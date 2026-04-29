-- ============================================
-- MOT Table Grants v1
--
-- RLS policy = "접근 조건" (WHO can see WHICH rows)
-- GRANT     = "테이블 접근권" (ROLE can USE table at all)
-- 둘 다 있어야 PostgREST/Supabase API가 동작한다.
--
-- 원칙:
--   1) service_role: 백엔드 API에서 사용. 모든 테이블 접근 가능.
--      단, raw_utterances UPDATE/DELETE는 DB 트리거가 차단하므로
--      GRANT에서도 INSERT+SELECT만 부여.
--   2) authenticated: 로그인한 가족 멤버. RLS로 본인 가구만.
--      raw_utterances는 SELECT만. UPDATE/DELETE 절대 불가.
--   3) anon: 미인증 사용자. 최소 권한만.
-- ============================================

-- ============================================
-- service_role 권한 (백엔드 API용)
-- ============================================

-- 사용자/가족/디바이스
GRANT SELECT, INSERT, UPDATE ON elders TO service_role;
GRANT SELECT, INSERT, UPDATE ON family_members TO service_role;
GRANT SELECT, INSERT, UPDATE ON devices TO service_role;

-- 사진/트리거
GRANT SELECT, INSERT, UPDATE ON photos TO service_role;
GRANT SELECT, INSERT, UPDATE ON family_questions TO service_role;
GRANT SELECT, INSERT, UPDATE ON prompts TO service_role;

-- 원본 발화 (immutable — INSERT+SELECT만, UPDATE/DELETE 트리거가 차단)
GRANT SELECT, INSERT ON raw_utterances TO service_role;

-- 8축 데이터 (백엔드 배치에서 쓰기)
GRANT SELECT, INSERT, UPDATE ON timeline_events TO service_role;
GRANT SELECT, INSERT, UPDATE ON entities TO service_role;
GRANT SELECT, INSERT, UPDATE ON themes TO service_role;
GRANT SELECT, INSERT ON emotion_layer TO service_role;
GRANT SELECT, INSERT ON unresolved_queue TO service_role;
GRANT SELECT, INSERT ON sensory_details TO service_role;
GRANT SELECT, INSERT ON verifications TO service_role;
GRANT SELECT, INSERT, UPDATE ON memory_candidates TO service_role;

-- 산출물/결제
GRANT SELECT, INSERT, UPDATE ON story_outputs TO service_role;
GRANT SELECT, INSERT, UPDATE ON subscriptions TO service_role;

-- ============================================
-- authenticated 권한 (로그인한 가족 멤버용)
-- RLS가 본인 가구만 필터링함.
-- ============================================

-- 읽기 전용
GRANT SELECT ON elders TO authenticated;
GRANT SELECT ON family_members TO authenticated;
GRANT SELECT ON devices TO authenticated;
GRANT SELECT ON prompts TO authenticated;

-- raw_utterances: SELECT만. UPDATE/DELETE 절대 금지.
GRANT SELECT ON raw_utterances TO authenticated;

-- 사진: 가족이 업로드 가능
GRANT SELECT, INSERT, UPDATE, DELETE ON photos TO authenticated;

-- 가족 질문: 가족이 입력 가능
GRANT SELECT, INSERT ON family_questions TO authenticated;

-- 8축 데이터: 읽기만
GRANT SELECT ON timeline_events TO authenticated;
GRANT SELECT ON entities TO authenticated;
GRANT SELECT ON themes TO authenticated;
GRANT SELECT ON emotion_layer TO authenticated;
GRANT SELECT ON unresolved_queue TO authenticated;
GRANT SELECT ON sensory_details TO authenticated;

-- 가족 보충/정정: 쓰기 가능
GRANT SELECT, INSERT ON verifications TO authenticated;

-- 기억 후보: 읽기만
GRANT SELECT ON memory_candidates TO authenticated;

-- 산출물: 읽기만
GRANT SELECT ON story_outputs TO authenticated;

-- 구독: 읽기만 (변경은 토스 Webhook + service_role)
GRANT SELECT ON subscriptions TO authenticated;

-- ============================================
-- anon 권한 (미인증 — 최소)
-- 디바이스 인증은 service_role로 처리하므로 anon에는 거의 불필요.
-- ============================================

-- family_members: 매직링크 콜백 시 INSERT 자기 자신 가능하도록
GRANT SELECT, INSERT ON family_members TO anon;

-- ============================================
-- Sequences (INSERT 시 gen_random_uuid() 용)
-- ============================================
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO anon;
