import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Database } from '@/types/database'
import BiographyInterview from './biography-interview'

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

async function getBiographySessions(elderId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('interview_sessions')
    .select('*')
    .eq('elder_id', elderId)
    .eq('session_type', 'biography')
    .order('created_at', { ascending: false })
    .limit(10)

  if (error) {
    return []
  }

  return data || []
}

async function getBiographies(elderId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('biographies')
    .select('*')
    .eq('elder_id', elderId)
    .order('created_at', { ascending: false })
    .limit(10)

  if (error) {
    return []
  }

  return data || []
}

export default async function BiographyPage({
  params,
}: {
  params: { id: string }
}) {
  const elder = await getElder(params.id)
  const sessions = await getBiographySessions(params.id)
  const biographies = await getBiographies(params.id)

  if (!elder) {
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
        <h1 className="text-2xl font-bold text-gray-900">
          {elder.name}님의 자서전 인터뷰
        </h1>
        <p className="text-sm text-gray-500 mt-2">
          생애와 기억을 함께 나누며 자서전을 만들어보세요.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 자서전 인터뷰 시작 */}
        <div className="lg:col-span-2">
          <BiographyInterview elder={elder} />
        </div>

        {/* 세션 및 자서전 목록 */}
        <div className="lg:col-span-1 space-y-6">
          {/* 자서전 목록 */}
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">
              생성된 자서전
            </h2>
            {biographies.length === 0 ? (
              <p className="text-gray-500 text-sm">
                아직 생성된 자서전이 없습니다.
              </p>
            ) : (
              <div className="space-y-3">
                {biographies.map((bio) => (
                  <Link
                    key={bio.id}
                    href={`/dashboard/elders/${elder.id}/biography/${bio.id}`}
                    className="block border border-gray-200 rounded-lg p-3 hover:bg-gray-50"
                  >
                    <h3 className="font-medium text-gray-900 text-sm">
                      {bio.title}
                    </h3>
                    <p className="text-xs text-gray-500 mt-1">
                      버전 {bio.version} ·{' '}
                      {new Date(bio.created_at).toLocaleDateString('ko-KR')}
                    </p>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* 인터뷰 세션 목록 */}
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">
              인터뷰 세션
            </h2>
            {sessions.length === 0 ? (
              <p className="text-gray-500 text-sm">
                아직 인터뷰 세션이 없습니다.
              </p>
            ) : (
              <div className="space-y-3">
                {sessions.map((session) => (
                  <Link
                    key={session.id}
                    href={`/dashboard/elders/${elder.id}/sessions/${session.id}`}
                    className="block border border-gray-200 rounded-lg p-3 hover:bg-gray-50"
                  >
                    <p className="text-sm font-medium text-gray-900">
                      {new Date(session.started_at).toLocaleDateString('ko-KR', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })}
                    </p>
                    {session.summary && (
                      <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                        {session.summary}
                      </p>
                    )}
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
