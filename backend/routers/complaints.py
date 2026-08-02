from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from typing import List
from backend import models, schemas
from backend.database import get_db
import os
import shutil
import uuid

router = APIRouter(prefix="/complaints", tags=["complaints"])


def _log(db, category, action, summary, detail=None):
    try:
        db.add(models.ActivityLog(category=category, action=action, summary=summary, detail=detail))
        db.commit()
    except Exception:
        db.rollback()


@router.post("/upload-image")
def upload_complaint_image(file: UploadFile = File(...)):
    BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    upload_dir = os.path.join(BASE_DIR, "frontend", "static", "images", "complaints")
    os.makedirs(upload_dir, exist_ok=True)

    file_extension = os.path.splitext(file.filename or "")[1].lower()
    allowed = {".jpg", ".jpeg", ".png", ".gif", ".webp"}
    if file_extension not in allowed:
        raise HTTPException(status_code=400, detail="Only image files are allowed (jpg, png, gif, webp)")

    unique_filename = f"{uuid.uuid4()}{file_extension}"
    file_path = os.path.join(upload_dir, unique_filename)

    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception:
        raise HTTPException(status_code=500, detail="Could not save uploaded image file.")

    return {"image_url": f"/static/images/complaints/{unique_filename}"}


@router.post("", response_model=schemas.ComplaintResponse)
def create_complaint(complaint: schemas.ComplaintCreate, db: Session = Depends(get_db)):
    db_complaint = models.Complaint(**complaint.model_dump())
    db.add(db_complaint)
    db.commit()
    db.refresh(db_complaint)

    role_label = {"buyer": "Buyer", "seller": "Seller", "delivery": "Delivery Boy"}.get(
        complaint.role, complaint.role
    )
    _log(
        db,
        "complaint",
        "submitted",
        f"New complaint from {role_label} — {complaint.name}",
        detail=f"shop={complaint.shop_name or 'N/A'}; {complaint.message[:180]}",
    )

    return db_complaint


@router.get("", response_model=List[schemas.ComplaintResponse])
def list_complaints(skip: int = 0, limit: int = 200, db: Session = Depends(get_db)):
    return (
        db.query(models.Complaint)
        .order_by(models.Complaint.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )
