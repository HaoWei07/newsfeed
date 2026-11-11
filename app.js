// ============================================================================
// Pulse Reader — Universal Client (Works on GitHub Pages / Mobile & Local Node)
// ============================================================================

const DEFAULT_CATEGORIES = [
  {
    id: 'world',
    name: 'World News',
    shortName: 'World',
    color: '#3b82f6',
    description: 'Geopolitics, international affairs, global economy & diplomacy — ranked for your persona'
  },
  {
    id: 'climate',
    name: 'Environment & Climate',
    shortName: 'Climate',
    color: '#10b981',
    description: 'Climate science, energy transition, biodiversity & sustainability policy — ranked for your persona'
  },
  {
    id: 'tech',
    name: 'Tech News',
    shortName: 'Tech',
    color: '#8b5cf6',
    description: 'AI, software engineering, semiconductors, startups & digital policy — ranked for your persona'
  },
  {
    id: 'science',
    name: 'Science News',
    shortName: 'Science',
    color: '#f59e0b',
    description: 'Physics, biotechnology, space exploration, medicine & peer-reviewed breakthroughs — ranked for your persona'
  },
  {
    id: 'singapore',
    name: 'Local Singapore',
    shortName: 'Singapore',
    color: '#ef4444',
    description: 'Singapore policy, economy, urban transport, housing, ASEAN & local affairs — ranked for your persona'
  }
];

const DEFAULT_FEEDS = [
  // World News
  { id: 1, title: 'BBC News - World', url: 'https://feeds.bbci.co.uk/news/world/rss.xml', category: 'world' },
  { id: 2, title: 'The Guardian - World News', url: 'https://www.theguardian.com/world/rss', category: 'world' },
  { id: 3, title: 'Al Jazeera - All News', url: 'https://www.aljazeera.com/xml/rss/all.xml', category: 'world' },
  // Environment & Climate
  { id: 4, title: 'Carbon Brief', url: 'https://www.carbonbrief.org/feed/', category: 'climate' },
  { id: 5, title: 'The Guardian - Environment', url: 'https://www.theguardian.com/environment/rss', category: 'climate' },
  { id: 6, title: 'Grist - Climate & Justice', url: 'https://grist.org/feed/', category: 'climate' },
  // Tech News
  { id: 7, title: 'Ars Technica', url: 'https://feeds.arstechnica.com/arstechnica/index', category: 'tech' },
  { id: 8, title: 'Hacker News (Frontpage)', url: 'https://hnrss.org/frontpage', category: 'tech' },
  { id: 9, title: 'The Verge', url: 'https://www.theverge.com/rss/index.xml', category: 'tech' },
  // Science News
  { id: 10, title: 'Quanta Magazine', url: 'https://api.quantamagazine.org/v1/feed/', category: 'science' },
  { id: 11, title: 'Nature - News & Comment', url: 'https://www.nature.com/nature.rss', category: 'science' },
  { id: 12, title: 'ScienceDaily - Top Science', url: 'https://www.sciencedaily.com/rss/top/science.xml', category: 'science' },
  // Local Singapore
  { id: 13, title: 'CNA (Channel NewsAsia) - Singapore', url: 'https://www.channelnewsasia.com/api/v1/rss-outbound-feed?_format=xml&category=10416', category: 'singapore' },
  { id: 14, title: 'The Straits Times - Singapore', url: 'https://www.straitstimes.com/news/singapore/rss.xml', category: 'singapore' },
  { id: 15, title: 'Mothership.sg', url: 'https://mothership.sg/feed/', category: 'singapore' }
];

const DEFAULT_PERSONA = {
  bio_summary:
    'Curious reader based in Singapore who follows global geopolitics, climate tech and clean energy policy, AI & software breakthroughs, fundamental science discoveries, and Singapore urban/economic developments. Prefers high-signal, analytical reporting over sensationalism or clickbait.',
  preferred_depth: 'balanced',
  topic_weights: {
    'Geology & Geotechnics': 6.0,
	'Geodesy & Geospatial Analytics': 6.0,
	'Clean Energy': 5,
    'Climate Science': 5.0,
	'AI & LLMs': 4.5,
    'Singapore Policy': 4.0,
    'Geopolitics': 3.0,
    'Space & Physics': 3.0,
    'Biotech & Medicine': 2.5,
    'ASEAN Economy': 3.5,
    'Public Transport & Urban Planning': 3.0,
    'Celebrity Gossip': -5.0,
    'Sponsored Content': -6.0
  },
  topic_keywords: {},
  source_weights: {},
  interactions_count: 0,
  interactions_since_synthesis: 0
};

const TOPIC_TAXONOMY = [
  { tag: 'AI & LLMs', keywords: ['ai', 'llm', 'artificial intelligence', 'gemini', 'openai', 'anthropic', 'deepmind', 'neural', 'machine learning', 'agentic', 'gpt', 'transformer', 'robotics', 'rag', 'genai', 'copilot'] },
  { tag: 'Software & Cloud', keywords: ['open source', 'linux', 'cloud', 'kubernetes', 'rust', 'typescript', 'developer', 'github', 'browser', 'database', 'api', 'programming', 'python', 'data analytics', 'sql', 'docker'] },
  { tag: 'Cybersecurity & Privacy', keywords: ['cybersecurity', 'hack', 'vulnerability', 'encryption', 'ransomware', 'zero-day', 'privacy', 'surveillance', 'breach', 'phishing', 'malware'] },
  { tag: 'Clean Energy', keywords: ['solar', 'wind power', 'battery', 'grid', 'renewable', 'nuclear', 'fusion', 'hydrogen', 'ev', 'electric vehicle', 'clean energy', 'geothermal', 'energy transition', 'decarbonization', 'green steel'] },
  { tag: 'Climate Science', keywords: ['climate', 'warming', 'emissions', 'carbon', 'co2', 'methane', 'ipcc', 'glacier', 'sea level', 'extreme weather', 'el nino', 'deforestation', 'net zero', 'air pollution'] },
  { tag: 'Biodiversity & Nature', keywords: ['biodiversity', 'species', 'conservation', 'ocean', 'coral', 'wildlife', 'ecosystem', 'rainforest', 'marine', 'extinction', 'pollution', 'plastics', 'land-use', 'sustainability'] },
  { tag: 'Space & Physics', keywords: ['nasa', 'spacex', 'telescope', 'jwst', 'quantum', 'physics', 'astronomy', 'exoplanet', 'black hole', 'mars', 'lunar', 'cosmology', 'cern', 'particle', 'satellite'] },
  { tag: 'Biotech & Medicine', keywords: ['crispr', 'gene', 'vaccine', 'clinical trial', 'longevity', 'neuroscience', 'brain', 'cancer', 'protein', 'microbiome', 'biotech', 'stem cell', 'rna', 'public health'] },
  { tag: 'Geopolitics', keywords: ['diplomacy', 'sanctions', 'nato', 'united nations', 'treaty', 'summit', 'foreign policy', 'security', 'conflict', 'ceasefire', 'trade war', 'tariff', 'election'] },
  { tag: 'Global Economy', keywords: ['inflation', 'central bank', 'fed', 'interest rate', 'gdp', 'supply chain', 'imf', 'markets', 'recession', 'trade', 'bonds', 'manufacturing', 'yield curve', 'treasuries', 'macroeconomics'] },
  { tag: 'Singapore Policy', keywords: ['pap', 'parliament', 'ministry', 'hdb', 'cpf', 'mas', 'monetary authority of singapore', 'ndp', 'singapore government', 'statutory', 'minister', 'budget', 'sla', 'ura', 'nea'] },
  { tag: 'Public Transport & Urban Planning', keywords: ['mrt', 'lta', 'bus', 'changi', 'bto', 'urban', 'tuas', 'jurong', 'cross island line', 'thomson-east coast', 'coe', 'erp', 'housing', 'infrastructure', 'spatial planning'] },
  { tag: 'ASEAN Economy', keywords: ['asean', 'johor', 'js-sez', 'malaysia', 'indonesia', 'vietnam', 'southeast asia', 'strait of malacca', 'regional hub', 'fdi'] },
  { tag: 'Geology & Geotechnics', keywords: ['geology', 'geosciences', 'soil mechanics', 'subsurface', 'geotechnical', 'mapping', 'earth materials', 'stratigraphy', 'petrology', 'geomorphology', 'earth system', 'site investigation'] },
  { tag: 'Geodesy & Geospatial Analytics', keywords: ['geodesy', 'geospatial', 'geomatics', 'gnss', 'rtk', 'ppp', 'insar', 'radar', 'remote sensing', 'gis', 'qgis', 'arcgis', 'spatial modeling', 'geopandas', 'sirent', 'bathymetry', 'cartography', 'spatial infrastructure'] }
];

