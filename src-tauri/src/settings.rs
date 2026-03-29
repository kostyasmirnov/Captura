use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct AppSettings {
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
}

impl Default for AppSettings {
    fn default() -> Self {
        let save_folder = dirs::picture_dir()
            .unwrap_or_else(|| PathBuf::from("~"))
            .join("Lightshot")
            .to_string_lossy()
            .to_string();

        AppSettings {
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
        }
    }
}

impl AppSettings {
    pub fn config_path() -> PathBuf {
        dirs::config_dir()
            .unwrap_or_else(|| PathBuf::from("."))
            .join("lightshot")
            .join("settings.json")
    }

    pub fn load() -> Self {
        let path = Self::config_path();
        if path.exists() {
            match fs::read_to_string(&path) {
                Ok(content) => {
                    serde_json::from_str(&content).unwrap_or_default()
                }
                Err(_) => Self::default(),
            }
        } else {
            Self::default()
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
