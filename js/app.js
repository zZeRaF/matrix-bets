// Matrix Bets — logique principale Alpine.js
// Tout le state vit ici. localStorage = bankroll + historique paris.

const STORE_KEY = "matrix-bets-state-v1";

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
      // Cherche un fichier audio/intro.{mp3,m4a,wav,aac,ogg} déposé par l'utilisateur
      const extensions = ["mp3", "m4a", "wav", "aac", "ogg"];
      for (const ext of extensions) {
        const url = `audio/intro.${ext}`;
        try {
          const res = await fetch(url, { method: "HEAD" });
          if (res.ok) {
            const audio = document.getElementById("splash-audio");
            if (audio) {
              audio.src = url;
              this.audioAvailable = true;
              return;
            }
          }
        } catch {}
      }
      this.audioAvailable = false;
    },

    enableAudio() {
      const audio = document.getElementById("splash-audio");
      if (!audio || !audio.src) return;
      audio.volume = 0.95;
      // Le tap utilisateur autorise la lecture sur iOS
      const playPromise = audio.play();
      if (playPromise) {
        playPromise.then(() => {
          this.audioStarted = true;
        }).catch(() => {
          // En cas de blocage, on désactive l'option pour ne pas re-tenter
          this.audioAvailable = false;
        });
      } else {
        this.audioStarted = true;
      }
    },

    async startSplash() {
      // Démarre la pluie Matrix
      await this.$nextTick();
      const canvas = document.getElementById("matrix-rain");
      if (canvas) {
        this._splashStopRain = startMatrixRain(canvas);
      }

      // ── BUDGET TOTAL : 7 000ms ──
      // Typewriter title          : 520ms (13 chars × 40ms)
      // Log lines (6 steps)        : 2 880ms cumul
      // Pause + scène 3D termine  : ~3 000ms
      // Fade out                  : 600ms
      // Bouton SKIP visible dès   : 2 000ms

      // Active le bouton SKIP après 2s
      setTimeout(() => { this.splashSkipAvailable = true; }, 2000);

      // Three.js désactivé — la scène SVG (.scene-galactik) prend le relais via CSS keyframes

      // Typewriter du titre
      const title = "BeTime";
      for (let i = 1; i <= title.length; i++) {
        if (this._splashCancelled) return;
        this.splashTitle = title.slice(0, i);
        await sleep(90);
      }
      if (this._splashCancelled) return;

      // 6 log lines compressées sur ~2.9s
      const steps = [
        { text: "INITIALISATION SHELL...", delay: 400 },
        { text: "CONNEXION GITHUB PAGES...", delay: 400 },
        { text: "FETCH TOP_DU_JOUR.JSON...", delay: 480 },
        { text: "PARSE ANALYSES MACRO/MESO/MICRO/NEWS...", delay: 500 },
        { text: "CALCUL KELLY /4...", delay: 480 },
        { text: "READY.", delay: 620 },
      ];
      for (let i = 0; i < steps.length; i++) {
        if (this._splashCancelled) return;
        this.splashLog.push({ text: steps[i].text, status: "wait" });
        this.splashProgress = Math.round((i / steps.length) * 100);
        await sleep(steps[i].delay);
        this.splashLog[i].status = "ok";
      }
      this.splashProgress = 100;

      // Pause finale pendant que la scène 3D finit (~3s restantes)
      await sleep(2980);
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
