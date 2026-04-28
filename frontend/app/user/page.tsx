"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Edge } from "@xyflow/react";
import { Maximize2, Minimize2 } from "lucide-react";
import UserHeader from "../components/UserHeader";
import UserFooter from "../components/UserFooter";
import UserThreadMapView, {
  type BaseGraphNode,
  type Message,
} from "../components/UserThreadMapView";
import UserChatView from "../components/UserChatView";
import UserMessageDetailSheet from "../components/UserMessageDetailSheet";
import TopicDetailSheet from "../components/TopicDetailSheet";
import TimeSlider from "../components/TimeSlider";

type TimeGranularity = "day" | "week" | "month";
type ViewMode = "map" | "chat";

type AiSummary = {
  root_id: string;
  main_topic: string;
  summary: string;
  key_points: string[];
};

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

function compareBuckets(a: string, b: string) {
  return a.localeCompare(b);
}

function formatBucketLabel(bucket: string, granularity: TimeGranularity) {
  if (granularity === "day") {
    const [, month, day] = bucket.split("-");
    return `${month}/${day}`;
  }
  if (granularity === "week") {
    const [, month, day] = bucket.split("-");
    return `Week ${month}/${day}`;
  }
  const [year, month] = bucket.split("-");
  return `${month}/${year}`;
}

