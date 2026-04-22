# 🛍️ ThreadShop — Microservices Fashion Store

Proyecto académico: clúster de microservicios con Kubernetes (DOKS) y CI/CD automatizado con GitHub Actions.

## Arquitectura

```
                        ┌─────────────────────────────────────┐
                        │         GitHub Actions CI/CD         │
                        │  push → build → push → deploy        │
                        └──────────────┬──────────────────────┘
                                       │
                        ┌──────────────▼──────────────────────┐
                        │   DigitalOcean Container Registry    │
                        │   (imágenes Docker de cada servicio) │
                        └──────────────┬──────────────────────┘
                                       │
               ┌───────────────────────▼───────────────────────┐
               │           DOKS — Kubernetes Cluster            │
               │  namespace: threadshop                         │
               │                                                │
               │  ┌──────────┐  ┌──────────┐  ┌───────────┐  │
               │  │  Users   │  │ Catalog  │  │ Payments  │  │
               │  │ :3001    │  │ :3002    │  │ :3003     │  │
               │  └────┬─────┘  └────┬─────┘  └─────┬─────┘  │
               │       │             │               │         │
               │  ┌────▼─────┐  ┌───▼──────┐  ┌────▼─────┐  │
               │  │PostgreSQL│  │ MongoDB  │  │PostgreSQL│  │
               │  └──────────┘  └──────────┘  └──────────┘  │
               │                                                │
               │  ┌─────────────────────────────────────────┐  │
               │  │   Frontend (nginx) — LoadBalancer :80   │  │
               │  └─────────────────────────────────────────┘  │
               └────────────────────────────────────────────────┘
```

## Estructura del proyecto

```
threadshop/
├── services/
│   ├── users-service/      # Node.js + PostgreSQL — Auth, JWT
│   ├── catalog-service/    # Node.js + MongoDB   — Productos
│   └── payments-service/   # Node.js + PostgreSQL — Órdenes, carrito
├── frontend/               # HTML/CSS/JS + nginx
├── k8s/                    # Manifiestos Kubernetes
├── helm/threadshop/        # Helm chart
├── .github/workflows/      # CI/CD con GitHub Actions
└── docker-compose.yml      # Desarrollo local
```

---

## PASO 1 — Correrlo localmente

### Requisitos previos
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) instalado

### Comandos

```bash
# 1. Clonar el repositorio
git clone https://github.com/TU_USUARIO/threadshop.git
cd threadshop

# 2. Levantar todos los servicios
docker compose up --build

# 3. Abrir en el navegador
# Frontend:  http://localhost
# Users API: http://localhost:3001/health
# Catalog:   http://localhost:3002/health
# Payments:  http://localhost:3003/health

# 4. Para detener
docker compose down
```

---

## PASO 2 — Subir a GitHub

```bash
# Dentro de la carpeta threadshop:
git init
git add .
git commit -m "feat: initial ThreadShop microservices project"

# Crear repo en github.com (sin inicializar README)
# Luego conectar:
git remote add origin https://github.com/TU_USUARIO/threadshop.git
git branch -M main
git push -u origin main
```

---

## PASO 3 — Configurar DigitalOcean

