const $=s=>document.querySelector(s);
const esc=s=>String(s??"").replace(/[&<>\"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[m]));
const roleLevel={Fondateur:6,"Co-Fondateur":5,Directeur:4,Manager:3,Ambassadeur:2,Créateur:1};
let me=null;
async function api(url,opt={}){const isForm=opt.body instanceof FormData;const headers=isForm?{...(opt.headers||{})}:{"Content-Type":"application/json",...(opt.headers||{})};const r=await fetch(url,{cache:"no-store",...opt,headers});let d={};try{d=await r.json()}catch{}if(!r.ok){const e=new Error(d.error||"Erreur");Object.assign(e,d,{status:r.status});throw e}return d}
function toast(msg){let x=document.createElement("div");x.className="toast";x.textContent=msg;document.body.append(x);setTimeout(()=>x.remove(),2800)}
const baseMenu=[
 ["dashboard","⌂","Tableau de bord",1], ["classement","♛","Classement",1], ["createurs","♙","Créateurs",1], ["danger","⚠","Créateurs en danger",3],
 ["tiktok","♪","Profils TikTok",1], ["reglements","▶","Règlements TikTok",1], ["partenariats","★","Partenariats",1],
 ["matchs","⚔","Matchs officiels",1], ["posters","▣","Match posters",1], ["coloriages","✎","Coloriages",1], ["invitation","↗","Lien invitation agence",1], ["avertissements","△","Avertissements",3],
 ["contrats","▤","Contrats",1], ["stats","◈","Statistiques TikTok",1], ["documents","▥","Documents",1],
 ["demandes","◇","Demandes",1], ["messages","✉","Messages",1], ["reunions","◉","Réunions vidéo",1],
 ["notifications","●","Notifications",1], ["reactivation","↻","Réactivation des accès",2], ["securite","⌁","Sécurité",4], ["admin","⚙","Administration",3]
];
const labels=Object.fromEntries(baseMenu.map(x=>[x[0],x[2]]));
function menuForRole(){
  return baseMenu.filter(x=>(roleLevel[me.role]>=x[3]) && (["Fondateur","Co-Fondateur","Directeur","Manager"].includes(me.role)||!Array.isArray(me.access_modules)||me.access_modules.includes(x[0])));
}
let chatTimer=null;
let chatSocket=null;
let deferredInstallPrompt=null;
let dailyCallFrame=null;
window.addEventListener("beforeinstallprompt",e=>{e.preventDefault();deferredInstallPrompt=e;document.querySelectorAll("#installApp").forEach(b=>b.hidden=false)});
window.addEventListener("appinstalled",()=>{deferredInstallPrompt=null;document.querySelectorAll("#installApp").forEach(b=>b.hidden=true);toast("Application Lion Dynasty installée");});
function setupInstallButton(){
  const b=$("#installApp"); if(!b)return;
  const standalone=window.matchMedia("(display-mode: standalone)").matches||window.navigator.standalone===true;
  b.hidden=standalone||!deferredInstallPrompt;
  b.onclick=async()=>{
    if(deferredInstallPrompt){
      const p=deferredInstallPrompt; deferredInstallPrompt=null;
      try{const r=await p.prompt(); if(r?.outcome!=="accepted")deferredInstallPrompt=p;}catch{}
      b.hidden=true; return;
    }
    if(/iphone|ipad|ipod/i.test(navigator.userAgent)){toast("Sur iPhone/iPad : Partager → Sur l’écran d’accueil");}
    else if(/android/i.test(navigator.userAgent)){toast("Dans Chrome : menu ⋮ → Installer l’application");}
    else{toast("Utilisez l’icône d'installation de votre navigateur");}
  };
}
function shell(content,active){if(dailyCallFrame){try{dailyCallFrame.destroy()}catch{} dailyCallFrame=null} if(chatTimer){clearInterval(chatTimer);chatTimer=null} if(chatSocket){try{chatSocket.close()}catch{} chatSocket=null}document.querySelector("#app").innerHTML=`<div class="layout"><aside><div class="brand"><div class="logo">L</div><div><b>LION DYNASTY</b><small>AGENCY</small></div></div><nav>${menuForRole().map(x=>`<button class="nav ${active===x[0]?"active":""}" data-page="${x[0]}"><span>${x[1]}</span>${x[2]}${x[0]==="notifications"?`<i id="notifBadge"></i>`:""}</button>`).join("")}</nav></aside><main><header>
  <div class="topbar-left">
    <button class="mobile-menu" id="mobileMenu" aria-label="Menu">☰</button>
    <div class="top-search"><span>⌕</span><input id="globalSearch" placeholder="Rechercher dans l'agence..." autocomplete="off"></div>
  </div>
  <div class="header-actions">
    <button class="iconbtn" id="installApp" title="Installer l'application" hidden>⬇ Installer</button>
    <button class="iconbtn" id="refresh" title="Actualiser">↻</button>
    <div class="profile-chip"><div class="avatar">${esc((me.name||"L").slice(0,1).toUpperCase())}</div><div><b>${esc(me.name)}</b><small>${esc(me.role)}</small></div></div>
    <button class="logout" id="logout">Déconnexion</button>
  </div>
</header><section class="content">${content}</section></main></div>`;document.querySelectorAll("[data-page]").forEach(b=>b.onclick=()=>page(b.dataset.page));
  $("#mobileMenu")?.addEventListener("click",()=>document.querySelector("aside")?.classList.toggle("open"));
  document.querySelectorAll("aside .nav").forEach(b=>b.addEventListener("click",()=>document.querySelector("aside")?.classList.remove("open")));
  $("#globalSearch")?.addEventListener("keydown",e=>{if(e.key==="Enter" && e.target.value.trim()){toast("Recherche globale : "+e.target.value.trim())}});
  $("#logout").onclick=async()=>{await api("/api/logout",{method:"POST"});me=null;login()};$("#refresh").onclick=()=>page(active);setupInstallButton();loadBadge();$("#copyInvite")?.addEventListener("click",async()=>{try{await navigator.clipboard.writeText("https://www.tiktok.com/t/ZSXVYGTVJ/");toast("Lien d’invitation copié")}catch{toast("Impossible de copier automatiquement le lien")}})}
function login(err=""){document.querySelector("#app").innerHTML=`<div class="login"><div class="login-card"><div class="logo big">L</div><div class="eyebrow">LION DYNASTY AGENCY</div><h1>Accès agence</h1><p class="muted">Entre ton code agence personnel.</p><input id="code" class="login-input" placeholder="CODE AGENCE" autofocus><button class="btn wide" id="go">Se connecter</button>${err?`<div class="error">${esc(err)}</div>`:""}<div class="login-foot">Accès sécurisé · Lion Dynasty Agency</div></div></div>`;$("#go").onclick=doLogin;$("#code").onkeydown=e=>{if(e.key==="Enter")doLogin()}}
async function doLogin(){try{const d=await api("/api/login",{method:"POST",body:JSON.stringify({code:$("#code").value})});me=d.user;page("dashboard")}catch(e){
  if(e.status===423||e.inactive){inactivePopup();return}
  toast(e.message)
}}
function inactivePopup(){
  const b=modal(`<div class="modal inactivity-modal"><div class="eyebrow">SÉCURITÉ DU COMPTE</div><h2>Connexion refusée</h2><p>Connexion refusée après délai d'inactivité de <b>72 h</b>.</p><p class="muted">Votre accès a été automatiquement suspendu. Un membre de l'agence ayant un rôle différent de Créateur doit réactiver votre accès.</p><button class="btn" id="inactiveOk">Fermer</button></div>`);
  $("#inactiveOk").onclick=()=>b.remove();
}
async function loadBadge(){try{const d=await api("/api/dashboard");const b=$("#notifBadge");if(b&&d.unread)b.textContent=d.unread}catch{}}
function head(ey,title,sub,button=""){return `<div class="eyebrow">${ey}</div><div class="head"><div><h1>${title}</h1><div class="muted">${sub}</div></div>${button}</div>`}
async function reunions(){
  const d=await api("/api/reunions");
  const canCreate=roleLevel[me.role]>=3;
  const setup=!d.configured?`<div class="panel daily-setup"><div class="eyebrow">CONFIGURATION DAILY</div><h2>Réunions vidéo prêtes à être activées</h2><p class="muted">Ajoutez la variable <b>DAILY_API_KEY</b> dans Render pour activer la création et l'accès aux salles privées.</p><p class="muted">La clé Daily reste uniquement sur le serveur et n'est jamais envoyée au navigateur.</p></div>`:"";
  return head("VISIO", "Réunions vidéo", "Visioconférences intégrées à Lion Dynasty avec Daily.",canCreate?`<button class="btn" id="addMeeting">+ Nouvelle réunion</button>`:"")+setup+`<div class="panel meeting-panel"><div class="eyebrow">DAILY VIDEO</div><h2>Vos réunions</h2><div class="meeting-list">${d.meetings.length?d.meetings.map(m=>`<div class="meeting-card"><div><b>${esc(m.title)}</b><div class="muted">${m.scheduled_at?new Date(m.scheduled_at).toLocaleString("fr-FR"):"Sans horaire"} · créée par ${esc(m.creator_name||"Agence")}</div><small class="muted">Salle privée Daily</small></div><div class="meeting-actions"><button class="btn join-meeting" data-id="${m.id}">Rejoindre</button>${canCreate?`<button class="btn danger-btn delete-meeting" data-id="${m.id}">Supprimer</button>`:""}</div></div>`).join(""):"<p class='muted'>Aucune réunion programmée.</p>"}</div></div><div id="dailyRoom" class="daily-room" hidden><div class="daily-room-head"><div><div class="eyebrow">RÉUNION EN COURS</div><b id="dailyRoomTitle">Daily</b></div><button class="btn" id="leaveDaily">Quitter la réunion</button></div><div id="dailyContainer" class="daily-container"></div></div>`;
}

async function invitation(){
  const link="https://www.tiktok.com/t/ZSXVYGTVJ/";
  return head("AGENCE","Lien invitation agence","Lien officiel pour inviter un nouveau membre à rejoindre l’agence.",`<button class="btn" id="copyInvite">Copier le lien</button>`)+`<div class="panel invitation-card"><div class="eyebrow">INVITATION AGENCE</div><h2>Rejoindre Lion Dynasty Agency</h2><p class="muted">Utilise ce lien pour inviter une personne à rejoindre l’agence sur TikTok.</p><div class="invite-link"><a href="${link}" target="_blank" rel="noopener noreferrer">${link}</a></div><div class="muted">Clique sur le lien pour l’ouvrir ou utilise « Copier le lien ».</div></div>`;
}

async function dashboard(){
  const d=await api("/api/dashboard");
  const canManage=roleLevel[me.role]>=3;
  return `<div class="dashboard-hero">
    <div>
      <div class="eyebrow">LION DYNASTY AGENCY</div>
      <h1>Bienvenue, ${esc(me.name||"membre")}</h1>
      <p class="muted">Votre espace de pilotage · <b>${esc(me.role)}</b></p>
    </div>
    <div class="hero-badge"><span class="live-dot"></span> Espace sécurisé</div>
  </div>
  <div class="dashboard-stats">
    <div class="stat-card"><div class="stat-icon cyan">♙</div><div><span>CRÉATEURS</span><strong>${d.creators}</strong><small>Profils suivis</small></div></div>
    <div class="stat-card"><div class="stat-icon purple">◈</div><div><span>UTILISATEURS ACTIFS</span><strong>${d.users}</strong><small>Accès ouverts</small></div></div>
    <div class="stat-card"><div class="stat-icon pink">◉</div><div><span>HEURES LIVE</span><strong>${Number(d.hours).toFixed(1)} h</strong><small>Activité enregistrée</small></div></div>
    <div class="stat-card"><div class="stat-icon blue">✦</div><div><span>DIAMANTS</span><strong>${Math.round(Number(d.diamonds)/1000)} K</strong><small>Performance cumulée</small></div></div>
  </div>
  <div class="section-title"><div><span>ACCÈS RAPIDE</span><h2>Centre de contrôle</h2></div>${roleLevel[me.role]>=3?`<button class="btn" id="newUser">+ Ajouter un utilisateur</button>`:""}</div>
  <div class="cards dashboard-cards">${[["♙","Créateurs","Gestion des profils et performances.","createurs"],["⚔","Matchs officiels","Calendrier et suivi des matchs.","matchs"],["✉","Messages","Communication interne en direct.","messages"],["▥","Documents","Ressources de l'agence.","documents"],["♪","Statistiques TikTok","Suivi quotidien des performances.","stats"],["◇","Demandes","Demandes et validations.","demandes"]].map((x,i)=>`<button class="panel module" data-page="${x[3]}"><span class="module-icon mi-${i}">${x[0]}</span><b>${x[1]}</b><div class="muted">${x[2]}</div><em>Ouvrir →</em></button>`).join("")}</div>`;
}
async function creators(){
  const d=await api("/api/creators");
  const canManage=roleLevel[me.role]>=3;
  return head("CRÉATEURS","Créateurs","Tous les comptes inscrits dans l'agence apparaissent ici, quel que soit leur rôle de connexion.",canManage?`<button class="btn" id="addCreator">+ Ajouter</button>`:"")
  +`<div class="panel"><div class="tablewrap"><table class="table"><thead><tr><th>Nom</th><th>Rôle</th><th>Manager</th><th>TikTok</th><th>Abonnés</th><th>Diamants</th><th>LIVE</th><th>Niveau</th><th>État</th><th>Actions</th></tr></thead><tbody>${d.creators.map(c=>`<tr><td><b>${esc(c.name)}</b></td><td><span class="tag">${esc(c.role||"Créateur")}</span></td><td>${esc(c.manager_name||"-")}</td><td>${esc(c.tiktok||"-")}</td><td>${Number(c.followers||0).toLocaleString("fr-FR")}</td><td>${Number(c.diamonds||0).toLocaleString("fr-FR")}</td><td>${Number(c.live_hours||0).toFixed(1)} h</td><td>${esc(c.level||"Nouveau")}</td><td>${c.active?`<span class="tag">Actif</span>`:`<span class="tag off">Inactif</span>`}</td><td>${canManage?`<button class="btn small" onclick="editCreator(${c.id})">Modifier</button> <button class="btn small dangerbtn" onclick="deleteCreator(${c.id},'${esc(c.name).replace(/'/g,"\\'")}')">Supprimer</button>`:"—"}</td></tr>`).join("")}</tbody></table></div></div>`;
}
async function rankings(){const d=await api("/api/rankings");return head("PERFORMANCES","Classement","Classement des créateurs par diamants et LIVE.")+`<div class="panel"><table class="table"><thead><tr><th>#</th><th>Créateur</th><th>Diamants</th><th>LIVE</th><th>Abonnés</th><th>Niveau</th></tr></thead><tbody>${d.rankings.map((c,i)=>`<tr><td><b>${i+1}</b></td><td>${esc(c.name)}</td><td>${Number(c.diamonds).toLocaleString("fr-FR")}</td><td>${Number(c.live_hours).toFixed(1)} h</td><td>${Number(c.followers).toLocaleString("fr-FR")}</td><td>${esc(c.level||"-")}</td></tr>`).join("")}</tbody></table></div>`}
async function danger(){const d=await api("/api/creators");const list=d.creators.filter(c=>!c.active||Number(c.live_hours)<10||Number(c.diamonds)<1000);return head("SURVEILLANCE","Créateurs en danger","Alertes simples basées sur l'activité.")+`<div class="panel">${list.length?list.map(c=>`<div class="item"><div><b>${esc(c.name)}</b><div class="muted">${Number(c.live_hours).toFixed(1)} h · ${Number(c.diamonds).toLocaleString("fr-FR")} diamants</div></div><span class="tag off">À surveiller</span></div>`).join(""):"<p class='muted'>Aucun créateur actuellement signalé.</p>"}</div>`}
async function users(){
  const d=await api("/api/users");
  return head("ADMINISTRATION","Utilisateurs","Gestion des comptes et des accès de l’agence.",`<button class="btn" id="refreshUsers">↻ Actualiser</button> ${roleLevel[me.role]>=3?`<button class="btn" id="newUser">+ Créer un compte</button>`:""}`)
  +`<div class="panel"><div class="tablewrap"><table class="table"><thead><tr><th>Nom</th><th>Rôle</th><th>Manager</th><th>État</th><th>Dernière connexion</th><th>Code</th><th>Actions</th></tr></thead><tbody>${d.users.map(u=>`<tr><td><b>${esc(u.name)}</b></td><td><span class="tag">${esc(u.role)}</span></td><td>${esc(u.manager_name||"-")}</td><td>${u.inactivity_locked?`<span class="tag off">Bloqué · 72 h</span>`:(u.active?"Actif":"Désactivé")}</td><td>${u.last_login_at?new Date(u.last_login_at).toLocaleString("fr-FR"):"Jamais"}</td><td>${roleLevel[me.role]>=6?`<button class="btn small" onclick="showCode(${u.id})">Voir le code</button>`:"—"}</td><td>${roleLevel[me.role]<3?"Lecture seule":(u.id!==me.id&&roleLevel[u.role]<roleLevel[me.role]?`${u.inactivity_locked?`<button class="btn small" onclick="reactivateUser(${u.id})">Réactiver</button>`:`<button class="btn small" onclick="toggleUser(${u.id},${!u.active})">${u.active?"Désactiver":"Activer"}</button>`} <button class="btn small" onclick="editUser(${u.id})">Modifier</button> <button class="btn small" onclick="regen(${u.id})">Nouveau code</button>${roleLevel[me.role]>=3?` <button class="btn small" onclick="editAccess(${u.id})">Accès</button>`:""} <button class="btn small dangerbtn" onclick="deleteUser(${u.id},'${esc(u.name).replace(/'/g,"\\'")}')">Supprimer</button>`:"—")}</td></tr>`).join("")}</tbody></table></div></div>`;
}
async function stats(){const d=await api("/api/tiktok/stats");return head("TIKTOK","Statistiques TikTok","Après une saisie, les statistiques sont verrouillées pendant 24 h. Le Fondateur peut toujours les modifier.",roleLevel[me.role]>=3?`<button class="btn" id="addStat">+ Saisir une journée</button>`:"")+`<div class="notice">⏱️ <b>Délai de 24 h :</b> une statistique existante ne peut pas être modifiée avant 24 h après sa dernière modification, sauf par le <b>Fondateur</b>.</div><div class="panel"><table class="table"><thead><tr><th>Date</th><th>Créateur</th><th>Abonnés</th><th>Vues</th><th>Likes</th><th>Diamants</th><th>LIVE</th><th>État</th></tr></thead><tbody>${d.stats.map(s=>`<tr><td>${esc(String(s.stat_date).slice(0,10))}</td><td>${esc(s.name)}</td><td>${Number(s.followers).toLocaleString("fr-FR")}</td><td>${Number(s.views).toLocaleString("fr-FR")}</td><td>${Number(s.likes).toLocaleString("fr-FR")}</td><td>${Number(s.diamonds).toLocaleString("fr-FR")}</td><td>${Number(s.live_hours).toFixed(1)} h</td><td>${s.locked?`<span class="tag off">🔒 24 h</span>`:`<span class="tag">✓ Modifiable</span>`}</td></tr>`).join("")}</tbody></table></div>`}
async function contracts(){const d=await api("/api/contracts");return head("JURIDIQUE","Contrats","Suivi des contrats et échéances.",roleLevel[me.role]>=3?`<button class="btn" id="addContract">+ Nouveau contrat</button>`:"")+`<div class="panel"><table class="table"><thead><tr><th>Créateur</th><th>Contrat</th><th>Statut</th><th>Début</th><th>Fin</th><th>Notes</th></tr></thead><tbody>${d.contracts.map(c=>`<tr><td>${esc(c.creator_name||"-")}</td><td>${esc(c.title)}</td><td><span class="tag">${esc(c.status)}</span></td><td>${esc(c.start_date||"-")}</td><td>${esc(c.end_date||"-")}</td><td>${esc(c.notes||"")}</td></tr>`).join("")}</tbody></table></div>`}
async function documents(){const d=await api("/api/documents");return head("RESSOURCES","Documents","Ressources, liens et documents de l'agence.",roleLevel[me.role]>=3?`<button class="btn" id="addDoc">+ Ajouter</button>`:"")+`<div class="panel">${d.documents.length?d.documents.map(x=>`<div class="item"><div><b>${esc(x.title)}</b><div class="muted">${esc(x.category)} · ${esc(x.content||"")}</div></div>${x.url?`<a class="btn small" href="${esc(x.url)}" target="_blank" rel="noreferrer">Ouvrir</a>`:""}</div>`).join(""):"<p class='muted'>Aucun document.</p>"}</div>`}
async function messages(){
  const [d,c]=await Promise.all([api("/api/messages"),api("/api/contacts")]);
  const msgs=[...d.messages].sort((a,b)=>new Date(a.created_at)-new Date(b.created_at));
  return head("COMMUNICATION","Chat direct","Messagerie interne en direct.",`<span class="tag">🟢 En direct</span>`)
    +`<div class="chatpanel">
      <div class="chatmessages" id="chatMessages">${msgs.length?msgs.map(m=>`<div class="chatmsg ${m.sender_id===me.id?"mine":""}">
        <div class="chatmeta"><b>${esc(m.sender_id===me.id?"Vous":(m.sender_name||"?"))}</b> · ${new Date(m.created_at).toLocaleTimeString("fr-FR",{hour:"2-digit",minute:"2-digit"})}</div>
        <div class="chatbody">${esc(m.body)}</div>
      </div>`).join(""):`<p class="muted">Aucun message. Commencez une conversation.</p>`}</div>
      <div class="chatcomposer">
        <select id="chatRecipient"><option value="">Choisir un destinataire</option>${c.contacts.map(x=>`<option value="${x.id}">${esc(x.name)} · ${esc(x.role)}</option>`).join("")}</select>
        <textarea id="chatBody" placeholder="Écrire un message…"></textarea>
        <button class="btn" id="sendChat">Envoyer</button>
      </div>
    </div>`;
}
async function matches(){
  const [d,c]=await Promise.all([api("/api/matches"),api("/api/creator-options")]);
  return head("COMPÉTITION","Matchs officiels","Calendrier et suivi des matchs.",roleLevel[me.role]>=3?`<button class="btn" id="addMatch">+ Ajouter un match</button>`:"")
  +`<div class="panel">${d.matches.length?d.matches.map(m=>`<div class="item"><div><b>${esc(m.creator_name||"Créateur")}</b><div class="muted">${esc(m.opponent||"Adversaire à définir")} · ${m.match_date?new Date(m.match_date).toLocaleString("fr-FR"):"Date à définir"}</div><div class="muted">${esc(m.age_restriction||"Tous")} · ${esc(m.boost||"Sans boost")}</div></div><span class="tag">${esc(m.status)}</span></div>`).join(""):"<p class='muted'>Aucun match programmé.</p>"}</div>`;
}
async function posters(){
  const [d,c]=await Promise.all([api("/api/posters"),api("/api/creator-options")]);
  return head("COMPÉTITION","Match posters","Envoyez vos affiches et associez-les à un créateur.",roleLevel[me.role]>=3?`<button class="btn" id="addPoster">+ Envoyer une image</button>`:"")
  +`<div class="panel">${d.posters.length?d.posters.map(p=>`<div class="item"><div><b>${esc(p.creator_name||"Créateur")}</b><div class="muted">${esc(p.original_name)} · ${(Number(p.size_bytes)/1024/1024).toFixed(1)} Mo</div></div><div>${p.url?`<a class="btn small" href="${esc(p.url)}" target="_blank">Ouvrir</a>`:""}${roleLevel[me.role]>=3?` <button class="btn small dangerbtn" onclick="deletePoster(${p.id})">Supprimer</button>`:""}</div></div>`).join(""):"<p class='muted'>Aucun poster.</p>"}</div>`;
}
async function colorings(){
  const [d,c]=await Promise.all([api("/api/coloriages"),api("/api/creator-options")]);
  const canManage=roleLevel[me.role]>=3;
  return head("CRÉATIVITÉ","Coloriages","Publiez les coloriages de l'agence, associez-les à un créateur et votez pour plusieurs créations.",canManage?`<button class="btn" id="addColoring">+ Publier un coloriage</button>`:"")
  +`<div class="coloring-grid">${d.colorings.length?d.colorings.map(x=>`<article class="coloring-card"><div class="coloring-image-wrap"><img src="${esc(x.url)}" alt="${esc(x.original_name)}" loading="lazy"></div><div class="coloring-body"><div class="coloring-meta"><span class="tag">${esc(x.creator_name||"Créateur")}</span><span class="muted">${(Number(x.size_bytes)/1024/1024).toFixed(1)} Mo</span></div><h3>${esc(x.original_name)}</h3><div class="coloring-actions"><button class="btn small ${x.voted?"active-vote":""}" onclick="voteColoring(${x.id})">${x.voted?"♥ Voté":"♡ Voter"} · <b id="votes-${x.id}">${Number(x.vote_count||0)}</b></button>${roleLevel[me.role]>=4?`<button class="btn small dangerbtn" onclick="deleteColoring(${x.id})">Supprimer</button>`:""}</div></div></article>`).join(""):"<div class='panel'><p class='muted'>Aucun coloriage publié pour le moment.</p></div>"}</div>`;
}
async function requests(){const d=await api("/api/requests");return head("SERVICE","Demandes","Demandes internes et suivi des réponses.",`<button class="btn" id="addRequest">+ Nouvelle demande</button>`)+`<div class="panel">${d.requests.length?d.requests.map(r=>`<div class="item"><div><b>${esc(r.subject)}</b><div class="muted">${esc(r.type)} · ${esc(r.requester_name||"Moi")}</div><p>${esc(r.body)}</p>${r.response?`<div class="reply">${esc(r.response)}</div>`:""}</div><span class="tag">${esc(r.status)}</span>${roleLevel[me.role]>=3?`<button class="btn small" onclick="answerRequest(${r.id})">Traiter</button>`:""}</div>`).join(""):"<p class='muted'>Aucune demande.</p>"}</div>`}
async function notifications(){const d=await api("/api/notifications");return head("ALERTES","Notifications","Vos notifications agence.",`<button class="btn" id="readAll">Tout marquer comme lu</button>`)+`<div class="panel">${d.notifications.length?d.notifications.map(n=>`<div class="item"><div><b>${esc(n.title)}</b><div class="muted">${new Date(n.created_at).toLocaleString("fr-FR")}</div><p>${esc(n.body)}</p></div><span class="tag ${n.read_at?"":"off"}">${n.read_at?"Lu":"Nouveau"}</span></div>`).join(""):"<p class='muted'>Aucune notification.</p>"}</div>`}
async function reactivation(){const d=await api("/api/inactive-users");return head("SÉCURITÉ","Réactivation des accès","Les comptes sans connexion pendant 72 h sont automatiquement suspendus. Tous les rôles sauf Créateur peuvent réactiver un accès.")+`<div class="panel">${d.users.length?`<div class="tablewrap"><table class="table"><thead><tr><th>Nom</th><th>Rôle</th><th>Dernière connexion</th><th>Motif</th><th>Action</th></tr></thead><tbody>${d.users.map(u=>`<tr><td><b>${esc(u.name)}</b></td><td><span class="tag">${esc(u.role)}</span></td><td>${u.last_login_at?new Date(u.last_login_at).toLocaleString("fr-FR"):"Jamais"}</td><td>${esc(u.inactive_reason||"72 h d'inactivité")}</td><td><button class="btn small" onclick="reactivateUser(${u.id})">Réactiver</button></td></tr>`).join("")}</tbody></table></div>`:`<p class="muted">Aucun accès bloqué pour inactivité.</p>`}</div>`}
async function auditPage(){const d=await api("/api/audit");return head("SÉCURITÉ","Journal des actions","Traçabilité des actions sensibles.")+`<div class="panel"><table class="table"><thead><tr><th>Date</th><th>Utilisateur</th><th>Action</th><th>Détails</th></tr></thead><tbody>${d.logs.map(x=>`<tr><td>${new Date(x.created_at).toLocaleString("fr-FR")}</td><td>${esc(x.name||"-")}</td><td>${esc(x.action)}</td><td>${esc(x.details)}</td></tr>`).join("")}</tbody></table></div>`}
async function modulePage(k){const d=await api(`/api/module/${k}`);return head("MODULE",labels[k]||k,"Espace de travail Lion Dynasty Agency.",roleLevel[me.role]>=3?`<button class="btn" id="addItem">+ Ajouter</button>`:"")+`<div class="panel">${d.items.length?d.items.map(x=>`<div class="item"><div><b>${esc(x.title)}</b><div class="muted">${esc(x.content||"")}</div></div><span class="tag">${esc(x.status)}</span></div>`).join(""):"<p class='muted'>Aucun élément pour le moment.</p>"}</div>`}
function modal(html){const b=document.createElement("div");b.className="modalbg";b.innerHTML=html;document.body.append(b);return b}
async function userModal(){
  const roles=Object.keys(roleLevel).filter(r=>roleLevel[r]<roleLevel[me.role] || (me.role==="Fondateur" && r==="Fondateur"));
  let cats=[];
  if(roleLevel[me.role]>=3){try{const d=await api("/api/access/"+me.id);cats=d.categories||[]}catch{}}
  const b=modal(`<div class="modal"><h2>Créer un compte</h2>
    <div class="field"><label>NOM</label><input id="n" autofocus></div>
    <div class="field"><label>RÔLE</label><select id="r">${roles.map(r=>`<option>${r}</option>`).join("")}</select></div>
    ${roleLevel[me.role]>=3?`<div class="field"><label>CATÉGORIES AUTORISÉES</label><div class="accessgrid" id="newAccess">${cats.map(([k,label])=>`<label class="check"><input type="checkbox" data-new-access="${k}" checked> ${esc(label)}</label>`).join("")}</div><p class="muted">Pour un Fondateur ou Co-Fondateur, toutes les catégories restent disponibles.</p></div>`:""}
    <button class="btn" id="save">Créer</button> <button class="btn" id="close">Annuler</button></div>`);
  $("#close").onclick=()=>b.remove();
  $("#save").onclick=async()=>{
    try{
      const access=[...b.querySelectorAll("[data-new-access]:checked")].map(x=>x.dataset.newAccess);
      const d=await api("/api/users",{method:"POST",body:JSON.stringify({name:$("#n").value,role:$("#r").value,access_modules:access})});
      b.innerHTML=`<div class="modal"><h2>Compte créé</h2><div class="code">${esc(d.code)}</div><p class="muted">Le profil apparaît automatiquement dans « Créateurs », « Matchs officiels » et « Match posters », quel que soit son rôle de connexion.</p><button class="btn" id="done">Fermer</button></div>`;
      $("#done").onclick=()=>{b.remove();page("admin")}
    }catch(e){toast(e.message)}
  }
}
async function creatorModal(id=null,data={}){const b=modal(`<div class="modal"><h2>${id?"Modifier":"Ajouter"} un créateur</h2><div class="field"><label>NOM</label><input id="cn" value="${esc(data.name||"")}"></div><div class="field"><label>TIKTOK</label><input id="ct" value="${esc(data.tiktok||"")}"></div><div class="field"><label>ABONNÉS</label><input id="cf" type="number" value="${data.followers||0}"></div><div class="field"><label>DIAMANTS</label><input id="cd" type="number" value="${data.diamonds||0}"></div><div class="field"><label>HEURES LIVE</label><input id="ch" type="number" step="0.1" value="${data.live_hours||0}"></div><div class="field"><label>NIVEAU</label><input id="cl" value="${esc(data.level||"Nouveau")}"></div><div class="field"><label>NOTE</label><textarea id="co">${esc(data.note||"")}</textarea></div><button class="btn" id="save">Enregistrer</button> <button class="btn" id="close">Annuler</button></div>`);$("#close").onclick=()=>b.remove();$("#save").onclick=async()=>{try{const body={name:$("#cn").value,tiktok:$("#ct").value,followers:$("#cf").value,diamonds:$("#cd").value,live_hours:$("#ch").value,level:$("#cl").value,note:$("#co").value};const d=id?await api(`/api/creators/${id}`,{method:"PATCH",body:JSON.stringify(body)}):await api("/api/creators",{method:"POST",body:JSON.stringify(body)});if(!id){b.innerHTML=`<div class="modal"><h2>Créateur créé</h2><div class="code">${esc(d.code)}</div><button class="btn" id="done">Fermer</button></div>`;$("#done").onclick=()=>{b.remove();page("createurs")}}else{b.remove();page("createurs")}}catch(e){toast(e.message)}}}
window.editCreator=async id=>{try{const d=await api("/api/creators");const c=d.creators.find(x=>String(x.id)===String(id));if(c)creatorModal(id,c);else toast("Créateur introuvable")}catch(e){toast(e.message)}};
window.deleteCreator=async(id,name)=>{if(!confirm(`Supprimer définitivement le créateur « ${name} » ?\n\nSes statistiques et contrats liés seront également supprimés.`))return;try{await api(`/api/creators/${id}`,{method:"DELETE"});toast("Créateur supprimé");page("createurs")}catch(e){toast(e.message)}};
window.toggleUser=async(id,active)=>{try{await api(`/api/users/${id}`,{method:"PATCH",body:JSON.stringify({active})});page("admin")}catch(e){toast(e.message)}};
window.editUser=async id=>{
  try{
    const d=await api("/api/users");
    const u=d.users.find(x=>String(x.id)===String(id)); if(!u)return toast("Utilisateur introuvable");
    const roles=Object.keys(roleLevel).filter(r=>roleLevel[r]<roleLevel[me.role] && roleLevel[r]>=1);
    const b=modal(`<div class="modal"><h2>Modifier le compte</h2><div class="field"><label>NOM</label><input id="un" value="${esc(u.name)}"></div><div class="field"><label>RÔLE</label><select id="ur">${roles.map(r=>`<option ${r===u.role?"selected":""}>${r}</option>`).join("")}</select></div><button class="btn" id="saveUser">Enregistrer</button> <button class="btn" id="close">Annuler</button></div>`);
    $("#close").onclick=()=>b.remove();
    $("#saveUser").onclick=async()=>{try{await api(`/api/users/${id}`,{method:"PATCH",body:JSON.stringify({name:$("#un").value.trim(),role:$("#ur").value})});b.remove();toast("Compte modifié");page("admin")}catch(e){toast(e.message)}};
  }catch(e){toast(e.message)}
};
window.deleteUser=async(id,name)=>{
  if(!confirm(`Supprimer définitivement le compte « ${name} » ?`))return;
  try{await api(`/api/users/${id}`,{method:"DELETE"});toast("Compte supprimé");page("admin")}catch(e){toast(e.message)}
};

window.reactivateUser=async id=>{try{await api(`/api/users/${id}/reactivate`,{method:"POST"});toast("Accès réactivé");page(roleLevel[me.role]>=3?"admin":"reactivation")}catch(e){toast(e.message)}};
window.showCode=async id=>{
  try{
    const d=await api(`/api/users/${id}/code`);
    const b=modal(`<div class="modal"><h2>Code de connexion</h2><p class="muted">${esc(d.name)}</p><div class="code">${esc(d.code)}</div><button class="btn" id="copyCode">Copier</button> <button class="btn" id="closeCode">Fermer</button></div>`);
    $("#copyCode").onclick=async()=>{try{await navigator.clipboard.writeText(d.code);toast("Code copié")}catch{toast("Copie impossible")}};
    $("#closeCode").onclick=()=>b.remove();
  }catch(e){toast(e.message)}
};
window.regen=async id=>{try{const d=await api(`/api/users/${id}/regenerate`,{method:"POST"});const b=modal(`<div class="modal"><h2>Nouveau code</h2><div class="code">${esc(d.code)}</div><button class="btn" id="ok">Fermer</button></div>`);$("#ok").onclick=()=>b.remove()}catch(e){toast(e.message)}};
async function accessModal(id){
  try{
    const d=await api(`/api/access/${id}`);
    const current=new Set(d.user.access_modules||[]);
    const b=modal(`<div class="modal"><h2>Catégories autorisées — ${esc(d.user.name)}</h2><p class="muted">Cochez uniquement les rubriques accessibles à ce compte.</p><div class="accessgrid">${d.categories.map(([k,label])=>`<label class="check"><input type="checkbox" data-access="${k}" ${current.has(k)?"checked":""}> ${esc(label)}</label>`).join("")}</div><button class="btn" id="saveAccess">Enregistrer</button> <button class="btn" id="close">Annuler</button></div>`);
    $("#close").onclick=()=>b.remove();
    $("#saveAccess").onclick=async()=>{try{const access=[...b.querySelectorAll("[data-access]:checked")].map(x=>x.dataset.access);await api(`/api/access/${id}`,{method:"PUT",body:JSON.stringify({access_modules:access})});toast("Accès mis à jour");b.remove();page("admin")}catch(e){toast(e.message)}};
  }catch(e){toast(e.message)}
}
window.editAccess=accessModal;
window.deletePoster=async id=>{if(!confirm("Supprimer définitivement ce poster ?"))return;try{await api(`/api/posters/${id}`,{method:"DELETE"});toast("Poster supprimé");page("posters")}catch(e){toast(e.message)}};

function simpleForm(title,fields,save){const b=modal(`<div class="modal"><h2>${title}</h2>${fields.map(f=>`<div class="field"><label>${esc(f.label)}</label>${f.type==="textarea"?`<textarea id="${f.id}">${esc(f.value||"")}</textarea>`:f.type==="select"?`<select id="${f.id}">${(f.options||[]).map(o=>`<option value="${esc(o[0])}">${esc(o[1])}</option>`).join("")}</select>`:`<input id="${f.id}" type="${f.type||"text"}" value="${esc(f.value||"")}" placeholder="${esc(f.placeholder||"")}">`}</div>`).join("")}<button class="btn" id="save">Enregistrer</button> <button class="btn" id="close">Annuler</button></div>`);$("#close").onclick=()=>b.remove();$("#save").onclick=async()=>{try{const out={};fields.forEach(f=>out[f.id]=$("#"+f.id).value);await save(out,b)}catch(e){toast(e.message)}}}
async function refreshChatMessages(){
  try{
    const d=await api("/api/messages");
    const box=$("#chatMessages"); if(!box)return;
    const msgs=[...d.messages].sort((a,b)=>new Date(a.created_at)-new Date(b.created_at));
    box.innerHTML=msgs.map(m=>`<div class="chatmsg ${m.sender_id===me.id?"mine":""}">
      <div class="chatmeta"><b>${esc(m.sender_id===me.id?"Vous":(m.sender_name||"?"))}</b> · ${new Date(m.created_at).toLocaleTimeString("fr-FR",{hour:"2-digit",minute:"2-digit"})}</div>
      <div class="chatbody">${esc(m.body)}</div>
    </div>`).join("")||`<p class="muted">Aucun message.</p>`;
    box.scrollTop=box.scrollHeight;
  }catch{}
}
function attachHandlers(k){
  $("#refreshUsers")?.addEventListener("click",()=>page("admin"));
  $("#newUser")?.addEventListener("click",userModal);
  $("#addCreator")?.addEventListener("click",()=>creatorModal());
  $("#addStat")?.addEventListener("click",async()=>{
    const d=await api("/api/creator-options");
    simpleForm("Saisir les statistiques",[
      {id:"creator_id",label:"Créateur",type:"select",options:d.creators.map(x=>[x.id,x.name])},
      {id:"stat_date",label:"Date",type:"date"},
      {id:"followers",label:"Abonnés",type:"number"},{id:"views",label:"Vues",type:"number"},
      {id:"likes",label:"Likes",type:"number"},{id:"diamonds",label:"Diamants",type:"number"},{id:"live_hours",label:"Heures LIVE",type:"number"}
    ],async(v,b)=>{await api("/api/tiktok/stats",{method:"POST",body:JSON.stringify(v)});b.remove();page("stats")});
  });
  $("#addContract")?.addEventListener("click",async()=>{
    const d=await api("/api/creator-options");
    simpleForm("Nouveau contrat",[
      {id:"creator_id",label:"Créateur",type:"select",options:d.creators.map(x=>[x.id,x.name])},{id:"title",label:"Titre"},
      {id:"status",label:"Statut",value:"Brouillon"},{id:"start_date",label:"Début",type:"date"},{id:"end_date",label:"Fin",type:"date"},{id:"notes",label:"Notes",type:"textarea"}
    ],async(v,b)=>{await api("/api/contracts",{method:"POST",body:JSON.stringify(v)});b.remove();page("contrats")});
  });
  $("#addDoc")?.addEventListener("click",()=>simpleForm("Ajouter un document",[{id:"title",label:"Titre"},{id:"category",label:"Catégorie",value:"Agence"},{id:"url",label:"Lien URL"},{id:"content",label:"Description",type:"textarea"},{id:"visibility",label:"Visibilité",value:"Tous"}],async(v,b)=>{await api("/api/documents",{method:"POST",body:JSON.stringify(v)});b.remove();page("documents")}));
  $("#sendChat")?.addEventListener("click",async()=>{
    const to=$("#chatRecipient").value, body=$("#chatBody").value.trim();
    if(!to||!body)return toast("Choisissez un destinataire et écrivez un message.");
    await api("/api/messages",{method:"POST",body:JSON.stringify({recipient_id:to,subject:"Chat",body})});
    $("#chatBody").value=""; page("messages");
  });
  if(k==="messages"){
    refreshChatMessages();
    const proto=location.protocol==="https:"?"wss":"ws";
    try{
      chatSocket=new WebSocket(`${proto}://${location.host}/ws`);
      chatSocket.onmessage=()=>refreshChatMessages();
      chatSocket.onerror=()=>{};
    }catch{}
    // filet de sécurité si le navigateur ou le proxy bloque WebSocket.
    chatTimer=setInterval(refreshChatMessages,10000);
    setTimeout(()=>{const box=$("#chatMessages");if(box)box.scrollTop=box.scrollHeight},50);
  }
  $("#addMeeting")?.addEventListener("click",()=>simpleForm("Nouvelle réunion Daily",[{id:"title",label:"Titre",value:"Réunion Lion Dynasty"},{id:"scheduled_at",label:"Date / heure",type:"datetime-local"}],async(v,b)=>{await api("/api/reunions",{method:"POST",body:JSON.stringify(v)});b.remove();toast("Réunion créée");page("reunions")}));
  document.querySelectorAll(".join-meeting").forEach(btn=>btn.addEventListener("click",async()=>{
    try{
      const id=btn.dataset.id; const d=await api(`/api/reunions/${id}/token`,{method:"POST"});
      const room=document.querySelector("#dailyRoom"); const container=document.querySelector("#dailyContainer");
      if(!window.DailyIframe){toast("Le module vidéo Daily n'est pas chargé. Rechargez la page.");return}
      document.querySelector("#dailyRoom").hidden=false;
      document.querySelector("#dailyRoomTitle").textContent=btn.closest(".meeting-card")?.querySelector("b")?.textContent||"Réunion Daily";
      room.scrollIntoView({behavior:"smooth",block:"start"});
      if(dailyCallFrame){try{dailyCallFrame.destroy()}catch{}}
      dailyCallFrame=window.DailyIframe.createFrame(container,{showLeaveButton:true,showFullscreenButton:true,iframeStyle:{width:"100%",height:"100%",border:0,borderRadius:"18px"}});
      dailyCallFrame.on("left-meeting",()=>{try{dailyCallFrame.destroy()}catch{} dailyCallFrame=null;room.hidden=true;});
      await dailyCallFrame.join({url:d.url,token:d.token});
    }catch(e){toast(e.message)}
  }));
  $("#leaveDaily")?.addEventListener("click",async()=>{if(dailyCallFrame){try{await dailyCallFrame.leave();dailyCallFrame.destroy()}catch{}dailyCallFrame=null}$("#dailyRoom").hidden=true});
  document.querySelectorAll(".delete-meeting").forEach(btn=>btn.addEventListener("click",async()=>{if(!confirm("Supprimer cette réunion Daily ?"))return;try{await api(`/api/reunions/${btn.dataset.id}`,{method:"DELETE"});toast("Réunion supprimée");page("reunions")}catch(e){toast(e.message)}}));
  $("#addMatch")?.addEventListener("click",async()=>{
    const d=await api("/api/creator-options");
    if(!d.creators.length){toast("Aucun compte actif n'est disponible. Créez d'abord un compte dans Administration.");return}
    simpleForm("Ajouter un match",[
      {id:"creator_id",label:"Créateur inscrit",type:"select",options:d.creators.map(x=>[x.id,`${x.name}${x.active===false?" (inactif)":""}`])},
      {id:"opponent",label:"Adversaire"},
      {id:"match_date",label:"Date/heure",type:"datetime-local"},
      {id:"age_restriction",label:"Accès",type:"select",options:[["Tous","Tous"],["+18","+18"],["-18","-18"]]},
      {id:"boost",label:"Boost",type:"select",options:[["Sans boost","Sans boost"],["Avec boost","Avec boost"]]},
      {id:"status",label:"Statut",value:"Planifié"},{id:"result",label:"Résultat"},{id:"notes",label:"Notes",type:"textarea"}
    ],async(v,b)=>{await api("/api/matches",{method:"POST",body:JSON.stringify(v)});b.remove();page("matchs")});
  });
  $("#addPoster")?.addEventListener("click",async()=>{
    const d=await api("/api/creator-options");
    if(!d.creators.length){toast("Aucun compte actif n'est disponible.");return}
    const b=modal(`<div class="modal"><h2>Envoyer un match poster</h2><div class="field"><label>CRÉATEUR</label><select id="posterCreator">${d.creators.map(x=>`<option value="${x.id}">${esc(x.name)}</option>`).join("")}</select></div><div class="field"><label>IMAGE — maximum 1000 Mo</label><input id="posterFile" type="file" accept="*/*"></div><p class="muted">Tous les formats de fichier sont acceptés.</p><button class="btn" id="savePoster">Envoyer</button> <button class="btn" id="close">Annuler</button></div>`);
    $("#close").onclick=()=>b.remove();
    $("#savePoster").onclick=async()=>{
      const file=$("#posterFile").files[0]; if(!file)return toast("Sélectionnez une image.");
      if(file.size>1000000000)return toast("Fichier trop volumineux : maximum 1000 Mo.");
      const fd=new FormData();fd.append("creator_id",$("#posterCreator").value);fd.append("image",file);
      try{await api("/api/posters",{method:"POST",body:fd,headers:{}});b.remove();toast("Poster envoyé");page("posters")}catch(e){toast(e.message)}
    };
  });
  $("#addColoring")?.addEventListener("click",async()=>{
    const d=await api("/api/creator-options");
    if(!d.creators.length){toast("Aucun compte actif n'est disponible.");return}
    const b=modal(`<div class="modal"><h2>Publier un coloriage</h2><label>Créateur</label><select id="coloringCreator">${d.creators.map(x=>`<option value="${x.id}">${esc(x.name)} — ${esc(x.role||"")}</option>`).join("")}</select><label>Image — maximum 1000 Mo</label><input id="coloringFile" type="file" accept="image/*"><p class="muted">Formats image acceptés par le navigateur et le serveur, jusqu'à 1000 Mo.</p><div class="modal-actions"><button class="btn" id="saveColoring">Publier</button><button class="btn" id="close">Annuler</button></div></div>`);
    $("#close").onclick=()=>b.remove();
    $("#saveColoring").onclick=async()=>{const file=$("#coloringFile").files[0];if(!file)return toast("Sélectionnez une image.");if(file.size>1000000000)return toast("Fichier trop volumineux : maximum 1000 Mo.");const fd=new FormData();fd.append("creator_id",$("#coloringCreator").value);fd.append("image",file);try{await api("/api/coloriages",{method:"POST",body:fd,headers:{}});b.remove();toast("Coloriage publié");page("coloriages")}catch(e){toast(e.message)}};
  });
  $("#addRequest")?.addEventListener("click",()=>simpleForm("Nouvelle demande",[{id:"type",label:"Type",value:"Autre"},{id:"subject",label:"Sujet"},{id:"body",label:"Détail",type:"textarea"}],async(v,b)=>{await api("/api/requests",{method:"POST",body:JSON.stringify(v)});b.remove();page("demandes")}));
  $("#readAll")?.addEventListener("click",async()=>{await api("/api/notifications/read-all",{method:"PATCH"});page("notifications")});
  $("#addItem")?.addEventListener("click",()=>simpleForm("Ajouter",[{id:"title",label:"Titre"},{id:"content",label:"Contenu",type:"textarea"},{id:"status",label:"Statut",value:"Actif"}],async(v,b)=>{await api(`/api/module/${k}`,{method:"POST",body:JSON.stringify(v)});b.remove();page(k)}));
}
window.voteColoring=async id=>{try{const d=await api(`/api/coloriages/${id}/vote`,{method:"POST"});const el=$(`#votes-${id}`);if(el)el.textContent=d.vote_count;page("coloriages")}catch(e){toast(e.message)}};
window.deleteColoring=async id=>{if(!confirm("Supprimer définitivement ce coloriage ?"))return;try{await api(`/api/coloriages/${id}`,{method:"DELETE"});toast("Coloriage supprimé");page("coloriages")}catch(e){toast(e.message)}};
window.answerRequest=async id=>{simpleForm("Traiter la demande",[{id:"status",label:"Statut",value:"En cours"},{id:"response",label:"Réponse",type:"textarea"}],async(v,b)=>{await api(`/api/requests/${id}`,{method:"PATCH",body:JSON.stringify(v)});b.remove();page("demandes")})}
async function page(k){try{let c;if(k==="dashboard")c=await dashboard();else if(k==="createurs")c=await creators();else if(k==="classement")c=await rankings();else if(k==="danger")c=await danger();else if(k==="admin")c=await users();else if(k==="reactivation")c=await reactivation();else if(k==="stats")c=await stats();else if(k==="contrats")c=await contracts();else if(k==="documents")c=await documents();else if(k==="messages")c=await messages();else if(k==="reunions")c=await reunions();else if(k==="matchs")c=await matches();else if(k==="posters")c=await posters();else if(k==="coloriages")c=await colorings();else if(k==="invitation")c=await invitation();else if(k==="demandes")c=await requests();else if(k==="notifications")c=await notifications();else if(k==="securite")c=await auditPage();else c=await modulePage(k);shell(c,k);attachHandlers(k)}catch(e){toast(e.message)}}
(async()=>{try{const d=await api("/api/me");me=d.user;if(me)page("dashboard");else login()}catch{login()}})();
