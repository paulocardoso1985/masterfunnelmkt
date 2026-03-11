import express from "express";
import { createServer as createViteServer } from "vite";
import cookieParser from "cookie-parser";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import path from "path";
import { fileURLToPath } from "url";
import Database from "better-sqlite3";
import fs from "fs";
import { VertexAI } from "@google-cloud/vertexai";
import { GoogleAuth } from 'google-auth-library';
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

// Centralized Google Auth Helper to handle JSON strings or File paths
const getGoogleAuthOptions = () => {
  const creds = process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim();
  if (!creds) return {};

  if (creds.includes('{')) {
    try {
      const parsed = JSON.parse(creds);
      console.log(`[Auth] Using JSON credentials for Project: ${parsed.project_id}`);
      return { credentials: parsed };
    } catch (e) {
      console.error(`[Auth] Error parsing GOOGLE_APPLICATION_CREDENTIALS JSON:`, e);
      return {};
    }
  }

  console.log(`[Auth] Using key file: ${creds}`);
  return { keyFilename: creds };
};

let vertexAI: any = null;

// Lazy Vertex AI initialization helper
const getVertexAI = () => {
  const proj = process.env.GOOGLE_PROJECT_ID?.trim();
  const loc = process.env.GOOGLE_LOCATION?.trim() || "us-central1";

  if (!vertexAI && proj && proj !== "") {
    const authOpts = getGoogleAuthOptions();
    console.log(`[Vertex AI] Initializing for Project: ${proj}, Location: ${loc}`);
    vertexAI = new VertexAI({
      project: proj,
      location: loc,
      googleAuthOptions: authOpts
    });
  }
  return vertexAI;
};

// Periodic check for initialization
setInterval(() => getVertexAI(), 30000);

