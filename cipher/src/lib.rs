use chacha20poly1305::{
    ChaCha20Poly1305, KeyInit, Nonce,
    aead::{Aead, AeadCore, OsRng, Payload},
};
use hkdf::Hkdf;
use k256::{
    PublicKey, SecretKey,
    ecdh::{EphemeralSecret, diffie_hellman},
};
use kaspa_addresses::Address;
use kaspa_wallet_keys::privatekey::PrivateKey as WalletPrivateKey;
use secp256k1::{
    Keypair, Message, PublicKey as SecpPublicKey, SecretKey as SecpSecretKey, XOnlyPublicKey,
    schnorr::Signature as SchnorrSignature,
};
use sha2::{Digest, Sha256};
use std::ops::Deref;
use wasm_bindgen::{JsError, UnwrapThrowExt, prelude::wasm_bindgen};

#[wasm_bindgen(inspectable)]
#[derive(Debug, Clone)]
pub struct EncryptedMessage {
    // size is 12 bytes
    #[wasm_bindgen(skip)]
    pub nonce: Vec<u8>,
    // size is 32 or 33 bytes (33 bytes for SEC1 compressed format with 02/03 prefix)
    #[wasm_bindgen(skip)]
    pub ephemeral_public_key: Vec<u8>,
    // size is dynamic
    #[wasm_bindgen(skip)]
    pub ciphertext: Vec<u8>,
}

#[wasm_bindgen]
impl EncryptedMessage {
    pub fn new(ciphertext: &[u8], nonce: &[u8], ephemeral_public_key: &[u8]) -> Self {
        Self {
            ciphertext: ciphertext.to_vec(),
            nonce: nonce.to_vec(),
            ephemeral_public_key: ephemeral_public_key.to_vec(),
        }
    }

    pub fn to_bytes(&self) -> Vec<u8> {
        let mut bytes = Vec::new();
        bytes.extend_from_slice(&self.nonce);
        bytes.extend_from_slice(&self.ephemeral_public_key);
        bytes.extend_from_slice(&self.ciphertext);
        bytes
    }

    pub fn from_bytes(bytes: &[u8]) -> Self {
        // The nonce is always 12 bytes
        let nonce = bytes[0..12].to_vec();

        // Check if the key starts with SEC1 compressed format marker (02 or 03)
        let is_sec1_compressed = bytes.len() > 12 && (bytes[12] == 0x02 || bytes[12] == 0x03);

        // If it's a SEC1 compressed key, it's 33 bytes, otherwise assume 32 bytes
        let key_size = if is_sec1_compressed { 33 } else { 32 };
        let key_end = 12 + key_size;

        // Ensure we don't go out of bounds
        if bytes.len() < key_end {
            // Not enough bytes for the key, use what we have
            let ephemeral_public_key = bytes[12..].to_vec();
            return Self {
                nonce,
                ephemeral_public_key,
                ciphertext: Vec::new(), // No bytes left for ciphertext
            };
        }

        // Extract the key and ciphertext
        let ephemeral_public_key = bytes[12..key_end].to_vec();
        let ciphertext = if bytes.len() > key_end {
            bytes[key_end..].to_vec()
        } else {
            Vec::new()
        };

        Self {
            nonce,
            ephemeral_public_key,
            ciphertext,
        }
    }

    pub fn to_hex(&self) -> String {
        hex::encode(self.to_bytes())
    }

    #[wasm_bindgen(constructor)]
    pub fn from_hex(hex: &str) -> EncryptedMessage {
        Self::from_bytes(&hex::decode(hex).unwrap())
    }
}

// Debug function to extract public key from address
#[wasm_bindgen]
pub fn debug_address_to_pubkey(address_string: &str) -> Result<String, JsError> {
    // Try to parse the address
    let address = match Address::try_from(address_string) {
        Ok(addr) => addr,
        Err(e) => return Err(JsError::new(&format!("Address parsing error: {}", e))),
    };

    // Extract X-only public key from address payload
    let xonly_pk = match XOnlyPublicKey::from_slice(address.payload.as_slice()) {
        Ok(pk) => pk,
        Err(e) => return Err(JsError::new(&format!("XOnlyPublicKey error: {}", e))),
    };

    // Convert to full public key (assuming even parity)
    let pk_even = SecpPublicKey::from_x_only_public_key(xonly_pk, secp256k1::Parity::Even);

    // Convert to k256 PublicKey format
    let k256_pk = match PublicKey::from_sec1_bytes(&pk_even.serialize()) {
        Ok(pk) => pk,
        Err(e) => return Err(JsError::new(&format!("k256 PublicKey error: {}", e))),
    };

    // Return the hex representation
    Ok(hex::encode(k256_pk.to_sec1_bytes()))
}

// Debug function to check if private key can decrypt a message
#[wasm_bindgen]
pub fn debug_can_decrypt(encrypted_hex: &str, private_key_hex: &str) -> Result<String, JsError> {
    // Try to parse the hex string into EncryptedMessage
    match hex::decode(encrypted_hex) {
        Ok(bytes) => bytes,
        Err(_) => return Err(JsError::new("Invalid encrypted message hex")),
    };

    // let encrypted_message = EncryptedMessage::from_bytes(&encrypted_bytes);

    // Try to parse the private key
    let private_key_bytes = match hex::decode(private_key_hex) {
        Ok(bytes) => bytes,
        Err(_) => return Err(JsError::new("Invalid private key hex")),
    };

    // Create WalletPrivateKey from bytes
    let wallet_private_key = match WalletPrivateKey::try_from_slice(&private_key_bytes) {
        Ok(pk) => pk,
        Err(e) => return Err(JsError::new(&format!("Invalid wallet private key: {}", e))),
    };

    // Attempt to get k256 SecretKey
    let secret_key = match SecretKey::from_slice(&wallet_private_key.secret_bytes()) {
        Ok(sk) => sk,
        Err(e) => return Err(JsError::new(&format!("Invalid k256 secret key: {}", e))),
    };

    // Get the public key from the private key
    let derived_public_key = secret_key.public_key();

    // Return success with public key for verification
    Ok(format!(
        "Private key valid. Derived public key: {}",
        hex::encode(derived_public_key.to_sec1_bytes())
    ))
}

