"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, useMotionValue, animate } from "motion/react";
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
import { Sparkles, User } from "lucide-react";

export type TopicGraphMessageNode = {
  id: string;
  sender: string;
  text: string;
  children?: TopicGraphMessageNode[];
};

export type TopicGraphTopicTree = {
  id: string;
  topic: string;
  aiSummary: string;
  rootMessage: TopicGraphMessageNode;
};

type VisibleGraphNode = {
  id: string;
  kind: "topic" | "message";
  title: string;
  body: string;
  topicId: string;
  depth: number;
  expanded: boolean;
  hasChildren: boolean;
};

type FlowNodeData = {
  node: VisibleGraphNode;
  onToggle: (id: string) => void;
  onExpandAll: (id: string) => void;
};

type TopicGraphMiddleProps = {
  data: TopicGraphTopicTree[];
  className?: string;
  height?: number;
};

type MessageIndexEntry = {
  message: TopicGraphMessageNode;
  topicId: string;
};

const NODE_WIDTH = 280;
const NODE_HEIGHT = 170;
const LEVEL_Y_GAP = 210;
const SIBLING_X_GAP = 44;
const TOPIC_X_GAP = 80;
const START_X = 24;
const START_Y = 24;

function buildMessageIndex(data: TopicGraphTopicTree[]) {
  const index = new Map<string, MessageIndexEntry>();

  function walk(message: TopicGraphMessageNode, topicId: string) {
    index.set(message.id, { message, topicId });
    for (const child of message.children ?? []) {
      walk(child, topicId);
    }
  }

  for (const topic of data) {
    walk(topic.rootMessage, topic.id);
  }

  return index;
}

function collectDescendants(message: TopicGraphMessageNode): string[] {
  const out: string[] = [];

  function dfs(node: TopicGraphMessageNode) {
    for (const child of node.children ?? []) {
      out.push(child.id);
      dfs(child);
    }
  }

  dfs(message);
  return out;
}

function buildVisibleRoot(topic: TopicGraphTopicTree, expandedSet: Set<string>): VisibleGraphNode {
  if (!expandedSet.has(topic.id)) {
    return {
      id: topic.id,
      kind: "topic",
      title: topic.topic,
      body: topic.aiSummary,
      topicId: topic.id,
      depth: 0,
      expanded: false,
      hasChildren: true,
    };
  }

  return {
    id: topic.rootMessage.id,
    kind: "message",
    title: topic.rootMessage.sender,
    body: topic.rootMessage.text,
    topicId: topic.id,
    depth: 0,
    expanded: expandedSet.has(topic.rootMessage.id),
    hasChildren: (topic.rootMessage.children?.length ?? 0) > 0,
  };
}

