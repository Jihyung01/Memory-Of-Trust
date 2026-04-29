/**
 * Edge TTS (Microsoft) — 완전 무료
 *
 * Microsoft Edge 브라우저의 "소리내어 읽기" 백엔드 활용.
 * API 키 불필요. 한국어 뉴럴 음성 지원.
 *
 * 한국어 음성 옵션:
 *   - ko-KR-SunHiNeural  (여성, 따뜻함 — 기본값)
 *   - ko-KR-InJoonNeural (남성)
 *   - ko-KR-HyunsuNeural (남성, 자연스러움)
 *
 * ⚠️ 비공식 API — MS가 차단할 수 있음. 장애 시 OpenAI TTS 폴백 고려.
 */

import { randomUUID } from "node:crypto";

const EDGE_TTS_ENDPOINT =
  "wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1";
const TRUSTED_CLIENT_TOKEN = "6A5AA1D4EAFF4E9FB37E23D68491D6F4";

export interface EdgeTTSOptions {
  text: string;
  voice?: string;
  rate?: string;
  pitch?: string;
}

function buildSSML(options: EdgeTTSOptions): string {
  const {
    text,
    voice = "ko-KR-SunHiNeural",
    rate = "-15%",
    pitch = "+0Hz",
  } = options;

  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

  return [
    '<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="ko-KR">',
    `<voice name="${voice}">`,
    `<prosody rate="${rate}" pitch="${pitch}">`,
    escaped,
    "</prosody>",
    "</voice>",
    "</speak>",
  ].join("");
}

/**
 * Edge TTS로 음성 합성 → mp3 Buffer 반환
 */
export async function synthesizeSpeechEdge(
  options: EdgeTTSOptions
): Promise<Buffer> {
  if (!options.text || options.text.trim().length === 0) {
    throw new Error("[edge-tts] Empty text");
  }

  const ssml = buildSSML(options);
  const requestId = randomUUID().replace(/-/g, "");

  const wsUrl = `${EDGE_TTS_ENDPOINT}?TrustedClientToken=${TRUSTED_CLIENT_TOKEN}&ConnectionId=${requestId}`;

  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let resolved = false;

    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        ws.close();
        reject(new Error("[edge-tts] Timeout after 30s"));
      }
    }, 30_000);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let WebSocketClass: any;
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      WebSocketClass = require("ws");
    } catch {
      clearTimeout(timeout);
      reject(
        new Error("[edge-tts] 'ws' package not found. Run: npm install ws")
      );
      return;
    }

    const ws = new WebSocketClass(wsUrl, {
      headers: {
        Origin: "chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0",
      },
    });

    ws.on("open", () => {
      const configMessage = [
        `X-Timestamp:${new Date().toISOString()}`,
        "Content-Type:application/json; charset=utf-8",
        "Path:speech.config",
        "",
        JSON.stringify({
          context: {
            synthesis: {
              audio: {
                metadataoptions: { sentenceBoundaryEnabled: false, wordBoundaryEnabled: false },
                outputFormat: "audio-24khz-48kbitrate-mono-mp3",
              },
            },
          },
        }),
      ].join("\r\n");
      ws.send(configMessage);

      const ssmlMessage = [
        `X-RequestId:${requestId}`,
        "Content-Type:application/ssml+xml",
        `X-Timestamp:${new Date().toISOString()}`,
        "Path:ssml",
        "",
        ssml,
      ].join("\r\n");
      ws.send(ssmlMessage);
    });

    ws.on("message", (data: Buffer | string) => {
      if (typeof data === "string") {
        if (data.includes("Path:turn.end")) {
          resolved = true;
          clearTimeout(timeout);
          ws.close();
          resolve(Buffer.concat(chunks));
        }
      } else if (Buffer.isBuffer(data)) {
        const headerEnd = data.indexOf(Buffer.from("Path:audio\r\n"));
        if (headerEnd >= 0) {
          const audioStart = data.indexOf(Buffer.from("\r\n\r\n"), headerEnd);
          if (audioStart >= 0) {
            chunks.push(data.subarray(audioStart + 4));
          }
        }
      }
    });

    ws.on("error", (err: Error) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeout);
        reject(new Error(`[edge-tts] WebSocket error: ${err.message}`));
      }
    });

    ws.on("close", () => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeout);
        if (chunks.length > 0) {
          resolve(Buffer.concat(chunks));
        } else {
          reject(new Error("[edge-tts] Connection closed without audio"));
        }
      }
    });
  });
}
