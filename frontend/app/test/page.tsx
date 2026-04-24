"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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

function compareBuckets(a: string, b: string) {
  return a.localeCompare(b);
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
  const [aiSummaries, setAiSummaries] = useState<any[]>([]);
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

    // Calculate average sentiment as a 0-1 scale
    // Using formula: (supportive + neutral * 0.5) / total
    // This gives: 1 if all supportive, 0.5 if all neutral, 0 if all critical
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

  // Filter AI Summaries based on selected topics and time range
  const filteredAiSummaries = useMemo(() => {
    return aiSummaries.filter((summary) => {
      // Filter by topic: if topics selected, summary must match one of them
      if (selectedTopics.length > 0 && !selectedTopics.includes(summary.main_topic)) {
        return false;
      }

      // Filter by time: if time range selected, root message must be in range
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
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout for upload

      const res = await fetch("/api/datasets/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, messages: parsed }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      
      const data = await res.json();
      if (!res.ok) {
        setUploadError(data.detail ?? "Upload failed.");
        return;
      }
      const newId: string = data.datasetId;
      setDatasetIds((prev) => prev.includes(newId) ? prev : [...prev, newId]);
      setSelectedDataset(newId);
      setUploadSuccess(`✨ "${newId}" uploaded (${data.messageCount} messages). 🤖 AI analysis in progress...`);
      
      // Don't auto-hide the message - let it clear when AI is done
      // The loadTopicSummaries useEffect will clear it when data arrives
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        setUploadError("Upload timed out. The file may be too large.");
      } else {
        setUploadError("Upload failed. Is the backend running?");
      }
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

    async function loadTopicSummaries() {
      try {
        setLoadingAI(true);
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

        try {
          const res = await fetch(
            `/api/discussions/${selectedDataset}/messages/ai-summary`,
            { signal: controller.signal }
          );
          clearTimeout(timeoutId);
          
          if (!res.ok) {
            throw new Error(`Failed to load AI summaries: ${res.status}`);
          }

          const data = await res.json();

          const mapped = Object.fromEntries(
            (data.summaries ?? []).map(
              (item: { root_id: string; summary: string }) => [
                item.root_id,
                item.summary,
              ]
            )
          );

          setTopicSummaries(mapped);
          
          // Also store the full summaries array
          const summaries = Array.isArray(data.summaries) ? data.summaries : [];
          // Only update if we got actual summaries
          if (summaries.length > 0) {
            setAiSummaries(summaries);
            // Clear the upload success message when AI analysis is done
            setUploadSuccess("");
          }
          setLoadingAI(false);
        } catch (err) {
          clearTimeout(timeoutId);
          if (err instanceof DOMException && err.name === 'AbortError') {
            console.error("AI summary loading timed out (30s)");
          } else {
            console.error(err);
          }
          setLoadingAI(false);
          // Don't clear existing data on error
        }
      } catch (err) {
        console.error(err);
        setLoadingAI(false);
      }
    }

    loadTopicSummaries();
  }, [selectedDataset]);

  useEffect(() => {
    if (!selectedDataset) return;

    async function loadMessages() {
      try {
        setError("");
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

        try {
          const res = await fetch(
            `/api/discussions/${selectedDataset}/messages/annotated`,
            { signal: controller.signal }
          );
          clearTimeout(timeoutId);
          
          if (!res.ok) {
            throw new Error(`Failed to load messages: ${res.status}`);
          }

          const data = await res.json();
          const msgs = Array.isArray(data.messages) ? data.messages : [];

          setMessages(msgs);
          setSelectedMessage(msgs[0] ?? null);
        } catch (err) {
          clearTimeout(timeoutId);
          if (err instanceof DOMException && err.name === 'AbortError') {
            console.error("Annotated messages loading timed out (30s)");
            setError("Loading messages timed out. AI analysis may still be processing.");
          } else {
            setError(err instanceof Error ? err.message : "Failed to load messages");
          }
        }
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

        <div className="min-h-0 flex-1 overflow-hidden">
          {error ? (
            <div className="p-4 text-sm text-red-700">{error}</div>
          ) : isFullscreen ? (
            // Fullscreen mode
            <div className="fixed inset-0 z-50 flex flex-col bg-[#f8faf7]">
              <div className="flex items-center justify-between border-b border-[#d4ddd0] px-4 py-2 bg-white">
                <h2 className="text-sm font-semibold text-[#2B3A2B]">Thread Map - Fullscreen</h2>
                <button
                  onClick={() => setIsFullscreen(false)}
                  className="rounded-lg px-3 py-1 text-xs font-medium bg-[#8BA07A] text-white hover:bg-[#7a9469] transition"
                >
                  Exit Fullscreen
                </button>
              </div>
              <div className="flex-1 min-h-0 overflow-hidden">
                <UserThreadMapView
                  nodesData={nodesData}
                  edgesData={edgesData}
                  onOpenMessage={openMessage}
                  onOpenTopic={openTopic}
                />
              </div>
            </div>
          ) : viewMode === "map" ? (
            <div className="h-full min-h-0 overflow-hidden flex flex-col relative">
              {/* Fullscreen button */}
              <button
                onClick={() => setIsFullscreen(true)}
                className="absolute top-2 right-2 z-10 rounded-lg px-2 py-1 text-xs font-medium bg-[#8BA07A] text-white hover:bg-[#7a9469] transition"
                title="Expand to fullscreen"
              >
                ⛶
              </button>
              <div className="flex-1 min-h-0 overflow-hidden px-2 py-2">
                <UserThreadMapView
                  nodesData={nodesData}
                  edgesData={edgesData}
                  onOpenMessage={openMessage}
                  onOpenTopic={openTopic}
                />
              </div>
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