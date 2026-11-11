import { GoogleGenAI } from '@google/genai';
import { db, getPersona, savePersona, getSetting } from './db.js';
import { recalculateAllArticleScores } from './persona.js';

export const DEFAULT_GEMINI_MODEL = 'gemini-3.8-flash';

export function getApiKey() {
  return (
    getSetting('gemini_api_key', '') ||
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_API_KEY ||
    ''
  ).trim();
}

export function getClient() {
  const apiKey = getApiKey();
  if (!apiKey) {
    return null;
  }
  return new GoogleGenAI({ apiKey });
}

/**
 * Summarizes and ranks a batch of articles using Gemini 3.8 Flash and the Interactions API
 * with structured JSON output.
 */
export async function summarizeAndRankBatch(articlesBatch) {
  const ai = getClient();
  if (!ai) {
    throw new Error('GEMINI_API_KEY is not configured. Add your key in Settings or environment variables.');
  }

  if (!articlesBatch || articlesBatch.length === 0) return [];

  const persona = getPersona();
  const model = getSetting('gemini_model', DEFAULT_GEMINI_MODEL) || DEFAULT_GEMINI_MODEL;

  const sortedTopics = Object.entries(persona.topic_weights || {})
    .sort((a, b) => b[1] - a[1]);
  const likedTopics = sortedTopics.filter(([, w]) => w > 0).slice(0, 12).map(([k, w]) => `${k} (+${w})`);
  const dislikedTopics = sortedTopics.filter(([, w]) => w < 0).map(([k, w]) => `${k} (${w})`);

  const depthInstruction =
    persona.preferred_depth === 'concise'
      ? 'Write ultra-crisp 1-2 sentence summaries and 2 short takeaways per article.'
      : persona.preferred_depth === 'deep-technical'
      ? 'Write analytical, technical 3-sentence summaries preserving numbers, mechanisms, and policy details, plus 3 insightful takeaways.'
      : 'Write clear, high-signal 2-3 sentence summaries and 3 key bullet takeaways per article.';

  const systemInstruction = `You are an elite personal news editor and relevance-ranking engine.
Your reader has the following evolving Persona:
- Bio & Reading Profile: ${persona.bio_summary}
- Preferred Summary Depth: ${persona.preferred_depth} (${depthInstruction})
- High-Affinity Topics: ${likedTopics.join(', ') || 'General high-signal news'}
- Muted/Disliked Topics: ${dislikedTopics.join(', ') || 'Clickbait, fluff'}

For each article provided:
1. Write a high-signal "ai_summary" (no filler phrases like "This article discusses").
2. Extract 3 crisp "key_takeaways" (concrete facts, numbers, or implications).
3. Assign 2 to 4 normalized "topics" tags (e.g. "AI & LLMs", "Singapore Policy", "Clean Energy", "Semiconductors", "Climate Science", "Geopolitics", "Space & Physics", "Biotech & Medicine", "ASEAN Economy", "Public Transport & Urban Planning").
4. Score "relevance_score" from 1 to 99 reflecting how strongly this article matches the reader's persona.
5. Write a concise 1-phrase "match_reason" (under 14 words) explaining why it is relevant (or less relevant) to this specific reader.`;

  const payload = articlesBatch.map(a => ({
    id: a.id,
    category: a.category,
    source: a.source_title,
    title: a.title,
    snippet: (a.raw_snippet || '').slice(0, 900)
  }));

  const batchSchema = {
    type: 'object',
    properties: {
      results: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'integer', description: 'The exact article id from input.' },
            ai_summary: { type: 'string', description: '2-3 sentence high-signal summary.' },
            key_takeaways: {
              type: 'array',
              items: { type: 'string' },
              description: '2-3 concise bullet points.'
            },
            topics: {
              type: 'array',
              items: { type: 'string' },
              description: '2-4 short topic tags.'
            },
            relevance_score: {
              type: 'integer',
              description: 'Personalized relevance score from 1 to 99.'
            },
            match_reason: {
              type: 'string',
              description: 'Short explanation of why this matches the reader persona.'
            }
          },
          required: ['id', 'ai_summary', 'key_takeaways', 'topics', 'relevance_score', 'match_reason']
        }
      }
    },
    required: ['results']
  };

  const interaction = await ai.interactions.create({
    model,
    system_instruction: systemInstruction,
    input: `Analyze, summarize, and rank these ${payload.length} news articles for the reader:\n${JSON.stringify(payload, null, 2)}`,
    response_format: {
      type: 'text',
      mime_type: 'application/json',
      schema: batchSchema
    }
  });

  const parsed = JSON.parse(interaction.output_text || '{"results":[]}');
  const results = Array.isArray(parsed.results) ? parsed.results : [];

  const updateStmt = db.prepare(`
    UPDATE articles
    SET ai_summary = ?,
        key_takeaways = ?,
        topics = ?,
        base_score = ?,
        relevance_score = ?,
        match_reason = ?,
        is_ai_ranked = 1
    WHERE id = ?
  `);

  db.exec('BEGIN');
  try {
    for (const item of results) {
      const clampedScore = Math.max(5, Math.min(99, Number(item.relevance_score) || 65));
      updateStmt.run(
        item.ai_summary || '',
        JSON.stringify(Array.isArray(item.key_takeaways) ? item.key_takeaways.slice(0, 4) : []),
        JSON.stringify(Array.isArray(item.topics) ? item.topics.slice(0, 4) : []),
        clampedScore,
        clampedScore,
        item.match_reason || 'Ranked by Gemini for your persona',
        item.id
      );
    }
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }

  return results;
}

