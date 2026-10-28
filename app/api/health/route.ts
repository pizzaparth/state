import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    status: "healthy",
    product: "State by Ksan Relay",
    timestamp: new Date().toISOString(),
  });
}
