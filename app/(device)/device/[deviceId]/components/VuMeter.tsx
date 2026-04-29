"use client";

import { useEffect, useRef, useState } from "react";

interface VuMeterProps {
  /** 0~1 사이 실제 오디오 레벨. null이면 시뮬레이션 모드 */
  level?: number | null;
  /** true면 바늘 애니메이션 활성화 */
  active: boolean;
}

/**
 * 아날로그 VU 미터 — 녹음 중 바늘이 움직이는 라디오 계기판.
 * 차가운 금속 프레임 + 따뜻한 앰버 바늘 (유일한 온기).
 */
export function VuMeter({ level, active }: VuMeterProps) {
  const [simLevel, setSimLevel] = useState(0);
  const rafRef = useRef<number>(0);
  const targetRef = useRef(0);

  // 실제 레벨이 없으면 자연스러운 시뮬레이션
  useEffect(() => {
    if (!active) {
      setSimLevel(0);
      return;
    }
    if (level != null) return; // 실제 레벨 사용 시 시뮬레이션 안 함

    let lastTime = 0;
    let nextChangeAt = 0;

    function animate(time: number) {
      if (time - lastTime > 50) {
        lastTime = time;

        if (time > nextChangeAt) {
          // 랜덤 타겟 — 보통 0.2~0.6, 가끔 0.8
          targetRef.current = 0.15 + Math.random() * 0.5 + (Math.random() > 0.85 ? 0.25 : 0);
          nextChangeAt = time + 200 + Math.random() * 600;
        }

        // 부드러운 추종
        setSimLevel((prev) => prev + (targetRef.current - prev) * 0.15);
      }
      rafRef.current = requestAnimationFrame(animate);
    }

    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [active, level]);

  const currentLevel = level != null ? level : simLevel;

  // 바늘 각도: -45도(왼쪽, 최소) ~ +45도(오른쪽, 최대)
  const needleAngle = -45 + currentLevel * 90;

  const w = 200;
  const h = 110;
  const pivotX = w / 2;
  const pivotY = h - 10;
  const needleLen = 72;

  // 눈금 생성 — -45 ~ +45도, 아래 피봇 기준
  const ticks = [];
  for (let i = 0; i <= 10; i++) {
    const angle = (-45 + i * 9) * (Math.PI / 180);
    const outerR = needleLen + 4;
    const innerR = i % 5 === 0 ? needleLen - 8 : needleLen - 4;
    const x1 = pivotX + innerR * Math.sin(angle);
    const y1 = pivotY - innerR * Math.cos(angle);
    const x2 = pivotX + outerR * Math.sin(angle);
    const y2 = pivotY - outerR * Math.cos(angle);

    // 0dB = index 7, +3dB = index 10 (Red Zone)
    const isRed = i >= 8;
    const isMain = i % 5 === 0;

    ticks.push(
      <line
        key={`tick-${i}`}
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke={isRed ? "#C04030" : "var(--radio-text-dim, #6E757D)"}
        strokeWidth={isMain ? 1.5 : 0.8}
        strokeLinecap="round"
      />
    );
  }

  // 눈금 라벨
  const labels = [
    { text: "-20", idx: 0 },
    { text: "-10", idx: 5 },
    { text: "0", idx: 7 },
    { text: "+3", idx: 10 },
  ];
  const labelElements = labels.map(({ text, idx }) => {
    const angle = (-45 + idx * 9) * (Math.PI / 180);
    const labelR = needleLen + 14;
    const x = pivotX + labelR * Math.sin(angle);
    const y = pivotY - labelR * Math.cos(angle);
    const isRed = idx >= 8;
    return (
      <text
        key={`label-${idx}`}
        x={x}
        y={y}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize="8"
        fontWeight={idx === 7 ? "600" : "400"}
        fill={isRed ? "#C04030" : "var(--radio-text-dim, #6E757D)"}
        fontFamily="-apple-system, BlinkMacSystemFont, sans-serif"
      >
        {text}
      </text>
    );
  });

  // 바늘 끝 좌표
  const needleRad = needleAngle * (Math.PI / 180);
  const needleX = pivotX + needleLen * Math.sin(needleRad);
  const needleY = pivotY - needleLen * Math.cos(needleRad);

  return (
    <div
      className="rounded-lg border-2"
      style={{
        background: "var(--radio-panel, #252A30)",
        borderColor: "var(--radio-border, #4A5058)",
        boxShadow: "inset 0 1px 3px rgba(0,0,0,0.3)",
        opacity: active ? 1 : 0.4,
        transition: "opacity 0.5s ease",
      }}
    >
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
        {/* VU 라벨 */}
        <text
          x={pivotX}
          y={18}
          textAnchor="middle"
          fontSize="10"
          fontWeight="600"
          letterSpacing="3"
          fill="var(--radio-text-dim, #6E757D)"
          fontFamily="-apple-system, BlinkMacSystemFont, sans-serif"
        >
          VU
        </text>

        {/* 눈금 호 */}
        {ticks}
        {labelElements}

        {/* 바늘 — 유일한 따뜻한 색 */}
        <line
          x1={pivotX}
          y1={pivotY}
          x2={needleX}
          y2={needleY}
          stroke={active ? "var(--radio-rec, #E8A050)" : "var(--radio-text-dim, #6E757D)"}
          strokeWidth="2"
          strokeLinecap="round"
          style={{ transition: "x2 0.08s linear, y2 0.08s linear" }}
        />

        {/* 바늘 끝 빛남 */}
        {active && (
          <circle
            cx={needleX}
            cy={needleY}
            r="3"
            fill="var(--radio-rec, #E8A050)"
            opacity="0.6"
          />
        )}

        {/* 피봇 */}
        <circle
          cx={pivotX}
          cy={pivotY}
          r="5"
          fill="var(--radio-bezel, #3A3E44)"
          stroke="var(--radio-border, #4A5058)"
          strokeWidth="1"
        />
        <circle
          cx={pivotX}
          cy={pivotY}
          r="2.5"
          fill={active ? "var(--radio-rec, #E8A050)" : "var(--radio-text-dim, #6E757D)"}
        />
      </svg>
    </div>
  );
}
