# Codex 실행 프롬프트: 대화 UX 상용화 (Sprint 2 — Updated)

> **본질**: "인간은 죽기 전에 자신의 가치를 남기고 가고 싶어한다. 기억되고 싶어한다."
> 자서전 서비스가 아니다. **인간의 보존 욕구를 충족시키는 서비스**다.
> 어르신(70~90대)은 **듣는 사람이 아니라 말하는 사람**. 대화가 끊기면 어르신이 말하기를 포기한다.
>
> **목표**: 어르신 디바이스(태블릿)에서 마이크 한 번 누르면 끊김 없이 자연스러운 대화가 이어지게 만든다.

---

## 이미 완료된 것 (수정하지 마시오)

아래 항목들은 이미 구현되어 있다. 다시 건드리지 않는다.

1. **Edge TTS DRM 토큰**: `lib/ai/edge-tts.ts` — Sec-MS-GEC + MUID 구현 완료
2. **webpack externals**: `next.config.ts` — `bufferutil`, `utf-8-validate` externals 추가 완료
3. **TTS 5초 타임아웃 + 브라우저 TTS 폴백**: `DevicePageClient.tsx` — AbortController 5초 + `speakWithBrowserTTS()` 폴백 완료
4. **Gemma 모델 전환**: 대화용 `gemma-3-4b-it`, 배치용 `gemma-4-26b-a4b-it` — 완료
5. **429 재시도 로직**: `lib/ai/gemini.ts` — retryDelay 파싱 + 일일한도 감지 완료
6. **침묵 감지 6초**: `DevicePageClient.tsx` — `silenceDurationMs: 6000`, `silenceThreshold: 12`, `maxDurationMs: 120000` 완료
7. **금지어 필터 개선**: `app/api/llm/respond/route.ts` — "AI"를 regex `/\bAI\b/i`로 분리, "프로그램" 등 추가 완료
8. **LLM 시스템 프롬프트 개선**: `app/api/llm/respond/route.ts` — 대화 초반에는 [END] 금지, 감각적 질문 유도, 서비스 어투 금지 완료
9. **dev 페이지 CRON_SECRET 자동 주입**: `/api/dev/run-batch` 프록시 엔드포인트 완료

---

## 읽어야 할 파일 (순서대로)

1. `CLAUDE.md`
2. `.ai/harness.md`
3. `docs/PRODUCT.md`
4. 이 파일 (`.ai/codex-conversation-ux.md`)

---

## P0: 대화 파이프라인 최적화 (반드시 먼저)

### P0-1. STT → LLM 병렬화 (utterance save를 비동기로 분리)

**파일**: `app/(device)/device/[deviceId]/components/DevicePageClient.tsx`

현재 흐름: `STT → utterance save (동기 대기) → LLM → TTS`
목표 흐름: `STT → [utterance save (비동기, fire-and-forget)] + [LLM (즉시 시작)] → TTS`

`continueAfterTranscript` 함수에서:

1. `utteranceForm` fetch를 `Promise`로 시작하되 **await 하지 않음**
2. LLM 요청에 `transcript`를 직접 전달 (현재는 utterance_id를 받아서 DB 조회 → 느림)
3. LLM 응답 후 TTS 시작 전에 utteranceSavePromise를 await (에러 무시)

```typescript
// utterance save — fire and forget
const utteranceSavePromise = fetch("/api/device/utterance", {
  method: "POST",
  body: utteranceForm,
}).catch((err) => console.error("Utterance save error:", err));

// LLM — 즉시 시작 (utterance_id 불필요, transcript 직접 전달)
const llmRes = await fetch("/api/llm/respond", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    transcript: input.transcript,
    turn_count: turnCount + 1,
  }),
});

// TTS 전에 utterance save 완료 대기 (에러 무시)
await utteranceSavePromise;
```

> `app/api/llm/respond/route.ts`는 이미 `transcript` 직접 전달을 지원한다. 변경 불필요.

**검증**: 콘솔에서 `llm/respond took`이 이전보다 빨라야 함 (utterance save 대기 시간 제거)

