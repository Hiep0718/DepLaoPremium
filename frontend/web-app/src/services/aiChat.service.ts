/**
 * aiChat.service.ts
 * Frontend service layer cho AI Chat microservice (port 3002)
 */

const AI_BASE = '/api/ai-chat';

/** Lấy token từ sessionStorage */
const getToken = (): string | null => sessionStorage.getItem('accessToken');

const authHeaders = (): Record<string, string> => {
  const token = getToken();
  return token
    ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
    : { 'Content-Type': 'application/json' };
};

// ── Types ──────────────────────────────────────────────────────────────────

export interface AiMessage {
  _id: string;
  userId: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
}

// ── API calls ──────────────────────────────────────────────────────────────

/**
 * Lấy lịch sử chat của user
 */
export const fetchAiMessages = async (userId: string): Promise<AiMessage[]> => {
  const res = await fetch(`${AI_BASE}/messages/${userId}`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(`Failed to fetch AI messages: ${res.status}`);
  const json = await res.json();
  return json.data ?? [];
};

/**
 * Gửi message + nhận stream SSE từ AI service
 *
 * @param userId    - ID người dùng
 * @param content   - Nội dung tin nhắn
 * @param onToken   - Callback nhận từng token stream
 * @param onDone    - Callback khi stream kết thúc
 * @param onError   - Callback khi có lỗi
 */
export const streamAiChat = async (
  userId: string,
  content: string,
  onToken: (token: string) => void,
  onDone: () => void,
  onError: (msg: string) => void
): Promise<void> => {
  const res = await fetch(`${AI_BASE}/chat`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ userId, content }),
  });

  if (!res.ok || !res.body) {
    onError('Không thể kết nối đến AI. Vui lòng thử lại.');
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');

    // Xử lý tất cả dòng hoàn chỉnh, giữ lại phần dở
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) continue;

      try {
        const json = JSON.parse(trimmed.slice(5).trim());

        if (json.error) {
          onError(json.error);
          return;
        }
        if (json.token) {
          onToken(json.token);
        }
        if (json.done) {
          onDone();
          return;
        }
      } catch {
        // chunk không hoàn chỉnh, bỏ qua
      }
    }
  }

  onDone();
};

/**
 * Xóa toàn bộ lịch sử chat
 */
export const clearAiHistory = async (userId: string): Promise<void> => {
  const res = await fetch(`${AI_BASE}/history/${userId}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error('Failed to clear AI history');
};

/**
 * Lấy last message của AI chat (dùng cho conversation list)
 */
export const fetchAiLastMessage = async (
  userId: string
): Promise<{ exists: boolean; content?: string; role?: string; timestamp?: string } | null> => {
  try {
    const res = await fetch(`${AI_BASE}/last-message/${userId}`, {
      headers: authHeaders(),
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json.success ? { exists: json.exists, ...json.data } : null;
  } catch {
    return null;
  }
};
