const autocannon = require('autocannon');

const SPRING_API = 'https://deplaopremium.io.vn/api';

async function runLoadTest() {
  console.log('Bắt đầu Stress Test - Mô phỏng 200 Users gửi Request đồng thời...\n');

  const instance = autocannon({
    url: `${SPRING_API}/auth/login`,
    connections: 200, // 200 CCU
    pipelining: 1,
    duration: 15, // Test trong 15 giây
    method: 'POST',
    headers: {
      'Content-type': 'application/json'
    },
    body: JSON.stringify({
      phone: '0988888888',
      password: 'wrongpassword' // Cố tình truyền sai để test tải DB
    })
  }, (err, result) => {
    if (err) {
      console.error('Lỗi khi chạy AutoCannon:', err);
      return;
    }
    
    console.log('========== KẾT QUẢ STRESS TEST (HTTP API) ==========');
    console.log(`- Thời gian test: ${result.duration} giây`);
    console.log(`- Tổng số Request gửi thành công: ${result.requests.total}`);
    console.log(`- Request / Giây (Throughput): Lớn nhất = ${result.requests.max}, Trung bình = ${result.requests.average.toFixed(2)}`);
    console.log(`- Độ trễ (Latency): Trung bình = ${result.latency.average.toFixed(2)} ms, P99 = ${result.latency.p99} ms`);
    console.log(`- Số lỗi (Timeouts/Errors): ${result.errors}`);
    console.log('====================================================\n');
  });

  // Hiển thị tiến trình
  autocannon.track(instance, { renderProgressBar: true });
}

runLoadTest();
