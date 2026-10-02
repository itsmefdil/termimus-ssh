//! Fallback implementation for platforms without biometric support.

pub fn is_supported() -> bool {
    false
}

pub fn authenticate(_reason: &str) -> Result<bool, String> {
    Err("Biometric authentication is not supported on this platform.".to_string())
}
