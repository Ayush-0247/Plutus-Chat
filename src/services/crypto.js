// Cryptographic Service for Plutus Secure Communication Line (PRD Phase 3)
// Standards: Native Web Crypto API (SubtleCrypto) - AES-256-GCM, ECDH (P-256), SHA-256, HKDF

/**
 * Convert ArrayBuffer or Uint8Array to Base64 string
 */
export function bufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

/**
 * Convert Base64 string to Uint8Array
 */
export function base64ToBuffer(base64) {
  const binary = window.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Convert ArrayBuffer to Hex string (for fingerprint display)
 */
export function bufferToHex(buffer) {
  const bytes = new Uint8Array(buffer);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Generate a high-entropy ECDH Identity Keypair for key agreement
 */
export async function generateIdentityKeyPair() {
  const keyPair = await window.crypto.subtle.generateKey(
    {
      name: 'ECDH',
      namedCurve: 'P-256',
    },
    true, // extractable
    ['deriveKey', 'deriveBits']
  );

  const exportedPublicKey = await window.crypto.subtle.exportKey('jwk', keyPair.publicKey);
  const rawPublicBuffer = await window.crypto.subtle.exportKey('raw', keyPair.publicKey);
  const fingerprint = await calculateFingerprint(rawPublicBuffer);

  return {
    keyPair,
    publicKeyJwk: exportedPublicKey,
    publicKeyString: JSON.stringify(exportedPublicKey),
    fingerprint,
  };
}

/**
 * Import a peer's public key from JWK
 */
export async function importPeerPublicKey(publicKeyJwkOrString) {
  const jwk =
    typeof publicKeyJwkOrString === 'string'
      ? JSON.parse(publicKeyJwkOrString)
      : publicKeyJwkOrString;

  return window.crypto.subtle.importKey(
    'jwk',
    jwk,
    {
      name: 'ECDH',
      namedCurve: 'P-256',
    },
    true,
    []
  );
}

/**
 * Derive a shared AES-256-GCM wrapping key using local private key and peer public key
 */
export async function deriveSharedWrappingKey(localPrivateKey, peerPublicKey) {
  return window.crypto.subtle.deriveKey(
    {
      name: 'ECDH',
      public: peerPublicKey,
    },
    localPrivateKey,
    {
      name: 'AES-GCM',
      length: 256,
    },
    false, // wrapping key does not need to be extractable
    ['encrypt', 'decrypt', 'wrapKey', 'unwrapKey']
  );
}

/**
 * Calculate SHA-256 fingerprint for public key or data
 */
export async function calculateFingerprint(buffer) {
  const hashBuffer = await window.crypto.subtle.digest('SHA-256', buffer);
  const hashHex = bufferToHex(hashBuffer);
  // Format as readable grouped hex: e.g. "a1b2:c3d4:..."
  return (
    hashHex.slice(0, 16).match(/.{1,4}/g)?.join(':').toUpperCase() ||
    hashHex.slice(0, 16).toUpperCase()
  );
}

/**
 * Calculate full SHA-256 checksum hex of an ArrayBuffer
 */
export async function calculateSha256(buffer) {
  const hashBuffer = await window.crypto.subtle.digest('SHA-256', buffer);
  return bufferToHex(hashBuffer);
}

/**
 * Generate a unique cryptographically random 256-bit AES-GCM File Key
 */
export async function generateFileKey() {
  return window.crypto.subtle.generateKey(
    {
      name: 'AES-GCM',
      length: 256,
    },
    true, // extractable so we can wrap/envelope it
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypt a File or ArrayBuffer using AES-256-GCM with a unique key and unique IV
 *
 * @param {ArrayBuffer} plaintextBuffer
 * @param {Object} options
 * @param {CryptoKey} options.fileKey (optional, will generate if omitted)
 * @param {Map<string, CryptoKey>} options.recipientSharedKeys - map of participantId -> derivedWrappingKey
 * @returns {Promise<Object>} Encrypted file package + metadata
 */
export async function encryptFileBuffer(plaintextBuffer, { recipientSharedKeys = new Map(), selfWrappingKey = null }) {
  // 1. Generate unique 256-bit AES-GCM file key
  const fileKey = await generateFileKey();

  // 2. Generate random 96-bit (12 bytes) IV
  const iv = window.crypto.getRandomValues(new Uint8Array(12));

  // 3. Encrypt file payload with AES-256-GCM (Web Crypto automatically attaches 128-bit authentication tag)
  const ciphertextBuffer = await window.crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv,
    },
    fileKey,
    plaintextBuffer
  );

  // 4. Calculate SHA-256 fingerprint of original plaintext for secondary integrity verification
  const originalSha256 = await calculateSha256(plaintextBuffer);

  // 5. Wrap / encrypt the file key for all participants
  const exportedRawFileKey = await window.crypto.subtle.exportKey('raw', fileKey);
  const keyEnvelopes = {};

  // If selfWrappingKey provided, encrypt key for sender
  if (selfWrappingKey) {
    const selfKeyIv = window.crypto.getRandomValues(new Uint8Array(12));
    const encryptedRawKey = await window.crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: selfKeyIv },
      selfWrappingKey,
      exportedRawFileKey
    );
    keyEnvelopes['_sender_self'] = {
      iv: bufferToBase64(selfKeyIv),
      encryptedKey: bufferToBase64(encryptedRawKey),
    };
  }

  // Encrypt file key for each peer using their shared derived key
  for (const [participantId, sharedKey] of recipientSharedKeys.entries()) {
    const peerKeyIv = window.crypto.getRandomValues(new Uint8Array(12));
    const encryptedRawKey = await window.crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: peerKeyIv },
      sharedKey,
      exportedRawFileKey
    );
    keyEnvelopes[participantId] = {
      iv: bufferToBase64(peerKeyIv),
      encryptedKey: bufferToBase64(encryptedRawKey),
    };
  }

  return {
    ciphertextBuffer,
    ciphertextBlob: new Blob([ciphertextBuffer], { type: 'application/octet-stream' }),
    encryptionVersion: 1,
    algorithm: 'AES-256-GCM',
    nonce: bufferToBase64(iv),
    keyEnvelopes,
    rawKeyExported: bufferToBase64(exportedRawFileKey), // in-memory for instant local use
    originalSha256,
    originalSize: plaintextBuffer.byteLength,
    encryptedSize: ciphertextBuffer.byteLength,
  };
}

