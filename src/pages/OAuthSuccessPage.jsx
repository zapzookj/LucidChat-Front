import { useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate, useSearchParams } from "react-router-dom";
import api from "../api/axios";

const OAuthSuccessPage = () => {
  const [searchParams] = useSearchParams();
  const { googleLogin } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const processLogin = async () => {
      // 1. URL에서 토큰 추출
      const token = searchParams.get("access_token");
      
      if (token) {
        try {
          // 2. 토큰으로 내 정보 조회 (API 필요) -> 일단 임시로 토큰만 가지고 처리하거나,
          //    백엔드에서 AuthResponse에 맞춰서 주는 방 정보를 따로 조회해야 함.
          //    여기서는 토큰 세팅 후 메인으로 보내고, 메인에서 정보 로드하게 함.
          
          // 임시: 토큰만 일단 저장. 
          // 실제로는 /api/v1/auth/me 같은 API가 있으면 좋지만,
          // MVP니까 roomId는 1번으로 가정하거나, 백엔드에서 리다이렉트 URL에 roomId도 같이 태워주면 좋음.
          // 현재 백엔드 로직상 roomId를 얻으려면... 방 조회 API를 호출해서 찾아야 함.
          
          // 일단 토큰을 헤더에 박고 방 조회를 시도
          localStorage.setItem('accessToken', token); 
          
          // 방 정보 조회 (사용자의 기본 방)
          // *주의* : 현재 백엔드 ChatController에는 '내 방 조회'가 없고 roomId로 조회만 있음.
          // OnboardingService가 보장해주므로, roomId=1이 아닐 수 있음.
          // MVP 팁: 그냥 1번 방이라고 가정하고 진입 시도 or 다음 페이즈에서 '내 방 목록' API 추가.
          
          // 여기서는 임시로 roomId=1, user={} (빈 객체)로 로그인 처리
          googleLogin(token, { username: "Google User" }, 1); 
          navigate("/");
          
        } catch (e) {
          console.error(e);
          navigate("/login");
        }
      } else {
        navigate("/login");
      }
    };
    
    processLogin();
  }, [searchParams, googleLogin, navigate]);

  return <div className="h-screen bg-black text-white flex items-center justify-center">로그인 처리 중...</div>;
};

export default OAuthSuccessPage;