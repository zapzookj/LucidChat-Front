import { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { initPortOne } from "./utils/portone";   // [C-2.j] 결제 초기화 단일 지점
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
import VerifyCallbackPage from "./pages/VerifyCallbackPage";
import PaymentCallbackPage from "./pages/PaymentCallbackPage";   // [P0] PortOne 모바일 결제 복귀
// [Studio v1] UGC 캐릭터 생성 스튜디오
import StudioPage from "./pages/StudioPage";
// [World Builder v1] UGC 세계관 빌더
import StudioWorldPage from "./pages/StudioWorldPage";
// [블록 A R2] 플랫폼형 로비 — 셸(탭 4: 홈/스토리/스튜디오/보관함) + 탭 콘텐츠 + 첫 만남 온보딩
import LobbyShell from "./pages/lobby/LobbyShell";
import HomeTab from "./pages/lobby/HomeTab";
import StoryTab from "./pages/lobby/StoryTab";
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
  // [C-2.j · docs/19 §F] PortOne 초기화를 **앱 부트스트랩 단일 지점**으로 이관.
  //   종전에는 폐기 예정 PaymentModal 안에만 IMP.init이 있어, 그 모달을 지우는 순간
  //   결제 초기화가 코드베이스에서 소멸했다. 살아 있는 LucidStore는 init 없이
  //   request_pay만 부르고 있었다 — 즉 어느 쪽도 단독으로는 결제가 성립하지 않았다.
  //   SDK(index.html의 iamport.js)가 늦게 뜨는 경우를 위해 결제 직전에도 방어적으로 재시도한다.
  useEffect(() => { initPortOne(); }, []);

  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/oauth2/success" element={<OAuthSuccessPage />} />
          {/* [C-1.5 / D-30] 성인인증 팝업 콜백 브리지.
              백엔드 GET|POST /api/v1/verify/callback 이 검증 후 이 라우트로 302 시킨다.
              **반드시 로그인 가드 밖 + catch-all(:*) 앞**에 둘 것 —
              라우트가 없던 탓에 팝업이 catch-all에 걸려 홈으로 튕겼고, 그래서
              AdultVerificationModal의 postMessage 수신부가 도달 불가 코드였다. */}
          <Route path="/verify/callback" element={<VerifyCallbackPage />} />
          {/* [적대적 리뷰 P0 · C-2 후속] PortOne **모바일** 결제 복귀 수신.
              모바일은 팝업이 아니라 전체 페이지 리다이렉트라 SPA가 언마운트되고
              request_pay 콜백이 실행되지 않는다 → /payments/confirm이 영영 안 불려
              '돈은 빠지고 재화 미지급'이 된다. m_redirect_url이 이 라우트를 가리킨다.
              catch-all 앞에 두어야 하고, 로그인 가드 밖에 둔다(복귀 시점의 세션 상태를
              가정하지 않는다 — confirm은 axios 인터셉터가 토큰을 붙여 처리한다). */}
          <Route path="/payment/callback" element={<PaymentCallbackPage />} />

          {/* ═══ 플랫폼형 로비 셸 — 게스트 진입 허용 ═══ */}
          <Route element={<LobbyShell />}>
            <Route path="/" element={<HomeTab />} />
            {/* [R2] 세계관 탭 → '스토리' 개명 (기능형 라벨 확정) — 구 경로는 리다이렉트 */}
            <Route path="/story" element={<StoryTab />} />
            <Route path="/worlds" element={<Navigate to="/story" replace />} />
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
