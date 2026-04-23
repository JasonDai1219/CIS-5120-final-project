"use client";

import { useMemo, useState } from "react";
import {
  Background,
  Controls,
  Handle,
  Position,
  ReactFlow,
  type Edge,
  type Node,
  type NodeProps,
  type NodeTypes,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

type Message = {
  id: string;
  author: string;
  timestamp: string;
  text: string;
  parentId: string | null;
  topic?: string;
  sentiment?: string;
  inferredReplyToId?: string | null;
  replyInferred?: boolean;
};

type Props = {
  messages: Message[];
  selectedMessageId: string | null;
  onSelectMessage: (id: string) => void;
};

type TopicGroup = {
  topic: string;
  messages: Message[];
  roots: Message[];
  summary: string;
  messageCount: number;
};

type TopicNodeData = {
  kind: "topic";
  topic: string;
  summary: string;
  messageCount: number;
  isOpen: boolean;
  onToggleTopic: (topic: string) => void;
};

type MessageGraphNodeData = {
  kind: "message";
  id: string;
  author: string;
  text: string;
  topic?: string;
  sentiment?: string;
  isSelected: boolean;
  isTopicRoot: boolean;
  topicName?: string;
  summary?: string;
  hiddenCount: number;
  hasChildren: boolean;
  isExpanded: boolean;
  showInferredStar: boolean;
  onToggleNode: (id: string) => void;
  onSelectMessage: (id: string) => void;
  onCollapseTopic?: (topic: string) => void;
};

type GraphNodeData = TopicNodeData | MessageGraphNodeData;

const TOPIC_NODE_W = 240;
const TOPIC_NODE_H = 124;

const MSG_NODE_W = 230;
const MSG_NODE_H = 128;

const CENTER_X = 420;
const CENTER_Y = 260;
const TOPIC_RADIUS = 240;

const ROOT_CHILD_Y_GAP = 170;
const CHILD_Y_GAP = 160;
const MIN_SIBLING_X_GAP = 260;

function getEffectiveParentId(msg: Message) {
  return msg.inferredReplyToId ?? msg.parentId ?? null;
}

function isAiOnlyInferredReply(msg: Message) {
  return !msg.parentId && !!msg.inferredReplyToId && !!msg.replyInferred;
}

function previewText(text: string, max = 120) {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function summarizeTopic(messages: Message[]) {
  const text = messages
    .map((m) => m.text.trim())
    .filter(Boolean)
    .slice(0, 3)
    .join(" ");
  return previewText(text || "Open to explore this topic.", 120);
}

function summarizeChildren(children: Message[]) {
  const text = children
    .map((m) => m.text.trim())
    .filter(Boolean)
    .slice(0, 2)
    .join(" ");
  return previewText(text || "Open to see replies.", 70);
}

function sortByTimestamp(messages: Message[]) {
  return [...messages].sort(
    (a, b) =>
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );
}

function hashOffset(seed: string, range: number) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  return (Math.abs(hash) % (range * 2 + 1)) - range;
}

function sentimentBadgeClass(sentiment?: string) {
  switch (sentiment) {
    case "supportive":
      return "bg-green-100 text-green-800";
    case "critical":
      return "bg-red-100 text-red-800";
    case "mixed":
      return "bg-yellow-100 text-yellow-800";
    default:
      return "bg-gray-100 text-gray-700";
  }
}

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function splitSummary(summary?: string, maxLen = 26) {
  if (!summary) return ["", ""];

  if (summary.length <= maxLen) return [summary, ""];

  const words = summary.split(" ");
  let line1 = "";
  let line2 = "";

  for (const word of words) {
    const next = `${line1} ${word}`.trim();
    if (next.length <= maxLen) {
      line1 = next;
    } else {
      const next2 = `${line2} ${word}`.trim();
      line2 = next2.length <= maxLen ? next2 : `${line2}…`;
    }
  }

  if (line2.length > maxLen) {
    line2 = `${line2.slice(0, maxLen - 1)}…`;
  }

  return [line1, line2];
}

function buildTopicGroups(messages: Message[]): TopicGroup[] {
  const byTopic = new Map<string, Message[]>();

  for (const msg of messages) {
    const topic = msg.topic && msg.topic !== "unknown" ? msg.topic : "other";
    if (!byTopic.has(topic)) byTopic.set(topic, []);
    byTopic.get(topic)!.push(msg);
  }

  const groups: TopicGroup[] = [];

  for (const [topic, raw] of byTopic) {
    const topicMessages = sortByTimestamp(raw);
    const ids = new Set(topicMessages.map((m) => m.id));

    const roots = topicMessages.filter((msg) => {
      const parentId = getEffectiveParentId(msg);
      return !parentId || !ids.has(parentId);
    });

    groups.push({
      topic,
      messages: topicMessages,
      roots: sortByTimestamp(roots),
      summary: summarizeTopic(topicMessages),
      messageCount: topicMessages.length,
    });
  }

  return groups.sort((a, b) => a.topic.localeCompare(b.topic));
}

function buildChildrenMap(messages: Message[]) {
  const ids = new Set(messages.map((m) => m.id));
  const map = new Map<string | null, Message[]>();

  for (const msg of messages) {
    const parentId = getEffectiveParentId(msg);
    const effectiveParent = parentId && ids.has(parentId) ? parentId : null;
    if (!map.has(effectiveParent)) map.set(effectiveParent, []);
    map.get(effectiveParent)!.push(msg);
  }

  for (const [key, arr] of map) {
    map.set(key, sortByTimestamp(arr));
  }

  return map;
}

function descendantCount(
  nodeId: string,
  childrenMap: Map<string | null, Message[]>
): number {
  const children = childrenMap.get(nodeId) ?? [];
  let total = children.length;
  for (const child of children) {
    total += descendantCount(child.id, childrenMap);
  }
  return total;
}

function TopicNode({ data }: NodeProps) {
  const typed = data as TopicNodeData;

  return (
    <div
      className="rounded-[18px] border border-[#d4ddd0] bg-[#fafaf8] px-4 py-4 shadow-sm"
      style={{
        width: TOPIC_NODE_W,
        height: TOPIC_NODE_H,
        boxSizing: "border-box",
      }}
    >
      <Handle
        type="target"
        position={Position.Top}
        style={{ opacity: 0, width: 1, height: 1, border: 0 }}
      />

      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="truncate text-[14px] font-semibold text-[#2B3A2B]">
          {typed.topic}
        </div>
        <span className="shrink-0 rounded-full bg-[#e4ebe0] px-2 py-0.5 text-[10px] font-medium text-[#4A5E42]">
          {typed.messageCount} msgs
        </span>
      </div>

      <div className="mb-3 text-[11px] leading-[1.35] text-[#4A5E42]">
        {typed.summary}
      </div>

      <div className="flex justify-center">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            typed.onToggleTopic(typed.topic);
          }}
          className="text-[18px] font-medium text-[#4A5E42]"
        >
          {typed.isOpen ? "⌃" : "⌄"}
        </button>
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        style={{ opacity: 0, width: 1, height: 1, border: 0 }}
      />
    </div>
  );
}

