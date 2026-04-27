import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import ChatPage from "./pages/ChatPage";
import LoginPage from "./pages/LoginPage";
import LobbyPage from "./pages/LobbyPage";
import TheaterPortalPage from "./pages/TheaterPortalPage";
import TheaterPlayPage from "./pages/TheaterPlayPage";
import TheaterIntermissionPage from "./pages/TheaterIntermissionPage";
import TheaterEndingCredits from "./pages/TheaterEndingCredits";
import OAuthSuccessPage from "./pages/OAuthSuccessPage";

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return null;
  return user ? children : <Navigate to="/login" />;
};

/**
 * [Phase 5.5-Theater-Polish · Phase I] 라우팅 재구성
 *
 * 변경 의도:
 *  - LobbyTabShell 제거. 더 이상 "탭으로 두 로비를 스위칭"하지 않는다.
 *  - 기본 진입(/)은 Lucid Station(LobbyPage) 단일.
 *  - Theater 진입(/theater)은 시네마틱 극장 포털 페이지로 이동.
 *  - Theater의 내부 화면(/theater/:roomId, .../intermission, .../ending)은
 *    그대로 유지 — 백엔드 / 다른 컴포넌트 영향 없음.
 *
 * /login              → 로그인/회원가입
 * /oauth2/success     → OAuth 콜백
 * /                   → Lucid Station (Hub)
 * /theater            → Theater Portal (세계관 선택, 진행 중 극)
 * /theater/:roomId    → Theater 플레이
 * /theater/:id/intermission → 인터미션
 * /theater/:id/ending → 엔딩 크레딧
 * /chat/:roomId       → Dialogue 채팅
 */
function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/oauth2/success" element={<OAuthSuccessPage />} />

          <Route
            path="/"
            element={
              <ProtectedRoute>
                <LobbyPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/theater"
            element={
              <ProtectedRoute>
                <TheaterPortalPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/theater/:roomId"
            element={
              <ProtectedRoute>
                <TheaterPlayPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/theater/:roomId/intermission"
            element={
              <ProtectedRoute>
                <TheaterIntermissionPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/theater/:roomId/ending"
            element={
              <ProtectedRoute>
                <TheaterEndingCredits />
              </ProtectedRoute>
            }
          />
          <Route
            path="/chat/:roomId"
            element={
              <ProtectedRoute>
                <ChatPage />
              </ProtectedRoute>
            }
          />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;