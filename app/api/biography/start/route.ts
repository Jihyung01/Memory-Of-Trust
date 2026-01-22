import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/auth'
import { generateFirstQuestion } from '@/lib/biography/prompts'

/**
 * 자서전 인터뷰 세션 시작 API
 * 
 * POST /api/biography/start
 * 
 * Body:
 * {
 *   elderId: string
 *   channel?: string (기본값: 'web')
 * }
 * 
 * Response:
 * {
 *   sessionId: string
 *   question: string
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
    const { elderId, channel = 'web' } = body

    if (!elderId) {
      return NextResponse.json(
        { error: 'elderId is required' },
        { status: 400 }
      )
    }

    const supabase = await createClient()
    const supabaseClient = supabase as any

    // 어르신 정보 확인
    const { data: elder, error: elderError } = await supabaseClient
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

    // 세션 생성
    const { data: session, error: sessionError } = await supabaseClient
      .from('interview_sessions')
      .insert({
        elder_id: elderId,
        session_type: 'biography',
        channel: channel,
        risk_level_before: elder.risk_level,
        created_by: user.id,
        started_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (sessionError || !session) {
      console.error('Error creating session:', sessionError)
      return NextResponse.json(
        { error: 'Failed to create session', details: sessionError?.message },
        { status: 500 }
      )
    }

    // 첫 질문 생성
    const firstQuestion = await generateFirstQuestion(elder.name)

    // 첫 질문을 메시지로 저장 (assistant 역할: 질문자)
    const { error: messageError } = await supabaseClient.from('messages').insert({
      session_id: session.id,
      role: 'assistant',
      content: firstQuestion,
    })

    if (messageError) {
      console.error('Error saving first question:', messageError)
      // 세션은 생성되었으므로 계속 진행
    }

    return NextResponse.json({
      sessionId: session.id,
      question: firstQuestion,
    })
  } catch (error) {
    console.error('Error in /api/biography/start:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
