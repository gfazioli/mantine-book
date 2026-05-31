# Page-curl iBooks/iPad: la matematica dietro l'effetto e come avvicinarci in DOM/CSS

> Brief tecnico per il maintainer del componente `mantine-book` (React / DOM / CSS, **senza WebGL**). Tutte le affermazioni sono ancorate alle fonti citate; dove una fonte è incerta, bloccata o ricostruita (non verbatim) è segnalato esplicitamente.
>
> _Prodotto da una ricerca multi-agente (36 fonti trovate, 16 lette in profondità, verifica anti-allucinazione inclusa) — 2026-05-31. Vedi §Fonti per la mappa dei riferimenti `[n]`._

---

## 1. Cosa fece Apple (iBooks 2010 + API native iOS)

Apple **non ha mai pubblicato la matematica** del proprio page-curl. Le API native sono "black-box" a tre livelli distinti, e in nessuno di essi compaiono equazioni di deformazione dei vertici.

### 1.1 `UIPageViewController.TransitionStyle.pageCurl` — livello UIKit (zero matematica)
La pagina dell'API contiene **ZERO matematica**: solo la dicitura "Page curl transition style", una frase di comportamento ("displays a page-turning animation... the animation follows the user's finger during a navigation gesture") e `case pageCurl` [0]. È una transizione opaca renderizzata internamente da UIKit/Core Animation: lo sviluppatore fornisce solo i view controller e (opzionalmente) un data source che fa seguire il curl al dito — **nessun raggio, angolo o geometria è esposto** a questo livello [0]. La **posizione** dello spine/fold a livello UIKit è gestita separatamente da `UIPageViewController.SpineLocation` (min/mid/max) e dalla proprietà `doubleSided`, non da questo enum [0].

### 1.2 `CIPageCurlTransition` — livello Core Image (parametri, ma niente formule)
È l'unico punto dello stack Apple dove il modello è *parametrizzato*, ma resta una `CIFilter` proprietaria closed-source: **nessun modello geometrico, nessuna equazione di vertice, nessun default numerico** sono pubblicati nelle doc moderne [0][1][15]. I parametri documentati (descrizioni verbatim):
- `angle` (Float) = "The angle of the curling page" — direzione/orientamento della fold line [0][1][15]
- `radius` (Float) = "The radius of the curl" — il **raggio dell'arrotolamento** (unico raggio esposto) [0][1][15]
- `extent` (CGRect) = "The extent of the effect" [0][1]
- `backsideImage` (CIImage?) = l'immagine sul retro della pagina che si arriccia [0][1][15]
- `shadingImage` (CIImage?) = "An image that looks like a shaded sphere enclosed in a square" [0][1][15]
- `time` (ereditato da `CITransitionFilter`) = "The parametric time of the transition", animato 0→1 [0][1][15]

Esiste anche la variante `CIPageCurlWithShadowTransition`, identica ma con generazione automatica dell'ombra [0][1].

**Modello geometrico (ricostruito, NON dichiarato da Apple):** le fonti convergono su un **cylinder-wrap** — la pagina si avvolge attorno a un cilindro invisibile di raggio `radius`, il cui asse è la fold line orientata da `angle` [0]. Va però segnalato esplicitamente che Apple **non dichiara** se la superficie sia cilindro, cono o developable generica: l'unico indizio è la `shadingImage` ("sphere enclosed in a square"), che indica che le normali della superficie curva vengono campionate su una lookup sferica anziché calcolate da una superficie analitica esposta [1]. La classificazione "cilindro" è quindi un'inferenza, con confidence *medium* [0][1].

**Corner vs mid-edge vs spine NON è una modalità distinta.** La differenza emerge solo dalla combinazione di `angle` + `extent` (+ `radius`, `time`): un angolo diagonale con la fold seminata in un angolo dà il classico "dog-ear"; un angolo allineato a un bordo dà uno sweep dritto mid-edge/spine [0][1][15].

