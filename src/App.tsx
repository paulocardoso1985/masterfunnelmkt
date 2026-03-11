/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * BUILD_TRIGGER: 2026-03-11_15:40
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
  Trash2,
  ChevronRight,
  ChevronDown,
  Layout,
  Music,
  Share2,
  Check,
  X,
  Plus
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
  const [videoProgress, setVideoProgress] = useState(0);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [videoAspectRatio, setVideoAspectRatio] = useState<'16:9' | '9:16'>('16:9');

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
    const textModel = "gemini-2.0-flash";
    try {
      const aspectRatioMap: Record<string, "1:1" | "9:16" | "16:9"> = {
        'Feed (Instagram/LinkedIn) - 1:1': '1:1',
        'Stories/Reels/TikTok - 9:16': '9:16',
        'Banner/YouTube/Site - 16:9': '16:9',
        'Carrossel para Feed - 1:1': '1:1',
        'Carrossel para Story - 9:16': '9:16'
      };

      const prompt = `Aja como o Diretor de Criação e Estratégia de Elite da MASTER FUNIL MARKETING MAIS CORPORATIVO. 
Crie um ecossistema de marketing digital de ALTA PERFORMANCE e COMPLETAMENTE DETALHADO para "${negocio}".

Ideia Central: ${ideia}
Público-alvo: ${publico}
Estilo de Comunicação & Visual: ${estilo} (Siga RIGOROSAMENTE este estilo em todos os textos e DESCRIÇÕES DE IMAGENS)
Formatos Solicitados: ${formatos.join(', ')}
${formatos.some(f => f.includes('Carrossel')) ? `- Slides por Carrossel: ${slidesCarrossel} (Gere EXATAMENTE este número de prompts de imagem)` : ''}

ESTRUTURA OBRIGATÓRIA DA RESPOSTA (NÃO PULE NENHUMA SEÇÃO):

1. POSICIONAMENTO DE ELITE E PROPOSTA DE VALOR
2. ARQUITETURA DO FUNIL DE CONVERSÃO (DETALHADO)
3. MIX DE CANAIS ESTRATÉGICOS & PLANO DE TRÁFEGO PAGO
4. CRONOGRAMA DE IMPACTO (PLANO DE AÇÃO DE 30 DIAS)
5. ROTEIRO DE NARRAÇÃO PROFISSIONAL (MASTER)
   - Texto completo para locução em PT-BR, com tom grave e autoridade máxima.

REQUISITOS TÉCNICOS ADICIONAIS:
1. IDIOMA: Todo o conteúdo (texto, labels, scripts e QUALQUER TEXTO DENTRO DAS IMAGENS) deve ser em PORTUGUÊS DO BRASIL (PT-BR) de altíssimo nível.
2. ASSETS_PROMPTS: No final, adicione a seção "ASSETS_PROMPTS" com prompts cinematográficos para CADA formato solicitado.
3. REGRAS PARA IMAGENS:
   - Cada asset deve ser identificado como: [ASSET: Nome do Formato (Indique a Proporção 1:1 ou 9:16 ou 16:9 aqui) | PROMPT: Descrição em inglês, cinematográfica, focada no produto, INCORPORANDO O ESTILO "${estilo}". MANDATORILY: Any text appearing inside the image MUST be in Brazilian Portuguese (PT-BR)].
   - Para Carrosséis, gere prompts para EXATAMENTE ${slidesCarrossel} slides: [ASSET: Nome do Carrossel - Slide X (Proporção) | PROMPT: Estilo ${estilo}, ...].
4. VÍDEO E ÁUDIO:
   - [VIDEO_PROMPT: Descrição cinematográfica em inglês para vídeo de impacto de 8s. Estilo ${estilo}. Any visible text MUST be in PT-BR].
   - [NARRATION_SCRIPT: Texto persuasivo em PT-BR para locução de 8s].

IMPORTANTE: O texto deve ser extenso, denso, focado em conversão e autoridade absoluta.`;

      const textResponse = await fetch('/api/ai/generate-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: prompt,
          systemInstruction: "Você é o Diretor de Criação da MASTER FUNNEL. Sua missão é entregar estratégias de marketing de elite, com português impecável (PT-BR), tom persuasivo e autoridade absoluta.",
          model: textModel
        })
      });

      if (!textResponse.ok) {
        const errData = await textResponse.json();
        throw new Error(errData.error || `Erro de servidor (${textResponse.status})`);
      }

      const textData = await textResponse.json();
      const fullText = textData.text || '';

      setStatus('Extraindo prompts e gerando visuais...');
      const assetRegex = /\[ASSET:\s*(.*?)\s*\|?\s*PROMPT:\s*(.*?)\]/gs;
      const assetMatches = [...fullText.matchAll(assetRegex)];

      const videoMatch = fullText.match(/\[VIDEO_PROMPT: (.*?)\]/);
      const videoPrompt = videoMatch ? videoMatch[1] : `Cinematic high-end commercial for ${negocio}, 4k, style ${estilo}`;

      const narrationMatch = fullText.match(/\[NARRATION_SCRIPT: (.*?)\]/s);
      const narrationScript = narrationMatch ? narrationMatch[1] : '';

      const imageModel = "gemini-2.5-flash-image";
      const generatedAssets = [];

      for (let i = 0; i < assetMatches.length; i++) {
        const match = assetMatches[i];
        const fullLabel = match[1];
        const p = match[2];

        setStatus(`Gerando asset ${i + 1} de ${assetMatches.length}: ${fullLabel}...`);

        // Determine base type and ratio
        let baseType = fullLabel;
        if (fullLabel.toLowerCase().includes(' - slide')) {
          baseType = fullLabel.split(/ - [Ss]lide/i)[0];
        }

        let ratio: "1:1" | "9:16" | "16:9" = '16:9';
        if (fullLabel.includes('1:1')) ratio = '1:1';
        else if (fullLabel.includes('9:16')) ratio = '9:16';
        else if (fullLabel.includes('16:9')) ratio = '16:9';
        else ratio = aspectRatioMap[baseType] || '16:9';

        // --- Robust Filter ---
        const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
        const normBaseType = normalize(baseType);
        const isMatched = formatos.some(f => {
          const normF = normalize(f.split(' - ')[0]);
          return normBaseType.includes(normF) || normF.includes(normBaseType);
        });

        console.log(`[FILTER] Label: "${fullLabel}" | Match: ${isMatched}`);
        if (!isMatched) continue;

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
          if (i < assetMatches.length - 1) await new Promise(resolve => setTimeout(resolve, 800));
        } catch (imgErr) {
          console.error(`Failed to generate asset: ${fullLabel}`, imgErr);
        }
      }

      const cleanText = fullText.split('ASSETS_PROMPTS')[0].trim();
      setResult({
        text: cleanText,
        assets: generatedAssets,
        videoPrompt,
        narrationScript
      });
      setStatus('');

      try {
        await fetch('/api/strategies', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            negocio, ideia, publico, estilo, formatos,
            reportText: cleanText, videoPrompt, narrationScript
          })
        });
      } catch (err) { console.error("Failed to save history"); }
    } catch (err: any) {
      console.error("Gen Error:", err);
      setError(err.message || "Erro na geração.");
    } finally {
      setLoading(false);
    }
  };

  const generateVideoAsset = async () => {
    if (!result?.videoPrompt) return;
    setVideoLoading(true);
    setVideoError(null);
    setVideoProgress(0);
    try {
      const startResp = await fetch('/api/ai/generate-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: result.videoPrompt, aspectRatio: videoAspectRatio })
      });
      if (!startResp.ok) {
        const errData = await startResp.json();
        throw new Error(errData.error || `Erro (${startResp.status})`);
      }
      const { operationName } = await startResp.json();
      setStatus('Renderizando vídeo cinematográfico...');

      let isDone = false;
      let attempts = 0;
      while (!isDone && attempts < 60) {
        attempts++;
        await new Promise(r => setTimeout(r, 4000));
        setVideoProgress(prev => Math.min(98, prev + 5));

        const statusResp = await fetch(`/api/ai/operation-status/${operationName}`);
        if (!statusResp.ok) continue;
        const statusData = await statusResp.json();

        if (statusData.done) {
          isDone = true;
          if (statusData.videoUri) {
            setVideoProgress(100);
            setGeneratedVideo(`/api/ai/video-proxy?url=${encodeURIComponent(statusData.videoUri)}`);
            setStatus('Vídeo gerado!');
          } else if (statusData.error) throw new Error(statusData.error.message || 'Falha');
        }
      }
      if (!isDone) throw new Error("Tempo limite esgotado.");
    } catch (err: any) {
      setVideoError(err.message || 'Erro no vídeo');
    } finally {
      setVideoLoading(false);
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
    setStatus('Gerando PDF...');
    try {
      const canvas = await html2canvas(element, { scale: 2, useCORS: true });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`estrategia-${formData.negocio.toLowerCase().replace(/\s+/g, '-')}.pdf`);
    } catch (err) { window.print(); } finally { setLoading(false); setStatus(''); }
  };

  const downloadVideo = () => {
    if (!generatedVideo) return;
    const link = document.createElement('a');
    link.href = generatedVideo;
    link.download = `video-campanha.mp4`;
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
    } catch (err) { console.error("History fail"); } finally { setHistoryLoading(false); }
  };

  const loadFromHistory = async (id: number) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/strategies/${id}`);
      if (res.ok) {
        const { strategy } = await res.json();
        setFormData({
          negocio: strategy.negocio, ideia: strategy.ideia, publico: strategy.publico,
          estilo: strategy.estilo, formatos: strategy.formatos || [], slidesCarrossel: 5
        });
        setResult({
          text: strategy.reportText, assets: [],
          videoPrompt: strategy.videoPrompt, narrationScript: strategy.narrationScript
        });
        setShowHistory(false);
      }
    } catch (err) { alert("Erro ao carregar"); } finally { setLoading(false); }
  };

  const deleteFromHistory = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    if (!confirm("Excluir?")) return;
    try {
      const res = await fetch(`/api/strategies/${id}`, { method: 'DELETE' });
      if (res.ok) fetchHistory();
    } catch (err) { alert("Erro ao excluir"); }
  };

  if (authLoading) return <div className="min-h-screen bg-[#050505] flex items-center justify-center"><Loader2 className="text-[#f58f2a] animate-spin" size={48} /></div>;

  if (!user) {
    return (
      <div className="min-h-screen bg-[#050505] text-white flex items-center justify-center p-6">
        <div className="w-full max-w-md space-y-8">
          <div className="text-center">
            <h1 className="text-3xl font-bold tracking-tighter uppercase">MASTER FUNNEL</h1>
            <p className="text-xs font-bold tracking-[0.4em] text-[#f58f2a] uppercase">MAIS Corporativo</p>
          </div>
          <form onSubmit={handleLogin} className="bg-[#0c2444] p-8 rounded-[32px] border border-white/5 space-y-6">
            <input type="email" required placeholder="E-mail" value={loginData.email} onChange={e => setLoginData({ ...loginData, email: e.target.value })} className="w-full bg-white/5 border-b border-white/10 py-3 focus:border-[#f58f2a] outline-none transition-all" />
            <input type="password" required placeholder="Senha" value={loginData.password} onChange={e => setLoginData({ ...loginData, password: e.target.value })} className="w-full bg-white/5 border-b border-white/10 py-3 focus:border-[#f58f2a] outline-none transition-all" />
            {error && <div className="text-red-400 text-xs text-center">{error}</div>}
            <button type="submit" disabled={loading} className="w-full py-4 bg-[#f58f2a] text-white rounded-2xl font-bold uppercase tracking-widest text-xs hover:bg-[#f15424] flex items-center justify-center gap-2">
              {loading ? <Loader2 className="animate-spin" size={16} /> : <Play size={16} />} Entrar
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans lg:pl-20">
      <aside className="fixed left-0 top-0 h-full w-20 bg-[#0c2444] border-r border-white/5 flex flex-col items-center py-8 gap-8 z-50 hidden lg:flex">
        <Rocket className="text-[#f58f2a]" size={32} />
        <nav className="flex flex-col gap-6">
          <button onClick={() => { setResult(null); setShowAdmin(false); setShowHistory(false); }} className={cn("p-3 rounded-xl", !result && !showAdmin && !showHistory ? "bg-[#f58f2a]" : "text-white/40")}><Monitor size={20} /></button>
          <button onClick={() => setShowHistory(true)} className={cn("p-3 rounded-xl", showHistory ? "bg-[#f58f2a]" : "text-white/40")}><History size={20} /></button>
          <button onClick={handleLogout} className="p-3 rounded-xl text-white/40 hover:text-red-400"><LogOut size={20} /></button>
        </nav>
      </aside>

      <header className="h-20 border-b border-white/5 bg-[#050505]/80 backdrop-blur-xl sticky top-0 z-40 px-8 flex items-center justify-between">
        <div className="flex flex-col">
          <h1 className="text-lg font-bold tracking-tighter uppercase leading-none">MASTER FUNNEL</h1>
          <p className="text-[10px] font-bold tracking-[0.3em] text-[#f58f2a] uppercase leading-none mt-1">MAIS MARKETING</p>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-xs font-bold text-[#f58f2a]">{user.name}</span>
          <button onClick={handleLogout} className="p-2 rounded-xl bg-white/5"><PowerOff size={16} /></button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-8">
        {showHistory ? (
          <div className="space-y-8">
            <h2 className="text-3xl font-serif italic">Histórico</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {historyList.map(h => (
                <div key={h.id} onClick={() => loadFromHistory(h.id)} className="bg-[#0c2444] p-6 rounded-[32px] border border-white/5 cursor-pointer hover:border-[#f58f2a]/50">
                  <p className="font-bold">{h.negocio}</p>
                  <p className="text-xs text-white/40">{new Date(h.timestamp).toLocaleDateString()}</p>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-12">
            <div className="xl:col-span-4 space-y-8">
              <section className="bg-[#0c2444] p-8 rounded-[32px] border border-white/5 shadow-2xl">
                <h2 className="text-2xl font-serif italic mb-8">Nova Estratégia</h2>
                <div className="space-y-8">
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase tracking-widest text-white/40">Negócio</label>
                    <input value={formData.negocio} onChange={e => setFormData({ ...formData, negocio: e.target.value })} className="w-full bg-white/5 border-b border-white/10 py-2 focus:border-[#f58f2a] outline-none" placeholder="Ex: Master Funnel" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase tracking-widest text-white/40">Ideia</label>
                    <textarea value={formData.ideia} onChange={e => setFormData({ ...formData, ideia: e.target.value })} className="w-full bg-white/5 border rounded-xl p-4 focus:border-[#f58f2a] outline-none resize-none" rows={3} placeholder="Descreva sua ideia..." />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] uppercase tracking-widest text-white/40">Estilo</label>
                      <select value={formData.estilo} onChange={e => setFormData({ ...formData, estilo: e.target.value })} className="w-full bg-white/5 border-b border-white/10 py-2 outline-none">
                        <option>Profissional</option><option>Brutalista</option><option>Minimalista</option><option>Energético</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] uppercase tracking-widest text-white/40">Público</label>
                      <input value={formData.publico} onChange={e => setFormData({ ...formData, publico: e.target.value })} className="w-full bg-white/5 border-b border-white/10 py-2 outline-none" placeholder="Ex: B2B" />
                    </div>
                  </div>
                  <div className="space-y-4">
                    <label className="text-[10px] uppercase tracking-widest text-white/40">Formatos</label>
                    <div className="space-y-2 bg-white/5 p-4 rounded-xl">
                      {['Feed (Instagram/LinkedIn) - 1:1', 'Stories/Reels/TikTok - 9:16', 'Banner/YouTube/Site - 16:9', 'Carrossel para Feed - 1:1', 'Carrossel para Story - 9:16'].map(fmt => (
                        <label key={fmt} className="flex items-center gap-3 cursor-pointer"><input type="checkbox" checked={formData.formatos.includes(fmt)} onChange={e => {
                          const list = e.target.checked ? [...formData.formatos, fmt] : formData.formatos.filter(x => x !== fmt);
                          setFormData({ ...formData, formatos: list });
                        }} className="rounded border-white/20 text-[#f58f2a]" /> <span className="text-xs text-white/60">{fmt}</span></label>
                      ))}
                    </div>
                  </div>
                  {formData.formatos.some(f => f.includes('Carrossel')) && (
                    <div className="space-y-2">
                      <label className="text-[10px] uppercase tracking-widest text-white/40">Slides: {formData.slidesCarrossel}</label>
                      <input type="range" min="3" max="10" value={formData.slidesCarrossel} onChange={e => setFormData({ ...formData, slidesCarrossel: parseInt(e.target.value) })} className="w-full accent-[#f58f2a]" />
                    </div>
                  )}
                  <button onClick={generateStrategy} disabled={loading} className="w-full py-4 bg-[#f58f2a] text-white rounded-2xl font-bold uppercase tracking-widest text-xs hover:bg-[#f15424] flex items-center justify-center gap-2">
                    {loading ? <Loader2 className="animate-spin" size={16} /> : <Rocket size={16} />} {loading ? status : 'Gerar Ecossistema'}
                  </button>
                  {error && <div className="text-red-400 text-xs text-center bg-red-500/10 p-4 rounded-xl">{error}</div>}
                </div>
              </section>
            </div>

            <div className="xl:col-span-8 space-y-12">
              {!result && !loading && (
                <div className="h-full min-h-[500px] bg-white/[0.02] rounded-[40px] border border-white/5 flex flex-col items-center justify-center text-center p-12">
                  <ImageIcon size={48} className="text-white/10 mb-6" />
                  <h3 className="text-2xl font-serif italic">Inicie sua estratégia</h3>
                </div>
              )}
              {result && (
                <div className="space-y-12">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {result.assets.map((a, i) => (
                      <div key={i} className={cn("relative rounded-[32px] overflow-hidden border border-white/5 bg-white/5 group", a.aspectRatio === '1:1' ? 'aspect-square' : a.aspectRatio === '9:16' ? 'aspect-[9/16]' : 'aspect-video')}>
                        <img src={a.url} alt={a.label} className="w-full h-full object-cover transition-transform group-hover:scale-105" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent flex flex-col justify-end p-6 opacity-0 group-hover:opacity-100 transition-opacity">
                          <p className="text-[#f58f2a] font-bold text-[10px] uppercase tracking-widest mb-2">{a.label}</p>
                          <button onClick={() => downloadImage(a.url, a.label || 'asset')} className="w-10 h-10 bg-white text-black rounded-full flex items-center justify-center"><Download size={16} /></button>
                        </div>
                      </div>
                    ))}
                    <div className="md:col-span-2 bg-[#0c2444] rounded-[40px] p-10 border border-white/5">
                      <div className="flex flex-col md:flex-row gap-10">
                        <div className="flex-1 space-y-6">
                          <div className="flex items-center gap-3 text-[#f58f2a] text-xs font-bold uppercase tracking-widest"><Video size={16} /> Asset de Vídeo</div>
                          <h3 className="text-2xl font-serif italic text-white/95">Preview Cinematográfico</h3>
                          <p className="text-sm text-white/50 italic leading-relaxed">"{result.videoPrompt}"</p>
                          <div className="flex gap-2">
                            {['16:9', '9:16'].map(r => (
                              <button key={r} onClick={() => setVideoAspectRatio(r as any)} className={cn("px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest border transition-all", videoAspectRatio === r ? "bg-[#f58f2a] border-[#f58f2a]" : "border-white/10 text-white/40")}>{r}</button>
                            ))}
                          </div>
                          <button onClick={generateVideoAsset} disabled={videoLoading} className="w-full py-4 bg-white text-[#0c2444] rounded-2xl font-bold uppercase tracking-widest text-[10px] flex items-center justify-center gap-3 shadow-xl shadow-white/5 hover:bg-[#f58f2a] hover:text-white transition-all">
                            {videoLoading ? <Loader2 className="animate-spin" size={16} /> : <Play size={16} />} {videoLoading ? status : 'Gerar Vídeo Real (Veo 3.1)'}
                          </button>
                          {videoError && <p className="text-red-400 text-xs">{videoError}</p>}
                          {videoLoading && <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden"><motion.div className="h-full bg-[#f58f2a]" initial={{ width: 0 }} animate={{ width: `${videoProgress}%` }} /></div>}
                        </div>
                        <div className="w-full md:w-[350px] aspect-video bg-black rounded-3xl border border-white/5 flex items-center justify-center overflow-hidden">
                          {generatedVideo ? <video src={generatedVideo} controls className="w-full h-full object-cover" /> : <p className="text-[10px] uppercase tracking-widest text-white/10">Aguardando geração</p>}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="bg-white text-black p-12 md:p-20 rounded-[56px] strategy-doc">
                    <div className="prose prose-slate max-w-none prose-headings:font-serif prose-headings:italic prose-h1:text-5xl prose-h2:text-3xl prose-h2:mt-12 prose-strong:text-[#f15424]">
                      <Markdown>{result.text}</Markdown>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

// Missing icons mock
const PowerOff = ({ size }: { size: number }) => <LogOut size={size} />;