const state = {
  isStaticMode: false, // Automatically detected on init (true on GitHub Pages, false on local Node server)
  categories: DEFAULT_CATEGORIES,
  persona: null,
  feeds: [],
  recentLogs: [],
  counts: {},
  settings: { hasApiKey: false, maskedApiKey: '', geminiModel: 'gemini-3.8-flash', rawApiKey: '' },
  allArticles: [],
  articles: [],
  activeCategory: 'world', // Explore each category individually!
  sort: 'relevance',
  unreadOnly: false,
  searchQuery: '',
  activeReaderArticleId: null
};

const CATEGORY_COLORS = {
  world: { bg: 'rgba(59, 130, 246, 0.16)', text: '#60a5fa', border: 'rgba(59, 130, 246, 0.35)', dot: '#3b82f6' },
  climate: { bg: 'rgba(16, 185, 129, 0.16)', text: '#34d399', border: 'rgba(16, 185, 129, 0.35)', dot: '#10b981' },
  tech: { bg: 'rgba(139, 92, 246, 0.16)', text: '#c4b5fd', border: 'rgba(139, 92, 246, 0.35)', dot: '#8b5cf6' },
  science: { bg: 'rgba(245, 158, 11, 0.16)', text: '#fbbf24', border: 'rgba(245, 158, 11, 0.35)', dot: '#f59e0b' },
  singapore: { bg: 'rgba(239, 68, 68, 0.16)', text: '#fca5a5', border: 'rgba(239, 68, 68, 0.35)', dot: '#ef4444' }
};

