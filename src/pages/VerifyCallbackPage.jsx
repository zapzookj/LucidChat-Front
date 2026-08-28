import { useEffect, useState } from 'react';

/**
 * 성인인증 콜백 브리지 (팝업 전용 화면)
 *
 * [C-1.5 · docs/17_assets/defect_register.md:1548 / D-30 · docs/19_assets/decision_agenda.md]
 *   AdultVerificationModal은 예전부터 `NICE_VERIFY_RESULT` postMessage를 **수신**하고 있었지만,
 *   그 메시지를 보내는 주체가 리포에 하나도 없었다(전수 grep 결과 수신부 1줄뿐).
 *   즉 성인인증 체인의 마지막 링크가 통째로 비어 있었고, POST /verify/success는 도달 불가 코드였다.
 *
 * [플로우]
 *   NICE 팝업 → (return-url) 백엔드 GET|POST /api/v1/verify/callback
 *             → 302 → 이 라우트(/verify/callback?encData=…&tokenVersionId=…)
 *             → window.opener.postMessage(NICE_VERIFY_RESULT) → 팝업 self-close
 *             → 오프너(모달)가 JWT를 실어 POST /verify/success 호출
 *
 * [설계 메모]
 *   - 로그인 가드(ProtectedRoute) **밖**에 둔다. 팝업 컨텍스트에는 앱 토큰이 없을 수 있고,
 *     여기서 로그인으로 튕기면 오프너는 영원히 결과를 못 받는다.
 *   - 실제 검증(복호화·나이·CI 중복)은 여기서 하지 않는다. 인증된 오프너가 한다.
 *   - postMessage 대상 origin은 window.location.origin으로 고정한다(와일드카드 '*' 금지 —
 *     enc_data가 다른 오리진에 노출된다).
 */
const VerifyCallbackPage = () => {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const encData = params.get('encData');
    const tokenVersionId = params.get('tokenVersionId');
    const error = params.get('error');

    const payload = {
      type: 'NICE_VERIFY_RESULT',
      encData: encData || null,
      tokenVersionId: tokenVersionId || null,
      error: error
        ? '본인확인 결과를 받지 못했습니다. 다시 시도해 주세요.'
        : (encData ? null : '본인확인 결과가 비어 있습니다. 다시 시도해 주세요.'),
    };

    // 오프너가 없으면(직접 접속·팝업 차단 후 같은 탭 이동) 알릴 대상이 없다 — 안내만 남긴다.
    if (!window.opener || window.opener.closed) {
      setFailed(true);
      return;
    }

    try {
      window.opener.postMessage(payload, window.location.origin);
    } catch {
      setFailed(true);
      return;
    }

    // 오프너가 메시지를 처리할 틈을 준 뒤 스스로 닫는다.
    const timer = setTimeout(() => window.close(), 300);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#12101c] px-6 text-center">
      <div className="animate-spin w-10 h-10 border-2 border-purple-400 border-t-transparent rounded-full mb-4" />
      <p className="text-white/80 text-sm">본인확인 결과를 처리하는 중입니다...</p>
      {failed && (
        <p className="text-white/50 text-xs mt-3">
          이 창을 닫고 원래 화면에서 다시 시도해 주세요.
        </p>
      )}
    </div>
  );
};

export default VerifyCallbackPage;
