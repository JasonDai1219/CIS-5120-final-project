"use client";

type SentimentPoint = {
  date: string;
  score: number; // -1 to 1
  count: number;
};

type Props = {
  data: SentimentPoint[];
};

function scoreToColor(score: number) {
  if (score >= 0.5) return "#16a34a";
  if (score >= 0.15) return "#84cc16";
  if (score > -0.15) return "#9ca3af";
  if (score > -0.5) return "#f97316";
  return "#dc2626";
}

export default function SentimentTrendLine({ data }: Props) {
  const width = 520;
  const height = 180;
  const padding = 24;

  if (data.length === 0) {
    return (
      <div className="rounded-xl bg-white p-4 shadow">
        <h2 className="mb-3 text-lg font-semibold">Sentiment Over Time</h2>
        <p className="text-sm text-gray-500">No data available.</p>
      </div>
    );
  }

  if (data.length === 1) {
    const y =
      padding + ((1 - (data[0].score + 1) / 2) * (height - padding * 2));

    return (
      <div className="rounded-xl bg-white p-4 shadow">
        <h2 className="mb-3 text-lg font-semibold">Sentiment Over Time</h2>
        <svg width="100%" viewBox={`0 0 ${width} ${height}`} className="overflow-visible">
          <line
            x1={padding}
            y1={height / 2}
            x2={width - padding}
            y2={height / 2}
            stroke="#e5e7eb"
            strokeWidth="1"
          />
          <circle cx={width / 2} cy={y} r="6" fill={scoreToColor(data[0].score)} />
          <text x={width / 2} y={height - 6} textAnchor="middle" fontSize="12" fill="#6b7280">
            {data[0].date}
          </text>
        </svg>
      </div>
    );
  }

  const stepX = (width - padding * 2) / (data.length - 1);

  const points = data.map((point, index) => {
    const x = padding + index * stepX;
    const y =
      padding + ((1 - (point.score + 1) / 2) * (height - padding * 2));
    return { ...point, x, y };
  });

  const pathD = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`)
    .join(" ");

  return (
    <div className="rounded-xl bg-white p-4 shadow">
      <h2 className="mb-3 text-lg font-semibold">Sentiment Over Time</h2>

      <div className="mb-2 flex items-center justify-between text-xs text-gray-500">
        <span>Critical</span>
        <span>Neutral</span>
        <span>Supportive</span>
      </div>

      <svg width="100%" viewBox={`0 0 ${width} ${height}`} className="overflow-visible">
        <line
          x1={padding}
          y1={padding}
          x2={width - padding}
          y2={padding}
          stroke="#f3f4f6"
          strokeWidth="1"
        />
        <line
          x1={padding}
          y1={height / 2}
          x2={width - padding}
          y2={height / 2}
          stroke="#d1d5db"
          strokeWidth="1"
          strokeDasharray="4 4"
        />
        <line
          x1={padding}
          y1={height - padding}
          x2={width - padding}
          y2={height - padding}
          stroke="#f3f4f6"
          strokeWidth="1"
        />

        <path
          d={pathD}
          fill="none"
          stroke="#9ca3af"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {points.map((p) => (
          <g key={p.date}>
            <circle cx={p.x} cy={p.y} r="6" fill={scoreToColor(p.score)} />
            <text
              x={p.x}
              y={height - 6}
              textAnchor="middle"
              fontSize="12"
              fill="#6b7280"
            >
              {p.date.slice(5)}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}