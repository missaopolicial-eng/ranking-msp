/* Banco do desafio MSP para site normal (GitHub Pages).
   Ranking: mensagens públicas num tópico ntfy.sh (só nome, notas e tempos).
   WhatsApp dos alistados: cifrado com a chave pública da MSP (RSA-OAEP) antes de sair do aparelho.
   Expõe a mesma interface que o motor usava (window.claude.use("db" | "user" | "downloads")). */
(function(){
const NET = window.MSP_NET, CFG = window.MSP_CFG || {};
const NT = "https://ntfy.sh/";
const K = "msp:" + (window.MSP_DATA && window.MSP_DATA.id) + ":";
const get = (k, d) => { try { const v = localStorage.getItem(K + k); return v ? JSON.parse(v) : d; } catch(e){ return d; } };
const put = (k, v) => { try { localStorage.setItem(K + k, JSON.stringify(v)); } catch(e){} };

let uid = get("uid", null);
if (!uid){ uid = "u" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); put("uid", uid); }
let own = get("doc", null), lead = get("lead", null);

const isObj = v => v && typeof v === "object" && !Array.isArray(v);
const merge = (a, b) => { const o = Object.assign({}, a); for (const k in b) o[k] = isObj(b[k]) && isObj(a && a[k]) ? merge(a[k], b[k]) : b[k]; return o; };
const normName = s => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
const firstEnd = d => { let m = Infinity; for (const c in (d.res || {})) { const r = d.res[c]; if (r && r.st) m = Math.min(m, r.st); } return m; };

let remote = {}, fixo = {}, listeners = [], pollT = null, lastOk = 0;

async function post(topic, obj){
  const r = await fetch(NT + topic, { method:"POST", body: JSON.stringify(obj) });
  if (!r.ok) throw new Error("ntfy " + r.status);
}
async function poll(){
  try {
    const r = await fetch(NT + NET.p + "/json?poll=1&since=all");
    if (!r.ok) throw new Error(r.status);
    const txt = await r.text(), seen = {};
    txt.split("\n").forEach(l => { if (!l) return; try {
      const m = JSON.parse(l); if (m.event !== "message") return;
      const x = JSON.parse(m.message); if (!x || !x.id || !isObj(x.d)) return;
      if (!seen[x.id] || seen[x.id].t <= m.time) seen[x.id] = { t:m.time, d:x.d };
    } catch(e){} });
    remote = {}; for (const id in seen) remote[id] = seen[id].d;
    lastOk = Date.now();
  } catch(e){ /* mantém a última lista */ }
  emit();
}
function list(){
  const all = Object.assign({}, fixo, remote);
  if (own) all[uid] = own;
  /* "vale a primeira tentativa": o mesmo nome em outro aparelho conta só uma vez (a que começou primeiro) */
  const best = {};
  for (const id in all){
    const d = all[id]; if (!d || !d.name) continue;
    const k = normName(d.name), cur = best[k];
    if (!cur) { best[k] = id; continue; }
    const a = all[cur], fa = firstEnd(a), fb = firstEnd(d);
    if (fb < fa || (fb === fa && (d.joinedAt || 0) < (a.joinedAt || 0))) best[k] = id;
  }
  const keep = new Set(Object.values(best)); if (own) keep.add(uid);
  return [...keep].map(id => ({ id, data: () => all[id] }));
}
function emit(){ const snap = { docs: list() }; listeners.forEach(f => { try { f(snap); } catch(e){} }); }

async function seal(obj){
  const key = await crypto.subtle.importKey("jwk", NET.pub, { name:"RSA-OAEP", hash:"SHA-256" }, false, ["encrypt"]);
  const raw = new TextEncoder().encode(JSON.stringify(obj));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name:"RSA-OAEP" }, key, raw));
  let s = ""; ct.forEach(b => s += String.fromCharCode(b)); return btoa(s);
}
async function sendLead(){
  const L = { n:String(lead.name || "").slice(0, 60), w:String(lead.whats || "").replace(/[^\d+]/g, "").slice(0, 16),
    m:lead.mentorado ? 1 : 0, c:lead.consent ? 1 : 0, i:lead.interesse ? 1 : 0, t:lead.at || Date.now(), u:uid };
  await post(NET.l, { x: await seal(L) });
}

function doc(path){
  const [col, id] = path.split("/");
  return {
    async set(d){
      if (col === "players"){ own = d; put("doc", own); emit(); await post(NET.p, { id:uid, d:own }); }
      else if (col === "leads"){ lead = d; put("lead", lead); await sendLead(); }
    },
    async update(p){
      if (col === "players"){ own = merge(own || {}, p); put("doc", own); emit(); await post(NET.p, { id:uid, d:own }); }
      else if (col === "leads"){ lead = merge(lead || {}, p); put("lead", lead); await sendLead(); }
    },
    onSnapshot(cb){ if (col === "config") setTimeout(() => cb({ exists:true, data: () => CFG }), 0); return () => {}; }
  };
}
const db = {
  doc,
  collection(name){
    return { onSnapshot(cb, err){
      if (name !== "players") return () => {};
      listeners.push(cb);
      if (!pollT){
        fetch("ranking.json?t=" + Date.now()).then(r => r.ok ? r.json() : {}).then(j => { fixo = j || {}; }).catch(() => {}).finally(poll);
        pollT = setInterval(() => { if (!document.hidden) poll(); }, 15000);
        document.addEventListener("visibilitychange", () => { if (!document.hidden) poll(); });
      }
      return () => { listeners = listeners.filter(f => f !== cb); };
    } };
  }
};
/* reenvia nota que falhou por rede */
window.addEventListener("online", () => { if (own) post(NET.p, { id:uid, d:own }).catch(() => {}); });

window.claude = { use: async (what) => {
  if (what === "db") return db;
  if (what === "user") return { id: async () => uid, isOwner: async () => false };
  return null;
} };
})();
