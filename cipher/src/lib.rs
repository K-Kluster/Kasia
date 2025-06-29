use chacha20poly1305::{
    ChaCha20Poly1305, KeyInit, Nonce,
    aead::{Aead, AeadCore, OsRng, Payload},
};
use k256::{
    PublicKey, SecretKey,
    ecdh::{EphemeralSecret, diffie_hellman},
};
use kaspa_addresses::Address;
use kaspa_wallet_keys::privatekey::PrivateKey as WalletPrivateKey;
use secp256k1::{PublicKey as SecpPublicKey, XOnlyPublicKey};
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
}
