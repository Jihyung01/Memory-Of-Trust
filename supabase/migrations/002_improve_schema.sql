-- MOT Care MVP - 스키마 개선 마이그레이션
-- 
-- 개선 사항:
-- 1. sessions 테이블을 interview_sessions로 명명 변경 (더 명확한 의미)
-- 2. channel 필드 추가 (text, phone_mock, real_ars 등)
-- 3. messages 테이블의 role 확장 (user, assistant, system, care_manager)
-- 4. elders 테이블에 last_session_id 추가
-- 5. risk_level_after 필드 추가 (세션 후 갱신된 위험도)

-- ENUM 타입 확장
DROP TYPE IF EXISTS message_role CASCADE;
CREATE TYPE message_role AS ENUM ('user', 'assistant', 'system', 'care_manager');

-- channel 타입 추가
CREATE TYPE session_channel AS ENUM ('text', 'phone_mock', 'real_ars');

-- 기존 sessions 테이블을 interview_sessions로 변경
-- (기존 데이터가 있다면 백업 후 마이그레이션 필요)
ALTER TABLE sessions RENAME TO interview_sessions;

-- interview_sessions 테이블에 필드 추가
ALTER TABLE interview_sessions 
  ADD COLUMN IF NOT EXISTS channel session_channel DEFAULT 'text',
  ADD COLUMN IF NOT EXISTS risk_level_after risk_level;

-- 기존 risk_level을 risk_level_before로 변경하고, risk_level_after와 구분
ALTER TABLE interview_sessions 
  RENAME COLUMN risk_level TO risk_level_before;

-- elders 테이블에 last_session_id 추가
ALTER TABLE elders 
  ADD COLUMN IF NOT EXISTS last_session_id UUID REFERENCES interview_sessions(id) ON DELETE SET NULL;

-- messages 테이블의 role 타입 변경 (기존 데이터가 있다면 주의)
-- 실제 운영 환경에서는 데이터 마이그레이션 스크립트가 필요할 수 있습니다.
-- 여기서는 타입만 변경합니다.
ALTER TABLE messages 
  DROP CONSTRAINT IF EXISTS messages_role_check,
  ALTER COLUMN role TYPE message_role USING 
    CASE 
      WHEN role::text = 'elder' THEN 'user'::message_role
      WHEN role::text = 'assistant' THEN 'assistant'::message_role
      ELSE 'user'::message_role
    END;

-- 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_interview_sessions_channel ON interview_sessions(channel);
CREATE INDEX IF NOT EXISTS idx_interview_sessions_risk_level_after ON interview_sessions(risk_level_after);
CREATE INDEX IF NOT EXISTS idx_elders_last_session_id ON elders(last_session_id);

-- 함수: 세션 종료 시 elders.last_session_at, last_session_id 업데이트
CREATE OR REPLACE FUNCTION update_elder_last_session()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.ended_at IS NOT NULL AND OLD.ended_at IS NULL THEN
    UPDATE elders
    SET 
      last_session_at = NEW.ended_at,
      last_session_id = NEW.id
    WHERE id = NEW.elder_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 트리거 설정
DROP TRIGGER IF EXISTS trigger_update_elder_last_session ON interview_sessions;
CREATE TRIGGER trigger_update_elder_last_session
  AFTER UPDATE ON interview_sessions
  FOR EACH ROW
  WHEN (NEW.ended_at IS NOT NULL AND OLD.ended_at IS NULL)
  EXECUTE FUNCTION update_elder_last_session();

-- RLS 정책 업데이트 (테이블 이름 변경 반영)
-- 기존 정책 삭제
DROP POLICY IF EXISTS "운영자는 세션 조회 가능" ON interview_sessions;
DROP POLICY IF EXISTS "운영자는 세션 생성 가능" ON interview_sessions;
DROP POLICY IF EXISTS "운영자는 세션 수정 가능" ON interview_sessions;

-- 새로운 정책 생성
CREATE POLICY "운영자는 인터뷰 세션 조회 가능"
  ON interview_sessions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "운영자는 인터뷰 세션 생성 가능"
  ON interview_sessions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "운영자는 인터뷰 세션 수정 가능"
  ON interview_sessions FOR UPDATE
  TO authenticated
  USING (true);
