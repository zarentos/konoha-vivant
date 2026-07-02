# Konoha Vivant

Base du projet. Pour l'instant : **atelier d'animations** (on vérifie que le découpage des planches est bon, personnage par personnage). Ça deviendra le jeu complet ensuite.

État actuel : **Naruto** (23 animations découpées directement de sa planche, y compris knockdown séparé en *chute* / *au sol* / *se relève*). Les autres persos arrivent.

---

## 1. Voir les animations tout de suite (rien à installer)

Double-clique **`src/index.html`**. Une fenêtre s'ouvre dans ton navigateur : choisis une animation à gauche, ça joue au centre. Barre espace = pause, flèches = image par image.

> C'est le moyen le plus rapide de vérifier le rendu. La caméra/sharingan ne sont pas là (phase plus tard).

---

## 2. (Optionnel) Lancer comme vraie app sur ton PC

Il faut **Node.js** installé (https://nodejs.org, version LTS). Ensuite, dans le dossier du projet :

```bash
npm install
npm start
```

Ça ouvre l'app de bureau (Electron). Même contenu que l'aperçu.

---

## 3. Fabriquer le `.exe` (Windows) et le `.dmg` (Mac) — les fichiers finaux

On ne compile pas sur ton PC : **GitHub le fait pour toi** (Windows *et* Mac), gratuitement.

1. Mets ce dossier dans un dépôt GitHub (un nouveau dépôt, ou une branche de ton dépôt actuel). Pousse tout (`git add . && git commit -m "app" && git push`).
2. Sur GitHub, onglet **Actions**. Si demandé, clique **"I understand my workflows, go ahead and enable them"**.
3. Le workflow **build** se lance tout seul au push. (Sinon : Actions → *build* → **Run workflow**.)
4. Attends ~5 min. Ouvre le run terminé (coche verte) → section **Artifacts** en bas :
   - **`KonohaVivant-windows-latest`** → contient le `.exe` (l'installateur Windows).
   - **`KonohaVivant-macos-latest`** → contient le `.dmg` (l'app Mac).
5. Télécharge, installe. Tu envoies le `.exe` à qui tu veux, ton pote Mac prend le `.dmg`.

### À savoir (app non signée = normal pour un projet perso)
- **Windows** : au lancement, écran bleu SmartScreen → **"Informations complémentaires" → "Exécuter quand même"**.
- **Mac** : clic droit sur l'app → **"Ouvrir"** (ou Réglages Système → Confidentialité et sécurité → "Ouvrir quand même").

---

## Structure

```
konoha-vivant/
├─ main.js              app de bureau (Electron)
├─ preload.js           (réservé)
├─ package.json         dépendances + config de build (.exe/.dmg)
├─ .github/workflows/   la CI qui fabrique les installateurs
├─ assets/              planches (PNG détourés, fond transparent)
│  └─ Naruto.png
└─ src/
   ├─ index.html        l'aperçu
   ├─ style.css
   ├─ app.js            lecteur d'animations (ancrage par les pieds)
   └─ data/naruto.js    frames de chaque animation de Naruto
```

Les sprites sont **tes** planches : je ne redessine rien, je définis seulement quelles cases composent chaque animation.
