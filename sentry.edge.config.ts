import * as Sentry from "@sentry/nextjs";

const dsn = process.env.SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    tracesSampleRate: 0.1,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
    environment: process.env.NODE_ENV,
    beforeSend: scrubPII,
  });
}

function scrubPII(event: Sentry.ErrorEvent): Sentry.ErrorEvent {
  const SENSITIVE_KEYS = ["transcript", "text", "meta", "response_text", "device_token"];

  function maskKnownKeys(data: unknown): void {
    if (!data || typeof data !== "object") return;
    const obj = data as Record<string, unknown>;
    for (const key of SENSITIVE_KEYS) {
      if (key in obj) obj[key] = "[REDACTED]";
    }
  }

  function maskTokenInUrl(url: string): string {
    return url.replace(/device_token=[^&]+/, "device_token=[REDACTED]");
  }

  // (1) 자동 capture body
  maskKnownKeys(event.request?.data);

  // (2) 명시 captureException 의 contexts.request.data
  const ctxRequest = event.contexts?.request as
    | { data?: unknown; url?: string }
    | undefined;
  if (ctxRequest) {
    maskKnownKeys(ctxRequest.data);
    if (typeof ctxRequest.url === "string") {
      ctxRequest.url = maskTokenInUrl(ctxRequest.url);
    }
  }

  // (3) extra (자유 형식, top-level keys 처리)
  maskKnownKeys(event.extra);

  // URL — event.request.url
  if (event.request?.url) {
    event.request.url = maskTokenInUrl(event.request.url);
  }

  // breadcrumbs
  if (event.breadcrumbs) {
    event.breadcrumbs = event.breadcrumbs.map((crumb) => {
      if (
        crumb.data &&
        typeof crumb.data === "object" &&
        "url" in crumb.data &&
        typeof crumb.data.url === "string"
      ) {
        crumb.data.url = maskTokenInUrl(crumb.data.url);
      }
      return crumb;
    });
  }
  return event;
}
