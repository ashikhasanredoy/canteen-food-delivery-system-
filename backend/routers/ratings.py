from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from typing import List
from backend import crud, schemas
from backend.database import get_db

router = APIRouter(prefix="/ratings", tags=["ratings"])

@router.post("", response_model=schemas.RatingResponse)
def create_rating(rating: schemas.RatingCreate, db: Session = Depends(get_db)):
    # Check food exists
    food = crud.get_food(db, food_id=rating.food_id)
    if not food:
        raise HTTPException(status_code=404, detail="Food not found")

    # Check if already rated
    existing = crud.get_student_rating_for_food(db, food_id=rating.food_id, student_id=rating.student_id)
    if existing:
        raise HTTPException(status_code=400, detail="You have already rated this food item")

    try:
        return crud.create_rating(db, rating=rating)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="You have already rated this food item")

@router.get("/food/{food_id}", response_model=List[schemas.RatingResponse])
def get_ratings_for_food(food_id: int, db: Session = Depends(get_db)):
    return crud.get_ratings_for_food(db, food_id=food_id)

@router.get("/food/{food_id}/stats")
def get_rating_stats(food_id: int, db: Session = Depends(get_db)):
    return crud.get_rating_stats(db, food_id=food_id)
