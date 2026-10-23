# Shop Microservices — Node.js · Express · MongoDB (Mongoose) · Kafka · Docker · Kubernetes

An event-driven e-commerce backend split into 6 microservices. Each service has its own MongoDB
database. Services talk through an **API Gateway** (HTTP) and **Kafka** (events).

| Service | Port | Database | Responsibility |
|---|---|---|---|
| **api-gateway** | 8080 | – | Single entry point. Verifies JWT, rate limiting, routes `/api/*` to services |
| **user-service** | 3001 | `user_db` | Register, login, JWT issuing, profile, admin seeding |
| **product-service** *(extra)* | 3002 | `product_db` | Product catalog + inventory (atomic stock reservation) |
| **order-service** | 3003 | `order_db` | Order lifecycle, coordinates the order saga |
| **payment-service** | 3004 | `payment_db` | Charges orders (mock provider, swap for Stripe/crypto later) |
| **notification-service** | 3005 | `notification_db` | Emails (SMTP via Nodemailer) + in-app notifications |

Infrastructure: **MongoDB 7**, **Kafka 3.9 (KRaft, no Zookeeper)**, **Mailpit** (fake SMTP with a web inbox).

---

## 1. Architecture

```mermaid
flowchart LR
  Client([Client / Postman]) -->|HTTP + JWT| GW[api-gateway :8080]
  GW --> US[user-service]
  GW --> PS[product-service]
  GW --> OS[order-service]
  GW --> PAY[payment-service]
  GW --> NS[notification-service]
  OS -- "HTTP: reserve stock" --> PS

  US & OS & PAY -- publish --> K[(Kafka)]
  K -- consume --> PAY & OS & PS & NS
  NS -- SMTP --> MP[Mailpit]

  US --- DB1[(user_db)]
  PS --- DB2[(product_db)]
  OS --- DB3[(order_db)]
  PAY --- DB4[(payment_db)]
  NS --- DB5[(notification_db)]
```

### The order flow (Saga pattern)

```
1. POST /api/orders ──► order-service ──HTTP──► product-service: reserve stock (atomic, no overselling)
2. order-service saves order (PENDING) ──► Kafka: order.created
3. payment-service consumes order.created ──► charges ──► payment.completed | payment.failed
4a. payment.completed ──► order-service: PAID      ──► order.confirmed ──► product-service commits stock
4b. payment.failed    ──► order-service: CANCELLED ──► order.cancelled ──► product-service RELEASES stock
5. notification-service listens to user.registered / order.created / order.confirmed / order.cancelled
   ──► sends email + stores an in-app notification
```

Step 4b is the **compensating action**: there's no distributed transaction across databases, so a
failure is undone by another event.

### Kafka topics

| Topic | Producer | Consumers |
|---|---|---|
| `user.registered` | user-service | notification-service |
| `order.created` | order-service | payment-service, notification-service |
| `payment.completed` / `payment.failed` | payment-service | order-service |
| `order.confirmed` / `order.cancelled` | order-service | product-service, notification-service |
| `<topic>.dlq` | any consumer | dead-letter queue: messages that failed 3 times |

Every event has the same envelope: `{ eventId, type, source, occurredAt, data }`.
The message **key** is the `orderId`/`userId`, so all events of one order go to the same partition (kept in order).

### Design choices worth knowing

- **Database per service** — one MongoDB server, but each service owns its own database and nobody reads another service's DB.
- **Auth at the edge** — only the gateway verifies the JWT, then forwards `x-user-id`, `x-user-email`, `x-user-role`. It strips any client-sent `x-user-*` headers so nobody can fake them. Services aren't reachable from outside the cluster.
- **`/internal/*` routes** (like stock reservation) are never proxied by the gateway — service-to-service only.
- **Idempotent consumers** — Kafka delivers *at least once*, so duplicates are expected: payments have a unique `orderId`, notifications a unique `eventId`, order status changes are conditional (`status: 'PENDING'`).
- **Each service is self-contained** — `src/lib/` (db, kafka, logger, errors, auth) is copied into every service on purpose, so each one builds and deploys independently. In a monorepo you could publish it as a private npm package.

---

## 2. Folder structure

