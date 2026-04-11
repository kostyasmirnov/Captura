use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

fn default_version() -> u32 {
    1
}
fn default_temp_lifetime() -> u32 {
    30
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct AppSettings {
    #[serde(default = "default_version")]
    pub version: u32,
    pub save_folder: String,
    pub format: String,
    pub jpg_quality: u8,
    pub file_template: String,
    pub hotkey_area: String,
    pub hotkey_fullscreen: String,
    pub hotkey_repeat: String,
    pub after_capture: String,
    pub autostart: bool,
    pub show_in_dock: bool,
    pub capture_delay: u32,
    pub history_limit: u32,
    #[serde(default = "default_temp_lifetime")]
    pub temp_file_lifetime_minutes: u32,
}

impl Default for AppSettings {
    fn default() -> Self {
        let save_folder = dirs::picture_dir()
            .unwrap_or_else(|| PathBuf::from("~"))
            .join("Captura")
            .to_string_lossy()
            .to_string();

        AppSettings {
            version: 1,
            save_folder,
            format: "png".to_string(),
            jpg_quality: 90,
            file_template: "screenshot_{datetime}".to_string(),
            hotkey_area: "CmdOrCtrl+Shift+1".to_string(),
            hotkey_fullscreen: "CmdOrCtrl+Shift+2".to_string(),
            hotkey_repeat: "CmdOrCtrl+Shift+3".to_string(),
            after_capture: "editor".to_string(),
            autostart: false,
            show_in_dock: false,
            capture_delay: 0,
            history_limit: 50,
            temp_file_lifetime_minutes: 30,
        }
    }
}

impl AppSettings {
    pub fn config_path() -> PathBuf {
        dirs::config_dir()
            .unwrap_or_else(|| PathBuf::from("."))
            .join("io.captura.desktop")
            .join("settings.json")
    }

    fn legacy_config_path() -> PathBuf {
        dirs::config_dir()
            .unwrap_or_else(|| PathBuf::from("."))
            .join("lightshot")
            .join("settings.json")
    }

    pub fn load() -> Self {
        let path = Self::config_path();
        if path.exists() {
            if let Ok(content) = fs::read_to_string(&path) {
                let mut s: AppSettings = serde_json::from_str(&content).unwrap_or_default();
                s.apply_migrations();
                return s;
            }
        }

        // Try to migrate from legacy path
        let legacy = Self::legacy_config_path();
        if legacy.exists() {
            if let Ok(content) = fs::read_to_string(&legacy) {
                if let Ok(mut s) = serde_json::from_str::<AppSettings>(&content) {
                    s.apply_migrations();
                    let _ = s.save(); // persist to new location
                    return s;
                }
            }
        }

        Self::default()
    }

    fn apply_migrations(&mut self) {
        // v0 → v1: rename legacy "Lightshot" save folder to "Captura"
        if self.version == 0 {
            if self.save_folder.contains("Lightshot") {
                self.save_folder = self.save_folder.replace("Lightshot", "Captura");
            }
            self.version = 1;
        }
    }

    pub fn save(&self) -> Result<(), String> {
        let path = Self::config_path();
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent)
                .map_err(|e| format!("Failed to create config dir: {}", e))?;
        }
        let json = serde_json::to_string_pretty(self)
            .map_err(|e| format!("Failed to serialize settings: {}", e))?;
        fs::write(&path, json)
            .map_err(|e| format!("Failed to write settings: {}", e))?;
        Ok(())
    }
}
