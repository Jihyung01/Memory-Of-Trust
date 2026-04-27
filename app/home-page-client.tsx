'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  CreateSessionResponse,
  TranscriptEntry,
  VisitPhase,
} from '@/lib/types';

// =====================================================
// MOT — 메인 페이지
// 오로라 구체 + 시계 (idle) → 대화 모드 (active)
// =====================================================

const MAX_DURATION_MS = 15 * 60 * 1000; // 15분
const TEST_USER_ID = process.env.NEXT_PUBLIC_TEST_USER_ID ?? '00000000-0000-0000-0000-000000000001';
// 한국어 환각 필터: 너무 짧거나 반복 패턴
const MIN_TRANSCRIPT_LENGTH = 2;
const HALLUCINATION_PATTERNS = [
  /^(아|어|음|흠|으|에|이)+$/,
  /^\.+$/,
  /^(MBC|SBS|KBS|TV|BGM)+$/i,
  /^(시청해\s*주셔서\s*감사합니다|구독|좋아요|알림)/,
  /^(자막|번역|제공)/,
  /^(\s)+$/,
];

function isHallucination(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length < MIN_TRANSCRIPT_LENGTH) return true;
  return HALLUCINATION_PATTERNS.some(p => p.test(trimmed));
}

export function HomePageClient() {
  // ── Phase & UI State ─────────────────────────────
  const [phase, setPhase] = useState<VisitPhase>('idle');
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [currentText, setCurrentText] = useState('');
  const [currentSpeaker, setCurrentSpeaker] = useState<'user' | 'assistant' | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  /** SSR과 첫 하이드레이트 시각이 달라지지 않도록, 실제 시각은 마운트 후에만 씀 */
  const [now, setNow] = useState<Date | null>(null);
  const [orbHover, setOrbHover] = useState(false);
  const [showHint, setShowHint] = useState(false);

  // ── Refs ──────────────────────────────────────────
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const sessionRef = useRef<{ sessionId: string; userId: string } | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);
  const endingRef = useRef(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameRef = useRef<number>(0);

  // ── 실시간 시계 (클라이언트에서만; SSR/하이드레이트 시각 불일치 방지) ──
  useEffect(() => {
    setNow(new Date());
    const clockInterval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(clockInterval);
  }, []);

  // ── Hint 3초 후 표시 ─────────────────────────────
  useEffect(() => {
    if (phase === 'idle') {
      const t = setTimeout(() => setShowHint(true), 3000);
      return () => clearTimeout(t);
    }
    setShowHint(false);
  }, [phase]);

  // ── 오로라 구체 Canvas 애니메이션 ────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const size = 500;
    canvas.width = size;
    canvas.height = size;
    const cx = size / 2;
    const cy = size / 2;

    let time = 0;
    const draw = () => {
      time += 0.008;
      ctx.clearRect(0, 0, size, size);

      // 외부 원 클리핑
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, 190, 0, Math.PI * 2);
      ctx.clip();

      // 배경 어두운 구체
      const bgGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, 200);
      bgGrad.addColorStop(0, 'rgba(8, 12, 30, 1)');
      bgGrad.addColorStop(1, 'rgba(2, 3, 10, 1)');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, size, size);

      // 오로라 레이어 1 — 시안/블루
      for (let i = 0; i < 5; i++) {
        const offset = i * 0.7;
        ctx.beginPath();
        ctx.moveTo(cx - 200, cy + 30 * Math.sin(time * 1.2 + offset));
        ctx.bezierCurveTo(
          cx - 80, cy - 120 + 40 * Math.sin(time * 0.9 + offset),
          cx + 60, cy - 80 + 50 * Math.cos(time * 1.1 + offset),
          cx + 200, cy + 20 * Math.sin(time * 0.7 + offset)
        );
        ctx.bezierCurveTo(
          cx + 100, cy + 60 + 30 * Math.cos(time + offset),
          cx - 60, cy + 80 + 20 * Math.sin(time * 1.3 + offset),
          cx - 200, cy + 30 * Math.sin(time * 1.2 + offset)
        );
        ctx.closePath();

        const grad = ctx.createLinearGradient(cx - 200, cy - 100, cx + 200, cy + 100);
        grad.addColorStop(0, `rgba(0, 200, 255, ${0.04 - i * 0.005})`);
        grad.addColorStop(0.4, `rgba(20, 180, 220, ${0.08 - i * 0.01})`);
        grad.addColorStop(0.7, `rgba(60, 140, 255, ${0.06 - i * 0.008})`);
        grad.addColorStop(1, `rgba(100, 80, 255, ${0.03 - i * 0.004})`);
        ctx.fillStyle = grad;
        ctx.fill();
      }

      // 오로라 레이어 2 — 마젠타/핑크 하단
      for (let i = 0; i < 3; i++) {
        const offset = i * 0.9;
        ctx.beginPath();
        ctx.moveTo(cx - 200, cy + 100 + 20 * Math.sin(time * 0.8 + offset));
        ctx.bezierCurveTo(
          cx - 60, cy + 40 + 50 * Math.cos(time * 0.6 + offset),
          cx + 80, cy + 60 + 30 * Math.sin(time * 1.0 + offset),
          cx + 200, cy + 120 + 15 * Math.cos(time * 0.5 + offset)
        );
        ctx.bezierCurveTo(
          cx + 120, cy + 180 + 10 * Math.sin(time * 0.9),
          cx - 80, cy + 190,
          cx - 200, cy + 100 + 20 * Math.sin(time * 0.8 + offset)
        );
        ctx.closePath();

        const grad = ctx.createLinearGradient(cx - 200, cy + 50, cx + 200, cy + 200);
        grad.addColorStop(0, `rgba(180, 40, 200, ${0.06 - i * 0.015})`);
        grad.addColorStop(0.5, `rgba(220, 60, 180, ${0.08 - i * 0.02})`);
        grad.addColorStop(1, `rgba(255, 100, 150, ${0.04 - i * 0.01})`);
        ctx.fillStyle = grad;
        ctx.fill();
      }

      // 밝은 코어 글로우
      const coreGrad = ctx.createRadialGradient(cx - 20, cy - 30, 0, cx, cy, 160);
      coreGrad.addColorStop(0, 'rgba(100, 220, 255, 0.08)');
      coreGrad.addColorStop(0.3, 'rgba(60, 160, 220, 0.04)');
      coreGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = coreGrad;
      ctx.fillRect(0, 0, size, size);

      ctx.restore();

      // 구체 테두리 — 미세한 글로우
      ctx.beginPath();
      ctx.arc(cx, cy, 190, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(100, 180, 255, 0.08)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // 외부 글로우
      const outerGlow = ctx.createRadialGradient(cx, cy, 170, cx, cy, 250);
      outerGlow.addColorStop(0, 'rgba(60, 140, 220, 0.04)');
      outerGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = outerGlow;
      ctx.beginPath();
      ctx.arc(cx, cy, 250, 0, Math.PI * 2);
      ctx.fill();

      animFrameRef.current = requestAnimationFrame(draw);
    };

    draw();
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [phase]);

  // ── 경과 시간 타이머 ─────────────────────────────
  useEffect(() => {
    if (phase === 'active') {
      startTimeRef.current = Date.now();
      timerRef.current = setInterval(() => {
        const secs = Math.round((Date.now() - startTimeRef.current) / 1000);
        setElapsed(secs);
        if (secs * 1000 >= MAX_DURATION_MS) {
          handleEnd();
        }
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // ── 발화 저장 ────────────────────────────────────
  const saveUtterance = useCallback(
    async (speaker: 'user' | 'assistant', text: string) => {
      if (!sessionRef.current || !text.trim()) return;
      try {
        await fetch('/api/visit/utterance', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId: sessionRef.current.sessionId,
            userId: sessionRef.current.userId,
            speaker,
            text: text.trim(),
            startedAt: new Date().toISOString(),
          }),
        });
      } catch (err) {
        console.error('Failed to save utterance:', err);
      }
    },
    [],
  );

  // ── WebRTC 연결 시작 ─────────────────────────────
  const handleStart = useCallback(async () => {
    setPhase('connecting');
    setError(null);
    setTranscript([]);
    setCurrentText('');
    endingRef.current = false;

    try {
      // 1) 세션 + ephemeral token
      const res = await fetch('/api/visit/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: TEST_USER_ID, channel: 'tablet' }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Session creation failed');
      }

      const session: CreateSessionResponse = await res.json();
      sessionRef.current = { sessionId: session.sessionId, userId: TEST_USER_ID };

      // 2) PeerConnection
      const pc = new RTCPeerConnection();
      pcRef.current = pc;

      const audioEl = new Audio();
      audioEl.autoplay = true;
      audioRef.current = audioEl;

      pc.ontrack = (e) => {
        audioEl.srcObject = e.streams[0];
      };

      // 마이크 — 노이즈 억제 + 에코 캔슬 활성화
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 24000,
        },
      });
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      // 3) Data Channel
      const dc = pc.createDataChannel('oai-events');
      dcRef.current = dc;

      dc.onopen = () => {
        // 한국어 전사 설정 강화
        dc.send(JSON.stringify({
          type: 'session.update',
          session: {
            input_audio_transcription: {
              model: 'gpt-4o-transcribe',
              language: 'ko',
            },
            turn_detection: {
              type: 'server_vad',
              threshold: 0.6,
              prefix_padding_ms: 400,
              silence_duration_ms: 1200,
            },
          },
        }));
      };

      dc.onmessage = (e) => {
        try {
          const event = JSON.parse(e.data);
          handleRealtimeEvent(event);
        } catch {
          // ignore
        }
      };

      // 4) SDP
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const sdpRes = await fetch(
        `https://api.openai.com/v1/realtime?model=${session.model}`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.ephemeralToken}`,
            'Content-Type': 'application/sdp',
          },
          body: offer.sdp,
        },
      );

      if (!sdpRes.ok) throw new Error('WebRTC SDP negotiation failed');

      const answerSdp = await sdpRes.text();
      await pc.setRemoteDescription({ type: 'answer', sdp: answerSdp });

      setPhase('active');
    } catch (err) {
      console.error('Connection error:', err);
      setError(err instanceof Error ? err.message : 'Connection failed');
      setPhase('idle');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Realtime 이벤트 핸들러 ───────────────────────
  const handleRealtimeEvent = useCallback(
    (event: Record<string, unknown>) => {
      const type = event.type as string;

      switch (type) {
        // 사용자 발화 전사 완료
        case 'conversation.item.input_audio_transcription.completed': {
          const text = (event.transcript as string) ?? '';
          if (text.trim() && !isHallucination(text)) {
            const entry: TranscriptEntry = {
              id: crypto.randomUUID(),
              speaker: 'user',
              text: text.trim(),
              timestamp: Date.now(),
            };
            setTranscript((prev) => [...prev, entry]);
            saveUtterance('user', text);
          }
          setCurrentText('');
          setCurrentSpeaker(null);
          break;
        }

        // 전사 실패 — 조용히 무시
        case 'conversation.item.input_audio_transcription.failed': {
          setCurrentText('');
          setCurrentSpeaker(null);
          break;
        }

        // AI 응답 전사 진행 중
        case 'response.audio_transcript.delta': {
          const delta = (event.delta as string) ?? '';
          setCurrentSpeaker('assistant');
          setCurrentText((prev) => prev + delta);
          break;
        }

        // AI 응답 전사 완료
        case 'response.audio_transcript.done': {
          const text = (event.transcript as string) ?? '';
          if (text.trim()) {
            const entry: TranscriptEntry = {
              id: crypto.randomUUID(),
              speaker: 'assistant',
              text: text.trim(),
              timestamp: Date.now(),
            };
            setTranscript((prev) => [...prev, entry]);
            saveUtterance('assistant', text);
          }
          setCurrentText('');
          setCurrentSpeaker(null);
          break;
        }

        // 사용자 말하기 시작
        case 'input_audio_buffer.speech_started': {
          setCurrentSpeaker('user');
          setCurrentText('');
          break;
        }

        // 사용자 말하기 중지
        case 'input_audio_buffer.speech_stopped': {
          break;
        }

        default:
          break;
      }
    },
    [saveUtterance],
  );

  // ── 세션 종료 ────────────────────────────────────
  const handleEnd = useCallback(async () => {
    if (endingRef.current) return;
    endingRef.current = true;
    setPhase('ending');

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (dcRef.current) {
      dcRef.current.close();
      dcRef.current = null;
    }
    if (pcRef.current) {
      pcRef.current.getSenders().forEach((s) => s.track?.stop());
      pcRef.current.close();
      pcRef.current = null;
    }
    if (audioRef.current) {
      audioRef.current.srcObject = null;
      audioRef.current = null;
    }

    if (sessionRef.current) {
      try {
        await fetch('/api/visit/end', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId: sessionRef.current.sessionId,
            userId: sessionRef.current.userId,
          }),
        });
      } catch (err) {
        console.error('Failed to end session:', err);
      }
    }

    setPhase('ended');
  }, []);

  // ── 다시 시작 (ended → idle) ─────────────────────
  const handleReset = useCallback(() => {
    setPhase('idle');
    setTranscript([]);
    setCurrentText('');
    setCurrentSpeaker(null);
    setElapsed(0);
    setError(null);
    endingRef.current = false;
    sessionRef.current = null;
  }, []);

  // ── 언마운트 정리 ────────────────────────────────
  useEffect(() => {
    return () => {
      if (pcRef.current) {
        pcRef.current.getSenders().forEach((s) => s.track?.stop());
        pcRef.current.close();
      }
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // ── 시간 포맷 ────────────────────────────────────
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const timeDisplay = (() => {
    if (!now) {
      return { hm: '--:--', ampm: '\u00a0' as const, sec: '--', date: '\u00a0' };
    }
    const h = now.getHours();
    const m = now.getMinutes();
    const s = now.getSeconds();
    const h12 = h % 12 || 12;
    return {
      hm: `${String(h12).padStart(2, '0')}:${String(m).padStart(2, '0')}`,
      ampm: h >= 12 ? ('PM' as const) : ('AM' as const),
      sec: String(s).padStart(2, '0'),
      date: now.toLocaleDateString('ko-KR', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
      }),
    };
  })();

  // ── 렌더 ─────────────────────────────────────────
  return (
    <div style={S.root}>
      {/* ═══ IDLE — 오로라 구체 + 시계 ═══ */}
      {(phase === 'idle' || phase === 'connecting') && (
        <div style={S.idleContainer}>
          {/* 오로라 구체 */}
          <div
            style={{
              ...S.orbWrapper,
              transform: orbHover ? 'scale(1.03)' : 'scale(1)',
              cursor: phase === 'idle' ? 'pointer' : 'default',
            }}
            onMouseEnter={() => setOrbHover(true)}
            onMouseLeave={() => setOrbHover(false)}
            onClick={phase === 'idle' ? handleStart : undefined}
          >
            <canvas
              ref={canvasRef}
              style={S.canvas}
            />
            {phase === 'connecting' && (
              <div style={S.connectingOverlay}>
                <div style={S.connectingDot} />
              </div>
            )}
          </div>

          {/* 시계 */}
          <div style={S.clockArea}>
            <div style={S.clockTime}>
              <span style={S.clockHM}>{timeDisplay.hm}</span>
              <span style={S.clockAMPM}>{timeDisplay.ampm}</span>
            </div>
            <div style={S.clockSeconds}>:{timeDisplay.sec}</div>
            <div style={S.clockDate}>{timeDisplay.date}</div>
          </div>

          {/* 힌트 */}
          {showHint && phase === 'idle' && (
            <div style={S.hint}>
              구체를 눌러 대화를 시작하세요
            </div>
          )}

          {error && <div style={S.errorBadge}>{error}</div>}
        </div>
      )}

      {/* ═══ ACTIVE — 대화 모드 ═══ */}
      {phase === 'active' && (
        <div style={S.activeContainer}>
          {/* 상단 바 */}
          <div style={S.topBar}>
            <span style={S.topClock}>
              {timeDisplay.hm} {timeDisplay.ampm}
            </span>
            <span style={S.topBrand}>MOT</span>
            <span style={S.topTimer}>{formatTime(elapsed)}</span>
          </div>

          {/* 중앙 — 파형 + 상태 */}
          <div style={S.activeCenter}>
            <div
              style={{
                ...S.activeOrb,
                ...(currentSpeaker === 'assistant' ? S.orbAI :
                  currentSpeaker === 'user' ? S.orbUser : S.orbSilent),
              }}
            >
              <canvas ref={canvasRef} style={S.canvasSmall} />
            </div>
            <p style={S.speakerLabel}>
              {currentSpeaker === 'assistant'
                ? '이야기하고 있어요...'
                : currentSpeaker === 'user'
                  ? '듣고 있어요...'
                  : ''}
            </p>
          </div>

          {/* 자막 */}
          <div style={S.subtitleArea}>
            {transcript.slice(-3).map((entry) => (
              <div
                key={entry.id}
                style={{
                  ...S.bubble,
                  ...(entry.speaker === 'user' ? S.bubbleUser : S.bubbleAssistant),
                }}
              >
                <span style={S.bubbleSpeaker}>
                  {entry.speaker === 'user' ? '나' : '손님'}
                </span>
                <span>{entry.text}</span>
              </div>
            ))}
            {currentText && (
              <div style={{ ...S.bubble, ...S.bubbleCurrent }}>
                <span style={S.bubbleSpeaker}>
                  {currentSpeaker === 'user' ? '나' : '손님'}
                </span>
                <span>{currentText}</span>
              </div>
            )}
          </div>

          {/* 종료 버튼 */}
          <button onClick={handleEnd} style={S.endBtn} id="btn-end">
            대화 끝내기
          </button>
        </div>
      )}

      {/* ═══ ENDING ═══ */}
      {phase === 'ending' && (
        <div style={S.centerMessage}>
          <div style={S.endingPulse} />
          <p style={S.statusText}>대화를 마무리하고 있어요...</p>
        </div>
      )}

      {/* ═══ ENDED ═══ */}
      {phase === 'ended' && (
        <div style={S.centerMessage}>
          <div style={S.checkmark}>&#10003;</div>
          <p style={S.endTitle}>오늘도 좋은 시간이었어요</p>
          <p style={S.endSub}>{formatTime(elapsed)} 동안 대화했어요</p>
          <p style={S.endHint}>내일 또 찾아올게요</p>
          <button onClick={handleReset} style={S.resetBtn}>
            처음으로
          </button>
        </div>
      )}

      <style>{cssKeyframes}</style>
    </div>
  );
}

// =====================================================
// 스타일
// =====================================================
const S: Record<string, React.CSSProperties> = {
  root: {
    position: 'fixed',
    inset: 0,
    background: '#000',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },

  // ── IDLE ────────────────────────────────
  idleContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '32px',
    position: 'relative',
  },
  orbWrapper: {
    width: '380px',
    height: '380px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'transform 0.6s cubic-bezier(0.16, 1, 0.3, 1)',
    position: 'relative',
  },
  canvas: {
    width: '380px',
    height: '380px',
    borderRadius: '50%',
  },
  connectingOverlay: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(0,0,0,0.3)',
    borderRadius: '50%',
  },
  connectingDot: {
    width: '16px',
    height: '16px',
    borderRadius: '50%',
    background: '#fff',
    animation: 'pulse 1.5s ease-in-out infinite',
  },
  clockArea: {
    textAlign: 'center' as const,
    marginTop: '8px',
  },
  clockTime: {
    display: 'flex',
    alignItems: 'baseline',
    justifyContent: 'center',
    gap: '6px',
  },
  clockHM: {
    fontSize: '64px',
    fontWeight: 200,
    letterSpacing: '2px',
    color: '#e8e8f0',
    fontVariantNumeric: 'tabular-nums',
  },
  clockAMPM: {
    fontSize: '20px',
    fontWeight: 400,
    color: 'rgba(255,255,255,0.5)',
  },
  clockSeconds: {
    fontSize: '16px',
    color: 'rgba(255,255,255,0.3)',
    fontVariantNumeric: 'tabular-nums',
    marginTop: '-8px',
  },
  clockDate: {
    fontSize: '16px',
    color: 'rgba(255,255,255,0.4)',
    marginTop: '8px',
    fontWeight: 300,
  },
  hint: {
    fontSize: '14px',
    color: 'rgba(255,255,255,0.25)',
    animation: 'fadeIn 1s ease',
    marginTop: '16px',
  },
  errorBadge: {
    fontSize: '13px',
    color: '#f87171',
    background: 'rgba(248,113,113,0.1)',
    padding: '8px 20px',
    borderRadius: '20px',
    marginTop: '8px',
  },

  // ── ACTIVE ──────────────────────────────
  activeContainer: {
    position: 'fixed',
    inset: 0,
    display: 'flex',
    flexDirection: 'column',
    background: '#000',
  },
  topBar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '20px 28px',
    fontSize: '14px',
    color: 'rgba(255,255,255,0.4)',
  },
  topClock: {
    fontVariantNumeric: 'tabular-nums',
  },
  topBrand: {
    fontSize: '15px',
    fontWeight: 600,
    letterSpacing: '3px',
    color: 'rgba(255,255,255,0.25)',
  },
  topTimer: {
    fontVariantNumeric: 'tabular-nums',
    background: 'rgba(255,255,255,0.06)',
    padding: '4px 14px',
    borderRadius: '20px',
    fontSize: '13px',
  },
  activeCenter: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '20px',
    minHeight: 0,
  },
  activeOrb: {
    width: '200px',
    height: '200px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.6s ease',
    overflow: 'hidden',
  },
  canvasSmall: {
    width: '200px',
    height: '200px',
  },
  orbAI: {
    boxShadow: '0 0 60px rgba(80,140,255,0.25), 0 0 120px rgba(80,140,255,0.08)',
    animation: 'breathe 1.8s ease-in-out infinite',
  },
  orbUser: {
    boxShadow: '0 0 60px rgba(52,211,153,0.25), 0 0 120px rgba(52,211,153,0.08)',
    animation: 'breathe 1.2s ease-in-out infinite',
  },
  orbSilent: {
    boxShadow: '0 0 30px rgba(255,255,255,0.03)',
  },
  speakerLabel: {
    fontSize: '14px',
    color: 'rgba(255,255,255,0.35)',
    height: '20px',
  },

  // ── SUBTITLES ───────────────────────────
  subtitleArea: {
    width: '100%',
    maxWidth: '640px',
    margin: '0 auto',
    padding: '0 28px 16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    minHeight: '140px',
    maxHeight: '240px',
    overflowY: 'auto',
  },
  bubble: {
    padding: '10px 18px',
    borderRadius: '14px',
    fontSize: '16px',
    lineHeight: 1.6,
    display: 'flex',
    gap: '8px',
    animation: 'fadeIn 0.25s ease',
  },
  bubbleUser: {
    background: 'rgba(52,211,153,0.07)',
    border: '1px solid rgba(52,211,153,0.12)',
    alignSelf: 'flex-end',
  },
  bubbleAssistant: {
    background: 'rgba(100,140,255,0.07)',
    border: '1px solid rgba(100,140,255,0.12)',
    alignSelf: 'flex-start',
  },
  bubbleCurrent: {
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.06)',
    opacity: 0.7,
  },
  bubbleSpeaker: {
    fontWeight: 600,
    fontSize: '13px',
    opacity: 0.4,
    minWidth: '28px',
    flexShrink: 0,
  },

  // ── END BUTTON ──────────────────────────
  endBtn: {
    margin: '8px auto 36px',
    padding: '14px 48px',
    fontSize: '15px',
    fontWeight: 400,
    background: 'rgba(255,255,255,0.04)',
    color: 'rgba(255,255,255,0.4)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '40px',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    letterSpacing: '0.5px',
  },

  // ── CENTER MESSAGE ──────────────────────
  centerMessage: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '16px',
  },
  endingPulse: {
    width: '80px',
    height: '80px',
    borderRadius: '50%',
    background: 'rgba(100,140,255,0.1)',
    animation: 'pulse 2s ease-in-out infinite',
  },
  statusText: {
    fontSize: '17px',
    color: 'rgba(255,255,255,0.5)',
  },
  checkmark: {
    width: '72px',
    height: '72px',
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #34d399, #10b981)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '32px',
    color: '#fff',
  },
  endTitle: {
    fontSize: '22px',
    fontWeight: 500,
    color: '#e8e8f0',
  },
  endSub: {
    fontSize: '15px',
    color: 'rgba(255,255,255,0.4)',
  },
  endHint: {
    fontSize: '14px',
    color: 'rgba(255,255,255,0.2)',
    marginTop: '20px',
  },
  resetBtn: {
    marginTop: '24px',
    padding: '12px 36px',
    fontSize: '14px',
    background: 'rgba(255,255,255,0.06)',
    color: 'rgba(255,255,255,0.5)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '30px',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
  },
};

const cssKeyframes = `
@keyframes pulse {
  0%, 100% { transform: scale(1); opacity: 0.7; }
  50% { transform: scale(1.12); opacity: 1; }
}
@keyframes breathe {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.06); }
}
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(6px); }
  to { opacity: 1; transform: translateY(0); }
}
#btn-end:hover {
  background: rgba(248, 113, 113, 0.1) !important;
  border-color: rgba(248, 113, 113, 0.2) !important;
  color: #f87171 !important;
}
`;
