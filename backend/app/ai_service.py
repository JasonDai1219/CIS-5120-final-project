from __future__ import annotations

import hashlib
import json
import logging
import os
import random
import re
import sqlite3
import threading
import time
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from typing import Dict, List, Optional, Tuple

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
_client_lock = threading.Lock()

# ── Tuning knobs ────────────────────────────────────────────────────────────
ANNOTATION_CHUNK_SIZE = 25        # messages per LLM call (was 12)
MAX_ANNOTATION_WORKERS = 6        # parallel annotation threads
MAX_SUMMARY_WORKERS = 8           # parallel summary threads
SUMMARY_BATCH_SIZE = 5            # threads summarised in one LLM call
MAX_LIVE_AI_MESSAGES = 2_000      # only skip above this (was 60!)
ANNOTATION_RETRIES = 3
OPENAI_TIMEOUT_SECONDS = 45
# ────────────────────────────────────────────────────────────────────────────

_annotation_dataset_locks: dict[str, threading.Lock] = defaultdict(threading.Lock)
_summary_dataset_locks: dict[str, threading.Lock] = defaultdict(threading.Lock)

# Thread-local SQLite connections (one per thread, avoids contention)
_local = threading.local()


def get_openai_client() -> OpenAI | None:
    global _client
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        logger.debug("[AI] OPENAI_API_KEY not set")
        return None
    with _client_lock:
        if _client is None:
            _client = OpenAI(api_key=api_key)
    return _client


# ── Database ─────────────────────────────────────────────────────────────────

def _get_db() -> sqlite3.Connection:
    """Return a per-thread SQLite connection (thread-safe, avoids lock contention)."""
    conn = getattr(_local, "conn", None)
    if conn is None:
        conn = sqlite3.connect(CACHE_DB, check_same_thread=False)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA journal_mode=WAL")   # enables concurrent readers
        conn.execute("PRAGMA synchronous=NORMAL")
        _local.conn = conn
    return conn


def init_cache_db() -> None:
    db = _get_db()
    db.executescript(
        """
        CREATE TABLE IF NOT EXISTS annotation_cache (
            cache_key TEXT PRIMARY KEY,
            value_json TEXT NOT NULL,
            created_at REAL NOT NULL
        );
        CREATE TABLE IF NOT EXISTS summary_cache (
            cache_key TEXT PRIMARY KEY,
            value_json TEXT NOT NULL,
            created_at REAL NOT NULL
        );
        CREATE TABLE IF NOT EXISTS annotated_dataset_cache (
            cache_key TEXT PRIMARY KEY,
            value_json TEXT NOT NULL,
            created_at REAL NOT NULL
        );
        CREATE TABLE IF NOT EXISTS summary_dataset_cache (
            cache_key TEXT PRIMARY KEY,
            value_json TEXT NOT NULL,
            created_at REAL NOT NULL
        );
        """
    )
    db.commit()


def _db_get(table: str, cache_key: str) -> Optional[dict]:
    try:
        row = _get_db().execute(
            f"SELECT value_json FROM {table} WHERE cache_key = ?", (cache_key,)
        ).fetchone()
        if row is None:
            return None
        return json.loads(row["value_json"])
    except Exception:
        return None


def _db_set(table: str, cache_key: str, value: dict) -> None:
    try:
        db = _get_db()
        db.execute(
            f"INSERT OR REPLACE INTO {table} (cache_key, value_json, created_at) VALUES (?, ?, ?)",
            (cache_key, json.dumps(_json_safe(value), ensure_ascii=False), time.time()),
        )
        db.commit()
    except Exception as exc:
        logger.warning("[AI] Cache write failed for %s: %s", cache_key, exc)


# ── Helpers ───────────────────────────────────────────────────────────────────

def _json_safe(value):
    if isinstance(value, dict):
        return {k: _json_safe(v) for k, v in value.items()}
    if isinstance(value, list):
        return [_json_safe(v) for v in value]
    if hasattr(value, "isoformat"):
        return value.isoformat()
    return value


def _msg_cache_key(msg: Message) -> str:
    payload = (
        f"{msg.id}|{msg.parentId}|"
        f"{getattr(msg, 'inferredReplyToId', None)}|"
        f"{msg.text}"
    )
    return hashlib.sha256(payload.encode()).hexdigest()


