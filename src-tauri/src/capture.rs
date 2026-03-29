use base64::{engine::general_purpose, Engine as _};
use image::{DynamicImage, ImageBuffer, Rgba};
use screenshots::Screen;
use serde::{Deserialize, Serialize};
use std::io::Cursor;

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct MonitorInfo {
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
    pub scale_factor: f64,
    pub is_primary: bool,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct CaptureData {
    pub image_data: String,
    pub width: u32,
    pub height: u32,
    pub offset_x: i32,
    pub offset_y: i32,
    pub screens: Vec<MonitorInfo>,
}

pub fn capture_all_screens() -> Result<CaptureData, String> {
    let screens = Screen::all().map_err(|e| format!("Failed to get screens: {}", e))?;

    if screens.is_empty() {
        return Err("No screens found".to_string());
    }

    // Screen::capture() returns image::RgbaImage at physical (Retina) resolution.
    // display_info.x/y are logical coordinates; .width/.height are logical pixels.
    struct ScreenCap {
        phys_x: i32,
        phys_y: i32,
        image: image::RgbaImage,
    }

    let mut captures: Vec<ScreenCap> = Vec::new();
    let mut monitor_infos: Vec<MonitorInfo> = Vec::new();
    let mut min_x = i32::MAX;
    let mut min_y = i32::MAX;
    let mut max_x = i32::MIN;
    let mut max_y = i32::MIN;

    for screen in &screens {
        let di = screen.display_info;
        let scale = di.scale_factor as f64;

        // screenshots uses image 0.24, our crate uses image 0.25 — same pixel layout,
        // so extract raw bytes and reconstruct to cross the version boundary.
        let screenshots_img = screen
            .capture()
            .map_err(|e| format!("Capture failed: {}", e))?;

        let phys_w = screenshots_img.width();
        let phys_h = screenshots_img.height();
        let raw_bytes: Vec<u8> = screenshots_img.into_raw();

        let rgba_img: ImageBuffer<Rgba<u8>, Vec<u8>> =
            ImageBuffer::from_raw(phys_w, phys_h, raw_bytes)
                .ok_or_else(|| "Failed to rebuild image buffer".to_string())?;

        let phys_w = rgba_img.width() as i32;
        let phys_h = rgba_img.height() as i32;
        // Physical origin from logical origin × scale
        let phys_x = (di.x as f64 * scale) as i32;
        let phys_y = (di.y as f64 * scale) as i32;

        if phys_x < min_x { min_x = phys_x; }
        if phys_y < min_y { min_y = phys_y; }
        if phys_x + phys_w > max_x { max_x = phys_x + phys_w; }
        if phys_y + phys_h > max_y { max_y = phys_y + phys_h; }

        monitor_infos.push(MonitorInfo {
            x: di.x,
            y: di.y,
            width: di.width,
            height: di.height,
            scale_factor: scale,
            is_primary: di.is_primary,
        });

        captures.push(ScreenCap { phys_x, phys_y, image: rgba_img });
    }

    let total_w = (max_x - min_x) as u32;
    let total_h = (max_y - min_y) as u32;

    let mut combined: ImageBuffer<Rgba<u8>, Vec<u8>> = ImageBuffer::new(total_w, total_h);

    for cap in &captures {
        let ox = cap.phys_x - min_x;
        let oy = cap.phys_y - min_y;
        let cw = cap.image.width();
        let ch = cap.image.height();

        for py in 0..ch {
            for px in 0..cw {
                let dest_x = ox + px as i32;
                let dest_y = oy + py as i32;
                if dest_x >= 0
                    && dest_y >= 0
                    && (dest_x as u32) < total_w
                    && (dest_y as u32) < total_h
                {
                    combined.put_pixel(dest_x as u32, dest_y as u32, *cap.image.get_pixel(px, py));
                }
            }
        }
    }

    let dynamic = DynamicImage::ImageRgba8(combined);
    let encoded = encode_image_to_base64(&dynamic)?;

    Ok(CaptureData {
        image_data: encoded,
        width: total_w,
        height: total_h,
        offset_x: min_x,
        offset_y: min_y,
        screens: monitor_infos,
    })
}

pub fn crop_image(base64_data: &str, x: u32, y: u32, w: u32, h: u32) -> Result<String, String> {
    let img = decode_base64_to_image(base64_data)?;
    let img_w = img.width();
    let img_h = img.height();

    let crop_x = x.min(img_w.saturating_sub(1));
    let crop_y = y.min(img_h.saturating_sub(1));
    let crop_w = w.min(img_w.saturating_sub(crop_x));
    let crop_h = h.min(img_h.saturating_sub(crop_y));

    if crop_w == 0 || crop_h == 0 {
        return Err("Crop dimensions are zero".to_string());
    }

    let cropped = img.crop_imm(crop_x, crop_y, crop_w, crop_h);
    encode_image_to_base64(&cropped)
}

pub fn create_thumbnail(base64_data: &str, max_size: u32) -> Result<String, String> {
    let img = decode_base64_to_image(base64_data)?;
    let thumb = img.thumbnail(max_size, max_size);
    encode_image_to_base64(&thumb)
}

pub fn encode_image_to_base64(img: &DynamicImage) -> Result<String, String> {
    let mut buf = Vec::new();
    img.write_to(&mut Cursor::new(&mut buf), image::ImageFormat::Png)
        .map_err(|e| format!("PNG encode failed: {}", e))?;
    Ok(general_purpose::STANDARD.encode(&buf))
}

pub fn decode_base64_to_image(base64_data: &str) -> Result<DynamicImage, String> {
    let b64 = if let Some(idx) = base64_data.find(',') {
        &base64_data[idx + 1..]
    } else {
        base64_data
    };

    let bytes = general_purpose::STANDARD
        .decode(b64)
        .map_err(|e| format!("Base64 decode failed: {}", e))?;

    image::load_from_memory(&bytes).map_err(|e| format!("Image decode failed: {}", e))
}
