import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ImageAdjustment, FilterType, FilterPreset, EditorState, ToolType, DrawingAction, Point } from '../types';

interface ImageEditorProps {
  base64Image: string;
  onSave: (newBase64: string) => void;
  onCancel: () => void;
}

// --- Icons ---
const UndoIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/></svg>;
const RedoIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 7v6h-6"/><path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3L21 13"/></svg>;
const BrushIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9.06 11.9 8.07-8.06a2.85 2.85 0 1 1 4.03 4.03l-8.06 8.08"/><path d="M7.07 14.94c-1.66 0-3 1.35-3 3.02 0 1.33-2.5 1.52-2.5 4.04h5c2.5 0 2.71-2.5 4.04-2.5 1.67 0 3.01-1.35 3.02-3.02"/><path d="M11 11 8 14"/><path d="M13 13 16 16"/></svg>;
const SquareIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/></svg>;
const CircleIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/></svg>;
const TypeIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="4 7 4 4 20 4 20 7"/><line x1="9" x2="15" y1="20" y2="20"/><line x1="12" x2="12" y1="4" y2="20"/></svg>;
const CursorIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m4 4 7.07 17 2.51-7.39L21 11.07z"/></svg>;
const CheckIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>;
const XMarkIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>;

const PRESETS: FilterPreset[] = [
  { name: 'None', settings: { brightness: 100, contrast: 100, saturate: 100, sepia: 0 } },
  { name: 'Vintage Glamour', settings: { brightness: 90, contrast: 90, saturate: 80, sepia: 60 } },
  { name: 'Monochrome Elegance', settings: { brightness: 110, contrast: 120, saturate: 0, sepia: 0 } },
  { name: 'Golden Hour Glow', settings: { brightness: 105, contrast: 100, saturate: 130, sepia: 30 } },
  { name: 'Deep Contrast', settings: { brightness: 100, contrast: 150, saturate: 110, sepia: 0 } },
];

const COLORS = [
  '#ffffff', // White
  '#000000', // Black
  '#d4af37', // Gold
  '#ef4444', // Red
  '#3b82f6', // Blue
  '#10b981', // Green
];

