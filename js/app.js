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
  _audioGainMaster.gain.value = 0.6;
  _audioGainMaster.connect(_audioCtx.destination);
  return _audioCtx;
}

function _beep(freq, dur, type = "square", vol = 0.06, slide = null) {
  const ctx = _ensureAudio();
  if (!ctx) return;
  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (slide) osc.frequency.exponentialRampToValueAtTime(slide, t + dur);
  // Enveloppe ADSR très courte (attack 5ms, decay vers 0 sur dur)
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(vol, t + 0.005);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(gain);
  gain.connect(_audioGainMaster);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

function _noise(dur, vol = 0.025, freq = 800) {
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

function playHackSequence() {
  const ctx = _ensureAudio();
  if (!ctx) return;
  if (ctx.state === "suspended") ctx.resume();

  // Phase 1 (0-600ms) : typewriter — 12 bips aigus rapides (1 par lettre du titre)
  for (let i = 0; i < 12; i++) {
    setTimeout(() => {
      const f = 1100 + (Math.random() - 0.5) * 400;
      _beep(f, 0.025, "square", 0.04);
    }, 30 + i * 50);
  }

  // Phase 2 (700-2100ms) : 6 log lines — chaque ligne = beep mid + "static"
  const logTimings = [700, 920, 1140, 1390, 1650, 1900];
  const logFreqs = [520, 580, 640, 700, 760, 880];
  logTimings.forEach((t, i) => {
    setTimeout(() => {
      _beep(logFreqs[i], 0.06, "square", 0.05);
      _noise(0.05, 0.018, 1500 + i * 200);
    }, t);
    // "OK" beep aigu 50ms plus tard
    setTimeout(() => _beep(logFreqs[i] * 2.4, 0.04, "sine", 0.035), t + 60);
  });

  // Phase 3 (~2100ms) : READY confirmé — slide ascendant majeur
  setTimeout(() => _beep(440, 0.18, "square", 0.07, 1320), 2100);
  setTimeout(() => _beep(880, 0.12, "sine", 0.05), 2280);

  // Phase 4 (~2900ms) : "BeTime" apparaît — accord harmonique
  setTimeout(() => _beep(523, 0.25, "sine", 0.05), 2900);    // do
  setTimeout(() => _beep(659, 0.25, "sine", 0.045), 2950);   // mi
  setTimeout(() => _beep(784, 0.30, "sine", 0.04), 3000);    // sol

  // Background : static de fond tout le long (4s)
  for (let i = 0; i < 8; i++) {
    setTimeout(() => _noise(0.4, 0.008, 600 + Math.random() * 800), i * 500);
  }
}


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
      })
    );
  } catch {}
}

// ─── Matrix Rain (canvas) ───
function startMatrixRain(canvas) {
  const ctx = canvas.getContext("2d");
  let w = canvas.width = window.innerWidth;
  let h = canvas.height = window.innerHeight;
  const onResize = () => {
    w = canvas.width = window.innerWidth;
    h = canvas.height = window.innerHeight;
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

function app() {
  return {
    // === Persistant (localStorage) ===
    bankroll: 100,
    peak: 100,
    history: [],

    // === Volatile (par session) ===
    data: null,
    state: "loading", // loading | ok | empty | error
    errorMsg: "",
    tab: "paris",

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
      const saved = loadStoredState();
      if (saved) {
        this.bankroll = saved.bankroll ?? 100;
        this.peak = saved.peak ?? Math.max(saved.bankroll ?? 100, 100);
        this.history = saved.history ?? [];
      }
      // Vérifie si un fichier audio/intro.* est déposé dans le repo
      this.detectAudio();
      // Démarre splash en parallèle du fetch (s'affiche pendant qu'on charge)
      this.startSplash();
      this.loadData(); // ne await pas — splash et fetch tournent en //
    },

    async detectAudio() {
      // Web Audio API toujours dispo dans les navigateurs modernes
      this.audioAvailable = !!(window.AudioContext || window.webkitAudioContext);
      // En plus, si un MP3 est posé dans audio/, on le joue par-dessus le beep
      const extensions = ["mp3", "m4a", "wav", "aac", "ogg"];
      for (const ext of extensions) {
        const url = `audio/intro.${ext}`;
        try {
          const res = await fetch(url, { method: "HEAD" });
          if (res.ok) {
            const audio = document.getElementById("splash-audio");
            if (audio) audio.src = url;
            break;
          }
        } catch {}
      }
    },

    enableAudio() {
      // Active le son hack synthétisé (Web Audio API)
      try {
        playHackSequence();
        this.audioStarted = true;
      } catch (e) {
        console.warn("Audio error:", e);
        this.audioAvailable = false;
      }
      // Bonus : si un fichier MP3 est aussi dispo, on le joue en parallèle
      const audio = document.getElementById("splash-audio");
      if (audio && audio.src) {
        audio.volume = 0.7;
        audio.play().catch(() => {});
      }
    },

    async startSplash() {
      // Démarre la pluie Matrix
      await this.$nextTick();
      const canvas = document.getElementById("matrix-rain");
      if (canvas) {
        this._splashStopRain = startMatrixRain(canvas);
      }

      // ── BUDGET TOTAL : 4 000ms ──
      // Typewriter "$MATRIX BET$" : 600ms (12 chars × 50ms)
      // Log lines (6)            : 1 500ms cumul
      // Pause finale             : 1 300ms
      // Fade out                 : 600ms
      // SKIP visible dès         : 1 500ms

      setTimeout(() => { this.splashSkipAvailable = true; }, 1500);

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

      // Pause finale (montre "BeTime" sous la progression)
      await sleep(1300);
      if (this._splashCancelled) return;

      this.closeSplash();
    },

    skipSplash() {
      this._splashCancelled = true;
      this.closeSplash();
    },

    async closeSplash() {
      if (this.splashFading) return;
      this.splashFading = true;
      await sleep(600);
      this.showSplash = false;
      // Force-hide en plus de x-show au cas où Alpine traîne
      const splashEl = document.getElementById("splash");
      if (splashEl) splashEl.style.display = "none";
      if (this._splashStopRain) this._splashStopRain();
      if (window.stopThreeScene) window.stopThreeScene();
    },

    async loadData() {
      this.state = "loading";
      this.errorMsg = "";
      try {
        const ts = Math.floor(Date.now() / 1000 / 60); // cache-buster /minute
        const res = await fetch(`data/latest.json?_=${ts}`, { cache: "no-store" });
        if (!res.ok) throw new Error("HTTP " + res.status);
        const json = await res.json();
        this.data = json;
        this.state = !json.top || json.top.length === 0 ? "empty" : "ok";
      } catch (e) {
        this.state = "error";
        this.errorMsg = e.message || String(e);
      }
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
      console.log("TODO J2 : ouverture détail", slug);
      alert("Détail du match : " + slug + "\n\n(Vue détaillée à coder dans la prochaine étape.)");
    },

    editBankroll() {
      const cur = this.bankroll.toFixed(2);
      const v = prompt("Bankroll actuelle (€) :", cur);
      if (v == null) return;
      const n = parseFloat(v);
      if (isNaN(n) || n < 0) return;
      this.bankroll = n;
      if (n > this.peak) this.peak = n;
      saveStoredState(this);
    },
  };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
