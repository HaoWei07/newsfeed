import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'data');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_PATH = path.join(DATA_DIR, 'pulse.db');
export const db = new DatabaseSync(DB_PATH);

export const CATEGORIES = [
  {
    id: 'world',
    name: 'World News',
    shortName: 'World',
    icon: 'globe',
    color: '#3b82f6',
    description: 'Geopolitics, international affairs, global economy & diplomacy'
  },
  {
    id: 'climate',
    name: 'Environment & Climate',
    shortName: 'Climate',
    icon: 'leaf',
    color: '#10b981',
    description: 'Climate science, energy transition, biodiversity & sustainability policy'
  },
  {
    id: 'tech',
    name: 'Tech News',
    shortName: 'Tech',
    icon: 'cpu',
    color: '#8b5cf6',
    description: 'AI, software engineering, semiconductors, startups & digital policy'
  },
  {
    id: 'science',
    name: 'Science News',
    shortName: 'Science',
    icon: 'atom',
    color: '#f59e0b',
    description: 'Physics, biotechnology, space exploration, medicine & peer-reviewed breakthroughs'
  },
  {
    id: 'singapore',
    name: 'Local Singapore',
    shortName: 'Singapore',
    icon: 'map-pin',
    color: '#ef4444',
    description: 'Singapore policy, economy, urban transport, housing, ASEAN & local affairs'
  }
];

export const DEFAULT_FEEDS = [
  // 1) World News
  {
    title: 'BBC News - World',
    url: 'https://feeds.bbci.co.uk/news/world/rss.xml',
    site_url: 'https://www.bbc.com/news/world',
    category: 'world'
  },
  {
    title: 'The Guardian - World News',
    url: 'https://www.theguardian.com/world/rss',
    site_url: 'https://www.theguardian.com/world',
    category: 'world'
  },
  {
    title: 'Al Jazeera - All News',
    url: 'https://www.aljazeera.com/xml/rss/all.xml',
    site_url: 'https://www.aljazeera.com',
    category: 'world'
  },
  // 2) Environment / Climate News
  {
    title: 'Carbon Brief',
    url: 'https://www.carbonbrief.org/feed/',
    site_url: 'https://www.carbonbrief.org',
    category: 'climate'
  },
  {
    title: 'The Guardian - Environment',
    url: 'https://www.theguardian.com/environment/rss',
    site_url: 'https://www.theguardian.com/environment',
    category: 'climate'
  },
  {
    title: 'Grist - Climate & Justice',
    url: 'https://grist.org/feed/',
    site_url: 'https://grist.org',
    category: 'climate'
  },
  // 3) Tech News
  {
    title: 'Ars Technica',
    url: 'https://feeds.arstechnica.com/arstechnica/index',
    site_url: 'https://arstechnica.com',
    category: 'tech'
  },
  {
    title: 'Hacker News (Frontpage)',
    url: 'https://hnrss.org/frontpage',
    site_url: 'https://news.ycombinator.com',
    category: 'tech'
  },
  {
    title: 'The Verge',
    url: 'https://www.theverge.com/rss/index.xml',
    site_url: 'https://www.theverge.com',
    category: 'tech'
  },
  // 4) Science News
  {
    title: 'Quanta Magazine',
    url: 'https://api.quantamagazine.org/v1/feed/',
    site_url: 'https://www.quantamagazine.org',
    category: 'science'
  },
  {
    title: 'Nature - News & Comment',
    url: 'https://www.nature.com/nature.rss',
    site_url: 'https://www.nature.com',
    category: 'science'
  },
  {
    title: 'ScienceDaily - Top Science',
    url: 'https://www.sciencedaily.com/rss/top/science.xml',
    site_url: 'https://www.sciencedaily.com',
    category: 'science'
  },
  // 5) Local Singapore News
  {
    title: 'CNA (Channel NewsAsia) - Singapore',
    url: 'https://www.channelnewsasia.com/api/v1/rss-outbound-feed?_format=xml&category=10416',
    site_url: 'https://www.channelnewsasia.com/singapore',
    category: 'singapore'
  },
  {
    title: 'The Straits Times - Singapore',
    url: 'https://www.straitstimes.com/news/singapore/rss.xml',
    site_url: 'https://www.straitstimes.com/singapore',
    category: 'singapore'
  },
  {
    title: 'Mothership.sg',
    url: 'https://mothership.sg/feed/',
    site_url: 'https://mothership.sg',
    category: 'singapore'
  }
];

export const DEFAULT_PERSONA = {
  bio_summary:
    'Curious reader based in Singapore who follows global geopolitics, climate tech and clean energy policy, AI & software breakthroughs, fundamental science discoveries, and Singapore urban/economic developments. Prefers high-signal, analytical reporting over sensationalism or clickbait.',
  preferred_depth: 'balanced',
  topic_weights: {
    'AI & LLMs': 4.5,
    'Singapore Policy': 4.0,
    'Clean Energy': 3.5,
    'Climate Science': 3.5,
    'Semiconductors': 3.0,
    'Geopolitics': 3.0,
    'Space & Physics': 3.0,
    'Biotech': 2.5,
    'ASEAN Economy': 3.5,
    'Public Transport & Urban Planning': 3.0,
    'Celebrity Gossip': -5.0,
    'Sponsored Content': -6.0
  },
  topic_keywords: {},
  source_weights: {},
  interactions_count: 0,
  interactions_since_synthesis: 0,
  last_updated_at: new Date().toISOString()
};

