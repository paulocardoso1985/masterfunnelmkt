import express from "express";
import { createServer as createViteServer } from "vite";
import cookieParser from "cookie-parser";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import path from "path";
import { fileURLToPath } from "url";
import Database from "better-sqlite3";
import fs from "fs";
import os from "os";
import { GoogleGenAI } from "@google/genai";
import "dotenv/config";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- 🔐 THE BULLETPROOF AUTH FIX ---
// Initialize Standard Gemini API client
const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENAI_API_KEY || process.env.GOOGLE_API_KEY;
if (!apiKey) console.warn("⚠️ AVISO: Variável de API do Gemini não encontrada no painel. O SDK pode falhar tentando usar ADC.");
const ai = new GoogleGenAI(apiKey ? { apiKey } : {});

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
  CREATE TABLE IF NOT EXISTS logs (id INTEGER PRIMARY KEY AUTOINCREMENT, userId INTEGER, userName TEXT, userEmail TEXT, action TEXT, params TEXT, timestamp DATETIME DEFAULT CURRENT_TIMESTAMP);
`);

const adminEmail = "paulo.cardoso@maiscorporativo.tur.br";
if (!db.prepare("SELECT id FROM users WHERE email = ?").get(adminEmail)) {
  db.prepare("INSERT INTO users (email, password, role, name) VALUES (?, ?, ?, ?)").run(
    adminEmail, bcrypt.hashSync(process.env.ADMIN_PASSWORD || "admin123", 10), "admin", "Paulo Cardoso"
  );
}

const JWT_SECRET = process.env.JWT_SECRET || "master_funnel_mkt";
const PORT = Number(process.env.PORT) || 3000;

async function startServer() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());

  const distPath = path.join(__dirname, "dist");
  app.use(express.static(path.join(__dirname, "public")));

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

  app.get("/api/me", authenticate, (req: any, res: any) => res.json({ user: req.user }));
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
    res.json({ logs: logs.map((l: any) => ({ ...l, params: JSON.parse(l.params || "{}") })) });
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

  app.get("/api/strategies", authenticate, (req: any, res) => {
    const list = req.user.role === "admin" ? db.prepare("SELECT * FROM strategies ORDER BY timestamp DESC").all() : db.prepare("SELECT * FROM strategies WHERE userId = ? ORDER BY timestamp DESC").all(req.user.id);
    res.json({ strategies: list.map((s: any) => ({ ...s, formatos: JSON.parse(s.formatos || "[]") })) });
  });

  app.post("/api/strategies", authenticate, (req: any, res) => {
    const { negocio, ideia, publico, estilo, formatos, reportText, videoPrompt, narrationScript } = req.body;
    const resu = db.prepare(`INSERT INTO strategies (userId, negocio, ideia, publico, estilo, formatos, reportText, videoPrompt, narrationScript) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(req.user.id, negocio, ideia, publico, estilo, JSON.stringify(formatos), reportText, videoPrompt, narrationScript);
    res.json({ success: true, id: resu.lastInsertRowid });
  });

  app.post("/api/ai/generate-text", authenticate, async (req, res) => {
    const { prompt, systemInstruction } = req.body;
    try {
      const response = await ai.models.generateContent({
        model: process.env.GEMINI_MODEL || "gemini-2.0-flash",
        contents: prompt,
        config: { systemInstruction: systemInstruction || "Diretor MASTER FUNIL" }
      });
      res.json({ text: response.text });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.post("/api/ai/generate-image", authenticate, async (req, res) => {
    const { prompt, aspectRatio } = req.body;
    try {
      const response = await ai.models.generateImages({
        model: "imagen-3.0-generate-001",
        prompt: `${prompt}. MANDATORY: High quality, cinematic.`,
        config: {
          aspectRatio: aspectRatio || "1:1",
          numberOfImages: 1,
          outputMimeType: "image/jpeg"
        }
      });
      res.json({ data: response.generatedImages?.[0]?.image?.imageBytes });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.post("/api/ai/generate-video", authenticate, async (req, res) => {
    const { prompt } = req.body;
    try {
      const operation = await ai.models.generateVideos({
        model: "veo-2.0-generate-001",
        prompt: `${prompt}. MANDATORY: cinematic, respond in PT-BR.`
      });
      res.json({ operationName: operation.name });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.get("/api/ai/operation-status/*", authenticate, async (req, res) => {
    try {
      const operationName = req.params[0];
      const operation: any = await (ai.operations as any).get({ name: operationName });

      let videoUri = null;
      if (operation.done && operation.response?.generatedVideos?.[0]?.video?.uri) {
        videoUri = operation.response.generatedVideos[0].video.uri;
      }

      res.json({
        done: !!operation.done,
        videoUri: videoUri,
        error: operation.error
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
    app.use(express.static(distPath));
    app.get("*", (req, res) => res.sendFile(path.join(distPath, "index.html")));
  }

  app.listen(PORT, "0.0.0.0", () => console.log(`🚀 MASTER FUNIL ON: ${PORT}`));
}

startServer();
