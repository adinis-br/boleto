import React, { useRef, useEffect, useState } from 'react';

interface CameraModalProps {
  onCapture: (base64: string) => void;
  onClose: () => void;
  onAccessError?: () => void; // Nova prop para avisar o pai sobre falha real
}

const CameraModal: React.FC<CameraModalProps> = ({ onCapture, onClose, onAccessError }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState<string>('');
  const [stream, setStream] = useState<MediaStream | null>(null);

  useEffect(() => {
    const startCamera = async () => {
      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode: "user", width: { ideal: 1920 }, height: { ideal: 1080 } } 
        });
        setStream(mediaStream);
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
        }
      } catch (err) {
        console.error("Erro ao acessar camera:", err);
        setError("Não foi possível acessar a câmera. Verifique as permissões ou conexões.");
        // Notifica o componente pai que o acesso falhou (ex: não tem camera real)
        if (onAccessError) {
          onAccessError();
        }
      }
    };

    startCamera();

    return () => {
      // Cleanup: Parar a stream ao fechar
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const handleCapture = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      
      // Ajustar dimensões do canvas para a resolução real do vídeo
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      const ctx = canvas.getContext('2d');
      if (ctx) {
        // Espelhar horizontalmente se for câmera frontal (opcional, mas comum em UX de desktop)
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
        
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        // Converter para Base64 (sem o prefixo data:image/...)
        const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
        const base64 = dataUrl.split(',')[1];
        
        onCapture(base64);
        stopAndClose();
      }
    }
  };

  const stopAndClose = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-3xl bg-luxury-charcoal border border-luxury-gold/30 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        
        {/* Header */}
        <div className="px-6 py-4 bg-black/40 border-b border-white/5 flex justify-between items-center">
          <h2 className="text-lg font-serif text-luxury-gold tracking-wide">Captura de Câmera</h2>
          <button onClick={stopAndClose} className="text-gray-400 hover:text-white transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
          </button>
        </div>

        {/* Video Area */}
        <div className="relative bg-black aspect-video flex items-center justify-center overflow-hidden">
          {error ? (
            <div className="text-red-400 text-center p-8 flex flex-col items-center animate-fade-in">
              <p className="mb-4 text-4xl">⚠️</p>
              <p className="font-medium">{error}</p>
              <p className="text-sm text-gray-500 mt-2 max-w-xs">O botão de câmera será desativado temporariamente.</p>
            </div>
          ) : (
            <video 
              ref={videoRef} 
              autoPlay 
              playsInline 
              className="w-full h-full object-cover transform -scale-x-100" // Espelhado visualmente para parecer um espelho
            />
          )}
          <canvas ref={canvasRef} className="hidden" />
          
          {/* Overlay Grid (Visual Luxury Touch) */}
          <div className="absolute inset-0 pointer-events-none opacity-20">
             <div className="absolute top-1/3 w-full h-px bg-white/30"></div>
             <div className="absolute bottom-1/3 w-full h-px bg-white/30"></div>
             <div className="absolute left-1/3 h-full w-px bg-white/30"></div>
             <div className="absolute right-1/3 h-full w-px bg-white/30"></div>
          </div>
        </div>

        {/* Footer Controls */}
        <div className="p-6 bg-black/40 border-t border-white/5 flex justify-center gap-4">
          <button 
            onClick={stopAndClose}
            className="px-6 py-3 rounded-full border border-white/10 text-gray-300 hover:bg-white/5 transition-colors text-sm font-medium"
          >
            {error ? "Fechar" : "Cancelar"}
          </button>
          {!error && (
            <button 
              onClick={handleCapture}
              className="px-8 py-3 rounded-full bg-luxury-gold text-black font-bold hover:bg-amber-400 transition-all shadow-[0_0_20px_rgba(212,175,55,0.4)] flex items-center gap-2"
            >
              <div className="w-3 h-3 bg-black rounded-full"></div>
              Capturar Foto
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default CameraModal;