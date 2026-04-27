-- ============================================
-- MOT RLS Policies v1
-- Master Document v3 §6-3
--
-- 핵심 원칙:
--   1) 가족 멤버는 자기 어르신의 데이터만 접근.
--   2) raw_utterances 는 service_role 만 INSERT 가능. UPDATE/DELETE 는 트리거가 차단.
--   3) family_questions.raw_question 은 가족 본인이 입력. softened_question 은 백엔드(service_role) 가 채움.
-- ============================================

-- ============================================
-- RLS 활성화
-- ============================================
ALTER TABLE elders                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE family_members          ENABLE ROW LEVEL SECURITY;
ALTER TABLE devices                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE photos                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE family_questions        ENABLE ROW LEVEL SECURITY;
ALTER TABLE prompts                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE raw_utterances          ENABLE ROW LEVEL SECURITY;
ALTER TABLE timeline_events         ENABLE ROW LEVEL SECURITY;
ALTER TABLE entities                ENABLE ROW LEVEL SECURITY;
ALTER TABLE themes                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE emotion_layer           ENABLE ROW LEVEL SECURITY;
ALTER TABLE unresolved_queue        ENABLE ROW LEVEL SECURITY;
ALTER TABLE sensory_details         ENABLE ROW LEVEL SECURITY;
ALTER TABLE verifications           ENABLE ROW LEVEL SECURITY;
ALTER TABLE memory_candidates       ENABLE ROW LEVEL SECURITY;
ALTER TABLE story_outputs           ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions           ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 헬퍼 함수: 현재 auth.uid() 의 family_member.elder_id 목록
-- ============================================
CREATE OR REPLACE FUNCTION my_elder_ids()
RETURNS SETOF UUID
LANGUAGE SQL STABLE SECURITY DEFINER
AS $$
  SELECT elder_id FROM family_members WHERE user_id = auth.uid();
$$;

-- ============================================
-- elders
-- ============================================
DROP POLICY IF EXISTS family_can_read_their_elder ON elders;
CREATE POLICY family_can_read_their_elder ON elders
  FOR SELECT USING (id IN (SELECT my_elder_ids()));

-- ============================================
-- family_members
-- ============================================
DROP POLICY IF EXISTS member_reads_own_row ON family_members;
CREATE POLICY member_reads_own_row ON family_members
  FOR SELECT USING (user_id = auth.uid() OR elder_id IN (SELECT my_elder_ids()));

DROP POLICY IF EXISTS member_inserts_self ON family_members;
CREATE POLICY member_inserts_self ON family_members
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- ============================================
-- devices
-- ============================================
DROP POLICY IF EXISTS family_reads_their_device ON devices;
CREATE POLICY family_reads_their_device ON devices
  FOR SELECT USING (elder_id IN (SELECT my_elder_ids()));

-- 디바이스 자체 인증은 백엔드(service_role)에서 device_token 검증으로 처리.
-- 일반 anon 사용자는 devices 직접 접근 불가.

-- ============================================
-- photos
-- ============================================
DROP POLICY IF EXISTS family_reads_photos ON photos;
CREATE POLICY family_reads_photos ON photos
  FOR SELECT USING (elder_id IN (SELECT my_elder_ids()));

DROP POLICY IF EXISTS family_inserts_photos ON photos;
CREATE POLICY family_inserts_photos ON photos
  FOR INSERT WITH CHECK (elder_id IN (SELECT my_elder_ids()));

DROP POLICY IF EXISTS family_updates_photos ON photos;
CREATE POLICY family_updates_photos ON photos
  FOR UPDATE USING (elder_id IN (SELECT my_elder_ids()));

DROP POLICY IF EXISTS family_deletes_photos ON photos;
CREATE POLICY family_deletes_photos ON photos
  FOR DELETE USING (elder_id IN (SELECT my_elder_ids()));