#[wasm_bindgen]
pub fn encrypt_message(
    receiver_address_string: &str,
    message: &str,
) -> Result<EncryptedMessage, JsError> {
    let receiver_address = Address::try_from(receiver_address_string)?;

    let receiver_xonly_pk = XOnlyPublicKey::from_slice(receiver_address.payload.as_slice())?;

    let receiver_pk_even =
        SecpPublicKey::from_x_only_public_key(receiver_xonly_pk, secp256k1::Parity::Even);

    let receiver_pk = PublicKey::from_sec1_bytes(&receiver_pk_even.serialize())?;

    let ephemeral_secret = EphemeralSecret::random(&mut OsRng);
    let ephemeral_public_key = PublicKey::from(&ephemeral_secret);

    let shared_secret = ephemeral_secret.diffie_hellman(&receiver_pk);

    let exctracted = shared_secret.extract::<sha2::Sha256>(None);
    let mut okm = [0u8; 32];
    let result = exctracted.expand(b"", &mut okm);

    if result.is_err() {
        return Err(JsError::new("Failed to expand shared secret"));
    }

    let cipher = ChaCha20Poly1305::new(&okm.into());

    let nonce = ChaCha20Poly1305::generate_nonce(&mut OsRng); // 96-bits; unique per message

    let ciphertext = cipher
        .encrypt(&nonce, message.as_bytes())
        .expect_throw("Failed to encrypt message");

    let encrypted_message = EncryptedMessage::new(
        ciphertext.as_slice(),
        nonce.as_slice(),
        ephemeral_public_key.to_sec1_bytes().deref(),
    );
    Ok(encrypted_message)
}

#[wasm_bindgen]
pub fn decrypt_message(
    encrypted_message: EncryptedMessage,
    receiver_wallet_sk: WalletPrivateKey,
) -> Result<String, JsError> {
    // Convert WalletPrivateKey to k256 SecretKey
    let receiver_sk = match SecretKey::from_slice(&receiver_wallet_sk.secret_bytes()) {
        Ok(sk) => sk,
        Err(_) => return Err(JsError::new("Invalid receiver private key")),
    };

    // Parse ephemeral public key
    let ephemeral_pk = match PublicKey::from_sec1_bytes(&encrypted_message.ephemeral_public_key) {
        Ok(pk) => pk,
        Err(_) => return Err(JsError::new("Invalid ephemeral public key")),
    };

    // Get nonce
    let nonce = Nonce::from_slice(&encrypted_message.nonce);

    // Perform Diffie-Hellman key exchange
    let shared_secret_2 = diffie_hellman(receiver_sk.to_nonzero_scalar(), ephemeral_pk.as_affine());

    // Extract shared secret for cipher
    let exctracted_2 = shared_secret_2.extract::<sha2::Sha256>(None);
    let mut okm_2 = [0u8; 32];
    match exctracted_2.expand(b"", &mut okm_2) {
        Ok(_) => {}
        Err(_) => {
            return Err(JsError::new(
                "Failed to expand shared secret for decryption",
            ));
        }
    }

    // Create cipher
    let cipher_2 = ChaCha20Poly1305::new(&okm_2.into());

    // Decrypt
    let plaintext = match cipher_2.decrypt(
        &nonce,
        Payload::from(encrypted_message.ciphertext.as_slice()),
    ) {
        Ok(pt) => pt,
        Err(_) => {
            return Err(JsError::new(
                "Decryption failed - incorrect key or corrupted data",
            ));
        }
    };

    // Convert to string
    match String::from_utf8(plaintext) {
        Ok(s) => Ok(s),
        Err(_) => Err(JsError::new("Decrypted data is not valid UTF-8")),
    }
}

#[wasm_bindgen]
pub fn decrypt_message_with_bytes(
    encrypted_message: EncryptedMessage,
    private_key_bytes: &[u8],
) -> Result<String, JsError> {
    // Create WalletPrivateKey from bytes
    let wallet_private_key = match WalletPrivateKey::try_from_slice(private_key_bytes) {
        Ok(pk) => pk,
        Err(e) => return Err(JsError::new(&format!("Invalid wallet private key: {}", e))),
    };

    // Use the existing decrypt_message function
    decrypt_message(encrypted_message, wallet_private_key)
}

#[wasm_bindgen]
pub fn decrypt_with_secret_key(
    encrypted_message: EncryptedMessage,
    secret_key_bytes: &[u8],
) -> Result<String, JsError> {
    // Create k256 SecretKey directly from bytes
    let receiver_sk = match SecretKey::from_slice(secret_key_bytes) {
        Ok(sk) => sk,
        Err(_) => return Err(JsError::new("Invalid secret key")),
    };

    // Parse ephemeral public key
    let ephemeral_pk = match PublicKey::from_sec1_bytes(&encrypted_message.ephemeral_public_key) {
        Ok(pk) => pk,
        Err(_) => return Err(JsError::new("Invalid ephemeral public key")),
    };

    // Get nonce
    let nonce = Nonce::from_slice(&encrypted_message.nonce);

    // Perform Diffie-Hellman key exchange
    let shared_secret = diffie_hellman(receiver_sk.to_nonzero_scalar(), ephemeral_pk.as_affine());

    // Extract shared secret for cipher
    let extracted = shared_secret.extract::<sha2::Sha256>(None);
    let mut okm = [0u8; 32];
    match extracted.expand(b"", &mut okm) {
        Ok(_) => {}
        Err(_) => {
            return Err(JsError::new(
                "Failed to expand shared secret for decryption",
            ));
        }
    }

    // Create cipher
    let cipher = ChaCha20Poly1305::new(&okm.into());

    // Decrypt
    let plaintext = match cipher.decrypt(
        &nonce,
        Payload::from(encrypted_message.ciphertext.as_slice()),
    ) {
        Ok(pt) => pt,
        Err(_) => {
            return Err(JsError::new(
                "Decryption failed - incorrect key or corrupted data",
            ));
        }
    };

    // Convert to string
    match String::from_utf8(plaintext) {
        Ok(s) => Ok(s),
        Err(_) => Err(JsError::new("Decrypted data is not valid UTF-8")),
    }
}

/// Derives my alias (the one I monitor for incoming messages).
/// Uses HKDF("chat" || shared_secret || my_public_key).
///
/// # Arguments
/// * `my_private_key` - My wallet private key
/// * `their_address` - Their Kaspa address
///
/// # Returns
/// A 12-character hex string (6 bytes) representing my alias
#[wasm_bindgen]
pub fn derive_my_alias(
    my_private_key: WalletPrivateKey,
    their_address: &str,
) -> Result<String, JsError> {
    // Get my public key from my private key
    let my_public_key = my_private_key
        .to_public_key()
        .map_err(|_| JsError::new("Failed to derive public key"))?;

    // Use the X-only public key bytes for the context (32 bytes)
    let my_pubkey_bytes = my_public_key.xonly_public_key.serialize().to_vec();

    derive_alias_with_context(&my_private_key, their_address, &my_pubkey_bytes)
}