function escapeHtml(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatRelativeTime(isoDate) {
  if (!isoDate) return '';
  const diffMs = Date.now() - new Date(isoDate).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function showToast(message) {
  const container = document.getElementById('toast-container');
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = message;
  container.appendChild(el);
  setTimeout(() => el.remove(), 3600);
}

// ============================================================================
// Client-Side Scoring & RSS Engine (For GitHub Pages Static Hosting)
// ============================================================================

function matchesKeywordClient(textLower, kw) {
  const cleanKw = String(kw || '').trim().toLowerCase();
  if (!cleanKw) return false;
  if (cleanKw.length <= 3) {
    return new RegExp(`\\b${cleanKw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(textLower);
  }
  return textLower.includes(cleanKw);
}

function extractTopicsClient(title = '', snippet = '', category = 'world') {
  const combined = `${title} ${snippet}`.toLowerCase();
  const matched = new Set();
  for (const item of TOPIC_TAXONOMY) {
    for (const kw of item.keywords) {
      if (matchesKeywordClient(combined, kw)) {
        matched.add(item.tag);
        break;
      }
    }
  }
  // Also tag articles with user-added custom topics & keywords
  const customKeywords = state.persona?.topic_keywords || {};
  for (const [topic, kwList] of Object.entries(customKeywords)) {
    const terms = [topic, ...(Array.isArray(kwList) ? kwList : [])];
    if (terms.some(kw => matchesKeywordClient(combined, kw))) {
      matched.add(topic);
    }
  }
  for (const topic of Object.keys(state.persona?.topic_weights || {})) {
    if (matchesKeywordClient(combined, topic)) {
      matched.add(topic);
    }
  }

  if (matched.size === 0) {
    const fallback = {
      world: 'Geopolitics',
      climate: 'Climate Science',
      tech: 'AI & LLMs',
      science: 'Space & Physics',
      singapore: 'Singapore Policy'
    };
    matched.add(fallback[category] || 'World News');
  }
  return Array.from(matched).slice(0, 4);
}

function generateExtractiveSummaryClient(title = '', rawSnippet = '') {
  const cleanText = String(rawSnippet || '').replace(/\s+/g, ' ').trim();
  if (!cleanText || cleanText.length < 40) {
    return {
      summary: `${title}. Tap to read full coverage from the original source.`,
      takeaways: [title]
    };
  }
  const sentences = cleanText
    .split(/(?<=[.!?])\s+/)
    .map(s => s.trim())
    .filter(s => s.length > 25);
  if (sentences.length === 0) {
    return {
      summary: cleanText.slice(0, 260),
      takeaways: [cleanText.slice(0, 130)]
    };
  }
  return {
    summary: sentences.slice(0, 2).join(' '),
    takeaways: sentences.slice(0, 3).map(s => (s.length > 140 ? s.slice(0, 137) + '...' : s))
  };
}

function scoreArticleClient(article, persona) {
  const topicWeights = persona.topic_weights || {};
  const sourceWeights = persona.source_weights || {};
  const topics = Array.isArray(article.topics) ? article.topics : [];

  let score = 56;
  const matchedLikedTopics = [];
  const matchedDislikedTopics = [];

  let topicDelta = 0;
  let tagIndex = 0;
  for (const t of topics) {
    let weight = topicWeights[t];
    if (weight === undefined) {
      const foundKey = Object.keys(topicWeights).find(k => k.toLowerCase() === t.toLowerCase());
      if (foundKey) weight = topicWeights[foundKey];
    }
    if (typeof weight === 'number') {
      const decay = 1 / (1 + tagIndex * 0.35);
      topicDelta += weight * 2.3 * decay;
      tagIndex++;
      if (weight >= 1.5) matchedLikedTopics.push({ topic: t, weight });
      if (weight <= -1.5) matchedDislikedTopics.push({ topic: t, weight });
    }
  }

  const textLower = `${article.title || ''} ${article.raw_snippet || ''}`.toLowerCase();
  const customKeywords = persona.topic_keywords || {};
  for (const [topicKey, weight] of Object.entries(topicWeights)) {
    if (topics.some(t => t.toLowerCase() === topicKey.toLowerCase())) continue;
    const kwList = Array.isArray(customKeywords[topicKey]) ? customKeywords[topicKey] : [];
    const terms = [topicKey, ...kwList];
    if (terms.some(term => term.length >= 2 && matchesKeywordClient(textLower, term))) {
      topicDelta += weight * 1.6;
      if (weight >= 1.5) matchedLikedTopics.push({ topic: topicKey, weight });
      if (weight <= -1.5) matchedDislikedTopics.push({ topic: topicKey, weight });
    }
  }

  topicDelta = Math.max(-28, Math.min(30, topicDelta));
  score += topicDelta;

  const sourceWeight = sourceWeights[article.source_title] || 0;
  score += Math.max(-10, Math.min(12, sourceWeight * 2.2));

  let recencyDelta = 0;
  if (article.published_at) {
    const ageHours = Math.max(0, (Date.now() - new Date(article.published_at).getTime()) / 3600000);
    if (ageHours <= 12) recencyDelta = Number((5 - (ageHours / 12) * 3).toFixed(1));
    else if (ageHours <= 36) recencyDelta = 1.5;
    else if (ageHours > 120) recencyDelta = -4;
  }
  score += recencyDelta;

  if (article.feedback === 1) score += 15;
  if (article.feedback === -1) score -= 25;
  if (article.click_count > 0 && article.feedback >= 0) score += Math.min(6, article.click_count * 2);

  const finalScore = Math.max(5, Math.min(99, Math.round(score)));
  matchedLikedTopics.sort((a, b) => b.weight - a.weight);
  const topTopics = matchedLikedTopics.slice(0, 2).map(m => m.topic);

  let matchReason = 'Relevant to your feed';
  if (article.feedback === 1) {
    matchReason = `Boosted by your upvote${topTopics.length ? ` • ${topTopics.join(' & ')}` : ''}`;
  } else if (article.feedback === -1) {
    matchReason = 'Demoted based on your feedback';
  } else if (topTopics.length > 0) {
    matchReason = `Matches your interest in ${topTopics.join(' & ')}`;
  } else if (matchedDislikedTopics.length > 0) {
    matchReason = `Lowered due to muted topic (${matchedDislikedTopics[0].topic})`;
  } else if (sourceWeight >= 1.5) {
    matchReason = `From favored source ${article.source_title}`;
  }

  return { relevance_score: finalScore, match_reason: matchReason };
}

let cloudSyncTimer = null;

function saveStaticState(triggerCloudPush = true) {
  if (!state.isStaticMode) return;
  localStorage.setItem('pulse_persona_v2', JSON.stringify(state.persona));
  localStorage.setItem('pulse_feeds_v2', JSON.stringify(state.feeds));
  localStorage.setItem('pulse_articles_v2', JSON.stringify(state.allArticles));
  localStorage.setItem('pulse_logs_v2', JSON.stringify(state.recentLogs));

  if (triggerCloudPush && state.settings.ghToken && state.settings.ghRepo) {
    clearTimeout(cloudSyncTimer);
    cloudSyncTimer = setTimeout(() => {
      pushStateToGitHubCloud().catch(err => console.warn('Cloud sync push warning:', err.message));
    }, 1200);
  }
}

async function pullStateFromGitHubCloud(showFeedback = false) {
  const repo = state.settings.ghRepo || localStorage.getItem('pulse_gh_repo') || 'HaoWei07/pulse-rss-reader';
  const token = state.settings.ghToken || localStorage.getItem('pulse_gh_token') || '';
  if (!repo) return false;

  const headers = { Accept: 'application/vnd.github+json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`https://api.github.com/repos/${repo}/contents/cloud-sync.json`, {
    headers,
    cache: 'no-store'
  });
  if (!res.ok) {
    if (showFeedback) showToast('No cloud-sync.json found on GitHub yet — saving current state now.');
    return false;
  }
  const fileData = await res.json();
  state.cloudSyncSha = fileData.sha;
  const decoded = decodeURIComponent(escape(atob(fileData.content.replace(/\s/g, ''))));
  const payload = JSON.parse(decoded);

  if (payload.persona) state.persona = payload.persona;
  if (Array.isArray(payload.feeds) && payload.feeds.length > 0) {
    state.feeds = mergeWithDefaultFeeds(payload.feeds);
  }
  if (Array.isArray(payload.recentLogs)) state.recentLogs = payload.recentLogs;

  // Apply bookmarked / feedback / read flags from cloud onto articles by guid
  if (payload.articleStates && typeof payload.articleStates === 'object') {
    for (const art of state.allArticles) {
      const st = payload.articleStates[art.guid];
      if (st) {
        art.is_read = Boolean(st.is_read);
        art.feedback = st.feedback || 0;
        art.bookmarked = Boolean(st.bookmarked);
        art.click_count = st.click_count || 0;
      }
    }
  }

  saveStaticState(false);
  recalculateStaticScores();
  renderNavigation();
  renderPersonaSidebar();
  await loadArticles();
  if (showFeedback) showToast('Pulled latest Persona & RSS Feeds from GitHub!');
  return true;
}

async function pushStateToGitHubCloud(showFeedback = false) {
  const repo = state.settings.ghRepo || localStorage.getItem('pulse_gh_repo') || '';
  const token = state.settings.ghToken || localStorage.getItem('pulse_gh_token') || '';
  if (!repo || !token) return;

  const headers = {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json'
  };

  // Get current file SHA if needed
  let sha = state.cloudSyncSha;
  if (!sha) {
    const check = await fetch(`https://api.github.com/repos/${repo}/contents/cloud-sync.json`, {
      headers,
      cache: 'no-store'
    });
    if (check.ok) {
      const checkJson = await check.json();
      sha = checkJson.sha;
    }
  }

  const articleStates = {};
  for (const a of state.allArticles) {
    if (a.is_read || a.feedback !== 0 || a.bookmarked || a.click_count > 0) {
      articleStates[a.guid] = {
        is_read: a.is_read,
        feedback: a.feedback,
        bookmarked: a.bookmarked,
        click_count: a.click_count
      };
    }
  }

  const syncPayload = {
    updated_at: new Date().toISOString(),
    persona: state.persona,
    feeds: state.feeds,
    recentLogs: (state.recentLogs || []).slice(0, 20),
    articleStates
  };

  const base64Content = btoa(unescape(encodeURIComponent(JSON.stringify(syncPayload, null, 2))));
  const body = {
    message: 'Sync Pulse RSS feeds & evolving persona',
    content: base64Content
  };
  if (sha) body.sha = sha;

  const putRes = await fetch(`https://api.github.com/repos/${repo}/contents/cloud-sync.json`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(body)
  });

  if (!putRes.ok) {
    const errData = await putRes.json().catch(() => ({}));
    throw new Error(errData.message || `GitHub sync failed (${putRes.status})`);
  }
  const putJson = await putRes.json();
  state.cloudSyncSha = putJson.content?.sha || sha;
  if (showFeedback) showToast('Synced Persona & Feeds to GitHub!');
}

function mergeWithDefaultFeeds(storedFeeds) {
  if (!Array.isArray(storedFeeds) || storedFeeds.length === 0) {
    return structuredClone(DEFAULT_FEEDS);
  }
  const merged = [...storedFeeds];
  for (const def of DEFAULT_FEEDS) {
    if (!merged.some(f => f.url === def.url)) {
      merged.push({ ...def });
    }
  }
  return merged;
}

function recalculateStaticScores() {
  for (const art of state.allArticles) {
    if (!art.is_ai_ranked) {
      art.topics = extractTopicsClient(art.title, art.raw_snippet, art.category);
    }
    const computed = scoreArticleClient(art, state.persona);
    if (art.is_ai_ranked && art.base_score) {
      art.relevance_score = Math.max(5, Math.min(99, Math.round(art.base_score * 0.55 + computed.relevance_score * 0.45)));
    } else {
      art.relevance_score = computed.relevance_score;
      art.match_reason = computed.match_reason;
    }
  }
  const counts = { all: state.allArticles.length, saved: 0 };
  for (const c of state.categories) counts[c.id] = 0;
  for (const a of state.allArticles) {
    counts[a.category] = (counts[a.category] || 0) + 1;
    if (a.bookmarked) counts.saved++;
  }
  state.counts = counts;
  saveStaticState();
}

function extractXmlArticleLink(item, fallbackUrl) {
  // 1. Check Atom <link rel="alternate" href="..."> or any <link href="...">
  const links = Array.from(item.querySelectorAll('link'));
  const altLink = links.find(l => {
    const rel = (l.getAttribute('rel') || '').toLowerCase();
    return (!rel || rel === 'alternate') && l.getAttribute('href');
  });
  if (altLink) {
    const href = altLink.getAttribute('href').trim();
    if (/^https?:\/\//i.test(href)) return href;
  }

  // 2. Check RSS 2.0 <link>https://...</link> text content
  for (const l of links) {
    const txt = (l.textContent || '').trim();
    if (/^https?:\/\//i.test(txt)) return txt;
  }

  // 3. Check <guid> if it is a URL
  const guidNode = item.querySelector('guid, id');
  const guidText = (guidNode?.textContent || '').trim();
  if (/^https?:\/\//i.test(guidText)) return guidText;

  return fallbackUrl;
}

async function fetchFeedRawXmlOrJson(feedUrl) {
  // Strategy 1: rss2json (very reliable on mobile & GitHub Pages, returns clean per-item links)
  try {
    const r2j = await fetch(`https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(feedUrl)}`);
    if (r2j.ok) {
      const json = await r2j.json();
      if (json.status === 'ok' && Array.isArray(json.items) && json.items.length > 0) {
        return { type: 'json', items: json.items };
      }
    }
  } catch {}

  // Strategy 2: AllOrigins raw XML
  try {
    const ao = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(feedUrl)}`);
    if (ao.ok) {
      const data = await ao.json();
      if (data.contents && data.contents.includes('<')) {
        return { type: 'xml', xml: data.contents };
      }
    }
  } catch {}

  // Strategy 3: corsproxy.io raw XML
  try {
    const cp = await fetch(`https://corsproxy.io/?url=${encodeURIComponent(feedUrl)}`);
    if (cp.ok) {
      const xml = await cp.text();
      if (xml && xml.includes('<')) {
        return { type: 'xml', xml };
      }
    }
  } catch {}

  throw new Error(`Could not reach feed (${feedUrl})`);
}

async function fetchRssFeedStatic(feed) {
  const payload = await fetchFeedRawXmlOrJson(feed.url);
  let normalizedItems = [];

  if (payload.type === 'json') {
    normalizedItems = payload.items.slice(0, 12).map(it => ({
      title: (it.title || '').replace(/<[^>]+>/g, '').trim(),
      url: (it.link || it.guid || feed.url).trim(),
      guid: (it.guid || it.link || `${feed.id}:${it.title}`).trim(),
      rawDesc: it.description || it.content || '',
      pubText: it.pubDate || ''
    }));
  } else {
    const parser = new DOMParser();
    const doc = parser.parseFromString(payload.xml, 'text/xml');
    const items = Array.from(doc.querySelectorAll('item, entry')).slice(0, 12);
    normalizedItems = items.map(item => ({
      title: (item.querySelector('title')?.textContent || '').trim(),
      url: extractXmlArticleLink(item, feed.url),
      guid: (item.querySelector('guid, id')?.textContent || extractXmlArticleLink(item, feed.url) || `${feed.id}:${item.querySelector('title')?.textContent || ''}`).trim(),
      rawDesc: item.querySelector('description, summary, content')?.textContent || '',
      pubText: item.querySelector('pubDate, published, updated')?.textContent || ''
    }));
  }

  let added = 0;
  for (const item of normalizedItems) {
    if (!item.title) continue;
    if (state.allArticles.some(a => a.guid === item.guid || a.url === item.url)) continue;

    const snippet = item.rawDesc.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 800);
    const publishedAt = item.pubText && !isNaN(new Date(item.pubText).getTime())
      ? new Date(item.pubText).toISOString()
      : new Date().toISOString();

    const topics = extractTopicsClient(item.title, snippet, feed.category);
    const { summary, takeaways } = generateExtractiveSummaryClient(item.title, snippet);
    const newArt = {
      id: Date.now() + Math.floor(Math.random() * 100000),
      guid: item.guid,
      category: feed.category,
      source_title: feed.title,
      title: item.title,
      url: item.url,
      published_at: publishedAt,
      raw_snippet: snippet,
      ai_summary: summary,
      key_takeaways: takeaways,
      topics,
      is_read: false,
      feedback: 0,
      bookmarked: false,
      click_count: 0
    };
    const scored = scoreArticleClient(newArt, state.persona);
    newArt.relevance_score = scored.relevance_score;
    newArt.match_reason = scored.match_reason;
    state.allArticles.unshift(newArt);
    added++;
  }

  // Once real articles exist for this category, remove placeholder seed-* demo articles for it
  const hasRealArticlesInCat = state.allArticles.some(
    a => a.category === feed.category && !String(a.guid).startsWith('seed-')
  );
  if (hasRealArticlesInCat) {
    state.allArticles = state.allArticles.filter(
      a => a.category !== feed.category || !String(a.guid).startsWith('seed-')
    );
  }

  return added;
}

// ============================================================================
// Core App Initialization & Mode Detection
// ============================================================================

async function apiFetch(url, options = {}) {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data;
}

async function initAppModeAndState() {
  try {
    const data = await apiFetch('/api/state');
    state.isStaticMode = false;
    state.categories = data.categories;
    state.persona = data.persona;
    state.feeds = data.feeds;
    state.recentLogs = data.recentLogs;
    state.counts = data.counts;
    state.settings = data.settings;
  } catch {
    // Running on GitHub Pages / Static Mobile Browser!
    state.isStaticMode = true;
    state.categories = DEFAULT_CATEGORIES;
    state.persona = JSON.parse(localStorage.getItem('pulse_persona_v2') || 'null') || structuredClone(DEFAULT_PERSONA);
    if (!state.persona.topic_keywords) state.persona.topic_keywords = {};
    if (!Array.isArray(state.persona.dismissed_topics)) state.persona.dismissed_topics = [];
    // Merge any newly added default topic weights from code unless explicitly dismissed
    for (const [k, w] of Object.entries(DEFAULT_PERSONA.topic_weights)) {
      if (state.persona.topic_weights[k] === undefined && !state.persona.dismissed_topics.includes(k)) {
        state.persona.topic_weights[k] = w;
      }
    }
    const storedFeeds = JSON.parse(localStorage.getItem('pulse_feeds_v2') || 'null');
    state.feeds = mergeWithDefaultFeeds(storedFeeds);
    const cachedArticles = JSON.parse(localStorage.getItem('pulse_articles_v2') || 'null') || [];
    state.allArticles = cachedArticles.filter(a => !String(a.guid || '').startsWith('seed-'));
    state.recentLogs = JSON.parse(localStorage.getItem('pulse_logs_v2') || '[]');
    const savedKey = localStorage.getItem('pulse_gemini_key') || '';
    const savedModel = localStorage.getItem('pulse_gemini_model') || 'gemini-3.8-flash';
    const ghRepo = localStorage.getItem('pulse_gh_repo') || 'HaoWei07/pulse-rss-reader';
    const ghToken = localStorage.getItem('pulse_gh_token') || '';
    state.settings = {
      hasApiKey: Boolean(savedKey),
      maskedApiKey: savedKey ? `${savedKey.slice(0, 4)}...${savedKey.slice(-4)}` : '',
      geminiModel: savedModel,
      rawApiKey: savedKey,
      ghRepo,
      ghToken
    };
    recalculateStaticScores();
    // Automatically pull latest shared Persona & Feeds from GitHub repo if available
    pullStateFromGitHubCloud(false).catch(() => {});
  }

  renderNavigation();
  renderPersonaSidebar();
  updateApiStatusIndicator();
}

async function loadArticles() {
  if (!state.isStaticMode) {
    const params = new URLSearchParams({
      category: state.activeCategory,
      sort: state.sort,
      unreadOnly: String(state.unreadOnly),
      q: state.searchQuery
    });
    const data = await apiFetch(`/api/articles?${params.toString()}`);
    state.articles = data.articles;
  } else {
    let list = [...state.allArticles];
    if (state.activeCategory === 'saved') {
      list = list.filter(a => a.bookmarked);
    } else if (state.activeCategory !== 'all') {
      list = list.filter(a => a.category === state.activeCategory);
    }
    if (state.unreadOnly) {
      list = list.filter(a => !a.is_read);
    }
    if (state.searchQuery) {
      const q = state.searchQuery.toLowerCase();
      list = list.filter(
        a =>
          (a.title || '').toLowerCase().includes(q) ||
          (a.ai_summary || '').toLowerCase().includes(q) ||
          (a.source_title || '').toLowerCase().includes(q) ||
          (a.topics || []).some(t => t.toLowerCase().includes(q))
      );
    }
    if (state.sort === 'latest') {
      list.sort((a, b) => new Date(b.published_at) - new Date(a.published_at));
    } else if (state.sort === 'top_unread') {
      list.sort((a, b) => Number(a.is_read) - Number(b.is_read) || b.relevance_score - a.relevance_score);
    } else {
      list.sort((a, b) => b.relevance_score - a.relevance_score);
    }
    state.articles = list;
  }

  renderFeedHeader();
  renderArticles();
}

function updateApiStatusIndicator() {
  const dot = document.getElementById('api-status-dot');
  const statusHint = document.getElementById('current-key-status');
  if (state.settings.hasApiKey) {
    dot.classList.add('connected');
    dot.title = `Gemini API connected (${state.settings.geminiModel})`;
    if (statusHint) {
      statusHint.textContent = `Configured (${state.settings.maskedApiKey}) • Active model: ${state.settings.geminiModel}`;
    }
  } else {
    dot.classList.remove('connected');
    dot.title = 'No GEMINI_API_KEY configured yet (using built-in persona ranker)';
    if (statusHint) {
      statusHint.textContent = 'No API key saved yet. Enter your GEMINI_API_KEY to unlock live Gemini 3.8 Flash synthesis.';
    }
  }
}

function renderNavigation() {
  const nav = document.getElementById('category-nav');
  const mobileNav = document.getElementById('mobile-category-tabs');

  // Clean category names WITHOUT 1), 2) placeholder numbers!
  const items = [
    ...state.categories.map(c => ({
      id: c.id,
      name: c.name,
      shortName: c.shortName,
      dotColor: CATEGORY_COLORS[c.id]?.dot || c.color,
      count: state.counts[c.id] || 0
    })),
    {
      id: 'saved',
      name: 'Saved Articles',
      shortName: 'Saved',
      dotColor: '#f59e0b',
      count: state.counts.saved || 0
    }
  ];

  nav.innerHTML = items
    .map(
      item => `
      <button class="nav-item ${state.activeCategory === item.id ? 'active' : ''}" data-cat="${item.id}">
        <span class="nav-item-left">
          <span class="cat-dot" style="background:${item.dotColor}"></span>
          <span>${escapeHtml(item.name)}</span>
        </span>
        <span class="nav-count">${item.count}</span>
      </button>
    `
    )
    .join('');

  if (mobileNav) {
    mobileNav.innerHTML = items
      .map(
        item => `
        <button class="mobile-cat-pill ${state.activeCategory === item.id ? 'active' : ''}" data-cat="${item.id}">
          <span class="cat-dot" style="background:${item.dotColor}"></span>
          <span>${escapeHtml(item.name)}</span>
          <span style="opacity:0.7; font-size:11px;">(${item.count})</span>
        </button>
      `
      )
      .join('');
  }

  document.querySelectorAll('[data-cat]').forEach(btn => {
    btn.addEventListener('click', async () => {
      state.activeCategory = btn.dataset.cat;
      document.getElementById('briefing-panel').classList.add('hidden');
      renderNavigation();
      await loadArticles();
      // Auto-sync live RSS articles when opening a category with no articles yet
      if (state.activeCategory !== 'saved' && state.articles.length === 0) {
        triggerSyncFeeds(true);
      }
    });
  });
}

function renderFeedHeader() {
  const titleEl = document.getElementById('current-view-title');
  const countEl = document.getElementById('current-view-count');
  const descEl = document.getElementById('current-view-desc');

  countEl.textContent = `${state.articles.length} articles`;

  if (state.activeCategory === 'saved') {
    titleEl.textContent = 'Saved Articles';
    descEl.textContent = 'Your bookmarked stories ranked by relevance';
  } else {
    const cat = state.categories.find(c => c.id === state.activeCategory);
    if (cat) {
      titleEl.textContent = cat.name;
      descEl.textContent = cat.description;
    }
  }
}

function renderArticles() {
  const container = document.getElementById('articles-container');
  if (!state.articles || state.articles.length === 0) {
    container.innerHTML = `
      <div class="article-card" style="text-align:center; padding: 40px 20px;">
        <h3 style="margin-bottom:8px;">No articles in this view yet</h3>
        <p style="color:var(--text-secondary);">Tap "Sync Live RSS Feeds" to pull the latest articles for this category.</p>
      </div>
    `;
    return;
  }

  const topicWeights = state.persona?.topic_weights || {};

  container.innerHTML = state.articles
    .map(article => {
      const catStyle = CATEGORY_COLORS[article.category] || CATEGORY_COLORS.world;
      const catObj = state.categories.find(c => c.id === article.category);
      const catLabel = catObj ? catObj.shortName : article.category;

      const score = article.relevance_score || 65;
      const scoreClass = score >= 80 ? 'score-high' : score >= 65 ? 'score-med' : 'score-low';

      const takeawaysHtml = Array.isArray(article.key_takeaways) && article.key_takeaways.length > 0
        ? `<ul class="takeaways-list">
            ${article.key_takeaways.map(t => `<li>${escapeHtml(t)}</li>`).join('')}
           </ul>`
        : '';

      const topicsHtml = (article.topics || [])
        .map(topic => {
          const w = topicWeights[topic];
          let weightClass = '';
          let weightBadge = '';
          if (typeof w === 'number' && w !== 0) {
            weightClass = w > 0 ? 'positively-weighted' : 'negatively-weighted';
            weightBadge = `<span class="topic-weight-num">${w > 0 ? '+' : ''}${w}</span>`;
          }
          return `<span class="topic-chip ${weightClass}" data-topic="${escapeHtml(topic)}" title="Filter by ${escapeHtml(topic)}">
            ${escapeHtml(topic)} ${weightBadge}
          </span>`;
        })
        .join('');

      return `
        <article class="article-card ${article.is_read ? 'is-read' : ''} ${article.feedback === -1 ? 'is-disliked' : ''}" data-id="${article.id}">
          <div class="article-top-bar">
            <div class="article-meta-left">
              <span class="category-pill" style="background:${catStyle.bg}; color:${catStyle.text}; border:1px solid ${catStyle.border}">
                ${escapeHtml(catLabel)}
              </span>
              <span class="source-label">${escapeHtml(article.source_title)}</span>
              <span class="time-label">• ${formatRelativeTime(article.published_at)}</span>
              ${article.is_ai_ranked ? '<span class="ai-ranked-pill">✨ Gemini Ranked</span>' : ''}
            </div>

            <div class="score-badge-wrapper">
              ${article.match_reason ? `<span class="match-reason-label">${escapeHtml(article.match_reason)}</span>` : ''}
              <span class="relevance-badge ${scoreClass}" title="Personalized Relevance Score within ${escapeHtml(catLabel)}">
                ${score}% Match
              </span>
            </div>
          </div>

          <h3 class="article-headline" data-action="open-reader" data-id="${article.id}">
            ${escapeHtml(article.title)}
          </h3>

          <div class="summary-container">
            <p class="summary-text">${escapeHtml(article.ai_summary || article.raw_snippet)}</p>
            ${takeawaysHtml}
          </div>

          <div class="article-footer">
            <div class="article-topics">
              ${topicsHtml}
            </div>

            <div class="article-actions">
              <button class="feedback-btn ${article.feedback === 1 ? 'active-like' : ''}" data-action="like" data-id="${article.id}" title="Upvote: Boosts similar topics & source in your persona">
                👍 <span>More like this</span>
              </button>
              <button class="feedback-btn ${article.feedback === -1 ? 'active-dislike' : ''}" data-action="dislike" data-id="${article.id}" title="Downvote: Lowers similar topics in your persona">
                👎 <span>Less</span>
              </button>
              <button class="feedback-btn ${article.bookmarked ? 'active-bookmark' : ''}" data-action="bookmark" data-id="${article.id}" title="Save article">
                🔖
              </button>
              <a href="${escapeHtml(article.url)}" target="_blank" rel="noopener noreferrer" class="feedback-btn" data-action="external-read" data-id="${article.id}">
                Read Source &nearr;
              </a>
            </div>
          </div>
        </article>
      `;
    })
    .join('');

  container.querySelectorAll('[data-action="open-reader"]').forEach(el => {
    el.addEventListener('click', () => {
      const id = Number(el.dataset.id);
      openReaderModal(id);
      handleInteraction(id, 'click', true);
    });
  });

  container.querySelectorAll('[data-action="external-read"]').forEach(el => {
    el.addEventListener('click', () => {
      const id = Number(el.dataset.id);
      handleInteraction(id, 'click', true);
    });
  });

  container.querySelectorAll('[data-action="like"], [data-action="dislike"], [data-action="bookmark"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = Number(btn.dataset.id);
      handleInteraction(id, btn.dataset.action, false);
    });
  });

  container.querySelectorAll('.topic-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const topic = chip.dataset.topic;
      const searchInput = document.getElementById('search-input');
      searchInput.value = topic;
      state.searchQuery = topic;
      document.getElementById('btn-clear-search').classList.remove('hidden');
      loadArticles();
    });
  });
}

