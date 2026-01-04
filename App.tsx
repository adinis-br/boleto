import React, { useState, useRef, useEffect, useCallback } from 'react';
import { handleGeminiRequest } from './services/geminiService';
import { Message } from './types';
import ImageEditor from './components/ImageEditor';
import CameraModal from './components/CameraModal';

// --- Icons ---
const PaperclipIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
);
const CameraIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/></svg>
);
const SendIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>
);
const XIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
);
const EditIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>
);
const CopyIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
);
const RefreshIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 12"/><path d="M3 3v9h9"/></svg>
);
const DownloadIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
);

// --- Components ---

const ChatMessageBubble: React.FC<{ message: Message; onCopy: (text: string) => void }> = ({ message, onCopy }) => {
  const isUser = message.role === 'user';
  const isWelcome = message.id === 'welcome';
  
  // Detectar código de boleto (sequência longa de números)
  const boletoMatch = !isUser && message.text ? message.text.match(/(?:\n|^)(\d{30,})(?:\n|$|\r)/) : null;
  const boletoCode = boletoMatch ? boletoMatch[1] : null;

  // Função para renderizar texto com formatação avançada
  const renderRichText = (text: string) => {
    if (!text) return null;
    
    // Divide o texto em linhas para processar blocos
    return text.split('\n').map((line, lineIndex) => {
      const trimmedLine = line.trim();

      // 1. Renderizar Título (se a linha começar com '# ')
      if (trimmedLine.startsWith('# ')) {
        return (
          <h1 key={lineIndex} className="font-serif text-2xl md:text-3xl text-luxury-gold mb-3 font-medium tracking-wide leading-tight">
            {trimmedLine.replace(/^#\s+/, '')}
          </h1>
        );
      }

      // Se a linha for vazia, renderizamos um espaço invisível
      if (!trimmedLine) {
        return <div key={lineIndex} className="h-2"></div>;
      }

      // Verifica se é a assinatura específica para alinhar à direita (usando novo marcador ^^)
      const isSignature = trimmedLine === '^^by AD^^';

      // 2. Renderizar Linha com Destaques
      // Regex atualizado:
      // Captura ^^texto^^ (Luxo) OU **texto** (Negrito MD) OU *texto* (Itálico/Negrito MD)
      const parts = line.split(/(\^\^[^\^]+\^\^|\*\*[^*]+\*\*|\*[^*]+\*)/g);

      const inlineContent = parts.map((part, partIndex) => {
        
        // A. Destaque de Luxo (^^texto^^) -> Dourado e Negrito
        if (part.startsWith('^^') && part.endsWith('^^') && part.length > 4) {
          const content = part.slice(2, -2); // Remove os ^^
          return (
            <span key={partIndex} className="text-luxury-gold font-bold">
              {content}
            </span>
          );
        }

        // B. Markdown Padrão da IA (**texto** ou *texto*) -> Apenas Negrito (Branco/Cinza Claro)
        // Isso evita que respostas da IA fiquem douradas incorretamente
        if ((part.startsWith('**') && part.endsWith('**') && part.length > 4) || 
            (part.startsWith('*') && part.endsWith('*') && part.length > 2)) {
          const content = part.replace(/^\*+|\*+$/g, ''); // Remove todos asteriscos das pontas
          return (
            <span key={partIndex} className="font-bold text-gray-100">
              {content}
            </span>
          );
        }

        return part;
      });

      return (
        <div key={lineIndex} className={`min-h-[1.2em] ${isSignature ? 'text-right mt-4' : ''}`}>
          {inlineContent}
        </div>
      );
    });
  };

  return (
    // Lógica de centralização: Se for Welcome, usa justify-center.
    <div className={`flex w-full mb-6 ${isWelcome ? 'justify-center' : (isUser ? 'justify-end' : 'justify-start')}`}>
      <div 
        className={`
          max-w-[85%] md:max-w-[70%] p-5 rounded-2xl relative
          ${isUser 
            ? 'bg-zinc-800 text-luxury-pearl rounded-br-none border border-zinc-700' 
            : 'bg-gradient-to-br from-luxury-charcoal to-black text-gray-200 rounded-bl-none border border-luxury-gold/20 shadow-lg shadow-black/50'
          }
          ${isWelcome ? 'text-center border-luxury-gold/40 shadow-[0_0_40px_rgba(212,175,55,0.15)]' : ''}
        `}
      >
        {/* Render User Image if attached */}
        {isUser && message.image && (
          <div className="mb-4 rounded-lg overflow-hidden border border-white/10">
            <img 
              src={`data:image/jpeg;base64,${message.image}`} 
              alt="User uploaded" 
              className="w-full h-auto max-h-64 object-cover"
            />
          </div>
        )}

        {/* Text Content */}
        <div className="font-sans leading-relaxed text-sm md:text-base flex flex-col gap-0.5">
          {renderRichText(message.text)}
        </div>

        {/* Botão Especial para Boleto */}
        {boletoCode && (
          <div className="mt-4 pt-4 border-t border-white/10 animate-fade-in">
            <div className="text-[10px] uppercase text-luxury-gold mb-2 tracking-widest font-bold">Código Detectado</div>
            <div className="bg-black/50 p-3 rounded border border-white/10 font-mono text-xs break-all mb-2 text-gray-400">
              {boletoCode}
            </div>
            <button 
              onClick={() => onCopy(boletoCode)}
              className="w-full py-2 bg-luxury-gold hover:bg-amber-400 text-black font-bold rounded text-xs uppercase tracking-wide flex items-center justify-center gap-2 transition-colors shadow-lg shadow-amber-500/10"
            >
              <CopyIcon /> Copiar Código
            </button>
          </div>
        )}

        {/* Render Model Image Response if present */}
        {!isUser && message.image && (
           <div className="mt-4 rounded-lg overflow-hidden border border-luxury-gold/30 shadow-2xl">
              <img 
                src={`data:image/jpeg;base64,${message.image}`} 
                alt="AI Generated" 
                className="w-full h-auto"
              />
              <div className="bg-black/80 px-3 py-1 text-xs text-luxury-gold text-center tracking-wider uppercase border-t border-luxury-gold/20">
                Gerado por Gemini AI
              </div>
           </div>
        )}

        {/* Timestamp */}
        <div className={`text-[10px] mt-2 opacity-50 uppercase tracking-wider ${isUser ? 'text-right' : 'text-left'} ${isWelcome ? 'text-center opacity-30' : ''}`}>
          {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>
    </div>
  );
};

// --- Toast Notification ---
const Toast: React.FC<{ message: string; visible: boolean }> = ({ message, visible }) => {
  if (!visible) return null;
  return (
    <div className="fixed top-24 left-1/2 transform -translate-x-1/2 z-50 animate-fade-in">
      <div className="bg-luxury-black/90 backdrop-blur-md border border-luxury-gold/30 text-luxury-gold px-6 py-3 rounded-full shadow-2xl flex items-center gap-3">
        <CopyIcon />
        <span className="text-sm font-medium tracking-wide">{message}</span>
      </div>
    </div>
  );
};

// --- Main App ---

export default function App() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'model',
      // Texto atualizado com o novo parágrafo sobre a Gemini AI
      text: `# Bem-vindo ao Leitor de Imagens.\n\nSou seu assistente alimentado por inteligência artificial. Posso analisar documentos, ler boletos, resumir gráficos, ou modificar imagens.\n\nClique no clip de papel para abrir uma imagem (inclusive Prints),\ncole (Ctrl+V) uma imagem copiada ou\nclique na camera se disponível para começar.\n\nEscreva ^^boleto^^ se desejar ler o código de barras para pagamento.\nAutomáticamente este código será copiado e basta ir no seu banco para pagar.\n\nSe a imagem for de uma Nota Fiscal, por exemplo, ou qualquer outra que tenha texto escreva ^^ler^^ e será fornecido o texto escrito.\n\nComo este App usa a ^^Gemini AI^^ perguntas podem ser feitas e serão respondidas.\n\n^^by AD^^`,
      timestamp: Date.now()
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null); // Base64
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isCameraOpen, setIsCameraOpen] = useState(false); // Controls desktop camera modal
  const [hasCamera, setHasCamera] = useState(false); // Controls button visibility/state
  const [toast, setToast] = useState<{ show: boolean; msg: string }>({ show: false, msg: '' });
  
  // PWA Install Prompt State
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // --- Start Up Logic: Check for Shared Images (PWA) ---
  useEffect(() => {
    const handleSharedImage = async () => {
      // Check for flag in URL (redirected from Service Worker)
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('share_processing') === 'true') {
        
        try {
          // Open the specific cache where SW stored the file
          const cache = await caches.open('share-target-cache');
          const response = await cache.match('shared-image');
          
          if (response) {
            const blob = await response.blob();
            // Delete from cache after retrieving to keep it clean
            await cache.delete('shared-image');
            
            // Convert to Base64 for the app
            const reader = new FileReader();
            reader.onload = (event) => {
               const result = event.target?.result as string;
               const base64Clean = result.split(',')[1];
               setSelectedImage(base64Clean);
               showToastMessage("Imagem compartilhada recebida!");
            };
            reader.readAsDataURL(blob);

            // Clean URL
            window.history.replaceState({}, document.title, "/");
          }
        } catch (err) {
          console.error("Erro ao recuperar imagem compartilhada", err);
        }
      }
    };

    handleSharedImage();
  }, []);

  // --- PWA Installation Listener ---
  useEffect(() => {
    const handler = (e: any) => {
      // Prevent Chrome 67 and earlier from automatically showing the prompt
      e.preventDefault();
      // Stash the event so it can be triggered later.
      setDeferredPrompt(e);
      console.log("PWA Install prompt intercepted");
    };

    window.addEventListener('beforeinstallprompt', handler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    
    // Show the install prompt
    deferredPrompt.prompt();
    
    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`User response to the install prompt: ${outcome}`);
    
    // We've used the prompt, and can't use it again, throw it away
    setDeferredPrompt(null);
  };

  // Check for camera availability on mount and on device change
  useEffect(() => {
    const checkCamera = async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(device => device.kind === 'videoinput');
        setHasCamera(videoDevices.length > 0);
      } catch (err) {
        console.log("Erro ao checar dispositivos:", err);
        setHasCamera(false);
      }
    };

    checkCamera();
    navigator.mediaDevices.addEventListener('devicechange', checkCamera);
    return () => {
      navigator.mediaDevices.removeEventListener('devicechange', checkCamera);
    };
  }, []);

  // Auto scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  // Logic to handle pasting images
  const handlePaste = useCallback((e: ClipboardEvent | React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        e.preventDefault(); 
        const blob = items[i].getAsFile();
        if (blob) {
          const reader = new FileReader();
          reader.onload = (event) => {
            const result = event.target?.result as string;
            const base64Clean = result.split(',')[1];
            setSelectedImage(base64Clean);
          };
          reader.readAsDataURL(blob);
        }
        break; 
      }
    }
  }, []);

  useEffect(() => {
    const globalPasteListener = (e: ClipboardEvent) => handlePaste(e);
    document.addEventListener('paste', globalPasteListener);
    return () => {
      document.removeEventListener('paste', globalPasteListener);
    };
  }, [handlePaste]);

  const showToastMessage = (msg: string) => {
    setToast({ show: true, msg });
    setTimeout(() => setToast({ show: false, msg: '' }), 3000);
  };

  const handleCopyText = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      showToastMessage("Copiado com sucesso!");
    } catch (err) {
      console.error("Failed to copy:", err);
      showToastMessage("Erro ao copiar.");
    }
  };

  const handleReset = () => {
    if (messages.length > 1 || input || selectedImage) {
      if (!window.confirm("Reiniciar a conversa? O histórico atual será perdido.")) {
        return;
      }
    }

    setMessages([{
      id: 'welcome',
      role: 'model',
      text: `# Bem-vindo ao Leitor de Imagens.\n\nSou seu assistente alimentado por inteligência artificial. Posso analisar documentos, ler boletos, resumir gráficos, ou modificar imagens.\n\nClique no clip de papel para abrir uma imagem (inclusive Prints),\ncole (Ctrl+V) uma imagem copiada ou\nclique na camera se disponível para começar.\n\nEscreva ^^boleto^^ se desejar ler o código de barras para pagamento.\nAutomáticamente este código será copiado e basta ir no seu banco para pagar.\n\nSe a imagem for de uma Nota Fiscal, por exemplo, ou qualquer outra que tenha texto escreva ^^ler^^ e será fornecido o texto escrito.\n\nComo este App usa a ^^Gemini AI^^ perguntas podem ser feitas e serão respondidas.\n\n^^by AD^^`,
      timestamp: Date.now()
    }]);
    setInput('');
    setSelectedImage(null);
    showToastMessage("Conversa reiniciada.");
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        const base64Clean = result.split(',')[1]; 
        setSelectedImage(base64Clean);
      };
      reader.readAsDataURL(file);
    }
    e.target.value = '';
  };

  const handleCameraClick = () => {
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    if (isMobile) {
      cameraInputRef.current?.click();
    } else {
      setIsCameraOpen(true);
    }
  };

  const handleCameraAccessError = () => {
    console.warn("Acesso à câmera falhou (desktop). Desativando botão.");
    setHasCamera(false);
  };

  const handleSendMessage = async () => {
    if ((!input.trim() && !selectedImage) || isLoading) return;

    let finalInputText = input;
    if (finalInputText.trim().toLowerCase() === 'boleto') {
      finalInputText = "mostre o código deste boleto";
    }

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      text: finalInputText,
      image: selectedImage || undefined,
      timestamp: Date.now()
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setSelectedImage(null);
    setIsLoading(true);

    try {
      const response = await handleGeminiRequest(userMsg.text || (userMsg.image ? "Analise esta imagem." : ""), userMsg.image);
      
      const modelMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        text: response.text,
        image: response.image,
        timestamp: Date.now()
      };
      
      setMessages(prev => [...prev, modelMsg]);

      if (response.text) {
        const numberSequenceMatch = response.text.match(/(?:\n|^)(\d{30,})(?:\n|$|\r)/);
        if (numberSequenceMatch) {
          const codeToCopy = numberSequenceMatch[1];
          try {
             await navigator.clipboard.writeText(codeToCopy);
             showToastMessage("Código do boleto copiado!");
          } catch (e) {
             console.log("Auto-copy blocked by browser, waiting for user click.");
          }
        }
      }

    } catch (err: any) {
      const errorText = err instanceof Error ? err.message : "Erro desconhecido.";
      const errorMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        text: `⚠️ ${errorText}`,
        timestamp: Date.now()
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="flex flex-col h-screen w-full bg-luxury-black font-sans text-gray-100 selection:bg-luxury-gold selection:text-black">
      
      <Toast message={toast.msg} visible={toast.show} />

      {/* Camera Modal (Desktop) */}
      {isCameraOpen && (
        <CameraModal 
          onCapture={(base64) => {
            setSelectedImage(base64);
            setIsCameraOpen(false); 
          }}
          onClose={() => setIsCameraOpen(false)}
          onAccessError={handleCameraAccessError}
        />
      )}

      {/* Editor Modal */}
      {isEditorOpen && selectedImage && (
        <ImageEditor 
          base64Image={selectedImage}
          onCancel={() => setIsEditorOpen(false)}
          onSave={(newBase64) => {
            setSelectedImage(newBase64);
            setIsEditorOpen(false);
          }}
        />
      )}

      {/* Header */}
      <header className="flex-none h-20 border-b border-white/5 bg-black/50 backdrop-blur-md flex items-center px-6 md:px-10 justify-between sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-amber-600 to-yellow-300 flex items-center justify-center shadow-[0_0_15px_rgba(212,175,55,0.3)]">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-black">
              <path d="M12 4L14.4 9.6L20 12L14.4 14.4L12 20L9.6 14.4L4 12L9.6 9.6L12 4Z" fill="currentColor"/>
            </svg>
          </div>
          <h1 className="text-2xl font-serif tracking-tight text-luxury-pearl">
            Leitor <span className="text-luxury-gold italic">de</span> Imagens
          </h1>
        </div>
        
        {/* Right Side: Install Button (if available) + Model Info */}
        <div className="flex items-center gap-4">
          
          {/* Custom Install Button (Visible ONLY if installable) */}
          {deferredPrompt && (
            <button 
              onClick={handleInstallClick}
              className="hidden md:flex items-center gap-2 bg-luxury-gold text-black px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider hover:bg-amber-400 transition-colors shadow-[0_0_15px_rgba(212,175,55,0.3)] animate-fade-in"
            >
              <DownloadIcon />
              Instalar App
            </button>
          )}

          <div className="hidden md:flex items-center gap-6 text-xs tracking-widest uppercase text-gray-500 font-medium">
            <span>Gemini 3.0 Flash</span>
            <span className="w-1 h-1 bg-gray-700 rounded-full"></span>
            <span>Gemini 2.5 Image</span>
          </div>

          {/* Mobile Install Icon (if available) */}
          {deferredPrompt && (
            <button 
               onClick={handleInstallClick}
               className="md:hidden text-luxury-gold hover:text-white transition-colors"
               title="Instalar App"
            >
               <DownloadIcon />
            </button>
          )}
        </div>
      </header>

      {/* Chat Area */}
      <main className="flex-1 overflow-y-auto relative p-4 md:p-8 scroll-smooth" ref={scrollRef}>
        <div className="max-w-4xl mx-auto min-h-full flex flex-col justify-end">
          {messages.map(msg => (
            <ChatMessageBubble key={msg.id} message={msg} onCopy={handleCopyText} />
          ))}
          
          {isLoading && (
            <div className="flex w-full mb-6 justify-start animate-fade-in">
              <div className="bg-transparent px-5 py-4 flex items-center gap-3">
                 <div className="w-2 h-2 bg-luxury-gold rounded-full animate-bounce" style={{ animationDelay: '0s' }}></div>
                 <div className="w-2 h-2 bg-luxury-gold rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                 <div className="w-2 h-2 bg-luxury-gold rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Input Area */}
      <footer className="flex-none p-4 md:p-6 bg-black/80 backdrop-blur-xl border-t border-white/5 relative z-30">
        <div className="max-w-4xl mx-auto relative">
          
          {/* Image Preview Floating Frame (Moldura) */}
          {selectedImage && (
            <div className="absolute bottom-full left-0 mb-4 animate-fade-in z-40 w-full md:w-auto">
              {/* Luxury Frame Container */}
              <div className="relative group rounded-xl overflow-hidden shadow-[0_0_30px_rgba(0,0,0,0.8)] border border-luxury-gold/50 bg-luxury-charcoal inline-block">
                
                {/* Image */}
                <div className="relative">
                  <img 
                    src={`data:image/jpeg;base64,${selectedImage}`} 
                    alt="Preview" 
                    className="h-40 md:h-48 w-auto object-cover opacity-90 group-hover:opacity-100 transition-opacity duration-300" 
                  />
                  {/* Gold scan line effect */}
                  <div className="absolute inset-0 bg-gradient-to-b from-transparent via-luxury-gold/10 to-transparent animate-pulse pointer-events-none"></div>
                </div>

                {/* Controls overlay */}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-start justify-end p-2 gap-2">
                   <button 
                    onClick={() => setIsEditorOpen(true)}
                    className="p-2 bg-black/60 backdrop-blur text-white rounded-full hover:bg-luxury-gold hover:text-black transition-all hover:scale-110 shadow-lg border border-white/10"
                    title="Editar imagem"
                  >
                    <EditIcon />
                  </button>
                  <button 
                    onClick={() => setSelectedImage(null)}
                    className="p-2 bg-black/60 backdrop-blur text-white rounded-full hover:bg-red-500 hover:text-white transition-all hover:scale-110 shadow-lg border border-white/10"
                    title="Remover imagem"
                  >
                    <XIcon />
                  </button>
                </div>
                
                {/* Label */}
                <div className="absolute bottom-0 left-0 right-0 bg-black/70 backdrop-blur-sm px-3 py-1.5 text-[10px] uppercase tracking-widest text-luxury-gold font-bold border-t border-luxury-gold/20">
                  Imagem Pronta para Análise
                </div>
              </div>
            </div>
          )}

          {/* Input Bar */}
          <div className="relative flex flex-wrap md:flex-nowrap items-end gap-3 bg-zinc-900/50 border border-white/10 p-3 rounded-2xl shadow-inner focus-within:border-luxury-gold/50 focus-within:bg-zinc-900 transition-all duration-300">
            
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              accept="image/*" 
              onChange={handleFileChange}
            />
             <input 
              type="file" 
              ref={cameraInputRef} 
              className="hidden" 
              accept="image/*"
              capture="environment" 
              onChange={handleFileChange}
            />

            {/* Grupo de Ícones (Esquerda) */}
            <div className="flex items-center gap-1 order-2 md:order-1 mt-2 md:mt-0">
              
              <button 
                onClick={handleReset}
                className="p-3 text-gray-500 hover:text-red-400 hover:bg-white/5 rounded-xl transition-colors"
                title="Reiniciar Conversa"
              >
                <RefreshIcon />
              </button>
              
              <div className="w-px h-6 bg-white/10 mx-1"></div>

              <button 
                onClick={handleCameraClick}
                disabled={!hasCamera} 
                className={`
                  p-3 rounded-xl transition-colors
                  ${!hasCamera 
                    ? 'text-gray-600 opacity-50 cursor-not-allowed' 
                    : 'text-gray-400 hover:text-luxury-gold hover:bg-white/5'
                  }
                `}
                title={hasCamera ? "Tirar foto" : "Câmera não detectada"}
              >
                <CameraIcon />
              </button>

              <button 
                onClick={() => fileInputRef.current?.click()}
                className="p-3 text-gray-400 hover:text-luxury-gold hover:bg-white/5 rounded-xl transition-colors"
                title="Adicionar imagem"
              >
                <PaperclipIcon />
              </button>
            </div>

            {/* Text Input */}
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              placeholder="Cole uma imagem/print (Ctrl+V), digite 'boleto' ou pergunte..."
              className="w-full md:w-auto md:flex-1 order-1 md:order-2 bg-transparent text-gray-200 placeholder-gray-600 focus:outline-none py-3 min-h-[50px] md:min-h-0 max-h-32 resize-none font-light text-sm md:text-base leading-relaxed scrollbar-hide"
              rows={1}
            />

            {/* Send Button */}
            <div className="order-3 md:order-3 ml-auto md:ml-0 flex-shrink-0 mt-2 md:mt-0">
              <button 
                onClick={handleSendMessage}
                disabled={isLoading || (!input.trim() && !selectedImage)}
                className={`
                  p-3 rounded-xl flex items-center justify-center transition-all duration-300
                  ${(isLoading || (!input.trim() && !selectedImage)) 
                    ? 'bg-zinc-800 text-gray-600 cursor-not-allowed' 
                    : 'bg-luxury-gold text-black shadow-[0_0_15px_rgba(212,175,55,0.4)] hover:shadow-[0_0_25px_rgba(212,175,55,0.6)] hover:bg-amber-400'
                  }
                `}
              >
                <SendIcon />
              </button>
            </div>
          </div>
          
          <div className="mt-2 text-center text-[10px] text-gray-600 tracking-widest uppercase">
            Gemini 3 Pro + Gemini 2.5 Flash Image
          </div>

        </div>
      </footer>
    </div>
  );
}