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

// --- Robust Auth Setup ---
const getAuthOptions = () => {
  const creds = process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim();
  if (!creds) return {};
  if (creds.includes('{')) {
    try {
      const parsed = JSON.parse(creds);
      return { credentials: parsed };
    } catch (e) {
      console.error("[Auth] Error parsing JSON credentials");
      return {};
    }
  }
  return { keyFile: creds };
};

const authOptions = getAuthOptions();
const projectId = process.env.GOOGLE_PROJECT_ID;
const location = process.env.GOOGLE_LOCATION || "us-central1";

// Ensure data directory exists
const dataDir = path.join(__dirname, "data");
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

let db: any;
try {
  db = new Database(path.join(dataDir, "database.db"));
} catch (err) {
  db = new Database(":memory:");
}

db.exec(`
  CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT UNIQUE, password TEXT, role TEXT, name TEXT);
  CREATE TABLE IF NOT EXISTS strategies (id INTEGER PRIMARY KEY AUTOINCREMENT, userId INTEGER, negocio TEXT, ideia TEXT, publico TEXT, estilo TEXT, formatos TEXT, reportText TEXT, videoPrompt TEXT, narrationScript TEXT, timestamp DATETIME DEFAULT CURRENT_TIMESTAMP);
`);

const adminEmail = "paulo.cardoso@maiscorporativo.tur.br";
if (!db.prepare("SELECT id FROM users WHERE email = ?").get(adminEmail)) {
  db.prepare("INSERT INTO users (email, password, role, name) VALUES (?, ?, ?, ?)").run(
    adminEmail, bcrypt.hashSync(process.env.ADMIN_PASSWORD || "admin123", 10), "admin", "Paulo Cardoso"
  );
}

const JWT_SECRET = process.env.JWT_SECRET || "master-funnel-secret-2026";
const PORT = Number(process.env.PORT) || 3000;

// Centralized REST Helper with Explicit Auth
async function fetchVertex(uriPath: string, method: string = 'GET', body?: any) {
  const auth = new GoogleAuth({ scopes: 'https://www.googleapis.com/auth/cloud-platform', ...authOptions });
  const client = await auth.getClient();
  const token = (await client.getAccessToken()).token;

  const url = uriPath.startsWith('projects/')
    ? `https://${location}-aiplatform.googleapis.com/v1/${uriPath}`
    : `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/${uriPath}`;

  const response = await fetch(url, {
    method,
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined
  });

  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.message || `API Error: ${response.statusText}`);
  return data;
}

let vertexAIInstance: any = null;
const getVertexAI = () => {
  if (!vertexAIInstance && projectId) {
    vertexAIInstance = new VertexAI({ project: projectId, location, googleAuthOptions: authOptions });
  }
  return vertexAIInstance;
};

async function startServer() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());

  const publicPath = path.join(__dirname, "public");
  const distPath = path.join(__dirname, "dist");
  app.use(express.static(publicPath));

  const authenticate = (req: any, res: any, next: any) => {
    const token = req.cookies.auth_token;
    if (!token) return res.status(401).json({ error: "Unauthorized" });
    try {
      req.user = jwt.verify(token, JWT_SECRET);
      next();
    } catch (err) { res.status(401).json({ error: "Expired" }); }
  };

  app.post("/api/login", (req, res) => {
    const { email, password } = req.body;
    const user: any = db.prepare("SELECT * FROM users WHERE email = ?").get(email);
    if (!user || !bcrypt.compareSync(password, user.password)) return res.status(401).json({ error: "Invalid" });
    const token = jwt.sign({ id: user.id, email: user.email, role: user.role, name: user.name }, JWT_SECRET);
    res.cookie("auth_token", token, { httpOnly: true, secure: true, sameSite: "none" });
    res.json({ user: { id: user.id, email: user.email, role: user.role, name: user.name } });
  });

  app.get("/api/health", (req, res) => res.json({ status: "ok", vertexReady: !!projectId }));

  app.get("/api/strategies", authenticate, (req: any, res) => {
    const list = req.user.role === "admin" ? db.prepare("SELECT * FROM strategies ORDER BY timestamp DESC").all() : db.prepare("SELECT * FROM strategies WHERE userId = ? ORDER BY timestamp DESC").all(req.user.id);
    res.json({ strategies: list });
  });

  app.post("/api/strategies", authenticate, (req: any, res) => {
    const { negocio, ideia, publico, estilo, formatos, reportText, videoPrompt, narrationScript } = req.body;
    const resu = db.prepare(`INSERT INTO strategies (userId, negocio, ideia, publico, estilo, formatos, reportText, videoPrompt, narrationScript) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(req.user.id, negocio, ideia, publico, estilo, JSON.stringify(formatos), reportText, videoPrompt, narrationScript);
    res.json({ success: true, id: resu.lastInsertRowid });
  });

  // --- AI ENDPOINTS ---
  app.post("/api/ai/generate-text", authenticate, async (req, res) => {
    const { prompt, systemInstruction } = req.body;
    try {
      const vAI = getVertexAI();
      const model = vAI.getGenerativeModel({ model: "gemini-2.0-flash", systemInstruction: systemInstruction || "Diretor MASTER FUNIL" });
      const result = await model.generateContent({ contents: [{ role: 'user', parts: [{ text: prompt }] }] });
      res.json({ text: (await result.response).candidates?.[0]?.content?.parts?.[0]?.text });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.post("/api/ai/generate-image", authenticate, async (req, res) => {
    const { prompt, aspectRatio } = req.body;
    try {
      const body = {
        instances: [{ prompt: `${prompt}. MANDATORY: High quality, cinematic, 4k.` }],
        parameters: { sampleCount: 1, aspectRatio: aspectRatio || "1:1" }
      };
      const data = await fetchVertex(`publishers/google/models/imagen-3.0-generate-001:predict`, 'POST', body);
      const b64 = data.predictions?.[0]?.bytesBase64Encoded;
      if (b64) res.json({ data: b64 }); else throw new Error("No image data returned from Vertex");
    } catch (err: any) {
      console.error("Image Gen Error:", err.message);
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/ai/generate-video", authenticate, async (req, res) => {
    const { prompt } = req.body;
    try {
      const body = { instances: [{ prompt: `${prompt}. MANDATORY: cinematic, 4k, respond in PT-BR.` }] };
      const data = await fetchVertex(`publishers/google/models/veo-3.1-fast-generate-001:predictLongRunning`, 'POST', body);
      if (data.name) res.json({ operationName: data.name }); else throw new Error(data.error?.message || "Operation failed");
    } catch (err: any) {
      console.error("Video Gen Error:", err.message);
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/ai/operation-status/*", authenticate, async (req, res) => {
    try {
      const data = await fetchVertex(req.params[0]);
      res.json({
        done: data.done,
        videoUri: data.response?.generatedVideos?.[0]?.video?.uri,
        error: data.error
      });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.get("/api/ai/video-proxy", authenticate, async (req, res) => {
    try {
      const videoRes = await fetch(req.query.url as string);
      res.setHeader("Content-Type", "video/mp4");
      res.send(Buffer.from(await videoRes.arrayBuffer()));
    } catch (err: any) { res.status(500).send(err.message); }
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: "spa" });
    app.use(vite.middlewares);
  } else {
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get("*", (req, res) => res.sendFile(path.join(distPath, "index.html")));
    }
  }

  app.listen(PORT, "0.0.0.0", () => console.log(`🚀 MASTER FUNIL ON: ${PORT}`));
}

startServer();
