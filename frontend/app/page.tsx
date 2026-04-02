"use client";

import { useEffect, useMemo, useState } from "react";
import ThreadMapView from "./components/ThreadMapView";
import TopicMapView from "./components/TopicMapView";
import SentimentOverTime from "./components/SentimentOverTime";
import SentimentTrendLine from "./components/SentimentTrendLine";


type Message = {
  id: string;
  author: string;
  timestamp: string;
  text: string;
  parentId: string | null;
  topic?: string;
  sentiment?: string;
};

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

export default function Home() {
  const [datasetIds, setDatasetIds] = useState<string[]>([]);
  const [selectedDataset, setSelectedDataset] = useState<string>("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [viewMode, setViewMode] = useState<"chat" | "graph">("chat");
  const [graphMode, setGraphMode] = useState<"message" | "topic">("message");
  const [timeFilter, setTimeFilter] = useState<"all" | "week1" | "week2">("all");

  const messagesById = useMemo(() => {
    return Object.fromEntries(messages.map((msg) => [msg.id, msg]));
  }, [messages]);

  const parentMessage = selectedMessage?.parentId
    ? messagesById[selectedMessage.parentId]
    : null;

  const filteredMessages = useMemo(() => {
    if (timeFilter === "all") return messages;
    if (timeFilter === "week1") {
      return messages.filter((msg) => msg.timestamp.startsWith("2026-03-01"));
    }
    if (timeFilter === "week2") {
      return messages.filter((msg) => msg.timestamp.startsWith("2026-03-08"));
    }
    return messages;
  }, [messages, timeFilter]);

  const sentimentCounts = useMemo(() => {
    return filteredMessages.reduce(
      (acc, msg) => {
        const key = msg.sentiment ?? "neutral";
        acc[key] = (acc[key] ?? 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );
  }, [filteredMessages]);

  const sentimentOverTime = useMemo(() => {
    const buckets: Record<
      string,
      { supportive: number; critical: number; neutral: number; mixed: number }
    > = {};

    messages.forEach((msg) => {
      const dateKey = msg.timestamp.slice(0, 10);

      if (!buckets[dateKey]) {
        buckets[dateKey] = {
          supportive: 0,
          critical: 0,
          neutral: 0,
          mixed: 0,
        };
      }

      const sentiment = msg.sentiment ?? "neutral";
      if (sentiment in buckets[dateKey]) {
        buckets[dateKey][sentiment as keyof (typeof buckets)[string]] += 1;
      }
    });

    return Object.entries(buckets)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, counts]) => ({
        date,
        ...counts,
      }));
  }, [messages]);

  const messagesByTopic = useMemo(() => {
    return filteredMessages.reduce<Record<string, Message[]>>((acc, msg) => {
      const topic = msg.topic ?? "untagged";
      if (!acc[topic]) acc[topic] = [];
      acc[topic].push(msg);
      return acc;
    }, {});
  }, [filteredMessages]);

  const topicSummary = useMemo(() => {
    return Object.entries(messagesByTopic).map(([topic, msgs]) => ({
      topic,
      count: msgs.length,
      sentiments: msgs.reduce(
        (acc, msg) => {
          const s = msg.sentiment ?? "neutral";
          acc[s] = (acc[s] ?? 0) + 1;
          return acc;
        },
        {} as Record<string, number>
      ),
    }));
  }, [messagesByTopic]);

  const topicFilteredMessages = useMemo(() => {
    if (!selectedTopic) return filteredMessages;
    return filteredMessages.filter((msg) => msg.topic === selectedTopic);
  }, [filteredMessages, selectedTopic]);

  const topicGraphData = useMemo(() => {
    const topicMap: Record<
      string,
      {
        topic: string;
        count: number;
        sentiments: Record<string, number>;
      }
    > = {};

    const edgeWeights: Record<string, number> = {};

    filteredMessages.forEach((msg) => {
      const topic = msg.topic ?? "untagged";

      if (!topicMap[topic]) {
        topicMap[topic] = {
          topic,
          count: 0,
          sentiments: {},
        };
      }

      topicMap[topic].count += 1;

      const sentiment = msg.sentiment ?? "neutral";
      topicMap[topic].sentiments[sentiment] =
        (topicMap[topic].sentiments[sentiment] ?? 0) + 1;
    });

    filteredMessages.forEach((msg) => {
      if (!msg.parentId) return;

      const parent = messagesById[msg.parentId];
      if (!parent) return;

      const sourceTopic = parent.topic ?? "untagged";
      const targetTopic = msg.topic ?? "untagged";

      if (sourceTopic === targetTopic) return;

      const edgeKey = `${sourceTopic}->${targetTopic}`;
      edgeWeights[edgeKey] = (edgeWeights[edgeKey] ?? 0) + 1;
    });

    const topics = Object.values(topicMap);

    const edges = Object.entries(edgeWeights).map(([key, weight]) => {
      const [source, target] = key.split("->");
      return { source, target, weight };
    });

    return { topics, edges };
  }, [filteredMessages, messagesById]);

  const sentimentLineData = useMemo(() => {
    const buckets: Record<
      string,
      { totalScore: number; count: number }
    > = {};

    const sentimentValue = (sentiment?: string) => {
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

    topicFilteredMessages.forEach((msg) => {
      const dateKey = msg.timestamp.slice(0, 10);

      if (!buckets[dateKey]) {
        buckets[dateKey] = { totalScore: 0, count: 0 };
      }

      buckets[dateKey].totalScore += sentimentValue(msg.sentiment);
      buckets[dateKey].count += 1;
    });

    return Object.entries(buckets)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, value]) => ({
        date,
        score: value.count > 0 ? value.totalScore / value.count : 0,
        count: value.count,
      }));
  }, [topicFilteredMessages]);

  useEffect(() => {
    async function loadDatasets() {
      try {
        setError("");
        const res = await fetch("http://localhost:8000/datasets");
        if (!res.ok) throw new Error(`Failed to load datasets: ${res.status}`);

        const data = await res.json();
        const ids = Array.isArray(data.datasets) ? data.datasets : [];
        setDatasetIds(ids);

        if (ids.length > 0) {
          setSelectedDataset(ids[0]);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Load failed");
      }
    }

    loadDatasets();
  }, []);

  useEffect(() => {
    if (!selectedDataset) return;

    async function loadMessages() {
      try {
        setLoading(true);
        setError("");

        const res = await fetch(
          `http://localhost:8000/discussions/${selectedDataset}/messages`
        );
        if (!res.ok) throw new Error(`Failed to load messages: ${res.status}`);

        const data = await res.json();
        const msgs = Array.isArray(data.messages) ? data.messages : [];
        setMessages(msgs);
        setSelectedMessage(msgs[0] ?? null);
        setSelectedTopic(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Load failed");
      } finally {
        setLoading(false);
      }
    }

    loadMessages();
  }, [selectedDataset]);

  useEffect(() => {
    if (
      selectedMessage &&
      !topicFilteredMessages.some((msg) => msg.id === selectedMessage.id)
    ) {
      setSelectedMessage(topicFilteredMessages[0] ?? null);
    }
  }, [topicFilteredMessages, selectedMessage]);

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <h1 className="mb-2 text-3xl font-bold">Visualizing Online Discussion Thread</h1>
      <p className="mb-6 text-gray-600">
        Logic-first prototype: filtering, message graph, topic graph, sentiment aggregation,
        and topic grouping.
      </p>

      {error && (
        <div className="mb-4 rounded-lg border border-red-300 bg-red-50 p-3 text-red-700">
          {error}
        </div>
      )}

      <div className="mb-6 flex flex-wrap gap-3">
        <button
          onClick={() => setViewMode("chat")}
          className={`rounded px-4 py-2 ${
            viewMode === "chat" ? "bg-black text-white" : "bg-gray-200"
          }`}
        >
          Chat View
        </button>
        <button
          onClick={() => setViewMode("graph")}
          className={`rounded px-4 py-2 ${
            viewMode === "graph" ? "bg-black text-white" : "bg-gray-200"
          }`}
        >
          Graph View
        </button>
      </div>

      <div className="mb-6 flex flex-wrap gap-3">
        <button
          onClick={() => setTimeFilter("all")}
          className={`rounded px-4 py-2 ${
            timeFilter === "all" ? "bg-blue-600 text-white" : "bg-gray-200"
          }`}
        >
          All
        </button>
        <button
          onClick={() => setTimeFilter("week1")}
          className={`rounded px-4 py-2 ${
            timeFilter === "week1" ? "bg-blue-600 text-white" : "bg-gray-200"
          }`}
        >
          Week 1
        </button>
        <button
          onClick={() => setTimeFilter("week2")}
          className={`rounded px-4 py-2 ${
            timeFilter === "week2" ? "bg-blue-600 text-white" : "bg-gray-200"
          }`}
        >
          Week 2
        </button>
      </div>

      {viewMode === "graph" && (
        <div className="mb-6 flex flex-wrap gap-3">
          <button
            onClick={() => setGraphMode("message")}
            className={`rounded px-4 py-2 ${
              graphMode === "message" ? "bg-purple-600 text-white" : "bg-gray-200"
            }`}
          >
            Message Graph
          </button>
          <button
            onClick={() => setGraphMode("topic")}
            className={`rounded px-4 py-2 ${
              graphMode === "topic" ? "bg-purple-600 text-white" : "bg-gray-200"
            }`}
          >
            Topic Graph
          </button>
        </div>
      )}

      <div className="mb-6">
        <label className="mb-2 block text-sm font-medium">Dataset</label>
        <select
          className="rounded border bg-white px-3 py-2"
          value={selectedDataset}
          onChange={(e) => setSelectedDataset(e.target.value)}
        >
          {datasetIds.map((id) => (
            <option key={id} value={id}>
              {id}
            </option>
          ))}
        </select>
      </div>

      <div className="mb-6 grid grid-cols-3 gap-4">
        <div className="rounded-xl bg-white p-4 shadow">
          <div className="text-sm text-gray-500">Datasets</div>
          <div className="text-2xl font-semibold">{datasetIds.length}</div>
        </div>
        <div className="rounded-xl bg-white p-4 shadow">
          <div className="text-sm text-gray-500">Messages</div>
          <div className="text-2xl font-semibold">{topicFilteredMessages.length}</div>
        </div>
        <div className="rounded-xl bg-white p-4 shadow">
          <div className="text-sm text-gray-500">Selected</div>
          <div className="text-2xl font-semibold">
            {selectedMessage ? selectedMessage.id : "None"}
          </div>
        </div>
      </div>

      <div className="mb-6 rounded-xl bg-white p-4 shadow">
        <h2 className="mb-3 text-lg font-semibold">Sentiment Summary</h2>
        <div className="flex flex-wrap gap-3 text-sm">
          <span className="rounded bg-green-100 px-3 py-1 text-green-800">
            Supportive: {sentimentCounts.supportive ?? 0}
          </span>
          <span className="rounded bg-red-100 px-3 py-1 text-red-800">
            Critical: {sentimentCounts.critical ?? 0}
          </span>
          <span className="rounded bg-gray-100 px-3 py-1 text-gray-700">
            Neutral: {sentimentCounts.neutral ?? 0}
          </span>
          <span className="rounded bg-yellow-100 px-3 py-1 text-yellow-800">
            Mixed: {sentimentCounts.mixed ?? 0}
          </span>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-6">
        <SentimentTrendLine data={sentimentLineData} />

        <section className="rounded-xl bg-white p-4 shadow">
          <h2 className="mb-3 text-lg font-semibold">Topic Summary</h2>

          <div className="mb-3">
            <button
              onClick={() => setSelectedTopic(null)}
              className={`rounded px-3 py-2 text-sm ${
                selectedTopic === null ? "bg-black text-white" : "bg-gray-200"
              }`}
            >
              All Topics
            </button>
          </div>

          <div className="space-y-3">
            {topicSummary.map((topic) => (
              <button
                key={topic.topic}
                onClick={() => setSelectedTopic(topic.topic)}
                className={`block w-full rounded-lg border p-3 text-left ${
                  selectedTopic === topic.topic
                    ? "border-blue-500 bg-blue-50"
                    : "border-gray-200 bg-white"
                }`}
              >
                <div className="font-medium">{topic.topic}</div>
                <div className="mt-1 text-sm text-gray-600">
                  Messages: {topic.count}
                </div>
                <div className="mt-2 flex flex-wrap gap-2 text-xs">
                  <span className="rounded bg-green-100 px-2 py-1 text-green-800">
                    Supportive: {topic.sentiments.supportive ?? 0}
                  </span>
                  <span className="rounded bg-red-100 px-2 py-1 text-red-800">
                    Critical: {topic.sentiments.critical ?? 0}
                  </span>
                  <span className="rounded bg-gray-100 px-2 py-1 text-gray-700">
                    Neutral: {topic.sentiments.neutral ?? 0}
                  </span>
                  <span className="rounded bg-yellow-100 px-2 py-1 text-yellow-800">
                    Mixed: {topic.sentiments.mixed ?? 0}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </section>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {viewMode === "chat" ? (
          <section className="rounded-xl bg-white p-4 shadow">
            <h2 className="mb-4 text-xl font-semibold">Message List</h2>

            {loading ? (
              <p>Loading...</p>
            ) : (
              <div className="space-y-3">
                {topicFilteredMessages.map((msg) => (
                  <button
                    key={msg.id}
                    onClick={() => setSelectedMessage(msg)}
                    className={`block w-full rounded-lg border p-3 text-left transition ${
                      selectedMessage?.id === msg.id
                        ? "border-blue-500 bg-blue-50"
                        : "border-gray-200 bg-white hover:bg-gray-50"
                    }`}
                  >
                    <div className="mb-1 flex items-center justify-between">
                      <span className="font-medium">{msg.author}</span>
                      <span className="text-xs text-gray-500">{msg.timestamp}</span>
                    </div>
                    <div className="mb-2 text-sm text-gray-700">{msg.text}</div>
                    <div className="flex flex-wrap gap-2 text-xs">
                      <span className="rounded bg-gray-100 px-2 py-1">id: {msg.id}</span>
                      <span className="rounded bg-gray-100 px-2 py-1">
                        parent: {msg.parentId ?? "root"}
                      </span>
                      {msg.topic && (
                        <span className="rounded bg-blue-100 px-2 py-1 text-blue-800">
                          topic: {msg.topic}
                        </span>
                      )}
                      {msg.sentiment && (
                        <span
                          className={`rounded px-2 py-1 ${sentimentBadgeClass(
                            msg.sentiment
                          )}`}
                        >
                          sentiment: {msg.sentiment}
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </section>
        ) : (
          <section className="rounded-xl bg-white p-4 shadow">
            <h2 className="mb-4 text-xl font-semibold">
              {graphMode === "message" ? "Thread Map" : "Topic Graph"}
            </h2>

            {graphMode === "message" ? (
              <ThreadMapView
                messages={topicFilteredMessages}
                selectedMessageId={selectedMessage?.id ?? null}
                onSelectMessage={(id) => {
                  const msg = topicFilteredMessages.find((m) => m.id === id);
                  if (msg) setSelectedMessage(msg);
                }}
              />
            ) : (
              <TopicMapView
                graph={topicGraphData}
                selectedTopic={selectedTopic}
                onSelectTopic={(topic) => setSelectedTopic(topic)}
              />
            )}
          </section>
        )}

        <section className="rounded-xl bg-white p-4 shadow">
          <h2 className="mb-4 text-xl font-semibold">Detail Panel</h2>

          {selectedMessage ? (
            <div className="space-y-3">
              <div>
                <div className="text-sm text-gray-500">Author</div>
                <div className="font-medium">{selectedMessage.author}</div>
              </div>

              <div>
                <div className="text-sm text-gray-500">Timestamp</div>
                <div>{selectedMessage.timestamp}</div>
              </div>

              <div>
                <div className="text-sm text-gray-500">Message</div>
                <div className="rounded-lg bg-gray-50 p-3">{selectedMessage.text}</div>
              </div>

              <div>
                <div className="text-sm text-gray-500">Topic / Sentiment</div>
                <div className="flex flex-wrap gap-2">
                  {selectedMessage.topic && (
                    <span className="rounded bg-blue-100 px-2 py-1 text-blue-800">
                      {selectedMessage.topic}
                    </span>
                  )}
                  <span
                    className={`rounded px-2 py-1 ${sentimentBadgeClass(
                      selectedMessage.sentiment
                    )}`}
                  >
                    {selectedMessage.sentiment ?? "neutral"}
                  </span>
                </div>
              </div>

              <div>
                <div className="text-sm text-gray-500">Reply Context</div>

                {!selectedMessage.parentId ? (
                  <div>No parent (root message)</div>
                ) : parentMessage ? (
                  <div className="rounded-lg border bg-gray-50 p-3">
                    <div className="mb-1 text-sm font-medium">{parentMessage.author}</div>
                    <div className="mb-1 text-sm text-gray-700">{parentMessage.text}</div>
                    <div className="text-xs text-gray-500">
                      {parentMessage.timestamp} · id: {parentMessage.id}
                    </div>
                  </div>
                ) : (
                  <div className="rounded-lg border border-yellow-300 bg-yellow-50 p-3 text-yellow-800">
                    Parent message not found. Parent ID: {selectedMessage.parentId}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <p>No message selected.</p>
          )}
        </section>
      </div>
    </main>
  );
}