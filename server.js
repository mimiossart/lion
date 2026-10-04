import express from "express";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import pg from "pg";
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import multer from "multer";
import { createServer } from "node:http";
import { WebSocketServer, WebSocket } from "ws";

const { Pool } = pg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const httpServer = createServer(app);
const wss = new WebSocketServer({ noServer: true });
const chatSockets = new Set();
wss.on("connection", socket => { chatSockets.add(socket); socket.on("close",()=>chatSockets.delete(socket)); });
function broadcastChat(){ for(const socket of chatSockets){ if(socket.readyState===WebSocket.OPEN) socket.send(JSON.stringify({type:"message"})); } }
httpServer.on("upgrade",(req,socket,head)=>{
  if(req.url !== "/ws"){ socket.destroy(); return; }
  wss.handleUpgrade(req,socket,head,ws=>wss.emit("connection",ws,req));
});
const uploadDir = path.join(__dirname, "uploads");
fs.mkdirSync(uploadDir, { recursive: true });
app.set("trust proxy", 1);
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) { console.error("DATABASE_URL est manquante."); process.exit(1); }
const pool = new Pool({ connectionString: databaseUrl, ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized:false } : false });
const hash = v => crypto.createHash("sha256").update(String(v)).digest("hex");
const makeCode = () => "LDA-" + crypto.randomBytes(3).toString("hex").toUpperCase() + "-" + crypto.randomInt(100,999);
const ROLE_LEVEL = { Fondateur:6, "Co-Fondateur":5, Directeur:4, Manager:3, Ambassadeur:2, Créateur:1 };
const ROLES = Object.keys(ROLE_LEVEL);
const agencyManagers = ["Fondateur","Co-Fondateur","Directeur","Manager"];
const modules = ["dashboard","classement","createurs","danger","tiktok","reglements","partenariats","matchs","posters","avertissements","contrats","stats","documents","demandes","messages","reunions","notifications","reactivation","securite","admin"];
const ACCESS_CATEGORIES = [
  ["dashboard","Tableau de bord"],["classement","Classement"],["createurs","Créateurs"],["danger","Créateurs en danger"],
  ["tiktok","Profils TikTok"],["reglements","Règlements TikTok"],["partenariats","Partenariats"],["matchs","Matchs officiels"],
  ["posters","Match posters"],["avertissements","Avertissements"],["contrats","Contrats"],["stats","Statistiques TikTok"],
  ["documents","Documents"],["demandes","Demandes"],["messages","Messages"],["reunions","Réunions vidéo"],
  ["notifications","Notifications"],["reactivation","Réactivation des accès"],["securite","Sécurité"],["admin","Administration"]
];
const DEFAULT_ACCESS = ACCESS_CATEGORIES.map(x=>x[0]);
const can = (role, min) => (ROLE_LEVEL[role]||0) >= min;

