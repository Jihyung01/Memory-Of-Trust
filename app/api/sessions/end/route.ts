import { NextRequest, NextResponse } from 'next/server'
import { openai } from '@/lib/openai'
import { createClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/auth'
import { calculateRiskFromConversation } from '@/lib/risk'

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { sessionId, elderId } = body

    if (!sessionId || !elderId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    const supabase = await createClient()
    const supabaseClient = supabase as any

    // 세션 정보 가져오기
    const { data: session, error: sessionError } = await supabaseClient
      .from('interview_sessions')
      .select('*')
      .eq('id', sessionId)
      .eq('elder_id', elderId)
      .single()

    if (sessionError || !session) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      )
    }

    // 메시지 가져오기
    const { data: messages, error: messagesError } = await supabaseClient
      .from('messages')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true })

    if (messagesError) {
      return NextResponse.json(
        { error: 'Failed to fetch messages' },
        { status: 500 }
      )
    }

    // 위험도 계산
    const riskAnalysis = calculateRiskFromConversation(messages || [])

    // GPT로 세션 요약 생성
    const conversationText = (messages || [])
      .map((msg) => {
        const role = msg.role === 'user' ? '어르신' : '상담사'
        return `${role}: ${msg.content}`
      })
      .join('\n\n')

    const summaryPrompt = `다음은 독거 어르신과의 상담 대화입니다. 이 대화를 3-5문장으로 요약해주세요. 
어르신의 주요 이야기, 감정 상태, 특별히 주목할 만한 내용을 포함해주세요.

대화 내용:
${conversationText}

요약:`

    let summary = ''
    try {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: '당신은 상담 대화를 요약하는 전문가입니다. 객관적이고 간결하게 요약해주세요.',
          },
          {
            role: 'user',
            content: summaryPrompt,
          },
        ],
        temperature: 0.5,
        max_tokens: 300,
      })

      summary = completion.choices[0]?.message?.content || ''
    } catch (error) {
      console.error('Error generating summary:', error)
      summary = '요약 생성 중 오류가 발생했습니다.'
    }

    // 세션 종료 및 업데이트
    const { error: updateError } = await supabaseClient
      .from('interview_sessions')
      .update({
        ended_at: new Date().toISOString(),
        summary: summary,
        risk_level_after: riskAnalysis.level,
      })
      .eq('id', sessionId)

    if (updateError) {
      return NextResponse.json(
        { error: 'Failed to update session' },
        { status: 500 }
      )
    }

    // 어르신의 위험도 업데이트 (세션 후 위험도가 높아진 경우)
    if (riskAnalysis.level === 'high' || riskAnalysis.level === 'medium') {
      const { data: elder } = await supabaseClient
        .from('elders')
        .select('risk_level')
        .eq('id', elderId)
        .single()

      // 위험도가 높아진 경우에만 업데이트
      if (elder && elder.risk_level !== 'high') {
        await supabaseClient
          .from('elders')
          .update({
            risk_level: riskAnalysis.level,
          })
          .eq('id', elderId)
      }

      // 알림 생성 (high 위험도인 경우)
      if (riskAnalysis.level === 'high') {
        await supabaseClient.from('alerts').insert({
          elder_id: elderId,
          session_id: sessionId,
          level: 'high',
          reason: `세션에서 높은 위험도가 감지되었습니다: ${riskAnalysis.reasons.join(', ')}`,
        })
      }
    }

    return NextResponse.json({
      success: true,
      summary,
      riskLevel: riskAnalysis.level,
      riskScore: riskAnalysis.score,
      reasons: riskAnalysis.reasons,
    })
  } catch (error) {
    console.error('Error ending session:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