function computeLayout(data: TopicGraphTopicTree[], expandedSet: Set<string>) {
  const topicById = new Map(data.map((topic) => [topic.id, topic]));
  const messageIndex = buildMessageIndex(data);
  const visibleRoots = data.map((topic) => buildVisibleRoot(topic, expandedSet));

  const nodes: Node<FlowNodeData>[] = [];
  const edges: Edge[] = [];

  function getChildren(node: VisibleGraphNode): VisibleGraphNode[] {
    if (node.kind === "topic") {
      return [];
    }

    if (!node.expanded) return [];
    const entry = messageIndex.get(node.id);
    if (!entry) return [];

    return (entry.message.children ?? []).map((child) => ({
      id: child.id,
      kind: "message",
      title: child.sender,
      body: child.text,
      topicId: entry.topicId,
      depth: node.depth + 1,
      expanded: expandedSet.has(child.id),
      hasChildren: (child.children?.length ?? 0) > 0,
    }));
  }

  function subtreeWidth(node: VisibleGraphNode): number {
    const children = getChildren(node);
    if (children.length === 0) return NODE_WIDTH;

    const childrenWidth = children.reduce((sum, child, index) => {
      return sum + subtreeWidth(child) + (index > 0 ? SIBLING_X_GAP : 0);
    }, 0);

    return Math.max(NODE_WIDTH, childrenWidth);
  }

  function place(node: VisibleGraphNode, leftX: number, topY: number, parentId?: string) {
    const width = subtreeWidth(node);
    const x = leftX + width / 2 - NODE_WIDTH / 2;

    nodes.push({
      id: node.id,
      type: "conversationNode",
      position: { x, y: topY },
      draggable: false,
      connectable: false,
      selectable: true,
      data: {
        node,
        onToggle: () => {},
        onExpandAll: () => {},
      },
      style: {
        width: NODE_WIDTH,
        height: NODE_HEIGHT,
        transition: "all 320ms ease-in-out",
      },
    });

    if (parentId) {
      edges.push({
        id: `e-${parentId}-${node.id}`,
        source: parentId,
        target: node.id,
        type: "smoothstep",
        selectable: false,
        style: { strokeWidth: 1.5 },
      });
    }

    const children = getChildren(node);
    if (children.length === 0) return;

    let currentLeft = leftX;
    for (const child of children) {
      const childWidth = subtreeWidth(child);
      place(child, currentLeft, topY + LEVEL_Y_GAP, node.id);
      currentLeft += childWidth + SIBLING_X_GAP;
    }
  }

  let left = START_X;

  for (const topic of data) {
    const visibleRoot = buildVisibleRoot(topic, expandedSet);
    const width = subtreeWidth(visibleRoot);
    place(visibleRoot, left, START_Y);

    if (expandedSet.has(topic.id)) {
      const rootMessage = topic.rootMessage;
      if (expandedSet.has(rootMessage.id)) {
        const children = (rootMessage.children ?? []).map((child) => ({
          id: child.id,
          kind: "message" as const,
          title: child.sender,
          body: child.text,
          topicId: topic.id,
          depth: 1,
          expanded: expandedSet.has(child.id),
          hasChildren: (child.children?.length ?? 0) > 0,
        }));

        if (children.length > 0) {
          let currentLeft = left;
          for (const child of children) {
            const childWidth = subtreeWidth(child);
            place(child, currentLeft, START_Y + LEVEL_Y_GAP, rootMessage.id);
            currentLeft += childWidth + SIBLING_X_GAP;
          }
        }
      }
    }

    left += width + TOPIC_X_GAP;
  }

  return { nodes, edges };
}

function NodeChevronButton({
  expanded,
  onClick,
  onDoubleClick,
}: {
  expanded: boolean;
  onClick: React.MouseEventHandler<HTMLButtonElement>;
  onDoubleClick: React.MouseEventHandler<HTMLButtonElement>;
}) {
  const midY = useMotionValue(expanded ? 6 : 18);

  useEffect(() => {
    const controls = animate(midY, expanded ? 6 : 18, {
      duration: 0.16,
      ease: "easeInOut",
    });

    return () => controls.stop();
  }, [expanded, midY]);

  return (
    <button
      type="button"
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      aria-label="Toggle node chevron"
      className="absolute left-1/2 bottom-4 z-20 flex h-11 w-11 -translate-x-1/2 items-center justify-center rounded-full bg-transparent text-slate-700 transition active:scale-95"
      title="Click to toggle. Double-click to expand all children."
    >
      <svg width="28" height="24" viewBox="0 0 28 24" className="overflow-visible">
        <motion.line
          x1="4"
          y1="12"
          x2="14"
          y2={midY}
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
        />
        <motion.line
          x1="14"
          y1={midY}
          x2="24"
          y2="12"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
        />
        <circle cx="4" cy="12" r="1.1" fill="currentColor" />
        <motion.circle cx="14" cy={midY} r="1.1" fill="currentColor" />
        <circle cx="24" cy="12" r="1.1" fill="currentColor" />
      </svg>
    </button>
  );
}

