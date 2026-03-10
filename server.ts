import express from "express";
import { createServer as createViteServer } from "vite";
import cookieParser from "cookie-parser";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import path from "path";
import { fileURLToPath } from "url";
import Database from "better-sqlite3";
import fs from "fs";

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

async function startServer() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  
  // Serve static files from public folder (fallback/dev)
  app.use(express.static(path.join(__dirname, "public")));
  
  // Explicit routes for logos to ensure they are found
  app.get("/logo.png", (req, res) => {
    const p = path.join(__dirname, "public", "logo.png");
    if (fs.existsSync(p)) return res.sendFile(p);
    const d = path.join(__dirname, "dist", "logo.png");
    if (fs.existsSync(d)) return res.sendFile(d);
    res.status(404).send("Not found");
  });

  app.get("/Logo_Mais_Braco_orange.png", (req, res) => {
    const p = path.join(__dirname, "public", "Logo_Mais_Braco_orange.png");
    if (fs.existsSync(p)) return res.sendFile(p);
    const d = path.join(__dirname, "dist", "Logo_Mais_Braco_orange.png");
    if (fs.existsSync(d)) return res.sendFile(d);
    res.status(404).send("Not found");
  });

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
    console.log(`🚀 MASTER FUNNEL ON: http://0.0.0.0:${PORT}`);
    console.log(`Ambiente: ${process.env.NODE_ENV || 'development'}`);
  });
}

startServer().catch(err => {
  console.error("FALHA AO INICIAR O SERVIDOR:", err);
  process.exit(1);
});
