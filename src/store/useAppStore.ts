import { create } from 'zustand';
import { Annotation, AnnotationTool } from '../types';

interface AppStore {
  // Tool state
  currentTool: AnnotationTool;
  strokeColor: string;
  fillColor: string;
  strokeWidth: number;
  opacity: number;
  fontSize: number;

  // Annotations
  annotations: Annotation[];
  history: Annotation[][];
  historyIndex: number;

  // Colors
  recentColors: string[];

  // Actions
  setTool: (tool: AnnotationTool) => void;
  setStrokeColor: (color: string) => void;
  setFillColor: (color: string) => void;
  setStrokeWidth: (width: number) => void;
  setOpacity: (opacity: number) => void;
  setFontSize: (size: number) => void;
  addAnnotation: (annotation: Annotation) => void;
  updateAnnotation: (id: string, updates: Record<string, unknown>) => void;
  removeAnnotation: (id: string) => void;
  undo: () => void;
  redo: () => void;
  clearAnnotations: () => void;
  addRecentColor: (color: string) => void;
}

export const useAppStore = create<AppStore>((set, get) => ({
  // Default state
  currentTool: 'arrow',
  strokeColor: '#ff3b30',
  fillColor: 'transparent',
  strokeWidth: 2,
  opacity: 1,
  fontSize: 16,

  annotations: [],
  history: [[]],
  historyIndex: 0,

  recentColors: ['#ff3b30', '#ff9500', '#ffcc00', '#34c759', '#007aff', '#5856d6', '#ffffff', '#000000'],

  // Actions
  setTool: (tool) => set({ currentTool: tool }),

  setStrokeColor: (color) => {
    set({ strokeColor: color });
    get().addRecentColor(color);
  },

  setFillColor: (color) => set({ fillColor: color }),

  setStrokeWidth: (width) => set({ strokeWidth: width }),

  setOpacity: (opacity) => set({ opacity }),

  setFontSize: (size) => set({ fontSize: size }),

  addAnnotation: (annotation) => {
    const { annotations, history, historyIndex } = get();
    const newAnnotations = [...annotations, annotation];

    // Truncate redo history
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(newAnnotations);

    set({
      annotations: newAnnotations,
      history: newHistory,
      historyIndex: newHistory.length - 1,
    });
  },

  updateAnnotation: (id, updates) => {
    const { annotations } = get();
    const newAnnotations = annotations.map((a) =>
      a.id === id ? ({ ...a, ...(updates as object) } as Annotation) : a
    );
    set({ annotations: newAnnotations });
  },

  removeAnnotation: (id) => {
    const { annotations, history, historyIndex } = get();
    const newAnnotations = annotations.filter((a) => a.id !== id);
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(newAnnotations);
    set({
      annotations: newAnnotations,
      history: newHistory,
      historyIndex: newHistory.length - 1,
    });
  },

  undo: () => {
    const { historyIndex, history } = get();
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      set({
        historyIndex: newIndex,
        annotations: history[newIndex],
      });
    }
  },

  redo: () => {
    const { historyIndex, history } = get();
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      set({
        historyIndex: newIndex,
        annotations: history[newIndex],
      });
    }
  },

  clearAnnotations: () => {
    set({
      annotations: [],
      history: [[]],
      historyIndex: 0,
    });
  },

  addRecentColor: (color) => {
    const { recentColors } = get();
    const filtered = recentColors.filter((c) => c !== color);
    const updated = [color, ...filtered].slice(0, 8);
    set({ recentColors: updated });
  },
}));
