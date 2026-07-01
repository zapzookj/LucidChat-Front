import api from "./axios";

// ── QnA / 공지 ──
export const fetchFaq = () => api.get("/faq").then((r) => r.data);
export const fetchNotices = () => api.get("/notices").then((r) => r.data);

// ── CS 티켓 ──
export const createTicket = (payload) => api.post("/support/tickets", payload).then((r) => r.data);
export const fetchMyTickets = () => api.get("/support/tickets").then((r) => r.data);
export const fetchTicket = (id) => api.get(`/support/tickets/${id}`).then((r) => r.data);
export const replyTicket = (id, body) =>
  api.post(`/support/tickets/${id}/replies`, { body }).then((r) => r.data);

// 채팅 응답 신고 → 로그 컨텍스트 자동 첨부 티켓(BUG)
export const reportChat = (payload) => api.post("/support/reports", payload).then((r) => r.data);

// ── 인앱 알림 ──
export const fetchUnreadCount = () =>
  api.get("/users/me/notifications/unread-count").then((r) => r.data.count ?? 0);
export const markAllNotificationsRead = () => api.post("/users/me/notifications/read-all");