async function initDb(){
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users(
      id BIGSERIAL PRIMARY KEY, name TEXT NOT NULL, code_hash TEXT NOT NULL UNIQUE,
      role TEXT NOT NULL, active BOOLEAN NOT NULL DEFAULT TRUE, inactivity_locked BOOLEAN NOT NULL DEFAULT FALSE, inactive_reason TEXT DEFAULT '', last_login_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      tiktok TEXT DEFAULT '', followers INTEGER NOT NULL DEFAULT 0, diamonds INTEGER NOT NULL DEFAULT 0,
      live_hours NUMERIC(10,2) NOT NULL DEFAULT 0, level TEXT DEFAULT 'Nouveau', note TEXT DEFAULT '',
      manager_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
      access_modules TEXT[] NOT NULL DEFAULT '{}'
    );
    CREATE TABLE IF NOT EXISTS module_items(
      id BIGSERIAL PRIMARY KEY, module TEXT NOT NULL, title TEXT NOT NULL, content TEXT DEFAULT '',
      status TEXT DEFAULT 'Actif', created_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS audit_logs(
      id BIGSERIAL PRIMARY KEY, user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
      action TEXT NOT NULL, details TEXT DEFAULT '', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS tiktok_stats(
      id BIGSERIAL PRIMARY KEY, creator_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      stat_date DATE NOT NULL DEFAULT CURRENT_DATE, followers INTEGER DEFAULT 0, views INTEGER DEFAULT 0,
      likes INTEGER DEFAULT 0, diamonds INTEGER DEFAULT 0, live_hours NUMERIC(10,2) DEFAULT 0,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(creator_id, stat_date)
    );
    ALTER TABLE tiktok_stats ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
    CREATE TABLE IF NOT EXISTS contracts(
      id BIGSERIAL PRIMARY KEY, creator_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
      title TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'Brouillon', start_date DATE, end_date DATE,
      notes TEXT DEFAULT '', created_by BIGINT REFERENCES users(id) ON DELETE SET NULL, created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS documents(
      id BIGSERIAL PRIMARY KEY, title TEXT NOT NULL, category TEXT DEFAULT 'Agence', url TEXT DEFAULT '', content TEXT DEFAULT '',
      visibility TEXT DEFAULT 'Tous', created_by BIGINT REFERENCES users(id) ON DELETE SET NULL, created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS messages(
      id BIGSERIAL PRIMARY KEY, sender_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
      recipient_id BIGINT REFERENCES users(id) ON DELETE CASCADE, subject TEXT NOT NULL, body TEXT NOT NULL,
      read_at TIMESTAMPTZ, created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS matches(
      id BIGSERIAL PRIMARY KEY, title TEXT NOT NULL, creator_id BIGINT REFERENCES users(id) ON DELETE SET NULL, opponent TEXT DEFAULT '', match_date TIMESTAMPTZ,
      status TEXT DEFAULT 'Planifié', result TEXT DEFAULT '', notes TEXT DEFAULT '', age_restriction TEXT DEFAULT 'Tous', boost TEXT DEFAULT 'Sans boost', created_by BIGINT REFERENCES users(id) ON DELETE SET NULL
    );
    CREATE TABLE IF NOT EXISTS posters(
      id BIGSERIAL PRIMARY KEY, creator_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
      original_name TEXT NOT NULL, stored_name TEXT NOT NULL, mime_type TEXT DEFAULT 'application/octet-stream',
      size_bytes BIGINT NOT NULL DEFAULT 0, url TEXT NOT NULL, uploaded_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS challenges(
      id BIGSERIAL PRIMARY KEY, title TEXT NOT NULL, description TEXT DEFAULT '', start_date DATE, end_date DATE,
      goal TEXT DEFAULT '', status TEXT DEFAULT 'Ouvert', created_by BIGINT REFERENCES users(id) ON DELETE SET NULL
    );
    CREATE TABLE IF NOT EXISTS requests(
      id BIGSERIAL PRIMARY KEY, requester_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
      type TEXT NOT NULL, subject TEXT NOT NULL, body TEXT DEFAULT '', status TEXT DEFAULT 'En attente',
      response TEXT DEFAULT '', created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS notifications(
      id BIGSERIAL PRIMARY KEY, user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
      title TEXT NOT NULL, body TEXT DEFAULT '', read_at TIMESTAMPTZ, created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
  // Migrations for older V5 databases.
  for(const q of [
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS manager_id BIGINT REFERENCES users(id) ON DELETE SET NULL`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS inactivity_locked BOOLEAN NOT NULL DEFAULT FALSE`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS inactive_reason TEXT DEFAULT ''`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS tiktok TEXT DEFAULT ''`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS followers INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS diamonds INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS live_hours NUMERIC(10,2) NOT NULL DEFAULT 0`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS level TEXT DEFAULT 'Nouveau'`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS note TEXT DEFAULT ''`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS access_modules TEXT[] NOT NULL DEFAULT '{}'`,
    `ALTER TABLE matches ADD COLUMN IF NOT EXISTS creator_id BIGINT REFERENCES users(id) ON DELETE SET NULL`,
    `ALTER TABLE matches ADD COLUMN IF NOT EXISTS age_restriction TEXT DEFAULT 'Tous'`,
    `ALTER TABLE matches ADD COLUMN IF NOT EXISTS boost TEXT DEFAULT 'Sans boost'`
  ]) await pool.query(q);
  await pool.query(`UPDATE users SET role='Fondateur' WHERE role='Admin'`);
  await pool.query(`UPDATE users SET active=TRUE,inactivity_locked=FALSE,inactive_reason='' WHERE role IN ('Fondateur','Co-Fondateur')`);
  await pool.query(`UPDATE users SET access_modules=$1 WHERE access_modules IS NULL OR cardinality(access_modules)=0`, [DEFAULT_ACCESS]);
  const c=await pool.query("SELECT COUNT(*)::int count FROM users");
  if(!c.rows[0].count){
    for(const [name,code,role] of [["Fondateur","ADMIN-001","Fondateur"],["Créateur Démo","LDA-DEMO-101","Créateur"],["Manager Démo","LDA-DEMO-202","Manager"]])
      await pool.query("INSERT INTO users(name,code_hash,role) VALUES($1,$2,$3)",[name,hash(code),role]);
    await pool.query("UPDATE users SET tiktok='@liondemo',followers=12500,diamonds=72000,live_hours=88,level='Or' WHERE role='Créateur'");
  }
  const demoCreator=await pool.query("SELECT id FROM users WHERE role='Créateur' ORDER BY id LIMIT 1");
  if(demoCreator.rowCount){
    await pool.query(`INSERT INTO tiktok_stats(creator_id,stat_date,followers,views,likes,diamonds,live_hours)
      VALUES($1,CURRENT_DATE,12500,450000,38000,72000,8) ON CONFLICT DO NOTHING`,[demoCreator.rows[0].id]);
  }
}

const PgSession=connectPgSimple(session);
app.use(express.json({limit:"2mb"})); app.use(express.urlencoded({extended:true}));
app.use("/api", (req,res,next)=>{res.set("Cache-Control","no-store, no-cache, must-revalidate, proxy-revalidate"); res.set("Pragma","no-cache"); res.set("Expires","0"); next();});
app.use(session({store:new PgSession({pool,tableName:"user_sessions",createTableIfMissing:true}),secret:process.env.SESSION_SECRET||"CHANGE-ME",resave:false,saveUninitialized:false,rolling:true,cookie:{httpOnly:true,sameSite:"lax",secure:process.env.NODE_ENV==="production",maxAge:43200000}}));
app.use(express.static(path.join(__dirname,"public")));
app.use("/uploads", express.static(uploadDir));
const auth=(req,res,next)=>req.session.user?next():res.status(401).json({error:"Non connecté"});
const guard=min=>(req,res,next)=>can(req.session.user?.role,min)?next():res.status(403).json({error:"Accès insuffisant"});
const manager=guard(3), director=guard(4), founder=guard(6);
function hasModuleAccess(user,module){
  if(!user) return false;
  if(user.role==="Fondateur" || user.role==="Co-Fondateur") return true;
  return Array.isArray(user.access_modules) && user.access_modules.includes(module);
}
const requireModule = module => (req,res,next) => hasModuleAccess(req.session.user,module) ? next() : res.status(403).json({error:"Cette catégorie n'est pas autorisée pour votre compte."});
const upload = multer({
  storage: multer.diskStorage({
    destination: (_req,_file,cb)=>cb(null,uploadDir),
    filename: (_req,file,cb)=>cb(null, crypto.randomUUID()+"-"+path.basename(file.originalname).replace(/[^a-zA-Z0-9._-]/g,"_"))
  }),
  limits:{fileSize:1_000_000_000}
});
async function audit(req,action,details=""){await pool.query("INSERT INTO audit_logs(user_id,action,details) VALUES($1,$2,$3)",[req.session.user?.id||null,action,details]);}
async function notify(userId,title,body){ if(userId) await pool.query("INSERT INTO notifications(user_id,title,body) VALUES($1,$2,$3)",[userId,title,body]); }
function creatorScope(req){ const u=req.session.user; if(can(u.role,4)) return {sql:"",params:[]}; if(u.role==="Manager") return {sql:" AND (u.manager_id=$1 OR u.id=$1)",params:[u.id]}; if(u.role==="Créateur") return {sql:" AND u.id=$1",params:[u.id]}; return {sql:" AND u.id=$1",params:[u.id]}; }

app.post("/api/login",async(req,res,next)=>{try{
  const code=String(req.body.code||"").trim().toUpperCase();
  const r=await pool.query("SELECT id,name,role,active,inactivity_locked,inactive_reason,last_login_at,created_at,access_modules FROM users WHERE code_hash=$1 LIMIT 1",[hash(code)]);
  const user=r.rows[0];
  if(!user)return res.status(401).json({error:"Code agence invalide ou désactivé"});
  const referenceDate=user.last_login_at||user.created_at;
  const inactiveFor72h=!['Fondateur','Co-Fondateur'].includes(user.role) && referenceDate && (Date.now()-new Date(referenceDate).getTime()>=72*60*60*1000);
  if(inactiveFor72h && user.active){
    await pool.query("UPDATE users SET active=FALSE,inactivity_locked=TRUE,inactive_reason=$1 WHERE id=$2",["Connexion refusée après 72 h d'inactivité",user.id]);
    user.active=false; user.inactivity_locked=true; user.inactive_reason="Connexion refusée après 72 h d'inactivité";
  }
  if(!user.active){
    if(user.inactivity_locked){
      return res.status(423).json({error:"Connexion refusée après délai d'inactivité de 72 h.",inactive:true,inactivity_locked:true});
    }
    return res.status(401).json({error:"Code agence invalide ou désactivé"});
  }
  await new Promise((ok,no)=>req.session.regenerate(e=>e?no(e):ok()));
  await pool.query("UPDATE users SET last_login_at=NOW(), inactivity_locked=FALSE, inactive_reason='' WHERE id=$1",[user.id]);
  user.last_login_at=new Date().toISOString(); user.inactivity_locked=false; user.inactive_reason="";
  req.session.user={id:user.id,name:user.name,role:user.role,active:true,access_modules:user.access_modules?.length?user.access_modules:DEFAULT_ACCESS};
  await audit(req,"Connexion","Connexion réussie");
  await new Promise((ok,no)=>req.session.save(e=>e?no(e):ok()));
  res.json({user:req.session.user});
}catch(e){next(e)}});
app.post("/api/logout",(req,res)=>req.session.destroy(()=>{res.clearCookie("connect.sid");res.json({ok:true})}));
app.get("/api/me",async(req,res)=>{
  if(!req.session.user) return res.json({user:null});
  try{
    const r=await pool.query("SELECT id,name,role,active,access_modules FROM users WHERE id=$1",[req.session.user.id]);
    if(!r.rowCount) return res.json({user:null});
    req.session.user={...req.session.user,name:r.rows[0].name,role:r.rows[0].role,active:r.rows[0].active,access_modules:r.rows[0].access_modules?.length?r.rows[0].access_modules:DEFAULT_ACCESS};
    res.json({user:req.session.user});
  }catch(e){res.status(500).json({error:"Erreur serveur"})}
});

async function sweepInactiveUsers(){
  await pool.query(`UPDATE users SET active=FALSE,inactivity_locked=TRUE,inactive_reason='Connexion refusée après 72 h d'inactivité'
    WHERE active=TRUE AND role NOT IN ('Fondateur','Co-Fondateur') AND COALESCE(last_login_at,created_at) <= NOW() - INTERVAL '72 hours'`);
}
setInterval(()=>sweepInactiveUsers().catch(e=>console.error("Inactivity sweep",e)),15*60*1000);

app.get("/api/dashboard",auth,async(req,res,next)=>{try{const u=req.session.user;let where="",params=[];if(u.role==="Manager"){where=" AND manager_id=$1";params=[u.id]}else if(u.role==="Créateur"){where=" AND id=$1";params=[u.id]};const r=await pool.query(`SELECT COUNT(*) FILTER(WHERE role='Créateur' AND active)::int creators,COUNT(*) FILTER(WHERE active)::int users,COALESCE(SUM(live_hours) FILTER(WHERE role='Créateur'),0) hours,COALESCE(SUM(diamonds) FILTER(WHERE role='Créateur'),0)::int diamonds FROM users WHERE TRUE${where}`,params);const n=await pool.query("SELECT COUNT(*)::int count FROM notifications WHERE user_id=$1 AND read_at IS NULL",[u.id]);res.json({...r.rows[0],role:u.role,unread:n.rows[0].count});}catch(e){next(e)}});

app.get("/api/creator-options",auth,async(req,res,next)=>{try{
  const s=creatorScope(req);
  const r=await pool.query(`SELECT u.id,u.name FROM users u WHERE u.role='Créateur' AND u.active=TRUE${s.sql} ORDER BY u.name`,s.params);
  res.json({creators:r.rows});
}catch(e){next(e)}});
app.get("/api/creators",auth,requireModule("createurs"),async(req,res,next)=>{try{const s=creatorScope(req);const r=await pool.query(`SELECT u.id,u.name,u.tiktok,u.followers,u.diamonds,u.live_hours,u.level,u.note,u.active,u.manager_id,m.name manager_name,u.created_at FROM users u LEFT JOIN users m ON m.id=u.manager_id WHERE u.role='Créateur'${s.sql} ORDER BY u.diamonds DESC,u.id DESC`,s.params);res.set("Cache-Control","no-store"); res.json({creators:r.rows})}catch(e){next(e)}});
app.post("/api/creators",manager,async(req,res,next)=>{try{const name=String(req.body.name||"").trim();if(!name)return res.status(400).json({error:"Nom requis"});let code,result;const managerId=req.session.user.role==="Manager"?req.session.user.id:(req.body.manager_id?Number(req.body.manager_id):null);for(let i=0;i<10;i++){code=makeCode();try{result=await pool.query(`INSERT INTO users(name,code_hash,role,tiktok,followers,diamonds,live_hours,level,note,manager_id,access_modules) VALUES($1,$2,'Créateur',$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id,name,role,tiktok,followers,diamonds,live_hours,level,note,manager_id,active`,[name,hash(code),String(req.body.tiktok||""),Math.max(0,Number(req.body.followers)||0),Math.max(0,Number(req.body.diamonds)||0),Math.max(0,Number(req.body.live_hours)||0),String(req.body.level||"Nouveau"),String(req.body.note||""),managerId,DEFAULT_ACCESS]);break}catch(e){if(e.code!=="23505"||i===9)throw e}}await audit(req,"Création créateur",name);res.json({...result.rows[0],code})}catch(e){next(e)}});
app.patch("/api/creators/:id",manager,async(req,res,next)=>{try{const id=Number(req.params.id);if(req.session.user.role==="Manager"){const own=await pool.query("SELECT 1 FROM users WHERE id=$1 AND role='Créateur' AND manager_id=$2",[id,req.session.user.id]);if(!own.rowCount)return res.status(403).json({error:"Créateur hors de votre équipe"})}const r=await pool.query(`UPDATE users SET name=COALESCE($1,name),tiktok=COALESCE($2,tiktok),followers=COALESCE($3,followers),diamonds=COALESCE($4,diamonds),live_hours=COALESCE($5,live_hours),level=COALESCE($6,level),note=COALESCE($7,note),active=COALESCE($8,active),manager_id=COALESCE($9,manager_id) WHERE id=$10 AND role='Créateur' RETURNING id,name,tiktok,followers,diamonds,live_hours,level,note,active,manager_id`,[req.body.name||null,req.body.tiktok??null,req.body.followers==null?null:Number(req.body.followers),req.body.diamonds==null?null:Number(req.body.diamonds),req.body.live_hours==null?null:Number(req.body.live_hours),req.body.level||null,req.body.note??null,req.body.active==null?null:Boolean(req.body.active),req.body.manager_id==null?null:Number(req.body.manager_id),id]);if(!r.rowCount)return res.status(404).json({error:"Créateur introuvable"});await audit(req,"Modification créateur",String(id));res.json(r.rows[0])}catch(e){next(e)}});
app.delete("/api/creators/:id",guard(3),async(req,res,next)=>{
  const client=await pool.connect();
  try{
    const id=Number(req.params.id);
    if(!Number.isInteger(id)) return res.status(400).json({error:"Identifiant créateur invalide"});
    await client.query("BEGIN");
    const target=await client.query("SELECT id,name,role,manager_id FROM users WHERE id=$1 FOR UPDATE",[id]);
    if(!target.rowCount || target.rows[0].role!=="Créateur"){ await client.query("ROLLBACK"); return res.status(404).json({error:"Créateur introuvable"}); }
    if(req.session.user.role==="Manager" && target.rows[0].manager_id!==req.session.user.id){ await client.query("ROLLBACK"); return res.status(403).json({error:"Créateur hors de votre équipe"}); }
    const name=target.rows[0].name;
    await client.query("DELETE FROM tiktok_stats WHERE creator_id=$1",[id]);
    await client.query("DELETE FROM contracts WHERE creator_id=$1",[id]);
    await client.query("DELETE FROM requests WHERE requester_id=$1",[id]);
    await client.query("DELETE FROM notifications WHERE user_id=$1",[id]);
    await client.query("DELETE FROM messages WHERE recipient_id=$1",[id]);
    await client.query("UPDATE messages SET sender_id=NULL WHERE sender_id=$1",[id]);
    await client.query("DELETE FROM posters WHERE creator_id=$1",[id]);
    await client.query("UPDATE matches SET creator_id=NULL WHERE creator_id=$1",[id]);
    await client.query("DELETE FROM users WHERE id=$1 AND role='Créateur'",[id]);
    await client.query("COMMIT");
    await audit(req,"Suppression créateur",`${name} (${id})`);
    res.json({ok:true,id});
  }catch(e){ try{await client.query("ROLLBACK");}catch{} next(e); } finally{client.release();}
});

app.get("/api/rankings",auth,requireModule("classement"),async(req,res,next)=>{try{const s=creatorScope(req);const r=await pool.query(`SELECT id,name,tiktok,followers,diamonds,live_hours,level,active FROM users u WHERE role='Créateur'${s.sql} ORDER BY diamonds DESC,live_hours DESC`,s.params);res.json({rankings:r.rows})}catch(e){next(e)}});

app.get("/api/users",director,async(req,res,next)=>{try{const r=await pool.query("SELECT u.id,u.name,u.role,u.active,u.inactivity_locked,u.inactive_reason,u.last_login_at,u.manager_id,u.access_modules,m.name manager_name,u.created_at FROM users u LEFT JOIN users m ON m.id=u.manager_id ORDER BY u.id DESC");res.set("Cache-Control","no-store"); res.json({users:r.rows})}catch(e){next(e)}});
app.post("/api/users",director,async(req,res,next)=>{try{const name=String(req.body.name||"").trim();const role=ROLES.includes(req.body.role)?req.body.role:"Créateur";if(!name)return res.status(400).json({error:"Nom requis"});if((ROLE_LEVEL[req.session.user.role]||0)<=ROLE_LEVEL[role] && !(req.session.user.role==="Fondateur" && role==="Fondateur"))return res.status(403).json({error:"Vous ne pouvez pas créer ce niveau de rôle"});let code,result;for(let i=0;i<10;i++){code=makeCode();try{result=await pool.query("INSERT INTO users(name,code_hash,role,manager_id,access_modules) VALUES($1,$2,$3,$4,$5) RETURNING id,name,role,active,manager_id",[name,hash(code),role,req.body.manager_id?Number(req.body.manager_id):null,DEFAULT_ACCESS]);break}catch(e){if(e.code!=="23505"||i===9)throw e}}await audit(req,"Création compte",`${name} (${role})`);res.json({...result.rows[0],code})}catch(e){next(e)}});
app.get("/api/access/:id",director,async(req,res,next)=>{
  try{
    const r=await pool.query("SELECT id,name,role,access_modules FROM users WHERE id=$1",[Number(req.params.id)]);
    if(!r.rowCount)return res.status(404).json({error:"Utilisateur introuvable"});
    res.json({user:{...r.rows[0],access_modules:r.rows[0].access_modules?.length?r.rows[0].access_modules:DEFAULT_ACCESS},categories:ACCESS_CATEGORIES});
  }catch(e){next(e)}
});
app.put("/api/access/:id",guard(5),async(req,res,next)=>{
  try{
    const id=Number(req.params.id);
    const target=await pool.query("SELECT id,name,role FROM users WHERE id=$1",[id]);
    if(!target.rowCount)return res.status(404).json({error:"Utilisateur introuvable"});
    if(id===req.session.user.id)return res.status(400).json({error:"Vous ne pouvez pas modifier vos propres catégories ici."});
    if((ROLE_LEVEL[target.rows[0].role]||0)>=ROLE_LEVEL[req.session.user.role])return res.status(403).json({error:"Niveau protégé"});
    const allowed=new Set(DEFAULT_ACCESS);
    const access=Array.isArray(req.body.access_modules)?req.body.access_modules.filter(x=>allowed.has(x)):DEFAULT_ACCESS;
    const r=await pool.query("UPDATE users SET access_modules=$1 WHERE id=$2 RETURNING id,name,role,access_modules",[access,id]);
    await audit(req,"Modification des catégories d'accès",`${r.rows[0].name} (${r.rows[0].role})`);
    res.json(r.rows[0]);
  }catch(e){next(e)}
});

app.get("/api/inactive-users",guard(2),async(req,res,next)=>{try{
  await sweepInactiveUsers();
  const r=await pool.query("SELECT id,name,role,inactive_reason,last_login_at,created_at FROM users WHERE active=FALSE AND inactivity_locked=TRUE ORDER BY id DESC");
  res.json({users:r.rows});
}catch(e){next(e)}});
app.post("/api/users/:id/reactivate",guard(2),async(req,res,next)=>{try{
  const id=Number(req.params.id);
  if(id===req.session.user.id)return res.status(400).json({error:"Vous ne pouvez pas réactiver votre propre accès depuis cette fonction."});
  if(req.session.user.role==="Créateur")return res.status(403).json({error:"Les créateurs ne peuvent pas réactiver un accès."});
  const target=await pool.query("SELECT id,name,role,active,inactivity_locked FROM users WHERE id=$1",[id]);
  if(!target.rowCount)return res.status(404).json({error:"Utilisateur introuvable"});
  if(!target.rows[0].inactivity_locked)return res.status(400).json({error:"Ce compte n'est pas bloqué pour inactivité."});
  const r=await pool.query("UPDATE users SET active=TRUE,inactivity_locked=FALSE,inactive_reason='',last_login_at=NOW() WHERE id=$1 RETURNING id,name,role,active,last_login_at",[id]);
  await audit(req,"Réactivation après inactivité",`${r.rows[0].name} (${r.rows[0].role})`);
  await notify(id,"Accès réactivé","Votre accès Lion Dynasty Agency a été réactivé après le blocage de 72 h d'inactivité.");
  res.json(r.rows[0]);
}catch(e){next(e)}});

app.patch("/api/users/:id",director,async(req,res,next)=>{try{
  const id=Number(req.params.id);
  const target=await pool.query("SELECT id,role FROM users WHERE id=$1",[id]);
  if(!target.rowCount)return res.status(404).json({error:"Utilisateur introuvable"});
  if(id===req.session.user.id)return res.status(400).json({error:"Vous ne pouvez pas modifier votre propre compte ici"});
  if((ROLE_LEVEL[target.rows[0].role]||0)>=ROLE_LEVEL[req.session.user.role])return res.status(403).json({error:"Niveau protégé"});
  const requestedRole=req.body.role;
  if(requestedRole && !ROLES.includes(requestedRole))return res.status(400).json({error:"Rôle invalide"});
  if(requestedRole && ((ROLE_LEVEL[requestedRole]||0)>=ROLE_LEVEL[req.session.user.role]) && req.session.user.role!=="Fondateur")
    return res.status(403).json({error:"Vous ne pouvez pas attribuer ce niveau de rôle"});
  const role=requestedRole||null;
  const r=await pool.query(
    "UPDATE users SET name=COALESCE(NULLIF($1,''),name),active=COALESCE($2,active),role=COALESCE($3,role),manager_id=$4,inactivity_locked=CASE WHEN COALESCE($3,role) IN ('Fondateur','Co-Fondateur') THEN FALSE ELSE inactivity_locked END,inactive_reason=CASE WHEN COALESCE($3,role) IN ('Fondateur','Co-Fondateur') THEN '' ELSE inactive_reason END WHERE id=$5 RETURNING id,name,role,active,manager_id",
    [req.body.name,req.body.active==null?null:Boolean(req.body.active),role,req.body.manager_id?Number(req.body.manager_id):null,id]
  );
  await audit(req,"Modification utilisateur",String(id));res.json(r.rows[0]);
}catch(e){next(e)}});
app.delete("/api/users/:id",director,async(req,res,next)=>{
  const client=await pool.connect();
  try{
    const id=Number(req.params.id);
    if(id===req.session.user.id)return res.status(400).json({error:"Vous ne pouvez pas supprimer votre propre compte."});
    await client.query("BEGIN");
    const target=await client.query("SELECT id,name,role FROM users WHERE id=$1 FOR UPDATE",[id]);
    if(!target.rowCount){await client.query("ROLLBACK");return res.status(404).json({error:"Utilisateur introuvable"});}
    const role=target.rows[0].role;
    if((ROLE_LEVEL[role]||0)>=(ROLE_LEVEL[req.session.user.role]||0)){await client.query("ROLLBACK");return res.status(403).json({error:"Niveau protégé"});}
    if(role==="Créateur"){
      await client.query("DELETE FROM tiktok_stats WHERE creator_id=$1",[id]);
      await client.query("DELETE FROM contracts WHERE creator_id=$1",[id]);
      await client.query("DELETE FROM requests WHERE requester_id=$1",[id]);
      await client.query("DELETE FROM notifications WHERE user_id=$1",[id]);
      await client.query("DELETE FROM messages WHERE recipient_id=$1",[id]);
      await client.query("UPDATE messages SET sender_id=NULL WHERE sender_id=$1",[id]);
      await client.query("DELETE FROM posters WHERE creator_id=$1",[id]);
      await client.query("UPDATE matches SET creator_id=NULL WHERE creator_id=$1",[id]);
    } else {
      await client.query("DELETE FROM notifications WHERE user_id=$1",[id]);
      await client.query("DELETE FROM messages WHERE recipient_id=$1",[id]);
      await client.query("UPDATE messages SET sender_id=NULL WHERE sender_id=$1",[id]);
      await client.query("UPDATE users SET manager_id=NULL WHERE manager_id=$1",[id]);
    }
    await client.query("DELETE FROM users WHERE id=$1",[id]);
    await client.query("COMMIT");
    await audit(req,"Suppression utilisateur",`${target.rows[0].name} (${role})`);
    res.json({ok:true,id});
  }catch(e){try{await client.query("ROLLBACK")}catch{};next(e)}finally{client.release();}
});
app.post("/api/users/:id/regenerate",director,async(req,res,next)=>{try{const id=Number(req.params.id);const target=await pool.query("SELECT role FROM users WHERE id=$1",[id]);if(!target.rowCount)return res.status(404).json({error:"Utilisateur introuvable"});if(id===req.session.user.id||ROLE_LEVEL[target.rows[0].role]>=ROLE_LEVEL[req.session.user.role])return res.status(403).json({error:"Action interdite"});const code=makeCode();await pool.query("UPDATE users SET code_hash=$1 WHERE id=$2",[hash(code),id]);await audit(req,"Nouveau code",String(id));res.json({code})}catch(e){next(e)}});

app.get("/api/tiktok/stats",auth,requireModule("stats"),async(req,res,next)=>{try{
  const s=creatorScope(req);
  const r=await pool.query(`SELECT t.*,u.name,
    CASE WHEN $1='Fondateur' THEN FALSE
         WHEN t.updated_at > NOW() - INTERVAL '24 hours' THEN TRUE ELSE FALSE END AS locked,
    CASE WHEN $1='Fondateur' THEN NULL
         WHEN t.updated_at > NOW() - INTERVAL '24 hours' THEN t.updated_at + INTERVAL '24 hours'
         ELSE NULL END AS unlock_at
    FROM tiktok_stats t JOIN users u ON u.id=t.creator_id
    WHERE 1=1 AND u.role='Créateur'${s.sql.replaceAll("u.","u.")}
    ORDER BY t.stat_date DESC,t.id DESC LIMIT 300`,[req.session.user.role,...s.params]);
  res.json({stats:r.rows});
}catch(e){next(e)}});
app.post("/api/tiktok/stats",manager,requireModule("stats"),async(req,res,next)=>{try{
  const cid=Number(req.body.creator_id);
  const statDate=req.body.stat_date||new Date().toISOString().slice(0,10);
  if(req.session.user.role==="Manager"){
    const x=await pool.query("SELECT 1 FROM users WHERE id=$1 AND manager_id=$2",[cid,req.session.user.id]);
    if(!x.rowCount)return res.status(403).json({error:"Créateur hors équipe"});
  }
  // Protection anti-modification pendant 24h : seul le Fondateur peut modifier
  // une saisie existante avant l'expiration du délai.
  const existing=await pool.query("SELECT updated_at FROM tiktok_stats WHERE creator_id=$1 AND stat_date=$2",[cid,statDate]);
  if(existing.rowCount && req.session.user.role!=="Fondateur"){
    const updatedAt=new Date(existing.rows[0].updated_at);
    const unlockAt=new Date(updatedAt.getTime()+24*60*60*1000);
    if(Date.now()<unlockAt.getTime()){
      const remainingMs=unlockAt.getTime()-Date.now();
      const remainingHours=Math.ceil(remainingMs/(60*60*1000));
      return res.status(409).json({
        error:`Cette statistique a été saisie/modifiée récemment. Nouvelle modification possible dans ${remainingHours} h.`,
        locked:true,
        unlock_at:unlockAt.toISOString()
      });
    }
  }
  const r=await pool.query(`INSERT INTO tiktok_stats(creator_id,stat_date,followers,views,likes,diamonds,live_hours,updated_at)
    VALUES($1,$2,$3,$4,$5,$6,$7,NOW())
    ON CONFLICT(creator_id,stat_date) DO UPDATE SET
      followers=EXCLUDED.followers,views=EXCLUDED.views,likes=EXCLUDED.likes,
      diamonds=EXCLUDED.diamonds,live_hours=EXCLUDED.live_hours,updated_at=NOW()
    RETURNING *`,
    [cid,statDate,Number(req.body.followers)||0,Number(req.body.views)||0,Number(req.body.likes)||0,Number(req.body.diamonds)||0,Number(req.body.live_hours)||0]);
  await pool.query(`UPDATE users SET followers=$1,diamonds=$2,live_hours=$3 WHERE id=$4`,
    [Number(req.body.followers)||0,Number(req.body.diamonds)||0,Number(req.body.live_hours)||0,cid]);
  await audit(req,"Statistiques TikTok",String(cid));
  res.json(r.rows[0]);
}catch(e){next(e)}});

app.get("/api/contracts",auth,requireModule("contrats"),async(req,res,next)=>{try{let q=`SELECT c.*,u.name creator_name FROM contracts c LEFT JOIN users u ON u.id=c.creator_id`;let p=[];if(req.session.user.role==="Créateur"){q+=" WHERE c.creator_id=$1";p=[req.session.user.id]}else if(req.session.user.role==="Manager"){q+=" WHERE u.manager_id=$1";p=[req.session.user.id]}q+=" ORDER BY c.id DESC";res.json({contracts:(await pool.query(q,p)).rows})}catch(e){next(e)}});
app.post("/api/contracts",manager,requireModule("contrats"),async(req,res,next)=>{try{const r=await pool.query(`INSERT INTO contracts(creator_id,title,status,start_date,end_date,notes,created_by) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *`,[Number(req.body.creator_id),String(req.body.title||"Contrat"),String(req.body.status||"Brouillon"),req.body.start_date||null,req.body.end_date||null,String(req.body.notes||""),req.session.user.id]);await audit(req,"Création contrat",r.rows[0].title);await notify(Number(req.body.creator_id),"Nouveau contrat",r.rows[0].title);res.json(r.rows[0])}catch(e){next(e)}});
app.patch("/api/contracts/:id",manager,async(req,res,next)=>{try{const r=await pool.query(`UPDATE contracts SET title=COALESCE($1,title),status=COALESCE($2,status),start_date=COALESCE($3,start_date),end_date=COALESCE($4,end_date),notes=COALESCE($5,notes) WHERE id=$6 RETURNING *`,[req.body.title||null,req.body.status||null,req.body.start_date||null,req.body.end_date||null,req.body.notes??null,Number(req.params.id)]);res.json(r.rows[0]||{})}catch(e){next(e)}});

app.get("/api/documents",auth,requireModule("documents"),async(req,res,next)=>{try{const r=await pool.query(`SELECT d.*,u.name creator_name FROM documents d LEFT JOIN users u ON u.id=d.created_by WHERE d.visibility='Tous' OR d.visibility=$1 OR d.visibility='Direction' AND $2 >= 4 ORDER BY d.id DESC`,[req.session.user.role,ROLE_LEVEL[req.session.user.role]||0]);res.json({documents:r.rows})}catch(e){next(e)}});
app.post("/api/documents",director,requireModule("documents"),async(req,res,next)=>{try{const r=await pool.query("INSERT INTO documents(title,category,url,content,visibility,created_by) VALUES($1,$2,$3,$4,$5,$6) RETURNING *",[String(req.body.title||"Document"),String(req.body.category||"Agence"),String(req.body.url||""),String(req.body.content||""),String(req.body.visibility||"Tous"),req.session.user.id]);await audit(req,"Ajout document",r.rows[0].title);res.json(r.rows[0])}catch(e){next(e)}});
app.delete("/api/documents/:id",director,async(req,res,next)=>{try{await pool.query("DELETE FROM documents WHERE id=$1",[Number(req.params.id)]);res.json({ok:true})}catch(e){next(e)}});

app.get("/api/contacts",auth,async(req,res,next)=>{try{
  const r=await pool.query("SELECT id,name,role FROM users WHERE active=TRUE AND id<>$1 ORDER BY name",[req.session.user.id]);
  res.json({contacts:r.rows});
}catch(e){next(e)}});
app.get("/api/messages",auth,requireModule("messages"),async(req,res,next)=>{try{await pool.query("UPDATE messages SET read_at=NOW() WHERE recipient_id=$1 AND read_at IS NULL",[req.session.user.id]);const r=await pool.query(`SELECT m.*,s.name sender_name,u.name recipient_name FROM messages m LEFT JOIN users s ON s.id=m.sender_id LEFT JOIN users u ON u.id=m.recipient_id WHERE m.sender_id=$1 OR m.recipient_id=$1 ORDER BY m.id DESC`,[req.session.user.id]);res.json({messages:r.rows})}catch(e){next(e)}});
app.post("/api/messages",auth,requireModule("messages"),async(req,res,next)=>{try{const to=Number(req.body.recipient_id);const target=await pool.query("SELECT id FROM users WHERE id=$1 AND active=TRUE",[to]);if(!target.rowCount)return res.status(400).json({error:"Destinataire invalide"});const r=await pool.query("INSERT INTO messages(sender_id,recipient_id,subject,body) VALUES($1,$2,$3,$4) RETURNING *",[req.session.user.id,to,String(req.body.subject||"Message"),String(req.body.body||"")]);await notify(to,"Nouveau message",String(req.body.subject||"Message"));broadcastChat();res.json(r.rows[0])}catch(e){next(e)}});
app.patch("/api/messages/:id/read",auth,requireModule("messages"),async(req,res,next)=>{try{await pool.query("UPDATE messages SET read_at=NOW() WHERE id=$1 AND recipient_id=$2",[Number(req.params.id),req.session.user.id]);res.json({ok:true})}catch(e){next(e)}});

app.get("/api/matches",auth,requireModule("matchs"),async(req,res,next)=>{try{const r=await pool.query("SELECT m.*,u.name creator_name FROM matches m LEFT JOIN users u ON u.id=m.creator_id ORDER BY m.match_date NULLS LAST,m.id DESC");res.json({matches:r.rows})}catch(e){next(e)}});
app.post("/api/matches",manager,requireModule("matchs"),async(req,res,next)=>{try{
  const cid=Number(req.body.creator_id);
  const exists=await pool.query("SELECT id,name FROM users WHERE id=$1 AND role='Créateur' AND active=TRUE",[cid]);
  if(!exists.rowCount)return res.status(400).json({error:"Créateur invalide"});
  const r=await pool.query("INSERT INTO matches(title,creator_id,opponent,match_date,status,result,notes,age_restriction,boost,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *",
    [`Match — ${exists.rows[0].name}`,cid,String(req.body.opponent||""),req.body.match_date||null,String(req.body.status||"Planifié"),String(req.body.result||""),String(req.body.notes||""),String(req.body.age_restriction||"Tous"),String(req.body.boost||"Sans boost"),req.session.user.id]);
  await audit(req,"Création match",`Créateur ${cid}`);
  res.json(r.rows[0]);
}catch(e){next(e)}});
app.patch("/api/matches/:id",manager,requireModule("matchs"),async(req,res,next)=>{try{
  const r=await pool.query("UPDATE matches SET creator_id=COALESCE($1,creator_id),opponent=COALESCE($2,opponent),match_date=COALESCE($3,match_date),status=COALESCE($4,status),result=COALESCE($5,result),notes=COALESCE($6,notes),age_restriction=COALESCE($7,age_restriction),boost=COALESCE($8,boost) WHERE id=$9 RETURNING *",
  [req.body.creator_id?Number(req.body.creator_id):null,req.body.opponent||null,req.body.match_date||null,req.body.status||null,req.body.result||null,req.body.notes??null,req.body.age_restriction||null,req.body.boost||null,Number(req.params.id)]);
  res.json(r.rows[0]||{});
}catch(e){next(e)}});

app.get("/api/posters",auth,requireModule("posters"),async(req,res,next)=>{try{
  const r=await pool.query(`SELECT p.*,u.name creator_name FROM posters p LEFT JOIN users u ON u.id=p.creator_id ORDER BY p.id DESC`);
  res.json({posters:r.rows});
}catch(e){next(e)}});
app.post("/api/posters",manager,requireModule("posters"),upload.single("image"),async(req,res,next)=>{
  try{
    if(!req.file)return res.status(400).json({error:"Image obligatoire"});
    const cid=Number(req.body.creator_id);
    const c=await pool.query("SELECT id,name FROM users WHERE id=$1 AND role='Créateur'",[cid]);
    if(!c.rowCount){fs.unlink(req.file.path,()=>{});return res.status(400).json({error:"Créateur invalide"});}
    const r=await pool.query(`INSERT INTO posters(creator_id,original_name,stored_name,mime_type,size_bytes,url,uploaded_by)
      VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [cid,req.file.originalname,req.file.filename,req.file.mimetype,req.file.size,"/uploads/"+req.file.filename,req.session.user.id]);
    await audit(req,"Ajout match poster",`${c.rows[0].name} — ${req.file.originalname}`);
    res.json(r.rows[0]);
  }catch(e){if(req.file)fs.unlink(req.file.path,()=>{});next(e)}
});
app.delete("/api/posters/:id",director,requireModule("posters"),async(req,res,next)=>{
  try{
    const r=await pool.query("SELECT stored_name FROM posters WHERE id=$1",[Number(req.params.id)]);
    if(!r.rowCount)return res.status(404).json({error:"Poster introuvable"});
    await pool.query("DELETE FROM posters WHERE id=$1",[Number(req.params.id)]);
    fs.unlink(path.join(uploadDir,r.rows[0].stored_name),()=>{});
    res.json({ok:true});
  }catch(e){next(e)}
});
app.get("/api/challenges",auth,async(req,res,next)=>{try{res.json({challenges:(await pool.query("SELECT * FROM challenges ORDER BY id DESC")).rows})}catch(e){next(e)}});
app.post("/api/challenges",manager,async(req,res,next)=>{try{const r=await pool.query("INSERT INTO challenges(title,description,start_date,end_date,goal,status,created_by) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *",[String(req.body.title||"Challenge"),String(req.body.description||""),req.body.start_date||null,req.body.end_date||null,String(req.body.goal||""),String(req.body.status||"Ouvert"),req.session.user.id]);res.json(r.rows[0])}catch(e){next(e)}});

app.get("/api/requests",auth,requireModule("demandes"),async(req,res,next)=>{try{let q="SELECT r.*,u.name requester_name FROM requests r LEFT JOIN users u ON u.id=r.requester_id";let p=[];if((ROLE_LEVEL[req.session.user.role]||0)<3){q+=" WHERE r.requester_id=$1";p=[req.session.user.id]}q+=" ORDER BY r.id DESC";res.json({requests:(await pool.query(q,p)).rows})}catch(e){next(e)}});
app.post("/api/requests",auth,requireModule("demandes"),async(req,res,next)=>{try{const r=await pool.query("INSERT INTO requests(requester_id,type,subject,body) VALUES($1,$2,$3,$4) RETURNING *",[req.session.user.id,String(req.body.type||"Autre"),String(req.body.subject||"Demande"),String(req.body.body||"")]);await audit(req,"Nouvelle demande",r.rows[0].subject);res.json(r.rows[0])}catch(e){next(e)}});
app.patch("/api/requests/:id",manager,requireModule("demandes"),async(req,res,next)=>{try{const r=await pool.query("UPDATE requests SET status=COALESCE($1,status),response=COALESCE($2,response),updated_at=NOW() WHERE id=$3 RETURNING *",[req.body.status||null,req.body.response??null,Number(req.params.id)]);if(r.rowCount)await notify(r.rows[0].requester_id,"Demande mise à jour",`${r.rows[0].subject} — ${r.rows[0].status}`);res.json(r.rows[0]||{})}catch(e){next(e)}});

app.get("/api/notifications",auth,requireModule("notifications"),async(req,res,next)=>{try{res.json({notifications:(await pool.query("SELECT * FROM notifications WHERE user_id=$1 ORDER BY id DESC LIMIT 100",[req.session.user.id])).rows})}catch(e){next(e)}});
app.patch("/api/notifications/read-all",auth,requireModule("notifications"),async(req,res,next)=>{try{await pool.query("UPDATE notifications SET read_at=NOW() WHERE user_id=$1 AND read_at IS NULL",[req.session.user.id]);res.json({ok:true})}catch(e){next(e)}});
app.get("/api/audit",director,async(req,res,next)=>{try{const r=await pool.query(`SELECT a.id,a.action,a.details,a.created_at,u.name FROM audit_logs a LEFT JOIN users u ON u.id=a.user_id ORDER BY a.id DESC LIMIT 300`);res.json({logs:r.rows})}catch(e){next(e)}});

app.get("/api/module/:module",auth,async(req,res,next)=>{if(!hasModuleAccess(req.session.user,req.params.module))return res.status(403).json({error:"Catégorie non autorisée"});try{if(!modules.includes(req.params.module))return res.status(404).json({error:"Module inconnu"});const r=await pool.query("SELECT id,module,title,content,status,created_at FROM module_items WHERE module=$1 ORDER BY id DESC",[req.params.module]);res.json({items:r.rows})}catch(e){next(e)}});
app.post("/api/module/:module",manager,async(req,res,next)=>{if(!hasModuleAccess(req.session.user,req.params.module))return res.status(403).json({error:"Catégorie non autorisée"});try{if(!modules.includes(req.params.module))return res.status(404).json({error:"Module inconnu"});const r=await pool.query("INSERT INTO module_items(module,title,content,status,created_by) VALUES($1,$2,$3,$4,$5) RETURNING *",[req.params.module,String(req.body.title||"Sans titre"),String(req.body.content||""),String(req.body.status||"Actif"),req.session.user.id]);res.json(r.rows[0])}catch(e){next(e)}});
app.delete("/api/module/:module/:id",manager,async(req,res,next)=>{if(!hasModuleAccess(req.session.user,req.params.module))return res.status(403).json({error:"Catégorie non autorisée"});try{await pool.query("DELETE FROM module_items WHERE module=$1 AND id=$2",[req.params.module,Number(req.params.id)]);res.json({ok:true})}catch(e){next(e)}});

app.get("/health",async(req,res)=>{try{await pool.query("SELECT 1");res.json({ok:true,service:"lion-dynasty-agency",version:"8.0",database:"postgresql"})}catch{res.status(503).json({ok:false})}});
app.use((err,req,res,next)=>{
  console.error(err);
  if(res.headersSent)return next(err);
  if(err?.code==="LIMIT_FILE_SIZE") return res.status(413).json({error:"Fichier trop volumineux. Maximum 1000 Mo."});
  res.status(500).json({error:"Erreur serveur"});
});
app.get(/.*/, (req,res)=>res.sendFile(path.join(__dirname,"public","index.html")));
const port=Number(process.env.PORT||3000);
initDb().then(()=>httpServer.listen(port,()=>console.log(`Lion Dynasty Agency V8 running on port ${port}`))).catch(e=>{console.error(e);process.exit(1)});
