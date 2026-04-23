type SentimentStats = {
  avg: number;
  supportivePct: number;
  neutralPct: number;
  criticalPct: number;
};

type Props = {
  messageCount: number;
  roots: number;
  depth: number;
  sentimentStats: SentimentStats;
};

export default function UserFooter({
  messageCount,
  roots,
  depth,
  sentimentStats,
}: Props) {
  return (
    <div className="absolute bottom-0 left-1/2 z-40 w-full -translate-x-1/2 border-t border-[#d4ddd0] bg-[#fafaf8] p-4 shadow-[0_-4px_12px_rgba(0,0,0,0.05)]">
      <div className="mb-3 flex gap-2">
        {[
          { value: messageCount, label: "messages" },
          { value: roots, label: "threads" },
          { value: depth, label: "depth" },
        ].map(({ value, label }) => (
          <div key={label} className="flex-1 rounded-[10px] bg-[#e4ebe0] px-2 py-1.5">
            <div className="text-base font-semibold text-[#2B3A2B]">{value}</div>
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
          <div className="h-full bg-[#4A9B4A]" style={{ width: `${sentimentStats.supportivePct}%` }} />
          <div className="h-full bg-[#E07820]" style={{ width: `${sentimentStats.neutralPct}%` }} />
          <div className="h-full bg-[#C93030]" style={{ width: `${sentimentStats.criticalPct}%` }} />
        </div>
        <span className="whitespace-nowrap text-[10px] text-[#8BA07A]">
          {sentimentStats.avg.toFixed(2)}
        </span>
      </div>
    </div>
  );
}