
import { mainnetClient, timelockDecrypt } from "./t.js";

const D = window.MSP_DATA, LOCK = window.MSP_LOCK;
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
  if (window.__msp) window.__msp();
  if (LOCK && !open){
    
    const wait = Math.max(0, LOCK.at - Date.now());
    const tick = async () => { try { await timelockDecrypt(LOCK.ct, mainnetClient()); location.reload(); } catch(e){ setTimeout(tick, 3000); } };
    if (wait < 2147483647) setTimeout(tick, wait + 1000);
  }
})();
