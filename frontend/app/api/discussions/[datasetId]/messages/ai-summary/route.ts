import { NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8000";

export async function GET(
  _request: Request,
  { params }: { params: { datasetId: string } }
) {
  try {
    const res = await fetch(
      `${BACKEND_URL}/discussions/${params.datasetId}/ai-summary`,
      { cache: "no-store" }
    );

    const data = await res.json();

    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json(
      { detail: "Failed to reach backend ai-summary endpoint." },
      { status: 500 }
    );
  }
}