# Pulse — AI RSS Reader & Dynamic Persona News Ranker

An adaptive RSS aggregator and personal news intelligence dashboard designed to replace static Inoreader feeds with **AI summaries**, **personalized relevance ranking**, and a **dynamic persona** that learns from your clicks, reads, upvotes, and downvotes over time.

## Features

1. **5 Curated News Categories**:
   - 🌍 **World News** (BBC World, The Guardian World, Al Jazeera)
   - 🌱 **Environment & Climate News** (Carbon Brief, The Guardian Environment, Grist)
   - 💻 **Tech News** (Ars Technica, Hacker News, The Verge)
   - 🔬 **Science News** (Quanta Magazine, Nature, ScienceDaily)
   - 🇸🇬 **Local Singapore News** (CNA Singapore, The Straits Times Singapore, Mothership.sg)
2. **Inoreader OPML Import & Custom RSS Feeds**:
   - Export your subscriptions from Inoreader (*Preferences → Import/Export → Export OPML*) and upload the `.opml` file directly via **Feeds & Inoreader OPML**. Feeds are automatically mapped into the 5 categories.
3. **Dynamic Persona that Learns Over Time**:
   - **Automatic Click & Read Tracking**: Clicking a headline or opening the source article automatically boosts the weights of that article's topics, category, and source in your SQLite persona profile.
   - **Explicit Feedback (`👍 More like this` / `👎 Less`)**: Upvoting or downvoting immediately adjusts topic weights and re-ranks all articles in real time.
   - **Interactive Category & Topic Controls**: Drag the 5 category weight sliders (`0.5x` – `1.8x`), add/mute custom topics, edit your reader bio, or click **✨ Evolve** to let Gemini 3.8 Flash synthesize your recent reading log into an updated persona narrative.
4. **Gemini 3.8 Flash Summarization & Executive Briefings**:
   - Built on the official `@google/genai` SDK (`ai.interactions.create` with structured JSON output schemas).
   - Generates 2–3 sentence high-signal summaries, 3 bullet takeaways, normalized topic tags, and a personalized `1–99%` relevance match score with an explanation badge.

## Quick Start

```bash
cd "C:\Users\Hao Wei\.gemini\antigravity\scratch\pulse-rss-reader"
npm start
```

Then open **http://localhost:3456** in your browser.
