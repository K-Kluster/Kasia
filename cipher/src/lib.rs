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
use secp256k1::{PublicKey as SecpPublicKey, XOnlyPublicKey};
use sha2::Sha256;
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

#[derive(Clone, Copy)]
enum HashDomain {
    DmAliasV1,
}

impl HashDomain {
    fn tag(self) -> &'static [u8] {
        match self {
            Self::DmAliasV1 => b"dm_alias:v1",
        }
    }
}

fn parse_xonly_public_key_from_address(address_string: &str) -> Result<XOnlyPublicKey, JsError> {
    let address = Address::try_from(address_string)
        .map_err(|e| JsError::new(&format!("Address parsing error: {}", e)))?;

    XOnlyPublicKey::from_slice(address.payload.as_slice())
        .map_err(|e| JsError::new(&format!("XOnlyPublicKey error: {}", e)))
}

fn parse_xonly_public_key_from_hex(
    xonly_public_key_hex: &str,
    field_name: &str,
) -> Result<XOnlyPublicKey, JsError> {
    let bytes = hex::decode(xonly_public_key_hex)
        .map_err(|_| JsError::new(&format!("Invalid {} hex", field_name)))?;
    XOnlyPublicKey::from_slice(&bytes)
        .map_err(|e| JsError::new(&format!("Invalid {}: {}", field_name, e)))
}

fn xonly_to_k256_public_key(xonly_pk: XOnlyPublicKey) -> Result<PublicKey, JsError> {
    let pk_even = SecpPublicKey::from_x_only_public_key(xonly_pk, secp256k1::Parity::Even);
    PublicKey::from_sec1_bytes(&pk_even.serialize())
        .map_err(|e| JsError::new(&format!("k256 PublicKey error: {}", e)))
}

fn shared_secret_for_alias(
    my_private_key: &WalletPrivateKey,
    their_xonly_pk: XOnlyPublicKey,
) -> Result<k256::ecdh::SharedSecret, JsError> {
    let their_pk = xonly_to_k256_public_key(their_xonly_pk)?;
    let my_sk = SecretKey::from_slice(&my_private_key.secret_bytes())
        .map_err(|_| JsError::new("Invalid private key"))?;
    Ok(diffie_hellman(
        my_sk.to_nonzero_scalar(),
        their_pk.as_affine(),
    ))
}

