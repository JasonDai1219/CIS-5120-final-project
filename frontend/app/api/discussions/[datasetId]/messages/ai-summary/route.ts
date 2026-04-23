import { NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8000";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ datasetId: string }> }
) {
  const { datasetId } = await params;

  const res = await fetch(
    `${BACKEND_URL}/discussions/${datasetId}/ai-summary`,
    { cache: "no-store" }
  );

  const data = await res.json();
  return Response.json(data, { status: res.status });
}