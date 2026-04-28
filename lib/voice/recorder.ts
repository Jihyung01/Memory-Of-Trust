/**
 * 브라우저 음성 녹음 유틸리티
 *
 * MediaRecorder API로 webm/opus 녹음.
 * 어르신 디바이스(T5)에서 사용.
 *
 * 무음 감지: AudioContext AnalyserNode로 볼륨 모니터링.
 * 일정 시간 무음이면 자동 종료 콜백 호출.
 */

export interface RecordingResult {
  blob: Blob;
  durationSec: number;
}

export interface RecorderOptions {
  /** 무음 판정 임계값 (0~255, 기본 15) — 높을수록 둔감 */
  silenceThreshold?: number;
  /** 이 시간(ms) 동안 연속 무음이면 자동 종료 (기본 3000ms = 3초) */
  silenceDurationMs?: number;
  /** 최대 녹음 시간(ms) (기본 60000ms = 60초) */
  maxDurationMs?: number;
  /** 자동 종료 시 호출되는 콜백 */
  onAutoStop?: () => void;
}

export class VoiceRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private startTime = 0;
  private stream: MediaStream | null = null;

  // 무음 감지
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private silenceCheckInterval: ReturnType<typeof setInterval> | null = null;
  private maxDurationTimer: ReturnType<typeof setTimeout> | null = null;
  private silenceStart = 0;
  private options: RecorderOptions = {};

  async start(options: RecorderOptions = {}): Promise<void> {
    if (this.mediaRecorder?.state === "recording") {
      return;
    }

    this.options = options;
    this.chunks = [];

    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: false, // 배경 잡음 증폭 방지 — 무음 감지 정확도 향상
      },
    });

    // webm/opus가 가장 넓게 지원됨
    const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
      ? "audio/webm;codecs=opus"
      : "audio/webm";

    this.mediaRecorder = new MediaRecorder(this.stream, { mimeType });

    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        this.chunks.push(event.data);
      }
    };

    this.startTime = Date.now();
    this.mediaRecorder.start(500); // 500ms 청크

    // 무음 감지 시작
    this.startSilenceDetection();

    // 최대 녹음 시간 타이머
    const maxMs = options.maxDurationMs ?? 60000;
    this.maxDurationTimer = setTimeout(() => {
      if (this.isRecording) {
        options.onAutoStop?.();
      }
    }, maxMs);
  }

  private startSilenceDetection(): void {
    const threshold = this.options.silenceThreshold ?? 15;
    const silenceDuration = this.options.silenceDurationMs ?? 3000;

    try {
      this.audioContext = new AudioContext();

      // Chrome에서 AudioContext가 suspended로 시작될 수 있음 — 반드시 resume
      if (this.audioContext.state === "suspended") {
        this.audioContext.resume().catch(() => {});
      }

      const source = this.audioContext.createMediaStreamSource(this.stream!);
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 512;
      source.connect(this.analyser);

      // TimeDomain 방식: 값이 128 중심, 무음이면 128 근처
      // Frequency 방식보다 노이즈 서프레션 환경에서 더 신뢰성 높음
      const dataArray = new Uint8Array(this.analyser.fftSize);
      this.silenceStart = 0;
      let autoStopped = false;

      // 200ms마다 볼륨 체크
      this.silenceCheckInterval = setInterval(() => {
        if (!this.analyser || !this.isRecording || autoStopped) return;

        this.analyser.getByteTimeDomainData(dataArray);

        // RMS(Root Mean Square) 볼륨 — 128 중심에서의 편차
        let sumSquares = 0;
        for (let i = 0; i < dataArray.length; i++) {
          const deviation = dataArray[i] - 128;
          sumSquares += deviation * deviation;
        }
        const rms = Math.sqrt(sumSquares / dataArray.length);

        if (rms < threshold) {
          // 무음
          if (this.silenceStart === 0) {
            this.silenceStart = Date.now();
          } else if (Date.now() - this.silenceStart > silenceDuration) {
            // 연속 무음 시간 초과 → 자동 종료
            // 최소 1초 이상 녹음된 경우에만
            if (Date.now() - this.startTime > 1500) {
              autoStopped = true;
              console.log(
                `[VoiceRecorder] Auto-stop: ${silenceDuration}ms silence detected`
              );
              this.options.onAutoStop?.();
            }
          }
        } else {
          // 소리 감지 → 무음 타이머 리셋
          this.silenceStart = 0;
        }
      }, 200);
    } catch {
      // AudioContext 지원 안 되면 무음 감지 없이 진행
      console.warn("AudioContext not supported, silence detection disabled");
    }
  }

  private stopSilenceDetection(): void {
    if (this.silenceCheckInterval) {
      clearInterval(this.silenceCheckInterval);
      this.silenceCheckInterval = null;
    }
    if (this.maxDurationTimer) {
      clearTimeout(this.maxDurationTimer);
      this.maxDurationTimer = null;
    }
    if (this.audioContext) {
      this.audioContext.close().catch(() => {});
      this.audioContext = null;
    }
    this.analyser = null;
  }

  async stop(): Promise<RecordingResult> {
    this.stopSilenceDetection();

    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder || this.mediaRecorder.state !== "recording") {
        reject(new Error("Not recording"));
        return;
      }

      this.mediaRecorder.onstop = () => {
        const durationSec = (Date.now() - this.startTime) / 1000;
        const blob = new Blob(this.chunks, {
          type: this.mediaRecorder?.mimeType ?? "audio/webm",
        });

        // 스트림 트랙 정리
        this.stream?.getTracks().forEach((track) => track.stop());
        this.stream = null;
        this.mediaRecorder = null;
        this.chunks = [];

        resolve({ blob, durationSec });
      };

      this.mediaRecorder.onerror = () => {
        this.stream?.getTracks().forEach((track) => track.stop());
        this.stream = null;
        reject(new Error("Recording failed"));
      };

      this.mediaRecorder.stop();
    });
  }

  get isRecording(): boolean {
    return this.mediaRecorder?.state === "recording";
  }

  /** 녹음 중단 + 스트림 정리 (결과 없이) */
  dispose(): void {
    this.stopSilenceDetection();
    if (this.mediaRecorder?.state === "recording") {
      this.mediaRecorder.stop();
    }
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
    this.mediaRecorder = null;
    this.chunks = [];
  }
}
