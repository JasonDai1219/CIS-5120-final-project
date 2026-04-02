from __future__ import annotations

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from app.loader import list_datasets, load_messages
from app.parser import build_thread_tree
from app.schemas import DatasetListResponse, MessagesResponse, ThreadResponse

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