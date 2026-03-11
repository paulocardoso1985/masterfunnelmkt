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
  Plus,
  RefreshCcw,
  ShieldCheck,
  Zap,
  LayoutGrid
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
    setShowHistory(false);
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
      setError("Preencha todos os campos obrigatórios.");
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);
    setGeneratedVideo(null);
    setStatus('Arquitetando estratégia de elite...');

    try {
      const aspectRatioMap: Record<string, "1:1" | "9:16" | "16:9"> = {
        'Feed (Instagram/LinkedIn) - 1:1': '1:1',
        'Stories/Reels/TikTok - 9:16': '9:16',
        'Banner/YouTube/Site - 16:9': '16:9',
        'Carrossel para Feed - 1:1': '1:1',
        'Carrossel para Story - 9:16': '9:16'
      };

      const prompt = `Aja como o Diretor de Criação da MASTER FUNIL. 
Crie uma estratégia de marketing de ALTA PERFORMANCE para "${negocio}".

Ideia: ${ideia}
Público: ${publico}
Estilo: ${estilo} (Aplique este estilo em TUDO)
Formatos: ${formatos.join(', ')}
${formatos.some(f => f.includes('Carrossel')) ? `- Slides: ${slidesCarrossel}` : ''}

REQUISITOS:
1. Idioma: PT-BR impecável.
2. Assets: Gere [ASSET: Formato (Ratio) | PROMPT: Cinematic, style ${estilo}, focused on ${negocio}. Any text inside MUST be in PT-BR].
3. Carrossel: Se solicitado, gere EXATAMENTE ${slidesCarrossel} slides: [ASSET: Carrossel - Slide X (Ratio) | PROMPT: ...].
4. Vídeo: [VIDEO_PROMPT: 8s cinematic video, style ${estilo}].
5. Narração: [NARRATION_SCRIPT: Persuasive text in PT-BR for 8s].`;

      const textResponse = await fetch('/api/ai/generate-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, systemInstruction: "Você é o Diretor da Master Funnel. Responda em PT-BR." })
      });

      if (!textResponse.ok) throw new Error("Erro na geração de texto.");
      const textData = await textResponse.json();
      const fullText = textData.text || '';

      const assetRegex = /\[ASSET:\s*(.*?)\s*\|?\s*PROMPT:\s*(.*?)\]/gs;
      const assetMatches = [...fullText.matchAll(assetRegex)];
      const videoPrompt = (fullText.match(/\[VIDEO_PROMPT: (.*?)\]/) || [])[1] || `Cinematic for ${negocio}`;
      const narrationScript = (fullText.match(/\[NARRATION_SCRIPT: (.*?)\]/s) || [])[1] || '';

      const generatedAssets: GeneratedAsset[] = [];
      for (let i = 0; i < assetMatches.length; i++) {
        const [_, fullLabel, p] = assetMatches[i];

        // Logic: Extract base types
        let baseType = fullLabel.split(' - ')[0].trim();
        if (fullLabel.toLowerCase().includes('slide')) {
          baseType = fullLabel.split(/ - [Ss]lide/i)[0].trim();
        }

        const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
        const normBaseType = normalize(baseType);

        const isMatched = formatos.some(f => {
          const normF = normalize(f.split(' - ')[0]);
          return normBaseType.includes(normF) || normF.includes(normBaseType);
        });

        if (!isMatched) continue;

        setStatus(`Gerando visual: ${fullLabel}...`);

        const ratio: any = fullLabel.includes('1:1') ? '1:1' : fullLabel.includes('9:16') ? '9:16' : '16:9';

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

      setResult({ text: fullText.split('[ASSET')[0].trim(), assets: generatedAssets, videoPrompt, narrationScript });
      setStatus('');

      await fetch('/api/strategies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ negocio, ideia, publico, estilo, formatos, reportText: fullText, videoPrompt, narrationScript })
      });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const generateVideoAsset = async () => {
    if (!result) return;
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
        setVideoProgress(p => Math.min(95, p + 5));

        const statusResp = await fetch(`/api/ai/operation-status/${operationName}`);
        const data = await statusResp.json();
        if (data.done) {
          if (data.videoUri) {
            setGeneratedVideo(`/api/ai/video-proxy?url=${encodeURIComponent(data.videoUri)}`);
            setVideoProgress(100);
          }
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

  if (authLoading) return <div className="min-h-screen bg-[#050505] flex items-center justify-center"><Loader2 className="animate-spin text-orange-500" size={48} /></div>;

  if (!user) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center p-6 text-white font-sans">
        <div className="w-full max-w-md space-y-12">
          <div className="text-center space-y-2">
            <h1 className="text-5xl font-black tracking-tighter italic">MASTER FUNNEL</h1>
            <p className="text-[10px] font-bold tracking-[0.5em] text-orange-500 uppercase">A Inteligência que Domina o Mercado</p>
          </div>

          <motion.form
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            onSubmit={handleLogin}
            className="bg-[#0c2444]/50 backdrop-blur-2xl p-10 rounded-[48px] border border-white/10 shadow-3xl space-y-8"
          >
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-white/40">E-mail Corporativo</label>
                <input
                  type="email"
                  required
                  placeholder="ex: voce@empresa.com"
                  className="w-full bg-white/5 border-b border-white/10 py-4 outline-none focus:border-orange-500 transition-all font-medium"
                  value={loginData.email}
                  onChange={e => setLoginData({ ...loginData, email: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-white/40">Senha de Acesso</label>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  className="w-full bg-white/5 border-b border-white/10 py-4 outline-none focus:border-orange-500 transition-all font-medium"
                  value={loginData.password}
                  onChange={e => setLoginData({ ...loginData, password: e.target.value })}
                />
              </div>
            </div>

            {error && <p className="text-red-400 text-xs text-center font-bold animate-shake">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-5 bg-orange-500 text-white rounded-3xl font-bold uppercase tracking-[0.2em] text-xs hover:bg-orange-600 transition-all shadow-xl shadow-orange-500/20 flex items-center justify-center gap-3"
            >
              {loading ? <Loader2 className="animate-spin" size={20} /> : <ShieldCheck size={20} />}
              Iniciar Sessão Segura
            </button>
          </motion.form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans lg:pl-24">
      {/* Premium Sidebar */}
      <aside className="fixed left-0 top-0 h-full w-24 bg-[#0c2444] border-r border-white/5 flex flex-col items-center py-10 gap-12 z-50 hidden lg:flex shadow-2xl">
        <div className="w-12 h-12 bg-orange-500 rounded-2xl flex items-center justify-center shadow-lg shadow-orange-500/30">
          <Rocket className="text-white" size={24} />
        </div>

        <nav className="flex flex-col gap-8">
          {[
            { id: 'gen', icon: LayoutGrid, active: !showAdmin && !showHistory },
            { id: 'history', icon: History, active: showHistory },
            { id: 'admin', icon: ShieldCheck, active: showAdmin, hide: user.role !== 'admin' }
          ].filter(i => !i.hide).map(item => (
            <button
              key={item.id}
              onClick={() => {
                if (item.id === 'gen') { setResult(null); setShowAdmin(false); setShowHistory(false); }
                if (item.id === 'history') { setShowHistory(true); setShowAdmin(false); fetchHistory(); }
                if (item.id === 'admin') { setShowAdmin(true); setShowHistory(false); fetchLogs(); }
              }}
              className={cn(
                "w-14 h-14 rounded-2xl flex items-center justify-center transition-all group relative",
                item.active ? "bg-orange-500 text-white shadow-lg shadow-orange-500/20" : "text-white/20 hover:text-white/60 hover:bg-white/5"
              )}
            >
              <item.icon size={22} />
              {item.active && <motion.div layoutId="active" className="absolute -left-2 w-1 h-8 bg-orange-500 rounded-full" />}
            </button>
          ))}
        </nav>

        <button
          onClick={handleLogout}
          className="mt-auto w-14 h-14 rounded-2xl flex items-center justify-center text-red-500/40 hover:text-red-500 hover:bg-red-500/10 transition-all"
        >
          <LogOut size={22} />
        </button>
      </aside>

      {/* Global Header */}
      <header className="h-24 sticky top-0 bg-[#050505]/80 backdrop-blur-3xl border-b border-white/5 z-40 px-10 flex items-center justify-between">
        <div className="flex flex-col">
          <h1 className="text-2xl font-black tracking-tighter italic leading-none">MASTER FUNNEL</h1>
          <div className="flex items-center gap-2 mt-1">
            <div className="w-1 h-1 bg-orange-500 rounded-full animate-pulse" />
            <p className="text-[9px] font-bold tracking-[0.4em] text-white/40 uppercase">Marketing de Elite</p>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="hidden sm:flex flex-col items-end">
            <span className="text-[10px] font-bold text-white/20 uppercase tracking-widest">Usuário Ativo</span>
            <span className="text-sm font-bold text-orange-500">{user.name}</span>
          </div>
          <div className="h-10 w-px bg-white/10" />
          <button className="p-3 bg-white/5 rounded-2xl border border-white/10 hover:bg-white/10 transition-all">
            <RefreshCcw size={18} className="text-white/40" />
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-12 lg:p-20">
        <AnimatePresence mode="wait">
          {showHistory ? (
            <motion.div key="history" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-12">
              <div className="flex items-center justify-between">
                <h2 className="text-4xl font-black italic tracking-tighter">Histórico de Campanhas</h2>
                <button onClick={fetchHistory} className="p-4 bg-white/5 rounded-2xl hover:bg-white/10 transition-all"><RefreshCw size={20} className={cn(historyLoading && "animate-spin")} /></button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {historyList.map(h => (
                  <div key={h.id} onClick={() => { setShowHistory(false); setResult({ text: h.reportText, assets: [], videoPrompt: h.videoPrompt, narrationScript: h.narrationScript }); }} className="group bg-[#0c2444]/50 border border-white/5 rounded-[40px] p-8 cursor-pointer hover:border-orange-500/50 transition-all relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity"><Rocket size={48} /></div>
                    <p className="text-[10px] font-bold text-orange-500 uppercase tracking-widest mb-2">{new Date(h.timestamp).toLocaleDateString('pt-BR')}</p>
                    <h3 className="text-xl font-bold line-clamp-1">{h.negocio}</h3>
                    <p className="text-sm text-white/40 mt-4 line-clamp-2 italic">"{h.ideia}"</p>
                    <div className="mt-8 pt-6 border-t border-white/5 flex items-center justify-between">
                      <span className="text-[9px] font-bold text-white/20 uppercase tracking-[0.2em]">{h.estilo}</span>
                      <ArrowRight size={16} className="text-orange-500 opacity-0 group-hover:opacity-100 transition-all -translate-x-4 group-hover:translate-x-0" />
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          ) : showAdmin ? (
            <motion.div key="admin" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-12">
              <h2 className="text-4xl font-black italic tracking-tighter">Administração</h2>
              <div className="bg-[#0c2444]/50 rounded-[48px] border border-white/5 overflow-hidden">
                <table className="w-full text-left">
                  <thead className="bg-white/5">
                    <tr>
                      <th className="p-8 text-[10px] font-bold uppercase tracking-widest text-white/40">Usuário</th>
                      <th className="p-8 text-[10px] font-bold uppercase tracking-widest text-white/40">Ação</th>
                      <th className="p-8 text-[10px] font-bold uppercase tracking-widest text-white/40">Data</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {adminLogs.map((l, i) => (
                      <tr key={i}>
                        <td className="p-8 text-sm font-bold">{l.userName}</td>
                        <td className="p-8"><span className="px-3 py-1 bg-green-500/10 text-green-400 rounded-lg text-[10px] font-bold uppercase">{l.action}</span></td>
                        <td className="p-8 text-sm text-white/40">{new Date(l.timestamp).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </motion.div>
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-20">
              {/* Luxury Input Panel */}
              <div className="xl:col-span-4 space-y-10">
                <section className="bg-[#0c2444]/50 backdrop-blur-2xl p-10 rounded-[56px] border border-white/5 shadow-3xl relative overflow-hidden group">
                  <div className="absolute -top-20 -right-20 w-64 h-64 bg-orange-500/10 rounded-full blur-[100px] pointer-events-none" />

                  <h2 className="text-3xl font-black italic tracking-tighter mb-10 flex items-center gap-4">
                    <Zap className="text-orange-500" /> Nova Campanha
                  </h2>

                  <div className="space-y-10">
                    <div className="space-y-3">
                      <label className="text-[10px] font-bold uppercase tracking-[0.3em] text-white/30 ml-1">Nome da Marca/Empresa</label>
                      <input
                        value={formData.negocio}
                        onChange={e => setFormData({ ...formData, negocio: e.target.value })}
                        placeholder="Ex: MAIS Corporativo"
                        className="w-full bg-transparent border-b border-white/10 py-3 text-xl font-bold outline-none focus:border-orange-500 transition-all placeholder:text-white/5"
                      />
                    </div>

                    <div className="space-y-3">
                      <label className="text-[10px] font-bold uppercase tracking-[0.3em] text-white/30 ml-1">A Ideia Central</label>
                      <textarea
                        value={formData.ideia}
                        onChange={e => setFormData({ ...formData, ideia: e.target.value })}
                        placeholder="Descreva o objetivo da campanha..."
                        rows={4}
                        className="w-full bg-white/5 border border-white/5 rounded-[32px] p-6 text-sm font-medium outline-none focus:border-orange-500 transition-all resize-none placeholder:text-white/5"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-6">
                      <div className="space-y-3">
                        <label className="text-[10px] font-bold uppercase tracking-[0.3em] text-white/30 ml-1">Estilo Visual</label>
                        <select
                          value={formData.estilo}
                          onChange={e => setFormData({ ...formData, estilo: e.target.value })}
                          className="w-full bg-white/5 border-b border-white/10 py-3 text-sm font-bold outline-none cursor-pointer"
                        >
                          <option className="bg-[#0c2444]">Profissional</option>
                          <option className="bg-[#0c2444]">Brutalista</option>
                          <option className="bg-[#0c2444]">Minimalista</option>
                          <option className="bg-[#0c2444]">Energético</option>
                        </select>
                      </div>
                      <div className="space-y-3">
                        <label className="text-[10px] font-bold uppercase tracking-[0.3em] text-white/30 ml-1">Target</label>
                        <input
                          value={formData.publico}
                          onChange={e => setFormData({ ...formData, publico: e.target.value })}
                          placeholder="Ex: Diretores B2B"
                          className="w-full bg-transparent border-b border-white/10 py-3 text-sm font-bold outline-none focus:border-orange-500 transition-all"
                        />
                      </div>
                    </div>

                    <div className="space-y-4">
                      <label className="text-[10px] font-bold uppercase tracking-[0.3em] text-white/30 ml-1">Ecossistema de Assets</label>
                      <div className="grid grid-cols-1 gap-3 bg-white/5 p-6 rounded-[32px] border border-white/5">
                        {['Feed (Instagram/LinkedIn) - 1:1', 'Stories/Reels/TikTok - 9:16', 'Banner/YouTube/Site - 16:9', 'Carrossel para Feed - 1:1', 'Carrossel para Story - 9:16'].map(fmt => (
                          <label key={fmt} className="flex items-center gap-4 cursor-pointer group/item">
                            <input
                              type="checkbox"
                              checked={formData.formatos.includes(fmt)}
                              onChange={e => {
                                const list = e.target.checked ? [...formData.formatos, fmt] : formData.formatos.filter(x => x !== fmt);
                                setFormData({ ...formData, formatos: list });
                              }}
                              className="w-5 h-5 rounded-lg border-white/10 bg-transparent text-orange-500 focus:ring-0"
                            />
                            <span className="text-xs font-bold text-white/40 group-hover/item:text-white transition-colors">{fmt}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    {formData.formatos.some(f => f.includes('Carrossel')) && (
                      <div className="space-y-4 pt-4">
                        <div className="flex justify-between items-center px-1">
                          <label className="text-[10px] font-bold uppercase tracking-[0.3em] text-white/30">Slides do Carrossel</label>
                          <span className="text-xl font-black italic text-orange-500">{formData.slidesCarrossel}</span>
                        </div>
                        <input
                          type="range" min="3" max="10"
                          value={formData.slidesCarrossel}
                          onChange={e => setFormData({ ...formData, slidesCarrossel: parseInt(e.target.value) })}
                          className="w-full h-1.5 bg-white/5 rounded-full appearance-none cursor-pointer accent-orange-500"
                        />
                      </div>
                    )}

                    <button
                      onClick={generateStrategy}
                      disabled={loading}
                      className="w-full py-6 bg-orange-500 text-white rounded-[32px] font-black uppercase tracking-[0.3em] text-xs hover:bg-orange-600 transition-all flex items-center justify-center gap-4 shadow-2xl shadow-orange-500/20 active:scale-95 disabled:opacity-50"
                    >
                      {loading ? <Loader2 className="animate-spin" size={20} /> : <Rocket size={20} />}
                      {loading ? status : 'Criar Dominância'}
                    </button>

                    {error && <p className="text-red-400 text-[10px] font-bold text-center bg-red-500/10 p-4 rounded-2xl">{error}</p>}
                  </div>
                </section>

                <div className="p-8 bg-white/5 rounded-[40px] flex items-center justify-between border border-white/5">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center"><CheckCircle2 className="text-green-500" size={18} /></div>
                    <div>
                      <p className="text-[10px] font-bold text-white/20 uppercase tracking-widest">IA Powered</p>
                      <p className="text-xs font-bold">Imagen 3 & Veo 3.1</p>
                    </div>
                  </div>
                  <Zap size={20} className="text-orange-500 animate-pulse" />
                </div>
              </div>

              {/* Luxury Result Panel */}
              <div className="xl:col-span-8 space-y-20">
                {!result && !loading && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="h-full min-h-[600px] border border-white/5 bg-white/[0.02] rounded-[64px] flex flex-col items-center justify-center text-center p-20">
                    <div className="w-32 h-32 bg-[#0c2444] rounded-[48px] flex items-center justify-center mb-10 shadow-3xl">
                      <Rocket className="text-orange-500 w-12 h-12" />
                    </div>
                    <h3 className="text-4xl font-black italic tracking-tighter mb-4 uppercase">Arquiteto de Funis</h3>
                    <p className="text-white/20 max-w-sm text-sm font-medium leading-relaxed">Defina os parâmetros ao lado para que nossa IA gere uma estratégia visual e textual completa e impactante.</p>
                  </motion.div>
                )}

                {result && (
                  <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} className="space-y-20">
                    {/* Asset Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                      {result.assets.map((a, i) => (
                        <div
                          key={i}
                          className={cn(
                            "relative rounded-[48px] overflow-hidden border border-white/5 bg-[#0c2444] group shadow-2xl",
                            a.aspectRatio === '1:1' ? 'aspect-square' : a.aspectRatio === '9:16' ? 'aspect-[9/16]' : 'aspect-video'
                          )}
                        >
                          <img src={a.url} alt={a.label} className="w-full h-full object-cover transition-all duration-1000 group-hover:scale-110" />
                          <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-0 group-hover:opacity-80 transition-all flex flex-col justify-end p-10">
                            <p className="text-orange-500 font-black text-xs uppercase tracking-[0.3em] mb-4">{a.label}</p>
                            <button onClick={() => downloadImage(a.url, a.label || 'master-asset')} className="w-14 h-14 bg-white text-black rounded-3xl flex items-center justify-center hover:bg-orange-500 hover:text-white transition-all shadow-xl"><Download size={22} /></button>
                          </div>
                        </div>
                      ))}

                      {/* Luxury Video Section */}
                      <div className="md:col-span-2 bg-[#0c2444] rounded-[64px] p-16 border border-white/5 relative overflow-hidden shadow-3xl">
                        <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none"><Video size={100} /></div>

                        <div className="flex flex-col lg:flex-row gap-16 items-center">
                          <div className="flex-1 space-y-8">
                            <div className="flex items-center gap-4 text-orange-500">
                              <Sparkles size={24} />
                              <span className="text-xs font-black uppercase tracking-[0.4em]">Asset Cinematográfico</span>
                            </div>
                            <h3 className="text-4xl font-black italic tracking-tighter">Preview em Vídeo High-End</h3>
                            <p className="text-base text-white/50 leading-relaxed italic border-l-2 border-orange-500/30 pl-6">"{result.videoPrompt}"</p>

                            <div className="space-y-4">
                              <p className="text-[10px] font-bold uppercase tracking-widest text-white/20">Seleção de Formato</p>
                              <div className="flex gap-4">
                                {['16:9', '9:16'].map(r => (
                                  <button
                                    key={r}
                                    onClick={() => setVideoAspectRatio(r as any)}
                                    className={cn(
                                      "px-8 py-3 rounded-2xl text-[10px] font-bold uppercase tracking-widest border transition-all",
                                      videoAspectRatio === r ? "bg-white text-black border-white shadow-xl" : "border-white/10 text-white/40 hover:text-white"
                                    )}
                                  >
                                    {r === '16:9' ? 'Wide (YouTube)' : 'Tall (Reels)'}
                                  </button>
                                ))}
                              </div>
                            </div>

                            {!generatedVideo ? (
                              <div className="space-y-8">
                                <button
                                  onClick={generateVideoAsset}
                                  disabled={videoLoading}
                                  className="px-10 py-5 bg-orange-500 text-white rounded-[32px] font-black uppercase tracking-widest text-xs flex items-center gap-4 hover:scale-105 transition-all shadow-xl shadow-orange-500/20"
                                >
                                  {videoLoading ? <Loader2 className="animate-spin" /> : <Play />}
                                  {videoLoading ? 'Processando Render...' : 'Gerar Vídeo Oficial'}
                                </button>

                                {videoLoading && (
                                  <div className="space-y-4">
                                    <div className="flex justify-between items-center px-1">
                                      <span className="text-[10px] font-bold uppercase text-white/20">{status}</span>
                                      <span className="text-xs font-black italic text-orange-500">{videoProgress}%</span>
                                    </div>
                                    <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                                      <motion.div initial={{ width: 0 }} animate={{ width: `${videoProgress}%` }} className="h-full bg-orange-500" />
                                    </div>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div className="flex gap-4 pt-4">
                                <button className="px-8 py-4 bg-white/10 rounded-2xl text-[10px] font-bold uppercase tracking-widest flex items-center gap-3 hover:bg-white/20 transition-all"><Download size={16} /> Download 4K</button>
                                <button onClick={() => setGeneratedVideo(null)} className="px-8 py-4 bg-white/5 rounded-2xl text-[10px] font-bold uppercase tracking-widest flex items-center gap-3 hover:bg-white/10 transition-all"><RefreshCw size={16} /> Render Novo</button>
                              </div>
                            )}
                          </div>

                          <div className="w-full lg:w-[450px] aspect-video bg-black/50 rounded-[48px] border border-white/10 flex items-center justify-center overflow-hidden shadow-Inner shadow-black">
                            {generatedVideo ? <video src={generatedVideo} controls className="w-full h-full object-cover" /> : <p className="text-[10px] font-bold uppercase tracking-[0.5em] text-white/10">Engine Offline</p>}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Professional Strategy Document */}
                    <div className="bg-white text-[#0c2444] p-16 lg:p-32 rounded-[80px] shadow-4xl relative overflow-hidden strategy-doc">
                      <div className="absolute top-0 right-0 p-20 opacity-5 pointer-events-none"><Rocket size={200} /></div>

                      <div className="prose prose-slate max-w-none 
                            prose-headings:font-black prose-headings:italic prose-headings:tracking-tighter prose-headings:text-[#0c2444]
                            prose-h1:text-7xl prose-h2:text-4xl prose-h2:mt-24 prose-h2:border-b-4 prose-h2:border-orange-500/20 prose-h2:pb-4
                            prose-p:text-xl prose-p:leading-relaxed prose-p:text-black/70
                            prose-strong:text-orange-500 prose-strong:font-black">
                        <Markdown>{result.text}</Markdown>
                      </div>

                      <div className="mt-32 pt-16 border-t-2 border-black/5 flex flex-col md:flex-row justify-between items-center gap-12">
                        <div className="flex items-center gap-8">
                          <div className="w-20 h-20 bg-[#0c2444] rounded-[32px] flex items-center justify-center shadow-2xl"><Rocket className="text-orange-500" size={32} /></div>
                          <div>
                            <p className="text-[10px] font-black uppercase tracking-[0.4em] text-black/20">Protocolo Master Funnel</p>
                            <p className="text-xl font-black italic">MAIS MARKETING ENGINE 4.0</p>
                          </div>
                        </div>
                        <button onClick={exportToPDF} className="px-12 py-6 bg-[#0c2444] text-white rounded-[32px] font-black uppercase tracking-widest text-xs hover:scale-105 transition-all shadow-2xl flex items-center gap-3">
                          <Download size={20} /> Baixar Estratégia PDF
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </div>
            </div>
          )}
        </AnimatePresence>
      </main>

      <footer className="max-w-7xl mx-auto p-20 text-center border-t border-white/5">
        <p className="text-[9px] font-black text-white/10 uppercase tracking-[0.8em]">© 2026 MASTER FUNNEL | A ELITE DO MARKETING CORPORATIVO</p>
      </footer>
    </div>
  );
}