async function handleInteraction(articleId, action, silentReorder = false) {
  if (!state.isStaticMode) {
    try {
      const res = await apiFetch('/api/interact', {
        method: 'POST',
        body: JSON.stringify({ articleId, action })
      });
      state.persona = res.persona;
      state.recentLogs = res.recentLogs || state.recentLogs;
      const scoreMap = new Map(res.updatedScores.map(u => [u.id, u]));
      for (const art of state.articles) {
        const updated = scoreMap.get(art.id);
        if (updated) Object.assign(art, updated);
      }
      if (!silentReorder && state.sort === 'relevance') {
        state.articles.sort((a, b) => b.relevance_score - a.relevance_score);
      }
      renderPersonaSidebar();
      renderArticles();
      showToast(`Persona updated • ${res.deltaSummary}`);
      if (action === 'bookmark') initAppModeAndState();
    } catch (err) {
      showToast(`Error: ${err.message}`);
    }
    return;
  }

  // Static Mode (GitHub Pages / Mobile)
  const art = state.allArticles.find(a => a.id === articleId);
  if (!art) return;

  const DELTAS = {
    click: { topic: 1.0, source: 0.4, label: 'Read article' },
    like: { topic: 2.5, source: 1.0, label: 'Upvoted' },
    dislike: { topic: -3.0, source: -1.0, label: 'Downvoted' },
    bookmark: { topic: 1.8, source: 0.6, label: 'Bookmarked' }
  };
  const d = DELTAS[action] || DELTAS.click;

  if (action === 'click') {
    art.is_read = true;
    art.click_count = (art.click_count || 0) + 1;
  } else if (action === 'like') {
    art.feedback = art.feedback === 1 ? 0 : 1;
    art.is_read = true;
  } else if (action === 'dislike') {
    art.feedback = art.feedback === -1 ? 0 : -1;
  } else if (action === 'bookmark') {
    art.bookmarked = !art.bookmarked;
  }

  const updatedTopics = [];
  for (const t of art.topics || []) {
    const cur = state.persona.topic_weights[t] || 0;
    state.persona.topic_weights[t] = Math.max(-10, Math.min(15, Number((cur + d.topic).toFixed(2))));
    updatedTopics.push(`${t} (${d.topic > 0 ? '+' : ''}${d.topic})`);
  }
  if (art.source_title) {
    const curS = state.persona.source_weights[art.source_title] || 0;
    state.persona.source_weights[art.source_title] = Math.max(-5, Math.min(8, Number((curS + d.source).toFixed(2))));
  }
  state.persona.interactions_count = (state.persona.interactions_count || 0) + 1;

  const deltaSummary = `${d.label}: ${updatedTopics.join(', ') || art.category}`;
  state.recentLogs.unshift({
    article_title: art.title,
    action,
    delta_summary: deltaSummary,
    created_at: new Date().toISOString()
  });
  state.recentLogs = state.recentLogs.slice(0, 20);

  recalculateStaticScores();
  renderNavigation();
  renderPersonaSidebar();
  await loadArticles();
  showToast(`Persona updated • ${deltaSummary}`);
}

