import axios from 'axios';
import { API_BASE_URL, refreshAccessToken } from './refreshLock';

const api = axios.create({
  baseURL: API_BASE_URL, // 백엔드 주소
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
// [E-1.2] 그 뮤텍스가 이 파일에만 있어서 SSE 트랙(UseChatStream·UseStoryV2Stream)과
//   경합했다. 이제 뮤텍스는 refreshLock.js 하나뿐이다 — 여기서 따로 들지 않는다.

// [응답 인터셉터] 401 에러 처리 (토큰 갱신)
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // 401 에러이고, 아직 재시도하지 않은 요청이라면
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        // [1] single-flight refresh — axios·SSE를 통틀어 한 번의 갱신으로 합침(refreshLock.js).
        //     [E-1.2] 반환은 토큰 문자열 또는 null이다. 예외를 던지지 않으므로 실패는 null로 온다.
        const accessToken = await refreshAccessToken();
        if (!accessToken) {
          throw new Error('token refresh failed');
        }
        // 저장은 refreshAccessToken이 이미 했다(성공한 경우에만).

        // [2] 실패했던 요청의 헤더 업데이트 후 재요청
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return api(originalRequest);

      } catch (refreshError) {
        // [3] 갱신 실패 시 (Refresh Token 만료 등) -> 로그아웃 처리
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