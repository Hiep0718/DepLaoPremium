import mongoose from 'mongoose';

const fcmTokenSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    index: true
  },
  fcmToken: {
    type: String,
    required: true,
    unique: true
  },
  deviceInfo: {
    type: String,
    default: 'mobile'
  }
}, { timestamps: true });

const FCMToken = mongoose.model('FCMToken', fcmTokenSchema);

export default FCMToken;
