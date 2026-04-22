from __future__ import annotations

import hashlib
import json
import logging
import os
import re
import sqlite3
import threading
import time
from collections import defaultdict
from pathlib import Path
from typing import Dict, List, Optional

from dotenv import load_dotenv
from openai import OpenAI

from app.parser import build_thread_tree
from app.schemas import Message, ThreadNode

load_dotenv()

logger = logging.getLogger(__name__)

BASE_DIR = Path(__file__).resolve().parent.parent
CACHE_DIR = BASE_DIR / ".cache"
CACHE_DIR.mkdir(exist_ok=True)
CACHE_DB = CACHE_DIR / "ai_cache.sqlite3"

_client: OpenAI | None = None

MAX_LIVE_AI_MESSAGES = 60
ANNOTATION_CHUNK_SIZE = 12
ANNOTATION_RETRIES = 2
OPENAI_TIMEOUT_SECONDS = 30

_annotation_dataset_locks: dict[str, threading.Lock] = defaultdict(threading.Lock)
_summary_dataset_locks: dict[str, threading.Lock] = defaultdict(threading.Lock)


def get_openai_client() -> OpenAI | None:
    global _client

    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        logger.debug("[AI] OPENAI_API_KEY not set")
        return None

    if _client is None:
        _client = OpenAI(api_key=api_key)

    return _client


def get_db() -> sqlite3.Connection:
    conn = sqlite3.connect(CACHE_DB)
    conn.row_factory = sqlite3.Row
    return conn


