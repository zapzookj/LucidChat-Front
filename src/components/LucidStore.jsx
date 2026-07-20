import { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, Zap, Lock, Unlock, Crown, CheckCircle, Sparkles,
  Coffee, CakeSlice, Wine, Moon, Key, Shield, Star, ArrowRight, ChevronRight
} from "lucide-react";
import api from "../api/axios";
import { sfx } from "../utils/sfx";

/**
 * Lucid Store — 루시드 부띠끄
 *
 * [3 Tabs]
 * 1. 에너지  — 커피/디저트/애프터눈 티
 * 2. 시크릿 해금 — 24h 패스 / 영구 해금
 * 3. 루시드 패스 — Standard(14,900) / Premium(24,900)
 *
 * [Payment Flow]
 * 상품 선택 → POST /payments/ready → PortOne SDK → POST /payments/confirm
 */

const TABS = [
  { key: "energy", label: "에너지", icon: Zap },
  { key: "secret", label: "시크릿 해금", icon: Lock },
  { key: "pass", label: "루시드 패스", icon: Crown },
];

const ENERGY_PRODUCTS = [
  {
    type: "ENERGY_T1", name: "커피 한 잔", price: 1500, energy: 30,
    icon: Coffee, color: "amber",
    desc: "가벼운 한 모금으로 대화를 이어가세요",
    perUnit: "50원/에너지",
  },
  {
    type: "ENERGY_T2", name: "달콤한 디저트 세트", price: 4500, energy: 100,
    icon: CakeSlice, color: "pink",
    desc: "달콤한 간식과 함께하는 넉넉한 시간",
    perUnit: "45원/에너지",
  },
  {
    type: "ENERGY_T3", name: "프리미엄 애프터눈 티", price: 9900, energy: 250,
    icon: Wine, color: "purple", badge: "BEST",
    desc: "여유롭고 우아한 대화를 위한 최적의 선택",
    perUnit: "39.6원/에너지",
  },
];

const SECRET_PRODUCTS = [
  {
    type: "SECRET_PASS_24H", name: "시크릿 나이트 패스", price: 2900,
    icon: Moon, color: "indigo",
    desc: "선택한 캐릭터의 시크릿 모드를\n24시간 동안 자유롭게 즐길 수 있습니다",
    tag: "단기 소모권",
  },
  {
    type: "SECRET_UNLOCK_PERMANENT", name: "캐릭터 시크릿 영구 해금", price: 14900,
    icon: Key, color: "amber",
    desc: "선택한 캐릭터의 시크릿 모드를\n영구적으로 제한 없이 이용할 수 있습니다",
    tag: "영구 소유권",
  },
];

const PASS_PRODUCTS = [
  {
    type: "LUCID_PASS", name: "루시드 패스", price: 14900, adultOnly: false,
    color: "indigo", tier: "Standard",
    benefits: [
      "에너지 부스트 모드 무제한 (Pro 모델 대화)",
      "에너지 회복 속도 2배 (10분→5분)",
      "최대 에너지 보유량 증가 (30→100)",
      "My Persona 설정 해금 (나만의 캐릭터 설정)",
    ],
  },
  {
    type: "LUCID_MIDNIGHT_PASS", name: "루시드 미드나잇 패스", price: 24900, adultOnly: true,
    color: "rose", tier: "Premium",
    benefits: [
      "루시드 패스의 모든 혜택 포함",
      "모든 캐릭터 시크릿 모드 상시 개방",
      "프리미엄 전용 이벤트 (예정)",
    ],
  },
];

const formatPrice = (n) => n.toLocaleString("ko-KR") + "원";

/* ── Elegant shimmer border for BEST card ── */
const PremiumCard = ({ children, className = "" }) => (
  <div className={`relative group/premium ${className}`}>
    {/* Ambient glow — soft breathing aura */}
    <motion.div
      className="absolute -inset-[1px] rounded-2xl opacity-60 pointer-events-none"
      style={{
        background: "linear-gradient(135deg, rgba(168,85,247,0.4), rgba(236,72,153,0.3), rgba(168,85,247,0.4))",
        filter: "blur(12px)",
      }}
      animate={{ opacity: [0.35, 0.6, 0.35] }}
      transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
    />
    {/* Border layer */}
    <div
      className="absolute inset-0 rounded-2xl pointer-events-none"
      style={{
        background: "linear-gradient(135deg, rgba(168,85,247,0.5), rgba(236,72,153,0.4), rgba(245,158,11,0.3), rgba(168,85,247,0.5))",
        padding: "1px",
        WebkitMask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
        WebkitMaskComposite: "xor",
        maskComposite: "exclude",
      }}
    />
    {/* Content */}
    <div className="relative rounded-2xl overflow-hidden bg-slate-900/95">
      {children}
    </div>
  </div>
);

