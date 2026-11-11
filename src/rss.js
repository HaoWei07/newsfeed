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
        const topics = extractTopics(
          item.title,
          item.raw_snippet,
          item.category,
          item.raw_categories,
          persona.topic_keywords,
          persona.topic_weights
        );
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

    if (insertedCount > 0) {
      db.prepare("DELETE FROM articles WHERE category = ? AND guid LIKE 'seed-%'").run(feed.category);
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

