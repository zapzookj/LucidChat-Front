import { createContext, useState, useContext, useEffect } from 'react';
import api from '../api/axios';

const AuthContext = createContext();

/**
 * [Phase 4.5] AuthContext 업데이트
 *
 * - roomId 더 이상 로그인 시 저장하지 않음
 * - 로그인 성공 시 로비(/)로 이동
 * - roomId는 로비에서 방 선택/생성 시 localStorage에 저장
 */
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    const savedUser = localStorage.getItem('user');
    if (token && savedUser) {
      setUser(JSON.parse(savedUser));
    }
    setLoading(false);
  }, []);

  // 로그인 (Local)
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

  // 회원가입 (Local)
  const signup = async (username, password, nickname, email) => {
    try {
      const res = await api.post('/auth/signup', { username, password, nickname, email });
      handleAuthSuccess(res.data);
      return true;
    } catch (error) {
      console.error("Signup Error", error);
      throw error;
    }
  };

  // 구글 로그인 성공 처리
  const googleLogin = (token, userData) => {
    handleAuthSuccess({ accessToken: token, user: userData });
  };

  const handleAuthSuccess = ({ accessToken, user }) => {
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('user', JSON.stringify(user));
    // [Phase 4.5] roomId는 더 이상 여기서 저장하지 않음 — 로비에서 선택
    setUser(user);
  };

  const logout = () => {
    localStorage.clear();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, signup, googleLogin, logout, loading }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);