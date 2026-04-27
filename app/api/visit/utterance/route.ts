/**
 * POST /api/visit/utterance
 *
 * 발화 이벤트를 utterance_events 테이블에 저장.
 * sequence_num은 서버에서 부여합니다.
 *
 * 한국어 음성 인식 환각 필터링:
 * - 2글자 미만 텍스트 거부
 * - 알려진 환각 패턴 거부 (자막 관련, 의미 없는 반복 등)
 */

import { NextRequest } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import type { SaveUtteranceRequest, SaveUtteranceResponse } from '@/lib/types';

export const dynamic = 'force-dynamic';

// 환각/노이즈 필터
const HALLUCINATION_PATTERNS = [
  /^(아|어|음|흠|으|에|이)+$/,
  /^\.+$/,
  /^(MBC|SBS|KBS|TV|BGM)+$/i,
  /^(시청해\s*주셔서\s*감사합니다|구독|좋아요|알림)/,
  /^(자막|번역|제공)/,
  /^\s+$/,
];

function isHallucination(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length < 2) return true;
  return HALLUCINATION_PATTERNS.some(p => p.test(trimmed));
}

export async function POST(request: NextRequest) {
  try {
    const body: SaveUtteranceRequest = await request.json();
    const {
      sessionId,
      userId,
      speaker,
      text,
      startedAt,
      endedAt,
      durationMs,
      silenceBeforeMs,
      wasInterrupted,
      wasSelfInitiated,
      emotionHint,
      rawData,
    } = body;

    if (!sessionId || !userId || !speaker || !text) {
      return Response.json(
        { error: 'sessionId, userId, speaker, text are required' },
        { status: 400 },
      );
    }

    // 사용자 발화에 대해 환각 필터링
    if (speaker === 'user' && isHallucination(text)) {
      // 환각 텍스트는 저장하지 않고 조용히 성공 반환
      return Response.json({ id: 'filtered', sequenceNum: -1 });
    }

    const db = getSupabaseAdmin();

    // ── sequence_num 서버 부여 ────────────────────
    const { data: maxRow } = await db
      .from('utterance_events')
      .select('sequence_num')
      .eq('session_id', sessionId)
      .order('sequence_num', { ascending: false })
      .limit(1)
      .single();

    const nextSeqNum = (maxRow?.sequence_num ?? 0) + 1;

    // ── INSERT ──────────────────────────────────
    const { data: inserted, error: insertErr } = await db
      .from('utterance_events')
      .insert({
        session_id: sessionId,
        user_id: userId,
        sequence_num: nextSeqNum,
        speaker,
        started_at: startedAt || new Date().toISOString(),
        ended_at: endedAt || null,
        duration_ms: durationMs || null,
        text: text.trim(),
        silence_before_ms: silenceBeforeMs || null,
        was_interrupted: wasInterrupted ?? false,
        was_self_initiated: wasSelfInitiated ?? null,
        emotion_hint: emotionHint || null,
        raw_data: rawData || null,
      })
      .select('id, sequence_num')
      .single();

    if (insertErr) {
      console.error('utterance insert error:', insertErr);
      return Response.json({ error: 'Failed to save utterance' }, { status: 500 });
    }

    const response: SaveUtteranceResponse = {
      id: inserted.id,
      sequenceNum: inserted.sequence_num,
    };

    return Response.json(response);
  } catch (err) {
    console.error('POST /api/visit/utterance error:', err);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
