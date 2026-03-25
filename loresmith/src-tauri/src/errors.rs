use serde::Deserialize;
use thiserror::Error;

#[derive(Debug, Error, Deserialize, Clone)]
pub enum LoreError {
    #[error("Path is not writable")]
    PathNotWritable,
    #[error("Project name cannot be empty")]
    NameEmpty,
    #[error("Invalid genre")]
    GenreInvalid,
    #[error("Not a Neworld project")]
    NotANeworldProject,
    #[error("DB migration failed: {0}")]
    DbMigrationFailed(String),
    #[error("Entity not found")]
    EntityNotFound,
    #[error("Category not found")]
    CategoryNotFound,
    #[error("Name too long")]
    NameTooLong,
    #[error("Built-in category is protected")]
    BuiltinCategoryProtected,
    #[error("Ollama is unreachable")]
    OllamaUnreachable,
    #[error("Embedding failed: {0}")]
    EmbeddingFailed(String),
    #[error("Pandoc not found")]
    PandocNotFound,
    #[error("Export failed: {0}")]
    ExportFailed(String),
    #[error("Self-relationship not allowed")]
    SelfRelationship,
    #[error("IO error: {0}")]
    IoError(String),
    #[error("Database error: {0}")]
    DatabaseError(String),
    #[error("Serialization error: {0}")]
    SerializationError(String),
    #[error("Invalid input: {0}")]
    InvalidInput(String),
}

impl From<rusqlite::Error> for LoreError {
    fn from(e: rusqlite::Error) -> Self {
        LoreError::DatabaseError(e.to_string())
    }
}

impl From<std::io::Error> for LoreError {
    fn from(e: std::io::Error) -> Self {
        LoreError::IoError(e.to_string())
    }
}

impl From<serde_json::Error> for LoreError {
    fn from(e: serde_json::Error) -> Self {
        LoreError::SerializationError(e.to_string())
    }
}

impl From<reqwest::Error> for LoreError {
    fn from(e: reqwest::Error) -> Self {
        LoreError::OllamaUnreachable
    }
}

// Tauri requires commands to return serializable errors
impl serde::Serialize for LoreError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::ser::Serializer,
    {
        use serde::ser::SerializeStruct;
        let mut s = serializer.serialize_struct("LoreError", 2)?;
        let code = match self {
            LoreError::PathNotWritable => "PATH_NOT_WRITABLE",
            LoreError::NameEmpty => "NAME_EMPTY",
            LoreError::GenreInvalid => "GENRE_INVALID",
            LoreError::NotANeworldProject => "NOT_A_NEWORLD_PROJECT",
            LoreError::DbMigrationFailed(_) => "DB_MIGRATION_FAILED",
            LoreError::EntityNotFound => "ENTITY_NOT_FOUND",
            LoreError::CategoryNotFound => "CATEGORY_NOT_FOUND",
            LoreError::NameTooLong => "NAME_TOO_LONG",
            LoreError::BuiltinCategoryProtected => "BUILTIN_CATEGORY_PROTECTED",
            LoreError::OllamaUnreachable => "OLLAMA_UNREACHABLE",
            LoreError::EmbeddingFailed(_) => "EMBEDDING_FAILED",
            LoreError::PandocNotFound => "PANDOC_NOT_FOUND",
            LoreError::ExportFailed(_) => "EXPORT_FAILED",
            LoreError::SelfRelationship => "SELF_RELATIONSHIP",
            LoreError::IoError(_) => "IO_ERROR",
            LoreError::DatabaseError(_) => "DATABASE_ERROR",
            LoreError::SerializationError(_) => "SERIALIZATION_ERROR",
            LoreError::InvalidInput(_) => "INVALID_INPUT",
        };
        s.serialize_field("code", code)?;
        s.serialize_field("message", &self.to_string())?;
        s.end()
    }
}
