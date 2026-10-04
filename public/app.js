const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"']/g, m => ({
  "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
}[m]));

const menu = [
  ["⌂","Tableau de bord","dashboard"],
  ["♛","Classement","classement"],
  ["♙","Créateurs","createurs"],
  ["⚠","Créateurs en danger","danger"],
  ["♪","Profils TikTok","tiktok"],
  ["▶","Règlements TikTok","reglements"],
  ["◆","Administrateurs","admin"],
  ["●","LIVE TikTok","live"],
  ["◎","Challenges","challenges"],
  ["♛","Notre équipe","equipe"],
  ["◆","Jeux","jeux"],
  ["★","Partenariats","partenariats"],
  ["✎","Collaborations","collaborations"],
  ["▤","Bibliothèque overlays","overlays"],
  ["⚔","Matchs officiels","matchs"],
  ["▧","Affiches matchs","affiches"],
  ["!","Avertissements","avertissements"],
  ["✓","Contrats","contrats"],
  ["▥","Statistiques","stats"],
  ["◆","Annonces","annonces"],
  ["✉","Messages","messages"],
  ["▣","Réunions vidéo","reunions"],
  ["?","Demandes","demandes"],
  ["◇","Sécurité","securite"],
  ["▤","Documents","documents"],
  ["▤","Extrait Kbis","kbis"],
  ["◇","Apparence","apparence"],
  ["?","Centre d'aide","aide"]
];

let me = null;

