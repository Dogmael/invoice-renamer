#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

usage() {
  cat <<EOF
Usage: $0 <version>

Met à jour la version dans tous les fichiers du projet (sans créer de tag git).

Exemples:
  $0 0.1.1
  $0 v0.1.1
EOF
  exit 1
}

[[ $# -eq 1 ]] || usage

NEW_VERSION="${1#v}"

if ! [[ "$NEW_VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+(-[a-zA-Z0-9.]+)?(\+[a-zA-Z0-9.]+)?$ ]]; then
  echo "Erreur: version invalide '$NEW_VERSION' (attendu: semver, ex. 0.1.1)" >&2
  exit 1
fi

CURRENT_VERSION="$(grep -m1 '"version"' package.json | sed -E 's/.*"version": "([^"]+)".*/\1/')"

if [[ "$CURRENT_VERSION" == "$NEW_VERSION" ]]; then
  echo "La version est déjà $NEW_VERSION, rien à faire."
  exit 0
fi

echo "Bump $CURRENT_VERSION → $NEW_VERSION"

echo "→ npm (package.json + package-lock.json)"
npm version "$NEW_VERSION" --no-git-tag-version

echo "→ Rust (Cargo.toml + tauri.conf.json)"
sed -i '' "s/^version = \"$CURRENT_VERSION\"/version = \"$NEW_VERSION\"/" src-tauri/Cargo.toml
sed -i '' "s/\"version\": \"$CURRENT_VERSION\"/\"version\": \"$NEW_VERSION\"/" src-tauri/tauri.conf.json

echo "→ Cargo.lock (via cargo check)"
cargo check --manifest-path src-tauri/Cargo.toml -q

echo ""
echo "Fichiers mis à jour :"
echo "  - package.json          (npm version)"
echo "  - package-lock.json     (npm version)"
echo "  - src-tauri/Cargo.toml"
echo "  - src-tauri/tauri.conf.json"
echo "  - src-tauri/Cargo.lock  (cargo check)"
echo ""
echo "Prochaines étapes :"
echo "  git add package.json package-lock.json src-tauri/Cargo.toml src-tauri/tauri.conf.json src-tauri/Cargo.lock"
echo "  git commit -m \"Bump version to $NEW_VERSION\""
echo "  git tag v$NEW_VERSION"
echo "  git push origin HEAD && git push origin v$NEW_VERSION"
