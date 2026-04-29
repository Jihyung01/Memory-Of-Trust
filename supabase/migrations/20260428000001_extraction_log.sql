-- ============================================
-- S1-T0: extraction_log 테이블
-- raw_utterances → 8축 추출 처리 상태 추적
-- ============================================

CREATE TABLE IF NOT EXISTS extraction_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  utterance_id UUID NOT NULL REFERENCES raw_utterances(id) ON DELETE CASCADE,
  elder_id UUID NOT NULL REFERENCES elders(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('pending', 'processing', 'done', 'failed')),
  attempt_count INT NOT NULL DEFAULT 0,
  last_error TEXT,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(utterance_id)
);

-- pending/failed 발화 빠르게 조회 (SKIP LOCKED claim 패턴용)
CREATE INDEX idx_extraction_log_pending
  ON extraction_log(elder_id, status)
  WHERE status IN ('pending', 'failed');

-- RLS: service_role 전용 (가족/디바이스는 접근 X)
ALTER TABLE extraction_log ENABLE ROW LEVEL SECURITY;

-- service_role 권한
GRANT SELECT, INSERT, UPDATE ON extraction_log TO service_role;

-- updated_at 자동 갱신
DROP TRIGGER IF EXISTS trg_extraction_log_updated_at ON extraction_log;
CREATE TRIGGER trg_extraction_log_updated_at
BEFORE UPDATE ON extraction_log
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
