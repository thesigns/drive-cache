#!/usr/bin/env bash
set -e

git fetch origin main
git reset --hard origin/main
docker compose down
docker compose up -d --build
