import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Database } from '@/types/database'
import { riskLevelToColorClass, riskLevelToText } from '@/lib/risk'

type Elder = Database['public']['Tables']['elders']['Row']

async function getElders() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('elders')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching elders:', error)
    return []
  }

  return data || []
}

export default async function EldersPage() {
  const elders = await getElders()

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">어르신 관리</h1>
        <Link
          href="/dashboard/elders/new"
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700"
        >
          새 어르신 등록
        </Link>
      </div>

      {elders.length === 0 ? (
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
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  이름
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  연령대
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  성별
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  위험도
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  최근 대화일
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  작업
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {elders.map((elder) => (
                <tr key={elder.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      {elder.name}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-500">
                      {elder.birth_year
                        ? `${new Date().getFullYear() - elder.birth_year}세`
                        : '-'}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {elder.gender || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${riskLevelToColorClass(
                        elder.risk_level
                      )}`}
                    >
                      {riskLevelToText(elder.risk_level)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {elder.last_session_at
                      ? new Date(elder.last_session_at).toLocaleDateString('ko-KR')
                      : '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <Link
                      href={`/dashboard/elders/${elder.id}`}
                      className="text-blue-600 hover:text-blue-900"
                    >
                      상세보기
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
