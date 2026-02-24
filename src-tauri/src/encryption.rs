use aes_gcm::{
    aead::{Aead, KeyInit, OsRng},
    Aes256Gcm, Nonce,
};
use base64::{engine::general_purpose, Engine as _};
use rand::RngCore;
use std::{env, fs};

/// Encryption key derived from machine-specific identifier
/// In production, consider using a proper key derivation function (KDF)
fn get_encryption_key() -> [u8; 32] {
    // Try to get from environment first (most secure)
    if let Ok(key_str) = env::var("ENCRYPTION_KEY") {
        // Hash it to get 32 bytes
        use std::collections::hash_map::DefaultHasher;
        use std::hash::{Hash, Hasher};
        
        let mut hasher = DefaultHasher::new();
        key_str.hash(&mut hasher);
        let hash = hasher.finish();
        
        let mut key = [0u8; 32];
        key[..8].copy_from_slice(&hash.to_le_bytes());
        // Fill rest with key bytes
        for (i, &b) in key_str.as_bytes().iter().take(24).enumerate() {
            key[8 + i] = b;
        }
        return key;
    }
    
    // Fallback: use machine ID (less secure but better than nothing)
    // In production, generate and store a random key on first run
    let machine_id = get_machine_id();
    let mut key = [0u8; 32];
    
    // Hash the machine ID
    use std::collections::hash_map::DefaultHasher;
    use std::hash::{Hash, Hasher};
    
    let mut hasher = DefaultHasher::new();
    machine_id.hash(&mut hasher);
    let hash = hasher.finish();
    
    key[..8].copy_from_slice(&hash.to_le_bytes());
    for (i, &b) in machine_id.as_bytes().iter().take(24).enumerate() {
        key[8 + i] = b;
    }
    key
}

/// Get a machine-specific identifier
fn get_machine_id() -> String {
    // Try different methods to get a unique machine ID
    // On Linux: machine-id
    if let Ok(id) = fs::read_to_string("/etc/machine-id") {
        return id.trim().to_string();
    }
    
    // Fallback to hostname
    env::var("HOSTNAME").unwrap_or_else(|_| "unknown".to_string())
}

/// Encrypt plaintext using AES-256-GCM
pub fn encrypt(plaintext: &str) -> Result<String, String> {
    let key = get_encryption_key();
    let cipher = Aes256Gcm::new_from_slice(&key)
        .map_err(|e| format!("Failed to initialize cipher: {}", e))?;
    
    // Generate random nonce
    let mut nonce_bytes = [0u8; 12];
    OsRng.fill_bytes(&mut nonce_bytes);
    let nonce = Nonce::from_slice(&nonce_bytes);
    
    // Encrypt
    let ciphertext = cipher
        .encrypt(nonce, plaintext.as_bytes())
        .map_err(|e| format!("Encryption failed: {}", e))?;
    
    // Combine nonce + ciphertext and encode as base64
    let mut combined = nonce_bytes.to_vec();
    combined.extend_from_slice(&ciphertext);
    
    Ok(general_purpose::STANDARD.encode(&combined))
}

/// Decrypt ciphertext using AES-256-GCM
pub fn decrypt(ciphertext_b64: &str) -> Result<String, String> {
    let key = get_encryption_key();
    let cipher = Aes256Gcm::new_from_slice(&key)
        .map_err(|e| format!("Failed to initialize cipher: {}", e))?;
    
    // Decode base64
    let combined = general_purpose::STANDARD
        .decode(ciphertext_b64)
        .map_err(|e| format!("Invalid base64: {}", e))?;
    
    // Split nonce and ciphertext
    if combined.len() < 12 {
        return Err("Invalid ciphertext format".to_string());
    }
    
    let nonce = Nonce::from_slice(&combined[..12]);
    let ciphertext = &combined[12..];
    
    // Decrypt
    let plaintext = cipher
        .decrypt(nonce, ciphertext)
        .map_err(|e| format!("Decryption failed: {}", e))?;
    
    String::from_utf8(plaintext)
        .map_err(|e| format!("Invalid UTF-8 in decrypted data: {}", e))
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_encrypt_decrypt() {
        let original = "test-server-key-123";
        let encrypted = encrypt(original).unwrap();
        let decrypted = decrypt(&encrypted).unwrap();
        assert_eq!(original, decrypted);
    }
    
    #[test]
    fn test_different_strings() {
        let s1 = encrypt("hello").unwrap();
        let s2 = encrypt("hello").unwrap();
        // Should be different due to random nonce
        assert_ne!(s1, s2);
        
        // But should decrypt to same value
        assert_eq!(decrypt(&s1).unwrap(), "hello");
        assert_eq!(decrypt(&s2).unwrap(), "hello");
    }
}
