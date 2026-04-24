"use client";

import { useEffect, useMemo, useState } from "react";
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
import { AnimatePresence, motion, useMotionValue, animate } from "motion/react";
import { layoutThreadMap } from "../lib/layoutThreadMap";
import { User } from "lucide-react";

export type Message = {
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

export type BaseGraphNode = {
  id: string;
  parentId: string | null;
  position: { x: number; y: number };
  topicTitle: string;
  aiSummary: string;
  senderName: string;
  messageText: string;
  timestamp: string;
  sentiment?: string;
  inferredReplyToId?: string | null;
  replyInferred?: boolean;
  isRoot: boolean;
  hasChildren: boolean;
};

type GraphCardData = {
  id: string;
  topicTitle: string;
  aiSummary: string;
  senderName: string;
  messageText: string;
  timestamp: string;
  sentiment?: string;
  isRoot: boolean;
  hasChildren: boolean;
  expanded: boolean;
  isInPath: boolean;
  onToggle: () => void;
  onOpenMessage: () => void;
  onOpenTopic: () => void;
};

type GraphCardNodeType = Node<GraphCardData, "graphCard">;

type NodeChevronButtonProps = {
  expanded: boolean;
  onToggle: () => void;
};

type Props = {
  nodesData: BaseGraphNode[];
  edgesData: Edge[];
  onOpenMessage: (msg: Message) => void;
  onOpenTopic: (topic: BaseGraphNode) => void;
};

function NodeChevronButton({ expanded, onToggle }: NodeChevronButtonProps) {
  const [isAnimating, setIsAnimating] = useState(false);
  const midY = useMotionValue(expanded ? 6 : 18);

  async function animateTo(value: number) {
    await animate(midY, value, {
      duration: 0.1,
      ease: "easeInOut",
    }).finished;
  }

  async function handleClick() {
    if (isAnimating) return;
    setIsAnimating(true);
    await animateTo(expanded ? 18 : 6);
    onToggle();
    setIsAnimating(false);
  }

  return (
    <button
      onClick={handleClick}
      type="button"
      aria-label="Toggle node chevron"
      className="nodrag flex h-11 w-11 items-center justify-center rounded-full bg-transparent transition active:scale-95"
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

function getTopicBadgeClass(topic?: string) {
  if (!topic) return "bg-gray-100 text-gray-800";
  
  const colors = [
    "bg-blue-100 text-blue-800",
    "bg-purple-100 text-purple-800",
    "bg-pink-100 text-pink-800",
    "bg-indigo-100 text-indigo-800",
    "bg-cyan-100 text-cyan-800",
    "bg-teal-100 text-teal-800",
    "bg-amber-100 text-amber-800",
    "bg-orange-100 text-orange-800",
  ];
  
  // 根据主题名称的哈希值选择颜色
  let hash = 0;
  for (let i = 0; i < topic.length; i++) {
    hash = ((hash << 5) - hash) + topic.charCodeAt(i);
    hash = hash & hash; // Convert to 32bit integer
  }
  
  return colors[Math.abs(hash) % colors.length];
}

function GraphCardNode({ data }: NodeProps<GraphCardNodeType>) {
  const cardMode = data.isRoot && !data.expanded ? "topic" : "node";
  // 显示按钮的条件：
  // 1. 在 topic 模式（根节点未展开）
  // 2. 在 node 模式且有子节点
  // 3. 在 node 模式且是根节点（允许根节点即使没有子节点也能折叠）
  const showButton = cardMode === "topic" || (cardMode === "node" && (data.hasChildren || data.isRoot));

  const nodeCardBgClass =
    data.sentiment === "critical"
      ? "bg-red-50"
      : data.sentiment === "supportive"
        ? "bg-green-100"
        : data.sentiment === "mixed"
          ? "bg-yellow-50"
          : "bg-white";

  return (
    <div className="relative">
      <Handle
        type="target"
        position={Position.Top}
        className="!h-2 !w-2 !border-0 !bg-[#8BA07A]"
      />

      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.22, ease: "easeOut" }}
        style={{ width: 320, height: 180, boxSizing: "border-box" }}
        className={`flex flex-col rounded-[16px] px-4 pt-4 transition-all ${
          data.isInPath
            ? "border-4 border-[#2B3A2B] shadow-xl ring-2 ring-[#8BA07A]"
            : "border border-[#d4ddd0] shadow-md"
        } ${cardMode === "node" ? nodeCardBgClass : "bg-white"}`}
      >
        <button
          type="button"
          onClick={() =>
            cardMode === "topic" ? data.onOpenTopic() : data.onOpenMessage()
          }
          style={{ height: 120, minHeight: 120, maxHeight: 120 }}
          className="block w-full overflow-hidden text-left"
        >
          <AnimatePresence mode="wait" initial={false}>
            {cardMode === "topic" ? (
              <motion.div
                key="topic"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.1, ease: "easeOut" }}
                className="flex h-full w-full flex-col overflow-hidden"
              >
                <div
                  className="shrink-0 text-center text-base font-bold text-[#2B3A2B]"
                  style={{
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                  }}
                >
                  {data.topicTitle}
                </div>
                <div
                  className="mt-3 text-sm leading-6 text-[#4D5B4D]"
                  style={{
                    display: "-webkit-box",
                    WebkitLineClamp: 4,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                  }}
                >
                  {data.aiSummary}
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="node"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.1, ease: "easeOut" }}
                className="flex h-full w-full flex-col overflow-hidden"
              >
                <div className="flex items-start justify-between gap-3 text-[#2B3A2B]">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#e4ebe0]">
                      <User size={16} />
                    </div>
                    <span
                      className="min-w-0 text-sm font-medium"
                      style={{
                        display: "-webkit-box",
                        WebkitLineClamp: 1,
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden",
                      }}
                    >
                      {data.senderName}
                    </span>
                  </div>

                  <span className="shrink-0 text-[10px] text-[#8BA07A]">
                    {new Date(data.timestamp).toLocaleString([], {
                      year: "numeric",
                      month: "numeric",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>

                <div
                  className="mt-3 text-sm leading-6 text-[#4D5B4D]"
                  style={{
                    display: "-webkit-box",
                    WebkitLineClamp: 3,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                  }}
                >
                  {data.messageText}
                </div>

                <div className="mt-auto flex flex-wrap items-center justify-end gap-1.5 pt-2">
                  {data.topicTitle && (
                    <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-medium ${getTopicBadgeClass(data.topicTitle)}`}>
                      {data.topicTitle}
                    </span>
                  )}
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[9px] font-medium ${sentimentBadgeClass(
                      data.sentiment
                    )}`}
                  >
                    {data.sentiment ?? "unknown"}
                  </span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </button>

        <div
          style={{ height: 36, minHeight: 36, maxHeight: 36 }}
          className="flex w-full items-center justify-center"
        >
          {showButton ? (
            <NodeChevronButton
              expanded={data.expanded}
              onToggle={data.onToggle}
            />
          ) : null}
        </div>
      </motion.div>

      <Handle
        type="source"
        position={Position.Bottom}
        className="!h-2 !w-2 !border-0 !bg-[#8BA07A]"
      />
    </div>
  );
}

export default function UserThreadMapView({
  nodesData,
  edgesData,
  onOpenMessage,
  onOpenTopic,
}: Props) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [layoutedVisibleNodes, setLayoutedVisibleNodes] = useState<BaseGraphNode[]>([]);
  const [anchorNodeId, setAnchorNodeId] = useState<string | null>(null);
  

  const toggleNode = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const nodeById = useMemo(() => {
    const map = new Map<string, BaseGraphNode>();
    for (const node of nodesData) {
      map.set(node.id, node);
    }
    return map;
  }, [nodesData]);

  const visibleBaseNodes = useMemo(() => {
    function isVisible(node: BaseGraphNode): boolean {
      // 根节点总是可见的
      if (node.isRoot) return true;
      
      // 非根节点需要其父节点存在且被展开
      const parent = nodeById.get(node.parentId ?? "");
      if (!parent) return false;
      
      // 父节点必须可见且被展开
      return isVisible(parent) && expandedIds.has(parent.id);
    }

    return nodesData
      .filter(isVisible)
      .map((node, index) => ({ node, originalIndex: index }))
      .sort((a, b) => {
        const aNode = a.node;
        const bNode = b.node;
        
        if (aNode.parentId !== bNode.parentId) {
          if (aNode.parentId === null && bNode.parentId !== null) return -1;
          if (aNode.parentId !== null && bNode.parentId === null) return 1;
        }

        // 同一父节点的子节点按时间戳排序
        const timeCompare = new Date(aNode.timestamp).getTime() - new Date(bNode.timestamp).getTime();
        if (timeCompare !== 0) return timeCompare;
        
        // 时间戳相同时保持原始顺序
        return a.originalIndex - b.originalIndex;
      })
      .map(({ node }) => node);
  }, [expandedIds, nodeById, nodesData]);

  const visibleNodeIds = useMemo(
    () => new Set(visibleBaseNodes.map((node) => node.id)),
    [visibleBaseNodes]
  );

  const visibleEdges = useMemo(
    () =>
      edgesData.filter(
        (edge) => visibleNodeIds.has(edge.source) && visibleNodeIds.has(edge.target)
      ),
    [edgesData, visibleNodeIds]
  );

  useEffect(() => {
    let cancelled = false;

    async function runLayout() {
      const result = await layoutThreadMap(visibleBaseNodes, visibleEdges);
      if (!cancelled) {
        setLayoutedVisibleNodes(result);
      }
    }

    runLayout();

    return () => {
      cancelled = true;
    };
  }, [visibleBaseNodes, visibleEdges]);

  // 计算路径上的节点 ID（展开的节点 + 到根节点的祖先路径）
  const pathNodeIds = useMemo(() => {
    const pathIds = new Set<string>();
    
    // 对每个展开的节点，追踪从它到根节点的路径
    for (const expandedId of expandedIds) {
      let currentId: string | null = expandedId;
      
      while (currentId !== null) {
        pathIds.add(currentId);
        const node = nodeById.get(currentId);
        if (!node) break;
        currentId = node.parentId;
      }
    }
    
    return pathIds;
  }, [expandedIds, nodeById]);

  // 计算需要高亮（黑框）的节点ID
  // 只有展开的节点以及从展开节点到根的路径需要黑框
  const highlightNodeIds = useMemo(() => {
    const highlight = new Set<string>();
    
    // 对每个展开的节点，只有该节点本身需要高亮
    // 其子节点和父节点都不需要高亮，除非它们也被展开
    for (const expandedId of expandedIds) {
      highlight.add(expandedId);
    }
    
    return highlight;
  }, [expandedIds]);

  const nodes = useMemo<GraphCardNodeType[]>(
    () =>
      layoutedVisibleNodes.map((node) => ({
        id: node.id,
        type: "graphCard",
        position: node.position,
        data: {
          id: node.id,
          topicTitle: node.topicTitle,
          aiSummary: node.aiSummary,
          senderName: node.senderName,
          messageText: node.messageText,
          timestamp: node.timestamp,
          sentiment: node.sentiment,
          isRoot: node.isRoot,
          hasChildren: node.hasChildren,
          expanded: expandedIds.has(node.id),
          isInPath: highlightNodeIds.has(node.id),
          onToggle: () => toggleNode(node.id),
          onOpenMessage: () =>
            onOpenMessage({
              id: node.id,
              author: node.senderName,
              timestamp: node.timestamp,
              text: node.messageText,
              parentId: node.parentId,
              topic: node.topicTitle,
              sentiment: node.sentiment,
              inferredReplyToId: node.inferredReplyToId,
              replyInferred: node.replyInferred,
            }),
          onOpenTopic: () => onOpenTopic(node),
        },
      })),
    [layoutedVisibleNodes, expandedIds, highlightNodeIds, onOpenMessage, onOpenTopic]
  );

  const edges = visibleEdges;

  const nodeTypes = useMemo<NodeTypes>(
    () => ({
      graphCard: GraphCardNode,
    }),
    []
  );

  return (
    <div className="h-full w-full overflow-hidden">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        proOptions={{ hideAttribution: true }}
        className="h-full w-full bg-transparent"
      >
        <Background gap={18} size={1} />
        <Controls />
      </ReactFlow>
    </div>
  );
}