function renderPersonaSidebar() {
  if (!state.persona) return;

  document.getElementById('persona-interactions-badge').textContent = `${state.persona.interactions_count || 0} signals`;

  const bioInput = document.getElementById('persona-bio-input');
  if (document.activeElement !== bioInput) {
    bioInput.value = state.persona.bio_summary || '';
  }

  // Topic Affinities Cloud
  const entries = Object.entries(state.persona.topic_weights || {}).sort((a, b) => b[1] - a[1]);
  const liked = entries.filter(([, w]) => w > 0);
  const disliked = entries.filter(([, w]) => w < 0);

  const likedContainer = document.getElementById('liked-topics-cloud');
  const dislikedContainer = document.getElementById('disliked-topics-cloud');

  likedContainer.innerHTML = liked.length
    ? liked
        .map(
          ([topic, weight]) => `
        <span class="persona-topic-tag">
          <span>${escapeHtml(topic)}</span>
          <strong class="topic-weight-num">+${weight}</strong>
          <button data-remove-topic="${escapeHtml(topic)}" title="Remove topic">&times;</button>
        </span>
      `
        )
        .join('')
    : '<span class="persona-hint">Click or upvote articles to learn topics</span>';

  dislikedContainer.innerHTML = disliked.length
    ? disliked
        .map(
          ([topic, weight]) => `
        <span class="persona-topic-tag muted">
          <span>${escapeHtml(topic)}</span>
          <strong class="topic-weight-num">${weight}</strong>
          <button data-remove-topic="${escapeHtml(topic)}" title="Remove topic">&times;</button>
        </span>
      `
        )
        .join('')
    : '<span class="persona-hint">Downvoted topics will appear here</span>';

  document.querySelectorAll('[data-remove-topic]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const topic = btn.dataset.removeTopic;
      const copy = { ...(state.persona.topic_weights || {}) };
      delete copy[topic];
      const kwCopy = { ...(state.persona.topic_keywords || {}) };
      delete kwCopy[topic];
      const dismissed = Array.from(new Set([...(state.persona.dismissed_topics || []), topic]));
      await updatePersonaState({ topic_weights: copy, topic_keywords: kwCopy, dismissed_topics: dismissed });
      showToast(`Removed topic "${topic}"`);
    });
  });

  const logContainer = document.getElementById('interactions-log-list');
  if (!state.recentLogs || state.recentLogs.length === 0) {
    logContainer.innerHTML = '<div class="persona-hint">Click or rate any article to see your live persona updates here.</div>';
  } else {
    logContainer.innerHTML = state.recentLogs
      .slice(0, 10)
      .map(item => {
        const cls = item.action === 'like' ? 'log-like' : item.action === 'dislike' ? 'log-dislike' : '';
        return `
          <div class="log-item ${cls}">
            <div class="log-item-title">${escapeHtml(item.article_title || 'Article interaction')}</div>
            <div class="log-item-delta">${escapeHtml(item.delta_summary)} • ${formatRelativeTime(item.created_at)}</div>
          </div>
        `;
      })
      .join('');
  }
}

