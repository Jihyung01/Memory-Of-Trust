-- ============================================
-- pgvector RAG 토대 (T3 메모리 시스템 / T6 자동 embedding)
-- harness §2.3, §4.2
--
-- 안전성:
--  · 신규 객체만 추가. 기존 raw_utterances / RLS / 트리거 무관.
--  · CASCADE는 utterance_embeddings → raw_utterances 단방향만.
-- ============================================

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS utterance_embeddings (
  utterance_id UUID PRIMARY KEY REFERENCES raw_utterances(id) ON DELETE CASCADE,
  embedding VECTOR(1536),
  model_name TEXT DEFAULT 'text-embedding-3-small',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_utterance_embedding
  ON utterance_embeddings
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- 유사도 검색 RPC (harness §4.2)
CREATE OR REPLACE FUNCTION match_utterances(
  elder_id_input UUID,
  query_embedding VECTOR(1536),
  match_threshold FLOAT DEFAULT 0.7,
  match_count INT DEFAULT 5
)
RETURNS TABLE (
  id UUID,
  transcript TEXT,
  similarity FLOAT,
  started_at TIMESTAMPTZ
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ru.id,
    ru.transcript,
    1 - (ue.embedding <=> query_embedding) AS similarity,
    ru.started_at
  FROM raw_utterances ru
  JOIN utterance_embeddings ue ON ue.utterance_id = ru.id
  WHERE ru.elder_id = elder_id_input
    AND 1 - (ue.embedding <=> query_embedding) > match_threshold
  ORDER BY ue.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- RLS: utterance_embeddings 도 가족이 본인 어르신 것만 조회
ALTER TABLE utterance_embeddings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS family_reads_utterance_embeddings ON utterance_embeddings;
CREATE POLICY family_reads_utterance_embeddings ON utterance_embeddings
  FOR SELECT
  USING (
    utterance_id IN (
      SELECT id FROM raw_utterances WHERE elder_id IN (
        SELECT elder_id FROM family_members WHERE user_id = auth.uid()
      )
    )
  );

GRANT SELECT ON utterance_embeddings TO authenticated;
GRANT SELECT, INSERT ON utterance_embeddings TO service_role;

GRANT EXECUTE ON FUNCTION match_utterances(UUID, VECTOR(1536), FLOAT, INT)
  TO authenticated, service_role;
