import { db, getPersona, savePersona, CATEGORIES } from './db.js';

// Canonical taxonomy of topics for smart auto-tagging when RSS feeds lack clean tags
export const TOPIC_TAXONOMY = [
  { tag: 'AI & LLMs', keywords: ['ai', 'llm', 'artificial intelligence', 'gemini', 'openai', 'anthropic', 'deepmind', 'neural', 'machine learning', 'agentic', 'gpt', 'transformer', 'robotics'] },
  { tag: 'Semiconductors', keywords: ['chip', 'semiconductor', 'nvidia', 'tsmc', 'gpu', 'wafer', 'intel', 'amd', 'foundry', 'silicon', 'asic', 'tpu'] },
  { tag: 'Software & Cloud', keywords: ['open source', 'linux', 'cloud', 'kubernetes', 'rust', 'typescript', 'developer', 'github', 'browser', 'database', 'api', 'programming'] },
  { tag: 'Cybersecurity & Privacy', keywords: ['cybersecurity', 'hack', 'vulnerability', 'encryption', 'ransomware', 'zero-day', 'privacy', 'surveillance', 'breach'] },
  { tag: 'Clean Energy', keywords: ['solar', 'wind power', 'battery', 'grid', 'renewable', 'nuclear', 'fusion', 'hydrogen', 'ev', 'electric vehicle', 'clean energy', 'geothermal', 'energy transition'] },
  { tag: 'Climate Science', keywords: ['climate', 'warming', 'emissions', 'carbon', 'co2', 'methane', 'ipcc', 'glacier', 'sea level', 'extreme weather', 'el nino', 'deforestation', 'net zero'] },
  { tag: 'Biodiversity & Nature', keywords: ['biodiversity', 'species', 'conservation', 'ocean', 'coral', 'wildlife', 'ecosystem', 'rainforest', 'marine', 'extinction', 'pollution', 'plastics'] },
  { tag: 'Space & Physics', keywords: ['nasa', 'spacex', 'telescope', 'jwst', 'quantum', 'physics', 'astronomy', 'exoplanet', 'black hole', 'mars', 'lunar', 'cosmology', 'cern', 'particle'] },
  { tag: 'Biotech & Medicine', keywords: ['crispr', 'gene', 'vaccine', 'clinical trial', 'longevity', 'neuroscience', 'brain', 'cancer', 'protein', 'microbiome', 'biotech', 'stem cell', 'rna'] },
  { tag: 'Geopolitics', keywords: ['diplomacy', 'sanctions', 'nato', 'united nations', 'treaty', 'summit', 'foreign policy', 'security', 'conflict', 'ceasefire', 'trade war', 'tariff', 'election'] },
  { tag: 'Global Economy', keywords: ['inflation', 'central bank', 'fed', 'interest rate', 'gdp', 'supply chain', 'imf', 'markets', 'recession', 'trade', 'bonds', 'manufactur'] },
  { tag: 'Singapore Policy', keywords: ['pap', 'parliament', 'ministry', 'hdb', 'cpf', 'mas', 'monetary authority of singapore', 'ndp', 'singapore government', 'statutory', 'minister', 'budget'] },
  { tag: 'Public Transport & Urban Planning', keywords: ['mrt', 'lta', 'bus', 'changi', 'bto', 'urban', 'tuas', 'jurong', 'cross island line', 'thomson-east coast', 'coe', 'erp', 'housing'] },
  { tag: 'ASEAN Economy', keywords: ['asean', 'johor', 'js-sez', 'malaysia', 'indonesia', 'vietnam', 'southeast asia', 'strait of malacca', 'regional hub'] }
];

