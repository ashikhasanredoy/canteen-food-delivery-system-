from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from backend.database import engine, Base, run_migrations, seed_default_settings
from backend.routers import pages, foods, orders, delivery, ratings, shops, complaints
import os

from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

# Create database tables and run migrations
Base.metadata.create_all(bind=engine)
run_migrations()
seed_default_settings()

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


# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static files
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
STATIC_DIR = os.path.join(BASE_DIR, "frontend", "static")

# Ensure static dir exists (if empty git repo)
os.makedirs(STATIC_DIR, exist_ok=True)
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

# Include routers
app.include_router(pages.router)
app.include_router(foods.router)
app.include_router(orders.router)
app.include_router(delivery.router)
app.include_router(ratings.router)
app.include_router(shops.router)
app.include_router(complaints.router)

# Mount admin app under the root so /admin routes are served on port 8000 as well
from backend.admin_app import admin_app
app.mount("/", admin_app)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.main:app", host="127.0.0.1", port=8000, reload=True)
