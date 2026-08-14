/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  /**
   * [Phase 5.5-Theater-Polish · Phase I]
   *
   * 모드별 색상이 동적 클래스("from-mode-theater-from", "border-mode-theater-accent" 등)
   * 로 합성될 가능성이 있어 safelist로 보호. 기존 색상 클래스에 영향 없음.
   */
  safelist: [
    // mode-theater 그라디언트 (Doorway · Portal · Hub 배너에서 동적으로 사용)
    "from-mode-theater-from", "to-mode-theater-to", "via-mode-theater-via",
    "border-mode-theater-accent", "text-mode-theater-text",
    "shadow-mode-theater",
    // mode-story (기존 amber DNA를 토큰화)
    "from-mode-story-from", "to-mode-story-to",
    "border-mode-story-accent", "text-mode-story-text",
    // mode-sandbox (기존 cyan DNA를 토큰화)
    "from-mode-sandbox-from", "to-mode-sandbox-to",
    "border-mode-sandbox-accent", "text-mode-sandbox-text",
    // [Phase III · B-2] Intermission 스탯 바 — STAT_META의 정적 barClass/textClass 보장.
    // 정적 매핑이라 보통 추출되지만, 다른 동적 경로 진입 가능성 대비 안전망.
    "from-pink-500", "to-pink-400", "text-pink-200",
    "from-cyan-500", "to-cyan-400", "text-cyan-200",
    "from-orange-500", "to-orange-400", "text-orange-200",
    "from-indigo-500", "to-indigo-400", "text-indigo-200",
    "from-rose-500", "to-rose-400", "text-rose-200",
    // ActivityCard pillClass — bg / border 조합
    "bg-pink-500/20", "border-pink-400/30",
    "bg-cyan-500/20", "border-cyan-400/30",
    "bg-orange-500/20", "border-orange-400/30",
    "bg-indigo-500/20", "border-indigo-400/30",
    "bg-rose-500/20", "border-rose-400/30",
    // [Phase III · B-3] EndingCredits — 4종 엔딩 톤 보장
    "text-amber-300", "text-amber-200", "from-amber-500/12", "to-amber-500/5", "border-amber-400/35",
    "text-slate-300", "text-slate-200", "from-slate-500/12", "to-slate-500/5", "border-slate-400/35",
    "text-red-300",   "text-red-200",   "from-red-500/12",   "to-red-500/5",   "border-red-400/35",
    "text-indigo-300","text-indigo-200","from-indigo-500/12","to-indigo-500/5","border-indigo-400/35",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Pretendard"', '"Noto Sans KR"', 'sans-serif'],
      },
      // [블록 A R2] 로비 디자인 토큰 — 정본: aichat docs/15_assets/lobby_redesign_mockup.html
      //   타입 스케일(데스크톱): 26/22/19/17/15/12.5/11 · 간격 리듬: 4 8 12 16 24 32 48 64
      //   대비 규칙: lobby-tx2는 12.5px 이상 전용, 그 미만 보조 텍스트는 lobby-tx1.
      fontSize: {
        "lb-hero":  ["26px",  { lineHeight: "1.3",  fontWeight: "800" }],
        "lb-page":  ["22px",  { lineHeight: "1.3",  fontWeight: "800" }],
        "lb-title": ["19px",  { lineHeight: "1.35", fontWeight: "800" }],
        "lb-sec":   ["17px",  { lineHeight: "1.4",  fontWeight: "700" }],
        "lb-card":  ["15px",  { lineHeight: "1.45" }],
        "lb-meta":  ["12.5px",{ lineHeight: "1.55" }],
        "lb-badge": ["11px",  { lineHeight: "1.3" }],
      },
      colors: {
        lobby: {
          bg: "#0b0b10",
          tx0: "#f2f2f7",
          tx1: "#b6b6c6",
          tx2: "#8b8ba3",
          easy: "#34d399",
          normal: "#60a5fa",
          hard: "#fb923c",
          extreme: "#f87171",
        },
        mode: {
          story: {
            from: "#fbbf24",     // amber-400
            to:   "#7c3aed",     // violet-600 (저녁의 책장 조명 → 보랏빛 노을)
            accent: "rgba(251,191,36,0.6)",
            text: "#fde68a",     // amber-200
          },
          sandbox: {
            from: "#22d3ee",     // cyan-400
            to:   "#1d4ed8",     // blue-700
            accent: "rgba(34,211,238,0.6)",
            text: "#a5f3fc",     // cyan-200
          },
          theater: {
            from: "#818cf8",     // indigo-400 (스포트라이트)
            via:  "#a78bfa",     // violet-400 (커튼)
            to:   "#3b0764",     // purple-950 (객석 어둠)
            accent: "rgba(167,139,250,0.55)",
            text: "#c7d2fe",     // indigo-200
          },
        },
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-out',
        'bounce-slow': 'bounce 3s infinite',
        // [Phase I] Theater Doorway 전용 — 커튼 외곽 살짝 펄스
        'curtain-breath': 'curtainBreath 6s ease-in-out infinite',
        // [Phase I] 극장 간판 글자 흐릿한 빛
        'marquee-shimmer': 'marqueeShimmer 3.5s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        curtainBreath: {
          '0%, 100%': { transform: 'scaleX(1)' },
          '50%': { transform: 'scaleX(1.012)' },
        },
        marqueeShimmer: {
          '0%, 100%': { textShadow: '0 0 12px rgba(199,210,254,0.35), 0 0 24px rgba(167,139,250,0.20)' },
          '50%':      { textShadow: '0 0 18px rgba(199,210,254,0.55), 0 0 36px rgba(167,139,250,0.35)' },
        },
      },
    },
  },
  plugins: [],
}