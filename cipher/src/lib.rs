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
    // size is 33 bytes
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
        Self {
            nonce: bytes[0..12].to_vec(),
            ephemeral_public_key: bytes[12..44].to_vec(),
            ciphertext: bytes[44..].to_vec(),
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
    let receiver_sk = SecretKey::from_slice(&receiver_wallet_sk.secret_bytes()).unwrap();

    let ephemeral_pk = PublicKey::from_sec1_bytes(&encrypted_message.ephemeral_public_key).unwrap();
    let nonce = Nonce::from_slice(&encrypted_message.nonce);

    let shared_secret_2 = diffie_hellman(receiver_sk.to_nonzero_scalar(), ephemeral_pk.as_affine());

    let exctracted_2 = shared_secret_2.extract::<sha2::Sha256>(None);
    let mut okm_2 = [0u8; 32];
    exctracted_2.expand(b"", &mut okm_2).unwrap();
    let cipher_2 = ChaCha20Poly1305::new(&okm_2.into());
    let plaintext = cipher_2
        .decrypt(
            &nonce,
            Payload::from(encrypted_message.ciphertext.as_slice()),
        )
        .expect_throw("Failed to decrypt message");

    Ok(String::from_utf8(plaintext).unwrap())
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
