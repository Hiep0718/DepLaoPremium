import axios from 'axios';
import { io } from 'socket.io-client';

const SPRING_API = 'http://localhost:8082/api';
const NODE_API = 'http://localhost:3001/api/messages';
const SOCKET_URL = 'ws://localhost:3001';

async function delay(ms) {
    return new Promise(res => setTimeout(res, ms));
}

async function runChatTest() {
    console.log("==========================================");
    console.log("BẮT ĐẦU KIỂM THỬ: SOCKET.IO CHAT REAL-TIME");
    console.log("==========================================\n");

    try {
        // 1. Dùng 2 tài khoản đã tạo trước đó để Login
        console.log(">> Đăng nhập User A (0957363843)...");
        let resA = await axios.post(`${SPRING_API}/auth/login`, {
            phone: '0957363843',
            password: 'password 123'
        });
        const tokenA = resA.data.data.accessToken;
        let profileA = await axios.get(`${SPRING_API}/users/profile`, { headers: { Authorization: `Bearer ${tokenA}` } });
        const userA_Id = profileA.data.data.id;
        const userA_Name = profileA.data.data.fullName;
        console.log(`[+] User A Đăng nhập thành công: ID=${userA_Id}, Name=${userA_Name}`);

        console.log(">> Đăng nhập User B (0799975339)...");
        let resB;
        try {
            resB = await axios.post(`${SPRING_API}/auth/login`, {
                phone: '0799975339',
                password: '123456'
            });
        } catch(e) {
            // Nếu Acc B bị lỗi, tạo Acc mới
            console.log("Acc B lỗi, sẽ đăng ký Acc Test (0988888888)...");
            await axios.post(`${SPRING_API}/auth/register`, { phone: '0988888888', fullName: 'Tester B', password: 'password' }).catch(()=>null);
            resB = await axios.post(`${SPRING_API}/auth/login`, { phone: '0988888888', password: 'password' });
        }
        const tokenB = resB.data.data.accessToken;
        let profileB = await axios.get(`${SPRING_API}/users/profile`, { headers: { Authorization: `Bearer ${tokenB}` } });
        const userB_Id = profileB.data.data.id;
        const userB_Name = profileB.data.data.fullName;
        console.log(`[+] User B Đăng nhập thành công: ID=${userB_Id}, Name=${userB_Name}\n`);

        // 2. Tạo Phòng Chat trên Nodejs
        const fakeConvId = `conv_11_${Math.random().toString(36).substring(2,7)}`;
        console.log(">> Tạo phòng Chat 1-1 giữa A và B...");
        await axios.post(`${NODE_API}/conversation`, {
            conversationId: fakeConvId,
            participants: [userA_Id, userB_Id],
            isGroup: false
        }, { headers: { Authorization: `Bearer ${tokenA}` }});
        console.log(`[+] Đã lên Node.js tạo phòng Chat, ID = ${fakeConvId}\n`);

        // 3. Kết nối Socket
        console.log(">> Khởi tạo kết nối Socket.IO tới Server (Port 3001)...");
        const socketA = io(SOCKET_URL);
        const socketB = io(SOCKET_URL);

        // Đợi socket nảy event connect
        await delay(1000);

        socketA.emit('user_join', userA_Id.toString());
        socketB.emit('user_join', userB_Id.toString());
        console.log("[+] User A và User B đã join Socket thành công.\n");

        // 4. Lắng nghe Event Nhận Tin B
        socketB.on('message_received', (data) => {
            console.log(`[SOCKET B LẮNG NGHE] 🔔 User B (${userB_Name}) Vừa nhận được tin nhắn CHỚP NHOÁNG:`);
            console.log(`   Nội dung: "${data.text}"`);
            console.log(`   Thời gian quét: ${data.timestamp}\n`);
            
            // Tự động báo đã xem
            console.log(`>> User B báo lại là "Đã xem" (mark_as_seen)...`);
            socketB.emit('mark_as_seen', {
                messageId: data.messageId,
                conversationId: data.conversationId,
                userId: userB_Id.toString()
            });
        });

        // Event Đã xem của A
        socketA.on('message_seen', (data) => {
            console.log(`[SOCKET A LẮNG NGHE] 👀 Server báo: Người dùng ${data.seenBy} đã XEM tin nhắn!\n`);
        });

        // 5. User A Gửi tin 
        console.log(`>> User A (${userA_Name}) bắt đầu gõ Text (Typing)...`);
        socketA.emit('typing', { conversationId: fakeConvId, userId: userA_Id.toString(), isTyping: true });
        
        // Listener Typing B
        socketB.on('user_typing', (data) => {
            if(data.isTyping) {
                 console.log(`[SOCKET B LẮNG NGHE] 💬 Thấy User A đang gõ tin nhắn...\n`);
            }
        });

        await delay(2000);
        
        const textMessage = "Xin chào B, tớ đang test tính năng Chat Realtime bằng Socket.IO của Zalo Clone!";
        console.log(`>> User A (${userA_Name}) nhấn nút Gửi (send_message): "${textMessage}"`);
        
        socketA.emit('typing', { conversationId: fakeConvId, userId: userA_Id.toString(), isTyping: false });
        socketA.emit('send_message', {
            conversationId: fakeConvId,
            senderId: userA_Id.toString(),
            recipientId: userB_Id.toString(),
            text: textMessage
        });

        // Chờ Socket nảy sự kiện khoảng 2s
        await delay(3000);

        console.log("==========================================");
        console.log("KIỂM THỬ HOÀN TẤT - LUỒNG SOCKET.IO MƯỢT MÀ!");
        
        process.exit();

    } catch (e) {
        console.log("Lỗi Chi tiết:");
        if (e.response) {
            console.log(e.response.data);
        } else {
            console.log(e.message);
        }
        process.exit();
    }
}

runChatTest();
