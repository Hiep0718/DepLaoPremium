const axios = require('axios');

const SPRING_API = 'http://localhost:8082/api';
const NODE_API = 'http://localhost:3001/api/messages';

// Random phone numbers for testing
const phone1 = `09${Math.floor(10000000 + Math.random() * 90000000)}`;
const phone2 = `09${Math.floor(10000000 + Math.random() * 90000000)}`;

async function testBackend() {
  try {
    console.log('--- BẮT ĐẦU TEST BACKEND FLOW ---');

    // 1. Register User 1
    console.log(`[1] Registering User 1 (${phone1})...`);
    let res = await axios.post(`${SPRING_API}/auth/register`, {
      phone: phone1,
      password: 'password123',
      fullName: 'Test User A'
    });
    console.log('✅ User 1 Registered:', res.data.message);

    // 2. Register User 2
    console.log(`\n[2] Registering User 2 (${phone2})...`);
    res = await axios.post(`${SPRING_API}/auth/register`, {
      phone: phone2,
      password: 'password123',
      fullName: 'Test User B'
    });
    console.log('✅ User 2 Registered:', res.data.message);

    // 3. Login User 1
    console.log(`\n[3] Logging in User 1...`);
    res = await axios.post(`${SPRING_API}/auth/login`, {
      phone: phone1,
      password: 'password123'
    });
    const token1 = res.data.data.accessToken;
    let profileRes = await axios.get(`${SPRING_API}/users/profile`, { headers: { Authorization: `Bearer ${token1}` } });
    const user1Id = profileRes.data.data.id;
    console.log(`✅ Login thành công! User ID: ${user1Id}, Token: ${token1.substring(0, 15)}...`);

    // 4. Login User 2
    console.log(`\n[4] Logging in User 2...`);
    res = await axios.post(`${SPRING_API}/auth/login`, {
      phone: phone2,
      password: 'password123'
    });
    const token2 = res.data.data.accessToken;
    profileRes = await axios.get(`${SPRING_API}/users/profile`, { headers: { Authorization: `Bearer ${token2}` } });
    const user2Id = profileRes.data.data.id;
    console.log(`✅ Login thành công! User ID: ${user2Id}`);

    // 5. Create Conversation (Node.js API)
    console.log(`\n[5] Đang tạo cuộc trò chuyện trên Node.js Service (port 3001)...`);
    const newConversationId = `conv_${Math.random().toString(36).substring(2, 9)}`;
    res = await axios.post(`${NODE_API}/conversation`, {
      conversationId: newConversationId,
      participants: [user1Id, user2Id],
      isGroup: false
    }, {
      headers: { Authorization: `Bearer ${token1}` }
    });
    const conversationId = res.data.data.conversationId;
    console.log(`✅ Tạo phòng chat thành công! Conversation ID: ${conversationId}`);

    // 6. Send Message (Node.js API)
    console.log(`\n[6] Gửi thử 1 tin nhắn...`);
    res = await axios.post(`${NODE_API}/send`, {
      conversationId: conversationId,
      senderId: user1Id,
      receiverId: user2Id,
      content: 'Chào B, mình là A. API hoat dong tot roi nhe!'
    }, {
      headers: { Authorization: `Bearer ${token1}` }
    });
    console.log(`✅ Tin nhắn gửi thành công! Content: "${res.data.data.content}"`);

    // 7. Get Messages
    console.log(`\n[7] Đọc lịch sử tin nhắn...`);
    res = await axios.get(`${NODE_API}/conversation/${conversationId}?page=1&limit=10`, {
      headers: { Authorization: `Bearer ${token2}` }
    });
    const messages = res.data.data;
    console.log(`✅ Đã tải ${messages.length} tin nhắn:`);
    messages.forEach(m => console.log(`   -> [${m.senderId}]: ${m.content}`));

    console.log('\n🎉 TOÀN BỘ FLOW BACKEND (SPRING BOOT + NODEJS) ĐÃ HOẠT ĐỘNG HOÀN HẢO! 🎉');

  } catch (error) {
    console.error('\n❌ TEST FAILED!');
    if (error.response) {
      console.error(error.response.data);
    } else {
      console.error(error.message);
    }
  }
}

testBackend();
