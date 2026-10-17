import sys
import asyncio

if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

import importlib.util
import time
from pathlib import Path
from contextlib import asynccontextmanager
from fastapi import FastAPI

ROOT = Path(__file__).resolve().parents[2]

def purge_local_modules():
    for name in list(sys.modules.keys()):
        # Remove local service modules from sys.modules cache
        # so that each service can import its local version of 'config', 'router', etc.
        if name in ("config", "router", "dependencies", "database", "models", "schemas", "service", "routes"):
            del sys.modules[name]
        elif name.startswith("routes.") or name.startswith("services."):
            del sys.modules[name]

def load_service(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module

def load_service_app(service_name, dir_name):
    service_dir = str(ROOT / "services" / dir_name)
    sys.path.insert(0, service_dir)
    purge_local_modules()
    try:
        module = load_service(service_name, str(ROOT / "services" / dir_name / "main.py"))
        return module.app
    finally:
        if service_dir in sys.path:
            sys.path.remove(service_dir)

# Load each app individually in its own sys.path environment
domain_app = load_service_app("domain_main", "domain-service")
ingestion_app = load_service_app("ingestion_main", "ingestion-service")
retrieval_app = load_service_app("retrieval_main", "retrieval-service")
generation_app = load_service_app("generation_main", "generation-service")
evaluation_app = load_service_app("evaluation_main", "evaluation-service")

@asynccontextmanager
async def monolith_lifespan(app: FastAPI):
    # --- STARTUP ---
    print("\n[Monolith] Starting services lifespan...", flush=True)
    app.state.models_ready = True
    
    # 1. Domain Startup
    sys.path.insert(0, str(ROOT / "services" / "domain-service"))
    purge_local_modules()
    try:
        from database import init_db
        print("  [Domain] Initializing DB...", flush=True)
        await asyncio.wait_for(init_db(), timeout=1.5)
    except Exception as exc:
        print(f"  [Domain] Notice: DB init bypassed (connecting: {exc})", flush=True)
    finally:
        sys.path.remove(str(ROOT / "services" / "domain-service"))

    # 2. Ingestion Startup
    sys.path.insert(0, str(ROOT / "services" / "ingestion-service"))
    purge_local_modules()
    try:
        from storage import create_tables
        print("  [Ingestion] Creating tables...", flush=True)
        await asyncio.wait_for(create_tables(), timeout=1.5)
    except Exception as exc:
        print(f"  [Ingestion] Notice: tables creation bypassed (connecting: {exc})", flush=True)
    finally:
        sys.path.remove(str(ROOT / "services" / "ingestion-service"))

    # 3. Retrieval Startup
    sys.path.insert(0, str(ROOT / "services" / "retrieval-service"))
    purge_local_modules()
    try:
        from config import settings as ret_settings
        if ret_settings.RETRIEVAL_WARMUP_ON_START:
            from services.embedding import get_embedding_service
            if ret_settings.WARMUP_EMBEDDING:
                print("  [Retrieval] Loading embedding model...", flush=True)
                try:
                    await asyncio.wait_for(get_embedding_service().warmup(), timeout=2.0)
                except Exception as e:
                    print(f"  [Retrieval] Embedding warmup bypassed: {e}", flush=True)
    except Exception as e:
        print(f"  [Retrieval] Warmup skipped: {e}", flush=True)
    finally:
        sys.path.remove(str(ROOT / "services" / "retrieval-service"))

    # 4. Generation Startup
    sys.path.insert(0, str(ROOT / "services" / "generation-service"))
    purge_local_modules()
    try:
        from router import ensure_query_log_table
        print("  [Generation] Ensuring query log tables...", flush=True)
        await asyncio.wait_for(ensure_query_log_table(), timeout=1.5)
    except Exception as exc:
        print(f"  [Generation] Notice: query log table check bypassed: {exc}", flush=True)
    finally:
        sys.path.remove(str(ROOT / "services" / "generation-service"))

    # 5. Evaluation Startup
    sys.path.insert(0, str(ROOT / "services" / "evaluation-service"))
    purge_local_modules()
    try:
        from db.queries import ensure_tables_exist
        print("  [Evaluation] Bootstrapping tables...", flush=True)
        await asyncio.wait_for(asyncio.to_thread(ensure_tables_exist), timeout=1.5)
    except Exception as exc:
        print(f"  [Evaluation] Notice: bootstrap tables bypassed: {exc}", flush=True)
    finally:
        sys.path.remove(str(ROOT / "services" / "evaluation-service"))

    app.state.models_ready = True
    print("[Monolith] Startup complete.\n", flush=True)
    yield

    # --- SHUTDOWN ---
    print("\n[Monolith] Shutting down services lifespan...")

    # 1. Retrieval Shutdown
    sys.path.insert(0, str(ROOT / "services" / "retrieval-service"))
    purge_local_modules()
    try:
        from services.bm25_search import get_bm25_search_service
        from services.cache import get_retrieval_cache
        from services.qdrant_search import get_qdrant_search_service
        await get_retrieval_cache().close()
        await get_bm25_search_service().close()
        await get_qdrant_search_service().close()
    except Exception:
        pass
    finally:
        sys.path.remove(str(ROOT / "services" / "retrieval-service"))

    # 2. Generation Shutdown
    sys.path.insert(0, str(ROOT / "services" / "generation-service"))
    purge_local_modules()
    try:
        from router import close_router_resources as close_gen_resources
        await close_gen_resources()
    except Exception:
        pass
    finally:
        sys.path.remove(str(ROOT / "services" / "generation-service"))

    # 3. Evaluation Shutdown
    sys.path.insert(0, str(ROOT / "services" / "evaluation-service"))
    purge_local_modules()
    try:
        from router import close_router_resources as close_eval_resources
        await close_eval_resources()
    except Exception:
        pass
    finally:
        sys.path.remove(str(ROOT / "services" / "evaluation-service"))

    # 4. Domain Shutdown
    sys.path.insert(0, str(ROOT / "services" / "domain-service"))
    purge_local_modules()
    try:
        from database import dispose_engine
        await dispose_engine()
    except Exception:
        pass
    finally:
        sys.path.remove(str(ROOT / "services" / "domain-service"))

    print("[Monolith] Shutdown complete.\n")

# Main Monolith FastAPI App
app = FastAPI(
    title="RAG System Monolith Gateway",
    description="Unified API gateway hosting all RAG services on a single process.",
    version="1.0.0",
    lifespan=monolith_lifespan,
)

# Merge all routes from loaded sub-apps
for sub_app in [domain_app, ingestion_app, retrieval_app, generation_app, evaluation_app]:
    for route in sub_app.routes:
        # Exclude default OpenAPI and health routes of each sub-app to prevent collision
        path = getattr(route, "path", None)
        if path in ("/openapi.json", "/docs", "/redoc", "/health", "/metrics"):
            continue
        app.routes.append(route)

# Setup unified metrics
sys.path.insert(0, str(ROOT / "services" / "evaluation-service"))
purge_local_modules()
try:
    from metrics import setup_metrics
    setup_metrics(app)
except Exception as exc:
    print(f"  [Metrics] Setup failed: {exc}")
finally:
    sys.path.remove(str(ROOT / "services" / "evaluation-service"))

@app.get("/", tags=["health"])
async def root():
    return {"name": "FixedRAG Monolith Gateway", "status": "ok", "docs": "/docs"}

@app.get("/health", tags=["health"])
async def root_health():
    status = "ok"
    if hasattr(app.state, "models_ready") and not app.state.models_ready:
        status = "warming_up"
    return {"status": status, "service": "monolith-service"}