**Default numerici:** i valori legacy comunemente citati (`radius` ~100, `angle` 0, `time` 0..1, `extent` [0 0 300 300]) provengono dalle vecchie attribute dictionary del Core Image Filter Reference e **non sono verificabili** dalle pagine attuali o archiviate (la `reference.html` legacy dà 404, web.archive.org bloccato) — quindi non vanno assunti come verificati [0][1]. (Vedi §Rettifiche: non assumere alcun default numerico.)

### 1.3 `CAFilter` "pageCurl" — livello CALayer privato (l'analogo interno)
The Apple Wiki documenta il wrapper privato QuartzCore `CAFilter`, che include un filtro statico `pageCurl` applicabile a una `CALayer` via `layer.filters` [2]. Anche qui **nessuna equazione**: solo nome + chiavi dei parametri. Accetta 12 float, di cui **solo 3 sono pensati per essere modificati** [2]:
- `inputTime` (CGFloat 0..1) — istante dello snapshot nell'animazione [2]
- `inputAngle` (radianti) — direzione del curl: "0 is the +x direction, π/2 is the +y direction" [2]
- `inputRadius` (pixel) — "The radius in pixel of the page's curvature" [2]

Gli altri 9 (start/end inclination angles, back/front enable + colori, shadow color/bounds) "spesso producono effetti pessimi" se cambiati [2]. Il fatto che esponga un **solo asse dritto** (`inputAngle`) implica un **cylinder-wrap a fold dritta, NON un cono** né un corner-mode [2]. È l'analogo CALayer/privato di `CIPageCurlTransition` [2].

> **Nota su CAPageTurnController / OpenGL privato:** le fonti citano `CATransition`/`CAPageTurnController` solo di passaggio come lignaggio del curl privato iOS [0][2]; **nessuna fonte documenta** un'eventuale implementazione OpenGL privata di iBooks con formule.

**Sintesi sezione 1:** Apple non ha mai esposto la matematica. Tutte e tre le API sono opache; l'unica certezza documentata è la **terna di knob** ricorrente — *fold-line angle, curl radius, progress 0→1* — più una back-face e una shading map [0][2][15].

---

## 2. Il modello canonico realistico: cilindro vs cono (superficie sviluppabile)