def init_cache_db() -> None:
    with get_db() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS annotation_cache (
                cache_key TEXT PRIMARY KEY,
                value_json TEXT NOT NULL,
                created_at REAL NOT NULL
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS summary_cache (
                cache_key TEXT PRIMARY KEY,
                value_json TEXT NOT NULL,
                created_at REAL NOT NULL
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS annotated_dataset_cache (
                cache_key TEXT PRIMARY KEY,
                value_json TEXT NOT NULL,
                created_at REAL NOT NULL
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS summary_dataset_cache (
                cache_key TEXT PRIMARY KEY,
                value_json TEXT NOT NULL,
                created_at REAL NOT NULL
            )
            """
        )
        conn.commit()


def _get_cached_annotation(cache_key: str) -> Optional[dict]:
    with get_db() as conn:
        row = conn.execute(
            "SELECT value_json FROM annotation_cache WHERE cache_key = ?",
            (cache_key,),
        ).fetchone()

    if row is None:
        return None

    try:
        return json.loads(row["value_json"])
    except (json.JSONDecodeError, KeyError, TypeError):
        logger.warning("[AI] Failed to decode cached annotation for key %s", cache_key)
        return None


def _set_cached_annotation(cache_key: str, value: dict) -> None:
    with get_db() as conn:
        conn.execute(
            """
            INSERT OR REPLACE INTO annotation_cache (cache_key, value_json, created_at)
            VALUES (?, ?, ?)
            """,
            (cache_key, json.dumps(value, ensure_ascii=False), time.time()),
        )
        conn.commit()


def _get_cached_summary(cache_key: str) -> Optional[dict]:
    with get_db() as conn:
        row = conn.execute(
            "SELECT value_json FROM summary_cache WHERE cache_key = ?",
            (cache_key,),
        ).fetchone()

    if row is None:
        return None

    try:
        return json.loads(row["value_json"])
    except (json.JSONDecodeError, KeyError, TypeError):
        logger.warning("[AI] Failed to decode cached summary for key %s", cache_key)
        return None


def _set_cached_summary(cache_key: str, value: dict) -> None:
    with get_db() as conn:
        conn.execute(
            """
            INSERT OR REPLACE INTO summary_cache (cache_key, value_json, created_at)
            VALUES (?, ?, ?)
            """,
            (cache_key, json.dumps(value, ensure_ascii=False), time.time()),
        )
        conn.commit()


def _get_cached_dataset_payload(table_name: str, cache_key: str) -> Optional[dict]:
    with get_db() as conn:
        row = conn.execute(
            f"SELECT value_json FROM {table_name} WHERE cache_key = ?",
            (cache_key,),
        ).fetchone()

    if row is None:
        return None

    try:
        return json.loads(row["value_json"])
    except (json.JSONDecodeError, KeyError, TypeError):
        logger.warning(
            "[AI] Failed to decode cached dataset payload for key %s", cache_key
        )
        return None


def _json_safe(value):
    if isinstance(value, dict):
        return {k: _json_safe(v) for k, v in value.items()}
    if isinstance(value, list):
        return [_json_safe(v) for v in value]
    if hasattr(value, "isoformat"):
        return value.isoformat()
    return value


def _set_cached_dataset_payload(table_name: str, cache_key: str, value: dict) -> None:
    safe_value = _json_safe(value)
    with get_db() as conn:
        conn.execute(
            f"""
            INSERT OR REPLACE INTO {table_name} (cache_key, value_json, created_at)
            VALUES (?, ?, ?)
            """,
            (cache_key, json.dumps(safe_value, ensure_ascii=False), time.time()),
        )
        conn.commit()


def _call_llm_json(prompt: str) -> Optional[dict]:
    client = get_openai_client()
    if client is None:
        return None

    try:
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {
                    "role": "system",
                    "content": "You are a discussion analyst. Respond only with valid JSON.",
                },
                {"role": "user", "content": prompt},
            ],
            temperature=0.2,
            timeout=OPENAI_TIMEOUT_SECONDS,
        )

        if not response.choices or not response.choices[0].message.content:
            logger.warning("[AI] Empty response from LLM")
            return None

        raw_text = response.choices[0].message.content.strip()
        logger.debug("[AI] Raw LLM response: %s...", raw_text[:200])

        try:
            parsed = json.loads(raw_text)
            if isinstance(parsed, list):
                return {"items": parsed}
            if isinstance(parsed, dict):
                return parsed
            return None
        except json.JSONDecodeError:
            match = re.search(r"\[.*\]", raw_text, re.DOTALL)
            if match:
                try:
                    return {"items": json.loads(match.group())}
                except json.JSONDecodeError:
                    logger.warning("[AI] Failed to parse extracted JSON array")

            match = re.search(r"\{.*\}", raw_text, re.DOTALL)
            if match:
                try:
                    return json.loads(match.group())
                except json.JSONDecodeError:
                    logger.warning("[AI] Failed to parse extracted JSON object")

            logger.warning("[AI] No JSON block found in response")
            return None

    except Exception as e:
        logger.warning("[AI] LLM call failed: %s: %s", type(e).__name__, e)
        return None


def _chunk_messages(
    messages: List[Message], chunk_size: int = ANNOTATION_CHUNK_SIZE
) -> List[List[Message]]:
    return [messages[i : i + chunk_size] for i in range(0, len(messages), chunk_size)]


def _build_message_cache_key(message: Message) -> str:
    payload = (
        f"{message.id}|{message.parentId}|"
        f"{getattr(message, 'inferredReplyToId', None)}|"
        f"{message.text}"
    )
    return hashlib.sha256(payload.encode()).hexdigest()


def _build_dataset_cache_key(dataset_id: str, messages: List[Message]) -> str:
    payload_parts = [dataset_id]
    for msg in messages:
        payload_parts.append(
            f"{msg.id}|{msg.parentId}|{msg.timestamp.isoformat()}|{msg.text}"
        )
    payload = "||".join(payload_parts)
    return hashlib.sha256(payload.encode()).hexdigest()


def _annotate_message_batch(messages: List[Message]) -> Dict[str, dict]:
    if not messages:
        return {}

    uncached_messages: List[Message] = []
    results: Dict[str, dict] = {}

    for msg in messages:
        cache_key = _build_message_cache_key(msg)

        existing_inferred_reply = getattr(msg, "inferredReplyToId", None)
        existing_reply_inferred = getattr(msg, "replyInferred", False)

        if msg.topic != "unknown" and msg.sentiment != "unknown":
            results[msg.id] = {
                "topic": msg.topic,
                "sentiment": msg.sentiment,
                "inferred_reply_to_id": existing_inferred_reply,
                "reply_inferred": bool(existing_reply_inferred),
            }
            continue

        cached_annotation = _get_cached_annotation(cache_key)
        if cached_annotation is not None:
            results[msg.id] = cached_annotation
            logger.debug("[AI] Using cached annotation for message %s", msg.id)
            continue

        uncached_messages.append(msg)

    if not uncached_messages:
        return results

    prompt_payload = [
        {
            "id": msg.id,
            "text": msg.text,
            "explicit_parent_id": msg.parentId,
        }
        for msg in uncached_messages
    ]

    prompt = f"""Analyze these discussion messages and return ONLY valid JSON as an array.

For each message, return:
- "id"
- "topic"
- "sentiment"
- "inferred_reply_to_id"
- "reply_inferred"

Rules:
- topic should be a short lowercase label, usually 1 to 3 words
- do NOT force topics into a fixed list
- use a specific topic when possible
- use "other" only if nothing clearer fits
- sentiment must be one of: supportive, critical, mixed, neutral
- if explicit_parent_id is already present, DO NOT infer another reply target
- only infer a reply target when explicit_parent_id is null
- inferred_reply_to_id should be the id of an EARLIER message in this batch if the message appears to respond to it
- if there is no strong evidence of an inferred reply, use null
- reply_inferred should be true only when explicit_parent_id is null and inferred_reply_to_id is not null
- never infer a message replies to itself
- only infer links to messages that appear earlier in the batch
- when possible, replies in the same thread should stay on the same main topic as the thread root
- root messages should establish the thread topic, and replies should usually inherit that topic unless there is a very strong reason not to

Messages:
{json.dumps(prompt_payload, ensure_ascii=False)}

Return ONLY JSON in this format:
[
  {{
    "id": "cc1",
    "topic": "participation",
    "sentiment": "supportive",
    "inferred_reply_to_id": null,
    "reply_inferred": false
  }},
  {{
    "id": "cc2",
    "topic": "participation",
    "sentiment": "critical",
    "inferred_reply_to_id": "cc1",
    "reply_inferred": true
  }}
]
"""

    parsed_items: Optional[List[dict]] = None

    for attempt in range(ANNOTATION_RETRIES):
        result = _call_llm_json(prompt)

        if result is not None and isinstance(result, dict):
            items = result.get("items")
            if isinstance(items, list):
                parsed_items = items
                break

        sleep_seconds = 2 * (attempt + 1)
        logger.warning(
            "[AI] Batch annotation attempt %s failed for %s messages, retrying in %ss",
            attempt + 1,
            len(uncached_messages),
            sleep_seconds,
        )
        time.sleep(sleep_seconds)

    if parsed_items is None:
        logger.warning(
            "[AI] Batch annotation failed for %s messages, returning 'unknown' labels",
            len(uncached_messages),
        )
        for msg in uncached_messages:
            results[msg.id] = {
                "topic": "unknown",
                "sentiment": "unknown",
                "inferred_reply_to_id": None,
                "reply_inferred": False,
            }
        return results

    valid_sentiments = {"supportive", "critical", "mixed", "neutral"}
    valid_ids = {msg.id for msg in uncached_messages}
    explicit_parent_by_id = {msg.id: msg.parentId for msg in uncached_messages}

    parsed_by_id: Dict[str, dict] = {}
    for item in parsed_items:
        if not isinstance(item, dict):
            continue

        msg_id = item.get("id")
        if not isinstance(msg_id, str):
            continue

        topic = item.get("topic", "unknown")
        if not isinstance(topic, str):
            topic = "unknown"
        topic = topic.strip().lower() or "unknown"

        sentiment = item.get("sentiment", "unknown")
        if not isinstance(sentiment, str) or sentiment not in valid_sentiments:
            sentiment = "unknown"

        inferred_reply_to_id = item.get("inferred_reply_to_id")
        if (
            not isinstance(inferred_reply_to_id, str)
            or inferred_reply_to_id not in valid_ids
            or inferred_reply_to_id == msg_id
        ):
            inferred_reply_to_id = None

        has_explicit_parent = explicit_parent_by_id.get(msg_id) is not None

        if has_explicit_parent:
            inferred_reply_to_id = None
            reply_inferred = False
        else:
            reply_inferred = (
                bool(item.get("reply_inferred")) and inferred_reply_to_id is not None
            )

        parsed_by_id[msg_id] = {
            "topic": topic,
            "sentiment": sentiment,
            "inferred_reply_to_id": inferred_reply_to_id,
            "reply_inferred": reply_inferred,
        }

    for msg in uncached_messages:
        annotation = parsed_by_id.get(
            msg.id,
            {
                "topic": "unknown",
                "sentiment": "unknown",
                "inferred_reply_to_id": None,
                "reply_inferred": False,
            },
        )
        results[msg.id] = annotation

        if annotation["topic"] != "unknown" or annotation["sentiment"] != "unknown":
            cache_key = _build_message_cache_key(msg)
            _set_cached_annotation(cache_key, annotation)
            logger.info(
                "[AI] Message %s annotated via batch API: topic=%s, sentiment=%s, "
                "inferred_reply_to_id=%s, reply_inferred=%s",
                msg.id,
                annotation["topic"],
                annotation["sentiment"],
                annotation["inferred_reply_to_id"],
                annotation["reply_inferred"],
            )
        else:
            logger.warning(
                "[AI] No valid batch annotation returned for message %s, using 'unknown' labels",
                msg.id,
            )

    return results


def annotate_message(message: Message) -> dict:
    return _annotate_message_batch([message]).get(
        message.id,
        {
            "topic": "unknown",
            "sentiment": "unknown",
            "inferred_reply_to_id": None,
            "reply_inferred": False,
        },
    )


def flatten_thread(root: ThreadNode) -> List[Message]:
    messages: List[Message] = []

    def dfs(node: ThreadNode) -> None:
        messages.append(
            Message(
                id=node.id,
                author=node.author,
                timestamp=node.timestamp,
                text=node.text,
                parentId=node.parentId,
                topic=node.topic,
                sentiment=node.sentiment,
            )
        )
        for child in node.children:
            dfs(child)

    dfs(root)
    messages.sort(key=lambda m: m.timestamp)
    return messages


def format_thread_transcript(messages: List[Message]) -> str:
    lines = []
    for idx, msg in enumerate(messages, start=1):
        lines.append(f"{idx}. {msg.author}: {msg.text}")
    return "\n".join(lines)


def summarize_thread(root: ThreadNode, all_messages: List[Message]) -> dict:
    cache_key = f"summary_{root.id}"

    cached_summary = _get_cached_summary(cache_key)
    if cached_summary is not None:
        logger.debug("[AI] Using cached summary for root %s", root.id)
        return cached_summary

    thread_messages = flatten_thread(root)
    root_msg = next((m for m in all_messages if m.id == root.id), None)
    main_topic = root_msg.topic if root_msg else "unknown"

    transcript = format_thread_transcript(thread_messages)
    prompt = f"""Summarize this discussion thread. Return ONLY valid JSON with:
- "summary": 1-2 sentence overall summary
- "key_points": array of 3 key points (strings)

Thread transcript:
{transcript}

Return ONLY JSON, no markdown or extra text."""

    result = _call_llm_json(prompt)
    if result and "summary" in result and "key_points" in result:
        summary_dict = {
            "root_id": root.id,
            "main_topic": main_topic,
            "summary": result["summary"],
            "key_points": result["key_points"]
            if isinstance(result["key_points"], list)
            else [result["key_points"]],
        }
        logger.info("[AI] Summary for root %s generated via API", root.id)
        _set_cached_summary(cache_key, summary_dict)
        return summary_dict

    logger.info("[AI] Using fallback summary for root %s", root.id)
    return _summarize_fallback(root, thread_messages)


def _summarize_fallback(root: ThreadNode, thread_messages: List[Message]) -> dict:
    summary = f'[No API] Discussion started with: "{root.text[:100]}..."'

    key_points = [
        "API summary unavailable - annotation labels provide limited insight.",
        f"Thread has {len(thread_messages)} messages in total.",
        f"Root message by {root.author}.",
    ]

    main_topic = root.topic if root.topic != "unknown" else "general"

    result = {
        "root_id": root.id,
        "main_topic": main_topic,
        "summary": summary,
        "key_points": key_points,
    }
    logger.warning("[AI] Fallback summary used for root %s (API unavailable)", root.id)
    return result


def _get_effective_parent_id(msg_dict: dict) -> Optional[str]:
    inferred = msg_dict.get("inferredReplyToId")
    if isinstance(inferred, str) and inferred:
        return inferred

    parent = msg_dict.get("parentId")
    if isinstance(parent, str) and parent:
        return parent

    return None


def _resolve_root_id(message_id: str, messages_by_id: Dict[str, dict]) -> str:
    current_id = message_id
    seen = set()

    while current_id in messages_by_id and current_id not in seen:
        seen.add(current_id)
        current_msg = messages_by_id[current_id]
        parent_id = _get_effective_parent_id(current_msg)

        if not parent_id or parent_id not in messages_by_id:
            return current_id

        current_id = parent_id

    return current_id


def _apply_root_topics(enriched: List[dict]) -> List[dict]:
    messages_by_id = {msg["id"]: msg for msg in enriched if "id" in msg}

    root_topic_by_message_id: Dict[str, str] = {}

    for msg in enriched:
        msg_id = msg.get("id")
        if not isinstance(msg_id, str):
            continue

        root_id = _resolve_root_id(msg_id, messages_by_id)
        root_msg = messages_by_id.get(root_id, {})

        root_topic = root_msg.get("topic")
        if (
            not isinstance(root_topic, str)
            or not root_topic.strip()
            or root_topic == "unknown"
        ):
            root_topic = "other"

        root_topic_by_message_id[msg_id] = root_topic

    for msg in enriched:
        msg_id = msg.get("id")
        if isinstance(msg_id, str) and msg_id in root_topic_by_message_id:
            msg["topic"] = root_topic_by_message_id[msg_id]

    return enriched


def enrich_messages_with_ai(messages: List[Message]) -> List[dict]:
    if len(messages) > MAX_LIVE_AI_MESSAGES:
        logger.warning(
            "[AI] Skipping live annotation for large dataset (%s messages)",
            len(messages),
        )
        return [_json_safe(msg.model_dump()) for msg in messages]

    enriched: List[dict] = []

    batch_annotations: Dict[str, dict] = {}
    for batch in _chunk_messages(messages, chunk_size=ANNOTATION_CHUNK_SIZE):
        batch_annotations.update(_annotate_message_batch(batch))

    for msg in messages:
        msg_dict = msg.model_dump()
        annotation = batch_annotations.get(
            msg.id,
            {
                "topic": msg.topic,
                "sentiment": msg.sentiment,
                "inferred_reply_to_id": None,
                "reply_inferred": False,
            },
        )

        msg_dict["topic"] = annotation.get("topic", msg.topic)
        msg_dict["sentiment"] = annotation.get("sentiment", msg.sentiment)

        if msg.parentId:
            msg_dict["inferredReplyToId"] = None
            msg_dict["replyInferred"] = False
        else:
            msg_dict["inferredReplyToId"] = annotation.get("inferred_reply_to_id")
            msg_dict["replyInferred"] = annotation.get("reply_inferred", False)

        enriched.append(_json_safe(msg_dict))

    enriched = _apply_root_topics(enriched)

    logger.info("[AI] Enriched %s messages", len(enriched))
    return enriched


def get_cached_annotated_dataset(dataset_id: str, messages: List[Message]) -> dict:
    cache_key = _build_dataset_cache_key(dataset_id, messages)

    cached = _get_cached_dataset_payload("annotated_dataset_cache", cache_key)
    if cached is not None:
        logger.debug("[AI] Using cached annotated dataset for %s", dataset_id)
        return cached

    lock = _annotation_dataset_locks[cache_key]
    with lock:
        cached = _get_cached_dataset_payload("annotated_dataset_cache", cache_key)
        if cached is not None:
            logger.debug(
                "[AI] Using cached annotated dataset for %s after lock", dataset_id
            )
            return cached

        enriched_messages = enrich_messages_with_ai(messages)
        result = {
            "datasetId": dataset_id,
            "messageCount": len(enriched_messages),
            "messages": enriched_messages,
            "warnings": [],
        }

        _set_cached_dataset_payload("annotated_dataset_cache", cache_key, result)
        logger.info("[AI] Cached annotated dataset for %s", dataset_id)
        return result


def get_cached_summary_dataset(dataset_id: str, messages: List[Message]) -> dict:
    cache_key = _build_dataset_cache_key(dataset_id, messages)

    cached = _get_cached_dataset_payload("summary_dataset_cache", cache_key)
    if cached is not None:
        logger.debug("[AI] Using cached summary dataset for %s", dataset_id)
        return cached

    lock = _summary_dataset_locks[cache_key]
    with lock:
        cached = _get_cached_dataset_payload("summary_dataset_cache", cache_key)
        if cached is not None:
            logger.debug(
                "[AI] Using cached summary dataset for %s after lock", dataset_id
            )
            return cached

        enriched_dicts = get_cached_annotated_dataset(dataset_id, messages)["messages"]
        enriched_messages = [Message(**msg_dict) for msg_dict in enriched_dicts]

        roots, _orphans, _stats = build_thread_tree(enriched_messages)

        summaries = []
        for root in roots:
            summaries.append(summarize_thread(root, enriched_messages))

        result = {
            "datasetId": dataset_id,
            "summaryCount": len(summaries),
            "summaries": _json_safe(summaries),
            "warnings": [],
        }

        _set_cached_dataset_payload("summary_dataset_cache", cache_key, result)
        logger.info("[AI] Cached summary dataset for %s", dataset_id)
        return result