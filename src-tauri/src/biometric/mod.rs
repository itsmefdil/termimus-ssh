//! Biometric authentication module (Touch ID on macOS, platform fallbacks).
//!
//! Provides a unified, maintainable interface for hardware-backed authentication:
//! - `is_supported()`: returns whether biometric hardware is available and enrolled.
//! - `authenticate(reason)`: requests user verification with a localized reason string.

#[cfg(target_os = "macos")]
mod macos;
#[cfg(target_os = "macos")]
pub use macos::*;

#[cfg(not(target_os = "macos"))]
mod unsupported;
#[cfg(not(target_os = "macos"))]
pub use unsupported::*;
