-- =====================================================
-- MOT 테스트용 시드 데이터
-- Supabase 대시보드 → SQL Editor → New query → 복붙 → Run
-- =====================================================

-- 1) 테스트 사용자
INSERT INTO users (id, display_name, birth_year, gender, region_origin, region_current, dialect, mode, is_active, metadata)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  '영숙',
  1945,
  'female',
  '경상북도 안동',
  '서울 관악구',
  '경상',
  'normal',
  true,
  '{"personality_notes": "말이 느리고 조용한 편. 남편 이야기를 가끔 꺼내시지만 깊이 들어가면 피하심. 고향 음식 이야기에 눈이 반짝이심."}'::jsonb
);

-- 2) 페르소나 상태 (첫 방문용 기본값)
INSERT INTO persona_state (user_id, consecutive_visits, total_facts, total_entities)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  0, 0, 0
);

-- 확인
SELECT '✓ 시드 데이터 삽입 완료' AS status, display_name, birth_year
FROM users WHERE id = '00000000-0000-0000-0000-000000000001';
