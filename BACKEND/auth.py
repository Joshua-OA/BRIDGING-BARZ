import jwt
import time
import random
import secrets
import logging
from datetime import datetime, timedelta
from typing import Dict, Optional, List, Union
from fastapi import Depends, HTTPException, status, Security, Response, Form
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from pydantic import BaseModel
from passlib.context import CryptContext

from models import StudentUser, CounselorUser
from config import Config

# --- Password Hashing ---
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

# JWT settings
JWT_SECRET = "your-secret-key-change-in-production"  # Should be in Config class in real app
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION = 24  # hours

# Security setup for JWT tokens
security = HTTPBearer()

# Simple rate limiting in-memory storage
rate_limit_store: Dict[str, Dict[str, int]] = {}
# Limits: 5 requests per 10 seconds per user
RATE_LIMIT = 5
RATE_LIMIT_WINDOW = 10  # seconds

# List of animals for user ID generation
ANIMALS = [
    "DOG", "CAT", "LION", "TIGER", "ELEPHANT", "GIRAFFE", "ZEBRA", "MONKEY", 
    "PANDA", "KOALA", "PENGUIN", "DOLPHIN", "EAGLE", "HAWK", "OWL", "BEAR", 
    "WOLF", "FOX", "RABBIT", "DEER", "TURTLE", "SNAKE", "CROCODILE", "FROG"
]

# --- Authentication Models ---
class UserLogin(BaseModel):
    user_id: str
    password: str

class UserCreate(BaseModel):
    password: str

class CounselorCreate(BaseModel):
    password: str
    campus_id: str

class UserRegistration(BaseModel):
    password: str  # Only password is required now
    email: Optional[str] = None  # Keep email as optional

class TokenResponse(BaseModel):
    access_token: str
    token_type: str
    user_id: str
    role: str
    expires_in: int
    is_paid: bool = False

class CampusAffiliation(BaseModel):
    campus_id: str
    user_id: str
    cardano_did: str
    password: str

class CounselorAffiliationUpdate(BaseModel):
    user_id: str
    cardano_did: str

class CounselorEmailLogin(BaseModel):
    email: str
    password: str

# --- Auth Functions ---
def create_jwt_token(user_id: str, role: str = "Student", is_paid: bool = False):
    expires_delta = timedelta(hours=JWT_EXPIRATION)
    expire = datetime.utcnow() + expires_delta
    
    payload = {
        "sub": user_id,
        "role": role,
        "is_paid": is_paid,
        "exp": expire,
        "iat": datetime.utcnow()
    }
    token = jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)
    
    return token, expires_delta.total_seconds()

def verify_jwt_token(token: str):
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload
    except jwt.PyJWTError:
        return None

# JWT validation dependency
async def get_current_user(credentials: HTTPAuthorizationCredentials = Security(security)):
    token = credentials.credentials
    payload = verify_jwt_token(token)
    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token or token has expired",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return payload["sub"]  # Return the username from the token

# Rate limiting dependency
async def check_rate_limit(user_id: str = Depends(get_current_user)):
    current_time = int(time.time())
    
    # Initialize rate limiting for user if not exists
    if user_id not in rate_limit_store:
        rate_limit_store[user_id] = {"count": 0, "reset_at": current_time + RATE_LIMIT_WINDOW}
    
    # Check if window has expired and reset if needed
    if current_time > rate_limit_store[user_id]["reset_at"]:
        rate_limit_store[user_id] = {"count": 0, "reset_at": current_time + RATE_LIMIT_WINDOW}
    
    # Increment request count
    rate_limit_store[user_id]["count"] += 1
    
    # Check if limit exceeded
    if rate_limit_store[user_id]["count"] > RATE_LIMIT:
        wait_time = rate_limit_store[user_id]["reset_at"] - current_time
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Rate limit exceeded. Try again in {wait_time} seconds.",
            headers={"Retry-After": str(wait_time)},
        )
    
    return user_id

# --- Authentication Route Logic ---
async def create_student_account(user_data: UserCreate, db: Session):
    generated_user_id = secrets.token_urlsafe(16)
    hashed_password = get_password_hash(user_data.password)

    db_user = StudentUser(id=generated_user_id, password_hash=hashed_password, campus_id="", cardano_did=None)
    db.add(db_user)
    try:
        db.commit()
        db.refresh(db_user)
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Account creation failed: {e}")
    return {"user_id": db_user.id, "message": "Account created successfully. Please proceed to campus affiliation."}

