const { io } = require('socket.io-client');

const SOCKET_URL = 'wss://deplaopremium.io.vn';
const TOTAL_CLIENTS = 100;
const DURATION_SEC = 15;

const clients = [];
let messagesSent = 0;
let connectionsEstablished = 0;

console.log(`Bắt đầu Stress Test - Mô phỏng ${TOTAL_CLIENTS} kết nối Socket đồng thời...\n`);

for (let i = 0; i < TOTAL_CLIENTS; i++) {
    const socket = io(SOCKET_URL, {
        reconnection: false,
        transports: ['websocket'],
    });

    socket.on('connect', () => {
        connectionsEstablished++;
        // Gửi ping mỗi 1 giây
        setInterval(() => {
            socket.emit('ping', { userId: `stress_user_${i}` });
            messagesSent++;
        }, 1000);
    });

    socket.on('connect_error', (err) => {
        // Lỗi kết nối
    });

    clients.push(socket);
}

// Báo cáo kết quả
setTimeout(() => {
    console.log('\n========== KẾT QUẢ STRESS TEST (WEBSOCKET) ==========');
    console.log(`- Thời gian test: ${DURATION_SEC} giây`);
    console.log(`- Số kết nối đồng thời thiết lập thành công: ${connectionsEstablished} / ${TOTAL_CLIENTS}`);
    console.log(`- Tổng số gói tin (Messages/Events) đã gửi: ${messagesSent}`);
    console.log(`- Tốc độ truyền trung bình (Events/Sec): ${(messagesSent / DURATION_SEC).toFixed(2)} events/s`);
    console.log('=====================================================\n');
    
    clients.forEach(c => c.disconnect());
    process.exit(0);
}, DURATION_SEC * 1000);
