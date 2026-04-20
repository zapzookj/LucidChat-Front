import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import ChatPage from "./pages/ChatPage";
import LoginPage from "./pages/LoginPage";
import LobbyPage from "./pages/LobbyPage";
import TheaterPlayPage from "./pages/TheaterPlayPage";
import TheaterIntermissionPage from "./pages/TheaterIntermissionPage";
import TheaterEndingCredits from "./pages/TheaterEndingCredits";
import LobbyTabShell from "./pages/LobbyTabShell";
import OAuthSuccessPage from "./pages/OAuthSuccessPage";

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return null;
  return user ? children : <Navigate to="/login" />;
};

/**
 * [Phase 4.5] 라우팅 구조 변경
 *
 * /login          → 로그인/회원가입
 * /oauth2/success → OAuth 콜백
 * /               → 로비 (Lucid Station)
 * /chat/:roomId   → 채팅방 (기존 ChatPage)
 */
function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/oauth2/success" element={<OAuthSuccessPage />} />
          <Route path="/" element={<LobbyTabShell />} />
          <Route path="/theater/:roomId" element={<TheaterPlayPage />} />
          <Route path="/theater/:roomId/intermission" element={<TheaterIntermissionPage />} />
          <Route path="/theater/:roomId/ending" element={<TheaterEndingCredits />} />
          <Route
            path="/chat/:roomId"
            element={
              <ProtectedRoute>
                <ChatPage />
              </ProtectedRoute>
            }
          />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;