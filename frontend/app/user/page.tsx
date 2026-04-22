"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import UserThreadMapView from "../components/UserThreadMapView";
import TimeSlider from "../components/TimeSlider";

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

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

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

function getEffectiveParentId(msg: Message) {
  return msg.parentId ?? msg.inferredReplyToId ?? null;
}

function isAiOnlyReply(msg: Message) {
  return !msg.parentId && !!msg.inferredReplyToId && !!msg.replyInferred;
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

  const chatScrollRef = useRef<HTMLDivElement | null>(null);
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

  const isTopicSelected = (topic: string) => selectedTopics.includes(topic);

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
    ? messagesById[getEffectiveParentId(selectedMessage) ?? ""]
    : null;

  return (
    <main className="h-dvh overflow-hidden bg-[#e8ede6]">
      <div className="relative mx-auto h-full w-full max-w-[430px] overflow-hidden bg-[#fafaf8] md:shadow-sm">
        <div className="grid h-full min-w-0 grid-rows-[200px_minmax(0,1fr)_200px]">
          {/* Header */}
          <div className="h-[200px] overflow-hidden border-b border-[#d4ddd0] px-5 pt-4 pb-3">
            <div className="flex h-full min-h-0 flex-col gap-3">
              <div className="flex items-center justify-between gap-3">
                <div className="text-[15px] font-semibold tracking-[-0.3px] text-[#2B3A2B]">
                  Thread Map
                </div>

                {datasetIds.length > 1 && (
                  <div className="relative shrink-0">
                    <select
                      value={selectedDataset}
                      onChange={(e) => setSelectedDataset(e.target.value)}
                      className="appearance-none rounded-full border border-[#A8B89A] bg-[#eef2eb] px-3 py-1 pr-8 text-xs font-medium text-[#2B3A2B] outline-none"
                    >
                      {datasetIds.map((id) => (
                        <option key={id} value={id}>
                          {id}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                <label className="shrink-0 text-[11px] font-medium text-[#5C7A4E]">
                  Group by
                </label>

                <div className="relative shrink-0">
                  <select
                    value={timeGranularity}
                    onChange={(e) =>
                      setTimeGranularity(e.target.value as TimeGranularity)
                    }
                    className="appearance-none rounded-full border border-[#A8B89A] bg-[#eef2eb] px-3 py-1 pr-8 text-xs font-medium text-[#2B3A2B] outline-none"
                  >
                    <option value="day">Daily</option>
                    <option value="week">Weekly</option>
                    <option value="month">Monthly</option>
                  </select>
                </div>
              </div>

              <div className="shrink-0" style={{ overflow: "visible" }}>
                <TimeSlider
                  segments={Math.max(
                    availableTimeBuckets.filter((b) => b !== "all").length,
                    1
                  )}
                  low={sliderLow}
                  high={sliderHigh}
                  onChange={(lo, hi) => {
                    const usableBuckets = availableTimeBuckets.filter(
                      (b) => b !== "all"
                    );

                    setSliderLow(lo);
                    setSliderHigh(hi);

                    if (usableBuckets.length === 0) {
                      setSelectedTimeRange(null);
                      return;
                    }

                    const startBucket = usableBuckets[lo];
                    const endBucket = usableBuckets[hi - 1];

                    if (!startBucket || !endBucket) {
                      setSelectedTimeRange(null);
                      return;
                    }

                    setSelectedTimeRange({
                      start: startBucket,
                      end: endBucket,
                    });
                  }}
                />
              </div>

              <div className="flex items-center justify-center gap-2">
                <select
                  value={usableTimeBuckets[sliderLow] ?? ""}
                  onChange={(e) => {
                    const nextLow = usableTimeBuckets.indexOf(e.target.value);
                    if (nextLow === -1) return;

                    const nextHigh = Math.max(sliderHigh, nextLow + 1);
                    setSliderLow(nextLow);
                    setSliderHigh(nextHigh);

                    const startBucket = usableTimeBuckets[nextLow];
                    const endBucket = usableTimeBuckets[nextHigh - 1];

                    if (startBucket && endBucket) {
                      setSelectedTimeRange({
                        start: startBucket,
                        end: endBucket,
                      });
                    }
                  }}
                  className="rounded-full border border-[#A8B89A] bg-[#eef2eb] px-3 py-1 text-[11px] font-medium text-[#2B3A2B] outline-none"
                >
                  {usableTimeBuckets.map((bucket, index) => (
                    <option
                      key={bucket}
                      value={bucket}
                      disabled={index >= sliderHigh}
                    >
                      {formatBucketLabel(bucket, timeGranularity)}
                    </option>
                  ))}
                </select>

                <span className="text-[11px] font-medium text-[#5C7A4E]">
                  to
                </span>

                <select
                  value={usableTimeBuckets[sliderHigh - 1] ?? ""}
                  onChange={(e) => {
                    const endIndex = usableTimeBuckets.indexOf(e.target.value);
                    if (endIndex === -1) return;

                    const nextHigh = endIndex + 1;
                    const nextLow = Math.min(sliderLow, endIndex);

                    setSliderLow(nextLow);
                    setSliderHigh(nextHigh);

                    const startBucket = usableTimeBuckets[nextLow];
                    const endBucket = usableTimeBuckets[nextHigh - 1];

                    if (startBucket && endBucket) {
                      setSelectedTimeRange({
                        start: startBucket,
                        end: endBucket,
                      });
                    }
                  }}
                  className="rounded-full border border-[#A8B89A] bg-[#eef2eb] px-3 py-1 text-[11px] font-medium text-[#2B3A2B] outline-none"
                >
                  {usableTimeBuckets.map((bucket, index) => (
                    <option
                      key={bucket}
                      value={bucket}
                      disabled={index < sliderLow}
                    >
                      {formatBucketLabel(bucket, timeGranularity)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="-mx-5 h-[38px] min-w-0 overflow-x-auto overflow-y-hidden px-5 scrollbar-thin">
                <div className="flex w-max gap-1.5 pr-5">
                  <button
                    onClick={() => setSelectedTopics([])}
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
                      key={topic}
                      onClick={() => toggleTopicSelection(topic)}
                      className={`shrink-0 rounded-full border px-3 py-1 text-xs font-medium whitespace-nowrap ${
                        isTopicSelected(topic)
                          ? "border-[#3D6B35] bg-[#3D6B35] text-[#f5f8f2]"
                          : "border-[#A8B89A] bg-transparent text-[#5C7A4E]"
                      }`}
                    >
                      {topic}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-auto">
                <div className="flex w-full rounded-full bg-[#e4ebe0] p-0.5">
                  <button
                    onClick={() => setViewMode("map")}
                    className={`flex-1 rounded-full px-3 py-2 text-xs font-medium transition ${
                      viewMode === "map"
                        ? "bg-[#fafaf8] text-[#2B3A2B]"
                        : "bg-transparent text-[#7A9B6E]"
                    }`}
                  >
                    Thread Map
                  </button>

                  <button
                    onClick={() => setViewMode("chat")}
                    className={`flex-1 rounded-full px-3 py-2 text-xs font-medium transition ${
                      viewMode === "chat"
                        ? "bg-[#fafaf8] text-[#2B3A2B]"
                        : "bg-transparent text-[#7A9B6E]"
                    }`}
                  >
                    Chat View
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Main content */}
          <div className="min-h-0 overflow-hidden">
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
              <div
                ref={chatScrollRef}
                className="h-full overflow-y-auto overflow-x-hidden px-4 py-3 flex flex-col justify-end"
              >
                <div className="flex min-w-0 flex-col gap-2 pb-4">
                  {topicFilteredMessages.map((msg) => {
                    const parent = messagesById[getEffectiveParentId(msg) ?? ""];
                    const inferred = isAiOnlyReply(msg);

                    return (
                      <div
                        key={msg.id}
                        ref={(el) => {
                          messageRefs.current[msg.id] = el;
                        }}
                        role="button"
                        tabIndex={0}
                        onClick={() => openMessage(msg)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            openMessage(msg);
                          }
                        }}
                        className="flex min-w-0 cursor-pointer items-start gap-2 rounded-[12px] text-left transition"
                      >
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#d6e0d2] text-[10px] font-semibold text-[#2B3A2B]">
                          {initials(msg.author)}
                        </div>

                        <div className="min-w-0 max-w-[260px] rounded-[16px] rounded-bl-[4px] bg-[#eef2eb] px-3 py-2">
                          {parent && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                jumpToParentMessage(parent, msg);
                              }}
                              className="mb-2 block w-full min-w-0 rounded-[10px] bg-[#dfe8d8] px-2.5 py-2 text-left"
                            >
                              <div className="flex min-w-0 items-center gap-1 text-[10px] font-medium text-[#5C7A4E]">
                                <span className="truncate">
                                  Replying to {parent.author}
                                </span>
                                {inferred && (
                                  <span
                                    className="shrink-0"
                                    title="AI-inferred reply"
                                  >
                                    ★
                                  </span>
                                )}
                              </div>
                              <div className="truncate text-[10px] text-[#7c8f70]">
                                {parent.text}
                              </div>
                            </button>
                          )}

                          <div className="mb-1 text-[11px] font-semibold text-[#3D6B35]">
                            {msg.author}
                          </div>

                          <div className="break-words text-[13px] leading-[1.45] text-[#2B3A2B]">
                            {msg.text}
                          </div>

                          <div className="mt-1.5 flex min-w-0 items-center gap-1.5">
                            <span className="shrink-0 text-[10px] text-[#8BA07A]">
                              {new Date(msg.timestamp).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                            <span
                              className={`shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-medium ${sentimentBadgeClass(
                                msg.sentiment
                              )}`}
                            >
                              {msg.sentiment ?? "neutral"}
                            </span>
                            {inferred && (
                              <span
                                className="shrink-0 text-[10px] text-[#5C7A4E]"
                                title="AI-inferred reply"
                              >
                                ★
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="h-[200px] overflow-hidden border-t border-[#d4ddd0] px-4 pt-2 pb-[calc(env(safe-area-inset-bottom)+8px)]">
            <div className="flex h-full min-h-0 flex-col">
              <div className="mb-2 flex gap-2">
                {[
                  { value: topicFilteredMessages.length, label: "messages" },
                  { value: roots, label: "threads" },
                  { value: depth, label: "depth" },
                ].map(({ value, label }) => (
                  <div
                    key={label}
                    className="flex-1 rounded-[10px] bg-[#e4ebe0] px-2 py-1.5"
                  >
                    <div className="text-base font-semibold text-[#2B3A2B]">
                      {value}
                    </div>
                    <div className="text-[9px] uppercase tracking-[.04em] text-[#8BA07A]">
                      {label}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-2">
                <span className="whitespace-nowrap text-[10px] font-medium uppercase tracking-[.04em] text-[#8BA07A]">
                  Sentiment
                </span>
                <div className="flex h-2 flex-1 overflow-hidden rounded-full">
                  <div
                    className="h-full bg-[#4A9B4A]"
                    style={{ width: `${sentimentLine.supportivePct}%` }}
                  />
                  <div
                    className="h-full bg-[#E07820]"
                    style={{ width: `${sentimentLine.neutralPct}%` }}
                  />
                  <div
                    className="h-full bg-[#C93030]"
                    style={{ width: `${sentimentLine.criticalPct}%` }}
                  />
                </div>
                <span className="whitespace-nowrap text-[10px] text-[#8BA07A]">
                  {sentimentLine.avg.toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Message detail sheet */}
        {selectedMessage && (
          <div
            className={`fixed bottom-0 left-1/2 z-50 w-full max-w-[430px] -translate-x-1/2 rounded-t-[20px] border-t border-[#d4ddd0] bg-[#fafaf8] px-4 pt-4 pb-[calc(env(safe-area-inset-bottom)+20px)] shadow-[0_-8px_24px_rgba(0,0,0,0.08)] transition-transform duration-300 ${
              sheetOpen ? "translate-y-0" : "translate-y-full"
            }`}
          >
            <div className="mb-3 flex justify-end">
              <button
                onClick={closeSheet}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-[#e4ebe0] text-sm font-semibold text-[#4A5E42] hover:bg-[#d6e0d2]"
                aria-label="Close detail panel"
              >
                ×
              </button>
            </div>

            <div className="mb-3 flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#d6e0d2] text-xs font-semibold text-[#2B3A2B]">
                {initials(selectedMessage.author)}
              </div>

              <div className="min-w-0">
                <div className="truncate text-[15px] font-semibold text-[#2B3A2B]">
                  {selectedMessage.author}
                </div>
                <div className="truncate text-[11px] text-[#8BA07A]">
                  {selectedMessage.timestamp}
                </div>
              </div>
            </div>

            <div className="mb-3 border-y border-[#d4ddd0] py-3 text-[13px] leading-[1.55] text-[#4A5E42]">
              {selectedMessage.text}
            </div>

            <div className="flex flex-wrap gap-2">
              {selectedMessage.topic && (
                <span className="rounded-full bg-[#e4ebe0] px-2.5 py-1 text-[11px] font-medium text-[#4A5E42]">
                  {selectedMessage.topic}
                </span>
              )}

              <span
                className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${sentimentBadgeClass(
                  selectedMessage.sentiment
                )}`}
              >
                {selectedMessage.sentiment ?? "neutral"}
              </span>

              {getEffectiveParentId(selectedMessage) && parentMessage && (
                <span className="rounded-full bg-[#ddeedd] px-2.5 py-1 text-[11px] font-medium text-[#3D6B35]">
                  replying to {parentMessage.author}
                  {isAiOnlyReply(selectedMessage) ? " ★" : ""}
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}