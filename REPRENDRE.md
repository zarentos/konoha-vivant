# Reprendre Konoha Vivant dans une nouvelle conversation

Copie-colle **tout ce qui suit la ligne** dans le premier message d'une nouvelle conversation,
et joins le dépôt GitHub (ou le zip du projet).

---

## PROMPT À COPIER

Je reprends un projet en cours avec toi. Lis d'abord `ETAT_DU_PROJET.md` à la racine du dépôt :
il contient l'état complet, les décisions prises et les pièges déjà rencontrés. Ne recommence
rien de ce qui y est décrit comme fait.

**Le projet.** « Konoha Vivant » : un vivarium autonome dans l'univers Naruto. Ce n'est **pas**
un jeu de combat. 15 ninjas vivent seuls — ils marchent, parlent, se lient, se battent, mangent,
dorment, se vengent, se réconcilient. Le joueur regarde, et peut intervenir à la souris. Tout
part de **zéro** : personne ne connaît personne, aucune relation n'est écrite d'avance, et deux
parties ne se ressemblent pas.

**La technique.** HTML5 + JS pur (aucun framework), empaqueté en Electron. Le moteur d'IA est
**embarqué dans l'exécutable** (`node-llama-cpp` / llama.cpp) : rien à installer côté
utilisateur, le modèle Qwen3 se télécharge une fois au premier lancement puis tourne hors ligne
et sans limite. Le jeu **doit** fonctionner à l'identique sans IA (cerveau scripté de repli) —
c'est une contrainte absolue, jamais de plantage possible à cause du LLM.

**Ma façon de travailler, respecte-la :**
- Je parle français, familièrement. Réponds-moi en français.
- **Pose-moi de vraies questions.** Si tu as un doute sur ce que je veux, demande — surtout
  avant un gros morceau : je préfère cadrer d'abord que jeter du travail après. Pose-en autant
  qu'il en faut.
  Ce que je ne veux pas, c'est qu'on me fasse trancher des détails techniques que tu peux
  décider toi-même, ou qu'on me redemande ce que j'ai déjà dit. Sur ces points-là : décide,
  explique ton choix, montre le résultat. Je corrigerai si ça ne va pas.
- **Livre toujours un zip contenant UNIQUEMENT les fichiers modifiés**, avec l'arborescence du
  dépôt. Je décompresse par-dessus mon dossier et je remplace. Ne me renvoie jamais un fichier
  qui n'a pas changé.
- **Gratuit obligatoire.** Aucune dépendance payante, aucun compte, aucun quota.
- **N'optimise pas pour économiser du matériel ou de l'argent.** Fais le meilleur truc possible.
  Mais **ne « optimise » que ce qui en a besoin** : mesure avant de toucher.
- Quand quelque chose ne va pas, **cherche la cause réelle**. Ne pose pas un pansement.
- **Prends du recul.** Si tu t'acharnes sur une solution, c'est souvent que le problème est mal
  posé. (Exemple vécu : je voulais que les techniques servent, tu as tenté de fabriquer de
  l'hostilité artificielle ; la vraie réponse était l'entraînement amical.)
- **Rien ne doit être scripté.** Aucune table du type « situation → réaction ». Les
  comportements se **calculent** à partir de beaucoup de facteurs, ou se **composent** par le
  LLM à partir de briques élémentaires. Deux personnages dans la même situation ne doivent pas
  faire la même chose, et le même personnage ne doit pas se répéter.
- Si un bouton a besoin d'une explication, c'est qu'il est mal fait. Refais-le.

**Comment tu vérifies ton travail** (indispensable, tu ne peux pas jouer au jeu) :
- **Logique** : `node tools/simtest.js 25` — harnais headless qui simule 25 minutes de monde
  avec un faux DOM et un faux LLM. Il valide : aucune exception, aucun NaN, toutes les
  techniques pointent sur une animation réelle, les scènes tiennent leur promesse, l'émergence
  des relations, les besoins, le budget de requêtes. Il dit précisément quels critères échouent.
  **Ne livre jamais sans l'avoir relancé.**
- **Visuel** : tu ne vois pas le rendu. Fabrique une image de contrôle en Python/Pillow avec
  **exactement la même math** que `world.js`, puis regarde-la. Ou demande-moi une capture.
- **Attention** : quand tu modifies un fichier par recherche-remplacement, **vérifie que le
  motif a bien été trouvé**. J'ai perdu du temps sur des remplacements silencieusement ratés.

**Ce qui reste à faire** (détail dans `ETAT_DU_PROJET.md`, section « CE QUI RESTE ») :
1. **Les animations** — je les répare moi-même dans `editor/` (atelier fourni). Je te renverrai
   `<perso>.js`, `<perso>_anim.png` et `<perso>_control.json` : avec ce dernier tu règles les
   hitboxes et tu repères les raccords qui sautent entre deux frames.
2. **La caméra** — MediaPipe, gratuit, dans la page. Décidé : elle ne doit **pas** déclencher de
   réactions prévues ; ma présence devient **une donnée de plus** que le LLM pèse pour composer.
   Bouton pour l'activer. Pièce sombre = pas de détection, tant pis. Pas de micro.
3. **Les décors** — en ajouter, en aligner (curseur « Sol » déjà en place, touche `D` pour voir
   la ligne de sol).
4. **Le visuel et les options** — je te donnerai ma liste.

Commence par lire `ETAT_DU_PROJET.md` en entier, puis dis-moi ce que tu as compris et par quoi
tu proposes de commencer. Ne code rien avant.