export function initDb() {
  db.exec(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS feeds (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      url TEXT NOT NULL UNIQUE,
      site_url TEXT DEFAULT '',
      category TEXT NOT NULL,
      enabled INTEGER DEFAULT 1,
      last_fetched_at TEXT,
      last_error TEXT
    );

    CREATE TABLE IF NOT EXISTS articles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guid TEXT NOT NULL UNIQUE,
      feed_id INTEGER,
      category TEXT NOT NULL,
      source_title TEXT NOT NULL,
      title TEXT NOT NULL,
      url TEXT NOT NULL,
      author TEXT DEFAULT '',
      published_at TEXT NOT NULL,
      raw_snippet TEXT DEFAULT '',
      image_url TEXT DEFAULT '',
      ai_summary TEXT DEFAULT '',
      key_takeaways TEXT DEFAULT '[]',
      topics TEXT DEFAULT '[]',
      base_score REAL DEFAULT 60,
      relevance_score INTEGER DEFAULT 65,
      match_reason TEXT DEFAULT '',
      score_breakdown TEXT DEFAULT '{}',
      is_ai_ranked INTEGER DEFAULT 0,
      is_read INTEGER DEFAULT 0,
      click_count INTEGER DEFAULT 0,
      feedback INTEGER DEFAULT 0,
      bookmarked INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS persona (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      bio_summary TEXT NOT NULL,
      preferred_depth TEXT DEFAULT 'balanced',
      category_weights TEXT NOT NULL,
      topic_weights TEXT NOT NULL,
      source_weights TEXT NOT NULL,
      interactions_count INTEGER DEFAULT 0,
      interactions_since_synthesis INTEGER DEFAULT 0,
      last_updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS interactions_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      article_id INTEGER,
      article_title TEXT,
      action TEXT NOT NULL,
      category TEXT,
      source_title TEXT,
      topics_json TEXT DEFAULT '[]',
      delta_summary TEXT DEFAULT '',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  // Seed default feeds if none exist
  const feedCount = db.prepare('SELECT COUNT(*) as count FROM feeds').get().count;
  if (feedCount === 0) {
    const insertFeed = db.prepare(
      'INSERT OR IGNORE INTO feeds (title, url, site_url, category, enabled) VALUES (?, ?, ?, ?, 1)'
    );
    for (const f of DEFAULT_FEEDS) {
      insertFeed.run(f.title, f.url, f.site_url, f.category);
    }
  }

  // Ensure topic_keywords column exists for existing DBs
  try {
    db.exec("ALTER TABLE persona ADD COLUMN topic_keywords TEXT DEFAULT '{}'");
  } catch {}

  // Remove any legacy placeholder seed articles
  db.exec("DELETE FROM articles WHERE guid LIKE 'seed-%'");

  // Seed default persona if not present
  const personaRow = db.prepare('SELECT id FROM persona WHERE id = 1').get();
  if (!personaRow) {
    db.prepare(`
      INSERT INTO persona (
        id, bio_summary, preferred_depth, category_weights, topic_weights, topic_keywords, source_weights,
        interactions_count, interactions_since_synthesis, last_updated_at
      ) VALUES (1, ?, ?, ?, ?, ?, ?, 0, 0, ?)
    `).run(
      DEFAULT_PERSONA.bio_summary,
      'balanced',
      '{}',
      JSON.stringify(DEFAULT_PERSONA.topic_weights),
      JSON.stringify(DEFAULT_PERSONA.topic_keywords),
      JSON.stringify(DEFAULT_PERSONA.source_weights),
      DEFAULT_PERSONA.last_updated_at
    );
  }
}

export function getSetting(key, defaultValue = '') {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? row.value : defaultValue;
}

export function setSetting(key, value) {
  db.prepare(`
    INSERT INTO settings (key, value) VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `).run(key, String(value));
}

export function getPersona() {
  const row = db.prepare('SELECT * FROM persona WHERE id = 1').get();
  if (!row) return { ...DEFAULT_PERSONA };
  return {
    bio_summary: row.bio_summary,
    preferred_depth: 'balanced',
    topic_weights: JSON.parse(row.topic_weights || '{}'),
    topic_keywords: JSON.parse(row.topic_keywords || '{}'),
    source_weights: JSON.parse(row.source_weights || '{}'),
    interactions_count: row.interactions_count || 0,
    interactions_since_synthesis: row.interactions_since_synthesis || 0,
    last_updated_at: row.last_updated_at
  };
}

export function savePersona(persona) {
  const now = new Date().toISOString();
  db.prepare(`
    UPDATE persona SET
      bio_summary = ?,
      preferred_depth = ?,
      topic_weights = ?,
      topic_keywords = ?,
      source_weights = ?,
      interactions_count = ?,
      interactions_since_synthesis = ?,
      last_updated_at = ?
    WHERE id = 1
  `).run(
    persona.bio_summary,
    'balanced',
    JSON.stringify(persona.topic_weights || {}),
    JSON.stringify(persona.topic_keywords || {}),
    JSON.stringify(persona.source_weights || {}),
    persona.interactions_count || 0,
    persona.interactions_since_synthesis || 0,
    now
  );
  return getPersona();
}
