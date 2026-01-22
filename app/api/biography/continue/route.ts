import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/auth'
import { getNextQuestionAndRisk, convertRiskLevelToStandard } from '@/lib/biography/prompts'

/**
 * 자서전 인터뷰 계속하기 API
 * 
 * POST /api/biography/continue
 * 
 * Body:
 * {
 *   sessionId: string
 *   elderId: string
 *   answer: string
 * }
 * 
 * Response:
 * {
 *   nextQuestion: string
 *   riskLevel: 'low' | 'medium' | 'high'
 * }
 */
export async function POST(req: NextRequest) {
  try {
    // 인증 확인
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { sessionId, elderId, answer } = body

    if (!sessionId || !elderId || !answer) {
      return NextResponse.json(
        { error: 'sessionId, elderId, and answer are required' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // 세션 확인
    const { data: session, error: sessionError } = await supabase
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

    // 세션이 자서전 타입인지 확인
    if (session.session_type !== 'biography') {
      return NextResponse.json(
        { error: 'Session is not a biography session' },
        { status: 400 }
      )
    }

    // 1) 사용자 답변 저장 (user role)
    const { error: answerError } = await supabase.from('messages').insert({
      session_id: sessionId,
      role: 'user',
      content: answer.trim(),
    })

    if (answerError) {
      console.error('Error saving answer:', answerError)
      return NextResponse.json(
        { error: 'Failed to save answer' },
        { status: 500 }
      )
    }

    // 2) 지금까지의 대화 불러오기
    const { data: messages, error: messagesError } = await supabase
      .from('messages')
      .select('role, content, created_at')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true })

    if (messagesError) {
      console.error('Error fetching messages:', messagesError)
      return NextResponse.json(
        { error: 'Failed to fetch conversation history' },
        { status: 500 }
      )
    }

    // 3) GPT에게 "다음 질문 + 위험도" 요청
    const simpleMessages = (messages || []).map((msg) => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content,
    }))

    const { nextQuestion, riskLevel: gptRiskLevel } =
      await getNextQuestionAndRisk(simpleMessages)

    // 4) 질문 메시지를 assistant로 저장
    const { error: questionError } = await supabase.from('messages').insert({
      session_id: sessionId,
      role: 'assistant',
      content: nextQuestion,
    })

    if (questionError) {
      console.error('Error saving question:', questionError)
      // 질문은 생성되었으므로 계속 진행
    }

    // 5) 위험도 변환 (none/mild/high -> low/medium/high)
    const riskLevel = convertRiskLevelToStandard(gptRiskLevel)

    // 6) 위험도가 높다면 alerts에 기록
    if (riskLevel === 'high' || riskLevel === 'medium') {
      const { error: alertError } = await supabase.from('alerts').insert({
        elder_id: elderId,
        session_id: sessionId,
        level: riskLevel === 'high' ? 'high' : 'medium',
        reason: `자서전 인터뷰 중 위험 신호 감지: ${gptRiskLevel}`,
      })

      if (alertError) {
        console.error('Error creating alert:', alertError)
        // 알림 생성 실패해도 계속 진행
      }
    }

    return NextResponse.json({
      nextQuestion,
      riskLevel,
    })
  } catch (error) {
    console.error('Error in /api/biography/continue:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
