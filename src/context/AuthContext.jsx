import { createContext, useState, useContext, useEffect, useCallback } from 'react';
import api from '../api/axios';

const AuthContext = createContext();

/**
 * [Phase 5] AuthContext 리팩토링
 *
 * [변경]
 * - signup() 제거 (로컬 가입 deprecated)
 * - login() 유지 (기존 LOCAL 계정 하위 호환)
 * - googleLogin() → handleOAuthLogin()으로 명칭 변경 + 실제 유저 데이터 수신
 * - logout: API 호출 추가 (서버측 블랙리스트)
 */
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    const savedUser = localStorage.getItem('user');
    if (token && savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch {
        localStorage.clear();
      }
    }
    setLoading(false);
  }, []);

  /**
   * 로컬 로그인 (기존 LOCAL 계정 하위 호환용)
   * 신규 가입은 불가 — 소셜 로그인만 허용
   */
  const login = async (username, password) => {
    try {
      const res = await api.post('/auth/login', { username, password });
      handleAuthSuccess(res.data);
      return true;
    } catch (error) {
      console.error("Login Error", error);
      return false;
    }
  };

  /**
   * 소셜 로그인 성공 처리 (OAuth 콜백 페이지에서 호출)
   * OAuthSuccessPage에서 토큰 + 유저 데이터를 전달받음
   */
  const handleOAuthLogin = useCallback((token, userData) => {
    localStorage.setItem('accessToken', token);
    localStorage.setItem('user', JSON.stringify(userData));
    setUser(userData);
  }, []);

  const handleAuthSuccess = ({ accessToken, user: userData }) => {
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('user', JSON.stringify(userData));
    setUser(userData);
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } catch (e) {
      // 서버 로그아웃 실패해도 클라이언트는 정리
      console.warn("Server logout failed:", e);
    }
    localStorage.clear();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, handleOAuthLogin, logout, loading }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);