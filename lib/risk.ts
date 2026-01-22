/**
 * 위험도 계산 엔진
 * 
 * 대화 내용을 분석하여 위험도를 계산합니다.
 * 이 함수는 확장 가능하도록 설계되어 있으며,
 * 향후 감정 분석, 빈도, 최근 통화 간격 등을 포함해 확장할 수 있습니다.
 */

import { Database } from '@/types/database'

type Message = Database['public']['Tables']['messages']['Row']
type RiskLevel = 'low' | 'medium' | 'high'

interface RiskAnalysisResult {
  level: RiskLevel
  score: number // 0~1 사이의 점수
  reasons: string[]
}

/**
 * 키워드 기반 위험도 계산
 * 
 * 위험 신호 키워드를 감지하여 위험도를 계산합니다.
 */
const RISK_KEYWORDS = {
  high: [
    '죽고 싶다',
    '자살',
    '끝내고 싶다',
    '포기',
    '쓰러졌다',
    '구급차',
    '병원',
    '응급',
    '아무도 없다',
    '혼자 죽는다',
  ],
  medium: [
    '외롭다',
    '슬프다',
    '힘들다',
    '밥을 못 먹겠다',
    '잠을 못 잔다',
    '아프다',
    '고통',
    '불안',
    '걱정',
    '무기력',
  ],
}

/**
 * 대화 메시지 배열을 분석하여 위험도를 계산합니다.
 * 
 * @param messages - 분석할 메시지 배열 (user 역할의 메시지만 분석)
 * @returns 위험도 분석 결과
 */
export function calculateRiskFromConversation(
  messages: Message[]
): RiskAnalysisResult {
  // user 역할의 메시지만 필터링
  const userMessages = messages.filter((msg) => msg.role === 'user')
  
  if (userMessages.length === 0) {
    return {
      level: 'low',
      score: 0,
      reasons: [],
    }
  }

  // 모든 user 메시지 내용을 합침
  const allContent = userMessages.map((msg) => msg.content.toLowerCase()).join(' ')

  let highRiskCount = 0
  let mediumRiskCount = 0
  const detectedKeywords: string[] = []

  // High 위험 키워드 검사
  for (const keyword of RISK_KEYWORDS.high) {
    if (allContent.includes(keyword.toLowerCase())) {
      highRiskCount++
      detectedKeywords.push(keyword)
    }
  }

  // Medium 위험 키워드 검사
  for (const keyword of RISK_KEYWORDS.medium) {
    if (allContent.includes(keyword.toLowerCase())) {
      mediumRiskCount++
      if (!detectedKeywords.includes(keyword)) {
        detectedKeywords.push(keyword)
      }
    }
  }

  // 위험도 점수 계산 (0~1)
  // High 키워드: 각각 0.4점
  // Medium 키워드: 각각 0.15점
  // 최대 1.0점
  const score = Math.min(
    1.0,
    highRiskCount * 0.4 + mediumRiskCount * 0.15
  )

  // 위험도 레벨 결정
  let level: RiskLevel = 'low'
  if (score >= 0.6 || highRiskCount >= 2) {
    level = 'high'
  } else if (score >= 0.3 || highRiskCount >= 1 || mediumRiskCount >= 3) {
    level = 'medium'
  }

  // 이유 생성
  const reasons: string[] = []
  if (highRiskCount > 0) {
    reasons.push(`심각한 위험 신호 ${highRiskCount}건 감지`)
  }
  if (mediumRiskCount > 0) {
    reasons.push(`주의 신호 ${mediumRiskCount}건 감지`)
  }
  if (detectedKeywords.length > 0) {
    reasons.push(`감지된 키워드: ${detectedKeywords.slice(0, 5).join(', ')}`)
  }

  return {
    level,
    score,
    reasons,
  }
}

/**
 * GPT를 사용한 위험도 분석 (향후 확장용)
 * 
 * 현재는 키워드 기반 분석을 사용하지만,
 * 향후 GPT를 활용한 더 정교한 분석으로 확장할 수 있습니다.
 */
export async function calculateRiskWithGPT(
  messages: Message[]
): Promise<RiskAnalysisResult> {
  // 현재는 키워드 기반 분석 사용
  // 향후 OpenAI API를 호출하여 더 정교한 분석 가능
  return calculateRiskFromConversation(messages)
}

/**
 * 위험도 레벨을 숫자로 변환 (정렬 등에 사용)
 */
export function riskLevelToNumber(level: RiskLevel): number {
  switch (level) {
    case 'high':
      return 3
    case 'medium':
      return 2
    case 'low':
      return 1
  }
}

/**
 * 위험도 레벨을 한글 텍스트로 변환
 */
export function riskLevelToText(level: RiskLevel): string {
  switch (level) {
    case 'high':
      return '높음'
    case 'medium':
      return '보통'
    case 'low':
      return '낮음'
  }
}

/**
 * 위험도 레벨에 따른 색상 클래스 반환 (Tailwind CSS)
 */
export function riskLevelToColorClass(level: RiskLevel): string {
  switch (level) {
    case 'high':
      return 'bg-red-100 text-red-800'
    case 'medium':
      return 'bg-yellow-100 text-yellow-800'
    case 'low':
      return 'bg-green-100 text-green-800'
  }
}
