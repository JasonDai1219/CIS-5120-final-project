from __future__ import annotations

import logging

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from app.ai_service import enrich_messages_with_ai, summarize_thread
from app.loader import list_datasets, load_messages
from app.parser import build_thread_tree
from app.schemas import DatasetListResponse, Message, MessagesResponse, ThreadResponse

logger = logging.getLogger(__name__)

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


@app.get("/")
def healthcheck() -> dict:
    return {"status": "ok", "service": "discussion-thread-backend"}


@app.get("/datasets", response_model=DatasetListResponse)
def get_datasets() -> DatasetListResponse:
    return DatasetListResponse(datasets=list_datasets())


@app.get("/discussions/{dataset_id}/messages", response_model=MessagesResponse)
def get_messages(dataset_id: str) -> MessagesResponse:
    try:
        messages, warnings = load_messages(dataset_id)
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
        messages, warnings = load_messages(dataset_id)
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
        messages, warnings = load_messages(dataset_id)
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
        messages, warnings = load_messages(dataset_id)
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