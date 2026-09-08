use serde::ser::{Serialize, SerializeStruct, Serializer};

#[derive(Debug, thiserror::Error)]
pub enum AppError {
    #[error("{0} not found")]
    NotFound(String),
    #[error("filesystem error: {0}")]
    Io(#[from] std::io::Error),
    #[error("serialization error: {0}")]
    Serde(#[from] serde_json::Error),
    #[error("{0}")]
    Invalid(String),
    #[error("{0}")]
    Busy(String),
}

impl AppError {
    /// Stable slug the frontend can branch on — the message is for humans only.
    pub fn code(&self) -> &'static str {
        match self {
            Self::NotFound(_) => "not-found",
            Self::Io(_) => "io",
            Self::Serde(_) => "serde",
            Self::Invalid(_) => "invalid",
            Self::Busy(_) => "busy",
        }
    }
}

// Tauri requires command errors to be Serialize; the ApiError on the TS side
// reads the `message` and keeps `code` for retry decisions.
impl Serialize for AppError {
    fn serialize<S: Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        let mut state = serializer.serialize_struct("AppError", 2)?;
        state.serialize_field("code", self.code())?;
        state.serialize_field("message", &self.to_string())?;
        state.end()
    }
}

pub type AppResult<T> = Result<T, AppError>;
