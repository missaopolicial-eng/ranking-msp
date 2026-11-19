/* Motor de Desafios MSP — todo o conteúdo vem de data.js (window.MSP_DATA). */
(function(){
const D = window.MSP_DATA;
const $ = s => document.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const pad = n => String(n).padStart(2,"0");
const mmss = s => { s = Math.max(0, Math.round(s)); return pad(Math.floor(s/60)) + ":" + pad(s%60); };
const NS = "msp:" + (D.id || "desafio") + ":";
const ls = {
  get(k, d){ try{ const v = localStorage.getItem(NS+k); return v ? JSON.parse(v) : d; }catch(e){ return d; } },
  set(k, v){ try{ localStorage.setItem(NS+k, JSON.stringify(v)); }catch(e){} }
};
const LET = ["A","B","C","D","E","F"];
const TRK = Object.keys(D.trilhas);
const ROT = D.rotulo || "Dia";
const PATS = D.patentes || ["Recruta","Soldado","Cabo","3º Sargento","1º Sargento","Subtenente","Aspirante","Tenente","Capitão","Comandante"];

const MENTORIA_URL = "https://youtu.be/IIMTd_mUaZ4";
const CONTATO_PADRAO = "61991847910";
const DIAS_SEM = ["dom","seg","ter","qua","qui","sex","sáb"];
const padrao = {}; TRK.forEach(k => padrao[k] = (D.liberados && D.liberados[k] != null) ? D.liberados[k] : 1);
const S = {
  db:null, dl:null, uid:null, owner:false, online:false, loading:true,
  players:[], leads:[], me:null,
  cfg:Object.assign({ mentoria:"", contato:"" }, padrao),
  tab:{}, prog: ls.get("prog", {}), quiz:null, deck:null
};

/* ---------- textos da marca ---------- */
document.title = D.titulo + (D.titulo2 ? " " + D.titulo2 : "");
$("#brandB").textContent = D.marca || (D.titulo + (D.titulo2 ? " " + D.titulo2 : ""));
$("#brandSm").textContent = D.marcaSub || "Mentoria para concursos";
$("#foot").innerHTML = esc(D.rodape || (D.marca || D.titulo) + " · Missão Serei Policial.") + ` · <a href="${esc(D.linkMentoria || MENTORIA_URL)}" target="_blank" rel="noopener">Conheça a mentoria MSP ↗</a>`;

const linkMentoria = () => S.cfg.mentoria || D.linkMentoria || MENTORIA_URL;
const contatoTxt = () => S.cfg.contato || D.contato || CONTATO_PADRAO;
const waLink = () => {
  let d = contatoTxt().replace(/\D/g, ""); if (!d) return ""; if (d.length <= 11) d = "55" + d;
  const nome = S.me && S.me.name ? S.me.name : "";
  const msg = `Olá! ${nome ? "Sou " + nome + " e p" : "P"}articipei do desafio ${D.marca || D.titulo} da MSP. Quero conhecer a mentoria!`;
  return "https://wa.me/" + d + "?text=" + encodeURIComponent(msg);
};
const WA_ICON = '<svg viewBox="0 0 32 32" aria-hidden="true"><path fill="#fff" d="M16 3C8.8 3 3 8.7 3 15.8c0 2.5.7 4.9 2 7L3 29l6.4-2c2 1.1 4.3 1.7 6.6 1.7 7.2 0 13-5.7 13-12.8S23.2 3 16 3Zm0 23.4c-2.1 0-4.1-.6-5.9-1.7l-.4-.3-3.8 1.2 1.2-3.7-.3-.4a10.4 10.4 0 0 1-1.7-5.7C5.1 9.9 10 5.2 16 5.2s10.9 4.7 10.9 10.6S22 26.4 16 26.4Zm6-7.9c-.3-.2-1.9-.9-2.2-1s-.5-.2-.7.2-.8 1-1 1.2-.4.2-.7.1a8.7 8.7 0 0 1-4.4-3.8c-.3-.6.3-.5.9-1.7.1-.2 0-.4 0-.5l-1-2.4c-.3-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4s-1 1-1 2.5 1.1 2.9 1.2 3.1 2.1 3.2 5.1 4.5c1.9.8 2.6.9 3.6.7.6-.1 1.9-.8 2.1-1.5s.3-1.4.2-1.5-.3-.2-.6-.3Z"/></svg>';
/* liberação automática: missão n abre no n-ésimo dia (úteis ou corridos) a partir de "inicio", na hora marcada, horário de Brasília */
function releaseAt(k, n){
  const ini = S.cfg.inicio || D.inicio; if (!ini) return null;
  const [y, m, d] = ini.split("-").map(Number); if (!y || !m || !d) return null;
  const hora = +(S.cfg.hora ?? D.hora ?? 10), uteis = (S.cfg.dias || D.dias || "uteis") === "uteis";
  const dt = new Date(Date.UTC(y, m-1, d)); let c = 0;
  for (let guard = 0; guard < 400; guard++){ const wd = dt.getUTCDay(); if (!uteis || (wd > 0 && wd < 6)){ c++; if (c === n) break; } dt.setUTCDate(dt.getUTCDate() + 1); }
  return Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth(), dt.getUTCDate(), hora + 3);
}
function openCount(k){
  const max = D.trilhas[k].dias.length; let a = 0;
  for (let n = 1; n <= max; n++){ const t = releaseAt(k, n); if (t != null && Date.now() >= t) a = n; else break; }
  return Math.min(max, Math.max(S.cfg[k] || 0, a));
}
function nextRelease(){
  let best = null;
  TRK.forEach(k => { const n = openCount(k) + 1; if (n > D.trilhas[k].dias.length) return; const t = releaseAt(k, n); if (t && t > Date.now() && (!best || t < best.t)) best = { k, n, t }; });
  return best;
}
const fmtRel = t => { const d = new Date(t - 3*3600e3); return DIAS_SEM[d.getUTCDay()] + " " + pad(d.getUTCDate()) + "/" + pad(d.getUTCMonth()+1) + " às " + pad(d.getUTCHours()) + "h"; };
/* janela: com "duracao" (minutos), cada missão fecha esse tempo depois de liberar */
function closeAt(k, n){ const dur = +(S.cfg.duracao ?? D.duracao ?? 0); if (!dur) return null; const t = releaseAt(k, n); return t == null ? null : t + dur*60000; }
function isClosed(cid){ const [k, n] = cid.split("-"); if (!D.trilhas[k]) return false; const c = closeAt(k, +n); return c != null && Date.now() >= c; }
function timerHTML(){
  for (const k of TRK) for (let n = 1; n <= openCount(k); n++){ const c = closeAt(k, n); if (c && c > Date.now()) return `<div class="timer" aria-live="off"><span class="tl">Desafio aberto · encerra em</span><span class="num" id="cd" data-t="${c}">--:--:--</span><span class="tl2">${fmtRel(c).replace(/h$/, "h" + pad(new Date(c).getUTCMinutes()))} · horário de Brasília</span></div>`; }
  const nx = nextRelease();
  if (!nx){ const anyClosed = TRK.some(k => closeAt(k, 1) && Date.now() >= closeAt(k, openCount(k) || 1)); return anyClosed ? `<div class="timer"><span class="tl">Desafio encerrado</span><span class="tl2">Ranking final abaixo</span></div>` : ""; }
  return `<div class="timer" aria-live="off"><span class="tl">${esc(ROT)} ${pad(nx.n)} libera em</span><span class="num" id="cd" data-t="${nx.t}">--:--:--</span><span class="tl2">${fmtRel(nx.t)} · horário de Brasília</span></div>`;
}
function tickCd(){
  const el = document.getElementById("cd"); if (!el) return;
  const ms = +el.dataset.t - Date.now(), s = Math.max(0, Math.floor(ms/1000));
  el.textContent = (s >= 86400 ? Math.floor(s/86400) + "d " : "") + pad(Math.floor(s%86400/3600)) + ":" + pad(Math.floor(s%3600/60)) + ":" + pad(s%60);
}
let lastSig = "";
setInterval(() => { const sig = TRK.map(openCount).join(",") + "|" + scoredCids().map(isClosed).join(","); if (lastSig && sig !== lastSig && !S.quiz){ lastSig = sig; render(); toast("Nova missão liberada!"); return; } lastSig = sig; tickCd(); }, 1000);
function mentBand(){
  const wa = waLink();
  return `<section class="ment-band"><div><span class="group">Mentoria MSP</span><h3>Quer esse ritmo o ano inteiro?</h3><p>O desafio é uma amostra do método. Veja como funciona a mentoria por dentro.</p></div>
    <div class="ctas" style="margin:0"><a class="btn pri" href="${esc(linkMentoria())}" target="_blank" rel="noopener">Assistir: como funciona ↗</a>${wa ? `<a class="btn" href="${esc(wa)}" target="_blank" rel="noopener"><span class="wa-ico">${WA_ICON}</span>Falar no WhatsApp</a>` : ""}</div></section>`;
}

/* ---------- catálogo ---------- */
const dia = (k, n) => D.trilhas[k].dias[n-1];
const modo = d => d.prova ? "prova" : (d.cards ? "deck" : null);
function norm(x, tipo){
  if (Array.isArray(x)) return { t:x[0], g:x[1], c:x[2] || "" };
  return { t:x.t, o:x.o, g:x.g, c:x.c || "", texto:x.texto, tag:x.tag };
}
function provaOf(cid){
  const a = (D.arena || []).find(x => x.id === cid);
  if (a){
    let q = a.q;
    if (!q && a.de) q = [].concat(...D.trilhas[a.de.trilha].dias.map(d => a.de.idx.map(i => d.prova.q[i]).filter(Boolean)));
    const tipo = a.tipo || "ce";
    return { nome:a.nome, sub:a.sub || "", tipo, tempo:a.tempo || q.length*36, penaliza:a.penaliza ?? (tipo==="ce"), q:q.map(x => norm(x, tipo)) };
  }
  const [k, n] = cid.split("-"), d = dia(k, +n), tr = D.trilhas[k], p = d.prova;
  const tipo = p.tipo || "ce";
  return { nome:(p.nome || (ROT + " " + pad(n))) + " · " + tr.sigla, sub:[d.ref, d.titulo].filter(Boolean).join(" · "), tipo,
    tempo:p.tempo || p.q.length*36, penaliza:p.penaliza ?? (tipo==="ce"), q:p.q.map(x => norm(x, tipo)), trk:k, dia:+n };
}
const missionCids = () => TRK.flatMap(k => D.trilhas[k].dias.map((d, i) => modo(d) ? k + "-" + (i+1) : null).filter(Boolean));
const scoredCids = () => [...missionCids(), ...(D.arena || []).map(a => a.id)];
function isOpen(cid){
  if (S.owner) return true;
  const a = (D.arena || []).find(x => x.id === cid);
  if (a){
    if (a.abre === "sempre") return true;
    if (a.abre && a.abre.startsWith("fim:")){ const k = a.abre.slice(4); if (openCount(k) >= D.trilhas[k].dias.length) return true; }
    return !!S.cfg["a_" + a.id];
  }
  const [k, n] = cid.split("-"); return +n <= openCount(k);
}
const res = (p, cid) => p && p.res && p.res[cid] && p.res[cid].n != null ? p.res[cid] : null;
const doneCount = p => scoredCids().filter(c => res(p, c)).length;
const total = p => scoredCids().reduce((a, c) => a + (res(p, c) ? res(p, c).n : 0), 0);
function patente(p){
  const n = doneCount(p), T = scoredCids().length, L = PATS.length - 1; let idx = 0;
  for (let i = 0; i <= L; i++) if (n >= Math.ceil(i * T / L)) idx = i;
  return { nome:PATS[idx], idx, L };
}
function chev(idx, L){
  L = L || PATS.length - 1; let g;
  if (idx >= L && idx > 0) g = '<path d="M9 2.5l1.9 4 4.4.5-3.3 3 .9 4.3L9 12.1l-3.9 2.2.9-4.3-3.3-3 4.4-.5z" fill="var(--brass)"/>';
  else if (idx <= 0) g = '<circle cx="9" cy="9" r="5" fill="none" stroke="var(--mut)" stroke-width="2"/>';
  else { const n = Math.min(3, Math.max(1, Math.ceil(3 * idx / Math.max(1, L-1)))), y0 = 9 - (n-1)*2.6; g = "";
    for (let j = 0; j < n; j++){ const y = y0 + j*5.2 - 2; g += `<path d="M3 ${y} 9 ${y+4} 15 ${y}" fill="none" stroke="var(--brass)" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>`; } }
  return `<svg class="chev" viewBox="0 0 18 18" width="18" height="18" aria-hidden="true">${g}</svg>`;
}
function rankOf(cid){
  return S.players.filter(p => res(p, cid)).sort((a, b) => { const x = res(a, cid), y = res(b, cid); return y.n - x.n || x.t - y.t || x.fim - y.fim; });
}
const rankGeral = () => S.players.filter(p => doneCount(p) > 0).sort((a, b) => total(b) - total(a) || doneCount(b) - doneCount(a) || (a.joinedAt||0) - (b.joinedAt||0));
const maxOf = cid => { const [k, n] = cid.split("-"); const d = D.trilhas[k] && dia(k, +n); return d && !d.prova && d.cards ? d.cards.length : provaOf(cid).q.length; };

/* ---------- navegação ---------- */
function route(){ return (location.hash || "#inicio").slice(1) || "inicio"; }
function renderNav(){
  const r = route(), isTrk = TRK.some(k => r === k || r.startsWith(k + "-"));
  const items = [["inicio","Início"],[TRK[0], D.nomeMissoes || "Missões"]];
  if ((D.arena || []).length) items.push(["arena","Arena"]);
  items.push(["ranking","Ranking"]); if (D.mentoria !== false) items.push(["mentoria","Mentoria"]);
  if (S.owner) items.push(["comando","Comando"]);
  $("#nav").innerHTML = items.map(([h, t]) => `<a href="#${h}" ${(isTrk && h===TRK[0]) || r===h ? 'aria-current="page"' : ""}>${t}</a>`).join("");
  const me = $("#me");
  const fab = $("#waFab"), wa = waLink();
  if (wa){ fab.hidden = false; fab.href = wa; if (!fab.innerHTML) fab.innerHTML = WA_ICON + "<span>Conhecer a mentoria</span>"; } else fab.hidden = true;
  if (S.me){ const pt = patente(S.me); me.hidden = false; me.innerHTML = chev(pt.idx, pt.L) + `<span>${esc(S.me.name)} · ${pt.nome}</span>`; }
  else me.hidden = true;
}
function render(){
  renderNav();
  const r = route(), app = $("#app"); let m;
  if (TRK.includes(r)) app.innerHTML = vTrilha(r);
  else if ((m = r.match(/^([a-z0-9]+)-(\d+)$/)) && D.trilhas[m[1]] && dia(m[1], +m[2])) app.innerHTML = vMissao(m[1], +m[2]);
  else if (r === "arena") app.innerHTML = vArena();
  else if (r === "ranking") app.innerHTML = vRanking();
  else if (r === "mentoria") app.innerHTML = vMentoria();
  else if (r === "comando" && S.owner) app.innerHTML = vComando();
  else app.innerHTML = vInicio();
  after();
}
window.addEventListener("hashchange", () => { render(); window.scrollTo(0,0); });

/* ---------- etapas de uma missão ---------- */
function etapas(d){
  const e = [];
  if (d.pdf) e.push(["leu","Leitura","Baixe o PDF e leia a lei seca com os destaques."]);
  if (d.briefing) e.push(["brief","Briefing",`${d.briefing.length} pontos que a banca cobra${d.pegadinha?" e a pegadinha do dia":""}.`]);
  if (d.cards) e.push(["cards","Flashcards",`${d.cards.length} cartas para fixar prazos, penas e conceitos.${!d.prova?" Vale para o ranking.":""}`]);
  if (d.juris) e.push(["juris","Jurisprudência","Súmulas e teses ligadas ao tema do dia."]);
  if (d.prova){ const p = d.prova, t = p.tipo || "ce"; e.push(["prova", p.nome || (t==="me" ? "Simulado" : "Prova de fogo"), `${p.q.length} itens ${t==="ce"?"certo ou errado":"de múltipla escolha"} em ${Math.round((p.tempo||p.q.length*36)/60)} minutos. Vale para o ranking.`]); }
  return e;
}

/* ---------- views ---------- */
function vEnlist(){
  if (S.me) return "";
  return `<section class="card enlist" id="alistar">
    <div style="display:grid;gap:12px;align-content:start">
      <span class="eyebrow">Alistamento</span>
      <h2 class="gold">Coloque seu nome na lista</h2>
      <p class="mut" style="margin:0">É a lista de presença do desafio. Cada missão entregue vira um ✅ ao lado do seu nome, igual à lista do grupo, só que atualizada sozinha.</p>
      ${S.online ? "" : `<div class="note warn">${S.loading ? "Conectando ao quartel-general…" : "Ranking indisponível nesta visualização. Entre na sua conta Claude para aparecer na lista. Você ainda pode treinar: seu progresso fica salvo neste aparelho."}</div>`}
    </div>
    <form id="fEnlist" novalidate>
      <label class="f">Nome no ranking <small>Primeiro nome e inicial do sobrenome. Ex.: Douglas G.</small>
        <input type="text" id="enName" maxlength="28" autocomplete="nickname" required></label>
      <label class="f">WhatsApp com DDD <small>Só a coordenação vê. Não aparece no ranking.</small>
        <input type="tel" id="enWhats" maxlength="20" placeholder="(61) 99999-9999" autocomplete="tel"></label>
      <div class="f" style="display:grid;gap:6px;font-weight:600;font-size:14px">Já é aluno(a) da mentoria MSP?
        <div class="seg"><label><input type="radio" name="enAluno" id="enAlunoS" value="1"> Sim</label><label><input type="radio" name="enAluno" id="enAlunoN" value="0" checked> Ainda não</label></div></div>
      <label class="chk"><input type="checkbox" id="enOk" checked> Autorizo a equipe MSP a falar comigo pelo WhatsApp sobre meu resultado e sobre a mentoria.</label>
      <div class="err" id="enErr"></div>
      <button class="btn pri" type="submit">Alistar e começar</button>
    </form>
  </section>`;
}
const STAR = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 1.5l3.1 6.6 7.2.9-5.3 5 1.4 7.1L12 17.6l-6.4 3.5 1.4-7.1-5.3-5 7.2-.9z" fill="url(#g-gold)"/></svg>';
function chipsOf(p){
  return `<span class="chips">${scoredCids().map((c, i) => `<i class="chip ${res(p, c) ? "M" : "X"}" title="${esc(cidNome(c))}">${res(p, c) ? i+1 : "✕"}</i>`).join("")}</span>`;
}
function podiumHTML(list){
  if (!list.length) return "";
  const order = [list[1], list[0], list[2]], cls = ["p2","p1","p3"], grad = ["g-silver","g-gold","g-bronze"], n = [2,1,3];
  return `<div class="podium">${order.map((p, i) => {
    if (!p) return `<div class="pod ${cls[i]}"><div class="step" aria-hidden="true">${n[i]}</div></div>`;
    const pt = patente(p);
    return `<div class="pod ${cls[i]}">
      <svg class="shield" viewBox="0 0 84 96" aria-hidden="true"><use href="#shield" fill="url(#${grad[i]})"/><path d="M42 12 70 21v23c0 18-12 31-28 39C26 75 14 62 14 44V21l28-9Z" fill="#14110b" opacity=".55"/><text x="42" y="60" text-anchor="middle" font-family="Big Shoulders Display, Impact, sans-serif" font-weight="900" font-size="38" fill="url(#${grad[i]})">${n[i]}</text></svg>
      <div class="nm">${esc(p.name)}</div>
      <div class="pts num">${total(p)}<small>pts</small></div>
      ${chipsOf(p)}
      <div class="meta">${pt.nome} · ${doneCount(p)}/${scoredCids().length} missões</div>
      <div class="step" aria-hidden="true">${n[i]}</div></div>`;
  }).join("")}</div>`;
}
function vInicio(){
  const players = S.players.length, provas = S.players.reduce((a, p) => a + doneCount(p), 0);
  const g = rankGeral(), et = etapas(D.trilhas[TRK[0]].dias[0]);
  const liberadas = TRK.reduce((a, k) => a + openCount(k), 0);
  const totalM = TRK.reduce((a, k) => a + D.trilhas[k].dias.length, 0);
  const anyCe = scoredCids().some(c => provaOrNull(c) && provaOrNull(c).tipo === "ce");
  const regras = (D.regras || [
    ["Sem consulta","Como no dia da prova. O relógio entrega sozinho quando zera."],
    ["Vale a primeira tentativa","Depois dela você pode refazer em modo treino, sem mexer no ranking."],
    anyCe ? ["Um errado anula um certo","Nos itens certo ou errado vale a nota líquida do Cebraspe. Na dúvida, deixe em branco."] : ["Desempate pelo tempo","Mesma nota? Fica na frente quem entregou mais rápido."],
    ["Comprove no grupo","Entregou? Tire print do cartão de Missão Cumprida e mande no grupo. A lista atualiza sozinha."]
  ]);
  return `<header class="hero">
      <div class="logo" role="img" aria-label="MSP Mentoria para Concursos">
        <div class="logo-msp">MSP</div><div class="logo-sub">Mentoria para concursos</div>
        <div class="logo-rule" aria-hidden="true"><span></span>${STAR}<span></span></div>
      </div>
      <span class="eyebrow">${esc(D.eyebrow || "Desafio da comunidade · gratuito")}</span>
      <h1 class="gold">${esc(D.titulo)}${D.titulo2 ? `<br>${esc(D.titulo2)}` : ""}</h1>
      ${D.premio ? `<div class="periodo" style="margin-bottom:10px;font-family:var(--f-body);font-weight:800;color:var(--on-gold);background:linear-gradient(180deg,var(--gold-hi),var(--gold));border:0">${STAR.replace('fill="url(#g-gold)"','fill="#1b1407"').replace("<svg ", '<svg width="16" height="16" ')} ${esc(D.premio)}</div>` : ""}
      <div class="periodo num">${liberadas} de ${totalM} ${esc((D.nomeMissoes || "missões").toLowerCase())} liberadas</div>
      <div class="upd"><span class="live" aria-hidden="true"></span><span>Ranking ao vivo · ${players} alistados · ${provas} entregas</span></div>
      ${timerHTML()}
      <p class="lead">${D.chamada || ""}</p>
      <div class="ctas">
        ${S.me ? `<a class="btn pri" href="#${TRK[0]}">Ir para ${esc((D.nomeMissoes || "as missões").toLowerCase())}</a>` : `<a class="btn pri" href="#inicio" data-scroll="alistar">Quero me alistar</a>`}
        <a class="btn" href="#ranking">Ver ranking completo</a>
      </div>
    </header>
    ${g.length ? podiumHTML(g) : `<div class="largada"><b>Largada.</b> Todo mundo começa com 0 ponto. O pódio aparece com a primeira entrega.</div>`}
    ${et.length > 1 ? `<section style="display:grid;gap:14px">
      <div class="sect-h c"><span class="group">Como funciona</span><h2>O protocolo do dia</h2><p class="lead2">${et.length} etapas, nesta ordem.</p></div>
      <div class="pgrid">${et.map((e, i) => `<div class="pcard"><span class="v">${pad(i+1)}</span><span class="t">${esc(e[1])}</span><p>${esc(e[2])}</p></div>`).join("")}</div>
    </section>` : ""}
    <section style="display:grid;gap:14px">
      <div class="sect-h c"><span class="group">Antes de começar</span><h2>Regras de engajamento</h2></div>
      <div class="faq">${regras.map(r => `<div><b>${esc(r[0])}</b><p>${esc(r[1])}</p></div>`).join("")}</div>
    </section>
    ${mentBand()}
    ${vEnlist()}`;
}
function provaOrNull(c){ const [k, n] = c.split("-"); const d = D.trilhas[k] && dia(k, +n); if (d && !d.prova) return null; return provaOf(c); }

function vTrilha(k){
  const tr = D.trilhas[k], n = tr.dias.length;
  const done = tr.dias.filter((d, i) => res(S.me, k+"-"+(i+1))).length;
  return `<section class="trk-head">
      <div style="display:grid;gap:10px"><span class="eyebrow">${esc(D.nomeMissoes || "Missões")} · ${done}/${n} cumpridas</span><h1 class="gold">${esc(tr.nome)}</h1></div>
      ${TRK.length > 1 ? `<div class="switch" role="tablist">${TRK.map(x => `<a href="#${x}" ${x===k?'aria-current="page"':""}>${esc(D.trilhas[x].sigla)}</a>`).join("")}</div>` : ""}
    </section>
    ${timerHTML()}
    ${S.me ? "" : `<div class="note warn">Você ainda não está na lista. <a href="#inicio" data-scroll="alistar">Aliste-se</a> para sua entrega contar no ranking.</div>`}
    <section class="missions">
      ${tr.dias.map((d, i) => {
        const cid = k+"-"+(i+1), r = res(S.me, cid), open = isOpen(cid), pr = S.prog[cid] || {}, et = etapas(d);
        const st = et.filter(e => e[0] === "prova" || (e[0] === "cards" && !d.prova) ? !!r : !!pr[e[0]]).length;
        return `<a class="mis ${open?"":"locked"} ${r?"done":""}" href="#${cid}" ${open?"":'aria-disabled="true" tabindex="-1"'}>
          <span class="num" aria-hidden="true">${pad(i+1)}</span>
          <div><span class="d">${esc(ROT.toUpperCase())} ${pad(i+1)}</span></div>
          <div style="display:grid;gap:6px;align-content:start"><h3>${esc(d.titulo)}</h3><span class="arts">${esc(d.ref || "")}</span></div>
          <div class="foot">
            ${r ? `<span class="pill ok">✓ ${d.prova ? "Nota" : "Dominou"} ${r.n}</span>` : open && isClosed(cid) ? `<span class="pill">Encerrado</span>` : open ? `<span class="pill go">Liberada</span>` : `<span class="pill lock">${releaseAt(k, i+1) ? "Libera " + fmtRel(releaseAt(k, i+1)) : "Bloqueada"}</span>`}
            ${et.length > 1 ? `<span class="steps5" aria-label="${st} de ${et.length} etapas">${et.map((_, j) => `<i class="${j<st?"on":""}"></i>`).join("")}</span>` : ""}
          </div></a>`;
      }).join("")}
    </section>`;
}

function vMissao(k, n){
  const cid = k+"-"+n, tr = D.trilhas[k];
  if (!isOpen(cid)) return `<a class="back" href="#${k}">← ${esc(tr.nome)}</a><div class="card empty">${releaseAt(k, n) ? "Esta missão libera " + fmtRel(releaseAt(k, n)) + " (horário de Brasília)." : "Esta missão ainda não foi liberada pela coordenação."}</div>`;
  const d = dia(k, n), pr = S.prog[cid] || {}, r = res(S.me, cid), et = etapas(d);
  let tab = S.tab[cid]; if (tab == null) tab = r ? et.length - 1 : 0; tab = Math.min(tab, et.length - 1);
  const key = et[tab][0], next = tab + 1 < et.length ? tab + 1 : null;
  const nextBtn = (mk, txtDone, txt) => `<div><button class="btn" data-mark="${mk}" ${next!=null?`data-next="${next}"`:""}>${pr[mk] ? txtDone : txt}</button></div>`;
  let body = "";
  if (key === "leu") body = `<div class="card pdfbox"><div class="pdficon">PDF</div>
      <div style="display:grid;gap:10px"><h3 style="font-size:28px">${esc(d.pdfTitulo || ("Lei seca · " + (d.ref || "")))}</h3>
      <p class="mut" style="margin:0">Material ${esc(ROT.toLowerCase())} ${pad(n)}. Leia antes de seguir.</p>
      <div class="ctas" style="margin:0"><button class="btn pri" data-pdf="${esc(d.pdf)}" data-pdfnome="${esc(d.pdfNome || (ROT + " " + pad(n) + ".pdf"))}">Baixar PDF</button>
      <button class="btn" data-mark="leu" ${next!=null?`data-next="${next}"`:""}>${pr.leu ? "✓ Leitura concluída" : "Marcar leitura como concluída"}</button></div></div></div>
      ${d.alerta ? `<div class="note warn"><b>Atualização legislativa.</b> ${esc(d.alerta)}</div>` : ""}`;
  else if (key === "brief") body = `<div class="brief">${d.briefing.map(([t, p]) => `<div><b>${esc(t)}</b><p>${esc(p)}</p></div>`).join("")}</div>
      ${d.pegadinha ? `<div class="trap"><b>Pegadinha</b><p>${esc(d.pegadinha)}</p></div>` : ""}
      ${d.alerta ? `<div class="note warn"><b>Atualização.</b> ${esc(d.alerta)}</div>` : ""}
      ${nextBtn("brief","✓ Briefing lido","Briefing entendido, próxima etapa")}`;
  else if (key === "cards") body = vDeck(cid, d, next);
  else if (key === "juris") body = `<div class="juris">${d.juris.map(([a, t]) => `<div><b>${esc(a)}</b><span>${esc(t)}</span></div>`).join("")}</div>
      ${nextBtn("juris","✓ Jurisprudência revisada","Revisado, próxima etapa")}`;
  else body = vProvaIntro(cid);
  return `<a class="back" href="#${k}">← ${esc(tr.nome)}</a>
    <section class="mhead"><span class="eyebrow">${esc(ROT)} ${pad(n)} · ${esc(tr.sigla)}${d.ref ? " · " + esc(d.ref) : ""}</span><h1 class="gold">${esc(d.titulo)}</h1></section>
    ${et.length > 1 ? `<div class="stepper" role="tablist" style="--cols:${et.length}">${et.map(([kk, lbl], i) => {
      const ok = kk === "prova" || (kk === "cards" && !d.prova) ? !!r : !!pr[kk];
      return `<button role="tab" data-tab="${i}" aria-selected="${tab===i}" class="${ok?"done":""}"><span class="k">${ok ? "✓ " : ""}ETAPA ${i+1}</span><b>${esc(lbl)}</b></button>`;
    }).join("")}</div>` : ""}
    <section class="panel" data-cid="${cid}">${body}</section>`;
}

function vDeck(cid, d, next){
  const cards = d.cards, scored = !d.prova, r = res(S.me, cid);
  const st = S.deck && S.deck.cid === cid ? S.deck : (S.deck = { cid, i:0, flip:false, know:0, seen:{}, order:cards.map((_, i) => i), t0:Date.now(), official: scored && !r && !!S.me });
  if (st.i >= st.order.length){
    if (st.official && !st.saved) saveDeck(cid, st, cards.length);
    return `<div class="card empty" style="display:grid;gap:12px;justify-items:center"><h3 style="font-size:34px">Baralho concluído</h3>
      <p style="margin:0">Dominou de primeira: <b class="mono">${st.know}/${cards.length}</b>${scored ? (st.official ? " · registrado no ranking" : " · treino, o ranking guarda a primeira rodada") : ""}</p>
      <div class="deckbar"><button class="btn" data-deck="reset">Revisar de novo</button>${next!=null ? `<button class="btn pri" data-mark="cards" data-next="${next}">Próxima etapa</button>` : `<a class="btn pri" href="#ranking">Ver ranking</a>`}</div></div>`;
  }
  const c = cards[st.order[st.i]];
  return `<div class="deck">
    <span class="sheet-lbl">Carta ${st.i+1} de ${st.order.length}${scored && st.official ? " · vale para o ranking" : ""}</span>
    <button class="flip ${st.flip?"on":""}" data-deck="flip" aria-label="Virar carta"><div class="in">
      <div class="fc fr"><span>${esc(c[0])}</span><small>Toque para virar</small></div>
      <div class="fc bk"><span>${esc(c[1])}</span></div></div></button>
    <div class="deckbar">${st.flip ? `<button class="btn" data-deck="again">Errei, rever depois</button><button class="btn pri" data-deck="know">Sabia</button>` : `<button class="btn pri" data-deck="flip">Ver resposta</button>`}</div>
  </div>`;
}
async function saveDeck(cid, st, n){
  st.saved = true;
  const rec = { st:st.t0, fim:Date.now(), t:Math.round((Date.now()-st.t0)/1000), c:st.know, e:n-st.know, b:0, n:st.know, a:"" };
  S.prog[cid] = Object.assign({}, S.prog[cid], { cards:true }); ls.set("prog", S.prog);
  if (S.online && S.me){ try { await S.db.doc("players/" + S.uid).update({ res:{ [cid]:rec } }); } catch(err){ toast("Falha ao registrar. Tente de novo."); st.saved = false; } }
  else if (S.me){ S.me.res = S.me.res || {}; S.me.res[cid] = rec; ls.set("me", S.me); }
}

function vProvaIntro(cid){
  const qz = provaOf(cid), r = S.me && S.me.res && S.me.res[cid], fin = res(S.me, cid);
  const pend = r && r.st && r.n == null;
  if (fin){
    const pos = rankOf(cid).findIndex(p => p.id === S.uid) + 1;
    return `<div class="brief-quiz"><div class="card" style="display:grid;gap:14px">
        <span class="eyebrow">Prova entregue</span><h3 style="font-size:40px">Nota ${fin.n}</h3>
        <div class="kv"><div><b class="mono">${fin.c}</b><span>acertos</span></div><div><b class="mono">${fin.e}</b><span>erros</span></div><div><b class="mono">${pos ? pos+"º" : "–"}</b><span>posição</span></div></div>
        <div class="ctas" style="margin:0"><button class="btn pri" data-review="${cid}">Ver correção e cartão</button><button class="btn" data-start="${cid}" data-treino="1">Refazer em modo treino</button></div></div>
      ${vMiniRank(cid)}</div>`;
  }
  const ce = qz.tipo === "ce";
  if (!pend && !S.owner && isClosed(cid)) return `<div class="brief-quiz"><div class="card" style="display:grid;gap:14px">
      <span class="eyebrow">Encerrado</span><h3 style="font-size:40px">O prazo acabou</h3>
      <p class="mut" style="margin:0">Este desafio aceitou entregas até ${(() => { const [k, n] = cid.split("-"), c = closeAt(k, +n); return fmtRel(c).replace(/h$/, "h" + pad(new Date(c).getUTCMinutes())); })()}. Veja o ranking final ou treine sem valer ponto.</p>
      <div class="ctas" style="margin:0"><a class="btn pri" href="#ranking">Ver ranking final</a><button class="btn" data-start="${cid}" data-treino="1">Treinar</button></div></div>
    ${vMiniRank(cid)}</div>`;
  return `<div class="brief-quiz"><div class="card" style="display:grid;gap:14px">${D.premio ? `<div class="note warn"><b>Prêmio:</b> ${esc(D.premio)}</div>` : ""}
      <span class="eyebrow">${ce ? "Prova de fogo" : "Simulado"}</span><h3 style="font-size:40px">${esc(qz.nome)}</h3>
      <div class="kv"><div><b class="mono">${qz.q.length}</b><span>${ce ? "itens C/E" : "questões A–" + LET[(qz.q[0].o||[]).length-1]}</span></div><div><b class="mono">${Math.round(qz.tempo/60)}min</b><span>no relógio</span></div><div><b class="mono">${qz.penaliza ? "−1" : "0"}</b><span>por erro</span></div></div>
      <p class="mut" style="margin:0">Sem consulta. Atalhos: ${ce ? `<span class="mono">C</span> certo, <span class="mono">E</span> errado` : `<span class="mono">A</span> a <span class="mono">E</span> marcam a alternativa`}, <span class="mono">Backspace</span> apaga, setas navegam. O relógio não para se você sair da página.</p>
      ${S.me ? "" : `<div class="note warn">Você não está alistado: esta tentativa não entra no ranking.</div>`}
      <button class="btn pri" data-start="${cid}">${pend ? "Retomar prova em andamento" : "Iniciar prova"}</button></div>
    ${vMiniRank(cid)}</div>`;
}
function vMiniRank(cid){
  const r = rankOf(cid).slice(0,5);
  return `<div class="card" style="display:grid;gap:10px"><span class="eyebrow">Top 5</span>
    ${r.length ? `<div class="mini">${r.map((p, i) => `<div class="${p.id===S.uid?"mine":""}"><span class="pos">${i+1}º</span><span class="nm">${esc(p.name)}</span><span class="mono">${res(p,cid).n} · ${mmss(res(p,cid).t)}</span></div>`).join("")}</div>` : `<p class="mut" style="margin:0">Ninguém entregou ainda. Seja o primeiro nome do quadro.</p>`}</div>`;
}

function vArena(){
  const A = D.arena || [];
  return `<section class="sect-h"><div style="display:grid;gap:10px"><span class="eyebrow">Arena</span><h1 class="pg-h gold">Provas especiais</h1></div></section>
    <section class="arena">${A.map(a => {
      const qz = provaOf(a.id), r = res(S.me, a.id), open = isOpen(a.id), my = S.me && S.me.res && S.me.res[a.id];
      return `<div class="ar"><span class="eyebrow">${qz.q.length} itens · ${Math.round(qz.tempo/60)} min</span><h3>${esc(a.nome)}</h3><ul>${(a.li || [a.sub]).filter(Boolean).map(x => `<li>${esc(x)}</li>`).join("")}</ul>
        ${r ? `<span class="pill ok">✓ Nota ${r.n}</span><div class="ctas" style="margin:0"><button class="btn" data-review="${a.id}">Correção</button><button class="btn" data-start="${a.id}" data-treino="1">Treinar</button></div>`
            : open ? `<button class="btn pri" data-start="${a.id}">${my && my.st ? "Retomar" : "Iniciar"}</button>` : `<span class="pill lock">Bloqueada</span>`}</div>`;
    }).join("")}</section>`;
}

function cidNome(c){
  const [k, n] = c.split("-"), d = D.trilhas[k] && dia(k, +n);
  if (d) return `${ROT} ${pad(n)} · ${D.trilhas[k].sigla}`;
  return provaOf(c).nome;
}
function vRanking(){
  const sel = S.rk || "geral";
  const opts = [["geral","Ranking geral"], ...TRK.map(k => ["lista-"+k, "Lista do grupo · " + D.trilhas[k].sigla]), ...scoredCids().map(c => [c, cidNome(c)])];
  let body;
  if (!S.online && !S.loading) body = `<div class="card empty">O ranking aparece para quem está conectado com a conta Claude.</div>`;
  else if (sel === "geral"){
    const r = rankGeral(), T = scoredCids().length;
    body = r.length ? `${podiumHTML(r)}
      <div class="legend"><span><i class="chip M">1</i>Missão entregue</span><span><i class="chip X">✕</i>Ainda não entregou</span></div>
      <div class="grid">${r.map((p, i) => { const pt = patente(p); return `<div class="ficha ${i<10?"top10":""} ${p.id===S.uid?"mine":""}">
        <span class="pos">${i+1}<sup>º</sup>${chev(pt.idx, pt.L)}</span><span class="pts">${total(p)}<small>pontos</small></span>
        <span class="nm">${esc(p.name)}</span>
        <div class="row">${chipsOf(p)}<span class="info">${pt.nome} · ${doneCount(p)}/${T}${p.mentorado?" · aluno MSP":""}</span></div></div>`; }).join("")}</div>`
      : `<div class="largada"><b>Largada.</b> Todo mundo começa com 0 ponto. O ranking aparece com a primeira entrega.</div>`;
  } else if (sel.startsWith("lista-")){
    body = `<div class="card" style="display:grid;gap:12px"><p class="mut" style="margin:0">Texto pronto para colar no grupo. Um ✅ por missão entregue, na ordem de alistamento.</p>
      <textarea id="lista" readonly>${esc(listaTxt(sel.slice(6)))}</textarea>
      <div><button class="btn pri" data-copy="lista">Copiar lista</button></div></div>`;
  } else {
    const r = rankOf(sel), deckOnly = (() => { const [k, n] = sel.split("-"); const d = D.trilhas[k] && dia(k, +n); return d && !d.prova; })();
    body = r.length ? `<div class="tbl"><table><thead><tr><th>#</th><th>Combatente</th><th class="num">${deckOnly?"Dominou":"Nota"}</th><th class="num">${deckOnly?"De":"Acertos"}</th><th class="num">${deckOnly?"Rever":"Erros"}</th>${deckOnly?"":'<th class="num">Branco</th>'}<th class="num">Tempo</th></tr></thead><tbody>
      ${r.map((p, i) => { const x = res(p, sel); return `<tr class="${i===0?"top1":""} ${p.id===S.uid?"mine":""}"><td class="pos">${i+1}</td><td><b>${esc(p.name)}</b></td><td class="num mono"><b>${x.n}</b></td><td class="num mono">${deckOnly ? maxOf(sel) : x.c}</td><td class="num mono">${x.e}</td>${deckOnly?"":`<td class="num mono">${x.b}</td>`}<td class="num mono">${mmss(x.t)}</td></tr>`; }).join("")}
      </tbody></table></div>` : `<div class="card empty">Ninguém entregou ainda.</div>`;
  }
  return `<section class="sect-h"><div style="display:grid;gap:10px"><span class="eyebrow">Ao vivo</span><h1 class="pg-h gold">Ranking</h1></div>
      <div class="rk-tools"><label for="rkSel" class="mut">Quadro</label><select id="rkSel">${opts.map(([v, t]) => `<option value="${v}" ${v===sel?"selected":""}>${esc(t)}</option>`).join("")}</select></div></section>
    <p class="mut" style="margin:0">Desempate: maior nota, depois menor tempo, depois quem entregou primeiro.</p>
    ${body}`;
}
function listaTxt(k){
  const ps = S.players.slice().sort((a, b) => (a.joinedAt||0) - (b.joinedAt||0));
  const lines = ps.map((p, i) => `${i+1}. ${p.name} ${"✅".repeat(D.trilhas[k].dias.filter((_, j) => res(p, k+"-"+(j+1))).length)}`.trim());
  return `LISTA DE PARTICIPANTES – ${D.trilhas[k].lista || D.titulo}\n\n${lines.join("\n") || "1. "}\n\nAtualizada automaticamente pelo site do desafio MSP.`;
}

function vMentoria(){
  const link = linkMentoria(), contato = contatoTxt(), wa = waLink();
  return `<section class="ment">
    <div style="display:grid;gap:16px">
      <span class="eyebrow">Por trás do desafio</span>
      <h1 class="pg-h gold">Isto é uma semana da mentoria</h1>
      <p class="lead mut" style="font-size:18px;margin:0;max-width:52ch">O desafio usa o mesmo método do dia a dia dos alunos MSP: estudo guiado, revisão ativa, questões no relógio e ranking com a tropa. Na mentoria, isso vira rotina até a posse.</p>
      <div class="ctas" style="margin:0">
        <a class="btn pri" href="${esc(link)}" target="_blank" rel="noopener">Assistir: como funciona a mentoria ↗</a>
        <button class="btn" data-interesse="1">Quero conhecer a mentoria</button>
        ${wa ? `<a class="btn" href="${esc(wa)}" target="_blank" rel="noopener"><span class="wa-ico">${WA_ICON}</span>Falar no WhatsApp</a>` : ""}
      </div>
      ${contato ? `<p class="mut" style="margin:0">Fale com a equipe: <span class="mono">${esc(contato)}</span> <button class="btn sm" data-copytext="${esc(contato)}">Copiar</button></p>` : ""}
      <div class="cmp">
        <div><span class="eyebrow">No desafio</span><h3>Uma amostra</h3><ul><li>Um tema por dia</li><li>Material, revisão e questões</li><li>Prova no relógio</li><li>Ranking da comunidade</li></ul></div>
        <div><span class="eyebrow">Na mentoria</span><h3>Até a aprovação</h3><ul><li>Plano de estudo semanal</li><li>Todas as disciplinas do edital</li><li>Simulados e acompanhamento</li><li>Correção de rota com mentor</li></ul></div>
      </div>
    </div>
    <div class="card"><span class="eyebrow">Como funciona a rotina</span>
      <div class="ladder" style="margin-top:16px">
        <div><b>Diagnóstico</b><p>Você mostra onde está; o plano parte do seu tempo real de estudo.</p></div>
        <div><b>Plano da semana</b><p>Ciclo com lei seca, teoria e questões, igual ao protocolo do desafio.</p></div>
        <div><b>Revisão ativa</b><p>Flashcards e retomadas programadas para o que você erra.</p></div>
        <div><b>Simulados e ranking</b><p>Prova no relógio, comparação com a tropa e correção item por item.</p></div>
        <div><b>Ajuste com mentor</b><p>Os números da semana definem o que muda na seguinte.</p></div>
      </div></div>
  </section>`;
}

function vComando(){
  const L = S.leads.slice().sort((a, b) => (a.at||0) - (b.at||0));
  return `<section class="sect-h"><div style="display:grid;gap:10px"><span class="eyebrow">Somente coordenação</span><h1 class="pg-h gold">Comando</h1></div></section>
    <section class="adm">
      ${TRK.map(k => `<div class="card" style="display:grid;gap:10px"><span class="eyebrow">Liberadas · ${esc(D.trilhas[k].sigla)}</span>
        <div class="stepn"><button class="btn sm" data-cfg="${k}" data-d="-1" aria-label="Menos uma">−</button><b class="mono">${S.cfg[k]||0}</b><button class="btn sm" data-cfg="${k}" data-d="1" aria-label="Mais uma">+</button><span class="mut">de ${D.trilhas[k].dias.length}</span></div>
        <span class="mut" style="font-size:13px">Libere uma por dia, no ritmo do grupo.</span></div>`).join("")}
      ${(D.arena || []).map(a => `<div class="card" style="display:grid;gap:10px"><span class="eyebrow">Arena · ${esc(a.nome)}</span>
        ${a.abre === "sempre" ? `<span class="mut">Sempre aberta.</span>` : `<button class="btn ${S.cfg["a_"+a.id]?"":"pri"}" data-cfgarena="${a.id}">${S.cfg["a_"+a.id] ? "Liberada · bloquear" : "Liberar agora"}</button>`}</div>`).join("")}
    </section>
    <form class="card" id="fCfg" style="display:grid;gap:12px">
      <span class="eyebrow">Liberação automática</span>
      <p class="mut" style="margin:0">A missão 1 abre na data de início, na hora marcada (horário de Brasília). Cada missão seguinte abre no próximo dia. Os botões + e − acima continuam valendo para liberar antes.</p>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px">
        <label class="f">Data de início <input type="date" id="cfgIni" value="${esc(S.cfg.inicio||D.inicio||"")}"></label>
        <label class="f">Hora <input type="number" id="cfgHora" min="0" max="23" value="${esc(S.cfg.hora ?? D.hora ?? 10)}"></label>
        <label class="f">Duração (min, 0 = sem fim) <input type="number" id="cfgDur" min="0" max="10080" value="${esc(S.cfg.duracao ?? D.duracao ?? 0)}"></label>
        <label class="f">Dias <select id="cfgDias"><option value="uteis" ${(S.cfg.dias||D.dias||"uteis")==="uteis"?"selected":""}>Úteis (seg a sex)</option><option value="corridos" ${(S.cfg.dias||D.dias)==="corridos"?"selected":""}>Corridos (todo dia)</option></select></label>
      </div>
      ${(S.cfg.inicio||D.inicio) ? `<p class="mut" style="margin:0">${TRK.map(k => `${esc(D.trilhas[k].sigla)}: ${D.trilhas[k].dias.map((_, i) => `${pad(i+1)} ${fmtRel(releaseAt(k, i+1))}`).join(" · ")}`).join("<br>")}</p>` : ""}
      <span class="eyebrow" style="margin-top:8px">Página da mentoria</span>
      <label class="f">Link da mentoria <input type="url" id="cfgLink" value="${esc(S.cfg.mentoria||"")}" placeholder="${esc(MENTORIA_URL)}"></label>
      <label class="f">WhatsApp da equipe <input type="text" id="cfgContato" value="${esc(S.cfg.contato||"")}" placeholder="${esc(CONTATO_PADRAO || "(61) 9…")}"></label>
      <div><button class="btn pri" type="submit">Salvar</button></div>
    </form>
    <section style="display:grid;gap:12px">
      <div class="sect-h"><h2 style="font-size:34px">Inscritos (${L.length})</h2><button class="btn sm" data-copy-csv="1">Copiar planilha</button></div>
      ${L.length ? `<div class="tbl"><table><thead><tr><th>Nome</th><th>WhatsApp</th><th>Aluno</th><th>Autorizou</th><th>Quer mentoria</th><th class="num">Missões</th></tr></thead><tbody>
        ${L.map(l => { const p = S.players.find(x => x.id === l.id); return `<tr><td>${esc(l.name)}</td><td class="mono">${esc(l.whats||"–")}</td><td>${l.mentorado?"Sim":"Não"}</td><td>${l.consent?"Sim":"Não"}</td><td>${l.interesse?"⭐ Sim":"–"}</td><td class="num mono">${p?doneCount(p):0}</td></tr>`; }).join("")}
      </tbody></table></div>` : `<div class="card empty">Os inscritos aparecem aqui conforme se alistam.</div>`}
    </section>`;
}

/* ---------- comportamento ---------- */
function after(){
  const f = $("#fEnlist"); if (f) f.onsubmit = enlist;
  const fc = $("#fCfg"); if (fc) fc.onsubmit = e => { e.preventDefault(); saveCfg({ mentoria:$("#cfgLink").value.trim(), contato:$("#cfgContato").value.trim(), inicio:$("#cfgIni").value, hora:Math.max(0, Math.min(23, +$("#cfgHora").value || 10)), dias:$("#cfgDias").value, duracao:Math.max(0, +$("#cfgDur").value || 0) }); };
  const rk = $("#rkSel"); if (rk) rk.onchange = () => { S.rk = rk.value; render(); };
  tickCd();
}
document.addEventListener("click", async e => {
  const t = e.target.closest("button,a"); if (!t || t.closest("#quiz")) return;
  const ds = t.dataset;
  if (ds.scroll){ e.preventDefault(); if (route() !== "inicio") location.hash = "#inicio"; setTimeout(() => { const el = document.getElementById(ds.scroll); if (el) el.scrollIntoView({behavior:"smooth"}); }, 30); return; }
  const panel = t.closest(".panel"), cid = panel && panel.dataset.cid;
  if (ds.tab != null){ S.tab[route()] = +ds.tab; render(); return; }
  if (ds.mark && cid){ S.prog[cid] = Object.assign({}, S.prog[cid], {[ds.mark]:true}); ls.set("prog", S.prog); if (ds.next) S.tab[cid] = +ds.next; render(); return; }
  if (ds.deck && cid){ deck(ds.deck); return; }
  if (ds.pdf){ baixar(ds.pdf, ds.pdfnome, t); return; }
  if (ds.start){ startQuiz(ds.start, !!ds.treino); return; }
  if (ds.review){ showResult(ds.review); return; }
  if (ds.copy){ const el = document.getElementById(ds.copy); copy(el.value, el); return; }
  if (ds.copytext){ copy(ds.copytext); return; }
  if (ds.copyCsv){ copy(csv()); return; }
  if (ds.cfgarena){ saveCfg({ ["a_"+ds.cfgarena]: !S.cfg["a_"+ds.cfgarena] }); return; }
  if (ds.cfg){ const max = D.trilhas[ds.cfg].dias.length; saveCfg({ [ds.cfg]: Math.max(0, Math.min(max, (S.cfg[ds.cfg]||0) + (+ds.d))) }); return; }
  if (ds.interesse){ interesse(); return; }
});
function deck(a){
  const st = S.deck; if (!st) return;
  if (a === "flip") st.flip = !st.flip;
  else if (a === "know"){ if (!st.seen[st.order[st.i]]) st.know++; st.i++; st.flip = false; }
  else if (a === "again"){ st.seen[st.order[st.i]] = 1; st.order.push(st.order[st.i]); st.i++; st.flip = false; }
  else if (a === "reset") S.deck = null;
  render();
}
function toast(m){ const t = $("#toast"); t.textContent = m; t.hidden = false; clearTimeout(toast.h); toast.h = setTimeout(() => t.hidden = true, 2600); }
async function copy(text, el){
  try { await navigator.clipboard.writeText(text); toast("Copiado"); }
  catch(err){ if (el && el.select){ el.focus(); el.select(); toast("Selecionado: use Copiar do seu aparelho"); } else toast("Não deu para copiar aqui"); }
}
function csv(){
  const rows = [["nome","whatsapp","aluno","autorizou","quer_mentoria","missoes"]].concat(S.leads.map(l => { const p = S.players.find(x => x.id === l.id); return [l.name, l.whats||"", l.mentorado?"sim":"nao", l.consent?"sim":"nao", l.interesse?"sim":"nao", p?doneCount(p):0]; }));
  return rows.map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(",")).join("\n");
}
async function baixar(path, nome, btn){
  if (!S.dl){ toast("Download indisponível nesta visualização"); return; }
  btn.disabled = true; const old = btn.textContent; btn.textContent = "Preparando…";
  try { const blob = await (await fetch(path)).blob(); await S.dl.save({ filename:nome, data:blob }); }
  catch(err){ if (!err || err.code !== "declined") toast("Não foi possível baixar agora"); }
  btn.disabled = false; btn.textContent = old;
}
async function enlist(e){
  e.preventDefault();
  const name = $("#enName").value.trim().replace(/\s+/g," "), whats = $("#enWhats").value.trim();
  const mentorado = $("#enAlunoS").checked, consent = $("#enOk").checked;
  if (name.length < 2){ $("#enErr").textContent = "Escreva o nome que vai aparecer no ranking."; return; }
  const doc = { name, mentorado, joinedAt:Date.now(), res:{} };
  if (S.online){
    try {
      await S.db.doc("players/" + S.uid).set(doc);
      await S.db.doc("leads/" + S.uid).set({ name, whats, mentorado, consent, at:Date.now(), interesse:false });
    } catch(err){ $("#enErr").textContent = "Não foi possível salvar agora. Tente de novo em instantes."; return; }
  } else { S.me = Object.assign({ id:"local" }, doc); ls.set("me", S.me); }
  toast("Alistado. Bem-vindo ao desafio!");
  location.hash = "#" + TRK[0]; render();
}
async function saveCfg(patch){
  const next = Object.assign({}, S.cfg, patch);
  try { await S.db.doc("config/main").set(next); toast("Salvo"); } catch(err){ toast("Não foi possível salvar"); }
}
async function interesse(){
  if (!S.me){ toast("Aliste-se primeiro: é por lá que a equipe te encontra."); location.hash = "#inicio"; setTimeout(() => { const el = document.getElementById("alistar"); if (el) el.scrollIntoView({behavior:"smooth"}); }, 60); return; }
  if (S.online){ try { await S.db.doc("leads/" + S.uid).update({ interesse:true, interesseAt:Date.now() }); } catch(err){} }
  toast("Recebido! A equipe vai entrar em contato.");
}

/* ---------- prova ---------- */
function startQuiz(cid, treino){
  if (!isOpen(cid)) return;
  { const m = S.me && S.me.res && S.me.res[cid]; if (!S.owner && isClosed(cid) && !(m && m.st)) treino = true; }
  const qz = provaOf(cid), my = S.me && S.me.res && S.me.res[cid];
  if (!qz.q || !qz.q.length){ toast("Liberando as questões… a página vai recarregar sozinha."); setTimeout(() => location.reload(), 4000); return; }
  const official = !treino && !res(S.me, cid);
  let st = Date.now(), ans = new Array(qz.q.length).fill("");
  if (official){
    const saved = ls.get("ans:" + cid, null);
    if (my && my.st){ st = my.st; if (saved) ans = saved; }
    else if (S.online && S.me){ S.db.doc("players/" + S.uid).update({ res:{ [cid]:{ st } } }).catch(() => {}); }
    else if (S.me){ S.me.res = S.me.res || {}; S.me.res[cid] = { st }; ls.set("me", S.me); }
  }
  S.quiz = { cid, qz, ans, i:0, st, treino:!official, confirm:false };
  $("#quiz").hidden = false; document.body.style.overflow = "hidden";
  drawQuiz(); tick();
  clearInterval(S.timer); S.timer = setInterval(tick, 1000);
}
function left(){ const q = S.quiz; return q.qz.tempo - (Date.now() - q.st)/1000; }
function tick(){
  const q = S.quiz; if (!q || q.done) return;
  const l = left(), c = $("#clk"), b = $("#tbar");
  if (c){ c.textContent = mmss(l); c.classList.toggle("low", l < 60); }
  if (b) b.style.width = Math.max(0, l / q.qz.tempo * 100) + "%";
  if (l <= 0) submit(true);
}
function drawQuiz(){
  const q = S.quiz, it = q.qz.q[q.i], a = q.ans[q.i], blanks = q.ans.filter(x => !x).length, ce = q.qz.tipo === "ce";
  const lbl = v => !v ? "em branco" : ce ? (v==="C"?"certo":"errado") : "letra " + v;
  $("#quiz").innerHTML = `<div class="qtop"><div class="wrap"><span class="t">${esc(q.qz.nome)}${q.treino?' <span class="pill">treino</span>':""}</span>
      <span id="clk" class="clock" aria-live="off">${mmss(left())}</span></div><div class="tbar"><i id="tbar" style="width:${Math.max(0,left()/q.qz.tempo*100)}%"></i></div></div>
    <div class="wrap"><div class="qbody">
      <span class="qno">${it.tag ? esc(it.tag).toUpperCase() + " · " : ""}${D.rotuloItem || (ce ? "ITEM" : "QUESTÃO")} ${pad(q.i+1)} DE ${pad(q.qz.q.length)}</span>
      ${it.texto ? `<div class="texto">${esc(it.texto)}</div>` : ""}
      <p class="qtext">${esc(it.t)}</p>
      ${ce ? `<div class="ans"><button class="c" data-a="C" aria-pressed="${a==="C"}">Certo<kbd>C</kbd></button><button class="e" data-a="E" aria-pressed="${a==="E"}">Errado<kbd>E</kbd></button></div>`
           : `<div class="opts">${it.o.map((o, j) => `<button data-a="${LET[j]}" aria-pressed="${a===LET[j]}"><span class="l">${LET[j]}</span><span>${esc(o)}</span></button>`).join("")}</div>`}
      <div class="qnav"><button class="btn sm" data-a="" ${a?"":"disabled"}>Deixar em branco</button><span style="flex:1"></span>
        <button class="btn sm" data-go="-1" ${q.i?"":"disabled"}>← Anterior</button><button class="btn sm" data-go="1" ${q.i<q.qz.q.length-1?"":"disabled"}>Próximo →</button></div>
      <span class="sheet-lbl">Cartão-resposta</span>
      <div class="sheet">${q.ans.map((v, i) => `<button data-jump="${i}" data-v="${v}" class="${i===q.i?"cur":""}" aria-label="${i+1}: ${lbl(v)}">${ce || !v ? pad(i+1) : pad(i+1) + v}</button>`).join("")}</div>
      <div class="qnav">${q.confirm ? `<button class="btn pri" data-submit="1">Confirmar entrega${blanks?` (${blanks} em branco)`:""}</button><button class="btn" data-submit="0">Voltar à prova</button>` : `<button class="btn pri" data-submit="ask">Entregar prova</button>`}
        ${q.treino ? `<button class="btn ghost" data-close="1">Sair do treino</button>` : ""}</div>
    </div></div>`;
}
function answer(v){
  const q = S.quiz; q.ans[q.i] = v; if (!q.treino) ls.set("ans:" + q.cid, q.ans);
  if (v && q.i < q.qz.q.length-1) q.i++; drawQuiz();
}
$("#quiz").addEventListener("click", e => {
  const t = e.target.closest("button"); if (!t || !S.quiz) return;
  const q = S.quiz, d = t.dataset;
  if (q.done){ if (d.close) closeQuiz(); else if (d.copymsg) copy(d.copymsg); return; }
  if (d.a != null) answer(d.a);
  else if (d.go){ q.i = Math.max(0, Math.min(q.qz.q.length-1, q.i + (+d.go))); drawQuiz(); }
  else if (d.jump){ q.i = +d.jump; drawQuiz(); }
  else if (d.submit === "ask"){ q.confirm = true; drawQuiz(); }
  else if (d.submit === "0"){ q.confirm = false; drawQuiz(); }
  else if (d.submit === "1") submit(false);
  else if (d.close) closeQuiz();
});
document.addEventListener("keydown", e => {
  const q = S.quiz; if (!q || q.done || $("#quiz").hidden || e.metaKey || e.ctrlKey) return;
  const k = e.key.toUpperCase(), ce = q.qz.tipo === "ce";
  if (ce && (k === "C" || k === "E")) answer(k);
  else if (!ce && LET.indexOf(k) > -1 && LET.indexOf(k) < (q.qz.q[q.i].o||[]).length) answer(k);
  else if (e.key === "Backspace" || e.key === "Delete"){ e.preventDefault(); answer(""); }
  else if (e.key === "ArrowRight"){ q.i = Math.min(q.qz.q.length-1, q.i+1); drawQuiz(); }
  else if (e.key === "ArrowLeft"){ q.i = Math.max(0, q.i-1); drawQuiz(); }
});
function grade(qz, ans){
  let c = 0, e = 0, b = 0;
  qz.q.forEach((x, i) => { if (!ans[i]) b++; else if (ans[i] === x.g) c++; else e++; });
  return { c, e, b, n:qz.penaliza ? c - e : c };
}
async function submit(auto){
  const q = S.quiz; if (!q || q.done) return;
  q.done = true; clearInterval(S.timer);
  const g = grade(q.qz, q.ans), t = Math.min(q.qz.tempo, Math.round((Date.now() - q.st)/1000));
  const rec = Object.assign({ st:q.st, fim:Date.now(), t, a:q.ans.map(x => x || "-").join("") }, g);
  q.rec = rec;
  if (!q.treino){
    if (S.online && S.me){ try { await S.db.doc("players/" + S.uid).update({ res:{ [q.cid]:rec } }); } catch(err){ toast("Falha ao enviar a nota. Ela ficou salva neste aparelho."); ls.set("pend:"+q.cid, rec); } }
    else if (S.me){ S.me.res[q.cid] = rec; ls.set("me", S.me); }
  }
  if (auto) toast("Tempo esgotado. Prova entregue.");
  drawResult(q.cid, rec, q.treino);
}
function showResult(cid){
  const r = res(S.me, cid); if (!r) return;
  S.quiz = { cid, qz:provaOf(cid), done:true, rec:r, treino:false };
  $("#quiz").hidden = false; document.body.style.overflow = "hidden";
  drawResult(cid, r, false);
}
function drawResult(cid, r, treino){
  const qz = provaOf(cid), ans = (r.a || "").split("").map(x => x === "-" ? "" : x), ce = qz.tipo === "ce";
  const rank = rankOf(cid), pos = rank.findIndex(p => p.id === S.uid) + 1;
  const name = S.me ? S.me.name : "Combatente";
  const msg = `🚨 MISSÃO CUMPRIDA – ${qz.nome}\n${qz.sub}\nNota: ${r.n}/${qz.q.length} · ${r.c} acertos, ${r.e} erros, ${r.b} em branco\nTempo: ${mmss(r.t)}${pos ? `\nPosição: ${pos}º de ${rank.length}` : ""}\n\n${name} ✅\n${D.marca || D.titulo} · MSP`;
  $("#quiz").innerHTML = `<div class="qtop"><div class="wrap"><span class="t">${treino ? "Resultado do treino" : "Missão cumprida"}</span><span style="flex:1"></span><button class="btn sm" data-close="1">Fechar</button></div></div>
    <div class="wrap" style="padding-block:28px 48px;display:grid;gap:26px">
      <div class="result">
        <div class="score"><span class="eyebrow">${esc(qz.nome)}</span>
          <div class="big gold">${r.n}<small>/${qz.q.length}</small></div>
          <div class="trio"><div><b class="mono">${r.c}</b><span>acertos</span></div><div><b class="mono">${r.e}</b><span>erros</span></div><div><b class="mono">${r.b}</b><span>branco</span></div><div><b class="mono">${mmss(r.t)}</b><span>tempo</span></div></div>
          ${treino ? `<div class="note">Modo treino: esta nota não altera o ranking.</div>` : pos ? `<div class="note">Você está em <b>${pos}º</b> de ${rank.length}. Ranking atualiza ao vivo.</div>` : ""}
        </div>
        ${treino ? "" : `<div style="display:grid;gap:10px">
          <div class="mc"><span class="mlogo">MSP</span><span class="mrule"></span><span class="tag">${esc(D.marca || D.titulo)}</span><h3 class="gold">Missão cumprida</h3>
            <span class="who">${esc(name)}</span>
            <div class="ln"><span><b>${r.n}</b>nota</span><span><b>${pos ? pos+"º" : "–"}</b>posição</span><span><b>${mmss(r.t)}</b>tempo</span></div>
            <span class="sub">${esc(qz.nome)}${qz.sub ? " · " + esc(qz.sub) : ""}</span></div>
          <p class="mut" style="margin:0;font-size:13.5px">Protocolo: tire print deste cartão, mande no grupo e cole a mensagem abaixo.</p>
          <div class="ctas" style="margin:0"><button class="btn pri" data-copymsg="${esc(msg)}">Copiar mensagem para o grupo</button><a class="btn" href="${esc(linkMentoria())}" target="_blank" rel="noopener">Conheça a mentoria ↗</a>${waLink() ? `<a class="btn" href="${esc(waLink())}" target="_blank" rel="noopener"><span class="wa-ico">${WA_ICON}</span>WhatsApp</a>` : ""}</div></div>`}
      </div>
      ${qz.q.some(x => x.tag) ? (() => { const m = {}; qz.q.forEach((x, i) => { const t = x.tag || "Geral"; m[t] = m[t] || [0, 0]; m[t][1]++; if (ans[i] && ans[i] === x.g) m[t][0]++; });
        return `<section style="display:grid;gap:12px"><h2 style="font-size:34px">Desempenho por matéria</h2><div class="pgrid">${Object.entries(m).map(([t, [a, n]]) => `<div class="pcard"><span class="v">${a}/${n}</span><span class="t">${esc(t)}</span><p>${a === n ? "Gabaritou" : a >= n*0.6 ? "Bom, revise os erros" : "Ponto de atenção"}</p></div>`).join("")}</div></section>`; })() : ""}
      <section style="display:grid;gap:12px"><h2 style="font-size:34px">Correção ${ce ? "item por item" : "questão por questão"}</h2>
        <div class="rev">${qz.q.map((x, i) => { const a = ans[i], ok = a && a === x.g;
          const gab = ce ? (x.g==="C"?"Certo":"Errado") : "Letra " + x.g;
          const opts = !ce && x.o ? x.o.map((o, j) => { const L = LET[j]; return `<p class="op ${L===x.g?"g":L===a?"x":""}">${L}) ${esc(o)}</p>`; }).join("") : "";
          return `<div><span class="i">${pad(i+1)}</span><div>${x.tag ? `<p class="op" style="color:var(--gold);font-weight:700;margin:0 0 4px">${esc(x.tag)}</p>` : ""}<p>${esc(x.t)}</p>${opts}<p class="cm"><b>Gabarito: ${gab}.</b> ${esc(x.c)}</p></div>
            <span class="g ${!a?"bl":ok?"ok":"bad"}">${!a?"Branco":ok?"+1":(qz.penaliza?"−1":"0")}</span></div>`; }).join("")}</div>
      </section>
    </div>`;
}
function closeQuiz(){ $("#quiz").hidden = true; $("#quiz").innerHTML = ""; document.body.style.overflow = ""; clearInterval(S.timer); S.quiz = null; render(); }