def _dataset_cache_key(dataset_id: str, messages: List[Message]) -> str:
    parts = [dataset_id] + [
        f"{m.id}|{m.parentId}|{m.timestamp.isoformat()}|{m.text}" for m in messages
    ]
    return hashlib.sha256("||".join(parts).encode()).hexdigest()


def _chunk(lst: list, size: int) -> List[list]:
    return [lst[i : i + size] for i in range(0, len(lst), size)]


def _jittered_sleep(attempt: int) -> None:
    """Exponential backoff with full jitter — doesn't starve other threads."""
    cap = 8.0
    base = min(cap, 0.5 * (2 ** attempt))
    time.sleep(random.uniform(0, base))


# ── LLM call ─────────────────────────────────────────────────────────────────

def _call_llm_json(prompt: str, system: str = "You are a discussion analyst. Respond only with valid JSON.") -> Optional[dict]:
    client = get_openai_client()
    if client is None:
        return None

    try:
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": prompt},
            ],
            temperature=0.2,
            response_format={"type": "json_object"},  # forces valid JSON out
            timeout=OPENAI_TIMEOUT_SECONDS,
        )

        if not response.choices or not response.choices[0].message.content:
            return None

        raw = response.choices[0].message.content.strip()
        logger.debug("[AI] LLM response snippet: %s…", raw[:120])

        parsed = json.loads(raw)
        if isinstance(parsed, list):
            return {"items": parsed}
        return parsed if isinstance(parsed, dict) else None

    except json.JSONDecodeError:
        # Fallback: try to salvage an array or object from the text
        raw_text = getattr(response.choices[0].message, "content", "") or ""
        for pattern, wrapper in [(r"\[.*\]", "items"), (r"\{.*\}", None)]:
            m = re.search(pattern, raw_text, re.DOTALL)
            if m:
                try:
                    extracted = json.loads(m.group())
                    return {wrapper: extracted} if wrapper else extracted
                except json.JSONDecodeError:
                    pass
        logger.warning("[AI] Could not parse JSON from LLM response")
        return None

    except Exception as exc:
        logger.warning("[AI] LLM call failed: %s: %s", type(exc).__name__, exc)
        return None


# ── Annotation ────────────────────────────────────────────────────────────────

