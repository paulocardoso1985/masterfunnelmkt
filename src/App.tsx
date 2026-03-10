/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * BUILD_TRIGGER: 2026-03-10_16:50
 */

import React, { useState, useEffect } from 'react';
import Markdown from 'react-markdown';
import {
  Rocket,
  Target,
  Palette,
  Lightbulb,
  Loader2,
  Image as ImageIcon,
  Download,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Video,
  Play,
  Layers,
  Sparkles,
  FileText,
  Monitor,
  Volume2,
  RefreshCw,
  LogOut,
  History,
  Trash2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Types ---
interface User {
  id: number;
  email: string;
  role: string;
  name: string;
}

interface StrategyData {
  negocio: string;
  ideia: string;
  publico: string;
  estilo: string;
  formatos: string[];
  slidesCarrossel: number;
}

interface GeneratedAsset {
  url: string;
  tipo: string;
  aspectRatio: "1:1" | "9:16" | "16:9";
  label?: string;
}

interface GeneratedContent {
  text: string;
  assets: GeneratedAsset[];
  videoPrompt: string;
  narrationScript?: string;
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [loginData, setLoginData] = useState({ email: '', password: '' });
  const [showAdmin, setShowAdmin] = useState(false);
  const [adminLogs, setAdminLogs] = useState<any[]>([]);
  const [adminUsers, setAdminUsers] = useState<any[]>([]);
  const [newUser, setNewUser] = useState({ email: '', password: '', name: '', role: 'user' });
  const [adminTab, setAdminTab] = useState<'logs' | 'users'>('logs');

  const [showHistory, setShowHistory] = useState(false);
  const [historyList, setHistoryList] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const [formData, setFormData] = useState<StrategyData>({
    negocio: '',
    ideia: '',
    publico: '',
    estilo: 'Profissional',
    formatos: ['Feed (Instagram/LinkedIn) - 1:1'],
    slidesCarrossel: 5
  });
  const [loading, setLoading] = useState(false);
  const [videoLoading, setVideoLoading] = useState(false);
  const [audioLoading, setAudioLoading] = useState(false);
  const [result, setResult] = useState<GeneratedContent | null>(null);
  const [generatedVideo, setGeneratedVideo] = useState<string | null>(null);
  const [generatedAudio, setGeneratedAudio] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string>('');

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const res = await fetch('/api/me');
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
      }
    } catch (err) {
      console.error("Auth check failed");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginData)
      });
      const data = await res.json();
      if (res.ok) {
        setUser(data.user);
      } else {
        setError(data.error || "Falha no login");
      }
    } catch (err) {
      setError("Erro de conexão");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await fetch('/api/logout', { method: 'POST' });
    setUser(null);
    setShowAdmin(false);
  };

  const fetchLogs = async () => {
    try {
      const res = await fetch('/api/admin/logs');
      if (res.ok) {
        const data = await res.json();
        setAdminLogs(data.logs);
      }
    } catch (err) {
      console.error("Failed to fetch logs");
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/admin/users');
      if (res.ok) {
        const data = await res.json();
        setAdminUsers(data.users);
      }
    } catch (err) {
      console.error("Failed to fetch users");
    }
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newUser)
      });
      if (res.ok) {
        setNewUser({ email: '', password: '', name: '', role: 'user' });
        fetchUsers();
      } else {
        const data = await res.json();
        alert(data.error);
      }
    } catch (err) {
      alert("Erro ao adicionar usuário");
    }
  };

  const handleDeleteUser = async (id: number) => {
    if (!confirm("Tem certeza que deseja excluir este usuário?")) return;
    try {
      const res = await fetch(`/api/admin/users/${id}`, { method: 'DELETE' });
      if (res.ok) fetchUsers();
    } catch (err) {
      alert("Erro ao excluir usuário");
    }
  };

  // Helper to get AI instance (DEPRECATED - Moved to server)
  // const getAI = () => { ... };

  const generateStrategy = async () => {
    const { negocio, ideia, publico, estilo, formatos, slidesCarrossel } = formData;

    if (!negocio.trim() || !ideia.trim() || !publico.trim() || !estilo.trim() || formatos.length === 0) {
      setError("Ops! Para criar uma estratégia de alta performance, precisamos que todos os campos (Negócio, Ideia, Público, Estilo e pelo menos um Formato) sejam preenchidos.");
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);
    setGeneratedVideo(null);
    setGeneratedAudio(null);
    setStatus('Arquitetando narrativa de elite...');
    const textModel = "gemini-1.5-flash";
    try {
      // Log usage
      const aspectRatioMap: Record<string, "1:1" | "9:16" | "16:9"> = {
        'Feed (Instagram/LinkedIn) - 1:1': '1:1',
        'Stories/Reels/TikTok - 9:16': '9:16',
        'Banner/YouTube/Site - 16:9': '16:9',
        'Carrossel para Feed - 1:1': '1:1',
        'Carrossel para Story - 9:16': '9:16'
      };

      // const ai = getAI();
      // ...

      // 1. Generate Strategy Text & Video Prompts (Now via Server)
      const textResponse = await fetch('/api/ai/generate-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: prompt,
          systemInstruction: "Você é o Diretor de Criação da MASTER FUNNEL. Sua missão é entregar estratégias de marketing de elite, com português impecável (PT-BR), sem erros ortográficos, e tom extremamente profissional e persuasivo.",
          model: textModel
        })
      });

      if (!textResponse.ok) {
        const errData = await textResponse.json();
        throw new Error(errData.error || `Erro de servidor (${textResponse.status})`);
      }

      const textData = await textResponse.json();
      const fullText = textData.text || '';

      // 2. Extract Prompts
      setStatus('Extraindo prompts e gerando visuais...');
      // More robust regex to catch assets even with slight formatting variations
      const assetRegex = /\[ASSET:\s*(.*?)\s*\|?\s*PROMPT:\s*(.*?)\]/gs;
      const assetMatches = [...fullText.matchAll(assetRegex)];

      const videoMatch = fullText.match(/\[VIDEO_PROMPT: (.*?)\]/);
      const videoPrompt = videoMatch ? videoMatch[1] : `Cinematic high-end commercial for ${negocio}, 4k, slow motion, professional lighting`;

      const narrationMatch = fullText.match(/\[NARRATION_SCRIPT: (.*?)\]/s);
      const narrationScript = narrationMatch ? narrationMatch[1] : '';

      // 3. Generate Images (Sequential to avoid 429 Resource Exhausted)
      const imageModel = "gemini-2.5-flash-image";
      const generatedAssets = [];

      for (let i = 0; i < assetMatches.length; i++) {
        const match = assetMatches[i];
        const fullLabel = match[1];
        const p = match[2];

        setStatus(`Gerando asset ${i + 1} de ${assetMatches.length}: ${fullLabel}...`);

        // Determine base type for aspect ratio
        let baseType = fullLabel;
        if (fullLabel.includes(' - Slide')) {
          baseType = fullLabel.split(' - Slide')[0];
        }

        let ratio: "1:1" | "9:16" | "16:9" = '16:9';
        if (fullLabel.includes('1:1')) ratio = '1:1';
        else if (fullLabel.includes('9:16')) ratio = '9:16';
        else if (fullLabel.includes('16:9')) ratio = '16:9';
        else ratio = aspectRatioMap[baseType] || '16:9';

        try {
          const res = await fetch('/api/ai/generate-image', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: p, aspectRatio: ratio, model: imageModel })
          });

          if (!res.ok) throw new Error(`Imagem falhou (${res.status})`);

          const data = await res.json();
          if (data.data) {
            generatedAssets.push({
              url: `data:image/png;base64,${data.data}`,
              tipo: baseType,
              label: fullLabel,
              aspectRatio: ratio
            });
          }

          // Small delay between requests to prevent rate limit confusion
          if (i < assetMatches.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 800));
          }
        } catch (imgErr) {
          console.error(`Failed to generate asset: ${fullLabel}`, imgErr);
        }
      }
      const cleanText = fullText.split('ASSETS_PROMPTS')[0].trim();

      setResult({
        text: cleanText,
        assets: generatedAssets,
        videoPrompt: videoPrompt,
        narrationScript: narrationScript
      });
      setStatus('');

      // 4. Save to History
      try {
        await fetch('/api/strategies', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            negocio,
            ideia,
            publico,
            estilo,
            formatos,
            reportText: cleanText,
            videoPrompt,
            narrationScript
          })
        });
      } catch (err) {
        console.error("Failed to save strategy to history");
      }
    } catch (err: any) {
      console.error("DEBUG: Detailed Generation Error:", err);
      // More specific error handling
      if (err.status === 404) {
        setError(`Modelo não encontrado (${textModel}). Por favor, verifique se o modelo está liberado para sua região.`);
      } else if (err.status === 403) {
        setError("Chave de API inválida ou sem permissão para este modelo.");
      } else {
        setError(err.message || "Erro na geração. Verifique sua chave de API ou tente novamente.");
      }
    } finally {
      setLoading(false);
    }
  };

  const generateVideoAsset = async () => {
    if (!result?.videoPrompt) return;

    setVideoLoading(true);
    setStatus('Gerando vídeo cinematográfico (Veo 3.1)...');

    try {
      // Veo only supports 16:9 and 9:16.
      const videoAspectRatio = result.assets[0]?.aspectRatio === '1:1' ? '16:9' : (result.assets[0]?.aspectRatio || '16:9');

      const resp = await fetch('/api/ai/generate-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: result.videoPrompt,
          aspectRatio: videoAspectRatio
        })
      });

      if (!resp.ok) {
        const errData = await resp.json();
        throw new Error(errData.error || `Erro de servidor (${resp.status})`);
      }

      const data = await resp.json();
      if (data.data) {
        setGeneratedVideo(`data:video/mp4;base64,${data.data}`);
      }
    } catch (err: any) {
      console.error("Video Generation Error:", err);
      setError(`Falha ao gerar vídeo: ${err.message || 'Erro desconhecido'}`);
    } finally {
      setVideoLoading(false);
      setStatus('');
    }
  };

  const generateAudio = async () => {
    if (!result?.narrationScript) return;

    setAudioLoading(true);
    setStatus('Gerando narração profissional em PT-BR...');

    try {
      const resp = await fetch('/api/ai/generate-audio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: result.narrationScript })
      });

      if (!resp.ok) {
        const errData = await resp.json();
        throw new Error(errData.error || `Erro de servidor (${resp.status})`);
      }

      const data = await resp.json();
      if (data.data) {
        setGeneratedAudio(`data:audio/wav;base64,${data.data}`);
      } else {
        throw new Error("O servidor não retornou dados de áudio.");
      }
    } catch (err: any) {
      console.error("Audio Generation Error:", err);
      setError(`Falha ao gerar narração: ${err.message || 'Erro desconhecido'}`);
    } finally {
      setAudioLoading(false);
      setStatus('');
    }
  };

  const downloadImage = (base64Data: string, filename: string) => {
    const link = document.createElement('a');
    link.href = base64Data;
    link.download = `${filename}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportToPDF = async () => {
    if (!result) return;

    const element = document.querySelector('.strategy-doc') as HTMLElement;
    if (!element) return;

    setLoading(true);
    setStatus('Gerando PDF de alta definição...');

    try {
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff'
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      const imgProps = pdf.getImageProperties(imgData);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`estrategia-${formData.negocio.toLowerCase().replace(/\s+/g, '-')}.pdf`);
    } catch (err) {
      console.error('PDF Error:', err);
      window.print(); // Fallback to browser print
    } finally {
      setLoading(false);
      setStatus('');
    }
  };

  const downloadVideo = () => {
    if (!generatedVideo) return;
    const link = document.createElement('a');
    link.href = generatedVideo;
    link.download = `video-campanha-${formData.negocio.toLowerCase().replace(/\s+/g, '-')}.mp4`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const fetchHistory = async () => {
    setHistoryLoading(true);
    try {
      const res = await fetch('/api/strategies');
      if (res.ok) {
        const data = await res.json();
        setHistoryList(data.strategies);
      }
    } catch (err) {
      console.error("Failed to fetch history");
    } finally {
      setHistoryLoading(false);
    }
  };

  const loadFromHistory = async (id: number) => {
    setLoading(true);
    setStatus('Recuperando estratégia do arquivo...');
    try {
      const res = await fetch(`/api/strategies/${id}`);
      if (res.ok) {
        const { strategy } = await res.json();
        setFormData({
          negocio: strategy.negocio,
          ideia: strategy.ideia,
          publico: strategy.publico,
          estilo: strategy.estilo,
          formatos: strategy.formatos,
          slidesCarrossel: 5 // Default
        });

        setResult({
          text: strategy.reportText,
          assets: [], // As imagens não são salvas (muito grandes), o usuário deve re-gerar se necessário
          videoPrompt: strategy.videoPrompt,
          narrationScript: strategy.narrationScript
        });
        setGeneratedVideo(null);
        setGeneratedAudio(null);
        setShowHistory(false);
        setShowAdmin(false);
      }
    } catch (err) {
      alert("Erro ao carregar do histórico");
    } finally {
      setLoading(false);
      setStatus('');
    }
  };

  const deleteFromHistory = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    if (!confirm("Excluir esta estratégia do histórico?")) return;
    try {
      const res = await fetch(`/api/strategies/${id}`, { method: 'DELETE' });
      if (res.ok) fetchHistory();
    } catch (err) {
      alert("Erro ao excluir do histórico");
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <Loader2 className="text-[#f58f2a] animate-spin" size={48} />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#050505] text-white font-sans flex items-center justify-center p-6">
        <div className="w-full max-w-md space-y-8">
          <div className="text-center space-y-4">
            <div className="flex justify-center mb-6">
              <img
                src="https://maiscorporativo.tur.br/wp-content/uploads/2025/02/Logo-azul-png.png"
                alt="Logo"
                className="h-16 object-contain"
              />
            </div>
            <h1 className="text-3xl font-bold tracking-tighter uppercase">MASTER FUNNEL</h1>
            <p className="text-xs font-bold tracking-[0.4em] text-[#f58f2a] uppercase">Acesso Restrito MAIS Corporativo</p>
          </div>

          <form onSubmit={handleLogin} className="bg-[#0c2444] p-8 rounded-[32px] border border-white/5 shadow-2xl space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] uppercase tracking-widest font-bold text-white/40">E-mail Corporativo</label>
              <input
                type="email"
                required
                value={loginData.email}
                onChange={e => setLoginData({ ...loginData, email: e.target.value })}
                className="w-full bg-white/5 border-b border-white/10 py-3 focus:border-[#f58f2a] outline-none transition-all"
                placeholder="seu@email.com"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] uppercase tracking-widest font-bold text-white/40">Senha de Acesso</label>
              <input
                type="password"
                required
                value={loginData.password}
                onChange={e => setLoginData({ ...loginData, password: e.target.value })}
                className="w-full bg-white/5 border-b border-white/10 py-3 focus:border-[#f58f2a] outline-none transition-all"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-[10px] uppercase font-bold text-center">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-[#f58f2a] text-white rounded-2xl font-bold uppercase tracking-widest text-xs hover:bg-[#f15424] transition-all flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="animate-spin" size={16} /> : <Play size={16} />}
              Entrar no Sistema
            </button>
          </form>

          <p className="text-center text-[10px] text-white/20 uppercase tracking-widest">
            Uso exclusivo para colaboradores autorizados.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans selection:bg-[#f58f2a] selection:text-white print:bg-white print:text-black lg:pl-20">
      <style dangerouslySetInnerHTML={{
        __html: `
        @media print {
          body { background: white !important; color: black !important; }
          aside, header, footer, section, .xl\\:col-span-4, button, .print\\:hidden {
            display: none !important;
          }
          main { padding: 0 !important; margin: 0 !important; max-width: none !important; }
          .xl\\:col-span-8 {
            width: 100% !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          .strategy-doc {
            display: block !important;
            box-shadow: none !important;
            border: none !important;
            padding: 2rem !important;
            color: black !important;
            background: white !important;
          }
          .strategy-doc * {
            color: black !important;
          }
          .prose { max-width: none !important; }
        }
      `}} />
      {/* Sidebar Navigation (Desktop) */}
      <aside className="fixed left-0 top-0 h-full w-20 bg-[#0c2444] border-r border-white/5 flex flex-col items-center py-8 gap-8 z-50 hidden lg:flex">
        <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-lg shadow-orange-500/20 overflow-hidden p-2 border border-white/10">
          <img
            src="https://maiscorporativo.tur.br/wp-content/uploads/2025/02/Logo-azul-png.png"
            alt="Logo"
            className="w-full h-full object-contain"
          />
        </div>
        <nav className="flex flex-col gap-6">
          <button
            onClick={() => { setResult(null); setShowAdmin(false); }}
            className={cn("p-3 rounded-xl transition-all", !result && !showAdmin ? "bg-[#f58f2a] text-white" : "hover:bg-white/5 text-white/40")}
            title="Nova Estratégia"
          >
            <Monitor size={20} />
          </button>
          <button
            onClick={() => { if (result) setShowAdmin(false); setShowHistory(false); }}
            className={cn("p-3 rounded-xl transition-all", result && !showAdmin && !showHistory ? "bg-[#f58f2a] text-white" : "hover:bg-white/5 text-white/40")}
            title="Ver Resultado Atual"
          >
            <Layers size={20} />
          </button>
          <button
            onClick={() => { setShowHistory(true); setShowAdmin(false); fetchHistory(); }}
            className={cn("p-3 rounded-xl transition-all", showHistory ? "bg-[#f58f2a] text-white" : "hover:bg-white/5 text-white/40")}
            title="Histórico de Estratégias"
          >
            <History size={20} />
          </button>
          <button
            onClick={() => { setShowAdmin(true); fetchLogs(); }}
            className={cn("p-3 rounded-xl transition-all", showAdmin ? "bg-[#f58f2a] text-white" : "hover:bg-white/5 text-white/40")}
            title="Administração"
          >
            <Sparkles size={20} />
          </button>
          <button
            onClick={exportToPDF}
            className="p-3 rounded-xl hover:bg-white/5 text-white/40 transition-colors"
            title="Exportar PDF"
          >
            <FileText size={20} />
          </button>
        </nav>
      </aside>

      <header className="h-20 border-b border-white/5 bg-[#050505]/80 backdrop-blur-xl sticky top-0 z-40 px-8 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <img
            src="https://maiscorporativo.tur.br/wp-content/uploads/2025/02/Logo-azul-png.png"
            alt="Logo"
            className="h-10 object-contain"
          />
          <div className="h-8 w-px bg-white/10 hidden sm:block" />
          <div className="flex flex-col">
            <h1 className="text-lg font-bold tracking-tighter uppercase leading-none">MASTER FUNNEL</h1>
            <p className="text-[10px] font-bold tracking-[0.3em] text-[#f58f2a] uppercase leading-none mt-1">MAIS MARKETING</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {result && (
            <button
              onClick={() => {
                setResult(null); setGeneratedVideo(null); setFormData({
                  negocio: '',
                  ideia: '',
                  publico: '',
                  estilo: 'Profissional',
                  formatos: ['Feed (Instagram/LinkedIn) - 1:1'],
                  slidesCarrossel: 5
                });
              }}
              className="hidden sm:flex items-center gap-2 px-4 py-2 bg-[#f58f2a] text-white rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-[#f15424] transition-all shadow-lg shadow-orange-500/20"
            >
              <RefreshCw size={14} /> Nova Estratégia
            </button>
          )}
          <div className="hidden lg:flex flex-col items-end mr-4">
            <span className="text-[10px] font-bold uppercase tracking-widest text-white/40">Bem-vindo,</span>
            <span className="text-xs font-bold text-[#f58f2a]">{user.name}</span>
          </div>
          {user.role === 'admin' && (
            <button
              onClick={() => {
                setShowAdmin(!showAdmin);
                if (!showAdmin) fetchLogs();
              }}
              className={cn(
                "p-2 rounded-xl border transition-all",
                showAdmin ? "bg-[#f58f2a] border-[#f58f2a] text-white" : "bg-white/5 border-white/10 text-white/40 hover:text-white"
              )}
              title="Monitoramento de Uso"
            >
              <FileText size={20} />
            </button>
          )}
          <button
            onClick={handleLogout}
            className="p-2 rounded-xl bg-white/5 border border-white/10 text-white/40 hover:text-white hover:bg-red-500/20 hover:border-red-500/20 transition-all"
            title="Sair do Sistema"
          >
            <ArrowRight size={20} />
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-8 lg:p-12">
        {showHistory ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-8"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-3xl font-serif italic">Histórico de Estratégias</h2>
              <button
                onClick={fetchHistory}
                disabled={historyLoading}
                className="p-2 bg-white/5 rounded-xl text-white/40 hover:text-white transition-colors"
              >
                <RefreshCw size={20} className={cn(historyLoading && "animate-spin")} />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {historyList.map((item) => (
                <div
                  key={item.id}
                  onClick={() => loadFromHistory(item.id)}
                  className="group bg-[#0c2444] p-6 rounded-[32px] border border-white/5 hover:border-[#f58f2a]/30 transition-all cursor-pointer relative overflow-hidden"
                >
                  <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => deleteFromHistory(e, item.id)}
                      className="p-2 bg-red-500/10 text-red-400 rounded-lg hover:bg-red-500/20 transition-all"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-[#f58f2a]/10 rounded-xl flex items-center justify-center text-[#f58f2a]">
                        <Target size={20} />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[10px] uppercase tracking-widest font-bold text-white/40">Negócio</span>
                        <span className="font-bold text-sm line-clamp-1">{item.negocio}</span>
                      </div>
                    </div>

                    <div className="pt-4 border-t border-white/5">
                      <p className="text-xs text-white/60 line-clamp-2 italic mb-4">
                        "{item.ideia}"
                      </p>
                      <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-white/30">
                        <span>{new Date(item.timestamp).toLocaleDateString('pt-BR')}</span>
                        <span className="text-[#f58f2a] opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                          Abrir <ArrowRight size={12} />
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              {historyList.length === 0 && !historyLoading && (
                <div className="col-span-full py-20 text-center space-y-4">
                  <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto text-white/10">
                    <History size={32} />
                  </div>
                  <p className="text-white/20 uppercase tracking-[0.2em] font-bold text-xs">Nenhuma estratégia salva ainda.</p>
                </div>
              )}
            </div>
          </motion.div>
        ) : showAdmin ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-8"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-8">
                <h2 className="text-3xl font-serif italic">Administração</h2>
                <div className="flex bg-white/5 p-1 rounded-xl border border-white/10">
                  <button
                    onClick={() => setAdminTab('logs')}
                    className={cn(
                      "px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all",
                      adminTab === 'logs' ? "bg-[#f58f2a] text-white" : "text-white/40 hover:text-white"
                    )}
                  >
                    Logs de Uso
                  </button>
                  <button
                    onClick={() => {
                      setAdminTab('users');
                      fetchUsers();
                    }}
                    className={cn(
                      "px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all",
                      adminTab === 'users' ? "bg-[#f58f2a] text-white" : "text-white/40 hover:text-white"
                    )}
                  >
                    Gerenciar Usuários
                  </button>
                </div>
              </div>
              <button
                onClick={() => adminTab === 'logs' ? fetchLogs() : fetchUsers()}
                className="px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-white/10 transition-all"
              >
                Atualizar
              </button>
            </div>

            {adminTab === 'logs' ? (
              <div className="bg-[#0c2444] rounded-[32px] border border-white/5 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-white/5 bg-white/5">
                        <th className="p-6 text-[10px] uppercase tracking-widest font-bold text-white/40">Usuário</th>
                        <th className="p-6 text-[10px] uppercase tracking-widest font-bold text-white/40">Ação</th>
                        <th className="p-6 text-[10px] uppercase tracking-widest font-bold text-white/40">Parâmetros</th>
                        <th className="p-6 text-[10px] uppercase tracking-widest font-bold text-white/40">Data/Hora</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {adminLogs.map((log, i) => (
                        <tr key={i} className="hover:bg-white/[0.02] transition-colors">
                          <td className="p-6">
                            <div className="flex flex-col">
                              <span className="font-bold text-sm">{log.userName}</span>
                              <span className="text-[10px] text-white/40">{log.userEmail}</span>
                            </div>
                          </td>
                          <td className="p-6">
                            <span className="px-2 py-1 bg-green-500/10 text-green-400 rounded text-[10px] font-bold uppercase tracking-widest">
                              {log.action}
                            </span>
                          </td>
                          <td className="p-6">
                            <div className="text-[10px] text-white/60 space-y-1">
                              <p><strong className="text-white/80">Negócio:</strong> {log.params.negocio}</p>
                              <p><strong className="text-white/80">Ideia:</strong> {log.params.ideia?.substring(0, 50)}...</p>
                            </div>
                          </td>
                          <td className="p-6 text-xs text-white/40">
                            {new Date(log.timestamp).toLocaleString('pt-BR')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-1">
                  <form onSubmit={handleAddUser} className="bg-[#0c2444] p-8 rounded-[32px] border border-white/5 space-y-6">
                    <h3 className="text-xl font-serif italic">Novo Usuário</h3>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-[10px] uppercase tracking-widest font-bold text-white/40">Nome Completo</label>
                        <input
                          type="text"
                          required
                          value={newUser.name}
                          onChange={e => setNewUser({ ...newUser, name: e.target.value })}
                          className="w-full bg-white/5 border-b border-white/10 py-2 focus:border-[#f58f2a] outline-none transition-all text-sm"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] uppercase tracking-widest font-bold text-white/40">E-mail</label>
                        <input
                          type="email"
                          required
                          value={newUser.email}
                          onChange={e => setNewUser({ ...newUser, email: e.target.value })}
                          className="w-full bg-white/5 border-b border-white/10 py-2 focus:border-[#f58f2a] outline-none transition-all text-sm"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] uppercase tracking-widest font-bold text-white/40">Senha</label>
                        <input
                          type="password"
                          required
                          value={newUser.password}
                          onChange={e => setNewUser({ ...newUser, password: e.target.value })}
                          className="w-full bg-white/5 border-b border-white/10 py-2 focus:border-[#f58f2a] outline-none transition-all text-sm"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] uppercase tracking-widest font-bold text-white/40">Cargo</label>
                        <select
                          value={newUser.role}
                          onChange={e => setNewUser({ ...newUser, role: e.target.value })}
                          className="w-full bg-white/5 border-b border-white/10 py-2 focus:border-[#f58f2a] outline-none transition-all text-sm"
                        >
                          <option value="user" className="bg-[#0c2444]">Usuário Padrão</option>
                          <option value="admin" className="bg-[#0c2444]">Administrador</option>
                        </select>
                      </div>
                    </div>
                    <button
                      type="submit"
                      className="w-full py-3 bg-[#f58f2a] text-white rounded-xl font-bold uppercase tracking-widest text-[10px] hover:bg-[#f15424] transition-all"
                    >
                      Cadastrar Usuário
                    </button>
                  </form>
                </div>

                <div className="lg:col-span-2">
                  <div className="bg-[#0c2444] rounded-[32px] border border-white/5 overflow-hidden">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="border-b border-white/5 bg-white/5">
                          <th className="p-6 text-[10px] uppercase tracking-widest font-bold text-white/40">Usuário</th>
                          <th className="p-6 text-[10px] uppercase tracking-widest font-bold text-white/40">Nível</th>
                          <th className="p-6 text-[10px] uppercase tracking-widest font-bold text-white/40 text-right">Ações</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {adminUsers.map((u) => (
                          <tr key={u.id} className="hover:bg-white/[0.02] transition-colors">
                            <td className="p-6">
                              <div className="flex flex-col">
                                <span className="font-bold text-sm">{u.name}</span>
                                <span className="text-[10px] text-white/40">{u.email}</span>
                              </div>
                            </td>
                            <td className="p-6">
                              <span className={cn(
                                "px-2 py-1 rounded text-[10px] font-bold uppercase tracking-widest",
                                u.role === 'admin' ? "bg-[#f58f2a]/10 text-[#f58f2a]" : "bg-white/10 text-white/60"
                              )}>
                                {u.role}
                              </span>
                            </td>
                            <td className="p-6 text-right">
                              {u.id !== user.id && (
                                <button
                                  onClick={() => handleDeleteUser(u.id)}
                                  className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
                                >
                                  Excluir
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-12">
            {/* Left: Input Panel */}
            <div className="xl:col-span-4 space-y-8">
              <section className="bg-[#0c2444] p-8 rounded-[32px] border border-white/5 shadow-2xl relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
                  <Sparkles size={48} />
                </div>

                <h2 className="text-2xl font-serif italic mb-8">Nova Estratégia</h2>

                <div className="space-y-8">
                  <div className="space-y-3">
                    <label className="text-[10px] uppercase tracking-[0.2em] font-bold text-white/40 flex items-center gap-2">
                      <Target size={14} className="text-[#f58f2a]" /> Nome do Negócio
                    </label>
                    <input
                      type="text"
                      value={formData.negocio}
                      onChange={e => setFormData({ ...formData, negocio: e.target.value })}
                      placeholder="Ex: MAIS Corporativo"
                      className="w-full bg-white/5 border-b border-white/10 py-3 focus:border-[#f58f2a] outline-none transition-all font-medium text-lg placeholder:text-white/10"
                    />
                  </div>

                  <div className="space-y-3">
                    <label className="text-[10px] uppercase tracking-[0.2em] font-bold text-white/40 flex items-center gap-2">
                      <Lightbulb size={14} className="text-[#f58f2a]" /> Ideia Central
                    </label>
                    <textarea
                      value={formData.ideia}
                      onChange={e => setFormData({ ...formData, ideia: e.target.value })}
                      placeholder="Qual o objetivo desta campanha?"
                      rows={4}
                      className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 focus:border-[#f58f2a] outline-none transition-all font-medium resize-none placeholder:text-white/10"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-3 relative group/style">
                      <label className="text-[10px] uppercase tracking-[0.2em] font-bold text-white/40 flex items-center gap-2 cursor-help">
                        <Palette size={14} className="text-[#f58f2a]" /> Estilo
                      </label>
                      <div className="absolute bottom-full left-0 mb-2 w-64 p-4 bg-[#14244c] border border-white/10 rounded-2xl shadow-2xl opacity-0 invisible group-hover/style:opacity-100 group-hover/style:visible transition-all z-50 pointer-events-none">
                        <p className="text-[10px] font-bold text-[#f58f2a] uppercase tracking-widest mb-2">Guia de Estilos</p>
                        <ul className="space-y-2 text-[11px] leading-relaxed text-white/70">
                          <li><strong className="text-white">Profissional:</strong> Credibilidade e sobriedade para o mercado corporativo.</li>
                          <li><strong className="text-white">Brutalista:</strong> Design cru, disruptivo e artístico para marcas modernas.</li>
                          <li><strong className="text-white">Minimalista:</strong> Foco total na ideia com sofisticação e clareza.</li>
                          <li><strong className="text-white">Energético:</strong> Cores vibrantes e movimento para capturar atenção rápida.</li>
                        </ul>
                      </div>
                      <select
                        value={formData.estilo}
                        onChange={e => setFormData({ ...formData, estilo: e.target.value })}
                        className="w-full bg-white/5 border-b border-white/10 py-2 focus:border-[#f58f2a] outline-none transition-all font-medium cursor-pointer"
                      >
                        <option className="bg-[#0c2444]">Profissional</option>
                        <option className="bg-[#0c2444]">Brutalista</option>
                        <option className="bg-[#0c2444]">Minimalista</option>
                        <option className="bg-[#0c2444]">Energético</option>
                      </select>
                    </div>
                    <div className="space-y-3">
                      <label className="text-[10px] uppercase tracking-[0.2em] font-bold text-white/40 flex items-center gap-2">
                        <Target size={14} className="text-[#f58f2a]" /> Público
                      </label>
                      <input
                        type="text"
                        value={formData.publico}
                        onChange={e => setFormData({ ...formData, publico: e.target.value })}
                        placeholder="Ex: B2B"
                        className="w-full bg-white/5 border-b border-white/10 py-2 focus:border-[#f58f2a] outline-none transition-all font-medium placeholder:text-white/10"
                      />
                    </div>
                  </div>

                  <div className="space-y-3">
                    <label className="text-[10px] uppercase tracking-[0.2em] font-bold text-white/40 flex items-center gap-2">
                      <Monitor size={14} className="text-[#f58f2a]" /> Formatos dos Assets
                    </label>
                    <div className="grid grid-cols-1 gap-3 bg-white/5 p-4 rounded-2xl border border-white/10">
                      {[
                        'Feed (Instagram/LinkedIn) - 1:1',
                        'Stories/Reels/TikTok - 9:16',
                        'Banner/YouTube/Site - 16:9',
                        'Carrossel para Feed - 1:1',
                        'Carrossel para Story - 9:16'
                      ].map((fmt) => (
                        <label key={fmt} className="flex items-center gap-3 cursor-pointer group">
                          <input
                            type="checkbox"
                            checked={formData.formatos.includes(fmt)}
                            onChange={(e) => {
                              const newFormatos = e.target.checked
                                ? [...formData.formatos, fmt]
                                : formData.formatos.filter(f => f !== fmt);
                              setFormData({ ...formData, formatos: newFormatos });
                            }}
                            className="w-4 h-4 rounded border-white/20 bg-transparent text-[#f58f2a] focus:ring-[#f58f2a] transition-all"
                          />
                          <span className="text-xs font-medium text-white/60 group-hover:text-white transition-colors">{fmt}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <AnimatePresence>
                    {formData.formatos.some(f => f.includes('Carrossel')) && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="space-y-3 overflow-hidden"
                      >
                        <label className="text-[10px] uppercase tracking-[0.2em] font-bold text-white/40 flex items-center gap-2">
                          <Layers size={14} className="text-[#f58f2a]" /> Slides do Carrossel ({formData.slidesCarrossel})
                        </label>
                        <input
                          type="range"
                          min="3"
                          max="10"
                          value={formData.slidesCarrossel}
                          onChange={(e) => setFormData({ ...formData, slidesCarrossel: parseInt(e.target.value) })}
                          className="w-full h-2 bg-white/5 rounded-lg appearance-none cursor-pointer accent-[#f58f2a]"
                        />
                        <div className="flex justify-between text-[10px] font-bold text-white/20 uppercase tracking-widest">
                          <span>3 Slides</span>
                          <span>10 Slides</span>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <button
                    onClick={generateStrategy}
                    disabled={loading}
                    className={cn(
                      "w-full py-5 rounded-2xl font-bold uppercase tracking-[0.2em] text-xs transition-all flex items-center justify-center gap-3 shadow-xl",
                      loading
                        ? "bg-white/5 text-white/20 cursor-not-allowed"
                        : "bg-[#f58f2a] text-white hover:bg-[#f15424] active:scale-95 shadow-orange-500/20"
                    )}
                  >
                    {loading ? (
                      <>
                        <Loader2 className="animate-spin" size={18} />
                        {status || 'Processando...'}
                      </>
                    ) : (
                      <>
                        Gerar Ecossistema <ArrowRight size={18} />
                      </>
                    )}
                  </button>

                  {error && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-3 text-red-400 text-xs"
                    >
                      <AlertCircle size={16} />
                      {error}
                    </motion.div>
                  )}
                </div>
              </section>

              {/* Stats / Info */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-6 bg-white/5 border border-white/10 rounded-[24px]">
                  <p className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-1">Modelos</p>
                  <p className="text-sm font-bold">Gemini 2.0 Flash</p>
                </div>
                <div className="p-6 bg-white/5 border border-white/10 rounded-[24px]">
                  <p className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-1">Assets</p>
                  <p className="text-sm font-bold">Imagen 3 & Veo</p>
                </div>
              </div>
            </div>

            {/* Right: Results Panel */}
            <div className="xl:col-span-8 space-y-12">
              <AnimatePresence mode="wait">
                {!result && !loading && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="h-full min-h-[600px] border border-white/5 bg-white/[0.02] rounded-[48px] flex flex-col items-center justify-center text-center p-12"
                  >
                    <div className="w-24 h-24 bg-[#0c2444] rounded-3xl flex items-center justify-center mb-8 shadow-2xl">
                      <ImageIcon className="text-[#f58f2a] w-10 h-10" />
                    </div>
                    <h3 className="text-3xl font-serif italic mb-4">Aguardando Comando</h3>
                    <p className="text-white/30 max-w-md leading-relaxed">
                      Insira os parâmetros da sua campanha para que nossa IA arquitete um funil de vendas completo com visuais cinematográficos.
                    </p>
                  </motion.div>
                )}

                {loading && !result && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="h-full min-h-[600px] flex flex-col items-center justify-center space-y-12"
                  >
                    <div className="relative">
                      <div className="w-32 h-32 border-2 border-white/5 rounded-full" />
                      <div className="w-32 h-32 border-2 border-t-[#f58f2a] rounded-full animate-spin absolute top-0" />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Rocket className="text-[#f58f2a] animate-pulse" size={32} />
                      </div>
                    </div>
                    <div className="text-center space-y-3">
                      <p className="font-bold uppercase tracking-[0.3em] text-xs text-[#f58f2a]">{status}</p>
                      <p className="text-[10px] text-white/20 uppercase tracking-widest">Otimizando conversão via IA...</p>
                    </div>
                  </motion.div>
                )}

                {result && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-12"
                  >
                    {/* Visual Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      {result.assets.map((asset, idx) => (
                        <div key={idx} className={cn(
                          "group relative rounded-[32px] overflow-hidden border border-white/5 bg-white/5",
                          asset.aspectRatio === '1:1' ? 'aspect-square' :
                            asset.aspectRatio === '9:16' ? 'aspect-[9/16]' : 'aspect-video'
                        )}>
                          <img
                            src={asset.url}
                            alt={asset.tipo}
                            className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110"
                            referrerPolicy="no-referrer"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-transparent to-transparent opacity-0 group-hover:opacity-60 transition-opacity flex items-end p-6">
                            <button
                              onClick={() => downloadImage(asset.url, `asset-${idx + 1}-${formData.negocio.toLowerCase().replace(/\s+/g, '-')}`)}
                              className="bg-white text-[#0c2444] p-3 rounded-full hover:bg-[#f58f2a] hover:text-white transition-all shadow-xl"
                            >
                              <Download size={20} />
                            </button>
                          </div>
                          <div className="absolute bottom-6 left-6">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-[#f58f2a]">{asset.label || asset.tipo}</p>
                          </div>
                        </div>
                      ))}

                      {/* Video Asset Section */}
                      <div className="md:col-span-2 bg-[#0c2444] rounded-[40px] p-10 border border-white/5 relative overflow-hidden">
                        <div className="relative z-10 flex flex-col md:flex-row items-center gap-10">
                          <div className="flex-1 space-y-4">
                            <div className="flex items-center gap-3 text-[#f58f2a]">
                              <Video size={20} />
                              <span className="text-xs font-bold uppercase tracking-widest">Asset Cinematográfico</span>
                            </div>
                            <h3 className="text-3xl font-serif italic">Preview em Vídeo</h3>
                            <p className="text-sm text-white/60 leading-relaxed italic">
                              "{result.videoPrompt}"
                            </p>
                            {!generatedVideo ? (
                              <button
                                onClick={generateVideoAsset}
                                disabled={videoLoading}
                                className="px-8 py-4 bg-white text-[#0c2444] rounded-2xl font-bold uppercase tracking-widest text-[10px] hover:bg-[#f58f2a] hover:text-white transition-all flex items-center gap-3"
                              >
                                {videoLoading ? <Loader2 className="animate-spin" size={16} /> : <Play size={16} />}
                                {videoLoading ? 'Processando Vídeo...' : 'Gerar Vídeo (Veo 3.1)'}
                              </button>
                            ) : (
                              <div className="flex gap-4">
                                <button
                                  onClick={downloadVideo}
                                  className="px-6 py-3 bg-white/10 rounded-xl text-xs font-bold uppercase tracking-widest flex items-center gap-2 hover:bg-white/20 transition-all"
                                >
                                  <Download size={14} /> Download MP4
                                </button>
                              </div>
                            )}
                          </div>
                          <div className="w-full md:w-[400px] aspect-video bg-black/40 rounded-3xl border border-white/10 flex items-center justify-center overflow-hidden">
                            {generatedVideo ? (
                              <video src={generatedVideo} controls className="w-full h-full object-cover" />
                            ) : (
                              <div className="text-center space-y-4">
                                <div className={cn("w-12 h-12 rounded-full border-2 border-white/10 flex items-center justify-center mx-auto", videoLoading && "animate-pulse")}>
                                  <Video className="text-white/20" size={20} />
                                </div>
                                <p className="text-[10px] uppercase tracking-widest text-white/20">Aguardando Geração</p>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Narration Section (Omitted per user request)
                      <div className="md:col-span-2 bg-[#0c2444] rounded-[40px] p-10 border border-white/5 relative overflow-hidden">
                        ... (Narration code preserved)
                      </div>
                      */}
                    </div>

                    {/* Strategy Document */}
                    <div className="bg-white text-[#050505] p-12 md:p-20 rounded-[56px] shadow-2xl relative strategy-doc">
                      <div className="absolute top-12 right-12 opacity-10 print:hidden">
                        <CheckCircle2 size={64} />
                      </div>

                      <div className="prose prose-slate max-w-none 
                          prose-headings:font-serif prose-headings:italic prose-headings:font-normal prose-headings:text-[#0c2444]
                          prose-h1:text-6xl prose-h2:text-4xl prose-h2:mt-16 prose-h2:border-b prose-h2:border-black/5 prose-h2:pb-4
                          prose-p:text-xl prose-p:leading-relaxed prose-p:text-black/70
                          prose-li:text-lg prose-li:text-black/60
                          prose-strong:text-[#f15424] prose-strong:font-bold">
                        <Markdown>{result.text}</Markdown>
                      </div>

                      <div className="mt-20 pt-12 border-t border-black/5 flex flex-col md:flex-row justify-between items-center gap-8 print:hidden">
                        <div className="flex items-center gap-6">
                          <div className="w-16 h-16 rounded-2xl bg-[#0c2444] flex items-center justify-center shadow-xl">
                            <Rocket className="text-[#f58f2a]" size={28} />
                          </div>
                          <div>
                            <p className="text-[10px] uppercase tracking-[0.3em] font-bold opacity-40">MASTER FUNNEL</p>
                            <p className="text-lg font-bold">MAIS MARKETING ENGINE</p>
                          </div>
                        </div>
                        <div className="flex gap-4">
                          <button
                            onClick={exportToPDF}
                            className="px-8 py-4 border border-black/10 rounded-2xl text-xs font-bold uppercase tracking-widest hover:bg-black hover:text-white transition-all flex items-center gap-3"
                          >
                            <Download size={16} /> Exportar Estratégia
                          </button>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        )}
      </main>

      <footer className="max-w-7xl mx-auto p-12 text-center border-t border-white/5">
        <p className="text-[10px] uppercase tracking-[0.5em] font-bold text-white/20">
          © 2026 MASTER FUNNEL | MARKETING MAIS CORPORATIVO
        </p>
      </footer>
    </div>
  );
}