export default function Page() {
  const [datasetIds, setDatasetIds] = useState<string[]>([]);
  const [selectedDataset, setSelectedDataset] = useState("");
  const [error, setError] = useState("");
  const [timeGranularity, setTimeGranularity] =
    useState<TimeGranularity>("week");
  const [sliderLow, setSliderLow] = useState(0);
  const [sliderHigh, setSliderHigh] = useState(1);
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>("map");
  const [messages, setMessages] = useState<Message[]>([]);
  const [topicSummaries, setTopicSummaries] = useState<Record<string, string>>(
    {}
  );
  const [aiSummaries, setAiSummaries] = useState<AiSummary[]>([]);
  const [loadingAI, setLoadingAI] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selectedTopic, setSelectedTopic] = useState<BaseGraphNode | null>(null);
  const [topicSheetOpen, setTopicSheetOpen] = useState(false);
  const [selectedTimeRange, setSelectedTimeRange] = useState<{
    start: string;
    end: string;
  } | null>(null);
  const [uploadError, setUploadError] = useState("");
  const [uploadSuccess, setUploadSuccess] = useState("");
  const [isFullscreen, setIsFullscreen] = useState(false);

  const messageRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const availableTimeBuckets = useMemo(() => {
    const unique = new Set(
      messages.map((msg) => getBucketKey(msg.timestamp, timeGranularity))
    );
    return ["all", ...Array.from(unique).sort()];
  }, [messages, timeGranularity]);

  const usableTimeBuckets = useMemo(() => {
    return availableTimeBuckets.filter((b) => b !== "all");
  }, [availableTimeBuckets]);

  const timeFilteredMessages = useMemo(() => {
    if (!selectedTimeRange) return messages;

    return messages.filter((msg) => {
      const bucket = getBucketKey(msg.timestamp, timeGranularity);
      return (
        compareBuckets(bucket, selectedTimeRange.start) >= 0 &&
        compareBuckets(bucket, selectedTimeRange.end) <= 0
      );
    });
  }, [messages, selectedTimeRange, timeGranularity]);

  const availableTopics = useMemo(() => {
    const topicSet = new Set<string>();

    timeFilteredMessages.forEach((msg) => {
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
  }, [timeFilteredMessages]);

  const displayedMessages = useMemo(() => {
    if (selectedTopics.length === 0) return timeFilteredMessages;

    return timeFilteredMessages.filter(
      (msg) => msg.topic && selectedTopics.includes(msg.topic)
    );
  }, [timeFilteredMessages, selectedTopics]);

  const messagesById: Record<string, Message> = useMemo(
    () => Object.fromEntries(displayedMessages.map((msg) => [msg.id, msg])),
    [displayedMessages]
  );

  const parentMessage = selectedMessage
    ? messagesById[
        selectedMessage.parentId ?? selectedMessage.inferredReplyToId ?? ""
      ] ?? null
    : null;

  const nodesData: BaseGraphNode[] = useMemo(
    () =>
      displayedMessages.map((msg, index) => ({
        id: msg.id,
        parentId: msg.parentId ?? msg.inferredReplyToId ?? null,
        position: { x: 40, y: 40 + index * 320 },
        topicTitle: msg.topic ?? "Unknown topic",
        aiSummary:
          !(msg.parentId ?? msg.inferredReplyToId)
            ? topicSummaries[msg.id] ?? "No summary available."
            : "No summary available.",
        senderName: msg.author,
        messageText: msg.text,
        timestamp: msg.timestamp,
        sentiment: msg.sentiment,
        inferredReplyToId: msg.inferredReplyToId,
        replyInferred: msg.replyInferred,
        isRoot: !(msg.parentId ?? msg.inferredReplyToId),
        hasChildren: displayedMessages.some(
          (other) =>
            (other.parentId ?? other.inferredReplyToId ?? null) === msg.id
        ),
      })),
    [displayedMessages, topicSummaries]
  );

  const edgesData: Edge[] = useMemo(
    () =>
      displayedMessages
        .filter((msg) => msg.parentId ?? msg.inferredReplyToId)
        .map((msg) => {
          const parentId = msg.parentId ?? msg.inferredReplyToId ?? "";
          return {
            id: `e-${parentId}-${msg.id}`,
            source: parentId,
            target: msg.id,
            style: { stroke: "#8BA07A", strokeWidth: 1.5 },
          };
        })
        .filter(
          (edge) =>
            displayedMessages.some((m) => m.id === edge.source) &&
            displayedMessages.some((m) => m.id === edge.target)
        ),
    [displayedMessages]
  );

  const roots = useMemo(() => {
    return displayedMessages.filter((m) => !(m.parentId ?? m.inferredReplyToId))
      .length;
  }, [displayedMessages]);

  const depth = useMemo(() => {
    const byId = Object.fromEntries(displayedMessages.map((m) => [m.id, m]));

    const depthOf = (msg: Message): number => {
      let d = 1;
      let cur = msg;

      while (
        (cur.parentId ?? cur.inferredReplyToId) &&
        byId[cur.parentId ?? cur.inferredReplyToId ?? ""]
      ) {
        d += 1;
        cur = byId[cur.parentId ?? cur.inferredReplyToId ?? ""];
      }

      return d;
    };

    return displayedMessages.length
      ? Math.max(...displayedMessages.map(depthOf))
      : 0;
  }, [displayedMessages]);

  const sentimentStats = useMemo(() => {
    const supportive = displayedMessages.filter(
      (m) => m.sentiment === "supportive"
    ).length;
    const neutral = displayedMessages.filter(
      (m) =>
        !m.sentiment || m.sentiment === "neutral" || m.sentiment === "mixed"
    ).length;
    const critical = displayedMessages.filter(
      (m) => m.sentiment === "critical"
    ).length;

    const totalCount = supportive + neutral + critical || 1;

    const avg = totalCount > 0
      ? (supportive + neutral * 0.5) / totalCount
      : 0.5;

    return {
      avg,
      supportivePct: (supportive / totalCount) * 100,
      neutralPct: (neutral / totalCount) * 100,
      criticalPct: (critical / totalCount) * 100,
    };
  }, [displayedMessages]);

  function handleSliderChange(lo: number, hi: number) {
    const maxHigh = Math.max(usableTimeBuckets.length, 1);
    const nextLow = Math.max(0, Math.min(lo, Math.max(maxHigh - 1, 0)));
    const nextHigh = Math.max(nextLow + 1, Math.min(hi, maxHigh));

    setSliderLow(nextLow);
    setSliderHigh(nextHigh);

    if (usableTimeBuckets.length === 0) {
      setSelectedTimeRange(null);
      return;
    }

    const startBucket = usableTimeBuckets[nextLow];
    const endBucket = usableTimeBuckets[nextHigh - 1];

    if (!startBucket || !endBucket) {
      setSelectedTimeRange(null);
      return;
    }

    setSelectedTimeRange({
      start: startBucket,
      end: endBucket,
    });
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

  const filteredAiSummaries = useMemo(() => {
    return aiSummaries.filter((summary) => {
      if (selectedTopics.length > 0 && !selectedTopics.includes(summary.main_topic)) {
        return false;
      }

      if (selectedTimeRange) {
        const rootMsg = messagesById[summary.root_id];
        if (!rootMsg) return false;
        
        const bucket = getBucketKey(rootMsg.timestamp, timeGranularity);
        const inRange =
          compareBuckets(bucket, selectedTimeRange.start) >= 0 &&
          compareBuckets(bucket, selectedTimeRange.end) <= 0;
        
        if (!inRange) return false;
      }

      return true;
    });
  }, [aiSummaries, selectedTopics, selectedTimeRange, timeGranularity, messagesById]);

  async function handleFileUpload(file: File) {
    setUploadError("");
    setUploadSuccess("");

    if (!file.name.endsWith(".json")) {
      setUploadError("Only .json files are supported.");
      return;
    }

    let parsed: unknown;
    try {
      const text = await file.text();
      parsed = JSON.parse(text);
    } catch {
      setUploadError("Could not parse file as JSON.");
      return;
    }

    if (!Array.isArray(parsed)) {
      setUploadError("JSON must be an array of messages.");
      return;
    }

    const name = file.name.replace(/\.json$/, "");

    try {
      const res = await fetch("/api/datasets/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, messages: parsed }),
      });
      const data = await res.json();

      if (!res.ok) {
        setUploadError(data.detail ?? "Upload failed.");
        return;
      }

      const newId: string = data.datasetId;
      setDatasetIds((prev) => (prev.includes(newId) ? prev : [...prev, newId]));
      setSelectedDataset(newId);
      setUploadSuccess(
        `"${newId}" uploaded (${data.messageCount} messages). AI analysis in progress...`
      );
    } catch {
      setUploadError("Upload failed. Is the backend running?");
    }
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

    let cancelled = false;

    setLoadingAI(true);
    setTopicSummaries({});
    setAiSummaries([]);

    async function loadTopicSummaries() {
      try {
        const res = await fetch(
          `/api/discussions/${selectedDataset}/messages/ai-summary`
        );
        if (!res.ok) {
          throw new Error(`Failed to load AI summaries: ${res.status}`);
        }

        const data = await res.json();
        const summaries = Array.isArray(data.summaries)
          ? (data.summaries as AiSummary[])
          : [];

        const mapped = Object.fromEntries(
          summaries.map(
            (item: { root_id: string; summary: string }) => [
              item.root_id,
              item.summary,
            ]
          )
        );

        if (cancelled) return;

        setTopicSummaries(mapped);
        setAiSummaries(summaries);
        setLoadingAI(false);
        if (summaries.length > 0) {
          setUploadSuccess("");
        }
      } catch (err) {
        console.error(err);
        if (!cancelled) {
          setLoadingAI(false);
        }
      }
    }

    loadTopicSummaries();

    const interval = window.setInterval(loadTopicSummaries, 30000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [selectedDataset]);

  useEffect(() => {
    if (!selectedDataset) return;

    async function loadMessages() {
      try {
        setError("");
        const res = await fetch(
          `/api/discussions/${selectedDataset}/messages/annotated`
        );
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
      setSelectedTimeRange(null);
      return;
    }

    setSliderLow(0);
    setSliderHigh(usableTimeBuckets.length);
    setSelectedTimeRange(null);
  }, [usableTimeBuckets]);

  useEffect(() => {
    setSelectedTopics((prev) =>
      prev.filter((topic) => availableTopics.includes(topic))
    );
  }, [availableTopics]);

  useEffect(() => {
    if (
      selectedMessage &&
      !displayedMessages.some((m) => m.id === selectedMessage.id)
    ) {
      setSelectedMessage(null);
      setSheetOpen(false);
    }
  }, [displayedMessages, selectedMessage]);

  const safeSliderLow = Math.max(
    0,
    Math.min(sliderLow, Math.max(usableTimeBuckets.length - 1, 0))
  );
  const safeSliderHigh = Math.max(
    safeSliderLow + 1,
    Math.min(sliderHigh, Math.max(usableTimeBuckets.length, 1))
  );
  const timeSliderSegments = Math.max(usableTimeBuckets.length, 1);

  return (
    <main className="h-dvh bg-[#f3f5f1]">
      <div className="mx-auto flex h-dvh w-full flex-col bg-[#f8faf7]">
        {!isFullscreen && (
          <UserHeader
            datasetIds={datasetIds}
            selectedDataset={selectedDataset}
            onSelectDataset={setSelectedDataset}
            timeGranularity={timeGranularity}
            onChangeGranularity={setTimeGranularity}
            availableTimeBuckets={availableTimeBuckets}
            usableTimeBuckets={usableTimeBuckets}
            sliderLow={safeSliderLow}
            sliderHigh={safeSliderHigh}
            onSliderChange={handleSliderChange}
            availableTopics={availableTopics}
            selectedTopics={selectedTopics}
            onToggleTopic={handleToggleTopic}
            onClearTopics={handleClearTopics}
            viewMode={viewMode}
            onChangeViewMode={setViewMode}
            onFileUpload={handleFileUpload}
            uploadError={uploadError}
            uploadSuccess={uploadSuccess}
          />
        )}

        <div className="min-h-0 flex-1 overflow-hidden">
          {error ? (
            <div className="p-4 text-sm text-red-700">{error}</div>
          ) : isFullscreen ? (
            <div className="flex h-full min-h-0 flex-col overflow-hidden bg-[#f8faf7]">
              <div className="shrink-0 border-b border-[#d4ddd0] bg-[#fafaf8] px-4 py-3">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1 overflow-visible px-1">
                    <TimeSlider
                      segments={timeSliderSegments}
                      low={safeSliderLow}
                      high={safeSliderHigh}
                      onChange={handleSliderChange}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsFullscreen(false)}
                    aria-label="Exit fullscreen"
                    title="Exit fullscreen"
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#A8B89A] bg-[#fafaf8] text-[#3D6B35] shadow-md transition hover:bg-[#eef2eb] active:scale-95"
                  >
                    <Minimize2 size={17} strokeWidth={2.2} />
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={usableTimeBuckets[safeSliderLow] ?? ""}
                    onChange={(e) => {
                      const nextLow = usableTimeBuckets.indexOf(e.target.value);
                      if (nextLow === -1) return;
                      const nextHigh = Math.max(safeSliderHigh, nextLow + 1);
                      handleSliderChange(nextLow, nextHigh);
                    }}
                    className="rounded-full border border-[#A8B89A] bg-[#eef2eb] px-3 py-1 text-[11px] font-medium text-[#2B3A2B] outline-none"
                  >
                    {usableTimeBuckets.map((bucket, index) => (
                      <option key={bucket} value={bucket} disabled={index >= safeSliderHigh}>
                        {formatBucketLabel(bucket, timeGranularity)}
                      </option>
                    ))}
                  </select>

                  <span className="text-[11px] font-medium text-[#5C7A4E]">to</span>

                  <select
                    value={usableTimeBuckets[safeSliderHigh - 1] ?? ""}
                    onChange={(e) => {
                      const endIndex = usableTimeBuckets.indexOf(e.target.value);
                      if (endIndex === -1) return;
                      const nextHigh = endIndex + 1;
                      const nextLow = Math.min(safeSliderLow, endIndex);
                      handleSliderChange(nextLow, nextHigh);
                    }}
                    className="rounded-full border border-[#A8B89A] bg-[#eef2eb] px-3 py-1 text-[11px] font-medium text-[#2B3A2B] outline-none"
                  >
                    {usableTimeBuckets.map((bucket, index) => (
                      <option key={bucket} value={bucket} disabled={index < safeSliderLow}>
                        {formatBucketLabel(bucket, timeGranularity)}
                      </option>
                    ))}
                  </select>

                  <div className="min-w-0 flex-1 overflow-x-auto overflow-y-hidden">
                    <div className="flex w-max gap-1.5 px-1">
                      <button
                        type="button"
                        onClick={handleClearTopics}
                        className={`shrink-0 rounded-full border px-3 py-1 text-xs font-medium whitespace-nowrap ${
                          selectedTopics.length === 0
                            ? "border-[#3D6B35] bg-[#3D6B35] text-[#f5f8f2]"
                            : "border-[#A8B89A] bg-transparent text-[#5C7A4E]"
                        }`}
                      >
                        All topics
                      </button>
                      {availableTopics.map((topic) => (
                        <button
                          type="button"
                          key={topic}
                          onClick={() => handleToggleTopic(topic)}
                          className={`shrink-0 rounded-full border px-3 py-1 text-xs font-medium whitespace-nowrap ${
                            selectedTopics.includes(topic)
                              ? "border-[#3D6B35] bg-[#3D6B35] text-[#f5f8f2]"
                              : "border-[#A8B89A] bg-transparent text-[#5C7A4E]"
                          }`}
                        >
                          {topic}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-hidden p-2">
                <UserThreadMapView
                  nodesData={nodesData}
                  edgesData={edgesData}
                  onOpenMessage={openMessage}
                  onOpenTopic={openTopic}
                />
              </div>
            </div>
          ) : viewMode === "map" ? (
            <div className="relative h-full min-h-0 overflow-hidden px-2 py-2">
              <button
                type="button"
                onClick={() => setIsFullscreen(true)}
                aria-label="Enter fullscreen"
                title="Enter fullscreen"
                className="absolute right-5 top-5 z-30 flex h-9 w-9 items-center justify-center rounded-full border border-[#A8B89A] bg-[#fafaf8] text-[#3D6B35] shadow-md transition hover:bg-[#eef2eb] active:scale-95"
              >
                <Maximize2 size={17} strokeWidth={2.2} />
              </button>
              <UserThreadMapView
                nodesData={nodesData}
                edgesData={edgesData}
                onOpenMessage={openMessage}
                onOpenTopic={openTopic}
              />
            </div>
          ) : (
            <UserChatView
              messages={displayedMessages}
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

        {!isFullscreen && (
          <div className="shrink-0">
            <UserFooter
              messageCount={displayedMessages.length}
              roots={roots}
              depth={depth}
              sentimentStats={sentimentStats}
              aiSummaries={filteredAiSummaries}
              loadingAI={loadingAI}
            />
          </div>
        )}

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
