import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import { Lock, User, Mail, Smile } from "lucide-react";

// ── 반짝이는 별 (밤 시간대에만) ──
const TwinkleStar = ({ style }) => (
  <motion.div
    className="absolute w-[1.5px] h-[1.5px] bg-white rounded-full pointer-events-none"
    style={style}
    animate={{ opacity: [0.15, 0.6, 0.15], scale: [0.8, 1.2, 0.8] }}
    transition={{ duration: Math.random() * 3 + 2, repeat: Infinity, delay: Math.random() * 5 }}
  />
);

const isNightTime = () => { const h = new Date().getHours(); return h >= 19 || h < 6; };

// 시간대별 그라디언트
const getTimeGradient = () => {
  const h = new Date().getHours();
  if (h >= 6 && h < 16) return "from-sky-300 via-blue-400 to-indigo-500";
  if (h >= 16 && h < 19) return "from-orange-300 via-rose-400 to-purple-600";
  return "from-slate-900 via-indigo-950 to-slate-950";
};

const LoginPage = () => {
  const [isLoginMode, setIsLoginMode] = useState(true);
  const { login, signup } = useAuth();
  const navigate = useNavigate();
  
  const [formData, setFormData] = useState({ username: "", password: "", nickname: "", email: "" });
  const [error, setError] = useState("");

  const stars = useMemo(() =>
    Array.from({ length: 40 }, () => ({
      left: `${Math.random() * 100}%`,
      top: `${Math.random() * 60}%`,
    })), []
  );

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    try {
      if (isLoginMode) {
        const success = await login(formData.username, formData.password);
        if (success) navigate("/");
        else setError("아이디 또는 비밀번호를 확인해주세요.");
      } else {
        const success = await signup(formData.username, formData.password, formData.nickname, formData.email);
        if (success) navigate("/");
      }
    } catch (err) {
      setError(err.response?.data?.message || "오류가 발생했습니다.");
    }
  };

  const handleGoogleLogin = () => {
    window.location.href = "http://localhost:8080/oauth2/authorization/google";
  };

  return (
    <div className="relative flex items-center justify-center min-h-screen overflow-hidden select-none">

      {/* [Fix #8] 시간대 반응형 CSS 그라디언트 배경 (기존 로비 배경 → 로그인으로 이동) */}
      <div className={`absolute inset-0 bg-gradient-to-b ${getTimeGradient()} transition-colors duration-[5000ms]`} />

      {/* 구름 텍스처 */}
      <div
        className="absolute inset-0 opacity-[0.06] pointer-events-none"
        style={{
          backgroundImage: `
            radial-gradient(ellipse at 20% 50%, rgba(255,255,255,0.4) 0%, transparent 60%),
            radial-gradient(ellipse at 80% 30%, rgba(255,255,255,0.3) 0%, transparent 55%),
            radial-gradient(ellipse at 50% 80%, rgba(255,255,255,0.2) 0%, transparent 50%)
          `,
        }}
      />

      {/* 별 (밤에만) */}
      {isNightTime() && stars.map((style, i) => <TwinkleStar key={i} style={style} />)}

      {/* 하단 비네트 */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent pointer-events-none" />

      {/* 어두움 오버레이 — 폼 가독성 */}
      <div className="absolute inset-0 bg-black/30" />

      {/* 로그인 폼 */}
      <motion.div
        className="relative w-full max-w-md p-8 bg-black/40 backdrop-blur-xl border border-white/10 rounded-3xl shadow-2xl"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, type: "spring", stiffness: 120, damping: 18 }}
      >
        <div className="text-center mb-8">
          {/* 로고 시도 */}
          <img
            src="/logo.png"
            alt="Lucid Chat"
            className="h-10 mx-auto mb-4 drop-shadow-lg object-contain"
            onError={(e) => { e.target.style.display = "none"; }}
          />
          <h2 className="text-3xl font-bold text-white drop-shadow-lg mb-6">
            {isLoginMode ? "Welcome" : "Join Us"}
          </h2>
          
          <div className="flex bg-white/10 rounded-full p-1 relative">
            <div 
              className={`absolute top-1 bottom-1 w-[48%] bg-pink-500 rounded-full transition-all duration-300 ${isLoginMode ? 'left-1' : 'left-[51%]'}`} 
            />
            <button 
              onClick={() => { setIsLoginMode(true); setError(""); }}
              className="flex-1 py-2 text-sm font-bold z-10 text-white transition-colors"
            >
              로그인
            </button>
            <button 
              onClick={() => { setIsLoginMode(false); setError(""); }}
              className="flex-1 py-2 text-sm font-bold z-10 text-white transition-colors"
            >
              회원가입
            </button>
          </div>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative group">
            <User className="absolute left-4 top-3.5 text-white/50 group-focus-within:text-pink-400 transition" size={20} />
            <input name="username" type="text" placeholder="Username" required value={formData.username} onChange={handleChange}
              className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-12 pr-4 text-white placeholder-white/30 focus:border-pink-500 focus:bg-white/10 transition outline-none" />
          </div>
          
          <div className="relative group">
            <Lock className="absolute left-4 top-3.5 text-white/50 group-focus-within:text-pink-400 transition" size={20} />
            <input name="password" type="password" placeholder="Password" required value={formData.password} onChange={handleChange}
              className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-12 pr-4 text-white placeholder-white/30 focus:border-pink-500 focus:bg-white/10 transition outline-none" />
          </div>

          <div className={`space-y-4 overflow-hidden transition-all duration-500 ${isLoginMode ? 'max-h-0 opacity-0' : 'max-h-40 opacity-100'}`}>
            <div className="relative group">
              <Smile className="absolute left-4 top-3.5 text-white/50 group-focus-within:text-pink-400 transition" size={20} />
              <input name="nickname" type="text" placeholder="Nickname (캐릭터가 부를 이름)" required={!isLoginMode} value={formData.nickname} onChange={handleChange}
                className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-12 pr-4 text-white placeholder-white/30 focus:border-pink-500 focus:bg-white/10 transition outline-none" />
            </div>
            <div className="relative group">
              <Mail className="absolute left-4 top-3.5 text-white/50 group-focus-within:text-pink-400 transition" size={20} />
              <input name="email" type="email" placeholder="Email (Optional)" value={formData.email} onChange={handleChange}
                className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-12 pr-4 text-white placeholder-white/30 focus:border-pink-500 focus:bg-white/10 transition outline-none" />
            </div>
          </div>

          {error && <p className="text-rose-400 text-sm text-center bg-rose-500/10 py-2 rounded-lg border border-rose-500/20">{error}</p>}

          <button type="submit"
            className="w-full bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-400 hover:to-purple-500 text-white font-bold py-3.5 rounded-xl transition shadow-lg transform hover:scale-[1.02] active:scale-95">
            {isLoginMode ? "시작하기" : "계정 만들기"}
          </button>
        </form>

        <div className="mt-6 flex items-center justify-between gap-4">
          <div className="h-px bg-white/10 flex-1" />
          <span className="text-white/30 text-xs uppercase">Or continue with</span>
          <div className="h-px bg-white/10 flex-1" />
        </div>

        <button onClick={handleGoogleLogin}
          className="mt-6 w-full bg-white text-gray-800 font-bold py-3.5 rounded-xl transition shadow-lg hover:bg-gray-100 flex items-center justify-center gap-3 transform hover:scale-[1.02] active:scale-95">
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
          </svg>
          Google 계정으로 시작
        </button>
      </motion.div>
    </div>
  );
};

export default LoginPage;