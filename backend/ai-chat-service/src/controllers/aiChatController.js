import AiMessage from '../models/AiMessage.js';
import { GoogleGenerativeAI } from '@google/generative-ai';

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
- SỬ DỤNG MARKDOWN để format câu trả lời: **in đậm** cho tiêu đề phụ, danh sách có đánh số cho các bước. TUYỆT ĐỐI KHÔNG SỬ DỤNG markdown code block (kí tự \` hoặc \`\`\`) dưới bất kỳ hình thức nào vì đây là giao diện tư vấn ẩm thực.
- Khi chia sẻ công thức, luôn chia thành các phần rõ ràng: **Nguyên liệu**, **Cách làm**, **Mẹo**
- Giữ câu trả lời ngắn gọn nhưng đầy đủ thông tin
- TỪ CHỐI TRẢ LỜI MỌI CÂU HỎI KHÔNG LIÊN QUAN ĐẾN ẨM THỰC. Nếu người dùng hỏi các chủ đề khác (toán học, lập trình, chính trị, giải trí, v.v.), bạn PHẢI TỪ CHỐI và nói: "Xin lỗi, mình là Bếp AI nên chỉ có thể giúp bạn các vấn đề liên quan đến ẩm thực, công thức nấu ăn và nguyên liệu thôi nhé!". Tuyệt đối không cung cấp thông tin ngoài luồng.`;

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
  const { userId, content, imageBase64, imageMimeType } = req.body;

  if (!userId || (!content?.trim() && !imageBase64)) {
    return res.status(400).json({ success: false, message: 'userId and content or image are required' });
  }

  const textContent = content?.trim() || 'Dựa vào ảnh này, hãy gợi ý cho tôi các món ăn có thể nấu.';

  if (!process.env.GEMINI_API_KEY) {
    return res.status(500).json({ success: false, message: 'GEMINI_API_KEY is not configured in .env' });
  }

  // Khởi tạo Gemini
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ 
    model: "gemini-2.5-flash",
    systemInstruction: SYSTEM_PROMPT 
  });

  // Lưu user message vào MongoDB (ghi chú [Hình ảnh] vào nội dung để lưu lịch sử)
  const savedContent = imageBase64 ? `[Đã đính kèm hình ảnh] ${textContent}` : textContent;
  const userMsg = new AiMessage({ userId, role: 'user', content: savedContent });
  await userMsg.save();

  // Lấy 10 messages gần nhất làm context (không tính message vừa gửi)
  const recentMessages = await AiMessage.find({ userId })
    .sort({ createdAt: -1 })
    .limit(10)
    .lean();

  const contextMessages = recentMessages.reverse();

  // Build history cho Gemini (Gemini dùng role 'user' và 'model')
  let geminiHistory = contextMessages.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content || ' ' }],
  }));

  // Xử lý lỗi "First content should be with role 'user', got model"
  // Gemini yêu cầu lịch sử PHẢI bắt đầu bằng 'user' và các role phải xen kẽ nhau (user -> model -> user)
  const validHistory = [];
  for (const msg of geminiHistory) {
    if (validHistory.length === 0) {
      if (msg.role === 'user') validHistory.push(msg); // Chỉ lấy nếu là user
    } else {
      if (validHistory[validHistory.length - 1].role !== msg.role) {
        validHistory.push(msg); // Xen kẽ thì push
      } else {
        // Cùng role thì gộp nội dung lại
        validHistory[validHistory.length - 1].parts[0].text += `\n${msg.parts[0].text}`;
      }
    }
  }

  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Nginx buffering off
  res.flushHeaders();

  let fullReply = '';

  try {
    const chat = model.startChat({
      history: validHistory,
    });

    // Chuẩn bị payload (chỉ text, hoặc text + hình ảnh)
    let messageParts = [textContent];
    if (imageBase64) {
      // Tự động cắt bỏ phần header "data:image/jpeg;base64," nếu frontend gửi kèm
      const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');
      messageParts.push({
        inlineData: {
          data: base64Data,
          mimeType: imageMimeType || "image/jpeg"
        }
      });
    }

    const result = await chat.sendMessageStream(messageParts);

    for await (const chunk of result.stream) {
      const chunkText = chunk.text();
      fullReply += chunkText;
      // Gửi từng token về frontend qua SSE
      res.write(`data: ${JSON.stringify({ token: chunkText })}\n\n`);
    }

    // Báo cho frontend đã xong
    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);

  } catch (error) {
    console.error('[AI-Chat] Gemini API error:', error.message);
    
    let fallbackMessage = "";
    if (!fullReply.trim()) {
      fallbackMessage = "Xin lỗi bạn, hiện tại Bếp AI đang bị quá tải lượt hỏi hoặc gặp sự cố kết nối với hệ thống. Bạn vui lòng thử lại sau ít phút nhé! 🥺";
    } else {
      fallbackMessage = "\n\n*(Xin lỗi bạn, kết nối bị ngắt quãng giữa chừng. Bạn vui lòng thử lại sau nhé!)*";
    }

    // Gửi dòng thông báo lỗi như một phần tin nhắn bình thường để UI hiển thị chuyên nghiệp
    res.write(`data: ${JSON.stringify({ token: fallbackMessage })}\n\n`);
    fullReply += fallbackMessage;

    // Báo cho frontend đã xong (để tắt trạng thái loading)
    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);

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

/**
 * POST /api/ai-chat/summarize
 * Body: { transcript: string }
 * Tóm tắt đoạn hội thoại do frontend gửi lên.
 */
export const summarizeGroupChat = async (req, res) => {
  try {
    const { transcript } = req.body;

    if (!transcript || !transcript.trim()) {
      return res.status(400).json({ success: false, message: 'Transcript is required' });
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ success: false, message: 'GEMINI_API_KEY is not configured' });
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const prompt = `Dưới đây là đoạn trích lịch sử chat nhóm:
"""
${transcript}
"""

Nhiệm vụ của bạn là:
1. Tóm tắt ngắn gọn các ý chính, quyết định, hoặc công việc được giao (nếu có).
2. Lọc bỏ các tin nhắn chào hỏi, tán gẫu không quan trọng.
3. Dùng gạch đầu dòng rõ ràng, dễ đọc.
4. KHÔNG sử dụng Markdown code block. CHỈ trả về văn bản bằng tiếng Việt thân thiện.`;

    const result = await model.generateContent(prompt);
    const summary = result.response.text();

    return res.status(200).json({
      success: true,
      data: summary
    });
  } catch (error) {
    console.error('[AI-Chat] summarizeGroupChat error:', error.message);
    return res.status(500).json({ success: false, message: 'Failed to summarize conversation' });
  }
};
