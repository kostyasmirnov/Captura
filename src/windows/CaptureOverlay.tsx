import React, { useEffect, useRef, useState, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { save } from '@tauri-apps/plugin-dialog';
import { getCurrentWindow } from '@tauri-apps/api/window';

// ─── Types ─────────────────────────────────────────────────────────────────────

type Phase = 'sel' | 'ann';
type Handle = 'nw' | 'n' | 'ne' | 'w' | 'e' | 'sw' | 's' | 'se' | 'move' | null;
type AnnTool = 'pen' | 'arrow' | 'rect' | 'ellipse' | 'marker' | 'text';

interface Box { x: number; y: number; w: number; h: number; }

type Stroke =
  | { id: string; kind: 'pen' | 'marker'; color: string; size: number; pts: number[] }
  | { id: string; kind: 'arrow'; color: string; size: number; x1: number; y1: number; x2: number; y2: number }
  | { id: string; kind: 'rect'; color: string; size: number; x: number; y: number; w: number; h: number }
  | { id: string; kind: 'ellipse'; color: string; size: number; x: number; y: number; w: number; h: number }
  | { id: string; kind: 'text'; color: string; size: number; x: number; y: number; text: string };

// ─── Constants ─────────────────────────────────────────────────────────────────

const COLORS = ['#ff3b30', '#ff9500', '#ffcc00', '#34c759', '#007aff', '#5856d6', '#000000', '#ffffff'];
const HANDLE_R = 5;

// ─── SVG icons ─────────────────────────────────────────────────────────────────

const IcoPen = () => (
  <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 2l3 3-8 8H3v-3l8-8z" />
  </svg>
);
const IcoArrow = () => (
  <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <line x1="3" y1="13" x2="12" y2="4" />
    <polyline points="6,4 12,4 12,10" />
  </svg>
);
const IcoRect = () => (
  <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round">
    <rect x="2" y="3" width="12" height="10" rx="1" />
  </svg>
);
const IcoEllipse = () => (
  <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6">
    <ellipse cx="8" cy="8" rx="6" ry="5" />
  </svg>
);
const IcoMarker = () => (
  <svg width="15" height="15" viewBox="0 0 16 16">
    <rect x="2" y="5" width="12" height="6" rx="3" fill="currentColor" opacity="0.65" />
  </svg>
);
const IcoText = () => (
  <svg width="15" height="15" viewBox="0 0 16 16">
    <text x="2" y="13" fontSize="13" fontWeight="bold" fill="currentColor" fontFamily="-apple-system,sans-serif">T</text>
  </svg>
);
const IcoUndo = () => (
  <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3.5 7.5a5 5 0 1 1 1.5 3.5" />
    <polyline points="1,5 3.5,7.5 6,5" />
  </svg>
);
const IcoCopy = () => (
  <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
    <rect x="4" y="4" width="9" height="9" rx="1" />
    <path d="M4 3V2a1 1 0 0 1 1-1h6l3 3v6a1 1 0 0 1-1 1h-1" />
  </svg>
);
const IcoSave = () => (
  <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 1h8l4 4v8H1V1z" />
    <rect x="4" y="1" width="5" height="3.5" />
    <rect x="3" y="8" width="8" height="5" />
  </svg>
);

const TOOLS: { id: AnnTool; icon: React.ReactElement; title: string; key: string }[] = [
  { id: 'pen',     icon: <IcoPen />,     title: 'Pen (P)',       key: 'p' },
  { id: 'arrow',   icon: <IcoArrow />,   title: 'Arrow (A)',     key: 'a' },
  { id: 'rect',    icon: <IcoRect />,    title: 'Rectangle (R)', key: 'r' },
  { id: 'ellipse', icon: <IcoEllipse />, title: 'Ellipse (E)',   key: 'e' },
  { id: 'marker',  icon: <IcoMarker />,  title: 'Marker (M)',    key: 'm' },
  { id: 'text',    icon: <IcoText />,    title: 'Text (T)',      key: 't' },
];

// ─── Canvas utilities ──────────────────────────────────────────────────────────

function normBox(x: number, y: number, w: number, h: number): Box {
  return { x: w >= 0 ? x : x + w, y: h >= 0 ? y : y + h, w: Math.abs(w), h: Math.abs(h) };
}

function drawArrowShape(
  ctx: CanvasRenderingContext2D,
  x1: number, y1: number, x2: number, y2: number,
  color: string, sz: number
) {
  const dx = x2 - x1, dy = y2 - y1;
  if (Math.hypot(dx, dy) < 2) return;
  const head = Math.max(10, sz * 4);
  const ang = Math.atan2(dy, dx);
  ctx.save();
  ctx.strokeStyle = ctx.fillStyle = color;
  ctx.lineWidth = sz;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2 - Math.cos(ang) * head * 0.5, y2 - Math.sin(ang) * head * 0.5);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - head * Math.cos(ang - Math.PI / 6), y2 - head * Math.sin(ang - Math.PI / 6));
  ctx.lineTo(x2 - head * Math.cos(ang + Math.PI / 6), y2 - head * Math.sin(ang + Math.PI / 6));
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawStroke(ctx: CanvasRenderingContext2D, s: Stroke) {
  ctx.save();
  switch (s.kind) {
    case 'pen':
      ctx.strokeStyle = s.color;
      ctx.lineWidth = s.size;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      for (let i = 0; i < s.pts.length - 1; i += 2) {
        if (i === 0) ctx.moveTo(s.pts[0], s.pts[1]);
        else ctx.lineTo(s.pts[i], s.pts[i + 1]);
      }
      ctx.stroke();
      break;
    case 'marker':
      ctx.strokeStyle = s.color;
      ctx.lineWidth = s.size * 6;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.globalAlpha = 0.45;
      ctx.beginPath();
      for (let i = 0; i < s.pts.length - 1; i += 2) {
        if (i === 0) ctx.moveTo(s.pts[0], s.pts[1]);
        else ctx.lineTo(s.pts[i], s.pts[i + 1]);
      }
      ctx.stroke();
      break;
    case 'arrow':
      drawArrowShape(ctx, s.x1, s.y1, s.x2, s.y2, s.color, s.size);
      break;
    case 'rect': {
      const b = normBox(s.x, s.y, s.w, s.h);
      ctx.strokeStyle = s.color;
      ctx.lineWidth = s.size;
      ctx.strokeRect(b.x, b.y, b.w, b.h);
      break;
    }
    case 'ellipse': {
      const b = normBox(s.x, s.y, s.w, s.h);
      if (b.w < 1 || b.h < 1) break;
      ctx.strokeStyle = s.color;
      ctx.lineWidth = s.size;
      ctx.beginPath();
      ctx.ellipse(b.x + b.w / 2, b.y + b.h / 2, b.w / 2, b.h / 2, 0, 0, Math.PI * 2);
      ctx.stroke();
      break;
    }
    case 'text':
      ctx.fillStyle = s.color;
      ctx.font = `bold ${s.size * 5 + 10}px -apple-system, sans-serif`;
      ctx.fillText(s.text, s.x, s.y);
      break;
  }
  ctx.restore();
}

