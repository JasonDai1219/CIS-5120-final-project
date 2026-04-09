const API_BASE_URL =
  process.env.BACKEND_API_BASE_URL ?? "http://localhost:8000";

export async function GET() {
  try {
    const res = await fetch(`${API_BASE_URL}/datasets`, {
      cache: "no-store",
    });

    const text = await res.text();

    return new Response(text, {
      status: res.status,
      headers: {
        "Content-Type": res.headers.get("Content-Type") ?? "application/json",
      },
    });
  } catch {
    return Response.json(
      { detail: "Failed to reach backend /datasets endpoint." },
      { status: 502 }
    );
  }
}