def _annotate_batch(messages: List[Message]) -> Dict[str, dict]:
    """
    Annotate a single chunk of messages.
    Checks the per-message cache first; only calls the LLM for cache-misses.
    Returns {msg_id: annotation_dict}.
    """
    if not messages:
        return {}

    results: Dict[str, dict] = {}
    uncached: List[Message] = []

    for msg in messages:
        # Already fully annotated (e.g. loaded from a pre-annotated dataset)
        if msg.topic != "unknown" and msg.sentiment != "unknown":
            results[msg.id] = {
                "topic": msg.topic,
                "sentiment": msg.sentiment,
                "inferred_reply_to_id": getattr(msg, "inferredReplyToId", None),
                "reply_inferred": bool(getattr(msg, "replyInferred", False)),
            }
            continue

        cached = _db_get("annotation_cache", _msg_cache_key(msg))
        if cached is not None:
            results[msg.id] = cached
            continue

        uncached.append(msg)

    if not uncached:
        return results

    payload = [
        {"id": m.id, "text": m.text, "explicit_parent_id": m.parentId}
        for m in uncached
    ]

    prompt = f"""Analyze these discussion messages. Return a JSON object with an "items" array.

Each item must contain:
- "id"            — the message id (string, unchanged)
- "topic"         — short lowercase label (1–3 words); be specific, avoid "other"
- "sentiment"     — one of: supportive | critical | mixed | neutral
- "inferred_reply_to_id" — id of an earlier message this replies to, or null
- "reply_inferred" — true only when explicit_parent_id is null AND inferred_reply_to_id is not null

Rules:
• If explicit_parent_id is set, inferred_reply_to_id MUST be null and reply_inferred MUST be false.
• Never infer a message replies to itself.
• Only link to messages that appear earlier in this list.
• Reply messages should inherit the root thread's topic when there is no strong reason to diverge.

Messages:
{json.dumps(payload, ensure_ascii=False)}

Respond with ONLY this JSON structure (no markdown, no extra keys):
{{"items": [{{"id": "...", "topic": "...", "sentiment": "...", "inferred_reply_to_id": null, "reply_inferred": false}}]}}"""

    parsed_items: Optional[List[dict]] = None
    for attempt in range(ANNOTATION_RETRIES):
        result = _call_llm_json(prompt)
        if result and isinstance(result.get("items"), list):
            parsed_items = result["items"]
            break
        logger.warning(
            "[AI] Annotation attempt %d/%d failed (%d msgs)",
            attempt + 1, ANNOTATION_RETRIES, len(uncached),
        )
        if attempt < ANNOTATION_RETRIES - 1:
            _jittered_sleep(attempt)

    valid_sentiments = {"supportive", "critical", "mixed", "neutral"}
    valid_ids = {m.id for m in uncached}
    explicit_parent = {m.id: m.parentId for m in uncached}

    parsed_by_id: Dict[str, dict] = {}
    if parsed_items:
        for item in parsed_items:
            if not isinstance(item, dict):
                continue
            msg_id = item.get("id")
            if not isinstance(msg_id, str) or msg_id not in valid_ids:
                continue

            topic = (item.get("topic") or "unknown").strip().lower() or "unknown"

            sentiment = item.get("sentiment", "unknown")
            if sentiment not in valid_sentiments:
                sentiment = "unknown"

            inferred = item.get("inferred_reply_to_id")
            if (
                not isinstance(inferred, str)
                or inferred not in valid_ids
                or inferred == msg_id
            ):
                inferred = None

            has_explicit = explicit_parent.get(msg_id) is not None
            if has_explicit:
                inferred = None
                reply_inferred = False
            else:
                reply_inferred = bool(item.get("reply_inferred")) and inferred is not None

            parsed_by_id[msg_id] = {
                "topic": topic,
                "sentiment": sentiment,
                "inferred_reply_to_id": inferred,
                "reply_inferred": reply_inferred,
            }

    _unknown = {"topic": "unknown", "sentiment": "unknown", "inferred_reply_to_id": None, "reply_inferred": False}

    for msg in uncached:
        annotation = parsed_by_id.get(msg.id, _unknown.copy())
        results[msg.id] = annotation

        if annotation["topic"] != "unknown" or annotation["sentiment"] != "unknown":
            _db_set("annotation_cache", _msg_cache_key(msg), annotation)
            logger.info(
                "[AI] Annotated %s → topic=%s sentiment=%s inferred=%s",
                msg.id, annotation["topic"], annotation["sentiment"],
                annotation["inferred_reply_to_id"],
            )
        else:
            logger.warning("[AI] No valid annotation for message %s", msg.id)

    return results


def _annotate_all_parallel(messages: List[Message]) -> Dict[str, dict]:
    """
    Split messages into chunks and annotate all chunks in parallel.
    Returns a merged {msg_id: annotation} dict.
    """
    chunks = _chunk(messages, ANNOTATION_CHUNK_SIZE)
    combined: Dict[str, dict] = {}

    with ThreadPoolExecutor(max_workers=min(MAX_ANNOTATION_WORKERS, len(chunks))) as pool:
        futures = {pool.submit(_annotate_batch, chunk): chunk for chunk in chunks}
        for future in as_completed(futures):
            try:
                combined.update(future.result())
            except Exception as exc:
                chunk = futures[future]
                logger.warning(
                    "[AI] Annotation chunk failed (%d msgs): %s", len(chunk), exc
                )
                for msg in chunk:
                    combined.setdefault(msg.id, {
                        "topic": "unknown",
                        "sentiment": "unknown",
                        "inferred_reply_to_id": None,
                        "reply_inferred": False,
                    })

    return combined


# ── Root-topic propagation ────────────────────────────────────────────────────

def _get_effective_parent(msg: dict) -> Optional[str]:
    inferred = msg.get("inferredReplyToId")
    if isinstance(inferred, str) and inferred:
        return inferred
    parent = msg.get("parentId")
    if isinstance(parent, str) and parent:
        return parent
    return None


def _resolve_root(msg_id: str, by_id: Dict[str, dict]) -> str:
    seen: set[str] = set()
    current = msg_id
    while current in by_id and current not in seen:
        seen.add(current)
        parent = _get_effective_parent(by_id[current])
        if not parent or parent not in by_id:
            return current
        current = parent
    return current


