import { GoogleGenAI, GenerateContentResponse } from "@google/genai";

const getApiKey = (): string | undefined => {
  let key: string | undefined = undefined;

  // 1. Tenta Vite (VITE_API_KEY) - Padrão moderno
  try {
    // @ts-ignore
    if (typeof import.meta !== 'undefined' && import.meta.env) {
      // @ts-ignore
      key = import.meta.env.VITE_API_KEY || import.meta.env.API_KEY;
    }
  } catch (e) {
    // Ignora erros de acesso ao import.meta
  }

  if (key) return key;

  // 2. Tenta Process Env (CRA / Node / Webpack)
  try {
    if (typeof process !== 'undefined' && process.env) {
      key = process.env.REACT_APP_API_KEY || process.env.API_KEY;
    }
  } catch (e) {
    // Ignora erros de acesso ao process
  }

  return key;
};

const getAiClient = () => {
  const apiKey = getApiKey();
  
  if (!apiKey) {
    throw new Error("API_KEY_MISSING");
  }
  return new GoogleGenAI({ apiKey: apiKey });
};

// Helper to check for analysis keywords in Portuguese
const isAnalysisPrompt = (prompt: string): boolean => {
  const keywords = [
    'leia', 'ler', 'analise', 'analisar', 'resuma', 'resumir', 
    'extraia', 'extrair', 'texto', 'tabela', 'dados', 'recibo', 
    'conta', 'código', 'descreva', 'descrição', 'o que é', 'explica',
    'boleto', 'código de barras', 'verifique'
  ];
  const lowerPrompt = prompt.toLowerCase();
  return keywords.some(k => lowerPrompt.includes(k));
};

// Helper to format errors nicely
const formatGeminiError = (error: any): string => {
  const msg = error.message || error.toString();

  if (msg.includes("API_KEY_MISSING")) {
    return "⚠️ Erro de Configuração: Nenhuma chave de API foi encontrada.\n\nSe você está no Netlify, certifique-se de que a variável 'VITE_API_KEY' está definida corretamente.\nSe estiver local, crie um arquivo .env com 'VITE_API_KEY=sua_chave'.";
  }
  if (msg.includes("API_KEY")) return "⚠️ Erro de Chave: A chave da API parece inválida ou expirada.";
  if (msg.includes("401") || msg.includes("403")) return "🔒 Acesso Negado: Verifique se sua API Key é válida e tem permissões para este modelo.";
  if (msg.includes("404")) return "🔍 Modelo Não Encontrado: O modelo solicitado pode não estar disponível na sua região ou a API Key não tem acesso a ele.";
  if (msg.includes("429")) return "⏳ Limite Excedido: Você atingiu o limite de requisições (Quota) da API. Tente novamente em alguns instantes.";
  if (msg.includes("503") || msg.includes("Overloaded")) return "🔥 Sobrecarga: Os servidores do Gemini estão com alto tráfego. Tente novamente em breve.";
  if (msg.includes("SAFETY") || msg.includes("blocked")) return "🛡️ Bloqueio de Segurança: A IA recusou a resposta devido aos filtros de segurança de conteúdo.";
  
  return `❌ Erro Técnico: ${msg}`;
};

export const handleGeminiRequest = async (
  prompt: string, 
  imageBase64?: string
): Promise<{ text: string; image?: string }> => {
  
  let finalPrompt = prompt;
  const lowerPrompt = prompt.toLowerCase();

  // Lógica de Detecção Automática de Boleto:
  // Se o usuário pedir explicitamente OU se for uma análise genérica (ex: "Analise esta imagem"),
  // injetamos a instrução para buscar boletos.
  const isGenericAnalysis = lowerPrompt === "analise esta imagem.";
  const hasBoletoKeyword = lowerPrompt.includes('boleto') || lowerPrompt.includes('código');

  if (hasBoletoKeyword || (imageBase64 && isGenericAnalysis)) {
    finalPrompt += `\n\nATENÇÃO: Verifique visualmente se existe um código de barras, linha digitável ou boleto bancário na imagem.\nSE ENCONTRAR, siga EXATAMENTE este formato:\n1. Escreva a linha digitável formatada (com pontos e espaços) entre asteriscos duplos (ex: **12345.67890...**).\n2. Na linha IMEDIATAMENTE ABAIXO, escreva SOMENTE os números (sem pontos, espaços, traços ou texto adicional) para que eu possa copiar automaticamente.\n3. Dê enter.\nSe não houver boleto, apenas analise a imagem normalmente.`;
  }

  try {
    // Initialize inside try-catch to handle config errors
    const ai = getAiClient();

    // Scenario 1: Text Only (No Image) -> Use Flash 3 Preview
    if (!imageBase64) {
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: finalPrompt,
      });
      
      if (!response.text) {
        throw new Error("A IA não retornou texto. Pode ter sido bloqueado.");
      }
      return { text: response.text };
    }

    // Scenario 2: Image Present
    const isAnalysis = isAnalysisPrompt(prompt);

    if (isAnalysis) {
      // Scenario 2a: Image Analysis -> Use Flash 3 Preview
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: {
          parts: [
            {
              inlineData: {
                mimeType: 'image/jpeg', 
                data: imageBase64,
              },
            },
            { text: finalPrompt },
          ],
        },
      });
      return { text: response.text || "Análise concluída, mas a IA não retornou detalhes." };
    
    } else {
      // Scenario 2b: Image Generation/Editing -> Use Flash 2.5 Image
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
          parts: [
            {
              inlineData: {
                mimeType: 'image/jpeg',
                data: imageBase64,
              },
            },
            { text: finalPrompt },
          ],
        },
      });

      // Parse response for image data
      let generatedImage = '';
      let generatedText = '';

      if (response.candidates?.[0]?.content?.parts) {
        for (const part of response.candidates[0].content.parts) {
          if (part.inlineData && part.inlineData.data) {
            generatedImage = part.inlineData.data;
          } else if (part.text) {
            generatedText += part.text;
          }
        }
      }

      if (!generatedImage && !generatedText) {
        throw new Error("A IA não gerou imagem nem texto. Tente reformular o prompt.");
      }

      return { 
        text: generatedText || (generatedImage ? "Imagem processada com sucesso." : ""),
        image: generatedImage 
      };
    }

  } catch (error: any) {
    console.error("Gemini API Error Detail:", error);
    // Return the formatted error as the text response so the user sees it in the chat
    return { text: formatGeminiError(error) };
  }
};