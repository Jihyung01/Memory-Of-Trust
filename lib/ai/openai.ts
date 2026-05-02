import OpenAI from "openai";

import { env } from "@/lib/env";

let client: OpenAI | null = null;

export class OpenAIAuthError extends Error {
  constructor(message = "[openai] Authentication failed") {
    super(message);
    this.name = "OpenAIAuthError";
  }
}

export class OpenAIRateLimitError extends Error {
  constructor(message = "[openai] Rate limit exceeded") {
    super(message);
    this.name = "OpenAIRateLimitError";
  }
}

export function getOpenAIClient(): OpenAI {
  if (!client) {
    client = new OpenAI({
      apiKey: env.OPENAI_API_KEY,
    });
  }

  return client;
}

export interface GenerateTextOptions {
  prompt: string;
  systemPrompt?: string;
  timeoutMs?: number;
  model?: string;
}

function getErrorStatus(error: unknown): number | null {
  if (typeof error === "object" && error !== null && "status" in error) {
    const status = (error as { status?: unknown }).status;
    return typeof status === "number" ? status : null;
  }

  return null;
}

export async function generateText(
  input: string | GenerateTextOptions
): Promise<string> {
  const options = typeof input === "string" ? { prompt: input } : input;
  const openai = getOpenAIClient();
  const timeoutMs = options.timeoutMs ?? 15_000;
  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];

  if (options.systemPrompt) {
    messages.push({
      role: "system",
      content: options.systemPrompt,
    });
  }

  messages.push({
    role: "user",
    content: options.prompt,
  });

  let completion: OpenAI.Chat.Completions.ChatCompletion;
  try {
    completion = await openai.chat.completions.create(
      {
        model: options.model ?? env.OPENAI_RESPONSE_MODEL,
        messages,
        temperature: 0.5,
        max_tokens: 120,
      },
      {
        signal: AbortSignal.timeout(timeoutMs),
      }
    );
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

  const text = completion.choices[0]?.message?.content?.trim();

  if (!text) {
    throw new Error("[openai] Empty text response");
  }

  return text;
}
