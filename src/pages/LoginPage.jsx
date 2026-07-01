import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import { Lock, User, ChevronDown, ChevronUp } from "lucide-react";
import { assetUrl } from "../utils/assetUrl";
import { sfx } from "../utils/sfx";

/**
 * [Phase 5] 로그인 페이지 — 소셜 로그인 중심 재설계
 *
 * [변경 사항]
 * - 로컬 회원가입 UI 완전 제거 (deprecated)
 * - Google / Kakao / Naver 소셜 로그인 버튼 3종
 * - 기존 LOCAL 계정 보유자를 위한 "기존 계정 로그인" 접이식 패널 (하위 호환)
 * - baseURL은 환경변수에서 로드
 */

const TwinkleStar = ({ style }) => (
  <motion.div
    className="absolute w-[1.5px] h-[1.5px] bg-white rounded-full pointer-events-none"
    style={style}
    animate={{ opacity: [0.15, 0.6, 0.15], scale: [0.8, 1.2, 0.8] }}
    transition={{ duration: Math.random() * 3 + 2, repeat: Infinity, delay: Math.random() * 5 }}
  />
);

const isNightTime = () => { const h = new Date().getHours(); return h >= 19 || h < 6; };

const getTimeGradient = () => {
  const h = new Date().getHours();
  if (h >= 6 && h < 16) return "from-sky-300 via-blue-400 to-indigo-500";
  if (h >= 16 && h < 19) return "from-orange-300 via-rose-400 to-purple-600";
  return "from-slate-900 via-indigo-950 to-slate-950";
};

// const API_BASE = import.meta.env.VITE_API_BASE_URL?.replace("/api/v1", "") || "http://localhost:8080";
const API_BASE = 'http://localhost:8080';