/* ---------- conexão ---------- */
async function boot(){
  S.me = ls.get("me", null);
  render();
  const C = window.claude;
  if (!C || !C.use){ S.loading = false; render(); return; }
  const giveUp = setTimeout(() => { if (S.loading){ S.loading = false; render(); } }, 10000);
  try {
    const [db, user, dl] = await Promise.all([C.use("db"), C.use("user"), C.use("downloads")]);
    S.dl = dl;
    if (!db || !user){ S.loading = false; clearTimeout(giveUp); render(); return; }
    S.db = db; S.uid = await user.id(); S.owner = await user.isOwner();
    if (!S.uid){ S.loading = false; clearTimeout(giveUp); render(); return; }
    S.online = true; S.me = null;
    db.collection("players").onSnapshot(snap => {
      clearTimeout(giveUp); S.loading = false;
      S.players = snap.docs.map(d => Object.assign({ id:d.id }, d.data()));
      S.me = S.players.find(p => p.id === S.uid) || null;
      if (!S.quiz) render(); else { renderNav(); if (S.quiz.done && S.quiz.rec && !S.quiz.treino) drawResult(S.quiz.cid, S.quiz.rec, false); }
    }, () => { S.loading = false; render(); });
    db.doc("config/main").onSnapshot(s => { if (s.exists) S.cfg = Object.assign(S.cfg, s.data()); if (!S.quiz) render(); }, () => {});
    if (S.owner) db.collection("leads").onSnapshot(snap => { S.leads = snap.docs.map(d => Object.assign({ id:d.id }, d.data())); if (route()==="comando" && !S.quiz) render(); }, () => {});
  } catch(err){ S.loading = false; clearTimeout(giveUp); render(); }
}
boot();
})();
