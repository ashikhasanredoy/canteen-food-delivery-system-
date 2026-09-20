from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from typing import List, Optional
from backend import crud, schemas, models
from backend.database import get_db
import os
import shutil
import uuid

# ══════════════════════════════════════════════════════════════════════════════
#  FOOD DISHES & MENU MANAGEMENT ROUTER
# ══════════════════════════════════════════════════════════════════════════════

router = APIRouter(prefix="/foods", tags=["foods"])


def _log(db: Session, category: str, action: str, summary: str, detail: str = None):
    """
    Helper function to record food inventory changes in the activity audit log.
    Silently rolls back on error so catalog browsing and dish updates are never blocked.
    """
    try:
        db.add(models.ActivityLog(category=category, action=action, summary=summary, detail=detail))
        db.commit()
    except Exception:
        db.rollback()


@router.post("/upload-image")
async def upload_food_image(file: UploadFile = File(...)):
    """
    Handles secure image uploads for food menu items created by canteen vendors.
    
    Security Defenses:
    - Verifies filename existence and checks extensions against a strict whitelist (.jpg, .jpeg, .png, .webp, .gif).
    - Enforces a 5MB maximum file size limit to prevent memory exhaustion / DoS attacks.
    - Uses UUID-based randomized filenames to avoid file collisions and path overwrite exploits.
    - Validates absolute path boundaries to prevent directory traversal attacks (../).
    """
    BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    upload_dir = os.path.abspath(os.path.join(BASE_DIR, "frontend", "static", "images", "foods"))
    os.makedirs(upload_dir, exist_ok=True)

    if not file.filename:
        raise HTTPException(status_code=400, detail="No file was attached to the request.")

    # Validate file extension
    file_extension = os.path.splitext(file.filename)[1].lower()
    allowed_extensions = {".jpg", ".jpeg", ".png", ".webp", ".gif"}
    if file_extension not in allowed_extensions:
        raise HTTPException(status_code=400, detail="Only image files are allowed (.jpg, .jpeg, .png, .webp, .gif)")

    # Read bytes and check size ceiling (5MB)
    contents = await file.read()
    if len(contents) > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Image file size exceeds the 5MB maximum limit.")

    unique_filename = f"{uuid.uuid4()}{file_extension}"
    file_path = os.path.abspath(os.path.join(upload_dir, unique_filename))

    # Path traversal check
    if not file_path.startswith(upload_dir):
        raise HTTPException(status_code=400, detail="Invalid destination file path.")

    try:
        with open(file_path, "wb") as buffer:
            buffer.write(contents)
    except Exception:
        raise HTTPException(status_code=500, detail="Could not write uploaded image to disk.")

    return {"image_url": f"/static/images/foods/{unique_filename}"}


def _attach_ratings(food: models.Food, db: Session) -> dict:
    """
    Helper function that attaches calculated average star ratings and total review counts
    to a Food model dictionary before sending it to the client.
    """
    stats = crud.get_rating_stats(db, food.id)
    food_dict = {c.name: getattr(food, c.name) for c in food.__table__.columns}
    food_dict["avg_rating"] = stats["avg_rating"]
    food_dict["rating_count"] = stats["rating_count"]
    return food_dict


@router.get("", response_model=List[schemas.FoodResponse])
def read_foods(shop_name: Optional[str] = None, skip: int = 0, limit: int = 1000, db: Session = Depends(get_db)):
    """
    Returns food items for customer browsing and seller inventory views.
    Supports optional shop_name filtering for shop-specific menus.
    """
    if shop_name:
        foods = db.query(models.Food).filter(models.Food.shop_name == shop_name).offset(skip).limit(limit).all()
    else:
        foods = crud.get_foods(db, skip=skip, limit=limit)
    return [_attach_ratings(f, db) for f in foods]


@router.get("/{food_id}", response_model=schemas.FoodResponse)
def read_food(food_id: int, db: Session = Depends(get_db)):
    """
    Returns single food item details and its aggregated rating stats by Food ID.
    """
    food = crud.get_food(db, food_id=food_id)
    if food is None:
        raise HTTPException(status_code=404, detail="Food item not found.")
    return _attach_ratings(food, db)


@router.post("", response_model=schemas.FoodResponse)
def create_food(food: schemas.FoodCreate, db: Session = Depends(get_db)):
    """
    Creates a new dish entry under a canteen merchant's catalog and records an audit log.
    """
    new_food = crud.create_food(db, food=food)
    _log(
        db,
        "food",
        "added",
        f"Food '{food.food_name}' added by {food.shop_name}",
        detail=f"price=৳{food.price}, qty={food.quantity}"
    )
    return _attach_ratings(new_food, db)


@router.put("/{food_id}", response_model=schemas.FoodResponse)
def update_food(food_id: int, food: schemas.FoodUpdate, db: Session = Depends(get_db)):
    """
    Updates price, stock count, description, image, or meal category for an existing dish.
    """
    db_food = crud.update_food(db, food_id=food_id, food_update=food)
    if db_food is None:
        raise HTTPException(status_code=404, detail="Food item not found.")
    return _attach_ratings(db_food, db)


@router.delete("/{food_id}")
def delete_food(food_id: int, db: Session = Depends(get_db)):
    """
    Deletes a dish from the food menu and records an audit log for administrative oversight.
    """
    db_food = crud.get_food(db, food_id=food_id)
    if db_food is None:
        raise HTTPException(status_code=404, detail="Food item not found.")
    name, shop = db_food.food_name, db_food.shop_name
    result = crud.delete_food(db, food_id=food_id)
    if result is None:
        raise HTTPException(status_code=404, detail="Food item not found.")
    _log(
        db,
        "food",
        "deleted",
        f"Food '{name}' removed by seller ({shop})",
        detail=f"food_id={food_id}"
    )
    return {"detail": "Food item successfully deleted."}
