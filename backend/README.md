# CIS-5120 Discussion Thread Backend

A **FastAPI-based discussion thread management service** with AI-powered annotation and summarization capabilities. This backend loads, parses, and analyzes threaded discussion datasets.

## 🎯 Quick Start

### Prerequisites
- Python 3.8+
- pip

### Setup & Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/JasonDai1219/CIS-5120-final-project.git
   cd CIS-5120-final-project/backend
   ```

2. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

3. **[Optional] Set up AI features with OpenAI API:**
   ```bash
   # Copy the example file
   cp .env.example .env
   
   # Edit .env and add your OpenAI API key
   # OPENAI_API_KEY=sk-...
   ```

4. **Run the backend:**
   ```bash
   python -m uvicorn app.main:app --reload
   ```

The API will be available at `http://localhost:8000`

**API Documentation (interactive):** http://localhost:8000/docs

---

## 📚 API Endpoints

### Health & Discovery

#### `GET /`
Health check endpoint.

**Response:**
```json
{
  "status": "ok",
  "service": "discussion-thread-backend"
}
```

#### `GET /datasets`
List all available datasets.

**Response:**
```json
{
  "datasets": ["discussion_demo", "course_forum"]
}
```

---

### Message Endpoints

#### `GET /discussions/{dataset_id}/messages`
Get flat list of all messages in a dataset.

**Example Request:**
```bash
curl http://localhost:8000/discussions/discussion_demo/messages
```

**Example Response:**
```json
{
  "datasetId": "discussion_demo",
  "messageCount": 3,
  "messages": [
    {
      "id": "m1",
      "author": "Alice",
      "timestamp": "2024-01-15T10:30:00",
      "text": "Should we extend the deadline?",
      "parentId": null,
      "topic": "unknown",
      "sentiment": "unknown"
    }
  ],
  "warnings": []
}
```

#### `GET /discussions/{dataset_id}/messages/annotated` ⭐ NEW
Get messages enriched with **AI-generated topic and sentiment labels**.

**Example Request:**
```bash
curl http://localhost:8000/discussions/discussion_demo/messages/annotated
```

**Example Response:**
```json
{
  "datasetId": "discussion_demo",
  "messageCount": 3,
  "messages": [
    {
      "id": "m1",
      "author": "Alice",
      "timestamp": "2024-01-15T10:30:00",
      "text": "Should we extend the deadline?",
      "parentId": null,
      "topic": "deadline",           ← AI-generated
      "sentiment": "neutral"          ← AI-generated
    }
  ],
  "warnings": []
}
```

---

### Thread Endpoints

#### `GET /discussions/{dataset_id}/thread`
Get hierarchical thread structure with parent-child relationships.

**Example Request:**
```bash
curl http://localhost:8000/discussions/discussion_demo/thread
```

**Example Response:**
```json
{
  "datasetId": "discussion_demo",
  "roots": [
    {
      "id": "m1",
      "author": "Alice",
      "timestamp": "2024-01-15T10:30:00",
      "text": "Should we extend the deadline?",
      "parentId": null,
      "topic": "unknown",
      "sentiment": "unknown",
      "children": [
        {
          "id": "m2",
          "author": "Bob",
          "timestamp": "2024-01-15T11:00:00",
          "text": "I think yes, several people are behind.",
          "parentId": "m1",
          "topic": "unknown",
          "sentiment": "unknown",
          "children": []
        }
      ]
    }
  ],
  "orphans": [],
  "stats": {
    "messageCount": 3,
    "rootCount": 1,
    "orphanCount": 0,
    "maxDepth": 2
  },
  "warnings": []
}
```

#### `GET /discussions/{dataset_id}/ai-summary` ⭐ NEW
Get **AI-generated summaries** for each root thread.

**Example Request:**
```bash
curl http://localhost:8000/discussions/discussion_demo/ai-summary
```

**Example Response:**
```json
{
  "datasetId": "discussion_demo",
  "summaryCount": 1,
  "summaries": [
    {
      "root_id": "m1",
      "main_topic": "deadline",
      "summary": "The discussion revolves around whether to extend the assignment deadline, with differing opinions on fairness and the needs of students.",
      "key_points": [
        "Bob supports extending the deadline due to students being behind.",
        "Carol opposes the extension, citing fairness concerns.",
        "Dan suggests a short extension as a potential compromise."
      ]
    }
  ],
  "warnings": []
}
```

---

## 🧠 Core Features

### 1. Message Loading & Validation
The `loader.py` module handles dataset loading:
- Loads JSON files from the `data/` directory
- **Validates each message** using Pydantic schemas
- **Deduplicates** messages by ID (keeps first occurrence)
- **Auto-fills defaults** for missing `topic` and `sentiment` fields
- **Sorts messages** chronologically by timestamp
- Returns warnings for skipped invalid rows

