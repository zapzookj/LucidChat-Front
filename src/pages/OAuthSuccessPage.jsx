import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate, useSearchParams } from "react-router-dom";
import api from "../api/axios";
import { motion } from "framer-motion";
import { resolvePostLoginPath } from "../utils/postLogin";

/**
 * [Phase 5] OAuth 콜백 페이지 — 완전 재작성
 *
 * [이전 버그]
 * googleLogin(token, { username: "Google User" }) → 하드코딩 더미 데이터
 * → 로비에서 user.id, user.nickname 등이 모두 undefined
 *
 * [수정 흐름]
 * 1. URL에서 access_token 추출
 * 2. localStorage에 토큰 저장
 * 3. GET /api/v1/users/me 호출하여 실제 유저 정보 조회
 * 4. AuthContext에 유저 데이터 세팅
 * 5. 로비(/)로 이동
 *
 * [Polish · P0]
 * 기존엔 res.data에서 id/username/nickname/energy 4개 필드만 골라 userData를 만들었다.
 * 이 때문에 useAuth().user.subscriptionTier / isAdultVerified / boostMode 등이
 * 항상 undefined → TheaterCreateFlow에서 구독자도 스탯 분배가 잠기는 등 광범위한
 * stale-state 버그가 있었다.
 * → res.data 전체를 그대로 userData로 사용한다. (UserResponse는 plain JSON이라 안전)
 */
const OAuthSuccessPage = () => {
  const [searchParams] = useSearchParams();
  const { handleOAuthLogin } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState(null);

  useEffect(() => {
    const processLogin = async () => {
      const token = searchParams.get("access_token");

      if (!token) {
        setError("인증 토큰을 받지 못했습니다.");
        setTimeout(() => navigate("/login"), 2000);
        return;
      }

      try {
        // 1. 토큰 저장 (axios 인터셉터가 이후 요청에 자동 주입)
        localStorage.setItem("accessToken", token);

        // 2. 실제 유저 정보 조회 (UserResponse 전체 — 구독/성인/에너지max 등 모두 포함)
        const res = await api.get("/users/me");

        // 3. AuthContext 상태 업데이트 — 응답 전체를 그대로 user에 저장.
        //    여기서 필드를 솎아내면 그 필드들이 영구 undefined로 남아 광범위한 게이팅 버그 발생.
        handleOAuthLogin(token, res.data);

        // 4. [블록 A] 딥링크 복원 — 게스트가 고른 인연과의 방 생성 직행 / 원래 목적지 복귀 /
        //    빈손 신규면 '첫 만남' 온보딩. 복원할 것이 없으면 로비.
        const dest = await resolvePostLoginPath();
        navigate(dest, { replace: true });

      } catch (err) {
        console.error("[OAuth] Failed to fetch user info:", err);
        localStorage.removeItem("accessToken");
        setError("로그인 처리에 실패했습니다. 다시 시도해주세요.");
        setTimeout(() => navigate("/login"), 2000);
      }
    };

    processLogin();
  }, [searchParams, handleOAuthLogin, navigate]);

  return (
    <div className="h-screen bg-gradient-to-b from-slate-900 to-indigo-950 flex items-center justify-center">
      <motion.div
        className="text-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        {error ? (
          <div className="space-y-3">
            <p className="text-red-400 text-sm">{error}</p>
            <p className="text-white/30 text-xs">로그인 페이지로 돌아갑니다...</p>
          </div>
        ) : (
          <div className="space-y-4">
            <motion.div
              className="w-10 h-10 border-2 border-purple-400/40 border-t-purple-400 rounded-full mx-auto"
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            />
            <p className="text-white/60 text-sm tracking-wider">로그인 처리 중...</p>
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default OAuthSuccessPage;