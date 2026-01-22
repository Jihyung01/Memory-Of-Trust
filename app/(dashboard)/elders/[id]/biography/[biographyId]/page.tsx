import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Database } from '@/types/database'

type Biography = Database['public']['Tables']['biographies']['Row']

async function getBiography(
  biographyId: string,
  elderId: string
): Promise<Biography | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('biographies')
    .select('*')
    .eq('id', biographyId)
    .eq('elder_id', elderId)
    .single()

  if (error || !data) {
    return null
  }

  return data as Biography
}

export default async function BiographyDetailPage({
  params,
}: {
  params: { id: string; biographyId: string }
}) {
  const biography = await getBiography(params.biographyId, params.id)

  if (!biography) {
    notFound()
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <Link
          href={`/dashboard/elders/${params.id}/biography`}
          className="text-sm text-gray-500 hover:text-gray-700 mb-4 inline-block"
        >
          ← 자서전 목록으로
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">{biography.title}</h1>
        <p className="text-sm text-gray-500 mt-2">
          버전 {biography.version} ·{' '}
          {new Date(biography.created_at).toLocaleDateString('ko-KR')}
        </p>
      </div>

      <div className="bg-white shadow rounded-lg p-8">
        {biography.outline && (
          <div className="mb-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">목차</h2>
            <div className="bg-gray-50 rounded-lg p-4">
              <pre className="whitespace-pre-wrap text-sm text-gray-700 font-sans">
                {biography.outline}
              </pre>
            </div>
          </div>
        )}

        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">본문</h2>
          <div className="prose max-w-none">
            <pre className="whitespace-pre-wrap text-sm text-gray-700 font-sans leading-relaxed">
              {biography.content}
            </pre>
          </div>
        </div>
      </div>
    </div>
  )
}
