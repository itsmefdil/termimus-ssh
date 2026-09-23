use aes_gcm::{
    aead::{Aead, KeyInit},
    Aes256Gcm, Nonce,
};
use argon2::{password_hash::rand_core::RngCore, Argon2};
use rand::rngs::OsRng;
use std::sync::RwLock;
use zeroize::Zeroize;

const VERIFY_STRING: &[u8] = b"TERMIMUS_VAULT_OK";

pub struct VaultManager {
    derived_key: RwLock<Option<[u8; 32]>>,
}

impl VaultManager {
    pub fn new() -> Self {
        VaultManager {
            derived_key: RwLock::new(None),
        }
    }

    pub fn is_unlocked(&self) -> bool {
        self.derived_key.read().unwrap().is_some()
    }

    pub fn lock(&self) {
        let mut key_guard = self.derived_key.write().unwrap();
        // Zero out the derived key bytes in memory before dropping them
        if let Some(ref mut key) = *key_guard {
            key.zeroize();
        }
        *key_guard = None;
    }

    /// Encrypt a backup bundle using a separate passphrase (independent from the vault key).
    /// Returns (ciphertext, salt, nonce) all as raw bytes.
    pub fn encrypt_with_passphrase(
        plaintext: &[u8],
        passphrase: &str,
    ) -> Result<(Vec<u8>, Vec<u8>, Vec<u8>), String> {
        let salt = VaultManager::generate_salt();
        let key = VaultManager::derive_key(passphrase, &salt)?;

        let cipher = Aes256Gcm::new_from_slice(&key)
            .map_err(|e| format!("Cipher init failed: {e}"))?;

        let mut nonce_bytes = [0u8; 12];
        OsRng.fill_bytes(&mut nonce_bytes);
        let nonce = Nonce::from_slice(&nonce_bytes);

        let ciphertext = cipher
            .encrypt(nonce, plaintext)
            .map_err(|e| format!("Encryption error: {e}"))?;

        Ok((ciphertext, salt.to_vec(), nonce_bytes.to_vec()))
    }

    /// Decrypt a backup bundle that was encrypted with `encrypt_with_passphrase`.
    pub fn decrypt_with_passphrase(
        ciphertext: &[u8],
        passphrase: &str,
        salt: &[u8],
        nonce_bytes: &[u8],
    ) -> Result<Vec<u8>, String> {
        let mut key = [0u8; 32];
        let argon2 = Argon2::default();
        argon2
            .hash_password_into(passphrase.as_bytes(), salt, &mut key)
            .map_err(|e| format!("Argon2 derivation error: {e}"))?;

        let cipher = Aes256Gcm::new_from_slice(&key)
            .map_err(|e| format!("Cipher init failed: {e}"))?;

        if nonce_bytes.len() != 12 {
            return Err("Invalid nonce length".to_string());
        }
        let nonce = Nonce::from_slice(nonce_bytes);

        let plaintext = cipher
            .decrypt(nonce, ciphertext)
            .map_err(|_| "Decryption failed — wrong passphrase or corrupted backup".to_string())?;

        Ok(plaintext)
    }

    /// Derive key from password using Argon2id and a 16-byte salt
    pub fn derive_key(password: &str, salt: &[u8]) -> Result<[u8; 32], String> {
        let mut derived = [0u8; 32];
        let argon2 = Argon2::default();
        argon2
            .hash_password_into(password.as_bytes(), salt, &mut derived)
            .map_err(|e| format!("Argon2 derivation error: {e}"))?;
        Ok(derived)
    }

    /// Generate a fresh 16-byte salt for new vault setup
    pub fn generate_salt() -> [u8; 16] {
        let mut salt = [0u8; 16];
        OsRng.fill_bytes(&mut salt);
        salt
    }

    /// Set the derived key in memory after successful unlock
    pub fn set_key(&self, key: [u8; 32]) {
        let mut key_guard = self.derived_key.write().unwrap();
        *key_guard = Some(key);
    }

    /// Export the current derived key as a hex string (for storing in the OS keyring).
    /// Errors if the vault is currently locked.
    pub fn export_key_hex(&self) -> Result<String, String> {
        let key_guard = self.derived_key.read().unwrap();
        let key_bytes = key_guard
            .as_ref()
            .ok_or_else(|| "Vault is locked".to_string())?;
        let mut hex = String::with_capacity(64);
        for b in key_bytes {
            hex.push_str(&format!("{b:02x}"));
        }
        Ok(hex)
    }

    /// Encrypt plaintext using AES-256-GCM
    pub fn encrypt(&self, plaintext: &[u8]) -> Result<(Vec<u8>, Vec<u8>), String> {
        let key_guard = self.derived_key.read().unwrap();
        let key_bytes = key_guard
            .as_ref()
            .ok_or_else(|| "Vault is locked. Unlock vault first.".to_string())?;

        let cipher = Aes256Gcm::new_from_slice(key_bytes)
            .map_err(|e| format!("Cipher init failed: {e}"))?;

        let mut nonce_bytes = [0u8; 12];
        OsRng.fill_bytes(&mut nonce_bytes);
        let nonce = Nonce::from_slice(&nonce_bytes);

        let ciphertext = cipher
            .encrypt(nonce, plaintext)
            .map_err(|e| format!("Encryption error: {e}"))?;

        Ok((ciphertext, nonce_bytes.to_vec()))
    }

    /// Decrypt ciphertext using AES-256-GCM
    pub fn decrypt(&self, ciphertext: &[u8], nonce_bytes: &[u8]) -> Result<Vec<u8>, String> {
        let key_guard = self.derived_key.read().unwrap();
        let key_bytes = key_guard
            .as_ref()
            .ok_or_else(|| "Vault is locked. Unlock vault first.".to_string())?;

        let cipher = Aes256Gcm::new_from_slice(key_bytes)
            .map_err(|e| format!("Cipher init failed: {e}"))?;

        if nonce_bytes.len() != 12 {
            return Err("Invalid nonce length".to_string());
        }
        let nonce = Nonce::from_slice(nonce_bytes);

        let plaintext = cipher
            .decrypt(nonce, ciphertext)
            .map_err(|e| format!("Decryption error: {e}"))?;

        Ok(plaintext)
    }

    pub fn verification_payload() -> &'static [u8] {
        VERIFY_STRING
    }
}
