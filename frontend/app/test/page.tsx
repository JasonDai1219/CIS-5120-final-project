"use client";

import { useRef, useState } from "react";
import type { Edge } from "@xyflow/react";
import UserHeader from "../components/UserHeader";
import UserFooter from "../components/UserFooter";
import UserThreadMapView, {
  type BaseGraphNode,
  type Message,
} from "../components/UserThreadMapView";
import UserChatView from "../components/UserChatView";
import UserMessageDetailSheet from "../components/UserMessageDetailSheet";
import TopicDetailSheet from "../components/TopicDetailSheet";

type TimeGranularity = "day" | "week" | "month";
type ViewMode = "map" | "chat";

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

  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selectedTopic, setSelectedTopic] = useState<BaseGraphNode | null>(null);
  const [topicSheetOpen, setTopicSheetOpen] = useState(false);

  const messageRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const datasetIds = ["discussion_demo"];
  const availableTimeBuckets = ["all", "2026-03-01", "2026-03-08", "2026-03-15"];
  const usableTimeBuckets = ["2026-03-01", "2026-03-08", "2026-03-15"];
  const availableTopics = ["Policy", "Debate", "Community"];

  const messages: Message[] = BASE_NODES.map((node) => ({
    id: node.id,
    author: node.senderName,
    timestamp: node.timestamp,
    text: node.messageText,
    parentId: node.parentId,
    topic: node.topicTitle,
    sentiment: node.sentiment,
    inferredReplyToId: node.inferredReplyToId,
    replyInferred: node.replyInferred,
  }));

  const messagesById: Record<string, Message> = Object.fromEntries(
    messages.map((msg) => [msg.id, msg])
  );

  const parentMessage =
    selectedMessage
      ? messagesById[
          selectedMessage.parentId ?? selectedMessage.inferredReplyToId ?? ""
        ] ?? null
      : null;

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

  function openMessage(msg: Message) {
    setSelectedTopic(null);
    setTopicSheetOpen(false);
    setSelectedMessage(msg);
    setSheetOpen(true);
  }

  function closeSheet() {
    setSheetOpen(false);
  }

  function openTopic(topic: BaseGraphNode) {
    setSelectedMessage(null);
    setSheetOpen(false);
    setSelectedTopic(topic);
    setTopicSheetOpen(true);
  }

  function closeTopicSheet() {
    setTopicSheetOpen(false);
  }

  function onJumpToParent(parent: Message) {
    const el = messageRefs.current[parent.id];
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
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
          {viewMode === "map" ? (
            <div className="h-full min-h-0 overflow-hidden px-2 py-2">
              <UserThreadMapView
                nodesData={BASE_NODES}
                edgesData={ALL_EDGES}
                onOpenMessage={openMessage}
                onOpenTopic={openTopic}
              />
            </div>
          ) : (
            <UserChatView
              messages={messages}
              messagesById={messagesById}
              messageRefs={messageRefs}
              selectedMessage={selectedMessage}
              sheetOpen={sheetOpen}
              onOpenMessage={openMessage}
              onCloseSheet={closeSheet}
              parentMessage={parentMessage}
              timeGranularity={timeGranularity}
              onJumpToParent={onJumpToParent}
            />
          )}
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

        <TopicDetailSheet
          selectedTopic={selectedTopic}
          sheetOpen={topicSheetOpen}
          onCloseSheet={closeTopicSheet}
        />
      </div>
    </main>
  );
}