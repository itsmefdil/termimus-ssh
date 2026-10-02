//! macOS LocalAuthentication (Touch ID) implementation.

#[link(name = "LocalAuthentication", kind = "framework")]
extern "C" {}

use std::sync::mpsc;
use objc2::runtime::{AnyClass, AnyObject, Bool};
use objc2::msg_send;
use objc2_foundation::NSString;
use block2::RcBlock;

// LAPolicyDeviceOwnerAuthenticationWithBiometrics = 1
const LA_POLICY_BIOMETRICS: isize = 1;

/// Check if Touch ID is available and enrolled on this Mac.
pub fn is_supported() -> bool {
    let Some(cls) = AnyClass::get(c"LAContext") else {
        return false;
    };

    unsafe {
        let context: *mut AnyObject = msg_send![cls, new];
        if context.is_null() {
            return false;
        }

        let mut error: *mut AnyObject = std::ptr::null_mut();
        let can_evaluate: Bool = msg_send![
            context,
            canEvaluatePolicy: LA_POLICY_BIOMETRICS,
            error: &mut error
        ];

        let _: () = msg_send![context, release];
        can_evaluate.as_bool()
    }
}

/// Prompt the user for Touch ID biometric authentication.
pub fn authenticate(reason: &str) -> Result<bool, String> {
    let cls = AnyClass::get(c"LAContext")
        .ok_or_else(|| "LAContext class not found in Objective-C runtime".to_string())?;

    let reason_ns = NSString::from_str(reason);
    let (tx, rx) = mpsc::channel();

    unsafe {
        let context: *mut AnyObject = msg_send![cls, new];
        if context.is_null() {
            return Err("Failed to instantiate LAContext".to_string());
        }

        let mut error: *mut AnyObject = std::ptr::null_mut();
        let can_evaluate: Bool = msg_send![
            context,
            canEvaluatePolicy: LA_POLICY_BIOMETRICS,
            error: &mut error
        ];

        if !can_evaluate.as_bool() {
            let _: () = msg_send![context, release];
            return Err("Touch ID is not available or not configured on this device".to_string());
        }

        let reply = RcBlock::new(move |success: Bool, error_ptr: *mut AnyObject| {
            let _ = tx.send((success.as_bool(), error_ptr as usize));
        });

        let _: () = msg_send![
            context,
            evaluatePolicy: LA_POLICY_BIOMETRICS,
            localizedReason: &*reason_ns,
            reply: &*reply
        ];

        let result = rx.recv().map_err(|e| format!("Channel error: {e}"));
        let _: () = msg_send![context, release];

        match result {
            Ok((true, _)) => Ok(true),
            Ok((false, _err_ptr)) => Ok(false),
            Err(e) => Err(e),
        }
    }
}
