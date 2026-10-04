import express from "express";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import pg from "pg";
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const { Pool } = pg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
app.set("trust proxy", 1);

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("DATABASE_URL est manquante. Ajoute une base PostgreSQL et sa variable DATABASE_URL sur Render.");
  process.exit(1);
}

const pool = new Pool({
  connectionString: databaseUrl,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false
});

const hash = value =>
  crypto.createHash("sha256").update(String(value)).digest("hex");

const makeCode = () =>
  "LDA-" +
  crypto.randomBytes(3).toString("hex").toUpperCase() +
  "-" +
  crypto.randomInt(100, 999);

async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id BIGSERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      code_hash TEXT NOT NULL UNIQUE,
      role TEXT NOT NULL CHECK (role IN ('Créateur','Manager','Admin')),
      active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  const count = await pool.query("SELECT COUNT(*)::int AS count FROM users");
  if (count.rows[0].count === 0) {
    const demoUsers = [
      ["Administrateur", "ADMIN-001", "Admin"],
      ["Créateur Démo", "LDA-DEMO-101", "Créateur"],
      ["Manager Démo", "LDA-DEMO-202", "Manager"]
    ];

    for (const [name, code, role] of demoUsers) {
      await pool.query(
        "INSERT INTO users(name, code_hash, role) VALUES($1,$2,$3)",
        [name, hash(code), role]
      );
    }

    console.log("Comptes de démonstration créés.");
  }
}

const PgSession = connectPgSimple(session);

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

app.use(
  session({
    store: new PgSession({
      pool,
      tableName: "user_sessions",
      createTableIfMissing: true
    }),
    secret:
      process.env.SESSION_SECRET ||
      "CHANGE-ME-IMMEDIATELY-IN-RENDER",
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 1000 * 60 * 60 * 12
    }
  })
);

app.use(express.static(path.join(__dirname, "public")));

function auth(req, res, next) {
  if (!req.session.user) {
    return res.status(401).json({ error: "Non connecté" });
  }
  next();
}

function admin(req, res, next) {
  if (req.session.user?.role !== "Admin") {
    return res.status(403).json({ error: "Accès administrateur requis" });
  }
  next();
}

app.post("/api/login", async (req, res, next) => {
  try {
    const code = String(req.body.code || "").trim().toUpperCase();
    if (!code) return res.status(400).json({ error: "Code agence requis" });

    const result = await pool.query(
      "SELECT id, name, role, active FROM users WHERE code_hash = $1 LIMIT 1",
      [hash(code)]
    );

    const user = result.rows[0];

    if (!user || !user.active) {
      return res
        .status(401)
        .json({ error: "Code agence invalide ou désactivé" });
    }

    await new Promise((resolve, reject) => {
      req.session.regenerate(err => {
        if (err) reject(err);
        else resolve();
      });
    });

    req.session.user = user;

    await new Promise((resolve, reject) => {
      req.session.save(err => {
        if (err) reject(err);
        else resolve();
      });
    });

    res.json({ user });
  } catch (err) {
    next(err);
  }
});

app.post("/api/logout", async (req, res) => {
  req.session.destroy(() => {
    res.clearCookie("connect.sid");
    res.json({ ok: true });
  });
});

app.get("/api/me", (req, res) => {
  res.json({ user: req.session.user || null });
});

app.get("/api/dashboard", auth, async (req, res, next) => {
  try {
    const [creators, users] = await Promise.all([
      pool.query(
        "SELECT COUNT(*)::int AS count FROM users WHERE role = 'Créateur' AND active = TRUE"
      ),
      pool.query("SELECT COUNT(*)::int AS count FROM users WHERE active = TRUE")
    ]);

    res.json({
      creators: creators.rows[0].count,
      users: users.rows[0].count,
      diamonds: 72000,
      hours: 88,
      days: 33
    });
  } catch (err) {
    next(err);
  }
});

app.get("/api/users", auth, admin, async (req, res, next) => {
  try {
    const result = await pool.query(
      "SELECT id, name, role, active, created_at FROM users ORDER BY id DESC"
    );
    res.json({ users: result.rows });
  } catch (err) {
    next(err);
  }
});

app.post("/api/users", auth, admin, async (req, res, next) => {
  try {
    const name = String(req.body.name || "").trim();
    const role = ["Créateur", "Manager"].includes(req.body.role)
      ? req.body.role
      : "Créateur";

    if (!name) return res.status(400).json({ error: "Nom requis" });

    let code;
    let result;
    for (let attempt = 0; attempt < 10; attempt++) {
      code = makeCode();
      try {
        result = await pool.query(
          "INSERT INTO users(name, code_hash, role) VALUES($1,$2,$3) RETURNING id, name, role, active, created_at",
          [name, hash(code), role]
        );
        break;
      } catch (err) {
        if (err.code !== "23505" || attempt === 9) throw err;
      }
    }

    res.json({ ...result.rows[0], code });
  } catch (err) {
    next(err);
  }
});

app.patch("/api/users/:id", auth, admin, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const active = Boolean(req.body.active);

    if (!Number.isInteger(id)) {
      return res.status(400).json({ error: "Identifiant invalide" });
    }

    await pool.query("UPDATE users SET active = $1 WHERE id = $2", [
      active,
      id
    ]);

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

app.post("/api/users/:id/regenerate", auth, admin, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ error: "Identifiant invalide" });
    }

    const code = makeCode();
    const result = await pool.query(
      "UPDATE users SET code_hash = $1 WHERE id = $2 RETURNING id",
      [hash(code), id]
    );

    if (!result.rowCount) {
      return res.status(404).json({ error: "Utilisateur introuvable" });
    }

    res.json({ code });
  } catch (err) {
    next(err);
  }
});

app.get("/health", async (req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ ok: true, service: "lion-dynasty-agency", database: "postgresql" });
  } catch {
    res.status(503).json({ ok: false });
  }
});

app.use((err, req, res, next) => {
  console.error(err);
  if (res.headersSent) return next(err);
  res.status(500).json({ error: "Erreur serveur" });
});

app.get(/.*/, (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

const port = Number(process.env.PORT || 3000);

initDb()
  .then(() => {
    app.listen(port, () =>
      console.log(`Lion Dynasty Agency V3 running on port ${port}`)
    );
  })
  .catch(err => {
    console.error("Impossible d'initialiser PostgreSQL :", err);
    process.exit(1);
  });
