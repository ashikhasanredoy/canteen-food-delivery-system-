from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from typing import List
from backend import crud, schemas
from backend.database import get_db

# ══════════════════════════════════════════════════════════════════════════════
#  RATINGS & CUSTOMER REVIEWS ROUTER
# ══════════════════════════════════════════════════════════════════════════════

router = APIRouter(prefix="/ratings", tags=["ratings"])


@router.post("", response_model=schemas.RatingResponse)
def create_rating(rating: schemas.RatingCreate, db: Session = Depends(get_db)):
    """
    Submits a student's 1-5 star rating and written review for a purchased meal.
    
    Human Developer Logic:
    1. Verifies that the targeted food item exists in the database.
    2. Prevents review spam by checking if the student has already reviewed this dish.
    3. Commits the rating and returns the newly saved review object with timestamp.
    """
    # Verify the food dish actually exists
    food = crud.get_food(db, food_id=rating.food_id)
    if not food:
        raise HTTPException(status_code=404, detail="The food item being reviewed does not exist.")

    # Guard against duplicate reviews from the same student
    existing = crud.get_student_rating_for_food(db, food_id=rating.food_id, student_id=rating.student_id)
    if existing:
        raise HTTPException(
            status_code=400,
            detail="You have already submitted a rating for this food item. Thank you!"
        )

    try:
        return crud.create_rating(db, rating=rating)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="You have already submitted a rating for this food item.")


@router.get("/food/{food_id}", response_model=List[schemas.RatingResponse])
def get_ratings_for_food(food_id: int, db: Session = Depends(get_db)):
    """
    Fetches all student reviews and comments associated with a specific food item.
    """
    return crud.get_ratings_for_food(db, food_id=food_id)


@router.get("/food/{food_id}/stats")
def get_rating_stats(food_id: int, db: Session = Depends(get_db)):
    """
    Returns aggregated rating statistics (average score out of 5.0 and total rating count).
    Used by the buyer portal to render star badges on food cards.
    """
    return crud.get_rating_stats(db, food_id=food_id)