### 3.1 Crear cuenta y obtener créditos
1. Ir a [digitalocean.com](https://www.digitalocean.com) → Create Account
2. Verificar tarjeta (no se cobra, solo verificación)
3. Aplicar código de crédito si tienes uno

### 3.2 Instalar doctl (CLI de DigitalOcean)

**macOS:**
```bash
brew install doctl
```

**Windows:**
```powershell
winget install DigitalOcean.doctl
```

**Linux:**
```bash
sudo snap install doctl
```

### 3.3 Autenticarse con doctl

```bash
# 1. Generar API token en: digitalocean.com → API → Generate New Token
#    (Permisos: Read + Write)

# 2. Autenticarse
doctl auth init
# Pegar el token cuando lo pida
```

### 3.4 Crear Container Registry (DOCR)

```bash
doctl registry create threadshop-registry --subscription-tier starter
# Nota el nombre: registry.digitalocean.com/threadshop-registry
```

### 3.5 Crear cluster de Kubernetes (DOKS)

```bash
doctl kubernetes cluster create threadshop-cluster \
  --region nyc1 \
  --node-pool "name=main;size=s-2vcpu-4gb;count=2" \
  --wait

# Esto tarda ~5 minutos. Al terminar, configura kubectl automáticamente.
```

### 3.6 Conectar DOKS con DOCR

```bash
doctl kubernetes cluster registry add threadshop-cluster
```

### 3.7 Crear bases de datos administradas

**PostgreSQL para Users:**
```bash
doctl databases create threadshop-users-db \
  --engine pg --num-nodes 1 --size db-s-1vcpu-1gb --region nyc1
```

**PostgreSQL para Payments:**
```bash
doctl databases create threadshop-payments-db \
  --engine pg --num-nodes 1 --size db-s-1vcpu-1gb --region nyc1
```

**MongoDB para Catalog:**
```bash
doctl databases create threadshop-catalog-db \
  --engine mongodb --num-nodes 1 --size db-s-1vcpu-1gb --region nyc1
```

> Guarda las **connection strings** de cada base de datos. Las necesitarás en el siguiente paso.
> Las encuentras en: DigitalOcean Dashboard → Databases → tu DB → Connection Details → URI

---

## PASO 4 — Configurar GitHub Secrets

En tu repo de GitHub: **Settings → Secrets and variables → Actions → New repository secret**

| Secret | Valor |
|--------|-------|
| `DO_ACCESS_TOKEN` | Tu API token de DigitalOcean |
| `DO_REGISTRY_NAME` | `threadshop-registry` |
| `DO_CLUSTER_NAME` | `threadshop-cluster` |
| `USERS_DB_URL` | Connection string de PostgreSQL users |
| `PAYMENTS_DB_URL` | Connection string de PostgreSQL payments |
| `MONGO_URI` | Connection string de MongoDB |
| `JWT_SECRET` | Una cadena secreta larga, ej: `mi-super-secreto-threadshop-2025` |

---

## PASO 5 — Desplegar con CI/CD

```bash
# Actualizar el registry en el código
# En helm/threadshop/values.yaml, cambia:
#   global.registry: registry.digitalocean.com/threadshop-registry

# Hacer push a main activa el pipeline automáticamente
git add .
git commit -m "feat: configure registry for production"
git push origin main

# Ver el pipeline en: github.com/TU_USUARIO/threadshop → Actions
```

El pipeline automáticamente:
1. Construye las 4 imágenes Docker
2. Las sube a DOCR
3. Despliega en DOKS con Helm
4. Verifica que los pods estén corriendo

---

## PASO 6 — Ver la app en producción

```bash
# Ver los pods corriendo
kubectl get pods -n threadshop

# Obtener la IP pública del frontend
kubectl get service frontend -n threadshop
# Busca la columna EXTERNAL-IP, espera ~2 min hasta que aparezca

# Abrir en el navegador:
# http://EXTERNAL-IP
```

---

## Comandos útiles

```bash
# Ver logs de un servicio
kubectl logs -f deployment/users-service -n threadshop
kubectl logs -f deployment/catalog-service -n threadshop

# Ver todos los recursos
kubectl get all -n threadshop

# Forzar redeploy sin cambiar código
kubectl rollout restart deployment/users-service -n threadshop

# Escalar un servicio
kubectl scale deployment catalog-service --replicas=3 -n threadshop

# Eliminar todo (¡cuidado!)
helm uninstall threadshop -n threadshop
```

---

## Endpoints de la API

### Users Service (puerto 3001)
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/health` | Health check |
| POST | `/api/users/register` | Registro de usuario |
| POST | `/api/users/login` | Login |
| GET | `/api/users/profile` | Perfil (requiere JWT) |

### Catalog Service (puerto 3002)
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/health` | Health check |
| GET | `/api/catalog/products` | Listar productos |
| GET | `/api/catalog/products/:id` | Producto por ID |
| POST | `/api/catalog/products` | Crear producto |

### Payments Service (puerto 3003)
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/health` | Health check |
| GET | `/api/payments/cart/:userId` | Ver carrito |
| POST | `/api/payments/cart` | Agregar al carrito |
| DELETE | `/api/payments/cart/:userId/:itemId` | Eliminar del carrito |
| POST | `/api/payments/checkout` | Procesar orden |
| GET | `/api/payments/orders/:userId` | Historial de órdenes |

---

## Mock de pagos

El servicio de pagos simula aprobación/rechazo:
- **Tarjeta que empieza con `4`** → Pago aprobado ✅ (ej: `4111111111111111`)
- **Cualquier otro número** → Pago rechazado ❌

---

## Tecnologías utilizadas

| Categoría | Tecnología |
|-----------|------------|
| Runtime | Node.js 18 |
| Framework | Express.js |
| Bases de datos | PostgreSQL, MongoDB |
| Contenedores | Docker |
| Orquestación | Kubernetes (DOKS) |
| Package manager K8s | Helm |
| Registry | DigitalOcean Container Registry |
| CI/CD | GitHub Actions |
| Frontend | HTML/CSS/JS + nginx |