```
microservices/
├── docker-compose.yml          # run everything locally with Docker
├── k8s/
│   ├── 00-namespace.yaml       # Namespace "shop"
│   ├── 01-config.yaml          # ConfigMap (settings) + Secret (passwords, JWT secret)
│   ├── infra/                  # mongodb.yaml, kafka.yaml, mailpit.yaml
│   ├── services/               # one Deployment + Service per microservice
│   └── extras/hpa.yaml         # optional autoscaling
├── scripts/
│   ├── build-images.sh         # docker build all services
│   ├── k8s-deploy.sh           # apply manifests in the right order + wait
│   ├── k8s-teardown.sh         # delete everything
│   └── test-flow.mjs           # end-to-end test through the gateway
└── services/
    └── <service>/
        ├── Dockerfile
        ├── package.json / package-lock.json
        └── src/
            ├── index.js        # startup: DB -> Kafka -> HTTP server
            ├── config.js       # env vars
            ├── lib/            # db, kafka, logger, errors, auth, server (health + shutdown)
            ├── models/         # Mongoose schemas
            ├── routes/         # Express routes
            └── events/         # Kafka consumers
```

---

## 3. Prerequisites (Mac)

1. **Docker Desktop** installed and running.
2. Give it enough resources: *Settings → Resources* → at least **6 GB memory**, 4 CPUs (Kafka + Mongo + 11 pods).
3. **Enable Kubernetes**: *Settings → Kubernetes → Enable Kubernetes* → choose **kubeadm** (single node) → *Apply & restart*. Wait until the bottom-left shows Kubernetes running.
4. Check `kubectl` points at it:
   ```bash
   kubectl config use-context docker-desktop
   kubectl get nodes          # STATUS should be Ready
   ```
5. Node.js 22+ (only needed for the test script or running a service outside Docker).

