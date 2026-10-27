# HELIX · simulatore di combattimento

Gioco web in prima persona in cui **ogni colpo segue l'anatomia**: ossa, organi, vasi e nervi sono mappati in 3D dentro ogni segmento del corpo, e la fisiologia (pressione, battito, saturazione, shock emorragico, coscienza) reagisce in tempo reale.

## Come giocare

| Modo | Come |
|---|---|
| **Online** | Pubblica il repo su GitHub Pages (vedi sotto) e apri il link |
| **Doppio clic, offline** | Apri `dist/helix-standalone.html` (un solo file, tutto incluso) |
| **Dal sorgente** | `python tools/serve.py` → http://localhost:8000 |

> I moduli ES e gli shader esterni non si caricano da `file://`: per la versione sorgente serve un server (anche `npx serve`), oppure usa lo standalone.

## Comandi

| Tasto | Azione |
|---|---|
| WASD · Shift · Spazio · C · Q/E | movimento, corsa, salto, accovacciarsi, sporgersi |
| 1 … 0 / rotellina | cambia arma |
| Mouse sx | attacco · jab → diretto alternati |
| **A**+sx / **D**+sx | gancio sinistro / destro |
| **S**+sx | montante |
| F | calcio frontale · **S**+F low kick · **A/D**+F calcio circolare |
| V | gomitata (pugni) · affondo di punta (mazza) |
| Mouse dx | guardia (pugni/mazza) · mira (armi da fuoco) · affondo (coltello) |
| Shift in mira col cecchino | trattieni il respiro |
| G | cambia oggetto da lancio (coltelli, mattone, granata) |
| B | benda la ferita che sanguina di più |
| R · X · T · N | ricarica · rallentatore · orario · nuovo round |
| Tab · H | cambia bersaglio · scheda anatomica |

### Combinazioni
Colpi concatenati entro ~0,9 s danno un moltiplicatore e possono **sfondare la guardia**:
jab-diretto (×1,12) · jab-jab-diretto (×1,22) · **1-2-3** jab-diretto-gancio (×1,32) · 1-2-3-2 (×1,45) · **Tempesta** diretto-gancio-montante (×1,45) · gancio-montante · montante-gancio · jab-diretto-low kick · jab-gomito · diretto-circolare · coltello: fendente-affondo · mazza: orizzontale-dall'alto. L'elenco è in `data/weapons.json`.

## Armi

Pugni · Tirapugni (più energia concentrata: fratture e lacerazioni) · Coltello (fendente largo e poco profondo, affondo stretto e profondo) · Mazza da baseball · Pistola 9 mm · Fucile a pompa cal. 12 (9 pallettoni) · Fucile d'assalto 5.56 (automatico, cavitazione) · Fucile di precisione .308 (cannocchiale 6×, otturatore, **killcam**) · Armi da lancio (coltelli che si conficcano, mattone, granata a frammentazione con 70 schegge e onda d'urto) · **Rasengan** (arma leggendaria: tieni premuto sx per il colpo ravvicinato, dx per lanciarlo).

### Killcam del cecchino
Se il proiettile del .308 attraversa una struttura vitale (cervello, tronco encefalico, cuore, aorta, carotidi, polmoni, fegato, femorali…), il tempo si ferma: la camera insegue il proiettile, poi il corpo diventa a **raggi X**, il tramite appare in rosso e ogni tessuto perforato si illumina con il suo stato e l'energia residua. Spazio o clic per saltare; si disattiva dal menu.

## Realismo

- **Balistica**: energia che si dissipa per centimetro di tessuto (diversa per osso e polmone), proiettili ritenuti o in uscita, cavitazione temporanea per i colpi veloci, sovrapenetrazione su più bersagli.
- **Contundenti**: soglie di frattura per osso, energia del colpo da massa efficace e velocità, commozione e KO in base alla rotazione della testa, colpo al fegato, senza fiato.
- **Sangue**: gocce fisiche allungate nella direzione del moto, nebulizzazione all'uscita, schizzi direzionali su muri e pavimento con colature per gravità, pozze che si allargano sotto i corpi, ossidazione (rosso vivo → bruno) e riflesso bagnato in GLSL, zampilli arteriosi a ritmo del battito, vestiti che si impregnano e sangue che cola sulla texture del corpo, lividi che diventano viola nel tempo.
- **Avversari**: guardia con gli avambracci, schivate (slip/abbassarsi), footwork dentro-fuori, combinazioni, fiato che si esaurisce, stordimento dopo i colpi duri, armi (mazza/coltello) che possono perdere.
- **Danni al giocatore** per zona: testa (vista sfocata, fischio nelle orecchie, audio ovattato, KO), braccia (meno potenza, mira che trema, fratture), gambe (zoppia, niente corsa), torace/addome (fiato), emorragia con battito nelle orecchie e desaturazione. Mappa del corpo in basso a sinistra: le zone colpite diventano rosse e pulsano quando fanno male.

## Struttura del progetto

```
index.html               pagina (HTML)
css/style.css            interfaccia (CSS)
js/                      logica di gioco, moduli ES (JavaScript)
  core.js                renderer, stato condiviso, caricamento asset
  world.js · nav.js      mappa, cielo, luci, collisioni · pathfinding A*
  anatomy.js             catalogo anatomico e mappa 3D per segmento
  char.js                personaggi: IK, fisiologia, ragdoll Verlet, IA
  skin.js                texture dipinte: ferite, lividi, sangue che impregna
  fx.js                  gocce, nebulizzazione, decal di sangue, onde d'urto
  combat.js              colpi, combinazioni, armi da fuoco, lanci, granate, Rasengan
  killcam.js             killcam e vista a raggi X
  playerbody.js          danni e fisiologia del giocatore
  bodymap.js             mappe SVG del corpo
  weapons.js · player.js modelli in prima persona · movimento e mira
  audio.js               audio sintetizzato con Web Audio
  ui.js · main.js        HUD · avvio, input e ciclo
shaders/*.glsl           cielo, sangue, nebulizzazione, Rasengan, raggi X, onda d'urto (GLSL)
data/weapons.json        balistica, armi, mosse e combinazioni (JSON)
tools/build.mjs          build dello standalone con esbuild (Node)
tools/serve.py           server di sviluppo (Python)
.github/workflows/       pubblicazione automatica su GitHub Pages (YAML)
vendor/three.min.js      three.js r149 (MIT)
```

## Pubblicare su GitHub Pages

1. Crea un repository e carica il contenuto di questa cartella (anche dal sito, "Add file → Upload files").
2. *Settings → Pages → Build and deployment → Source: **GitHub Actions***.
3. Ad ogni push su `main` il workflow `pages.yml` genera lo standalone e pubblica il sito su `https://<utente>.github.io/<repo>/`.

## Sviluppo

```bash
npm install          # solo esbuild, per la build standalone
npm run dev          # server locale
npm run build        # rigenera dist/helix-standalone.html
```

Nota: è un simulatore di finzione con grafica stilizzata; i valori anatomici e balistici sono approssimazioni a scopo di gioco.