---

### P0-2. TTS 재생 후 자동 녹음 재시작 강화

**파일**: `app/(device)/device/[deviceId]/components/DevicePageClient.tsx`

현재 `proceedAfterSpeaking`에서 `startRecording()`을 호출하지만, 실패 시 무한 대기 가능.

```typescript
const proceedAfterSpeaking = () => {
  audioRef.current = null;
  if (llmData.should_end) {
    setTurnCount(0);
    setPhase("idle");
    return;
  }
  // 0.5초 뒤 녹음 시작 (오디오 출력 잔향 방지)
  setTimeout(() => {
    startRecording().catch((err) => {
      console.error("[device] Auto-restart recording failed:", err);
      setPhase("idle");
    });
  }, 500);
};
```

**검증**: TTS 종료 후 0.5초 이내에 녹음이 자동으로 시작되어야 함

---

### P0-3. TTS 서버 응답 개선 — base64 인라인 반환

**파일**: `app/api/tts/route.ts`

Supabase Storage 업로드 실패 시에도 오디오를 반환하도록 base64 폴백 추가:

```typescript
let mp3Buffer: Buffer;
try {
  mp3Buffer = await synthesizeSpeechEdge({ text, rate: "-15%" });
} catch (edgeErr) {
  console.warn("[tts] Edge TTS failed:", edgeErr);
  return Response.json({ audio_url: null, fallback: true });
}

// Storage 업로드 시도 — 실패 시 base64 폴백
let audioUrl: string | null = null;
try {
  audioUrl = await uploadTtsAudioAndCreateSignedUrl({ ... });
} catch (storageErr) {
  console.warn("[tts] Storage upload failed, using base64:", storageErr);
}

if (audioUrl) {
  return Response.json({ audio_url: audioUrl });
}

// base64 폴백
const base64 = mp3Buffer.toString("base64");
return Response.json({ audio_url: `data:audio/mpeg;base64,${base64}` });
```

**DevicePageClient.tsx에서**: `ttsData.fallback === true`이면 즉시 `speakWithBrowserTTS()` 호출

**검증**: Storage 없이도 Edge TTS 오디오가 재생되어야 함

---

## P1: 대화 품질

### P1-1. 항상 듣는 모드 (Continuous Listening)

**파일**: `app/(device)/device/[deviceId]/components/DevicePageClient.tsx`

마이크 한 번 누르면 대화가 끝나도 계속 녹음 대기. 다시 누르면 종료.

1. `const [continuousMode, setContinuousMode] = useState(false);` 추가
2. `handleMicPress`:
   - idle + !continuous → continuous ON + startRecording
   - idle + continuous → continuous OFF
   - recording → 수동 정지 + 처리
   - speaking → TTS 중단 + 녹음 시작 (인터럽트)
3. `proceedAfterSpeaking`:
   - `should_end && continuousMode` → 1초 뒤 새 대화 시작
   - `should_end && !continuousMode` → idle
   - `!should_end` → 0.5초 뒤 다음 턴 녹음
4. 헤더 상태 표시: "듣는 중" / "대화 중" / "연결됨"

---

### P1-2. TTS 재생 중 인터럽트

**파일**: `app/(device)/device/[deviceId]/components/DevicePageClient.tsx`, `MicButton.tsx`

- `speaking` 상태에서 마이크 탭 → `audio.pause()` + `speechSynthesis.cancel()` + 즉시 녹음 시작
- `MicButton`의 `isProcessing` prop에서 `speaking`을 제외 (탭 가능하게)

---

### P1-3. 대화 컨텍스트 유지 (최근 3~5턴)

**파일**: `DevicePageClient.tsx`, `app/api/llm/respond/route.ts`

클라이언트에서 `conversationHistory: ConversationTurn[]` 관리, LLM 요청에 최근 6개 메시지 포함.

서버에서 `buildConversationContext(history)` → 프롬프트에 "이전 대화:" 섹션 추가.

```typescript
interface ConversationTurn {
  role: "elder" | "assistant";
  text: string;
}
```

**검증**: 3턴째에 1턴째 내용을 참조하는 응답이 나오는지 확인

---

### P1-4. 적응형 침묵 감지 (배경 소음 캘리브레이션)

**파일**: `lib/voice/recorder.ts`

녹음 시작 첫 1초(5샘플) 동안 배경 소음 RMS를 측정하여 `noiseFloor` 설정.
이후 `adaptiveThreshold = noiseFloor + configuredThreshold`로 침묵 판정.

TV 소리가 있는 거실에서도 어르신 말이 끝나면 정확히 자동 종료되어야 함.

---

## P2: TTS 안정화

### P2-1. Edge TTS 서버 타임아웃 5초로 단축

**파일**: `lib/ai/edge-tts.ts`

현재 30초 타임아웃 → 5초로 변경. 클라이언트에서도 5초 abort 하고 있으므로 서버도 일치시킨다.

### P2-2. TTS 인메모리 캐시 (LRU 50개, TTL 30분)

**파일**: `app/api/tts/route.ts`

같은 텍스트 반복 합성 방지. Vercel 서버리스에서 같은 인스턴스 내에서만 유효하지만, 연속 대화 중 "그러셨어요..." 같은 반복 텍스트에 효과적.

---

## P3: 인프라

### P3-1. Supabase Storage 버킷 생성

**파일**: `supabase/migrations/20260429000001_storage_buckets.sql` (새 파일)

`utterances`, `tts-audio`, `photos`, `family-photos` 4개 버킷 생성.
모두 service_role 전용 RLS.

---

## 실행 순서

1. **P0-1**: STT→LLM 병렬화 (20분)
2. **P0-2**: 자동 녹음 재시작 강화 (10분)
3. **P0-3**: TTS base64 인라인 반환 (15분)
4. **P1-1**: 항상 듣는 모드 (30분)
5. **P1-2**: TTS 인터럽트 (20분)
6. **P1-3**: 대화 컨텍스트 유지 (30분)
7. **P1-4**: 적응형 침묵 감지 (20분)
8. **P2-1**: Edge TTS 타임아웃 5초 (5분)
9. **P2-2**: TTS 캐시 (15분)
10. **P3-1**: Storage 마이그레이션 (10분)
11. **빌드 검증**: `npm run build && npm run typecheck` (5분)

**총 예상 시간**: 3시간

---

## 수정 금지 영역

- `raw_utterances` 에 대한 UPDATE/DELETE
- RLS 정책 약화
- `lib/ai/prompts.ts`의 `ELDER_CHARACTER_SYSTEM_PROMPT` 본문 (금지어 규칙 추가만 허용, 기존 내용 수정 금지)
- 결제/인증 관련 코드
- `supabase/migrations/` 기존 파일
- **이미 완료된 항목** (위 "이미 완료된 것" 섹션 참조)

---

## 롤백 계획

모든 변경은 기존 동작의 상위 호환:

- **P0-1 롤백**: utterance save를 동기로 복원
- **P1-1 롤백**: `continuousMode` 상태 제거
- **P1-3 롤백**: `conversation_history` 파라미터 무시
- DB 스키마 변경 없음. 코드만 되돌리면 됨.

---

## 검증 시나리오 (전체 통합)

1. **정상 플로우**: 마이크 탭 → 발화 → 6초 침묵 → 자동 종료 → LLM 응답(2초 이내) → TTS → 자동 녹음 재시작
2. **TTS 실패 플로우**: Edge TTS 실패(5초) → 즉시 브라우저 TTS → 자동 녹음 재시작
3. **인터럽트**: TTS 재생 중 마이크 탭 → 즉시 중단 → 녹음 시작
4. **대화 컨텍스트**: 3턴째에 1턴째 내용 참조
5. **continuous mode**: 5턴 자동 순환 → idle에서 탭으로 종료
6. **빌드**: `npm run build && npm run typecheck` 성공

---

_v2 / 2026-04-29 / Claude Opus 4.6 설계, Codex 실행용_
