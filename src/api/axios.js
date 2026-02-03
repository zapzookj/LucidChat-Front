import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:8080/api/v1', // 백엔드 주소
  headers: {
    'Content-Type': 'application/json',
  },
});

// 요청 인터셉터: 토큰 자동 주입
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  // [수정] 로그인(/auth/login)이나 회원가입(/auth/signup) 요청이 아닐 때만 토큰을 넣음
  if (token && !config.url.includes('/auth/login') && !config.url.includes('/auth/signup')) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;