#[wasm_bindgen]
pub fn encrypt_message(
    receiver_address_string: &str,
    message: &str,
) -> Result<EncryptedMessage, JsError> {
    let receiver_xonly_pk = parse_xonly_public_key_from_address(receiver_address_string)?;
    let receiver_pk = xonly_to_k256_public_key(receiver_xonly_pk)?;

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
        nonce,
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

/// Derive a deterministic 1:1 conversation alias (DM alias).
///
/// HKDF info uses a dedicated domain tag:
/// `dm_alias:v1 || shared_secret || context_xonly_public_key`
#[wasm_bindgen]
pub fn derive_dm_alias(
    my_private_key: &WalletPrivateKey,
    their_xonly_public_key_hex: &str,
    context_xonly_public_key_hex: &str,
) -> Result<String, JsError> {
    let their_xonly_pk =
        parse_xonly_public_key_from_hex(their_xonly_public_key_hex, "their_xonly_public_key")?;
    let context_xonly_pk =
        parse_xonly_public_key_from_hex(context_xonly_public_key_hex, "context_xonly_public_key")?;

    derive_alias_with_context(
        my_private_key,
        their_xonly_pk,
        context_xonly_pk,
        HashDomain::DmAliasV1,
    )
}

fn derive_alias_with_context(
    my_private_key: &WalletPrivateKey,
    their_xonly_pk: XOnlyPublicKey,
    context_xonly_pk: XOnlyPublicKey,
    domain: HashDomain,
) -> Result<String, JsError> {
    let shared_secret = shared_secret_for_alias(my_private_key, their_xonly_pk)?;

    let mut info = Vec::new();
    info.extend_from_slice(domain.tag());
    info.extend_from_slice(context_xonly_pk.serialize().as_ref());

    let hkdf = Hkdf::<Sha256>::new(None, shared_secret.raw_secret_bytes());
    let mut alias_bytes = [0u8; 6];
    hkdf.expand(&info, &mut alias_bytes)
        .map_err(|_| JsError::new("HKDF expansion failed"))?;

    Ok(hex::encode(alias_bytes))
}

// tests
#[cfg(test)]
mod tests {

    use kaspa_consensus_core::network::NetworkType;
    use kaspa_wallet_keys::{
        prelude::PublicKey as WalletPublicKey, privatekey::PrivateKey as WalletPrivateKey,
    };
    #[cfg(target_arch = "wasm32")]
    use wasm_bindgen_test::wasm_bindgen_test;

    use super::*;

    fn make_wallet_private_key() -> WalletPrivateKey {
        let sk = SecretKey::random(&mut OsRng);
        WalletPrivateKey::try_from_slice(sk.to_bytes().as_slice()).unwrap()
    }

    fn xonly_hex(private_key: &WalletPrivateKey) -> String {
        hex::encode(
            private_key
                .to_public_key()
                .unwrap()
                .xonly_public_key
                .serialize(),
        )
    }

    #[test]
    fn test_hash_domain_tag_dm_alias_v1() {
        assert_eq!(HashDomain::DmAliasV1.tag(), b"dm_alias:v1");
    }

    #[test]
    fn test_parse_xonly_public_key_from_hex_valid() {
        let private_key = make_wallet_private_key();
        let xonly = private_key.to_public_key().unwrap().xonly_public_key;
        let parsed =
            parse_xonly_public_key_from_hex(&xonly_hex(&private_key), "their_xonly_public_key")
                .unwrap();
        assert_eq!(parsed.serialize(), xonly.serialize());
    }

    #[test]
    fn test_parse_xonly_public_key_from_address_valid() {
        let private_key = make_wallet_private_key();
        let wallet_public_key = private_key.to_public_key().unwrap();
        let expected = wallet_public_key.xonly_public_key;
        let address = wallet_public_key.to_address(NetworkType::Testnet).unwrap();

        let parsed = parse_xonly_public_key_from_address(&address.to_string()).unwrap();
        assert_eq!(parsed.serialize(), expected.serialize());
    }

    #[cfg(target_arch = "wasm32")]
    #[wasm_bindgen_test]
    fn test_parse_xonly_public_key_from_address_invalid() {
        let parsed = parse_xonly_public_key_from_address("invalid-address");
        assert!(parsed.is_err());
    }

    #[test]
    fn test_xonly_to_k256_public_key_roundtrip_xonly() {
        let private_key = make_wallet_private_key();
        let xonly = private_key.to_public_key().unwrap().xonly_public_key;

        let k256_pk = xonly_to_k256_public_key(xonly).unwrap();
        let secp_pk = SecpPublicKey::from_slice(&k256_pk.to_sec1_bytes()).unwrap();
        let (roundtrip_xonly, _) = secp_pk.x_only_public_key();

        assert_eq!(roundtrip_xonly.serialize(), xonly.serialize());
    }

    #[test]
    fn test_shared_secret_for_alias_is_symmetric() {
        let alice_private_key = make_wallet_private_key();
        let bob_private_key = make_wallet_private_key();

        let alice_xonly = alice_private_key.to_public_key().unwrap().xonly_public_key;
        let bob_xonly = bob_private_key.to_public_key().unwrap().xonly_public_key;

        let alice_secret = shared_secret_for_alias(&alice_private_key, bob_xonly).unwrap();
        let bob_secret = shared_secret_for_alias(&bob_private_key, alice_xonly).unwrap();

        assert_eq!(
            alice_secret.raw_secret_bytes(),
            bob_secret.raw_secret_bytes()
        );
    }

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
        let _ = WalletPublicKey::from(alice_secp_pk);
        let alice_private_key =
            WalletPrivateKey::try_from_slice(alice_sk.to_bytes().as_slice()).unwrap();

        // Create Bob's keypair
        let bob_sk = SecretKey::random(&mut OsRng);
        let bob_pk = bob_sk.public_key();
        let bob_secp_pk = SecpPublicKey::from_slice(&bob_pk.to_sec1_bytes()).unwrap();
        let _ = WalletPublicKey::from(bob_secp_pk);
        let bob_private_key =
            WalletPrivateKey::try_from_slice(bob_sk.to_bytes().as_slice()).unwrap();

        let alice_xonly_hex = hex::encode(
            alice_private_key
                .to_public_key()
                .unwrap()
                .xonly_public_key
                .serialize(),
        );
        let bob_xonly_hex = hex::encode(
            bob_private_key
                .to_public_key()
                .unwrap()
                .xonly_public_key
                .serialize(),
        );

        // Alice derives her alias for conversation with Bob
        let alice_my_alias =
            derive_dm_alias(&alice_private_key, &bob_xonly_hex, &alice_xonly_hex).unwrap();

        // Bob derives his alias for conversation with Alice
        let bob_my_alias =
            derive_dm_alias(&bob_private_key, &alice_xonly_hex, &bob_xonly_hex).unwrap();

        // Verify privacy property: myAliases should be different
        assert_ne!(
            alice_my_alias, bob_my_alias,
            "Alice and Bob should have different myAliases (privacy: different aliases in each direction)"
        );
    }
}
