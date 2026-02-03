import { createContext, useState, useContext, useEffect } from 'react';
import api from '../api/axios';

const AuthContext = createContext();

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
      throw error; // 에러 메시지를 UI로 전달하기 위해 throw
    }
  };

  // 구글 로그인 성공 처리 (토큰 저장)
  const googleLogin = (token, userData, roomId) => {
    handleAuthSuccess({ accessToken: token, user: userData, roomId });
  };

  const handleAuthSuccess = ({ accessToken, user, roomId }) => {
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('user', JSON.stringify(user));
    localStorage.setItem('roomId', roomId);
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