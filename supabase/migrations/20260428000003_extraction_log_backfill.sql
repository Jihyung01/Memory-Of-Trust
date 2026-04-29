-- ============================================
-- S1-T0: extraction_log 백필
-- 기존 raw_utterances 전체를 pending으로 등록
-- ============================================

INSERT INTO extraction_log (utterance_id, elder_id, status)
SELECT id, elder_id, 'pending'
FROM raw_utterances
ON CONFLICT (utterance_id) DO NOTHING;