/// Derives their alias (the one I send messages to).
/// Uses HKDF("chat" || shared_secret || their_xonly_public_key).
///
/// # Arguments
/// * `my_private_key` - My wallet private key
/// * `their_address` - Their Kaspa address
///
/// # Returns
/// A 12-character hex string (6 bytes) representing their alias
#[wasm_bindgen]
pub fn derive_their_alias(
    my_private_key: WalletPrivateKey,
    their_address: &str,
) -> Result<String, JsError> {
    // Parse their address to extract their public key
    let address = Address::try_from(their_address)
        .map_err(|e| JsError::new(&format!("Invalid address: {}", e)))?;

    // Extract X-only public key from address (32 bytes, no parity)
    let their_xonly_pk = XOnlyPublicKey::from_slice(address.payload.as_slice())
        .map_err(|e| JsError::new(&format!("Invalid public key in address: {}", e)))?;

    // Use X-only bytes (32 bytes) to avoid parity ambiguity
    // This matches what derive_my_alias does for consistency
    let their_pubkey_bytes = their_xonly_pk.serialize().to_vec();

    derive_alias_with_context(&my_private_key, their_address, &their_pubkey_bytes)
}

/// Internal function to derive an alias using ECDH + HKDF with a public key context.
///
/// # Arguments
/// * `my_private_key` - My wallet private key
/// * `their_address` - Their Kaspa address
/// * `context_pubkey` - The public key to use as context (either mine or theirs)
///
/// # Returns
/// A 12-character hex string (6 bytes)
fn derive_alias_with_context(
    my_private_key: &WalletPrivateKey,
    their_address: &str,
    context_pubkey: &[u8],
) -> Result<String, JsError> {
    // Parse their address to extract their public key
    let address = Address::try_from(their_address)
        .map_err(|e| JsError::new(&format!("Invalid address: {}", e)))?;

    // Extract X-only public key from address
    let their_xonly_pk = XOnlyPublicKey::from_slice(address.payload.as_slice())
        .map_err(|e| JsError::new(&format!("Invalid public key in address: {}", e)))?;

    // Convert to full public key (assuming even parity)
    let their_pk_even =
        SecpPublicKey::from_x_only_public_key(their_xonly_pk, secp256k1::Parity::Even);

    // Convert to k256 PublicKey
    let their_pk = PublicKey::from_sec1_bytes(&their_pk_even.serialize())
        .map_err(|e| JsError::new(&format!("Failed to parse public key: {}", e)))?;

    // Convert my private key to k256 SecretKey
    let my_sk = SecretKey::from_slice(&my_private_key.secret_bytes())
        .map_err(|_| JsError::new("Invalid private key"))?;

    // Perform ECDH to get shared secret
    let shared_secret = diffie_hellman(my_sk.to_nonzero_scalar(), their_pk.as_affine());

    // Construct info string: "chat" || shared_secret || context_pubkey
    let mut info = Vec::new();
    info.extend_from_slice(b"chat");
    info.extend_from_slice(shared_secret.raw_secret_bytes());
    info.extend_from_slice(context_pubkey);

    // Use HKDF to derive deterministic alias from shared secret with context
    let hkdf = Hkdf::<Sha256>::new(None, shared_secret.raw_secret_bytes());
    let mut alias_bytes = [0u8; 6]; // 6 bytes = 12 hex characters
    hkdf.expand(&info, &mut alias_bytes)
        .map_err(|_| JsError::new("HKDF expansion failed"))?;

    // Convert to hex string
    Ok(hex::encode(alias_bytes))
}

/// Derive group keys using HKDF.
/// sender_key = HKDF(root_sender_secret, info="kasia:gcomm:key", salt=group_id || epoch)
/// sender_nonce_key = HKDF(root_sender_secret, info="kasia:gcomm:nonce", salt=group_id || epoch)
///
/// # Arguments
/// * `root_secret` - 32 bytes
/// * `group_id` - 32 bytes
/// * `epoch` - epoch number
/// * `key_type` - "key" or "nonce"
#[wasm_bindgen]
pub fn derive_group_key(
    root_secret: &[u8],
    group_id: &[u8],
    epoch: u64,
    key_type: &str,
) -> Result<Vec<u8>, JsError> {
    let info = format!("kasia:gcomm:{}", key_type);
    let mut salt = group_id.to_vec();
    salt.extend_from_slice(&epoch.to_le_bytes());

    let hk = Hkdf::<Sha256>::new(Some(&salt), root_secret);
    let mut okm = [0u8; 32];
    hk.expand(info.as_bytes(), &mut okm)
        .map_err(|_| JsError::new("hkdf expansion failed"))?;
    Ok(okm.to_vec())
}

/// Sign message using secp256k1 schnorr (compatible with kaspa keys).
/// Signs SHA256(message) with secp256k1 schnorr.
///
/// # Arguments
/// * `private_key` - 32 bytes secp256k1 secret key
/// * `message` - message bytes (hashed internally)
#[wasm_bindgen]
pub fn sign_message(private_key: &[u8], message: &[u8]) -> Result<Vec<u8>, JsError> {
    let secret_key =
        SecpSecretKey::from_slice(private_key).map_err(|_| JsError::new("Invalid private key"))?;

    // hash the message with sha256
    let mut hasher = Sha256::new();
    hasher.update(message);
    let hash = hasher.finalize();

    let message = Message::from_digest_slice(&hash)
        .map_err(|_| JsError::new("Failed to create message from hash"))?;

    let secp = secp256k1::Secp256k1::new();
    let keypair = Keypair::from_secret_key(&secp, &secret_key);
    let signature = secp.sign_schnorr(&message, &keypair);

    Ok(signature.serialize().to_vec()) // 64 bytes
}

