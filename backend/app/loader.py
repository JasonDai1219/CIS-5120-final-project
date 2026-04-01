from __future__ import annotations

import json
from pathlib import Path
from typing import List, Tuple

from pydantic import ValidationError

from app.schemas import Message

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"


def list_datasets() -> List[str]:
    """Return all available dataset names without the .json extension."""
    if not DATA_DIR.exists():
        return []

    return sorted([p.stem for p in DATA_DIR.glob("*.json")])


def load_messages(dataset_id: str) -> Tuple[List[Message], List[str]]:
    """
    Load and validate messages from a dataset file.

    Rules:
    - Invalid rows are skipped with warnings.
    - Duplicate IDs are skipped after the first occurrence.
    - Missing topic/sentiment fall back to defaults via schema.
    - Messages are sorted by timestamp ascending.
    """
    file_path = DATA_DIR / f"{dataset_id}.json"
    if not file_path.exists():
        raise FileNotFoundError(f"Dataset '{dataset_id}' not found.")

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
