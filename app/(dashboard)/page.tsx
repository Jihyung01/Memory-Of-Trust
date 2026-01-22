import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Database } from '@/types/database'
import { riskLevelToColorClass, riskLevelToText } from '@/lib/risk'

type Elder = Database['public']['Tables']['elders']['Row']

async function getEldersByRisk(): Promise<Elder[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('elders')
    .select('*')
    .order('risk_level', { ascending: false })
    .order('last_session_at', { ascending: false, nullsFirst: false })
    .limit(20)

  if (error) {
    console.error('Error fetching elders:', error)
    return []
  }

  return (data || []) as Elder[]
}

async function getEldersByLastSession(): Promise<Elder[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('elders')
    .select('*')
    .order('last_session_at', { ascending: true, nullsFirst: true })
    .limit(10)

  if (error) {
    console.error('Error fetching elders:', error)
    return []
  }

  return (data || []) as Elder[]
}

export default async function DashboardPage() {
  const [eldersByRisk, eldersByLastSession] = await Promise.all([
    getEldersByRisk(),
    getEldersByLastSession(),
  ])

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">대시보드</h1>
        <Link
          href="/dashboard/elders/new"
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          새 어르신 등록
        </Link>
      </div>

      {/* 위험도 높은 순 */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          위험도 높은 어르신
        </h2>
        {eldersByRisk.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg shadow">
            <p className="text-gray-500 mb-4">등록된 어르신이 없습니다.</p>
            <Link
              href="/dashboard/elders/new"
              className="text-blue-600 hover:text-blue-700"
            >
              첫 어르신을 등록해보세요
            </Link>
          </div>
        ) : (
          <div className="bg-white shadow overflow-hidden sm:rounded-md">
            <ul className="divide-y divide-gray-200">
              {eldersByRisk.map((elder) => (
                <li key={elder.id}>
                  <Link
                    href={`/dashboard/elders/${elder.id}`}
                    className="block hover:bg-gray-50 px-4 py-4 sm:px-6"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <div className="flex-shrink-0">
                          <div className="h-10 w-10 rounded-full bg-gray-300 flex items-center justify-center">
                            <span className="text-gray-600 font-medium">
                              {elder.name.charAt(0)}
                            </span>
                          </div>
                        </div>
                        <div className="ml-4">
                          <div className="flex items-center">
                            <p className="text-sm font-medium text-gray-900">
                              {elder.name}
                            </p>
                            {elder.birth_year && (
                              <span className="ml-2 text-sm text-gray-500">
                                ({new Date().getFullYear() - elder.birth_year}세)
                              </span>
                            )}
                          </div>
                          <div className="mt-1 flex items-center text-sm text-gray-500">
                            {elder.last_session_at ? (
                              <span>
                                최근 대화:{' '}
                                {new Date(elder.last_session_at).toLocaleDateString('ko-KR')}
                              </span>
                            ) : (
                              <span>대화 기록 없음</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${riskLevelToColorClass(
                            elder.risk_level
                          )}`}
                        >
                          {riskLevelToText(elder.risk_level)}
                        </span>
                      </div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* 최근 대화일 오래된 순 */}
      {eldersByLastSession.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            방문/콜 우선순위 (최근 대화일 오래된 순)
          </h2>
          <div className="bg-white shadow overflow-hidden sm:rounded-md">
            <ul className="divide-y divide-gray-200">
              {eldersByLastSession.map((elder) => (
                <li key={elder.id}>
                  <Link
                    href={`/dashboard/elders/${elder.id}`}
                    className="block hover:bg-gray-50 px-4 py-4 sm:px-6"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <div className="flex-shrink-0">
                          <div className="h-10 w-10 rounded-full bg-gray-300 flex items-center justify-center">
                            <span className="text-gray-600 font-medium">
                              {elder.name.charAt(0)}
                            </span>
                          </div>
                        </div>
                        <div className="ml-4">
                          <div className="flex items-center">
                            <p className="text-sm font-medium text-gray-900">
                              {elder.name}
                            </p>
                            {elder.birth_year && (
                              <span className="ml-2 text-sm text-gray-500">
                                ({new Date().getFullYear() - elder.birth_year}세)
                              </span>
                            )}
                          </div>
                          <div className="mt-1 flex items-center text-sm text-gray-500">
                            {elder.last_session_at ? (
                              <span>
                                최근 대화:{' '}
                                {new Date(elder.last_session_at).toLocaleDateString('ko-KR')}
                                {' '}({Math.floor(
                                  (Date.now() - new Date(elder.last_session_at).getTime()) /
                                    (1000 * 60 * 60 * 24)
                                )}일 전)
                              </span>
                            ) : (
                              <span className="text-red-600 font-medium">대화 기록 없음</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${riskLevelToColorClass(
                            elder.risk_level
                          )}`}
                        >
                          {riskLevelToText(elder.risk_level)}
                        </span>
                      </div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  )
}
