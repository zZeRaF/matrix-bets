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
      if (this.audioStarted) return;
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