async def student_login(user_data: UserLogin, db: Session):
    db_user = db.query(StudentUser).filter(StudentUser.id == user_data.user_id).first()
    if not db_user or not verify_password(user_data.password, db_user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    
    return {
        "user_id": db_user.id,
        "campus_id": db_user.campus_id,
        "role": db_user.role,
        "cardano_did": db_user.cardano_did,
        "message": "Login successful"
    }

async def counselor_login(user_data: UserLogin, db: Session):
    db_counselor = db.query(CounselorUser).filter(CounselorUser.id == user_data.user_id).first()
    if not db_counselor or not verify_password(user_data.password, db_counselor.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    
    return {
        "user_id": db_counselor.id,
        "campus_id": db_counselor.campus_id,
        "role": db_counselor.role,
        "cardano_did": db_counselor.cardano_did,
        "message": "Login successful"
    }

async def universal_login(user_data: UserLogin, response: Response, db: Session):
    """Universal login endpoint for both students and counselors"""
    # Try student login first
    student = db.query(StudentUser).filter(StudentUser.id == user_data.user_id).first()
    if student and verify_password(user_data.password, student.password_hash):
        # Generate JWT token, including paid status
        token, expires_in = create_jwt_token(student.id, student.role, is_paid=student.is_paid)
        
        # Set cookie for web clients
        response.set_cookie(
            key="session_token",
            value=token,
            httponly=True,
            max_age=int(expires_in),
            samesite="lax",
            secure=True  # Set to False for development without HTTPS
        )
        
        return TokenResponse(
            access_token=token,
            token_type="bearer",
            user_id=student.id,
            role=student.role,
            expires_in=int(expires_in),
            is_paid=student.is_paid
        )
    
    # Try counselor login
    counselor = db.query(CounselorUser).filter(CounselorUser.id == user_data.user_id).first()
    if counselor and verify_password(user_data.password, counselor.password_hash):
        # Generate JWT token (counselors are not 'paid')
        token, expires_in = create_jwt_token(counselor.id, counselor.role, is_paid=False)
        
        # Set cookie for web clients
        response.set_cookie(
            key="session_token",
            value=token,
            httponly=True,
            max_age=int(expires_in),
            samesite="lax",
            secure=True  # Set to False for development without HTTPS
        )
        
        return TokenResponse(
            access_token=token,
            token_type="bearer",
            user_id=counselor.id,
            role=counselor.role,
            expires_in=int(expires_in),
            is_paid=False
        )
    
    # If no user found or password incorrect
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

async def register_user(user_data: UserRegistration, db: Session, response: Response = None):
    """Register a new user with auto-generated animal-based ID and return JWT token"""
    # Get current year (last two digits)
    current_year = str(datetime.now().year)[-2:]
    
    # Select random animal
    animal = random.choice(ANIMALS)
    
    # Generate a unique ID
    base_user_id = f"{animal}_{current_year}"
    generated_user_id = base_user_id
    
    # Check if ID already exists and add suffix if needed
    suffix = 1
    while (
        db.query(StudentUser).filter(StudentUser.id == generated_user_id).first() or
        db.query(CounselorUser).filter(CounselorUser.id == generated_user_id).first()
    ):
        generated_user_id = f"{base_user_id}_{suffix}"
        suffix += 1
        
        # Prevent infinite loop
        if suffix > 100:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to generate a unique user ID. Please try again."
            )
    
    # Hash the password
    hashed_password = get_password_hash(user_data.password)
    
    # Create new user
    new_user = StudentUser(
        id=generated_user_id,
        password_hash=hashed_password,
        campus_id="",  # Will be set during affiliation
        cardano_did=None
    )
    
    db.add(new_user)
    try:
        db.commit()
        db.refresh(new_user)
        
        # Generate JWT token for the new user (starts as not paid)
        token, expires_in = create_jwt_token(generated_user_id, "Student", is_paid=False)
        
        # Set cookie if response object is provided
        if response:
            response.set_cookie(
                key="session_token",
                value=token,
                httponly=True,
                max_age=int(expires_in),
                samesite="lax",
                secure=True
            )
        
        # Log successful registration
        logging.info(f"New user registered with ID: {generated_user_id}")
        
        return TokenResponse(
            access_token=token,
            token_type="bearer",
            user_id=generated_user_id,
            role="Student",
            expires_in=int(expires_in),
            is_paid=False
        )
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Registration failed: {e}"
        )

async def get_available_animals():
    """Return the list of available animals for user ID generation"""
    return {"animals": ANIMALS}

async def logout(response: Response):
    """Logout endpoint to clear session"""
    response.delete_cookie(key="session_token")
    return {"message": "Successfully logged out"}

async def update_counselor_did(update_data: CounselorAffiliationUpdate, db: Session):
    db_counselor = db.query(CounselorUser).filter(CounselorUser.id == update_data.user_id).first()
    if not db_counselor:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Counselor user not found")
    
    if db_counselor.cardano_did and db_counselor.cardano_did != update_data.cardano_did:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cardano DID already set and mismatch.")
    
    db_counselor.cardano_did = update_data.cardano_did
    try:
        db.commit()
        db.refresh(db_counselor)
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to update DID: {e}")
    
    return {"user_id": db_counselor.id, "message": "Counselor Cardano DID updated successfully."}

async def affiliate_student_account(affiliation_data: CampusAffiliation, db: Session):
    db_user = db.query(StudentUser).filter(StudentUser.id == affiliation_data.user_id).first()
    if not db_user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student user not found")

    if db_user.campus_id and db_user.campus_id != affiliation_data.campus_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="User already affiliated with a different campus.")

    db_user.campus_id = affiliation_data.campus_id
    db_user.cardano_did = affiliation_data.cardano_did
    try:
        db.commit()
        db.refresh(db_user)
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Affiliation failed: {e}")
    
    return {
        "user_id": db_user.id,
        "campus_id": db_user.campus_id,
        "message": "Account affiliated successfully."
    }

async def counselor_email_login(login_data: CounselorEmailLogin, response: Response, db: Session):
    """Login endpoint for counselors using email and password"""
    # Find counselor by email
    counselor = db.query(CounselorUser).filter(CounselorUser.email == login_data.email).first()
    if not counselor or not verify_password(login_data.password, counselor.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Generate JWT token (counselors are not 'paid')
    token, expires_in = create_jwt_token(counselor.id, counselor.role, is_paid=False)
    
    # Set cookie for web clients
    response.set_cookie(
        key="session_token",
        value=token,
        httponly=True,
        max_age=int(expires_in),
        samesite="lax",
        secure=True  # Set to False for development without HTTPS
    )
    
    return TokenResponse(
        access_token=token,
        token_type="bearer",
        user_id=counselor.id,
        role=counselor.role,
        expires_in=int(expires_in),
        is_paid=False
    ) 