import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import api from "../api/axios";
import {
  fetchMyUgcWorlds,
  fetchWorldCreationJob,
  LAST_WORLD_JOB_KEY,
} from "../api/WorldStudioApi";
import WorldCreateFlow from "../components/studio/WorldCreateFlow";
import { sfx } from "../utils/sfx";

/**
 * [World Builder v1] StudioWorldPage — UGC 세계관 빌더 전용 페이지
 *
 * 라우트: /studio/world (ProtectedRoute)
 *
 * 마운트 시 GET /ugc/worlds/mine 1회:
 *   - activeJob 있으면 해당 잡으로 플로우 재개
 *   - [적대 리뷰 #5] activeJob이 없고 lastWorldJobId 키가 있으면 잡 1회 조회 —
 *     이탈 중 종결(READY/FAILED/EXPIRED)된 잡의 완성/실패 뷰(환불 안내 포함)를 1회 복원
 *   - 둘 다 없으면 컨셉 입력부터 시작
 * 위저드(WorldCreateFlow)가 fixed 풀스크린이므로 이 페이지는
 * 부트스트랩(잡 조회 + 에너지)과 배경만 책임진다.
 */

const TERMINAL_JOB_STATUSES = new Set(["READY", "FAILED", "EXPIRED"]);
export default function StudioWorldPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [userInfo, setUserInfo] = useState(null);
  const [boot, setBoot] = useState({ loading: true, error: null, initialJobId: null });

  const fetchEnergy = useCallback(async () => {
    try { setUserInfo((await api.get("/users/me")).data); } catch { /* noop */ }
  }, []);

  const bootLoad = useCallback(async () => {
    setBoot({ loading: true, error: null, initialJobId: null });
    try {
      const data = await fetchMyUgcWorlds();
      let initialJobId = data?.activeJob?.jobId || null;

      // [적대 리뷰 #5] 종결된 잡은 activeJob에서 빠진다 — 마지막 잡 키로 1회 조회해
      // READY/FAILED/EXPIRED면 그 잡으로 플로우를 열어 종결 뷰를 보여준다
      // (키 제거는 종결 뷰 표시 후 플로우 닫힘 시 WorldCreateFlow가 처리)
      if (!initialJobId) {
        const lastJobId = localStorage.getItem(LAST_WORLD_JOB_KEY);
        if (lastJobId) {
          try {
            const lastJob = await fetchWorldCreationJob(lastJobId);
            if (TERMINAL_JOB_STATUSES.has(lastJob?.status)) {
              initialJobId = lastJobId;
            } else {
              // 진행 중도 아닌데 activeJob에 없는 스테일 키 — 정리 후 신규 시작
              localStorage.removeItem(LAST_WORLD_JOB_KEY);
            }
          } catch {
            // 404 등 조회 실패 — 조용히 키 제거 후 신규 시작
            localStorage.removeItem(LAST_WORLD_JOB_KEY);
          }
        }
      }

      setBoot({ loading: false, error: null, initialJobId });
    } catch (e) {
      setBoot({
        loading: false,
        error: e?.response?.data?.message || "월드 빌더를 불러오지 못했습니다.",
        initialJobId: null,
      });
    }
  }, []);

  useEffect(() => {
    fetchEnergy();
    bootLoad();
  }, [fetchEnergy, bootLoad]);

  const displayEnergy = userInfo?.energy ?? user?.energy ?? 0;

  return (
    <div className="relative w-full h-screen overflow-hidden bg-stone-950">
      {/* 배경 — 스튜디오와 동일한 앰버 무드 */}
      <div className="absolute inset-0 pointer-events-none bg-gradient-to-br from-amber-950 via-stone-950 to-orange-950" />

      {boot.loading ? (
        <div className="relative z-10 h-full flex items-center justify-center">
          <motion.div
            className="w-10 h-10 border-2 border-amber-400/40 border-t-amber-400 rounded-full"
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          />
        </div>
      ) : boot.error ? (
        <div className="relative z-10 h-full flex flex-col items-center justify-center text-center px-6">
          <p className="text-rose-300 text-sm mb-5">{boot.error}</p>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => { sfx.click(); bootLoad(); }}
              className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white/70 hover:bg-white/10 text-sm transition-colors"
            >
              다시 시도
            </button>
            <button
              type="button"
              onClick={() => { sfx.click(); navigate("/studio"); }}
              className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white/70 hover:bg-white/10 text-sm transition-colors"
            >
              스튜디오로 돌아가기
            </button>
          </div>
        </div>
      ) : (
        <WorldCreateFlow
          initialJobId={boot.initialJobId}
          energy={displayEnergy}
          onClose={() => navigate("/studio")}
          onEnergyRefresh={fetchEnergy}
        />
      )}
    </div>
  );
}