Il page-curl realistico è una **superficie sviluppabile** (si srotola su un piano senza stirare la carta). Due istanze concrete: **cilindro** (curvatura uniforme) e **cono** (curvatura variabile lungo l'asse). Il cono è il modello accademico canonico iBooks; il cilindro è il suo caso degenere con l'apice all'infinito [11][12].

### 2.1 Il modello a CONO (Hong, Card, Chen — Xerox PARC, "3Book"/iBooks lineage)
Modello canonico, originato dal brevetto PARC **US 2006/0133664 A1** (Hong, Card, Chen; priorità 2004-12-17), equivalente al paper IEEE 3DUI/VR 2006 e AVI 2004 [8][9][10]. *(Le URL ResearchGate/IEEE/ACM erano bloccate — 403/418 — quindi il modello è stato ricostruito dal brevetto equivalente degli stessi autori. Nota: le fonti riportano il numero di brevetto concesso in modo **incoerente** — US7667703 in [8] vs US 7,898,541 B2 in [7]/[10] — per la stessa domanda; vedi §Rettifiche.)*

**Costruzione:** ogni faccia della pagina che gira viene avvolta attorno a un **cono immaginario** (dual-cone: un cono per la faccia superiore, uno per quella inferiore, che condividono `θ` e `V_y`) [8][9]. L'asse del cono è parallelo all'asse y (il dorso); il lato del cono lungo la linea V–S **coincide con la rilegatura**, così il dorso non si deforma [8][9][10].

**Equazione verbatim disponibile** (l'unica formula chiusa pubblicata nel brevetto): per un punto piatto P=(P_x, P_y, 0), il raggio dall'apice proiettato V è
```
R = sqrt(P_x^2 + (P_y - V_y)^2)
```
[8][9][10]. L'angolo di avvolgimento del punto curvato = (lunghezza d'arco / R), con mappatura che **preserva la lunghezza d'arco** (niente stretch/compress) [9]. **Le coordinate cartesiane chiuse del punto mappato T NON sono espanse verbatim** nel brevetto [8][9].

**Due parametri animati guidano l'intero turn** [8][9][10]:
- `θ(t)` (semi-angolo del cono): parte da **90° (piatto, nessun curl)**, scende a un minimo a metà giro (curl massimo), poi torna a 90° (la seconda metà è speculare). Il minimo **non è dato numericamente**.
- `V_y(t)` (apice lungo l'asse y/dorso): scivola lungo l'asse y "verso meno infinito", propagando il curl attraverso la pagina.

Entrambe `θ(t)` e `V_y(t)` sono **empiriche/hand-tuned**, non in forma chiusa [8][9][10].

### 2.2 Perché il CONO arriccia più stretto verso l'angolo che verso il dorso
È il cuore della questione. In un cono, il **raggio di curvatura locale cresce con la distanza dall'apice** (vedi la formula R: punti vicini all'apice hanno R piccolo). Poiché l'apice è ancorato sul lato del dorso, **i punti vicino all'apice si arricciano stretti** mentre **l'angolo opposto/lontano si solleva e si "pela"** — è proprio la firma del corner-curl iBooks [9][10]. Il cono è scelto *al posto* del cilindro **perché permette al curl di essere stretto a un'estremità e largo all'altra**, producendo naturalmente il sollevamento d'angolo mantenendo il dorso vincolato [9][11]. Il cilindro, avendo curvatura uniforme, non può farlo da solo.

### 2.3 L'implementazione a cono di W. Dana Nuon (la più citata, con formule verbatim)
Il write-up 2010 di Nuon ("Implementing iBooks page curling using a conical deformation algorithm") fornisce la **pipeline per-vertice completa e verbatim** [3]. Tre parametri: `theta` (semi-angolo cono, 0..π/2), `A` (apice lungo y/dorso), `rho` (rotazione attorno a y/dorso) [3].

Equazioni verbatim (per vertice di input `vi` → output `vo`) [3]:
```
R    = sqrt(vi.x * vi.x + pow(vi.y - A, 2));
r    = R * sin(theta);
beta = asin(vi.x / R) / sin(theta);
v1.x = r * sin(beta);
v1.y = R + A - r * (1 - cos(beta)) * sin(theta);
v1.z = r * (1 - cos(beta)) * cos(theta);
vo.x = (v1.x * cos(rho) - v1.z * sin(rho));
vo.y = v1.y;
vo.z = (v1.x * sin(rho) + v1.z * cos(rho));
```
Note: `R` = raggio circoscritto attorno all'apice; `r = R·sin(theta)` = raggio della sezione del cono; `beta` = angolo d'arco sulla sezione [3]. `theta→0` con `A` grande **elonga il cono verso un curl quasi cilindrico** — è così che il modello a cono approssima il cilindro variando i parametri, non cambiando algoritmo [3]. La pagina è due mesh coplanari indipendenti a spessore zero. Corner-vs-edge **non è special-cased**: emerge dai valori di `A` (apice) e `rho` (rotazione) [3].

La stessa pipeline è confermata nel codice TypeScript di prideout.net (`pageDeformer.ts`), che la lega esplicitamente al modello Hong et al. [6]. **Attenzione (vedi §Rettifiche):** prideout NON usa il parametro `rho` di Nuon; la sua rotazione finale è una rotazione rigida attorno al dorso guidata da `radians = PI*max(0,(t-0.125)/0.875)`. Sono due rotazioni diverse, da non confondere.

### 2.4 Il modello a CILINDRO (Chris Luke / Andrew Hung / XBPageCurl)
Il cilindro è la scelta pratica quando serve **tracciare il dito analiticamente**. Chris Luke deriva entrambi i modelli e **sceglie il cilindro** proprio perché ammette un inverso analitico (touch → parametri del curl) [4].

**Parametri cilindro:** raggio `C`, angolo `theta` nel piano (x,y), base `{B, A}` [4]. Il punto chiave interattivo è l'**inverso** (formula verbatim) [4]:
```
Sistema di vincoli:  B + h + c = 1 ;  h^2 = Delta^2 + y^2 ;  B = x + Delta
Soluzione:  Delta = (y^2 - x^2 + (2 - 2c)x - c^2 + 2c - 1) / (2x + 2c - 2)
            B = x + Delta
```
Dato il punto toccato (x, y) e il raggio `c`, si risolve per l'offset `Delta` e quindi la base `B`, così il curl segue il dito [4]. **Questo inverso è il pezzo che il paper a cono omette**, ed è il nugget più portabile in DOM (vedi §5) [4].

**Geometria del wrap cilindrico (Andrew Hung, fragment shader, verbatim)** — la trig più pulita [11]:
```
d  = distanza con segno del punto dalla fold line, misurata lungo dir
θ  = arcsin(d / r)
d1 = θ * r          // arc length FRONTE del cilindro
d2 = (π − θ) * r    // arc length RETRO del cilindro
p1 = linePoint + dir * d1   // UV del fronte (pagina stampata)
p2 = linePoint + dir * d2   // UV del retro (sotto del curl)
dir    = normalize(clickPos - dragPos)   // fold line ⟂ a dir
origin = clamp(dragPos - dir * dragPos.x / dir.x, 0., 1.)  // aggancia al dorso
```
Il fatto che lo **stesso punto** mappi a due UV (fronte `d1` e retro `d2`) è "tutta l'illusione" [11]. È il caso degenere del cono PARC con apice all'infinito [11]. **Nota (vedi §Rettifiche):** la fonte presenta una tensione interna tra `θ = arcsin(d/r)` e `d1 = θ·r` (quest'ultima implicherebbe `θ = d/r`); da chiarire prima di copiare la relazione arco↔angolo.

