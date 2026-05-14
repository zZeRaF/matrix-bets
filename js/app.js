// Matrix Bets — logique principale Alpine.js
// Tout le state vit ici. localStorage = bankroll + historique paris.

const STORE_KEY = "matrix-bets-state-v1";

// ════════════════════════════════════════════════════════════════
// SON HACK — Web Audio API synthétisé (beeps de terminal)
// ════════════════════════════════════════════════════════════════
let _audioCtx = null;
let _audioGainMaster = null;

function _ensureAudio() {
  if (_audioCtx) return _audioCtx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  _audioCtx = new AC();
  _audioGainMaster = _audioCtx.createGain();
  _audioGainMaster.gain.value = 1.0; // volume master max — beeps audibles
  _audioGainMaster.connect(_audioCtx.destination);
  return _audioCtx;
}

function _beep(freq, dur, type = "square", vol = 0.25, slide = null) {
  const ctx = _ensureAudio();
  if (!ctx) return;
  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (slide) osc.frequency.linearRampToValueAtTime(slide, t + dur);
  const attack = Math.min(0.003, dur * 0.1);
  const release = Math.min(0.01, dur * 0.3);
  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(vol, t + attack);
  gain.gain.setValueAtTime(vol, t + Math.max(attack, dur - release));
  gain.gain.linearRampToValueAtTime(0, t + dur);
  osc.connect(gain);
  gain.connect(_audioGainMaster);
  osc.start(t);
  osc.stop(t + dur + 0.05);
}

function _noise(dur, vol = 0.12, freq = 800) {
  // "Static" filtered : bruit blanc passé en band-pass pour effet radio
  const ctx = _ensureAudio();
  if (!ctx) return;
  const t = ctx.currentTime;
  const bufferSize = Math.floor(ctx.sampleRate * dur);
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * 0.5;
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  const filter = ctx.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = freq;
  filter.Q.value = 1.2;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(vol, t + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(filter);
  filter.connect(gain);
  gain.connect(_audioGainMaster);
  src.start(t);
  src.stop(t + dur + 0.02);
}

// Courbe de distortion (WaveShaper) pour ajouter du grain à l'audio
function _makeDistortion(amount = 40) {
  const curve = new Float32Array(44100);
  const deg = Math.PI / 180;
  for (let i = 0; i < 44100; i++) {
    const x = (i * 2) / 44100 - 1;
    curve[i] = ((3 + amount) * x * 20 * deg) / (Math.PI + amount * Math.abs(x));
  }
  return curve;
}

function playSplashSound() {
  const ctx = _ensureAudio();
  if (!ctx) return;
  if (ctx.state === "suspended") ctx.resume();

  // ─── CHAÎNE D'EFFETS : master → distortion → compressor → output
  //     avec delay/feedback parallèle pour effet "écho hack"
  const master = ctx.createGain();
  master.gain.value = 0.75;

  const compressor = ctx.createDynamicsCompressor();
  compressor.threshold.value = -18;
  compressor.knee.value = 18;
  compressor.ratio.value = 8;
  compressor.attack.value = 0.004;
  compressor.release.value = 0.16;

  const distortion = ctx.createWaveShaper();
  distortion.curve = _makeDistortion(22);
  distortion.oversample = "4x";

  const delay = ctx.createDelay();
  delay.delayTime.value = 0.085;
  const feedback = ctx.createGain();
  feedback.gain.value = 0.22;
  const delayGain = ctx.createGain();
  delayGain.gain.value = 0.18;

  delay.connect(feedback);
  feedback.connect(delay);
  delay.connect(delayGain);

  master.connect(distortion);
  distortion.connect(compressor);
  compressor.connect(_audioGainMaster);
  delayGain.connect(compressor);

  // ─── Helpers locaux (envelope + sources)
  function envGain(time, dur, peak = 0.3) {
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, time);
    g.gain.exponentialRampToValueAtTime(peak, time + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, time + dur);
    return g;
  }

  function tone(time, freq, dur, type = "square", gain = 0.28) {
    const osc = ctx.createOscillator();
    const g = envGain(time, dur, gain);
    const filter = ctx.createBiquadFilter();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, time);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.92, time + dur);
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(freq * 1.7, time);
    filter.Q.value = 7;
    osc.connect(filter);
    filter.connect(g);
    g.connect(master);
    g.connect(delay);
    osc.start(time);
    osc.stop(time + dur + 0.02);
  }

  function fmHit(time, base = 210, dur = 0.42) {
    const carrier = ctx.createOscillator();
    const mod = ctx.createOscillator();
    const modGain = ctx.createGain();
    const g = envGain(time, dur, 0.26);
    const filter = ctx.createBiquadFilter();
    carrier.type = "sawtooth";
    mod.type = "square";
    carrier.frequency.setValueAtTime(base, time);
    carrier.frequency.exponentialRampToValueAtTime(base * 0.55, time + dur);
    mod.frequency.value = 38;
    modGain.gain.setValueAtTime(95, time);
    modGain.gain.exponentialRampToValueAtTime(8, time + dur);
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(1300, time);
    filter.frequency.exponentialRampToValueAtTime(360, time + dur);
    filter.Q.value = 6;
    mod.connect(modGain);
    modGain.connect(carrier.frequency);
    carrier.connect(filter);
    filter.connect(g);
    g.connect(master);
    mod.start(time);
    carrier.start(time);
    mod.stop(time + dur);
    carrier.stop(time + dur);
  }

  function noiseTick(time, dur = 0.055) {
    const len = Math.floor(ctx.sampleRate * dur);
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.4);
    }
    const src = ctx.createBufferSource();
    const filter = ctx.createBiquadFilter();
    const g = envGain(time, dur, 0.18);
    src.buffer = buffer;
    filter.type = "bandpass";
    filter.frequency.value = 2600 + Math.random() * 1200;
    filter.Q.value = 12;
    src.connect(filter);
    filter.connect(g);
    g.connect(master);
    g.connect(delay);
    src.start(time);
  }

  // ─── Pattern hacking alert : 5 bars de 0.82s + finale
  const t = ctx.currentTime + 0.05;
  for (let bar = 0; bar < 5; bar++) {
    const o = t + bar * 0.82;
    tone(o + 0.00, 980, 0.075, "square", 0.26);
    tone(o + 0.095, 740, 0.075, "square", 0.24);
    tone(o + 0.19, 980, 0.075, "square", 0.26);
    noiseTick(o + 0.285, 0.045);
    fmHit(o + 0.35, 170, 0.34);
    tone(o + 0.60, 1320, 0.045, "sawtooth", 0.16);
    noiseTick(o + 0.66, 0.035);
  }
  const end = t + 4.35;
  fmHit(end, 120, 0.7);
  tone(end + 0.08, 440, 0.35, "sawtooth", 0.18);
  tone(end + 0.14, 880, 0.28, "square", 0.12);
}

