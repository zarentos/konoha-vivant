#!/bin/bash
cd "$(dirname "$0")"
if ! command -v node >/dev/null 2>&1; then
  echo "Node.js n'est pas installe. Va sur https://nodejs.org"
  read -p "Entree pour fermer"; exit 1
fi
[ -d node_modules ] || npm install
npm start