const LoginPage = () => {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [showLegacy, setShowLegacy] = useState(false);
  const [formData, setFormData] = useState({ username: "", password: "" });
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const stars = useMemo(() =>
    Array.from({ length: 40 }, () => ({
      left: `${Math.random() * 100}%`,
      top: `${Math.random() * 60}%`,
    })), []
  );

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  // 기존 LOCAL 계정 로그인 (하위 호환)
  const handleLegacyLogin = async (e) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);
    try {
      const success = await login(formData.username, formData.password);
      if (success) navigate("/");
      else setError("아이디 또는 비밀번호를 확인해주세요.");
    } catch (err) {
      setError(err.response?.data?.message || "오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  };

  // 소셜 로그인 핸들러
  const handleSocialLogin = (provider) => {
    window.location.href = `${API_BASE}/oauth2/authorization/${provider}`;
  };

  return (
    <div className="relative flex items-center justify-center min-h-screen overflow-hidden select-none">
      {/* 배경 */}
      <div className={`absolute inset-0 bg-gradient-to-b ${getTimeGradient()} transition-colors duration-[5000ms]`} />
      <div className="absolute inset-0 opacity-[0.06] pointer-events-none"
        style={{
          backgroundImage: `
            radial-gradient(ellipse at 20% 50%, rgba(255,255,255,0.4) 0%, transparent 60%),
            radial-gradient(ellipse at 80% 30%, rgba(255,255,255,0.3) 0%, transparent 55%),
            radial-gradient(ellipse at 50% 80%, rgba(255,255,255,0.2) 0%, transparent 50%)
          `,
        }}
      />
      {isNightTime() && stars.map((style, i) => <TwinkleStar key={i} style={style} />)}
      <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent pointer-events-none" />
      <div className="absolute inset-0 bg-black/30" />

      {/* 메인 카드 */}
      <motion.div
        className="relative w-full max-w-md p-8 bg-black/40 backdrop-blur-xl border border-white/10 rounded-3xl shadow-2xl mx-4"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, type: "spring", stiffness: 120, damping: 18 }}
      >
        {/* 로고 */}
        <div className="text-center mb-8">
          <img
            src={assetUrl("/logo.png")}
            alt="Lucid Chat"
            className="h-12 mx-auto mb-5 drop-shadow-lg object-contain"
            onError={(e) => { e.target.style.display = "none"; }}
          />
          <h2 className="text-2xl font-bold text-white drop-shadow-lg mb-2">
            Welcome to Lucid Chat
          </h2>
          <p className="text-white/40 text-sm">소셜 계정으로 간편하게 시작하세요</p>
        </div>

        {/* ── 소셜 로그인 버튼들 ── */}
        <div className="space-y-3">
          {/* Google */}
          <button
            onClick={() => handleSocialLogin("google")}
            className="w-full bg-white text-gray-800 font-bold py-3.5 rounded-xl transition shadow-lg
              hover:bg-gray-50 flex items-center justify-center gap-3
              hover:scale-[1.02] active:scale-95"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            Google로 시작
          </button>

          {/* Kakao */}
          <button
            onClick={() => handleSocialLogin("kakao")}
            className="w-full font-bold py-3.5 rounded-xl transition shadow-lg flex items-center justify-center gap-3
              hover:scale-[1.02] active:scale-95"
            style={{ backgroundColor: "#FEE500", color: "#191919" }}
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="#191919">
              <path d="M12 3C6.48 3 2 6.36 2 10.44c0 2.62 1.75 4.93 4.38 6.24l-1.12 4.1c-.1.36.3.65.6.44l4.87-3.22c.42.04.84.06 1.27.06 5.52 0 10-3.36 10-7.5S17.52 3 12 3z"/>
            </svg>
            카카오로 시작
          </button>

          {/* Naver */}
          <button
            onClick={() => handleSocialLogin("naver")}
            className="w-full font-bold py-3.5 rounded-xl transition shadow-lg flex items-center justify-center gap-3
              hover:scale-[1.02] active:scale-95 text-white"
            style={{ backgroundColor: "#03C75A" }}
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="white">
              <path d="M16.273 12.845L7.376 0H0v24h7.727V11.155L16.624 24H24V0h-7.727z"/>
            </svg>
            네이버로 시작
          </button>
        </div>

        {/* ── 기존 계정 로그인 (접이식 — 하위 호환) ── */}
        <div className="mt-6">
          <button
            onClick={() => setShowLegacy(!showLegacy)}
            className="w-full flex items-center justify-center gap-2 text-white/30 text-xs
              hover:text-white/50 transition py-2"
          >
            기존 계정으로 로그인
            {showLegacy ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>

          <AnimatePresence>
            {showLegacy && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="overflow-hidden"
              >
                <form onSubmit={handleLegacyLogin} className="space-y-3 pt-3 border-t border-white/5 mt-3">
                  <p className="text-white/20 text-[10px] text-center mb-2">
                    소셜 로그인 도입 이전에 가입한 계정용입니다
                  </p>
                  <div className="relative group">
                    <User className="absolute left-4 top-3 text-white/30 group-focus-within:text-pink-400 transition" size={18} />
                    <input name="username" type="text" placeholder="Username" required
                      value={formData.username} onChange={handleChange}
                      className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 pl-11 pr-4
                        text-white text-sm placeholder-white/20 focus:border-pink-500/50 transition outline-none" />
                  </div>
                  <div className="relative group">
                    <Lock className="absolute left-4 top-3 text-white/30 group-focus-within:text-pink-400 transition" size={18} />
                    <input name="password" type="password" placeholder="Password" required
                      value={formData.password} onChange={handleChange}
                      className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 pl-11 pr-4
                        text-white text-sm placeholder-white/20 focus:border-pink-500/50 transition outline-none" />
                  </div>

                  {error && (
                    <p className="text-rose-400 text-xs text-center bg-rose-500/10 py-2 rounded-lg border border-rose-500/20">
                      {error}
                    </p>
                  )}

                  <button type="submit" disabled={isLoading}
                    className="w-full bg-white/10 hover:bg-white/15 text-white/70 font-medium py-2.5 rounded-xl
                      transition text-sm disabled:opacity-50">
                    {isLoading ? "로그인 중..." : "로그인"}
                  </button>
                </form>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* 하단 정보 */}
        <p className="text-white/15 text-[10px] text-center mt-6 leading-relaxed">
          로그인 시 이용약관 및 개인정보처리방침에 동의하게 됩니다
        </p>
      </motion.div>
    </div>
  );
};

export default LoginPage;