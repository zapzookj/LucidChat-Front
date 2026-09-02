import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import api from "../api/axios";
import { sfx } from "../utils/sfx";

/**
 * [적대적 리뷰 P0 · C-2 후속] PortOne **모바일 결제 복귀** 수신 페이지.
 *
 * ## 왜 필요한가
 * PortOne V1은 데스크톱에서만 팝업으로 결제창을 띄우고, **모바일에서는 전체 페이지를
 * PG로 리다이렉트**한다. 그러면 SPA가 통째로 언마운트되므로 `IMP.request_pay`의
 * 두 번째 인자 콜백이 **영영 실행되지 않는다** — 즉 `POST /payments/confirm`이 호출되지 않는다.
 * 결과: 카드 승인은 났는데 주문은 PENDING으로 남고 30분 뒤 EXPIRED로 마킹된다.
 * **돈은 빠지고 재화는 지급되지 않는다.**
 *
 * 구 `PaymentModal`에도 없던 결함이지만, 그 모달을 폐기해 이 경로가 **유일한 결제 경로**가 되면서
 * 노출 범위가 100%가 됐다. 유일한 폴백인 웹훅도 검증 실패를 200으로 삼켜 재시도가 걸리지 않는다.
 *
 * ## 계약
 * - `LucidStore`가 `request_pay`에 `m_redirect_url: {origin}/payment/callback`을 넘긴다.
 * - PortOne이 결제 후 이 URL로 `imp_uid` · `merchant_uid` · `imp_success`(또는 `success`) 쿼리를 붙여 복귀시킨다.
 * - 여기서 `/payments/confirm`을 호출해 **서버 검증·지급**을 완료한 뒤 원래 화면으로 돌려보낸다.
 * - 데스크톱 팝업 경로는 종전대로 `LucidStore` 콜백이 처리한다 — 이 페이지를 타지 않는다.
 *
 * ## 주의
 * 확인은 **한 번만** 수행한다(`confirmedRef`). 새로고침·뒤로가기로 재진입해도 중복 confirm이
 * 나가지 않게 한다 — 서버가 멱등하긴 하지만 여기서도 접어 둔다.
 */
