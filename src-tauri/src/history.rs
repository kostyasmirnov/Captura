use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct HistoryEntry {
    pub id: String,
    pub timestamp: i64,
    pub file_path: Option<String>,
    pub thumbnail: String,
    pub width: u32,
    pub height: u32,
}

pub struct HistoryManager {
    pub entries: Vec<HistoryEntry>,
    pub limit: usize,
}

impl HistoryManager {
    pub fn new(limit: usize) -> Self {
        let mut manager = HistoryManager {
            entries: Vec::new(),
            limit,
        };
        manager.load_from_disk();
        manager
    }

    pub fn add(&mut self, entry: HistoryEntry) {
        // Remove oldest if over limit
        while self.entries.len() >= self.limit {
            self.entries.pop();
        }
        self.entries.insert(0, entry);
        let _ = self.save_to_disk();
    }

    pub fn remove(&mut self, id: &str, delete_file: bool) {
        if let Some(idx) = self.entries.iter().position(|e| e.id == id) {
            let entry = self.entries.remove(idx);
            if delete_file {
                if let Some(path) = &entry.file_path {
                    let _ = fs::remove_file(path);
                }
            }
        }
        let _ = self.save_to_disk();
    }

    pub fn get_all(&self) -> &Vec<HistoryEntry> {
        &self.entries
    }

    pub fn get_by_id(&self, id: &str) -> Option<&HistoryEntry> {
        self.entries.iter().find(|e| e.id == id)
    }

    pub fn history_path() -> PathBuf {
        dirs::config_dir()
            .unwrap_or_else(|| PathBuf::from("."))
            .join("lightshot")
            .join("history.json")
    }

    pub fn save_to_disk(&self) -> Result<(), String> {
        let path = Self::history_path();
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent)
                .map_err(|e| format!("Failed to create config dir: {}", e))?;
        }
        let json = serde_json::to_string_pretty(&self.entries)
            .map_err(|e| format!("Failed to serialize history: {}", e))?;
        fs::write(&path, json)
            .map_err(|e| format!("Failed to write history: {}", e))?;
        Ok(())
    }

    pub fn load_from_disk(&mut self) {
        let path = Self::history_path();
        if path.exists() {
            if let Ok(content) = fs::read_to_string(&path) {
                if let Ok(entries) = serde_json::from_str::<Vec<HistoryEntry>>(&content) {
                    self.entries = entries;
                }
            }
        }
    }
}