-- ============================================
-- family_questions
-- ============================================
DROP POLICY IF EXISTS family_reads_questions ON family_questions;
CREATE POLICY family_reads_questions ON family_questions
  FOR SELECT USING (elder_id IN (SELECT my_elder_ids()));

DROP POLICY IF EXISTS family_inserts_questions ON family_questions;
CREATE POLICY family_inserts_questions ON family_questions
  FOR INSERT WITH CHECK (
    elder_id IN (SELECT my_elder_ids())
    AND asked_by IN (SELECT id FROM family_members WHERE user_id = auth.uid())
  );

-- softened_question, status 필드는 service_role 만 업데이트.
-- 가족 본인은 raw_question 외 다른 필드 변경 불가.

-- ============================================
-- prompts
-- ============================================
DROP POLICY IF EXISTS family_reads_prompts ON prompts;
CREATE POLICY family_reads_prompts ON prompts
  FOR SELECT USING (elder_id IN (SELECT my_elder_ids()));

-- ============================================
-- raw_utterances (immutable)
-- ============================================
DROP POLICY IF EXISTS family_reads_utterances ON raw_utterances;
CREATE POLICY family_reads_utterances ON raw_utterances
  FOR SELECT USING (elder_id IN (SELECT my_elder_ids()));

-- INSERT 는 service_role 만 허용.
-- (디바이스 토큰 검증 후 백엔드가 service_role 클라이언트로 INSERT)
-- UPDATE/DELETE 는 트리거가 차단 (initial_schema.sql 참조).

-- ============================================
-- 8축 데이터 테이블 (모두 SELECT 만 가족에게 허용, 쓰기는 service_role)
-- ============================================
DO $$
DECLARE
  t TEXT;
  policy_name TEXT;
BEGIN
  FOR t IN
    SELECT unnest(ARRAY[
      'timeline_events',
      'entities',
      'themes',
      'emotion_layer',
      'unresolved_queue',
      'sensory_details',
      'verifications',
      'memory_candidates'
    ])
  LOOP
    policy_name := 'family_reads_' || t;
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', policy_name, t);
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR SELECT USING (elder_id IN (SELECT my_elder_ids()))',
      policy_name, t
    );
  END LOOP;
END$$;

-- 가족이 verifications 추가는 가능 (보충/정정)
DROP POLICY IF EXISTS family_inserts_verifications ON verifications;
CREATE POLICY family_inserts_verifications ON verifications
  FOR INSERT WITH CHECK (
    elder_id IN (SELECT my_elder_ids())
    AND verified_by IN (SELECT id FROM family_members WHERE user_id = auth.uid())
  );

-- ============================================
-- story_outputs
-- ============================================
DROP POLICY IF EXISTS family_reads_outputs ON story_outputs;
CREATE POLICY family_reads_outputs ON story_outputs
  FOR SELECT USING (elder_id IN (SELECT my_elder_ids()));

-- ============================================
-- subscriptions
-- ============================================
DROP POLICY IF EXISTS family_reads_subscription ON subscriptions;
CREATE POLICY family_reads_subscription ON subscriptions
  FOR SELECT USING (elder_id IN (SELECT my_elder_ids()));

-- 결제 변경은 별도 안전 경로 (토스 Webhook + service_role) 만.

-- ============================================
-- Storage 정책 메모 (Supabase Studio Storage UI 에서 적용)
-- ============================================
-- 1) bucket: photos
--    - SELECT: signed URL 또는 family RLS (객체 path prefix elder_id 기준)
--    - INSERT: 가족 멤버만, path = elder_id/* 강제
-- 2) bucket: utterance-audio
--    - SELECT: service_role + signed URL 만 (가족도 직접 접근 X — signed URL 발급으로)
--    - INSERT: service_role 만 (디바이스 토큰 검증 후 백엔드가 업로드)
--    - DELETE: 차단 (raw_utterances 와 동기화 보장)
-- 자세한 Storage policy SQL 은 별도 마이그레이션에서 추가.
