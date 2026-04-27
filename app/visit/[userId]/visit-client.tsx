'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  CreateSessionResponse,
  TranscriptEntry,
  VisitPhase,
} from '@/lib/types';

// =====================================================
// Visit Page — 태블릿 Kiosk 전체화면 음성 대화 UI
// =====================================================

const MAX_DURATION_MS = 10 * 60 * 1000; // 10분

export function VisitPageClient({ userId }: { userId: string }) {

  // ── State ──────────────────────────────────────
  const [phase, setPhase] = useState<VisitPhase>('idle');
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [currentText, setCurrentText] = useState('');
  const [currentSpeaker, setCurrentSpeaker] = useState<'user' | 'assistant' | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // ── Refs ───────────────────────────────────────
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const sessionRef = useRef<{ sessionId: string; userId: string } | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);
  const endingRef = useRef(false);

  // ── 경과 시간 타이머 ──────────────────────────
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

  // ── 발화 저장 ─────────────────────────────────
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

  // ── WebRTC 연결 시작 ──────────────────────────
  const handleStart = useCallback(async () => {
    setPhase('connecting');
    setError(null);

    try {
      // 1) 세션 + ephemeral token 요청
      const res = await fetch('/api/visit/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, channel: 'tablet' }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Session creation failed');
      }

      const session: CreateSessionResponse = await res.json();
      sessionRef.current = { sessionId: session.sessionId, userId };

      // 2) PeerConnection 생성
      const pc = new RTCPeerConnection();
      pcRef.current = pc;

      // 원격 오디오 재생 설정
      const audioEl = new Audio();
      audioEl.autoplay = true;
      audioRef.current = audioEl;

      pc.ontrack = (e) => {
        audioEl.srcObject = e.streams[0];
      };

      // 마이크 획득 & 트랙 추가
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      // 3) Data Channel 생성 (이벤트 수신용)
      const dc = pc.createDataChannel('oai-events');
      dcRef.current = dc;

      dc.onopen = () => {
        // 세션 설정 업데이트 (한국어 지시)
        dc.send(JSON.stringify({
          type: 'session.update',
          session: {
            input_audio_transcription: {
              model: 'whisper-1',
              language: 'ko',
            },
          },
        }));
      };

      dc.onmessage = (e) => {
        try {
          const event = JSON.parse(e.data);
          handleRealtimeEvent(event);
        } catch {
          // non-JSON 메시지 무시
        }
      };

      // 4) SDP offer 생성 & OpenAI에 전송
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const sdpRes = await fetch(
        `https://api.openai.com/v1/realtime?model=${session.model}`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.ephemeralToken}`,
            'Content-Type': 'application/sdp',
          },
          body: offer.sdp,
        },
      );

      if (!sdpRes.ok) {
        throw new Error('WebRTC SDP negotiation failed');
      }

      const answerSdp = await sdpRes.text();
      await pc.setRemoteDescription({ type: 'answer', sdp: answerSdp });

      setPhase('active');
    } catch (err) {
      console.error('Connection error:', err);
      setError(err instanceof Error ? err.message : 'Connection failed');
      setPhase('idle');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // ── Realtime 이벤트 핸들러 ────────────────────
  const handleRealtimeEvent = useCallback(
    (event: Record<string, unknown>) => {
      const type = event.type as string;

      switch (type) {
        // 사용자 발화 전사 완료
        case 'conversation.item.input_audio_transcription.completed': {
          const text = (event.transcript as string) ?? '';
          if (text.trim()) {
            const entry: TranscriptEntry = {
              id: crypto.randomUUID(),
              speaker: 'user',
              text: text.trim(),
              timestamp: Date.now(),
            };
            setTranscript((prev) => [...prev, entry]);
            setCurrentText('');
            setCurrentSpeaker(null);
            saveUtterance('user', text);
          }
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
          setCurrentText('...');
          break;
        }

        // 사용자 말하기 중지
        case 'input_audio_buffer.speech_stopped': {
          // 전사 완료 이벤트에서 처리
          break;
        }

        default:
          break;
      }
    },
    [saveUtterance],
  );

  // ── 세션 종료 ─────────────────────────────────
  const handleEnd = useCallback(async () => {
    if (endingRef.current) return;
    endingRef.current = true;
    setPhase('ending');

    // 타이머 정리
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    // WebRTC 정리
    if (dcRef.current) {
      dcRef.current.close();
      dcRef.current = null;
    }
    if (pcRef.current) {
      pcRef.current.getSenders().forEach((sender) => {
        sender.track?.stop();
      });
      pcRef.current.close();
      pcRef.current = null;
    }
    if (audioRef.current) {
      audioRef.current.srcObject = null;
      audioRef.current = null;
    }

    // 세션 종료 API 호출
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

  // ── 컴포넌트 언마운트 시 정리 ────────────────
  useEffect(() => {
    return () => {
      if (pcRef.current) {
        pcRef.current.getSenders().forEach((s) => s.track?.stop());
        pcRef.current.close();
      }
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // ── 시간 포맷 ─────────────────────────────────
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // ── 렌더 ─────────────────────────────────────
  return (
    <div style={styles.container}>
      {/* 상단 바 */}
      {phase === 'active' && (
        <div style={styles.topBar}>
          <span style={styles.clock}>
            {new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
          </span>
          <span style={styles.timer}>{formatTime(elapsed)}</span>
        </div>
      )}

      {/* 메인 콘텐츠 */}
      <div style={styles.mainContent}>
        {/* === IDLE 상태 === */}
        {phase === 'idle' && (
          <div style={styles.centerContent}>
            <div style={styles.logo}>MOT</div>
            <p style={styles.subtitle}>매일 저녁, 당신을 찾아가는 손님</p>
            {error && <p style={styles.errorText}>{error}</p>}
            <button
              onClick={handleStart}
              style={styles.startButton}
              id="btn-start-visit"
            >
              대화 시작하기
            </button>
          </div>
        )}

        {/* === CONNECTING 상태 === */}
        {phase === 'connecting' && (
          <div style={styles.centerContent}>
            <div style={styles.pulseOuter}>
              <div style={styles.pulseInner} />
            </div>
            <p style={styles.statusText}>연결하고 있어요...</p>
          </div>
        )}

        {/* === ACTIVE 상태 === */}
        {phase === 'active' && (
          <>
            {/* 파형 시각화 영역 */}
            <div style={styles.waveformArea}>
              <div
                style={{
                  ...styles.waveformCircle,
                  ...(currentSpeaker === 'assistant'
                    ? styles.waveformAI
                    : currentSpeaker === 'user'
                      ? styles.waveformUser
                      : styles.waveformIdle),
                }}
              >
                <div style={styles.waveformInner} />
              </div>
              <p style={styles.speakerLabel}>
                {currentSpeaker === 'assistant'
                  ? '손님이 말하고 있어요'
                  : currentSpeaker === 'user'
                    ? '듣고 있어요...'
                    : ''}
              </p>
            </div>

            {/* 자막 영역 */}
            <div style={styles.subtitleArea}>
              {/* 최근 대화 2개 */}
              {transcript.slice(-2).map((entry) => (
                <div
                  key={entry.id}
                  style={{
                    ...styles.transcriptLine,
                    ...(entry.speaker === 'user'
                      ? styles.transcriptUser
                      : styles.transcriptAssistant),
                  }}
                >
                  <span style={styles.transcriptSpeaker}>
                    {entry.speaker === 'user' ? '나' : '손님'}
                  </span>
                  <span>{entry.text}</span>
                </div>
              ))}
              {/* 현재 진행 중 텍스트 */}
              {currentText && (
                <div
                  style={{
                    ...styles.transcriptLine,
                    ...styles.transcriptCurrent,
                  }}
                >
                  <span style={styles.transcriptSpeaker}>
                    {currentSpeaker === 'user' ? '나' : '손님'}
                  </span>
                  <span>{currentText}</span>
                </div>
              )}
            </div>
          </>
        )}

        {/* === ENDING 상태 === */}
        {phase === 'ending' && (
          <div style={styles.centerContent}>
            <p style={styles.statusText}>대화를 마무리하고 있어요...</p>
          </div>
        )}

        {/* === ENDED 상태 === */}
        {phase === 'ended' && (
          <div style={styles.centerContent}>
            <div style={styles.checkmark}>✓</div>
            <p style={styles.endTitle}>오늘도 좋은 시간이었어요</p>
            <p style={styles.endSubtitle}>
              {formatTime(elapsed)} 동안 대화했어요
            </p>
            <p style={styles.endHint}>내일 또 찾아올게요</p>
          </div>
        )}
      </div>

      {/* 하단 종료 버튼 (대화 중일 때만) */}
      {phase === 'active' && (
        <button
          onClick={handleEnd}
          style={styles.endButton}
          id="btn-end-visit"
        >
          대화 끝내기
        </button>
      )}

      {/* CSS 애니메이션 */}
      <style>{animationCSS}</style>
    </div>
  );
}

// =====================================================
// 스타일
// =====================================================

const styles: Record<string, React.CSSProperties> = {
  container: {
    position: 'fixed',
    inset: 0,
    display: 'flex',
    flexDirection: 'column',
    background: 'linear-gradient(145deg, #0a0a0f 0%, #111128 50%, #0d0d1a 100%)',
    color: '#e8e8f0',
    fontFamily: "'Pretendard', 'Apple SD Gothic Neo', sans-serif",
    overflow: 'hidden',
    userSelect: 'none',
    WebkitUserSelect: 'none',
  },
  topBar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '24px 32px',
    fontSize: '16px',
    opacity: 0.6,
  },
  clock: {
    fontVariantNumeric: 'tabular-nums',
  },
  timer: {
    fontVariantNumeric: 'tabular-nums',
    background: 'rgba(255,255,255,0.08)',
    padding: '4px 12px',
    borderRadius: '20px',
    fontSize: '14px',
  },
  mainContent: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '0 32px',
  },
  centerContent: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '20px',
  },

  // ── IDLE ────
  logo: {
    fontSize: '64px',
    fontWeight: 700,
    letterSpacing: '8px',
    background: 'linear-gradient(135deg, #a78bfa, #818cf8, #6366f1)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    marginBottom: '8px',
  },
  subtitle: {
    fontSize: '18px',
    color: 'rgba(255,255,255,0.5)',
    marginBottom: '32px',
  },
  startButton: {
    padding: '20px 64px',
    fontSize: '20px',
    fontWeight: 600,
    background: 'linear-gradient(135deg, #7c3aed, #6366f1)',
    color: '#fff',
    border: 'none',
    borderRadius: '60px',
    cursor: 'pointer',
    boxShadow: '0 8px 32px rgba(99,102,241,0.4)',
    transition: 'all 0.3s ease',
    letterSpacing: '1px',
  },
  errorText: {
    color: '#f87171',
    fontSize: '14px',
    background: 'rgba(248,113,113,0.1)',
    padding: '8px 16px',
    borderRadius: '8px',
  },

  // ── CONNECTING ──
  pulseOuter: {
    width: '120px',
    height: '120px',
    borderRadius: '50%',
    background: 'rgba(99,102,241,0.15)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    animation: 'pulse 2s ease-in-out infinite',
  },
  pulseInner: {
    width: '60px',
    height: '60px',
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #7c3aed, #6366f1)',
    animation: 'pulse 2s ease-in-out infinite reverse',
  },
  statusText: {
    fontSize: '18px',
    color: 'rgba(255,255,255,0.6)',
    marginTop: '16px',
  },

  // ── ACTIVE ──
  waveformArea: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '24px',
    marginBottom: '48px',
  },
  waveformCircle: {
    width: '160px',
    height: '160px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.6s ease',
  },
  waveformAI: {
    background: 'radial-gradient(circle, rgba(99,102,241,0.3) 0%, rgba(99,102,241,0.05) 70%)',
    boxShadow: '0 0 60px rgba(99,102,241,0.3), 0 0 120px rgba(99,102,241,0.1)',
    animation: 'breathe 1.5s ease-in-out infinite',
  },
  waveformUser: {
    background: 'radial-gradient(circle, rgba(52,211,153,0.3) 0%, rgba(52,211,153,0.05) 70%)',
    boxShadow: '0 0 60px rgba(52,211,153,0.3), 0 0 120px rgba(52,211,153,0.1)',
    animation: 'breathe 1.2s ease-in-out infinite',
  },
  waveformIdle: {
    background: 'radial-gradient(circle, rgba(255,255,255,0.05) 0%, transparent 70%)',
    boxShadow: '0 0 40px rgba(255,255,255,0.05)',
  },
  waveformInner: {
    width: '80px',
    height: '80px',
    borderRadius: '50%',
    background: 'rgba(255,255,255,0.03)',
    backdropFilter: 'blur(20px)',
    border: '1px solid rgba(255,255,255,0.08)',
  },
  speakerLabel: {
    fontSize: '15px',
    color: 'rgba(255,255,255,0.4)',
    height: '20px',
  },

  // ── SUBTITLE ──
  subtitleArea: {
    width: '100%',
    maxWidth: '600px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    minHeight: '120px',
  },
  transcriptLine: {
    padding: '12px 20px',
    borderRadius: '16px',
    fontSize: '17px',
    lineHeight: '1.6',
    display: 'flex',
    gap: '8px',
    animation: 'fadeIn 0.3s ease',
  },
  transcriptUser: {
    background: 'rgba(52,211,153,0.08)',
    border: '1px solid rgba(52,211,153,0.15)',
    alignSelf: 'flex-end',
  },
  transcriptAssistant: {
    background: 'rgba(99,102,241,0.08)',
    border: '1px solid rgba(99,102,241,0.15)',
    alignSelf: 'flex-start',
  },
  transcriptCurrent: {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    opacity: 0.7,
  },
  transcriptSpeaker: {
    fontWeight: 600,
    fontSize: '14px',
    opacity: 0.5,
    minWidth: '28px',
  },

  // ── END BUTTON ──
  endButton: {
    margin: '24px auto 48px',
    padding: '16px 48px',
    fontSize: '17px',
    fontWeight: 500,
    background: 'rgba(255,255,255,0.06)',
    color: 'rgba(255,255,255,0.5)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '48px',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    letterSpacing: '0.5px',
  },

  // ── ENDED ──
  checkmark: {
    width: '80px',
    height: '80px',
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #34d399, #10b981)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '36px',
    color: '#fff',
    marginBottom: '16px',
  },
  endTitle: {
    fontSize: '24px',
    fontWeight: 600,
  },
  endSubtitle: {
    fontSize: '16px',
    color: 'rgba(255,255,255,0.5)',
  },
  endHint: {
    fontSize: '15px',
    color: 'rgba(255,255,255,0.3)',
    marginTop: '32px',
  },
};

// =====================================================
// CSS 애니메이션 (인라인 keyframes)
// =====================================================
const animationCSS = `
@keyframes pulse {
  0%, 100% { transform: scale(1); opacity: 0.8; }
  50% { transform: scale(1.15); opacity: 1; }
}

@keyframes breathe {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.08); }
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}

/* 터치 하이라이트 제거 (태블릿) */
* {
  -webkit-tap-highlight-color: transparent;
}

/* 종료 버튼 호버 */
#btn-end-visit:hover {
  background: rgba(248, 113, 113, 0.15) !important;
  border-color: rgba(248, 113, 113, 0.3) !important;
  color: #f87171 !important;
}

/* 시작 버튼 호버 */
#btn-start-visit:hover {
  transform: translateY(-2px);
  box-shadow: 0 12px 40px rgba(99,102,241,0.5);
}
`;
