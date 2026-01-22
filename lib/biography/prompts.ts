/**
 * 자서전 인터뷰 엔진 - GPT 프롬프트 관리
 * 
 * 이 모듈은 자서전 인터뷰를 위한 질문 생성, 위험도 분석, 자서전 초안 생성을 담당합니다.
 */

import { openai } from '@/lib/openai'

export type SimpleMessage = { role: 'user' | 'assistant'; content: string }

/**
 * 첫 번째 질문 생성
 * 
 * 자서전 인터뷰를 시작할 때 사용하는 첫 질문입니다.
 * MVP에서는 고정 질문을 사용하지만, 향후 GPT로 동적 생성 가능합니다.
 */
export async function generateFirstQuestion(elderName?: string): Promise<string> {
  // MVP: 고정 질문 사용
  // 향후 GPT로 동적 생성 가능
  if (elderName) {
    return `${elderName}님, 안녕하세요. 오늘은 ${elderName}님의 소중한 기억들을 함께 나눠보고 싶습니다. 처음부터 천천히 들어보고 싶어요. 어린 시절을 떠올리면 가장 먼저 생각나는 장소나 장면이 있나요?`
  }
  return '처음부터 천천히 들어보고 싶어요. 어린 시절을 떠올리면 가장 먼저 생각나는 장소나 장면이 있나요?'
}

/**
 * 다음 질문 생성 및 위험도 분석
 * 
 * 사용자의 답변을 바탕으로 다음 질문을 생성하고,
 * 동시에 정서적 위험 신호를 감지합니다.
 * 
 * @param messages - 지금까지의 대화 히스토리
 * @returns 다음 질문과 위험도 레벨
 */
export async function getNextQuestionAndRisk(
  messages: SimpleMessage[]
): Promise<{ nextQuestion: string; riskLevel: 'none' | 'mild' | 'high' }> {
  const systemPrompt = `당신은 고령자 및 독거노인 대상의 "자서전 인터뷰를 진행하는 대화형 인터뷰어"입니다.

목표:
- 상대방의 생애를 시대별로 고르게 듣고,
- 기억에 남는 사람, 장소, 사건을 중심으로 이야기를 끌어내며,
- 동시에 우울감, 상실감, 자살 위험 등 정서적 위험 신호를 부드럽게 감지합니다.

규칙:
- 질문은 한 번에 하나만, 짧고 명료하게.
- 심문이 아니라 "함께 회상하는 느낌"으로 물어볼 것.
- 너무 무거운 감정이 보이면, 먼저 공감과 안전감을 표현한 후 다음 질문으로 넘어갈 것.
- 이미 충분히 들은 구간(예: 어린 시절)이 있다면, 다른 시기로 넘어갈 것(청년기, 결혼, 일, 가족, 취미 등).
- 존댓말을 사용하고, 따뜻하고 친근한 톤을 유지합니다.
- 어르신의 말투와 감정을 존중하며, 공감하고 이해한다는 것을 표현합니다.

위험 신호 감지:
- "none": 특별한 위험 신호 없음, 정상적인 대화
- "mild": 약간의 우울감이나 슬픔 표현, 주의 깊게 관찰 필요
- "high": 자살 생각, 극도의 절망감, 즉각적인 개입 필요

출력 형식(JSON):
{
  "nextQuestion": "다음에 할 질문 한 문장",
  "riskLevel": "none" | "mild" | "high"
}`

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages.map((m) => ({
          role: m.role === 'user' ? 'user' : 'assistant',
          content: m.content,
        })),
      ],
      response_format: { type: 'json_object' },
      temperature: 0.7,
      max_tokens: 500,
    })

    const raw = response.choices[0]?.message?.content || '{}'
    const parsed = JSON.parse(raw)

    return {
      nextQuestion: (parsed.nextQuestion as string) || '더 들려주실 이야기가 있으신가요?',
      riskLevel: (parsed.riskLevel as 'none' | 'mild' | 'high') || 'none',
    }
  } catch (error) {
    console.error('Error generating next question:', error)
    // 에러 발생 시 기본 질문 반환
    return {
      nextQuestion: '더 들려주실 이야기가 있으신가요?',
      riskLevel: 'none',
    }
  }
}

/**
 * 자서전 초안 생성
 * 
 * 인터뷰 세션의 모든 Q&A를 바탕으로 자서전 초안을 생성합니다.
 * 
 * @param messages - 인터뷰 세션의 모든 메시지
 * @returns 자서전 제목, 목차(outline), 본문(content)
 */
export async function generateBiographyDraft(
  messages: SimpleMessage[]
): Promise<{ title: string; outline: string; content: string }> {
  const systemPrompt = `당신은 고령자 생애사 자서전을 정리하는 편집자입니다.
입력은 "인터뷰어의 질문(assistant)"과 "어르신의 대답(user)"으로 이루어진 대화 기록입니다.

목표:
- 시간 순서(어린 시절 → 청년기 → 중년기 → 현재)로 정리한 자서전 초안 작성
- 중요한 사람/사건/장소를 중심으로 스토리 구조화
- 존중(존대)과 따뜻한 톤 유지
- 과장 없이, 실제 대화를 기반으로 한 사실 중심의 서술
- 어르신의 말투를 존중하되, 지나친 미화는 피하고, 존엄을 유지하는 톤
- 반드시 입력된 메시지에서만 추론하도록 지시 (hallucination 방지)

구조:
- 제목: 어르신의 생애를 대표하는 의미 있는 제목
- 목차: 시대별 챕터 구조 (예: "1. 어린 시절\n2. 청년기\n3. 결혼과 가족\n4. 일과 성취\n5. 현재")
- 본문: 각 챕터별로 상세한 내용 작성

출력 형식(JSON):
{
  "title": "자서전 제목",
  "outline": "1. 어린 시절 ...\\n2. 청년기 ...\\n3. ...",
  "content": "전체 자서전 초안 텍스트 (마크다운 형식 가능)"
}`

  // 대화 내용을 텍스트로 변환
  const conversationText = messages
    .map((msg) => {
      const role = msg.role === 'user' ? '어르신' : '인터뷰어'
      return `${role}: ${msg.content}`
    })
    .join('\n\n')

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: `다음은 인터뷰 대화 기록입니다. 이를 바탕으로 자서전 초안을 작성해주세요.\n\n${conversationText}`,
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.5,
      max_tokens: 3000,
    })

    const raw = response.choices[0]?.message?.content || '{}'
    const parsed = JSON.parse(raw)

    return {
      title: (parsed.title as string) || '나의 이야기',
      outline: (parsed.outline as string) || '',
      content: (parsed.content as string) || '',
    }
  } catch (error) {
    console.error('Error generating biography draft:', error)
    // 에러 발생 시 기본값 반환
    return {
      title: '나의 이야기',
      outline: '1. 어린 시절\n2. 청년기\n3. 현재',
      content: '인터뷰 내용을 바탕으로 자서전을 작성 중입니다.',
    }
  }
}

/**
 * 위험도 레벨을 RiskLevel 타입으로 변환
 */
export function convertRiskLevelToStandard(
  riskLevel: 'none' | 'mild' | 'high'
): 'low' | 'medium' | 'high' {
  switch (riskLevel) {
    case 'high':
      return 'high'
    case 'mild':
      return 'medium'
    case 'none':
    default:
      return 'low'
  }
}
