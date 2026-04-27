-- ============================================
-- MOT Seed Data (development only)
--
-- Sprint 0 T2 마지막에 실행.
-- elder 1명, family_member 1명, photos 5장 + 디바이스 1대 + 구독 1건.
--
-- 주의:
--   - family_members.user_id 는 실제 auth.users 의 UUID 로 교체해야 한다.
--   - 본인 계정으로 Supabase Auth 매직링크 한 번 받은 후, 그 user_id 로 갱신.
-- ============================================

-- 1) 어르신
INSERT INTO elders (id, name, display_name, birth_year, gender, region, voice_persona)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  '이복순',
  '어머님',
  1944,
  'female',
  '경상북도',
  '손주 같은 작가'
)
ON CONFLICT (id) DO NOTHING;

-- 2) 가족 멤버 (user_id 는 실제 auth.users 의 UUID 로 교체!)
INSERT INTO family_members (
  id, user_id, elder_id, relation, is_payer,
  notification_kakao, notification_email
) VALUES (
  '00000000-0000-0000-0000-000000000010',
  -- TODO: replace with real auth.users.id (예: SELECT id FROM auth.users WHERE email = 'tbvj123wlgud@gmail.com')
  '00000000-0000-0000-0000-000000000999',
  '00000000-0000-0000-0000-000000000001',
  '큰아들',
  TRUE,
  TRUE,
  TRUE
)
ON CONFLICT (id) DO NOTHING;

-- 3) 디바이스
INSERT INTO devices (
  id, elder_id, device_token, model
) VALUES (
  '00000000-0000-0000-0000-000000000020',
  '00000000-0000-0000-0000-000000000001',
  -- TODO: replace with real signed device token (HMAC of device id + secret)
  'DEV_DEMO_TOKEN_REPLACE_ME',
  'Samsung Galaxy Tab A7 Lite (시판)'
)
ON CONFLICT (id) DO NOTHING;

-- 4) 사진 5장 (storage_path 는 Supabase Storage 의 photos 버킷 경로)
INSERT INTO photos (
  id, elder_id, uploaded_by, storage_path, caption,
  approximate_year, approximate_age, people_in_photo, location, active
) VALUES
  (
    '00000000-0000-0000-0000-000000000101',
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000010',
    'photos/00000000-0000-0000-0000-000000000001/wedding_1968.jpg',
    '결혼식 날',
    1968, 24,
    ARRAY['남편', '시어머니'],
    '경북 안동',
    TRUE
  ),
  (
    '00000000-0000-0000-0000-000000000102',
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000010',
    'photos/00000000-0000-0000-0000-000000000001/first_son_1972.jpg',
    '큰아들 돌',
    1972, 28,
    ARRAY['큰아들'],
    '대구',
    TRUE
  ),
  (
    '00000000-0000-0000-0000-000000000103',
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000010',
    'photos/00000000-0000-0000-0000-000000000001/family_1985.jpg',
    '온 가족 모임',
    1985, 41,
    ARRAY['남편', '큰아들', '둘째딸'],
    '대구',
    TRUE
  ),
  (
    '00000000-0000-0000-0000-000000000104',
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000010',
    'photos/00000000-0000-0000-0000-000000000001/grandkid_2005.jpg',
    '첫 손주',
    2005, 61,
    ARRAY['큰아들', '며느리', '손주'],
    '서울',
    TRUE
  ),
  (
    '00000000-0000-0000-0000-000000000105',
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000010',
    'photos/00000000-0000-0000-0000-000000000001/old_house_1955.jpg',
    '어릴 때 살던 집',
    1955, 11,
    ARRAY['어머니', '아버지', '오빠'],
    '경북 영주',
    TRUE
  )
ON CONFLICT (id) DO NOTHING;

-- 5) 구독 (파일럿)
INSERT INTO subscriptions (
  id, elder_id, payer_family_id, plan, monthly_price_krw, device_handling, status
) VALUES (
  '00000000-0000-0000-0000-000000000200',
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000010',
  'pilot',
  0,
  'family_owned',
  'active'
)
ON CONFLICT (id) DO NOTHING;

-- 6) 가족 질문 1개 (F5 트리거 데모용)
INSERT INTO family_questions (
  id, elder_id, asked_by, raw_question, status
) VALUES (
  '00000000-0000-0000-0000-000000000300',
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000010',
  '엄마, 아버지랑 처음 만났을 때 어땠어?',
  'pending'
)
ON CONFLICT (id) DO NOTHING;
