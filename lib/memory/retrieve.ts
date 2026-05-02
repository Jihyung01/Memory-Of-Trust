import { createEmbedding } from "@/lib/ai/embedding";
import { getSupabaseServiceClient } from "@/lib/supabase/server";

export interface SimilarUtterance {
  id: string;
  transcript: string;
  similarity: number;
  started_at: string;
}

export async function retrieveSimilarUtterances(params: {
  elderId: string;
  queryText: string;
  topK?: number;
  threshold?: number;
}): Promise<SimilarUtterance[]> {
  const queryEmbedding = await createEmbedding(params.queryText);
  const db = getSupabaseServiceClient();

  const { data, error } = await db.rpc("match_utterances", {
    elder_id_input: params.elderId,
    query_embedding: queryEmbedding,
    match_threshold: params.threshold ?? 0.7,
    match_count: params.topK ?? 5,
  });

  if (error) {
    throw new Error(`[supabase] Failed to retrieve similar utterances: ${error.message}`);
  }

  return (data ?? []) as SimilarUtterance[];
}
