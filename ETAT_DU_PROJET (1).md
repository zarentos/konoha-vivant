# KONOHA VIVANT — état du projet (à jour)

> **VISUEL TERMINÉ** : les 15 persos sont découpés ET leurs effets sont calés/validés.
> Prochaine phase = phase 2 (IA autonome, caméra, packaging).

Repo : github.com/zarentos/konoha-vivant
Repo de référence (rips bruts) : github.com/zarentos/naruto-test — sert juste d'archive des planches d'origine.

---

## 1. Le projet

Jeu de combat Naruto **autonome** (les persos se battent tout seuls, l'utilisateur n'a pas besoin d'interagir).
HTML5/JS, packagé en Electron. 15 personnages jouables.

**Objectif final** : IA temps réel qui pilote les persos + détection des mouvements de main à la caméra + build final en une seule appli `.exe` / `.dmg`. Tout doit rester gratuit.

---

## 2. Ce qui est FAIT — découpage des sprites (100 %)

Les **15 personnages** sont entièrement découpés depuis les planches (rips), étiquetés et vérifiés un par un :

Naruto, Sasuke, Itachi, Sakura, Kakashi, Jiraiya, Orochimaru, Pain, Deidara, Konan, Saï, Shikamaru, Suigetsu, Karin, Jūgo.

**492 animations** au total. Chaque perso a la taxonomie complète : idle, run, dash, jump, guard, attack, attack_air, strong (+ fwd/up/down/air/dash), win, hurt (light/special/h1/h2/h3), knockdown, downed, getup, mode crapaud, + ses techniques signature.

Méthode utilisée : découpage automatique au pixel (détection du fond par color-key), puis validation visuelle via une **fiche PNG** par perso (fond magenta, chaque ligne = une anim étiquetée, frames numérotées, trait rouge = ancre pieds). Raph renvoie la fiche, Claude la relit et corrige.

Fichiers : `src/data/<perso>.js` — un par perso. Planches détourées dans `assets/`.

---

## 3. Ce qui est EN COURS — placement des effets (jutsu)

**Le problème** : les techniques (rasengan, chidori, katon…) doivent afficher leur effet visuel au bon endroit, frame par frame. L'effet doit suivre la main, être **devant** le perso, partir en projectile quand c'est un jet, etc.

**Le système** (dans les data) :
- `fx: [...]` = les sprites de l'effet (découpés sur la planche du perso lui-même)
- `orb: [x,y]` sur chaque frame = **où** placer l'effet (relatif au sprite du corps). `null` = pas d'effet sur cette frame.
- `ofx: N` sur chaque frame = **quel** sprite de `fx` afficher. `-1` = aucun.
- `proj: true` + `launchFrame: N` = l'effet **part vers l'avant** comme un projectile à partir de la frame N (au lieu de rester en main)
- `clones: true` = l'effet s'affiche **aux pieds des clones** (de part et d'autre), pas dans la main

**Méthode de calage** : mesure au pixel de la position de la main / bouche sur chaque frame, puis génération d'une **fiche PNG de contrôle** (`FICHE_<perso>_orbes.png`) qui compose l'effet sur chaque frame. Raph la renvoie, Claude vérifie et ajuste.

### État perso par perso

| Perso | Effets séparés à caler | État |
|---|---|---|
| **Naruto** | rasengan, oodama, rising ×2, rasen_shuriken, ryujin, kage_bunshin, kyuubi_4t | ✅ **FAIT et validé** |
| **Sasuke** | chidori, strong (électricité), katon (projectile), kirin | ✅ **FAIT et validé** |
| **Itachi** | katon (projectile bouche) | ✅ **FAIT et validé** |
| **Sakura** | shosen (soin vert, main), strong (impact sol) | ✅ **FAIT et validé** |
| **Kakashi** | raikiri, raikiri_montant | ✅ **FAIT et validé** |
| **Jiraiya** | endan, senpu (feu bouche → proj), rasengan (main) | ✅ **FAIT et validé** |
| **Deidara** | strong, c1, clone_argile, c2 (bombes d'argile) | ✅ **FAIT et validé** |
| **Saï** | 5 bêtes d'encre (souris/faucon/plongeant/serpent/lion) | ✅ **FAIT et validé** |
| **Suigetsu** | suiko (prison d'eau) | ✅ **FAIT et validé** |
| Orochimaru, Pain, Konan, Shikamaru, Karin, Jūgo | *aucun* — leurs effets sont déjà dessinés dans les sprites du corps | ✅ rien à faire |

**TERMINÉ : les 15 persos sont calés et validés. 492 animations, 2533 frames, 0 problème.**

Pour Jiraiya, les mesures sont déjà prises :
- endan (4 frames) : bouche ≈ (57,29) (57,29) (57,12) (80,28) — proj
- senpu (10 frames) : bouche ≈ (57,30)(60,14)(70,34)(73,21)(73,21)(65,30)(65,30)(80,13)(82,31)(82,28) — proj
- rasengan (5 frames) : main ≈ (67,42)(70,23)(55,29)(215,31)(92,25) — pas proj, reste en main

---

## 4. L'atelier de vérification

`src/index.html` + `src/app.js` — **double-clic sur index.html**, pas besoin de serveur.
Menu déroulant = 15 persos. Liste = toutes leurs anims groupées. Les anims avec `+fx` / `proj` / `clones` ont un effet.

`src/app.js` (v4) contient le moteur de rendu des effets : orbe par frame (orb/ofx), placement auto dans la main si pas d'orb, mode projectile (`launchFrame`), mode clones, effet toujours **devant** le corps.

⚠️ **Attention** : ne PAS faire de color-key au runtime avec `getImageData` — ça plante en `file://` (canvas tainted) et rien ne s'affiche. Les planches dans `assets/` sont **déjà détourées** (fond transparent), on les dessine directement.

---

## 5. Noms d'animations provisoires (à renommer quand Raph veut — ça casse rien)

- Itachi : `susanoo`, `crow_scatter`, `crow_swarm`
- Jiraiya : `hari_jizo`, `jutsu_hair`, `jutsu_hair2`, `sage_1..7` (mode ermite)
- Orochimaru : `jutsu_serpent1..5`
- Konan : `jutsu_papier1..7`, `ailes_ange`
- Suigetsu : `kubikiri1..12` (beaucoup de swings de sabre, à consolider éventuellement)
- Shikamaru : `shadow_jutsu1..3`
- Jūgo : `hache_violente2`, `pics`, `entrave2`

## 6. Non inclus (à demander si besoin)

- **Kakashi "G"** et **2e Saï** : leur planche contient une 2e version complète en bas, pas traitée.
- **Fukasaku / Shima** (crapauds) : aucune planche fournie.

---

## 7. Prochaine étape immédiate

Le visuel est **fini**. On passe à la **phase 2** : IA autonome temps réel, hand-tracking caméra (MediaPipe), packaging Electron `.exe`/`.dmg`.

---

## 8. Comment reprendre dans une nouvelle conversation

Coller ce fichier, plus :

> On bosse sur konoha-vivant (github.com/zarentos/konoha-vivant). Les 15 persos sont découpés. On cale la position des effets frame par frame, un perso à la fois, via une fiche PNG que je te renvoie. Le découpage ET le calage des effets sont TERMINÉS pour les 15. On attaque la phase 2 : IA autonome temps réel, hand-tracking caméra (MediaPipe), packaging Electron .exe/.dmg.

Claude clone le repo pour lire l'état réel du code.
