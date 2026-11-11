import { XMLParser } from 'fast-xml-parser';
import { db, getPersona } from './db.js';
import { extractTopics, generateExtractiveSummary, scoreArticleWithPersona } from './persona.js';

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  textNodeName: '#text',
  cdataPropName: '__cdata',
  trimValues: true,
  parseTagValue: false
});

export function decodeHtmlAndStripTags(html = '') {
  if (!html) return '';
  let text = typeof html === 'object' ? (html.__cdata || html['#text'] || JSON.stringify(html)) : String(html);
  // Remove script and style tags
  text = text.replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, ' ');
  // Replace block tags with space/period
  text = text.replace(/<\/(p|div|li|h[1-6]|br)>/gi, '. ');
  // Strip remaining HTML tags
  text = text.replace(/<[^>]+>/g, ' ');
  // Decode common HTML entities
  const entities = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#39;': "'",
    '&apos;': "'",
    '&nbsp;': ' ',
    '&#8217;': "'",
    '&#8216;': "'",
    '&#8220;': '"',
    '&#8221;': '"',
    '&#8211;': '–',
    '&#8212;': '—',
    '&#038;': '&'
  };
  for (const [ent, char] of Object.entries(entities)) {
    text = text.split(ent).join(char);
  }
  text = text.replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(Number(dec)));
  text = text.replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
  // Collapse whitespace and duplicate periods
  return text.replace(/\.\s*\./g, '.').replace(/\s+/g, ' ').trim();
}

function extractNodeText(val) {
  if (!val) return '';
  if (typeof val === 'string') return val.trim();
  if (Array.isArray(val)) return extractNodeText(val[0]);
  if (typeof val === 'object') {
    return String(val.__cdata || val['#text'] || '').trim();
  }
  return String(val).trim();
}

function extractImageFromItem(item, rawHtml = '') {
  // Check media:content or media:thumbnail or enclosure
  const mediaContent = item['media:content'] || item['media:thumbnail'] || item.enclosure;
  if (mediaContent) {
    const first = Array.isArray(mediaContent) ? mediaContent[0] : mediaContent;
    if (first && first['@_url'] && /^https?:\/\//i.test(first['@_url'])) {
      return first['@_url'];
    }
  }
  // Check img tag inside raw HTML description
  const imgMatch = String(rawHtml).match(/<img[^>]+src=["'](https?:\/\/[^"']+)["']/i);
  if (imgMatch && imgMatch[1]) {
    return imgMatch[1];
  }
  return '';
}

export function parseRssXml(xmlString, feed) {
  const parsed = xmlParser.parse(xmlString);
  const channel = parsed?.rss?.channel || parsed?.['rdf:RDF'] || parsed?.feed;
  if (!channel) return [];

  let items = channel.item || channel.entry || [];
  if (!Array.isArray(items)) items = [items];

  const articles = [];
  for (const item of items.slice(0, 18)) {
    const title = decodeHtmlAndStripTags(extractNodeText(item.title));
    if (!title) continue;

    // Extract link
    let url = '';
    if (typeof item.link === 'string') {
      url = item.link.trim();
    } else if (Array.isArray(item.link)) {
      const alt = item.link.find(l => l['@_rel'] === 'alternate' || !l['@_rel']) || item.link[0];
      url = alt?.['@_href'] || extractNodeText(alt);
    } else if (item.link && typeof item.link === 'object') {
      url = item.link['@_href'] || extractNodeText(item.link);
    }
    if (!url) url = extractNodeText(item.guid) || extractNodeText(item.id) || feed.site_url;

    const guid = extractNodeText(item.guid) || extractNodeText(item.id) || url || `${feed.id}:${title}`;

    const rawDesc =
      extractNodeText(item['content:encoded']) ||
      extractNodeText(item.description) ||
      extractNodeText(item.summary) ||
      extractNodeText(item.content) ||
      '';

    const snippet = decodeHtmlAndStripTags(rawDesc).slice(0, 1000);
    const imageUrl = extractImageFromItem(item, rawDesc);

    const rawDate =
      extractNodeText(item.pubDate) ||
      extractNodeText(item.published) ||
      extractNodeText(item.updated) ||
      extractNodeText(item['dc:date']);

    let publishedAt = new Date().toISOString();
    if (rawDate) {
      const d = new Date(rawDate);
      if (!isNaN(d.getTime())) publishedAt = d.toISOString();
    }

    const author =
      decodeHtmlAndStripTags(
        extractNodeText(item['dc:creator']) ||
          extractNodeText(item.author?.name) ||
          extractNodeText(item.author)
      ) || '';

    // Extract raw categories
    let rawCats = [];
    if (item.category) {
      const catArr = Array.isArray(item.category) ? item.category : [item.category];
      rawCats = catArr
        .map(c => (typeof c === 'object' ? c['@_term'] || extractNodeText(c) : String(c)))
        .filter(Boolean);
    }

    articles.push({
      guid,
      feed_id: feed.id,
      category: feed.category,
      source_title: feed.title,
      title,
      url,
      author,
      published_at: publishedAt,
      raw_snippet: snippet,
      image_url: imageUrl,
      raw_categories: rawCats
    });
  }

  return articles;
}

