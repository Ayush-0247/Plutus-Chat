import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 10;

/**
 * Securely hashes a session passkey before persistent database storage.
 * The raw passkey is never persisted to the database.
 */
export async function hashPasskey(passkey) {
  if (!passkey || typeof passkey !== 'string') {
    throw new Error('Passkey is required for hashing');
  }
  const normalized = passkey.trim().toUpperCase();
  return bcrypt.hash(normalized, SALT_ROUNDS);
}

/**
 * Verifies a submitted plain-text passkey against the stored secure hash.
 */
export async function verifyPasskey(candidatePasskey, passkeyHash) {
  if (!candidatePasskey || !passkeyHash) {
    return false;
  }
  const normalized = candidatePasskey.trim().toUpperCase();
  return bcrypt.compare(normalized, passkeyHash);
}
