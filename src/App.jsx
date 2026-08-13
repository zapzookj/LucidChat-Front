import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import ChatPage from "./pages/ChatPage";
import ChatPageV2 from "./pages/ChatPageV2";
import LoginPage from "./pages/LoginPage";
import TheaterPortalPage from "./pages/TheaterPortalPage";
import TheaterPlayPage from "./pages/TheaterPlayPage";
import TheaterIntermissionPage from "./pages/TheaterIntermissionPage";
import TheaterEndingCredits from "./pages/TheaterEndingCredits";
import TheaterArchivePage from "./pages/TheaterArchivePage";
import OAuthSuccessPage from "./pages/OAuthSuccessPage";
// [Studio v1] UGC 캐릭터 생성 스튜디오
import StudioPage from "./pages/StudioPage";
// [World Builder v1] UGC 세계관 빌더
import StudioWorldPage from "./pages/StudioWorldPage";
// [블록 A] 플랫폼형 로비 — 셸(탭 4) + 탭 콘텐츠 + 첫 만남 온보딩
import LobbyShell from "./pages/lobby/LobbyShell";
import HomeTab from "./pages/lobby/HomeTab";
import WorldsTab from "./pages/lobby/WorldsTab";
import ArchiveTab from "./pages/lobby/ArchiveTab";
import FirstMeetPage from "./pages/lobby/FirstMeetPage";
import { savePendingAction } from "./utils/postLogin";

/**
 * 보호 라우트 — 비로그인 시 /login으로 보내되, 원래 목적지를 저장해
 * 로그인 후 딥링크 복원(postLogin.resolvePostLoginPath)이 이어받게 한다.
 */
const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return null;
  if (!user) {
    savePendingAction({ type: "route", path: location.pathname + location.search });
    return <Navigate to="/login" replace />;
  }
  return children;
};

/**
 * [블록 A] 라우팅 재구성 — 플랫폼형 로비 (docs/14 §B, A′ + 셸 임베드 2안 확정)
 *
 *  - LobbyShell = 상주 레이아웃(탭 4: 정거장/세계관/스튜디오/보관함). 모바일 하단 탭바.
 *  - /, /worlds 는 게스트 브라우징 허용(탐색 공개) — 행동 시 로그인 게이트.
 *  - /studio, /archive 는 로그인 필수지만 셸 안에서 렌더(탭바 상주 — 2안).
 *  - /first-meet = 빈손 신규 전용 '첫 만남' 온보딩.
 *  - 인게임 라우트(chat/theater)는 종전과 동일하게 보호.
 */
function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/oauth2/success" element={<OAuthSuccessPage />} />

          {/* ═══ 플랫폼형 로비 셸 — 게스트 진입 허용 ═══ */}
          <Route element={<LobbyShell />}>
            <Route path="/" element={<HomeTab />} />
            <Route path="/worlds" element={<WorldsTab />} />
            <Route
              path="/archive"
              element={
                <ProtectedRoute>
                  <ArchiveTab />
                </ProtectedRoute>
              }
            />
            {/* [Studio v1] UGC 스튜디오 — 셸 임베드(탭바 상주, URL 유지) */}
            <Route
              path="/studio"
              element={
                <ProtectedRoute>
                  <StudioPage embedded />
                </ProtectedRoute>
              }
            />
          </Route>

          {/* [블록 A] 빈손 신규 온보딩 — 풀스크린 (셸 밖) */}
          <Route
            path="/first-meet"
            element={
              <ProtectedRoute>
                <FirstMeetPage />
              </ProtectedRoute>
            }
          />

          {/* [World Builder v1] UGC 세계관 빌더 — 풀스크린 위저드 (셸 밖) */}
          <Route
            path="/studio/world"
            element={
              <ProtectedRoute>
                <StudioWorldPage />
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
          {/* [Phase 5.5 UX Polish · R4] 아카이브 — 보관된 극 + 엔딩 도달한 극 */}
          <Route
            path="/theater/archive"
            element={
              <ProtectedRoute>
                <TheaterArchivePage />
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
          {/* [Story V2] V2 디렉터 시점 World 탐험 */}
          <Route
            path="/v2/chat/:roomId"
            element={
              <ProtectedRoute>
                <ChatPageV2 />
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
