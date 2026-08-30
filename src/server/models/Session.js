import mongoose from 'mongoose';

const sessionSchema = new mongoose.Schema({
    sessionId: {
        type: String,
        required: true,
        unique: true,
        index: true,
        uppercase: true,
        trim: true,
    },
    ownerParticipantId: {
        type: String,
        required: true,
    },
    passkeyHash: {
        type: String,
        required: true,
    },
    status: {
        type: String,
        enum: ['ACTIVE', 'ENDING', 'EXPIRED', 'DESTROYED'],
        default: 'ACTIVE',
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
    expiresAt: {
        type: Date,
        default: null,
    },
    endingReason: {
        type: String,
        default: null,
    },
});

export const Session = mongoose.models.Session || mongoose.model('Session', sessionSchema);