// Alias pour compat
const playHackSequence = playSplashSound;


function loadStoredState() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function saveStoredState(state) {
  try {
    localStorage.setItem(
      STORE_KEY,
      JSON.stringify({
        bankroll: state.bankroll,
        peak: state.peak,
        history: state.history,
        updated_at: state.updated_at,
      })
    );
  } catch {}
}

// ─── Matrix Rain (canvas) ───
// useClientSize=true : remplit le canvas selon sa taille DOM (pas fullscreen)
function startMatrixRain(canvas, useClientSize = false) {
  const ctx = canvas.getContext("2d");
  const getSize = () => useClientSize
    ? [canvas.clientWidth || 1, canvas.clientHeight || 1]
    : [window.innerWidth, window.innerHeight];
  let [w, h] = getSize();
  canvas.width = w;
  canvas.height = h;
  const onResize = () => {
    [w, h] = getSize();
    canvas.width = w;
    canvas.height = h;
  };
  window.addEventListener("resize", onResize);

  const fontSize = 16;
  const cols = Math.floor(w / fontSize);
  const drops = Array(cols).fill(0).map(() => Math.random() * -100);
  const chars = "アァカサタナハマヤラワABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789$_/<>";

  function draw() {
    // Trail effect : fond noir semi-transparent qui s'accumule
    ctx.fillStyle = "rgba(0, 16, 0, 0.08)";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "#00FF66";
    ctx.font = fontSize + "px monospace";
    for (let i = 0; i < drops.length; i++) {
      const c = chars[Math.floor(Math.random() * chars.length)];
      const x = i * fontSize;
      const y = drops[i] * fontSize;
      // Tête plus lumineuse
      ctx.fillStyle = "#A8FFCB";
      ctx.fillText(c, x, y);
      ctx.fillStyle = "#00FF66";
      ctx.fillText(c, x, y - fontSize);
      // Reset quand on dépasse + un peu d'aléatoire
      if (y > h && Math.random() > 0.975) drops[i] = 0;
      drops[i] += 1;
    }
  }
  const interval = setInterval(draw, 50);
  return () => {
    clearInterval(interval);
    window.removeEventListener("resize", onResize);
  };
}

// LocalStorage : univers actif (foot/basket/tennis) — persistant entre sessions
const UNIVERSE_KEY = "matrix-bets-universe-v1";
const VALID_UNIVERSES = ["foot", "basket", "tennis"];
function loadUniverse() {
  try {
    const u = localStorage.getItem(UNIVERSE_KEY);
    return VALID_UNIVERSES.includes(u) ? u : "foot";
  } catch { return "foot"; }
}
function saveUniverse(u) {
  try { localStorage.setItem(UNIVERSE_KEY, u); } catch {}
}

