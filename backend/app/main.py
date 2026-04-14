from __future__ import annotations

import logging
from typing import Any, List

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from app.ai_service import enrich_messages_with_ai, summarize_thread
from app.loader import list_datasets, load_messages
from app.parser import build_thread_tree
from app.schemas import DatasetListResponse, Message, MessagesResponse, ThreadResponse

logger = logging.getLogger(__name__)

# In-memory store for user-uploaded datasets
uploaded_datasets: dict[str, list[Message]] = {}

app = FastAPI(
    title="Discussion Thread Backend",
    version="0.1.0",
    description="Minimal backend for loading and parsing threaded discussion datasets.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class UploadDatasetRequest(BaseModel):
    name: str
    messages: List[Any]


def _resolve_messages(dataset_id: str) -> tuple[list[Message], list[str]]:
    """Load messages from file or in-memory uploaded store."""
    if dataset_id in uploaded_datasets:
        return uploaded_datasets[dataset_id], []
    return load_messages(dataset_id)


@app.get("/")
def healthcheck() -> dict:
    return {"status": "ok", "service": "discussion-thread-backend"}


@app.get("/datasets", response_model=DatasetListResponse)
def get_datasets() -> DatasetListResponse:
    file_datasets = list_datasets()
    all_datasets = file_datasets + [k for k in uploaded_datasets if k not in file_datasets]
    return DatasetListResponse(datasets=sorted(all_datasets))


@app.post("/datasets/upload")
def upload_dataset(payload: UploadDatasetRequest) -> dict:
    """Accept a JSON array of messages and register it as an in-memory dataset."""
    from pydantic import ValidationError

    name = payload.name.strip() or "custom"
    # Sanitize name: keep alphanumeric, hyphens, underscores
    safe_name = "".join(c if c.isalnum() or c in "-_" else "_" for c in name)

    messages: list[Message] = []
    warnings: list[str] = []
    seen_ids: set[str] = set()

    for idx, item in enumerate(payload.messages):
        try:
            msg = Message.model_validate(item)
        except ValidationError as e:
            warnings.append(f"Skipped row {idx}: {e.errors()[0]['msg']}")
            continue
        if msg.id in seen_ids:
            warnings.append(f"Skipped duplicate id '{msg.id}'.")
            continue
        seen_ids.add(msg.id)
        messages.append(msg)

    if not messages:
        raise HTTPException(status_code=400, detail="No valid messages found in uploaded file.")

    messages.sort(key=lambda m: m.timestamp)
    uploaded_datasets[safe_name] = messages

    return {
        "datasetId": safe_name,
        "messageCount": len(messages),
        "warnings": warnings,
    }


@app.get("/discussions/{dataset_id}/messages", response_model=MessagesResponse)
def get_messages(dataset_id: str) -> MessagesResponse:
    try:
        messages, warnings = _resolve_messages(dataset_id)
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e

    return MessagesResponse(
        datasetId=dataset_id,
        messageCount=len(messages),
        messages=messages,
        warnings=warnings,
    )


@app.get("/discussions/{dataset_id}/thread", response_model=ThreadResponse)
def get_thread(dataset_id: str) -> ThreadResponse:
    try:
        messages, warnings = _resolve_messages(dataset_id)
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e

    roots, orphans, stats = build_thread_tree(messages)

    return ThreadResponse(
        datasetId=dataset_id,
        roots=roots,
        orphans=orphans,
        stats=stats,
        warnings=warnings,
    )


@app.get("/discussions/{dataset_id}/messages/annotated")
def get_annotated_messages(dataset_id: str) -> dict:
    """
    Return messages enriched with AI-generated topic and sentiment annotations.
    
    Skips messages that are already fully annotated (topic != 'unknown' AND sentiment != 'unknown').
    Falls back to keyword-based heuristics if API key is missing or API fails.
    """
    try:
        messages, warnings = _resolve_messages(dataset_id)
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e

    enriched_messages = enrich_messages_with_ai(messages)

    return {
        "datasetId": dataset_id,
        "messageCount": len(enriched_messages),
        "messages": enriched_messages,
        "warnings": warnings,
    }


@app.get("/discussions/{dataset_id}/ai-summary")
def get_ai_summary(dataset_id: str) -> dict:
    """
    Return AI-generated summaries for each root thread in the dataset.
    
    Each summary includes:
    - root_id: ID of the root message
    - main_topic: Inferred topic from root message
    - summary: 1-2 sentence summary of the thread
    - key_points: List of 3 key discussion points
    
    Falls back to keyword-based heuristics if API key is missing or API fails.
    """
    try:
        messages, warnings = _resolve_messages(dataset_id)
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e

    # First, enrich messages with AI annotations to get topics
    enriched_dicts = enrich_messages_with_ai(messages)
    
    # Convert enriched dicts back to Message objects
    enriched_messages = [Message(**msg_dict) for msg_dict in enriched_dicts]
    
    # Build thread tree from enriched messages
    roots, _orphans, _stats = build_thread_tree(enriched_messages)

    summaries = []
    for root in roots:
        summary = summarize_thread(root, enriched_messages)
        summaries.append(summary)

    return {
        "datasetId": dataset_id,
        "summaryCount": len(summaries),
        "summaries": summaries,
        "warnings": warnings,
    }