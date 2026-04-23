"use client";

import { useEffect, useRef, useState, useMemo } from "react";
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

function getDayKey(timestamp: string) {
  return timestamp.slice(0, 10);
}

function getMonthKey(timestamp: string) {
  return timestamp.slice(0, 7);
}

function getWeekKey(timestamp: string) {
  const date = new Date(timestamp);
  const day = date.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setUTCDate(date.getUTCDate() + diff);
  return date.toISOString().slice(0, 10);
}

function getBucketKey(timestamp: string, granularity: TimeGranularity) {
  if (granularity === "day") return getDayKey(timestamp);
  if (granularity === "week") return getWeekKey(timestamp);
  return getMonthKey(timestamp);
}

export default function Page() {
  const [datasetIds, setDatasetIds] = useState<string[]>([]);
  const [selectedDataset, setSelectedDataset] = useState("");
  const [error, setError] = useState("");
  const [timeGranularity, setTimeGranularity] = useState<TimeGranularity>("week");
  const [sliderLow, setSliderLow] = useState(0);
  const [sliderHigh, setSliderHigh] = useState(2);
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>("map");
  const [messages, setMessages] = useState<Message[]>([]);


  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selectedTopic, setSelectedTopic] = useState<BaseGraphNode | null>(null);
  const [topicSheetOpen, setTopicSheetOpen] = useState(false);

  const messageRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const messagesById: Record<string, Message> = Object.fromEntries(
    messages.map((msg) => [msg.id, msg])
  );

  const parentMessage = selectedMessage ? 
    messagesById[selectedMessage.parentId ?? selectedMessage.inferredReplyToId ?? ""] ?? null : null;

  const nodesData: BaseGraphNode[] = messages.map((msg, index) => ({
    id: msg.id,
    parentId: msg.parentId ?? msg.inferredReplyToId ?? null,
    position: { x: 40, y: 40 + index * 320 },
    topicTitle: msg.topic ?? "Unknown topic",
    aiSummary: msg.topic ?? "No summary available.",
    senderName: msg.author,
    messageText: msg.text,
    timestamp: msg.timestamp,
    sentiment: msg.sentiment,
    inferredReplyToId: msg.inferredReplyToId,
    replyInferred: msg.replyInferred,
    isRoot: !(msg.parentId ?? msg.inferredReplyToId),
    hasChildren: messages.some(
      (other) => (other.parentId ?? other.inferredReplyToId ?? null) === msg.id
    ),
  }));

  const edgesData: Edge[] = messages
    .filter((msg) => msg.parentId ?? msg.inferredReplyToId)
    .map((msg) => {
      const parentId = msg.parentId ?? msg.inferredReplyToId ?? "";
      return {
        id: `e-${parentId}-${msg.id}`,
        source: parentId,
        target: msg.id,
        style: { stroke: "#8BA07A", strokeWidth: 1.5 },
      };
  });

  const availableTimeBuckets = useMemo(() => {
    const unique = new Set(
      messages.map((msg) => getBucketKey(msg.timestamp, timeGranularity))
    );
    return ["all", ...Array.from(unique).sort()];
  }, [messages, timeGranularity]);

  const usableTimeBuckets = useMemo(() => {
    return availableTimeBuckets.filter((b) => b !== "all");
  }, [availableTimeBuckets]);

  const availableTopics = useMemo(() => {
    const topicSet = new Set<string>();
    messages.forEach((msg) => {
      if (msg.topic && msg.topic !== "unknown") {
        topicSet.add(msg.topic);
      }
    });

    const topics = Array.from(topicSet);
    const withoutOther = topics
      .filter((t) => t !== "other")
      .sort((a, b) => a.localeCompare(b));

    if (topics.includes("other")) withoutOther.push("other");
    return withoutOther;
  }, [messages]);

  const roots = useMemo(() => {
  return messages.filter((m) => !(m.parentId ?? m.inferredReplyToId)).length;
}, [messages]);

const depth = useMemo(() => {
  const byId = Object.fromEntries(messages.map((m) => [m.id, m]));

  const depthOf = (msg: Message): number => {
    let d = 1;
    let cur = msg;

    while ((cur.parentId ?? cur.inferredReplyToId) && byId[cur.parentId ?? cur.inferredReplyToId ?? ""]) {
      d += 1;
      cur = byId[cur.parentId ?? cur.inferredReplyToId ?? ""];
    }

    return d;
  };

  return messages.length ? Math.max(...messages.map(depthOf)) : 0;
}, [messages]);

const sentimentStats = useMemo(() => {
  const value = (sentiment?: string) => {
    switch (sentiment) {
      case "supportive":
        return 1;
      case "critical":
        return -1;
      default:
        return 0;
    }
  };

  const total = messages.reduce((sum, m) => sum + value(m.sentiment), 0);
  const avg = messages.length ? total / messages.length : 0;

  const supportive = messages.filter((m) => m.sentiment === "supportive").length;
  const neutral = messages.filter(
    (m) => !m.sentiment || m.sentiment === "neutral" || m.sentiment === "mixed"
  ).length;
  const critical = messages.filter((m) => m.sentiment === "critical").length;

  const totalCount = supportive + neutral + critical || 1;

  return {
    avg,
    supportivePct: (supportive / totalCount) * 100,
    neutralPct: (neutral / totalCount) * 100,
    criticalPct: (critical / totalCount) * 100,
  };
}, [messages]);

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

  useEffect(() => {
    async function loadDatasets() {
      try {
        setError("");
        const res = await fetch("/api/datasets");
        if (!res.ok) {
          throw new Error(`Failed to load datasets: ${res.status}`);
        }

        const data = await res.json();
        const ids = Array.isArray(data.datasets) ? data.datasets : [];

        setDatasetIds(ids);

        if (ids.length > 0) {
          setSelectedDataset((prev) => prev || ids[0]);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load datasets");
      }
    }

    loadDatasets();
  }, []);

  useEffect(() => {
    if (!selectedDataset) return;

    async function loadMessages() {
      try {
        setError("");
        const res = await fetch(`/api/discussions/${selectedDataset}/messages/annotated`);
        if (!res.ok) {
          throw new Error(`Failed to load messages: ${res.status}`);
        }

        const data = await res.json();
        const msgs = Array.isArray(data.messages) ? data.messages : [];

        setMessages(msgs);
        setSelectedMessage(msgs[0] ?? null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load messages");
      }
    }

    loadMessages();
  }, [selectedDataset]);

  useEffect(() => {
    if (usableTimeBuckets.length === 0) {
      setSliderLow(0);
      setSliderHigh(1);
      return;
    }

    setSliderLow(0);
    setSliderHigh(usableTimeBuckets.length);
  }, [usableTimeBuckets]);

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
          {error ? (
            <div className="p-4 text-sm text-red-700">{error}</div>
          ) : viewMode === "map" ? (
            <div className="h-full min-h-0 overflow-hidden px-2 py-2">
              <UserThreadMapView
                nodesData={nodesData}
                edgesData={edgesData}
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
            messageCount={messages.length}
            roots={roots}
            depth={depth}
            sentimentStats={sentimentStats}
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