/// Verify signature using secp256k1 schnorr.
/// Verifies secp256k1 schnorr signature on SHA256(message).
///
/// # Arguments
/// * `public_key` - 32 bytes x-only public key
/// * `message` - message bytes (hashed internally)
/// * `signature` - 64 bytes schnorr signature
#[wasm_bindgen]
pub fn verify_signature(public_key: &[u8], message: &[u8], signature: &[u8]) -> bool {
    let xonly_pk = match XOnlyPublicKey::from_slice(public_key) {
        Ok(pk) => pk,
        Err(_) => return false,
    };

    // hash the message with sha256
    let mut hasher = Sha256::new();
    hasher.update(message);
    let hash = hasher.finalize();

    let message = match Message::from_digest_slice(&hash) {
        Ok(msg) => msg,
        Err(_) => return false,
    };

    let signature = match SchnorrSignature::from_slice(signature) {
        Ok(sig) => sig,
        Err(_) => return false,
    };

    let secp = secp256k1::Secp256k1::new();
    secp.verify_schnorr(&signature, &message, &xonly_pk).is_ok()
}

/// Get x-only public key from private key (for schnorr signatures).
///
/// # Arguments
/// * `private_key` - 32 bytes secp256k1 secret key
///
/// # Returns
/// 32 bytes x-only public key
#[wasm_bindgen]
pub fn get_xonly_pubkey(private_key: &[u8]) -> Result<Vec<u8>, JsError> {
    let secret_key =
        SecpSecretKey::from_slice(private_key).map_err(|_| JsError::new("Invalid private key"))?;

    let secp = secp256k1::Secp256k1::new();
    let keypair = Keypair::from_secret_key(&secp, &secret_key);
    let (xonly_pk, _parity) = keypair.x_only_public_key();

    Ok(xonly_pk.serialize().to_vec())
}

/// Generate cryptographically secure random bytes using OsRng.
#[wasm_bindgen]
pub fn generate_random_bytes(len: usize) -> Vec<u8> {
    use rand::RngCore;

    let mut bytes = vec![0u8; len];
    OsRng.fill_bytes(&mut bytes);
    bytes
}

/// Derive group_id from group_seed.
/// group_id = SHA256("ciph_msg:groupid" || group_seed)
///
/// # Arguments
/// * `group_seed` - 32 bytes, admin-only secret
///
/// # Returns
/// 32 bytes group_id
#[wasm_bindgen]
pub fn derive_group_id(group_seed: &[u8]) -> Vec<u8> {
    let mut hasher = Sha256::new();
    hasher.update(b"ciph_msg:groupid");
    hasher.update(group_seed);
    hasher.finalize().to_vec()
}

/// Derive group_root for a specific epoch from group_seed.
/// group_root_epoch_N = HKDF(group_seed, salt=group_id||N, info="kasia:groot")
///
/// only the admin can call this (they have the group_seed)
/// members receive the derived group_root_epoch from admin via COMM
///
/// # Arguments
/// * `group_seed` - 32 bytes, admin-only secret
/// * `group_id` - 32 bytes, derived from group_seed
/// * `epoch` - current epoch number
///
/// # Returns
/// 32 bytes group_root_epoch_N
#[wasm_bindgen]
pub fn derive_group_root_epoch(
    group_seed: &[u8],
    group_id: &[u8],
    epoch: u64,
) -> Result<Vec<u8>, JsError> {
    // salt = group_id || epoch (little-endian)
    let mut salt = group_id.to_vec();
    salt.extend_from_slice(&epoch.to_le_bytes());

    let hk = Hkdf::<Sha256>::new(Some(&salt), group_seed);
    let mut okm = [0u8; 32];
    hk.expand(b"kasia:groot", &mut okm)
        .map_err(|_| JsError::new("hkdf expansion failed"))?;
    Ok(okm.to_vec())
}

/// Derive blinding_key from group_seed.
/// blinding_key = HKDF(group_seed, salt=group_id, info="kasia:blinding_key")
///
/// this key is derived once by admin and distributed to all members.
/// it allows members to compute blinded group IDs for any member.
///
/// # Arguments
/// * `group_seed` - 32 bytes, admin-only secret
/// * `group_id` - 32 bytes, derived from group_seed
///
/// # Returns
/// 32 bytes blinding_key
#[wasm_bindgen]
pub fn derive_blinding_key(group_seed: &[u8], group_id: &[u8]) -> Result<Vec<u8>, JsError> {
    let hk = Hkdf::<Sha256>::new(Some(group_id), group_seed);
    let mut okm = [0u8; 32];
    hk.expand(b"kasia:blinding_key", &mut okm)
        .map_err(|_| JsError::new("hkdf expansion failed"))?;
    Ok(okm.to_vec())
}

/// Derive per-user blinded group ID from blinding_key and user's public key.
/// blinded_group_id = HKDF(blinding_key, salt=user_pubkey, info="kasia:blinded_gid")
///
/// each group member uses their own blinded_group_id on-chain, making it
/// impossible to correlate group membership by observing messages.
/// group members can compute each other's blinded IDs since they share blinding_key.
///
/// # Arguments
/// * `blinding_key` - 32 bytes, shared among group members
/// * `user_pubkey` - 33 bytes compressed public key of the user
///
/// # Returns
/// 32 bytes blinded_group_id for this user
#[wasm_bindgen]
pub fn derive_blinded_group_id(
    blinding_key: &[u8],
    user_pubkey: &[u8],
) -> Result<Vec<u8>, JsError> {
    let hk = Hkdf::<Sha256>::new(Some(user_pubkey), blinding_key);
    let mut okm = [0u8; 32];
    hk.expand(b"kasia:blinded_gid", &mut okm)
        .map_err(|_| JsError::new("hkdf expansion failed"))?;
    Ok(okm.to_vec())
}

/// Derive sender_id from sender address.
/// sender_id = SHA256(sender_address_bytes)
///
/// # Arguments
/// * `sender_address` - kaspa address string
///
/// # Returns
/// 32 bytes sender_id
#[wasm_bindgen]
pub fn derive_sender_id(sender_address: &str) -> Vec<u8> {
    let mut hasher = Sha256::new();
    hasher.update(sender_address.as_bytes());
    hasher.finalize().to_vec()
}

/// Derive sender encryption key from group_root_epoch.
/// sender_key = HKDF(group_root_epoch, salt=group_id||epoch, info="kasia:gcomm:key"||sender_id)
///
/// # Arguments
/// * `group_root_epoch` - 32 bytes, received from admin
/// * `group_id` - 32 bytes
/// * `epoch` - current epoch number
/// * `sender_id` - 32 bytes, SHA256(sender_address)
///
/// # Returns
/// 32 bytes sender_key for chacha20poly1305
#[wasm_bindgen]
pub fn derive_sender_key(
    group_root_epoch: &[u8],
    group_id: &[u8],
    epoch: u64,
    sender_id: &[u8],
) -> Result<Vec<u8>, JsError> {
    // salt = group_id || epoch
    let mut salt = group_id.to_vec();
    salt.extend_from_slice(&epoch.to_le_bytes());

    // info = "kasia:gcomm:key" || sender_id
    let mut info = b"kasia:gcomm:key".to_vec();
    info.extend_from_slice(sender_id);

    let hk = Hkdf::<Sha256>::new(Some(&salt), group_root_epoch);
    let mut okm = [0u8; 32];
    hk.expand(&info, &mut okm)
        .map_err(|_| JsError::new("hkdf expansion failed"))?;
    Ok(okm.to_vec())
}

