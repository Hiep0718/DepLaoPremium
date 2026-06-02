import admin from 'firebase-admin';
import FCMToken from '../models/FCMToken.js';
import fs from 'fs';
import path from 'path';

// Khởi tạo Firebase Admin SDK
const initFirebaseAdmin = () => {
  try {
    const serviceAccountPath = path.resolve(process.cwd(), 'serviceAccountKey.json');
    if (fs.existsSync(serviceAccountPath)) {
      const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
      console.log('✅ Firebase Admin SDK initialized successfully');
    } else {
      console.warn('⚠️ Firebase Admin SDK config not found (serviceAccountKey.json). Push notifications will be disabled.');
    }
  } catch (error) {
    console.error('❌ Failed to initialize Firebase Admin SDK:', error);
  }
};

initFirebaseAdmin();

/**
 * Gửi Push Notification tới nhiều User (vì 1 user có thể có nhiều thiết bị)
 * @param {Array<String>} userIds Danh sách người nhận
 * @param {Object} payload Dữ liệu thông báo { title, body, data }
 */
export const sendPushNotification = async (userIds, payload) => {
  if (!admin.apps.length) return; // Nếu Firebase chưa init thì bỏ qua

  try {
    // 1. Tìm tất cả FCM Token của các user nhận
    const tokensDoc = await FCMToken.find({ userId: { $in: userIds } });
    if (!tokensDoc.length) return;

    const tokens = tokensDoc.map(doc => doc.fcmToken);

    // 2. Định dạng thông báo chuẩn FCM
    const message = {
      notification: {
        title: payload.title || 'Thông báo mới',
        body: payload.body || 'Bạn có tin nhắn mới',
      },
      data: payload.data || {}, // Data dùng cho Deep Link
      tokens: tokens,
    };

    // 3. Gửi thông báo
    const response = await admin.messaging().sendEachForMulticast(message);
    
    // 4. Xóa các token bị lỗi (user đã gỡ app hoặc logout không chuẩn)
    if (response.failureCount > 0) {
      const failedTokens = [];
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          const errorCode = resp.error?.code;
          if (errorCode === 'messaging/invalid-registration-token' ||
              errorCode === 'messaging/registration-token-not-registered') {
            failedTokens.push(tokens[idx]);
          }
        }
      });

      if (failedTokens.length > 0) {
        await FCMToken.deleteMany({ fcmToken: { $in: failedTokens } });
        console.log(`🗑️ Đã xóa ${failedTokens.length} FCM Tokens rác.`);
      }
    }
  } catch (error) {
    console.error('Lỗi gửi Push Notification:', error);
  }
};
