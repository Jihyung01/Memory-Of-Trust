/**
 * POST /api/visit/process
 *
 * 비동기 후처리 — 세션 종료 후 백그라운드에서 실행.
 * 1. 세션의 모든 utterance 조회
 * 2. EXTRACT_CANDIDATES로 기억 후보 추출 → memory_candidates INSERT
 * 3. RISK_ASSESSMENT로 위험 평가 → risk_signals INSERT
 * 4. session_summaries 생성
 * 5. sessions.post_processed = true 업데이트
 *
 * Vercel에서 충분한 실행 시간을 확보하기 위해 maxDuration을 설정합니다.
 */

import { NextRequest } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import {
  PROMPT_EXTRACT_CANDIDATES,
  PROMPT_RISK_ASSESSMENT,
  PROMPT_VERSION,
  fillTemplate,
} from '@/lib/prompts';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // 최대 60초 실행

export async function POST(request: NextRequest) {
  try {
    const { sessionId, userId } = await request.json();

    if (!sessionId || !userId) {
      return Response.json({ error: 'sessionId and userId are required' }, { status: 400 });
    }

    const db = getSupabaseAdmin();
    const model = process.env.OPENAI_RESPONSES_MODEL ?? 'gpt-4o';

    // ── 1) 세션 발화 조회 ─────────────────────────
    const { data: utterances } = await db
      .from('utterance_events')
      .select('*')
      .eq('session_id', sessionId)
      .order('sequence_num', { ascending: true });

    if (!utterances || utterances.length === 0) {
      // 발화가 없으면 후처리 불필요
      await db
        .from('sessions')
        .update({ post_processed: true, post_processed_at: new Date().toISOString() })
        .eq('id', sessionId);
      return Response.json({ success: true, message: 'No utterances to process' });
    }

    // 트랜스크립트 조립 — 환각/노이즈 필터링
    const NOISE_PATTERNS = [
      /^(아|어|음|흠|으|에|이)+$/,
      /^(MBC|SBS|KBS|TV|BGM)+$/i,
      /^(시청해\s*주셔서\s*감사합니다|구독|좋아요|알림)/,
      /^(자막|번역|제공)/,
    ];
    const cleanUtterances = utterances.filter(u => {
      const text = (u.text ?? '').trim();
      if (text.length < 2) return false;
      if (NOISE_PATTERNS.some(p => p.test(text))) return false;
      return true;
    });

    if (cleanUtterances.length === 0) {
      await db
        .from('sessions')
        .update({ post_processed: true, post_processed_at: new Date().toISOString() })
        .eq('id', sessionId);
      return Response.json({ success: true, message: 'No meaningful utterances to process' });
    }

    const transcript = cleanUtterances
      .map(u => `[${u.speaker}] ${u.text ?? '(무음)'}`)
      .join('\n');

    // 사용자 프로필 조회
    const { data: user } = await db
      .from('users')
      .select('display_name, birth_year, region_origin, dialect')
      .eq('id', userId)
      .single();

    const currentYear = new Date().getFullYear();
    const userProfile = user
      ? `이름: ${user.display_name}, 나이: ${user.birth_year ? currentYear - user.birth_year : '?'}세, 출신: ${user.region_origin ?? '?'}`
      : '(프로필 없음)';

    // 기존 엔티티 목록 (매칭용)
    const { data: entities } = await db
      .from('entities')
      .select('id, entity_type, name, aliases')
      .eq('user_id', userId)
      .order('mention_count', { ascending: false })
      .limit(50);

    const existingEntities = entities && entities.length > 0
      ? entities.map(e => `- [${e.entity_type}] ${e.name}${e.aliases?.length ? ` (별칭: ${e.aliases.join(', ')})` : ''}`).join('\n')
      : '(없음)';

    // ── 2) 기억 후보 추출 ─────────────────────────
    try {
      const extractPrompt = fillTemplate(PROMPT_EXTRACT_CANDIDATES, {
        transcript,
        user_profile: userProfile,
        existing_entities: existingEntities,
      });

      const extractRes = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: extractPrompt }],
          temperature: 0.3,
          response_format: { type: 'json_object' },
        }),
      });

      if (extractRes.ok) {
        const extractData = await extractRes.json();
        const content = extractData.choices?.[0]?.message?.content;
        if (content) {
          const parsed = JSON.parse(content);

          // 기억 후보 INSERT
          if (parsed.candidates && Array.isArray(parsed.candidates)) {
            for (const c of parsed.candidates) {
              await db.from('memory_candidates').insert({
                user_id: userId,
                session_id: sessionId,
                source_event_ids: utterances.map(u => u.id),
                summary: c.summary ?? '요약 없음',
                full_text: c.full_text ?? null,
                narrative_role: c.narrative_role ?? null,
                era: c.era ?? null,
                year_approx: c.year_approx ?? null,
                season: c.season ?? null,
                time_of_day: c.time_of_day ?? null,
                weather: c.weather ?? null,
                sensory: c.sensory ?? null,
                emotions: c.emotions ?? null,
                themes: c.themes ?? null,
                trigger_context: c.trigger_context ?? null,
                resolution_status: c.resolution_status ?? 'complete',
                confidence: c.confidence ?? 0.5,
                significance: c.significance ?? 0.5,
                significance_reason: c.significance_reason ?? null,
                is_wisdom: c.is_wisdom ?? false,
                is_identity_statement: c.is_identity_statement ?? false,
                is_body_memory: c.is_body_memory ?? false,
                contains_message_to_someone: c.contains_message_to_someone ?? null,
                status: 'pending',
              });
            }
          }

          // 세션 요약 INSERT
          await db.from('session_summaries').insert({
            session_id: sessionId,
            user_id: userId,
            summary_short: parsed.session_summary_short ?? null,
            summary_detailed: parsed.session_summary_detailed ?? null,
            dominant_themes: parsed.dominant_themes ?? null,
            emotion_arc: parsed.emotion_arc ?? null,
            new_entities_count: parsed.candidates?.length ?? 0,
            new_facts_count: 0,
            open_loops_created: 0,
          });
        }
      }
    } catch (extractErr) {
      console.error('Memory extraction error:', extractErr);
      // 추출 실패해도 위험 평가는 계속 진행
    }

    // ── 3) 위험 평가 ─────────────────────────────
    try {
      // 최근 7일 감정 추세
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const { data: emotionTraces } = await db
        .from('emotion_traces')
        .select('emotions, dominant_emotion, measured_at')
        .eq('user_id', userId)
        .gte('measured_at', sevenDaysAgo)
        .order('measured_at', { ascending: false })
        .limit(7);

      const emotionTrend = emotionTraces && emotionTraces.length > 0
        ? emotionTraces.map(e => `${new Date(e.measured_at).toLocaleDateString('ko-KR')}: ${e.dominant_emotion ?? '?'}`).join('\n')
        : '(데이터 없음)';

      // 과거 위험 이력
      const { data: pastRisks } = await db
        .from('risk_signals')
        .select('category, severity, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(5);

      const pastRiskSignals = pastRisks && pastRisks.length > 0
        ? pastRisks.map(r => `${r.category}: ${r.severity} (${new Date(r.created_at).toLocaleDateString('ko-KR')})`).join('\n')
        : '(없음)';

      const age = user?.birth_year ? currentYear - user.birth_year : '?';

      const riskPrompt = fillTemplate(PROMPT_RISK_ASSESSMENT, {
        transcript,
        emotion_trend_7days: emotionTrend,
        past_risk_signals: pastRiskSignals,
        age,
        lives_alone: '알 수 없음',
        family_contact_frequency: '알 수 없음',
      });

      const riskRes = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: riskPrompt }],
          temperature: 0.2,
          response_format: { type: 'json_object' },
        }),
      });

      if (riskRes.ok) {
        const riskData = await riskRes.json();
        const riskContent = riskData.choices?.[0]?.message?.content;
        if (riskContent) {
          const riskParsed = JSON.parse(riskContent);

          // 위험 플래그가 있으면 risk_signals에 저장
          if (riskParsed.flags && Array.isArray(riskParsed.flags)) {
            for (const flag of riskParsed.flags) {
              if (flag.severity > 0.3) {
                await db.from('risk_signals').insert({
                  user_id: userId,
                  session_id: sessionId,
                  category: flag.category,
                  severity: flag.severity,
                  evidence: flag.evidence ?? null,
                  reasoning: flag.reasoning ?? null,
                  action_taken: riskParsed.recommended_action ?? 'logged',
                });
              }
            }
          }

          // persona_state의 last_risk_score 업데이트
          if (riskParsed.overall_risk_score != null) {
            await db
              .from('persona_state')
              .upsert({
                user_id: userId,
                last_risk_score: riskParsed.overall_risk_score,
                last_visit_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              }, { onConflict: 'user_id' });
          }
        }
      }
    } catch (riskErr) {
      console.error('Risk assessment error:', riskErr);
    }

    // ── 4) sessions.post_processed 업데이트 ──────
    await db
      .from('sessions')
      .update({
        post_processed: true,
        post_processed_at: new Date().toISOString(),
      })
      .eq('id', sessionId);

    return Response.json({ success: true, sessionId });
  } catch (err) {
    console.error('POST /api/visit/process error:', err);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
