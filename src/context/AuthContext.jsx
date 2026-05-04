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
 *
 * [Polish · P0]
 * - refreshUser() 추가:
 *   기존 user 객체는 로그인 시점의 일부 필드(id/username/nickname/energy)만
 *   가지고 있어, 베타 활성화나 결제, 관리자 강제 변경 후 구독/성인 인증 상태가
 *   AuthContext에 반영되지 않았다. 이로 인해 useAuth().user.subscriptionTier가
 *   undefined로 남아 TheaterCreateFlow의 스탯 분배가 잠기는 등 광범위한
 *   stale-state 버그가 발생했다.
 *   refreshUser()는 GET /users/me로 최신 UserResponse를 받아 AuthContext +
 *   localStorage를 동기화한다. 베타 활성화 직후, 결제 완료 직후, 그리고
 *   필요한 시점에 호출.
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

  /**
   * [Polish · P0] 서버에서 최신 user 정보를 가져와 AuthContext + localStorage 동기화.
   *
   * 호출 시점 (예시):
   *  - 베타 활성화 직후 (구독/성인 인증 변경)
   *  - 결제 완료 직후 (에너지 충전, 구독 변경, 시크릿 패스 등)
   *  - 시크릿 모드 토글 후 (isSecretMode 변경)
   *  - 명시적 새로고침 의도가 있는 모든 지점
   *
   * 호출은 비동기지만 await가 필수는 아님. 실패해도 기존 user는 유지되며
   * 다음 호출 기회에 동기화될 수 있도록 try-catch로 감쌈.
   *
   * 반환: 새로 받아온 user 객체 (실패 시 기존 user). 호출자가 필요하면 사용 가능.
   */
  const refreshUser = useCallback(async () => {
    try {
      const res = await api.get('/users/me');
      const fresh = res.data;
      // 기존 user의 필드를 보존하면서 서버 응답으로 덮어쓰기 (안전한 머지).
      setUser((prev) => {
        const merged = { ...(prev || {}), ...fresh };
        try {
          localStorage.setItem('user', JSON.stringify(merged));
        } catch {
          // localStorage quota 등 — 무시
        }
        return merged;
      });
      return fresh;
    } catch (e) {
      console.warn('[Auth] refreshUser failed:', e?.message || e);
      return user;
    }
  }, [user]);

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
    <AuthContext.Provider value={{ user, login, handleOAuthLogin, refreshUser, logout, loading }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);