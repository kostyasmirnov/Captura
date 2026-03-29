export interface MonitorInfo {
  x: number;
  y: number;
  width: number;
  height: number;
  scale_factor: number;
  is_primary: boolean;
}

export interface CaptureData {
  image_data: string;
  width: number;
  height: number;
  offset_x: number;
  offset_y: number;
  screens: MonitorInfo[];
}

export interface AppSettings {
  save_folder: string;
  format: string;
  jpg_quality: number;
  file_template: string;
  hotkey_area: string;
  hotkey_fullscreen: string;
  hotkey_repeat: string;
  after_capture: string;
  autostart: boolean;
  show_in_dock: boolean;
  capture_delay: number;
  history_limit: number;
}

export interface HistoryEntry {
  id: string;
  timestamp: number;
  file_path: string | null;
  thumbnail: string;
  width: number;
  height: number;
}

export type AnnotationTool =
  | 'select'
  | 'arrow'
  | 'rectangle'
  | 'ellipse'
  | 'line'
  | 'freehand'
  | 'marker'
  | 'text'
  | 'pin'
  | 'blur'
  | 'eraser';

export interface Point {
  x: number;
  y: number;
}

export interface BaseAnnotation {
  id: string;
  tool: AnnotationTool;
  strokeColor: string;
  fillColor: string;
  strokeWidth: number;
  opacity: number;
}

export interface ArrowAnnotation extends BaseAnnotation {
  tool: 'arrow';
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface RectAnnotation extends BaseAnnotation {
  tool: 'rectangle';
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface EllipseAnnotation extends BaseAnnotation {
  tool: 'ellipse';
  x: number;
  y: number;
  radiusX: number;
  radiusY: number;
}

export interface LineAnnotation extends BaseAnnotation {
  tool: 'line';
  points: number[];
}

export interface FreehandAnnotation extends BaseAnnotation {
  tool: 'freehand';
  points: number[];
}

export interface MarkerAnnotation extends BaseAnnotation {
  tool: 'marker';
  points: number[];
}

export interface TextAnnotation extends BaseAnnotation {
  tool: 'text';
  x: number;
  y: number;
  text: string;
  fontSize: number;
  fontFamily: string;
}

export interface PinAnnotation extends BaseAnnotation {
  tool: 'pin';
  x: number;
  y: number;
  index: number;
}

export interface BlurAnnotation extends BaseAnnotation {
  tool: 'blur';
  x: number;
  y: number;
  width: number;
  height: number;
  blurRadius: number;
}

export interface EraserAnnotation extends BaseAnnotation {
  tool: 'eraser';
  points: number[];
}

export type Annotation =
  | ArrowAnnotation
  | RectAnnotation
  | EllipseAnnotation
  | LineAnnotation
  | FreehandAnnotation
  | MarkerAnnotation
  | TextAnnotation
  | PinAnnotation
  | BlurAnnotation
  | EraserAnnotation;