**XBPageCurl (GLSL, verbatim)** — versione 3D con tre regioni [5]:
```
n     = vec2(direction.y, -direction.x);          // normale ⟂ all'asse
d     = dot(vertex.xy - cylinderPosition, n);      // distanza con segno
theta = dr = d / radius;                            // arc-length → angolo
vProj = vec3(sin(dr)*n, 1 - cos(dr)) * radius;      // punto sul cilindro
br1   = clamp(sign(d), 0, 1);                       // d<0 → piatto fronte
br2   = clamp(sign(d - π*radius), 0, 1);            // d>πr → piatto retro a z=2r
```
Tre regioni: `d<0` resta piatto (fronte); `0<d<πr` avvolto sul cilindro; `d>πr` piatto a z=2r mostrando il retro [5]. Drag→cilindro: `r = 16 + l/8`, `angle = atan2(-vn.x, vn.y)`, `d` piecewise non-lineare. Corner-vs-edge **non** è un algoritmo diverso: `touchBeganAtPoint` interseca la linea di drag con i bordi e prende l'intersezione più vicina come riferimento [5].

### 2.5 Tabella sintesi modelli

| Modello | Superficie | Parametri chiave | Corner-curl? | Formule verbatim |
|---|---|---|---|---|
| Cono (PARC/Hong) | sviluppabile, curvatura variabile | `θ(t)` 90°→min, apice `V_y(t)` | Sì, nativo (apice ancorato) [9][10] | Solo `R = sqrt(...)`; T non espanso [8][9] |
| Cono (Nuon/prideout) | come sopra | `theta`, `A`, `rho` | Emergente da `A`,`rho` [3][6] | **Sì, pipeline completa** [3][6] |
| Cilindro (Luke) | curvatura uniforme | `C`, `theta`, base `{B,A}` | Stesso modello, sposta asse [4] | **Sì, + inverso touch→curl** [4] |
| Cilindro (Hung) | uniforme, per-fragment | `r`, fold line ⟂ drag | Stesso modello [11] | **Sì, trig arcsin** [11] |
| Cilindro (XBPageCurl) | uniforme, per-vertex GPU | `cylinderPosition/direction/radius` | Stesso modello [5] | **Sì, GLSL completo** [5] |

---

## 3. Il modello fold/riflessione (bisettrice perpendicolare) e come approssima il curl cilindrico