async function startServer() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());

  const publicPath = path.join(__dirname, "public");
  const distPath = path.join(__dirname, "dist");
  app.use(express.static(publicPath));

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
        return res.sendFile(loc);
      }
    }
    res.status(404).send("Logo not found");
  };

  app.get("/logo.png", serveLogo("logo.png"));
  app.get("/Logo_Mais_Braco_orange.png", serveLogo("Logo_Mais_Braco_orange.png"));

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

  app.post("/api/login", (req, res) => {
    const { email, password } = req.body;
    const user: any = db.prepare("SELECT * FROM users WHERE email = ?").get(email);
    if (!user || !bcrypt.compareSync(password, user.password)) {
      return res.status(401).json({ error: "Credenciais inválidas" });
    }
    const token = jwt.sign({ id: user.id, email: user.email, role: user.role, name: user.name }, JWT_SECRET, { expiresIn: "7d" });
    res.cookie("auth_token", token, { httpOnly: true, secure: true, sameSite: "none", maxAge: 7 * 24 * 60 * 60 * 1000 });
    res.json({ user: { id: user.id, email: user.email, role: user.role, name: user.name } });
  });

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString(), vertexInitialized: !!vertexAI });
  });

  app.get("/api/me", authenticate, (req: any, res) => {
    res.json({ user: req.user });
  });

  app.post("/api/logout", (req, res) => {
    res.clearCookie("auth_token");
    res.json({ success: true });
  });

  app.get("/api/strategies", authenticate, (req: any, res) => {
    let strategies = req.user.role === "admin"
      ? db.prepare("SELECT * FROM strategies ORDER BY timestamp DESC").all()
      : db.prepare("SELECT * FROM strategies WHERE userId = ? ORDER BY timestamp DESC").all(req.user.id);
    res.json({ strategies });
  });

  app.post("/api/strategies", authenticate, (req: any, res) => {
    const { negocio, ideia, publico, estilo, formatos, reportText, videoPrompt, narrationScript } = req.body;
    try {
      const result = db.prepare(`
        INSERT INTO strategies (userId, negocio, ideia, publico, estilo, formatos, reportText, videoPrompt, narrationScript)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(req.user.id, negocio, ideia, publico, estilo, JSON.stringify(formatos), reportText, videoPrompt, narrationScript);
      res.json({ success: true, id: result.lastInsertRowid });
    } catch (err) {
      res.status(500).json({ error: "Falha ao salvar estratégia" });
    }
  });

  // --- AI API Endpoints ---
  app.post("/api/ai/generate-text", authenticate, async (req, res) => {
    const { model, prompt, systemInstruction } = req.body;
    try {
      const vAI = getVertexAI();
      if (!vAI) throw new Error("Vertex AI is not initialized.");
      const modelInstance = vAI.getGenerativeModel({
        model: model || "gemini-2.0-flash",
        systemInstruction: systemInstruction || "Você é o Diretor de Criação da MASTER FUNIL."
      });
      const result = await modelInstance.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }]
      });
      const response = await result.response;
      res.json({ text: response.candidates?.[0]?.content?.parts?.[0]?.text });
    } catch (err: any) {
      console.error("AI Text Error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/ai/generate-image", authenticate, async (req, res) => {
    const { prompt, aspectRatio, model } = req.body;
    try {
      const vAI = getVertexAI();
      if (!vAI) throw new Error("Vertex AI is not initialized.");
      const targetModel = model || "imagen-3.0-generate-001";
      const modelInstance = vAI.getGenerativeModel({ model: targetModel });

      console.log(`[Vertex AI] Generating image. Ratio: ${aspectRatio}`);

      const result = await modelInstance.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          aspectRatio: aspectRatio || "1:1",
        }
      });

      const response = await result.response;
      const part = response.candidates?.[0]?.content?.parts.find((p: any) => p.inlineData);
      if (part?.inlineData?.data) {
        res.json({ data: part.inlineData.data });
      } else {
        throw new Error("O modelo não retornou dados de imagem.");
      }
    } catch (err: any) {
      console.error("AI Image Error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/ai/generate-video", authenticate, async (req, res) => {
    const { prompt } = req.body;
    try {
      if (!prompt) throw new Error("Prompt is required");

      const authOpts = getGoogleAuthOptions();
      const auth = new GoogleAuth({
        scopes: 'https://www.googleapis.com/auth/cloud-platform',
        ...authOpts
      });

      const client = await auth.getClient();
      const projectId = process.env.GOOGLE_PROJECT_ID;
      const location = process.env.GOOGLE_LOCATION || 'us-central1';
      const accessTokenDetails = await client.getAccessToken();
      const accessToken = accessTokenDetails.token || "";

      const targetModel = 'veo-3.1-fast-generate-001';
      const url = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/${targetModel}:predictLongRunning`;

      const videoBody = {
        instances: [{ prompt: `${prompt}. MANDATORY: Respond ONLY in Portuguese (PT-BR). Style: Cinematic, 4k.` }]
      };

      const restResp = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(videoBody)
      });

      const videoData = await restResp.json();
      if (videoData.name) {
        res.json({ operationName: videoData.name });
      } else {
        throw new Error(videoData.error?.message || "Erro ao iniciar operação de vídeo.");
      }
    } catch (err: any) {
      console.error("AI Video Error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/ai/operation-status/*", authenticate, async (req, res) => {
    try {
      const vAI = getVertexAI();
      if (!vAI) throw new Error("Vertex AI is not initialized.");
      const operationName = req.params[0];
      const operation: any = await (vertexAI as any).getOperation({ name: operationName });
      res.json({
        done: operation.done,
        videoUri: operation.response?.generatedVideos?.[0]?.video?.uri,
        error: operation.error
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/ai/video-proxy", authenticate, async (req, res) => {
    const videoUrl = req.query.url as string;
    try {
      if (!videoUrl) throw new Error("URL é obrigatória");
      const videoRes = await fetch(videoUrl);
      if (!videoRes.ok) throw new Error(`Falha ao buscar vídeo`);
      res.setHeader("Content-Type", "video/mp4");
      const buffer = await videoRes.arrayBuffer();
      res.send(Buffer.from(buffer));
    } catch (err: any) {
      res.status(500).send(err.message);
    }
  });

  // --- Production Serving ---
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: "spa" });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, "dist");
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get("*", (req, res) => res.sendFile(path.join(distPath, "index.html")));
    }
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 MASTER FUNIL ON: http://0.0.0.0:${PORT}`);
  });
}

startServer();
