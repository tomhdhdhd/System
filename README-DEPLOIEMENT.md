# ⚔ LE SYSTÈME — Guide de déploiement (0€)

Objectif : mettre l'app en ligne gratuitement et l'installer sur ton Android comme une vraie application, avec notifications.

Durée totale : ~10 minutes.

---

## Étape 1 — Mettre les fichiers en ligne (GitHub Pages, gratuit à vie)

1. Crée un compte gratuit sur **github.com** (si tu n'en as pas déjà un).
2. En haut à droite : **+** → **New repository**.
   - Repository name : `systeme`
   - Coche **Public** (obligatoire pour Pages gratuit)
   - Clique **Create repository**
3. Sur la page du repo : **uploading an existing file** (ou Add file → Upload files).
4. Glisse-dépose **les 6 fichiers** de ce dossier (pas le dossier lui-même, ni ce README obligatoirement) :
   - `index.html`
   - `app.js`
   - `sw.js`
   - `manifest.webmanifest`
   - `icon-192.png`
   - `icon-512.png`
5. Clique **Commit changes**.
6. Va dans **Settings** (onglet du repo) → **Pages** (menu de gauche).
   - Source : **Deploy from a branch**
   - Branch : **main** / dossier **/ (root)** → **Save**
7. Attends 1 à 2 minutes, recharge la page : ton URL apparaît, du type
   **`https://TON-PSEUDO.github.io/systeme/`**

> Alternative si tu préfères : app.netlify.com → "Deploy manually" → glisse le dossier entier. Même résultat.

---

## Étape 2 — Installer sur ton Android

1. Ouvre l'URL dans **Chrome** sur ton téléphone.
2. Menu **⋮** (en haut à droite) → **"Installer l'application"** (ou "Ajouter à l'écran d'accueil").
3. Valide. L'icône violette ◆ apparaît sur ton écran d'accueil.
4. Lance l'app depuis cette icône : plein écran, sans barre de navigateur, fonctionne même hors connexion.

---

## Étape 3 — Activer les rappels

1. Dans l'app : onglet **Profil** → **🔔 Activer les rappels** → **Autoriser**.
2. Pour une fiabilité maximale sur Android :
   - Paramètres Android → Applications → **Chrome** → Notifications : **autorisées**
   - Paramètres Android → Applications → **Chrome** → Batterie : **Non optimisée** (ou "Sans restriction")

### Ce que font les rappels (honnêtement)

- ⏰ **Rappel à l'heure exacte** de chaque routine : fonctionne quand l'app est ouverte ou récemment utilisée en arrière-plan.
- ⚔ **Rappel quotidien automatique** ("Le Système t'attend") : envoyé même app fermée, via la synchronisation en arrière-plan de Chrome — c'est Chrome qui choisit le moment exact (généralement quand tu déverrouilles ton téléphone).
- Pour un rappel critique à heure fixe garantie (ex : médicament), double avec une alarme Android classique. C'est la seule limite du 100% gratuit sans serveur.

---

## Tes données

- Stockées **uniquement sur ton téléphone** (localStorage). Rien ne part sur un serveur.
- Conséquence : fais **Profil → Exporter la sauvegarde** de temps en temps (fichier JSON à garder dans ton Drive). En cas de changement de téléphone ou de nettoyage des données Chrome : **Importer**.

---

## Mettre à jour l'app plus tard

Quand on fera une V4 : tu remplaces les fichiers dans le repo GitHub (Upload files → écraser), tu attends 1 minute, puis tu fermes et rouvres l'app deux fois. Le service worker récupère la nouvelle version automatiquement.

---

## Récap des fichiers

| Fichier | Rôle |
|---|---|
| `index.html` | Structure + design (thème Monarque) |
| `app.js` | Toute la logique : quêtes, XP, rappels, sauvegarde |
| `sw.js` | Mode hors-ligne + notifications en arrière-plan |
| `manifest.webmanifest` | Fiche d'identité de l'app (nom, icône, plein écran) |
| `icon-192.png` / `icon-512.png` | Icônes d'écran d'accueil |

Bon grind, chasseur. 🗡️
