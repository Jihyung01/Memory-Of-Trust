/**
 * KST (Asia/Seoul) 시간대 유틸리티.
 * 모든 주/월 경계 계산은 KST 기준.
 * 외부 라이브러리 없이 Intl + 수동 계산.
 */

const KST_OFFSET_MS = 9 * 60 * 60 * 1000; // +9h

/**
 * 현재 KST 시각을 Date 객체로 반환 (실제 시스템 시간 + 9h offset 적용된 UTC Date).
 * 주의: 반환 Date의 getUTC* 메서드가 KST 값을 반환.
 */
function toKstDate(date: Date = new Date()): Date {
  return new Date(date.getTime() + KST_OFFSET_MS);
}

/**
 * KST Date의 자정(00:00)을 UTC ISO string으로 반환.
 * @param kstDate — toKstDate()로 생성한 Date
 */
function kstMidnightToUtc(year: number, month: number, day: number): string {
  // KST YYYY-MM-DD 00:00 = UTC YYYY-MM-(DD-1) 15:00
  const kstMidnight = new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
  const utc = new Date(kstMidnight.getTime() - KST_OFFSET_MS);
  return utc.toISOString();
}

/**
 * 지난 월요일(KST)의 주 시작/종료 UTC ISO string 반환.
 * 주 범위: 월요일 00:00 KST ~ 다음 월요일 00:00 KST
 */
export function getLastWeekBoundsUtc(referenceDate?: Date): {
  weekStart: string;
  weekEnd: string;
  weekLabel: string;
} {
  const kst = toKstDate(referenceDate);
  const year = kst.getUTCFullYear();
  const month = kst.getUTCMonth(); // 0-indexed
  const date = kst.getUTCDate();
  const day = kst.getUTCDay(); // 0=Sun, 1=Mon

  // 이번 주 월요일 (KST)
  const daysFromMonday = day === 0 ? 6 : day - 1;
  const thisMonday = new Date(Date.UTC(year, month, date - daysFromMonday));

  // 지난 주 월~일
  const lastMonday = new Date(thisMonday.getTime() - 7 * 24 * 60 * 60 * 1000);
  const lastMondayYear = lastMonday.getUTCFullYear();
  const lastMondayMonth = lastMonday.getUTCMonth() + 1;
  const lastMondayDate = lastMonday.getUTCDate();

  const weekStart = kstMidnightToUtc(lastMondayYear, lastMondayMonth, lastMondayDate);
  const weekEnd = kstMidnightToUtc(
    thisMonday.getUTCFullYear(),
    thisMonday.getUTCMonth() + 1,
    thisMonday.getUTCDate()
  );

  // 주차 계산 (간단히 월 기준)
  const weekOfMonth = Math.ceil(lastMondayDate / 7);
  const weekLabel = `${lastMondayYear}년 ${lastMondayMonth}월 ${weekOfMonth}주차`;

  return { weekStart, weekEnd, weekLabel };
}

/**
 * 특정 KST 날짜의 주 경계를 UTC ISO string으로 반환.
 * @param weekStartKst — "2026-04-21" 형식 (KST 기준 월요일)
 */
export function getWeekBoundsFromDateUtc(weekStartKst: string): {
  weekStart: string;
  weekEnd: string;
  weekLabel: string;
} {
  const [year, month, day] = weekStartKst.split("-").map(Number);
  const weekStart = kstMidnightToUtc(year, month, day);

  const nextMonday = new Date(Date.UTC(year, month - 1, day + 7));
  const weekEnd = kstMidnightToUtc(
    nextMonday.getUTCFullYear(),
    nextMonday.getUTCMonth() + 1,
    nextMonday.getUTCDate()
  );

  const weekOfMonth = Math.ceil(day / 7);
  const weekLabel = `${year}년 ${month}월 ${weekOfMonth}주차`;

  return { weekStart, weekEnd, weekLabel };
}

/**
 * 지난달의 월 시작/종료 UTC ISO string 반환.
 * 월 범위: 1일 00:00 KST ~ 다음 달 1일 00:00 KST
 */
export function getLastMonthBoundsUtc(referenceDate?: Date): {
  monthStart: string;
  monthEnd: string;
  monthLabel: string;
} {
  const kst = toKstDate(referenceDate);
  const year = kst.getUTCFullYear();
  const month = kst.getUTCMonth(); // 0-indexed, 현재 달

  // 지난달
  const lastMonth = month === 0 ? 12 : month; // 1-indexed
  const lastMonthYear = month === 0 ? year - 1 : year;

  const monthStart = kstMidnightToUtc(lastMonthYear, lastMonth, 1);

  // 이번 달 1일
  const monthEnd = kstMidnightToUtc(year, month + 1, 1);

  const monthLabel = `${lastMonthYear}년 ${lastMonth}월`;

  return { monthStart, monthEnd, monthLabel };
}

/**
 * 특정 월의 경계를 UTC ISO string으로 ��환.
 * @param monthStr — "2026-04" 형식
 */
export function getMonthBoundsFromStrUtc(monthStr: string): {
  monthStart: string;
  monthEnd: string;
  monthLabel: string;
} {
  const [year, month] = monthStr.split("-").map(Number);
  const monthStart = kstMidnightToUtc(year, month, 1);

  // 다음 달 1일
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextMonthYear = month === 12 ? year + 1 : year;
  const monthEnd = kstMidnightToUtc(nextMonthYear, nextMonth, 1);

  const monthLabel = `${year}년 ${month}월`;

  return { monthStart, monthEnd, monthLabel };
}
