import TimeSlider from "./TimeSlider";

type TimeGranularity = "day" | "week" | "month";
type ViewMode = "map" | "chat";

type Props = {
    datasetIds: string[];
    selectedDataset: string;
    onSelectDataset: (id: string) => void;

    timeGranularity: TimeGranularity;
    onChangeGranularity: (g: TimeGranularity) => void;

    availableTimeBuckets: string[];
    usableTimeBuckets: string[];
    sliderLow: number;
    sliderHigh: number;
    onSliderChange: (lo: number, hi: number) => void;

    availableTopics: string[];
    selectedTopics: string[];
    onToggleTopic: (topic: string) => void;
    onClearTopics: () => void;

    viewMode: ViewMode;
    onChangeViewMode: (mode: ViewMode) => void;
};

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

export default function UserHeader({
    datasetIds,
    selectedDataset,
    onSelectDataset,
    timeGranularity,
    onChangeGranularity,
    availableTimeBuckets,
    usableTimeBuckets,
    sliderLow,
    sliderHigh,
    onSliderChange,
    availableTopics,
    selectedTopics,
    onToggleTopic,
    onClearTopics,
    viewMode,
    onChangeViewMode,
}: Props) {
    const segments = Math.max(
        availableTimeBuckets.filter((b) => b !== "all").length,
        1
    );

    const handleStartSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const nextLow = usableTimeBuckets.indexOf(e.target.value);
        if (nextLow === -1) return;
        const nextHigh = Math.max(sliderHigh, nextLow + 1);
        onSliderChange(nextLow, nextHigh);
    };

    const handleEndSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const endIndex = usableTimeBuckets.indexOf(e.target.value);
        if (endIndex === -1) return;
        const nextHigh = endIndex + 1;
        const nextLow = Math.min(sliderLow, endIndex);
        onSliderChange(nextLow, nextHigh);
    };

    return (
        <div className="shrink-0 border-b border-[#d4ddd0] px-4 p-4">
            <div className="flex flex-col gap-3">

                {/* Row 1: title + dataset picker */}
                <div className="flex items-center justify-between gap-3">
                    <div className="text-[15px] font-semibold tracking-[-0.3px] text-[#2B3A2B]">
                        Thread Map
                    </div>
                    {datasetIds.length > 1 && (
                        <select
                            value={selectedDataset}
                            onChange={(e) => onSelectDataset(e.target.value)}
                            className="appearance-none rounded-full border border-[#A8B89A] bg-[#eef2eb] px-3 py-1 pr-8 text-xs font-medium text-[#2B3A2B] outline-none"
                        >
                            {datasetIds.map((id) => (
                                <option key={id} value={id}>{id}</option>
                            ))}
                        </select>
                    )}
                </div>

                {/* Row 2: granularity */}
                <div className="flex items-center gap-2">
                    <label className="shrink-0 text-[11px] font-medium text-[#5C7A4E]">
                        Group by
                    </label>
                    <select
                        value={timeGranularity}
                        onChange={(e) => onChangeGranularity(e.target.value as TimeGranularity)}
                        className="appearance-none rounded-full border border-[#A8B89A] bg-[#eef2eb] px-3 py-1 pr-8 text-xs font-medium text-[#2B3A2B] outline-none"
                    >
                        <option value="day">Daily</option>
                        <option value="week">Weekly</option>
                        <option value="month">Monthly</option>
                    </select>
                </div>

                {/* Row 3: time slider */}
                <div style={{ overflow: "visible" }}>
                    <TimeSlider
                        segments={segments}
                        low={sliderLow}
                        high={sliderHigh}
                        onChange={onSliderChange}
                    />
                </div>

                {/* Row 4: start / end bucket selects */}
                <div className="flex items-center justify-center gap-2">
                    <select
                        value={usableTimeBuckets[sliderLow] ?? ""}
                        onChange={handleStartSelect}
                        className="rounded-full border border-[#A8B89A] bg-[#eef2eb] px-3 py-1 text-[11px] font-medium text-[#2B3A2B] outline-none"
                    >
                        {usableTimeBuckets.map((bucket, index) => (
                            <option key={bucket} value={bucket} disabled={index >= sliderHigh}>
                                {formatBucketLabel(bucket, timeGranularity)}
                            </option>
                        ))}
                    </select>

                    <span className="text-[11px] font-medium text-[#5C7A4E]">to</span>

                    <select
                        value={usableTimeBuckets[sliderHigh - 1] ?? ""}
                        onChange={handleEndSelect}
                        className="rounded-full border border-[#A8B89A] bg-[#eef2eb] px-3 py-1 text-[11px] font-medium text-[#2B3A2B] outline-none"
                    >
                        {usableTimeBuckets.map((bucket, index) => (
                            <option key={bucket} value={bucket} disabled={index < sliderLow}>
                                {formatBucketLabel(bucket, timeGranularity)}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Row 5: topic chips */}
                <div className="-mx-5 overflow-x-auto overflow-y-hidden px-5 scrollbar-thin">
                    <div className="flex w-max gap-1.5 pr-5">
                        <button
                            onClick={onClearTopics}
                            className={`shrink-0 rounded-full border px-3 py-1 text-xs font-medium whitespace-nowrap ${selectedTopics.length === 0
                                    ? "border-[#3D6B35] bg-[#3D6B35] text-[#f5f8f2]"
                                    : "border-[#A8B89A] bg-transparent text-[#5C7A4E]"
                                }`}
                        >
                            All topics
                        </button>
                        {availableTopics.map((topic) => (
                            <button
                                key={topic}
                                onClick={() => onToggleTopic(topic)}
                                className={`shrink-0 rounded-full border px-3 py-1 text-xs font-medium whitespace-nowrap ${selectedTopics.includes(topic)
                                        ? "border-[#3D6B35] bg-[#3D6B35] text-[#f5f8f2]"
                                        : "border-[#A8B89A] bg-transparent text-[#5C7A4E]"
                                    }`}
                            >
                                {topic}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Row 6: view toggle */}
                <div className="flex w-full rounded-full bg-[#e4ebe0] p-0.5">
                    <button
                        onClick={() => onChangeViewMode("map")}
                        className={`flex-1 rounded-full px-3 py-2 text-xs font-medium transition ${viewMode === "map"
                                ? "bg-[#fafaf8] text-[#2B3A2B]"
                                : "bg-transparent text-[#7A9B6E]"
                            }`}
                    >
                        Thread Map
                    </button>
                    <button
                        onClick={() => onChangeViewMode("chat")}
                        className={`flex-1 rounded-full px-3 py-2 text-xs font-medium transition ${viewMode === "chat"
                                ? "bg-[#fafaf8] text-[#2B3A2B]"
                                : "bg-transparent text-[#7A9B6E]"
                            }`}
                    >
                        Chat View
                    </button>
                </div>

            </div>
        </div>
    );
}