async function api(url, opt = {}) {
  const r = await fetch(url, {
    credentials: "same-origin",
    ...opt,
    headers: {"Content-Type":"application/json", ...(opt.headers || {})}
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw Error(d.error || "Erreur");
  return d;
}

function toast(message) {
  const e = document.createElement("div");
  e.className = "toast";
  e.textContent = message;
  document.body.append(e);
  setTimeout(() => e.remove(), 2800);
}

function login(errorMessage = "") {
  document.body.innerHTML = `
    <main class="login">
      <section class="card">
        <div class="brand">
          <div class="logo">L</div>
          <div><b>LION DYNASTY</b><div class="muted">AGENCY PORTAL</div></div>
        </div>
        <h1>Connexion</h1>
        <p class="muted">Votre code agence est attribué par un administrateur.</p>
        ${errorMessage ? `<div class="error">${esc(errorMessage)}</div>` : ""}
        <form id="f">
          <div class="field">
            <label>CODE AGENCE</label>
            <input id="code" placeholder="LDA-XXXXXX-000" autocomplete="off" required autofocus>
          </div>
          <button class="primary">SE CONNECTER</button>
        </form>
        <p class="muted" style="font-size:12px;margin-top:16px">
          Lion Dynasty Agency · Version 3 · PostgreSQL
        </p>
      </section>
    </main>`;

  $("#f").onsubmit = async e => {
    e.preventDefault();
    const button = $("#f button");
    button.disabled = true;
    button.textContent = "Connexion...";
    try {
      const d = await api("/api/login", {
        method:"POST",
        body:JSON.stringify({code:$("#code").value})
      });
      me = d.user;
      render();
    } catch (x) {
      button.disabled = false;
      button.textContent = "SE CONNECTER";
      login(x.message);
    }
  };
}

function shell(content, active) {
  document.body.innerHTML = `
    <div class="shell">
      <aside class="side">
        <div class="brand">
          <div class="logo">L</div>
          <div><b>LION DYNASTY</b><div class="muted">AGENCY</div></div>
        </div>
        <nav>
          ${menu.map(m => `
            <button class="${active === m[2] ? "active" : ""}" data-p="${m[2]}">
              <span>${m[0]}</span> ${m[1]}
            </button>`).join("")}
        </nav>
        <div class="userbox">
          <b>${esc(me.name)}</b>
          <div class="muted">${esc(me.role)}</div>
        </div>
      </aside>
      <section class="main">
        <header class="top">
          <span class="muted">Lion Dynasty Agency · ${esc(me.role)}</span>
          <button class="btn" id="out">Déconnexion</button>
        </header>
        <main class="content">${content}</main>
      </section>
    </div>`;

  document.querySelectorAll("[data-p]").forEach(b =>
    b.onclick = () => page(b.dataset.p)
  );

  $("#out").onclick = async () => {
    await api("/api/logout", {method:"POST"});
    me = null;
    login();
  };
}

async function dash() {
  const d = await api("/api/dashboard");
  return `
    <div class="eyebrow">LION DYNASTY AGENCY</div>
    <div class="head">
      <div>
        <h1>Tableau de bord</h1>
        <div class="muted">Bienvenue dans votre espace agence.</div>
      </div>
      ${me.role === "Admin"
        ? '<button class="btn" id="newUser">+ Ajouter un utilisateur</button>'
        : ""}
    </div>
    <div class="grid">
      <div class="box">Créateurs<div class="num">${d.creators}</div></div>
      <div class="box">Utilisateurs actifs<div class="num">${d.users}</div></div>
      <div class="box">Heures cumulées<div class="num">${d.hours} h</div></div>
      <div class="box">Diamants<div class="num">${Math.round(d.diamonds/1000)} K</div></div>
    </div>
    <div class="cards">
      <div class="panel module"><span>♙</span><b>Créateurs</b><div class="muted">Profils, suivi et gestion des créateurs.</div></div>
      <div class="panel module"><span class="pink">⚔</span><b>Matchs officiels</b><div class="muted">Calendrier et suivi des matchs.</div></div>
      <div class="panel module"><span>✉</span><b>Messages</b><div class="muted">Communication interne.</div></div>
      <div class="panel module"><span class="pink">▤</span><b>Documents</b><div class="muted">Documents et ressources de l'agence.</div></div>
    </div>`;
}

async function admin() {
  const d = await api("/api/users");
  return `
    <div class="eyebrow">ADMINISTRATION</div>
    <div class="head">
      <div>
        <h1>Utilisateurs</h1>
        <div class="muted">Les codes agence sont créés et attribués uniquement par l'Admin.</div>
      </div>
      <button class="btn" id="newUser">+ Créer un compte</button>
    </div>
    <div class="panel">
      <div style="overflow:auto">
        <table class="table">
          <thead><tr><th>Nom</th><th>Rôle</th><th>État</th><th>Actions</th></tr></thead>
          <tbody>
            ${d.users.map(u => `
              <tr>
                <td>${esc(u.name)}</td>
                <td>${esc(u.role)}</td>
                <td><span class="tag ${u.active ? "" : "off"}">${u.active ? "Actif" : "Désactivé"}</span></td>
                <td>
                  ${u.role !== "Admin" ? `<button class="btn" onclick="toggleUser(${u.id},${u.active ? "false" : "true"})">${u.active ? "Désactiver" : "Activer"}</button>` : ""}
                  ${u.role !== "Admin" ? `<button class="btn" onclick="regen(${u.id})">Nouveau code</button>` : ""}
                </td>
              </tr>`).join("")}
          </tbody>
        </table>
      </div>
    </div>`;
}

async function page(k) {
  let c = "";
  if (k === "dashboard") c = await dash();
  else if (k === "admin" && me.role === "Admin") c = await admin();
  else {
    const m = menu.find(x => x[2] === k);
    c = `
      <div class="eyebrow">MODULE</div>
      <h1>${esc(m?.[1] || k)}</h1>
      <div class="panel">
        <h2>${esc(m?.[1] || k)}</h2>
        <p class="muted">Ce module est prévu dans la construction complète de Lion Dynasty Agency. La V3 fournit déjà l'authentification, les rôles et l'administration des comptes.</p>
      </div>`;
  }

  shell(c, k);
  $("#newUser")?.addEventListener("click", modal);
}

function modal() {
  const b = document.createElement("div");
  b.className = "modalbg";
  b.innerHTML = `
    <div class="modal">
      <h2>Créer un compte</h2>
      <div class="field"><label>NOM / PSEUDO</label><input id="n" autofocus></div>
      <div class="field">
        <label>RÔLE</label>
        <select id="r"><option>Créateur</option><option>Manager</option></select>
      </div>
      <div class="row">
        <button class="btn" id="save">Créer</button>
        <button class="btn" id="close">Annuler</button>
      </div>
    </div>`;

  document.body.append(b);
  $("#close").onclick = () => b.remove();

  $("#save").onclick = async () => {
    try {
      const d = await api("/api/users", {
        method:"POST",
        body:JSON.stringify({name:$("#n").value, role:$("#r").value})
      });

      b.innerHTML = `
        <div class="modal">
          <h2>Compte créé</h2>
          <p class="muted">Transmets ce code à l'utilisateur. Il ne sera plus affiché ensuite.</p>
          <div class="code">${esc(d.code)}</div>
          <button class="btn" id="done">Fermer</button>
        </div>`;

      $("#done").onclick = () => { b.remove(); page("admin"); };
    } catch (x) {
      toast(x.message);
    }
  };
}

window.toggleUser = async (id, active) => {
  try {
    await api("/api/users/" + id, {
      method:"PATCH",
      body:JSON.stringify({active})
    });
    page("admin");
  } catch (x) {
    toast(x.message);
  }
};

window.regen = async id => {
  try {
    const d = await api("/api/users/" + id + "/regenerate", {method:"POST"});
    const b = document.createElement("div");
    b.className = "modalbg";
    b.innerHTML = `
      <div class="modal">
        <h2>Nouveau code agence</h2>
        <div class="code">${esc(d.code)}</div>
        <p class="muted">Transmets ce nouveau code à l'utilisateur.</p>
        <button class="btn" id="x">Fermer</button>
      </div>`;
    document.body.append(b);
    $("#x").onclick = () => b.remove();
  } catch (x) {
    toast(x.message);
  }
};

async function render() {
  try {
    const d = await api("/api/me");
    me = d.user;
    if (me) page("dashboard");
    else login();
  } catch {
    login();
  }
}

render();
