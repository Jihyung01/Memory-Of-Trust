import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Database } from '@/types/database'
import { riskLevelToColorClass, riskLevelToText } from '@/lib/risk'

type Elder = Database['public']['Tables']['elders']['Row']
type Session = Database['public']['Tables']['interview_sessions']['Row']
type Message = Database['public']['Tables']['messages']['Row']

async function getElder(id: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('elders')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !data) {
    return null
  }

  return data
}

async function getSession(sessionId: string, elderId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('interview_sessions')
    .select('*')
    .eq('id', sessionId)
    .eq('elder_id', elderId)
    .single()

  if (error || !data) {
    return null
  }

  return data
}

async function getMessages(sessionId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true })

  if (error) {
    return []
  }

  return data || []
}

export default async function SessionDetailPage({
  params,
}: {
  params: { id: string; sessionId: string }
}) {
  const elder = await getElder(params.id)
  const session = await getSession(params.sessionId, params.id)
  const messages = await getMessages(params.sessionId)

  if (!elder || !session) {
    notFound()
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-6">
        <Link
          href={`/dashboard/elders/${elder.id}`}
          className="text-sm text-gray-500 hover:text-gray-700 mb-4 inline-block"
        >
          ← {elder.name}님 프로필로
        </Link>
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">인터뷰 세션 상세</h1>
            <p className="text-sm text-gray-500 mt-1">
              {new Date(session.started_at).toLocaleDateString('ko-KR', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
              {session.ended_at && (
                <> ~ {new Date(session.ended_at).toLocaleDateString('ko-KR', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}</>
              )}
            </p>
          </div>
          <div className="flex items-center space-x-4">
            <div>
              <span className="text-sm text-gray-500">세션 전 위험도: </span>
              <span
                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${riskLevelToColorClass(
                  session.risk_level_before
                )}`}
              >
                {riskLevelToText(session.risk_level_before)}
              </span>
            </div>
            {session.risk_level_after && (
              <div>
                <span className="text-sm text-gray-500">세션 후 위험도: </span>
                <span
                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${riskLevelToColorClass(
                    session.risk_level_after
                  )}`}
                >
                  {riskLevelToText(session.risk_level_after)}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 대화 로그 */}
        <div className="lg:col-span-2">
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">대화 로그</h2>
            <div className="space-y-4 max-h-[600px] overflow-y-auto">
              {messages.length === 0 ? (
                <p className="text-gray-500 text-sm">대화 메시지가 없습니다.</p>
              ) : (
                messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${
                      message.role === 'user' ? 'justify-end' : 'justify-start'
                    }`}
                  >
                    <div
                      className={`max-w-[80%] rounded-lg px-4 py-2 ${
                        message.role === 'user'
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-900'
                      }`}
                    >
                      <p className="text-sm font-medium mb-1">
                        {message.role === 'user' ? elder.name : 'AI 상담사'}
                      </p>
                      <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                      <p className="text-xs mt-1 opacity-70">
                        {new Date(message.created_at).toLocaleTimeString('ko-KR', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* 세션 정보 */}
        <div className="lg:col-span-1">
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">세션 정보</h2>
            <dl className="space-y-4">
              <div>
                <dt className="text-sm font-medium text-gray-500">시작 시간</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {new Date(session.started_at).toLocaleString('ko-KR')}
                </dd>
              </div>
              {session.ended_at && (
                <div>
                  <dt className="text-sm font-medium text-gray-500">종료 시간</dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    {new Date(session.ended_at).toLocaleString('ko-KR')}
                  </dd>
                </div>
              )}
              <div>
                <dt className="text-sm font-medium text-gray-500">채널</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {session.channel === 'text' && '텍스트'}
                  {session.channel === 'phone_mock' && '전화 (모의)'}
                  {session.channel === 'real_ars' && '전화 (ARS)'}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">메시지 수</dt>
                <dd className="mt-1 text-sm text-gray-900">{messages.length}개</dd>
              </div>
              {session.summary && (
                <div>
                  <dt className="text-sm font-medium text-gray-500">세션 요약</dt>
                  <dd className="mt-1 text-sm text-gray-900 whitespace-pre-wrap">
                    {session.summary}
                  </dd>
                </div>
              )}
            </dl>
          </div>
        </div>
      </div>
    </div>
  )
}
