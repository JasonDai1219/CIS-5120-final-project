from __future__ import annotations

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field


class Message(BaseModel):
    id: str
    author: str
    timestamp: datetime
    text: str
    parentId: Optional[str] = None
    topic: str = "unknown"
    sentiment: str = "unknown"


class ThreadNode(BaseModel):
    id: str
    author: str
    timestamp: datetime
    text: str
    parentId: Optional[str] = None
    topic: str = "unknown"
    sentiment: str = "unknown"
    children: List["ThreadNode"] = Field(default_factory=list)


class DatasetListResponse(BaseModel):
    datasets: List[str]


class MessagesResponse(BaseModel):
    datasetId: str
    messageCount: int
    messages: List[Message]
    warnings: List[str] = Field(default_factory=list)


class ThreadResponse(BaseModel):
    datasetId: str
    roots: List[ThreadNode]
    orphans: List[ThreadNode]
    stats: dict
    warnings: List[str] = Field(default_factory=list)
