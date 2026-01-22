import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Database } from '@/types/database'
import { riskLevelToColorClass, riskLevelToText } from '@/lib/risk'

type Elder = Database['public']['Tables']['elders']['Row']
type Session = Database['public']['Tables']['interview_sessions']['Row']

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

async function getSessions(elderId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('interview_sessions')
    .select('*')
    .eq('elder_id', elderId)
    .order('created_at', { ascending: false })
    .limit(10)

  if (error) {
    return []
  }

  return data || []
}

export default async function ElderDetailPage({
  params,
}: {
  params: { id: string }
}) {
  const elder = await getElder(params.id)
  const sessions = await getSessions(params.id)

  if (!elder) {
    notFound()
  }

  return (
    <div>
      <div className="mb-6">
        <Link
          href="/dashboard/elders"
          className="text-sm text-gray-500 hover:text-gray-700 mb-4 inline-block"
        >
          ← 어르신 목록으로
        </Link>
        <div className="flex justify-between items-center mt-2">
          <h1 className="text-2xl font-bold text-gray-900">{elder.name}님</h1>
          <div className="flex space-x-3">
            <Link
              href={`/dashboard/elders/${elder.id}/edit`}
              className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
            >
              수정
            </Link>
            <Link
              href={`/dashboard/elders/${elder.id}/sessions/new`}
              className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
            >
              새 인터뷰 시작
            </Link>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 프로필 정보 */}
        <div className="lg:col-span-1">
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">프로필 정보</h2>
            <dl className="space-y-4">
              <div>
                <dt className="text-sm font-medium text-gray-500">이름</dt>
                <dd className="mt-1 text-sm text-gray-900">{elder.name}</dd>
              </div>
              {elder.birth_year && (
                <div>
                  <dt className="text-sm font-medium text-gray-500">나이</dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    {new Date().getFullYear() - elder.birth_year}세
                  </dd>
                </div>
              )}
              {elder.gender && (
                <div>
                  <dt className="text-sm font-medium text-gray-500">성별</dt>
                  <dd className="mt-1 text-sm text-gray-900">{elder.gender}</dd>
                </div>
              )}
              {elder.contact_phone && (
                <div>
                  <dt className="text-sm font-medium text-gray-500">연락처</dt>
                  <dd className="mt-1 text-sm text-gray-900">{elder.contact_phone}</dd>
                </div>
              )}
              {elder.guardian_contact && (
                <div>
                  <dt className="text-sm font-medium text-gray-500">보호자 연락처</dt>
                  <dd className="mt-1 text-sm text-gray-900">{elder.guardian_contact}</dd>
                </div>
              )}
              <div>
                <dt className="text-sm font-medium text-gray-500">위험도</dt>
                <dd className="mt-1">
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${riskLevelToColorClass(
                      elder.risk_level
                    )}`}
                  >
                    {riskLevelToText(elder.risk_level)}
                  </span>
                </dd>
              </div>
              {elder.last_session_at && (
                <div>
                  <dt className="text-sm font-medium text-gray-500">최근 대화일</dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    {new Date(elder.last_session_at).toLocaleDateString('ko-KR')}
                  </dd>
                </div>
              )}
            </dl>
          </div>
        </div>

        {/* 세션 목록 */}
        <div className="lg:col-span-2">
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">인터뷰 세션</h2>
            {sessions.length === 0 ? (
              <p className="text-gray-500 text-sm">아직 인터뷰 세션이 없습니다.</p>
            ) : (
              <div className="space-y-4">
                {sessions.map((session) => (
                  <Link
                    key={session.id}
                    href={`/dashboard/elders/${elder.id}/sessions/${session.id}`}
                    className="block border border-gray-200 rounded-lg p-4 hover:bg-gray-50"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {new Date(session.started_at).toLocaleDateString('ko-KR', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                        {session.summary && (
                          <p className="mt-1 text-sm text-gray-500 line-clamp-2">
                            {session.summary}
                          </p>
                        )}
                      </div>
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${riskLevelToColorClass(
                          session.risk_level_after || session.risk_level_before
                        )}`}
                      >
                        {riskLevelToText(session.risk_level_after || session.risk_level_before)}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
