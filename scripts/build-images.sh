#!/usr/bin/env bash
# Build a Docker image for every microservice: shop/<service>:<tag>
# Usage: ./scripts/build-images.sh [tag]     (default tag: 1.0.0)
set -euo pipefail
TAG="${1:-1.0.0}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

for dir in "$ROOT"/services/*/; do
  name="$(basename "$dir")"
  echo "==> Building shop/$name:$TAG"
  docker build -t "shop/$name:$TAG" "$dir"
done

echo
docker images "shop/*"
