/**
 * 한국어 UI 텍스트 — 단일 진실원
 *
 * Phase 1: 정적 ko 객체.
 * Phase 3+: i18next 도입 시 이 객체를 그대로 ko 리소스로 마이그레이션.
 *
 * 어르신 화면(elder.*) 의 텍스트는 docs/PRODUCT.md, agent-prompts/08_elder_ux_guardian_claude.md
 * 의 금지어 룰을 절대 위반하지 않는다.
 *
 * 변경 시 8번 가디언 검수 필수.
 */

export const ko = {
  // ============================================
  // 어르신 화면 (app/(device)/*)
  //   금지어: 기록되었습니다 / 저장합니다 / 녹음합니다 / 수집합니다
  //          / 도와드릴까요 / 힘내세요 / 오류가 발생했습니다 / AI / 챗봇
  // ============================================
  elder: {
    // 마이크 버튼 라벨 (수집 언어 회피)
    micStart: "이야기 시작",
    micStop: "잠시 멈추기",

    // 사진 문장이 늦게 올 때 자연스러운 기본 문장
    promptFallback: "사진을 보며 떠오르는 이야기를 들려주세요",

    // 침묵 / 대기 (시각만)
    listening: "...", // 듣는 중일 때 시각 표현 (텍스트 최소화)

    // ambient 모드
    ambientHint: "", // 야간엔 텍스트 없음

    // 시계 라벨 (없는 게 자연스러움 — 빈 문자열 유지)
    clockSuffix: "",
  },

  // ============================================
  // 자녀 대시보드 (app/(family)/*)
  //   여기는 일반 SaaS 톤 OK.
  // ============================================
  family: {
    appName: "MOT",
    appTagline: "어머님 / 아버님의 이야기를 함께 모으는 곳",

    nav: {
      home: "홈",
      photos: "사진",
      questions: "질문하기",
      cards: "이번 주 이야기",
      chapters: "월간 챕터",
      billing: "구독",
    },

    auth: {
      loginTitle: "로그인",
      loginEmailLabel: "이메일 주소",
      loginSubmit: "매직 링크 받기",
      loginSent: "메일을 보냈어요. 메일함을 확인해 주세요.",
      linkExpired: "이전 매직 링크가 만료되었어요. 아래에서 다시 받아주세요.",
      noLinkedElder: "이 계정에 연결된 어르신이 없어요.",
      resendCooldown: (sec: number) => `${sec}초 뒤에 다시 받기`,
      logout: "로그아웃",
    },

    photos: {
      title: "사진 업로드",
      subtitle: "사진은 가장 강력한 기억 트리거입니다. 옛 사진일수록 좋아요.",
      fileLabel: "사진 파일",
      uploadButton: "사진 추가",
      captionLabel: "메모 (예: 결혼식, 1968년)",
      yearLabel: "추정 연도",
      peopleLabel: "사진 속 인물 (쉼표로 구분)",
      successToast: "사진을 추가했어요.",
      uploadFailed: "사진 업로드에 실패했어요. 잠시 후 다시 시도해 주세요.",
      latestTitle: "방금 추가한 사진",
      latestImageAlt: "방금 추가한 사진",
    },

    questions: {
      title: "어머님 / 아버님께 묻고 싶은 것",
      subtitle: "직접 묻기 어려운 것을 적어주세요. 부드럽게 대신 여쭤볼게요.",
      placeholder: "예: 아빠, 군대에서 가장 기억나는 날은?",
      submit: "질문 보내기",
      pending: "대기 중",
      asked: "여쭤봤어요",
      answered: "답을 들었어요",
    },

    cards: {
      title: "이번 주 들려주신 이야기",
      empty: "아직 이번 주 이야기가 모이지 않았어요.",
      readMore: "전체 보기",
    },

    chapters: {
      title: "이 달의 챕터",
      empty: "이 달의 챕터는 아직 준비 중이에요.",
    },

    utterances: {
      title: "최근 들려주신 말",
      empty: "아직 들려주신 이야기가 없어요.",
      duration: (sec: number) => `${Math.round(sec)}초`,
    },
  },

  // ============================================
  // 시스템 / 에러 (가족 화면 전용)
  // ============================================
  system: {
    genericError: "잠시 문제가 있었어요. 다시 시도해 주세요.",
    networkError: "네트워크 연결을 확인해 주세요.",
    unauthorized: "로그인이 필요합니다.",
  },
} as const;

export type Strings = typeof ko;