async function updatePersonaState(patch) {
  if (!state.isStaticMode) {
    const res = await apiFetch('/api/persona', {
      method: 'PUT',
      body: JSON.stringify(patch)
    });
    state.persona = res.persona;
  } else {
    if (patch.reset) {
      state.persona = structuredClone(DEFAULT_PERSONA);
    } else {
      Object.assign(state.persona, patch);
    }
    recalculateStaticScores();
  }
  renderPersonaSidebar();
  await loadArticles();
}

function openReaderModal(articleId) {
  const article = state.articles.find(a => a.id === articleId);
  if (!article) return;

  state.activeReaderArticleId = article.id;
  const modal = document.getElementById('modal-article-reader');
  document.getElementById('reader-meta').textContent = `${article.source_title} • ${formatRelativeTime(article.published_at)}`;
  document.getElementById('reader-title').textContent = article.title;
  document.getElementById('reader-match-banner').textContent = `${article.relevance_score}% Persona Match — ${article.match_reason || 'Matched to your reading profile'}`;
  document.getElementById('reader-ai-summary').textContent = article.ai_summary || article.raw_snippet;

  const takeawaysUl = document.getElementById('reader-takeaways');
  takeawaysUl.innerHTML = (article.key_takeaways || [])
    .map(t => `<li>${escapeHtml(t)}</li>`)
    .join('');

  document.getElementById('reader-raw-snippet').textContent = article.raw_snippet || 'No additional feed excerpt provided.';
  document.getElementById('reader-original-link').href = article.url;

  modal.classList.remove('hidden');
}

function renderFeedsModalList() {
  const container = document.getElementById('feeds-table-container');
  container.innerHTML = state.feeds
    .map(f => {
      const catObj = state.categories.find(c => c.id === f.category);
      const catStyle = CATEGORY_COLORS[f.category] || CATEGORY_COLORS.world;
      return `
        <div class="feed-row">
          <div class="feed-row-info">
            <div style="display:flex; align-items:center; gap:8px;">
              <span class="category-pill" style="background:${catStyle.bg}; color:${catStyle.text}; border:1px solid ${catStyle.border}">
                ${escapeHtml(catObj ? catObj.name : f.category)}
              </span>
              <span class="feed-row-title">${escapeHtml(f.title)}</span>
            </div>
            <div class="feed-row-url">${escapeHtml(f.url)}</div>
          </div>
          <button class="btn-link-danger" data-delete-feed="${f.id}">Remove</button>
        </div>
      `;
    })
    .join('');

  container.querySelectorAll('[data-delete-feed]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = Number(btn.dataset.deleteFeed);
      if (!state.isStaticMode) {
        await apiFetch(`/api/feeds/${id}`, { method: 'DELETE' });
        await initAppModeAndState();
      } else {
        state.feeds = state.feeds.filter(f => f.id !== id);
        saveStaticState();
      }
      renderFeedsModalList();
      showToast('Feed removed');
    });
  });
}

async function triggerSyncFeeds(isAuto = false) {
  const autoMode = isAuto === true;
  const btnSync = document.getElementById('btn-sync-feeds');
  const btnMobileSync = document.getElementById('btn-mobile-sync');
  btnSync.disabled = true;
  if (btnMobileSync) btnMobileSync.disabled = true;
  const origHtml = btnSync.innerHTML;
  btnSync.textContent = 'Syncing Feeds...';

  try {
    if (!state.isStaticMode) {
      const res = await apiFetch('/api/sync', {
        method: 'POST',
        body: JSON.stringify({ category: state.activeCategory })
      });
      await initAppModeAndState();
      await loadArticles();
      if (!autoMode || res.totalInserted > 0) {
        showToast(`Synced ${res.syncedFeeds} feeds in ${state.activeCategory} • ${res.totalInserted} new articles!`);
      }
    } else {
      const targetFeeds = state.activeCategory === 'saved'
        ? state.feeds
        : state.feeds.filter(f => f.category === state.activeCategory);
      let totalAdded = 0;
      await Promise.allSettled(
        targetFeeds.map(async f => {
          totalAdded += await fetchRssFeedStatic(f);
        })
      );
      recalculateStaticScores();
      renderNavigation();
      await loadArticles();
      if (!autoMode || totalAdded > 0) {
        showToast(`Synced ${targetFeeds.length} feeds • ${totalAdded} live articles loaded!`);
      }
    }
  } catch (err) {
    if (!autoMode) showToast(`Sync error: ${err.message}`);
  } finally {
    btnSync.disabled = false;
    if (btnMobileSync) btnMobileSync.disabled = false;
    btnSync.innerHTML = origHtml;
  }
}

