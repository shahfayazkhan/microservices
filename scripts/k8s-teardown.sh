#!/usr/bin/env bash
# Remove everything (including MongoDB/Kafka data volumes) from the cluster.
set -euo pipefail
kubectl delete namespace shop --ignore-not-found
echo "Namespace 'shop' deleted."