/**
 * Fetches a single RSS feed and inserts/updates articles in SQLite
 */
export async function fetchSingleFeed(feed) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 9500);

  try {
    const response = await fetch(feed.url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'PulseNewsReader/1.0 (+https://localhost; RSS Aggregator)',
        Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*'
      }
    });
    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const xml = await response.text();
    const parsedItems = parseRssXml(xml, feed);
    const persona = getPersona();

    const insertArticle = db.prepare(`
      INSERT INTO articles (
        guid, feed_id, category, source_title, title, url, author, published_at,
        raw_snippet, image_url, ai_summary, key_takeaways, topics,
        base_score, relevance_score, match_reason, score_breakdown, is_ai_ranked
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
      ON CONFLICT(guid) DO NOTHING
    `);

    let insertedCount = 0;
    db.exec('BEGIN');
    try {
      for (const item of parsedItems) {
        const topics = extractTopics(item.title, item.raw_snippet, item.category, item.raw_categories);
        const { summary, takeaways } = generateExtractiveSummary(item.title, item.raw_snippet);
        const scored = scoreArticleWithPersona(
          {
            ...item,
            topics,
            feedback: 0,
            click_count: 0
          },
          persona
        );

        const res = insertArticle.run(
          item.guid,
          item.feed_id,
          item.category,
          item.source_title,
          item.title,
          item.url,
          item.author,
          item.published_at,
          item.raw_snippet,
          item.image_url,
          summary,
          JSON.stringify(takeaways),
          JSON.stringify(topics),
          scored.relevance_score,
          scored.relevance_score,
          scored.match_reason,
          JSON.stringify(scored.score_breakdown)
        );
        if (res.changes > 0) insertedCount++;
      }
      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }

    db.prepare('UPDATE feeds SET last_fetched_at = ?, last_error = NULL WHERE id = ?').run(
      new Date().toISOString(),
      feed.id
    );

    return { feedId: feed.id, title: feed.title, insertedCount, totalParsed: parsedItems.length };
  } catch (err) {
    clearTimeout(timeout);
    const errMsg = err?.message || 'Failed to fetch feed';
    db.prepare('UPDATE feeds SET last_error = ? WHERE id = ?').run(errMsg, feed.id);
    return { feedId: feed.id, title: feed.title, error: errMsg, insertedCount: 0 };
  }
}

/**
 * Fetches all enabled feeds concurrently (or for a specific category)
 */
export async function syncAllFeeds(category = null) {
  const feeds = category && category !== 'all'
    ? db.prepare('SELECT * FROM feeds WHERE enabled = 1 AND category = ?').all(category)
    : db.prepare('SELECT * FROM feeds WHERE enabled = 1').all();

  const results = await Promise.all(feeds.map(f => fetchSingleFeed(f)));
  const totalInserted = results.reduce((acc, r) => acc + (r.insertedCount || 0), 0);
  const errors = results.filter(r => r.error);
  return {
    syncedFeeds: feeds.length,
    totalInserted,
    errors,
    results
  };
}

