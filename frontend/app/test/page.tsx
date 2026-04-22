"use client";

import { useState } from "react";
import UserHeader from "../components/UserHeader";
import UserFooter from "../components/UserFooter";

type TimeGranularity = "day" | "week" | "month";
type ViewMode = "map" | "chat";

export default function HeaderTestPage() {
  const [selectedDataset, setSelectedDataset] = useState("discussion_demo");
  const [timeGranularity, setTimeGranularity] = useState<TimeGranularity>("week");
  const [sliderLow, setSliderLow] = useState(0);
  const [sliderHigh, setSliderHigh] = useState(3);
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>("map");

  const datasetIds = ["discussion_demo", "sample_data"];
  const usableTimeBuckets = ["2026-03-01", "2026-03-08", "2026-03-15", "2026-03-22"];
  const availableTimeBuckets = ["all", ...usableTimeBuckets];
  const availableTopics = ["Policy", "Sports", "AI", "Campus"];

  const handleToggleTopic = (topic: string) => {
    setSelectedTopics((prev) =>
      prev.includes(topic)
        ? prev.filter((t) => t !== topic)
        : [...prev, topic]
    );
  };

  return (
    <div className="min-h-screen bg-[#f7f8f4]">
      <div className="mx-auto flex min-h-screen max-w-md flex-col bg-white shadow">
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
          }}
          availableTopics={availableTopics}
          selectedTopics={selectedTopics}
          onToggleTopic={handleToggleTopic}
          onClearTopics={() => setSelectedTopics([])}
          viewMode={viewMode}
          onChangeViewMode={setViewMode}
        />

        <div className="flex-1 p-4 pb-36 text-sm text-gray-500">
          Mock content area
        </div>

        <UserFooter
          messageCount={42}
          roots={6}
          depth={4}
          sentimentStats={{
            avg: 0.38,
            supportivePct: 45,
            neutralPct: 30,
            criticalPct: 25,
          }}
        />
      </div>
    </div>
  );
}