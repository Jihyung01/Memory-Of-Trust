/**
 * POST /api/visit/end
 *
 * 세션 종료 처리.
 * 1. sessions 테이블 ended_at, duration_seconds 업데이트
 * 2. 비동기 후처리 큐잉 (/api/visit/process fire-and-forget)
 */

import { NextRequest } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import type { EndSessionRequest, EndSessionResponse } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body: EndSessionRequest = await request.json();
    const { sessionId, userId } = body;

    if (!sessionId || !userId) {
      return Response.json(
        { error: 'sessionId and userId are required' },
        { status: 400 },
      );
    }

    const db = getSupabaseAdmin();
    const now = new Date();

    // ── 1) 세션 정보 조회 ─────────────────────────
    const { data: session } = await db
      .from('sessions')
      .select('started_at, visit_attempt_id')
      .eq('id', sessionId)
      .single();

    if (!session) {
      return Response.json({ error: 'Session not found' }, { status: 404 });
    }

    const startedAt = new Date(session.started_at);
    const durationSeconds = Math.round((now.getTime() - startedAt.getTime()) / 1000);

    // ── 2) sessions 업데이트 ─────────────────────
    await db
      .from('sessions')
      .update({
        ended_at: now.toISOString(),
        duration_seconds: durationSeconds,
      })
      .eq('id', sessionId);

    // ── 3) 비동기 후처리 큐잉 (fire-and-forget) ──
    // 현재 요청의 origin을 사용하여 실제 URL 구성
    const origin = request.nextUrl.origin;
    fetch(`${origin}/api/visit/process`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, userId }),
    }).catch((err) => {
      // fire-and-forget: 에러가 나도 클라이언트에 영향 없음
      console.error('Failed to queue post-processing:', err);
    });

    const response: EndSessionResponse = {
      success: true,
      sessionId,
      durationSeconds,
    };

    return Response.json(response);
  } catch (err) {
    console.error('POST /api/visit/end error:', err);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
