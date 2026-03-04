// =============================================================================
// backend/src/services/mod.rs — Fixed Issue 23: removed phantom `email_service`
// declaration that referenced a non-existent file, causing a compiler error.
// =============================================================================

// Public service sub-modules
// (add real service modules here as they are implemented)

/// Placeholder so the `services` module is not completely empty.
/// Remove once real sub-modules are added.
pub mod placeholder {
    /// Returns a static greeting — used only for smoke-testing the module tree.
    pub fn hello() -> &'static str {
        "services module OK"
    }
}

#[cfg(test)]
mod tests {
    use super::placeholder;

    #[test]
    fn test_placeholder() {
        assert_eq!(placeholder::hello(), "services module OK");
    }
}
