// app/api/ping/route.ts  (or src/app/...)
import { NextResponse } from "next/server";
import { apis } from "@/lib/apisports";

export async function GET() {
  const r = await apis<any>("/timezone", undefined, 1).catch(e => ({ error: String(e) }));
  return NextResponse.json(r);
}