function matchesKeyword(textLower, kw) {
  const cleanKw = String(kw || '').trim().toLowerCase();
  if (!cleanKw) return false;
  if (cleanKw.length <= 3) {
    return new RegExp(`\\b${cleanKw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(textLower);
  }
  return textLower.includes(cleanKw);
}

/**
 * Extracts 2-4 clean topic tags from title, snippet, category, raw RSS categories, and user-defined topic_keywords
 */
export function extractTopics(title = '', snippet = '', category = 'world', rawTags = [], customTopicKeywords = {}, customTopicWeights = {}) {
  const combined = `${title} ${snippet} ${(rawTags || []).join(' ')}`.toLowerCase();
  const matched = new Set();

  for (const item of TOPIC_TAXONOMY) {
    for (const kw of item.keywords) {
      if (matchesKeyword(combined, kw)) {
        matched.add(item.tag);
        break;
      }
    }
  }

  // Also check user-defined custom topic keywords & custom topic names
  for (const [topic, kwList] of Object.entries(customTopicKeywords || {})) {
    const terms = [topic, ...(Array.isArray(kwList) ? kwList : [])];
    if (terms.some(kw => matchesKeyword(combined, kw))) {
      matched.add(topic);
    }
  }
  for (const topic of Object.keys(customTopicWeights || {})) {
    if (matchesKeyword(combined, topic)) {
      matched.add(topic);
    }
  }

  // Also include up to 2 clean raw RSS tags if they look concise and meaningful
  for (const raw of rawTags || []) {
    if (matched.size >= 4) break;
    const cleaned = String(raw).trim();
    if (
      cleaned.length >= 3 &&
      cleaned.length <= 26 &&
      !/^(news|world|general|uncategorized|top stories|rss|article|default)$/i.test(cleaned)
    ) {
      matched.add(cleaned);
    }
  }

  // Fallback category-based default tag if none matched
  if (matched.size === 0) {
    const defaults = {
      world: 'World Affairs',
      climate: 'Climate & Environment',
      tech: 'Technology',
      science: 'Science Research',
      singapore: 'Singapore'
    };
    matched.add(defaults[category] || 'General News');
  }

  return Array.from(matched).slice(0, 4);
}

/**
 * Generates an extractive 2-3 sentence summary & bullet takeaways when AI hasn't run yet
 */
export function generateExtractiveSummary(title = '', rawSnippet = '') {
  const cleanText = String(rawSnippet || '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleanText || cleanText.length < 40) {
    return {
      summary: `${title}. Click to read the full coverage from the original source.`,
      takeaways: [title]
    };
  }

  const sentences = cleanText
    .split(/(?<=[.!?])\s+/)
    .map(s => s.trim())
    .filter(s => s.length > 25 && !/^(read more|continue reading|the post|appeared first on)/i.test(s));

  if (sentences.length === 0) {
    return {
      summary: cleanText.slice(0, 280) + (cleanText.length > 280 ? '...' : ''),
      takeaways: [cleanText.slice(0, 140)]
    };
  }

  const summary = sentences.slice(0, 2).join(' ');
  const takeaways = sentences.slice(0, 3).map(s => (s.length > 140 ? s.slice(0, 137) + '...' : s));
  return { summary, takeaways };
}

/**
 * Computes a personalized relevance score (1-99) and match reason for an article
 * within its category based on the user's dynamic persona (topic weights, source weights, recency, and explicit feedback).
 */
export function scoreArticleWithPersona(article, persona) {
  const topicWeights = persona.topic_weights || {};
  const sourceWeights = persona.source_weights || {};

  let topics = [];
  try {
    topics = Array.isArray(article.topics) ? article.topics : JSON.parse(article.topics || '[]');
  } catch {
    topics = [];
  }

  // 1. Base score (starts around 56)
  let score = 56;
  const matchedLikedTopics = [];
  const matchedDislikedTopics = [];

  // 2. Topic affinity contribution (diminishing returns across multiple tags for smooth spread)
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

  // Also scan title + snippet against user's custom topic_weights keys and topic_keywords
  const textLower = `${article.title || ''} ${article.raw_snippet || ''}`.toLowerCase();
  const customKeywords = persona.topic_keywords || {};
  for (const [topicKey, weight] of Object.entries(topicWeights)) {
    if (topics.some(t => t.toLowerCase() === topicKey.toLowerCase())) continue;
    const kwList = Array.isArray(customKeywords[topicKey]) ? customKeywords[topicKey] : [];
    const terms = [topicKey, ...kwList];
    if (terms.some(term => term.length >= 2 && matchesKeyword(textLower, term))) {
      topicDelta += weight * 1.6;
      if (weight >= 1.5) matchedLikedTopics.push({ topic: topicKey, weight });
      if (weight <= -1.5) matchedDislikedTopics.push({ topic: topicKey, weight });
    }
  }

  // Cap topicDelta so a single article doesn't overflow wildly
  topicDelta = Math.max(-28, Math.min(30, topicDelta));
  score += topicDelta;

  // 3. Source affinity contribution
  const sourceWeight = sourceWeights[article.source_title] || 0;
  const sourceDelta = Math.max(-10, Math.min(12, sourceWeight * 2.2));
  score += sourceDelta;

  // 4. Recency bonus (smooth decay over hours)
  let recencyDelta = 0;
  if (article.published_at) {
    const ageHours = Math.max(0, (Date.now() - new Date(article.published_at).getTime()) / (1000 * 60 * 60));
    if (ageHours <= 12) recencyDelta = Number((5 - (ageHours / 12) * 3).toFixed(1));
    else if (ageHours <= 36) recencyDelta = 1.5;
    else if (ageHours > 120) recencyDelta = -4;
  }
  score += recencyDelta;

  // 5. Direct user feedback on this specific article
  if (article.feedback === 1) score += 15;
  if (article.feedback === -1) score -= 25;
  if (article.click_count > 0 && article.feedback >= 0) score += Math.min(6, article.click_count * 2);

  const finalScore = Math.max(5, Math.min(99, Math.round(score)));

  // Build human-friendly match reason
  matchedLikedTopics.sort((a, b) => b.weight - a.weight);
  const topTopics = matchedLikedTopics.slice(0, 2).map(m => m.topic);

  let matchReason = '';
  const catInfo = CATEGORIES.find(c => c.id === article.category);
  const catLabel = catInfo ? catInfo.shortName : article.category;

  if (article.feedback === 1) {
    matchReason = `Boosted by your upvote${topTopics.length ? ` • Matches ${topTopics.join(' & ')}` : ''}`;
  } else if (article.feedback === -1) {
    matchReason = `Demoted based on your feedback`;
  } else if (topTopics.length > 0) {
    matchReason = `Matches your interest in ${topTopics.join(' & ')}`;
  } else if (matchedDislikedTopics.length > 0) {
    matchReason = `Lowered due to muted topic (${matchedDislikedTopics[0].topic})`;
  } else if (sourceWeight >= 1.5) {
    matchReason = `From favored source ${article.source_title}`;
  } else if (recencyDelta >= 3.5) {
    matchReason = `Fresh breaking story in ${catLabel}`;
  } else {
    matchReason = `General ${catLabel} coverage`;
  }

  const breakdown = {
    base: 56,
    topicDelta: Math.round(topicDelta),
    sourceDelta: Math.round(sourceDelta),
    recencyDelta
  };

  return {
    relevance_score: finalScore,
    match_reason: matchReason,
    score_breakdown: breakdown
  };
}

/**
 * Recalculates scores for all non-AI-locked articles (or blends AI score with live persona delta)
 */
export function recalculateAllArticleScores() {
  const persona = getPersona();
  const rows = db.prepare('SELECT * FROM articles').all();

  const updateStmt = db.prepare(`
    UPDATE articles
    SET relevance_score = ?, match_reason = ?, score_breakdown = ?
    WHERE id = ?
  `);

  db.exec('BEGIN');
  try {
    for (const row of rows) {
      const computed = scoreArticleWithPersona(row, persona);
      // If Gemini already scored this article, blend 55% Gemini base_score + 45% live persona score so clicks/likes still adapt immediately!
      let finalScore = computed.relevance_score;
      let finalReason = computed.match_reason;
      if (row.is_ai_ranked && row.base_score) {
        finalScore = Math.max(
          5,
          Math.min(99, Math.round(row.base_score * 0.55 + computed.relevance_score * 0.45))
        );
        if (row.feedback === 0 && row.match_reason && !computed.match_reason.startsWith('Matches your interest')) {
          finalReason = row.match_reason;
        }
      }
      updateStmt.run(finalScore, finalReason, JSON.stringify(computed.score_breakdown), row.id);
    }
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

/**
 * Records a user interaction (click, like, dislike, bookmark) and dynamically updates the Persona weights!
 */
export function recordInteractionAndEvolvePersona(articleId, action) {
  const article = db.prepare('SELECT * FROM articles WHERE id = ?').get(articleId);
  if (!article) return null;

  const persona = getPersona();
  let topics = [];
  try {
    topics = JSON.parse(article.topics || '[]');
  } catch {
    topics = [];
  }

  // Weight deltas by interaction type
  const DELTAS = {
    click: { topic: 1.0, source: 0.4, label: 'Read article' },
    like: { topic: 2.5, source: 1.0, label: 'Upvoted (More like this)' },
    dislike: { topic: -3.0, source: -1.0, label: 'Downvoted (Less like this)' },
    bookmark: { topic: 1.8, source: 0.6, label: 'Bookmarked' }
  };

  const delta = DELTAS[action] || DELTAS.click;

  // Update article row itself
  if (action === 'click') {
    db.prepare('UPDATE articles SET is_read = 1, click_count = click_count + 1 WHERE id = ?').run(articleId);
  } else if (action === 'like') {
    const newFeedback = article.feedback === 1 ? 0 : 1;
    db.prepare('UPDATE articles SET feedback = ?, is_read = 1 WHERE id = ?').run(newFeedback, articleId);
  } else if (action === 'dislike') {
    const newFeedback = article.feedback === -1 ? 0 : -1;
    db.prepare('UPDATE articles SET feedback = ? WHERE id = ?').run(newFeedback, articleId);
  } else if (action === 'bookmark') {
    const newBookmark = article.bookmarked ? 0 : 1;
    db.prepare('UPDATE articles SET bookmarked = ? WHERE id = ?').run(newBookmark, articleId);
  }

  // Update topic weights
  const updatedTopics = [];
  for (const t of topics) {
    const current = typeof persona.topic_weights[t] === 'number' ? persona.topic_weights[t] : 0;
    const next = Math.max(-10, Math.min(15, Number((current + delta.topic).toFixed(2))));
    persona.topic_weights[t] = next;
    updatedTopics.push(`${t} (${delta.topic > 0 ? '+' : ''}${delta.topic})`);
  }

  // Update source weight (bounded between -5 and +8)
  if (article.source_title) {
    const currentSource = persona.source_weights[article.source_title] || 0;
    persona.source_weights[article.source_title] = Math.max(
      -5,
      Math.min(8, Number((currentSource + delta.source).toFixed(2)))
    );
  }

  persona.interactions_count = (persona.interactions_count || 0) + 1;
  persona.interactions_since_synthesis = (persona.interactions_since_synthesis || 0) + 1;

  savePersona(persona);

  // Log interaction in interactions_log
  const deltaSummary = `${delta.label}: ${updatedTopics.join(', ') || article.category}`;
  db.prepare(`
    INSERT INTO interactions_log (article_id, article_title, action, category, source_title, topics_json, delta_summary, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    article.id,
    article.title,
    action,
    article.category,
    article.source_title,
    JSON.stringify(topics),
    deltaSummary,
    new Date().toISOString()
  );

  // Recalculate all article relevance scores immediately
  recalculateAllArticleScores();

  return {
    persona: getPersona(),
    article: db.prepare('SELECT * FROM articles WHERE id = ?').get(articleId),
    deltaSummary
  };
}
