from __future__ import annotations

from typing import Dict, List, Tuple

from app.schemas import Message, ThreadNode


def build_thread_tree(messages: List[Message]) -> Tuple[List[ThreadNode], List[ThreadNode], dict]:
    """
    Build thread trees from flat messages.

    Returns:
    - roots: top-level discussion threads
    - orphans: messages whose parentId does not exist
    - stats: basic structure stats
    """
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
            parent = node_map[msg.parentId]
            parent.children.append(node)
        else:
            orphans.append(node)

    stats = {
        "messageCount": len(messages),
        "rootCount": len(roots),
        "orphanCount": len(orphans),
        "maxDepth": _max_depth(roots),
    }

    return roots, orphans, stats


def _max_depth(roots: List[ThreadNode]) -> int:
    """Compute the maximum depth across all roots."""
    if not roots:
        return 0

    def dfs(node: ThreadNode) -> int:
        if not node.children:
            return 1
        return 1 + max(dfs(child) for child in node.children)

    return max(dfs(root) for root in roots)
