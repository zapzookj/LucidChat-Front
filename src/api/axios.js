import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:8080/api/v1', // 백엔드 주소
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // [NEW] 쿠키(Refresh Token) 전송을 위해 필수
});

// [요청 인터셉터] AccessToken 주입
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  // 로그인/회원가입/리프레시 요청이 아닐 때만 헤더에 토큰 추가
  if (token && !config.url.includes('/auth/login') && !config.url.includes('/auth/signup') && !config.url.includes('/auth/refresh')) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// [응답 인터셉터] 401 에러 처리 (토큰 갱신)
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // 401 에러이고, 아직 재시도하지 않은 요청이라면
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        // [1] 토큰 갱신 요청 (쿠키에 있는 Refresh Token 사용)
        const res = await api.post('/auth/refresh');
        
        // [2] 새 AccessToken 저장
        const { accessToken } = res.data;
        localStorage.setItem('accessToken', accessToken);

        // [3] 실패했던 요청의 헤더 업데이트 후 재요청
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return api(originalRequest);

      } catch (refreshError) {
        // [4] 갱신 실패 시 (Refresh Token 만료 등) -> 로그아웃 처리
        console.error("Session expired:", refreshError);
        localStorage.removeItem('accessToken');
        localStorage.removeItem('user');
        localStorage.removeItem('roomId');
        
        // 로그인 페이지로 강제 이동 (window.location 사용)
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default api;