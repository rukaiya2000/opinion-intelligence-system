# Opinion Intelligence System

A Chrome extension + FastAPI backend that analyzes Reddit threads and surfaces structured opinion insights directly on the Reddit page.

## What It Does

- Adds an `Analyze` button to Reddit post action rows.
- Sends the current post URL to a local backend (`http://127.0.0.1:3001`).
- Runs a multi-step AI pipeline to summarize discussion and viewpoints.
- Renders results inline on Reddit.
- Stores the latest analysis in extension local storage for popup viewing.

## Features

- **Inline analysis UI on Reddit**
  - appears below post controls after clicking `Analyze`
  - persists until page reload
  - supports analyzing multiple posts on the same page
- **Structured output**
  - `consensus`
  - `main_debate`
  - `viewpoints` (with sentiment)
  - `most_heated`
  - `gap` (missing perspective)
- **Popup support**
  - latest analysis is also visible from the extension popup

## Project Structure

```text
opinion-intelligence-system/
├── backend/
│   ├── main.py              # FastAPI app (/test, /analyze)
│   ├── analyze.py           # End-to-end orchestration
│   ├── pipeline.py          # Scoring, clustering, sentiment, output shaping
│   ├── reddit_scraper.py    # Reddit scraping logic
│   └── requirements.txt
├── extension/
│   ├── manifest.json        # Chrome extension config (MV3)
│   ├── background.js        # Service worker, calls backend
│   ├── content.js           # Injects Analyze button + inline results
│   └── popup/
│       ├── popup.html
│       ├── popup.js
│       └── style.css
└── README.md
```

## Prerequisites

- Python 3.10+ (recommended 3.11/3.12)
- Google Chrome (or Chromium-based browser with extension support)
- API credentials compatible with your configured LLM endpoint

## Backend Setup

From project root:

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

Create `backend/.env`:

```env
OPENAI_API_KEY=your_api_key
OPENAI_API_BASE=your_api_base_url
OPENAI_MODEL=your_model_name
```

Run backend:

```bash
python main.py
```

Expected:
- API on `http://127.0.0.1:3001`
- Health check: `GET http://127.0.0.1:3001/test`

## Extension Setup (Load Unpacked)

1. Open `chrome://extensions`
2. Turn on **Developer mode**
3. Click **Load unpacked**
4. Select the `extension/` folder
5. Keep backend running on `127.0.0.1:3001`

## How To Use

1. Open a Reddit page (`https://www.reddit.com/...`)
2. Click `Analyze` on a post
3. Wait for analysis to finish
4. View results inline under the post controls

You can click `Analyze` on multiple posts; each post keeps its own result panel.

## API Contract

### Request

`POST /analyze`

```json
{
  "reddit_url": "https://www.reddit.com/r/.../comments/..."
}
```

### Response (success)

```json
{
  "success": true,
  "data": {
    "consensus": "...",
    "main_debate": "...",
    "viewpoints": [
      {
        "title": "Viewpoint 1",
        "summary": "...",
        "sentiment": "positive|negative|neutral"
      }
    ],
    "most_heated": "...",
    "gap": "...",
    "metadata": {
      "reddit_url": "...",
      "post_title": "...",
      "total_comments_analyzed": 0,
      "num_clusters": 0
    }
  }
}
```

### Response (error)

```json
{
  "success": false,
  "error": "error message"
}
```

## Troubleshooting

- **Analyze button appears but no result**
  - Check backend is running on `127.0.0.1:3001`
  - Open extension service worker logs in `chrome://extensions`
  - Verify `/analyze` returns success JSON

- **`Cannot read properties of undefined (reading 'sendMessage')`**
  - Reload extension and Reddit tab
  - Ensure extension is enabled and host permissions are present

- **`No structured fields returned`**
  - Usually means backend response shape mismatch
  - Confirm backend returns fields inside `data`

- **CORS/network issues**
  - Ensure backend is local and reachable
  - Confirm `extension/manifest.json` includes `http://127.0.0.1/*` in `host_permissions`

## Current Notes

- Reddit DOM changes can affect button injection placement.
- The extension is currently targeted at `www.reddit.com`.
- Results are session-DOM based inline; they clear on full page reload.

---

If you want, I can also add:
- a short GIF/screenshots section,
- a one-command run script for backend,
- and a `.env.example` file.
