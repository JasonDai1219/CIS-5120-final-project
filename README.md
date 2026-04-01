# CIS-5120-final-project

## Backend Functionality & Behavior

The backend is a **FastAPI-based discussion thread management service** designed to load and parse threaded discussion datasets.

### Core Features

#### 1. Service Health & Discovery
- **Health Check** (`GET /`) - Verifies service status
- **Dataset Discovery** (`GET /datasets`) - Lists all available datasets from the `data/` directory

#### 2. Message Loading & Validation
The `loader.py` module handles dataset loading with the following behaviors:
- Loads JSON files from the `data/` directory
- **Validates each message** using Pydantic schemas (skips invalid rows with warnings)
- **Deduplicates** messages by ID (keeps first occurrence, warns on duplicates)
- **Auto-fills defaults** for missing `topic` and `sentiment` fields (default: "unknown")
- **Sorts messages** chronologically by timestamp (ascending)

#### 3. Two Data Retrieval Endpoints
- **`GET /discussions/{dataset_id}/messages`** - Returns flat list of all messages with metadata
- **`GET /discussions/{dataset_id}/thread`** - Returns hierarchical thread structure with statistics

#### 4. Thread Tree Construction
The `parser.py` module builds a parent-child hierarchy from flat messages:
- **Creates roots** (messages with no parent)
- **Identifies orphans** (messages whose parent doesn't exist in the dataset)
- **Computes statistics**: 
  - Total message count
  - Root count (top-level threads)
  - Orphan count (broken references)
  - Maximum thread depth (via depth-first search)

### Data Model

Each message/thread node contains:
```
- id: Unique message identifier
- author: Message author name
- timestamp: ISO 8601 datetime
- text: Message content
- parentId: (Optional) Reference to parent message ID
- topic: Topic label (default: "unknown")
- sentiment: Sentiment label (default: "unknown")
- children: (ThreadNode only) List of child messages
```

### Error Handling

- **404 Not Found** - Dataset file doesn't exist
- **400 Bad Request** - Invalid JSON structure (not a list)
- **Warnings** - Non-fatal issues like skipped invalid rows or duplicate IDs are returned in response

### Technology Stack

- **FastAPI 0.115.12** - Modern async web framework
- **Uvicorn 0.34.0** - ASGI server
- **Pydantic 2.11.3** - Data validation & serialization
- **Python-dateutil 2.9.0** - DateTime parsing
