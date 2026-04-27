import OpenAI from "openai";

import { env } from "@/lib/env";

let client: OpenAI | null = null;

function getOpenAIClient(): OpenAI {
  if (!client) {
    client = new OpenAI({
      apiKey: env.OPENAI_API_KEY,
    });
  }

  return client;
}

export async function generateText(prompt: string): Promise<string> {
  const openai = getOpenAIClient();
  const completion = await openai.chat.completions.create({
    model: env.OPENAI_RESPONSE_MODEL,
    messages: [
      {
        role: "user",
        content: prompt,
      },
    ],
    temperature: 0.5,
    max_tokens: 120,
  });

  const text = completion.choices[0]?.message?.content?.trim();

  if (!text) {
    throw new Error("[openai] Empty text response");
  }

  return text;
}
