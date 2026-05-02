import { createEmbedding, createEmbeddingsBatch } from "@/lib/ai/embedding";
import { getSupabaseServiceClient } from "@/lib/supabase/server";

const EMBEDDING_MODEL = "text-embedding-3-small";

export async function embedUtterance(input: {
  utteranceId: string;
  transcript: string;
}): Promise<void> {
  const embedding = await createEmbedding(input.transcript);
  const db = getSupabaseServiceClient();

  const { error } = await db
    .from("utterance_embeddings")
    .upsert(
      {
        utterance_id: input.utteranceId,
        embedding,
        model_name: EMBEDDING_MODEL,
      },
      { onConflict: "utterance_id" }
    );

  if (error) {
    throw new Error(`[supabase] Failed to upsert utterance embedding: ${error.message}`);
  }
}

export async function embedUtterancesBatch(
  inputs: { utteranceId: string; transcript: string }[]
): Promise<void> {
  if (inputs.length === 0) return;

  const embeddings = await createEmbeddingsBatch(inputs.map((input) => input.transcript));
  const db = getSupabaseServiceClient();

  const rows = inputs.map((input, index) => ({
    utterance_id: input.utteranceId,
    embedding: embeddings[index],
    model_name: EMBEDDING_MODEL,
  }));

  const { error } = await db
    .from("utterance_embeddings")
    .upsert(rows, { onConflict: "utterance_id" });

  if (error) {
    throw new Error(`[supabase] Failed to upsert utterance embeddings: ${error.message}`);
  }
}
