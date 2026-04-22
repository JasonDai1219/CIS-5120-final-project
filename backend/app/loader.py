from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import List, Tuple

from pydantic import ValidationError

from app.schemas import Message

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"


def list_datasets() -> List[str]:
    if not DATA_DIR.exists():
        return []
    return sorted([p.stem for p in DATA_DIR.glob("*.json")])


@lru_cache(maxsize=32)
def _load_messages_cached(dataset_id: str, mtime: float) -> Tuple[List[Message], List[str]]:
    file_path = DATA_DIR / f"{dataset_id}.json"

    with file_path.open("r", encoding="utf-8") as f:
        raw = json.load(f)

    if not isinstance(raw, list):
        raise ValueError(f"Dataset '{dataset_id}' must be a JSON list of messages.")

    messages: List[Message] = []
    warnings: List[str] = []
    seen_ids = set()

    for idx, item in enumerate(raw):
        try:
            msg = Message.model_validate(item)
        except ValidationError as e:
            warnings.append(
                f"Skipped row {idx}: validation failed ({e.errors()[0]['msg']})."
            )
            continue

        if msg.id in seen_ids:
            warnings.append(f"Skipped duplicate message id '{msg.id}'.")
            continue

        seen_ids.add(msg.id)
        messages.append(msg)

    messages.sort(key=lambda m: m.timestamp)
    return messages, warnings


def load_messages(dataset_id: str) -> Tuple[List[Message], List[str]]:
    file_path = DATA_DIR / f"{dataset_id}.json"
    if not file_path.exists():
        raise FileNotFoundError(f"Dataset '{dataset_id}' not found.")

    mtime = file_path.stat().st_mtime
    return _load_messages_cached(dataset_id, mtime)