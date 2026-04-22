from __future__ import annotations

import logging
import threading
from contextlib import asynccontextmanager
from typing import Any, List

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from app.ai_service import (
    get_cached_annotated_dataset,
    get_cached_summary_dataset,
    init_cache_db,
)
from app.loader import list_datasets, load_messages
from app.parser import build_thread_tree
from app.schemas import DatasetListResponse, Message, MessagesResponse, ThreadResponse

logger = logging.getLogger(__name__)

uploaded_datasets: dict[str, list[Message]] = {}


def _resolve_messages(dataset_id: str) -> tuple[list[Message], list[str]]:
    if dataset_id in uploaded_datasets:
        return uploaded_datasets[dataset_id], []
    return load_messages(dataset_id)


def _warm_all_datasets() -> None:
    try:
        dataset_ids = list_datasets()

        datasets_with_sizes: list[tuple[str, int]] = []
        for dataset_id in dataset_ids:
            try:
                messages, _warnings = load_messages(dataset_id)
                datasets_with_sizes.append((dataset_id, len(messages)))
            except Exception as e:
                logger.warning("[Warmup] Failed loading %s: %s", dataset_id, e)

        datasets_with_sizes.sort(key=lambda x: x[1])

        for dataset_id, size in datasets_with_sizes:
            try:
                messages, _warnings = load_messages(dataset_id)
                logger.info("[Warmup] Processing %s (%s messages)", dataset_id, size)

                get_cached_annotated_dataset(dataset_id, messages)
                get_cached_summary_dataset(dataset_id, messages)

                logger.info("[Warmup] Finished %s", dataset_id)
            except Exception as e:
                logger.warning("[Warmup] Failed processing %s: %s", dataset_id, e)

    except Exception as e:
        logger.warning("[Warmup] Background warmup crashed: %s", e)


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_cache_db()

    warmup_thread = threading.Thread(target=_warm_all_datasets, daemon=True)
    warmup_thread.start()

    yield


app = FastAPI(
    title="Discussion Thread Backend",
    version="0.1.0",
    description="Minimal backend for loading and parsing threaded discussion datasets.",
    lifespan=lifespan,
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


@app.get("/")
def healthcheck() -> dict:
    return {"status": "ok", "service": "discussion-thread-backend"}


@app.get("/datasets", response_model=DatasetListResponse)
def get_datasets() -> DatasetListResponse:
    file_datasets = list_datasets()
    all_datasets = file_datasets + [
        k for k in uploaded_datasets if k not in file_datasets
    ]
    return DatasetListResponse(datasets=sorted(all_datasets))


@app.post("/datasets/upload")
def upload_dataset(payload: UploadDatasetRequest) -> dict:
    from pydantic import ValidationError

    name = payload.name.strip() or "custom"
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
        raise HTTPException(
            status_code=400,
            detail="No valid messages found in uploaded file.",
        )

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
    try:
        messages, warnings = _resolve_messages(dataset_id)
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e

    result = get_cached_annotated_dataset(dataset_id, messages)
    result["warnings"] = warnings
    return result


@app.get("/discussions/{dataset_id}/ai-summary")
def get_ai_summary(dataset_id: str) -> dict:
    try:
        messages, warnings = _resolve_messages(dataset_id)
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e

    result = get_cached_summary_dataset(dataset_id, messages)
    result["warnings"] = warnings
    return result