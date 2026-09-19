from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from typing import List, Optional
from backend import crud, schemas, models
from backend.database import get_db
import os
import shutil
import uuid

router = APIRouter(prefix="/foods", tags=["foods"])

def _log(db, category, action, summary, detail=None):
    try:
        db.add(models.ActivityLog(category=category, action=action, summary=summary, detail=detail))
        db.commit()
    except Exception:
        db.rollback()

@router.post("/upload-image")
def upload_food_image(file: UploadFile = File(...)):
    BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    upload_dir = os.path.join(BASE_DIR, "frontend", "static", "images", "foods")
    os.makedirs(upload_dir, exist_ok=True)

    file_extension = os.path.splitext(file.filename)[1]
    unique_filename = f"{uuid.uuid4()}{file_extension}"
    file_path = os.path.join(upload_dir, unique_filename)

    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception:
        raise HTTPException(status_code=500, detail="Could not save uploaded image file.")

    return {"image_url": f"/static/images/foods/{unique_filename}"}

def _attach_ratings(food, db: Session) -> dict:
    stats = crud.get_rating_stats(db, food.id)
    food_dict = {c.name: getattr(food, c.name) for c in food.__table__.columns}
    food_dict["avg_rating"] = stats["avg_rating"]
    food_dict["rating_count"] = stats["rating_count"]
    return food_dict

@router.get("", response_model=List[schemas.FoodResponse])
def read_foods(shop_name: Optional[str] = None, skip: int = 0, limit: int = 1000, db: Session = Depends(get_db)):
    if shop_name:
        foods = db.query(models.Food).filter(models.Food.shop_name == shop_name).offset(skip).limit(limit).all()
    else:
        foods = crud.get_foods(db, skip=skip, limit=limit)
    return [_attach_ratings(f, db) for f in foods]

@router.get("/{food_id}", response_model=schemas.FoodResponse)
def read_food(food_id: int, db: Session = Depends(get_db)):
    food = crud.get_food(db, food_id=food_id)
    if food is None:
        raise HTTPException(status_code=404, detail="Food not found")
    return _attach_ratings(food, db)

@router.post("", response_model=schemas.FoodResponse)
def create_food(food: schemas.FoodCreate, db: Session = Depends(get_db)):
    new_food = crud.create_food(db, food=food)
    _log(db, "food", "added",
         f"Food '{food.food_name}' added by {food.shop_name}",
         detail=f"price=${food.price}, qty={food.quantity}")
    return _attach_ratings(new_food, db)

@router.put("/{food_id}", response_model=schemas.FoodResponse)
def update_food(food_id: int, food: schemas.FoodUpdate, db: Session = Depends(get_db)):
    db_food = crud.update_food(db, food_id=food_id, food_update=food)
    if db_food is None:
        raise HTTPException(status_code=404, detail="Food not found")
    return _attach_ratings(db_food, db)

@router.delete("/{food_id}")
def delete_food(food_id: int, db: Session = Depends(get_db)):
    db_food = crud.get_food(db, food_id=food_id)
    if db_food is None:
        raise HTTPException(status_code=404, detail="Food not found")
    name, shop = db_food.food_name, db_food.shop_name
    result = crud.delete_food(db, food_id=food_id)
    if result is None:
        raise HTTPException(status_code=404, detail="Food not found")
    _log(db, "food", "deleted",
         f"Food '{name}' removed by seller ({shop})",
         detail=f"food_id={food_id}")
    return {"detail": "Food deleted"}

