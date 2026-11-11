import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    status: "healthy",
    product: "State",
    timestamp: new Date().toISOString(),
  });
}
