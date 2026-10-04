import express from "express";
import session from "express-session";
import Database from "better-sqlite3";
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const db = new Database(process.env.DB_PATH || path.join(__dirname, "lion.db"));

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  code_hash TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL DEFAULT 'Créateur',
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
`);

const hash = value => crypto.createHash("sha256").update(value).digest("hex");
const makeCode = () => "LDA-" + crypto.randomBytes(3).toString("hex").toUpperCase() + "-" + crypto.randomInt(100,999);

if (!db.prepare("SELECT id FROM users LIMIT 1").get()) {
  for (const [name, code, role] of [
    ["Administrateur", "ADMIN-001", "Admin"],
    ["Créateur Démo", "LDA-DEMO-101", "Créateur"],
    ["Manager Démo", "LDA-DEMO-202", "Manager"]
  ]) db.prepare("INSERT INTO users(name,code_hash,role) VALUES(?,?,?)").run(name,hash(code),role);
}

app.use(express.json());
app.use(express.urlencoded({extended:true}));
app.use(session({
  secret: process.env.SESSION_SECRET || "CHANGE-ME-IN-PRODUCTION",
  resave:false, saveUninitialized:false,
  cookie:{httpOnly:true,sameSite:"lax",secure:process.env.NODE_ENV==="production",maxAge:1000*60*60*12}
}));
app.use(express.static(path.join(__dirname,"public")));

function auth(req,res,next){ if(!req.session.user) return res.status(401).json({error:"Non connecté"}); next(); }
function admin(req,res,next){ if(req.session.user?.role!=="Admin") return res.status(403).json({error:"Accès administrateur requis"}); next(); }

app.post("/api/login",(req,res)=>{
  const code=String(req.body.code||"").trim().toUpperCase();
  if(!code) return res.status(400).json({error:"Code agence requis"});
  const u=db.prepare("SELECT id,name,role,active FROM users WHERE code_hash=?").get(hash(code));
  if(!u || !u.active) return res.status(401).json({error:"Code agence invalide ou désactivé"});
  req.session.user=u; res.json({user:u});
});
app.post("/api/logout",(req,res)=>req.session.destroy(()=>res.json({ok:true})));
app.get("/api/me",(req,res)=>res.json({user:req.session.user||null}));

app.get("/api/users",auth,admin,(req,res)=>{
  const rows=db.prepare("SELECT id,name,role,active,created_at FROM users ORDER BY id DESC").all();
  res.json({users:rows});
});
app.post("/api/users",auth,admin,(req,res)=>{
  const name=String(req.body.name||"").trim();
  const role=["Créateur","Manager"].includes(req.body.role)?req.body.role:"Créateur";
  if(!name) return res.status(400).json({error:"Nom requis"});
  const code=makeCode();
  const info=db.prepare("INSERT INTO users(name,code_hash,role) VALUES(?,?,?)").run(name,hash(code),role);
  res.json({id:info.lastInsertRowid,name,role,code});
});
app.patch("/api/users/:id",auth,admin,(req,res)=>{
  const id=Number(req.params.id);
  const active=req.body.active?1:0;
  db.prepare("UPDATE users SET active=? WHERE id=?").run(active,id);
  res.json({ok:true});
});
app.post("/api/users/:id/regenerate",auth,admin,(req,res)=>{
  const id=Number(req.params.id), code=makeCode();
  db.prepare("UPDATE users SET code_hash=? WHERE id=?").run(hash(code),id);
  res.json({code});
});

app.get("/api/dashboard",auth,(req,res)=>{
  const creators=db.prepare("SELECT COUNT(*) c FROM users WHERE role='Créateur' AND active=1").get().c;
  const users=db.prepare("SELECT COUNT(*) c FROM users WHERE active=1").get().c;
  res.json({creators,users,diamonds:72000,hours:88,days:33});
});

app.get(/.*/,(req,res)=>res.sendFile(path.join(__dirname,"public","index.html")));
app.listen(process.env.PORT||3000,()=>console.log("Lion Dynasty Agency running"));
