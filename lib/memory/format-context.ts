export interface MemoryContextInput {
  similarUtterances?: { transcript: string; started_at: string }[];
  recentUtterances: { transcript: string; started_at: string }[];
  entities: { name: string; relation: string | null; emotional_tone: string | null }[];
  themes: { theme: string; weight: number }[];
  unresolved: { type: string; excerpt: string }[];
  sensory: { sense: string; detail: string; context: string | null }[];
}

export function formatMemoryContext(input: MemoryContextInput): string {
  const similarUtterances = input.similarUtterances?.length
    ? input.similarUtterances
        .map((u) => `- [${u.started_at.slice(0, 10)}] ${u.transcript}`)
        .join("\n")
    : null;
  const recentUtterances = input.recentUtterances.length
    ? input.recentUtterances
        .map((u) => `- [${u.started_at.slice(0, 10)}] ${u.transcript}`)
        .join("\n")
    : "- 아직 이전 발화 없음";
  const entities = input.entities.length
    ? input.entities
        .map((e) => `- ${e.name}${e.relation ? ` (${e.relation})` : ""}${e.emotional_tone ? `, ${e.emotional_tone}` : ""}`)
        .join("\n")
    : "- 없음";
  const themes = input.themes.length
    ? input.themes.map((t) => `- ${t.theme}`).join("\n")
    : "- 없음";
  const unresolved = input.unresolved.length
    ? input.unresolved.map((u) => `- (${u.type}) ${u.excerpt}`).join("\n")
    : "- 없음";
  const sensory = input.sensory.length
    ? input.sensory
        .map((s) => `- ${s.sense}: ${s.detail}${s.context ? ` (${s.context})` : ""}`)
        .join("\n")
    : "- 없음";

  return [
    "【어르신에 대한 기억】",
    "",
    ...(similarUtterances
      ? [
          "비슷한 옛 이야기:",
          similarUtterances,
          "",
        ]
      : []),
    "최근 하신 말씀:",
    recentUtterances,
    "",
    "자주 말씀하신 사람:",
    entities,
    "",
    "반복되는 주제:",
    themes,
    "",
    "미해결로 남아있는 것:",
    unresolved,
    "",
    "기억하시는 감각:",
    sensory,
    "",
    "이 정보를 자연스럽게 활용하되, 이 정보를 알고 있다는 사실을 직접 설명하지 않는다.",
  ].join("\n");
}