function MessageNode({ data }: NodeProps) {
  const typed = data as MessageGraphNodeData;
  const [line1, line2] = splitSummary(typed.summary);

  if (typed.isTopicRoot) {
    return (
      <div
        className={`rounded-[18px] border px-4 py-4 shadow-sm ${
          typed.isSelected
            ? "border-[#3D6B35] bg-[#f3f7ef]"
            : "border-[#d4ddd0] bg-[#fafaf8]"
        }`}
        style={{
          width: TOPIC_NODE_W,
          height: TOPIC_NODE_H,
          boxSizing: "border-box",
        }}
      >
        <Handle
          type="target"
          position={Position.Top}
          style={{ opacity: 0, width: 1, height: 1, border: 0 }}
        />

        <div className="mb-2 flex items-start justify-between gap-2">
          <div className="truncate text-[14px] font-semibold text-[#2B3A2B]">
            {typed.topicName}
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              typed.onCollapseTopic?.(typed.topicName || "");
            }}
            className="text-[18px] font-medium text-[#4A5E42]"
          >
            ⌃
          </button>
        </div>

        <div className="mb-2 text-[11px] leading-[1.35] text-[#4A5E42]">
          {typed.summary}
        </div>

        <div className="text-center text-[10px] text-[#8BA07A]">
          Expand branches below
        </div>

        <Handle
          type="source"
          position={Position.Bottom}
          style={{ opacity: 0, width: 1, height: 1, border: 0 }}
        />
      </div>
    );
  }

  return (
    <div
      className={`flex flex-col justify-between rounded-[16px] border px-3 py-3 shadow-sm transition ${
        typed.isSelected
          ? "border-[#3D6B35] bg-[#f3f7ef]"
          : "border-[#d4ddd0] bg-white"
      }`}
      style={{
        width: MSG_NODE_W,
        height: MSG_NODE_H,
        boxSizing: "border-box",
      }}
      onClick={() => typed.onSelectMessage(typed.id)}
    >
      <Handle
        type="target"
        position={Position.Top}
        style={{ opacity: 0, width: 1, height: 1, border: 0 }}
      />

      <div>
        <div className="mb-2 flex items-start gap-2">
          <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#d6e0d2] text-[9px] font-semibold text-[#2B3A2B]">
            {initials(typed.author)}
          </div>

          <div className="min-w-0 flex-1">
            <div className="truncate text-[11px] font-semibold text-[#2B3A2B]">
              {typed.author}
              {typed.showInferredStar ? " ★" : ""}
            </div>
            <div className="mt-0.5 break-words text-[10px] leading-[1.35] text-[#2B3A2B]">
              {previewText(typed.text, typed.isExpanded ? 120 : 92)}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <span
            className={`rounded-full px-1.5 py-0.5 text-[9px] font-medium ${sentimentBadgeClass(
              typed.sentiment
            )}`}
          >
            {typed.sentiment ?? "neutral"}
          </span>

          {typed.topic && (
            <span className="rounded-full bg-[#e4ebe0] px-1.5 py-0.5 text-[9px] font-medium text-[#4A5E42]">
              {typed.topic}
            </span>
          )}
        </div>
      </div>

      {typed.hasChildren ? (
        <div className="mt-2 flex w-full flex-col items-center text-center">
          {!typed.isExpanded ? (
            <>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  typed.onToggleNode(typed.id);
                }}
                className="flex w-full flex-col items-center"
              >
                <div className="text-[9px] leading-[1.2] text-[#8BA07A]">
                  {line1}
                </div>
                {line2 ? (
                  <div className="text-[9px] leading-[1.2] text-[#8BA07A]">
                    {line2}
                  </div>
                ) : (
                  <div className="h-[11px]" />
                )}
                <div className="mt-1 text-[18px] font-medium leading-none text-[#4A5E42]">
                  ⌄
                </div>
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                typed.onToggleNode(typed.id);
              }}
              className="text-[18px] font-medium leading-none text-[#4A5E42]"
            >
              ⌃
            </button>
          )}
        </div>
      ) : (
        <div />
      )}

      <Handle
        type="source"
        position={Position.Bottom}
        style={{ opacity: 0, width: 1, height: 1, border: 0 }}
      />
    </div>
  );
}

