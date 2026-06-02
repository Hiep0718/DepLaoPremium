import FCMToken from '../models/FCMToken.js';

export const registerToken = async (req, res) => {
  try {
    const { userId, fcmToken } = req.body;

    if (!userId || !fcmToken) {
      return res.status(400).json({ success: false, message: 'Missing userId or fcmToken' });
    }

    // Cập nhật token nếu đã tồn tại, hoặc tạo mới (upsert)
    await FCMToken.findOneAndUpdate(
      { fcmToken },
      { userId, fcmToken, updatedAt: new Date() },
      { upsert: true, new: true }
    );

    res.status(200).json({ success: true, message: 'Token registered successfully' });
  } catch (error) {
    console.error('Error registering token:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const removeToken = async (req, res) => {
  try {
    const { fcmToken } = req.body;
    if (!fcmToken) {
      return res.status(400).json({ success: false, message: 'Missing fcmToken' });
    }

    await FCMToken.deleteOne({ fcmToken });
    res.status(200).json({ success: true, message: 'Token removed successfully' });
  } catch (error) {
    console.error('Error removing token:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
