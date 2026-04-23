"use client";

import { useCallback, useMemo, useState } from "react";
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
import { User } from "lucide-react";
import UserHeader from "../components/UserHeader";
import UserFooter from "../components/UserFooter";
import UserMessageDetailSheet from "../components/UserMessageDetailSheet";
import TopicDetailSheet from "../components/TopicDetailSheet";

type TimeGranularity = "day" | "week" | "month";
type ViewMode = "map" | "chat";

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

type GraphCardData = {
  id: string;
  topicTitle: string;
  aiSummary: string;
  senderName: string;
  messageText: string;
  isRoot: boolean;
  hasChildren: boolean;
  expanded: boolean;
  onToggle: () => void;
  onOpenMessage: (messageId: string) => void;
  onOpenTopic: (topicId: string) => void;
};

type GraphCardNodeType = Node<GraphCardData, "graphCard">;

type BaseGraphNode = {
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

type NodeChevronButtonProps = {
  expanded: boolean;
  onToggle: () => void;
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

function GraphCardNode({ data }: NodeProps<GraphCardNodeType>) {
  const cardMode = data.isRoot && !data.expanded ? "topic" : "node";
  const showButton = cardMode === "topic" || (cardMode === "node" && data.hasChildren);

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
        className="flex flex-col rounded-[16px] border border-[#d4ddd0] bg-white px-4 pt-4 shadow-md"
      >
        <button
          type="button"
          onClick={() =>
            cardMode === "topic"
              ? data.onOpenTopic(data.id)
              : data.onOpenMessage(data.id)
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
                <div className="flex items-center gap-3 text-[#2B3A2B]">
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
                <div
                  className="mt-3 text-sm leading-6 text-[#4D5B4D]"
                  style={{
                    display: "-webkit-box",
                    WebkitLineClamp: 4,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                  }}
                >
                  {data.messageText}
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
            <NodeChevronButton expanded={data.expanded} onToggle={data.onToggle} />
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

const BASE_NODES: BaseGraphNode[] = [
  {
    id: "topic-1",
    parentId: null,
    position: { x: 40, y: 40 },
    topicTitle: "Climate Policy Debate",
    aiSummary:
      "Participants are discussing whether stricter climate regulations should be implemented now or introduced more gradually. Supporters argue immediate action is necessary, while others worry about economic costs and feasibility.",
    senderName: "Matija Rajkovic",
    messageText:
      "I think the main issue is not whether climate action is needed, but how quickly it can realistically be implemented without hurting people who depend on current industries.",
    isRoot: true,
    hasChildren: true,
    timestamp: "2026-03-01 09:00",
    sentiment: "mixed",
    inferredReplyToId: null,
    replyInferred: false,
  },
  {
    id: "topic-2",
    parentId: "topic-1",
    position: { x: 40, y: 360 },
    topicTitle: "Economic Tradeoffs",
    aiSummary:
      "This branch focuses on the economic risks, timelines, and implementation concerns around policy change.",
    senderName: "Alex Chen",
    messageText:
      "We need a plan that protects workers too, otherwise even good policy will face strong resistance.",
    isRoot: false,
    hasChildren: true,
    timestamp: "2026-03-01 09:12",
    sentiment: "critical",
    inferredReplyToId: "topic-1",
    replyInferred: false,
  },
  {
    id: "topic-3",
    parentId: "topic-2",
    position: { x: 40, y: 680 },
    topicTitle: "Worker Impact",
    aiSummary:
      "The discussion narrows to how transitions affect workers in existing industries.",
    senderName: "Sara Lee",
    messageText:
      "Any real transition plan has to include support for workers or it will lose public support immediately.",
    isRoot: false,
    hasChildren: false,
    timestamp: "2026-03-01 09:20",
    sentiment: "supportive",
    inferredReplyToId: "topic-2",
    replyInferred: false,
  },
];

const ALL_EDGES: Edge[] = [
  {
    id: "e-topic-1-topic-2",
    source: "topic-1",
    target: "topic-2",
    style: { stroke: "#8BA07A", strokeWidth: 1.5 },
  },
  {
    id: "e-topic-2-topic-3",
    source: "topic-2",
    target: "topic-3",
    style: { stroke: "#8BA07A", strokeWidth: 1.5 },
  },
];

export default function Page() {
  const [selectedDataset, setSelectedDataset] = useState("discussion_demo");
  const [timeGranularity, setTimeGranularity] = useState<TimeGranularity>("week");
  const [sliderLow, setSliderLow] = useState(0);
  const [sliderHigh, setSliderHigh] = useState(2);
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>("map");

  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null);
  const [topicSheetOpen, setTopicSheetOpen] = useState(false);

  const datasetIds = ["discussion_demo"];
  const availableTimeBuckets = ["all", "2026-03-01", "2026-03-08", "2026-03-15"];
  const usableTimeBuckets = ["2026-03-01", "2026-03-08", "2026-03-15"];
  const availableTopics = ["Policy", "Debate", "Community"];

  const toggleNode = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const openMessage = useCallback((messageId: string) => {
    setTopicSheetOpen(false);
    setSelectedTopicId(null);
    setSelectedMessageId(messageId);
    setSheetOpen(true);
  }, []);

  const closeSheet = useCallback(() => {
    setSheetOpen(false);
  }, []);

  const openTopic = useCallback((topicId: string) => {
    setSheetOpen(false);
    setSelectedMessageId(null);
    setSelectedTopicId(topicId);
    setTopicSheetOpen(true);
  }, []);

  const closeTopicSheet = useCallback(() => {
    setTopicSheetOpen(false);
  }, []);

  const nodeById = useMemo(() => {
    const map = new Map<string, BaseGraphNode>();
    for (const node of BASE_NODES) map.set(node.id, node);
    return map;
  }, []);

  const selectedMessage = useMemo<Message | null>(() => {
    if (!selectedMessageId) return null;
    const node = nodeById.get(selectedMessageId);
    if (!node) return null;

    return {
      id: node.id,
      author: node.senderName,
      timestamp: node.timestamp,
      text: node.messageText,
      parentId: node.parentId,
      topic: node.topicTitle,
      sentiment: node.sentiment,
      inferredReplyToId: node.inferredReplyToId,
      replyInferred: node.replyInferred,
    };
  }, [selectedMessageId, nodeById]);

  const selectedTopic = useMemo(() => {
    if (!selectedTopicId) return null;
    return nodeById.get(selectedTopicId) ?? null;
  }, [selectedTopicId, nodeById]);

  const parentMessage = useMemo<Message | null>(() => {
    if (!selectedMessage) return null;

    const effectiveParentId =
      selectedMessage.inferredReplyToId ?? selectedMessage.parentId;

    if (!effectiveParentId) return null;

    const parentNode = nodeById.get(effectiveParentId);
    if (!parentNode) return null;

    return {
      id: parentNode.id,
      author: parentNode.senderName,
      timestamp: parentNode.timestamp,
      text: parentNode.messageText,
      parentId: parentNode.parentId,
      topic: parentNode.topicTitle,
      sentiment: parentNode.sentiment,
      inferredReplyToId: parentNode.inferredReplyToId,
      replyInferred: parentNode.replyInferred,
    };
  }, [selectedMessage, nodeById]);

  const visibleBaseNodes = useMemo(() => {
    function isVisible(node: BaseGraphNode): boolean {
      if (node.parentId === null) return true;

      const parent = nodeById.get(node.parentId);
      if (!parent) return false;

      return isVisible(parent) && expandedIds.has(parent.id);
    }

    return BASE_NODES.filter(isVisible);
  }, [expandedIds, nodeById]);

  const visibleNodeIds = useMemo(
    () => new Set(visibleBaseNodes.map((node) => node.id)),
    [visibleBaseNodes]
  );

  const nodes = useMemo<GraphCardNodeType[]>(
    () =>
      visibleBaseNodes.map((node) => ({
        id: node.id,
        type: "graphCard",
        position: node.position,
        data: {
          id: node.id,
          topicTitle: node.topicTitle,
          aiSummary: node.aiSummary,
          senderName: node.senderName,
          messageText: node.messageText,
          isRoot: node.isRoot,
          hasChildren: node.hasChildren,
          expanded: expandedIds.has(node.id),
          onToggle: () => toggleNode(node.id),
          onOpenMessage: openMessage,
          onOpenTopic: openTopic,
        },
      })),
    [visibleBaseNodes, expandedIds, toggleNode, openMessage, openTopic]
  );

  const edges = useMemo(
    () =>
      ALL_EDGES.filter(
        (edge) => visibleNodeIds.has(edge.source) && visibleNodeIds.has(edge.target)
      ),
    [visibleNodeIds]
  );

  const nodeTypes = useMemo<NodeTypes>(
    () => ({
      graphCard: GraphCardNode,
    }),
    []
  );

  function handleSliderChange(lo: number, hi: number) {
    setSliderLow(lo);
    setSliderHigh(hi);
  }

  function handleToggleTopic(topic: string) {
    setSelectedTopics((prev) =>
      prev.includes(topic) ? prev.filter((t) => t !== topic) : [...prev, topic]
    );
  }

  function handleClearTopics() {
    setSelectedTopics([]);
  }

  function initials(name: string) {
    return name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("");
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

  function getEffectiveParentId(msg: Message) {
    return msg.inferredReplyToId ?? msg.parentId;
  }

  function isAiOnlyReply(msg: Message) {
    return Boolean(msg.replyInferred && msg.inferredReplyToId && !msg.parentId);
  }

  return (
    <main className="h-dvh bg-[#f3f5f1]">
      <div className="mx-auto flex h-dvh w-full flex-col bg-[#f8faf7]">
        <UserHeader
          datasetIds={datasetIds}
          selectedDataset={selectedDataset}
          onSelectDataset={setSelectedDataset}
          timeGranularity={timeGranularity}
          onChangeGranularity={setTimeGranularity}
          availableTimeBuckets={availableTimeBuckets}
          usableTimeBuckets={usableTimeBuckets}
          sliderLow={sliderLow}
          sliderHigh={sliderHigh}
          onSliderChange={handleSliderChange}
          availableTopics={availableTopics}
          selectedTopics={selectedTopics}
          onToggleTopic={handleToggleTopic}
          onClearTopics={handleClearTopics}
          viewMode={viewMode}
          onChangeViewMode={setViewMode}
        />

        <div className="min-h-0 flex-1 overflow-hidden">
          <div className="h-full min-h-0 overflow-hidden px-2 py-2">
            <div className="h-full w-full overflow-hidden ">
              <ReactFlow
                nodes={nodes}
                edges={edges}
                nodeTypes={nodeTypes}
                fitView
                proOptions={{ hideAttribution: true }}
                className="h-full w-full bg-transparent"
              >
                <Background gap={18} size={1} />
                <Controls />
              </ReactFlow>
            </div>
          </div>
        </div>

        <div className="shrink-0">
          <UserFooter
            messageCount={24}
            roots={6}
            depth={4}
            sentimentStats={{
              avg: 0.42,
              supportivePct: 45,
              neutralPct: 30,
              criticalPct: 25,
            }}
          />
        </div>

        {selectedMessage ? (
          <UserMessageDetailSheet
            selectedMessage={selectedMessage}
            parentMessage={parentMessage}
            sheetOpen={sheetOpen}
            onCloseSheet={closeSheet}
            initials={initials}
            sentimentBadgeClass={sentimentBadgeClass}
            getEffectiveParentId={getEffectiveParentId}
            isAiOnlyReply={isAiOnlyReply}
          />
        ) : null}

        {selectedTopic ? (
          <TopicDetailSheet
            selectedTopic={selectedTopic}
            sheetOpen={topicSheetOpen}
            onCloseSheet={closeTopicSheet}
          />
        ) : null}
      </div>
    </main>
  );
}