const nodeTypes: NodeTypes = {
  topicNode: TopicNode,
  messageNode: MessageNode,
};

function buildVisibleGraph(
  topicGroups: TopicGroup[],
  openTopic: string | null,
  expandedNodeIds: Set<string>,
  selectedMessageId: string | null,
  onToggleTopic: (topic: string) => void,
  onToggleNode: (id: string) => void,
  onSelectMessage: (id: string) => void
): { nodes: Node<GraphNodeData>[]; edges: Edge[] } {
  const nodes: Node<GraphNodeData>[] = [];
  const edges: Edge[] = [];

  const count = Math.max(topicGroups.length, 1);

  topicGroups.forEach((group, index) => {
    const angle = (2 * Math.PI * index) / count - Math.PI / 2;
    const topicX =
      CENTER_X +
      TOPIC_RADIUS * Math.cos(angle) +
      hashOffset(group.topic + ":x", 18);
    const topicY =
      CENTER_Y +
      TOPIC_RADIUS * Math.sin(angle) +
      hashOffset(group.topic + ":y", 18);

    if (openTopic !== group.topic) {
      nodes.push({
        id: `topic:${group.topic}`,
        type: "topicNode",
        position: { x: topicX, y: topicY },
        draggable: false,
        data: {
          kind: "topic",
          topic: group.topic,
          summary: group.summary,
          messageCount: group.messageCount,
          isOpen: false,
          onToggleTopic,
        },
      });
      return;
    }

    const childrenMap = buildChildrenMap(group.messages);
    const topicRootId = `topic-root:${group.topic}`;

    nodes.push({
      id: topicRootId,
      type: "messageNode",
      position: { x: topicX, y: topicY },
      draggable: false,
      data: {
        kind: "message",
        id: topicRootId,
        author: group.topic,
        text: group.summary,
        topic: group.topic,
        sentiment: undefined,
        isSelected: false,
        isTopicRoot: true,
        topicName: group.topic,
        summary: group.summary,
        hiddenCount: 0,
        hasChildren: true,
        isExpanded: true,
        showInferredStar: false,
        onToggleNode,
        onSelectMessage,
        onCollapseTopic: onToggleTopic,
      },
    });

    const visibleRoots = group.roots;
    const rootFanWidth = Math.max(
      MIN_SIBLING_X_GAP,
      (visibleRoots.length - 1) * MIN_SIBLING_X_GAP
    );

    visibleRoots.forEach((rootMsg, i) => {
      const rootX =
        topicX -
        rootFanWidth / 2 +
        i * MIN_SIBLING_X_GAP +
        hashOffset(rootMsg.id + ":x", 16);
      const rootY =
        topicY + ROOT_CHILD_Y_GAP + hashOffset(rootMsg.id + ":y", 8);

      edges.push({
        id: `${topicRootId}-${rootMsg.id}`,
        source: topicRootId,
        target: rootMsg.id,
        type: "smoothstep",
        style: { stroke: "#7a8e73", strokeWidth: 1.6 },
      });

      placeMessageSubtree(
        rootMsg,
        rootX,
        rootY,
        childrenMap,
        expandedNodeIds,
        selectedMessageId,
        onToggleNode,
        onSelectMessage,
        nodes,
        edges
      );
    });
  });

  return { nodes, edges };
}