const PaymentCallbackPage = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const confirmedRef = useRef(false);

  const impUid = params.get("imp_uid");
  const merchantUid = params.get("merchant_uid");
  // PortOne은 `imp_success`를 주지만 PG/버전에 따라 `success`로 오는 경우가 있어 둘 다 본다.
  const rawSuccess = params.get("imp_success") ?? params.get("success");
  // 취소·파라미터 누락은 **쿼리만 보면 알 수 있다** → 렌더 시점에 확정한다.
  //   effect 안에서 setState로 처리하면 캐스케이딩 렌더가 되고(react-hooks/set-state-in-effect)
  //   '확인 중' 화면이 한 프레임 깜빡인 뒤 실패로 바뀐다.
  const invalid = rawSuccess === "false" || !impUid || !merchantUid;

  const [state, setState] = useState(() =>
    invalid
      ? { phase: "failed", message: params.get("error_msg") || "결제가 취소되었거나 완료되지 않았습니다." }
      : { phase: "verifying", message: "" }
  );
  const [retrying, setRetrying] = useState(false);

  // 복귀 후 되돌아갈 곳. 결제는 대개 채팅/로비에서 시작하므로 히스토리가 있으면 그쪽으로.
  const goBack = () => navigate("/", { replace: true });

  const confirm = () =>
    api
      .post("/payments/confirm", { impUid, merchantUid })
      .then((res) => {
        if (res.data?.status === "PAID") {
          sfx.chime();
          setState({ phase: "success", message: "결제가 완료되었습니다." });
          setTimeout(goBack, 1600);
        } else {
          sfx.thud();
          setState({
            phase: "failed",
            message: res.data?.message || "결제 검증에 실패했습니다. 고객센터로 문의해 주세요.",
          });
        }
      })
      .catch((err) => {
        // [안건 4 · 적대적 리뷰 P1] 결제는 확정, 지급만 지연 — '실패'로 단정하지 않고 재시도 수단을 준다.
        if (err.response?.data?.errorCode === "PAYMENT_DELIVERY_PENDING") {
          setState({
            phase: "pending",
            message: err.response.data.message || "결제는 완료됐고 지급이 지연되고 있어요.",
          });
          return;
        }
        sfx.thud();
        // ⚠ 여기서 실패해도 결제 자체는 승인된 상태일 수 있다 — 유저에게 '결제 안 됨'이라고
        //   단정하지 않는다. 서버 웹훅/만료 스케줄러가 뒤이어 처리하므로 문의 경로를 안내한다.
        setState({
          phase: "failed",
          message:
            err.response?.data?.message ||
            "결제 확인 중 문제가 발생했습니다. 결제가 완료됐다면 잠시 후 반영됩니다.",
        });
      });

  useEffect(() => {
    if (invalid) { sfx.thud(); return; }
    if (confirmedRef.current) return;
    confirmedRef.current = true;
    confirm();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invalid, impUid, merchantUid]);

  const retryDelivery = async () => {
    if (retrying) return;
    setRetrying(true);
    try {
      await confirm();
    } finally {
      setTimeout(() => setRetrying(false), 5000);   // 결제 검증 레이트리밋(5초) 쿨다운
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 px-6">
      <div className="w-full max-w-sm text-center">
        {state.phase === "verifying" && (
          <>
            <div className="mx-auto mb-5 h-9 w-9 rounded-full border-2 border-white/15 border-t-white/70 animate-spin" />
            <p className="text-sm font-bold text-white/80">결제를 확인하고 있습니다</p>
            <p className="mt-2 text-xs text-white/45">창을 닫지 말아 주세요.</p>
          </>
        )}

        {state.phase === "success" && (
          <>
            <div className="mx-auto mb-5 flex h-11 w-11 items-center justify-center rounded-full bg-emerald-500/15 text-xl">✓</div>
            <p className="text-sm font-bold text-white/90">{state.message}</p>
            <p className="mt-2 text-xs text-white/45">잠시 후 자동으로 돌아갑니다.</p>
          </>
        )}

        {state.phase === "pending" && (
          <>
            <div className="mx-auto mb-5 flex h-11 w-11 items-center justify-center rounded-full bg-amber-500/15 text-xl">✓</div>
            <p className="text-sm font-bold text-white/90">결제 완료 · 지급 대기</p>
            <p className="mt-2 text-xs text-white/55">{state.message}</p>
            <p className="mt-2 text-xs text-amber-300/80">다시 결제하지 마세요 — 결제는 이미 완료됐어요.</p>
            <div className="mt-6 flex justify-center gap-2">
              <button
                onClick={retryDelivery}
                disabled={retrying}
                className="rounded-xl border border-amber-400/30 bg-amber-500/15 px-5 py-2.5 text-xs font-bold text-amber-100 hover:bg-amber-500/25 disabled:opacity-50"
              >
                {retrying ? "확인 중…" : "지급 다시 시도"}
              </button>
              <button
                onClick={goBack}
                className="rounded-xl border border-white/12 bg-white/[0.04] px-5 py-2.5 text-xs font-bold text-white/75 hover:bg-white/[0.08]"
              >
                돌아가기
              </button>
            </div>
          </>
        )}

        {state.phase === "failed" && (
          <>
            <div className="mx-auto mb-5 flex h-11 w-11 items-center justify-center rounded-full bg-rose-500/15 text-xl">!</div>
            <p className="text-sm font-bold text-white/90">{state.message}</p>
            <button
              onClick={() => navigate("/", { replace: true })}
              className="mt-6 rounded-xl border border-white/12 bg-white/[0.04] px-5 py-2.5 text-xs font-bold text-white/75 hover:bg-white/[0.08]"
            >
              돌아가기
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default PaymentCallbackPage;