const ImageEditor: React.FC<ImageEditorProps> = ({ base64Image, onSave, onCancel }) => {
  // --- Constants & Init ---
  const INITIAL_STATE: EditorState = {
    adjustments: { brightness: 100, contrast: 100, saturate: 100, sepia: 0, blur: 0 },
    drawingActions: [],
    activeFilter: 'None',
  };

  // --- State ---
  // History Stack
  const [history, setHistory] = useState<EditorState[]>([INITIAL_STATE]);
  const [historyIndex, setHistoryIndex] = useState(0);

  // Current Working State (for sliders before commit)
  const [localAdjustments, setLocalAdjustments] = useState<ImageAdjustment>(INITIAL_STATE.adjustments);
  
  // UI State
  const [activeTab, setActiveTab] = useState<'adjust' | 'draw'>('adjust');
  const [activeTool, setActiveTool] = useState<ToolType>('cursor');
  const [brushColor, setBrushColor] = useState('#d4af37');
  const [brushSize, setBrushSize] = useState(5);
  
  // Drawing State
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentAction, setCurrentAction] = useState<DrawingAction | null>(null);
  const [textInput, setTextInput] = useState<{ visible: boolean; x: number; y: number; text: string; canvasPos: Point } | null>(null);

  // Refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const baseImageRef = useRef<HTMLImageElement | null>(null);

  const currentState = history[historyIndex];

  // --- Helpers ---
  
  const commitHistory = useCallback((newState: EditorState) => {
    setHistory(prev => {
      const newHistory = prev.slice(0, historyIndex + 1);
      return [...newHistory, newState];
    });
    setHistoryIndex(prev => prev + 1);
  }, [historyIndex]);

  // Handle Undo/Redo
  const handleUndo = () => {
    if (historyIndex > 0) {
      setHistoryIndex(historyIndex - 1);
      setLocalAdjustments(history[historyIndex - 1].adjustments);
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex(historyIndex + 1);
      setLocalAdjustments(history[historyIndex + 1].adjustments);
    }
  };

  // Load Base Image
  useEffect(() => {
    const img = new Image();
    img.src = `data:image/jpeg;base64,${base64Image}`;
    img.onload = () => {
      baseImageRef.current = img;
      renderCanvas(); // Initial render
    };
  }, [base64Image]);

  // Sync Local Adjustments when History Changes (e.g. Undo)
  useEffect(() => {
    setLocalAdjustments(currentState.adjustments);
  }, [historyIndex]);

  // Redraw Canvas Effect
  useEffect(() => {
    renderCanvas();
  }, [localAdjustments, currentState.drawingActions, currentAction, brushSize, brushColor, activeTool]);


  // --- Rendering Logic ---

  const renderCanvas = () => {
    const canvas = canvasRef.current;
    const img = baseImageRef.current;
    if (!canvas || !img) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas dimensions to match image resolution
    if (canvas.width !== img.width || canvas.height !== img.height) {
      canvas.width = img.width;
      canvas.height = img.height;
    }

    // 1. Clear
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 2. Draw Base Image with Filters
    ctx.save();
    const filterString = `brightness(${localAdjustments.brightness}%) contrast(${localAdjustments.contrast}%) saturate(${localAdjustments.saturate}%) sepia(${localAdjustments.sepia}%)`;
    ctx.filter = filterString;
    ctx.drawImage(img, 0, 0, img.width, img.height);
    ctx.restore();

    // 3. Draw Committed Actions
    currentState.drawingActions.forEach(action => drawAction(ctx, action));

    // 4. Draw Current (In-Progress) Action
    if (currentAction) {
      drawAction(ctx, currentAction);
    }

    // 5. Draw Brush Cursor (Optional visual feedback)
    // Complex to overlay on canvas without lag, skipping for now.
  };

  const drawAction = (ctx: CanvasRenderingContext2D, action: DrawingAction) => {
    ctx.strokeStyle = action.color;
    ctx.lineWidth = action.size;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.fillStyle = action.color;

    if (action.type === 'brush' && action.points && action.points.length > 0) {
      ctx.beginPath();
      ctx.moveTo(action.points[0].x, action.points[0].y);
      for (let i = 1; i < action.points.length; i++) {
        ctx.lineTo(action.points[i].x, action.points[i].y);
      }
      ctx.stroke();
    } else if (action.type === 'rectangle' && action.start && action.end) {
      const width = action.end.x - action.start.x;
      const height = action.end.y - action.start.y;
      ctx.strokeRect(action.start.x, action.start.y, width, height);
    } else if (action.type === 'circle' && action.start && action.end) {
      const radius = Math.sqrt(Math.pow(action.end.x - action.start.x, 2) + Math.pow(action.end.y - action.start.y, 2));
      ctx.beginPath();
      ctx.arc(action.start.x, action.start.y, radius, 0, 2 * Math.PI);
      ctx.stroke();
    } else if (action.type === 'text' && action.position && action.text) {
      ctx.font = `bold ${action.size * 5}px "Playfair Display", serif`; // Scaling size for visibility
      ctx.textBaseline = 'middle';
      ctx.fillText(action.text, action.position.x, action.position.y);
    }
  };

  // --- Interaction Handlers ---

  const getCanvasPoint = (e: React.MouseEvent | React.TouchEvent): Point => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;

    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY
    };
  };

  const handleMouseDown = (e: React.MouseEvent | React.TouchEvent) => {
    if (activeTool === 'cursor' || activeTab === 'adjust') return;
    const pos = getCanvasPoint(e);

    if (activeTool === 'text') {
      // Calculate screen position for input popup
      const canvas = canvasRef.current;
      const rect = canvas!.getBoundingClientRect();
      const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
      
      // Relative to container for positioning
      const containerRect = containerRef.current!.getBoundingClientRect();

      setTextInput({
        visible: true,
        x: clientX - containerRect.left,
        y: clientY - containerRect.top,
        text: '',
        canvasPos: pos
      });
      return;
    }

    setIsDrawing(true);
    setCurrentAction({
      id: Date.now().toString(),
      type: activeTool,
      color: brushColor,
      size: brushSize,
      points: [pos],
      start: pos,
      end: pos
    });
  };

  const handleMouseMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing || !currentAction) return;
    const pos = getCanvasPoint(e);

    if (activeTool === 'brush') {
      setCurrentAction(prev => ({
        ...prev!,
        points: [...(prev?.points || []), pos]
      }));
    } else if (activeTool === 'rectangle' || activeTool === 'circle') {
      setCurrentAction(prev => ({
        ...prev!,
        end: pos
      }));
    }
  };

  const handleMouseUp = () => {
    if (isDrawing && currentAction) {
      setIsDrawing(false);
      // Add action to state
      commitHistory({
        ...currentState,
        drawingActions: [...currentState.drawingActions, currentAction]
      });
      setCurrentAction(null);
    }
  };

  const handleTextSubmit = () => {
    if (textInput && textInput.text.trim()) {
       const newAction: DrawingAction = {
         id: Date.now().toString(),
         type: 'text',
         color: brushColor,
         size: brushSize,
         position: textInput.canvasPos,
         text: textInput.text
       };
       commitHistory({
         ...currentState,
         drawingActions: [...currentState.drawingActions, newAction]
       });
    }
    setTextInput(null);
  };

  // --- Adjustments Handlers ---

  const handleAdjustmentChange = (key: keyof ImageAdjustment, value: number) => {
    setLocalAdjustments(prev => ({ ...prev, [key]: value }));
  };

  const handleAdjustmentCommit = () => {
    // Only commit if different from current history state
    const hasChanged = JSON.stringify(localAdjustments) !== JSON.stringify(currentState.adjustments);
    if (hasChanged) {
      commitHistory({
        ...currentState,
        adjustments: localAdjustments
      });
    }
  };

  const applyPreset = (preset: FilterPreset) => {
    const newState = {
      ...currentState,
      adjustments: { ...currentState.adjustments, ...preset.settings },
      activeFilter: preset.name
    };
    setLocalAdjustments(newState.adjustments);
    commitHistory(newState);
  };

  // --- Final Save ---
  const handleSave = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      // Ensure everything is drawn
      renderCanvas(); 
      const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
      const rawBase64 = dataUrl.split(',')[1];
      onSave(rawBase64);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-md p-0 md:p-4 animate-fade-in">
      <div className="w-full h-full md:h-[90vh] max-w-7xl bg-luxury-charcoal md:border border-luxury-gold/20 md:rounded-2xl shadow-2xl flex flex-col md:flex-row overflow-hidden">
        
        {/* --- Canvas Area --- */}
        <div 
          ref={containerRef}
          className="flex-1 bg-black flex items-center justify-center relative overflow-hidden touch-none"
        >
          <canvas 
            ref={canvasRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onTouchStart={handleMouseDown}
            onTouchMove={handleMouseMove}
            onTouchEnd={handleMouseUp}
            className={`max-w-full max-h-full object-contain shadow-2xl ${activeTool !== 'cursor' ? 'cursor-crosshair' : 'cursor-default'}`}
          />

          {/* Text Input Popup */}
          {textInput && (
            <div 
              className="absolute p-2 bg-zinc-900 border border-luxury-gold/50 rounded-lg shadow-xl flex gap-2 animate-fade-in"
              style={{ top: textInput.y, left: textInput.x }}
            >
              <input 
                autoFocus
                type="text" 
                value={textInput.text}
                onChange={(e) => setTextInput({ ...textInput, text: e.target.value })}
                onKeyDown={(e) => e.key === 'Enter' && handleTextSubmit()}
                className="bg-black text-white px-2 py-1 outline-none border-b border-gray-700 focus:border-luxury-gold w-48 font-serif"
                placeholder="Digite aqui..."
              />
              <button onClick={handleTextSubmit} className="text-green-500 hover:text-green-400"><CheckIcon/></button>
              <button onClick={() => setTextInput(null)} className="text-red-500 hover:text-red-400"><XMarkIcon/></button>
            </div>
          )}
        </div>

        {/* --- Controls Sidebar --- */}
        <div className="w-full md:w-[400px] bg-zinc-900/95 flex flex-col border-l border-white/5 shadow-[0_0_50px_rgba(0,0,0,0.5)] z-10">
          
          {/* Header & Undo/Redo */}
          <div className="h-16 border-b border-white/10 flex items-center justify-between px-6 bg-black/40">
            <h2 className="text-xl font-serif text-luxury-gold tracking-wide">Estúdio</h2>
            <div className="flex gap-2">
              <button 
                onClick={handleUndo} 
                disabled={historyIndex === 0}
                className={`p-2 rounded-lg transition-colors ${historyIndex === 0 ? 'text-gray-700' : 'text-gray-300 hover:text-white hover:bg-white/10'}`}
                title="Desfazer"
              >
                <UndoIcon />
              </button>
              <button 
                onClick={handleRedo} 
                disabled={historyIndex === history.length - 1}
                className={`p-2 rounded-lg transition-colors ${historyIndex === history.length - 1 ? 'text-gray-700' : 'text-gray-300 hover:text-white hover:bg-white/10'}`}
                title="Refazer"
              >
                <RedoIcon />
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-white/5">
            <button 
              onClick={() => setActiveTab('adjust')}
              className={`flex-1 py-4 text-xs uppercase tracking-widest font-medium transition-colors ${activeTab === 'adjust' ? 'text-luxury-gold border-b-2 border-luxury-gold bg-white/5' : 'text-gray-500 hover:text-gray-300'}`}
            >
              Ajustar
            </button>
            <button 
              onClick={() => setActiveTab('draw')}
              className={`flex-1 py-4 text-xs uppercase tracking-widest font-medium transition-colors ${activeTab === 'draw' ? 'text-luxury-gold border-b-2 border-luxury-gold bg-white/5' : 'text-gray-500 hover:text-gray-300'}`}
            >
              Desenhar
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-8 scrollbar-thin scrollbar-thumb-gray-800">
            
            {/* --- Adjustments Tab --- */}
            {activeTab === 'adjust' && (
              <div className="space-y-8 animate-fade-in">
                {/* Presets */}
                <div className="space-y-3">
                  <h3 className="text-xs uppercase tracking-widest text-luxury-goldDim font-bold mb-3">Filtros de Luxo</h3>
                  <div className="grid grid-cols-2 gap-2">
                    {PRESETS.map((preset) => (
                      <button
                        key={preset.name}
                        onClick={() => applyPreset(preset)}
                        className={`px-3 py-3 text-xs rounded border transition-all duration-300 text-left ${
                          currentState.activeFilter === preset.name
                            ? 'bg-luxury-gold text-black border-luxury-gold font-bold shadow-lg shadow-amber-500/10'
                            : 'bg-transparent text-gray-400 border-white/10 hover:border-luxury-gold/40 hover:text-gray-200'
                        }`}
                      >
                        {preset.name}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Sliders */}
                <div className="space-y-6">
                  <h3 className="text-xs uppercase tracking-widest text-luxury-goldDim font-bold">Ajustes Finos</h3>
                  
                  {[
                    { label: 'Brilho', key: 'brightness', min: 0, max: 200 },
                    { label: 'Contraste', key: 'contrast', min: 0, max: 200 },
                    { label: 'Saturação', key: 'saturate', min: 0, max: 200 },
                    { label: 'Vintage', key: 'sepia', min: 0, max: 100 },
                  ].map((ctrl) => (
                    <div key={ctrl.key} className="space-y-2">
                      <div className="flex justify-between text-xs text-gray-400">
                        <span>{ctrl.label}</span>
                        <span className="font-mono text-luxury-gold">
                          {localAdjustments[ctrl.key as keyof ImageAdjustment]}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min={ctrl.min}
                        max={ctrl.max}
                        value={localAdjustments[ctrl.key as keyof ImageAdjustment]}
                        onChange={(e) => handleAdjustmentChange(ctrl.key as keyof ImageAdjustment, Number(e.target.value))}
                        onMouseUp={handleAdjustmentCommit}
                        onTouchEnd={handleAdjustmentCommit}
                        className="w-full h-1 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-luxury-gold hover:accent-amber-400"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* --- Drawing Tab --- */}
            {activeTab === 'draw' && (
              <div className="space-y-8 animate-fade-in">
                
                {/* Tools */}
                <div>
                  <h3 className="text-xs uppercase tracking-widest text-luxury-goldDim font-bold mb-4">Ferramentas</h3>
                  <div className="flex gap-2">
                    {[
                      { id: 'cursor', icon: <CursorIcon/>, label: 'Mover' },
                      { id: 'brush', icon: <BrushIcon/>, label: 'Pincel' },
                      { id: 'rectangle', icon: <SquareIcon/>, label: 'Ret.' },
                      { id: 'circle', icon: <CircleIcon/>, label: 'Círculo' },
                      { id: 'text', icon: <TypeIcon/>, label: 'Texto' },
                    ].map((tool) => (
                      <button
                        key={tool.id}
                        onClick={() => setActiveTool(tool.id as ToolType)}
                        className={`flex-1 p-3 rounded-lg border flex flex-col items-center gap-1 transition-all ${
                          activeTool === tool.id
                            ? 'bg-luxury-gold text-black border-luxury-gold shadow-lg shadow-amber-500/20'
                            : 'bg-zinc-800 text-gray-400 border-white/5 hover:bg-zinc-700 hover:text-gray-200'
                        }`}
                        title={tool.label}
                      >
                        {tool.icon}
                        <span className="text-[10px] uppercase font-bold">{tool.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Properties (Visible if not Cursor) */}
                {activeTool !== 'cursor' && (
                  <div className="space-y-6 animate-fade-in">
                    
                    {/* Colors */}
                    <div className="space-y-2">
                      <h3 className="text-xs uppercase tracking-widest text-gray-500 font-bold">Cor</h3>
                      <div className="flex flex-wrap gap-3">
                        {COLORS.map(color => (
                          <button
                            key={color}
                            onClick={() => setBrushColor(color)}
                            className={`w-8 h-8 rounded-full border-2 transition-transform ${brushColor === color ? 'border-white scale-110 shadow-lg' : 'border-transparent hover:scale-105'}`}
                            style={{ backgroundColor: color }}
                          />
                        ))}
                      </div>
                    </div>

                    {/* Size */}
                    <div className="space-y-2">
                       <div className="flex justify-between text-xs text-gray-400">
                        <span className="uppercase tracking-widest font-bold text-gray-500">Espessura</span>
                        <span>{brushSize}px</span>
                      </div>
                      <input
                        type="range"
                        min="1"
                        max="50"
                        value={brushSize}
                        onChange={(e) => setBrushSize(Number(e.target.value))}
                        className="w-full h-1 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-white"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

          </div>

          {/* Footer Actions */}
          <div className="p-6 border-t border-white/10 bg-black/20 mt-auto flex gap-3">
            <button
              onClick={onCancel}
              className="flex-1 px-4 py-3 rounded-lg border border-white/10 text-gray-300 hover:bg-white/5 transition-colors text-sm font-medium"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              className="flex-1 px-4 py-3 rounded-lg bg-gradient-to-r from-amber-500 to-amber-600 text-black font-semibold hover:from-amber-400 hover:to-amber-500 transition-all shadow-lg shadow-amber-500/20 text-sm"
            >
              Salvar Alterações
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ImageEditor;