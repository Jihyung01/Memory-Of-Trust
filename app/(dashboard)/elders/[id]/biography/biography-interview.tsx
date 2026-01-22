'use client'

import { useState, useEffect, useRef } from 'react'
import { Database } from '@/types/database'
import { createClient } from '@/lib/supabase/client'
import { riskLevelToColorClass, riskLevelToText } from '@/lib/risk'

type Elder = Database['public']['Tables']['elders']['Row']

interface BiographyInterviewProps {
  elder: Elder
}

interface Message {
  id?: string
  role: 'user' | 'assistant'
  content: string
  created_at?: string
}

export default function BiographyInterview({ elder }: BiographyInterviewProps) {
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [currentQuestion, setCurrentQuestion] = useState<string>('')
  const [answer, setAnswer] = useState('')
  const [loading, setLoading] = useState(false)
  const [sessionStarted, setSessionStarted] = useState(false)
  const [riskLevel, setRiskLevel] = useState<'low' | 'medium' | 'high'>('low')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const supabase = createClient()

  // 메시지 스크롤
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // 세션 시작
  const startSession = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/biography/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          elderId: elder.id,
          channel: 'web',
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to start session')
      }

      const data = await response.json()
      setSessionId(data.sessionId)
      setCurrentQuestion(data.question)
      setSessionStarted(true)
      setMessages([
        {
          role: 'assistant',
          content: data.question,
        },
      ])
    } catch (error) {
      console.error('Error starting session:', error)
      alert('세션 시작 중 오류가 발생했습니다: ' + (error instanceof Error ? error.message : 'Unknown error'))
    } finally {
      setLoading(false)
    }
  }

  // 답변 제출
  const submitAnswer = async () => {
    if (!answer.trim() || !sessionId || loading) return

    const userAnswer = answer.trim()
    setAnswer('')
    setLoading(true)

    // 사용자 답변을 메시지에 추가
    const userMessage: Message = {
      role: 'user',
      content: userAnswer,
    }
    setMessages((prev) => [...prev, userMessage])

    try {
      const response = await fetch('/api/biography/continue', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId,
          elderId: elder.id,
          answer: userAnswer,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to continue session')
      }

      const data = await response.json()
      setCurrentQuestion(data.nextQuestion)
      setRiskLevel(data.riskLevel)

      // AI 질문을 메시지에 추가
      const assistantMessage: Message = {
        role: 'assistant',
        content: data.nextQuestion,
      }
      setMessages((prev) => [...prev, assistantMessage])

      // 위험도가 높으면 알림
      if (data.riskLevel === 'high') {
        alert('⚠️ 위험 신호가 감지되었습니다. 운영자에게 알림이 전송되었습니다.')
      }
    } catch (error) {
      console.error('Error submitting answer:', error)
      alert('답변 전송 중 오류가 발생했습니다: ' + (error instanceof Error ? error.message : 'Unknown error'))
    } finally {
      setLoading(false)
    }
  }

  // 자서전 초안 생성
  const generateDraft = async () => {
    if (!sessionId) return

    if (!confirm('인터뷰를 종료하고 자서전 초안을 생성하시겠습니까?')) {
      return
    }

    setLoading(true)
    try {
      const response = await fetch('/api/biography/draft', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId,
          elderId: elder.id,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to generate draft')
      }

      const data = await response.json()
      alert('자서전 초안이 생성되었습니다!')
      
      // 페이지 새로고침하여 자서전 목록 업데이트
      window.location.reload()
    } catch (error) {
      console.error('Error generating draft:', error)
      alert('자서전 초안 생성 중 오류가 발생했습니다: ' + (error instanceof Error ? error.message : 'Unknown error'))
    } finally {
      setLoading(false)
    }
  }

  if (!sessionStarted) {
    return (
      <div className="bg-white shadow rounded-lg p-8 text-center">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">
          자서전 인터뷰 시작하기
        </h2>
        <p className="text-gray-600 mb-6">
          {elder.name}님의 소중한 기억과 생애 이야기를 함께 나누며 자서전을 만들어보세요.
          <br />
          AI가 자연스럽게 질문을 이어가며 이야기를 듣겠습니다.
        </p>
        <button
          onClick={startSession}
          disabled={loading}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? '시작 중...' : '인터뷰 시작하기'}
        </button>
      </div>
    )
  }

  return (
    <div className="bg-white shadow rounded-lg flex flex-col h-[700px]">
      {/* 헤더 */}
      <div className="border-b border-gray-200 p-4 flex justify-between items-center">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">
            자서전 인터뷰 진행 중
          </h2>
          <p className="text-sm text-gray-500">
            {elder.name}님과의 대화
          </p>
        </div>
        <div className="flex items-center space-x-4">
          <div>
            <span className="text-xs text-gray-500">위험도: </span>
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${riskLevelToColorClass(
                riskLevel
              )}`}
            >
              {riskLevelToText(riskLevel)}
            </span>
          </div>
          <button
            onClick={generateDraft}
            disabled={loading || messages.length < 4}
            className="px-4 py-2 bg-green-600 text-white rounded-md text-sm font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            자서전 초안 생성
          </button>
        </div>
      </div>

      {/* 대화 영역 */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message, index) => (
          <div
            key={index}
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
                {message.role === 'user' ? elder.name : 'AI 인터뷰어'}
              </p>
              <p className="text-sm whitespace-pre-wrap">{message.content}</p>
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
        <div className="mb-2">
          <p className="text-sm font-medium text-gray-700 mb-1">
            현재 질문:
          </p>
          <p className="text-sm text-gray-600 bg-gray-50 p-2 rounded">
            {currentQuestion}
          </p>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            submitAnswer()
          }}
          className="flex space-x-2"
        >
          <textarea
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder="답변을 입력하세요..."
            disabled={loading}
            rows={3}
            className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 resize-none"
          />
          <button
            type="submit"
            disabled={loading || !answer.trim()}
            className="px-6 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed self-end"
          >
            {loading ? '전송 중...' : '답변하기'}
          </button>
        </form>
      </div>
    </div>
  )
}
