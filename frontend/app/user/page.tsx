"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import UserThreadMapView from "../components/UserThreadMapView";
import UserChatView from "../components/UserChatView";
import UserHeader from "../components/UserHeader";
import UserFooter from "../components/UserFooter";
import UserMessageDetailSheet from "../components/UserMessageDetailSheet";

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

type TimeGranularity = "day" | "week" | "month";
type TimeRange = { start: string; end: string } | null;

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

function initials(name: string) {
  return name.split(" ").map((p) => p[0] ?? "").join("").slice(0, 2).toUpperCase();
}

function getEffectiveParentId(msg: Message) {
  return msg.parentId ?? msg.inferredReplyToId ?? null;
}

function isAiOnlyReply(msg: Message) {
  return !msg.parentId && !!msg.inferredReplyToId && !!msg.replyInferred;
}

function sentimentBadgeClass(sentiment?: string) {
  switch (sentiment) {
    case "supportive": return "bg-green-100 text-green-800";
    case "critical":   return "bg-red-100 text-red-800";
    case "mixed":      return "bg-yellow-100 text-yellow-800";
    default:           return "bg-gray-100 text-gray-700";
  }
}



export default function UserAppPage() {
  const [datasetIds, setDatasetIds] = useState<string[]>([]);
  const [selectedDataset, setSelectedDataset] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [aiMessages, setAiMessages] = useState<Message[]>([]);
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<"map" | "chat">("map");
  const [timeGranularity, setTimeGranularity] =
    useState<TimeGranularity>("week");
  const [selectedTimeRange, setSelectedTimeRange] = useState<TimeRange>(null);
  const [pendingScrollMessageId, setPendingScrollMessageId] = useState<
    string | null
  >(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [error, setError] = useState("");
  const [sliderLow, setSliderLow] = useState(0);
  const [sliderHigh, setSliderHigh] = useState(1);

  const messageRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const scrollToMessage = (messageId: string) => {
    const target = messageRefs.current[messageId];
    if (!target) return;
    target.scrollIntoView({
      behavior: "smooth",
      block: "center",
      inline: "nearest",
    });
    target.classList.add("ring-2", "ring-[#7A9B6E]", "ring-offset-2");
    window.setTimeout(() => {
      target.classList.remove("ring-2", "ring-[#7A9B6E]", "ring-offset-2");
    }, 1200);
  };

  const toggleTopicSelection = (topic: string) => {
    setSelectedTopics((prev) =>
      prev.includes(topic) ? prev.filter((t) => t !== topic) : [...prev, topic]
    );
  };

  const jumpToParentMessage = (parent: Message, current: Message) => {
    const parentBucket = getBucketKey(parent.timestamp, timeGranularity);
    const currentBucket = getBucketKey(current.timestamp, timeGranularity);
    const start =
      compareBuckets(parentBucket, currentBucket) <= 0
        ? parentBucket
        : currentBucket;
    const end =
      compareBuckets(parentBucket, currentBucket) <= 0
        ? currentBucket
        : parentBucket;
    setSelectedTimeRange({ start, end });
    setPendingScrollMessageId(parent.id);
  };

  const sourceMessages = useMemo(() => {
    return aiMessages.length > 0 ? aiMessages : messages;
  }, [messages, aiMessages]);

  const messagesById = useMemo(() => {
    return Object.fromEntries(sourceMessages.map((m) => [m.id, m]));
  }, [sourceMessages]);

  const availableTimeBuckets = useMemo(() => {
    const unique = new Set(
      sourceMessages.map((msg) => getBucketKey(msg.timestamp, timeGranularity))
    );
    return ["all", ...Array.from(unique).sort()];
  }, [sourceMessages, timeGranularity]);

  const usableTimeBuckets = useMemo(() => {
    return availableTimeBuckets.filter((b) => b !== "all");
  }, [availableTimeBuckets]);

  const timeFilteredMessages = useMemo(() => {
    if (!selectedTimeRange) return sourceMessages;
    return sourceMessages.filter((msg) => {
      const bucket = getBucketKey(msg.timestamp, timeGranularity);
      return (
        compareBuckets(bucket, selectedTimeRange.start) >= 0 &&
        compareBuckets(bucket, selectedTimeRange.end) <= 0
      );
    });
  }, [sourceMessages, selectedTimeRange, timeGranularity]);

  useEffect(() => {
    const usableBuckets = availableTimeBuckets.filter((b) => b !== "all");
    if (usableBuckets.length === 0) {
      setSliderLow(0);
      setSliderHigh(1);
      setSelectedTimeRange(null);
      return;
    }
    if (!selectedTimeRange) {
      setSliderLow(0);
      setSliderHigh(usableBuckets.length);
      return;
    }
    const startIndex = usableBuckets.indexOf(selectedTimeRange.start);
    const endIndex = usableBuckets.indexOf(selectedTimeRange.end);
    if (startIndex >= 0 && endIndex >= 0) {
      setSliderLow(startIndex);
      setSliderHigh(endIndex + 1);
    }
  }, [availableTimeBuckets, selectedTimeRange]);

  const availableTopics = useMemo(() => {
    const topicSet = new Set<string>();
    sourceMessages.forEach((msg) => {
      if (msg.topic && msg.topic !== "unknown") topicSet.add(msg.topic);
    });
    const topics = Array.from(topicSet);
    const withoutOther = topics
      .filter((t) => t !== "other")
      .sort((a, b) => a.localeCompare(b));
    if (topics.includes("other")) withoutOther.push("other");
    return withoutOther;
  }, [sourceMessages]);

  const topicFilteredMessages = useMemo(() => {
    if (selectedTopics.length === 0) return timeFilteredMessages;
    const timeFilteredById = Object.fromEntries(
      timeFilteredMessages.map((msg) => [msg.id, msg])
    );
    const includedIds = new Set<string>();

    timeFilteredMessages.forEach((msg) => {
      if (!msg.topic || !selectedTopics.includes(msg.topic)) return;
      includedIds.add(msg.id);

      let current: Message | undefined = msg;
      while (current) {
        const effectiveParentId = getEffectiveParentId(current);
        if (!effectiveParentId) break;
        const parent = timeFilteredById[effectiveParentId];
        if (!parent) break;
        includedIds.add(parent.id);
        current = parent;
      }
    });

    return timeFilteredMessages.filter((msg) => includedIds.has(msg.id));
  }, [timeFilteredMessages, selectedTopics]);

  const graphMessages = useMemo(() => {
    return topicFilteredMessages.map((msg) => ({
      ...msg,
      parentId: msg.parentId ?? msg.inferredReplyToId ?? null,
    }));
  }, [topicFilteredMessages]);

  const roots = useMemo(
    () => graphMessages.filter((m) => !m.parentId).length,
    [graphMessages]
  );

  const depth = useMemo(() => {
    const graphById = Object.fromEntries(graphMessages.map((m) => [m.id, m]));
    const depthOf = (msg: Message): number => {
      let d = 1;
      let cur = msg;
      while (cur.parentId && graphById[cur.parentId]) {
        d += 1;
        cur = graphById[cur.parentId];
      }
      return d;
    };
    return graphMessages.length ? Math.max(...graphMessages.map(depthOf)) : 0;
  }, [graphMessages]);

  const sentimentLine = useMemo(() => {
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

    const total = topicFilteredMessages.reduce(
      (sum, m) => sum + value(m.sentiment),
      0
    );
    const avg = topicFilteredMessages.length
      ? total / topicFilteredMessages.length
      : 0;
    const supportive = topicFilteredMessages.filter(
      (m) => m.sentiment === "supportive"
    ).length;
    const neutral = topicFilteredMessages.filter(
      (m) =>
        !m.sentiment || m.sentiment === "neutral" || m.sentiment === "mixed"
    ).length;
    const critical = topicFilteredMessages.filter(
      (m) => m.sentiment === "critical"
    ).length;
    const totalCount = supportive + neutral + critical || 1;

    return {
      avg,
      supportivePct: (supportive / totalCount) * 100,
      neutralPct: (neutral / totalCount) * 100,
      criticalPct: (critical / totalCount) * 100,
    };
  }, [topicFilteredMessages]);

  useEffect(() => {
    async function loadDatasets() {
      try {
        const res = await fetch("/api/datasets");
        if (!res.ok) throw new Error(`Failed to load datasets: ${res.status}`);
        const data = await res.json();
        const ids = Array.isArray(data.datasets) ? data.datasets : [];
        setDatasetIds(ids);
        if (ids.length > 0) setSelectedDataset(ids[0]);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load datasets"
        );
      }
    }
    loadDatasets();
  }, []);

  useEffect(() => {
    if (!selectedDataset) return;

    async function loadMessages() {
      try {
        setError("");
        const res = await fetch(`/api/discussions/${selectedDataset}/messages`);
        if (!res.ok) throw new Error(`Failed to load messages: ${res.status}`);
        const data = await res.json();
        const msgs = Array.isArray(data.messages) ? data.messages : [];
        setAiMessages([]);
        setMessages(msgs);
        setSelectedTimeRange(null);
        setPendingScrollMessageId(null);
        setSelectedTopics([]);
        setSelectedMessage(msgs[0] ?? null);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load messages"
        );
      }
    }

    loadMessages();
  }, [selectedDataset]);

  useEffect(() => {
    if (!selectedDataset) return;

    let cancelled = false;

    const refreshSelectedDataset = async () => {
      try {
        const res = await fetch(
          `api/discussions/${selectedDataset}/messages/annotated`
        );
        if (!res.ok) return;

        const data = await res.json();
        const msgs = Array.isArray(data.messages) ? data.messages : [];

        if (!cancelled) {
          setAiMessages(msgs);
          setSelectedMessage((prev) => {
            if (!prev) return msgs[0] ?? null;
            return msgs.find((m: Message) => m.id === prev.id) ?? prev;
          });
        }
      } catch {
        // ignore polling errors
      }
    };

    refreshSelectedDataset();
    const interval = window.setInterval(refreshSelectedDataset, 20000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [selectedDataset]);

  useEffect(() => {
    if (aiMessages.length > 0 && selectedMessage) {
      const enriched = aiMessages.find((m) => m.id === selectedMessage.id);
      if (enriched) setSelectedMessage(enriched);
    }
  }, [aiMessages, selectedMessage]);

  useEffect(() => {
    setSelectedTimeRange(null);
    setPendingScrollMessageId(null);
    setSelectedTopics([]);
  }, [timeGranularity]);

  useEffect(() => {
    if (!selectedTimeRange) return;
    const startValid = availableTimeBuckets.includes(selectedTimeRange.start);
    const endValid = availableTimeBuckets.includes(selectedTimeRange.end);
    if (!startValid || !endValid) setSelectedTimeRange(null);
  }, [availableTimeBuckets, selectedTimeRange]);

  useEffect(() => {
    setSelectedTopics((prev) => {
      const next = prev.filter((topic) => availableTopics.includes(topic));
      if (
        next.length === prev.length &&
        next.every((t, i) => t === prev[i])
      ) {
        return prev;
      }
      return next;
    });
  }, [availableTopics]);

  useEffect(() => {
    if (
      selectedMessage &&
      !topicFilteredMessages.some((m) => m.id === selectedMessage.id)
    ) {
      setSelectedMessage(topicFilteredMessages[0] ?? null);
      setSheetOpen(false);
    }
  }, [topicFilteredMessages, selectedMessage]);

  useEffect(() => {
    if (!pendingScrollMessageId || viewMode !== "chat") return;
    const timer = window.setTimeout(() => {
      scrollToMessage(pendingScrollMessageId);
      setPendingScrollMessageId(null);
    }, 150);
    return () => window.clearTimeout(timer);
  }, [topicFilteredMessages, pendingScrollMessageId, viewMode]);

  const closeSheet = () => {
    setSheetOpen(false);
  };

  const openMessage = (msg: Message) => {
    setSelectedMessage(msg);
    setSheetOpen(true);
  };

  const parentMessage = selectedMessage
    ? (messagesById[getEffectiveParentId(selectedMessage) ?? ""] ?? null)
    : null;


  return (
    <main className="h-dvh overflow-hidden bg-[#e8ede6]">
      <div className="relative mx-auto flex h-dvh w-full max-w-[430px] flex-col overflow-hidden bg-[#fafaf8] md:shadow-sm">
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
          onSliderChange={(lo, hi) => {
            setSliderLow(lo);
            setSliderHigh(hi);

            if (usableTimeBuckets.length === 0) {
              setSelectedTimeRange(null);
              return;
            }

            const startBucket = usableTimeBuckets[lo];
            const endBucket = usableTimeBuckets[hi - 1];

            if (!startBucket || !endBucket) {
              setSelectedTimeRange(null);
              return;
            }

            setSelectedTimeRange({
              start: startBucket,
              end: endBucket,
            });
          }}
          availableTopics={availableTopics}
          selectedTopics={selectedTopics}
          onToggleTopic={toggleTopicSelection}
          onClearTopics={() => setSelectedTopics([])}
          viewMode={viewMode}
          onChangeViewMode={setViewMode}
        />

        <div className="min-h-0 flex-1 overflow-hidden pb-36">
          {error ? (
            <div className="p-4 text-sm text-red-700">{error}</div>
          ) : viewMode === "map" ? (
            <div className="h-full min-h-0 overflow-hidden px-2 py-2">
              <div className="h-full overflow-hidden rounded-xl">
                <UserThreadMapView
                  messages={graphMessages}
                  selectedMessageId={selectedMessage?.id ?? null}
                  onSelectMessage={(id) => {
                    const msg = topicFilteredMessages.find((m) => m.id === id);
                    if (msg) {
                      setSelectedMessage(msg);
                      setSheetOpen(true);
                    }
                  }}
                />
              </div>
            </div>
          ) : (
            <UserChatView
              messages={topicFilteredMessages}
              messagesById={messagesById}
              messageRefs={messageRefs}
              selectedMessage={selectedMessage}
              sheetOpen={sheetOpen}
              onOpenMessage={openMessage}
              onCloseSheet={closeSheet}
              parentMessage={parentMessage}
              timeGranularity={timeGranularity}
              onJumpToParent={jumpToParentMessage}
            />
          )}
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

        <UserFooter
          messageCount={topicFilteredMessages.length}
          roots={roots}
          depth={depth}
          sentimentStats={sentimentLine}
        />
      </div>
    </main>
  );
}