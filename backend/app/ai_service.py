"""
AI service for message annotation and thread summarization.

Handles LLM calls with graceful fallback when API key is missing or API fails.
Includes lightweight in-memory caching to avoid repeated calls.
"""

from __future__ import annotations

import hashlib
import json
import logging
import os
import re
from typing import Any, Dict, List, Optional

from dotenv import load_dotenv

from app.schemas import Message, ThreadNode

# Load environment variables from .env file
load_dotenv()

logger = logging.getLogger(__name__)

# Lightweight in-memory cache: key -> result
_annotation_cache: Dict[str, dict] = {}
_summary_cache: Dict[str, dict] = {}


def _call_llm_json(prompt: str) -> Optional[dict]:
    """
    Call OpenAI LLM and attempt to parse response as JSON.
    
    Returns None if:
    - OPENAI_API_KEY is not set
    - API call fails (network, rate limit, etc.)
    - Response cannot be parsed as JSON
    
    Never raises exceptions to prevent endpoint 500s.
    """
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        logger.debug("[AI] OPENAI_API_KEY not set, returning None")
        return None

    try:
        import openai
        
        client = openai.OpenAI(api_key=api_key)
        response = client.chat.completions.create(
            model="gpt-4o-mini",  # Cheap, stable model for demo
            messages=[
                {
                    "role": "system",
                    "content": "You are a discussion analyst. Respond only with valid JSON.",
                },
                {"role": "user", "content": prompt},
            ],
            temperature=0.2,  # Low temperature for stable structure
            timeout=10,
        )

        if not response.choices or not response.choices[0].message.content:
            logger.warning("[AI] Empty response from LLM")
            return None

        raw_text = response.choices[0].message.content.strip()
        logger.debug(f"[AI] Raw LLM response: {raw_text[:100]}...")

        # Try direct JSON parse
        try:
            result = json.loads(raw_text)
            logger.debug("[AI] JSON parsed successfully")
            return result
        except json.JSONDecodeError:
            # Try to extract JSON block from response
            match = re.search(r"\{.*\}", raw_text, re.DOTALL)
            if match:
                try:
                    result = json.loads(match.group())
                    logger.debug("[AI] JSON extracted and parsed from response")
                    return result
                except json.JSONDecodeError:
                    logger.warning("[AI] Failed to parse extracted JSON")
                    return None
            else:
                logger.warning("[AI] No JSON block found in response")
                return None

    except ImportError:
        logger.warning("[AI] openai package not installed, returning None")
        return None
    except Exception as e:
        logger.warning(f"[AI] LLM call failed: {type(e).__name__}: {e}")
        return None


def annotate_message(message: Message) -> dict:
    """
    Annotate a single message with topic and sentiment.
    
    Returns a dict with 'topic' and 'sentiment' keys.
    Uses cache first, then tries LLM, then falls back to default "unknown" labels.
    """
    # Create cache key from message content
    cache_key = hashlib.sha256(message.text.encode()).hexdigest()
    if cache_key in _annotation_cache:
        logger.debug(f"[AI] Using cached annotation for message {message.id}")
        return _annotation_cache[cache_key]

    # If already annotated, return as-is
    if message.topic != "unknown" and message.sentiment != "unknown":
        logger.debug(f"[AI] Message {message.id} already annotated, skipping")
        return {"topic": message.topic, "sentiment": message.sentiment}

    # Try LLM annotation
    prompt = f"""Analyze this discussion message and return JSON with 'topic' and 'sentiment'.

topic: One of: deadline, grading, meeting, participation, logistics, other
sentiment: One of: supportive, critical, mixed, neutral

Message: "{message.text}"

Return ONLY valid JSON with exactly these two fields, no other text."""

    result = _call_llm_json(prompt)
    if result and "topic" in result and "sentiment" in result:
        logger.info(
            f"[AI] Message {message.id} annotated via API: "
            f"topic={result['topic']}, sentiment={result['sentiment']}"
        )
        _annotation_cache[cache_key] = result
        return result

    # Fallback: return "unknown" for both fields when API unavailable
    logger.warning(
        f"[AI] API annotation failed for message {message.id}, returning 'unknown' labels"
    )
    return {"topic": "unknown", "sentiment": "unknown"}


def flatten_thread(root: ThreadNode) -> List[Message]:
    """
    Recursively flatten a thread tree into a list of messages sorted by timestamp.
    
    Traverses entire subtree, not just immediate children.
    """
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
    """
    Format a list of messages into a simple numbered transcript.
    
    Example output:
    1. Alice: Should we extend the deadline?
    2. Bob: I think yes.
    """
    lines = []
    for idx, msg in enumerate(messages, start=1):
        lines.append(f"{idx}. {msg.author}: {msg.text}")
    return "\n".join(lines)


def summarize_thread(root: ThreadNode, all_messages: List[Message]) -> dict:
    """
    Summarize a thread (root and all descendants) and return structure:
    {
        "root_id": str,
        "main_topic": str,
        "summary": str,
        "key_points": List[str]
    }
    
    Uses cache, LLM if available, then keyword-based fallback.
    """
    # Create cache key from root ID
    cache_key = f"summary_{root.id}"
    if cache_key in _summary_cache:
        logger.debug(f"[AI] Using cached summary for root {root.id}")
        return _summary_cache[cache_key]

    # Flatten thread and get all messages in this subtree
    thread_messages = flatten_thread(root)

    # Infer main topic from root message annotations
    root_msg = next((m for m in all_messages if m.id == root.id), None)
    main_topic = root_msg.topic if root_msg else "unknown"

    # Try LLM summary
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
            "key_points": result["key_points"] if isinstance(result["key_points"], list) else [result["key_points"]],
        }
        logger.info(f"[AI] Summary for root {root.id} generated via API")
        _summary_cache[cache_key] = summary_dict
        return summary_dict

    # Fallback: template-based summary
    logger.info(f"[AI] Using fallback summary for root {root.id}")
    return _summarize_fallback(root, thread_messages)


def _summarize_fallback(root: ThreadNode, thread_messages: List[Message]) -> dict:
    """Fallback summary when API unavailable."""
    # Simple template-based fallback
    summary = f"[No API] Discussion started with: \"{root.text[:100]}...\""

    key_points = [
        "API summary unavailable - annotation labels provide limited insight.",
        f"Thread has {len(thread_messages)} messages in total.",
        f"Root message by {root.author}."
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
    """
    Enrich messages with AI annotations (topic, sentiment).
    
    Skips messages already fully annotated.
    Returns list of dicts (not Pydantic models) to avoid mutation issues.
    """
    enriched = []
    for msg in messages:
        # Convert to dict
        msg_dict = msg.model_dump()

        # Only enrich if missing or unknown
        if msg.topic == "unknown" or msg.sentiment == "unknown":
            annotation = annotate_message(msg)
            if annotation.get("topic") != "unknown":
                msg_dict["topic"] = annotation.get("topic", msg.topic)
            if annotation.get("sentiment") != "unknown":
                msg_dict["sentiment"] = annotation.get("sentiment", msg.sentiment)

        enriched.append(msg_dict)

    logger.info(f"[AI] Enriched {len(enriched)} messages")
    return enriched
