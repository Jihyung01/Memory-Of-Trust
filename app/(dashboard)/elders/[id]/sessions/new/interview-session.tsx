'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Database } from '@/types/database'
import { createClient } from '@/lib/supabase/client'

type Elder = Database['public']['Tables']['elders']['Row']
type Session = Database['public']['Tables']['interview_sessions']['Row']
type Message = Database['public']['Tables']['messages']['Row']

interface InterviewSessionProps {
  elder: Elder
  session: Session
}

export default function InterviewSession({ elder, session }: InterviewSessionProps) {
  const router = useRouter()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [sessionEnded, setSessionEnded] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const supabase = createClient()

  // 메시지 로드
  useEffect(() => {
    loadMessages()
  }, [session.id])

  // 메시지 스크롤
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function loadMessages() {
    const { data, error } = await (supabase as any)
      .from('messages')
      .select('*')
      .eq('session_id', session.id)
      .order('created_at', { ascending: true })

    if (!error && data) {
      setMessages(data as Message[])
    }
  }

  async function sendMessage() {
    if (!input.trim() || loading) return

    const userMessage = input.trim()
    setInput('')
    setLoading(true)

    try {
      // 사용자 메시지 저장
      const { data: userMsg, error: userError } = await (supabase as any)
        .from('messages')
        .insert({
          session_id: session.id,
          role: 'user',
          content: userMessage,
        })
        .select()
        .single()

      if (userError) {
        console.error('Error saving user message:', userError)
        setLoading(false)
        return
      }

      setMessages((prev) => [...prev, userMsg])

      // GPT 응답 요청
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId: session.id,
          elderId: elder.id,
          message: userMessage,
          conversationHistory: messages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to get AI response')
      }

      const { assistantMessage, error: apiError } = await response.json()

      if (apiError) {
        throw new Error(apiError)
      }

      // AI 응답 저장
      const { data: assistantMsg, error: assistantError } = await (supabase as any)
        .from('messages')
        .insert({
          session_id: session.id,
          role: 'assistant',
          content: assistantMessage.content,
        })
        .select()
        .single()

      if (!assistantError && assistantMsg) {
        setMessages((prev) => [...prev, assistantMsg])
      }
    } catch (error) {
      console.error('Error sending message:', error)
      alert('메시지 전송 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  async function endSession() {
    if (!confirm('인터뷰 세션을 종료하시겠습니까?')) return

    setLoading(true)

    try {
      // 세션 종료 및 요약 생성
      const response = await fetch('/api/sessions/end', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId: session.id,
          elderId: elder.id,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to end session')
      }

      setSessionEnded(true)
      router.push(`/dashboard/elders/${elder.id}/sessions/${session.id}`)
    } catch (error) {
      console.error('Error ending session:', error)
      alert('세션 종료 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-4">
        <button
          onClick={() => router.back()}
          className="text-sm text-gray-500 hover:text-gray-700 mb-2 inline-block"
        >
          ← 돌아가기
        </button>
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900">
            {elder.name}님과의 인터뷰
          </h1>
          <button
            onClick={endSession}
            disabled={sessionEnded || loading}
            className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            세션 종료
          </button>
        </div>
      </div>

      {/* 대화 영역 */}
      <div className="bg-white shadow rounded-lg h-[600px] flex flex-col">
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && (
            <div className="text-center text-gray-500 py-8">
              <p className="text-lg mb-2">인터뷰를 시작하세요</p>
              <p className="text-sm">
                어르신의 생애와 기억에 대해 대화를 나눠보세요.
              </p>
            </div>
          )}
          {messages.map((message) => (
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
                <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                <p className="text-xs mt-1 opacity-70">
                  {new Date(message.created_at).toLocaleTimeString('ko-KR', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-gray-100 rounded-lg px-4 py-2">
                <p className="text-sm text-gray-500">입력 중...</p>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* 입력 영역 */}
        <div className="border-t border-gray-200 p-4">
          <form
            onSubmit={(e) => {
              e.preventDefault()
              sendMessage()
            }}
            className="flex space-x-2"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="메시지를 입력하세요..."
              disabled={loading || sessionEnded}
              className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={loading || sessionEnded || !input.trim()}
              className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              전송
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