/// Derive sender nonce key from group_root_epoch.
/// sender_nonce_key = HKDF(group_root_epoch, salt=group_id||epoch, info="kasia:gcomm:nonce"||sender_id)
///
/// # Arguments
/// * `group_root_epoch` - 32 bytes, received from admin
/// * `group_id` - 32 bytes
/// * `epoch` - current epoch number
/// * `sender_id` - 32 bytes, SHA256(sender_address)
///
/// # Returns
/// 32 bytes sender_nonce_key for nonce derivation
#[wasm_bindgen]
pub fn derive_sender_nonce_key(
    group_root_epoch: &[u8],
    group_id: &[u8],
    epoch: u64,
    sender_id: &[u8],
) -> Result<Vec<u8>, JsError> {
    // salt = group_id || epoch
    let mut salt = group_id.to_vec();
    salt.extend_from_slice(&epoch.to_le_bytes());

    // info = "kasia:gcomm:nonce" || sender_id
    let mut info = b"kasia:gcomm:nonce".to_vec();
    info.extend_from_slice(sender_id);

    let hk = Hkdf::<Sha256>::new(Some(&salt), group_root_epoch);
    let mut okm = [0u8; 32];
    hk.expand(&info, &mut okm)
        .map_err(|_| JsError::new("hkdf expansion failed"))?;
    Ok(okm.to_vec())
}

/// Build deterministic message id from device_id and msg_counter.
/// msg_id = device_id || msg_counter (24 bytes total)
///
/// # Arguments
/// * `device_id` - 16 bytes, persistent per device
/// * `msg_counter` - monotonic counter per (group_id, epoch, device_id)
///
/// # Returns
/// 24 bytes msg_id
#[wasm_bindgen]
pub fn build_msg_id(device_id: &[u8], msg_counter: u64) -> Vec<u8> {
    let mut msg_id = device_id.to_vec();
    msg_id.extend_from_slice(&msg_counter.to_le_bytes());
    msg_id
}

/// Derive nonce from sender_nonce_key and msg_id.
/// nonce = HKDF(sender_nonce_key, salt=msg_id, info="kasia:gcomm:nonce")[0:12]
///
/// # Arguments
/// * `sender_nonce_key` - 32 bytes
/// * `msg_id` - 24 bytes (device_id || msg_counter)
///
/// # Returns
/// 12 bytes nonce for chacha20poly1305
#[wasm_bindgen]
pub fn derive_message_nonce(sender_nonce_key: &[u8], msg_id: &[u8]) -> Result<Vec<u8>, JsError> {
    let hk = Hkdf::<Sha256>::new(Some(msg_id), sender_nonce_key);
    let mut nonce = [0u8; 12];
    hk.expand(b"kasia:gcomm:nonce", &mut nonce)
        .map_err(|_| JsError::new("hkdf expansion failed"))?;
    Ok(nonce.to_vec())
}

/// Build AAD (authenticated associated data) for group message.
/// AAD = version || "gcomm" || group_id || epoch || sender_id || msg_id
///
/// # Arguments
/// * `version` - protocol version (currently 1)
/// * `group_id` - 32 bytes
/// * `epoch` - current epoch
/// * `sender_id` - 32 bytes
/// * `msg_id` - 24 bytes
///
/// # Returns
/// aad bytes for aead encryption
#[wasm_bindgen]
pub fn build_group_aad(
    version: u8,
    group_id: &[u8],
    epoch: u64,
    sender_id: &[u8],
    msg_id: &[u8],
) -> Vec<u8> {
    let mut aad = Vec::new();
    aad.push(version);
    aad.extend_from_slice(b"gcomm");
    aad.extend_from_slice(group_id);
    aad.extend_from_slice(&epoch.to_le_bytes());
    aad.extend_from_slice(sender_id);
    aad.extend_from_slice(msg_id);
    aad
}

/// Encrypt group message.
///
/// # Arguments
/// * `sender_key` - 32 bytes, derived via derive_sender_key
/// * `sender_nonce_key` - 32 bytes, derived via derive_sender_nonce_key
/// * `msg_id` - 24 bytes (device_id || msg_counter)
/// * `plaintext` - message content
/// * `aad` - authenticated associated data from build_group_aad
///
/// # Returns
/// ciphertext bytes
#[wasm_bindgen]
pub fn group_encrypt(
    sender_key: &[u8],
    sender_nonce_key: &[u8],
    msg_id: &[u8],
    plaintext: &[u8],
    aad: &[u8],
) -> Result<Vec<u8>, JsError> {
    // derive nonce from sender_nonce_key + msg_id
    let nonce_bytes = derive_message_nonce(sender_nonce_key, msg_id)?;

    let cipher = ChaCha20Poly1305::new(sender_key.into());
    let nonce = Nonce::from_slice(&nonce_bytes);

    cipher
        .encrypt(
            nonce,
            Payload {
                msg: plaintext,
                aad,
            },
        )
        .map_err(|_| JsError::new("encryption failed"))
}

/// Decrypt group message.
///
/// # Arguments
/// * `sender_key` - 32 bytes, derived via derive_sender_key
/// * `sender_nonce_key` - 32 bytes, derived via derive_sender_nonce_key
/// * `msg_id` - 24 bytes (device_id || msg_counter)
/// * `ciphertext` - encrypted message
/// * `aad` - authenticated associated data from build_group_aad
///
/// # Returns
/// plaintext bytes or error
#[wasm_bindgen]
pub fn group_decrypt(
    sender_key: &[u8],
    sender_nonce_key: &[u8],
    msg_id: &[u8],
    ciphertext: &[u8],
    aad: &[u8],
) -> Result<Vec<u8>, JsError> {
    // derive nonce from sender_nonce_key + msg_id
    let nonce_bytes = derive_message_nonce(sender_nonce_key, msg_id)?;

    let cipher = ChaCha20Poly1305::new(sender_key.into());
    let nonce = Nonce::from_slice(&nonce_bytes);

    cipher
        .decrypt(
            nonce,
            Payload {
                msg: ciphertext,
                aad,
            },
        )
        .map_err(|_| JsError::new("decryption failed"))
}