def _apply_root_topics(enriched: List[dict]) -> List[dict]:
    by_id = {m["id"]: m for m in enriched if "id" in m}
    root_topic: Dict[str, str] = {}

    for msg in enriched:
        mid = msg.get("id")
        if not isinstance(mid, str):
            continue
        root = _resolve_root(mid, by_id)
        topic = by_id.get(root, {}).get("topic") or "other"
        if not topic.strip() or topic == "unknown":
            topic = "other"
        root_topic[mid] = topic

    for msg in enriched:
        mid = msg.get("id")
        if isinstance(mid, str) and mid in root_topic:
            msg["topic"] = root_topic[mid]

    return enriched


# ── Summarization ─────────────────────────────────────────────────────────────

def _flatten_thread(root: ThreadNode) -> List[Message]:
    msgs: List[Message] = []

    def dfs(node: ThreadNode) -> None:
        msgs.append(
            Message(
                id=node.id, author=node.author, timestamp=node.timestamp,
                text=node.text, parentId=node.parentId,
                topic=node.topic, sentiment=node.sentiment,
            )
        )
        for child in node.children:
            dfs(child)

    dfs(root)
    msgs.sort(key=lambda m: m.timestamp)
    return msgs


def _format_transcript(messages: List[Message]) -> str:
    return "\n".join(
        f"{i}. {m.author}: {m.text}" for i, m in enumerate(messages, 1)
    )


def _summarize_thread_batch(roots: List[ThreadNode], all_messages: List[Message]) -> List[dict]:
    """
    Summarise multiple thread roots in a single LLM call.
    Returns a list of summary dicts (same order as roots).
    """
    threads_payload = []
    for root in roots:
        thread_msgs = _flatten_thread(root)
        threads_payload.append({
            "root_id": root.id,
            "transcript": _format_transcript(thread_msgs),
            "message_count": len(thread_msgs),
        })

    prompt = f"""Summarize each of these discussion threads. Return a JSON object with a "summaries" array.

Each summary must contain:
- "root_id"    — unchanged from input
- "summary"    — 1–2 sentence overview of the thread
- "key_points" — array of exactly 3 short key-point strings

Threads:
{json.dumps(threads_payload, ensure_ascii=False)}

Return ONLY this structure (no markdown):
{{"summaries": [{{"root_id": "...", "summary": "...", "key_points": ["...", "...", "..."]}}]}}"""

    result = _call_llm_json(prompt)
    raw_summaries: List[dict] = []
    if result and isinstance(result.get("summaries"), list):
        raw_summaries = result["summaries"]

    by_root_id = {s["root_id"]: s for s in raw_summaries if isinstance(s, dict) and "root_id" in s}

    all_msgs_by_id = {m.id: m for m in all_messages}
    output = []
    for root in roots:
        root_msg = all_msgs_by_id.get(root.id)
        main_topic = (root_msg.topic if root_msg else None) or root.topic or "general"
        if main_topic == "unknown":
            main_topic = "general"

        s = by_root_id.get(root.id)
        if s and "summary" in s and "key_points" in s:
            output.append({
                "root_id": root.id,
                "main_topic": main_topic,
                "summary": s["summary"],
                "key_points": s["key_points"] if isinstance(s["key_points"], list) else [s["key_points"]],
            })
        else:
            # Fallback for this root
            thread_msgs = _flatten_thread(root)
            output.append({
                "root_id": root.id,
                "main_topic": main_topic,
                "summary": f'[Fallback] Discussion started with: "{root.text[:120]}…"',
                "key_points": [
                    "API summary unavailable.",
                    f"Thread has {len(thread_msgs)} messages.",
                    f"Root message by {root.author}.",
                ],
            })

    return output


def _summarize_root(root: ThreadNode, all_messages: List[Message]) -> dict:
    """Single-root summary with per-root cache."""
    cache_key = f"summary_{root.id}"
    cached = _db_get("summary_cache", cache_key)
    if cached is not None:
        return cached

    result = _summarize_thread_batch([root], all_messages)
    summary = result[0] if result else {}
    if summary:
        _db_set("summary_cache", cache_key, summary)
    return summary


