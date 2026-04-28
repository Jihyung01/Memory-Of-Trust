import Link from "next/link";

/**
 * MOT 랜딩 페이지 — 회색 레트로 라디오 톤.
 * 서비스 소개 + 가입 유도.
 */
export default function LandingPage() {
  return (
    <div
      className="min-h-screen overflow-y-auto"
      style={{
        background: "#f5f3ef",
        color: "#2a2a2d",
      }}
    >
      {/* 네비게이션 */}
      <nav
        className="flex items-center justify-between px-8 py-5"
        style={{ borderBottom: "1px solid #ddd8d0" }}
      >
        <div className="flex items-center gap-3">
          <div
            className="flex h-9 w-9 items-center justify-center rounded-full"
            style={{
              background: "radial-gradient(circle, #8a8880, #5a5a5e)",
              border: "2px solid #6a6a6e",
            }}
          >
            <span className="text-sm font-medium" style={{ color: "#f5f3ef" }}>
              M
            </span>
          </div>
          <div>
            <span className="text-lg font-medium tracking-tight" style={{ color: "#2a2a2d" }}>
              MOT
            </span>
            <span className="ml-2 text-xs tracking-wide" style={{ color: "#8a8880" }}>
              기억의 신탁
            </span>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <a href="#features" className="cursor-pointer text-sm" style={{ color: "#5a5a5e" }}>
            서비스 소개
          </a>
          <span className="cursor-pointer text-sm" style={{ color: "#5a5a5e" }}>
            요금제
          </span>
          <Link
            href="/family/login"
            className="rounded-full px-5 py-2 text-sm"
            style={{ background: "#2a2a2d", color: "#f5f3ef" }}
          >
            시작하기
          </Link>
        </div>
      </nav>

      {/* 히어로 */}
      <section className="px-8 py-16 text-center">
        <div
          className="mx-auto mb-4 h-px w-24"
          style={{ background: "linear-gradient(90deg, transparent, #b0a898, transparent)" }}
        />
        <p className="mb-3 text-sm italic" style={{ color: "#8a8880" }}>
          &ldquo;엄마, 그때 그 이야기 다시 해줘&rdquo;
        </p>
        <h1
          className="mx-auto max-w-lg text-4xl font-medium leading-snug tracking-tight"
          style={{ color: "#2a2a2d" }}
        >
          부모님의 목소리로 채워지는
          <br />
          세상에 하나뿐인 책
        </h1>
        <p className="mx-auto mt-5 max-w-md text-base leading-relaxed" style={{ color: "#6a6a6e" }}>
          매일 저녁, 따뜻한 대화 상대가 찾아갑니다.
          <br />
          옛 사진 한 장에 담긴 수십 년의 기억을
          <br />
          부모님의 목소리 그대로 모아드립니다.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Link
            href="/family/login"
            className="rounded-full px-8 py-3.5 text-base"
            style={{
              background: "linear-gradient(135deg, #6a6a6e, #4a4a4e)",
              color: "#f5f3ef",
              border: "2px solid #7a7a7e",
            }}
          >
            무료로 시작하기
          </Link>
          <a
            href="#features"
            className="rounded-full px-7 py-3.5 text-base"
            style={{
              background: "transparent",
              color: "#2a2a2d",
              border: "1.5px solid #c0b8a8",
            }}
          >
            자세히 알아보기
          </a>
        </div>
      </section>

      {/* 통계 바 — 라디오 다크 패널 */}
      <section className="mx-8 overflow-hidden rounded-2xl" style={{ background: "#2a2a2d" }}>
        <div
          className="grid grid-cols-3"
          style={{ borderColor: "#3a3a3e" }}
        >
          {[
            { value: "15분", label: "하루 대화" },
            { value: "365", label: "매일 찾아가는 손님" },
            { value: "1권", label: "1년 뒤 자서전" },
          ].map((stat, i) => (
            <div
              key={stat.label}
              className="py-7 text-center"
              style={i > 0 ? { borderLeft: "1px solid #3a3a3e" } : {}}
            >
              <div
                className="text-3xl font-medium"
                style={{ color: "#ffb43c", textShadow: "0 0 8px rgba(255,180,60,0.3)" }}
              >
                {stat.value}
              </div>
              <div className="mt-1 text-xs" style={{ color: "#8a8880" }}>
                {stat.label}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 기능 카드 */}
      <section id="features" className="px-8 py-14">
        <div className="mx-auto grid max-w-3xl grid-cols-3 gap-5">
          {[
            {
              iconPath:
                "M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z M19 10v2a7 7 0 0 1-14 0v-2 M12 19v3",
              title: "말씀만 하세요",
              desc: "버튼 하나로 시작하고 편하게 이야기하시면 됩니다",
            },
            {
              iconPath: "M3 3h18v18H3z M8.5 8.5m-1.5 0a1.5 1.5 0 1 0 3 0a1.5 1.5 0 1 0 -3 0 M21 15l-5-5L5 21",
              title: "사진이 기억을 열어요",
              desc: "옛 사진 한 장이 수십 년 전 이야기를 불러옵니다",
            },
            {
              iconPath: "M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20",
              title: "한 권의 책으로",
              desc: "한 해의 이야기가 가족에게 전해지는 자서전이 됩니다",
            },
          ].map((card) => (
            <div
              key={card.title}
              className="rounded-2xl border-2 p-6 text-center"
              style={{ background: "#fff", borderColor: "#e0dbd2" }}
            >
              <div
                className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full border-2"
                style={{
                  background: "radial-gradient(circle, #f0ece6, #e0dbd2)",
                  borderColor: "#d0c8b8",
                }}
              >
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#6a6a6e"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d={card.iconPath} />
                </svg>
              </div>
              <div className="mb-2 text-base font-medium" style={{ color: "#2a2a2d" }}>
                {card.title}
              </div>
              <div className="text-sm leading-relaxed" style={{ color: "#8a8880" }}>
                {card.desc}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 푸터 */}
      <footer className="px-8 pb-10 text-center">
        <div
          className="mx-auto mb-3 h-px w-16"
          style={{ background: "linear-gradient(90deg, transparent, #c0b8a8, transparent)" }}
        />
        <p className="text-sm italic" style={{ color: "#8a8880" }}>
          부모님의 이야기는 세상에서 가장 소중한 책입니다
        </p>
      </footer>
    </div>
  );
}