function placeMessageSubtree(
  msg: Message,
  x: number,
  y: number,
  childrenMap: Map<string | null, Message[]>,
  expandedNodeIds: Set<string>,
  selectedMessageId: string | null,
  onToggleNode: (id: string) => void,
  onSelectMessage: (id: string) => void,
  nodes: Node<GraphNodeData>[],
  edges: Edge[]
) {
  const children = childrenMap.get(msg.id) ?? [];
  const hasChildren = children.length > 0;
  const isExpanded = expandedNodeIds.has(msg.id);
  const hiddenCount = hasChildren ? descendantCount(msg.id, childrenMap) : 0;

  nodes.push({
    id: msg.id,
    type: "messageNode",
    position: { x, y },
    draggable: false,
    data: {
      kind: "message",
      id: msg.id,
      author: msg.author,
      text: msg.text,
      topic: msg.topic,
      sentiment: msg.sentiment,
      isSelected: selectedMessageId === msg.id,
      isTopicRoot: false,
      hiddenCount,
      hasChildren,
      isExpanded,
      showInferredStar: isAiOnlyInferredReply(msg),
      summary: hasChildren ? summarizeChildren(children) : undefined,
      onToggleNode,
      onSelectMessage,
    },
  });

  if (!hasChildren || !isExpanded) return;

  const fanWidth = Math.max(
    MIN_SIBLING_X_GAP,
    (children.length - 1) * MIN_SIBLING_X_GAP
  );

  children.forEach((child, index) => {
    const childX =
      x -
      fanWidth / 2 +
      index * MIN_SIBLING_X_GAP +
      hashOffset(child.id + ":x", 16);
    const childY = y + CHILD_Y_GAP + hashOffset(child.id + ":y", 10);

    const aiOnly = isAiOnlyInferredReply(child);
    const stroke = aiOnly ? "#A8B89A" : "#7a8e73";

    edges.push({
      id: `${msg.id}-${child.id}`,
      source: msg.id,
      target: child.id,
      type: "smoothstep",
      animated: aiOnly,
      style: aiOnly
        ? {
            stroke,
            strokeWidth: 1.4,
            strokeDasharray: "4 3",
            strokeLinecap: "round",
          }
        : {
            stroke,
            strokeWidth: 1.6,
            strokeLinecap: "round",
          },
    });

    placeMessageSubtree(
      child,
      childX,
      childY,
      childrenMap,
      expandedNodeIds,
      selectedMessageId,
      onToggleNode,
      onSelectMessage,
      nodes,
      edges
    );
  });
}

export default function UserThreadMapView({
  messages,
  selectedMessageId,
  onSelectMessage,
}: Props) {
  const topicGroups = useMemo(() => buildTopicGroups(messages), [messages]);

  const [openTopic, setOpenTopic] = useState<string | null>(null);
  const [expandedNodeIds, setExpandedNodeIds] = useState<Set<string>>(
    new Set()
  );

  const toggleTopic = (topic: string) => {
    setOpenTopic((prev) => (prev === topic ? null : topic));
  };

  const toggleNode = (id: string) => {
    setExpandedNodeIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const graph = useMemo(
    () =>
      buildVisibleGraph(
        topicGroups,
        openTopic,
        expandedNodeIds,
        selectedMessageId,
        toggleTopic,
        toggleNode,
        onSelectMessage
      ),
    [topicGroups, openTopic, expandedNodeIds, selectedMessageId, onSelectMessage]
  );

  return (
    <div className="h-full w-full overflow-hidden rounded-xl bg-transparent">
      <ReactFlow
        nodes={graph.nodes}
        edges={graph.edges}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.18 }}
        minZoom={0.35}
        maxZoom={1.5}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable
      >
        <Background gap={20} size={1} color="#e4ebe0" />
        <Controls />
      </ReactFlow>
    </div>
  );
}