def _summarize_all_parallel(roots: List[ThreadNode], all_messages: List[Message]) -> List[dict]:
    """
    Check per-root cache first, then summarise cache-misses in batched parallel calls.
    """
    cached_results: Dict[str, dict] = {}
    uncached_roots: List[ThreadNode] = []

    for root in roots:
        cached = _db_get("summary_cache", f"summary_{root.id}")
        if cached is not None:
            cached_results[root.id] = cached
        else:
            uncached_roots.append(root)

    if uncached_roots:
        batches = _chunk(uncached_roots, SUMMARY_BATCH_SIZE)
        with ThreadPoolExecutor(max_workers=min(MAX_SUMMARY_WORKERS, len(batches))) as pool:
            futures = {
                pool.submit(_summarize_thread_batch, batch, all_messages): batch
                for batch in batches
            }
            for future in as_completed(futures):
                try:
                    batch_results = future.result()
                    for summary in batch_results:
                        rid = summary.get("root_id")
                        if rid:
                            _db_set("summary_cache", f"summary_{rid}", summary)
                            cached_results[rid] = summary
                except Exception as exc:
                    batch = futures[future]
                    logger.warning("[AI] Summary batch failed: %s", exc)
                    for root in batch:
                        cached_results.setdefault(root.id, {
                            "root_id": root.id,
                            "main_topic": root.topic or "general",
                            "summary": f'[Error] Could not summarise thread "{root.text[:80]}…"',
                            "key_points": ["Summary generation failed.", f"Root by {root.author}.", "Please retry."],
                        })

    # Return in original root order
    return [cached_results[root.id] for root in roots if root.id in cached_results]


# ── Public enrichment entry points ────────────────────────────────────────────

def _get_recent_candidates(messages: List[Message], index: int, window: int = 8) -> List[Message]:
    start = max(0, index - window)
    return messages[start:index]


def _infer_root_reply_target(root_msg: Message, candidates: List[Message]) -> Optional[str]:
    """
    For a message that currently looks like a root, decide whether it is actually
    contextually replying to one of a few earlier candidate messages.
    """
    if not candidates:
        return None

    payload = {
        "root_message": {
            "id": root_msg.id,
            "author": root_msg.author,
            "text": root_msg.text,
        },
        "candidate_messages": [
            {
                "id": m.id,
                "author": m.author,
                "text": m.text,
            }
            for m in candidates
        ],
    }

    prompt = f"""A discussion message currently appears to start a new thread. Determine whether it is actually a contextual reply to one of the earlier candidate messages.

Return a JSON object with:
- "inferred_reply_to_id": one candidate id, or null
- "confidence": number from 0 to 1
- "reason": short explanation

Rules:
• Choose a candidate only if the root message clearly responds to it.
• Prefer a direct contextual response, not just a broadly similar topic.
• If uncertain, return null.
• Never choose a message not listed in candidate_messages.

Data:
{json.dumps(payload, ensure_ascii=False)}

Return ONLY:
{{"inferred_reply_to_id": null, "confidence": 0.0, "reason": ""}}"""

    result = _call_llm_json(prompt)
    if not result:
        return None

    inferred = result.get("inferred_reply_to_id")
    confidence = result.get("confidence", 0)
    valid_ids = {m.id for m in candidates}

    if isinstance(inferred, str) and inferred in valid_ids:
        try:
            confidence_value = float(confidence)
        except (TypeError, ValueError):
            confidence_value = 0.0

        if confidence_value >= 0.65:
            return inferred

    return None


def _reattach_contextual_roots(messages: List[Message], enriched: List[dict], window: int = 8) -> List[dict]:
    """
    Second pass:
    Only inspect messages that are still roots (no explicit parent and no inferred parent).
    Try to attach them to one of a few earlier messages if they read like contextual replies.
    """
    for i, msg in enumerate(messages):
        enriched_msg = enriched[i]

        # Keep explicit replies untouched
        if msg.parentId is not None:
            continue

        # Only inspect messages still acting as roots
        if enriched_msg.get("inferredReplyToId"):
            continue

        candidates = _get_recent_candidates(messages, i, window=window)
        if not candidates:
            continue

        inferred = _infer_root_reply_target(msg, candidates)
        if inferred is not None:
            enriched_msg["inferredReplyToId"] = inferred
            enriched_msg["replyInferred"] = True
            logger.info(
                "[AI] Reattached root %s -> %s via contextual reply inference",
                msg.id,
                inferred,
            )

    return enriched



