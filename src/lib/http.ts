// src/lib/http.ts
import { NextResponse } from "next/server";

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export function toAmerican(decimalOdd: string | number | undefined): number | undefined {
  const d = typeof decimalOdd === "string" ? parseFloat(decimalOdd.replace(",", ".")) : decimalOdd;
  if (!d || !isFinite(d) || d <= 1) return undefined;
  return d >= 2 ? Math.round((d - 1) * 100) : Math.round(-100 / (d - 1));
}

export function num(s?: string | number | null): number | undefined {
  if (s === undefined || s === null) return undefined;
  const n = typeof s === "number" ? s : parseFloat(String(s).replace(",", "."));
  return isFinite(n) ? n : undefined;
}