function handlePositions(x: number, y: number, w: number, h: number): [Handle, number, number][] {
  return [
    ['nw', x, y], ['n', x + w / 2, y], ['ne', x + w, y],
    ['w', x, y + h / 2], ['e', x + w, y + h / 2],
    ['sw', x, y + h], ['s', x + w / 2, y + h], ['se', x + w, y + h],
  ];
}

function hitHandle(mx: number, my: number, x: number, y: number, w: number, h: number): Handle {
  for (const [name, hx, hy] of handlePositions(x, y, w, h)) {
    if (Math.abs(mx - hx) <= HANDLE_R + 4 && Math.abs(my - hy) <= HANDLE_R + 4) return name;
  }
  if (mx >= x && mx <= x + w && my >= y && my <= y + h) return 'move';
  return null;
}

// ─── Main component ────────────────────────────────────────────────────────────

let _uid = 0;
const uid = () => String(++_uid);

export default function CaptureOverlay() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const rafRef = useRef(0);

  // ── State (with paired refs for use inside RAF/event closures) ────────────────
  const [rawSel, setRawSel] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const rawSelRef = useRef<typeof rawSel>(null);
  const syncRawSel = (v: typeof rawSel) => { setRawSel(v); rawSelRef.current = v; };

  const [phase, setPhase] = useState<Phase>('sel');
  const phaseRef = useRef<Phase>('sel');
  const syncPhase = (v: Phase) => { setPhase(v); phaseRef.current = v; };

  const [tool, setTool] = useState<AnnTool | null>(null);
  const toolRef = useRef<AnnTool | null>(null);
  const syncTool = (v: AnnTool | null) => { setTool(v); toolRef.current = v; };

  const [color, setColor] = useState('#ff3b30');
  const colorRef = useRef('#ff3b30');
  const syncColor = (v: string) => { setColor(v); colorRef.current = v; };

  const [sz, setSz] = useState(2);
  const szRef = useRef(2);
  const syncSz = (v: number) => { setSz(v); szRef.current = v; };

  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const strokesRef = useRef<Stroke[]>([]);
  const syncStrokes = (v: Stroke[]) => { setStrokes(v); strokesRef.current = v; };

  const curStroke = useRef<Stroke | null>(null);
  const [showColors, setShowColors] = useState(false);

  // Drag state (ref only — no React state needed)
  type DragState =
    | { mode: 'draw_sel'; start: { x: number; y: number } }
    | { mode: 'resize_sel'; start: { x: number; y: number }; snap: Box; handle: Handle }
    | { mode: 'move_sel'; start: { x: number; y: number }; snap: Box }
    | { mode: 'draw_ann'; start: { x: number; y: number } };

  const dragging = useRef<DragState | null>(null);
  const mouse = useRef({ x: 0, y: 0 });
  const canvasW = useRef(window.innerWidth);
  const canvasH = useRef(window.innerHeight);

  // ── Mount ─────────────────────────────────────────────────────────────────────

  useEffect(() => {
    invoke<{ image_data: string }>('get_current_capture').then(data => {
      const img = new Image();
      img.onload = () => { imgRef.current = img; };
      img.src = `data:image/png;base64,${data.image_data}`;
    }).catch(console.error);

    invoke<string>('get_capture_mode').then(mode => {
      if (mode === 'fullscreen') {
        const sel = { x: 0, y: 0, w: canvasW.current, h: canvasH.current };
        syncRawSel(sel);
        syncPhase('ann');
      }
    }).catch(() => { });

    const resize = () => {
      const c = canvasRef.current;
      if (!c) return;
      c.width = window.innerWidth;
      c.height = window.innerHeight;
      canvasW.current = window.innerWidth;
      canvasH.current = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const render = () => { drawFrame(); rafRef.current = requestAnimationFrame(render); };
    rafRef.current = requestAnimationFrame(render);

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(rafRef.current);
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (phaseRef.current === 'ann') {
          syncPhase('sel');
          syncStrokes([]);
          curStroke.current = null;
          syncTool(null);
        } else {
          invoke('cancel_capture').catch(() => { });
        }
        return;
      }
      if (phaseRef.current !== 'ann') return;

      // Cmd+C — copy to clipboard and close
      if (e.key === 'c' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        // Use a small timeout so any in-progress text input can commit first
        setTimeout(() => { document.dispatchEvent(new CustomEvent('captura:copy')); }, 0);
        return;
      }
      // Enter — same as Copy
      if (e.key === 'Enter') {
        e.preventDefault();
        setTimeout(() => { document.dispatchEvent(new CustomEvent('captura:copy')); }, 0);
        return;
      }
      if (e.key === 'z' && (e.metaKey || e.ctrlKey) && !e.shiftKey) {
        const next = strokesRef.current.slice(0, -1);
        syncStrokes(next);
        e.preventDefault();
        return;
      }
      const t = TOOLS.find(t => t.key === e.key.toLowerCase());
      if (t) syncTool(t.id);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // ── Render loop ───────────────────────────────────────────────────────────────

  const drawFrame = useCallback(() => {
    const c = canvasRef.current;
    const img = imgRef.current;
    if (!c) return;
    const ctx = c.getContext('2d')!;
    const W = c.width, H = c.height;
    const ph = phaseRef.current;
    const sel = rawSelRef.current;

    ctx.clearRect(0, 0, W, H);
    if (img) ctx.drawImage(img, 0, 0, W, H);
    else { ctx.fillStyle = '#111'; ctx.fillRect(0, 0, W, H); }

    // Dim overlay
    if (sel && Math.abs(sel.w) > 2 && Math.abs(sel.h) > 2) {
      const { x, y, w, h } = normBox(sel.x, sel.y, sel.w, sel.h);
      ctx.fillStyle = ph === 'ann' ? 'rgba(0,0,0,0.38)' : 'rgba(0,0,0,0.52)';
      ctx.fillRect(0, 0, W, y);
      ctx.fillRect(0, y, x, h);
      ctx.fillRect(x + w, y, W - x - w, h);
      ctx.fillRect(0, y + h, W, H - y - h);
    } else {
      ctx.fillStyle = 'rgba(0,0,0,0.52)';
      ctx.fillRect(0, 0, W, H);
    }

    // Annotations
    strokesRef.current.forEach(s => drawStroke(ctx, s));
    if (curStroke.current) drawStroke(ctx, curStroke.current);

    // Selection border + handles
    if (sel && Math.abs(sel.w) > 2 && Math.abs(sel.h) > 2) {
      const { x, y, w, h } = normBox(sel.x, sel.y, sel.w, sel.h);

      ctx.strokeStyle = ph === 'ann' ? 'rgba(90,155,255,0.55)' : '#4d90fe';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(x, y, w, h);

      if (ph === 'sel') {
        ctx.fillStyle = '#fff';
        ctx.strokeStyle = '#4d90fe';
        ctx.lineWidth = 1;
        for (const [, hx, hy] of handlePositions(x, y, w, h)) {
          ctx.beginPath();
          ctx.arc(hx, hy, HANDLE_R, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        }
      }

      // Size label
      const lbl = `${Math.round(w)} × ${Math.round(h)}`;
      ctx.font = 'bold 12px -apple-system, sans-serif';
      const tw = ctx.measureText(lbl).width;
      const pad = 5, bw = tw + pad * 2, bh = 20;
      let lx = x + w / 2 - bw / 2;
      let ly = y - bh - 6;
      if (ly < 4) ly = y + h + 4;
      lx = Math.max(4, Math.min(W - bw - 4, lx));
      ctx.fillStyle = 'rgba(0,0,0,0.75)';
      ctx.beginPath();
      (ctx as any).roundRect(lx, ly, bw, bh, 3);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.fillText(lbl, lx + pad, ly + bh - 5);
    }

    // Crosshair + magnifier (only before any selection in 'sel' phase)
    if (ph === 'sel' && img && (!sel || (Math.abs(sel.w) < 3 && Math.abs(sel.h) < 3))) {
      const { x: mx, y: my } = mouse.current;
      // Crosshair
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(mx, 0); ctx.lineTo(mx, H);
      ctx.moveTo(0, my); ctx.lineTo(W, my);
      ctx.stroke();
      ctx.setLineDash([]);
      // Magnifier
      drawMagnifier(ctx, W, H, img, mx, my);
    }
  }, []);

  function drawMagnifier(
    ctx: CanvasRenderingContext2D, W: number, H: number,
    img: HTMLImageElement, mx: number, my: number
  ) {
    const LENS = 56, ZOOM = 4, SIZE = LENS * ZOOM, OFF = 22;
    let dx = mx + OFF, dy = my + OFF;
    if (dx + SIZE > W - 4) dx = mx - SIZE - OFF;
    if (dy + SIZE > H - 4) dy = my - SIZE - OFF;
    dx = Math.max(4, dx); dy = Math.max(4, dy);

    const sx = img.naturalWidth / W, sy = img.naturalHeight / H;
    const srcX = (mx - LENS / 2) * sx, srcY = (my - LENS / 2) * sy;
    const srcW = LENS * sx, srcH = LENS * sy;

    ctx.save();
    ctx.beginPath(); ctx.rect(dx, dy, SIZE, SIZE); ctx.clip();
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, srcX, srcY, srcW, srcH, dx, dy, SIZE, SIZE);
    ctx.restore();

    ctx.strokeStyle = 'rgba(255,255,255,0.65)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(dx + SIZE / 2, dy); ctx.lineTo(dx + SIZE / 2, dy + SIZE);
    ctx.moveTo(dx, dy + SIZE / 2); ctx.lineTo(dx + SIZE, dy + SIZE / 2);
    ctx.stroke();

    ctx.strokeStyle = '#4d90fe';
    ctx.lineWidth = 2;
    ctx.strokeRect(dx, dy, SIZE, SIZE);

    // Pixel color hex
    const tmp = document.createElement('canvas');
    tmp.width = tmp.height = 1;
    const tc = tmp.getContext('2d')!;
    tc.drawImage(img, mx * sx, my * sy, 1, 1, 0, 0, 1, 1);
    const d = tc.getImageData(0, 0, 1, 1).data;
    const hex = '#' + [d[0], d[1], d[2]].map(n => n.toString(16).padStart(2, '0')).join('').toUpperCase();
    ctx.font = '11px monospace';
    const hexW = ctx.measureText(hex).width + 12;
    let lx = dx, ly = dy + SIZE + 4;
    if (ly + 18 > H - 4) ly = dy - 22;
    ctx.fillStyle = 'rgba(0,0,0,0.82)';
    (ctx as any).roundRect(lx, ly, hexW, 18, 3);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.fillText(hex, lx + 6, ly + 13);
  }

  // ── Mouse ──────────────────────────────────────────────────────────────────────

  const getPos = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const c = canvasRef.current!;
    const r = c.getBoundingClientRect();
    return {
      x: (e.clientX - r.left) * (c.width / r.width),
      y: (e.clientY - r.top) * (c.height / r.height),
    };
  };

  const onMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (e.button !== 0) return;
    const pos = getPos(e);
    const ph = phaseRef.current;
    const t = toolRef.current;
    const sel = rawSelRef.current;

    // In annotation phase with an active tool: start drawing annotation
    if (ph === 'ann' && t) {
      if (t === 'text') { handleTextInput(pos.x, pos.y); return; }
      const base = { id: uid(), color: colorRef.current, size: szRef.current };
      let s: Stroke;
      switch (t) {
        case 'pen':    s = { ...base, kind: 'pen', pts: [pos.x, pos.y] }; break;
        case 'marker': s = { ...base, kind: 'marker', pts: [pos.x, pos.y] }; break;
        case 'arrow':  s = { ...base, kind: 'arrow', x1: pos.x, y1: pos.y, x2: pos.x, y2: pos.y }; break;
        case 'rect':   s = { ...base, kind: 'rect', x: pos.x, y: pos.y, w: 0, h: 0 }; break;
        case 'ellipse': s = { ...base, kind: 'ellipse', x: pos.x, y: pos.y, w: 0, h: 0 }; break;
        default: return;
      }
      curStroke.current = s;
      dragging.current = { mode: 'draw_ann', start: pos };
      return;
    }

    // In annotation phase without tool: try to resize/move selection
    if (ph === 'ann' && !t && sel) {
      const b = normBox(sel.x, sel.y, sel.w, sel.h);
      const h = hitHandle(pos.x, pos.y, b.x, b.y, b.w, b.h);
      if (h === 'move') { dragging.current = { mode: 'move_sel', start: pos, snap: b }; return; }
      if (h) { dragging.current = { mode: 'resize_sel', start: pos, snap: b, handle: h }; return; }
      // Click outside selection → restart
      syncPhase('sel');
      syncStrokes([]);
      curStroke.current = null;
      syncTool(null);
    }

    // Selection phase: check existing handles or start new selection
    if (sel && Math.abs(sel.w) > 3 && Math.abs(sel.h) > 3) {
      const b = normBox(sel.x, sel.y, sel.w, sel.h);
      const h = hitHandle(pos.x, pos.y, b.x, b.y, b.w, b.h);
      if (h === 'move') { dragging.current = { mode: 'move_sel', start: pos, snap: b }; return; }
      if (h) { dragging.current = { mode: 'resize_sel', start: pos, snap: b, handle: h }; return; }
    }
    // Start new selection
    syncRawSel({ x: pos.x, y: pos.y, w: 0, h: 0 });
    dragging.current = { mode: 'draw_sel', start: pos };
  }, []);

  const onMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const pos = getPos(e);
    mouse.current = pos;
    const d = dragging.current;
    if (!d) return;

    const dx = pos.x - d.start.x, dy = pos.y - d.start.y;

    if (d.mode === 'draw_sel') {
      syncRawSel({ x: d.start.x, y: d.start.y, w: dx, h: dy });
      return;
    }
    if (d.mode === 'move_sel') {
      const { x, y, w, h } = d.snap;
      syncRawSel({ x: x + dx, y: y + dy, w, h });
      return;
    }
    if (d.mode === 'resize_sel') {
      const { x: ox, y: oy, w: ow, h: oh } = d.snap;
      let { x, y, w, h } = { x: ox, y: oy, w: ow, h: oh };
      switch (d.handle) {
        case 'nw': x = ox + dx; y = oy + dy; w = ow - dx; h = oh - dy; break;
        case 'n':  y = oy + dy; h = oh - dy; break;
        case 'ne': y = oy + dy; w = ow + dx; h = oh - dy; break;
        case 'w':  x = ox + dx; w = ow - dx; break;
        case 'e':  w = ow + dx; break;
        case 'sw': x = ox + dx; w = ow - dx; h = oh + dy; break;
        case 's':  h = oh + dy; break;
        case 'se': w = ow + dx; h = oh + dy; break;
      }
      syncRawSel({ x, y, w, h });
      return;
    }
    if (d.mode === 'draw_ann') {
      const s = curStroke.current;
      if (!s) return;
      switch (s.kind) {
        case 'pen': case 'marker':
          curStroke.current = { ...s, pts: [...s.pts, pos.x, pos.y] }; break;
        case 'arrow':
          curStroke.current = { ...s, x2: pos.x, y2: pos.y }; break;
        case 'rect': case 'ellipse':
          curStroke.current = { ...s, w: pos.x - s.x, h: pos.y - s.y }; break;
      }
    }
  }, []);

  const onMouseUp = useCallback((_e: React.MouseEvent<HTMLCanvasElement>) => {
    const d = dragging.current;
    dragging.current = null;

    if (d?.mode === 'draw_sel') {
      const sel = rawSelRef.current;
      if (sel && Math.abs(sel.w) > 5 && Math.abs(sel.h) > 5) {
        syncPhase('ann');
      } else {
        syncRawSel(null);
      }
      return;
    }
    if (d?.mode === 'draw_ann') {
      const s = curStroke.current;
      if (s) {
        syncStrokes([...strokesRef.current, s]);
        curStroke.current = null;
      }
    }
  }, []);

  // Text input
  const handleTextInput = (x: number, y: number) => {
    const input = document.createElement('input');
    const fontSize = szRef.current * 5 + 10;
    Object.assign(input.style, {
      position: 'fixed',
      left: `${x}px`, top: `${y}px`,
      font: `bold ${fontSize}px -apple-system, sans-serif`,
      color: colorRef.current,
      background: 'transparent',
      border: 'none',
      borderBottom: `2px dashed ${colorRef.current}`,
      outline: 'none',
      minWidth: '80px',
      zIndex: '100',
    } as CSSStyleDeclaration);
    document.body.appendChild(input);
    input.focus();

    const commit = () => {
      if (input.value.trim()) {
        const s: Stroke = {
          id: uid(), kind: 'text',
          color: colorRef.current, size: szRef.current,
          x, y: y + fontSize,
          text: input.value,
        };
        syncStrokes([...strokesRef.current, s]);
      }
      if (document.body.contains(input)) document.body.removeChild(input);
    };
    input.addEventListener('blur', commit);
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === 'Escape') { e.stopPropagation(); input.blur(); }
    });
  };

  // ── Export ─────────────────────────────────────────────────────────────────────

  const exportImage = useCallback((): string | null => {
    const c = canvasRef.current;
    const img = imgRef.current;
    const sel = rawSelRef.current;
    if (!c || !img || !sel) return null;
    const b = normBox(sel.x, sel.y, sel.w, sel.h);
    if (b.w < 1 || b.h < 1) return null;

    const dpr = window.devicePixelRatio || 1;
    const exp = document.createElement('canvas');
    exp.width = Math.round(b.w * dpr);
    exp.height = Math.round(b.h * dpr);
    const ctx = exp.getContext('2d')!;

    // Screenshot crop at full physical resolution
    const sxRatio = img.naturalWidth / c.width;
    const syRatio = img.naturalHeight / c.height;
    ctx.drawImage(img, b.x * sxRatio, b.y * syRatio, b.w * sxRatio, b.h * syRatio,
      0, 0, exp.width, exp.height);

    // Annotations
    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.translate(-b.x, -b.y);
    strokesRef.current.forEach(s => drawStroke(ctx, s));
    ctx.restore();

    return exp.toDataURL('image/png').split(',')[1];
  }, []);

  const handleCopy = useCallback(async () => {
    const data = exportImage();
    if (!data) return;
    await invoke('copy_to_clipboard', { imageData: data }).catch(console.error);
    getCurrentWindow().close();
  }, [exportImage]);

  // Listen for copy event dispatched from keyboard handler
  useEffect(() => {
    const listener = () => handleCopy();
    document.addEventListener('captura:copy', listener);
    return () => document.removeEventListener('captura:copy', listener);
  }, [handleCopy]);

  const handleSave = useCallback(async () => {
    const data = exportImage();
    if (!data) return;
    await invoke('save_screenshot', { imageData: data, path: null, format: null }).catch(console.error);
    getCurrentWindow().close();
  }, [exportImage]);

  const handleSaveAs = useCallback(async () => {
    const data = exportImage();
    if (!data) return;
    const fp = await save({ filters: [{ name: 'PNG', extensions: ['png'] }, { name: 'JPEG', extensions: ['jpg'] }] });
    if (fp) {
      const ext = fp.split('.').pop()?.toLowerCase() || 'png';
      await invoke('save_screenshot', { imageData: data, path: fp, format: ext }).catch(console.error);
      getCurrentWindow().close();
    }
  }, [exportImage]);

  // ── Toolbar layout ─────────────────────────────────────────────────────────────

  const selNorm = rawSel ? normBox(rawSel.x, rawSel.y, rawSel.w, rawSel.h) : null;
  const W = canvasW.current, H = canvasH.current;
  const TB_W = 454, TB_H = 40;
  let tbLeft = 0, tbTop = 0;
  if (selNorm) {
    tbLeft = Math.max(4, Math.min(W - TB_W - 4, selNorm.x + selNorm.w / 2 - TB_W / 2));
    tbTop = selNorm.y + selNorm.h + 7;
    if (tbTop + TB_H > H - 4) tbTop = selNorm.y - TB_H - 7;
    if (tbTop < 4) tbTop = selNorm.y + selNorm.h - TB_H - 4;
  }

  const btnBase: React.CSSProperties = {
    height: 30, minWidth: 30,
    background: 'transparent',
    border: '1px solid transparent',
    borderRadius: 5,
    color: 'rgba(255,255,255,0.8)',
    cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
    padding: '0 3px',
  };
  const btnActive: React.CSSProperties = {
    ...btnBase,
    background: 'rgba(77,144,254,0.22)',
    border: '1px solid rgba(77,144,254,0.5)',
    color: '#5a9fff',
  };
  const sepStyle: React.CSSProperties = {
    width: 1, height: 20,
    background: 'rgba(255,255,255,0.13)',
    margin: '0 3px', flexShrink: 0,
  };

  const cursor = tool ? 'crosshair' : phase === 'sel' ? 'crosshair' : 'default';

  return (
    <div style={{ width: '100vw', height: '100vh', overflow: 'hidden', userSelect: 'none' }}>
      <canvas
        ref={canvasRef}
        style={{ display: 'block', width: '100vw', height: '100vh', cursor }}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onDoubleClick={() => { if (phase === 'ann') handleCopy(); }}
      />

      {/* Floating annotation toolbar */}
      {phase === 'ann' && selNorm && (
        <>
          <div
            style={{
              position: 'fixed', left: tbLeft, top: tbTop,
              width: TB_W, height: TB_H,
              background: 'rgba(20,20,22,0.96)',
              backdropFilter: 'blur(18px)',
              WebkitBackdropFilter: 'blur(18px)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 8,
              display: 'flex', alignItems: 'center',
              padding: '0 6px', gap: 2,
              boxShadow: '0 8px 32px rgba(0,0,0,0.65), 0 2px 8px rgba(0,0,0,0.4)',
              zIndex: 20,
            }}
            onMouseDown={e => e.stopPropagation()}
          >
            {/* Tool buttons */}
            {TOOLS.map(t => (
              <button
                key={t.id}
                style={tool === t.id ? btnActive : btnBase}
                title={t.title}
                onClick={() => syncTool(tool === t.id ? null : t.id)}
              >
                {t.icon}
              </button>
            ))}

            <div style={sepStyle} />

            {/* Color swatch */}
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setShowColors(!showColors)}
                title="Color"
                style={{
                  width: 22, height: 22, borderRadius: '50%',
                  background: color,
                  border: '2px solid rgba(255,255,255,0.35)',
                  cursor: 'pointer', flexShrink: 0,
                }}
              />
              {showColors && (
                <div
                  style={{
                    position: 'absolute', bottom: '100%', left: '50%',
                    transform: 'translateX(-50%)', marginBottom: 10,
                    background: 'rgba(20,20,22,0.97)',
                    border: '1px solid rgba(255,255,255,0.12)',
                    borderRadius: 8, padding: 8,
                    display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6,
                    boxShadow: '0 6px 24px rgba(0,0,0,0.55)',
                  }}
                  onMouseDown={e => e.stopPropagation()}
                >
                  {COLORS.map(c => (
                    <button
                      key={c}
                      onClick={() => { syncColor(c); setShowColors(false); }}
                      style={{
                        width: 20, height: 20, borderRadius: '50%', background: c, padding: 0,
                        border: color === c ? '2px solid #fff' : '2px solid rgba(255,255,255,0.12)',
                        cursor: 'pointer',
                      }}
                    />
                  ))}
                  <label style={{ gridColumn: '1/-1', display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                    <span style={{ fontSize: 10, color: '#777' }}>Custom</span>
                    <input
                      type="color"
                      value={color}
                      onChange={e => syncColor(e.target.value)}
                      style={{ flex: 1, height: 20, border: 'none', borderRadius: 3, cursor: 'pointer' }}
                    />
                  </label>
                </div>
              )}
            </div>

            <div style={sepStyle} />

            {/* Size buttons */}
            {([2, 4, 8] as const).map((s, i) => (
              <button
                key={s}
                title={['Thin', 'Medium', 'Thick'][i]}
                onClick={() => syncSz(s)}
                style={{ ...sz === s ? btnActive : btnBase, width: 28 }}
              >
                <div style={{ width: [10, 12, 14][i], height: s, background: 'currentColor', borderRadius: 1 }} />
              </button>
            ))}

            <div style={sepStyle} />

            {/* Undo */}
            <button
              title="Undo (⌘Z)"
              onClick={() => syncStrokes(strokesRef.current.slice(0, -1))}
              style={{ ...btnBase, opacity: strokes.length === 0 ? 0.35 : 1 }}
            >
              <IcoUndo />
            </button>

            <div style={sepStyle} />

            {/* Copy */}
            <button
              onClick={handleCopy}
              title="Copy to clipboard (⌘C)"
              style={{
                ...btnBase, width: 'auto', padding: '0 9px',
                gap: 5, fontSize: 12, fontWeight: 500,
                color: 'rgba(255,255,255,0.9)',
              }}
            >
              <IcoCopy /> Copy
            </button>

            {/* Save */}
            <button
              onClick={handleSave}
              title="Save to folder"
              style={{
                ...btnBase, width: 'auto', padding: '0 9px',
                gap: 5, fontSize: 12, fontWeight: 500,
                color: 'rgba(255,255,255,0.9)',
              }}
            >
              <IcoSave /> Save
            </button>

            <div style={sepStyle} />

            {/* Close */}
            <button
              onClick={() => invoke('cancel_capture').catch(() => { })}
              title="Cancel (Esc)"
              style={{ ...btnBase, color: 'rgba(220,80,80,0.85)' }}
            >
              <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
                <path d="M1 1l10 10M11 1L1 11" />
              </svg>
            </button>
          </div>

          {/* Dismiss color picker on outside click */}
          {showColors && (
            <div style={{ position: 'fixed', inset: 0, zIndex: 18 }} onClick={() => setShowColors(false)} />
          )}
        </>
      )}
    </div>
  );
}
