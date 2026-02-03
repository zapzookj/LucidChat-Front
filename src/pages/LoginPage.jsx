import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import { Lock, User, Mail, Smile } from "lucide-react";

const LoginPage = () => {
  const [isLoginMode, setIsLoginMode] = useState(true); // 탭 전환 상태
  const { login, signup } = useAuth();
  const navigate = useNavigate();
  
  const [formData, setFormData] = useState({
    username: "", password: "", nickname: "", email: ""
  });
  const [error, setError] = useState("");

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    
    try {
      if (isLoginMode) {
        // 로그인 시도
        const success = await login(formData.username, formData.password);
        if (success) navigate("/");
        else setError("아이디 또는 비밀번호를 확인해주세요.");
      } else {
        // 회원가입 시도
        const success = await signup(formData.username, formData.password, formData.nickname, formData.email);
        if (success) navigate("/");
      }
    } catch (err) {
      // 백엔드 에러 메시지 처리
      const msg = err.response?.data?.message || "오류가 발생했습니다.";
      setError(msg);
    }
  };

  const handleGoogleLogin = () => {
    // 백엔드의 구글 OAuth 시작 엔드포인트로 이동
    window.location.href = "http://localhost:8080/oauth2/authorization/google";
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-[url('/backgrounds/room_night.png')] bg-cover bg-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" /> 
      
      <div className="relative w-full max-w-md p-8 bg-black/50 backdrop-blur-xl border border-white/10 rounded-3xl shadow-2xl transition-all duration-500">
        {/* 타이틀 & 탭 */}
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-white drop-shadow-lg mb-6">
            {isLoginMode ? "Welcome Back" : "Join Us"}
          </h2>
          
          <div className="flex bg-white/10 rounded-full p-1 relative">
            <div 
              className={`absolute top-1 bottom-1 w-[48%] bg-pink-500 rounded-full transition-all duration-300 ${isLoginMode ? 'left-1' : 'left-[51%]'}`} 
            />
            <button 
              onClick={() => {setIsLoginMode(true); setError("");}}
              className="flex-1 py-2 text-sm font-bold z-10 text-white transition-colors"
            >
              로그인
            </button>
            <button 
              onClick={() => {setIsLoginMode(false); setError("");}}
              className="flex-1 py-2 text-sm font-bold z-10 text-white transition-colors"
            >
              회원가입
            </button>
          </div>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 아이디 */}
          <div className="relative group">
            <User className="absolute left-4 top-3.5 text-white/50 group-focus-within:text-pink-400 transition" size={20} />
            <input
              name="username"
              type="text"
              placeholder="Username"
              required
              value={formData.username}
              onChange={handleChange}
              className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-12 pr-4 text-white placeholder-white/30 focus:border-pink-500 focus:bg-white/10 transition outline-none"
            />
          </div>
          
          {/* 비밀번호 */}
          <div className="relative group">
            <Lock className="absolute left-4 top-3.5 text-white/50 group-focus-within:text-pink-400 transition" size={20} />
            <input
              name="password"
              type="password"
              placeholder="Password"
              required
              value={formData.password}
              onChange={handleChange}
              className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-12 pr-4 text-white placeholder-white/30 focus:border-pink-500 focus:bg-white/10 transition outline-none"
            />
          </div>

          {/* 회원가입 전용 필드 (애니메이션과 함께 등장) */}
          <div className={`space-y-4 overflow-hidden transition-all duration-500 ${isLoginMode ? 'max-h-0 opacity-0' : 'max-h-40 opacity-100'}`}>
            <div className="relative group">
              <Smile className="absolute left-4 top-3.5 text-white/50 group-focus-within:text-pink-400 transition" size={20} />
              <input
                name="nickname"
                type="text"
                placeholder="Nickname (캐릭터가 부를 이름)"
                required={!isLoginMode}
                value={formData.nickname}
                onChange={handleChange}
                className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-12 pr-4 text-white placeholder-white/30 focus:border-pink-500 focus:bg-white/10 transition outline-none"
              />
            </div>
            <div className="relative group">
              <Mail className="absolute left-4 top-3.5 text-white/50 group-focus-within:text-pink-400 transition" size={20} />
              <input
                name="email"
                type="email"
                placeholder="Email (Optional)"
                value={formData.email}
                onChange={handleChange}
                className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-12 pr-4 text-white placeholder-white/30 focus:border-pink-500 focus:bg-white/10 transition outline-none"
              />
            </div>
          </div>

          {error && <p className="text-rose-400 text-sm text-center bg-rose-500/10 py-2 rounded-lg border border-rose-500/20">{error}</p>}

          <button
            type="submit"
            className="w-full bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-400 hover:to-purple-500 text-white font-bold py-3.5 rounded-xl transition shadow-lg transform hover:scale-[1.02] active:scale-95"
          >
            {isLoginMode ? "시작하기" : "계정 만들기"}
          </button>
        </form>

        <div className="mt-6 flex items-center justify-between gap-4">
           <div className="h-px bg-white/10 flex-1" />
           <span className="text-white/30 text-xs uppercase">Or continue with</span>
           <div className="h-px bg-white/10 flex-1" />
        </div>

        {/* 구글 로그인 버튼 */}
        <button
          onClick={handleGoogleLogin}
          className="mt-6 w-full bg-white text-gray-800 font-bold py-3.5 rounded-xl transition shadow-lg hover:bg-gray-100 flex items-center justify-center gap-3 transform hover:scale-[1.02] active:scale-95"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
          </svg>
          Google 계정으로 시작
        </button>
      </div>
    </div>
  );
};

export default LoginPage;