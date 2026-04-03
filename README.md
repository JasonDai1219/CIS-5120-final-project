# CIS-5120 Final Project: Discussion Thread Analysis Platform

A full-stack application for analyzing threaded discussions with AI-powered annotation and summarization capabilities.

## 📦 Project Structure

```
CIS-5120-final-project/
├── backend/              ← AI-powered discussion analysis API
│   ├── README.md        # ⭐ Start here for backend docs
│   ├── AI_SETUP.md
│   ├── TEST_RESULTS.md
│   ├── requirements.txt
│   ├── .env.example
│   └── app/
│       ├── main.py
│       ├── ai_service.py    # ⭐ AI features (Copilot-generated)
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

### Backend (AI-Powered API)

```bash
cd backend
pip install -r requirements.txt
python -m uvicorn app.main:app --reload
```

API available at: **http://localhost:8000**  
Interactive docs: **http://localhost:8000/docs**

#### With AI Features (Optional)
```bash
# Set up OpenAI API
cp .env.example .env
# Edit .env and add your OpenAI API key

# Restart backend
python -m uvicorn app.main:app --reload
```

**See `backend/README.md` for complete backend documentation.**

### Frontend (Web UI)

```bash
cd frontend
npm install
npm run dev
```

UI available at: **http://localhost:3000**

---

## ✨ Key Features

### Backend
- ✅ **REST API** for discussion data management
- ✅ **Message Validation** with JSON schema enforcement
- ✅ **Thread Parsing** - Build hierarchical discussion trees
- ✅ **AI Annotation** - Auto-generate topic/sentiment labels
- ✅ **AI Summarization** - Generate thread summaries
- ✅ **Graceful Fallback** - Works with or without API key
- ✅ **CORS Support** - Ready for frontend integration

### Frontend
- 🎨 React 19 + Next.js 16
- 📊 Discussion thread visualization
- 🌳 Tree/graph layout with @xyflow/react
- 📝 Interactive message exploration

---

## 📡 API Overview

### Core Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `GET` | `/` | Health check |
| `GET` | `/datasets` | List available datasets |
| `GET` | `/discussions/{id}/messages` | Flat message list |
| `GET` | `/discussions/{id}/thread` | Hierarchical threads |
| `GET` | `/discussions/{id}/messages/annotated` | ⭐ AI-annotated messages |
| `GET` | `/discussions/{id}/ai-summary` | ⭐ AI-generated summaries |

**See `backend/README.md` for complete API documentation with examples.**

---

## 🤖 AI Features (NEW!)

### Message Annotation
Automatically classify each message with:
- **Topic**: deadline, grading, meeting, participation, logistics, other
- **Sentiment**: supportive, critical, mixed, neutral

### Thread Summarization
Generate concise summaries of entire discussion threads with:
- Main topic inference
- Summary paragraph
- Key discussion points

### Smart Caching
- In-memory caching to avoid repeated API calls
- Graceful fallback when API unavailable

**See `backend/AI_SETUP.md` for detailed AI setup instructions.**

---

## 🧪 Testing

### Backend Tests
```bash
cd backend
./test_ai_comprehensive.sh
```

**See `backend/TEST_RESULTS.md` for test results.**

---

## 🛠️ Technology Stack

### Backend
- **FastAPI 0.115.12** - Modern async Python web framework
- **Pydantic 2.11.3** - Data validation
- **OpenAI 1.63.0** - AI API (optional)
- **python-dotenv** - Environment config

### Frontend
- **Next.js 16.2** - React framework
- **React 19** - UI library
- **@xyflow/react 12** - Graph visualization
- **Tailwind CSS 4** - Styling

---

## 📝 Code Attribution

### AI-Generated Components
This project leverages **GitHub Copilot** for code generation:

**Backend AI Service** (`backend/app/ai_service.py`):
- ✨ LLM integration with OpenAI API
- ✨ Message annotation logic
- ✨ Thread summarization
- ✨ Caching and fallback handling
- ✨ Comprehensive error handling

**New Endpoints** (`backend/app/main.py`):
- ✨ `/messages/annotated` endpoint
- ✨ `/ai-summary` endpoint

**Test & Documentation**:
- ✨ Comprehensive test scripts
- ✨ Setup guides (`AI_SETUP.md`)
- ✨ Test results documentation

### Human-Created Components
Original modules:
- 👤 `backend/app/loader.py` - Data loading
- 👤 `backend/app/parser.py` - Thread parsing
- 👤 `backend/app/schemas.py` - Data models
- 👤 Frontend application structure

### Development Process
- **IDE**: VS Code with GitHub Copilot
- **AI Assistant**: GitHub Copilot (GPT-4o-mini)
- **Development Approach**: Iterative prompting with human oversight

---

## 📖 Documentation

### For Backend Development
1. **Getting Started**: `backend/README.md`
2. **AI Setup**: `backend/AI_SETUP.md`
3. **Testing**: `backend/TEST_RESULTS.md`
4. **Interactive API Docs**: http://localhost:8000/docs

### For Frontend Development
See `frontend/README.md`

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

## 💡 Next Steps

1. **Backend**: Add your OpenAI API key to `backend/.env`
2. **Test**: Run `backend/test_ai_comprehensive.sh`
3. **Frontend**: Connect UI to backend endpoints
4. **Deploy**: Consider production deployment options

---

## 📞 Support

- **Backend Issues**: See `backend/README.md` and `backend/AI_SETUP.md`
- **API Documentation**: http://localhost:8000/docs (when running)
- **Test Verification**: See `backend/TEST_RESULTS.md`

---

## 📄 Project Info

- **Course**: CIS 5120 (University of Pennsylvania)
- **Type**: Final Project
- **Status**: ✅ MVP Complete with AI Features
- **Last Updated**: April 2026

---

**Ready to analyze discussions with AI? Start with `backend/README.md`! 🚀**
