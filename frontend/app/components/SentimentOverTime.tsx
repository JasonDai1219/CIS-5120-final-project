"use client";

type SentimentBucket = {
  date: string;
  supportive: number;
  critical: number;
  neutral: number;
  mixed: number;
};

type Props = {
  data: SentimentBucket[];
};

export default function SentimentOverTime({ data }: Props) {
  const maxTotal = Math.max(
    ...data.map(
      (d) => d.supportive + d.critical + d.neutral + d.mixed
    ),
    1
  );

  return (
    <div className="rounded-xl bg-white p-4 shadow">
      <h2 className="mb-3 text-lg font-semibold">Sentiment Over Time</h2>

      <div className="mb-4 flex flex-wrap gap-3 text-xs">
        <span className="rounded bg-green-100 px-2 py-1 text-green-800">
          Supportive
        </span>
        <span className="rounded bg-red-100 px-2 py-1 text-red-800">
          Critical
        </span>
        <span className="rounded bg-gray-100 px-2 py-1 text-gray-700">
          Neutral
        </span>
        <span className="rounded bg-yellow-100 px-2 py-1 text-yellow-800">
          Mixed
        </span>
      </div>

      <div className="flex items-end gap-6">
        {data.map((bucket) => {
          const total =
            bucket.supportive +
            bucket.critical +
            bucket.neutral +
            bucket.mixed;

          const supportiveHeight = (bucket.supportive / maxTotal) * 160;
          const criticalHeight = (bucket.critical / maxTotal) * 160;
          const neutralHeight = (bucket.neutral / maxTotal) * 160;
          const mixedHeight = (bucket.mixed / maxTotal) * 160;

          return (
            <div key={bucket.date} className="flex flex-col items-center">
              <div className="mb-2 text-xs text-gray-500">Total: {total}</div>

              <div className="flex h-40 w-16 items-end overflow-hidden rounded-t-md border border-gray-200 bg-gray-50">
                <div className="flex w-full flex-col justify-end">
                  {supportiveHeight > 0 && (
                    <div
                      className="w-full bg-green-500"
                      style={{ height: `${supportiveHeight}px` }}
                      title={`Supportive: ${bucket.supportive}`}
                    />
                  )}
                  {criticalHeight > 0 && (
                    <div
                      className="w-full bg-red-500"
                      style={{ height: `${criticalHeight}px` }}
                      title={`Critical: ${bucket.critical}`}
                    />
                  )}
                  {neutralHeight > 0 && (
                    <div
                      className="w-full bg-gray-400"
                      style={{ height: `${neutralHeight}px` }}
                      title={`Neutral: ${bucket.neutral}`}
                    />
                  )}
                  {mixedHeight > 0 && (
                    <div
                      className="w-full bg-yellow-400"
                      style={{ height: `${mixedHeight}px` }}
                      title={`Mixed: ${bucket.mixed}`}
                    />
                  )}
                </div>
              </div>

              <div className="mt-2 text-xs font-medium text-gray-700">
                {bucket.date}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}