### 2. Thread Tree Construction
The `parser.py` module builds hierarchical structures:
- **Creates roots** (messages with no parent)
- **Identifies orphans** (messages whose parent doesn't exist)
- **Computes statistics**: message count, root count, orphan count, max depth
- Uses recursive depth-first search for tree traversal

### 3. AI Annotation & Summarization ⭐ NEW
The `ai_service.py` module provides AI capabilities:
- **Message Annotation**: Assigns topic and sentiment to each message
- **Thread Summarization**: Generates summaries of entire discussion threads
- **In-memory Caching**: Avoids repeated API calls
- **Graceful Degradation**: Works with or without OpenAI API key

#### Annotation Labels

**Topics:**
- `deadline` - Assignment/project deadlines
- `grading` - Grades, grading criteria, rubrics
- `meeting` - Scheduling meetings or events
- `participation` - Class participation or engagement
- `logistics` - Locations, resources, administrative details
- `other` - General discussion
- `unknown` - Label could not be generated (API unavailable)

**Sentiments:**
- `supportive` - Participant agrees or supports
- `critical` - Participant disagrees or raises concerns
- `mixed` - Both support and criticism
- `neutral` - Neutral or informational
- `unknown` - Label could not be generated (API unavailable)

---

## 🤖 AI Features Setup

The backend includes optional AI-powered annotation and summarization using OpenAI's API.

### Getting Started

1. **Get an OpenAI API Key:**
   - Go to https://platform.openai.com/api/keys
   - Create a new API key (starts with `sk-`)

2. **Add to `.env` file:**
   ```bash
   cp .env.example .env
   # Edit .env and add your key
   OPENAI_API_KEY=sk-your-key-here
   ```

3. **Install python-dotenv (already in requirements):**
   ```bash
   pip install -r requirements.txt
   ```

4. **Restart the backend:**
   ```bash
   python -m uvicorn app.main:app --reload
   ```

### Without API Key

If you don't have an OpenAI API key:
- `/messages/annotated` returns `"unknown"` for topic and sentiment
- `/ai-summary` returns template-based fallback summaries
- All endpoints still work - they're just not AI-powered

See `AI_SETUP.md` for detailed configuration instructions.

---

## 📊 Data Format

### Input: Dataset JSON
Place JSON files in `backend/data/` directory:

```json
[
  {
    "id": "m1",
    "author": "Alice",
    "timestamp": "2024-01-15T10:30:00Z",
    "text": "Should we extend the deadline?",
    "parentId": null,
    "topic": "deadline",
    "sentiment": "neutral"
  },
  {
    "id": "m2",
    "author": "Bob",
    "timestamp": "2024-01-15T10:45:00Z",
    "text": "Yes, please. Many students are behind.",
    "parentId": "m1",
    "topic": "deadline",
    "sentiment": "supportive"
  }
]
```

**Required fields:**
- `id` - Unique message identifier
- `author` - Message author name
- `timestamp` - ISO 8601 datetime
- `text` - Message content

**Optional fields:**
- `parentId` - Reference to parent message ID (default: `null`)
- `topic` - Topic label (default: `"unknown"`)
- `sentiment` - Sentiment label (default: `"unknown"`)

---

## 🧪 Testing

### Run Test Suite
```bash
cd backend
./test_ai_comprehensive.sh
```

### Manual Testing

**Test annotated messages:**
```bash
curl http://localhost:8000/discussions/discussion_demo/messages/annotated | jq
```

**Test AI summaries:**
```bash
curl http://localhost:8000/discussions/discussion_demo/ai-summary | jq
```

**Test without API key (fallback mode):**
```bash
# Unset API key
unset OPENAI_API_KEY

# Restart backend
python -m uvicorn app.main:app --reload

# Endpoints should still work with "unknown" labels
curl http://localhost:8000/discussions/discussion_demo/messages/annotated | jq
```

See `TEST_RESULTS.md` for detailed test results.

---

## 📁 Project Structure

```
backend/
├── app/
│   ├── __init__.py
│   ├── main.py              # FastAPI app & endpoints
│   ├── loader.py            # Dataset loading & validation
│   ├── parser.py            # Thread tree construction
│   ├── schemas.py           # Pydantic data models
│   └── ai_service.py        # AI annotation & summarization ⭐
├── data/
│   └── discussion_demo.json  # Example dataset
├── requirements.txt         # Python dependencies
├── .env.example            # Environment variables template
├── .env                    # Local environment (not committed)
├── AI_SETUP.md            # AI features configuration guide
├── TEST_RESULTS.md        # Test results
└── README.md              # This file
```

---

## 🛠️ Technology Stack

| Component | Version | Purpose |
|-----------|---------|---------|
| **FastAPI** | 0.115.12 | Web framework |
| **Uvicorn** | 0.34.0 | ASGI server |
| **Pydantic** | 2.11.3 | Data validation |
| **Python-dateutil** | 2.9.0 | DateTime parsing |
| **OpenAI** | 1.63.0 | AI API (optional) |
| **python-dotenv** | - | Environment variables |

---

## 🚨 Error Handling

All endpoints include graceful error handling:

| Status | Condition | Response |
|--------|-----------|----------|
| **200** | Success | Requested data |
| **404** | Dataset not found | `{"detail": "Dataset 'xyz' not found."}` |
| **400** | Invalid JSON format | `{"detail": "Dataset must be a JSON list..."}` |

Validation errors are returned as warnings, not failures:
```json
{
  "datasetId": "demo",
  "messageCount": 2,
  "messages": [...],
  "warnings": [
    "Skipped row 3: validation failed (missing required field 'text')",
    "Skipped duplicate message id 'm5'"
  ]
}
```

---

## 📝 Logging

Check server logs to understand what's happening:

```
[AI] Message m1 annotated via API: topic=deadline, sentiment=neutral
[AI] API annotation failed for message m2, returning 'unknown' labels
[AI] Summary for root m1 generated via API
[AI] Fallback summary used for root m1 (API unavailable)
```

---

## 💰 Cost Estimation

Using `gpt-4o-mini` (very cheap model):

| Operation | Cost per Unit | Example |
|-----------|---------------|---------|
| Message Annotation | ~$0.00002 | 1000 messages ≈ $0.02 |
| Thread Summary | ~$0.0001 | 10 threads ≈ $0.001 |
| **Total** | - | Full demo ≈ $0.05 |

Extremely affordable for demo and testing purposes!

---

## 🔐 Security

- **API Key Safety**: `.env` file is in `.gitignore` - never committed to git
- **Public Repo Safe**: Only `.env.example` is committed
- **Rate Limiting**: Consider implementing for production use
- **CORS**: Currently allows localhost:3000 (frontend)

---

## 📖 Code Attribution

### AI-Generated Code
This backend was developed with assistance from **GitHub Copilot**:

- **`app/ai_service.py`** - Complete AI service module with:
  - LLM integration (`_call_llm_json`)
  - Message annotation (`annotate_message`)
  - Thread summarization (`summarize_thread`)
  - Helper functions (tree flattening, transcript formatting)
  - In-memory caching
  - Graceful fallback logic

- **`app/main.py`** - New endpoints added:
  - `GET /discussions/{dataset_id}/messages/annotated`
  - `GET /discussions/{dataset_id}/ai-summary`

- **Test scripts** - Comprehensive testing:
  - `test_ai_comprehensive.sh`
  - `test_ai_endpoints.sh`

- **Documentation** - Complete guides:
  - `AI_SETUP.md`
  - `TEST_RESULTS.md`

### Human-Created Code
Original modules (human-written):
- `app/loader.py` - Dataset loading and validation
- `app/parser.py` - Thread tree construction
- `app/schemas.py` - Pydantic data models

### Development Tools
- **IDE**: VS Code with GitHub Copilot extension
- **LLM**: GPT-4o-mini for code generation
- **Framework**: FastAPI documentation and examples

---

## 🤝 Contributing

When adding new features:
1. Add corresponding endpoints to `app/main.py`
2. Add helper functions to appropriate modules
3. Update tests in `test_ai_comprehensive.sh`
4. Document in this README
5. Note which components were AI-generated vs human-written

---

## 📞 Support

### Common Issues

**"openai package not installed"**
```bash
pip install -r requirements.txt
```

**"OPENAI_API_KEY not set"**
```bash
export OPENAI_API_KEY="sk-..."
# or create .env file
cp .env.example .env  # then edit and add key
```

**Backend not responding**
```bash
# Check if running on localhost:8000
curl http://localhost:8000/

# Check logs for errors
# Restart with verbose output
python -m uvicorn app.main:app --reload --log-level debug
```

**Summaries show "[No API]" prefix**
- API key is not set or not loaded
- Check `.env` file exists and has valid key
- Check logs for `[AI]` messages

See `AI_SETUP.md` for more detailed troubleshooting.

---

## 📄 License

Part of CIS-5120 Final Project

---

## 🎉 What's New (AI Features)

- ⭐ **Message Annotation** - AI-powered topic and sentiment classification
- ⭐ **Thread Summarization** - Automatic summary generation for discussion threads
- ⭐ **Smart Caching** - In-memory cache to reduce API calls
- ⭐ **Graceful Degradation** - Works perfectly with or without API key
- ⭐ **Comprehensive Logging** - Track which features are using API vs fallback
- ⭐ **Full Documentation** - Setup guides and test results included

For detailed info on AI features, see `AI_SETUP.md` and `TEST_RESULTS.md`.

---

**Version**: 0.1.0  
**Last Updated**: April 2026  
**Status**: ✅ Production Ready