/**
 * Maps a folder name or feed title/URL from an Inoreader OPML export to one of the 5 categories
 */
export function inferCategoryFromOpmlOutline(folderName = '', title = '', xmlUrl = '') {
  const combined = `${folderName} ${title} ${xmlUrl}`.toLowerCase();
  if (/singapore|straitstimes|channelnewsasia|cna|mothership|todayonline|zaobao|businesstimes\.com\.sg|\.sg\b/.test(combined)) {
    return 'singapore';
  }
  if (/climate|environment|carbon|green|energy|earth|ecology|nature conservation|sustainability|grist|mongabay/.test(combined)) {
    return 'climate';
  }
  if (/science|physics|biology|quanta|space|nasa|astronomy|chemistry|medicine|neuro|nature\.com|sciencedaily|newscientist/.test(combined)) {
    return 'science';
  }
  if (/tech|software|programming|ai\b|hacker news|verge|arstechnica|wired|engadget|developer|startup|cyber|silicon/.test(combined)) {
    return 'tech';
  }
  return 'world';
}

/**
 * Parses an Inoreader / standard OPML XML file and imports feeds into the 5 categories
 */
export function importOpmlFeeds(opmlXmlString) {
  const parsed = xmlParser.parse(opmlXmlString);
  const body = parsed?.opml?.body;
  if (!body || !body.outline) {
    throw new Error('Invalid OPML file: missing <opml><body><outline> structure.');
  }

  const discovered = [];

  function walkOutlines(outlines, parentFolder = '') {
    const arr = Array.isArray(outlines) ? outlines : [outlines];
    for (const node of arr) {
      if (!node) continue;
      const xmlUrl = node['@_xmlUrl'] || node['@_url'];
      const title = node['@_title'] || node['@_text'] || 'Untitled Feed';
      const htmlUrl = node['@_htmlUrl'] || '';

      if (xmlUrl) {
        const category = inferCategoryFromOpmlOutline(parentFolder, title, xmlUrl);
        discovered.push({
          title: decodeHtmlAndStripTags(title),
          url: xmlUrl.trim(),
          site_url: htmlUrl.trim(),
          category
        });
      }
      if (node.outline) {
        walkOutlines(node.outline, title);
      }
    }
  }

  walkOutlines(body.outline, '');

  const insertStmt = db.prepare(`
    INSERT INTO feeds (title, url, site_url, category, enabled)
    VALUES (?, ?, ?, ?, 1)
    ON CONFLICT(url) DO UPDATE SET
      title = excluded.title,
      category = excluded.category,
      enabled = 1
  `);

  let imported = 0;
  db.exec('BEGIN');
  try {
    for (const f of discovered) {
      insertStmt.run(f.title, f.url, f.site_url, f.category);
      imported++;
    }
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }

  return { imported, feeds: discovered };
}

/**
 * Seeds initial curated articles across all 5 categories on first run so the interface
 * is immediately rich and interactive even before syncing external RSS feeds.
 */
