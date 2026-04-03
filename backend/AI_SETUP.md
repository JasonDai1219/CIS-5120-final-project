# AI Features Setup Guide

## Overview

The backend now includes AI-powered annotation and summarization endpoints that rely on OpenAI's API. All features gracefully degrade when the API is unavailable.

## Getting Your OpenAI API Key

1. Go to https://platform.openai.com/api/keys
2. Create a new API key
3. Copy the key (starts with `sk-`)

## Setting Up the API Key

### Option 1: Environment Variable (Recommended)

**macOS/Linux:**
```bash
export OPENAI_API_KEY="sk-your-api-key-here"
cd backend
python -m uvicorn app.main:app --reload
```

**Windows (PowerShell):**
```powershell
$env:OPENAI_API_KEY="sk-your-api-key-here"
cd backend
python -m uvicorn app.main:app --reload
```

### Option 2: Create a `.env` File

Create `backend/.env`:
```
OPENAI_API_KEY=sk-your-api-key-here
```

Then install `python-dotenv`:
```bash
pip install python-dotenv
```

Update the top of `backend/app/ai_service.py`:
```python
from dotenv import load_dotenv
load_dotenv()
```

## Testing the AI Features

### Without API Key (Fallback Mode)

```bash
cd backend
python -m uvicorn app.main:app --reload
```

Then test:
```bash
curl http://localhost:8000/discussions/discussion_demo/messages/annotated | jq
curl http://localhost:8000/discussions/discussion_demo/ai-summary | jq
```

**Expected behavior:** Endpoints return valid JSON with `"unknown"` labels for annotations and basic fallback summaries.

### With API Key (Full AI Mode)

```bash
export OPENAI_API_KEY="sk-..."
cd backend
python -m uvicorn app.main:app --reload
```

Same curl commands as above, but now you'll see AI-generated labels like `"deadline"`, `"grading"`, `"supportive"`, `"critical"`, etc.

## New Endpoints

### `GET /discussions/{dataset_id}/messages/annotated`

Returns all messages with AI-generated topic and sentiment labels.

**Example Response:**
```json
{
  "datasetId": "discussion_demo",
  "messageCount": 3,
  "messages": [
    {
      "id": "msg1",
      "author": "Alice",
      "timestamp": "2024-01-15T10:30:00",
      "text": "Should we extend the deadline?",
      "parentId": null,
      "topic": "deadline",
      "sentiment": "neutral"
    },
    ...
  ],
  "warnings": []
}
```

### `GET /discussions/{dataset_id}/ai-summary`

Returns AI-generated summaries for each root thread.

**Example Response:**
```json
{
  "datasetId": "discussion_demo",
  "summaryCount": 1,
  "summaries": [
    {
      "root_id": "msg1",
      "main_topic": "deadline",
      "summary": "The discussion explores whether extending the assignment deadline would be fair and beneficial for students.",
      "key_points": [
        "Some participants support an extension due to workload",
        "Others worry about fairness and repeated extensions",
        "A compromise of a shorter extension is proposed"
      ]
    }
  ],
  "warnings": []
}
```

## Understanding the AI Labels

### Topics
- `deadline` - Discussion about assignment/project deadlines
- `grading` - Discussion about grades, grading criteria, or rubrics
- `meeting` - Discussion about scheduling meetings or events
- `participation` - Discussion about class participation or engagement
- `logistics` - Discussion about locations, resources, or administrative details
- `other` - General discussion that doesn't fit above categories
- `unknown` - Label could not be generated (API unavailable)

### Sentiments
- `supportive` - Participant agrees or supports the idea
- `critical` - Participant disagrees or raises concerns
- `mixed` - Participant expresses both support and criticism
- `neutral` - Neutral or informational tone
- `unknown` - Label could not be generated (API unavailable)

## Caching

The system includes lightweight in-memory caching to avoid repeated API calls when testing locally. Cache is cleared when the server restarts.

## Logging

Check the server logs to see whether annotations/summaries came from the API or fallback mode:

```
[AI] Message m1 annotated via API: topic=deadline, sentiment=neutral
[AI] API annotation failed for message m2, returning 'unknown' labels
[AI] Summary for root m1 generated via API
[AI] Fallback summary used for root m1 (API unavailable)
```

## Troubleshooting

**"openai package not installed"**
```bash
pip install -r requirements.txt
```

**"OPENAI_API_KEY not set"**
- Check that you've exported the environment variable: `echo $OPENAI_API_KEY`
- Or create a `.env` file as described above

**API calls are slow**
- First call takes time as the model processes. Subsequent identical messages are cached.
- Consider using a cheaper model or lower concurrency during demo.

**Endpoints return "unknown" labels**
- This is expected when OPENAI_API_KEY is not set
- It's the graceful fallback - the endpoints still work!

## Cost Estimation

Using `gpt-4o-mini` with 1000 messages per dataset:
- Annotation: ~$0.01 USD (very cheap)
- Summary: ~$0.02 USD (varies by thread depth)

Total cost is minimal for demo purposes.
