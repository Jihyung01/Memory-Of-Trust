-- ============================================
-- utterance_embeddings 동기 hook 권한 거부 fix
--
-- 기존 마이그레이션 20260502000001_pgvector_rag.sql 에서
-- service_role 에 SELECT, INSERT 만 부여.
-- supabase-js .upsert() 는 ON CONFLICT DO UPDATE 로 변환되어 UPDATE 권한 필요.
-- 첫 호출부터 거부되어 T6 hook 100% 실패 상태였음.
--
-- 안전성:
--   · 신규 GRANT 한 줄 추가. 기존 RLS / 트리거 / 다른 grants 무관.
--   · authenticated 는 SELECT 만 유지 (가족 대시보드 read-only 그대로).
--   · raw_utterances immutable 보장에 영향 없음.
-- ============================================

GRANT UPDATE ON utterance_embeddings TO service_role;
