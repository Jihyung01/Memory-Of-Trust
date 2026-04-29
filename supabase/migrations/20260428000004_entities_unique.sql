-- ============================================
-- S1-T3: entities 테이블에 (elder_id, name) UNIQUE 제약 추가
-- UPSERT로 mention_count 증가시키기 위해 필요
-- ============================================

ALTER TABLE entities
  ADD CONSTRAINT entities_elder_name_unique UNIQUE(elder_id, name);
