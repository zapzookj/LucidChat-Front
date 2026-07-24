import { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, LifeBuoy, HelpCircle, MessageSquarePlus, Inbox, Bell,
  Search, ChevronDown, ChevronLeft, Send, MessageCircle, Bug, Lightbulb, HelpCircle as HelpIcon,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { sfx } from "../utils/sfx";
import {
  fetchFaq, createTicket, fetchMyTickets, fetchTicket, replyTicket,
  fetchNotifications, markAllNotificationsRead,
} from "../api/SupportApi";

/**
 * 도움말 / 문의 통합 창구 (Phase 6).
 *
 * 기존 LucidStore/SettingsModal 과 동일한 모달 디자인 언어(그라디언트 셸 · layoutId 탭 · sfx)로
 * 앱 분위기를 맞춘다. 3탭: QnA(FAQ) / 문의하기 / 내 문의(답변 확인).
 */

const TABS = [
  { key: "notify", label: "알림", icon: Bell },
  { key: "qna", label: "QnA", icon: HelpCircle },
  { key: "inquiry", label: "문의하기", icon: MessageSquarePlus },
  { key: "mine", label: "내 문의", icon: Inbox },
];

const INQUIRY_TYPES = [
  { key: "INQUIRY", label: "문의", icon: MessageCircle },
  { key: "FEEDBACK", label: "피드백", icon: Lightbulb },
  { key: "BUG", label: "버그 신고", icon: Bug },
];

const TICKET_STATUS = {
  OPEN: { label: "접수", cls: "bg-amber-500/15 text-amber-300" },
  IN_PROGRESS: { label: "처리 중", cls: "bg-sky-500/15 text-sky-300" },
  RESOLVED: { label: "완료", cls: "bg-emerald-500/15 text-emerald-300" },
};
const TICKET_TYPE = { INQUIRY: "문의", FEEDBACK: "피드백", BUG: "버그" };

const StatusChip = ({ status }) => {
  const s = TICKET_STATUS[status] || { label: status, cls: "bg-white/5 text-white/50" };
  return <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${s.cls}`}>{s.label}</span>;
};

// ─────────────────────────────────────────────
//  QnA (FAQ) 탭
// ─────────────────────────────────────────────
function QnaTab() {
  const [faq, setFaq] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState(null);

  useEffect(() => {
    fetchFaq().then(setFaq).catch(() => setFaq([])).finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return faq;
    return faq.filter(
      (f) => f.question.toLowerCase().includes(q) || f.answer.toLowerCase().includes(q) || f.category.toLowerCase().includes(q)
    );
  }, [faq, query]);

  const grouped = useMemo(() => {
    const map = new Map();
    filtered.forEach((f) => {
      if (!map.has(f.category)) map.set(f.category, []);
      map.get(f.category).push(f);
    });
    return [...map.entries()];
  }, [filtered]);

  return (
    <div>
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" size={15} />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="궁금한 점을 검색하세요"
          className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-sm text-white placeholder-white/30 outline-none focus:border-purple-400/40 transition-colors"
        />
      </div>

      {loading ? (
        <div className="text-center text-white/30 text-sm py-10">불러오는 중…</div>
      ) : grouped.length === 0 ? (
        <div className="text-center text-white/30 text-sm py-10">검색 결과가 없습니다.</div>
      ) : (
        <div className="space-y-5">
          {grouped.map(([category, items]) => (
            <div key={category}>
              <div className="text-[11px] font-bold uppercase tracking-widest text-purple-300/60 mb-2">{category}</div>
              <div className="space-y-1.5">
                {items.map((f) => {
                  const isOpen = openId === f.id;
                  return (
                    <div key={f.id} className="rounded-xl border border-white/10 bg-white/[0.02] overflow-hidden">
                      <button
                        onClick={() => { sfx.click(); setOpenId(isOpen ? null : f.id); }}
                        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-white/[0.03] transition-colors"
                      >
                        <span className="text-sm text-white/90">{f.question}</span>
                        <ChevronDown
                          size={16}
                          className={`text-white/30 flex-shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`}
                        />
                      </button>
                      <AnimatePresence initial={false}>
                        {isOpen && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                          >
                            <div className="px-4 pb-4 pt-0.5 text-sm text-white/55 leading-relaxed whitespace-pre-wrap">
                              {f.answer}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
//  문의하기 탭
// ─────────────────────────────────────────────
function InquiryTab({ onSubmitted }) {
  const [type, setType] = useState("INQUIRY");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    if (!subject.trim() || !body.trim()) return;
    setBusy(true); setError("");
    try {
      await createTicket({ type, subject: subject.trim(), body: body.trim() });
      sfx.chime();
      setSubject(""); setBody(""); setType("INQUIRY");
      onSubmitted?.();
    } catch (e) {
      sfx.thud();
      setError(e.response?.data?.message || "제출에 실패했습니다. 잠시 후 다시 시도해주세요.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="text-[11px] uppercase tracking-widest text-white/40 mb-2 block">유형</label>
        <div className="flex gap-2">
          {INQUIRY_TYPES.map((t) => {
            const Icon = t.icon;
            const active = type === t.key;
            return (
              <button
                key={t.key}
                onClick={() => { sfx.click(); setType(t.key); }}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                  active
                    ? "border-purple-400/50 bg-purple-500/10 text-white"
                    : "border-white/10 bg-white/[0.02] text-white/45 hover:text-white/70"
                }`}
              >
                <Icon size={15} /> {t.label}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <label className="text-[11px] uppercase tracking-widest text-white/40 mb-2 block">제목</label>
        <input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          maxLength={200}
          placeholder="한 줄로 요약해주세요"
          className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-sm text-white placeholder-white/30 outline-none focus:border-purple-400/40 transition-colors"
        />
      </div>

      <div>
        <label className="text-[11px] uppercase tracking-widest text-white/40 mb-2 block">내용</label>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={6}
          placeholder="자세한 내용을 알려주시면 더 빠르게 도와드릴 수 있어요."
          className="w-full px-3.5 py-3 rounded-xl bg-white/[0.04] border border-white/10 text-sm text-white placeholder-white/30 outline-none focus:border-purple-400/40 transition-colors resize-none"
        />
      </div>

      {error && <div className="text-sm text-rose-400">{error}</div>}

      <p className="text-[11px] text-white/25 leading-relaxed">
        원활한 응대를 위해 계정 정보(에너지·구독·인증 상태)가 함께 전달됩니다.
        답변은 <span className="text-white/40">내 문의</span> 탭과 알림으로 확인할 수 있어요.
      </p>

      <button
        onClick={submit}
        disabled={busy || !subject.trim() || !body.trim()}
        className="w-full py-3 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold text-sm transition-all"
      >
        {busy ? "제출 중…" : "문의 보내기"}
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────
//  내 문의 탭 (목록 + 상세/스레드)
// ─────────────────────────────────────────────
function MineTab() {
  const [tickets, setTickets] = useState(null);
  const [selected, setSelected] = useState(null);
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);

  const loadList = useCallback(async () => {
    try { setTickets(await fetchMyTickets()); } catch { setTickets([]); }
  }, []);

  useEffect(() => { loadList(); }, [loadList]);

  const openTicket = async (id) => {
    sfx.pageTurn();
    try { setSelected(await fetchTicket(id)); } catch { /* ignore */ }
  };

  const sendReply = async () => {
    if (!reply.trim()) return;
    setBusy(true);
    try {
      const updated = await replyTicket(selected.id, reply.trim());
      setSelected(updated);
      setReply("");
      loadList();
    } catch { sfx.thud(); } finally { setBusy(false); }
  };

  // ── 상세 ──
  if (selected) {
    return (
      <div>
        <button
          onClick={() => { sfx.click(); setSelected(null); loadList(); }}
          className="flex items-center gap-1.5 text-sm text-white/50 hover:text-white mb-4"
        >
          <ChevronLeft size={16} /> 목록
        </button>

        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 mb-3">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[11px] px-2 py-0.5 rounded bg-white/5 text-white/50">{TICKET_TYPE[selected.type] || selected.type}</span>
            <StatusChip status={selected.status} />
          </div>
          <h4 className="text-white font-semibold mb-2">{selected.subject}</h4>
          <p className="text-sm text-white/55 whitespace-pre-wrap">{selected.body}</p>
        </div>

        {/* 스레드 */}
        <div className="space-y-2 mb-3">
          {selected.replies?.map((r) => (
            <div
              key={r.id}
              className={`rounded-xl border p-3 ${
                r.authorType === "ADMIN"
                  ? "border-purple-400/20 bg-purple-500/[0.07] ml-5"
                  : "border-white/10 bg-white/[0.02] mr-5"
              }`}
            >
              <div className="text-[11px] text-white/35 mb-1">
                {r.authorType === "ADMIN" ? "운영팀" : "나"} · {r.createdAt?.replace("T", " ").slice(5, 16)}
              </div>
              <p className="text-sm text-white/80 whitespace-pre-wrap">{r.body}</p>
            </div>
          ))}
        </div>

        {selected.status !== "RESOLVED" && (
          <div className="flex gap-2">
            <input
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendReply()}
              placeholder="답변에 이어서 문의하기"
              className="flex-1 px-3.5 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-sm text-white placeholder-white/30 outline-none focus:border-purple-400/40"
            />
            <button
              onClick={sendReply}
              disabled={busy || !reply.trim()}
              className="px-4 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white transition-colors"
            >
              <Send size={16} />
            </button>
          </div>
        )}
      </div>
    );
  }

  // ── 목록 ──
  return (
    <div>
      {tickets === null ? (
        <div className="text-center text-white/30 text-sm py-10">불러오는 중…</div>
      ) : tickets.length === 0 ? (
        <div className="flex flex-col items-center text-center py-12">
          <Inbox size={32} className="text-white/20 mb-3" />
          <p className="text-white/40 text-sm">아직 문의 내역이 없어요.</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {tickets.map((t) => (
            <button
              key={t.id}
              onClick={() => openTicket(t.id)}
              className="w-full text-left rounded-xl border border-white/10 bg-white/[0.02] hover:bg-white/[0.04] px-4 py-3 transition-colors"
            >
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="text-sm text-white/85 truncate">{t.subject}</span>
                <StatusChip status={t.status} />
              </div>
              <div className="text-[11px] text-white/35">
                {TICKET_TYPE[t.type] || t.type} · {t.updatedAt?.replace("T", " ").slice(0, 16)}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
//  알림 탭 (인앱 알림 목록 + 딥링크)
// ─────────────────────────────────────────────
function NotificationsTab({ onClose, onGoTickets, onSeen }) {
  const [items, setItems] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    let alive = true;
    fetchNotifications(0, 30)
      .then((page) => {
        if (!alive) return;
        setItems(page?.content ?? []);
        // 목록을 본 시점에 읽음 처리 → 도움말 배지 클리어. 미읽음 하이라이트는 이 스냅샷 기준 유지.
        markAllNotificationsRead().then(() => onSeen?.()).catch(() => {});
      })
      .catch(() => { if (alive) setItems([]); });
    return () => { alive = false; };
  }, [onSeen]);

  const clickableTypes = ["TICKET", "UGC_CHARACTER", "UGC_WORLD"];
  const handleClick = (n) => {
    if (!clickableTypes.includes(n.linkType)) return;
    sfx.click();
    if (n.linkType === "TICKET") { onGoTickets?.(); return; }
    onClose?.();
    if (n.linkType === "UGC_CHARACTER") navigate("/studio");
    else if (n.linkType === "UGC_WORLD") navigate("/studio/world");
  };

  if (items === null) {
    return <div className="text-center text-white/30 text-sm py-10">불러오는 중…</div>;
  }
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center text-center py-12">
        <Bell size={32} className="text-white/20 mb-3" />
        <p className="text-white/40 text-sm">새로운 알림이 없어요.</p>
      </div>
    );
  }
  return (
    <div className="space-y-1.5">
      {items.map((n) => {
        const clickable = clickableTypes.includes(n.linkType);
        return (
          <button
            key={n.id}
            onClick={() => handleClick(n)}
            className={`w-full text-left rounded-xl border px-4 py-3 transition-colors ${
              n.read ? "border-white/10 bg-white/[0.02]" : "border-purple-400/25 bg-purple-500/[0.06]"
            } ${clickable ? "hover:bg-white/[0.05] cursor-pointer" : "cursor-default"}`}
          >
            <div className="flex items-center gap-2 mb-1">
              {!n.read && <span className="w-1.5 h-1.5 rounded-full bg-rose-400 flex-shrink-0" />}
              <span className="text-sm text-white/90 font-medium truncate">{n.title}</span>
            </div>
            {n.body && (
              <p className="text-[13px] text-white/55 leading-relaxed whitespace-pre-wrap">{n.body}</p>
            )}
            <div className="text-[11px] text-white/30 mt-1">
              {n.createdAt?.replace("T", " ").slice(0, 16)}
            </div>
          </button>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────
//  Panel Shell
// ─────────────────────────────────────────────
export default function SupportPanel({ open, onClose, onSeen, initialTab = "qna" }) {
  const [activeTab, setActiveTab] = useState(initialTab);

  useEffect(() => {
    if (open) {
      sfx.wooshLight();
      setActiveTab(initialTab);
    }
  }, [open, initialTab]);

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[200] flex items-center justify-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <motion.div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

        <motion.div
          className="relative z-10 w-[95vw] max-w-xl max-h-[88vh] overflow-hidden rounded-3xl border border-white/10 flex flex-col"
          style={{
            background: "linear-gradient(160deg, rgba(15,10,35,0.98) 0%, rgba(30,15,55,0.97) 50%, rgba(20,10,40,0.98) 100%)",
            boxShadow: "0 40px 80px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.05)",
          }}
          initial={{ scale: 0.92, y: 30, opacity: 0 }}
          animate={{ scale: 1, y: 0, opacity: 1 }}
          exit={{ scale: 0.92, y: 30, opacity: 0 }}
          transition={{ type: "spring", stiffness: 260, damping: 24 }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 pt-5 pb-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-lg">
                <LifeBuoy size={18} className="text-white" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white tracking-wide">도움말 · 문의</h2>
                <p className="text-[11px] text-white/30 tracking-widest uppercase">Help &amp; Support</p>
              </div>
            </div>
            <button
              onClick={() => { sfx.click(); onClose?.(); }}
              className="w-8 h-8 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 text-white/40 hover:text-white transition"
            >
              <X size={16} />
            </button>
          </div>

          {/* Tabs */}
          <div className="px-6 mb-4">
            <div className="flex gap-1 bg-white/[0.03] rounded-xl p-1 border border-white/5">
              {TABS.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.key;
                return (
                  <button
                    key={tab.key}
                    onClick={() => { sfx.click(); setActiveTab(tab.key); }}
                    className={`relative flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                      isActive ? "text-white" : "text-white/40 hover:text-white/60"
                    }`}
                  >
                    {isActive && (
                      <motion.div
                        layoutId="support-tab-bg"
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

          {/* Content */}
          <div className="px-6 pb-6 overflow-y-auto custom-scrollbar">
            {activeTab === "notify" && (
              <NotificationsTab
                onClose={onClose}
                onGoTickets={() => setActiveTab("mine")}
                onSeen={onSeen}
              />
            )}
            {activeTab === "qna" && <QnaTab />}
            {activeTab === "inquiry" && <InquiryTab onSubmitted={() => setActiveTab("mine")} />}
            {activeTab === "mine" && <MineTab />}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
