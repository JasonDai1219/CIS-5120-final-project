# CIS-5120 Final Project: Discussion Thread Analysis Platform

A full-stack application for analyzing threaded discussions, including optional AI-powered annotation and summarization.

## 📦 Project Structure

```
CIS-5120-final-project/
├── backend/              ← FastAPI API (optional AI features)
│   ├── README.md        # ⭐ Start here for backend docs
│   ├── AI_SETUP.md
│   ├── TEST_RESULTS.md
│   ├── requirements.txt
│   ├── .env.example
│   └── app/
│       ├── main.py
│       ├── ai_service.py
│       ├── loader.py
│       ├── parser.py
│       └── schemas.py
│
└── frontend/            ← Next.js web interface
    ├── README.md
    ├── package.json
    ├── app/
    └── ...
```

## 🚀 Quick Start

### Backend (API)

```bash
cd backend
pip install -r requirements.txt
python -m uvicorn app.main:app --reload
```

API: **http://localhost:8000**  
Interactive docs: **http://localhost:8000/docs**

#### Enable AI Features (Optional)

```bash
# Set up OpenAI API
cp .env.example .env
# Edit .env and add your OpenAI API key

# Restart backend
python -m uvicorn app.main:app --reload
```

See `backend/README.md` and `backend/AI_SETUP.md` for full details.

### Frontend (Web UI)

```bash
cd frontend
npm install
npm run dev
```

UI: **http://localhost:3000**

---

## ✨ Key Features

### Backend
- ✅ REST API for discussion data management
- ✅ Message validation with Pydantic schemas
- ✅ Thread parsing (hierarchical discussion trees)
- ✅ Optional AI annotation (topic + sentiment)
- ✅ Optional AI summarization (thread-level summaries)
- ✅ Graceful fallback when no API key is configured
- ✅ CORS support for local frontend integration

### Frontend
- React + Next.js App Router
- Discussion thread visualization
- Tree/graph layout with `@xyflow/react`
- Interactive message exploration

---

## 📡 API Overview

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `GET` | `/` | Health check |
| `GET` | `/datasets` | List available datasets |
| `GET` | `/discussions/{id}/messages` | Flat message list |
| `GET` | `/discussions/{id}/thread` | Hierarchical threads |
| `GET` | `/discussions/{id}/messages/annotated` | AI-annotated messages (optional) |
| `GET` | `/discussions/{id}/ai-summary` | AI-generated summaries (optional) |

Full examples live in `backend/README.md`.

---

## 🤖 AI Features

The backend can optionally use OpenAI’s API to:
- **Annotate each message** with a topic label (deadline, grading, meeting, participation, logistics, other) and sentiment (supportive, critical, mixed, neutral)
- **Summarize discussion threads** into a main topic, short summary, and key points

If no API key is configured, the system still works:
- annotation returns `"unknown"` labels
- summarization returns a simple template-based fallback

---

## 🧪 Testing

```bash
cd backend
./test_ai_comprehensive.sh
```

See `backend/TEST_RESULTS.md` for test results.

---

## 🛠️ Technology Stack

### Backend
- FastAPI
- Pydantic
- OpenAI Python SDK (optional)
- python-dotenv

### Frontend
- Next.js
- React
- @xyflow/react
- Tailwind CSS

---

## 📝 Attribution & Extent of AI Use

This section is intended to be **more informative than a simple list of tools**. It describes (1) where AI assistance was used, (2) how much of the codebase it affected, and (3) what was still done manually.

### What AI was used for

During development, GitHub Copilot was used primarily in two ways:

1. **Code drafting / scaffolding**
   - generating first-pass implementations for new modules and endpoints
   - suggesting boilerplate for FastAPI routes, request/response typing, and error handling

2. **Iterative edits**
   - refactoring and reorganizing code (e.g., helper functions, formatting)
   - producing test scripts and documentation drafts that were then edited for correctness

### Where AI-assisted code lives (high-impact areas)

AI assistance was concentrated in the “AI features” portion of the backend:

- `backend/app/ai_service.py`
  - OpenAI client integration
  - prompt construction for annotation + summarization
  - caching and fallback logic
  - error handling around API failures

- `backend/app/main.py`
  - the newer AI-related endpoints:
    - `GET /discussions/{dataset_id}/messages/annotated`
    - `GET /discussions/{dataset_id}/ai-summary`

- Testing + docs
  - shell scripts under `backend/` (e.g., `test_ai_comprehensive.sh`)
  - documentation files such as `backend/AI_SETUP.md` and `backend/TEST_RESULTS.md`

### Approximate extent / effect on the codebase

- **Most non-AI core backend logic** (dataset loading, schema validation, thread parsing) was written manually and then lightly edited with Copilot suggestions.
- **Most AI feature code paths** (LLM calls, prompt/JSON parsing, fallbacks, AI endpoints, AI-related tests/docs) were drafted with Copilot and then reviewed and revised by the author.

Given the repo’s purpose and language mix, AI assistance disproportionately affected:
- the **backend’s AI-specific modules and endpoints**, and
- the **documentation and test harness** around those features,

while the foundational parsing/validation logic and overall project structure were authored directly.

### How AI output was verified

AI-generated drafts were treated as a starting point and then validated by:
- running the test scripts in `backend/`
- manual endpoint testing with `curl` against `/docs`
- reviewing fallback behavior by running without an API key

### Tools

- **GitHub Copilot** (in VS Code) for drafting and iterative edits
- **OpenAI API** for runtime annotation/summarization (optional feature), configured via `.env`

---

## 📖 Documentation

- Backend docs: `backend/README.md`
- AI setup: `backend/AI_SETUP.md`
- Testing: `backend/TEST_RESULTS.md`
- Frontend docs: `frontend/README.md`

---

## 🔐 Security Notes

- API keys in `.env` are never committed (`.gitignore`)
- Only `.env.example` is in the repo
- CORS configured for localhost:3000
- Input validation on all API endpoints

---

## 📊 Data Format

Datasets are JSON arrays in `backend/data/`:

```json
[
  {
    "id": "m1",
    "author": "Alice",
    "timestamp": "2024-01-15T10:30:00Z",
    "text": "Discussion topic...",
    "parentId": null,
    "topic": "deadline",
    "sentiment": "neutral"
  }
]
```

See `backend/README.md` for full schema documentation.

---

## 📄 Project Info

- Course: CIS 5120 (University of Pennsylvania)
- Type: Final Project
- Status: MVP complete with optional AI features
- Last Updated: 2026-05-02 17:26:28

---

Ready to analyze discussions? Start with `backend/README.md`.