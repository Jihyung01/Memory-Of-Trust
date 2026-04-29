"use client";

import { useCallback, useEffect, useState } from "react";

const DEV_ELDER_ID = "00000000-0000-0000-0000-000000000001";
const DEV_DEVICE_TOKEN = "dev";

interface SetupResult {
  elder_id: string;
  device_token: string;
  device_url: string;
  family_url: string;
}

export default function DevPage() {
  const [setup, setSetup] = useState<SetupResult | null>(null);
  const [status, setStatus] = useState<string>("초기화 중...");
  const [batchLog, setBatchLog] = useState<string[]>([]);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  // 자동 setup
  useEffect(() => {
    fetch("/api/dev/setup", { method: "POST" })
      .then((r) => r.json())
      .then((data: SetupResult) => {
        setSetup(data);
        setStatus("준비 완료");
      })
      .catch((e) => {
        setStatus(`Setup 실패: ${String(e)}`);
      });
  }, []);

  const addLog = useCallback((msg: string) => {
    setBatchLog((prev) => [...prev, `[${new Date().toLocaleTimeString("ko-KR")}] ${msg}`]);
  }, []);

  const runExtract = useCallback(async () => {
    setIsExtracting(true);
    addLog("추출 시작...");
    try {
      const cronSecret = prompt("CRON_SECRET 값을 입력하세요:");
      if (!cronSecret) {
        addLog("취소됨");
        setIsExtracting(false);
        return;
      }
      const res = await fetch("/api/batch/extract", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${cronSecret}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ elder_id: DEV_ELDER_ID, limit: 10 }),
      });
      const data = await res.json();
      addLog(`추출 완료: claimed=${data.claimed}, succeeded=${data.succeeded}, failed=${data.failed}`);
      if (data.errors?.length) {
        addLog(`에러: ${data.errors.slice(0, 3).join(", ")}`);
      }
    } catch (e) {
      addLog(`추출 실패: ${String(e)}`);
    }
    setIsExtracting(false);
  }, [addLog]);

  const runWeeklyCard = useCallback(async () => {
    setIsGenerating(true);
    addLog("주간 카드 생성 시작...");
    try {
      const cronSecret = prompt("CRON_SECRET 값을 입력하세요:");
      if (!cronSecret) {
        addLog("취소됨");
        setIsGenerating(false);
        return;
      }
      const res = await fetch("/api/batch/weekly-card", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${cronSecret}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ elder_id: DEV_ELDER_ID }),
      });
      const data = await res.json();
      if (data.skipped) {
        addLog(`주간 카드 스킵: ${data.reason}`);
      } else {
        addLog(`주간 카드 생성 완료: ${data.weekLabel} (${data.created ? "신규" : "업데이트"})`);
      }
    } catch (e) {
      addLog(`주간 카드 실패: ${String(e)}`);
    }
    setIsGenerating(false);
  }, [addLog]);

  return (
    <main
      className="min-h-screen px-6 py-8"
      style={{ background: "#1a1a1d", color: "#e0e0e0" }}
    >
      <div className="mx-auto max-w-3xl">
        {/* 헤더 */}
        <div className="mb-8 flex items-center gap-3">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold"
            style={{ background: "#ffb43c", color: "#1a1a1d" }}
          >
            DEV
          </div>
          <div>
            <h1 className="text-xl font-bold" style={{ color: "#ffb43c" }}>
              MOT 개발 테스트
            </h1>
            <p className="text-sm" style={{ color: "#8a8880" }}>{status}</p>
          </div>
        </div>

        {setup && (
          <>
            {/* 바로가기 링크들 */}
            <section
              className="mb-6 rounded-xl border p-5"
              style={{ background: "#222225", borderColor: "#3a3a3d" }}
            >
              <h2 className="mb-4 text-base font-semibold" style={{ color: "#ffb43c" }}>
                바로가기
              </h2>
              <div className="grid gap-3 sm:grid-cols-2">
                <a
                  href={setup.device_url}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-lg border px-4 py-3 text-center text-sm font-medium transition-colors hover:border-amber-500"
                  style={{ borderColor: "#3a3a3d", color: "#e0e0e0" }}
                >
                  🎙️ 어르신 화면 열기
                  <br />
                  <span className="text-xs" style={{ color: "#8a8880" }}>
                    {setup.device_url}
                  </span>
                </a>
                <a
                  href={setup.family_url}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-lg border px-4 py-3 text-center text-sm font-medium transition-colors hover:border-amber-500"
                  style={{ borderColor: "#3a3a3d", color: "#e0e0e0" }}
                >
                  👨‍👩‍👧 가족 대시보드 열기
                  <br />
                  <span className="text-xs" style={{ color: "#8a8880" }}>
                    {setup.family_url}
                  </span>
                </a>
              </div>
              <p className="mt-3 text-xs" style={{ color: "#6a6a6e" }}>
                어르신 ID: {setup.elder_id}
                <br />
                디바이스 토큰: {setup.device_token}
              </p>
            </section>

            {/* 테스트 흐름 안내 */}
            <section
              className="mb-6 rounded-xl border p-5"
              style={{ background: "#222225", borderColor: "#3a3a3d" }}
            >
              <h2 className="mb-3 text-base font-semibold" style={{ color: "#ffb43c" }}>
                테스트 순서
              </h2>
              <ol className="space-y-2 text-sm" style={{ color: "#b0b0b0" }}>
                <li>1. &quot;어르신 화면 열기&quot;에서 마이크 버튼 → 말하기 → 자동 종료 또는 다시 누르기</li>
                <li>2. 발화가 자동으로 저장되고, 짧지 않은 발화는 8축 추출도 자동 실행됩니다</li>
                <li>3. &quot;가족 대시보드 열기&quot;에서 홈 탭 → 발화 목록 확인</li>
                <li>4. 아래 &quot;주간 카드 생성&quot; 버튼 → 가족 대시보드 &quot;이번 주 이야기&quot; 탭 확인</li>
              </ol>
            </section>

            {/* 배치 실행 버튼 */}
            <section
              className="mb-6 rounded-xl border p-5"
              style={{ background: "#222225", borderColor: "#3a3a3d" }}
            >
              <h2 className="mb-4 text-base font-semibold" style={{ color: "#ffb43c" }}>
                배치 수동 실행
              </h2>
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={runExtract}
                  disabled={isExtracting}
                  className="rounded-lg px-4 py-2.5 text-sm font-medium transition-colors disabled:opacity-50"
                  style={{ background: "#ffb43c", color: "#1a1a1d" }}
                >
                  {isExtracting ? "추출 중..." : "8축 추출 실행"}
                </button>
                <button
                  onClick={runWeeklyCard}
                  disabled={isGenerating}
                  className="rounded-lg px-4 py-2.5 text-sm font-medium transition-colors disabled:opacity-50"
                  style={{ background: "#4a9eff", color: "#fff" }}
                >
                  {isGenerating ? "생성 중..." : "주간 카드 생성"}
                </button>
              </div>
              <p className="mt-2 text-xs" style={{ color: "#6a6a6e" }}>
                CRON_SECRET 값은 .env.local에서 확인하세요
              </p>
            </section>

            {/* 로그 */}
            {batchLog.length > 0 && (
              <section
                className="rounded-xl border p-5"
                style={{ background: "#222225", borderColor: "#3a3a3d" }}
              >
                <h2 className="mb-3 text-base font-semibold" style={{ color: "#ffb43c" }}>
                  로그
                </h2>
                <div
                  className="max-h-60 overflow-y-auto rounded-lg p-3 font-mono text-xs"
                  style={{ background: "#1a1a1d" }}
                >
                  {batchLog.map((log, i) => (
                    <div key={i} className="mb-1" style={{ color: "#b0b0b0" }}>
                      {log}
                    </div>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </main>
  );
}
