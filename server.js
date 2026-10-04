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
  console.error("DATABASE_URL est manquante.");
  process.exit(1);
}
const pool = new Pool({
  connectionString: databaseUrl,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false
});
const hash = v => crypto.createHash("sha256").update(String(v)).digest("hex");
const makeCode = () => "LDA-" + crypto.randomBytes(3).toString("hex").toUpperCase() + "-" + crypto.randomInt(100,999);

async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id BIGSERIAL PRIMARY KEY, name TEXT NOT NULL, code_hash TEXT NOT NULL UNIQUE,
      role TEXT NOT NULL CHECK (role IN ('Créateur','Manager','Admin')),
      active BOOLEAN NOT NULL DEFAULT TRUE, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS module_items (
      id BIGSERIAL PRIMARY KEY,
      module TEXT NOT NULL, title TEXT NOT NULL, content TEXT DEFAULT '',
      status TEXT DEFAULT 'Actif', created_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS audit_logs (
      id BIGSERIAL PRIMARY KEY, user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
      action TEXT NOT NULL, details TEXT DEFAULT '', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  for (const q of [
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS tiktok TEXT DEFAULT ''`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS followers INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS diamonds INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS live_hours NUMERIC(10,2) NOT NULL DEFAULT 0`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS level TEXT DEFAULT 'Nouveau'`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS note TEXT DEFAULT ''`
  ]) await pool.query(q);

  const count = await pool.query("SELECT COUNT(*)::int AS count FROM users");
  if (!count.rows[0].count) {
    for (const [name, code, role] of [
      ["Administrateur","ADMIN-001","Admin"],
      ["Créateur Démo","LDA-DEMO-101","Créateur"],
      ["Manager Démo","LDA-DEMO-202","Manager"]
    ]) {
      await pool.query("INSERT INTO users(name,code_hash,role) VALUES($1,$2,$3)", [name,hash(code),role]);
    }
    await pool.query("UPDATE users SET tiktok='@liondemo', followers=12500, diamonds=72000, live_hours=88, level='Or' WHERE role='Créateur'");
  }
}

const PgSession = connectPgSimple(session);
app.use(express.json({limit:"1mb"}));
app.use(express.urlencoded({extended:true}));
app.use(session({
  store:new PgSession({pool,tableName:"user_sessions",createTableIfMissing:true}),
  secret:process.env.SESSION_SECRET || "CHANGE-ME",
  resave:false, saveUninitialized:false, rolling:true,
  cookie:{httpOnly:true,sameSite:"lax",secure:process.env.NODE_ENV==="production",maxAge:43200000}
}));
app.use(express.static(path.join(__dirname,"public")));

const auth=(req,res,next)=>req.session.user?next():res.status(401).json({error:"Non connecté"});
const manager=(req,res,next)=>["Admin","Manager"].includes(req.session.user?.role)?next():res.status(403).json({error:"Accès manager requis"});
const admin=(req,res,next)=>req.session.user?.role==="Admin"?next():res.status(403).json({error:"Accès administrateur requis"});

async function audit(req, action, details="") {
  await pool.query("INSERT INTO audit_logs(user_id,action,details) VALUES($1,$2,$3)", [req.session.user?.id||null,action,details]);
}

app.post("/api/login",async(req,res,next)=>{
  try {
    const code=String(req.body.code||"").trim().toUpperCase();
    const r=await pool.query("SELECT id,name,role,active FROM users WHERE code_hash=$1 LIMIT 1",[hash(code)]);
    const user=r.rows[0];
    if(!user||!user.active) return res.status(401).json({error:"Code agence invalide ou désactivé"});
    await new Promise((ok,no)=>req.session.regenerate(e=>e?no(e):ok()));
    req.session.user=user;
    await audit(req,"Connexion","Connexion réussie");
    await new Promise((ok,no)=>req.session.save(e=>e?no(e):ok()));
    res.json({user});
  } catch(e){next(e)}
});
app.post("/api/logout",(req,res)=>req.session.destroy(()=>{res.clearCookie("connect.sid");res.json({ok:true})}));
app.get("/api/me",(req,res)=>res.json({user:req.session.user||null}));

app.get("/api/dashboard",auth,async(req,res,next)=>{
  try {
    const r=await pool.query(`SELECT
      COUNT(*) FILTER (WHERE role='Créateur' AND active)::int creators,
      COUNT(*) FILTER (WHERE active)::int users,
      COALESCE(SUM(live_hours) FILTER (WHERE role='Créateur'),0) hours,
      COALESCE(SUM(diamonds) FILTER (WHERE role='Créateur'),0)::int diamonds
      FROM users`);
    res.json(r.rows[0]);
  } catch(e){next(e)}
});

app.get("/api/creators",auth,async(req,res,next)=>{
  try {
    const r=await pool.query(`SELECT id,name,tiktok,followers,diamonds,live_hours,level,note,active,created_at
      FROM users WHERE role='Créateur' ORDER BY diamonds DESC,id DESC`);
    res.json({creators:r.rows});
  }catch(e){next(e)}
});
app.post("/api/creators",manager,async(req,res,next)=>{
  try {
    const name=String(req.body.name||"").trim();
    if(!name)return res.status(400).json({error:"Nom requis"});
    const tiktok=String(req.body.tiktok||"").trim();
    const followers=Math.max(0,Number(req.body.followers)||0);
    const diamonds=Math.max(0,Number(req.body.diamonds)||0);
    const hours=Math.max(0,Number(req.body.live_hours)||0);
    let code,result;
    for(let i=0;i<10;i++){
      code=makeCode();
      try {
        result=await pool.query(`INSERT INTO users(name,code_hash,role,tiktok,followers,diamonds,live_hours,level,note)
          VALUES($1,$2,'Créateur',$3,$4,$5,$6,$7,$8)
          RETURNING id,name,tiktok,followers,diamonds,live_hours,level,note,active`,[
            name,hash(code),tiktok,followers,diamonds,hours,String(req.body.level||"Nouveau"),String(req.body.note||"")
          ]);
        break;
      }catch(e){if(e.code!=="23505"||i===9)throw e}
    }
    await audit(req,"Création créateur",name);
    res.json({...result.rows[0],code});
  }catch(e){next(e)}
});
app.patch("/api/creators/:id",manager,async(req,res,next)=>{
  try{
    const id=Number(req.params.id);
    const r=await pool.query(`UPDATE users SET name=COALESCE($1,name),tiktok=COALESCE($2,tiktok),
      followers=COALESCE($3,followers),diamonds=COALESCE($4,diamonds),live_hours=COALESCE($5,live_hours),
      level=COALESCE($6,level),note=COALESCE($7,note),active=COALESCE($8,active)
      WHERE id=$9 AND role='Créateur' RETURNING id,name,tiktok,followers,diamonds,live_hours,level,note,active`,
      [req.body.name||null,req.body.tiktok??null,req.body.followers==null?null:Number(req.body.followers),
       req.body.diamonds==null?null:Number(req.body.diamonds),req.body.live_hours==null?null:Number(req.body.live_hours),
       req.body.level||null,req.body.note??null,req.body.active==null?null:Boolean(req.body.active),id]);
    if(!r.rowCount)return res.status(404).json({error:"Créateur introuvable"});
    await audit(req,"Modification créateur",String(id));
    res.json(r.rows[0]);
  }catch(e){next(e)}
});

app.get("/api/rankings",auth,async(req,res,next)=>{
  try{
    const r=await pool.query(`SELECT id,name,tiktok,followers,diamonds,live_hours,level,active
      FROM users WHERE role='Créateur' ORDER BY diamonds DESC,live_hours DESC`);
    res.json({rankings:r.rows});
  }catch(e){next(e)}
});

app.get("/api/users",admin,async(req,res,next)=>{
  try{const r=await pool.query("SELECT id,name,role,active,created_at FROM users ORDER BY id DESC");res.json({users:r.rows})}catch(e){next(e)}
});
app.post("/api/users",admin,async(req,res,next)=>{
  try{
    const name=String(req.body.name||"").trim(); const role=["Créateur","Manager"].includes(req.body.role)?req.body.role:"Créateur";
    if(!name)return res.status(400).json({error:"Nom requis"});
    let code,result;
    for(let i=0;i<10;i++){code=makeCode();try{result=await pool.query("INSERT INTO users(name,code_hash,role) VALUES($1,$2,$3) RETURNING id,name,role,active,created_at",[name,hash(code),role]);break}catch(e){if(e.code!=="23505"||i===9)throw e}}
    await audit(req,"Création compte",`${name} (${role})`);
    res.json({...result.rows[0],code});
  }catch(e){next(e)}
});
app.patch("/api/users/:id",admin,async(req,res,next)=>{
  try{const id=Number(req.params.id);await pool.query("UPDATE users SET active=$1 WHERE id=$2",[Boolean(req.body.active),id]);await audit(req,"Activation compte",`${id}`);res.json({ok:true})}catch(e){next(e)}
});
app.post("/api/users/:id/regenerate",admin,async(req,res,next)=>{
  try{const id=Number(req.params.id),code=makeCode();const r=await pool.query("UPDATE users SET code_hash=$1 WHERE id=$2 RETURNING id",[hash(code),id]);if(!r.rowCount)return res.status(404).json({error:"Utilisateur introuvable"});await audit(req,"Régénération code",`${id}`);res.json({code})}catch(e){next(e)}
});

const modules=["tiktok","reglements","live","challenges","equipe","jeux","partenariats","collaborations","overlays","matchs","affiches","avertissements","contrats","annonces","messages","reunions","demandes","securite","documents","kbis","apparence","aide"];
app.get("/api/module/:module",auth,async(req,res,next)=>{
  try{if(!modules.includes(req.params.module))return res.status(404).json({error:"Module inconnu"});
    const r=await pool.query("SELECT id,module,title,content,status,created_at FROM module_items WHERE module=$1 ORDER BY id DESC",[req.params.module]);res.json({items:r.rows})
  }catch(e){next(e)}
});
app.post("/api/module/:module",manager,async(req,res,next)=>{
  try{if(!modules.includes(req.params.module))return res.status(404).json({error:"Module inconnu"});
    const title=String(req.body.title||"").trim();if(!title)return res.status(400).json({error:"Titre requis"});
    const r=await pool.query("INSERT INTO module_items(module,title,content,status,created_by) VALUES($1,$2,$3,$4,$5) RETURNING *",
      [req.params.module,title,String(req.body.content||""),String(req.body.status||"Actif"),req.session.user.id]);
    await audit(req,"Ajout module",`${req.params.module}: ${title}`);res.json(r.rows[0])
  }catch(e){next(e)}
});
app.delete("/api/module/:module/:id",manager,async(req,res,next)=>{
  try{await pool.query("DELETE FROM module_items WHERE module=$1 AND id=$2",[req.params.module,Number(req.params.id)]);await audit(req,"Suppression module",`${req.params.module}:${req.params.id}`);res.json({ok:true})}catch(e){next(e)}
});
app.get("/api/audit",admin,async(req,res,next)=>{try{const r=await pool.query(`SELECT a.id,a.action,a.details,a.created_at,u.name FROM audit_logs a LEFT JOIN users u ON u.id=a.user_id ORDER BY a.id DESC LIMIT 200`);res.json({logs:r.rows})}catch(e){next(e)}});

app.get("/health",async(req,res)=>{try{await pool.query("SELECT 1");res.json({ok:true,service:"lion-dynasty-agency",version:"4",database:"postgresql"})}catch{res.status(503).json({ok:false})}});
app.use((err,req,res,next)=>{console.error(err);if(res.headersSent)return next(err);res.status(500).json({error:"Erreur serveur"})});
app.get(/.*/, (req,res)=>res.sendFile(path.join(__dirname,"public","index.html")));

const port=Number(process.env.PORT||3000);
initDb().then(()=>app.listen(port,()=>console.log(`Lion Dynasty Agency V4 running on port ${port}`))).catch(e=>{console.error(e);process.exit(1)});