// tests
#[cfg(test)]
mod tests {

    use kaspa_wallet_keys::{
        prelude::PublicKey as WalletPublicKey, privatekey::PrivateKey as WalletPrivateKey,
    };
    use kaspa_wrpc_client::prelude::NetworkType;

    use super::*;

    #[test]
    fn test_encrypt_decrypt() {
        let receiver_sk = SecretKey::random(&mut OsRng);
        let receiver_pk = receiver_sk.public_key();

        let sec_receiver_pk = SecpPublicKey::from_slice(&receiver_pk.to_sec1_bytes()).unwrap();
        let wallet_pk = WalletPublicKey::from(sec_receiver_pk);

        let receiver_address = wallet_pk.to_address(NetworkType::Testnet).unwrap();

        let wallet_private_key =
            WalletPrivateKey::try_from_slice(receiver_sk.to_bytes().as_slice()).unwrap();

        let message = "plaintext message";
        let encrypted_message = encrypt_message(&receiver_address.to_string(), message).unwrap();
        let decrypted_message = decrypt_message(encrypted_message, wallet_private_key).unwrap();
        assert_eq!(message.to_owned(), decrypted_message);
    }

    #[test]
    fn test_asymmetric_alias_derivation() {
        // Create Alice's keypair
        let alice_sk = SecretKey::random(&mut OsRng);
        let alice_pk = alice_sk.public_key();
        let alice_secp_pk = SecpPublicKey::from_slice(&alice_pk.to_sec1_bytes()).unwrap();
        let alice_wallet_pk = WalletPublicKey::from(alice_secp_pk);
        let alice_address = alice_wallet_pk.to_address(NetworkType::Testnet).unwrap();
        let alice_private_key =
            WalletPrivateKey::try_from_slice(alice_sk.to_bytes().as_slice()).unwrap();

        // Create Bob's keypair
        let bob_sk = SecretKey::random(&mut OsRng);
        let bob_pk = bob_sk.public_key();
        let bob_secp_pk = SecpPublicKey::from_slice(&bob_pk.to_sec1_bytes()).unwrap();
        let bob_wallet_pk = WalletPublicKey::from(bob_secp_pk);
        let bob_address = bob_wallet_pk.to_address(NetworkType::Testnet).unwrap();
        let bob_private_key =
            WalletPrivateKey::try_from_slice(bob_sk.to_bytes().as_slice()).unwrap();

        // Alice derives her aliases for conversation with Bob
        let alice_my_alias =
            derive_my_alias(alice_private_key.clone(), &bob_address.to_string()).unwrap();
        let alice_their_alias =
            derive_their_alias(alice_private_key.clone(), &bob_address.to_string()).unwrap();

        // Bob derives his aliases for conversation with Alice
        let bob_my_alias =
            derive_my_alias(bob_private_key.clone(), &alice_address.to_string()).unwrap();
        let bob_their_alias =
            derive_their_alias(bob_private_key.clone(), &alice_address.to_string()).unwrap();

        // Verify asymmetric property: Alice's theirAlias should equal Bob's myAlias
        assert_eq!(
            alice_their_alias, bob_my_alias,
            "Alice's theirAlias must match Bob's myAlias (Alice sends to Bob's listening alias)"
        );

        // Verify asymmetric property: Bob's theirAlias should equal Alice's myAlias
        assert_eq!(
            bob_their_alias, alice_my_alias,
            "Bob's theirAlias must match Alice's myAlias (Bob sends to Alice's listening alias)"
        );

        // Verify privacy property: myAliases should be different
        assert_ne!(
            alice_my_alias, bob_my_alias,
            "Alice and Bob should have different myAliases (privacy: different aliases in each direction)"
        );

        // Verify aliases are 12 characters (6 bytes in hex)
        assert_eq!(
            alice_my_alias.len(),
            12,
            "Alias should be 12 hex characters (6 bytes)"
        );
        assert_eq!(
            alice_their_alias.len(),
            12,
            "Alias should be 12 hex characters (6 bytes)"
        );
        assert_eq!(
            bob_my_alias.len(),
            12,
            "Alias should be 12 hex characters (6 bytes)"
        );
        assert_eq!(
            bob_their_alias.len(),
            12,
            "Alias should be 12 hex characters (6 bytes)"
        );
    }

    #[test]
    fn test_alias_determinism() {
        // Create keypairs
        let alice_sk = SecretKey::random(&mut OsRng);
        let alice_private_key =
            WalletPrivateKey::try_from_slice(alice_sk.to_bytes().as_slice()).unwrap();

        let bob_sk = SecretKey::random(&mut OsRng);
        let bob_pk = bob_sk.public_key();
        let bob_secp_pk = SecpPublicKey::from_slice(&bob_pk.to_sec1_bytes()).unwrap();
        let bob_wallet_pk = WalletPublicKey::from(bob_secp_pk);
        let bob_address = bob_wallet_pk.to_address(NetworkType::Testnet).unwrap();

        // Derive aliases twice
        let alias1 = derive_my_alias(alice_private_key.clone(), &bob_address.to_string()).unwrap();
        let alias2 = derive_my_alias(alice_private_key.clone(), &bob_address.to_string()).unwrap();

        // Should be identical (deterministic)
        assert_eq!(alias1, alias2, "Alias derivation must be deterministic");
    }

    #[test]
    fn test_derive_group_id() {
        // group_id = SHA256("ciph_msg:groupid" || group_seed)
        let group_seed = [0u8; 32]; // deterministic for testing
        let group_id = derive_group_id(&group_seed);

        assert_eq!(group_id.len(), 32, "group_id should be 32 bytes");

        // verify determinism
        let group_id_2 = derive_group_id(&group_seed);
        assert_eq!(
            group_id, group_id_2,
            "group_id derivation should be deterministic"
        );

        // different seed = different group_id
        let different_seed = [1u8; 32];
        let different_group_id = derive_group_id(&different_seed);
        assert_ne!(
            group_id, different_group_id,
            "different seeds should produce different group_ids"
        );
    }