/**
 * Evolves the user's natural-language Persona bio and refines topic weights
 * based on their recent click, upvote, downvote, and bookmark history using Gemini 3.8 Flash.
 */
export async function synthesizePersonaWithGemini() {
  const ai = getClient();
  if (!ai) {
    throw new Error('GEMINI_API_KEY is not configured.');
  }

  const persona = getPersona();
  const recentLogs = db
    .prepare('SELECT * FROM interactions_log ORDER BY id DESC LIMIT 35')
    .all();

  const likedArticles = db
    .prepare('SELECT title, category, source_title, topics FROM articles WHERE feedback = 1 ORDER BY id DESC LIMIT 15')
    .all();
  const dislikedArticles = db
    .prepare('SELECT title, category, source_title, topics FROM articles WHERE feedback = -1 ORDER BY id DESC LIMIT 15')
    .all();
  const clickedArticles = db
    .prepare('SELECT title, category, source_title, topics, click_count FROM articles WHERE click_count > 0 ORDER BY click_count DESC, id DESC LIMIT 15')
    .all();

  const model = getSetting('gemini_model', DEFAULT_GEMINI_MODEL) || DEFAULT_GEMINI_MODEL;

  const synthesisSchema = {
    type: 'object',
    properties: {
      updated_bio_summary: {
        type: 'string',
        description: 'Updated 2-4 sentence reader persona bio capturing evolving interests, preferred angles, and topics to avoid.'
      },
      new_or_adjusted_topics: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            topic: { type: 'string' },
            weight: { type: 'number', description: 'Weight between -10 and +15' }
          },
          required: ['topic', 'weight']
        },
        description: 'Up to 10 refined topic weights based on reading behavior.'
      },
      evolution_insight: {
        type: 'string',
        description: 'A 1-2 sentence summary telling the user how their persona just evolved based on their clicks and feedback.'
      }
    },
    required: ['updated_bio_summary', 'new_or_adjusted_topics', 'evolution_insight']
  };

  const interaction = await ai.interactions.create({
    model,
    system_instruction: `You are an adaptive user-modeling engine for a personalized news reader covering 5 categories: World News, Environment/Climate, Tech, Science, and Local Singapore News.
Examine the user's current persona and their recent reading/click/feedback history.
Synthesize an updated, sharper "updated_bio_summary" that preserves their core identity while incorporating emerging interests and dislikes revealed by their clicks, upvotes, and downvotes.`,
    input: JSON.stringify(
      {
        current_persona: {
          bio_summary: persona.bio_summary,
          category_weights: persona.category_weights,
          topic_weights: persona.topic_weights
        },
        upvoted_articles: likedArticles,
        downvoted_articles: dislikedArticles,
        most_clicked_articles: clickedArticles,
        recent_interaction_log: recentLogs.slice(0, 20)
      },
      null,
      2
    ),
    response_format: {
      type: 'text',
      mime_type: 'application/json',
      schema: synthesisSchema
    }
  });

  const result = JSON.parse(interaction.output_text || '{}');
  if (result.updated_bio_summary) {
    persona.bio_summary = result.updated_bio_summary;
  }
  if (Array.isArray(result.new_or_adjusted_topics)) {
    for (const item of result.new_or_adjusted_topics) {
      if (item.topic && typeof item.weight === 'number') {
        persona.topic_weights[item.topic] = Math.max(-10, Math.min(15, Number(item.weight.toFixed(1))));
      }
    }
  }
  persona.interactions_since_synthesis = 0;
  savePersona(persona);
  recalculateAllArticleScores();

  return {
    persona: getPersona(),
    evolution_insight: result.evolution_insight || 'Persona updated based on your recent reading activity.'
  };
}

