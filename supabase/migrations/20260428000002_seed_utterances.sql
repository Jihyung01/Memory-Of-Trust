-- ============================================
-- S1-T0: 검증용 seed 발화 데이터 (6개)
-- elder_id: 00000000-0000-0000-0000-000000000001
-- ============================================

-- 더미 어르신이 없으면 생성
INSERT INTO elders (id, name, display_name, birth_year, gender, region)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  '김순자',
  '어머님',
  1945,
  'female',
  '서울'
)
ON CONFLICT (id) DO NOTHING;

-- 검증용 발화 6개 (KST 기준 오늘 분산)
-- started_at / ended_at: UTC 기준 (KST -9h)

INSERT INTO raw_utterances (id, elder_id, transcript, started_at, ended_at)
VALUES
  (
    '11111111-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    '오늘 아침에 밥 먹었어',
    NOW() - INTERVAL '5 hours',
    NOW() - INTERVAL '4 hours 59 minutes'
  ),
  (
    '11111111-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000001',
    '예전에 결혼식 날 비가 많이 왔었지. 친정엄마가 우산 들고 마중 나오셨어',
    NOW() - INTERVAL '4 hours',
    NOW() - INTERVAL '3 hours 58 minutes'
  ),
  (
    '11111111-0000-0000-0000-000000000003',
    '00000000-0000-0000-0000-000000000001',
    '큰아들이 요즘 연락을 잘 안 해서 걱정이야',
    NOW() - INTERVAL '3 hours',
    NOW() - INTERVAL '2 hours 59 minutes'
  ),
  (
    '11111111-0000-0000-0000-000000000004',
    '00000000-0000-0000-0000-000000000001',
    '어제 동네 마트에서 옛날 동창을 만났어. 너무 반가웠지',
    NOW() - INTERVAL '2 hours',
    NOW() - INTERVAL '1 hour 59 minutes'
  ),
  (
    '11111111-0000-0000-0000-000000000005',
    '00000000-0000-0000-0000-000000000001',
    '그 사람 이름이 뭐였더라… 기억이 잘 안 나',
    NOW() - INTERVAL '1 hour',
    NOW() - INTERVAL '59 minutes'
  ),
  (
    '11111111-0000-0000-0000-000000000006',
    '00000000-0000-0000-0000-000000000001',
    '젊었을 때는 시장에서 생선 장사를 했어. 새벽 4시에 일어났지',
    NOW() - INTERVAL '30 minutes',
    NOW() - INTERVAL '29 minutes'
  )
ON CONFLICT (id) DO NOTHING;