def enrich_messages_with_ai(messages: List[Message]) -> List[dict]:
    if len(messages) > MAX_LIVE_AI_MESSAGES:
        logger.warning(
            "[AI] Skipping live annotation — dataset too large (%d messages, limit %d)",
            len(messages), MAX_LIVE_AI_MESSAGES,
        )
        return [_json_safe(m.model_dump()) for m in messages]

    batch_annotations = _annotate_all_parallel(messages)

    enriched: List[dict] = []
    for msg in messages:
        msg_dict = _json_safe(msg.model_dump())
        ann = batch_annotations.get(msg.id, {
            "topic": msg.topic,
            "sentiment": msg.sentiment,
            "inferred_reply_to_id": None,
            "reply_inferred": False,
        })

        msg_dict["topic"] = ann.get("topic", msg.topic)
        msg_dict["sentiment"] = ann.get("sentiment", msg.sentiment)

        if msg.parentId:
            msg_dict["inferredReplyToId"] = None
            msg_dict["replyInferred"] = False
        else:
            msg_dict["inferredReplyToId"] = ann.get("inferred_reply_to_id")
            msg_dict["replyInferred"] = ann.get("reply_inferred", False)

        enriched.append(msg_dict)

    # Second pass: only inspect messages that still look like roots
    enriched = _reattach_contextual_roots(messages, enriched, window=8)

    # After roots are reattached, propagate root topic across the final thread tree
    enriched = _apply_root_topics(enriched)

    logger.info("[AI] Enriched %d messages", len(enriched))
    return enriched


def get_cached_annotated_dataset(dataset_id: str, messages: List[Message]) -> dict:
    cache_key = _dataset_cache_key(dataset_id, messages)
    cached = _db_get("annotated_dataset_cache", cache_key)
    if cached is not None:
        logger.debug("[AI] annotated dataset cache hit: %s", dataset_id)
        return cached

    lock = _annotation_dataset_locks[cache_key]
    with lock:
        # Double-checked locking
        cached = _db_get("annotated_dataset_cache", cache_key)
        if cached is not None:
            return cached

        enriched = enrich_messages_with_ai(messages)
        result = {
            "datasetId": dataset_id,
            "messageCount": len(enriched),
            "messages": enriched,
            "warnings": [],
        }
        _db_set("annotated_dataset_cache", cache_key, result)
        logger.info("[AI] Cached annotated dataset: %s", dataset_id)
        return result


def get_cached_summary_dataset(dataset_id: str, messages: List[Message]) -> dict:
    cache_key = _dataset_cache_key(dataset_id, messages)
    cached = _db_get("summary_dataset_cache", cache_key)
    if cached is not None:
        logger.debug("[AI] summary dataset cache hit: %s", dataset_id)
        return cached

    lock = _summary_dataset_locks[cache_key]
    with lock:
        cached = _db_get("summary_dataset_cache", cache_key)
        if cached is not None:
            return cached

        # Get annotated messages (from cache if possible)
        annotated = get_cached_annotated_dataset(dataset_id, messages)
        enriched_messages = [Message(**m) for m in annotated["messages"]]

        roots, _orphans, _stats = build_thread_tree(enriched_messages)

        # ── Parallel summarisation ───────────────────────────────────────────
        summaries = _summarize_all_parallel(roots, enriched_messages)

        result = {
            "datasetId": dataset_id,
            "summaryCount": len(summaries),
            "summaries": _json_safe(summaries),
            "warnings": [],
        }
        _db_set("summary_dataset_cache", cache_key, result)
        logger.info("[AI] Cached summary dataset: %s (%d summaries)", dataset_id, len(summaries))
        return result


# ── Backwards-compat helpers (used by main.py / tests) ────────────────────────

def annotate_message(message: Message) -> dict:
    """Annotate a single message (convenience wrapper)."""
    return _annotate_batch([message]).get(message.id, {
        "topic": "unknown",
        "sentiment": "unknown",
        "inferred_reply_to_id": None,
        "reply_inferred": False,
    })


def summarize_thread(root: ThreadNode, all_messages: List[Message]) -> dict:
    """Summarise a single thread root (convenience wrapper with cache)."""
    return _summarize_root(root, all_messages)


def flatten_thread(root: ThreadNode) -> List[Message]:
    return _flatten_thread(root)


def format_thread_transcript(messages: List[Message]) -> str:
    return _format_transcript(messages)