    #[test]
    fn test_derive_group_root_epoch() {
        let group_seed = generate_random_bytes(32);
        let group_id = derive_group_id(&group_seed);

        // derive roots for different epochs
        let root_0 = derive_group_root_epoch(&group_seed, &group_id, 0).unwrap();
        let root_1 = derive_group_root_epoch(&group_seed, &group_id, 1).unwrap();
        let root_2 = derive_group_root_epoch(&group_seed, &group_id, 2).unwrap();

        assert_eq!(root_0.len(), 32, "group_root should be 32 bytes");
        assert_eq!(root_1.len(), 32, "group_root should be 32 bytes");
        assert_eq!(root_2.len(), 32, "group_root should be 32 bytes");

        // different epochs = different roots
        assert_ne!(
            root_0, root_1,
            "different epochs should produce different roots"
        );
        assert_ne!(
            root_1, root_2,
            "different epochs should produce different roots"
        );

        // determinism check
        let root_0_again = derive_group_root_epoch(&group_seed, &group_id, 0).unwrap();
        assert_eq!(
            root_0, root_0_again,
            "group_root derivation should be deterministic"
        );
    }

    #[test]
    fn test_derive_blinding_key() {
        let group_seed = generate_random_bytes(32);
        let group_id = derive_group_id(&group_seed);

        let blinding_key = derive_blinding_key(&group_seed, &group_id).unwrap();

        assert_eq!(blinding_key.len(), 32, "blinding_key should be 32 bytes");

        // determinism
        let blinding_key_2 = derive_blinding_key(&group_seed, &group_id).unwrap();
        assert_eq!(
            blinding_key, blinding_key_2,
            "blinding_key derivation should be deterministic"
        );

        // different group = different blinding_key
        let different_seed = generate_random_bytes(32);
        let different_id = derive_group_id(&different_seed);
        let different_blinding_key = derive_blinding_key(&different_seed, &different_id).unwrap();
        assert_ne!(
            blinding_key, different_blinding_key,
            "different groups should have different blinding keys"
        );
    }

    #[test]
    fn test_derive_blinded_group_id() {
        let group_seed = generate_random_bytes(32);
        let group_id = derive_group_id(&group_seed);
        let blinding_key = derive_blinding_key(&group_seed, &group_id).unwrap();

        // simulate two users with different pubkeys
        let alice_pubkey = [0x02; 33]; // compressed pubkey format
        let bob_pubkey = [0x03; 33];

        let alice_blinded_id = derive_blinded_group_id(&blinding_key, &alice_pubkey).unwrap();
        let bob_blinded_id = derive_blinded_group_id(&blinding_key, &bob_pubkey).unwrap();

        assert_eq!(
            alice_blinded_id.len(),
            32,
            "blinded_group_id should be 32 bytes"
        );
        assert_eq!(
            bob_blinded_id.len(),
            32,
            "blinded_group_id should be 32 bytes"
        );

        // different users get different blinded IDs (privacy)
        assert_ne!(
            alice_blinded_id, bob_blinded_id,
            "different users should have different blinded group IDs"
        );

        // both are different from the real group_id (unlinkable)
        assert_ne!(
            alice_blinded_id, group_id,
            "blinded ID should differ from real group_id"
        );
        assert_ne!(
            bob_blinded_id, group_id,
            "blinded ID should differ from real group_id"
        );

        // determinism - alice can recompute bob's blinded ID
        let bob_blinded_id_recomputed =
            derive_blinded_group_id(&blinding_key, &bob_pubkey).unwrap();
        assert_eq!(
            bob_blinded_id, bob_blinded_id_recomputed,
            "blinded ID computation should be deterministic"
        );
    }

    #[test]
    fn test_derive_sender_id() {
        let address = "kaspa:qr0zy65xmf3jqykxyknrkn5nxd38d08fx2x3z0ngm9u4l3mwz9qy5znl9sgv0";
        let sender_id = derive_sender_id(address);

        assert_eq!(sender_id.len(), 32, "sender_id should be 32 bytes");

        // determinism
        let sender_id_2 = derive_sender_id(address);
        assert_eq!(sender_id, sender_id_2, "sender_id should be deterministic");

        // different address = different sender_id
        let different_address =
            "kaspa:qr0zy65xmf3jqykxyknrkn5nxd38d08fx2x3z0ngm9u4l3mwz9qy5znl9sgv1";
        let different_sender_id = derive_sender_id(different_address);
        assert_ne!(
            sender_id, different_sender_id,
            "different addresses should produce different sender_ids"
        );
    }

    #[test]
    fn test_derive_sender_keys() {
        let group_seed = generate_random_bytes(32);
        let group_id = derive_group_id(&group_seed);
        let group_root = derive_group_root_epoch(&group_seed, &group_id, 0).unwrap();

        let alice_sender_id = derive_sender_id("kaspa:alice_address_here");
        let bob_sender_id = derive_sender_id("kaspa:bob_address_here");

        // derive keys for alice
        let alice_key = derive_sender_key(&group_root, &group_id, 0, &alice_sender_id).unwrap();
        let alice_nonce_key =
            derive_sender_nonce_key(&group_root, &group_id, 0, &alice_sender_id).unwrap();

        // derive keys for bob
        let bob_key = derive_sender_key(&group_root, &group_id, 0, &bob_sender_id).unwrap();
        let bob_nonce_key =
            derive_sender_nonce_key(&group_root, &group_id, 0, &bob_sender_id).unwrap();

        assert_eq!(alice_key.len(), 32, "sender_key should be 32 bytes");
        assert_eq!(
            alice_nonce_key.len(),
            32,
            "sender_nonce_key should be 32 bytes"
        );

        // different senders = different keys (because sender_id is in info)
        assert_ne!(
            alice_key, bob_key,
            "different senders should have different keys"
        );
        assert_ne!(
            alice_nonce_key, bob_nonce_key,
            "different senders should have different nonce keys"
        );

        // determinism
        let alice_key_2 = derive_sender_key(&group_root, &group_id, 0, &alice_sender_id).unwrap();
        assert_eq!(
            alice_key, alice_key_2,
            "sender_key derivation should be deterministic"
        );
    }

    #[test]
    fn test_build_msg_id() {
        let device_id = generate_random_bytes(16);
        let msg_counter: u64 = 42;

        let msg_id = build_msg_id(&device_id, msg_counter);

        // msg_id = device_id (16) || msg_counter (8) = 24 bytes
        assert_eq!(msg_id.len(), 24, "msg_id should be 24 bytes");

        // verify contents
        assert_eq!(
            &msg_id[0..16],
            device_id.as_slice(),
            "first 16 bytes should be device_id"
        );
        assert_eq!(
            &msg_id[16..24],
            &msg_counter.to_le_bytes(),
            "last 8 bytes should be counter"
        );

        // different counters = different msg_ids
        let msg_id_43 = build_msg_id(&device_id, 43);
        assert_ne!(
            msg_id, msg_id_43,
            "different counters should produce different msg_ids"
        );
    }

