-- ============================================
-- S1-T4: story_outputs UPSERT를 위한 UNIQUE 제약
-- (elder_id, output_type, title)로 중��� 방지
-- ============================================

ALTER TABLE story_outputs
  ADD CONSTRAINT story_outputs_elder_type_title_unique
  UNIQUE(elder_id, output_type, title);
