from __future__ import annotations

import hashlib
import json
import logging
import os
import re
import time
from typing import Dict, List, Optional

from dotenv import load_dotenv

from app.schemas import Message, ThreadNode

load_dotenv()

logger = logging.getLogger(__name__)

_annotation_cache: Dict[str, dict] = {}
_summary_cache: Dict[str, dict] = {}


def _call_llm_json(prompt: str) -> Optional[dict]:
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        logger.debug("[AI] OPENAI_API_KEY not set, returning None")
        return None

    try:
        import openai

        client = openai.OpenAI(api_key=api_key)
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
            timeout=20,
        )

        if not response.choices or not response.choices[0].message.content:
            logger.warning("[AI] Empty response from LLM")
            return None

        raw_text = response.choices[0].message.content.strip()
        logger.debug(f"[AI] Raw LLM response: {raw_text[:200]}...")

        try:
            return json.loads(raw_text)
        except json.JSONDecodeError:
            match = re.search(r"\{.*\}", raw_text, re.DOTALL)
            if match:
                try:
                    return json.loads(match.group())
                except json.JSONDecodeError:
                    logger.warning("[AI] Failed to parse extracted JSON object")
                    return None

            match = re.search(r"\[.*\]", raw_text, re.DOTALL)
            if match:
                try:
                    return {"items": json.loads(match.group())}
                except json.JSONDecodeError:
                    logger.warning("[AI] Failed to parse extracted JSON array")
                    return None

            logger.warning("[AI] No JSON block found in response")
            return None

    except ImportError:
        logger.warning("[AI] openai package not installed, returning None")
        return None
    except Exception as e:
        logger.warning(f"[AI] LLM call failed: {type(e).__name__}: {e}")
        return None


def _chunk_messages(messages: List[Message], chunk_size: int = 10) -> List[List[Message]]:
    return [messages[i:i + chunk_size] for i in range(0, len(messages), chunk_size)]


def _build_message_cache_key(message: Message) -> str:
    payload = f"{message.id}|{message.text}"
    return hashlib.sha256(payload.encode()).hexdigest()


def _annotate_message_batch(messages: List[Message]) -> Dict[str, dict]:
    if not messages:
        return {}

    uncached_messages: List[Message] = []
    results: Dict[str, dict] = {}

    for msg in messages:
        cache_key = _build_message_cache_key(msg)

        if msg.topic != "unknown" and msg.sentiment != "unknown":
            results[msg.id] = {"topic": msg.topic, "sentiment": msg.sentiment}
            continue

        if cache_key in _annotation_cache:
            results[msg.id] = _annotation_cache[cache_key]
            logger.debug(f"[AI] Using cached annotation for message {msg.id}")
            continue

        uncached_messages.append(msg)

    if not uncached_messages:
        return results

    prompt_payload = [
        {"id": msg.id, "text": msg.text}
        for msg in uncached_messages
    ]

    prompt = f"""Analyze these discussion messages and return ONLY valid JSON as an array.

For each message, return:
- "id"
- "topic"
- "sentiment"

Allowed topic values:
deadline, grading, meeting, participation, logistics, other

Allowed sentiment values:
supportive, critical, mixed, neutral

Messages:
{json.dumps(prompt_payload, ensure_ascii=False)}

Return ONLY JSON in this format:
[
  {{"id":"cc1","topic":"deadline","sentiment":"critical"}},
  {{"id":"cc2","topic":"participation","sentiment":"supportive"}}
]
"""

    parsed_items: Optional[List[dict]] = None

    for attempt in range(3):
        result = _call_llm_json(prompt)

        if result is not None:
            if isinstance(result, dict) and isinstance(result.get("items"), list):
                parsed_items = result["items"]
                break
            if isinstance(result, list):
                parsed_items = result
                break

        sleep_seconds = 5 * (attempt + 1)
        logger.warning(
            f"[AI] Batch annotation attempt {attempt + 1} failed for "
            f"{len(uncached_messages)} messages, retrying in {sleep_seconds}s"
        )
        time.sleep(sleep_seconds)

    if parsed_items is None:
        logger.warning(
            f"[AI] Batch annotation failed for {len(uncached_messages)} messages, "
            "returning 'unknown' labels"
        )
        for msg in uncached_messages:
            results[msg.id] = {"topic": "unknown", "sentiment": "unknown"}
        return results

    parsed_by_id: Dict[str, dict] = {}
    for item in parsed_items:
        if not isinstance(item, dict):
            continue

        msg_id = item.get("id")
        topic = item.get("topic", "unknown")
        sentiment = item.get("sentiment", "unknown")

        if not isinstance(msg_id, str):
            continue

        if topic not in {"deadline", "grading", "meeting", "participation", "logistics", "other"}:
            topic = "unknown"

        if sentiment not in {"supportive", "critical", "mixed", "neutral"}:
            sentiment = "unknown"

        parsed_by_id[msg_id] = {"topic": topic, "sentiment": sentiment}

    for msg in uncached_messages:
        annotation = parsed_by_id.get(msg.id, {"topic": "unknown", "sentiment": "unknown"})
        results[msg.id] = annotation

        if annotation["topic"] != "unknown" or annotation["sentiment"] != "unknown":
            cache_key = _build_message_cache_key(msg)
            _annotation_cache[cache_key] = annotation
            logger.info(
                f"[AI] Message {msg.id} annotated via batch API: "
                f"topic={annotation['topic']}, sentiment={annotation['sentiment']}"
            )
        else:
            logger.warning(
                f"[AI] No valid batch annotation returned for message {msg.id}, "
                "using 'unknown' labels"
            )

    return results


def annotate_message(message: Message) -> dict:
    return _annotate_message_batch([message]).get(
        message.id,
        {"topic": "unknown", "sentiment": "unknown"},
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
    if cache_key in _summary_cache:
        logger.debug(f"[AI] Using cached summary for root {root.id}")
        return _summary_cache[cache_key]

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
        logger.info(f"[AI] Summary for root {root.id} generated via API")
        _summary_cache[cache_key] = summary_dict
        return summary_dict

    logger.info(f"[AI] Using fallback summary for root {root.id}")
    return _summarize_fallback(root, thread_messages)


def _summarize_fallback(root: ThreadNode, thread_messages: List[Message]) -> dict:
    summary = f"[No API] Discussion started with: \"{root.text[:100]}...\""

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
    logger.warning(f"[AI] Fallback summary used for root {root.id} (API unavailable)")
    return result


def enrich_messages_with_ai(messages: List[Message]) -> List[dict]:
    enriched: List[dict] = []

    batch_annotations: Dict[str, dict] = {}
    for batch in _chunk_messages(messages, chunk_size=10):
        batch_annotations.update(_annotate_message_batch(batch))

    for msg in messages:
        msg_dict = msg.model_dump()
        annotation = batch_annotations.get(
            msg.id,
            {"topic": msg.topic, "sentiment": msg.sentiment},
        )

        if annotation.get("topic") != "unknown":
            msg_dict["topic"] = annotation.get("topic", msg.topic)
        else:
            msg_dict["topic"] = msg.topic

        if annotation.get("sentiment") != "unknown":
            msg_dict["sentiment"] = annotation.get("sentiment", msg.sentiment)
        else:
            msg_dict["sentiment"] = msg.sentiment

        enriched.append(msg_dict)

    logger.info(f"[AI] Enriched {len(enriched)} messages")
    return enriched