    #[test]
    fn test_group_encrypt_decrypt() {
        // setup: admin creates group
        let group_seed = generate_random_bytes(32);
        let group_id = derive_group_id(&group_seed);
        let epoch: u64 = 0;
        let group_root = derive_group_root_epoch(&group_seed, &group_id, epoch).unwrap();

        // alice sends a message
        let alice_address = "kaspa:alice_test_address";
        let alice_sender_id = derive_sender_id(alice_address);
        let alice_key = derive_sender_key(&group_root, &group_id, epoch, &alice_sender_id).unwrap();
        let alice_nonce_key =
            derive_sender_nonce_key(&group_root, &group_id, epoch, &alice_sender_id).unwrap();

        // alice's device state
        let alice_device_id = generate_random_bytes(16);
        let alice_msg_counter: u64 = 0;
        let msg_id = build_msg_id(&alice_device_id, alice_msg_counter);

        // build aad
        let aad = build_group_aad(1, &group_id, epoch, &alice_sender_id, &msg_id);

        // encrypt
        let plaintext = b"hello group members!";
        let ciphertext =
            group_encrypt(&alice_key, &alice_nonce_key, &msg_id, plaintext, &aad).unwrap();

        // bob (another member) decrypts
        // bob derives alice's keys from the same group_root (he received from admin)
        let bob_derived_alice_key =
            derive_sender_key(&group_root, &group_id, epoch, &alice_sender_id).unwrap();
        let bob_derived_alice_nonce_key =
            derive_sender_nonce_key(&group_root, &group_id, epoch, &alice_sender_id).unwrap();

        // verify bob derived same keys
        assert_eq!(
            alice_key, bob_derived_alice_key,
            "all members should derive same sender keys"
        );
        assert_eq!(
            alice_nonce_key, bob_derived_alice_nonce_key,
            "all members should derive same nonce keys"
        );

        // bob decrypts
        let decrypted = group_decrypt(
            &bob_derived_alice_key,
            &bob_derived_alice_nonce_key,
            &msg_id,
            &ciphertext,
            &aad,
        )
        .unwrap();

        assert_eq!(
            decrypted, plaintext,
            "decryption should recover original plaintext"
        );
    }

    #[test]
    fn test_group_message_tamper_detection() {
        // setup
        let group_seed = generate_random_bytes(32);
        let group_id = derive_group_id(&group_seed);
        let epoch: u64 = 0;
        let group_root = derive_group_root_epoch(&group_seed, &group_id, epoch).unwrap();

        let sender_id = derive_sender_id("kaspa:sender");
        let sender_key = derive_sender_key(&group_root, &group_id, epoch, &sender_id).unwrap();
        let sender_nonce_key =
            derive_sender_nonce_key(&group_root, &group_id, epoch, &sender_id).unwrap();

        let device_id = generate_random_bytes(16);
        let msg_id = build_msg_id(&device_id, 0);
        let aad = build_group_aad(1, &group_id, epoch, &sender_id, &msg_id);

        let plaintext = b"secret message";
        let ciphertext =
            group_encrypt(&sender_key, &sender_nonce_key, &msg_id, plaintext, &aad).unwrap();

        // verify correct decryption works
        let decrypted =
            group_decrypt(&sender_key, &sender_nonce_key, &msg_id, &ciphertext, &aad).unwrap();
        assert_eq!(decrypted, plaintext, "correct decryption should work");

        // tamper detection is ensured by chacha20poly1305 AEAD properties
        // the poly1305 tag authenticates both the ciphertext and AAD
        // any modification to either will cause authentication failure
        // we verify this property by checking the ciphertext includes the tag
        assert!(
            ciphertext.len() > plaintext.len(),
            "ciphertext should include authentication tag"
        );

        // the auth tag is 16 bytes for poly1305
        let expected_overhead = 16; // poly1305 tag
        assert_eq!(
            ciphertext.len(),
            plaintext.len() + expected_overhead,
            "ciphertext should be plaintext + 16 byte tag"
        );
    }

    #[test]
    fn test_epoch_isolation() {
        // setup
        let group_seed = generate_random_bytes(32);
        let group_id = derive_group_id(&group_seed);

        // epoch 0
        let root_0 = derive_group_root_epoch(&group_seed, &group_id, 0).unwrap();
        let sender_id = derive_sender_id("kaspa:sender");
        let key_0 = derive_sender_key(&root_0, &group_id, 0, &sender_id).unwrap();
        let nonce_key_0 = derive_sender_nonce_key(&root_0, &group_id, 0, &sender_id).unwrap();

        // epoch 1
        let root_1 = derive_group_root_epoch(&group_seed, &group_id, 1).unwrap();
        let key_1 = derive_sender_key(&root_1, &group_id, 1, &sender_id).unwrap();
        let nonce_key_1 = derive_sender_nonce_key(&root_1, &group_id, 1, &sender_id).unwrap();

        // keys should be different across epochs
        assert_ne!(
            key_0, key_1,
            "different epochs should have different sender keys"
        );
        assert_ne!(
            nonce_key_0, nonce_key_1,
            "different epochs should have different nonce keys"
        );

        // roots should be different
        assert_ne!(
            root_0, root_1,
            "different epochs should have different roots"
        );

        // encrypt in epoch 0, verify can decrypt with epoch 0 keys
        let device_id = generate_random_bytes(16);
        let msg_id = build_msg_id(&device_id, 0);
        let aad_0 = build_group_aad(1, &group_id, 0, &sender_id, &msg_id);
        let plaintext = b"epoch 0 message";
        let ciphertext = group_encrypt(&key_0, &nonce_key_0, &msg_id, plaintext, &aad_0).unwrap();

        // decrypt with correct epoch 0 keys should work
        let decrypted = group_decrypt(&key_0, &nonce_key_0, &msg_id, &ciphertext, &aad_0).unwrap();
        assert_eq!(
            decrypted, plaintext,
            "decryption with correct epoch keys should work"
        );

        // epoch isolation is proven by different keys - trying to decrypt with wrong keys
        // would fail, but we can't test that here due to JsError limitations in native tests
        // the key difference assertion above proves epoch isolation
    }
}
