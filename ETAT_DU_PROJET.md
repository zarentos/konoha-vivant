# KONOHA VIVANT — état du projet

**Repo :** github.com/zarentos/konoha-vivant
**Archive des rips bruts :** github.com/zarentos/naruto-test (référence, on n'y touche pas)

---

## 🎯 Le projet

Ce n'est **pas** un jeu de combat. C'est un **monde autonome** qu'on regarde vivre.
15 ninjas se baladent, se parlent, se cherchent, se battent, tombent K.O., se font
soigner, se vengent. L'utilisateur n'a rien à faire — mais il peut prendre le contrôle
de n'importe qui d'un clic.

HTML5 / JS, packagé en Electron. Tout gratuit.

**Trois cerveaux :** le *réflexe* (JS, 60 fps : esquive, punit, se place) · la *mémoire*
(chacun se souvient de ce qui lui est arrivé) · la *tête* (un LLM, toutes les 8 s : pourquoi
j'y vais, ce que je dis). La tête est **optionnelle** : sans elle, le monde tourne pareil.

**Reste à faire :** hand-tracking caméra (MediaPipe), puis build `.exe` / `.dmg`.

---

## ✅ PHASE 1 — TERMINÉE : sprites + animations + effets

Les 15 personnages sont finis : **492 animations · 2533 frames · 0 problème.**

Naruto · Sasuke · Itachi · Sakura · Kakashi · Jiraiya · Orochimaru · Pain · Deidara ·
Konan · Saï · Shikamaru · Suigetsu · Karin · Jūgo

Taxonomie complète partout : `idle`, `run`, `dash`, `jump`, `guard`, `attack`,
`attack_air`, `strong` (+ variantes), `win`, `hurt_*`, `knockdown`, `downed`, `getup`,
mode crapaud, **+ les techniques signature avec leurs effets**.
(Seuls Itachi et Konan n'ont pas de `win` — la pose de victoire est simplement sautée.)

---

## ✅ PHASE 2 & 3 — TERMINÉES : le monde autonome + les trois cerveaux

`src/world.html` + `src/world.js` — c'est **l'écran principal** maintenant.
Electron ouvre directement dessus. L'atelier d'animations (`index.html`) reste dispo.

### Ce qui tourne
- **Monde de 2800 px**, caméra qui suit l'action, zoom molette, glisser pour panoramiquer,
  **vue large** (touche `F`) pour tout voir d'un coup.
- **Combat complet** : PV, chakra, hitboxes calées sur les frames actives, projectiles avec
  collision, garde, recul, étourdissement, K.O., relève, pose de victoire.
- **Vie sociale** : conversations à 2 ou 3 avec bulles, relations orientées (Sakura adore
  Sasuke, Sasuke non ; Deidara déteste Itachi, l'inverse est tiède…), rancunes qui montent
  quand on prend des coups.
- **Duels** : 1v1 par défaut. Un allié loyal proche peut **venir prêter main-forte** → 2v1, 2v2.
  Les autres s'approchent et **regardent**.
- **K.O. réaliste** : 14 à 25 s au sol, puis on se relève à 45 % de PV et on fuit.
- **Soigneurs** : Sakura va chercher un blessé/K.O. avec qui elle est en bons termes et le
  remet debout (`shosen`).
- **Vengeance** : quand quelqu'un tombe, ses proches accumulent de la rancune et vont
  chercher le responsable — mais 10 à 35 s plus tard, pas tête baissée.
- **Alertes + zoom** : une scène notable annonce « X et Y vont s'affronter » → *Regarder*
  (le monde ralentit, la caméra zoome dessus) ou *Ignorer* (**ça se passe quand même**,
  on rate juste la scène — sinon le monde n'est plus autonome).
- **Possession** : clic sur un ninja → clavier. `←→` bouger · `Espace` saut · `Maj` dash ·
  `J` coup (ré-appuyer = enchaîner) · `K` garde · `1`–`0` = ses techniques · `Échap` lâcher.
  Si tu frappes un passant, il riposte.
- **Curseur Tension** : règle l'agressivité du monde en direct. 1.0 = une bagarre toutes
  les ~30 s. Mets 0.4 pour un village calme, 2 pour un bain de sang.

### Les nouveaux fichiers de données
- `src/data/moves.js` — **le méta-combat**. Les `data/<perso>.js` disent à quoi ressemble
  une technique ; celui-ci dit ce qu'elle **fait** : type (`melee`/`dash`/`proj`/`buff`),
  portée, dégâts, recharge, coût en chakra, allonge, recul, poids dans le choix de l'IA.
  127 techniques décrites. **C'est ici qu'on règle l'équilibrage.**
- `src/data/social.js` — **la couche sociale**. Camps, caractères (sociable / loyal / calme),
  matrice de relations canon **orientée**, paires à étincelles (Naruto↔Sasuke…), répliques.
  **C'est ici qu'on règle les personnalités.**

### Le monde physique
- **Une seule échelle** (`SCALE = 1.70`) pour les 15. Avant, `scaleTo: 115` forçait tout le
  monde à la même taille : Naruto faisait 115 px, Pain aussi. Maintenant les planches (toutes
  du même jeu) donnent les vraies proportions : Pain 145 px, Naruto 110 px.
- **Profondeur** (`z` de 0 à 1, bande de sol de 118 px). Ils se croisent, se contournent, et
  on ne peut pas se toucher si on n'est pas sur le même plan (`Z_HIT = 0.24`). Le tri de
  dessin se fait par `z`, avec une légère perspective (0,93× au fond → 1,06× devant).
- **Décor collé au sol** : chaque image a une valeur `sol` (où se trouve son sol, en fraction
  de sa hauteur) dans `DECORS`. L'image est dessinée dans les coordonnées du **monde**, tuilée
  en miroir alterné. **Plus de barre grise.**
  ⚠️ Ces valeurs sont **réglables en direct** (curseur « Sol » dans la barre) et **retenues
  par décor** (localStorage). On ne devine plus : on tire le curseur jusqu'à ce que les pieds
  touchent, c'est enregistré.
- **Bug corrigé (contournement)** : la collision décalait `z`, mais la physique recollait le
  ninja sur `goalZ` à la frame suivante → le décalage était annulé et ils restaient bloqués.
  Il faut déplacer **`goalZ`**, pas `z`. Et celui qui n'est pas en train de se battre s'écarte.

### Scène (façon Tomodachi Life)
Quand on accepte une alerte : `openScene(acteurs, duel)`. Pendant la scène, **seuls les
participants bougent et sont dessinés** — tout le reste du monde est en pause et invisible.
La caméra se verrouille dessus. Ça se ferme tout seul à la fin du duel / du soin.

### L'intensité des combats
`niveauDe(a,b)` → **amical** / **sérieux** / **mortel**, selon la relation et la rancune.
- **amical** : pas de technique au-dessus de 16 dégâts, pas de projection, coût en chakra
  plafonné à 22. Dégâts ×0,65. **Le combat s'arrête à 32 % de PV : l'un s'avoue vaincu.**
  Aucun K.O.
- **sérieux** : normal.
- **mortel** : dégâts ×1,15, tout est permis.

Repère : 24 bagarres → seulement **17 K.O.** (avant : 36). Les entraînements ne tuent plus.

### Les relations ne sont plus verrouillées
Sélecteur **Relations** : *Tièdes* (défaut — le canon divisé par 2,5 + du hasard : tout peut
évoluer) · *Canon* · *Neutres* (tout le monde part de zéro). Et elles **bougent vraiment** :
discuter +3,2 · être soigné +22 · être secouru +18 · perdre un vrai combat −14.

### L'IA de combat (gratuite, zéro dépendance, tourne sur un PC pourri)
Ce n'est plus un tirage au hasard pondéré. Chaque ninja **lit son adversaire** à chaque
décision (`readTarget`) et note chaque option (`scoreMove`) :
- **Punition** : l'adversaire est en fin d'animation → on frappe le plus fort possible.
- **Anti-air** : il saute → on privilégie les coups qui envoient en l'air.
- **Esquive** : il charge un gros jutsu → on saute ou on recule, on ne fonce PAS dedans.
- **Lecture de la garde** : il bloque → les étourdissements passent, les coups normaux non.
- **Économie de chakra** : on garde de quoi finir le combat.
- **Adaptation** : une technique qui rate 3 fois voit son poids s'effondrer.
- **Pas de répétition** : la technique qu'on vient d'utiliser voit son poids ×0,14.
  Mesuré : **1 %** de techniques enchaînées à l'identique.
- **Style** (`normal` / `rage` / `prudent` / `distance` / `achever`) : la tête peut le changer.

Repères : **56 %** des techniques lancées touchent · 92 % des projectiles.

### La mémoire (gratuite)
Chaque ninja garde un journal de 8 événements (`g.mem`) : *« Itachi m'a mis K.O. »*,
*« Sakura m'a soigné »*, *« j'ai vu Jūgo tomber »*. C'est **ça** qui nourrit le prompt du LLM.
Sans mémoire, un LLM écrit du blabla d'anime générique.

### Le moteur d'IA est EMBARQUÉ — rien à installer
`node-llama-cpp` (llama.cpp compilé dans l'appli). Le `.exe` / `.dmg` se suffit à lui-même :
**pas d'Ollama, pas de Node, pas de compte, pas de clé, pas de ligne de commande.**

- **Validé :** `getLlama({ build: "never", gpu: "auto" })` démarre en ~1 s sans rien compiler,
  détecte le GPU et se rabat proprement sur le CPU. C'est le scénario exact du `.exe`.
- **Le modèle est choisi selon la machine** (`choisirNiveau()` dans main.js) :

  | RAM de la machine | Modèle | Poids |
  |---|---|---|
  | 16 Go et + | Qwen3 8B | 5,1 Go |
  | 8 à 16 Go | **Qwen3 4B** | 2,6 Go |
  | moins de 8 Go | Qwen3 1.7B | 1,2 Go |

- **Il est téléchargé UNE FOIS au premier lancement**, par le jeu, avec une barre de
  progression (`resolveModelFile` + `onProgress`). Ensuite : **hors ligne, illimité, à vie.**
  Il n'y a aucun moyen d'y couper : un vrai modèle, ce sont des gigaoctets de poids qui
  doivent atterrir sur la machine. La seule question est *qui* les télécharge — l'installeur
  (3 Go, au-dessus de la limite GitHub de 2 Go) ou le jeu. C'est le jeu.
- **CUDA est exclu du build** (+350 Mo pour NVIDIA seulement). Vulkan (75 Mo) couvre NVIDIA
  *et* AMD, et la tête ne réfléchit que toutes les 8 à 20 s : la vitesse n'est pas le sujet.
- **Installeur estimé : ~165 Mo.**

### Repli automatique, dans cet ordre
1. **Moteur embarqué** (rien à installer)
2. **Ollama**, s'il est déjà présent sur la machine
3. **Groq / Gemini**, si une clé est posée dans `konoha.config.json`
4. **rien** → cerveau scripté, le monde tourne exactement pareil

Chaque étage attrape ses erreurs. Le jeu ne peut pas planter à cause de l'IA.

### Lancer
- **Développement :** double-clic sur **`LANCER.bat`** / **`LANCER.command`**.
- **Distribution :** push sur GitHub → onglet Actions → l'installeur `.exe` / `.dmg`.
  Tu l'envoies à qui tu veux : ils double-cliquent, et tout est là.

### LA RÉSERVE — pourquoi ils ne se répétaient plus qu'à moitié
Le LLM ne travaille **pas** quand on a besoin de lui. Il travaille **avant**, en fond, et
remplit des piles de répliques (`RESERVE[perso][situation]`, 18 max). Le jeu y pioche **en
0 ms**. Résultat mesuré : **1 548 répliques fabriquées en 12 minutes**, 871 encore en stock.

5 situations : `seul` · `detendu` · `tendu` · `blesse` · `content`.

**Ils parlent tout le temps** — même seuls, toutes les 6 à 17 s (uniquement s'ils sont à
l'écran : inutile de gaspiller la réserve pour quelqu'un qu'on ne voit pas).

Filet de sécurité si le LLM est absent : **329 répliques écrites à la main** dans `social.js`
(contre 105 avant), classées par situation.

**Bug corrigé :** pendant que le LLM écrivait un dialogue, ils restaient **muets 9 secondes**
puis retombaient sur les 5 répliques en dur. C'était ça, la boucle. Maintenant ils piochent
dans la réserve en attendant, et le dialogue écrit prend le relais quand il arrive.

### LES SCÈNES — 7 types, façon Tomodachi
`RITES` dans world.js. Chacune se déclenche sur un seuil de relation, lève une alerte
(→ zoom, le reste du monde disparaît) et a de **vraies conséquences** :

| Scène | Déclencheur | Conséquence |
|---|---|---|
| 💗 **déclaration d'amour** | rel > 72, une seule fois par cible | Accepté (+25/+30) ou **repoussé** (−18, il encaisse) |
| ☠ **déclaration de guerre** | rel < −72 | Un combat **mortel** démarre |
| 🥊 **défi** | paire à étincelles, en forme | Un combat **amical** démarre |
| 😈 **mauvais coup** | impulsif, relation tiède | La victime prend une rancune (+18). C'est drôle. |
| 💢 **engueulade** | rel entre −18 et −62 | −12 des deux côtés, 35 % de chance que ça dégénère |
| 🤝 **réconciliation** | rancune > 22 mais rel remontée | Rancune **remise à zéro**, +26/+22 |
| ✨ **admiration** | rel > 55 | +9, et l'autre est mal à l'aise |

**UNE SCÈNE NE MENT JAMAIS.** Trois garde-fous, chacun venant d'un vrai bug :

1. **Le dialogue est garanti.** `prepareTalk` refusait une scène si le moteur était occupé →
   repli sur la réserve → *« Naruto prépare un mauvais coup »* et il parlait de nouilles.
   Maintenant une scène passe **devant tout** (`libreScene()`), et un **script écrit à la main**
   est posé d'emblée (`SCRIPTS`, 2-3 variantes par type). Le LLM le remplace s'il arrive à temps.
2. **L'acte se voit.** `acteRite()` : la bêtise se termine par un **vrai coup** (impact, recul,
   éclair, son) puis un rire · la déclaration acceptée fait **rayonner les deux** · refusée,
   l'autre **tourne les talons** et lui encaisse · l'engueulade se finit en **bousculade** ·
   la réconciliation par un **salut** · l'admiration, il lui **colle aux basques**.
   Pour `guerre` et `défi`, le combat qui suit **est** l'acte.
3. **Elle est intouchable.** On pouvait arracher quelqu'un à une scène en cours (Sakura part
   soigner, un spectateur est recruté, un allié appelé en renfort) → la scène mourait sans son
   acte. `enScene()` la protège de tout. Et si le joueur l'attrape quand même à la souris,
   les conséquences s'appliquent tout de même.

Mesuré : **0 scène muette, 0 scène sans acte.**

### ATTRAPER UN NINJA À LA SOURIS
Clic-glisser : il est **dans la main**, il gigote, il râle. On le soulève, on le déplace.
On le lâche : il tombe, ça claque, et **de haut, il se vautre**.
**Si on le pose sur quelqu'un** : ils se parlent (s'ils s'entendent) ou **se battent** (sinon).
Simple clic sans bouger = sa fiche.

### La tête — `src/mind.js` (optionnelle)
Deux types de requêtes, et c'est tout :

1. **UNE CONVERSATION = UNE REQUÊTE.** Quand des ninjas se mettent à parler, le LLM écrit
   **toute la discussion d'un coup** (5-7 répliques). Le jeu la rejoue ligne par ligne, une
   toutes les ~2 s, **chacun son tour**. Pendant que ça charge, ils marchent l'un vers l'autre —
   on ne voit même pas le délai. Repli sur les répliques écrites si ça met plus de 3,5 s.
2. **Les intentions**, rarement, pour les 3 ninjas qui vivent quelque chose.

**Budget** (`libre()` dans mind.js). Le vrai mur en ligne, c'est le quota **journalier** :

| | Requêtes/min | Autonomie |
|---|---|---|
| Ollama (local) | 25 max — mesuré 7,2 | **illimitée** |
| Groq / Gemini | **3 max** — mesuré 2,4 | **~7 h de jeu par jour** (1000 req/jour) |

Le compteur est affiché en direct dans le voyant « IA » en haut à droite.

Backends, dans l'ordre, avec repli automatique :
1. **Ollama** en local (`main.js` fait l'appel via IPC, pas de CORS) — gratuit, illimité, hors ligne
2. **Groq** (Llama 3.3 70B gratuit) ou **Gemini**, si une clé est dans `konoha.config.json`
3. **rien** → cerveau scripté. Le monde tourne exactement pareil.

⚠️ **L'IA ne marche qu'avec `npm start`** (Electron). En double-clic sur `world.html`, le
navigateur bloque l'appel à `localhost` (CORS) — sauf si `OLLAMA_ORIGINS=*` est réglé.

Garde-fou : un petit modèle local peut délirer. `applyIntent` refuse l'absurde — Konan
n'attaquera pas Pain, et personne ne relance une bagarre 5 s après s'être fait démonter.

### LE SON — `src/audio.js` + `src/data/sons.js`
Deux sources, pour deux raisons :

**1. Les voix** — les 370 clips ripés du jeu NDS (`Character Sounds.zip` du repo `naruto-test`),
convertis en OGG : **10,8 Mo → 2,8 Mo**, 320 clips pour les 15 persos.
Leurs noms d'origine sont des **codes hexa** (`0249_0000.wav`) : impossible de savoir lequel
dit « Rasengan » et lequel est un grognement sans les écouter. Ils sont donc classés **par
durée** dans `data/sons.js` — la structure de ces banques NDS est régulière :

| durée | ce que c'est | joué quand |
|---|---|---|
| < 0,55 s | effort, grognement | combo, coup encaissé |
| < 1,45 s | cri | technique moyenne, soin |
| < 2,45 s | technique nommée | gros jutsu (≥15 dégâts) |
| > 2,45 s | ultime / K.O. / victoire | jutsu ≥22 dégâts, K.O., pose de victoire |

Si un clip tombe dans la mauvaise case, il suffit de le **déplacer dans `sons.js`**.

**2. Les bruitages** — **synthétisés en direct** (Web Audio, zéro fichier) : impact, garde,
souffle du projectile, chute. Comme ça, aucun risque de coller une réplique de victoire sur
un coup de poing.

**Tout est spatialisé** : panoramique selon la position à l'écran, volume au carré selon la
distance à la caméra. Ce qui se passe hors champ ne s'entend pas.

**La musique** : `main.js` **liste lui-même** `assets/music/`. Il suffit d'y déposer les
pistes (extraites de `Soundtrack.rar`) — rien à déclarer nulle part.

### L'interface — palette reprise de `sharingan-cam`
- **Bandeau des ninjas** (sous la scène) : 15 portraits, **clic = il arrive / il s'en va**,
  en direct. Grisé = absent, bordé de rouge = à terre, bordé d'orange = sélectionné.
  Les portraits sont découpés automatiquement des planches (`assets/portraits/`, 18 ko).
- **Fiche perso** : clic sur un ninja → panneau à gauche, mis à jour en direct :
  portrait, camp, caractère · PV et chakra · **ce qu'il fait** (il se bat contre X, il discute
  avec Y, il va secourir Z, il veut se venger de W…) · **ce qu'il pense** (ses 4 liens les plus
  forts, en barres vert/rouge) · **ce dont il se souvient** · **ses techniques** avec leur
  recharge en direct · un bouton **Prendre le contrôle**.
- Le sélecteur **Qualité** a été retiré (le jeu tourne au maximum, on a mesuré que ça passait).
- **Le volume suit le zoom** : vue large ≈ 9 %, normal ≈ 42 %, duel suivi ≈ 90 %,
  scène zoomée ≈ 125 %. On entend ce qu'on regarde.

### L'interface — palette reprise de `sharingan-cam`
`--ink #0e1118` · `--plate #2a3140` · `--orange #e8731c` · `--sharingan #cc1518` ·
`--leaf #3a8a4a` · `--parch #e9ddc2` · police **Russo One**.
Bandeau titre + voyant IA · barre de commandes (pause, vitesse, son, caméra) ·
**panneau Réglages** repliable (décor, relations, tension, ninjas, alertes, qualité, sol) ·
journal en parchemin · bannière d'événement bordée de rouge Sharingan.

### Le décor — mesuré, plus deviné
`DECORS` (dans world.js) contient pour chaque image : `sol` (où se trouve son sol, en
fraction), `ciel` et `bas` (couleurs moyennes du haut et du bas, **mesurées sur l'image**).
- Au-dessus du décor → rempli avec `ciel`. En dessous → rempli avec `bas` (le sol continue).
- **Bug corrigé :** j'étirais les 2 dernières lignes de pixels sur 900 px → grosse bavure
  verticale au bas de l'écran. C'était ça, la « map buggée ».
- La bande de profondeur (96 px) tombe **entre 91,4 % et 99,6 %** de l'image sur Training
  Field — pile sa bande de sable. Vérifié en échantillonnant la couleur sous les pieds.
- Le curseur **Sol** reste là pour ajuster, et la touche **D** dessine la ligne de sol et
  les deux bords de la bande de profondeur.
- Note : les décors du repo `naruto-test` sont des planches sur fond `rgb(0,64,128)` (la même
  couleur-clé que les persos). Les images d'`assets/backgrounds/` sont les scènes **déjà
  correctement détourées** (Training Field = le morceau 505×341 de la planche). Rien à refaire.

### La grammaire JSON — pourquoi les dialogues se répétaient
Qwen3 « réfléchit » (`<think>…</think>`) avant de répondre. Sans contrainte, sa sortie n'était
pas parsable → `script` restait vide → repli sur les 5 répliques écrites en dur dans
`social.js` → **boucle visible.**
Corrigé avec `llama.createGrammarForJsonSchema()` : la génération est contrainte **token par
token**. Le modèle ne *peut plus* sortir autre chose que le JSON attendu.
Plus, contre la lassitude :
- chaque ninja retient **ses 5 dernières répliques** (`g.dits`), qui partent dans le prompt
  avec « ne redis SURTOUT pas ça » ;
- chaque conversation reçoit un **angle imposé** tiré au hasard parmi 16 (une provocation, un
  reproche, une confidence, un silence gênant…) ;
- `repeatPenalty` + `temperature: 1.0` côté moteur.

### Comment le moteur sait quand une technique touche
Il n'y a **rien à annoter à la main** : les frames actives se déduisent des données
existantes. Une frame « frappe » si son `ofx` est dans `fxAttack`. Si la technique n'a pas
de `fx` (l'effet est dessiné dans le sprite), on prend les frames 40 %–78 % de l'anim.
Le projectile part à `launchFrame`, ou à la première frame `fxAttack`.

### Bug corrigé
`data/naruto.js` faisait `window.KV_CHARS = {…}` au lieu de `Object.assign` : il **écrasait**
tous les persos chargés avant lui. Ça marchait par chance parce qu'il était en premier
dans `index.html`. Corrigé.

---

## 🧪 Le harnais de test

`node tools/simtest.js 12` — mocke le DOM, le canvas **et le LLM**, fait tourner
**12 minutes de monde** en quelques secondes, et vérifie :
1. que chaque technique de `moves.js` pointe sur une anim qui existe vraiment ;
2. qu'aucune exception, aucun NaN, aucun PV aberrant n'apparaît ;
3. que le monde **vit** : bagarres, K.O., relevées, discussions, soins, projectiles ;
4. **la couverture** : quelles techniques ne sortent jamais (poids ou coût mal réglés) ;
5. **la précision** de l'IA de combat ;
6. **toute la plomberie de la tête** : prompt → JSON → intention → action réelle, avec un
   faux LLM. Ça valide le circuit sans dépendre d'Ollama ni d'une clé.

À relancer après **chaque** modif de `moves.js` ou `social.js`. C'est ce qui a permis de
trouver un combat qui durait 611 secondes en boucle infinie (un K.O. restait compté comme
debout dans son duel).

Repères actuels : une bagarre toutes les ~30 s, ~35 s par combat, 98 % des techniques
sortent au moins une fois.

---

## 📁 Structure

```
konoha-vivant/
├─ main.js                 Electron + les 3 backends LLM (Ollama / Groq / Gemini)
├─ preload.js              pont vers la page (contourne le CORS)
├─ konoha.config.json      ★ où coller une clé API (facultatif)
├─ package.json            build .exe / .dmg
├─ .github/workflows/      CI qui fabrique les installateurs
├─ tools/simtest.js        harnais de test headless
├─ assets/                 planches détourées + décors
└─ src/
   ├─ world.html/.js/.css  ★ LE MONDE (réflexe + mémoire)
   ├─ mind.js              ★ LA TÊTE (LLM, optionnelle)
   ├─ audio.js             ★ LE SON (voix + bruitages synthétisés)
   ├─ index.html/app.js    atelier d'animations (vérif visuelle)
   ├─ game.html/game.js    ancien bac à sable Naruto seul (legacy, supprimable)
   └─ data/
      ├─ <perso>.js  ×15   frames de chaque animation
      ├─ moves.js          ★ ce que font les techniques
      ├─ social.js         ★ qui aime / déteste qui
      └─ sons.js           ★ les voix, classées par durée
```

**Fichiers morts, supprimables :** `src/data/chars.js` (122 ko, plus chargé par personne),
`assets/J363go.png` (doublon de `Jugo.png`), `src/game.*` si tu veux faire le ménage.

---

## ⚠️ LE CHANTIER ANIMATIONS — chiffré

| | Planche | Frames extraites | Techniques |
|---|---|---|---|
| Moyenne des 15 | 4 900 px | 170 | 10 |
| **Kakashi** | **7 315 px** (la plus grosse) | **136** | **5** |
| **Saï** | **6 846 px** | **131** | **5** |

Leurs planches sont les plus grosses et ce sont eux qui ont le moins de contenu :
**une 2ᵉ version complète du perso dort en bas de leur planche, jamais découpée.**
Kakashi a même des anims `frog_idle` / `frog_move` (mode ermite) — des frames mal étiquetées.

À faire : re-découper Kakashi et Saï en entier, avec la méthode de la phase 1
(analyse au pixel → fiche PNG fond magenta → Raph valide → correction).

## 🚧 PHASE 4 — À FAIRE

1. **Hand-tracking caméra** — MediaPipe (gratuit). Détecter les signes de main pour lancer
   les jutsu du ninja possédé. La permission caméra est déjà autorisée dans `main.js`.
2. **Packaging** — le workflow GitHub Actions existe déjà : push → onglet Actions →
   artifacts `KonohaVivant-windows-latest` (.exe) et `KonohaVivant-macos-latest` (.dmg).
3. **Pistes** : plusieurs zones/décors dans le même monde, cycle jour/nuit, faim/fatigue,
   mémoire des PNJ (le journal en bas à gauche est déjà là).

---

## 🔄 Reprendre dans une nouvelle conversation

Coller ce fichier, plus :

> On bosse sur konoha-vivant (github.com/zarentos/konoha-vivant), un **monde Naruto autonome**
> (pas un jeu de combat : les persos vivent seuls, on regarde).
> Phases 1 et 2 finies : 15 persos animés, et le moteur de monde tourne
> (`src/world.js` + `data/moves.js` + `data/social.js`).
> Il y a un harnais de test : `node tools/simtest.js 12`.
> Clone le repo pour voir l'état réel du code.

**Méthode qui marche :**
- Toucher au **visuel** → Claude analyse la planche au pixel, place les données, génère une
  **fiche PNG** (fond magenta), Raph la renvoie, Claude corrige. Un aller-retour par perso.
- Toucher à la **logique** → Claude modifie, lance `simtest.js`, et lit les chiffres.
  Ne jamais livrer une modif de `moves.js`/`social.js` sans avoir relancé le test.
