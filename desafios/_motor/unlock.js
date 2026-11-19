/* Trava por tempo: as questões vêm cifradas com timelock drand (tlock).
   Ninguém, nem a MSP, consegue abrir antes da hora: a chave só é publicada pela rede drand no horário. */
import { mainnetClient, timelockDecrypt } from "./tlock.js";

const D = window.MSP_DATA, LOCK = window.MSP_LOCK;
const load = src => new Promise((ok, no) => { const s = document.createElement("script"); s.src = src; s.onload = ok; s.onerror = no; document.body.appendChild(s); });
const box = () => { const p = D.trilhas[Object.keys(D.trilhas)[0]].dias[0].prova; return p; };

async function tryOpen(){
  const plain = await timelockDecrypt(LOCK.ct, mainnetClient());
  const q = JSON.parse(new TextDecoder().decode(plain));
  box().q.splice(0, box().q.length, ...q);
}

(async () => {
  let open = false;
  if (LOCK && Date.now() >= LOCK.at - 2000){
    for (let i = 0; i < 4 && !open; i++){
      try { await tryOpen(); open = true; } catch(e){ await new Promise(r => setTimeout(r, 2500)); }
    }
  }
  await load("../_motor/store.js");
  await load("../_motor/engine.js");
  if (LOCK && !open){
    /* aguarda a hora e recarrega já com as questões */
    const wait = Math.max(0, LOCK.at - Date.now());
    const tick = async () => { try { await timelockDecrypt(LOCK.ct, mainnetClient()); location.reload(); } catch(e){ setTimeout(tick, 3000); } };
    if (wait < 2147483647) setTimeout(tick, wait + 1000);
  }
})();
