// src/lib/apisports.ts
import { env } from "./env";

export const APIS_BASE = `https://${env.APISPORTS_HOST}`;

function buildHeaders(host: string) {
  const h: Record<string, string> = {};
  if (host.includes("rapidapi")) {
    h["x-rapidapi-host"] = host;
    h["x-rapidapi-key"] = env.APISPORTS_KEY;
  } else {
    // direct API-Sports host (e.g., v1.basketball.api-sports.io)
    h["x-apisports-key"] = env.APISPORTS_KEY;
  }
  return h;
}

export type ApiSportsResponse<T> = { response: T; results?: number; errors?: unknown };

export async function apis<T>(
  path: string,
  params?: Record<string, string | number | boolean | undefined>,
  revalidateSeconds = 15
): Promise<ApiSportsResponse<T>> {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params ?? {})) if (v !== undefined) sp.set(k, String(v));
  const url = `${APIS_BASE}${path}${sp.size ? `?${sp}` : ""}`;

  const res = await fetch(url, {
    headers: buildHeaders(env.APISPORTS_HOST),
    next: { revalidate: revalidateSeconds },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error("API-Sports error", res.status, res.statusText, text);
    throw new Error(`API-Sports ${res.status} ${res.statusText}: ${text}`);
  }
  return (await res.json()) as ApiSportsResponse<T>;
}
