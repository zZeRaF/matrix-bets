// Matrix Bets — module de synchronisation multi-device via GitHub Gist privé.
//
// Idée : on stocke {bankroll, peak, history, updated_at} dans un Gist privé sur le
// compte GitHub de l'utilisateur. Tous les devices configurés avec le même Personal
// Access Token (PAT) lisent et écrivent ce Gist. Conflits = "last write wins"
// (timestamp ISO le plus récent gagne).
//
// Le PAT (équivalent d'un mot de passe spécifique scope=gist) reste dans localStorage
// du navigateur. Aucun serveur tiers — purement client → GitHub API.

const GIST_API = "https://api.github.com/gists";
const GIST_FILENAME = "matrix-bets-state.json";
const SYNC_AUTH_KEY = "matrix-bets-sync-auth-v1";

// ─── Persistance config (token + gist_id) ─────────────────────────
function loadSyncAuth() {
  try {
    const raw = localStorage.getItem(SYNC_AUTH_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function saveSyncAuth(auth) {
  localStorage.setItem(SYNC_AUTH_KEY, JSON.stringify(auth));
}

function clearSyncAuth() {
  localStorage.removeItem(SYNC_AUTH_KEY);
}

// ─── Helpers GitHub API ──────────────────────────────────────────
function ghHeaders(token) {
  return {
    "Authorization": "Bearer " + token,
    "Accept": "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

async function ghFetch(url, opts = {}) {
  const res = await fetch(url, opts);
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`GitHub API ${res.status} ${res.statusText} — ${txt.slice(0, 200)}`);
  }
  return res;
}

// Trouve un gist matrix-bets-state.json existant sur le compte. Renvoie l'ID ou null.
async function findGist(token) {
  const res = await ghFetch(`${GIST_API}?per_page=100`, { headers: ghHeaders(token) });
  const gists = await res.json();
  for (const g of gists) {
    if (g.files && g.files[GIST_FILENAME]) return g.id;
  }
  return null;
}

// Crée un nouveau gist privé contenant un state vide.
async function createGist(token, initialState) {
  const body = {
    description: "Matrix Bets — sync state multi-device",
    public: false,
    files: {
      [GIST_FILENAME]: { content: JSON.stringify(initialState, null, 2) },
    },
  };
  const res = await ghFetch(GIST_API, {
    method: "POST",
    headers: { ...ghHeaders(token), "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const j = await res.json();
  return j.id;
}

// Récupère le state distant depuis un gist. Renvoie le dict parsé ou null si vide.
async function pullGistState(token, gistId) {
  const res = await ghFetch(`${GIST_API}/${gistId}`, { headers: ghHeaders(token) });
  const j = await res.json();
  const f = j.files && j.files[GIST_FILENAME];
  if (!f) return null;
  let content = f.content;
  // GitHub tronque les gros gists ; si oui re-fetch via raw_url
  if (f.truncated && f.raw_url) {
    const rr = await fetch(f.raw_url);
    content = await rr.text();
  }
  try { return JSON.parse(content); }
  catch { return null; }
}

// Écrit le state dans le gist (overwrite complet du fichier).
async function pushGistState(token, gistId, state) {
  const body = {
    files: {
      [GIST_FILENAME]: { content: JSON.stringify(state, null, 2) },
    },
  };
  await ghFetch(`${GIST_API}/${gistId}`, {
    method: "PATCH",
    headers: { ...ghHeaders(token), "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// ─── API publique exposée via window.MatrixSync ─────────────────

// Configure le token : trouve ou crée le gist. Renvoie {token, gist_id}.
async function configureSync(token, initialState) {
  let gistId = await findGist(token);
  if (!gistId) {
    gistId = await createGist(token, initialState);
  }
  const auth = { token, gist_id: gistId, configured_at: new Date().toISOString() };
  saveSyncAuth(auth);
  return auth;
}

// Lit le state distant. Renvoie null si pas configuré ou gist vide.
async function pullRemote() {
  const auth = loadSyncAuth();
  if (!auth) return null;
  return await pullGistState(auth.token, auth.gist_id);
}

// Écrit le state local sur le gist. Met à jour updated_at automatiquement.
// Renvoie l'objet pushé.
async function pushLocal(localState) {
  const auth = loadSyncAuth();
  if (!auth) return null;
  const toSend = { ...localState, updated_at: new Date().toISOString() };
  await pushGistState(auth.token, auth.gist_id, toSend);
  return toSend;
}

// Renvoie l'auth courante ou null.
function getSyncAuth() {
  return loadSyncAuth();
}

// Efface la config (déconnexion).
function disconnectSync() {
  clearSyncAuth();
}

// Expose en global pour app.js (chargé en script classique, pas module)
window.MatrixSync = {
  configureSync,
  pullRemote,
  pushLocal,
  getSyncAuth,
  disconnectSync,
};
