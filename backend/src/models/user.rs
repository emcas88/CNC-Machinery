use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use uuid::Uuid;

/// System user role controlling access permissions.
#[derive(Debug, Clone, Copy, Serialize, Deserialize, sqlx::Type, PartialEq, Eq, Hash)]
#[sqlx(type_name = "user_role", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum UserRole {
    SuperAdmin,
    Designer,
    CncOperator,
    ShopFloor,
}

impl UserRole {
    pub fn from_str_role(s: &str) -> Option<UserRole> {
        match s {
            "super_admin" => Some(UserRole::SuperAdmin),
            "designer" => Some(UserRole::Designer),
            "cnc_operator" => Some(UserRole::CncOperator),
            "shop_floor" => Some(UserRole::ShopFloor),
            _ => None,
        }
    }

    pub fn privilege_level(&self) -> u32 {
        match self {
            UserRole::SuperAdmin => 100,
            UserRole::Designer => 50,
            UserRole::CncOperator => 30,
            UserRole::ShopFloor => 10,
        }
    }
}

impl std::fmt::Display for UserRole {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::SuperAdmin => write!(f, "super_admin"),
            Self::Designer => write!(f, "designer"),
            Self::CncOperator => write!(f, "cnc_operator"),
            Self::ShopFloor => write!(f, "shop_floor"),
        }
    }
}

/// A system user account.
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct User {
    pub id: Uuid,
    pub email: String,
    pub name: String,
    #[serde(skip_serializing)]
    pub password_hash: String,
    pub role: UserRole,
    /// Fine-grained permission flags as JSON.
    pub permissions: Value,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// DTO for creating a user via the admin API.
#[derive(Debug, Deserialize)]
pub struct CreateUser {
    pub email: String,
    pub name: String,
    pub password: String,
    pub role: Option<UserRole>,
    pub permissions: Option<Value>,
}

/// DTO for updating a user.
#[derive(Debug, Deserialize)]
pub struct UpdateUser {
    pub email: Option<String>,
    pub name: Option<String>,
    pub password: Option<String>,
    pub role: Option<UserRole>,
    pub permissions: Option<Value>,
}

/// DTO for user login.
#[derive(Debug, Deserialize)]
pub struct LoginRequest {
    pub email: String,
    pub password: String,
}
