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

    init() {
      const saved = loadStoredState();
      if (saved) {
        this.bankroll = saved.bankroll ?? 100;
        this.peak = saved.peak ?? Math.max(saved.bankroll ?? 100, 100);
        this.history = saved.history ?? [];
      }
      this.loadData();
    },

    async loadData() {
      this.state = "loading";
      this.errorMsg = "";
      try {
        // cache-buster basé sur l'heure pour forcer refresh au pull
        const ts = Math.floor(Date.now() / 1000 / 60); // change chaque minute
        const res = await fetch(`data/latest.json?_=${ts}`, { cache: "no-store" });
        if (!res.ok) throw new Error("HTTP " + res.status);
        const json = await res.json();
        this.data = json;
        if (!json.top || json.top.length === 0) {
          this.state = "empty";
        } else {
          this.state = "ok";
        }
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
      // Sera codé en J2 : navigation vers vue détail
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
