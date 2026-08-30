import crypto from 'crypto';

const WORDS = [
    'ALPHA', 'BRAVO', 'COBALT', 'DELTA', 'ECHO', 'FALCON', 'GHOST', 'HAVEN',
    'IRON', 'JADE', 'KRYPTO', 'LUNAR', 'NEO', 'ORION', 'PRISM', 'QUANTUM',
    'RAVEN', 'SOLAR', 'TITAN', 'VORTEX', 'ZENITH'
];

export function generatePasskey() {
    const word = WORDS[crypto.randomInt(0, WORDS.length)];
    const num = crypto.randomInt(100, 999);
    return `${word}-${num}`;
}
