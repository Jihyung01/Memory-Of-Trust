import {
  getOpenAIClient,
  OpenAIAuthError,
  OpenAIRateLimitError,
} from "@/lib/ai/openai";
import { env } from "@/lib/env";

const EMBEDDING_MODEL = "text-embedding-3-small";
const EMBEDDING_DIMENSIONS = 1536;
const EMBEDDING_TIMEOUT_MS = 10_000;
const MAX_BATCH_SIZE = 50;

function getErrorStatus(error: unknown): number | null {
  if (typeof error === "object" && error !== null && "status" in error) {
    const status = (error as { status?: unknown }).status;
    return typeof status === "number" ? status : null;
  }

  return null;
}

function assertOpenAIKey(): void {
  if (!env.OPENAI_API_KEY) {
    throw new OpenAIAuthError("[openai] OPENAI_API_KEY is required for embeddings");
  }
}

function validateEmbedding(embedding: number[], index: number): number[] {
  if (embedding.length !== EMBEDDING_DIMENSIONS) {
    throw new Error(
      `[openai] Embedding ${index} dimension mismatch: expected ${EMBEDDING_DIMENSIONS}, got ${embedding.length}`
    );
  }

  return embedding;
}

async function createEmbeddingsChunk(texts: string[]): Promise<number[][]> {
  assertOpenAIKey();

  const openai = getOpenAIClient();
  try {
    const response = await openai.embeddings.create(
      {
        model: EMBEDDING_MODEL,
        input: texts,
      },
      {
        signal: AbortSignal.timeout(EMBEDDING_TIMEOUT_MS),
      }
    );

    return response.data.map((item, index) => validateEmbedding(item.embedding, index));
  } catch (error) {
    const status = getErrorStatus(error);
    if (status === 401) {
      throw new OpenAIAuthError();
    }
    if (status === 429) {
      throw new OpenAIRateLimitError();
    }
    throw error;
  }
}

export async function createEmbedding(text: string): Promise<number[]> {
  const [embedding] = await createEmbeddingsChunk([text]);
  if (!embedding) {
    throw new Error("[openai] Empty embedding response");
  }

  return embedding;
}

export async function createEmbeddingsBatch(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];

  const embeddings: number[][] = [];
  for (let i = 0; i < texts.length; i += MAX_BATCH_SIZE) {
    const chunk = texts.slice(i, i + MAX_BATCH_SIZE);
    const chunkEmbeddings = await createEmbeddingsChunk(chunk);
    embeddings.push(...chunkEmbeddings);
  }

  return embeddings;
}
