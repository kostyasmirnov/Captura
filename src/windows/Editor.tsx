import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Stage, Layer, Image as KonvaImage, Arrow, Rect, Ellipse, Line, Text, Group, Circle } from 'react-konva';
import Konva from 'konva';
import { invoke } from '@tauri-apps/api/core';
import { save } from '@tauri-apps/plugin-dialog';
import { useAppStore } from '../store/useAppStore';
import {
  Annotation,
  ArrowAnnotation, RectAnnotation, EllipseAnnotation,
  FreehandAnnotation, MarkerAnnotation,
  TextAnnotation, PinAnnotation, BlurAnnotation, EraserAnnotation,
} from '../types';
import FloatingToolbar from '../components/FloatingToolbar';
import { v4 as uuidv4 } from '../utils/uuid';

function useImage(src: string | null): HTMLImageElement | null {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  useEffect(() => {
    if (!src) return;
    const image = new window.Image();
    image.onload = () => setImg(image);
    image.src = src.startsWith('data:') ? src : `data:image/png;base64,${src}`;
  }, [src]);
  return img;
}

export default function Editor() {
  const stageRef = useRef<Konva.Stage>(null);
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const bgImage = useImage(imageSrc);
  const [stageSize, setStageSize] = useState({ width: 800, height: 600 });
  const [imageOffset, setImageOffset] = useState({ x: 0, y: 0 });
  const [imageSize, setImageSize] = useState({ width: 800, height: 600 });
  const [currentAnnotation, setCurrentAnnotation] = useState<Annotation | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const [pinCount, setPinCount] = useState(0);
  const [blurImages, setBlurImages] = useState<Record<string, HTMLImageElement>>({});

  const {
    currentTool, strokeColor, fillColor, strokeWidth, opacity, fontSize,
    annotations, addAnnotation, updateAnnotation, undo, redo, clearAnnotations,
  } = useAppStore();

  useEffect(() => {
    invoke<string>('get_edit_image')
      .then(data => setImageSrc(`data:image/png;base64,${data}`))
      .catch(console.error);
  }, []);

  // Fit image to window (no toolbar sidebar, full window)
  useEffect(() => {
    if (!bgImage) return;
    const BOTTOM_BAR = 64;
    const PADDING = 24;
    const maxW = window.innerWidth - PADDING * 2;
    const maxH = window.innerHeight - BOTTOM_BAR - PADDING * 2;
    const scale = Math.min(1, maxW / bgImage.naturalWidth, maxH / bgImage.naturalHeight);
    const w = Math.round(bgImage.naturalWidth * scale);
    const h = Math.round(bgImage.naturalHeight * scale);
    setStageSize({ width: w, height: h });
    setImageSize({ width: w, height: h });
    setImageOffset({ x: 0, y: 0 });
  }, [bgImage]);

  const getPos = (stage: Konva.Stage) => {
    const pos = stage.getPointerPosition();
    return pos ? { x: pos.x - imageOffset.x, y: pos.y - imageOffset.y } : { x: 0, y: 0 };
  };

  const makeBase = () => ({ id: uuidv4(), strokeColor, fillColor, strokeWidth, opacity } as any);

  const onMouseDown = useCallback((e: Konva.KonvaEventObject<MouseEvent>) => {
    if (editingTextId) return;
    const stage = stageRef.current;
    if (!stage) return;
    const pos = getPos(stage);
    if (pos.x < 0 || pos.y < 0 || pos.x > imageSize.width || pos.y > imageSize.height) return;
    setIsDrawing(true);

    switch (currentTool) {
      case 'arrow':
        setCurrentAnnotation({ ...makeBase(), tool: 'arrow', x1: pos.x, y1: pos.y, x2: pos.x, y2: pos.y } as ArrowAnnotation);
        break;
      case 'rectangle':
        setCurrentAnnotation({ ...makeBase(), tool: 'rectangle', x: pos.x, y: pos.y, width: 0, height: 0 } as RectAnnotation);
        break;
      case 'ellipse':
        setCurrentAnnotation({ ...makeBase(), tool: 'ellipse', x: pos.x, y: pos.y, radiusX: 0, radiusY: 0 } as EllipseAnnotation);
        break;
      case 'line':
      case 'freehand':
        setCurrentAnnotation({ ...makeBase(), tool: 'freehand', points: [pos.x, pos.y] } as FreehandAnnotation);
        break;
      case 'marker':
        setCurrentAnnotation({ ...makeBase(), tool: 'marker', points: [pos.x, pos.y], strokeWidth: Math.max(strokeWidth, 15), opacity: 0.5 } as MarkerAnnotation);
        break;
      case 'eraser':
        setCurrentAnnotation({ ...makeBase(), tool: 'eraser', points: [pos.x, pos.y], strokeColor: '#fff', strokeWidth: Math.max(strokeWidth * 5, 20) } as EraserAnnotation);
        break;
      case 'text': {
        const id = uuidv4();
        const ann: TextAnnotation = { ...makeBase(), id, tool: 'text', x: pos.x, y: pos.y, text: 'Text', fontSize, fontFamily: '-apple-system, sans-serif' };
        addAnnotation(ann);
        setEditingTextId(id);
        setIsDrawing(false);
        break;
      }
      case 'pin': {
        const count = pinCount + 1;
        setPinCount(count);
        addAnnotation({ ...makeBase(), tool: 'pin', x: pos.x, y: pos.y, index: count } as PinAnnotation);
        setIsDrawing(false);
        break;
      }
      case 'blur':
        setCurrentAnnotation({ ...makeBase(), tool: 'blur', x: pos.x, y: pos.y, width: 0, height: 0, blurRadius: 10 } as BlurAnnotation);
        break;
    }
  }, [currentTool, strokeColor, fillColor, strokeWidth, opacity, fontSize, imageOffset, imageSize, editingTextId, pinCount, addAnnotation]);

  const onMouseMove = useCallback((e: Konva.KonvaEventObject<MouseEvent>) => {
    if (!isDrawing || !currentAnnotation) return;
    const stage = stageRef.current;
    if (!stage) return;
    const pos = getPos(stage);

    switch (currentAnnotation.tool) {
      case 'arrow':
        setCurrentAnnotation({ ...currentAnnotation as ArrowAnnotation, x2: pos.x, y2: pos.y });
        break;
      case 'rectangle':
        setCurrentAnnotation({ ...currentAnnotation as RectAnnotation, width: pos.x - (currentAnnotation as RectAnnotation).x, height: pos.y - (currentAnnotation as RectAnnotation).y });
        break;
      case 'ellipse': {
        const ea = currentAnnotation as EllipseAnnotation;
        setCurrentAnnotation({ ...ea, radiusX: Math.abs(pos.x - ea.x) / 2, radiusY: Math.abs(pos.y - ea.y) / 2, x: (ea.x + pos.x) / 2, y: (ea.y + pos.y) / 2 });
        break;
      }
      case 'freehand': case 'marker': case 'eraser':
        setCurrentAnnotation({ ...currentAnnotation as FreehandAnnotation, points: [...(currentAnnotation as FreehandAnnotation).points, pos.x, pos.y] });
        break;
      case 'blur':
        setCurrentAnnotation({ ...currentAnnotation as BlurAnnotation, width: pos.x - (currentAnnotation as BlurAnnotation).x, height: pos.y - (currentAnnotation as BlurAnnotation).y });
        break;
    }
  }, [isDrawing, currentAnnotation, imageOffset]);

  const onMouseUp = useCallback(async () => {
    if (!isDrawing || !currentAnnotation) { setIsDrawing(false); return; }
    setIsDrawing(false);
    if (currentAnnotation.tool === 'blur') {
      const ba = currentAnnotation as BlurAnnotation;
      const blurImg = await generateBlurImage(ba);
      if (blurImg) setBlurImages(prev => ({ ...prev, [ba.id]: blurImg }));
    }
    addAnnotation(currentAnnotation);
    setCurrentAnnotation(null);
  }, [isDrawing, currentAnnotation, addAnnotation]);

  const generateBlurImage = async (ba: BlurAnnotation): Promise<HTMLImageElement | null> => {
    if (!bgImage || ba.width === 0 || ba.height === 0) return null;
    const off = document.createElement('canvas');
    const x = Math.min(ba.x, ba.x + ba.width), y = Math.min(ba.y, ba.y + ba.height);
    const w = Math.abs(ba.width), h = Math.abs(ba.height);
    const sx = bgImage.naturalWidth / imageSize.width, sy = bgImage.naturalHeight / imageSize.height;
    off.width = w; off.height = h;
    const ctx = off.getContext('2d')!;
    ctx.filter = `blur(${ba.blurRadius}px)`;
    ctx.drawImage(bgImage, x * sx, y * sy, w * sx, h * sy, 0, 0, w, h);
    return new Promise(resolve => {
      const img = new window.Image();
      img.onload = () => resolve(img);
      img.src = off.toDataURL('image/png');
    });
  };

  const getExportDataUrl = useCallback((): string => {
    const stage = stageRef.current;
    if (!stage) return '';
    return stage.toDataURL({ mimeType: 'image/png', x: imageOffset.x, y: imageOffset.y, width: imageSize.width, height: imageSize.height });
  }, [imageOffset, imageSize]);

  const handleCopyRef = useRef<() => void>(() => {});
  const handleCopy = useCallback(async () => {
    const base64 = getExportDataUrl().split(',')[1];
    if (!base64) return;
    await invoke('copy_to_clipboard', { imageData: base64 }).catch(console.error);
  }, [getExportDataUrl]);
  useEffect(() => { handleCopyRef.current = handleCopy; }, [handleCopy]);

  const handleSave = useCallback(async () => {
    const base64 = getExportDataUrl().split(',')[1];
    if (!base64) return;
    await invoke('save_screenshot', { imageData: base64, path: null, format: null }).catch(console.error);
  }, [getExportDataUrl]);

  const handleSaveAs = useCallback(async () => {
    const dataUrl = getExportDataUrl();
    if (!dataUrl) return;
    const base64 = dataUrl.split(',')[1];
    const filePath = await save({ filters: [{ name: 'PNG', extensions: ['png'] }, { name: 'JPEG', extensions: ['jpg', 'jpeg'] }, { name: 'WebP', extensions: ['webp'] }] });
    if (filePath) {
      const ext = filePath.split('.').pop()?.toLowerCase() || 'png';
      await invoke('save_screenshot', { imageData: base64, path: filePath, format: ext }).catch(console.error);
    }
  }, [getExportDataUrl]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { window.close(); return; }
      if (e.key === 'z' && (e.metaKey || e.ctrlKey)) { e.shiftKey ? redo() : undo(); e.preventDefault(); return; }
      if (e.key === 'c' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        handleCopyRef.current();
        // Close after copy (like Lightshot behaviour)
        setTimeout(() => window.close(), 150);
        return;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [undo, redo]);

  const handleTextDblClick = useCallback((id: string, node: Konva.Text) => {
    setEditingTextId(id);
    const ann = annotations.find(a => a.id === id) as TextAnnotation | undefined;
    if (!ann) return;
    const stage = stageRef.current!;
    const box = stage.container().getBoundingClientRect();
    const tp = node.getAbsolutePosition();
    const ta = document.createElement('textarea');
    ta.value = ann.text;
    Object.assign(ta.style, {
      position: 'fixed',
      left: `${box.left + tp.x}px`, top: `${box.top + tp.y}px`,
      fontSize: `${ann.fontSize}px`, color: ann.strokeColor,
      border: '2px solid #4d90fe', outline: 'none',
      background: 'transparent', zIndex: '9999', minWidth: '100px',
    });
    document.body.appendChild(ta);
    ta.focus(); ta.select();
    const cleanup = () => {
      updateAnnotation(id, { text: ta.value });
      document.body.removeChild(ta);
      setEditingTextId(null);
    };
    ta.addEventListener('blur', cleanup);
    ta.addEventListener('keydown', ke => { if (ke.key === 'Escape' || (ke.key === 'Enter' && !ke.shiftKey)) cleanup(); });
  }, [annotations, updateAnnotation]);

  const renderAnnotation = (ann: Annotation, isPreview = false) => {
    const key = isPreview ? 'preview' : ann.id;
    const base = { key, opacity: ann.opacity, listening: !isPreview && currentTool === 'select' };

    switch (ann.tool) {
      case 'arrow': {
        const a = ann as ArrowAnnotation;
        return <Arrow {...base} x={imageOffset.x} y={imageOffset.y} points={[a.x1, a.y1, a.x2, a.y2]} stroke={a.strokeColor} strokeWidth={a.strokeWidth} fill={a.strokeColor} pointerLength={12} pointerWidth={10} lineCap="round" />;
      }
      case 'rectangle': {
        const a = ann as RectAnnotation;
        return <Rect {...base} x={imageOffset.x + (a.width < 0 ? a.x + a.width : a.x)} y={imageOffset.y + (a.height < 0 ? a.y + a.height : a.y)} width={Math.abs(a.width)} height={Math.abs(a.height)} stroke={a.strokeColor} strokeWidth={a.strokeWidth} fill={a.fillColor === 'transparent' ? undefined : a.fillColor} />;
      }
      case 'ellipse': {
        const a = ann as EllipseAnnotation;
        return <Ellipse {...base} x={imageOffset.x + a.x} y={imageOffset.y + a.y} radiusX={a.radiusX} radiusY={a.radiusY} stroke={a.strokeColor} strokeWidth={a.strokeWidth} fill={a.fillColor === 'transparent' ? undefined : a.fillColor} />;
      }
      case 'freehand': case 'line': {
        const a = ann as FreehandAnnotation;
        return <Line {...base} x={imageOffset.x} y={imageOffset.y} points={a.points} stroke={a.strokeColor} strokeWidth={a.strokeWidth} tension={0.5} lineCap="round" lineJoin="round" />;
      }
      case 'marker': {
        const a = ann as MarkerAnnotation;
        return <Line {...base} x={imageOffset.x} y={imageOffset.y} points={a.points} stroke={a.strokeColor} strokeWidth={a.strokeWidth} tension={0.5} lineCap="round" lineJoin="round" globalCompositeOperation="multiply" opacity={0.5} />;
      }
      case 'eraser': {
        const a = ann as EraserAnnotation;
        return <Line {...base} x={imageOffset.x} y={imageOffset.y} points={a.points} stroke="#fff" strokeWidth={a.strokeWidth} tension={0.5} lineCap="round" lineJoin="round" globalCompositeOperation="destination-out" />;
      }
      case 'text': {
        const a = ann as TextAnnotation;
        return <Text {...base} x={imageOffset.x + a.x} y={imageOffset.y + a.y} text={editingTextId === a.id ? '' : a.text} fontSize={a.fontSize} fill={a.strokeColor} fontFamily={a.fontFamily} draggable={currentTool === 'select'} onDblClick={e => handleTextDblClick(a.id, e.target as Konva.Text)} onDragEnd={e => updateAnnotation(a.id, { x: e.target.x() - imageOffset.x, y: e.target.y() - imageOffset.y })} />;
      }
      case 'pin': {
        const a = ann as PinAnnotation;
        return (
          <Group {...base} x={imageOffset.x + a.x} y={imageOffset.y + a.y} draggable={currentTool === 'select'} onDragEnd={e => updateAnnotation(a.id, { x: e.target.x() - imageOffset.x, y: e.target.y() - imageOffset.y })}>
            <Circle radius={14} fill="#ff3b30" />
            <Text text={String(a.index)} fontSize={12} fill="#fff" fontStyle="bold" align="center" verticalAlign="middle" x={-14} y={-7} width={28} height={14} />
          </Group>
        );
      }
      case 'blur': {
        const a = ann as BlurAnnotation;
        const bi = blurImages[a.id];
        const x = a.width < 0 ? a.x + a.width : a.x, y = a.height < 0 ? a.y + a.height : a.y;
        const w = Math.abs(a.width), h = Math.abs(a.height);
        if (!bi) return <Rect {...base} x={imageOffset.x + x} y={imageOffset.y + y} width={w} height={h} fill="rgba(0,0,0,0.3)" stroke="#4d90fe" strokeWidth={1} dash={[4, 4]} />;
        return <KonvaImage {...base} x={imageOffset.x + x} y={imageOffset.y + y} width={w} height={h} image={bi} />;
      }
      default: return null;
    }
  };

  const stageCursor = currentTool === 'eraser' ? 'cell' : currentTool === 'text' ? 'text' : 'crosshair';

  return (
    <div style={{ width: '100vw', height: '100vh', background: '#1a1a1a', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}>
      {bgImage ? (
        <Stage
          ref={stageRef}
          width={stageSize.width}
          height={stageSize.height}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          style={{ cursor: stageCursor, boxShadow: '0 8px 40px rgba(0,0,0,0.7)' }}
        >
          <Layer>
            <KonvaImage image={bgImage} x={imageOffset.x} y={imageOffset.y} width={imageSize.width} height={imageSize.height} />
          </Layer>
          <Layer>
            {annotations.map(ann => renderAnnotation(ann))}
            {currentAnnotation && renderAnnotation(currentAnnotation, true)}
          </Layer>
        </Stage>
      ) : (
        <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>Loading…</div>
      )}

      {/* Floating toolbar at bottom center */}
      <div style={{ position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)', zIndex: 100 }}>
        <FloatingToolbar
          onCopy={handleCopy}
          onSave={handleSave}
          onSaveAs={handleSaveAs}
          onClose={() => window.close()}
        />
      </div>
    </div>
  );
}
