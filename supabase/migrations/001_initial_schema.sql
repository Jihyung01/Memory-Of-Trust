-- MOT Care MVP - 초기 데이터베이스 스키마
-- 
-- 주의사항:
-- 1. 이 시스템은 의료행위가 아니며, 의학적 진단/치료를 제공하지 않습니다.
-- 2. 위험 분석은 보조적 참고용이며, 반드시 사람에 의한 최종 판단이 필요합니다.
-- 3. 민감 정보(주민번호, 정확한 주소 등)는 저장하지 않습니다.

-- ENUM 타입 정의
CREATE TYPE risk_level AS ENUM ('low', 'medium', 'high');
CREATE TYPE message_role AS ENUM ('elder', 'assistant');
CREATE TYPE emotion_type AS ENUM ('neutral', 'sad', 'angry', 'anxious', 'happy');

-- 어르신 프로필 테이블
CREATE TABLE elders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  birth_year INTEGER,
  gender TEXT,
  contact_phone TEXT,
  guardian_contact TEXT,
  risk_level risk_level NOT NULL DEFAULT 'low',
  last_session_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 세션 테이블
CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  elder_id UUID NOT NULL REFERENCES elders(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  summary TEXT,
  risk_level risk_level NOT NULL DEFAULT 'low',
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 메시지 테이블 (대화 로그)
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  role message_role NOT NULL,
  content TEXT NOT NULL,
  emotion emotion_type,
  risk_score NUMERIC(3, 2) CHECK (risk_score >= 0 AND risk_score <= 1),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 자서전 테이블
CREATE TABLE biographies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  elder_id UUID NOT NULL REFERENCES elders(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(elder_id, version)
);

-- 알림 테이블
CREATE TABLE alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  elder_id UUID NOT NULL REFERENCES elders(id) ON DELETE CASCADE,
  session_id UUID REFERENCES sessions(id) ON DELETE SET NULL,
  level risk_level NOT NULL CHECK (level IN ('medium', 'high')),
  reason TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

-- 인덱스 생성
CREATE INDEX idx_elders_risk_level ON elders(risk_level);
CREATE INDEX idx_elders_last_session_at ON elders(last_session_at);
CREATE INDEX idx_sessions_elder_id ON sessions(elder_id);
CREATE INDEX idx_sessions_created_at ON sessions(created_at DESC);
CREATE INDEX idx_messages_session_id ON messages(session_id);
CREATE INDEX idx_messages_created_at ON messages(created_at);
CREATE INDEX idx_biographies_elder_id ON biographies(elder_id);
CREATE INDEX idx_alerts_elder_id ON alerts(elder_id);
CREATE INDEX idx_alerts_resolved_at ON alerts(resolved_at) WHERE resolved_at IS NULL;

-- updated_at 자동 업데이트 함수
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 트리거 설정
CREATE TRIGGER update_elders_updated_at
  BEFORE UPDATE ON elders
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_biographies_updated_at
  BEFORE UPDATE ON biographies
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS) 설정
ALTER TABLE elders ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE biographies ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;

-- RLS 정책: 운영자(인증된 사용자)만 모든 데이터에 접근 가능
-- 실제 운영 시에는 더 세밀한 권한 제어가 필요합니다.

CREATE POLICY "운영자는 모든 어르신 프로필 조회 가능"
  ON elders FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "운영자는 어르신 프로필 생성 가능"
  ON elders FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "운영자는 어르신 프로필 수정 가능"
  ON elders FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "운영자는 어르신 프로필 삭제 가능"
  ON elders FOR DELETE
  TO authenticated
  USING (true);

CREATE POLICY "운영자는 세션 조회 가능"
  ON sessions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "운영자는 세션 생성 가능"
  ON sessions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "운영자는 세션 수정 가능"
  ON sessions FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "운영자는 메시지 조회 가능"
  ON messages FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "운영자는 메시지 생성 가능"
  ON messages FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "운영자는 자서전 조회 가능"
  ON biographies FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "운영자는 자서전 생성 가능"
  ON biographies FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "운영자는 자서전 수정 가능"
  ON biographies FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "운영자는 알림 조회 가능"
  ON alerts FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "운영자는 알림 생성 가능"
  ON alerts FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "운영자는 알림 수정 가능"
  ON alerts FOR UPDATE
  TO authenticated
  USING (true);