Il modello che già usiamo (StPageFlip: la fold è una **riflessione attraverso la bisettrice perpendicolare** del segmento *angolo afferrato → target*) **non compare verbatim** in nessuna fonte come tale. Le fonti più vicine sono i **flat-fold rigidi**, che modellano una piega netta (crease) anziché un curl curvo:

- **Leaves (brow/leaves):** **flat-fold 2D puro** via CALayer, App-Store-safe, **senza cono, senza cilindro, senza raggio** [12]. La pagina che gira è **due rettangoli piatti** (fronte + retro speculare) che si incontrano su un'unica fold line verticale; il retro è il fronte specchiato con `CATransform3DMakeScale(-1, 1, 1)`; `m34 = 0` → **nessuna prospettiva, nessuna rotazione 3D** [12]. Tutto dipende da un solo scalare `leafEdge ∈ [0,1] = touchPoint.x / width` [12]. **Conseguenza diretta per noi:** poiché la geometria dipende solo da `leafEdge` (touch X), mai dalla Y, **corner / mid-edge / spine curl sono identici** — Leaves *non* modella alcun cono d'angolo localizzato [12]. È esattamente il limite che distingue un flat-fold da un vero curl 3D iBooks (ed è il nostro attuale "su/giù bloccato").

- **MPFoldTransition (Pospesel):** **flat-fold rigido a cerniera** attorno a una fold line dritta, senza raggio/cono/deformazione [14]. Rotazione a due stadi attorno all'asse Y: front 0°→−90°, poi back +90°→0°, ancorati su bordi opposti [14]. La profondità è **solo** prospettiva: `sublayerTransform.m34 = -1/z`, consigliato `m34 = -1/(4..5 × page_width)` [14]. La larghezza apparente segue `width = cos(theta) × max_width`; le ombre seguono cammini coseno/seno [14]. **Corner-curl NON trattati** — solo flip di dorso mid-edge [14].

**Relazione fold ↔ curl cilindrico.** Il flat-fold è il **limite a raggio → 0** del wrap. Nella trig cilindrica di Hung, il "soft" è governato da `θ = arcsin(d/r)` e dalle due lunghezze d'arco `d1 = θ·r` / `d2 = (π−θ)·r` [11]; portando `r → 0` la regione arrotolata collassa e resta una piega netta lungo la fold line — cioè il modello a due rettangoli di Leaves [11][12]. Quindi: **la bisettrice/fold line dà la cresta corretta; il raggio `r` è il parametro che aggiunge la morbidezza**. La fold line di Hung è definita ⟂ al vettore di drag (`dir = normalize(clickPos - dragPos)`) [11], **concettualmente la stessa costruzione** della nostra bisettrice perpendicolare. _(Questa equivalenza "fold = curl con r→0" è una sintesi derivata da [11] e [12], non una frase verbatim di una singola fonte.)_

---

## 4. Librerie Objective-C / iOS rilevanti e modello usato

