/**
 * Sentry PII scrub 검증용 임시 라우트.
 * dev 모드에서만 동작 (production 에선 404).
 * 검증 끝나면 이 파일 삭제.
 *
 * 사용:
 *   curl -X POST "http://localhost:3002/api/dev/sentry-test?device_token=secret123abc" \
 *     -H "Content-Type: application/json" \
 *     -d '{"transcript":"어르신의 비밀 발화 데이터","text":"비밀 텍스트","meta":"비밀 메타","response_text":"비밀 LLM 응답"}'
 *
 * Sentry Issues 탭에서 이벤트 확인. 다음 모두 [REDACTED] 여야 함:
 *   - request.data.transcript
 *   - request.data.text
 *   - request.data.meta
 *   - request.data.response_text
 *   - URL 의 device_token 파라미터
 */

import * as Sentry from "@sentry/nextjs";

import { isDevMode } from "@/lib/env";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!isDevMode) {
    return Response.json({ error: "dev only" }, { status: 404 });
  }

  let body: unknown = null;
  try {
    body = await request.json();
  } catch {
    body = { error: "no body" };
  }

  try {
    throw new Error("PII scrub test - server route /api/dev/sentry-test");
  } catch (error) {
    Sentry.captureException(error, {
      contexts: {
        request: {
          method: "POST",
          url: request.url,
          data: body,
        },
      },
      tags: {
        test: "pii-scrub",
      },
    });

    return Response.json({
      ok: true,
      sent_to_sentry: true,
      hint: "Sentry Issues 탭에서 이벤트 확인. body 필드와 URL 의 device_token 이 [REDACTED] 인지.",
    });
  }
}
