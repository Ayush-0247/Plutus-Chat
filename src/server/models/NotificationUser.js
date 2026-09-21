import mongoose from 'mongoose';

const notificationUserSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    index: true,
    lowercase: true,
    trim: true,
  },
  passkeyHash: {
    type: String,
    required: true,
  },
  channelEnabled: {
    type: Boolean,
    default: false,
  },
  lastAuthenticatedAt: {
    type: Date,
    default: null,
  },
  channelCreatedAt: {
    type: Date,
    default: null,
  },
  channelDisabledAt: {
    type: Date,
    default: null,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

export const NotificationUser =
  mongoose.models.NotificationUser || mongoose.model('NotificationUser', notificationUserSchema);
