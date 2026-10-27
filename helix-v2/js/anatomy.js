// HELIX · anatomia: catalogo strutture (organi, vasi, nervi, ossa, muscoli) e mappa 3D per segmento
// u: laterale normalizzato (+ = sinistra della persona), v: lungo il segmento (0 = giunto prossimale), w: -1 fronte … +1 schiena
import { clamp } from './core.js';
export const CAT={};export const ORDER={org:[],ske:[],vas:[],ner:[],mus:[]};
function def(id,n,t,b=0,x={}){CAT[id]=Object.assign({n,t,b},x);ORDER[t].push(id);}
const LR=(id,n,t,b,x)=>{def(id+'L',n+' sx',t,b,x);def(id+'R',n+' dx',t,b,x);};
// organi (b = perdita mL/min a lesione completa, a pressione normale)
def('cervello','Cervello','org',150);def('tronco','Tronco encefalico','org',60);LR('occhio','Occhio','org',3);def('trachea','Trachea','org',30);def('esofago','Esofago','org',25);
def('cuore','Cuore','org',1600);LR('polmone','Polmone','org',160);def('fegato','Fegato','org',450);def('milza','Milza','org',380);def('stomaco','Stomaco','org',70);def('pancreas','Pancreas','org',110);
LR('rene','Rene','org',230);def('tenue','Intestino tenue','org',80);def('crasso','Intestino crasso','org',60);def('vescica','Vescica','org',30);
// vasi
LR('carotide','Carotide','vas',850,{art:1});LR('giugulare','Giugulare','vas',320);def('aorta','Aorta','vas',4000,{art:1});def('cava','Vena cava','vas',2200);
LR('succlavia','Succlavia','vas',800,{art:1});LR('ascellare','Ascellare','vas',600,{art:1});LR('brachiale','Brachiale','vas',330,{art:1});LR('radiale','Radiale','vas',110,{art:1});
LR('iliaca','Iliaca','vas',1100,{art:1});LR('femorale','Femorale','vas',1000,{art:1});LR('poplitea','Poplitea','vas',430,{art:1});LR('tibiale','Tibiale','vas',140,{art:1});
// nervi
def('midolloC','Midollo spinale cervicale','ner',0);def('midolloT','Midollo spinale toracico','ner',0);def('midolloL','Midollo spinale lombare','ner',0);
LR('plesso','Plesso brachiale','ner',0);LR('nradiale','Nervo radiale','ner',0);LR('nfemorale','Nervo femorale','ner',0);LR('sciatico','Nervo sciatico','ner',0);
// scheletro (b: sanguinamento interno da frattura)
def('cranio','Cranio','ske',30,{g:'Testa'});def('mandibola','Mandibola','ske',15,{g:'Testa'});
for(let i=1;i<=7;i++)def('C'+i,'C'+i,'ske',5,{g:'Vertebre',short:'C'+i});for(let i=1;i<=12;i++)def('T'+i,'T'+i,'ske',5,{g:'Vertebre',short:'T'+i});for(let i=1;i<=5;i++)def('L'+i,'L'+i,'ske',8,{g:'Vertebre',short:'L'+i});
def('sterno','Sterno','ske',10,{g:'Torace'});LR('clavicola','Clavicola','ske',10,{g:'Torace'});LR('scapola','Scapola','ske',10,{g:'Torace'});
for(let i=1;i<=12;i++){def('costaL'+i,'Costa sx '+i,'ske',6,{g:'Costole sx',short:''+i});}for(let i=1;i<=12;i++){def('costaR'+i,'Costa dx '+i,'ske',6,{g:'Costole dx',short:''+i});}
def('bacino','Bacino','ske',150,{g:'Bacino'});
LR('omero','Omero','ske',25,{g:'Arti superiori'});LR('radio','Radio','ske',10,{g:'Arti superiori'});LR('ulna','Ulna','ske',10,{g:'Arti superiori'});LR('mano','Mano','ske',5,{g:'Arti superiori'});
LR('femore','Femore','ske',60,{g:'Arti inferiori'});LR('rotula','Rotula','ske',5,{g:'Arti inferiori'});LR('tibia','Tibia','ske',20,{g:'Arti inferiori'});LR('perone','Perone','ske',8,{g:'Arti inferiori'});LR('piede','Piede','ske',5,{g:'Arti inferiori'});
// muscoli (registrati per il danno e la mobilità)
['collo:Muscoli del collo','pettorali:Pettorali','dorsali:Dorsali','intercostali:Intercostali','addominali:Addominali','lombari:Muscoli lombari','glutei:Glutei'].forEach(s=>{const [i,n]=s.split(':');def(i,n,'mus',20);});
['deltoide:Deltoide','bicipite:Bicipite','tricipite:Tricipite','avambraccio:Muscoli avambraccio','quadricipite:Quadricipite','femorali:Ischiocrurali','polpaccio:Polpaccio'].forEach(s=>{const [i,n]=s.split(':');LR(i,n,'mus',22);});
export const SOFT={cute:'Pelle',grasso:'Grasso'};
export function statusOf(id,hp){const t=CAT[id].t;if(hp>=99)return['intatto','s-ok'];if(hp<=0)return['distrutto','s-dis'];
  if(t==='ske'){if(hp<45)return['fratturato','s-fra'];if(hp<80)return['incrinato','s-les'];return['contuso','s-con'];}
  if(hp<35)return['lesione grave','s-fra'];if(hp<85)return['lesionato','s-les'];return['contuso','s-con'];}