/**
 * Generates an on-demand Executive Radar Briefing across top stories in the selected view
 */
export async function generateExecutiveBriefing(category = 'all') {
  const ai = getClient();
  const persona = getPersona();

  let topArticles;
  if (category && category !== 'all' && category !== 'saved') {
    topArticles = db
      .prepare('SELECT id, title, source_title, category, ai_summary, relevance_score, match_reason FROM articles WHERE category = ? ORDER BY relevance_score DESC LIMIT 8')
      .all(category);
  } else {
    topArticles = db
      .prepare('SELECT id, title, source_title, category, ai_summary, relevance_score, match_reason FROM articles ORDER BY relevance_score DESC LIMIT 10')
      .all();
  }

  if (!ai) {
    // Clean local synthesis fallback when no API key is set
    const grouped = {};
    for (const a of topArticles.slice(0, 6)) {
      grouped[a.category] = grouped[a.category] || [];
      grouped[a.category].push(`• **${a.title}** (${a.source_title}, ${a.relevance_score}% match) — ${a.ai_summary}`);
    }
    return {
      headline: `Your Personalized Pulse Briefing (${topArticles.length} Top Stories)`,
      synthesis: `Ranked for your current persona profile. Top priorities today span ${Object.keys(grouped).join(', ')}. Configure your GEMINI_API_KEY in Settings for live cross-article AI synthesis with Gemini 3.8 Flash.`,
      themes: topArticles.slice(0, 4).map(a => ({
        title: a.title,
        insight: a.ai_summary,
        category: a.category,
        score: a.relevance_score
      }))
    };
  }

  const model = getSetting('gemini_model', DEFAULT_GEMINI_MODEL) || DEFAULT_GEMINI_MODEL;
  const briefingSchema = {
    type: 'object',
    properties: {
      headline: { type: 'string', description: 'Compelling briefing title for today.' },
      synthesis: { type: 'string', description: '2-3 sentence cross-cutting executive overview connecting the top stories to the reader persona.' },
      themes: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            insight: { type: 'string' },
            category: { type: 'string' },
            score: { type: 'integer' }
          },
          required: ['title', 'insight', 'category', 'score']
        }
      }
    },
    required: ['headline', 'synthesis', 'themes']
  };

  const interaction = await ai.interactions.create({
    model,
    system_instruction: `You are writing a personalized Executive Briefing for a reader with this persona: "${persona.bio_summary}". Connect the dots across their highest-ranked stories today.`,
    input: JSON.stringify(topArticles, null, 2),
    response_format: {
      type: 'text',
      mime_type: 'application/json',
      schema: briefingSchema
    }
  });

  return JSON.parse(interaction.output_text || '{}');
}
