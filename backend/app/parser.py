from __future__ import annotations

from functools import lru_cache
from typing import Dict, List, Tuple

from app.schemas import Message, ThreadNode


def _serialize_messages(messages: List[Message]) -> tuple:
    return tuple(
        (
            m.id,
            m.author,
            m.timestamp.isoformat(),
            m.text,
            m.parentId,
            m.topic,
            m.sentiment,
        )
        for m in messages
    )


@lru_cache(maxsize=32)
def _build_thread_tree_cached(serialized_messages: tuple) -> Tuple[List[ThreadNode], List[ThreadNode], dict]:
    messages = [
        Message(
            id=m[0],
            author=m[1],
            timestamp=m[2],
            text=m[3],
            parentId=m[4],
            topic=m[5],
            sentiment=m[6],
        )
        for m in serialized_messages
    ]

    node_map: Dict[str, ThreadNode] = {
        msg.id: ThreadNode(
            id=msg.id,
            author=msg.author,
            timestamp=msg.timestamp,
            text=msg.text,
            parentId=msg.parentId,
            topic=msg.topic,
            sentiment=msg.sentiment,
        )
        for msg in messages
    }

    roots: List[ThreadNode] = []
    orphans: List[ThreadNode] = []

    for msg in messages:
        node = node_map[msg.id]

        if msg.parentId is None:
            roots.append(node)
        elif msg.parentId in node_map:
            node_map[msg.parentId].children.append(node)
        else:
            orphans.append(node)

    stats = {
        "messageCount": len(messages),
        "rootCount": len(roots),
        "orphanCount": len(orphans),
        "maxDepth": _max_depth(roots),
    }

    return roots, orphans, stats


def build_thread_tree(messages: List[Message]) -> Tuple[List[ThreadNode], List[ThreadNode], dict]:
    return _build_thread_tree_cached(_serialize_messages(messages))


def _max_depth(roots: List[ThreadNode]) -> int:
    if not roots:
        return 0

    def dfs(node: ThreadNode) -> int:
        if not node.children:
            return 1
        return 1 + max(dfs(child) for child in node.children)

    return max(dfs(root) for root in roots)