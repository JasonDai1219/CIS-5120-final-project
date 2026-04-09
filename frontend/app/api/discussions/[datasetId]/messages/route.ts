const API_BASE_URL =
  process.env.BACKEND_API_BASE_URL ?? "http://localhost:8000";

type RouteContext = {
  params: Promise<{
    datasetId: string;
  }>;
};

export async function GET(_: Request, context: RouteContext) {
  try {
    const { datasetId } = await context.params;

    const res = await fetch(
      `${API_BASE_URL}/discussions/${datasetId}/messages`,
      { cache: "no-store" }
    );

    const text = await res.text();

    return new Response(text, {
      status: res.status,
      headers: {
        "Content-Type": res.headers.get("Content-Type") ?? "application/json",
      },
    });
  } catch {
    return Response.json(
      { detail: "Failed to reach backend messages endpoint." },
      { status: 502 }
    );
  }
}