import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/auth'
import InterviewSession from './interview-session'
import { Database } from '@/types/database'

type Elder = Database['public']['Tables']['elders']['Row']

async function getElder(id: string): Promise<Elder | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('elders')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !data) {
    return null
  }

  return data as Elder
}

export default async function NewSessionPage({
  params,
}: {
  params: { id: string }
}) {
  const elder = await getElder(params.id)
  const user = await getCurrentUser()

  if (!elder) {
    notFound()
  }

  if (!user) {
    redirect('/login')
  }

  // 새 세션 생성
  const supabase = await createClient()
  const supabaseClient = supabase as any
  const { data: session, error } = await supabaseClient
    .from('interview_sessions')
    .insert({
      elder_id: elder.id,
      created_by: user.id,
      channel: 'text',
      session_type: 'care',
      risk_level_before: elder.risk_level,
    })
    .select()
    .single()

  if (error || !session) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600">세션 생성 중 오류가 발생했습니다.</p>
        <p className="text-sm text-gray-500 mt-2">{error?.message}</p>
      </div>
    )
  }

  return <InterviewSession elder={elder} session={session} />
}