export function seedInitialArticlesIfEmpty() {
  const count = db.prepare('SELECT COUNT(*) as count FROM articles').get().count;
  if (count > 0) return;

  const now = Date.now();
  const hoursAgo = h => new Date(now - h * 3600 * 1000).toISOString();

  const SEED_ARTICLES = [
    // 5) Local Singapore News
    {
      guid: 'seed-sg-1',
      category: 'singapore',
      source_title: 'CNA (Channel NewsAsia) - Singapore',
      title: 'Singapore Expands Cross-Border Clean Power Imports to 6GW Target by 2035 Amid Data Center Growth',
      url: 'https://www.channelnewsasia.com/singapore',
      author: 'CNA Singapore Desk',
      published_at: hoursAgo(1.5),
      raw_snippet: 'The Energy Market Authority (EMA) announced new conditional approvals for low-carbon electricity imports from regional ASEAN grids alongside domestic solar and geothermal feasibility pilots. The capacity expansion aims to power next-generation green data centers and semiconductor fabrication plants in Jurong and Tuas while keeping Singapore on track for net-zero emissions by 2050.',
      ai_summary: 'Singapore’s Energy Market Authority raised its low-carbon electricity import target to 6GW by 2035 through new ASEAN regional grid interconnects. The initiative specifically supports energy-intensive AI data centers and advanced manufacturing in Tuas and Jurong while maintaining national 2050 net-zero commitments.',
      key_takeaways: [
        'Low-carbon electricity import target raised to 6GW by 2035 via regional subsea cables.',
        'Directly supports green AI data center expansion and semiconductor fabs in Jurong & Tuas.',
        'Includes domestic deep-geothermal and grid-scale battery storage pilot deployments.'
      ],
      topics: ['Singapore Policy', 'Clean Energy', 'ASEAN Economy', 'AI & LLMs']
    },
    {
      guid: 'seed-sg-2',
      category: 'singapore',
      source_title: 'The Straits Times - Singapore',
      title: 'LTA Unveils Autonomous Shuttle Corridors and Next-Gen Rail Predictive Maintenance on Cross Island Line',
      url: 'https://www.straitstimes.com/singapore',
      author: 'Transport Correspondent',
      published_at: hoursAgo(3.2),
      raw_snippet: 'The Land Transport Authority (LTA) detailed plans to expand high-capacity autonomous feeder shuttles across Punggol, Tengah, and Jurong Lake District. Simultaneously, AI-driven acoustic and vibration sensors along the upcoming Cross Island Line will detect track wear weeks before faults occur, aiming to boost rail reliability above 2 million train-kilometers between delays.',
      ai_summary: 'LTA is rolling out autonomous feeder shuttle routes in Tengah, Punggol, and Jurong Lake District alongside AI predictive maintenance on the Cross Island Line. Continuous acoustic track sensing is projected to push MRT reliability past 2 million train-km between delays.',
      key_takeaways: [
        'Autonomous electric shuttles expanding to Tengah, Punggol, and Jurong Lake District.',
        'Cross Island Line integrates real-time acoustic and optical rail diagnostics.',
        'Targets >2M train-km mean kilometer between failure (MKBF) across the MRT network.'
      ],
      topics: ['Public Transport & Urban Planning', 'Singapore Policy', 'AI & LLMs']
    },
    {
      guid: 'seed-sg-3',
      category: 'singapore',
      source_title: 'Mothership.sg',
      title: 'Johor-Singapore Special Economic Zone (JS-SEZ) Launches Passport-Free QR Clearance & Fast-Track Tech Visas',
      url: 'https://mothership.sg',
      author: 'Mothership News',
      published_at: hoursAgo(5.0),
      raw_snippet: 'Businesses operating across Singapore and Iskandar Malaysia can now tap unified customs clearance, QR-code commuter lanes at Woodlands and Tuas checkpoints, and a harmonized talent pass for engineers in renewable energy, logistics, and advanced manufacturing.',
      ai_summary: 'The Johor-Singapore Special Economic Zone (JS-SEZ) rolled out unified customs channels and QR-code border clearance at Woodlands and Tuas. Cross-border engineering and clean-tech firms also gain access to fast-track regional talent passes.',
      key_takeaways: [
        'Unified customs and QR-code clearance live across Woodlands and Tuas checkpoints.',
        'Targets cross-border supply chains in clean energy, medtech, and logistics.',
        'Reduces peak-hour commercial cargo turnaround times by up to 40%.'
      ],
      topics: ['ASEAN Economy', 'Singapore Policy', 'Public Transport & Urban Planning']
    },

    // 3) Tech News
    {
      guid: 'seed-tech-1',
      category: 'tech',
      source_title: 'Ars Technica',
      title: 'Next-Gen Agentic Coding Workflows Cut End-to-End Verification Loops by 60% in Production Repositories',
      url: 'https://arstechnica.com',
      author: 'Kyle Orland',
      published_at: hoursAgo(2.0),
      raw_snippet: 'Engineering teams adopting multi-step reasoning models with sandboxed terminal execution and automated property-based testing report dramatic reductions in bug escape rates. Rather than single-turn autocomplete, modern agentic harnesses orchestrate dependency migrations, database schema updates, and live integration tests autonomously.',
      ai_summary: 'Long-context reasoning models paired with sandboxed test execution have reduced verification overhead by 60% across enterprise codebases. Engineering teams are shifting from line-by-line autocomplete to autonomous schema migrations and property-based test verification.',
      key_takeaways: [
        'Sandboxed agentic verification reduces production bug escape rates significantly.',
        '1M-token context windows allow full-repository dependency graph reasoning.',
        'Shift from IDE autocomplete toward autonomous test-and-repair loops.'
      ],
      topics: ['AI & LLMs', 'Software & Cloud']
    },
    {
      guid: 'seed-tech-2',
      category: 'tech',
      source_title: 'Hacker News (Frontpage)',
      title: 'Show HN: Sub-Millisecond Local SQLite Vector & Full-Text Hybrid Search in Pure WebAssembly',
      url: 'https://news.ycombinator.com',
      author: 'hn_community',
      published_at: hoursAgo(4.1),
      raw_snippet: 'We built a zero-dependency hybrid BM25 + quantized HNSW vector index extension that runs inside Node.js built-in SQLite and browser Origin-Private File System (OPFS). Benchmarks on 250,000 technical documents show 0.7ms p95 query latency with 4x lower memory footprint.',
      ai_summary: 'A new open-source SQLite extension combines BM25 full-text search with quantized vector indexing in WebAssembly and Node.js. It achieves 0.7ms p95 query latency over 250k documents with a 75% reduction in RAM usage.',
      key_takeaways: [
        'Combines lexical BM25 and quantized vector search inside a single SQLite file.',
        '0.7ms p95 latency across 250k documents without external database servers.',
        'Runs natively in Node 24 sqlite and browser OPFS.'
      ],
      topics: ['Software & Cloud', 'AI & LLMs']
    },
    {
      guid: 'seed-tech-3',
      category: 'tech',
      source_title: 'The Verge',
      title: 'Silicon Photonics Interconnects Break the Memory Wall for Next-Gen AI Inference Clusters',
      url: 'https://www.theverge.com',
      author: 'Nilay Patel',
      published_at: hoursAgo(6.5),
      raw_snippet: 'Foundries and optical chip startups demonstrated co-packaged optics (CPO) capable of transferring 1.6 terabits per second per fiber directly between accelerator packages, cutting data center interconnect power consumption by more than half compared to copper.',
      ai_summary: 'Co-packaged silicon photonics interconnects achieved 1.6 Tbps per optical fiber directly between AI accelerator dies. The breakthrough slashes cluster interconnect power draw by over 50% compared to traditional copper interconnects.',
      key_takeaways: [
        'Co-packaged optics (CPO) delivers 1.6 Tbps bandwidth directly chip-to-chip.',
        'Cuts AI cluster network energy consumption by more than 50%.',
        'Volume foundry production scheduled for hyperscale deployment next year.'
      ],
      topics: ['Semiconductors', 'AI & LLMs', 'Clean Energy']
    },

    // 2) Environment / Climate News
    {
      guid: 'seed-climate-1',
      category: 'climate',
      source_title: 'Carbon Brief',
      title: 'Global Grid-Scale Sodium-Ion Battery Installations Triple as Utility Storage Costs Fall Below $55/kWh',
      url: 'https://www.carbonbrief.org',
      author: 'Simon Evans',
      published_at: hoursAgo(2.4),
      raw_snippet: 'Abundant sodium-ion battery cells free of lithium, cobalt, and nickel have reached commercial parity for stationary solar-plus-storage plants across Asia and Europe. With pack costs dropping below $55/kWh and superior thermal stability in tropical climates, utilities are pairing 8-hour storage blocks with utility-scale PV.',
      ai_summary: 'Grid-scale sodium-ion battery deployments tripled over the past year as pack costs fell below $55/kWh. Free of lithium and cobalt, the chemistry excels in hot tropical climates and enables 8-hour firm solar dispatch.',
      key_takeaways: [
        'Stationary storage pack costs dropped below $55/kWh using abundant sodium salts.',
        'Eliminates supply-chain bottlenecks around lithium, cobalt, and nickel.',
        'High thermal resilience makes it ideal for Southeast Asian tropical grids.'
      ],
      topics: ['Clean Energy', 'Climate Science', 'ASEAN Economy']
    },
    {
      guid: 'seed-climate-2',
      category: 'climate',
      source_title: 'The Guardian - Environment',
      title: 'Satellite Methane Trackers Pinpoint Ultra-Emitters in Real Time, Prompting Rapid Pipeline Repairs Across 14 Countries',
      url: 'https://www.theguardian.com/environment',
      author: 'Damian Carrington',
      published_at: hoursAgo(5.8),
      raw_snippet: 'High-resolution hyperspectral satellites operated by international climate coalitions identified over 400 previously unreported methane plumes from oil, gas, and landfill sites. Automated regulatory alerts led operators to seal leaks equivalent to taking 18 million combustion cars off the road.',
      ai_summary: 'Hyperspectral methane satellites detected 400+ major fugitive emission plumes globally, triggering automated alerts that resulted in verified repairs across 14 countries—equivalent to removing 18 million cars from the road.',
      key_takeaways: [
        '400+ super-emitter methane leaks pinpointed from orbit with facility-level precision.',
        'Rapid valve and pipeline repairs abated emissions equal to 18M vehicles.',
        'Mandatory satellite verification is now being integrated into LNG import standards.'
      ],
      topics: ['Climate Science', 'Space & Physics', 'Clean Energy']
    },

    // 4) Science News
    {
      guid: 'seed-science-1',
      category: 'science',
      source_title: 'Quanta Magazine',
      title: 'Physicists Observe Fault-Tolerant Logical Qubits Outperforming Physical Qubits Across 1,000 Error-Correction Cycles',
      url: 'https://www.quantamagazine.org',
      author: 'charlie wood',
      published_at: hoursAgo(3.0),
      raw_snippet: 'By encoding quantum information across topological LDPC codes on a neutral-atom processor, researchers suppressed logical error rates exponentially below the physical gate threshold across 1,000 syndrome extraction rounds—a critical milestone toward practical quantum simulation of catalysts and materials.',
      ai_summary: 'Researchers demonstrated logical qubits encoded with low-density parity-check (LDPC) codes that maintained coherence across 1,000 error-correction cycles. Logical error rates fell exponentially below physical qubit thresholds, paving the way for materials simulation.',
      key_takeaways: [
        'Topological LDPC codes require 8x fewer physical qubits per logical qubit than surface codes.',
        'Sustained below-threshold error suppression across 1,000 consecutive syndrome rounds.',
        'Opens near-term quantum simulations for nitrogen fixation and battery electrolytes.'
      ],
      topics: ['Space & Physics', 'Semiconductors', 'Clean Energy']
    },
    {
      guid: 'seed-science-2',
      category: 'science',
      source_title: 'Nature - News & Comment',
      title: 'Programmable Epigenetic Editors Silence Disease-Causing Genes Durably Without Cutting DNA Strands',
      url: 'https://www.nature.com',
      author: 'Heidi Ledford',
      published_at: hoursAgo(7.2),
      raw_snippet: 'Unlike standard CRISPR-Cas9 nucleases that introduce double-stranded DNA breaks, a new compact epigenetic editor recruits endogenous methylation machinery to switch off target genes in liver and neural tissues permanently while avoiding chromosomal rearrangements.',
      ai_summary: 'Scientists unveiled a compact epigenetic editor that permanently silences disease-linked genes via targeted DNA methylation without cutting the double helix, eliminating risks of off-target chromosomal breaks.',
      key_takeaways: [
        'Silences target genes durably without double-stranded DNA cleavage.',
        'Avoids genotoxicity and chromosomal translocation risks of classic CRISPR nucleases.',
        'Demonstrated >92% PCSK9 cholesterol gene repression in preclinical models.'
      ],
      topics: ['Biotech & Medicine', 'Science Research']
    },

    // 1) World News
    {
      guid: 'seed-world-1',
      category: 'world',
      source_title: 'BBC News - World',
      title: 'ASEAN and EU Sign Digital Trade & Green Corridor Pact to Harmonize Cross-Border Supply Chains',
      url: 'https://www.bbc.com/news/world',
      author: 'BBC World Service',
      published_at: hoursAgo(2.8),
      raw_snippet: 'Trade ministers from ASEAN and the European Union finalized a landmark framework covering mutual recognition of electronic trade documents, carbon-accounting interoperability, and critical mineral supply chain resilience, with Singapore and Vietnam serving as initial digital clearing hubs.',
      ai_summary: 'ASEAN and the EU signed a Digital Trade and Green Corridor agreement standardizing paperless customs, carbon-footprint verification, and critical mineral supply chains, with Singapore and Vietnam acting as primary clearing hubs.',
      key_takeaways: [
        'Harmonizes electronic invoicing and customs clearing between ASEAN and the EU.',
        'Establishes mutual recognition for industrial carbon accounting to ease CBAM compliance.',
        'Designates Singapore and Vietnam as initial digital trade clearing nodes.'
      ],
      topics: ['Geopolitics', 'ASEAN Economy', 'Global Economy', 'Singapore Policy']
    },
    {
      guid: 'seed-world-2',
      category: 'world',
      source_title: 'The Guardian - World News',
      title: 'Central Banks Coordinate Instant Cross-Border Wholesale Settlement Network Across 12 Currencies',
      url: 'https://www.theguardian.com/world',
      author: 'Economics Editor',
      published_at: hoursAgo(6.0),
      raw_snippet: 'The Bank for International Settlements (BIS) Innovation Hub and participating central banks—including the Monetary Authority of Singapore, ECB, and Bank of England—completed live wholesale settlement trials reducing international treasury clearing from two days to under four seconds.',
      ai_summary: 'A coalition of 12 central banks including MAS and the ECB completed live multi-currency wholesale settlement trials, cutting cross-border institutional FX clearing times from 48 hours to under 4 seconds.',
      key_takeaways: [
        'Reduces cross-border wholesale FX settlement from T+2 days to under 4 seconds.',
        'Co-developed with the BIS Innovation Hub and Monetary Authority of Singapore (MAS).',
        'Cuts correspondent banking liquidity costs for international trade by up to 65%.'
      ],
      topics: ['Global Economy', 'Geopolitics', 'Singapore Policy']
    }
  ];

  const persona = getPersona();
  const insertStmt = db.prepare(`
    INSERT OR IGNORE INTO articles (
      guid, feed_id, category, source_title, title, url, author, published_at,
      raw_snippet, image_url, ai_summary, key_takeaways, topics,
      base_score, relevance_score, match_reason, score_breakdown, is_ai_ranked
    ) VALUES (?, NULL, ?, ?, ?, ?, ?, ?, ?, '', ?, ?, ?, ?, ?, ?, ?, 0)
  `);

  db.exec('BEGIN');
  try {
    for (const item of SEED_ARTICLES) {
      const scored = scoreArticleWithPersona({ ...item, feedback: 0, click_count: 0 }, persona);
      insertStmt.run(
        item.guid,
        item.category,
        item.source_title,
        item.title,
        item.url,
        item.author,
        item.published_at,
        item.raw_snippet,
        item.ai_summary,
        JSON.stringify(item.key_takeaways),
        JSON.stringify(item.topics),
        scored.relevance_score,
        scored.relevance_score,
        scored.match_reason,
        JSON.stringify(scored.score_breakdown)
      );
    }
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}