const LucidStore = ({
  isOpen,
  onClose,
  initialTab = "energy",
  userInfo,
  characters = [],
  currentCharacterId = null,
  onPaymentComplete,
  onRequestAdultVerify,
}) => {
  const [activeTab, setActiveTab] = useState(initialTab);
  const [selectedCharId, setSelectedCharId] = useState(currentCharacterId);
  const [status, setStatus] = useState("idle"); // idle | processing | success | error
  const [errorMsg, setErrorMsg] = useState("");
  const [successProduct, setSuccessProduct] = useState(null);

  useEffect(() => {
    if (isOpen) {
      sfx.wooshLight();
      setActiveTab(initialTab);
      setStatus("idle");
      setErrorMsg("");
      if (currentCharacterId) setSelectedCharId(currentCharacterId);
    }
  }, [isOpen, initialTab, currentCharacterId]);

  useEffect(() => {
    if (status === 'error') sfx.thud();
    else if (status === 'success') sfx.chime();
  }, [status]);

  /* ── Payment Flow ── */
  const handlePurchase = useCallback(async (product) => {
    setStatus("processing");
    setErrorMsg("");

    try {
      const payload = { productType: product.type };
      if (product.type === "SECRET_PASS_24H" || product.type === "SECRET_UNLOCK_PERMANENT") {
        if (!selectedCharId) {
          setStatus("error");
          setErrorMsg("캐릭터를 선택해주세요.");
          return;
        }
        payload.targetCharacterId = selectedCharId;
      }

      const { data: order } = await api.post("/payments/ready", payload);

      if (!window.IMP) {
        setStatus("error");
        setErrorMsg("결제 모듈을 불러올 수 없습니다.");
        return;
      }

      window.IMP.request_pay(
        {
          pg: "tosspayments",
          pay_method: "card",
          merchant_uid: order.merchantUid,
          name: order.productName,
          amount: order.amount,
          buyer_name: "Lucid User",
        },
        async (res) => {
          if (res.success) {
            try {
              const confirm = await api.post("/payments/confirm", {
                impUid: res.imp_uid,
                merchantUid: order.merchantUid,
              });
              if (confirm.data.status === "PAID") {
                setSuccessProduct(product);
                setStatus("success");
                setTimeout(() => {
                  onPaymentComplete?.(confirm.data);
                }, 2500);
              } else {
                setStatus("error");
                setErrorMsg(confirm.data.message || "결제 검증에 실패했습니다.");
              }
            } catch (e) {
              setStatus("error");
              setErrorMsg(e.response?.data?.message || "서버 검증 실패");
            }
          } else {
            setStatus("idle");
          }
        }
      );
    } catch (e) {
      setStatus("error");
      setErrorMsg(e.response?.data?.message || "결제 준비 실패");
    }
  }, [selectedCharId, onPaymentComplete]);

  if (!isOpen) return null;

  const energy = (userInfo?.freeEnergy ?? 0) + (userInfo?.paidEnergy ?? 0);

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[200] flex items-center justify-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        {/* Backdrop */}
        <motion.div
          className="absolute inset-0 bg-black/70 backdrop-blur-sm"
          onClick={onClose}
        />

        {/* Modal */}
        <motion.div
          className="relative z-10 w-[95vw] max-w-3xl max-h-[90vh] overflow-hidden rounded-3xl border border-white/10"
          style={{
            background: "linear-gradient(160deg, rgba(15,10,35,0.98) 0%, rgba(30,15,55,0.97) 50%, rgba(20,10,40,0.98) 100%)",
            boxShadow: "0 40px 80px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.05)",
          }}
          initial={{ scale: 0.92, y: 30, opacity: 0 }}
          animate={{ scale: 1, y: 0, opacity: 1 }}
          exit={{ scale: 0.92, y: 30, opacity: 0 }}
          transition={{ type: "spring", stiffness: 260, damping: 24 }}
        >
          {/* ─── Header ─── */}
          <div className="relative flex items-center justify-between px-6 pt-5 pb-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-lg">
                <Sparkles size={18} className="text-white" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white tracking-wide">루시드 부띠끄</h2>
                <p className="text-[11px] text-white/30 tracking-widest uppercase">Lucid Boutique</p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-3.5 py-1.5">
                <Zap size={14} className="text-amber-400" />
                <span className="text-sm font-bold text-white">{energy}</span>
                <span className="text-[10px] text-white/30">에너지</span>
              </div>
              <button
                onClick={() => { sfx.click(); onClose?.(); }}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 text-white/40 hover:text-white transition"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* ─── Tabs ─── */}
          <div className="relative px-6 mb-4">
            <div className="flex gap-1 bg-white/[0.03] rounded-xl p-1 border border-white/5">
              {TABS.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.key;
                return (
                  <button
                    key={tab.key}
                    onClick={() => { sfx.click(); setActiveTab(tab.key); setStatus("idle"); }}
                    className={`relative flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                      isActive ? "text-white" : "text-white/40 hover:text-white/60"
                    }`}
                  >
                    {isActive && (
                      <motion.div
                        layoutId="store-tab-bg"
                        className="absolute inset-0 bg-white/10 rounded-lg border border-white/10"
                        transition={{ type: "spring", stiffness: 400, damping: 30 }}
                      />
                    )}
                    <span className="relative flex items-center gap-2">
                      <Icon size={15} />
                      {tab.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ─── Content ─── */}
          <div className="px-6 pb-6 overflow-y-auto max-h-[calc(90vh-180px)] custom-scrollbar">

            {/* Processing / Success / Error overlays */}
            <AnimatePresence mode="wait">
              {status === "processing" && (
                <motion.div
                  key="processing"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex flex-col items-center justify-center py-16"
                >
                  <motion.div
                    className="w-12 h-12 border-2 border-purple-400/40 border-t-purple-400 rounded-full"
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  />
                  <p className="text-white/60 text-sm mt-4">결제를 진행하고 있습니다...</p>
                  <p className="text-white/30 text-xs mt-1">결제창을 완료해주세요</p>
                </motion.div>
              )}

              {status === "success" && successProduct && (
                <motion.div
                  key="success"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex flex-col items-center justify-center py-12"
                >
                  {/* Confetti particles (optimized) */}
                  <div className="absolute inset-0 overflow-hidden pointer-events-none">
                    {[...Array(12)].map((_, i) => (
                      <motion.div
                        key={i}
                        className={`absolute w-2 h-2 rounded-full ${
                          ["bg-purple-400", "bg-pink-400", "bg-amber-400", "bg-cyan-400", "bg-white"][i % 5]
                        }`}
                        style={{ willChange: "transform, opacity" }}
                        initial={{
                          x: "50%", y: "40%", opacity: 0, scale: 0,
                        }}
                        animate={{
                          x: `${15 + Math.random() * 70}%`,
                          y: `${Math.random() * 100}%`,
                          opacity: [0, 1, 0],
                          scale: [0, 1.5, 0],
                          rotate: Math.random() * 360,
                        }}
                        transition={{
                          duration: 1.5 + Math.random(),
                          delay: Math.random() * 0.5,
                        }}
                      />
                    ))}
                  </div>

                  <motion.div
                    initial={{ scale: 0, rotate: -180 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: "spring", stiffness: 200, delay: 0.2 }}
                    className="w-20 h-20 rounded-full bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center mb-5 shadow-2xl shadow-emerald-500/30"
                  >
                    <CheckCircle size={40} className="text-white" />
                  </motion.div>
                  <motion.h3
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                    className="text-xl font-bold text-white mb-1"
                  >
                    결제 완료!
                  </motion.h3>
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.6 }}
                    className="text-purple-300 text-sm"
                  >
                    {successProduct.energy
                      ? `+${successProduct.energy} 에너지가 충전되었습니다`
                      : successProduct.name}
                  </motion.p>
                </motion.div>
              )}

              {status === "error" && (
                <motion.div
                  key="error"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex flex-col items-center py-8"
                >
                  <div className="w-14 h-14 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mb-3">
                    <X size={28} className="text-red-400" />
                  </div>
                  <p className="text-red-400 font-medium mb-1">결제 실패</p>
                  <p className="text-white/50 text-sm text-center">{errorMsg}</p>
                  <button
                    onClick={() => setStatus("idle")}
                    className="mt-4 px-6 py-2 rounded-lg bg-white/10 text-white/70 hover:bg-white/15 text-sm transition"
                  >
                    돌아가기
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* ═══ ENERGY TAB ═══ */}
            {status === "idle" && activeTab === "energy" && (
              <motion.div
                key="energy"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="grid grid-cols-1 sm:grid-cols-3 gap-5"
              >
                {ENERGY_PRODUCTS.map((p) => {
                  const Icon = p.icon;
                  const colorMap = {
                    amber: { border: "border-amber-500/20", hoverBorder: "hover:border-amber-400/50", text: "text-amber-400", bg: "from-amber-900/30 to-amber-900/10", glow: "hover:shadow-amber-500/10" },
                    pink: { border: "border-pink-500/20", hoverBorder: "hover:border-pink-400/50", text: "text-pink-400", bg: "from-pink-900/30 to-pink-900/10", glow: "hover:shadow-pink-500/10" },
                    purple: { border: "border-purple-500/20", hoverBorder: "hover:border-purple-400/50", text: "text-purple-400", bg: "from-purple-900/30 to-purple-900/10", glow: "hover:shadow-purple-500/10" },
                  };
                  const c = colorMap[p.color];

                  const CardContent = (
                    <button
                      onClick={() => { sfx.click(); handlePurchase(p); }}
                      className={`relative w-full h-full text-left p-5 flex flex-col justify-between ${
                        p.badge ? "rounded-2xl" : `rounded-2xl border ${c.border} ${c.hoverBorder} bg-gradient-to-b ${c.bg} shadow-lg ${c.glow}`
                      } transition-all duration-300 group hover:-translate-y-1`}
                    >
                      {p.badge && (
                        <div className="absolute -top-0 right-4 z-10">
                          <div className="bg-gradient-to-r from-amber-500 to-orange-500 text-white text-[10px] font-black px-3 py-1 rounded-b-lg shadow-lg tracking-wider">
                            {p.badge}
                          </div>
                        </div>
                      )}

                      <div>
                        <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${c.bg} border ${c.border} flex items-center justify-center mb-4`}>
                          <Icon size={22} className={c.text} />
                        </div>
                        <h4 className="text-white font-bold text-base mb-1">{p.name}</h4>
                        <p className="text-white/40 text-xs leading-relaxed mb-3">{p.desc}</p>
                      </div>

                      <div>
                        <div className="flex items-baseline gap-2 mb-2">
                          <span className="text-2xl font-black text-white">{formatPrice(p.price)}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <Zap size={14} className={c.text} fill="currentColor" />
                            <span className={`text-sm font-bold ${c.text}`}>+{p.energy}</span>
                          </div>
                          <span className="text-[10px] text-white/25">{p.perUnit}</span>
                        </div>
                      </div>
                    </button>
                  );

                  return p.badge ? (
                    <PremiumCard key={p.type}>{CardContent}</PremiumCard>
                  ) : (
                    <div key={p.type}>{CardContent}</div>
                  );
                })}
              </motion.div>
            )}

            {/* ═══ SECRET TAB ═══ */}
            {status === "idle" && activeTab === "secret" && (
              <motion.div
                key="secret"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-5"
              >
                {/* Character selector */}
                {characters.length > 0 && (
                  <div>
                    <label className="text-xs text-white/40 uppercase tracking-wider mb-2 block">대상 캐릭터 선택</label>
                    {/* [Phase B · 단계4] 모바일(<640px)에서만 줄바꿈 — 데스크톱 한 줄 배치 불변(G1) */}
                    <div className="flex gap-3 max-sm:flex-wrap">
                      {characters.map((ch) => (
                        <button
                          key={ch.id}
                          onClick={() => { sfx.click(); setSelectedCharId(ch.id); }}
                          className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl border transition-all ${
                            selectedCharId === ch.id
                              ? "border-purple-500/60 bg-purple-500/10 text-white"
                              : "border-white/10 bg-white/[0.02] text-white/50 hover:bg-white/5"
                          }`}
                        >
                          <div className="w-8 h-8 rounded-full overflow-hidden bg-slate-800 flex-shrink-0">
                            {ch.thumbnailUrl
                              ? <img src={ch.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                              : <div className="w-full h-full flex items-center justify-center text-xs text-white/30">{ch.name?.[0]}</div>
                            }
                          </div>
                          <span className="text-sm font-medium">{ch.name}</span>
                          {selectedCharId === ch.id && <CheckCircle size={14} className="text-purple-400" />}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Adult verification status banner */}
                {!userInfo?.isAdultVerified ? (
                  <button
                    onClick={() => { sfx.click(); onRequestAdultVerify?.(); }}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-red-500/5 border border-red-500/15 hover:bg-red-500/10 hover:border-red-500/25 transition-all group"
                  >
                    <Shield size={16} className="text-red-400 flex-shrink-0" />
                    <span className="text-xs text-red-300/80 text-left flex-1">성인 인증을 완료하면 시크릿 상품을 구매할 수 있습니다.</span>
                    <span className="text-[10px] text-red-400/60 font-bold group-hover:text-red-400 transition whitespace-nowrap">
                      인증하기 →
                    </span>
                  </button>
                ) : (
                  <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500/5 border border-emerald-500/10">
                    <CheckCircle size={14} className="text-emerald-400 flex-shrink-0" />
                    <span className="text-xs text-emerald-300/70">성인 인증 완료</span>
                  </div>
                )}

                {/* Product cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {SECRET_PRODUCTS.map((p) => {
                    const Icon = p.icon;
                    const isPermanent = p.type === "SECRET_UNLOCK_PERMANENT";
                    const isVerified = !!userInfo?.isAdultVerified;
                    return (
                      <button
                        key={p.type}
                        onClick={() => {
                          sfx.click();
                          if (!isVerified) {
                            onRequestAdultVerify?.();
                          } else {
                            handlePurchase(p);
                          }
                        }}
                        className={`relative text-left p-5 rounded-2xl border transition-all duration-300 group hover:-translate-y-0.5 ${
                          isPermanent
                            ? "border-amber-500/20 bg-gradient-to-b from-amber-900/20 to-amber-950/30 hover:border-amber-400/40 shadow-lg shadow-amber-500/5"
                            : "border-indigo-500/20 bg-gradient-to-b from-indigo-900/20 to-indigo-950/30 hover:border-indigo-400/40"
                        }`}
                      >
                        {/* 미인증 시 잠금 뱃지 */}
                        {!isVerified && (
                          <div className="absolute top-3 right-3 flex items-center gap-1 bg-white/5 border border-white/10 px-2 py-1 rounded-lg">
                            <Lock size={10} className="text-white/40" />
                            <span className="text-[9px] text-white/40">인증 필요</span>
                          </div>
                        )}

                        <div className={`text-[10px] font-bold uppercase tracking-widest mb-3 ${
                          isPermanent ? "text-amber-400/70" : "text-indigo-400/70"
                        }`}>
                          {p.tag}
                        </div>

                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${
                          isPermanent
                            ? "bg-gradient-to-br from-amber-600/20 to-amber-800/20 border border-amber-500/20"
                            : "bg-gradient-to-br from-indigo-600/20 to-indigo-800/20 border border-indigo-500/20"
                        }`}>
                          <Icon size={22} className={isPermanent ? "text-amber-400" : "text-indigo-400"} />
                        </div>

                        <h4 className="text-white font-bold text-base mb-2">{p.name}</h4>
                        <p className="text-white/40 text-xs leading-relaxed whitespace-pre-line mb-5">{p.desc}</p>

                        <div className="flex items-center justify-between">
                          <span className="text-xl font-black text-white">{formatPrice(p.price)}</span>
                          <div className={`flex items-center gap-1 text-xs font-medium ${
                            isPermanent ? "text-amber-400" : "text-indigo-400"
                          }`}>
                            {isVerified ? "구매하기" : "인증 후 구매"} <ArrowRight size={12} />
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </motion.div>
            )}

            {/* ═══ PASS TAB ═══ */}
            {status === "idle" && activeTab === "pass" && (
              <motion.div
                key="pass"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-5"
              >
                {PASS_PRODUCTS.map((p) => {
                  const isPremium = p.type === "LUCID_MIDNIGHT_PASS";
                  const isCurrentTier = userInfo?.subscriptionTier === p.type;
                  const needsAdult = p.adultOnly && !userInfo?.isAdultVerified;

                  const PassCard = (
                    <button
                      onClick={() => {
                        if (isCurrentTier) return;
                        sfx.click();
                        if (needsAdult) { onRequestAdultVerify?.(); return; }
                        handlePurchase(p);
                      }}
                      className={`relative w-full text-left p-6 transition-all duration-300 ${
                        isPremium ? "rounded-2xl" : "rounded-2xl border border-indigo-500/20 bg-gradient-to-br from-indigo-900/20 via-slate-900/50 to-indigo-950/20 hover:border-indigo-400/40"
                      } ${isCurrentTier ? "ring-2 ring-emerald-500/50" : ""}`}
                    >
                      {isCurrentTier && (
                        <div className="absolute top-4 right-4 flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-bold px-3 py-1 rounded-full">
                          <CheckCircle size={12} /> 구독 중
                        </div>
                      )}

                      <div className="flex items-center gap-3 mb-4">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                          isPremium
                            ? "bg-gradient-to-br from-rose-600/20 to-purple-600/20 border border-rose-500/20"
                            : "bg-gradient-to-br from-indigo-600/20 to-blue-600/20 border border-indigo-500/20"
                        }`}>
                          {isPremium ? <Crown size={20} className="text-rose-400" /> : <Star size={20} className="text-indigo-400" />}
                        </div>
                        <div>
                          <h4 className="text-white font-bold text-base">{p.name}</h4>
                          <span className={`text-[10px] uppercase tracking-widest font-bold ${
                            isPremium ? "text-rose-400/60" : "text-indigo-400/60"
                          }`}>{p.tier}</span>
                        </div>
                      </div>

                      <ul className="space-y-2.5 mb-6">
                        {p.benefits.map((b, i) => (
                          <li key={i} className="flex items-start gap-2.5 text-sm text-white/70">
                            <CheckCircle size={15} className={`mt-0.5 flex-shrink-0 ${isPremium ? "text-rose-400" : "text-indigo-400"}`} />
                            <span>{b}</span>
                          </li>
                        ))}
                      </ul>

                      {p.adultOnly && (
                        <div className={`flex items-center gap-1.5 mb-4 text-[10px] ${
                          needsAdult ? "text-red-400/60" : "text-emerald-400/60"
                        }`}>
                          {needsAdult ? <Lock size={10} /> : <CheckCircle size={10} />}
                          {needsAdult ? "성인 인증 필요" : "성인 인증 완료"}
                        </div>
                      )}

                      <div className="flex items-center justify-between">
                        <div className="flex items-baseline gap-1">
                          <span className="text-2xl font-black text-white">{formatPrice(p.price)}</span>
                          <span className="text-xs text-white/30">/월</span>
                        </div>
                        {!isCurrentTier && (
                          <div className={`flex items-center gap-1 text-xs font-bold px-4 py-2 rounded-lg ${
                            isPremium
                              ? "bg-gradient-to-r from-rose-600 to-pink-600 text-white"
                              : "bg-indigo-600 text-white"
                          }`}>
                            {needsAdult ? "인증 후 구독" : "구독하기"} <ChevronRight size={14} />
                          </div>
                        )}
                      </div>
                    </button>
                  );

                  return isPremium ? (
                    <div key={p.type} className="relative">
                      {/* Premium aura effect */}
                      <motion.div
                        className="absolute -inset-1 rounded-3xl opacity-40"
                        style={{
                          background: "linear-gradient(135deg, rgba(225,29,72,0.3), rgba(168,85,247,0.3), rgba(225,29,72,0.3))",
                          filter: "blur(20px)",
                        }}
                        animate={{
                          opacity: [0.3, 0.5, 0.3],
                          scale: [1, 1.02, 1],
                        }}
                        transition={{ duration: 3, repeat: Infinity }}
                      />
                      <div className="relative rounded-2xl border border-rose-500/20 bg-gradient-to-br from-rose-900/20 via-purple-900/20 to-rose-950/20 overflow-hidden">
                        {PassCard}
                      </div>
                    </div>
                  ) : (
                    <div key={p.type}>{PassCard}</div>
                  );
                })}

                <p className="text-center text-white/20 text-xs mt-2">
                  구독은 결제일로부터 30일간 유효합니다
                </p>
              </motion.div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default LucidStore;