import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import EditElderForm from './edit-form'
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

export default async function EditElderPage({
  params,
}: {
  params: { id: string }
}) {
  const elder = await getElder(params.id)

  if (!elder) {
    notFound()
  }

  return <EditElderForm elder={elder} />
}
