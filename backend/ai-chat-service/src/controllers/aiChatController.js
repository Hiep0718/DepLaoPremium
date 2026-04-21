import AiMessage from '../models/AiMessage.js';

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://127.0.0.1:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'qwen2:1.5b';

/**
 * System prompt cho Bếp AI — chuyên gia ẩm thực Việt Nam
 */
const SYSTEM_PROMPT = `Bạn là "Bếp AI" - trợ lý ẩm thực thân thiện và chuyên nghiệp của người Việt Nam.

Khả năng của bạn:
- Chia sẻ công thức nấu ăn chi tiết, dễ làm tại nhà
- Gợi ý món ăn phù hợp theo nguyên liệu có sẵn
- Giải thích kỹ thuật nấu ăn (chiên, xào, hầm, hấp...)
- Giới thiệu ẩm thực vùng miền Việt Nam (Bắc, Trung, Nam) và ẩm thực thế giới
- Tư vấn dinh dưỡng và cách ăn uống lành mạnh
- Mẹo bảo quản thực phẩm và chọn nguyên liệu tươi ngon

Quy tắc trả lời:
- Luôn dùng tiếng Việt, thân thiện và dễ hiểu
- SỬ DỤNG MARKDOWN để format câu trả lời: **in đậm** cho tiêu đề phụ, danh sách có đánh số cho các bước, \`code\` cho đơn vị đo lường đặc biệt
- Khi chia sẻ công thức, luôn chia thành các phần rõ ràng: **Nguyên liệu**, **Cách làm**, **Mẹo**
- Giữ câu trả lời ngắn gọn nhưng đầy đủ thông tin
- Nếu người dùng hỏi ngoài chủ đề ẩm thực, nhẹ nhàng dẫn dắt họ quay lại chủ đề ẩm thực`;

/**
 * GET /api/ai-chat/messages/:userId
 * Lấy lịch sử chat của user (50 messages gần nhất)
 */
export const getMessages = async (req, res) => {
  try {
    const { userId } = req.params;
    const { limit = 50, page = 1 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const messages = await AiMessage.find({ userId })
      .sort({ createdAt: 1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await AiMessage.countDocuments({ userId });

    return res.status(200).json({
      success: true,
      data: messages,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error('[AI-Chat] getMessages error:', error.message);
    return res.status(500).json({ success: false, message: 'Failed to fetch messages' });
  }
};

/**
 * POST /api/ai-chat/chat
 * Body: { userId, content }
 * 
 * Gửi message tới Ollama với streaming SSE.
 * Lưu cả user message + AI reply vào MongoDB.
 */
export const streamChat = async (req, res) => {
  const { userId, content } = req.body;

  if (!userId || !content || !content.trim()) {
    return res.status(400).json({ success: false, message: 'userId and content are required' });
  }

  // Lưu user message vào MongoDB
  const userMsg = new AiMessage({ userId, role: 'user', content: content.trim() });
  await userMsg.save();

  // Lấy 10 messages gần nhất làm context (không tính message vừa lưu)
  const recentMessages = await AiMessage.find({ userId })
    .sort({ createdAt: -1 })
    .limit(11)
    .lean();

  // Đảo ngược để theo thứ tự thời gian, bỏ message vừa gửi (cái đầu tiên sau sort desc)
  const contextMessages = recentMessages.reverse().slice(0, -1);

  // Build messages array cho Ollama
  const ollamaMessages = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...contextMessages.map((m) => ({ role: m.role, content: m.content })),
    { role: 'user', content: content.trim() },
  ];

  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Nginx buffering off
  res.flushHeaders();

  let fullReply = '';

  try {
    const ollamaRes = await fetch(`${OLLAMA_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        messages: ollamaMessages,
        stream: true,
      }),
    });

    if (!ollamaRes.ok) {
      const errText = await ollamaRes.text();
      console.error('[AI-Chat] Ollama error:', errText);
      res.write(`data: ${JSON.stringify({ error: 'AI service unavailable' })}\n\n`);
      res.end();
      return;
    }

    const reader = ollamaRes.body.getReader();
    const decoder = new TextDecoder();

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n').filter((l) => l.trim());

      for (const line of lines) {
        try {
          const parsed = JSON.parse(line);
          const token = parsed?.message?.content || '';

          if (token) {
            fullReply += token;
            // Gửi từng token về frontend qua SSE
            res.write(`data: ${JSON.stringify({ token })}\n\n`);
          }

          // Ollama báo done
          if (parsed.done) {
            res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
          }
        } catch {
          // ignore parse errors for incomplete chunks
        }
      }
    }
  } catch (fetchError) {
    console.error('[AI-Chat] Fetch Ollama error:', fetchError.message);
    res.write(`data: ${JSON.stringify({ error: 'Cannot connect to Ollama. Make sure it is running.' })}\n\n`);
  } finally {
    // Lưu AI reply vào MongoDB dù có lỗi hay không (nếu có nội dung)
    if (fullReply.trim()) {
      const aiMsg = new AiMessage({ userId, role: 'assistant', content: fullReply.trim() });
      await aiMsg.save().catch((e) => console.error('[AI-Chat] Save AI reply error:', e.message));
    }
    res.end();
  }
};

/**
 * DELETE /api/ai-chat/history/:userId
 * Xóa toàn bộ lịch sử chat của user
 */
export const clearHistory = async (req, res) => {
  try {
    const { userId } = req.params;
    const result = await AiMessage.deleteMany({ userId });
    return res.status(200).json({
      success: true,
      message: `Đã xóa ${result.deletedCount} messages`,
    });
  } catch (error) {
    console.error('[AI-Chat] clearHistory error:', error.message);
    return res.status(500).json({ success: false, message: 'Failed to clear history' });
  }
};

/**
 * GET /api/ai-chat/last-message/:userId
 * Trả về message cuối cùng + có tồn tại conversation hay không
 * Dùng cho frontend để hiển thị AI conversation trong danh sách
 */
export const getLastMessage = async (req, res) => {
  try {
    const { userId } = req.params;
    const lastMsg = await AiMessage.findOne({ userId })
      .sort({ createdAt: -1 })
      .lean();

    if (!lastMsg) {
      return res.status(200).json({ success: true, exists: false, data: null });
    }

    return res.status(200).json({
      success: true,
      exists: true,
      data: {
        content: lastMsg.content,
        role: lastMsg.role,
        timestamp: lastMsg.createdAt,
      },
    });
  } catch (error) {
    console.error('[AI-Chat] getLastMessage error:', error.message);
    return res.status(500).json({ success: false, message: 'Failed to get last message' });
  }
};
