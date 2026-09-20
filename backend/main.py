import sys
import os

# Ensure the repository root directory is in sys.path
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from backend.database import engine, Base, run_migrations, seed_default_settings
from backend.routers import pages, foods, orders, delivery, ratings, shops, complaints

from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

# Create database tables and run migrations
try:
    Base.metadata.create_all(bind=engine)
    run_migrations()
    seed_default_settings()
except Exception as e:
    print(f"[BOOTSTRAP NOTICE] Database init: {e}")

app = FastAPI(title="University Canteen Food Delivery System")

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request, exc):
    errors = exc.errors()
    if errors:
        error = errors[0]
        field = error.get("loc", ["field"])[-1]
        msg = error.get("msg", "Invalid value")
        # Clean up common messages
        if "pattern" in msg:
            msg = "must be between 9 and 11 digits"
        detail = f"Invalid {field}: {msg}"
    else:
        detail = "Validation Error"
    return JSONResponse(status_code=400, content={"detail": detail})


import traceback
from fastapi import Request
from fastapi.responses import HTMLResponse

@app.exception_handler(Exception)
async def global_unhandled_exception_handler(request: Request, exc: Exception):
    err_tb = "".join(traceback.format_exception(type(exc), exc, exc.__traceback__))
    print(f"[UNHANDLED EXCEPTION on {request.url.path}]:\n{err_tb}")
    return HTMLResponse(
        status_code=500,
        content=f"""<!DOCTYPE html>
<html>
<head><title>500 Internal Error</title></head>
<body style="font-family: sans-serif; background: #0f172a; color: #f87171; padding: 30px;">
    <h2>⚠️ Server Error on {request.url.path}</h2>
    <p style="color: #cbd5e1;">A runtime exception occurred while processing this request:</p>
    <pre style="background: #1e293b; color: #38bdf8; padding: 20px; border-radius: 8px; overflow: auto; font-size: 13px; line-height: 1.5;">{err_tb}</pre>
</body>
</html>"""
    )


# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Security Shield Middleware (Rate Limiting, Scanner Defense, Payload Limiting, Headers)
from backend.security import SecurityShieldMiddleware
app.add_middleware(SecurityShieldMiddleware)

# Mount static files with robust path resolution
def _find_static_dir():
    candidates = [
        os.path.join(PROJECT_ROOT, "frontend", "static"),
        os.path.join(os.getcwd(), "frontend", "static"),
        os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "frontend", "static"),
        os.path.abspath("frontend/static"),
    ]
    for p in candidates:
        if os.path.exists(p):
            return p
    for root, dirs, _ in os.walk(os.getcwd()):
        if os.path.basename(root) == "static" and "frontend" in root:
            return root
    return candidates[0]

STATIC_DIR = _find_static_dir()

try:
    os.makedirs(STATIC_DIR, exist_ok=True)
except Exception:
    pass

if os.path.exists(STATIC_DIR):
    app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

# Include routers
app.include_router(pages.router)
app.include_router(foods.router)
app.include_router(orders.router)
app.include_router(delivery.router)
app.include_router(ratings.router)
app.include_router(shops.router)
app.include_router(complaints.router)

from starlette.middleware.sessions import SessionMiddleware
from backend.config import ADMIN_SESSION_SECRET

# Add Session Middleware for Admin authentication
app.add_middleware(SessionMiddleware, secret_key=ADMIN_SESSION_SECRET)

# Include admin routes
from backend.admin_app import admin_app
app.include_router(admin_app.router)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.main:app", host="127.0.0.1", port=8000, reload=True)
