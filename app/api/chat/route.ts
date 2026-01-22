import { NextRequest, NextResponse } from 'next/server'
import { openai } from '@/lib/openai'
import { createClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { sessionId, elderId, message, conversationHistory } = body

    if (!sessionId || !elderId || !message) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // 어르신 정보 가져오기
    const supabase = await createClient()
    const { data: elder, error: elderError } = await supabase
      .from('elders')
      .select('*')
      .eq('id', elderId)
      .single()

    if (elderError || !elder) {
      return NextResponse.json(
        { error: 'Elder not found' },
        { status: 404 }
      )
    }

    // 이전 대화 히스토리 구성
    const messages = [
      {
        role: 'system' as const,
        content: `당신은 독거 어르신을 위한 친근하고 따뜻한 AI 상담사입니다. 
어르신의 이름은 ${elder.name}입니다.
${elder.birth_year ? `출생년도는 ${elder.birth_year}년입니다.` : ''}

당신의 역할:
1. 어르신의 생애와 기억에 대해 자연스럽고 친근하게 질문합니다.
2. 어린 시절, 가족, 직업, 가장 기억에 남는 순간 등에 대해 대화를 이어갑니다.
3. 한 번에 너무 긴 발화를 유도하지 않고, 짧고 자연스러운 질문을 합니다.
4. 어르신의 말투와 감정을 존중하며, 공감하고 이해한다는 것을 표현합니다.
5. 위험 신호(우울, 자살 생각 등)가 감지되면 부드럽게 관심을 표현하되, 전문적인 도움을 권장합니다.

대화 스타일:
- 존댓말을 사용합니다.
- 따뜻하고 친근한 톤을 유지합니다.
- 어르신의 이야기를 경청하고, 자연스럽게 다음 질문을 이어갑니다.
- 과도하게 긍정적이거나 미화하지 않습니다.`,
      },
    ]

    // 대화 히스토리 추가
    if (conversationHistory && conversationHistory.length > 0) {
      conversationHistory.forEach((msg: { role: string; content: string }) => {
        if (msg.role === 'user') {
          messages.push({
            role: 'user' as const,
            content: msg.content,
          })
        } else if (msg.role === 'assistant') {
          messages.push({
            role: 'assistant' as const,
            content: msg.content,
          })
        }
      })
    }

    // 현재 사용자 메시지 추가
    messages.push({
      role: 'user' as const,
      content: message,
    })

    // OpenAI API 호출
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: messages as any,
      temperature: 0.7,
      max_tokens: 500,
    })

    const assistantMessage = completion.choices[0]?.message?.content

    if (!assistantMessage) {
      return NextResponse.json(
        { error: 'Failed to generate response' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      assistantMessage: {
        content: assistantMessage,
      },
    })
  } catch (error) {
    console.error('Error in chat API:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
