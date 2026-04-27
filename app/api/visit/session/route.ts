/**
 * POST /api/visit/session
 *
 * 세션 생성 + OpenAI Realtime ephemeral token 발급.
 * 1. Supabase에 visit_attempts, sessions 생성
 * 2. buildVisitContext()로 시스템 프롬프트 조립
 * 3. OpenAI /v1/realtime/sessions 호출 → ephemeral token 반환
 *
 * 한국어 음성 인식 최적화:
 * - gpt-4o-transcribe 모델 사용 (whisper-1 대비 한국어 정확도 향상)
 * - VAD threshold 0.6 (0.5 → 환경 소음 오탐 방지)
 * - silence_duration_ms 1200ms (한국어 문장 끝 여유)
 * - prefix_padding_ms 400ms (말 시작 전 버퍼 확보)
 */

import { NextRequest } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { buildVisitContext } from '@/lib/context';
import { PROMPT_VISIT, fillTemplate } from '@/lib/prompts';
import type { CreateSessionRequest, CreateSessionResponse } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body: CreateSessionRequest = await request.json();
    const { userId, channel = 'tablet' } = body;

    if (!userId) {
      return Response.json({ error: 'userId is required' }, { status: 400 });
    }

    const db = getSupabaseAdmin();
    const model = process.env.OPENAI_REALTIME_MODEL ?? 'gpt-4o-realtime-preview';

    // ── 1) visit_attempts 생성 ─────────────────────
    const now = new Date().toISOString();
    const { data: attempt, error: attemptErr } = await db
      .from('visit_attempts')
      .insert({
        user_id: userId,
        scheduled_at: now,
        attempted_at: now,
        channel,
        result: 'answered',
      })
      .select('id')
      .single();

    if (attemptErr) {
      console.error('visit_attempts insert error:', attemptErr);
      return Response.json(
        { error: 'Failed to create visit attempt', details: attemptErr.message, code: attemptErr.code },
        { status: 500 },
      );
    }

    // ── 2) sessions 생성 ──────────────────────────
    const { data: session, error: sessionErr } = await db
      .from('sessions')
      .insert({
        user_id: userId,
        visit_attempt_id: attempt.id,
        channel,
        mode: 'normal',
        started_at: now,
      })
      .select('id')
      .single();

    if (sessionErr) {
      console.error('sessions insert error:', sessionErr);
      return Response.json({ error: 'Failed to create session' }, { status: 500 });
    }

    // visit_attempts에 session_id 업데이트
    await db
      .from('visit_attempts')
      .update({ session_id: session.id })
      .eq('id', attempt.id);

    // ── 3) 방문 컨텍스트 빌드 ─────────────────────
    const context = await buildVisitContext(userId);
    const systemPrompt = fillTemplate(PROMPT_VISIT, context);

    // ── 4) OpenAI ephemeral token 발급 ────────────
    // 한국어 최적화: transcription 모델 + VAD 튜닝
    const openaiRes = await fetch('https://api.openai.com/v1/realtime/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        voice: 'shimmer',
        instructions: systemPrompt,
        // 한국어 전사 — gpt-4o-transcribe가 whisper-1보다 한국어 정확도 높음
        input_audio_transcription: {
          model: 'gpt-4o-transcribe',
          language: 'ko',
        },
        // VAD 튜닝 — 한국어 특성 반영
        turn_detection: {
          type: 'server_vad',
          threshold: 0.6,           // 환경 소음 오탐 방지 (기본 0.5)
          prefix_padding_ms: 400,   // 말 시작 전 버퍼 (기본 300)
          silence_duration_ms: 1200, // 문장 끝 대기 (기본 800, 한국어는 길게)
        },
      }),
    });

    if (!openaiRes.ok) {
      const errText = await openaiRes.text();
      console.error('OpenAI session error:', openaiRes.status, errText);
      return Response.json(
        { error: 'Failed to create OpenAI session' },
        { status: 502 },
      );
    }

    const openaiData = await openaiRes.json();
    const ephemeralToken: string = openaiData.client_secret?.value ?? '';

    // sessions에 openai_session_id 저장
    if (openaiData.id) {
      await db
        .from('sessions')
        .update({ openai_session_id: openaiData.id })
        .eq('id', session.id);
    }

    const response: CreateSessionResponse = {
      sessionId: session.id,
      visitAttemptId: attempt.id,
      ephemeralToken,
      systemPrompt,
      model,
    };

    return Response.json(response);
  } catch (err) {
    console.error('POST /api/visit/session error:', err);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
