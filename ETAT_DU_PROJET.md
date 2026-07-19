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
      ├─ social.js         ★ qui aime / déteste qui (458 répliques à la main)
      └─ sons.js           ★ les voix, classées par durée
```

**Fichiers morts, supprimables :** `src/data/chars.js` (122 ko, plus chargé par personne),
`assets/J363go.png` (doublon de `Jugo.png`), `src/game.*` si tu veux faire le ménage.

---

## ✅ PHASE 5 — TERMINÉE : la vie autonome

### Les besoins — le vrai moteur
Trois jauges qui montent toutes seules (`faim`, `fatigue`, `ennui`) et qu'il faut satisfaire.
C'est ce qui les fait **bouger d'eux-mêmes**, indépendamment des relations.
- **5 lieux** posés sur la carte (`LIEUX`) : 🍜 Ichiraku, 💤 Sous le saule, 🎯 Les poteaux,
  🍡 L'échoppe, 🌳 Le grand arbre. Quand un besoin crie, le ninja **va au bon endroit** :
  il mange, il **s'allonge et dort** (rendu avec l'anim `downed`, +25 % PV au réveil), ou il
  **s'entraîne** (il enchaîne des combos tout seul).
- **L'humeur** = 100 − moyenne des trois besoins. De mauvaise humeur, il **cherche la bagarre** ;
  de bonne humeur, il papote. Affichée dans la fiche (« en pleine forme » → « au bout du rouleau »).

### Le cycle jour / nuit
20 min réelles = 24 h. Une **horloge** en haut à gauche, et la **lumière change** : aube orangée,
plein jour, crépuscule violet, **nuit bleu nuit**. La nuit, ils tombent de sommeil et se battent
beaucoup moins (`nuit()` pèse sur tout). Le prompt du LLM reçoit le moment de la journée.

### La chronique
Bouton **📜 Chronique** : le journal complet et horodaté de leur vie, qu'on fait défiler.
*« 23:14 — Shikamaru s'endort — Sous le saule. »* · *« 09:02 — Sakura a repoussé Naruto. »*
200 événements gardés.

### Ce que la fiche montre en plus
Les **3 jauges de besoins** (🍜 💤 🎯), l'**humeur**, et « ce qu'il fait » devient précis :
*« Il dort — Sous le saule »*, *« Il va vers Ichiraku 🍜 »*, *« Il s'entraîne »*.

La banque de répliques écrites à la main passe à **458** (situations `faim`, `fatigue`, `ennui`
ajoutées), et la réserve du LLM fabrique aussi ces trois humeurs.

**Bug corrigé :** un ninja tiré dans un duel pendant qu'il mangeait gardait son minuteur de
repas, qui le remettait en « balade » en plein combat → duel bloqué (un combat montait à
382 s). Un duel efface maintenant ce qu'il faisait, et un besoin ne peut plus sortir quelqu'un
d'un combat.

## ✅ COHÉRENCE — texte et actes racontent la même chose

Le problème signalé : *« Naruto prépare un mauvais coup »* puis il dit « je vais manger des
nouilles », ou il annonce une blague et lâche un vrai coup de poing. Corrigé sur trois plans.

### Le LLM sait comment la scène finit
Avant, il écrivait un dialogue « dans le vide », sans savoir quel acte suivait. Maintenant son
prompt contient **`quoi` + `fin`** : ce qui se passe ET comment ça se termine (accepté/refusé
pour l'amour, la farce qui réussit, le duel qui se lance…). Le dialogue doit **mener à cette
fin**. La dernière réplique correspond exactement à l'acte joué.

### Les scripts de secours collent à l'acte
Réécrits (sans LLM, ce sont eux qui jouent). La **bêtise** n'est plus un coup de poing déguisé :
le dernier mot de l'auteur EST le moment où il piège, la victime râle sans être blessée.
L'**amour** a deux variantes (`amour_oui` / `amour_non`) choisies selon la relation réelle.

### La bêtise est enfin une farce
`acteRite` pour la bêtise : petit coup en douce (recul de 70 au lieu de 140), étincelle jaune
légère, **aucune perte de PV réelle**, l'auteur se marre. Ce n'est plus une agression.

### Les dialogues ordinaires ont un passé
Le LLM reçoit maintenant **l'historique croisé** entre les personnages présents (`entreEux()` :
« Pain a mis Naruto K.O. », « Sakura a soigné Kakashi »… puisés dans leur mémoire, < 2 min),
plus le **moment de la journée**. Et une consigne d'enchaînement : chaque réplique répond à la
précédente, pas de phrases jetées en l'air. Résultat : des échanges qui ressemblent à de vraies
conversations, différents à chaque fois grâce à la réserve.

### Anti-répétition renforcé
La réserve ne remet plus en pile une réplique que le perso vient de dire (`g.dits`), et le LLM
reçoit la liste de ce qu'il a déjà dit avec « trouve VRAIMENT autre chose ».

## ✅ COMMUNICATION — le LLM a enfin la priorité

Le problème signalé : *« si cette phrase est dite, la réponse sera toujours celle-ci »* — donc
un effet scripté. La cause était mécanique : le LLM (8B sur le PC) met 4-8 s à écrire, mais le
**script de secours en dur** sortait dès 1,2 s. On voyait donc presque toujours les mêmes 2-3
variantes pré-écrites, jamais le dialogue unique du LLM.

Corrigé : **le dialogue attend le LLM** (`grp.attenteLLM` : ~2,6 s pour une conversation,
~3,5 s pour une scène). Tant qu'il n'a pas répondu, silence (ils se rejoignent, se regardent).
Le script en dur ne sort **que** s'il tarde vraiment trop — c'est un filet de dernier recours,
plus le cas normal. Et le LLM peut **prendre le relais même en cours de dialogue**
(`setScript` greffe la suite sans répéter ce qui est déjà affiché).

Le **prompt de conversation** est refondu pour de vrais échanges : chaque réplique répond à la
précédente, la réaction dépend de QUI répond et de ce qu'il pense de l'autre (le même mot ne
provoque pas la même réponse chez tous), chacun garde sa voix, zéro banalité creuse. 24 angles
de départ (au lieu de 16), et la consigne que la conversation PEUT dérailler comme une vraie.

## ✅ L'ATTENTE DU LLM — supprimée, pas masquée

Idée de Raph, meilleure que la précédente : **le texte s'écrit lettre par lettre**. Ce temps
n'est pas perdu, c'est le temps de réflexion du LLM. Quatre mesures qui se cumulent :

**1. Frappe caractère par caractère** (~26 ms/lettre, curseur orange clignotant). La bulle
garde sa **taille finale** dès le départ (pas de tremblement). Durée de vie proportionnelle à
la longueur. Une conversation de 5 répliques gagne ainsi **~12 s de marge**.

**2. On attend le LLM AVANT le premier mot** (6 s pour une conversation, 7 s pour une scène).
Plus jamais de phrase de secours affichée puis remplacée : `setScript` refuse de réécrire un
dialogue déjà LLM (`grp.fromLLM`). Pendant l'attente, ils **se tournent l'un vers l'autre et se
rejoignent** — ça se lit comme deux personnes qui s'apprêtent à parler, pas comme un bug.

**3. LLM accéléré** — c'était le vrai goulot :

| | avant | après |
|---|---|---|
| `maxTokens` dialogue | 620 | **260** |
| `contextSize` | 4096 | **2048** |
| Ollama `num_predict` | 480 | **280** |

Un dialogue de 6 répliques fait ~160 tokens réels. Sur un 8B GPU (~30 tok/s) : **~5 s au lieu
de 20 s** dans le pire cas.

**4. Anticipation** (`prechauffe`) : quand deux ninjas se rapprochent (60-260 px), le LLM
**commence à écrire avant** qu'ils ne se parlent. Quand ils s'arrêtent, le dialogue est déjà
prêt → **zéro attente**. Réservé au mode local (en ligne, le quota est trop précieux).

## ✅ LE FLUX — la première réplique s'affiche pendant que le LLM écrit la suite

Idée de Raph : ne pas attendre que tout le dialogue soit écrit. **Streaming de bout en bout.**
- `main.js` : `onTextChunk` renvoie chaque morceau au jeu via `kv-llm-chunk` dès sa production.
- `mind.js` : une regex extrait chaque `{"qui":…,"dit":…}` **complet** du JSON encore en cours,
  et l'envoie immédiatement au monde (`W.pushLine`).
- `world.js` : `pushLine()` démarre la conversation **dès la première réplique** et ajoute les
  suivantes au fil de l'eau. Le dialogue ne se conclut qu'après 2,2 s sans nouvelle réplique.

Mesuré : la 1ʳᵉ réplique est disponible à **38 % de la génération** → ~1,9 s au lieu de 5 s.
Et comme le jeu la joue en ~2 s (frappe + lecture), la 2ᵉ est déjà arrivée. Le tuyau ne se vide
jamais : **le LLM écrit pendant qu'on lit.**

**Bug corrigé :** le compteur d'attente de fin de flux s'incrémentait 8× trop lentement (on
ajoutait un `dt` de frame alors qu'on ne passe dans ce code qu'une fois toutes les 200 ms) →
les scènes attendaient 30 s au lieu de 2,5 et rataient leur acte. Mesuré sur `worldT` désormais.

### La tête ne dort jamais
`KV_MIND.tick` était appelé **dans** `step()`, donc bloqué en pause. Il est maintenant appelé
depuis la boucle principale avec le temps réel : **le LLM continue de réfléchir en pause,
pendant une scène, pendant une alerte.** Ce temps d'arrêt devient du temps d'avance.

## ⚙️ CE QUI N'A **PAS** BESOIN D'ÊTRE OPTIMISÉ (mesuré)
15 minutes de monde simulées = **5 s de CPU**, soit **93 µs par frame** sur un budget de
16 666 µs → la simulation occupe **0,56 %**. Ralentir les ninjas hors écran n'apporterait rien
et risquerait de casser leur comportement. **Non fait, volontairement.**
Seul ajout gratuit : on ne **dessine** plus les agents hors champ (leur simulation, elle,
continue à l'identique — rien ne se voit au dézoom).

## ✅ PLUS DE VIE — il se passe des choses

*« Même avec tous les persos, j'ai l'impression qu'il ne se passe rien. »* Corrigé :
- **Scènes ~2× plus fréquentes** : respiration entre scènes 13 s → 7 s, cooldown par perso
  55-130 s → 30-70 s. Mesuré : 55 scènes / 15 min (avant : 28).
- Les scènes les plus vivantes (bêtise, dispute, défi) montent en probabilité.
- **Réactions visibles aux K.O.** : les témoins à l'écran se figent, se tournent vers la scène
  et lâchent un mot — choqués pour un ami, ravis pour un ennemi. Un K.O. ne passe plus inaperçu.
- **Alerte sur les K.O. spectaculaires** (haine réciproque forte) — rare, pour ne pas saturer.

## ✅ LA FORCE — le joueur existe dans leur monde

Idée de Raph, et c'est la plus importante du projet : **le joueur n'est pas un spectateur
invisible. C'est une PRÉSENCE que les ninjas perçoivent, subissent, et jugent.**

### Tout commence à zéro
`SOC.depart` est passé à **`"neutres"` par défaut** : personne ne connaît personne. Aucune
relation n'est écrite d'avance. Deux parties ne se ressemblent pas.

### Ils se font une opinion de toi
Chaque ninja porte `opMain` (−100 terreur … +100 dévotion), qui commence à **0**.
`forceAgit(gravité, cible, quoi)` fait juger l'acte par la victime **et par tous les témoins
présents à l'écran** — et un témoin qui déteste la victime en tire la conclusion inverse.

| Ce que tu fais | Effet |
|---|---|
| Le saisir | −0,35 (agaçant) |
| Le lâcher de haut | **−0,85** |
| Le reposer doucement | +0,12 |
| Le jeter sur un ennemi | −0,70 (et −0,50 pour l'autre) |
| Le poser près d'un ami | +0,45 |
| Le prendre en contrôle | −0,50 (être habité, c'est troublant) |
| **Le mener là où son besoin le réclame** | **+0,90** |
| **Le sortir d'un combat qu'il perd** | **+1,00** |
| **Le confier à quelqu'un qui peut le soigner** | **+1,00** |

**Rendements décroissants** : plus un avis est tranché, plus il est dur de le pousser — mais
un avis opposé se corrige 1,5× plus vite (on doute, puis on révise). Et sans manifestation
pendant 25 s, l'opinion **s'estompe**. Une réputation se mérite, et se perd.

Mesuré sur 15 minutes :

| Style de joueur | Résultat |
|---|---|
| absent | indifférence ×15 |
| il attrape de temps en temps | méfiance ×3, indifférence ×12 |
| il les lâche de haut | **terreur ×14** |
| il les pose près de leurs amis | curiosité ×13, fascination ×2 |
| il s'occupe d'eux | **fascination ×11** |

### ⚠️⚠️ LA TÊTE **COMPOSE**, ELLE NE CHOISIT PAS — `demandeReaction()`
Deuxième correction de Raph, et elle va plus loin que la première : *« tu viens de me dire que
leurs réactions sont prévues à l'avance et pas improvisées selon ce qu'ils ont envie de faire. »*
Il avait raison — le **menu** de 11 réactions restait fermé.

Désormais le LLM ne choisit plus un comportement : il **assemble une suite de gestes
élémentaires**, comme on forme une phrase avec des mots. « Fuir » n'est plus une option qu'on
lui propose : c'est ce qui ressort s'il enchaîne `s_eloigner` → `regarder` → `dire`.

**Les 11 briques** (`P.jouerSuite`) : `aller_vers` · `s_eloigner` · `suivre` · `s_arreter` ·
`regarder` · `geste` · `dire` · `attendre` · `provoquer` · `toucher` · `soigner`.

Le prompt ne contient **aucune liste de comportements** : juste qui il est (caractère, état
d'âme, ce qu'il pense de la Force, sa mémoire, ses besoins), ce qui vient de lui arriver, qui
est autour, et la grammaire. Puis : *« Compose une suite de 2 à 4 gestes. Pas de comportement
type : ce que LUI ferait. »*

**L'ancien menu fermé d'intentions** (`but: parler|provoquer|venger|eviter|soigner|seul`) a été
**supprimé**. `penser()` décrit maintenant le moment de vie du ninja et laisse composer.

Mesuré sur 25 min : **158 réactions improvisées → 148 enchaînements différents.**

**Limite honnête :** le vocabulaire *physique* est borné par le moteur. Un ninja ne peut pas
grimper sur un toit ni construire un autel — il n'y a ni sprite ni physique pour ça. Ce qui est
ouvert, c'est le **choix, la combinaison, l'ordre et le sens**. Pas l'inventaire des gestes.

### Le filet : `P.reagirForce()` (quand la tête est absente ou occupée)
Première version : une table (`peur → il fuit`). **Mauvaise approche**, et Raph l'a corrigée :
*« pas du "il se passe ça donc il y a ça", mais une réaction propre à chacun, tirée d'énormément
de données, qui fait qu'il peut réagir comme ceci ou comme cela pour exactement le même
contexte. »*

Refait sur le modèle de l'IA de combat (qui marche depuis le début, précisément pour ça).
**11 réactions possibles**, chacune notée sur ~15 facteurs, puis **tirage proportionnel** :

`fuir` · `reculer` · `cacher` (derrière un ami) · `figer` · `observer` · `approcher` ·
`saluer` · `defier` · `chercher` (quelqu'un à qui en parler) · `proteger` (un plus faible) ·
`ignorer`

Facteurs pesés : opinion · état d'âme · les 3 traits · PV · humeur (besoins) · distance ·
**contagion** (combien de voisins fuient ou vénèrent en ce moment) · son vécu personnel avec
la Force (mémoire fraîche pondérée par l'âge) · nuit ou jour · depuis quand elle n'a rien fait ·
présence d'un allié · présence d'un plus faible à protéger · et du hasard partout.

**Aucun seuil dur.** Un fervent peut avoir peur. Un terrifié peut venir voir. Mesuré :

| Opinion | Ce qu'ils font (500 tirages, Force venant d'agir) |
|---|---|
| terrifiés | fuir 26% · ignorer 23% · observer 19% · reculer 18% · **defier 7%** · chercher 5% |
| méfiants | ignorer 44% · figer 20% · observer 15% · fuir 11% · reculer 9% |
| indifférents | ignorer 56% · figer 31% · observer 13% |
| fascinés | ignorer 37% · **approcher 22%** · saluer 15% · figer 14% |
| en dévotion | approcher 34% · saluer 30% · **ignorer 25%** |

Et **le même ninja**, 400 fois dans la même situation (Naruto terrifié) :
fuir 32% · ignorer 25% · **defier 15%** · reculer 10% · chercher 9% · observer 8% · figer 2%.
Naruto défie plus que la moyenne — parce qu'il est impulsif, pas parce que c'est écrit.

### Trois nouvelles scènes, uniquement sur toi
- 🤫 **le secret** — deux effrayés se confient à voix basse. *« Quelque chose nous attrape. »*
  Et ça **propage la peur** (−10 pour l'autre).
- 🙏 **le culte** — deux fervents parlent de la Présence qui veille. Ça **propage la foi** (+12).
- ✊ **le défi** — un aigri terrifié provoque le vide. Rien ne répond. **Le silence le ronge**
  (−8 d'opinion, −0,08 d'âme).
- ❓ **la théorie** — ils cherchent à comprendre ce que tu es. Le LLM a carte blanche : un dieu,
  un rêve, une punition, un enfant qui joue, ou l'idée qu'ils n'existent que pour être regardés.
  **Aucune réponse n'est imposée**, et deux parties ne donneront pas les mêmes théories.
  Leurs avis **convergent** de 30 % après en avoir parlé : les croyances se propagent.

Le LLM reçoit tout ça : ils n'ont **aucun mot** pour te désigner — ni dieu ni démon, juste
« la chose », « ça ».

## ✅ L'ÉTAT D'ÂME — le même ninja n'est pas le même d'une partie à l'autre

Second volet de l'idée de Raph. `P.ame` (−1 aigri … +1 serein) n'est **pas un trait** : c'est
le **résultat** de ce qu'il a vécu. Calculé (`calculeAme`) à partir du climat de ses relations,
du nombre d'amis et d'ennemis, du bilan coups/douceurs, de son avis sur la Force et de ses
besoins. Il **dérive lentement** (6 % toutes les 2 s) : on n'aigrit pas quelqu'un en une minute.

Et il **module tout** :
- `ouverture()` → à quel point il peut encore s'attacher. Aigri : il se lie mal.
- `aCran()` → à quel point il s'emporte. Aigri : il cherche la bagarre.

### ⚠️ Le piège évité : la spirale
Première version : après 30 min, **13 aigris sur 15, 24 inimitiés, 1 amitié**. Le monde ne
pouvait QUE s'effondrer — chaque bagarre laissait une trace définitive et rien ne la réparait.
Trois correctifs :
1. **Le temps apaise.** Les relations non entretenues retombent vers 0, et **une rancune
   s'oublie 3× plus vite qu'une amitié ne se refroidit**.
2. **Le bon compte plus que le mauvais.** Discuter : +4,6 (au lieu de +3). Un combat amical
   **rapproche** (+3/+7) au lieu d'éloigner.
3. **On ne se bat pas avec un inconnu** sans raison (×0,22 si la relation est neutre).

Puis un second problème : plus rien ne se passait. Cause réelle — avec 15 ninjas et des
rencontres au hasard, **ils ne reparlaient jamais à la même personne**, donc aucune amitié ne
pouvait se construire. Corrigé : ils **choisissent** leur interlocuteur (préférence pour ceux
qu'ils apprécient) et **dérivent vers eux** en se baladant.

Résultat mesuré à 25 min, en partant de zéro :
**7 amitiés, 1 inimitié, des âmes de −0,37 à +0,63** (aigris, neutres, apaisés, sereins).
Le monde se construit tout seul, **dans les deux sens**.

## ✅ L'ENTRAÎNEMENT — la bonne réponse, trouvée en reculant

**Leçon de méthode** (Raph : *« au lieu de trouver absolument une solution fixe, prends du
recul »*). Le monde neutre s'endormait : la formule des bagarres est proportionnelle à la
haine, donc à zéro quand personne ne déteste personne. **2 bagarres en 25 min.**

Ma première réponse : fabriquer de l'hostilité artificielle (terme d'« incident »). Mauvaise
piste — je m'acharnais sur *les bagarres* alors que le vrai besoin était *que les techniques
servent et qu'il se passe quelque chose*.

**La bonne réponse : l'entraînement.** Deux ninjas qui s'ennuient, sont en forme et
s'apprécient (ou veulent se mesurer) s'entraînent ensemble. Un entraînement est **toujours**
`niveau: "amical"` quelles que soient les relations : dégâts ×0,65, pas de technique lourde,
arrêt à 32 % de PV, **aucun K.O.** Et à la fin : **+5 de relation des deux côtés, −45 d'ennui**.

| | avant | après |
|---|---|---|
| Combats (25 min, sans IA) | 2 | **36** (dont 33 amicaux) |
| Techniques utilisées | 25 % | **69 %** (76 % avec IA) |
| K.O. | 1 | 3 |

Ça résout tout d'un coup : les techniques servent, le monde est animé, et ça **rapproche** au
lieu de diviser. C'est aussi ce qui colle le mieux à l'univers.

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

## 🚧 CE QUI RESTE

### En attente de Raph
1. **Les animations** — il les répare lui-même dans `editor/`. Il renvoie `<perso>.js`,
   `<perso>_anim.png` et surtout **`<perso>_control.json`** (avec lequel je règle les hitboxes
   et repère les raccords qui sautent entre deux frames).
2. **Le test des 5 décors** — touche `D`, la ligne rouge doit passer sous leurs pieds.
   S'il y a un décalage : curseur **Sol** → me donner le chiffre.
3. **Le visuel / les options** — il a dit qu'il donnerait sa liste après les gros problèmes.

### À faire côté code
4. **La caméra (MediaPipe)** — le gros morceau restant. Mains : pincer = attraper,
   paume = soigner, poing = provoquer. Visage = ambiance. La permission caméra est déjà
   autorisée dans `main.js`. À faire **après** les animations (choix de Raph).
5. ~~Vérifier le packaging~~ ✅ **FAIT — le build fonctionne** (voir ci-dessous).
6. **Décors** — en ajouter / en aligner. Reporté par Raph « en dernier ».

### Petits restes connus
- **Itachi** et **Konan** n'ont pas d'anim `win` (la pose de victoire est sautée) — sera réglé
  par l'atelier d'animations.
- **Kakashi** (427 poses, 5 techniques) et **Saï** (395 poses, 5 techniques) : la moitié de
  leur planche n'a jamais été découpée. C'est LE chantier animations.

---

## ✅ LE PACKAGING — testé pour de vrai

Build complet lancé en local (`npx electron-builder --linux dir`) puis **application lancée**
sous écran virtuel. Résultat :

| Étape | Résultat |
|---|---|
| `asarUnpack` sort node-llama-cpp de l'archive | ✔ |
| Binaire natif `llama-addon.node` présent | ✔ |
| L'appli démarre depuis le build | ✔ |
| Config lue depuis l'asar | ✔ |
| RAM détectée → choix du modèle | ✔ |
| Vulkan tenté, repli CPU propre | ✔ |
| Le moteur va jusqu'au téléchargement du modèle | ✔ (403 : HuggingFace bloqué dans le bac à sable, pas un bug) |
| Repli en cerveau scripté sans planter | ✔ |

**Le `.exe` fonctionnera.** C'était le dernier gros risque du projet.

### Allègement (−40 Mo)
- `llama/gitRelease.bundle` (**31 Mo**) : le code source de llama.cpp, inutile puisqu'on
  utilise les binaires précompilés (`build: "never"`). → `node-llama-cpp` passe de 36 à 4,4 Mo.
- Architectures ARM exclues sur Windows/Linux (gardées sur Mac pour Apple Silicon).
- CUDA déjà exclu (−550 Mo).

App décompressée : **400 Mo** (dont ~300 Mo d'Electron). L'installeur NSIS compresse fortement.

### Garde-fou dans la CI
`.github/workflows/build.yml` a maintenant une étape **« Vérifier que le moteur d'IA est bien
embarqué »** : elle cherche `app.asar.unpacked`, `node-llama-cpp` et `llama-addon.node`, et
**fait échouer le build** s'ils manquent. Sans ça, une future modif pourrait produire un `.exe`
qui se lance mais sans IA — et on ne s'en apercevrait qu'après l'avoir distribué.

⚠️ **Mac** : `macos-latest` sur GitHub est en Apple Silicon (arm64). Le `.dmg` produit ne
tournera **pas** sur un Mac Intel. Si besoin, ajouter `macos-13` à la matrice.

---

## 🔄 Reprendre dans une nouvelle conversation

👉 **Voir `REPRENDRE.md`** : il contient un prompt prêt à copier-coller qui donne à une nouvelle
conversation tout le contexte nécessaire (le projet, mes préférences de travail, les méthodes de
vérification, et ce qui reste à faire).

### Carte du dépôt
```
konoha-vivant/
├─ main.js               Electron + moteur LLM embarqué (node-llama-cpp) + repli Ollama/Groq/Gemini
├─ preload.js            pont fenêtre ↔ Node (statut, LLM, flux de texte, musique)
├─ konoha.config.json    tout en "auto" — ne rien toucher normalement
├─ package.json          build electron-builder (asarUnpack, exclusions CUDA/ARM)
├─ LANCER.bat / .command double-clic : installe puis lance
├─ ETAT_DU_PROJET.md     CE FICHIER — l'état complet
├─ REPRENDRE.md          le prompt de reprise
├─ .github/workflows/    build.yml : .exe + .dmg, avec vérification que l'IA est embarquée
├─ src/
│  ├─ world.html/.css    l'interface (palette reprise de sharingan-cam)
│  ├─ world.js           ★ LE MONDE : agents, combat, social, besoins, scènes, la Force
│  ├─ mind.js            ★ LA TÊTE : réserve, dialogues, réactions composées (optionnelle)
│  ├─ audio.js           voix ripées + bruitages synthétisés, volume suivant le zoom
│  ├─ index.html         atelier de vérification des sprites
│  └─ data/
│     ├─ <15 persos>.js  animations : {r:[x,y,w,h], ax, orb, ofx, fx, proj, clones}
│     ├─ moves.js        127 techniques : ce qu'elles FONT (dégâts, portée, coût, poids IA)
│     ├─ social.js       camps, traits, 458 répliques écrites à la main, départ des relations
│     └─ sons.js         320 voix classées par durée
├─ editor/               ★ L'ATELIER D'ANIMATIONS (découpe, montage, réparation d'un .js)
├─ tools/simtest.js      ★ LE HARNAIS DE TEST — `node tools/simtest.js 25`
└─ assets/               planches, décors, portraits, sons/<perso>/, music/
```

### Les fichiers à connaître en priorité
1. **`src/world.js`** — tout le moteur. C'est le gros morceau.
2. **`src/mind.js`** — la couche LLM. Entièrement optionnelle.
3. **`tools/simtest.js`** — la seule façon de vérifier qu'on n'a rien cassé.
4. **`src/data/moves.js`** — l'équilibrage des techniques se fait là, pas ailleurs.

### Les pièges déjà rencontrés (ne pas les refaire)
- Un remplacement de texte qui échoue en silence : **vérifier que le motif existe**.
- Une scène qui ment (annoncée mais rien ne se passe) : voir « UNE SCÈNE NE MENT JAMAIS ».
- Le monde qui s'effondre en spirale négative : voir « Le piège évité ».
- Le monde qui s'endort : voir « L'ENTRAÎNEMENT ».
- Une table « situation → réaction » : voir « LA TÊTE COMPOSE ».
- Un compteur alimenté par `dt` dans du code qui ne tourne pas à chaque frame.
