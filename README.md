# InvoiceRenamer

Application desktop pour renommer automatiquement des factures PDF à partir de leur contenu.

InvoiceRenamer extrait le texte de chaque facture (texte natif + OCR Mistral), puis génère un nom de fichier structuré via un modèle de langage. Les fichiers sont renommés localement sur votre machine.

## Fonctionnalités

- Sélection ou glisser-déposer de fichiers PDF
- Renommage par lot avec barre de progression globale et par fichier
- Prompt personnalisable pour le format de nom attendu
- Clé API Mistral stockée dans le trousseau système
- Interface en français et en anglais

## Prérequis

- [Node.js](https://nodejs.org/) (LTS)
- [Rust](https://www.rust-lang.org/tools/install)
- Une clé API [Mistral](https://mistral.ai/)

### Dépendances système (build Tauri)

- **macOS** : Xcode Command Line Tools
- **Linux** : `libwebkit2gtk-4.1-dev`, `libappindicator3-dev`, `librsvg2-dev`, `patchelf`
- **Windows** : WebView2 (généralement déjà installé)

## Développement

```bash
npm install
npm run tauri dev
```

Le frontend de développement tourne sur le port `1420`.

## Build

```bash
npm run build          # compile le frontend (TypeScript + Vite)
npm run tauri build    # build l'application desktop
```

## Tests

```bash
npm test               # tests unitaires Rust (processor, i18n, pdf_utils, mistral)
```

## CI / Releases

| Événement | Workflow | Action |
|-----------|----------|--------|
| Push / pull request | [`ci.yml`](.github/workflows/ci.yml) | Vérifie le build frontend et Rust (`cargo test`, `cargo build`) |
| Tag git | [`release.yml`](.github/workflows/release.yml) | Compile et publie les binaires sur GitHub Releases |

### Monter de version

Le script [`scripts/bump-version.sh`](scripts/bump-version.sh) aligne la version dans tous les fichiers concernés :

- `package.json` et `package-lock.json` (via `npm version`)
- `src-tauri/Cargo.toml` et `src-tauri/tauri.conf.json`
- `src-tauri/Cargo.lock` (via `cargo check`)

```bash
./scripts/bump-version.sh 0.1.1
```

Puis committer, tagger et pousser. Le tag git utilise le préfixe `app-v` (la version dans les fichiers reste `0.1.1`) :

```bash
git add .
git commit -m "Bump version to 0.1.1"
git tag app-v0.1.1
git push origin HEAD && git push origin app-v0.1.1
```

Le push du tag déclenche [`release.yml`](.github/workflows/release.yml), qui compile et publie les binaires sur GitHub Releases (macOS Intel/ARM, Linux, Windows).

## Structure du projet

```
├── src/              # Frontend (HTML, CSS, TypeScript)
├── src-tauri/        # Backend Rust (Tauri)
├── scripts/          # Utilitaires (ex. bump-version.sh)
├── python draft/     # Prototypes et notebooks de traitement
└── index.html
```

## Licence

MIT — voir [LICENSE](LICENSE).

La police [SN Pro](src/assets/fonts/sn-pro/OFL.txt) est sous [SIL Open Font License 1.1](src/assets/fonts/sn-pro/OFL.txt).