const ConversationNodeCard = memo(function ConversationNodeCard({
  data,
  selected,
}: NodeProps<Node<FlowNodeData>>) {
  const { node, onToggle, onExpandAll } = data;
  const isTopic = node.kind === "topic";

  return (
    <div className="relative h-full w-full">
      <Handle
        type="target"
        position={Position.Top}
        className="!left-1/2 !top-0 !h-0 !w-0 !-translate-x-1/2 !border-0 !bg-transparent"
      />

      <div
        className={[
          "relative h-full w-full overflow-visible border bg-white px-5 pt-5 pb-14 shadow-sm",
          "rounded-[10px] transition-all duration-300 ease-in-out",
          selected ? "border-sky-500 shadow-md" : "border-slate-200",
        ].join(" ")}
      >
        <div className="flex h-full flex-col justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-center gap-2">
              {isTopic ? (
                <Sparkles size={16} className="shrink-0 text-sky-600" />
              ) : (
                <User size={16} className="shrink-0 text-slate-500" />
              )}

              <div className="min-w-0 flex-1">
                <div className="truncate text-center text-[15px] font-bold text-slate-900">
                  {node.title}
                </div>
              </div>
            </div>

            <div className="mt-4 line-clamp-4 text-center text-sm leading-6 text-slate-600">
              {node.body}
            </div>
          </div>

          <div className="text-center text-[11px] text-slate-400">
            {isTopic ? "Topic" : "Message"}
          </div>
        </div>

        {node.hasChildren && (
          <NodeChevronButton
            expanded={node.expanded}
            onClick={(e) => {
              e.stopPropagation();
              onToggle(node.id);
            }}
            onDoubleClick={(e) => {
              e.stopPropagation();
              onExpandAll(node.id);
            }}
          />
        )}
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        className="!left-1/2 !bottom-[-18px] !h-3 !w-3 !-translate-x-1/2 !rounded-full !border-0 !bg-transparent"
      />
    </div>
  );
});

const nodeTypes = {
  conversationNode: ConversationNodeCard,
} satisfies NodeTypes;

export default function TopicGraphMiddle({
  data,
  className = "",
  height = 520,
}: TopicGraphMiddleProps) {
  const [expandedSet, setExpandedSet] = useState<Set<string>>(new Set());
  const [containerReady, setContainerReady] = useState(false);

  const flowRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const topicById = useMemo(() => new Map(data.map((topic) => [topic.id, topic])), [data]);
  const messageIndex = useMemo(() => buildMessageIndex(data), [data]);

  const onToggle = useCallback((id: string) => {
    setExpandedSet((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const onExpandAll = useCallback(
    (id: string) => {
      setExpandedSet((prev) => {
        const next = new Set(prev);

        if (topicById.has(id)) {
          const topic = topicById.get(id)!;
          next.add(id);
          next.add(topic.rootMessage.id);
          for (const desc of collectDescendants(topic.rootMessage)) {
            next.add(desc);
          }
          return next;
        }

        const entry = messageIndex.get(id);
        if (!entry) return next;

        next.add(id);
        for (const desc of collectDescendants(entry.message)) {
          next.add(desc);
        }
        return next;
      });
    },
    [messageIndex, topicById],
  );

  const layout = useMemo(() => computeLayout(data, expandedSet), [data, expandedSet]);

  const nodes = useMemo(
    () =>
      layout.nodes.map((node) => ({
        ...node,
        data: {
          ...node.data,
          onToggle,
          onExpandAll,
        },
      })),
    [layout.nodes, onToggle, onExpandAll],
  );

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const update = () => {
      const rect = el.getBoundingClientRect();
      setContainerReady(rect.width > 0 && rect.height > 0);
    };

    update();

    const observer = new ResizeObserver(update);
    observer.observe(el);

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!containerReady) return;

    const timer = window.setTimeout(() => {
      flowRef.current?.fitView?.({ padding: 0.18, duration: 350 });
    }, 50);

    return () => window.clearTimeout(timer);
  }, [nodes, layout.edges, containerReady]);

  return (
    <div className={className}>
      <div
        ref={containerRef}
        className="relative w-full rounded-[2px] border border-slate-200 bg-[#f8fafc] shadow-sm"
        style={{ height }}
      >
        {containerReady ? (
          <div className="h-full w-full">
            <ReactFlow
              nodes={nodes}
              edges={layout.edges}
              nodeTypes={nodeTypes}
              fitView
              minZoom={0.35}
              maxZoom={1.5}
              proOptions={{ hideAttribution: true }}
              nodesDraggable={false}
              nodesConnectable={false}
              onInit={(instance) => {
                flowRef.current = instance;
              }}
            >
              <Background gap={18} size={1} />
              <Controls showInteractive={true} />
            </ReactFlow>
          </div>
        ) : (
          <div className="flex h-full w-full items-center justify-center text-sm text-slate-400">
            Loading graph...
          </div>
        )}
      </div>
    </div>
  );
}