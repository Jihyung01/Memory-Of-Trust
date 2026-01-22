import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/auth'
import { generateBiographyDraft } from '@/lib/biography/prompts'

/**
 * 자서전 초안 생성 API
 * 
 * POST /api/biography/draft
 * 
 * Body:
 * {
 *   sessionId: string
 *   elderId: string
 * }
 * 
 * Response:
 * {
 *   biography: {
 *     id: string
 *     title: string
 *     outline: string
 *     content: string
 *     ...
 *   }
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
    const { sessionId, elderId } = body

    if (!sessionId || !elderId) {
      return NextResponse.json(
        { error: 'sessionId and elderId are required' },
        { status: 400 }
      )
    }

    const supabase = await createClient()
    const supabaseClient = supabase as any

    // 세션 확인
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

    // 세션이 자서전 타입인지 확인
    if (session.session_type !== 'biography') {
      return NextResponse.json(
        { error: 'Session is not a biography session' },
        { status: 400 }
      )
    }

    // 1) 해당 세션의 모든 Q&A 가져오기
    const { data: messages, error: messagesError } = await supabase
      .from('messages')
      .select('role, content, created_at')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true })

    if (messagesError) {
      console.error('Error fetching messages:', messagesError)
      return NextResponse.json(
        { error: 'Failed to fetch messages' },
        { status: 500 }
      )
    }

    if (!messages || messages.length === 0) {
      return NextResponse.json(
        { error: 'No messages found in session' },
        { status: 400 }
      )
    }

    // 2) GPT로 자서전 초안 생성
    const simpleMessages = (messages || []).map((msg: any) => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content,
    }))

    const { title, outline, content } = await generateBiographyDraft(
      simpleMessages
    )

    // 3) 기존 자서전이 있는지 확인 (같은 세션)
    const { data: existingBio } = await supabaseClient
      .from('biographies')
      .select('*')
      .eq('session_id', sessionId)
      .single()

    let biography

    if (existingBio) {
      // 기존 자서전 업데이트
      const { data: updatedBio, error: updateError } = await supabaseClient
        .from('biographies')
        .update({
          title,
          outline,
          content,
          updated_at: new Date().toISOString(),
        })
        .eq('id', (existingBio as any).id)
        .select()
        .single()

      if (updateError) {
        console.error('Error updating biography:', updateError)
        return NextResponse.json(
          { error: 'Failed to update biography' },
          { status: 500 }
        )
      }

      biography = updatedBio
    } else {
      // 새 자서전 생성
      // 기존 자서전의 최대 버전 확인
      const { data: existingBios } = await supabaseClient
        .from('biographies')
        .select('version')
        .eq('elder_id', elderId)
        .order('version', { ascending: false })
        .limit(1)

      const nextVersion = existingBios && existingBios.length > 0
        ? existingBios[0].version + 1
        : 1

      const { data: newBio, error: insertError } = await supabaseClient
        .from('biographies')
        .insert({
          elder_id: elderId,
          session_id: sessionId,
          title,
          outline,
          content,
          version: nextVersion,
        })
        .select()
        .single()

      if (insertError) {
        console.error('Error creating biography:', insertError)
        return NextResponse.json(
          { error: 'Failed to create biography' },
          { status: 500 }
        )
      }

      biography = newBio
    }

    // 4) 세션 요약 업데이트 (선택사항)
    const summary = `자서전 초안 생성 완료: ${title}`
    await supabaseClient
      .from('interview_sessions')
      .update({ summary })
      .eq('id', sessionId)

    return NextResponse.json({
      biography,
    })
  } catch (error) {
    console.error('Error in /api/biography/draft:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
