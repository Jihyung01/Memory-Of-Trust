/**
 * MOT — 방문 컨텍스트 빌더
 *
 * 세션 시작 시 호출하여, PROMPT_VISIT 템플릿에 주입할 변수들을
 * Supabase에서 조회·조립합니다.
 */

import { getSupabaseAdmin } from '@/lib/supabase';
import type { VisitContext } from '@/lib/types';

/**
 * 사용자 ID를 받아 방문 대화 프롬프트에 필요한 컨텍스트를 빌드합니다.
 * DB에 아직 데이터가 없는 경우(첫 방문) 안전한 기본값을 반환합니다.
 */
export async function buildVisitContext(userId: string): Promise<VisitContext> {
  const db = getSupabaseAdmin();

  // ── 1) 사용자 기본 정보 ────────────────────────────
  const { data: user } = await db
    .from('users')
    .select('display_name, birth_year, region_origin, dialect, metadata')
    .eq('id', userId)
    .single();

  const currentYear = new Date().getFullYear();
  const displayName = user?.display_name ?? '어르신';
  const age = user?.birth_year
    ? currentYear - user.birth_year
    : '알 수 없음';
  const regionOrigin = user?.region_origin ?? '(없음)';
  const dialect = user?.dialect ?? '(없음)';
  const personalityNotes =
    (user?.metadata as Record<string, unknown>)?.personality_notes as string ??
    '아직 파악되지 않았습니다.';

  // ── 2) 페르소나 상태 ───────────────────────────────
  const { data: persona } = await db
    .from('persona_state')
    .select('recent_emotions, consecutive_visits, last_risk_score, pending_open_loop_ids, active_thread_ids, recent_topics')
    .eq('user_id', userId)
    .single();

  const recentEmotions = persona?.recent_emotions
    ? JSON.stringify(persona.recent_emotions, null, 2)
    : '(첫 방문이라 데이터 없음)';
  const consecutiveVisits = persona?.consecutive_visits ?? 0;
  const lastRiskScore = persona?.last_risk_score != null
    ? String(persona.last_risk_score)
    : '0 (기록 없음)';

  // ── 3) 최근 3일 세션 요약 ──────────────────────────
  const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
  const { data: recentSummaries } = await db
    .from('session_summaries')
    .select('summary_short, summary_detailed, dominant_themes, created_at')
    .eq('user_id', userId)
    .gte('created_at', threeDaysAgo)
    .order('created_at', { ascending: false })
    .limit(3);

  const recentContext = recentSummaries && recentSummaries.length > 0
    ? recentSummaries
        .map((s, i) => {
          const date = new Date(s.created_at).toLocaleDateString('ko-KR');
          const themes = s.dominant_themes?.join(', ') ?? '';
          return `[${date}] ${s.summary_short ?? '요약 없음'}${themes ? ` (주제: ${themes})` : ''}`;
        })
        .join('\n')
    : '(최근 대화 기록 없음 — 첫 방문)';

  // ── 4) 진행 중 생애 스레드 ─────────────────────────
  const { data: threads } = await db
    .from('life_threads')
    .select('title, thread_type, summary')
    .eq('user_id', userId)
    .eq('status', 'active')
    .order('last_touched_at', { ascending: false })
    .limit(5);

  const activeThreads = threads && threads.length > 0
    ? threads
        .map(t => `- ${t.title} (${t.thread_type ?? '분류 없음'}): ${t.summary ?? '요약 없음'}`)
        .join('\n')
    : '(아직 진행 중인 이야기 없음)';

  // ── 5) 미해결 주제(open loops)에서 오늘 피할 주제 ──
  const { data: openLoops } = await db
    .from('open_loops')
    .select('topic, type, attempts')
    .eq('user_id', userId)
    .eq('status', 'pending')
    .order('priority', { ascending: false })
    .limit(5);

  // 3회 이상 회피한 주제는 묻지 않도록 avoid_list에 추가
  const avoidList = openLoops
    ? openLoops
        .filter(l => l.type === 'avoided' && (l.attempts ?? 0) >= 2)
        .map(l => `- ${l.topic}`)
        .join('\n') || '(없음)'
    : '(없음)';

  // ── 6) 오늘의 대화 시드 (간이 버전) ────────────────
  // v1에서는 사전 생성 없이 최근 맥락에서 힌트만 제공
  const todaySeed = recentSummaries && recentSummaries.length > 0
    ? `어제 대화 요약을 참고하여 자연스럽게 말을 걸어주세요: "${recentSummaries[0]?.summary_short ?? ''}"`
    : '첫 방문입니다. 부담 없이 인사하며 시작해주세요. 이름을 부르면서 "여기 처음 왔는데, 댁이 참 좋네요" 정도로 가볍게.';

  return {
    display_name: displayName,
    age,
    region_origin: regionOrigin,
    dialect,
    personality_notes: personalityNotes,
    recent_context: recentContext,
    active_threads: activeThreads,
    recent_emotions: recentEmotions,
    consecutive_visits: consecutiveVisits,
    last_risk_score: lastRiskScore,
    today_seed: todaySeed,
    avoid_list: avoidList,
  };
}
