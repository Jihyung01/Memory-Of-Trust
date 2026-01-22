-- MOT Care MVP - 자서전 인터뷰 엔진 지원 스키마
-- 
-- 추가 사항:
-- 1. interview_sessions 테이블에 session_type 필드 추가
-- 2. channel 타입 확장 (web, phone, kiosk 등)
-- 3. biographies 테이블 구조 개선 (outline 필드 추가)

-- session_type ENUM 타입 생성
CREATE TYPE session_type AS ENUM ('care', 'biography', 'checkin');

-- interview_sessions 테이블에 session_type 필드 추가
ALTER TABLE interview_sessions 
  ADD COLUMN IF NOT EXISTS session_type session_type DEFAULT 'care';

-- channel 타입 확장 (기존 session_channel 타입이 있으면 확장)
-- PostgreSQL에서는 ENUM 타입을 직접 수정할 수 없으므로, 
-- 기존 타입이 있다면 DROP하고 재생성하거나, TEXT로 변경
DO $$ 
BEGIN
  -- session_channel 타입이 있는지 확인
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'session_channel') THEN
    -- 기존 컬럼을 TEXT로 변경
    ALTER TABLE interview_sessions 
      ALTER COLUMN channel TYPE TEXT;
    
    -- 기존 ENUM 타입 삭제
    DROP TYPE IF EXISTS session_channel;
  END IF;
END $$;

-- channel을 TEXT로 변경 (더 유연하게)
ALTER TABLE interview_sessions 
  ALTER COLUMN channel TYPE TEXT USING channel::TEXT;

-- channel 기본값 설정
ALTER TABLE interview_sessions 
  ALTER COLUMN channel SET DEFAULT 'web';

-- summary 필드가 없으면 추가
ALTER TABLE interview_sessions 
  ADD COLUMN IF NOT EXISTS summary TEXT;

-- biographies 테이블 구조 개선
-- 기존 테이블이 있다면 outline과 session_id 필드 추가
ALTER TABLE biographies 
  ADD COLUMN IF NOT EXISTS outline TEXT,
  ADD COLUMN IF NOT EXISTS session_id UUID REFERENCES interview_sessions(id) ON DELETE SET NULL;

-- session_type 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_interview_sessions_session_type 
  ON interview_sessions(session_type);

-- session_type과 channel 복합 인덱스
CREATE INDEX IF NOT EXISTS idx_interview_sessions_type_channel 
  ON interview_sessions(session_type, channel);

-- biographies 테이블에 session_id 인덱스 추가 (없는 경우)
CREATE INDEX IF NOT EXISTS idx_biographies_session_id 
  ON biographies(session_id) 
  WHERE session_id IS NOT NULL;

-- 자서전 인터뷰 세션 조회를 위한 뷰 생성 (선택사항)
CREATE OR REPLACE VIEW biography_sessions AS
SELECT 
  s.id,
  s.elder_id,
  s.started_at,
  s.ended_at,
  s.summary,
  s.risk_level_before,
  s.risk_level_after,
  s.channel,
  e.name as elder_name,
  COUNT(m.id) as message_count
FROM interview_sessions s
JOIN elders e ON s.elder_id = e.id
LEFT JOIN messages m ON m.session_id = s.id
WHERE s.session_type = 'biography'
GROUP BY s.id, s.elder_id, s.started_at, s.ended_at, s.summary, 
         s.risk_level_before, s.risk_level_after, s.channel, e.name;

-- RLS 정책에 session_type 조건 추가 (필요시)
-- 기존 정책은 그대로 유지
