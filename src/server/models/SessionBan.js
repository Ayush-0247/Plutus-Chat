import mongoose from 'mongoose';

const sessionBanSchema = new mongoose.Schema({
    sessionId: {
        type: String,
        required: true,
        index: true,
        uppercase: true,
        trim: true,
    },
    participantId: {
        type: String,
        required: true,
    },
    bannedAt: {
        type: Date,
        default: Date.now,
    },
});

// Composite index to quickly check if a participant is banned in a session
sessionBanSchema.index({ sessionId: 1, participantId: 1 }, { unique: true });

export const SessionBan = mongoose.models.SessionBan || mongoose.model('SessionBan', sessionBanSchema);
