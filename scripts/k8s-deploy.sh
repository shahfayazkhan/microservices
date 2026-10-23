#!/usr/bin/env bash
# Deploy everything to the current kubectl context (Docker Desktop Kubernetes).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
K8S="$ROOT/k8s"

echo "==> Using context: $(kubectl config current-context)"

echo "==> 1/4 Namespace + config"
kubectl apply -f "$K8S/00-namespace.yaml"
kubectl apply -f "$K8S/01-config.yaml"

echo "==> 2/4 Infrastructure (MongoDB, Kafka, Mailpit)"
kubectl apply -f "$K8S/infra/"
kubectl -n shop rollout status statefulset/mongodb --timeout=300s
kubectl -n shop rollout status statefulset/kafka --timeout=300s
kubectl -n shop rollout status deployment/mailpit --timeout=120s

echo "==> 3/4 Microservices"
kubectl apply -f "$K8S/services/"

echo "==> 4/4 Waiting for rollouts"
for d in user-service product-service order-service payment-service notification-service api-gateway; do
  kubectl -n shop rollout status "deployment/$d" --timeout=300s
done

echo
kubectl -n shop get pods,svc
echo
echo "API Gateway : http://localhost:8080   (try: curl http://localhost:8080/health/services)"
echo "Mail inbox  : http://localhost:8025"
