import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  db,
  initDb,
  CATEGORIES,
  DEFAULT_PERSONA,
  getPersona,
  savePersona,
  getSetting,
  setSetting
} from './src/db.js';
import {
  recalculateAllArticleScores,
  recordInteractionAndEvolvePersona
} from './src/persona.js';
import {
  syncAllFeeds,
  fetchSingleFeed,
  importOpmlFeeds
} from './src/rss.js';
import {
  getApiKey,
  DEFAULT_GEMINI_MODEL,
  summarizeAndRankBatch,
  synthesizePersonaWithGemini,
  generateExecutiveBriefing
} from './src/gemini.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

initDb();
recalculateAllArticleScores();

const app = express();
app.use(express.json({ limit: '5mb' }));
app.use(express.static(path.join(__dirname, 'public')));

function formatArticleRow(row) {
  let takeaways = [];
  let topics = [];
  let breakdown = {};
  try {
    takeaways = JSON.parse(row.key_takeaways || '[]');
  } catch {}
  try {
    topics = JSON.parse(row.topics || '[]');
  } catch {}
  try {
    breakdown = JSON.parse(row.score_breakdown || '{}');
  } catch {}

  return {
    ...row,
    key_takeaways: takeaways,
    topics,
    score_breakdown: breakdown,
    is_read: Boolean(row.is_read),
    bookmarked: Boolean(row.bookmarked),
    is_ai_ranked: Boolean(row.is_ai_ranked)
  };
}

