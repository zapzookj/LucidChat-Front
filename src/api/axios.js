import axios from 'axios';

const api = axios.create({
  // [변경] 환경변수에서 주소를 가져오도록 수정
  // baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api/v1', // 백엔드 주소
  baseURL: 'http://localhost:8080/api/v1',
  headers: {
    'Content-Type': 'application/json',
    'ngrok-skip-browser-warning': 'true', // [NEW] ngrok 경고 무시 헤더
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

// [Phase6/Tier3 / H-24] Refresh single-flight.
//   5개 API가 동시에 401을 받으면 5개 동시 /auth/refresh → RT rotation으로 첫 호출만
//   성공하고 나머지는 storedToken 불일치 → 정상 유저가 강제 로그아웃되던 결함을 차단.
//   진행 중인 refresh가 있으면 모든 요청이 그 Promise를 공유한다.
let refreshPromise = null;

function refreshOnce() {
  if (!refreshPromise) {
    refreshPromise = api.post('/auth/refresh')
      .finally(() => { refreshPromise = null; });
  }
  return refreshPromise;
}

// [응답 인터셉터] 401 에러 처리 (토큰 갱신)
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // 401 에러이고, 아직 재시도하지 않은 요청이라면
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        // [1] single-flight refresh — 동시 다발 요청을 한 번의 갱신으로 합침
        const res = await refreshOnce();

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

    if (error.response?.status === 429) {
      const retryAfter = error.response.headers['retry-after'] || 3;
      // 글로벌 토스트로 안내
      window.dispatchEvent(new CustomEvent('rate-limited', {
        detail: { retryAfter: Number(retryAfter) }
      }));
    }
    return Promise.reject(error);
    // [Phase6/Tier3 / M-27] dead code 제거: 위 return 이후의 두 번째 `return Promise.reject(error)` 삭제됨.
  }
);

export default api;