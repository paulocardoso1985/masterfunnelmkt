import express from "express";
import { createServer as createViteServer } from "vite";
import cookieParser from "cookie-parser";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import path from "path";
import { fileURLToPath } from "url";
import Database from "better-sqlite3";
import fs from "fs";
import { GoogleGenAI } from "@google/genai";
import { VertexAI } from "@google-cloud/vertexai";
import "dotenv/config";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure data directory exists for persistent storage (Railway/Render Volume)
const dataDir = path.join(__dirname, "data");

try {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
} catch (err) {
  console.error("Erro ao criar diretório de dados:", err);
}

let db: any;
try {
  db = new Database(path.join(dataDir, "database.db"));
  console.log("Banco de dados inicializado com sucesso em:", path.join(dataDir, "database.db"));
} catch (err) {
  console.error("Falha crítica ao abrir o banco de dados:", err);
  // Fallback para banco em memória se o arquivo falhar (evita erro 502 imediato)
  db = new Database(":memory:");
  console.warn("Usando banco de dados em memória como fallback temporário.");
}

// --- Database Initialization ---
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE,
    password TEXT,
    role TEXT,
    name TEXT
  );

  CREATE TABLE IF NOT EXISTS logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId INTEGER,
    userName TEXT,
    userEmail TEXT,
    action TEXT,
    params TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS strategies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId INTEGER,
    negocio TEXT,
    ideia TEXT,
    publico TEXT,
    estilo TEXT,
    formatos TEXT,
    reportText TEXT,
    videoPrompt TEXT,
    narrationScript TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(userId) REFERENCES users(id)
  );
