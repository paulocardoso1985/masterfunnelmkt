/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * BUILD_TRIGGER: 2026-03-11_16:30
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
  const [result, setResult] = useState<GeneratedContent | null>(null);
  const [generatedVideo, setGeneratedVideo] = useState<string | null>(null);
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
      setError("Ops! Para criar uma estratégia de alta performance, precisamos que todos os campos sejam preenchidos.");
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);
    setGeneratedVideo(null);
    setStatus('Gerando estratégia...');

    try {
      const aspectRatioMap: Record<string, "1:1" | "9:16" | "16:9"> = {
        'Feed (Instagram/LinkedIn) - 1:1': '1:1',
        'Stories/Reels/TikTok - 9:16': '9:16',
        'Banner/YouTube/Site - 16:9': '16:9',
        'Carrossel para Feed - 1:1': '1:1',
        'Carrossel para Story - 9:16': '9:16'
      };

      const prompt = `Aja como o Diretor de Criação da MASTER FUNIL. 
Crie um ecossistema de marketing de ALTA PERFORMANCE para "${negocio}".

Ideia Central: ${ideia}
Público-alvo: ${publico}
Estilo de Comunicação: ${estilo} (Siga rigorosamente este estilo)
Formatos Solicitados: ${formatos.join(', ')}
${formatos.some(f => f.includes('Carrossel')) ? `- Slides por Carrossel: ${slidesCarrossel}` : ''}

REQUISITOS TÉCNICOS:
1. IDIOMA: Todo o conteúdo (texto, labels, scripts e QUALQUER TEXTO NAS IMAGENS) deve ser em PT-BR.
2. ASSETS_PROMPTS: Adicione no final a seção "ASSETS_PROMPTS".
3. IMAGENS: [ASSET: Nome Formato (1:1 ou 9:16 ou 16:9) | PROMPT: Cinematic description in English, style ${estilo}, any text in PT-BR].
4. CARROSSEL: Se solicitado, gere EXATAMENTE ${slidesCarrossel} slides. Cada slide deve ser rotulado como: [ASSET: Carrossel - Slide X (Ratio) | PROMPT: description].
5. VÍDEO: [VIDEO_PROMPT: 8s cinematic impact video description in English, style ${estilo}].
6. NARRAÇÃO: [NARRATION_SCRIPT: Texto persuasivo em PT-BR para 8s].`;

      const textResponse = await fetch('/api/ai/generate-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, systemInstruction: "Diretor da Master Funnel. Responda em PT-BR." })
      });

      if (!textResponse.ok) throw new Error("Erro na geração de texto.");
      const textData = await textResponse.json();
      const fullText = textData.text || '';

      setStatus('Gerando visuais cinematográficos...');
      const assetRegex = /\[ASSET:\s*(.*?)\s*\|?\s*PROMPT:\s*(.*?)\]/gs;
      const assetMatches = [...fullText.matchAll(assetRegex)];

      const videoMatch = fullText.match(/\[VIDEO_PROMPT: (.*?)\]/);
      const videoPrompt = videoMatch ? videoMatch[1] : `Cinematic commercial for ${negocio}, style ${estilo}`;
      const narrationMatch = fullText.match(/\[NARRATION_SCRIPT: (.*?)\]/s);
      const narrationScript = narrationMatch ? narrationMatch[1] : '';

      const generatedAssets = [];
      const normalizeStr = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

      for (let i = 0; i < assetMatches.length; i++) {
        const [_, fullLabel, p] = assetMatches[i];

        let baseType = fullLabel;
        if (fullLabel.toLowerCase().includes(' - slide')) {
          baseType = fullLabel.split(/ - [Ss]lide/i)[0];
        }

        const normBaseType = normalizeStr(baseType);
        const isMatched = formatos.some(f => {
          const normF = normalizeStr(f.split(' - ')[0]);
          // Match standard assets or specifically carousel slides
          if (normF.includes('carrossel')) {
            return fullLabel.toLowerCase().includes('slide') || normBaseType.includes('carrossel');
          }
          return normBaseType.includes(normF) || normF.includes(normBaseType);
        });

        if (!isMatched) continue;

        setStatus(`Gerando Visual: ${fullLabel}...`);
        let ratio: "1:1" | "9:16" | "16:9" = '16:9';
        if (fullLabel.includes('1:1')) ratio = '1:1';
        else if (fullLabel.includes('9:16')) ratio = '9:16';
        else if (fullLabel.includes('16:9')) ratio = '16:9';
        else ratio = (aspectRatioMap as any)[baseType] || '16:9';

        try {
          const res = await fetch('/api/ai/generate-image', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: p, aspectRatio: ratio })
          });
          const data = await res.json();
          if (data.data) {
            generatedAssets.push({ url: `data:image/png;base64,${data.data}`, tipo: baseType, label: fullLabel, aspectRatio: ratio });
          }
          await new Promise(r => setTimeout(r, 800));
        } catch (e) { console.error(e); }
      }

      const cleanText = fullText.split('ASSETS_PROMPTS')[0].trim();
      setResult({ text: cleanText, assets: generatedAssets, videoPrompt, narrationScript });
      setStatus('');

      await fetch('/api/strategies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ negocio, ideia, publico, estilo, formatos, reportText: cleanText, videoPrompt, narrationScript })
      });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const generateVideoAsset = async () => {
    if (!result?.videoPrompt) return;
    setVideoLoading(true);
    setVideoProgress(0);
    try {
      const startResp = await fetch('/api/ai/generate-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: result.videoPrompt, aspectRatio: videoAspectRatio })
      });
      const { operationName } = await startResp.json();

      let attempts = 0;
      while (attempts < 60) {
        attempts++;
        await new Promise(r => setTimeout(r, 4000));
        setVideoProgress(p => Math.min(98, p + 5));

        const statusResp = await fetch(`/api/ai/operation-status/${operationName}`);
        if (!statusResp.ok) continue;
        const statusData = await statusResp.json();
        if (statusData.done) {
          if (statusData.videoUri) {
            setGeneratedVideo(`/api/ai/video-proxy?url=${encodeURIComponent(statusData.videoUri)}`);
            setVideoProgress(100);
          } else if (statusData.error) throw new Error(statusData.error.message);
          break;
        }
      }
    } catch (e: any) { setVideoError(e.message); } finally { setVideoLoading(false); }
  };

  const downloadImage = (base64: string, name: string) => {
    const a = document.createElement('a');
    a.href = base64;
    a.download = `${name}.png`;
    a.click();
  };

  const exportToPDF = async () => {
    const el = document.querySelector('.strategy-doc') as HTMLElement;
    if (!el) return;
    const canvas = await html2canvas(el, { scale: 2 });
    const pdf = new jsPDF('p', 'mm', 'a4');
    pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, 210, (canvas.height * 210) / canvas.width);
    pdf.save('estrategia.pdf');
  };

  const fetchHistory = async () => {
    setHistoryLoading(true);
    const res = await fetch('/api/strategies');
    if (res.ok) {
      const data = await res.json();
      setHistoryList(data.strategies);
    }
    setHistoryLoading(false);
  };

  const loadFromHistory = async (id: number) => {
    const res = await fetch(`/api/strategies/${id}`);
    if (res.ok) {
      const { strategy } = await res.json();
      setFormData({
        negocio: strategy.negocio, ideia: strategy.ideia, publico: strategy.publico,
        estilo: strategy.estilo, formatos: strategy.formatos || [], slidesCarrossel: 5
      });
      setResult({ text: strategy.reportText, assets: [], videoPrompt: strategy.videoPrompt, narrationScript: strategy.narrationScript });
      setShowHistory(false);
    }
  };

  const deleteFromHistory = async (e: any, id: number) => {
    e.stopPropagation();
    if (!confirm("Excluir?")) return;
    await fetch(`/api/strategies/${id}`, { method: 'DELETE' });
    fetchHistory();
  };

  if (authLoading) return <div className="min-h-screen bg-[#050505] flex items-center justify-center"><Loader2 className="animate-spin text-orange-500" size={48} /></div>;

  if (!user) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center p-6 text-white font-sans">
        <div className="w-full max-w-md space-y-8">
          <div className="text-center">
            <img src="https://maiscorporativo.tur.br/wp-content/uploads/2025/02/Logo-azul-png.png" alt="Logo" className="h-16 mx-auto mb-6" />
            <h1 className="text-3xl font-bold tracking-tighter uppercase">MASTER FUNNEL</h1>
            <p className="text-xs font-bold tracking-[0.4em] text-orange-500 uppercase">Acesso Restrito</p>
          </div>

          <form onSubmit={handleLogin} className="bg-[#0c2444] p-8 rounded-[32px] border border-white/5 space-y-6">
            <input
              type="email" required placeholder="E-mail"
              className="w-full bg-white/5 border-b border-white/10 py-3 outline-none focus:border-orange-500 transition-all"
              value={loginData.email} onChange={e => setLoginData({ ...loginData, email: e.target.value })}
            />
            <input
              type="password" required placeholder="Senha"
              className="w-full bg-white/5 border-b border-white/10 py-3 outline-none focus:border-orange-500 transition-all"
              value={loginData.password} onChange={e => setLoginData({ ...loginData, password: e.target.value })}
            />
            {error && <p className="text-red-400 text-xs text-center">{error}</p>}
            <button type="submit" disabled={loading} className="w-full py-4 bg-orange-500 text-white rounded-2xl font-bold uppercase tracking-widest text-xs hover:bg-orange-600 transition-all">
              {loading ? <Loader2 className="animate-spin mx-auto" size={16} /> : 'Entrar'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans lg:pl-20">
      <aside className="fixed left-0 top-0 h-full w-20 bg-[#0c2444] border-r border-white/5 flex flex-col items-center py-8 gap-8 z-50 hidden lg:flex">
        <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center overflow-hidden p-2">
          <img src="https://maiscorporativo.tur.br/wp-content/uploads/2025/02/Logo-azul-png.png" alt="Logo" className="w-full h-full object-contain" />
        </div>
        <nav className="flex flex-col gap-6">
          <button onClick={() => { setResult(null); setShowAdmin(false); setShowHistory(false); }} className={cn("p-3 rounded-xl", !result && !showAdmin && !showHistory ? "bg-orange-500" : "text-white/40")}><Monitor size={20} /></button>
          <button onClick={() => { setShowHistory(true); fetchHistory(); }} className={cn("p-3 rounded-xl", showHistory ? "bg-orange-500" : "text-white/40")}><History size={20} /></button>
          <button onClick={handleLogout} className="p-3 rounded-xl text-white/40 hover:text-red-400"><LogOut size={20} /></button>
        </nav>
      </aside>

      <header className="h-20 border-b border-white/5 bg-[#050505]/80 backdrop-blur-xl sticky top-0 z-40 px-8 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <img src="https://maiscorporativo.tur.br/wp-content/uploads/2025/02/Logo-azul-png.png" alt="Logo" className="h-10" />
          <div className="h-8 w-px bg-white/10" />
          <div className="flex flex-col">
            <h1 className="text-lg font-bold tracking-tighter uppercase leading-none">MASTER FUNNEL</h1>
            <p className="text-[10px] font-bold tracking-[0.3em] text-orange-500 uppercase leading-none mt-1">MAIS MARKETING</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="hidden lg:flex flex-col items-end mr-4">
            <span className="text-[10px] font-bold uppercase tracking-widest text-white/40">Bem-vindo,</span>
            <span className="text-xs font-bold text-orange-500">{user.name}</span>
          </div>
          <button onClick={handleLogout} className="p-2 rounded-xl bg-white/5 border border-white/10 text-white/40 hover:text-white"><LogOut size={20} /></button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-8 lg:p-12">
        <AnimatePresence mode="wait">
          {showHistory ? (
            <motion.div key="history" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
              <div className="flex items-center justify-between">
                <h2 className="text-3xl font-serif italic">Histórico</h2>
                <button onClick={fetchHistory} className="p-2 bg-white/5 rounded-xl"><RefreshCw size={20} className={cn(historyLoading && "animate-spin")} /></button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {historyList.map(h => (
                  <div key={h.id} onClick={() => loadFromHistory(h.id)} className="bg-[#0c2444] p-6 rounded-[32px] border border-white/5 cursor-pointer hover:border-orange-500/30 relative group">
                    <button onClick={(e) => deleteFromHistory(e, h.id)} className="absolute top-4 right-4 p-2 opacity-0 group-hover:opacity-100"><Trash2 size={16} className="text-red-400" /></button>
                    <p className="font-bold">{h.negocio}</p>
                    <p className="text-xs text-white/40">{new Date(h.timestamp).toLocaleDateString()}</p>
                    <p className="text-xs italic mt-2 text-white/20 line-clamp-1">{h.ideia}</p>
                  </div>
                ))}
              </div>
            </motion.div>
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-12">
              <div className="xl:col-span-4 space-y-8">
                <section className="bg-[#0c2444] p-8 rounded-[32px] border border-white/5 shadow-2xl">
                  <h2 className="text-2xl font-serif italic mb-8">Nova Estratégia</h2>
                  <div className="space-y-8">
                    <div className="space-y-2">
                      <label className="text-[10px] uppercase tracking-widest text-white/40">Nome do Negócio</label>
                      <input value={formData.negocio} onChange={e => setFormData({ ...formData, negocio: e.target.value })} className="w-full bg-white/5 border-b border-white/10 py-2 focus:border-orange-500 outline-none" placeholder="Ex: Master Funnel" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] uppercase tracking-widest text-white/40">Ideia Central</label>
                      <textarea value={formData.ideia} onChange={e => setFormData({ ...formData, ideia: e.target.value })} className="w-full bg-white/5 border rounded-xl p-4 focus:border-orange-500 outline-none resize-none" rows={3} placeholder="Descreva sua ideia..." />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[10px] uppercase tracking-widest text-white/40">Estilo</label>
                        <select value={formData.estilo} onChange={e => setFormData({ ...formData, estilo: e.target.value })} className="w-full bg-white/5 border-b border-white/10 py-2 outline-none">
                          <option className="bg-[#0c2444]">Profissional</option>
                          <option className="bg-[#0c2444]">Brutalista</option>
                          <option className="bg-[#0c2444]">Minimalista</option>
                          <option className="bg-[#0c2444]">Energético</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] uppercase tracking-widest text-white/40">Público</label>
                        <input value={formData.publico} onChange={e => setFormData({ ...formData, publico: e.target.value })} className="w-full bg-white/5 border-b border-white/10 py-2 outline-none" placeholder="Ex: B2B" />
                      </div>
                    </div>
                    <div className="space-y-4">
                      <label className="text-[10px] uppercase tracking-widest text-white/40">Formatos dos Assets</label>
                      <div className="space-y-2 bg-white/5 p-4 rounded-xl border border-white/5">
                        {[
                          'Feed (Instagram/LinkedIn) - 1:1',
                          'Stories/Reels/TikTok - 9:16',
                          'Banner/YouTube/Site - 16:9',
                          'Carrossel para Feed - 1:1',
                          'Carrossel para Story - 9:16'
                        ].map(fmt => (
                          <label key={fmt} className="flex items-center gap-3 cursor-pointer group">
                            <input type="checkbox" checked={formData.formatos.includes(fmt)} onChange={e => {
                              const list = e.target.checked ? [...formData.formatos, fmt] : formData.formatos.filter(x => x !== fmt);
                              setFormData({ ...formData, formatos: list });
                            }} className="rounded border-white/20 text-orange-500" />
                            <span className="text-xs text-white/60 group-hover:text-white transition-colors">{fmt}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                    {formData.formatos.some(f => f.includes('Carrossel')) && (
                      <div className="space-y-2">
                        <label className="text-[10px] uppercase tracking-widest text-white/40">Slides do Carrossel ({formData.slidesCarrossel})</label>
                        <input type="range" min="3" max="10" value={formData.slidesCarrossel} onChange={e => setFormData({ ...formData, slidesCarrossel: parseInt(e.target.value) })} className="w-full accent-orange-500" />
                      </div>
                    )}
                    <button onClick={generateStrategy} disabled={loading} className="w-full py-4 bg-orange-500 text-white rounded-2xl font-bold uppercase tracking-widest text-xs hover:bg-orange-600 transition-all flex items-center justify-center gap-3 shadow-xl shadow-orange-500/20 active:scale-95">
                      {loading ? <Loader2 className="animate-spin" size={16} /> : <Rocket size={16} />}
                      {loading ? status : 'Gerar Ecossistema'}
                    </button>
                    {error && <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs text-center">{error}</div>}
                  </div>
                </section> section
              </div>

              <div className="xl:col-span-8 space-y-12">
                {!result && !loading && (
                  <div className="h-full min-h-[500px] bg-white/[0.02] rounded-[48px] border border-white/5 flex flex-col items-center justify-center text-center p-12">
                    <ImageIcon size={48} className="text-white/10 mb-6" />
                    <h3 className="text-2xl font-serif italic mb-4">Aguardando Comando</h3>
                    <p className="text-white/20 max-w-sm">Defina os parâmetros ao lado para gerar sua estratégia.</p>
                  </div>
                )}
                {result && (
                  <div className="space-y-12">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      {result.assets.map((a, i) => (
                        <div key={i} className={cn("relative rounded-[32px] overflow-hidden border border-white/5 bg-white/5 group", a.aspectRatio === '1:1' ? 'aspect-square' : a.aspectRatio === '9:16' ? 'aspect-[9/16]' : 'aspect-video')}>
                          <img src={a.url} alt={a.label} className="w-full h-full object-cover transition-transform group-hover:scale-105" />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent p-6 flex flex-col justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                            <p className="text-orange-500 font-bold text-[10px] uppercase mb-2">{a.label}</p>
                            <button onClick={() => downloadImage(a.url, a.label || 'asset')} className="w-10 h-10 bg-white text-black rounded-full flex items-center justify-center"><Download size={16} /></button>
                          </div>
                        </div>
                      ))}
                      <div className="md:col-span-2 bg-[#0c2444] rounded-[40px] p-10 border border-white/5">
                        <div className="flex flex-col md:flex-row gap-10 items-center">
                          <div className="flex-1 space-y-6">
                            <div className="flex items-center gap-3 text-orange-500 text-xs font-bold uppercase tracking-widest"><Video size={16} /> Asset de Vídeo</div>
                            <h3 className="text-2xl font-serif italic">Preview Cinematográfico</h3>
                            <p className="text-sm text-white/50 italic leading-relaxed">"{result.videoPrompt}"</p>
                            <div className="flex gap-2">
                              {['16:9', '9:16'].map(r => (
                                <button key={r} onClick={() => setVideoAspectRatio(r as any)} className={cn("px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest border transition-all", videoAspectRatio === r ? "bg-orange-500 border-orange-500" : "border-white/10 text-white/40")}>{r}</button>
                              ))}
                            </div>
                            <button onClick={generateVideoAsset} disabled={videoLoading} className="w-full py-4 bg-white text-[#0c2444] rounded-2xl font-bold uppercase tracking-widest text-[10px] flex items-center justify-center gap-3 shadow-xl hover:bg-orange-500 hover:text-white transition-all">
                              {videoLoading ? <Loader2 className="animate-spin" size={16} /> : <Play size={16} />}
                              {videoLoading ? status : 'Gerar Vídeo Oficial (Veo 3.1)'}
                            </button>
                            {videoLoading && (
                              <div className="space-y-2">
                                <div className="flex justify-between text-[10px] font-bold text-white/20"><span>Progresso</span><span>{videoProgress}%</span></div>
                                <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden"><motion.div className="h-full bg-orange-500" initial={{ width: 0 }} animate={{ width: `${videoProgress}%` }} /></div>
                              </div>
                            )}
                          </div>
                          <div className="w-full md:w-[350px] aspect-video bg-black rounded-3xl border border-white/5 flex items-center justify-center overflow-hidden">
                            {generatedVideo ? <video src={generatedVideo} controls className="w-full h-full object-cover" /> : <Video className="text-white/10" size={48} />}
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="bg-white text-black p-12 md:p-20 rounded-[56px] strategy-doc shadow-2xl">
                      <div className="prose prose-slate max-w-none prose-headings:font-serif prose-headings:italic prose-h1:text-5xl prose-h2:text-3xl prose-h2:mt-12 prose-strong:text-orange-500">
                        <Markdown>{result.text}</Markdown>
                      </div>
                      <div className="mt-12 flex justify-end"><button onClick={exportToPDF} className="px-8 py-4 bg-[#0c2444] text-white rounded-2xl font-bold text-xs uppercase tracking-widest hover:scale-105 transition-all">Exportar PDF</button></div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </AnimatePresence>
      </main>
      <footer className="max-w-7xl mx-auto p-12 text-center border-t border-white/5">
        <p className="text-[10px] uppercase tracking-[0.5em] font-bold text-white/20">© 2026 MASTER FUNNEL | MARKETING MAIS CORPORATIVO</p>
      </footer>
    </div>
  );
}