export const COL={'s-ok':'#2c3530','s-con':'#8a8d4a','s-les':'#c08a32','s-fra':'#c24a36','s-dis':'#ff5a46'};

/* ---- mappa anatomica in coordinate locali del segmento ----
   u: laterale normalizzato (+ = sinistra della persona), v: lungo il segmento (0 = giunto prossimale), w: -1 fronte … +1 schiena */
export function anatAt(k,sd,u,v,w){const au=Math.abs(u),S=u>0?'L':'R',rho=Math.hypot(u,w);
  switch(k){
  case 'head':{const r=Math.hypot(u,v,w);if(r>.93)return'cute';if(v<-.42)return w<.15?'mandibola':'C1';
    if(v>-.05&&v<.32&&w<-.62&&au>.18&&au<.62)return'occhio'+S;if(r>.8)return'cranio';if(v<-.22&&au<.3&&w>-.15&&w<.6)return'tronco';return'cervello';}
  case 'neck':{if(rho>.9)return'cute';if(w>.22&&au<.42){if(au<.16&&w>.42&&w<.72)return'midolloC';return'C'+clamp(7-Math.floor(v*7),1,7);}
    if(w<-.35&&au<.3)return'trachea';if(w>-.35&&w<.22&&au<.2)return'esofago';if(au>.28&&au<.62&&w<.08&&w>-.62)return'carotide'+S;if(au>=.62&&w<.3&&w>-.5)return'giugulare'+S;return'collo';}
  case 'tho':{if(rho>.95)return'cute';if(rho>.9)return'grasso';
    if(au<.13&&w>.6){if(au<.06&&w>.7&&w<.85)return'midolloT';return'T'+clamp(12-Math.floor(v*12),1,12);}
    if(au<.14&&w<-.72&&v>.2)return'sterno';if(v>.86&&w<-.35&&au>.12&&au<.82)return'clavicola'+S;if(w>.6&&au>.25&&au<.8&&v>.42)return'scapola'+S;
    if(rho>.82)return w<0?'pettorali':'dorsali';
    if(rho>.73){const n=clamp(1+Math.floor((1-v)*12),1,12);return((v*12)%1)<.62?'costa'+S+n:'intercostali';}
    if(v>.8&&au<.08&&w<-.15)return'trachea';if(v>.8&&au<.08&&w>-.15&&w<.28)return'esofago';
    if(v>.78&&au>.12&&au<.58&&w<.05)return'succlavia'+S;if(au>.6&&v>.7)return'ascellare'+S;
    if((u>-.1&&u<.16&&w>.2&&w<.55)||(v>.66&&v<.82&&u>-.1&&u<.25&&w>-.3&&w<.5))return'aorta';
    if(u<-.08&&u>-.28&&w>-.25&&w<.25&&v<.75)return'cava';
    if(u>-.12&&u<.44&&v>.24&&v<.66&&w<.15&&w>-.7)return'cuore';
    if(v<.3&&u<.22)return'fegato';if(v<.26&&u>.44&&w>-.1)return'milza';if(v<.22&&u>.05&&w<0)return'stomaco';
    return'polmone'+S;}
  case 'abd':{if(rho>.95)return'cute';if(rho>.84)return'grasso';if(rho>.74)return w<0?'addominali':(v<.15?'glutei':'lombari');
    if(au<.14&&w>.6){if(v<.1)return'bacino';if(au<.06&&w>.68&&w<.82)return'midolloL';return'L'+clamp(5-Math.floor(v*5),1,5);}
    if(v<.12&&(au>.5||w>.55))return'bacino';if(v<.16&&au>.15&&au<.5&&w>-.2&&w<.42)return'iliaca'+S;if(v<.05&&au<.3&&w<-.2)return'vescica';
    if(u>-.06&&u<.16&&w>.3&&w<.6&&v>.12)return'aorta';if(u<-.06&&u>-.24&&w>.25&&w<.6&&v>.12)return'cava';
    if(au>.25&&au<.62&&v>.45&&w>.35)return'rene'+S;
    if(v>.68){if(u<.05)return'fegato';if(u>.5&&w>0)return'milza';if(w<.05)return'stomaco';}
    if(v>.55&&v<.8&&w>-.05&&w<.35&&u>-.2&&u<.5)return'pancreas';if(au>.52||(v>.55&&v<.68&&w<0))return'crasso';return'tenue';}
  }
  // arti: m = mediale (+ verso la linea mediana)
  const m=sd==='L'?-u:u;
  switch(k){
  case 'uarm':{if(rho>.92)return'cute';if(rho<.32)return'omero'+sd;if(v<.2){if(m>.2&&rho<.62&&w<.35)return m>.45?'ascellare'+sd:'plesso'+sd;return'deltoide'+sd;}
    if(m>.35&&rho<.66&&w<.2&&w>-.45)return'brachiale'+sd;if(w>.3&&m<0&&rho<.6&&v>.3&&v<.75)return'nradiale'+sd;return w<0?'bicipite'+sd:'tricipite'+sd;}
  case 'farm':{if(rho>.9)return'cute';if(rho<.4)return(m>0?'ulna':'radio')+sd;if(v>.55&&m<-.15&&w<0&&rho<.72)return'radiale'+sd;return'avambraccio'+sd;}
  case 'hand':return rho<.75?'mano'+sd:'cute';
  case 'thigh':{if(rho>.93)return'cute';if(rho>.82)return'grasso';if(rho<.3)return'femore'+sd;if(v>.92&&w<-.4)return'rotula'+sd;
    if(v>.78&&w>.25&&Math.abs(m)<.38&&rho<.62)return'poplitea'+sd;if(m>.28&&w<.12&&w>-.55&&rho<.64)return v<.12?'iliaca'+sd:'femorale'+sd;
    if(w>.35&&Math.abs(m)<.3&&rho<.55)return'sciatico'+sd;if(m>.2&&w<-.3&&rho<.5&&v<.3)return'nfemorale'+sd;if(v<.12&&w>0)return'glutei';return w<.1?'quadricipite'+sd:'femorali'+sd;}
  case 'shin':{if(rho>.92)return'cute';if(v<.08&&w<-.5)return'rotula'+sd;if(m>-.15&&w<-.15&&rho<.6)return'tibia'+sd;if(m<-.42&&rho<.6&&w>-.35&&w<.35)return'perone'+sd;
    if(v<.18&&w>.22&&rho<.6)return'poplitea'+sd;if(rho<.62&&w>-.05&&w<.5&&Math.abs(m)<.42)return'tibiale'+sd;return'polpaccio'+sd;}
  case 'foot':return rho<.8?'piede'+sd:'cute';}
  return'cute';}
export const ZLABEL={head:'Testa',neck:'Collo',tho:'Torace',abd:'Addome',uarm:'Braccio',farm:'Avambraccio',hand:'Mano',thigh:'Coscia',shin:'Gamba',foot:'Piede'};
// strutture "vitali": un colpo di cecchino che le attraversa avvia la killcam
export const VITAL = id => /^(cervello|tronco|cuore|aorta|cava|carotide|midolloC|polmone|succlavia|fegato|giugulare|femorale|iliaca)/.test(id);
export const sideLabel = sd => sd ? (sd === 'L' ? ' sx' : ' dx') : '';