function app() {
  return {
    // === Multi-sport : univers actif ===
    currentUniverse: "foot",  // foot | basket | tennis (chargé depuis localStorage en init)
    showUniverseMenu: false,  // overlay menu DA artistique

    // === Persistant (localStorage) ===
    bankroll: 100,
    peak: 100,
    history: [],
    updated_at: null,        // ISO timestamp dernière modif locale (pour réconcilier vs gist)

    // === Sync GitHub Gist (volatile, recharge à chaque ouverture) ===
    syncAuth: null,          // {token, gist_id, configured_at} si configuré
    syncStatus: "idle",      // idle | syncing | error | pulled | pushed
    syncLastAt: null,        // timestamp dernier succès sync (ISO)
    syncError: null,         // message d'erreur si syncStatus='error'
    showSyncModal: false,    // affichage modal config sync
    syncTokenInput: "",      // contenu input token dans modal

    // === Volatile (par session) ===
    data: null,
    pipelineStatus: null,    // contenu de data/pipeline_status.json (santé du run nocturne)
    state: "loading", // loading | ok | empty | error
    errorMsg: "",
    tab: "paris",

    // Vue détail match
    currentView: "feed",            // "feed" ou "detail"
    selectedMatchSlug: null,
    detailSubtab: "analyse",        // "analyse" ou "pari"
    selectedLayer: null,            // null | "consensus" | "macro" | "meso" | "micro" | "news"
    coteInputs: {},                 // { [pari.rank]: cote saisie utilisateur } (réactif Alpine)
    miseInputs: {},                 // { [pari.rank]: mise saisie utilisateur } (éditable, défaut = Kelly)

    // === Splash ===
    showSplash: true,
    splashFading: false,
    splashTitle: "",
    splashLog: [],
    splashProgress: 0,
    splashSkipAvailable: false,
    audioStarted: false,
    audioAvailable: false,
    _splashStopRain: null,
    _splashCancelled: false,

    async init() {
      this.currentUniverse = loadUniverse();
      // Affiche le menu IMMÉDIATEMENT (sous le splash, z-index inférieur).
      // Quand le splash se ferme, le menu est déjà rendu et hermétique :
      // pas de flash possible vers le contenu d'un univers.
      this.showUniverseMenu = true;
      const saved = loadStoredState();
      if (saved) {
        this.bankroll = saved.bankroll ?? 100;
        this.peak = saved.peak ?? Math.max(saved.bankroll ?? 100, 100);
        this.history = saved.history ?? [];
        this.updated_at = saved.updated_at ?? null;
      }
      // Sync GitHub Gist (best-effort, ne bloque pas l'init si erreur)
      this.syncAuth = (window.MatrixSync && window.MatrixSync.getSyncAuth()) || null;
      if (this.syncAuth) {
        // pull au démarrage + polling 30s
        this.pullAndApply().catch(() => {});
        setInterval(() => { this.pullAndApply().catch(() => {}); }, 30000);
      }
      this.detectAudio();
      // Tente d'auto-démarrer l'audio (peut être bloqué selon navigateur)
      this.tryAutoStartAudio();
      // Fallback : tout premier geste utilisateur (souris/tap/touche/scroll) → démarre l'audio
      const triggers = ["pointerdown", "touchstart", "keydown", "mousemove", "wheel"];
      const fallback = () => {
        triggers.forEach((ev) => document.removeEventListener(ev, fallback, true));
        if (!this.audioStarted) this.enableAudio();
      };
      triggers.forEach((ev) => document.addEventListener(ev, fallback, true));
      this.startSplash();
      this.loadData();
    },

    tryAutoStartAudio() {
      // Tente l'autoplay sans interaction (souvent bloqué — fallback existe)
      try {
        const ctx = _ensureAudio();
        if (!ctx) return;
        const start = () => {
          if (this.audioStarted) return;
          playSplashSound();
          this.audioStarted = true;
        };
        if (ctx.state === "suspended") {
          ctx.resume().then(start).catch(() => {});
        } else {
          start();
        }
      } catch {}
    },

    async detectAudio() {
      this.audioAvailable = !!(window.AudioContext || window.webkitAudioContext);
      this._audioDetectionDone = false;
      const bust = Math.floor(Date.now() / 1000 / 3600);
      const extensions = ["mp3", "m4a", "wav", "aac", "ogg"];
      for (const ext of extensions) {
        const url = `audio/intro.${ext}?v=${bust}`;
        try {
          const res = await fetch(url, { method: "HEAD", cache: "no-cache" });
          if (res.ok) {
            const audio = document.getElementById("splash-audio");
            if (audio) audio.src = url;
            break;
          }
        } catch {}
      }
      this._audioDetectionDone = true;
    },

    async enableAudio() {
      if (this.audioStarted) return;
      // Attendre que la détection du fichier audio soit terminée (max 1.5s)
      // pour éviter de fallback sur le Codex synthétisé alors que le fichier
      // perso est en cours de détection.
      for (let i = 0; i < 30; i++) {
        if (this._audioDetectionDone) break;
        await sleep(50);
      }
      const audio = document.getElementById("splash-audio");
      if (audio && audio.src) {
        audio.volume = 1.0;
        audio.play().then(() => {
          this.audioStarted = true;
        }).catch((e) => {
          console.warn("Audio play failed:", e);
          this._playSynthSound();
        });
        return;
      }
      this._playSynthSound();
    },

    _playSynthSound() {
      try {
        const ctx = _ensureAudio();
        if (!ctx) return;
        const start = () => {
          if (this.audioStarted) return;
          playSplashSound();
          this.audioStarted = true;
        };
        if (ctx.state === "suspended") {
          ctx.resume().then(start).catch(start);
        } else {
          start();
        }
      } catch {}
    },

    async startSplash() {
      // Démarre la pluie Matrix
      await this.$nextTick();
      const canvas = document.getElementById("matrix-rain");
      if (canvas) {
        this._splashStopRain = startMatrixRain(canvas);
      }

      // ── BUDGET TOTAL : 5 200ms (matche les 5s du pattern audio + finale) ──
      // Typewriter "$MATRIX BET$" : 600ms
      // Log lines (6)            : 1 500ms cumul
      // Pause finale             : 2 500ms
      // Fade out                 : 600ms
      // SKIP visible dès         : 1 500ms

      setTimeout(() => { this.splashSkipAvailable = true; }, 1500);

      // Typewriter simple stable
      const title = "$MATRIX BET$";
      for (let i = 1; i <= title.length; i++) {
        if (this._splashCancelled) return;
        this.splashTitle = title.slice(0, i);
        await sleep(50);
      }
      if (this._splashCancelled) return;

      // 6 log lines sur 1.5s
      const steps = [
        { text: "INIT SHELL...", delay: 220 },
        { text: "CONNEXION GITHUB...", delay: 220 },
        { text: "FETCH TOP_DU_JOUR...", delay: 250 },
        { text: "PARSE ANALYSES 4 COUCHES...", delay: 260 },
        { text: "CALCUL KELLY /4...", delay: 250 },
        { text: "READY.", delay: 300 },
      ];
      for (let i = 0; i < steps.length; i++) {
        if (this._splashCancelled) return;
        this.splashLog.push({ text: steps[i].text, status: "wait" });
        this.splashProgress = Math.round((i / steps.length) * 100);
        await sleep(steps[i].delay);
        this.splashLog[i].status = "ok";
      }
      this.splashProgress = 100;

      // Pause finale (montre "BeTime" + laisse le pattern audio finir)
      await sleep(2500);
      if (this._splashCancelled) return;

      this.closeSplash();
    },

    skipSplash() {
      this._splashCancelled = true;
      this.closeSplash();
    },

    startBgRain() {
      const canvas = document.getElementById("bg-rain");
      if (!canvas || canvas._rainStarted) return;
      startMatrixRain(canvas, false); // false = utilise window.innerWidth/Height
      canvas._rainStarted = true;
      // Fade-in opacité une fois l'animation lancée
      requestAnimationFrame(() => canvas.classList.add("active"));
    },

    async closeSplash() {
      if (this.splashFading) return;
      this.splashFading = true;
      // Démarre la pluie matrix de fond pendant le fade
      this.startBgRain();

      // Fade out audio via volume property (sync avec fade visuel 600ms)
      const audio = document.getElementById("splash-audio");
      const fadeDur = 600;
      if (audio && !audio.paused) {
        const startVol = audio.volume;
        const steps = 24;
        const stepDur = fadeDur / steps;
        (async () => {
          for (let i = 1; i <= steps; i++) {
            audio.volume = Math.max(0, startVol * (1 - i / steps));
            await sleep(stepDur);
          }
          audio.pause();
          audio.currentTime = 0;
        })();
      }

      await sleep(fadeDur);

      this.showSplash = false;
      const splashEl = document.getElementById("splash");
      if (splashEl) splashEl.style.display = "none";
      if (this._splashStopRain) this._splashStopRain();
      if (window.stopThreeScene) window.stopThreeScene();
      // Note : showUniverseMenu = true déjà set dès init() pour éviter le flash.
    },

    // Change l'univers actif (foot/basket/tennis) — persiste + recharge data.
    switchUniverse(u) {
      if (!VALID_UNIVERSES.includes(u) || u === this.currentUniverse) return;
      this.currentUniverse = u;
      saveUniverse(u);
      // Reset état dépendant de l'univers
      this.currentView = "feed";
      this.selectedMatchSlug = null;
      this.selectedLayer = null;
      this.coteInputs = {};
      this.miseInputs = {};
      this.loadData();
    },

    async loadData() {
      this.state = "loading";
      this.errorMsg = "";
      // Fetch latest.json multi-sport + pipeline_status.json en parallèle.
      // URL dépend de l'univers actif. Fallback foot : data/latest.json (back-compat)
      const ts = Math.floor(Date.now() / 1000 / 60); // cache-buster /minute
      const universeUrl = `data/${this.currentUniverse}/latest.json?_=${ts}`;
      const fallbackUrl = this.currentUniverse === "foot" ? `data/latest.json?_=${ts}` : null;
      try {
        let resData = await fetch(universeUrl, { cache: "no-store" });
        if (!resData.ok && fallbackUrl) {
          resData = await fetch(fallbackUrl, { cache: "no-store" });
        }
        const resStatus = await fetch(`data/pipeline_status.json?_=${ts}`, { cache: "no-store" }).catch(() => null);
        if (!resData.ok) throw new Error("HTTP " + resData.status);
        const json = await resData.json();
        this.data = json;
        // Status pipeline (best-effort, ne casse pas l'app si absent ou invalide)
        if (resStatus && resStatus.ok) {
          try { this.pipelineStatus = await resStatus.json(); }
          catch { this.pipelineStatus = null; }
        } else {
          this.pipelineStatus = null;
        }
        const newCotes = {};
        const newMises = {};
        (json.top || []).forEach((p) => {
          const cote = p.cote_reelle || p.cote_estimee || "";
          newCotes[p.rank] = cote.toString();
          // Mise par défaut = Kelly calculé sur bankroll actuelle + cote actuelle
          // (l'utilisateur peut la modifier librement avant de placer)
          const mise = this.computeMise(p, parseFloat(cote) || null);
          newMises[p.rank] = mise > 0 ? mise.toFixed(2) : "";
        });
        this.coteInputs = newCotes;
        this.miseInputs = newMises;
        this.state = !json.top || json.top.length === 0 ? "empty" : "ok";
      } catch (e) {
        this.state = "error";
        this.errorMsg = e.message || String(e);
      }
    },

    // ═══════════════════════════════════════════════════
    // SANTÉ PIPELINE — bandeau d'alerte en haut du feed
    // ═══════════════════════════════════════════════════

    // Retourne {level, title, detail, step} si problème, sinon null.
    // level : "fail" (rouge) ou "warn" (orange).
    pipelineHealthMsg() {
      const todayIso = new Date().toISOString().split("T")[0];
      const dataDate = this.data?.date;
      // 1. Pipeline status FAIL → bandeau rouge prioritaire
      if (this.pipelineStatus && this.pipelineStatus.overall_status === "FAIL") {
        const step = this.pipelineStatus.error_step || "?";
        const summary = this.pipelineStatus.error_summary || "Erreur inconnue";
        return {
          level: "fail",
          title: "⚠ PIPELINE EN ÉCHEC",
          detail: `Étape « ${step} » a échoué : ${summary}`,
          step,
          time: this.pipelineStatus.last_update_at || this.pipelineStatus.last_run_at,
        };
      }
      // 2. Données obsolètes (latest.json date < aujourd'hui) → bandeau orange
      if (dataDate && dataDate < todayIso) {
        return {
          level: "warn",
          title: "⚠ DONNÉES OBSOLÈTES",
          detail: `Affichage du TOP ${this.formatDateFr(dataDate)} — pipeline du jour pas (encore) exécuté.`,
          step: null,
          time: this.pipelineStatus?.last_run_at,
        };
      }
      // 3. Dernier run > 24h → bandeau orange (cas pipeline stoppé depuis longtemps)
      if (this.pipelineStatus?.last_run_at) {
        const lastMs = new Date(this.pipelineStatus.last_run_at).getTime();
        const ageH = (Date.now() - lastMs) / (1000 * 3600);
        if (ageH > 24) {
          return {
            level: "warn",
            title: "⚠ DERNIER RUN ANCIEN",
            detail: `Dernier pipeline il y a ${ageH.toFixed(0)} h.`,
            step: null,
            time: this.pipelineStatus.last_run_at,
          };
        }
      }
      return null;
    },

    // Étiquette FR pour une étape pipeline
    stepLabel(s) {
      return {
        collecte: "Collecte (Footystats + Flashscore + FotMob)",
        analyses: "Analyses 4 couches + TOP10",
        pwa: "Génération données PWA foot",
        basket: "Pipeline basket (NBA)",
        tennis: "Pipeline tennis (ATP + WTA)",
        push: "Push GitHub Pages",
      }[s] || s;
    },

    // Formate un timestamp ISO en HH:MM locale, sinon "—"
    fmtTime(iso) {
      if (!iso) return "—";
      try {
        const d = new Date(iso);
        return d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
      } catch { return iso; }
    },

    fmtEur(v) {
      if (v == null || isNaN(v)) return "—";
      return v.toFixed(2) + "€";
    },

    formatDateFr(iso) {
      if (!iso) return "";
      const [y, m, d] = iso.split("-");
      return `${d}/${m}/${y}`;
    },

    ruleClass(rule_id) {
      if (rule_id === "R1") return "rule-r1";
      if (rule_id === "R2") return "rule-r2";
      if (rule_id === "R3") return "rule-r3";
      return "rule-other";
    },

    openDetail(slug) {
      this.selectedMatchSlug = slug;
      this.currentView = "detail";
      this.detailSubtab = "analyse";
      // Scroll en haut de la vue
      window.scrollTo({ top: 0, behavior: "instant" });
    },

    backToFeed() {
      this.currentView = "feed";
      this.selectedMatchSlug = null;
      this.selectedLayer = null;
    },

    // Ouvre la vue HTML détaillée d'une couche (iframe sur data/<date>/<slug>/<layer>.html)
    openLayer(layerKey) {
      if (!this.hasLayerHtml(layerKey)) return;
      this.selectedLayer = layerKey;
      document.body.classList.add("layer-open");
    },

    closeLayer() {
      this.selectedLayer = null;
      document.body.classList.remove("layer-open");
    },

    hasLayerHtml(layerKey) {
      const m = this.selectedMatch();
      if (!m) return false;
      const list = m.layers_html_available || [];
      return list.includes(layerKey);
    },

    layerHtmlUrl(layerKey) {
      if (!layerKey || !this.data || !this.selectedMatchSlug) return "";
      const date = this.data.date;
      const slug = this.selectedMatchSlug;
      // Cache-buster fort : combine pivot generated_at + Date.now() pour forcer
      // un fetch réseau à chaque ouverture (les iframes Chrome ont un cache HTTP
      // très tenace qui ignore parfois les bumps de service worker).
      const pivot_v = this.data.generated_at ? encodeURIComponent(this.data.generated_at) : "0";
      const t = Date.now();
      return `data/${date}/${slug}/${layerKey}.html?v=${pivot_v}&t=${t}`;
    },

    layerLabel(key) {
      return {
        consensus: "CONSENSUS · synthèse",
        macro: "MACRO · saison entière",
        meso: "MESO · 10 derniers matchs",
        micro: "MICRO · rapport forces XI",
        news: "NEWS · contexte qualitatif",
      }[key] || (key || "").toUpperCase();
    },

    selectedMatch() {
      if (!this.data || !this.selectedMatchSlug) return null;
      return (this.data.matches || {})[this.selectedMatchSlug] || null;
    },

    // Paris liés à ce match dans le TOP (peut y avoir plusieurs : 1X2 + OU + joueur)
    selectedMatchBets() {
      if (!this.data || !this.selectedMatchSlug) return [];
      return (this.data.top || []).filter(p => p.match_slug === this.selectedMatchSlug);
    },

    // Helpers de formatage pour la vue détail
    fmtNum(v, decimals = 2) {
      if (v == null || isNaN(v)) return "—";
      return Number(v).toFixed(decimals);
    },
    fmtPct(v, decimals = 1) {
      if (v == null || isNaN(v)) return "—";
      return (Number(v) * 100).toFixed(decimals) + "%";
    },
    fmtSigned(v, decimals = 2) {
      if (v == null || isNaN(v)) return "—";
      const n = Number(v);
      return (n >= 0 ? "+" : "") + n.toFixed(decimals);
    },

    editBankroll() {
      const cur = this.bankroll.toFixed(2);
      const v = prompt("Bankroll actuelle (€) :", cur);
      if (v == null) return;
      const n = parseFloat(v);
      if (isNaN(n) || n < 0) return;
      this.bankroll = n;
      if (n > this.peak) this.peak = n;
      this._saveAndSync();
    },

    // ═══════════════════════════════════════════════════
    // GESTION DES PARIS PLACÉS — vue détail onglet PARI
    // ═══════════════════════════════════════════════════

    // Liste tous les paris en attente de résolution (status='placed'), du plus récent au plus ancien
    pendingBets() {
      return this.history
        .filter((b) => b.status === "placed")
        .sort((a, b) => (b.placed_at || "").localeCompare(a.placed_at || ""));
    },

    // Liste tous les paris résolus (won/lost), du plus récent au plus ancien
    // Source de vérité pour l'onglet "Mes Paris" → section TERMINÉS.
    resolvedBets() {
      return this.history
        .filter((b) => b.status === "won" || b.status === "lost")
        .sort((a, b) => (b.placed_at || "").localeCompare(a.placed_at || ""));
    },

    // Stats agrégées sur l'ensemble de l'historique résolu (pour le bandeau en tête de l'onglet)
    betStats() {
      const resolved = this.resolvedBets();
      const won = resolved.filter((b) => b.status === "won");
      const lost = resolved.filter((b) => b.status === "lost");
      const totalProfit = resolved.reduce((s, b) => s + (b.profit || 0), 0);
      const totalMise = resolved.reduce((s, b) => s + (b.mise || 0), 0);
      return {
        n_total: resolved.length,
        n_won: won.length,
        n_lost: lost.length,
        n_pending: this.pendingBets().length,
        profit_net: totalProfit,
        win_rate: resolved.length > 0 ? won.length / resolved.length : 0,
        roi: totalMise > 0 ? totalProfit / totalMise : 0,
      };
    },

    // Libellé "Aujourd'hui" / "Hier" / "DD/MM" pour une date YYYY-MM-DD
    fmtDateLabel(iso) {
      if (!iso) return "";
      const d = String(iso).split("T")[0];
      const today = new Date();
      const todayIso = today.toISOString().split("T")[0];
      if (d === todayIso) return "Aujourd'hui";
      const yest = new Date(today);
      yest.setDate(yest.getDate() - 1);
      if (d === yest.toISOString().split("T")[0]) return "Hier";
      const [, m, dd] = d.split("-");
      return dd + "/" + m;
    },


    // Clé d'identification d'un pari (combinaison match + règle + verdict)
    _betKey(date, slug, rule_id, verdict) {
      return `${date}|${slug}|${rule_id}|${verdict}`;
    },

    // Retourne l'entrée history correspondant à un pari du TOP, ou null
    getBetForPari(pari) {
      if (!pari || !this.data) return null;
      const key = this._betKey(this.data.date, pari.match_slug, pari.rule_id, pari.verdict);
      return this.history.find((b) => b.key === key) || null;
    },

    // Kelly recalculé avec une cote saisie utilisateur
    computeKelly(proba, cote, divisor = 4, cap = 0.07) {
      if (!cote || cote <= 1 || !proba || proba <= 0 || proba >= 1) return 0;
      const b = cote - 1;
      const q = 1 - proba;
      const f_full = (b * proba - q) / b;
      if (f_full <= 0) return 0;
      let f = f_full / divisor;
      if (f > cap) f = cap;
      return f;
    },

    // Kelly théorique non plafonné (pour détecter si le cap agit)
    computeKellyRaw(proba, cote, divisor = 4) {
      if (!cote || cote <= 1 || !proba || proba <= 0 || proba >= 1) return 0;
      const b = cote - 1;
      const q = 1 - proba;
      const f_full = (b * proba - q) / b;
      if (f_full <= 0) return 0;
      return f_full / divisor;
    },

    // Mise en € calculée selon la cote réelle saisie + bankroll actuelle
    computeMise(pari, coteReelle) {
      if (!pari || !coteReelle) return 0;
      const divisor = pari.rule_id === "R3" ? 8 : 4;
      const f = this.computeKelly(pari.proba_validee, coteReelle, divisor);
      return Math.round(this.bankroll * f * 100) / 100;
    },

    // True si la mise est plafonnée par le cap 7% (= Kelly théorique > cap)
    isMiseCapped(pari, coteReelle) {
      if (!pari || !coteReelle) return false;
      const divisor = pari.rule_id === "R3" ? 8 : 4;
      const raw = this.computeKellyRaw(pari.proba_validee, coteReelle, divisor);
      return raw > 0.07;
    },

    // Place un pari → entry history avec status='placed'
    // miseOverride : si fourni, écrase la mise calculée Kelly. Sinon Kelly auto.
    placeBet(pari, coteReelle, miseOverride = null) {
      if (!pari || !coteReelle || coteReelle <= 1) {
        alert("Cote invalide (doit être > 1).");
        return;
      }
      if (this.getBetForPari(pari)) {
        alert("Ce pari a déjà été placé.");
        return;
      }
      let mise;
      if (miseOverride && miseOverride > 0) {
        mise = Math.round(miseOverride * 100) / 100;
        // Avertit si supérieur au cap 7% bankroll (mais autorise)
        const cap = Math.round(this.bankroll * 0.07 * 100) / 100;
        if (mise > cap) {
          if (!confirm(`Mise saisie (${mise.toFixed(2)}€) > cap 7% bankroll (${cap.toFixed(2)}€). Confirmer quand même ?`)) return;
        }
      } else {
        mise = this.computeMise(pari, coteReelle);
        if (mise <= 0) {
          alert("Mise calculée = 0 (cote trop basse ou proba trop faible). Pari non rentable.");
          return;
        }
      }
      const entry = {
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
        key: this._betKey(this.data.date, pari.match_slug, pari.rule_id, pari.verdict),
        date: this.data.date,
        match_slug: pari.match_slug,
        home: pari.home_team,
        away: pari.away_team,
        competition: pari.competition,
        rule_id: pari.rule_id,
        rule_label: pari.rule_label,
        bet_type: pari.bet_type,
        verdict: pari.verdict,
        cote_book: coteReelle,
        proba: pari.proba_validee,
        mise: mise,
        kelly_fraction: this.computeKelly(pari.proba_validee, coteReelle,
                                          pari.rule_id === "R3" ? 8 : 4),
        status: "placed",
        profit: 0,
        placed_at: new Date().toISOString(),
        resolved_at: null,
      };
      this.history.push(entry);
      this._saveAndSync();
    },

    // Marque un pari comme gagné ou perdu, ajuste bankroll
    resolveBet(betId, outcome) {
      const bet = this.history.find((b) => b.id === betId);
      if (!bet || bet.status !== "placed") return;
      if (outcome !== "won" && outcome !== "lost") return;
      if (outcome === "won") {
        bet.profit = Math.round(bet.mise * (bet.cote_book - 1) * 100) / 100;
        this.bankroll = Math.round((this.bankroll + bet.profit) * 100) / 100;
      } else {
        bet.profit = -bet.mise;
        this.bankroll = Math.round((this.bankroll + bet.profit) * 100) / 100;
      }
      bet.status = outcome;
      bet.resolved_at = new Date().toISOString();
      if (this.bankroll > this.peak) this.peak = this.bankroll;
      this._saveAndSync();
    },

    // Annuler un pari placé (avant résolution) — au cas où erreur de saisie
    cancelBet(betId) {
      const idx = this.history.findIndex((b) => b.id === betId);
      if (idx < 0) return;
      if (this.history[idx].status !== "placed") return;
      if (!confirm("Annuler ce pari (mise non engagée) ?")) return;
      this.history.splice(idx, 1);
      this._saveAndSync();
    },

    // ═══════════════════════════════════════════════════
    // SYNC GITHUB GIST — multi-device
    // ═══════════════════════════════════════════════════

    // Helper appelé après chaque modif locale : save localStorage + push gist (non bloquant).
    _saveAndSync() {
      this.updated_at = new Date().toISOString();
      saveStoredState(this);
      this.pushNow().catch(() => {}); // fire-and-forget
    },

    // Snapshot du state actuel (ce qu'on persiste / sync)
    _stateSnapshot() {
      return {
        bankroll: this.bankroll,
        peak: this.peak,
        history: this.history,
        updated_at: this.updated_at,
      };
    },

    // Push le state actuel vers le gist. Mise à jour syncStatus / syncLastAt.
    async pushNow() {
      if (!this.syncAuth || !window.MatrixSync) return;
      this.syncStatus = "syncing";
      try {
        const pushed = await window.MatrixSync.pushLocal(this._stateSnapshot());
        if (pushed && pushed.updated_at) {
          this.updated_at = pushed.updated_at;
          saveStoredState(this);
        }
        this.syncStatus = "pushed";
        this.syncLastAt = new Date().toISOString();
        this.syncError = null;
      } catch (e) {
        this.syncStatus = "error";
        this.syncError = e.message || String(e);
      }
    },

    // Force un push de l'état actuel (bankroll + history) avec updated_at = maintenant.
    // Utile pour résoudre un conflit de sync : on impose la version de CE device au cloud
    // SANS modifier le state lui-même (pari LA Galaxy reste bien marqué perdu, etc.).
    async forcePushNow() {
      if (!this.syncAuth) { alert("Sync non configurée"); return; }
      if (!confirm("Forcer la mise sur le Gist de la bankroll + historique actuels de CE device ?\n\nLes autres devices écraseront leur version par celle-ci au prochain pull (30s ou bouton « ↻ Forcer sync »).")) return;
      this.updated_at = new Date().toISOString();
      saveStoredState(this);
      await this.pushNow();
      if (this.syncStatus !== "error") {
        alert("✓ État poussé. Va sur ton autre device → Stats → « ↻ Forcer sync ».");
      }
    },

    // Pull du gist et applique si plus récent que local.
    async pullAndApply() {
      if (!this.syncAuth || !window.MatrixSync) return;
      this.syncStatus = "syncing";
      try {
        const remote = await window.MatrixSync.pullRemote();
        if (!remote) {
          // Gist vide : push notre local
          await this.pushNow();
          return;
        }
        const localTs = this.updated_at || "1970-01-01T00:00:00";
        const remoteTs = remote.updated_at || "1970-01-01T00:00:00";
        if (remoteTs > localTs) {
          // Distant plus récent → on adopte
          this.bankroll = remote.bankroll ?? this.bankroll;
          this.peak = remote.peak ?? this.peak;
          this.history = remote.history ?? [];
          this.updated_at = remote.updated_at;
          saveStoredState(this);
          this.syncStatus = "pulled";
        } else if (localTs > remoteTs) {
          // Local plus récent → push
          await this.pushNow();
          return;
        } else {
          this.syncStatus = "pushed"; // déjà synchro
        }
        this.syncLastAt = new Date().toISOString();
        this.syncError = null;
      } catch (e) {
        this.syncStatus = "error";
        this.syncError = e.message || String(e);
      }
    },

    // Modal config sync
    openSyncModal() {
      this.syncTokenInput = "";
      this.showSyncModal = true;
    },

    closeSyncModal() {
      this.showSyncModal = false;
      this.syncTokenInput = "";
    },

    // Connecte un token : trouve ou crée le gist, démarre la sync.
    // IMPORTANT : à la connexion, on PRIVILÉGIE le gist existant (s'il a du contenu)
    // plutôt que de comparer naïvement les timestamps. Sinon un device récemment
    // modifié écraserait la version cloud légitime des autres devices.
    async connectSync() {
      const token = (this.syncTokenInput || "").trim();
      if (!token) { alert("Colle ton Personal Access Token GitHub d'abord."); return; }
      if (!window.MatrixSync) { alert("Module sync non chargé"); return; }
      this.syncStatus = "syncing";
      try {
        this.syncAuth = await window.MatrixSync.configureSync(token, this._stateSnapshot());
        // Pull le gist : si contenu présent, on l'adopte INCONDITIONNELLEMENT (priorité cloud).
        // Si gist vide (nouvelle config), on push notre state local.
        const remote = await window.MatrixSync.pullRemote();
        if (remote && (remote.history !== undefined || remote.bankroll !== undefined)) {
          const hasContent = (remote.history && remote.history.length > 0)
                          || (remote.bankroll !== undefined && remote.bankroll !== 100);
          if (hasContent) {
            // Adopter le gist existant (autre device a déjà configuré)
            this.bankroll = remote.bankroll ?? this.bankroll;
            this.peak = remote.peak ?? this.peak;
            this.history = remote.history ?? [];
            this.updated_at = remote.updated_at;
            saveStoredState(this);
            this.syncStatus = "pulled";
            this.syncLastAt = new Date().toISOString();
          } else {
            // Gist quasi-vide : on push notre local
            await this.pushNow();
          }
        } else {
          await this.pushNow();
        }
        this.closeSyncModal();
        // Démarrer le polling 30s
        setInterval(() => { this.pullAndApply().catch(() => {}); }, 30000);
      } catch (e) {
        this.syncStatus = "error";
        this.syncError = e.message || String(e);
        alert("Échec connexion : " + this.syncError + "\n\nVérifie que le token a bien le scope 'gist' et qu'il est valide.");
      }
    },

    // Déconnecte (efface la config sync). N'efface PAS bankroll/history.
    disconnectSyncAction() {
      if (!confirm("Déconnecter la synchro ? Ta bankroll et ton historique restent sur ce device, mais ne seront plus synchronisés avec tes autres appareils.")) return;
      if (window.MatrixSync) window.MatrixSync.disconnectSync();
      this.syncAuth = null;
      this.syncStatus = "idle";
      this.syncLastAt = null;
      this.syncError = null;
    },

    // Label FR pour syncStatus
    syncStatusLabel() {
      return {
        idle: "Non configuré",
        syncing: "Synchronisation…",
        pushed: "✓ À jour",
        pulled: "✓ Synchronisé (data importée)",
        error: "⚠ Erreur",
      }[this.syncStatus] || this.syncStatus;
    },

    // ═══════════════════════════════════════════════════
    // STATS AVANCÉES — onglet Stats
    // Toutes les fonctions ci-dessous lisent this.history (paris résolus)
    // et produisent des agrégats pour les graphes + tableaux comparatifs.
    // ═══════════════════════════════════════════════════

    // Cibles backtest officielles (rétroactif 152 matchs) — base de comparaison
    BACKTEST_TARGETS: {
      R1: { win_rate: 0.737, roi: 0.221, sample: 19, cote_moy_gagnes: 1.66 },
      R2: { win_rate: 0.800, roi: 0.153, sample: 15, cote_moy_gagnes: 1.44 },
      R3: { win_rate: null, roi: null, sample: 0, cote_moy_gagnes: null }, // pas de backtest
    },

    // Intervalle de confiance Wilson 95% pour une proportion p sur n essais.
    // Plus robuste que Wald sur petits échantillons (utile vu qu'on a quelques paris résolus).
    wilsonCI(wins, n, z = 1.96) {
      if (!n) return { lo: 0, hi: 0, center: 0 };
      const p = wins / n;
      const denom = 1 + (z * z) / n;
      const center = (p + (z * z) / (2 * n)) / denom;
      const margin = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / denom;
      return {
        lo: Math.max(0, center - margin),
        hi: Math.min(1, center + margin),
        center,
      };
    },

    // Agrégats par règle (R1, R2, R3) sur les paris RÉSOLUS uniquement.
    // Comparaison automatique vs backtest cible.
    statsPerRule() {
      const resolved = this.resolvedBets();
      const byRule = {};
      ["R1", "R2", "R3"].forEach((r) => {
        const bets = resolved.filter((b) => b.rule_id === r);
        const won = bets.filter((b) => b.status === "won");
        const lost = bets.filter((b) => b.status === "lost");
        const n = bets.length;
        const winRate = n ? won.length / n : 0;
        const totalMise = bets.reduce((s, b) => s + (b.mise || 0), 0);
        const totalProfit = bets.reduce((s, b) => s + (b.profit || 0), 0);
        const roi = totalMise > 0 ? totalProfit / totalMise : 0;
        const coteAvgWon = won.length ? won.reduce((s, b) => s + (b.cote_book || 0), 0) / won.length : null;
        const ci = this.wilsonCI(won.length, n);
        const target = this.BACKTEST_TARGETS[r] || {};
        byRule[r] = {
          n_total: n,
          n_won: won.length,
          n_lost: lost.length,
          win_rate: winRate,
          ci_lo: ci.lo,
          ci_hi: ci.hi,
          profit: totalProfit,
          mise: totalMise,
          roi,
          cote_avg_won: coteAvgWon,
          target_win_rate: target.win_rate,
          target_roi: target.roi,
          target_sample: target.sample,
          // Direction de la dérive vs backtest
          drift_win_rate: target.win_rate != null && n > 0 ? winRate - target.win_rate : null,
          drift_roi: target.roi != null && n > 0 ? roi - target.roi : null,
          // Significativité : la cible backtest tombe-t-elle dans l'IC95% ?
          target_in_ci: target.win_rate != null && n > 0 && target.win_rate >= ci.lo && target.win_rate <= ci.hi,
        };
      });
      return byRule;
    },

    // Évolution chronologique de la bankroll, du plus ancien au plus récent.
    // Point initial = bankroll - somme totale des profits (reconstitution rétroactive).
    // Renvoie [{ts, value, delta, status, label}].
    bankrollEvolution() {
      const resolved = this.resolvedBets()
        .slice()
        .sort((a, b) => (a.resolved_at || "").localeCompare(b.resolved_at || ""));
      if (resolved.length === 0) return [];
      const totalProfit = resolved.reduce((s, b) => s + (b.profit || 0), 0);
      let cursor = this.bankroll - totalProfit;
      const points = [{
        ts: resolved[0].placed_at || resolved[0].resolved_at,
        value: cursor,
        delta: 0,
        status: "start",
        label: "Départ",
      }];
      resolved.forEach((b) => {
        cursor = Math.round((cursor + (b.profit || 0)) * 100) / 100;
        points.push({
          ts: b.resolved_at,
          value: cursor,
          delta: b.profit || 0,
          status: b.status,
          label: `${b.home} vs ${b.away} (${b.rule_id})`,
        });
      });
      return points;
    },

    // Analyses drawdown : plus longue série de pertes, plus longue série de gains,
    // drawdown actuel vs peak, drawdown max historique.
    drawdownStats() {
      const evolution = this.bankrollEvolution();
      if (evolution.length === 0) {
        return {
          max_losing_streak: 0,
          max_winning_streak: 0,
          current_drawdown_pct: 0,
          max_drawdown_pct: 0,
          peak_value: this.bankroll,
        };
      }
      let curWin = 0, curLoss = 0, maxWin = 0, maxLoss = 0;
      evolution.slice(1).forEach((p) => {
        if (p.status === "won") {
          curWin++; curLoss = 0;
          if (curWin > maxWin) maxWin = curWin;
        } else if (p.status === "lost") {
          curLoss++; curWin = 0;
          if (curLoss > maxLoss) maxLoss = curLoss;
        }
      });
      // Drawdown max = plus grande baisse depuis un peak
      let peak = evolution[0].value;
      let maxDD = 0;
      evolution.forEach((p) => {
        if (p.value > peak) peak = p.value;
        const dd = peak > 0 ? (peak - p.value) / peak : 0;
        if (dd > maxDD) maxDD = dd;
      });
      const peakVal = Math.max(this.peak, this.bankroll);
      const currentDD = peakVal > 0 ? (peakVal - this.bankroll) / peakVal : 0;
      return {
        max_losing_streak: maxLoss,
        max_winning_streak: maxWin,
        current_drawdown_pct: currentDD,
        max_drawdown_pct: maxDD,
        peak_value: peakVal,
      };
    },

    // Distribution des paris par buckets de cote (utilisé par l'histogramme).
    coteDistribution() {
      const resolved = this.resolvedBets();
      const buckets = [
        { label: "1.00-1.30", lo: 1.0, hi: 1.3, n: 0, won: 0 },
        { label: "1.30-1.50", lo: 1.3, hi: 1.5, n: 0, won: 0 },
        { label: "1.50-1.80", lo: 1.5, hi: 1.8, n: 0, won: 0 },
        { label: "1.80-2.20", lo: 1.8, hi: 2.2, n: 0, won: 0 },
        { label: "2.20-3.00", lo: 2.2, hi: 3.0, n: 0, won: 0 },
        { label: "3.00+",     lo: 3.0, hi: 999, n: 0, won: 0 },
      ];
      resolved.forEach((b) => {
        const c = b.cote_book || 0;
        const bk = buckets.find((x) => c >= x.lo && c < x.hi);
        if (bk) {
          bk.n++;
          if (b.status === "won") bk.won++;
        }
      });
      buckets.forEach((bk) => {
        bk.win_rate = bk.n > 0 ? bk.won / bk.n : 0;
      });
      return buckets;
    },

    // Stats de calibration : proba modèle moyenne (au moment du placement)
    // vs win rate réel observé. Si divergence → soit le modèle est mal calibré,
    // soit sample trop petit (cf. IC95%).
    calibrationByRule() {
      const resolved = this.resolvedBets();
      const out = {};
      ["R1", "R2", "R3"].forEach((r) => {
        const bets = resolved.filter((b) => b.rule_id === r);
        if (bets.length === 0) {
          out[r] = { n: 0, proba_avg: null, observed: null, diff: null };
          return;
        }
        const won = bets.filter((b) => b.status === "won").length;
        const probaAvg = bets.reduce((s, b) => s + (b.proba || 0), 0) / bets.length;
        const observed = won / bets.length;
        out[r] = {
          n: bets.length,
          proba_avg: probaAvg,
          observed,
          diff: observed - probaAvg,
        };
      });
      return out;
    },

    // ═══════════════════════════════════════════════════
    // GRAPHIQUE BANKROLL — helpers SVG
    // ═══════════════════════════════════════════════════

    // Construit les attributs SVG d'un line chart à partir de bankrollEvolution().
    // viewBox = "0 0 W H". On normalise les valeurs y entre yMin et yMax.
    bankrollChartSvg(W = 320, H = 140, padTop = 12, padBot = 24, padL = 36, padR = 12) {
      const points = this.bankrollEvolution();
      if (points.length < 2) return null;
      const values = points.map((p) => p.value);
      let yMin = Math.min(...values);
      let yMax = Math.max(...values);
      const yRange = yMax - yMin;
      // 10% de marge haut/bas si plat
      const pad = Math.max(yRange * 0.1, Math.max(yMax * 0.02, 1));
      yMin -= pad;
      yMax += pad;
      const xN = points.length - 1;
      const chartW = W - padL - padR;
      const chartH = H - padTop - padBot;
      const toX = (i) => padL + (i / xN) * chartW;
      const toY = (v) => padTop + ((yMax - v) / (yMax - yMin)) * chartH;
      const pathD = points.map((p, i) => `${i === 0 ? "M" : "L"}${toX(i).toFixed(1)} ${toY(p.value).toFixed(1)}`).join(" ");
      // Aire sous la courbe
      const areaD = pathD + ` L${toX(xN).toFixed(1)} ${(padTop + chartH).toFixed(1)} L${padL} ${(padTop + chartH).toFixed(1)} Z`;
      // Marqueurs (points won/lost)
      const markers = points.map((p, i) => ({
        cx: toX(i).toFixed(1),
        cy: toY(p.value).toFixed(1),
        status: p.status,
        value: p.value,
        delta: p.delta,
        label: p.label,
      }));
      // Axes y : 3 ticks (min, mid, max)
      const yMid = (yMin + yMax) / 2;
      const yTicks = [
        { v: yMax, y: padTop.toFixed(1), label: yMax.toFixed(0) + "€" },
        { v: yMid, y: (padTop + chartH / 2).toFixed(1), label: yMid.toFixed(0) + "€" },
        { v: yMin, y: (padTop + chartH).toFixed(1), label: yMin.toFixed(0) + "€" },
      ];
      // Ligne horizontale = bankroll initiale (premier point)
      const initialY = toY(points[0].value).toFixed(1);
      return {
        viewBox: `0 0 ${W} ${H}`,
        pathD,
        areaD,
        markers,
        yTicks,
        chartLeft: padL,
        chartRight: W - padR,
        initialY,
        initialValue: points[0].value,
      };
    },
  };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
