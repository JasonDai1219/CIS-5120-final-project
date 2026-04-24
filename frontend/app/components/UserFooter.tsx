"use client";

import { useState, useRef, useEffect } from "react";

type SentimentStats = {
  avg: number;
  supportivePct: number;
  neutralPct: number;
  criticalPct: number;
};

type AISummary = {
  root_id: string;
  main_topic: string;
  summary: string;
  key_points: string[];
};

type Props = {
  messageCount: number;
  roots: number;
  depth: number;
  sentimentStats: SentimentStats;
  aiSummaries?: AISummary[];
  loadingAI?: boolean;
};

export default function UserFooter({
  messageCount,
  roots,
  depth,
  sentimentStats,
  aiSummaries = [],
  loadingAI = false,
}: Props) {
  const [isExpanded, setIsExpanded] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  // Determine bar color based on average sentiment score (0-1 range)
  let barColor = "#4A9B4A"; // Green for < 1/3 (< 0.34)
  if (sentimentStats.avg >= 0.34 && sentimentStats.avg < 0.67) barColor = "#eab308"; // Yellow
  else if (sentimentStats.avg >= 0.67) barColor = "#C93030"; // Red

  const toggleExpand = () => {
    setIsExpanded(!isExpanded);
  };

  // Reset scroll position when expanding/collapsing
  useEffect(() => {
    if (contentRef.current) {
      contentRef.current.scrollTop = 0;
    }
  }, [isExpanded]);

  return (
    <>
      {/* Backdrop - show when expanded */}
      {isExpanded && (
        <div
          className="fixed inset-0 z-30 bg-black/20 transition-opacity duration-300"
          onClick={toggleExpand}
        />
      )}

      {/* Bottom Sheet */}
      <div
        className={`fixed bottom-0 left-0 right-0 z-40 w-full bg-[#fafaf8] shadow-lg transition-all duration-300 ease-out ${
          isExpanded ? "h-[90vh]" : "h-auto"
        }`}
        suppressHydrationWarning
      >
        {/* Handle bar - Click to expand/collapse */}
        <div
          onClick={toggleExpand}
          className="flex justify-center py-3 border-b border-[#d4ddd0] bg-[#fafaf8] select-none hover:bg-[#f0f0ee] cursor-pointer transition-colors"
          style={{ userSelect: "none" }}
        >
          <style>{`
            @keyframes pulse-color {
              0%, 100% {
                background-color: #8BA07A;
                box-shadow: 0 0 0 0 rgba(139, 160, 122, 0.4);
              }
              50% {
                background-color: #6ba862;
                box-shadow: 0 0 8px 2px rgba(107, 168, 98, 0.6);
              }
            }
            .handle-bar {
              animation: pulse-color 1.5s ease-in-out infinite;
            }
          `}</style>
          <div className="handle-bar h-1 w-12 rounded-full" />
        </div>

        {/* Content */}
        <div
          ref={contentRef}
          className="px-8 py-8 overflow-y-auto"
          style={{
            height: isExpanded ? "calc(90vh - 56px)" : "auto",
            maxHeight: isExpanded ? "calc(90vh - 56px)" : "none",
          }}
        >
          {/* Collapsed view - always visible */}
          {!isExpanded && (
            <div className="space-y-6 max-w-none">
              {/* Sentiment Bar */}
              <div className="flex items-center gap-4 w-full">
                <span className="whitespace-nowrap text-xs font-medium uppercase tracking-wider text-[#8BA07A] flex-shrink-0">
                  Sentiment
                </span>
                <div className="h-4 flex-1 overflow-hidden rounded-full bg-gray-300">
                  <div
                    className="h-full"
                    style={{
                      width: `${sentimentStats.avg * 100}%`,
                      backgroundColor: barColor,
                    }}
                  />
                </div>
                <span className="whitespace-nowrap text-sm font-bold text-[#2B3A2B] flex-shrink-0 min-w-fit">
                  {sentimentStats.avg.toFixed(2)}
                </span>
              </div>

              {/* Quick stats - spread out horizontally */}
              <div className="grid grid-cols-3 gap-6 w-full">
                {[
                  { value: messageCount, label: "messages" },
                  { value: roots, label: "threads" },
                  { value: depth, label: "depth" },
                ].map(({ value, label }) => (
                  <div key={label} className="rounded-xl bg-[#e4ebe0] px-6 py-6 text-center flex-1">
                    <div className="text-2xl font-bold text-[#2B3A2B]">{value}</div>
                    <div className="text-sm uppercase tracking-wider text-[#8BA07A] mt-2">{label}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Expanded view */}
          {isExpanded && (
            <div className="space-y-8 max-w-none">
              <h2 className="text-3xl font-bold text-[#2B3A2B]">Summary</h2>

              {/* Stats grid */}
              <div className="grid grid-cols-3 gap-6">
                {[
                  { value: messageCount, label: "messages" },
                  { value: roots, label: "threads" },
                  { value: depth, label: "depth" },
                ].map(({ value, label }) => (
                  <div key={label} className="rounded-2xl bg-[#e4ebe0] px-8 py-8 text-center">
                    <div className="text-4xl font-bold text-[#2B3A2B]">{value}</div>
                    <div className="text-sm uppercase tracking-wider text-[#8BA07A] mt-3">{label}</div>
                  </div>
                ))}
              </div>

              {/* Sentiment overview */}
              <div className="space-y-3">
                <h3 className="text-lg font-semibold text-[#2B3A2B]">Sentiment Score</h3>
                <div className="flex items-center gap-4">
                  <div className="h-4 flex-1 overflow-hidden rounded-full bg-gray-300">
                    <div
                      className="h-full"
                      style={{
                        width: `${sentimentStats.avg * 100}%`,
                        backgroundColor: barColor,
                      }}
                    />
                  </div>
                  <span className="text-lg font-bold text-[#2B3A2B] min-w-fit">{sentimentStats.avg.toFixed(2)}</span>
                </div>
              </div>

              {/* Sentiment detail */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-[#2B3A2B]">Distribution</h3>
                <div className="space-y-2">
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-[#4A9B4A] font-medium">🟢 Supportive</span>
                      <span className="font-semibold">{sentimentStats.supportivePct}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-gray-200">
                      <div
                        className="h-full bg-[#4A9B4A] rounded-full"
                        style={{ width: `${sentimentStats.supportivePct}%` }}
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-[#eab308] font-medium">🟡 Neutral</span>
                      <span className="font-semibold">{sentimentStats.neutralPct}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-gray-200">
                      <div
                        className="h-full bg-[#eab308] rounded-full"
                        style={{ width: `${sentimentStats.neutralPct}%` }}
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-[#C93030] font-medium">🔴 Critical</span>
                      <span className="font-semibold">{sentimentStats.criticalPct}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-gray-200">
                      <div
                        className="h-full bg-[#C93030] rounded-full"
                        style={{ width: `${sentimentStats.criticalPct}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* AI Summary Section */}
              {(loadingAI || (aiSummaries && aiSummaries.length > 0)) && (
                <div className="space-y-4 border-t border-[#d4ddd0] pt-8">
                  <h3 className="text-lg font-semibold text-[#2B3A2B]">🤖 AI Analysis Summary</h3>
                  
                  {loadingAI ? (
                    // Loading skeleton
                    <div className="space-y-4 animate-pulse">
                      {[0, 1, 2].map((idx) => (
                        <div
                          key={idx}
                          className="rounded-lg border border-[#d4ddd0] bg-gradient-to-br from-blue-50 to-indigo-50 p-4"
                        >
                          <div className="flex items-center justify-between mb-3">
                            <div className="inline-flex items-center gap-2 rounded-full bg-indigo-100 px-3 py-1">
                              <div className="h-4 w-16 bg-indigo-200 rounded"></div>
                            </div>
                            <div className="h-3 w-20 bg-gray-200 rounded"></div>
                          </div>

                          <div className="mb-3 space-y-2">
                            <div className="h-3 w-20 bg-gray-200 rounded"></div>
                            <div className="h-5 w-32 bg-indigo-100 rounded"></div>
                          </div>

                          <div className="mb-3 space-y-2">
                            <div className="h-3 w-16 bg-gray-200 rounded"></div>
                            <div className="h-8 w-full bg-gray-100 rounded"></div>
                          </div>

                          <div className="space-y-2">
                            <div className="h-3 w-20 bg-gray-200 rounded"></div>
                            <div className="space-y-1">
                              <div className="h-2 w-full bg-gray-100 rounded"></div>
                              <div className="h-2 w-5/6 bg-gray-100 rounded"></div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    // Loaded content
                    <div className="space-y-4">
                      {aiSummaries.map((summary, idx) => (
                        <div
                          key={idx}
                          className="rounded-lg border border-[#d4ddd0] bg-gradient-to-br from-blue-50 to-indigo-50 p-4"
                        >
                          <div className="flex items-center justify-between mb-3">
                            <div className="inline-flex items-center gap-2 rounded-full bg-indigo-100 px-3 py-1">
                              <span className="text-xs font-semibold text-indigo-700">Thread #{idx + 1}</span>
                            </div>
                            <span className="text-xs text-gray-500">Root: {summary.root_id}</span>
                          </div>

                          <div className="mb-3">
                            <div className="text-xs text-gray-500 font-medium">Topic</div>
                            <div className="text-base font-semibold text-indigo-700">
                              {summary.main_topic}
                            </div>
                          </div>

                          <div className="mb-3">
                            <div className="text-xs text-gray-500 font-medium">Summary</div>
                            <p className="text-sm text-gray-700">{summary.summary}</p>
                          </div>

                          <div>
                            <div className="mb-2 text-xs text-gray-500 font-medium">Key Points</div>
                            <ul className="space-y-1">
                              {Array.isArray(summary.key_points) &&
                                summary.key_points.map((point: string, i: number) => (
                                  <li key={i} className="flex items-start gap-2 text-xs text-gray-700">
                                    <span className="mt-1 inline-block h-1.5 w-1.5 rounded-full bg-indigo-500 flex-shrink-0"></span>
                                    <span>{point}</span>
                                  </li>
                                ))}
                            </ul>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}