`);

// Seed admin if not exists
const seedAdmin = () => {
  const adminEmail = "paulo.cardoso@maiscorporativo.tur.br";
  const adminExists = db.prepare("SELECT * FROM users WHERE email = ?").get(adminEmail);

  if (!adminExists) {
    console.log("Seeding admin user...");
    db.prepare("INSERT INTO users (email, password, role, name) VALUES (?, ?, ?, ?)").run(
      adminEmail,
      bcrypt.hashSync(process.env.ADMIN_PASSWORD || "admin123", 10),
      "admin",
      "Paulo Cardoso"
    );
  }
};

seedAdmin();

const JWT_SECRET = process.env.JWT_SECRET || "master-funnel-secret-2026";
const PORT = Number(process.env.PORT) || 3000;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";

const genAI = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

// Vertex AI Client (Enterprise)
const PROJECT_ID = process.env.GOOGLE_PROJECT_ID;
const LOCATION = process.env.GOOGLE_LOCATION || "us-central1";

let vertexAI: any = null;
if (PROJECT_ID) {
  console.log(`[Vertex AI] Initialized for Project: ${PROJECT_ID}, Location: ${LOCATION}`);
  vertexAI = new VertexAI({ project: PROJECT_ID, location: LOCATION });
}

async function startServer() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());

  // Serve static files from public folder (fallback/dev)
  const publicPath = path.join(__dirname, "public");
  const distPath = path.join(__dirname, "dist");

  app.use(express.static(publicPath));

  // Explicit routes for logos with detailed logging
  const serveLogo = (fileName: string) => (req: any, res: any) => {
    const locations = [
      path.join(publicPath, fileName),
      path.join(distPath, fileName),
      path.join(__dirname, fileName),
      path.join(process.cwd(), "public", fileName),
      path.join(process.cwd(), fileName)
    ];

    for (const loc of locations) {
      if (fs.existsSync(loc)) {
        console.log(`[Static] Serving ${fileName} from ${loc}`);
        return res.sendFile(loc);
      }
    }

    console.warn(`[Static] CRITICAL: ${fileName} not found. Searched:`, locations);
    res.status(404).send("Logo not found");
  };

  app.get("/logo.png", serveLogo("logo.png"));
  app.get("/Logo_Mais_Braco_orange.png", serveLogo("Logo_Mais_Braco_orange.png"));

  // --- Auth Middleware ---
  const authenticate = (req: any, res: any, next: any) => {
    const token = req.cookies.auth_token;
    if (!token) return res.status(401).json({ error: "Não autorizado" });
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      req.user = decoded;
      next();
    } catch (err) {
      res.status(401).json({ error: "Sessão expirada" });
    }
  };

  // Debug route to see files in the container
  app.get("/api/admin/debug-files", authenticate, (req: any, res) => {
    if (req.user.role !== "admin") return res.status(403).send("Forbidden");
    try {
      const getDir = (dir: string) => fs.existsSync(dir) ? fs.readdirSync(dir) : [];
      res.json({
        cwd: process.cwd(),
        dirname: __dirname,
        root: getDir(__dirname),
        public: getDir(publicPath),
        dist: getDir(distPath)
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // --- Auth Routes ---
  app.post("/api/login", (req, res) => {
    const { email, password } = req.body;
    const user: any = db.prepare("SELECT * FROM users WHERE email = ?").get(email);

    if (!user || !bcrypt.compareSync(password, user.password)) {
      return res.status(401).json({ error: "Credenciais inválidas" });
    }
    const token = jwt.sign({ id: user.id, email: user.email, role: user.role, name: user.name }, JWT_SECRET, { expiresIn: "24h" });
    res.cookie("auth_token", token, { httpOnly: true, secure: true, sameSite: "none" });
    res.json({ user: { id: user.id, email: user.email, role: user.role, name: user.name } });
  });

  // API routes go here
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  app.get("/api/me", authenticate, (req: any, res) => {
    res.json({ user: req.user });
  });

  app.post("/api/logout", (req, res) => {
    res.clearCookie("auth_token");
    res.json({ success: true });
  });

  // --- Usage Monitoring ---
  app.post("/api/log-usage", authenticate, (req: any, res) => {
    const { action, params } = req.body;
    db.prepare("INSERT INTO logs (userId, userName, userEmail, action, params) VALUES (?, ?, ?, ?, ?)").run(
      req.user.id,
      req.user.name,
      req.user.email,
      action,
      JSON.stringify(params)
    );
    res.json({ success: true });
  });

  app.get("/api/admin/logs", authenticate, (req: any, res) => {
    if (req.user.role !== "admin") return res.status(403).json({ error: "Acesso negado" });
    const logs = db.prepare("SELECT * FROM logs ORDER BY timestamp DESC LIMIT 100").all();
    res.json({ logs: logs.map((l: any) => ({ ...l, params: JSON.parse(l.params) })) });
  });

  // --- User Management ---
  app.get("/api/admin/users", authenticate, (req: any, res) => {
    if (req.user.role !== "admin") return res.status(403).json({ error: "Acesso negado" });
    const users = db.prepare("SELECT id, email, role, name FROM users").all();
    res.json({ users });
  });

  app.post("/api/admin/users", authenticate, (req: any, res) => {
    if (req.user.role !== "admin") return res.status(403).json({ error: "Acesso negado" });
    const { email, password, name, role } = req.body;
    try {
      db.prepare("INSERT INTO users (email, password, name, role) VALUES (?, ?, ?, ?)").run(
        email,
        bcrypt.hashSync(password, 10),
        name,
        role || "user"
      );
      res.json({ success: true });
    } catch (err) {
      res.status(400).json({ error: "E-mail já cadastrado ou dados inválidos" });
    }
  });

  app.delete("/api/admin/users/:id", authenticate, (req: any, res) => {
    if (req.user.role !== "admin") return res.status(403).json({ error: "Acesso negado" });
    if (parseInt(req.params.id) === req.user.id) return res.status(400).json({ error: "Não pode excluir a si mesmo" });
    db.prepare("DELETE FROM users WHERE id = ?").run(req.params.id);
    res.json({ success: true });
  });

  // --- Strategy History ---
  app.get("/api/strategies", authenticate, (req: any, res) => {
    let strategies;
    if (req.user.role === "admin") {
      strategies = db.prepare("SELECT * FROM strategies ORDER BY timestamp DESC").all();
    } else {
      strategies = db.prepare("SELECT * FROM strategies WHERE userId = ? ORDER BY timestamp DESC").all();
    }
    res.json({ strategies });
  });

  app.post("/api/strategies", authenticate, (req: any, res) => {
    const { negocio, ideia, publico, estilo, formatos, reportText, videoPrompt, narrationScript } = req.body;
    try {
      const result = db.prepare(`
        INSERT INTO strategies (userId, negocio, ideia, publico, estilo, formatos, reportText, videoPrompt, narrationScript)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        req.user.id,
        negocio,
        ideia,
        publico,
        estilo,
        JSON.stringify(formatos),
        reportText,
        videoPrompt,
        narrationScript
      );
      res.json({ success: true, id: result.lastInsertRowid });
    } catch (err) {
      console.error("Erro ao salvar estratégia:", err);
      res.status(500).json({ error: "Falha ao salvar estratégia no histórico" });
    }
  });

  app.get("/api/strategies/:id", authenticate, (req: any, res) => {
    const strategy = db.prepare("SELECT * FROM strategies WHERE id = ?").get(req.params.id);
    if (!strategy) return res.status(404).json({ error: "Estratégia não encontrada" });
    if (req.user.role !== "admin" && strategy.userId !== req.user.id) {
      return res.status(403).json({ error: "Acesso negated" });
    }
    res.json({ strategy: { ...strategy, formatos: JSON.parse(strategy.formatos) } });
  });

  app.delete("/api/strategies/:id", authenticate, (req: any, res) => {
    const strategy = db.prepare("SELECT * FROM strategies WHERE id = ?").get(req.params.id);
    if (!strategy) return res.status(404).json({ error: "Estratégia não encontrada" });
    if (req.user.role !== "admin" && strategy.userId !== req.user.id) {
      return res.status(403).json({ error: "Acesso negado" });
    }
    db.prepare("DELETE FROM strategies WHERE id = ?").run(req.params.id);
    res.json({ success: true });
  });

  // --- AI Server Proxy Endpoints ---
  app.post("/api/ai/generate-text", authenticate, async (req, res) => {
    const { model, prompt, systemInstruction, apiKey } = req.body;
    try {
      if (!prompt) throw new Error("Prompt is required");
      const targetModel = model || "gemini-2.0-flash";

      // Use client-provided key (AI Studio) or server key
      const clientGenAI = apiKey ? new GoogleGenAI({ apiKey }) : genAI;

      console.log(`[AI] Generating text with model: ${targetModel}`);

      const result = await clientGenAI.models.generateContent({
        model: targetModel,
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: { systemInstruction: systemInstruction ? { parts: [{ text: systemInstruction }] } : undefined }
      });
      res.json({ text: result.text });
    } catch (err: any) {
      console.error("AI Text Generation Error:", err);
      // Detailed error for the client to help debugging
      res.status(err.status || 500).json({
        error: err.message,
        details: err.details || err.stack,
        payload: { model, promptLength: prompt?.length }
      });
    }
  });

  app.post("/api/ai/generate-image", authenticate, async (req, res) => {
    const { prompt, aspectRatio, model, apiKey } = req.body;
    try {
      if (!prompt) throw new Error("Prompt is required");
      const targetModel = model || "gemini-2.5-flash-image";

      const clientGenAI = apiKey ? new GoogleGenAI({ apiKey }) : genAI;
      console.log(`[AI] Generating image with model: ${targetModel}`);

      const result = await clientGenAI.models.generateContent({
        model: targetModel,
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: { imageConfig: { aspectRatio: aspectRatio || '1:1' } }
      });

      const part = result.candidates?.[0]?.content?.parts.find((p: any) => p.inlineData);
      if (part?.inlineData?.data) {
        res.json({ data: part.inlineData.data });
      } else {
        res.status(500).json({ error: "Falha ao gerar imagem: Dado binário não encontrado." });
      }
    } catch (err: any) {
      console.error("AI Image Generation Error:", err);
      res.status(err.status || 500).json({ error: err.message });
    }
  });

  // Endpoint 1: Iniciar Geração (Assíncrono)
  app.post("/api/ai/generate-video", authenticate, async (req, res) => {
    const { prompt, aspectRatio, apiKey } = req.body;
    try {
      if (!prompt) throw new Error("Prompt is required");

      const targetModel = 'veo-3.1-fast-generate-preview';
      const professionalPrompt = `${prompt}. MANDATORY REQUIREMENTS: The video must be professional, corporate, and high-end. If there is any voiceover or audio integration, it MUST use perfect Brazilian Portuguese (PT-BR) with a professional business tone, correct intonation, and no artifacts/bizarreness. Length: 8 seconds.`;

      let operation: any;

      if (vertexAI && !apiKey) {
        console.log(`[Vertex AI] Starting enterprise video generation (Model: ${targetModel})`);
        const model = vertexAI.getGenerativeModel({ model: targetModel });
        operation = await (model as any).generateVideos({
          prompt: professionalPrompt,
          config: {
            numberOfVideos: 1,
            resolution: '720p',
            aspectRatio: aspectRatio || '16:9',
            durationSeconds: 8
          }
        });
      } else {
        // Fallback to AI Studio
        console.log(`[AI Studio] Starting video generation (Model: ${targetModel})`);
        const clientGenAI = apiKey ? new GoogleGenAI({ apiKey }) : genAI;
        operation = await (clientGenAI.models as any).generateVideos({
          model: targetModel,
          prompt: professionalPrompt,
          config: {
            numberOfVideos: 1,
            resolution: '720p',
            aspectRatio: aspectRatio || '16:9',
            durationSeconds: 8
          }
        });
      }

      if (!operation || !operation.name) {
        throw new Error("A API não conseguiu iniciar a operação. Verifique sua chave e permissões.");
      }

      console.log(`[AI] Operation started: ${operation.name}`);
      res.json({ operationName: operation.name });

    } catch (err: any) {
      console.error("AI Video Start Error:", err);
      res.status(err.status || 500).json({ error: err.message });
    }
  });

  // Endpoint 2: Polling de Status (Usa wildcard '*' para aceitar nomes com barras do Google)
  app.get("/api/ai/operation-status/*", authenticate, async (req, res) => {
    try {
      const operationName = req.params[0];
      // Tenta pegar a chave do header (enviada pelo frontend se houver) ou usa a padrão
      const apiKey = req.headers['x-goog-api-key'] as string || GEMINI_API_KEY;
      const clientGenAI = new GoogleGenAI({ apiKey });

      const operation: any = await (clientGenAI.operations as any).getVideosOperation({
        name: operationName
      });

      res.json({
        done: operation.done,
        videoUri: operation.response?.generatedVideos?.[0]?.video?.uri,
        error: operation.error
      });
    } catch (err: any) {
      console.error("AI Video Status Error:", err);
      res.status(err.status || 500).json({ error: err.message });
    }
  });

  // Endpoint 3: Proxy de Vídeo para evitar CORS
  app.get("/api/ai/video-proxy", authenticate, async (req, res) => {
    const videoUrl = req.query.url as string;
    try {
      if (!videoUrl) throw new Error("URL é obrigatória");

      const apiKey = req.headers['x-goog-api-key'] as string || GEMINI_API_KEY;
      const videoRes = await fetch(videoUrl, {
        headers: { 'x-goog-api-key': apiKey }
      });

      if (!videoRes.ok) throw new Error(`Falha ao buscar vídeo: ${videoRes.statusText}`);

      res.setHeader("Content-Type", "video/mp4");
      const buffer = await videoRes.arrayBuffer();
      res.send(Buffer.from(buffer));
    } catch (err: any) {
      console.error("Video Proxy Error:", err);
      res.status(500).send(err.message);
    }
  });

  app.post("/api/ai/generate-audio", authenticate, async (req, res) => {
    const { text, model, apiKey } = req.body;
    try {
      const clientGenAI = apiKey ? new GoogleGenAI({ apiKey }) : genAI;
      const response: any = await (clientGenAI.models as any).generateContent({
        model: model || "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text }] }],
        config: {
          responseModalities: ["AUDIO"],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: 'Aoede' },
            },
          },
        },
      });

      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (base64Audio) {
        res.json({ data: base64Audio });
      } else {
        res.status(500).json({ error: "O modelo não retornou dados de áudio." });
      }
    } catch (err: any) {
      console.error("AI Audio Generation Error:", err);
      res.status(err.status || 500).json({ error: err.message });
    }
  });

  // --- Diagnostic & Debug Routes ---
  app.get("/api/ai/debug-simple", authenticate, async (req, res) => {
    try {
      console.log("[AI-DEBUG] Testing simple generation...");
      const result = await genAI.models.generateContent({
        model: "gemini-1.5-flash",
        contents: [{ role: 'user', parts: [{ text: "Diga 'Conexão OK' em português." }] }]
      });
      res.json({ success: true, text: result.text });
    } catch (err: any) {
      console.error("[AI-DEBUG] Simple test failed:", err);
      res.status(err.status || 500).json({ error: err.message, details: err.stack });
    }
  });

  // Handle unhandled rejections to prevent silent crashes
  process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  });

  process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
  });

  // --- Vite Integration ---
  if (process.env.NODE_ENV !== "production") {
    console.log("Iniciando em modo DESENVOLVIMENTO (Vite Middleware)");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    console.log("Iniciando em modo PRODUÇÃO (Servindo pasta dist)");
    const distPath = path.join(__dirname, "dist");

    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get("*", (req, res) => {
        const indexPath = path.join(distPath, "index.html");
        if (fs.existsSync(indexPath)) {
          res.sendFile(indexPath);
        } else {
          res.status(404).send("Erro de Build: index.html não encontrado na pasta dist. Verifique o comando npm run build.");
        }
      });
    } else {
      console.error("ERRO CRÍTICO: Pasta 'dist' não encontrada! O deploy vai falhar.");
      app.get("*", (req, res) => {
        res.status(500).send("Erro de Deploy: Pasta 'dist' não encontrada. O comando 'npm run build' pode ter falhado.");
      });
    }
  }

  // Erro Handler Global
  app.use((err: any, req: any, res: any, next: any) => {
    console.error("ERRO NO SERVIDOR:", err);
    res.status(500).json({ error: "Erro interno no servidor", details: err.message });
  });

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 MASTER FUNIL ON: http://0.0.0.0:${PORT}`);
    console.log(`Ambiente: ${process.env.NODE_ENV || 'development'}`);
  });
}

startServer().catch(err => {
  console.error("FALHA AO INICIAR O SERVIDOR:", err);
  process.exit(1);
});
