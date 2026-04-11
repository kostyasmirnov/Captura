use std::fs;
use std::path::PathBuf;

pub fn temp_dir() -> PathBuf {
    dirs::cache_dir()
        .unwrap_or_else(|| PathBuf::from("/tmp"))
        .join("io.captura.desktop")
        .join("temp")
}

/// Save image data (base64-encoded PNG) to a temp file and return the path.
pub fn save_temp_image(image_data: &str) -> Result<PathBuf, String> {
    let dir = temp_dir();
    fs::create_dir_all(&dir).map_err(|e| format!("Cannot create temp dir: {}", e))?;

    let filename = format!("screenshot_{}.png", uuid::Uuid::new_v4());
    let path = dir.join(&filename);

    let img = crate::capture::decode_base64_to_image(image_data)?;
    img.save_with_format(&path, image::ImageFormat::Png)
        .map_err(|e| format!("Failed to save temp image: {}", e))?;

    Ok(path)
}

/// Delete temp files older than `lifetime_minutes`.
pub fn cleanup_old_temp_files(lifetime_minutes: u64) {
    let dir = temp_dir();
    if !dir.exists() {
        return;
    }

    let cutoff = std::time::SystemTime::now()
        .checked_sub(std::time::Duration::from_secs(lifetime_minutes * 60))
        .unwrap_or(std::time::SystemTime::UNIX_EPOCH);

    if let Ok(entries) = fs::read_dir(&dir) {
        for entry in entries.flatten() {
            if let Ok(metadata) = entry.metadata() {
                if let Ok(modified) = metadata.modified() {
                    if modified < cutoff {
                        let _ = fs::remove_file(entry.path());
                    }
                }
            }
        }
    }
}
