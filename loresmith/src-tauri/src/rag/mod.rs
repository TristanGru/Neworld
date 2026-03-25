use rusqlite::Connection;
use serde::{Deserialize, Serialize};

use crate::errors::LoreError;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct RagChunk {
    pub id: i64,
    pub source_type: String,
    pub source_id: String,
    pub content: String,
    pub chunk_index: i64,
    pub score: f32,
}

/// Cosine similarity between two vectors
fn cosine_similarity(a: &[f32], b: &[f32]) -> f32 {
    if a.len() != b.len() || a.is_empty() {
        return 0.0;
    }
    let dot: f32 = a.iter().zip(b.iter()).map(|(x, y)| x * y).sum();
    let norm_a: f32 = a.iter().map(|x| x * x).sum::<f32>().sqrt();
    let norm_b: f32 = b.iter().map(|x| x * x).sum::<f32>().sqrt();
    if norm_a == 0.0 || norm_b == 0.0 {
        return 0.0;
    }
    dot / (norm_a * norm_b)
}

/// Retrieve top_k most similar chunks from embedding_documents table
pub fn retrieve_chunks(
    conn: &Connection,
    project_id: &str,
    query_embedding: &[f32],
    top_k: usize,
) -> Result<Vec<RagChunk>, LoreError> {
    let mut stmt = conn.prepare(
        "SELECT id, source_type, source_id, content, chunk_index, embedding FROM embedding_documents WHERE project_id = ?1 AND embedding IS NOT NULL"
    )?;

    let mut scored: Vec<(f32, RagChunk)> = stmt.query_map([project_id], |row| {
        let id: i64 = row.get(0)?;
        let source_type: String = row.get(1)?;
        let source_id: String = row.get(2)?;
        let content: String = row.get(3)?;
        let chunk_index: i64 = row.get(4)?;
        let embedding_json: String = row.get(5)?;
        Ok((id, source_type, source_id, content, chunk_index, embedding_json))
    })?.filter_map(|r| r.ok()).filter_map(|(id, source_type, source_id, content, chunk_index, emb_json)| {
        let embedding: Vec<f32> = serde_json::from_str(&emb_json).ok()?;
        let mut score = cosine_similarity(query_embedding, &embedding);
        // Weight entity chunks 2x over prose chunks (BL-009)
        if source_type == "entity" {
            score *= 2.0;
        }
        Some((score, RagChunk { id, source_type, source_id, content, chunk_index, score }))
    }).collect();

    scored.sort_by(|a, b| b.0.partial_cmp(&a.0).unwrap_or(std::cmp::Ordering::Equal));
    scored.truncate(top_k);

    Ok(scored.into_iter().map(|(_, chunk)| chunk).collect())
}

/// Split text into chunks of ~512 tokens (approx 2048 chars)
pub fn chunk_text(text: &str) -> Vec<String> {
    if text.is_empty() {
        return vec![];
    }

    let chunk_size = 2048;
    let mut chunks = Vec::new();

    // Split by paragraphs first
    let paragraphs: Vec<&str> = text.split("\n\n").collect();
    let mut current_chunk = String::new();

    for para in paragraphs {
        if current_chunk.len() + para.len() + 2 > chunk_size && !current_chunk.is_empty() {
            chunks.push(current_chunk.trim().to_string());
            current_chunk = String::new();
        }
        if !current_chunk.is_empty() {
            current_chunk.push_str("\n\n");
        }
        current_chunk.push_str(para);
    }

    if !current_chunk.trim().is_empty() {
        chunks.push(current_chunk.trim().to_string());
    }

    chunks
}

/// Upsert embedding document for an entity
pub fn upsert_entity_embedding(
    conn: &Connection,
    project_id: &str,
    entity_id: &str,
    entity_text: &str,
    embedding: &[f32],
) -> Result<(), LoreError> {
    let now = chrono::Utc::now().timestamp();
    let embedding_json = serde_json::to_string(embedding)?;

    // Delete existing embedding for this entity
    conn.execute(
        "DELETE FROM embedding_documents WHERE project_id = ?1 AND source_type = 'entity' AND source_id = ?2",
        rusqlite::params![project_id, entity_id],
    )?;

    conn.execute(
        "INSERT INTO embedding_documents (project_id, source_type, source_id, chunk_index, content, updated_at, embedding) VALUES (?1, 'entity', ?2, 0, ?3, ?4, ?5)",
        rusqlite::params![project_id, entity_id, entity_text, now, embedding_json],
    )?;

    Ok(())
}

/// Upsert prose chunks for a chapter
pub fn upsert_prose_embeddings(
    conn: &Connection,
    project_id: &str,
    chapter_id: &str,
    prose: &str,
    embeddings: &[(usize, String, Vec<f32>)], // (chunk_index, chunk_text, embedding)
) -> Result<(), LoreError> {
    let now = chrono::Utc::now().timestamp();

    // Delete existing chunks for this chapter
    conn.execute(
        "DELETE FROM embedding_documents WHERE project_id = ?1 AND source_type = 'prose' AND source_id = ?2",
        rusqlite::params![project_id, chapter_id],
    )?;

    for (chunk_index, chunk_text, embedding) in embeddings {
        let embedding_json = serde_json::to_string(embedding)?;
        conn.execute(
            "INSERT INTO embedding_documents (project_id, source_type, source_id, chunk_index, content, updated_at, embedding) VALUES (?1, 'prose', ?2, ?3, ?4, ?5, ?6)",
            rusqlite::params![project_id, chapter_id, *chunk_index as i64, chunk_text, now, embedding_json],
        )?;
    }

    Ok(())
}