/**
 * Decrypt an Encrypted File ArrayBuffer using AES-256-GCM
 *
 * @param {ArrayBuffer} ciphertextBuffer
 * @param {Object} metadata
 * @param {string} metadata.nonce - base64 string
 * @param {Object} metadata.keyEnvelopes - map of participantId -> { iv, encryptedKey }
 * @param {string} currentParticipantId
 * @param {CryptoKey} sharedWrappingKey - derived shared key or selfWrappingKey
 * @param {string} [directRawKeyBase64] - optional direct key if available locally
 * @param {string} [expectedSha256] - optional SHA-256 to verify against decrypted plaintext
 * @returns {Promise<ArrayBuffer>} Decrypted plaintext buffer
 */
export async function decryptFileBuffer({
  ciphertextBuffer,
  nonce,
  keyEnvelopes = {},
  currentParticipantId,
  sharedWrappingKey,
  directRawKeyBase64 = null,
  expectedSha256 = null,
}) {
  try {
    let rawFileKeyBuffer = null;

    if (directRawKeyBase64) {
      rawFileKeyBuffer = base64ToBuffer(directRawKeyBase64);
    } else {
      // Look up envelope for current participant or sender self
      const envelope = keyEnvelopes[currentParticipantId] || keyEnvelopes['_sender_self'];
      if (!envelope) {
        throw new Error('No encrypted key envelope found for this participant.');
      }
      if (!sharedWrappingKey) {
        throw new Error('Shared decryption key is not initialized.');
      }

      const keyIv = base64ToBuffer(envelope.iv);
      const encryptedKeyData = base64ToBuffer(envelope.encryptedKey);

      // Decrypt the raw file key
      rawFileKeyBuffer = await window.crypto.subtle.decrypt(
        {
          name: 'AES-GCM',
          iv: keyIv,
        },
        sharedWrappingKey,
        encryptedKeyData
      );
    }

    // Import the decrypted raw file key into SubtleCrypto
    const fileKey = await window.crypto.subtle.importKey(
      'raw',
      rawFileKeyBuffer,
      {
        name: 'AES-GCM',
        length: 256,
      },
      false,
      ['decrypt']
    );

    const iv = base64ToBuffer(nonce);

    // Decrypt ciphertext with AES-256-GCM (strict authentication tag verification)
    const plaintextBuffer = await window.crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv,
      },
      fileKey,
      ciphertextBuffer
    );

    // Secondary integrity check with SHA-256 if provided
    if (expectedSha256) {
      const calculatedHash = await calculateSha256(plaintextBuffer);
      if (calculatedHash.toLowerCase() !== expectedSha256.toLowerCase()) {
        throw new Error('Integrity verification failed: SHA-256 checksum mismatch.');
      }
    }

    return plaintextBuffer;
  } catch (err) {
    // Translate technical cryptographic errors into user-friendly message as per PRD Section 42
    console.error('Decryption / Integrity Verification failure:', err);
    const friendlyError = new Error('Unable to verify this file. The file may be corrupted or unavailable.');
    friendlyError.originalError = err;
    friendlyError.code = 'INTEGRITY_VERIFICATION_FAILED';
    throw friendlyError;
  }
}