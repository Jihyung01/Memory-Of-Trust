/**
 * POST /api/dev/run-batch
 *
 * Dev 전용 프록시: 클라이언트가 CRON_SECRET을 몰라도
 * 배치 엔드포인트를 호출할 수 있게 해준다.
 *
 * body: { action: "extract" | "weekly-card", elder_id?: string, limit?: number }
 *
 * ⚠️ production에서는 403 반환.
 */

import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

interface RunBatchRequest {
  action?: string;
  elder_id?: string;
  limit?: number;
}

const ACTION_MAP: Record<string, { path: string; method: string }> = {
  extract: { path: "/api/batch/extract", method: "POST" },
  "weekly-card": { path: "/api/batch/weekly-card", method: "POST" },
};

export async function POST(request: Request) {
  const isDev = env.NODE_ENV !== "production" && env.ENABLE_DEV_PAGE === "true";
  if (!isDev) {
    return Response.json(
      { error: "Dev mode is not enabled" },
      { status: 403 }
    );
  }

  const body = (await request.json().catch(() => ({}))) as RunBatchRequest;
  const action = body.action ?? "";
  const target = ACTION_MAP[action];

  if (!target) {
    return Response.json(
      { error: `Unknown action: ${action}. Use "extract" or "weekly-card".` },
      { status: 400 }
    );
  }

  // 원본 요청의 origin으로 내부 fetch
  const url = new URL(target.path, request.url);

  const proxyBody: Record<string, unknown> = {};
  if (body.elder_id) proxyBody.elder_id = body.elder_id;
  if (body.limit) proxyBody.limit = body.limit;

  try {
    const res = await fetch(url.toString(), {
      method: target.method,
      headers: {
        Authorization: `Bearer ${env.CRON_SECRET}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(proxyBody),
    });

    const data = await res.json().catch(() => ({ error: "Non-JSON response" }));
    return Response.json(data, { status: res.status });
  } catch (error) {
    console.error("POST /api/dev/run-batch proxy error:", error);
    return Response.json(
      { error: "Proxy request failed", details: String(error) },
      { status: 500 }
    );
  }
}
