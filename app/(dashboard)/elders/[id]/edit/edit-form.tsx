'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Database } from '@/types/database'

type Elder = Database['public']['Tables']['elders']['Row']

export default function EditElderForm({ elder }: { elder: Elder }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    name: elder.name,
    birth_year: elder.birth_year?.toString() || '',
    gender: elder.gender || '',
    contact_phone: elder.contact_phone || '',
    guardian_contact: elder.guardian_contact || '',
    risk_level: elder.risk_level,
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const supabase = createClient()
      const { error } = await supabase
        .from('elders')
        .update({
          name: formData.name,
          birth_year: formData.birth_year ? parseInt(formData.birth_year) : null,
          gender: formData.gender || null,
          contact_phone: formData.contact_phone || null,
          guardian_contact: formData.guardian_contact || null,
          risk_level: formData.risk_level,
        })
        .eq('id', elder.id)

      if (error) {
        alert('수정 중 오류가 발생했습니다: ' + error.message)
        setLoading(false)
        return
      }

      router.push(`/dashboard/elders/${elder.id}`)
    } catch (err) {
      alert('수정 중 오류가 발생했습니다.')
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <button
          onClick={() => router.back()}
          className="text-sm text-gray-500 hover:text-gray-700 mb-4 inline-block"
        >
          ← 돌아가기
        </button>
        <h1 className="text-2xl font-bold text-gray-900">어르신 정보 수정</h1>
      </div>

      <form onSubmit={handleSubmit} className="bg-white shadow rounded-lg p-6">
        <div className="space-y-6">
          <div>
            <label
              htmlFor="name"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              이름 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="name"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="birth_year"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                출생년도
              </label>
              <input
                type="number"
                id="birth_year"
                min="1900"
                max={new Date().getFullYear()}
                value={formData.birth_year}
                onChange={(e) =>
                  setFormData({ ...formData, birth_year: e.target.value })
                }
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm"
              />
            </div>

            <div>
              <label
                htmlFor="gender"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                성별
              </label>
              <select
                id="gender"
                value={formData.gender}
                onChange={(e) =>
                  setFormData({ ...formData, gender: e.target.value })
                }
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm"
              >
                <option value="">선택 안 함</option>
                <option value="남성">남성</option>
                <option value="여성">여성</option>
              </select>
            </div>
          </div>

          <div>
            <label
              htmlFor="contact_phone"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              연락처
            </label>
            <input
              type="tel"
              id="contact_phone"
              value={formData.contact_phone}
              onChange={(e) =>
                setFormData({ ...formData, contact_phone: e.target.value })
              }
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm"
            />
          </div>

          <div>
            <label
              htmlFor="guardian_contact"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              보호자 연락처
            </label>
            <input
              type="tel"
              id="guardian_contact"
              value={formData.guardian_contact}
              onChange={(e) =>
                setFormData({ ...formData, guardian_contact: e.target.value })
              }
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm"
            />
          </div>

          <div>
            <label
              htmlFor="risk_level"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              위험도
            </label>
            <select
              id="risk_level"
              value={formData.risk_level}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  risk_level: e.target.value as 'low' | 'medium' | 'high',
                })
              }
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm"
            >
              <option value="low">낮음</option>
              <option value="medium">보통</option>
              <option value="high">높음</option>
            </select>
          </div>
        </div>

        <div className="mt-6 flex justify-end space-x-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
          >
            취소
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? '수정 중...' : '수정하기'}
          </button>
        </div>
      </form>
    </div>
  )
}
