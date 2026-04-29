# S2-F: 레거시 코드 정리

## 목표
사용하지 않는 Clova Voice 코드를 제거하여 TypeScript 빌드 에러를 해소한다.

## 실행 계획

### 1. clova.ts 삭제
**파일**: `lib/ai/clova.ts`
- 이 파일 전체 삭제
- 현재 유일한 TypeScript 에러 원인 (optional env 값을 header에 넣는 타입 에러)

### 2. env.ts에서 Clova 관련 환경변수 제거
**파일**: `lib/env.ts`
- `NAVER_CLOVA_*` 관련 항목 제거 (optional이라 빌드엔 영향 없지만 정리)

### 3. import 확인
- `clova.ts`를 import하는 파일이 없는지 grep 확인
- 있으면 해당 import 제거

## 검증
- `npx tsc --noEmit` → 에러 0개 확인