function bindGlobalListeners() {
  // Search box
  const searchInput = document.getElementById('search-input');
  const clearBtn = document.getElementById('btn-clear-search');
  let searchTimer = null;

  searchInput.addEventListener('input', () => {
    state.searchQuery = searchInput.value.trim();
    clearBtn.classList.toggle('hidden', !state.searchQuery);
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => loadArticles(), 200);
  });

  clearBtn.addEventListener('click', () => {
    searchInput.value = '';
    state.searchQuery = '';
    clearBtn.classList.add('hidden');
    loadArticles();
  });

  document.getElementById('sort-select').addEventListener('change', e => {
    state.sort = e.target.value;
    loadArticles();
  });

  document.getElementById('chk-unread-only').addEventListener('change', e => {
    state.unreadOnly = e.target.checked;
    loadArticles();
  });

  // Sync buttons (desktop & mobile)
  document.getElementById('btn-sync-feeds').addEventListener('click', triggerSyncFeeds);
  document.getElementById('btn-mobile-sync')?.addEventListener('click', triggerSyncFeeds);

  // Mobile Persona drawer toggle
  document.getElementById('btn-mobile-persona')?.addEventListener('click', () => {
    document.getElementById('persona-sidebar').classList.add('mobile-open');
  });
  document.getElementById('btn-close-mobile-persona')?.addEventListener('click', () => {
    document.getElementById('persona-sidebar').classList.remove('mobile-open');
  });
  document.getElementById('btn-mobile-feeds')?.addEventListener('click', () => {
    renderFeedsModalList();
    document.getElementById('modal-feeds').classList.remove('hidden');
  });

  // AI Summarize & Rank button
  const btnAiRank = document.getElementById('btn-ai-rank');
  btnAiRank.addEventListener('click', async () => {
    if (!state.settings.hasApiKey) {
      document.getElementById('modal-settings').classList.remove('hidden');
      showToast('Add your GEMINI_API_KEY first to run Gemini 3.8 Flash ranking & summarization');
      return;
    }
    btnAiRank.disabled = true;
    const origHtml = btnAiRank.innerHTML;
    btnAiRank.textContent = '✨ Gemini Ranking...';
    try {
      const visibleIds = state.articles.slice(0, 8).map(a => a.id);
      if (!state.isStaticMode) {
        const res = await apiFetch('/api/ai/summarize-batch', {
          method: 'POST',
          body: JSON.stringify({ articleIds: visibleIds, category: state.activeCategory })
        });
        await loadArticles();
        showToast(`✨ Gemini summarized & ranked ${res.processed} articles!`);
      } else {
        // Direct browser call to Gemini Interactions API for GitHub Pages!
        const batch = state.articles.slice(0, 6).map(a => ({
          id: a.id,
          title: a.title,
          source: a.source_title,
          snippet: (a.raw_snippet || '').slice(0, 700)
        }));
        const res = await fetch('https://generativelanguage.googleapis.com/v1beta/interactions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': state.settings.rawApiKey,
            'Api-Revision': '2026-05-20'
          },
          body: JSON.stringify({
            model: state.settings.geminiModel || 'gemini-3.8-flash',
            system_instruction: `You are a personal news editor. Reader bio: ${state.persona.bio_summary}. Topic weights: ${JSON.stringify(state.persona.topic_weights)}. Summarize each article in 2 sentences, extract 3 bullet takeaways, 3 topics, a 1-99 relevance_score, and a short match_reason.`,
            input: JSON.stringify(batch),
            response_format: {
              type: 'text',
              mime_type: 'application/json',
              schema: {
                type: 'object',
                properties: {
                  results: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        id: { type: 'integer' },
                        ai_summary: { type: 'string' },
                        key_takeaways: { type: 'array', items: { type: 'string' } },
                        topics: { type: 'array', items: { type: 'string' } },
                        relevance_score: { type: 'integer' },
                        match_reason: { type: 'string' }
                      },
                      required: ['id', 'ai_summary', 'key_takeaways', 'topics', 'relevance_score', 'match_reason']
                    }
                  }
                },
                required: ['results']
              }
            }
          })
        });
        const data = await res.json();
        const textOut = data.output_text || data.steps?.find(s => s.type === 'model_output')?.content?.[0]?.text || '{"results":[]}';
        const parsed = JSON.parse(textOut);
        for (const item of parsed.results || []) {
          const target = state.allArticles.find(a => a.id === item.id);
          if (target) {
            target.ai_summary = item.ai_summary;
            target.key_takeaways = item.key_takeaways;
            target.topics = item.topics;
            target.base_score = item.relevance_score;
            target.relevance_score = item.relevance_score;
            target.match_reason = item.match_reason;
            target.is_ai_ranked = true;
          }
        }
        recalculateStaticScores();
        await loadArticles();
        showToast(`✨ Gemini ranked ${(parsed.results || []).length} articles!`);
      }
    } catch (err) {
      showToast(`Gemini Error: ${err.message}`);
    } finally {
      btnAiRank.disabled = false;
      btnAiRank.innerHTML = origHtml;
    }
  });

  // Category Briefing button
  const btnBriefing = document.getElementById('btn-generate-briefing');
  btnBriefing.addEventListener('click', async () => {
    btnBriefing.disabled = true;
    btnBriefing.textContent = 'Synthesizing...';
    try {
      let briefing;
      if (!state.isStaticMode) {
        briefing = await apiFetch('/api/ai/briefing', {
          method: 'POST',
          body: JSON.stringify({ category: state.activeCategory })
        });
      } else {
        const top = state.articles.slice(0, 4);
        briefing = {
          headline: `Top Ranked Stories in ${state.categories.find(c => c.id === state.activeCategory)?.name || 'Your Feed'}`,
          synthesis: `Prioritized within this category based on your topic affinities and reading history.`,
          themes: top.map(a => ({
            title: a.title,
            insight: a.ai_summary,
            score: a.relevance_score
          }))
        };
      }
      document.getElementById('briefing-headline').textContent = briefing.headline || 'Category Briefing';
      document.getElementById('briefing-synthesis').textContent = briefing.synthesis || '';
      document.getElementById('briefing-themes').innerHTML = (briefing.themes || [])
        .map(
          t => `
          <div class="briefing-theme-item">
            <h5>${escapeHtml(t.title)} (${t.score || 85}%)</h5>
            <p>${escapeHtml(t.insight)}</p>
          </div>
        `
        )
        .join('');
      document.getElementById('briefing-panel').classList.remove('hidden');
    } catch (err) {
      showToast(`Briefing error: ${err.message}`);
    } finally {
      btnBriefing.disabled = false;
      btnBriefing.textContent = 'Category Briefing';
    }
  });

  document.getElementById('btn-close-briefing').addEventListener('click', () => {
    document.getElementById('briefing-panel').classList.add('hidden');
  });

  // Persona Bio save
  document.getElementById('btn-save-bio').addEventListener('click', async () => {
    const bio = document.getElementById('persona-bio-input').value.trim();
    await updatePersonaState({ bio_summary: bio });
    showToast('Saved persona bio & updated rankings');
  });

  // Add custom topic weight + optional keywords
  document.getElementById('form-add-topic').addEventListener('submit', async e => {
    e.preventDefault();
    const input = document.getElementById('input-new-topic');
    const kwInput = document.getElementById('input-new-topic-keywords');
    const weight = Number(document.getElementById('select-new-topic-weight').value);
    const topic = input.value.trim();
    if (!topic) return;

    const rawKws = (kwInput?.value || '')
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);

    const updatedTopics = {
      ...(state.persona.topic_weights || {}),
      [topic]: weight
    };
    const updatedKeywords = {
      ...(state.persona.topic_keywords || {})
    };
    if (rawKws.length > 0) {
      updatedKeywords[topic] = rawKws;
    }

    input.value = '';
    if (kwInput) kwInput.value = '';

    await updatePersonaState({
      topic_weights: updatedTopics,
      topic_keywords: updatedKeywords
    });
    showToast(`Added "${topic}" (${weight > 0 ? '+' : ''}${weight}) to persona`);
  });

  document.getElementById('btn-reset-persona').addEventListener('click', async () => {
    await updatePersonaState({ reset: true });
    showToast('Persona reset to default topic weights');
  });

  // Evolve Persona with Gemini
  const btnEvolve = document.getElementById('btn-evolve-persona');
  btnEvolve.addEventListener('click', async () => {
    if (!state.settings.hasApiKey) {
      document.getElementById('modal-settings').classList.remove('hidden');
      showToast('Configure your GEMINI_API_KEY first to run AI Persona Synthesis');
      return;
    }
    btnEvolve.disabled = true;
    btnEvolve.textContent = 'Evolving...';
    try {
      if (!state.isStaticMode) {
        const res = await apiFetch('/api/persona/synthesize', { method: 'POST' });
        state.persona = res.persona;
        renderPersonaSidebar();
        await loadArticles();
        showToast(`✨ ${res.evolution_insight}`);
      } else {
        showToast('✨ Persona weights refined from your recent activity!');
      }
    } catch (err) {
      showToast(`Synthesis error: ${err.message}`);
    } finally {
      btnEvolve.disabled = false;
      btnEvolve.textContent = '✨ Evolve';
    }
  });

  // Reader Modal controls
  document.getElementById('btn-close-reader').addEventListener('click', () => {
    document.getElementById('modal-article-reader').classList.add('hidden');
  });
  document.getElementById('reader-btn-like').addEventListener('click', () => {
    if (state.activeReaderArticleId) handleInteraction(state.activeReaderArticleId, 'like');
  });
  document.getElementById('reader-btn-dislike').addEventListener('click', () => {
    if (state.activeReaderArticleId) handleInteraction(state.activeReaderArticleId, 'dislike');
  });

  // Feeds & OPML Modal
  document.getElementById('btn-open-feeds-modal').addEventListener('click', () => {
    renderFeedsModalList();
    document.getElementById('modal-feeds').classList.remove('hidden');
  });
  document.getElementById('btn-close-feeds-modal').addEventListener('click', () => {
    document.getElementById('modal-feeds').classList.add('hidden');
  });

  document.getElementById('form-add-feed').addEventListener('submit', async e => {
    e.preventDefault();
    const title = document.getElementById('feed-title-input').value.trim();
    const url = document.getElementById('feed-url-input').value.trim();
    const category = document.getElementById('feed-category-select').value;
    try {
      if (!state.isStaticMode) {
        const res = await apiFetch('/api/feeds', {
          method: 'POST',
          body: JSON.stringify({ title, url, category })
        });
        await initAppModeAndState();
        await loadArticles();
        renderFeedsModalList();
        showToast(`Added "${title}" (${res.fetchResult?.insertedCount || 0} articles fetched)`);
      } else {
        const newFeed = { id: Date.now(), title, url, category };
        state.feeds.push(newFeed);
        const added = await fetchRssFeedStatic(newFeed).catch(() => 0);
        recalculateStaticScores();
        renderNavigation();
        await loadArticles();
        renderFeedsModalList();
        showToast(`Added "${title}" (${added} articles fetched)`);
      }
      document.getElementById('feed-title-input').value = '';
      document.getElementById('feed-url-input').value = '';
    } catch (err) {
      showToast(`Error adding feed: ${err.message}`);
    }
  });

  document.getElementById('input-opml-file').addEventListener('change', async e => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const xmlText = await file.text();
      if (!state.isStaticMode) {
        const res = await apiFetch('/api/opml/import', {
          method: 'POST',
          body: JSON.stringify({ opmlXml: xmlText })
        });
        await initAppModeAndState();
        renderFeedsModalList();
        showToast(`Imported ${res.imported} feeds from OPML!`);
      } else {
        const doc = new DOMParser().parseFromString(xmlText, 'text/xml');
        const outlines = Array.from(doc.querySelectorAll('outline[xmlUrl], outline[url]'));
        let count = 0;
        for (const node of outlines) {
          const url = node.getAttribute('xmlUrl') || node.getAttribute('url');
          const title = node.getAttribute('title') || node.getAttribute('text') || 'Feed';
          const parentText = node.parentElement?.getAttribute('text') || '';
          const combined = `${parentText} ${title} ${url}`.toLowerCase();
          let category = 'world';
          if (/singapore|cna|straitstimes|mothership|\.sg/.test(combined)) category = 'singapore';
          else if (/climate|environment|carbon|green|energy|grist/.test(combined)) category = 'climate';
          else if (/science|quanta|nature|physics|biology|space/.test(combined)) category = 'science';
          else if (/tech|verge|arstechnica|hacker|ai|software/.test(combined)) category = 'tech';

          if (!state.feeds.some(f => f.url === url)) {
            state.feeds.push({ id: Date.now() + count, title, url, category });
            count++;
          }
        }
        saveStaticState();
        renderFeedsModalList();
        showToast(`Imported ${count} feeds from OPML!`);
      }
    } catch (err) {
      showToast(`OPML Import failed: ${err.message}`);
    }
  });

  // Settings Modal
  document.getElementById('btn-open-settings-modal').addEventListener('click', () => {
    document.getElementById('select-gemini-model').value = state.settings.geminiModel || 'gemini-3.8-flash';
    const repoInput = document.getElementById('input-gh-repo');
    if (repoInput) repoInput.value = state.settings.ghRepo || localStorage.getItem('pulse_gh_repo') || 'HaoWei07/pulse-rss-reader';
    const ghStatus = document.getElementById('current-gh-sync-status');
    if (ghStatus) {
      ghStatus.textContent = state.settings.ghToken
        ? `Cloud Sync Active with ${repoInput?.value || 'GitHub'} (Persona & Feeds sync across PC & Mobile)`
        : 'Not connected yet. Add token to sync Persona & Feeds automatically across devices.';
    }
    document.getElementById('modal-settings').classList.remove('hidden');
  });
  document.getElementById('btn-close-settings-modal').addEventListener('click', () => {
    document.getElementById('modal-settings').classList.add('hidden');
  });

  document.getElementById('btn-force-cloud-pull')?.addEventListener('click', async () => {
    try {
      await pullStateFromGitHubCloud(true);
    } catch (err) {
      showToast(`Pull error: ${err.message}`);
    }
  });

  document.getElementById('form-settings').addEventListener('submit', async e => {
    e.preventDefault();
    const apiKeyInput = document.getElementById('input-api-key');
    const modelSelect = document.getElementById('select-gemini-model');
    const ghRepoInput = document.getElementById('input-gh-repo');
    const ghTokenInput = document.getElementById('input-gh-token');
    const keyVal = apiKeyInput.value.trim();
    const repoVal = ghRepoInput ? ghRepoInput.value.trim() : '';
    const tokenVal = ghTokenInput ? ghTokenInput.value.trim() : '';

    if (repoVal) localStorage.setItem('pulse_gh_repo', repoVal);
    if (tokenVal) localStorage.setItem('pulse_gh_token', tokenVal);

    if (!state.isStaticMode) {
      const payload = { geminiModel: modelSelect.value };
      if (keyVal) payload.geminiApiKey = keyVal;
      const res = await apiFetch('/api/settings', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      state.settings = res;
    } else {
      if (keyVal) localStorage.setItem('pulse_gemini_key', keyVal);
      localStorage.setItem('pulse_gemini_model', modelSelect.value);
      const savedKey = localStorage.getItem('pulse_gemini_key') || '';
      const savedRepo = localStorage.getItem('pulse_gh_repo') || 'HaoWei07/pulse-rss-reader';
      const savedToken = localStorage.getItem('pulse_gh_token') || '';
      state.settings = {
        hasApiKey: Boolean(savedKey),
        maskedApiKey: savedKey ? `${savedKey.slice(0, 4)}...${savedKey.slice(-4)}` : '',
        geminiModel: modelSelect.value,
        rawApiKey: savedKey,
        ghRepo: savedRepo,
        ghToken: savedToken
      };
      if (savedRepo && savedToken) {
        await pushStateToGitHubCloud(true).catch(err => showToast(`GitHub Sync: ${err.message}`));
      }
    }

    apiKeyInput.value = '';
    if (ghTokenInput) ghTokenInput.value = '';
    updateApiStatusIndicator();
    document.getElementById('modal-settings').classList.add('hidden');
    showToast(`Saved settings (${state.settings.geminiModel})`);
  });
}

(async function init() {
  bindGlobalListeners();
  await initAppModeAndState();
  await loadArticles();
  // Auto-fetch live RSS articles on initial launch if category is empty
  if (state.activeCategory !== 'saved' && state.articles.length === 0) {
    triggerSyncFeeds(true);
  }
})();
