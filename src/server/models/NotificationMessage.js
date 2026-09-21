import mongoose from 'mongoose';

const notificationMessageSchema = new mongoose.Schema({
  senderEmail: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
    index: true,
  },
  receiverEmail: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
    index: true,
  },
  content: {
    type: String,
    required: true,
    maxlength: 5000,
  },
  viewOnce: {
    type: Boolean,
    default: false,
  },
  viewed: {
    type: Boolean,
    default: false,
  },
  viewedAt: {
    type: Date,
    default: null,
  },
  readAt: {
    type: Date,
    default: null,
  },
  expiresAt: {
    type: Date,
    default: null,
    index: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true,
  },
});

// Optimize most common query: Get messages for receiver ordered by time
notificationMessageSchema.index({ receiverEmail: 1, createdAt: -1 });

export const NotificationMessage =
  mongoose.models.NotificationMessage ||
  mongoose.model('NotificationMessage', notificationMessageSchema);