> **Why kubeadm mode?** Docker Desktop's single-node kubeadm cluster shares Docker's image store, so images you `docker build` are usable by Kubernetes immediately — no registry needed. (If you pick the *kind* mode, you'd have to load images into the cluster first.)

---

## 4. Option A — Run with Docker Compose (quickest)

Good for developing and debugging before Kubernetes.

```bash
cd microservices
docker compose up --build -d      # build images + start everything
docker compose ps                 # all should be "Up"; mongodb & kafka "healthy"
curl http://localhost:8080/health/services
node scripts/test-flow.mjs        # full end-to-end test
```

- API Gateway → http://localhost:8080
- Email inbox (Mailpit) → http://localhost:8025
- MongoDB → `mongodb://root:rootpassword@localhost:27017/?authSource=admin` (open in Compass)
- Kafka from your Mac → `localhost:29092`

Logs: `docker compose logs -f order-service payment-service`
Stop: `docker compose down` (add `-v` to also delete DB/Kafka data).

> Stop Compose before using Kubernetes (`docker compose down`) — both use ports 8080 and 8025.

---

## 5. Option B — Run on Kubernetes (Docker Desktop)

### Step 1: Build the images
```bash
cd microservices
./scripts/build-images.sh         # builds shop/<service>:1.0.0 for all 6 services
```

### Step 2: Deploy
```bash
./scripts/k8s-deploy.sh
```
The script does, in order:
```bash
kubectl apply -f k8s/00-namespace.yaml      # create the "shop" namespace
kubectl apply -f k8s/01-config.yaml         # ConfigMap + Secret
kubectl apply -f k8s/infra/                 # MongoDB, Kafka, Mailpit
kubectl -n shop rollout status statefulset/mongodb   # wait until ready
kubectl -n shop rollout status statefulset/kafka
kubectl apply -f k8s/services/              # the 6 microservices
kubectl -n shop rollout status deployment/<each service>
```
First run takes 1–3 minutes (pulling Mongo/Kafka images, Kafka startup).

### Step 3: Check & test
```bash
kubectl -n shop get pods          # everything Running and READY 1/1
kubectl -n shop get svc           # api-gateway & mailpit-ui EXTERNAL-IP = localhost
curl http://localhost:8080/health/services
node scripts/test-flow.mjs
```
Open http://localhost:8025 to see the emails.

### Step 4: Clean up
```bash
./scripts/k8s-teardown.sh         # deletes the namespace (and the DB/Kafka volumes)
```

---

## 6. Kubernetes concepts used here (beginner guide)

Think of Kubernetes as: *"I describe the state I want in YAML; Kubernetes keeps making reality match it."*

| Concept | What it is | Where in this project |
|---|---|---|
| **Cluster / Node** | The machine(s) running containers. Docker Desktop = 1 node. | `kubectl get nodes` |
| **Pod** | Smallest unit: one (or a few) containers with an IP. Pods are disposable — they die and get replaced. | `kubectl -n shop get pods` |
| **Namespace** | A folder to group resources. | `00-namespace.yaml` → `shop` |
| **Deployment** | "Keep N identical pods of this image running." Replaces crashed pods, does rolling updates. | `k8s/services/*.yaml` |
| **ReplicaSet** | Created by a Deployment; actually counts the pods. You rarely touch it. | automatic |
| **Service** | A stable DNS name + virtual IP that load-balances to pods by label. Pods' IPs change; the Service name doesn't. | `http://order-service:3003` |
| **ClusterIP** | Service only reachable *inside* the cluster (default). | all microservices except gateway |
| **LoadBalancer** | Service exposed outside. Docker Desktop maps it to `localhost`. | `api-gateway` (8080), `mailpit-ui` (8025) |
| **ConfigMap** | Non-secret config → env vars. | `app-config` in `01-config.yaml` |
| **Secret** | Sensitive config (base64, not encrypted!). | `app-secrets` in `01-config.yaml` |
| **StatefulSet** | Like a Deployment but for stateful apps: stable names (`mongodb-0`) and a dedicated disk per pod. | `mongodb.yaml`, `kafka.yaml` |
| **PersistentVolumeClaim (PVC)** | A request for disk storage that outlives the pod. | `volumeClaimTemplates` → `kubectl -n shop get pvc` |
| **Headless Service** | `clusterIP: None` — DNS points directly at the pod(s). Used with StatefulSets. | `mongodb`, `kafka` |
| **Probes** | Health checks: **startup** (wait for slow boot), **readiness** (send traffic?), **liveness** (restart?). | `/health` and `/ready` in every service |
| **Resources** | `requests` = guaranteed CPU/RAM for scheduling; `limits` = hard cap (exceed memory → killed). | every container |
| **Labels / selectors** | Key-value tags; Services and Deployments find pods by `app: <name>`. | `labels: { app: order-service }` |
| **initContainer** | Runs to completion before the main container. | `kafka.yaml` fixes volume permissions |
| **HPA** | Auto-scales pod count on CPU. | `extras/hpa.yaml` (optional) |

How a request travels in Kubernetes:
```
curl localhost:8080 → Service api-gateway (LoadBalancer) → one of 2 gateway pods
  → http://order-service:3003 (cluster DNS) → Service → one of 2 order-service pods
  → mongodb:27017 → mongodb-0 pod → its PVC disk
```

How MongoDB credentials reach a pod (see any `k8s/services/*.yaml`):
```yaml
envFrom:
  - configMapRef: { name: app-config }            # gives MONGO_HOST=mongodb:27017, KAFKA_BROKERS, ...
env:
  - name: MONGO_USER
    valueFrom: { secretKeyRef: { name: app-secrets, key: MONGO_ROOT_USERNAME } }
  - name: MONGO_PASSWORD
    valueFrom: { secretKeyRef: { name: app-secrets, key: MONGO_ROOT_PASSWORD } }
  - name: MONGO_URI                                # $(VAR) uses variables defined above
    value: "mongodb://$(MONGO_USER):$(MONGO_PASSWORD)@$(MONGO_HOST)/order_db?authSource=admin"
```

---

## 7. API reference (through the gateway, `http://localhost:8080`)

| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/api/users/register` | public | `{ name, email, password }` → `{ user, token }` |
| POST | `/api/users/login` | public | `{ email, password }` → `{ user, token }` |
| GET / PATCH | `/api/users/me` | user | profile |
| GET | `/api/users` | admin | list users |
| GET | `/api/products?search=&page=&limit=` | public | |
| GET | `/api/products/:id` | public | |
| POST / PATCH / DELETE | `/api/products[/:id]` | admin | `{ name, sku, price, stock, description }` |
| POST | `/api/orders` | user | `{ items: [{ productId, quantity }] }` |
| GET | `/api/orders`, `/api/orders/:id` | user | admin: `?all=true` |
| GET | `/api/payments`, `/api/payments/order/:orderId` | user | |
| GET | `/api/notifications?unread=true` | user | |
| PATCH | `/api/notifications/:id/read`, `/api/notifications/read-all` | user | |
| GET | `/health/services` | public | status of every service |

Seeded data: admin **`admin@shop.local` / `Admin@123`** and 4 sample products. The *Gaming Laptop* ($6500)
is above the mock card limit (`PAYMENT_MAX_AMOUNT=5000`), so ordering it demonstrates the failure + stock release path.

Quick curl session:
```bash
TOKEN=$(curl -s -X POST localhost:8080/api/users/register \
  -H 'Content-Type: application/json' \
  -d '{"name":"John","email":"john@example.com","password":"Secret@123"}' | node -pe 'JSON.parse(require("fs").readFileSync(0)).token')

curl -s localhost:8080/api/products                       # copy a product _id

curl -s -X POST localhost:8080/api/orders -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' -d '{"items":[{"productId":"<id>","quantity":1}]}'

sleep 2 && curl -s localhost:8080/api/orders -H "Authorization: Bearer $TOKEN"   # status: PAID
curl -s localhost:8080/api/notifications -H "Authorization: Bearer $TOKEN"
```

---

## 8. Everyday kubectl commands

```bash
# Tip: stop typing "-n shop" every time
kubectl config set-context --current --namespace=shop

kubectl get pods -o wide                       # pods + which node + IP
kubectl get all                                # deployments, services, pods, statefulsets
kubectl describe pod <pod-name>                # events: why is it Pending / CrashLoopBackOff?
kubectl logs -f deployment/order-service       # follow logs (one pod)
kubectl logs -l app=order-service --tail=50    # logs from ALL pods of a service
kubectl exec -it deploy/order-service -- sh    # shell inside a container

# Scaling
kubectl scale deployment payment-service --replicas=3
kubectl get pods -l app=payment-service -w     # watch new pods appear
# Kafka spreads the 3 partitions across the 3 consumers in the "payment-service" group.

# Self-healing demo: delete a pod and watch the Deployment replace it
kubectl delete pod -l app=user-service --wait=false && kubectl get pods -w

# Rolling update to a new version
docker build -t shop/order-service:1.0.1 services/order-service
kubectl set image deployment/order-service order-service=shop/order-service:1.0.1
kubectl rollout status deployment/order-service
kubectl rollout undo deployment/order-service  # rollback

# After changing ConfigMap/Secret, restart pods so they read new env vars
kubectl apply -f k8s/01-config.yaml && kubectl rollout restart deployment

# MongoDB from your Mac (Compass / mongosh): mongodb://root:rootpassword@localhost:27018/?authSource=admin&directConnection=true
kubectl port-forward statefulset/mongodb 27018:27017

# Kafka: list topics & see consumer lag
kubectl exec -it kafka-0 -- /opt/kafka/bin/kafka-topics.sh --bootstrap-server localhost:9092 --list
kubectl exec -it kafka-0 -- /opt/kafka/bin/kafka-consumer-groups.sh --bootstrap-server localhost:9092 --describe --all-groups
# Read events from a topic
kubectl exec -it kafka-0 -- /opt/kafka/bin/kafka-console-consumer.sh --bootstrap-server localhost:9092 --topic order.created --from-beginning
```

---

## 9. Running one service on your Mac (development)

Run infra in Docker and the service with `node --watch`:
```bash
docker compose up -d mongodb kafka mailpit
cd services/order-service && npm install
MONGO_URI="mongodb://root:rootpassword@localhost:27017/order_db?authSource=admin" \
KAFKA_BROKERS=localhost:29092 SERVICE_NAME=order-service npm run dev
```

---

## 10. Troubleshooting

| Symptom | Cause / fix |
|---|---|
| Pod `ErrImagePull` / `ImagePullBackOff` for `shop/*` | Images not built, or Kubernetes isn't sharing Docker's images. Run `./scripts/build-images.sh`; use Docker Desktop's **kubeadm** cluster. |
| Pod stuck `Pending` | Not enough memory → raise Docker Desktop memory. `kubectl describe pod <name>` shows the reason. |
| Services `0/1 READY` for ~1 min after deploy | Normal: they wait for Kafka/Mongo (startupProbe allows 150s). Check `kubectl logs`. |
| `CrashLoopBackOff` on a service | `kubectl logs <pod> --previous` — usually Mongo credentials or Kafka not reachable. |
| `localhost:8080` not responding on K8s | `kubectl get svc api-gateway` — EXTERNAL-IP must be `localhost`. Make sure Compose is stopped (port clash). Or `kubectl port-forward svc/api-gateway 8080:8080`. |
| Order stays `PENDING` | payment-service not consuming: `kubectl logs -l app=payment-service`. |
| Reset all data | `./scripts/k8s-teardown.sh` then deploy again (Compose: `docker compose down -v`). |

---

## 11. Going to production (next steps)

- Push images to a registry (ECR / GHCR) and set `imagePullPolicy: Always` with immutable tags; build them in your CI/CD pipeline.
- MongoDB: use **Atlas** or a 3-node replica set (operator); Kafka: **MSK / Confluent Cloud** or the **Strimzi** operator with 3 brokers and replication factor 3.
- Secrets: External Secrets / Sealed Secrets / AWS Secrets Manager instead of plain YAML.
- Ingress (NGINX/ALB) + TLS (cert-manager) in front of the gateway instead of a LoadBalancer per service.
- Observability: Prometheus + Grafana, centralized logs (Loki/ELK), tracing (OpenTelemetry) using the `x-request-id` header.
- Transactional outbox pattern so "save to Mongo" and "publish to Kafka" can never get out of sync.
- Swap the mock payment provider in `payment-service/src/services/gateway.js` for a real one.
