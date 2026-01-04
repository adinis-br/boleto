export interface Message {
  id: string;
  role: 'user' | 'model';
  text: string;
  image?: string; // Base64 string for user uploads or model generations
  timestamp: number;
}

export interface ImageAdjustment {
  brightness: number; // 0-200, default 100
  contrast: number;   // 0-200, default 100
  saturate: number;   // 0-200, default 100
  sepia: number;      // 0-100, default 0
  blur: number;       // 0-10, default 0
}

export type FilterType = 'None' | 'Vintage Glamour' | 'Monochrome Elegance' | 'Golden Hour Glow' | 'Deep Contrast';

export interface FilterPreset {
  name: FilterType;
  settings: Partial<ImageAdjustment>;
  overlayColor?: string; // For tinting
}

export type ToolType = 'cursor' | 'brush' | 'rectangle' | 'circle' | 'text';

export interface Point {
  x: number;
  y: number;
}

export interface DrawingAction {
  id: string;
  type: ToolType;
  color: string;
  size: number;
  points?: Point[]; // For brush
  start?: Point;    // For shapes
  end?: Point;      // For shapes
  text?: string;    // For text
  position?: Point; // For text
}

export interface EditorState {
  adjustments: ImageAdjustment;
  drawingActions: DrawingAction[];
  activeFilter: FilterType;
}