// 1. Get full application state (categories, persona, feeds, counts, settings)
app.get('/api/state', (req, res) => {
  try {
    const persona = getPersona();
    const feeds = db.prepare('SELECT * FROM feeds ORDER BY category, title').all();
    const recentLogs = db
      .prepare('SELECT * FROM interactions_log ORDER BY id DESC LIMIT 18')
      .all();

    const categoryCounts = {};
    const rows = db
      .prepare('SELECT category, COUNT(*) as count FROM articles GROUP BY category')
      .all();
    let totalCount = 0;
    for (const r of rows) {
      categoryCounts[r.category] = r.count;
      totalCount += r.count;
    }
    const savedCount = db
      .prepare('SELECT COUNT(*) as count FROM articles WHERE bookmarked = 1')
      .get().count;

    const apiKey = getApiKey();
    res.json({
      categories: CATEGORIES,
      persona,
      feeds,
      recentLogs,
      counts: {
        all: totalCount,
        saved: savedCount,
        ...categoryCounts
      },
      settings: {
        hasApiKey: Boolean(apiKey),
        maskedApiKey: apiKey ? `${apiKey.slice(0, 4)}...${apiKey.slice(-4)}` : '',
        geminiModel: getSetting('gemini_model', DEFAULT_GEMINI_MODEL) || DEFAULT_GEMINI_MODEL
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. Get articles with filtering & sorting
app.get('/api/articles', (req, res) => {
  try {
    const { category = 'all', sort = 'relevance', q = '', unreadOnly = 'false' } = req.query;
    const conditions = [];
    const params = [];

    if (category === 'saved') {
      conditions.push('bookmarked = 1');
    } else if (category && category !== 'all') {
      conditions.push('category = ?');
      params.push(category);
    }

    if (unreadOnly === 'true') {
      conditions.push('is_read = 0');
    }

    if (q && String(q).trim()) {
      const term = `%${String(q).trim()}%`;
      conditions.push('(title LIKE ? OR ai_summary LIKE ? OR raw_snippet LIKE ? OR topics LIKE ? OR source_title LIKE ?)');
      params.push(term, term, term, term, term);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    let orderClause = 'ORDER BY relevance_score DESC, published_at DESC';
    if (sort === 'latest') {
      orderClause = 'ORDER BY published_at DESC, relevance_score DESC';
    } else if (sort === 'top_unread') {
      orderClause = 'ORDER BY is_read ASC, relevance_score DESC, published_at DESC';
    }

    const rows = db
      .prepare(`SELECT * FROM articles ${whereClause} ${orderClause} LIMIT 120`)
      .all(...params);

    res.json({
      articles: rows.map(formatArticleRow)
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Record interaction (click, like, dislike, bookmark) & dynamically evolve persona
app.post('/api/interact', async (req, res) => {
  try {
    const { articleId, action } = req.body;
    if (!articleId || !action) {
      return res.status(400).json({ error: 'articleId and action are required' });
    }

    const outcome = recordInteractionAndEvolvePersona(Number(articleId), action);
    if (!outcome) {
      return res.status(404).json({ error: 'Article not found' });
    }

    // Return updated scores map so frontend can smoothly animate re-ranking in real time
    const updatedScores = db
      .prepare('SELECT id, relevance_score, match_reason, score_breakdown, is_read, feedback, bookmarked, click_count FROM articles')
      .all()
      .map(r => ({
        ...r,
        is_read: Boolean(r.is_read),
        bookmarked: Boolean(r.bookmarked),
        score_breakdown: JSON.parse(r.score_breakdown || '{}')
      }));

    const recentLogs = db
      .prepare('SELECT * FROM interactions_log ORDER BY id DESC LIMIT 18')
      .all();

    res.json({
      persona: outcome.persona,
      article: formatArticleRow(outcome.article),
      deltaSummary: outcome.deltaSummary,
      updatedScores,
      recentLogs
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Update Persona manually (bio, depth, category sliders, topic weights, or reset)
app.put('/api/persona', (req, res) => {
  try {
    if (req.body.reset) {
      const fresh = savePersona({
        ...DEFAULT_PERSONA,
        last_updated_at: new Date().toISOString()
      });
      recalculateAllArticleScores();
      return res.json({ persona: fresh });
    }

    const current = getPersona();
    const updated = {
      ...current,
      bio_summary: req.body.bio_summary ?? current.bio_summary,
      preferred_depth: 'balanced',
      topic_weights: req.body.topic_weights ?? current.topic_weights,
      topic_keywords: req.body.topic_keywords ?? current.topic_keywords,
      source_weights: req.body.source_weights ?? current.source_weights
    };

    const saved = savePersona(updated);
    recalculateAllArticleScores();

    res.json({ persona: saved });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 5. Evolve Persona with Gemini AI synthesis
app.post('/api/persona/synthesize', async (req, res) => {
  try {
    const result = await synthesizePersonaWithGemini();
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// 6. Sync live RSS feeds
app.post('/api/sync', async (req, res) => {
  try {
    const { category = 'all' } = req.body || {};
    const syncResult = await syncAllFeeds(category);
    recalculateAllArticleScores();
    res.json(syncResult);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 7. Summarize & Rank articles with Gemini 3.8 Flash
app.post('/api/ai/summarize-batch', async (req, res) => {
  try {
    const { articleIds, category = 'all', limit = 8 } = req.body || {};
    let batch = [];

    if (Array.isArray(articleIds) && articleIds.length > 0) {
      const placeholders = articleIds.map(() => '?').join(',');
      batch = db
        .prepare(`SELECT * FROM articles WHERE id IN (${placeholders})`)
        .all(...articleIds);
    } else if (category && category !== 'all' && category !== 'saved') {
      batch = db
        .prepare('SELECT * FROM articles WHERE category = ? ORDER BY is_ai_ranked ASC, published_at DESC LIMIT ?')
        .all(category, Math.min(12, Number(limit) || 8));
    } else {
      batch = db
        .prepare('SELECT * FROM articles ORDER BY is_ai_ranked ASC, published_at DESC LIMIT ?')
        .all(Math.min(12, Number(limit) || 8));
    }

    const results = await summarizeAndRankBatch(batch);
    recalculateAllArticleScores();
    res.json({
      processed: results.length,
      results
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// 8. Generate Executive Briefing across top ranked articles
app.post('/api/ai/briefing', async (req, res) => {
  try {
    const { category = 'all' } = req.body || {};
    const briefing = await generateExecutiveBriefing(category);
    res.json(briefing);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// 9. Add custom RSS feed
app.post('/api/feeds', async (req, res) => {
  try {
    const { title, url, category = 'world' } = req.body;
    if (!url || !title) {
      return res.status(400).json({ error: 'Feed title and RSS URL are required.' });
    }
    const cleanUrl = String(url).trim();
    db.prepare(`
      INSERT INTO feeds (title, url, site_url, category, enabled)
      VALUES (?, ?, ?, ?, 1)
      ON CONFLICT(url) DO UPDATE SET title = excluded.title, category = excluded.category, enabled = 1
    `).run(String(title).trim(), cleanUrl, cleanUrl, category);

    const feed = db.prepare('SELECT * FROM feeds WHERE url = ?').get(cleanUrl);
    const fetchResult = await fetchSingleFeed(feed);
    recalculateAllArticleScores();

    res.json({ feed, fetchResult });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 10. Delete or toggle feed
app.delete('/api/feeds/:id', (req, res) => {
  try {
    const id = Number(req.params.id);
    db.prepare('DELETE FROM feeds WHERE id = ?').run(id);
    res.json({ deleted: id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 11. Import OPML from Inoreader
app.post('/api/opml/import', async (req, res) => {
  try {
    const { opmlXml } = req.body;
    if (!opmlXml) {
      return res.status(400).json({ error: 'OPML XML content is required.' });
    }
    const result = importOpmlFeeds(opmlXml);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// 12. Save Settings (Gemini API Key & Model)
app.post('/api/settings', (req, res) => {
  try {
    const { geminiApiKey, geminiModel } = req.body;
    if (typeof geminiApiKey === 'string') {
      setSetting('gemini_api_key', geminiApiKey.trim());
    }
    if (typeof geminiModel === 'string' && geminiModel.trim()) {
      setSetting('gemini_model', geminiModel.trim());
    }
    const apiKey = getApiKey();
    res.json({
      hasApiKey: Boolean(apiKey),
      maskedApiKey: apiKey ? `${apiKey.slice(0, 4)}...${apiKey.slice(-4)}` : '',
      geminiModel: getSetting('gemini_model', DEFAULT_GEMINI_MODEL) || DEFAULT_GEMINI_MODEL
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3456;
app.listen(PORT, () => {
  console.log(`Pulse Personalized RSS Reader running at http://localhost:${PORT}`);
});
