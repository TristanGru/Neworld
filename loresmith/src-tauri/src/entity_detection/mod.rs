use aho_corasick::{AhoCorasick, AhoCorasickBuilder, MatchKind};
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct EntityMatch {
    pub entity_id: String,
    pub name: String,
    pub start: usize,
    pub end: usize,
}

pub struct EntityDetector {
    ac: AhoCorasick,
    patterns: Vec<(String, String)>, // (pattern_text, entity_id)
}

impl EntityDetector {
    pub fn new(entities: Vec<(String, String, Vec<String>)>) -> Self {
        // entities: (entity_id, name, aliases)
        let mut patterns: Vec<(String, String)> = Vec::new();

        for (id, name, aliases) in &entities {
            if name.len() >= 3 {
                patterns.push((name.to_lowercase(), id.clone()));
            }
            for alias in aliases {
                if alias.len() >= 3 {
                    patterns.push((alias.to_lowercase(), id.clone()));
                }
            }
        }

        let pattern_strs: Vec<&str> = patterns.iter().map(|(p, _)| p.as_str()).collect();

        let ac = AhoCorasickBuilder::new()
            .ascii_case_insensitive(true)
            .match_kind(MatchKind::LeftmostLongest)
            .build(pattern_strs)
            .expect("Failed to build Aho-Corasick automaton");

        EntityDetector { ac, patterns }
    }

    pub fn detect(&self, prose: &str) -> Vec<EntityMatch> {
        if prose.is_empty() || self.patterns.is_empty() {
            return vec![];
        }

        let mut matches = Vec::new();

        for mat in self.ac.find_iter(prose) {
            let (pattern_text, entity_id) = &self.patterns[mat.pattern().as_usize()];
            let start = mat.start();
            let end = mat.end();

            // Verify word boundaries to avoid partial matches
            let before_ok = start == 0 || {
                let ch = prose[..start].chars().last().unwrap_or(' ');
                !ch.is_alphanumeric() && ch != '\''
            };
            let after_ok = end >= prose.len() || {
                let ch = prose[end..].chars().next().unwrap_or(' ');
                !ch.is_alphanumeric() && ch != '\''
            };

            if before_ok && after_ok {
                let matched_text = &prose[start..end];
                matches.push(EntityMatch {
                    entity_id: entity_id.clone(),
                    name: matched_text.to_string(),
                    start,
                    end,
                });
            }
        }

        matches
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_basic_detection() {
        let entities = vec![
            ("id1".to_string(), "Elara Voss".to_string(), vec!["The Pale Witch".to_string()]),
        ];
        let detector = EntityDetector::new(entities);
        let matches = detector.detect("Elara Voss walked into the room.");
        assert_eq!(matches.len(), 1);
        assert_eq!(matches[0].entity_id, "id1");
        assert_eq!(matches[0].name, "Elara Voss");
    }

    #[test]
    fn test_alias_detection() {
        let entities = vec![
            ("id1".to_string(), "Elara Voss".to_string(), vec!["The Pale Witch".to_string()]),
        ];
        let detector = EntityDetector::new(entities);
        let matches = detector.detect("The Pale Witch cast a spell.");
        assert_eq!(matches.len(), 1);
        assert_eq!(matches[0].entity_id, "id1");
    }

    #[test]
    fn test_min_length_filter() {
        let entities = vec![
            ("id1".to_string(), "Ed".to_string(), vec![]),
        ];
        let detector = EntityDetector::new(entities);
        let matches = detector.detect("Ed walked in.");
        // "Ed" is 2 chars, should not be detected
        assert_eq!(matches.len(), 0);
    }

    #[test]
    fn test_case_insensitive() {
        let entities = vec![
            ("id1".to_string(), "Elara".to_string(), vec![]),
        ];
        let detector = EntityDetector::new(entities);
        let matches = detector.detect("ELARA appeared.");
        assert_eq!(matches.len(), 1);
    }
}