| Libreria | Tech | Modello | GPU? | Note |
|---|---|---|---|---|
| **Leaves** (brow/leaves) | Core Animation | **Flat-fold 2D** (due rettangoli, retro = scaleX(-1), m34=0) | **No** [12] | Uniforme su tutto il bordo; nessun corner-curl; App-Store-safe [12] |
| **MPFoldTransition** (Pospesel) | Core Animation (CALayer/CATransform3D) | **Flat-fold rigido a cerniera** (hinge 2 stadi) | No [14] | Prospettiva via `m34=-1/z`; ombre coseno/seno; solo dorso, no corner [14] |
| **PaperStack** (lomanf) | Obj-C + OpenGL ES | **Cono** (credita l'algoritmo conico di W. Dana Nuon) | **Sì, OpenGL ES** [13] | README senza formule; cono → corner si solleva, dorso pinnato [13] |
| **XBPageCurl** (xissburg) | OpenGL ES 2.0 vertex shader | **Cilindro** (mesh proiettata su cilindro) | **Sì** [5] | GLSL verbatim; corner = stesso modello, sposta asse [5] |
| **CIPageCurlTransition / CAFilter** | Core Image / QuartzCore privato | Black-box (inferito cilindro) | GPU in pratica | Nessuna formula esposta [0][1][2] |
| **prideout.net/pageturn** | TypeScript + Filament (WebGL) | **Cono** (Hong et al.) | Renderer GPU (curl su CPU JS) [6] | `pageDeformer.ts`: pipeline a cono, Apache-2.0 [6] |

**Pattern chiave:** i flat-fold (Leaves, MPFoldTransition) **non hanno GPU e non hanno corner-curl**; i veri curl curvi (PaperStack/cono, XBPageCurl/cilindro) **richiedono GPU/OpenGL** e mesh per-vertice [5][12][13][14].

---

## 5. Raccomandazioni concrete per il componente DOM/CSS (no WebGL)

### 5.1 Cosa NON è fattibile in DOM senza WebGL — da mettere in chiaro
Tutte le fonti che descrivono un curl *curvo* fedele (cono o cilindro) sono **per-vertice su mesh** o **per-fragment su texture**, e quindi **richiedono WebGL/canvas**, non DOM puro [3][4][5][6][8][9][10][11]:
- Il cono PARC/Nuon è deformazione 3D per-vertice su mesh tassellata → WebGL/canvas [3][8][9][10].
- Il cilindro XBPageCurl è lavoro per-vertice GPU; "il DOM non ha vertex shader nativo" [5].
- Il fragment shader di Hung opera su UV di una texture: in DOM dovreste prima **rasterizzare la pagina a texture** (html2canvas/WebGL) [11].
- `CIPageCurlTransition`/`CAFilter` sono filtri Apple GPU non portabili: riusabile **solo il modello dei parametri**, non la matematica [0][1][2][15].

**Conclusione onesta:** un page-curl *curvo fedele* in **DOM/CSS puro non è raggiungibile** — sarà sempre un'approssimazione [10][12].

### 5.2 Cosa È portabile e quale approssimazione adottare

**(A) La cresta via bisettrice/fold line — riusabile direttamente.**
La costruzione "fold line ⟂ alla direzione di drag" è il nugget DOM-portabile: `dir = normalize(clickPos - dragPos)`, fold line perpendicolare a `dir`, con un `origin = clamp(...)` che **aggancia la pagina al dorso** [11]. Coincide con la nostra bisettrice perpendicolare. Puro 2D, nessun GPU.

**(B) L'inverso touch→curl di Chris Luke — il nugget più prezioso.**
`Delta = (y^2 - x^2 + (2-2c)x - c^2 + 2c - 1) / (2x + 2c - 2)` e `B = x + Delta` convertono la posizione dell'angolo trascinato in **un singolo parametro di curl** [4]. Usatela per derivare angolo/posizione della fold line dal dito, poi approssimate il visivo con transform CSS + ombra [4].

**(C) Bordo arrotondato/cilindrico "soft" via clip-path + gradiente — l'approssimazione consigliata.**
Portate `r` e la curvatura `arcsin` come parametri load-bearing [11]: definite la fold line ⟂ al drag, calcolate la distanza con segno `d`, e mappate `d → d1 = arcsin(d/r)·r` (fronte) e `d2 = (π−arcsin(d/r))·r` (retro) per posizionare la regione che si arriccia e il suo sottobordo ombreggiato [11]. In CSS si **approssima** con:
- **clip-path** per ritagliare front/back lungo la fold line [4][11];
- alcuni **pannelli ruotati segmentati** (o un 3D transform) per simulare il cilindro invece del campionamento per-pixel [5][11];
- **gradiente lineare/radiale** per fronte/retro e specular, tracciando l'asse del curl (angle) e la tightness (radius) — l'idea trasferibile dalla `shadingImage` Apple [1][15] e dalle strisce d'ombra di Leaves [12].

**(D) Il pattern Leaves — la base flat-fold più cheap e fedele in DOM (ma senza corner).**
Mappa quasi 1:1 in CSS, nessun WebGL: front clippato a `width = leafEdge·W`; back a `left = (2·leafEdge − 1)·W`, `width = (1 − leafEdge)·W`, contenuto specchiato `transform: scaleX(-1)`; due strisce d'ombra da 40px con `opacity = min(1, 4·(1−leafEdge))` e `min(1, 4·leafEdge)` [12]. Poiché `m34 = 0`, **non serve `perspective`/`rotateY`** [12]. **Limite ereditato:** piega verticale uniforme, **nessun vero corner-cone** [12].

**(E) Se volete il corner-lift senza WebGL — variante a cerniera con prospettiva (MPFoldTransition).**
Dividete la pagina, `perspective` sul container (l'analogo CSS di `m34=-1/z`, `perspective_px ≈ 4..5 × page_width`), `transform-origin` sul dorso, animate `rotateY()` 0°→−90° poi +90°→0° con `backface-visibility`, ombre via opacità coseno/seno [14]. **Ma resta una piega netta**, non un curl morbido [14].

**(F) Driver "fedele al cono" se un giorno aggiungete canvas/WebGL.**
Portate la pipeline Nuon/prideout in un vertex shader, poi compositate il canvas sul DOM [3][6]. Il **vincolo del dorso** si ottiene ancorando il lato del cono al binding [8][9][10]; il **corner-lift** scegliendo dove l'utente afferra = posizione dell'apice [9][10].

### 5.3 Ricette in ordine di fedeltà crescente (riepilogo decisionale)
1. **Flat-fold uniforme (Leaves):** DOM/CSS puro, zero prospettiva, cheap; nessun corner-curl [12].
2. **Cerniera con prospettiva (MPFoldTransition):** CSS 3D `rotateY` + `perspective`; corner-lift assente, piega netta [14].
3. **Cresta via bisettrice + inverso di Luke + clip-path/gradiente:** approssima il curl cilindrico morbido in 2D, parametri `angle`/`radius`/`progress` esposti come API [4][11][15]; vincolo dorso via `origin=clamp(...)` [11]. ← **punto dolce per noi**.
4. **Vero curl curvo (cono Nuon o cilindro XBPageCurl):** solo con canvas/WebGL [3][5][6].

---

## Fonti / Citazioni

- **[0]** UIPageViewController.TransitionStyle.pageCurl (Apple) — https://developer.apple.com/documentation/uikit/uipageviewcontroller/transitionstyle/pagecurl
- **[1]** CIPageCurlTransition — Core Image Filter Reference (Apple) — https://developer.apple.com/library/archive/documentation/GraphicsImaging/Reference/CoreImageFilterReference/index.html
- **[2]** The Apple Wiki — Dev:CAFilter (Core Animation private filter types) — https://theapplewiki.com/wiki/Dev:CAFilter
- **[3]** Implementing iBooks page curling using a conical deformation algorithm — W. Dana Nuon — http://wdnuon.blogspot.com/2010/05/implementing-ibooks-page-curling-using.html
- **[4]** The anatomy of a page curl — Chris Luke (flirble.org) — https://blog.flirble.org/2010/10/08/the-anatomy-of-a-page-curl/
- **[5]** XBPageCurl — page curl transition for iOS (xissburg) — https://github.com/xissburg/XBPageCurl
- **[6]** Page Turning Animation — Philip Rideout (prideout.net) — https://prideout.net/pageturn/
- **[7]** Computer graphics techniques for modeling page turning — Hong, Card & Chen — https://www.researchgate.net/publication/33050985_Computer_graphics_techniques_for_modeling_page_turning
- **[8]** US Patent US20060133664A1 — Turning pages in a 3D electronic document (Xerox PARC) — https://patents.google.com/patent/US20060133664?oq=2006/0133664
- **[9]** Turning Pages of 3D Electronic Books — Hong, Card, Chen (IEEE 3DUI/VR 2006) — https://ieeexplore.ieee.org/document/1647522/
- **[10]** Deforming Pages of 3D Electronic Books — Hong, Card & Chen (PARC patent provenance) — https://www.researchgate.net/publication/33050985_Computer_graphics_techniques_for_modeling_page_turning
- **[11]** Page Curl Shader Breakdown — Andrew Hung — https://andrewhungblog.wordpress.com/2018/04/29/page-curl-shader-breakdown/
- **[12]** brow/leaves — Tom Brow's iOS page-turn library (flat 2D CALayer) — https://github.com/brow/leaves
- **[13]** lomanf/PaperStack — iOS Page Curl (App Store safe, cono) — https://github.com/lomanf/PaperStack
- **[14]** Anatomy of a page-flip animation — Mark Pospesel (MPFoldTransition) — https://mpospese.com/2012/05/23/anatomy-of-a-page-flip-animation/
- **[15]** CIPageCurlTransition — Core Image Filter Reference (cifilter.app) — https://cifilter.app/CIPageCurlTransition/

---

## Raccomandazioni operative (sintesi)

1. **Cresta in DOM** = costruzione fold-line ⟂ alla direzione di drag (`dir = normalize(click - drag)`) con `origin=clamp(...)` che aggancia al dorso: stessa geometria della nostra bisettrice perpendicolare, puro 2D senza GPU [11].
2. **Trasportare l'inverso touch→curl di Chris Luke** (`Delta = (y² - x² + (2-2c)x - c² + 2c - 1)/(2x + 2c - 2)`; `B = x + Delta`) per convertire la posizione dell'angolo trascinato in un singolo parametro di curl [4].
3. **"Soft" senza WebGL**: esporre `r` (raggio) + curvatura `arcsin` come parametri, approssimare il cilindro con clip-path lungo la fold line + pannelli ruotati segmentati + gradiente per fronte/retro/specular [11][1][15].
4. **Base flat-fold Leaves** (cheap, DOM puro) come fallback — ma accettando il limite: piega verticale uniforme, nessun corner-cone [12].
5. **Corner-lift senza WebGL** → cerniera con prospettiva (MPFoldTransition): resta piega netta [14].
6. **Mettere in chiaro nel design doc** che un curl curvo FEDELE (cono/cilindro) richiede WebGL/canvas e NON è raggiungibile in DOM/CSS puro [3][5][6][10][11][12].
7. **Evoluzione futura WebGL** → cono canonico iBooks (corner più stretto del dorso perché il raggio cresce con la distanza dall'apice ancorato al binding): pipeline Nuon/prideout con `θ(t)` 90°→min e apice `A(t)` animati [3][6][9][10].
8. **Non assumere i default numerici legacy** di CIPageCurlTransition: provengono da attribute dictionary archiviate non recuperabili [0][1][15].

---

## Rettifiche dalla revisione scettica (verdetto complessivo: solido)

Un agente revisore ha verificato il brief contro le fonti. Verdetto: **solido**, con queste precisazioni da tenere presenti:

- **Valori d'esempio CIPageCurlTransition**: NON usare numeri specifici (es. radius 400) come default o esempi — la fonte cifilter.app non li conteneva nell'estratto. Trattare l'API come black-box senza default pubblicati [0][1][15].
- **`rho` (Nuon) ≠ rotazione dorso (prideout)**: in §2.3 sono due rotazioni diverse. Nuon [3] ruota di `rho` attorno all'asse y/dorso; prideout [6] applica una rotazione rigida del dorso `radians = PI*max(0,(t-0.125)/0.875)`. Non vanno fuse in "rotazione rho" comune.
- **Numero di brevetto incoerente tra fonti**: US7667703 in [8] vs US 7,898,541 B2 in [7]/[10], per la stessa domanda US 2006/0133664 A1. Da verificare alla fonte primaria.
- **Tensione trig in Andrew Hung [11]**: la fonte dà sia `θ = arcsin(d/r)` sia `d1 = θ·r` (quest'ultima implicherebbe `θ = d/r`). Chiarire la relazione arco↔angolo prima di implementare §5.2(C).
- **Provenienza paper vs brevetto**: il paper ACM AVI 2004 "3Book" era paywall/403, quindi il modello a cono è ricostruito dal **brevetto** equivalente, non dal paper verbatim. La catena di provenienza è leggermente più debole di quanto suggerisca l'etichetta "modello canonico".
