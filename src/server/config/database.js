import mongoose from 'mongoose';

// CRITICAL: fail fast, don't hang if database is offline
mongoose.set('bufferCommands', false);

let isConnected = false;

export async function connectDatabase() {
    const uri = process.env.MONGODB_URI;

    if (!uri) {
        console.log('[Database] MONGODB_URI not configured. Operating with server-managed metadata store.');
        return false;
    }

    try {
        await mongoose.connect(uri, {
            serverSelectionTimeoutMS: 5000,
        });
        isConnected = true;
        console.log('[Database] MongoDB connected successfully.');
        return true;
    } catch (error) {
        console.error('[Database] MongoDB connection failed. Gracefully handling database operations:', error.message);
        isConnected = false;
        return false;
    }
}

export function isDatabaseConnected() {
    return isConnected && mongoose.connection.readyState === 1;
}

export function getConnectionStatus() {
    const readyState = mongoose.connection.readyState;
    // readyState: 0=disconnected, 1=connected, 2=connecting, 3=disconnecting
    const stateMap = { 0: 'disconnected', 1: 'connected', 2: 'connecting', 3: 'disconnecting' };
    return {
        connected: readyState === 1,
        readyState,
        state: stateMap[readyState] || 'unknown',
        host: mongoose.connection.host || null,
    };
}

export { mongoose };
