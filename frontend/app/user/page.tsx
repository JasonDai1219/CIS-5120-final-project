"use client";

import { useEffect, useMemo, useState } from "react";
import UserThreadMapView from "../components/UserThreadMapView";

type Message = {
  id: string;
  author: string;
  timestamp: string;
  text: string;
  parentId: string | null;
  topic?: string;
  sentiment?: string;
};

type TimeGranularity = "day" | "week" | "month";

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
    .map((part) => part[0])
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

function formatBucketLabel(bucket: string, granularity: TimeGranularity) {
  if (bucket === "all") return "All";

  if (granularity === "day") {
    const [year, month, day] = bucket.split("-");
    return `${month}/${day}`;
  }

  if (granularity === "week") {
    const [year, month, day] = bucket.split("-");
    return `Week ${month}/${day}`;
  }

  const [year, month] = bucket.split("-");
  return `${month}/${year}`;
}

export default function UserAppPage() {
<<<<<<< Updated upstream
  const [datasetIds, setDatasetIds] = useState<string[]>([]);
  const [selectedDataset, setSelectedDataset] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [viewMode, setViewMode] = useState<"map" | "chat">("map");
  const [timeGranularity, setTimeGranularity] =
    useState<TimeGranularity>("week");
  const [selectedTimeBucket, setSelectedTimeBucket] = useState<string>("all");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [error, setError] = useState("");

  const messagesById = useMemo(() => {
    return Object.fromEntries(messages.map((m) => [m.id, m]));
  }, [messages]);

  const availableTimeBuckets = useMemo(() => {
    const unique = new Set(
      messages.map((msg) => getBucketKey(msg.timestamp, timeGranularity))
=======
    const [datasetIds, setDatasetIds] = useState<string[]>([]);
    const [selectedDataset, setSelectedDataset] = useState("");
    const [messages, setMessages] = useState<Message[]>([]);
    const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
    const [viewMode, setViewMode] = useState<"map" | "chat">("map");
    const [timeFilter, setTimeFilter] = useState<"week1" | "week2" | "all">("week1");
    const [sheetOpen, setSheetOpen] = useState(false);
    const [error, setError] = useState("");
    const [aiMessages, setAiMessages] = useState<Message[]>([]);

    const messagesById = useMemo(() => {
        const source = aiMessages.length > 0 ? aiMessages : messages;
        return Object.fromEntries(source.map((m) => [m.id, m]));
    }, [messages, aiMessages]);

    const filteredMessages = useMemo(() => {
        const source = aiMessages.length > 0 ? aiMessages : messages;
        if (timeFilter === "all") return source;
        if (timeFilter === "week1") {
            return source.filter((m) => m.timestamp.startsWith("2026-03-01"));
        }
        if (timeFilter === "week2") {
            return source.filter((m) => m.timestamp.startsWith("2026-03-08"));
        }
        return source;
    }, [messages, aiMessages, timeFilter]);

    const roots = useMemo(() => {
        return filteredMessages.filter((m) => !m.parentId).length;
    }, [filteredMessages]);

    const depth = useMemo(() => {
        const depthOf = (msg: Message): number => {
            let d = 1;
            let cur = msg;
            while (cur.parentId && messagesById[cur.parentId]) {
                d += 1;
                cur = messagesById[cur.parentId];
            }
            return d;
        };

        return filteredMessages.length ? Math.max(...filteredMessages.map(depthOf)) : 0;
    }, [filteredMessages, messagesById]);

    const sentimentLine = useMemo(() => {
        const value = (sentiment?: string) => {
            switch (sentiment) {
                case "supportive":
                    return 1;
                case "critical":
                    return -1;
                case "mixed":
                    return 0;
                default:
                    return 0;
            }
        };

        const total = filteredMessages.reduce((sum, m) => sum + value(m.sentiment), 0);
        const avg = filteredMessages.length ? total / filteredMessages.length : 0;

        const supportive = filteredMessages.filter((m) => m.sentiment === "supportive").length;
        const neutral = filteredMessages.filter(
            (m) => !m.sentiment || m.sentiment === "neutral" || m.sentiment === "mixed"
        ).length;
        const critical = filteredMessages.filter((m) => m.sentiment === "critical").length;
        const totalCount = supportive + neutral + critical || 1;

        return {
            avg,
            supportivePct: (supportive / totalCount) * 100,
            neutralPct: (neutral / totalCount) * 100,
            criticalPct: (critical / totalCount) * 100,
        };
    }, [filteredMessages]);

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
                const res = await fetch(`/api/discussions/${selectedDataset}/messages`);
                if (!res.ok) throw new Error(`Failed to load messages: ${res.status}`);

                const data = await res.json();
                const msgs = Array.isArray(data.messages) ? data.messages : [];
                setMessages(msgs);

                const initial =
                    msgs.find((m: Message) => m.timestamp.startsWith("2026-03-01")) ??
                    msgs[0] ??
                    null;

                setSelectedMessage(initial);
            } catch (err) {
                setError(err instanceof Error ? err.message : "Failed to load messages");
            }
        }

        loadMessages();
    }, [selectedDataset]);

    useEffect(() => {
        if (!selectedDataset) return;

        async function loadAIMessages() {
            try {
                const res = await fetch(`/api/discussions/${selectedDataset}/messages/annotated`);
                if (!res.ok) return;
                const data = await res.json();
                setAiMessages(Array.isArray(data.messages) ? data.messages : []);
            } catch {
                // silently fail — raw messages are still shown
            }
        }

        loadAIMessages();
    }, [selectedDataset]);

    // When AI analysis completes, refresh selectedMessage with the enriched version
    useEffect(() => {
        if (aiMessages.length > 0 && selectedMessage) {
            const enriched = aiMessages.find((m) => m.id === selectedMessage.id);
            if (enriched) setSelectedMessage(enriched);
        }
    }, [aiMessages]);

    useEffect(() => {
        if (
            selectedMessage &&
            !filteredMessages.some((m) => m.id === selectedMessage.id)
        ) {
            setSelectedMessage(filteredMessages[0] ?? null);
            setSheetOpen(false);
        }
    }, [filteredMessages, selectedMessage]);

    const closeSheet = () => {
        setSheetOpen(false);
        setSelectedMessage(null);
    };

    const openMessage = (msg: Message) => {
        setSelectedMessage(msg);
        setSheetOpen(true);
    };

    const parentMessage = selectedMessage?.parentId
        ? messagesById[selectedMessage.parentId]
        : null;

    return (
        <main className="h-dvh overflow-hidden bg-[#e8ede6]">
            <div className="mx-auto h-dvh w-full max-w-[430px] bg-[#fafaf8] md:shadow-sm">
                <div className="grid h-full grid-rows-[auto_auto_minmax(0,1fr)_auto]">
                    <div className="shrink-0 px-5 pb-0 pt-4">
                        <div className="flex items-center justify-between">
                            <div className="text-[15px] font-semibold tracking-[-0.3px] text-[#2B3A2B]">
                                Thread Map
                            </div>

                            {datasetIds.length > 1 && (
                                <select
                                    value={selectedDataset}
                                    onChange={(e) => setSelectedDataset(e.target.value)}
                                    className="rounded-md border border-[#d4ddd0] bg-white px-2 py-1 text-xs text-[#2B3A2B]"
                                >
                                    {datasetIds.map((id) => (
                                        <option key={id} value={id}>
                                            {id}
                                        </option>
                                    ))}
                                </select>
                            )}
                        </div>
                    </div>

                    <div className="shrink-0 border-b border-[#d4ddd0] px-5 pb-3 pt-3">
                        <div className="mb-2 flex gap-1.5">
                            <button
                                onClick={() => setTimeFilter("week1")}
                                className={`rounded-full border px-3.5 py-1 text-xs font-medium ${timeFilter === "week1"
                                    ? "border-[#3D6B35] bg-[#3D6B35] text-[#f5f8f2]"
                                    : "border-[#A8B89A] bg-transparent text-[#5C7A4E]"
                                    }`}
                            >
                                Week 1
                            </button>
                            <button
                                onClick={() => setTimeFilter("week2")}
                                className={`rounded-full border px-3.5 py-1 text-xs font-medium ${timeFilter === "week2"
                                    ? "border-[#3D6B35] bg-[#3D6B35] text-[#f5f8f2]"
                                    : "border-[#A8B89A] bg-transparent text-[#5C7A4E]"
                                    }`}
                            >
                                Week 2
                            </button>
                            <button
                                onClick={() => setTimeFilter("all")}
                                className={`rounded-full border px-3.5 py-1 text-xs font-medium ${timeFilter === "all"
                                    ? "border-[#3D6B35] bg-[#3D6B35] text-[#f5f8f2]"
                                    : "border-[#A8B89A] bg-transparent text-[#5C7A4E]"
                                    }`}
                            >
                                All
                            </button>
                        </div>

                        <div className="flex rounded-[10px] bg-[#e4ebe0] p-0.5">
                            <button
                                onClick={() => setViewMode("map")}
                                className={`flex-1 rounded-[8px] px-2 py-1 text-xs font-medium ${viewMode === "map"
                                    ? "bg-[#fafaf8] text-[#2B3A2B]"
                                    : "bg-transparent text-[#7A9B6E]"
                                    }`}
                            >
                                Thread Map
                            </button>
                            <button
                                onClick={() => setViewMode("chat")}
                                className={`flex-1 rounded-[8px] px-2 py-1 text-xs font-medium ${viewMode === "chat"
                                    ? "bg-[#fafaf8] text-[#2B3A2B]"
                                    : "bg-transparent text-[#7A9B6E]"
                                    }`}
                            >
                                Chat View
                            </button>
                        </div>
                    </div>

                    <div className="min-h-0 overflow-hidden">
                        {error ? (
                            <div className="p-4 text-sm text-red-700">{error}</div>
                        ) : viewMode === "map" ? (
                            <div className="h-full min-h-0 px-2 py-2">
                                <div className="h-full min-h-[320px]">
                                    <UserThreadMapView
                                        messages={filteredMessages}
                                        selectedMessageId={selectedMessage?.id ?? null}
                                        onSelectMessage={(id) => {
                                            const msg = filteredMessages.find((m) => m.id === id);
                                            if (msg) {
                                                setSelectedMessage(msg);
                                                setSheetOpen(true);
                                            }
                                        }}
                                    />
                                </div>
                            </div>
                        ) : (
                            <div className="h-full overflow-y-auto px-4 py-3">
                                <div className="flex flex-col gap-2 pb-4">
                                    {filteredMessages.map((msg) => {
                                        const parent = msg.parentId ? messagesById[msg.parentId] : null;

                                        return (
                                            <div
                                                key={msg.id}
                                                role="button"
                                                tabIndex={0}
                                                onClick={() => openMessage(msg)}
                                                onKeyDown={(e) => {
                                                    if (e.key === "Enter" || e.key === " ") {
                                                        e.preventDefault();
                                                        openMessage(msg);
                                                    }
                                                }}
                                                className="flex cursor-pointer items-start gap-2 text-left"
                                            >
                                                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#d6e0d2] text-[10px] font-semibold text-[#2B3A2B]">
                                                    {initials(msg.author)}
                                                </div>

                                                <div className="max-w-[260px] rounded-[16px] rounded-bl-[4px] bg-[#eef2eb] px-3 py-2">
                                                    {parent && (
                                                        <button
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                openMessage(parent);
                                                            }}
                                                            className="mb-2 block w-full rounded-[10px] bg-[#dfe8d8] px-2.5 py-2 text-left"
                                                        >
                                                            <div className="text-[10px] font-medium text-[#5C7A4E]">
                                                                Replying to {parent.author}
                                                            </div>
                                                            <div className="truncate text-[10px] text-[#7c8f70]">
                                                                {parent.text}
                                                            </div>
                                                        </button>
                                                    )}

                                                    <div className="mb-1 text-[11px] font-semibold text-[#3D6B35]">
                                                        {msg.author}
                                                    </div>

                                                    <div className="text-[13px] leading-[1.45] text-[#2B3A2B]">
                                                        {msg.text}
                                                    </div>

                                                    <div className="mt-1.5 flex items-center gap-1.5">
                                                        <span className="text-[10px] text-[#8BA07A]">
                                                            {new Date(msg.timestamp).toLocaleTimeString([], {
                                                                hour: "2-digit",
                                                                minute: "2-digit",
                                                            })}
                                                        </span>

                                                        <span
                                                            className={`rounded-full px-1.5 py-0.5 text-[9px] font-medium ${sentimentBadgeClass(
                                                                msg.sentiment
                                                            )}`}
                                                        >
                                                            {msg.sentiment ?? "neutral"}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="shrink-0 border-t border-[#d4ddd0] px-4 pb-[calc(env(safe-area-inset-bottom)+8px)] pt-2">
                        <div className="mb-2 flex gap-2">
                            <div className="flex-1 rounded-[10px] bg-[#e4ebe0] px-2 py-1.5">
                                <div className="text-base font-semibold text-[#2B3A2B]">
                                    {filteredMessages.length}
                                </div>
                                <div className="text-[9px] uppercase tracking-[.04em] text-[#8BA07A]">
                                    messages
                                </div>
                            </div>

                            <div className="flex-1 rounded-[10px] bg-[#e4ebe0] px-2 py-1.5">
                                <div className="text-base font-semibold text-[#2B3A2B]">{roots}</div>
                                <div className="text-[9px] uppercase tracking-[.04em] text-[#8BA07A]">
                                    threads
                                </div>
                            </div>

                            <div className="flex-1 rounded-[10px] bg-[#e4ebe0] px-2 py-1.5">
                                <div className="text-base font-semibold text-[#2B3A2B]">{depth}</div>
                                <div className="text-[9px] uppercase tracking-[.04em] text-[#8BA07A]">
                                    depth
                                </div>
                            </div>
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

                <div
                    className={`fixed bottom-0 left-0 right-0 z-30 mx-auto w-full max-w-[430px] rounded-t-[20px] border-t border-[#d4ddd0] bg-[#fafaf8] px-4 pb-[calc(env(safe-area-inset-bottom)+20px)] pt-4 shadow-[0_-8px_24px_rgba(0,0,0,0.08)] transition-transform duration-300 ${sheetOpen ? "translate-y-0" : "translate-y-full"
                        }`}
                    onClick={(e) => {
                        if (e.target === e.currentTarget) closeSheet();
                    }}
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

                    {selectedMessage && (
                        <>
                            <div className="mb-3 flex items-center gap-2.5">
                                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#d6e0d2] text-xs font-semibold text-[#2B3A2B]">
                                    {initials(selectedMessage.author)}
                                </div>

                                <div>
                                    <div className="text-[15px] font-semibold text-[#2B3A2B]">
                                        {selectedMessage.author}
                                    </div>
                                    <div className="text-[11px] text-[#8BA07A]">
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

                                {selectedMessage.parentId && parentMessage && (
                                    <span className="rounded-full bg-[#ddeedd] px-2.5 py-1 text-[11px] font-medium text-[#3D6B35]">
                                        replying to {parentMessage.author}
                                    </span>
                                )}
                            </div>
                        </>
                    )}
                </div>
            </div>
        </main>
>>>>>>> Stashed changes
    );

    return ["all", ...Array.from(unique).sort()];
  }, [messages, timeGranularity]);

  const filteredMessages = useMemo(() => {
    if (selectedTimeBucket === "all") return messages;

    return messages.filter(
      (msg) => getBucketKey(msg.timestamp, timeGranularity) === selectedTimeBucket
    );
  }, [messages, selectedTimeBucket, timeGranularity]);

  const roots = useMemo(() => {
    return filteredMessages.filter((m) => !m.parentId).length;
  }, [filteredMessages]);

  const depth = useMemo(() => {
    const depthOf = (msg: Message): number => {
      let d = 1;
      let cur = msg;
      while (cur.parentId && messagesById[cur.parentId]) {
        d += 1;
        cur = messagesById[cur.parentId];
      }
      return d;
    };

    return filteredMessages.length ? Math.max(...filteredMessages.map(depthOf)) : 0;
  }, [filteredMessages, messagesById]);

  const sentimentLine = useMemo(() => {
    const value = (sentiment?: string) => {
      switch (sentiment) {
        case "supportive":
          return 1;
        case "critical":
          return -1;
        case "mixed":
          return 0;
        default:
          return 0;
      }
    };

    const total = filteredMessages.reduce((sum, m) => sum + value(m.sentiment), 0);
    const avg = filteredMessages.length ? total / filteredMessages.length : 0;

    const supportive = filteredMessages.filter((m) => m.sentiment === "supportive").length;
    const neutral = filteredMessages.filter(
      (m) => !m.sentiment || m.sentiment === "neutral" || m.sentiment === "mixed"
    ).length;
    const critical = filteredMessages.filter((m) => m.sentiment === "critical").length;
    const totalCount = supportive + neutral + critical || 1;

    return {
      avg,
      supportivePct: (supportive / totalCount) * 100,
      neutralPct: (neutral / totalCount) * 100,
      criticalPct: (critical / totalCount) * 100,
    };
  }, [filteredMessages]);

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
        const res = await fetch(`/api/discussions/${selectedDataset}/messages`);
        if (!res.ok) throw new Error(`Failed to load messages: ${res.status}`);

        const data = await res.json();
        const msgs = Array.isArray(data.messages) ? data.messages : [];
        setMessages(msgs);
        setSelectedTimeBucket("all");

        const initial = msgs[0] ?? null;
        setSelectedMessage(initial);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load messages");
      }
    }

    loadMessages();
  }, [selectedDataset]);

  useEffect(() => {
    setSelectedTimeBucket("all");
  }, [timeGranularity]);

  useEffect(() => {
    if (
      selectedTimeBucket !== "all" &&
      !availableTimeBuckets.includes(selectedTimeBucket)
    ) {
      setSelectedTimeBucket("all");
    }
  }, [availableTimeBuckets, selectedTimeBucket]);

  useEffect(() => {
    if (
      selectedMessage &&
      !filteredMessages.some((m) => m.id === selectedMessage.id)
    ) {
      setSelectedMessage(filteredMessages[0] ?? null);
      setSheetOpen(false);
    }
  }, [filteredMessages, selectedMessage]);

  const closeSheet = () => {
    setSheetOpen(false);
    setSelectedMessage(null);
  };

  const openMessage = (msg: Message) => {
    setSelectedMessage(msg);
    setSheetOpen(true);
  };

  const parentMessage = selectedMessage?.parentId
    ? messagesById[selectedMessage.parentId]
    : null;

  return (
    <main className="h-dvh overflow-hidden bg-[#e8ede6]">
      <div className="mx-auto h-dvh w-full max-w-[430px] bg-[#fafaf8] md:shadow-sm">
        <div className="grid h-full grid-rows-[auto_auto_minmax(0,1fr)_auto]">
          <div className="shrink-0 px-5 pb-0 pt-4">
            <div className="flex items-center justify-between">
              <div className="text-[15px] font-semibold tracking-[-0.3px] text-[#2B3A2B]">
                Thread Map
              </div>

              {datasetIds.length > 1 && (
                <div className="relative">
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

                    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-[#5C7A4E]">
                    ▼
                    </span>
                </div>
                )}
            </div>
          </div>

          <div className="shrink-0 border-b border-[#d4ddd0] px-5 pb-3 pt-3">
            <div className="mb-2 flex items-center gap-2">
            <label className="text-[11px] font-medium text-[#5C7A4E]">
                Group by
            </label>

            <div className="relative">
                <select
                value={timeGranularity}
                onChange={(e) => setTimeGranularity(e.target.value as TimeGranularity)}
                className="appearance-none rounded-full border border-[#A8B89A] bg-[#eef2eb] px-3 py-1 pr-8 text-xs font-medium text-[#2B3A2B] outline-none"
                >
                <option value="day">Daily</option>
                <option value="week">Weekly</option>
                <option value="month">Monthly</option>
                </select>

                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-[#5C7A4E]">
                ▼
                </span>
            </div>
            </div>

            <div className="mb-2 overflow-x-auto">
              <div className="flex min-w-max gap-1.5 pr-2">
                {availableTimeBuckets.map((bucket) => (
                  <button
                    key={bucket}
                    onClick={() => setSelectedTimeBucket(bucket)}
                    className={`rounded-full border px-3.5 py-1 text-xs font-medium whitespace-nowrap ${
                      selectedTimeBucket === bucket
                        ? "border-[#3D6B35] bg-[#3D6B35] text-[#f5f8f2]"
                        : "border-[#A8B89A] bg-transparent text-[#5C7A4E]"
                    }`}
                  >
                    {formatBucketLabel(bucket, timeGranularity)}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex rounded-[10px] bg-[#e4ebe0] p-0.5">
              <button
                onClick={() => setViewMode("map")}
                className={`flex-1 rounded-[8px] px-2 py-1 text-xs font-medium ${
                  viewMode === "map"
                    ? "bg-[#fafaf8] text-[#2B3A2B]"
                    : "bg-transparent text-[#7A9B6E]"
                }`}
              >
                Thread Map
              </button>
              <button
                onClick={() => setViewMode("chat")}
                className={`flex-1 rounded-[8px] px-2 py-1 text-xs font-medium ${
                  viewMode === "chat"
                    ? "bg-[#fafaf8] text-[#2B3A2B]"
                    : "bg-transparent text-[#7A9B6E]"
                }`}
              >
                Chat View
              </button>
            </div>
          </div>

          <div className="min-h-0 overflow-hidden">
            {error ? (
              <div className="p-4 text-sm text-red-700">{error}</div>
            ) : viewMode === "map" ? (
              <div className="h-full min-h-0 px-2 py-2">
                <div className="h-full min-h-[320px]">
                  <UserThreadMapView
                    messages={filteredMessages}
                    selectedMessageId={selectedMessage?.id ?? null}
                    onSelectMessage={(id) => {
                      const msg = filteredMessages.find((m) => m.id === id);
                      if (msg) {
                        setSelectedMessage(msg);
                        setSheetOpen(true);
                      }
                    }}
                  />
                </div>
              </div>
            ) : (
              <div className="h-full overflow-y-auto px-4 py-3">
                <div className="flex flex-col gap-2 pb-4">
                  {filteredMessages.map((msg) => {
                    const parent = msg.parentId ? messagesById[msg.parentId] : null;

                    return (
                      <div
                        key={msg.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => openMessage(msg)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            openMessage(msg);
                          }
                        }}
                        className="flex cursor-pointer items-start gap-2 text-left"
                      >
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#d6e0d2] text-[10px] font-semibold text-[#2B3A2B]">
                          {initials(msg.author)}
                        </div>

                        <div className="max-w-[260px] rounded-[16px] rounded-bl-[4px] bg-[#eef2eb] px-3 py-2">
                          {parent && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                openMessage(parent);
                              }}
                              className="mb-2 block w-full rounded-[10px] bg-[#dfe8d8] px-2.5 py-2 text-left"
                            >
                              <div className="text-[10px] font-medium text-[#5C7A4E]">
                                Replying to {parent.author}
                              </div>
                              <div className="truncate text-[10px] text-[#7c8f70]">
                                {parent.text}
                              </div>
                            </button>
                          )}

                          <div className="mb-1 text-[11px] font-semibold text-[#3D6B35]">
                            {msg.author}
                          </div>

                          <div className="text-[13px] leading-[1.45] text-[#2B3A2B]">
                            {msg.text}
                          </div>

                          <div className="mt-1.5 flex items-center gap-1.5">
                            <span className="text-[10px] text-[#8BA07A]">
                              {new Date(msg.timestamp).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>

                            <span
                              className={`rounded-full px-1.5 py-0.5 text-[9px] font-medium ${sentimentBadgeClass(
                                msg.sentiment
                              )}`}
                            >
                              {msg.sentiment ?? "neutral"}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <div className="shrink-0 border-t border-[#d4ddd0] px-4 pb-[calc(env(safe-area-inset-bottom)+8px)] pt-2">
            <div className="mb-2 flex gap-2">
              <div className="flex-1 rounded-[10px] bg-[#e4ebe0] px-2 py-1.5">
                <div className="text-base font-semibold text-[#2B3A2B]">
                  {filteredMessages.length}
                </div>
                <div className="text-[9px] uppercase tracking-[.04em] text-[#8BA07A]">
                  messages
                </div>
              </div>

              <div className="flex-1 rounded-[10px] bg-[#e4ebe0] px-2 py-1.5">
                <div className="text-base font-semibold text-[#2B3A2B]">{roots}</div>
                <div className="text-[9px] uppercase tracking-[.04em] text-[#8BA07A]">
                  threads
                </div>
              </div>

              <div className="flex-1 rounded-[10px] bg-[#e4ebe0] px-2 py-1.5">
                <div className="text-base font-semibold text-[#2B3A2B]">{depth}</div>
                <div className="text-[9px] uppercase tracking-[.04em] text-[#8BA07A]">
                  depth
                </div>
              </div>
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

        <div
          className={`fixed bottom-0 left-0 right-0 z-30 mx-auto w-full max-w-[430px] rounded-t-[20px] border-t border-[#d4ddd0] bg-[#fafaf8] px-4 pb-[calc(env(safe-area-inset-bottom)+20px)] pt-4 shadow-[0_-8px_24px_rgba(0,0,0,0.08)] transition-transform duration-300 ${
            sheetOpen ? "translate-y-0" : "translate-y-full"
          }`}
          onClick={(e) => {
            if (e.target === e.currentTarget) closeSheet();
          }}
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

          {selectedMessage && (
            <>
              <div className="mb-3 flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#d6e0d2] text-xs font-semibold text-[#2B3A2B]">
                  {initials(selectedMessage.author)}
                </div>

                <div>
                  <div className="text-[15px] font-semibold text-[#2B3A2B]">
                    {selectedMessage.author}
                  </div>
                  <div className="text-[11px] text-[#8BA07A]">
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

                {selectedMessage.parentId && parentMessage && (
                  <span className="rounded-full bg-[#ddeedd] px-2.5 py-1 text-[11px] font-medium text-[#3D6B35]">
                    replying to {parentMessage.author}
                  </span>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </main>
  );
}