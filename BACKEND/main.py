import uvicorn
import os
import secrets
import json
import base64
import logging
import asyncio # Required for concurrent tasks
import uuid
import jwt
from datetime import datetime, timedelta
from io import BytesIO
from PIL import Image
import qrcode
from typing import List, Optional, Dict
import time
import random

from fastapi import FastAPI, HTTPException, Depends, status, WebSocket, WebSocketDisconnect, Form, Request, Response, Security, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, RedirectResponse, FileResponse
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from passlib.context import CryptContext
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric import ec
from fastapi.staticfiles import StaticFiles
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from config import Config
from models import Base, StudentUser, CounselorUser, School, ChatMessage
from nlp_lite import detect_danger_intent, detect_counselor_misconduct # Import your lightweight NLP
from signaling_manager import manager, test_manager # Import your WebSocket managers
from auth import (
    UserLogin, UserCreate, CounselorCreate, UserRegistration, 
    CampusAffiliation, CounselorAffiliationUpdate,
    get_password_hash, create_jwt_token, verify_jwt_token,
    get_current_user, check_rate_limit,
    universal_login as login, register_user, get_available_animals, logout,
    student_login, counselor_login, create_student_account,
    update_counselor_did, affiliate_student_account,
    CounselorEmailLogin, counselor_email_login, TokenResponse
)

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

# --- FastAPI App Setup ---
app = FastAPI(title="Cardano Chat Backend Monolith")

# Mount static files
app.mount("/static", StaticFiles(directory="static"), name="static")

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=Config.FRONTEND_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["Content-Type", "Authorization"],
    max_age=600  # Cache preflight requests for 10 minutes
)

# --- Database Setup (Single DB for Monolith) ---
engine = create_engine(Config.DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base.metadata.create_all(bind=engine) # Create all tables if they don't exist

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# --- Pydantic Models ---
from pydantic import BaseModel

# Auth & User Management Models
class AttestationRequest(BaseModel):
    user_id: str
    cardano_did: str

class SignedAttestationResponse(BaseModel):
    attestation_data: dict
    signature: str

# NLP Models
class MessageAnalysisRequest(BaseModel):
    chat_message: str
    sender_user_id: str
    recipient_user_id: str
    campus_id: str

class EmergencyDetectionResponse(BaseModel):
    is_emergency: bool
    reason: str
    original_message: str
    triggered_actions: list[str] = []

# School Models
class SchoolCreate(BaseModel):
    name: str
    school_id: str
    location: Optional[str] = None

class SchoolResponse(BaseModel):
    name: str
    school_id: str
    location: Optional[str] = None
    counselors: List[dict] = []

class CounselorCreateAdmin(BaseModel):
    name: str
    email: str
    password: str
    campus_id: str

# Add this Pydantic model to your models section
class CounselorMessageAnalysisRequest(BaseModel):
    chat_message: str
    counselor_id: str
    student_id: str
    campus_id: str

class CounselorMisconductResponse(BaseModel):
    is_misconduct: bool
    misconduct_type: Optional[str] = None
    original_message: str
    triggered_actions: list[str] = []

# ADDED: Pydantic model for persistent chat messages
class PersistentMessageCreate(BaseModel):
    recipient_id: str
    message_content: str

# --- Helper Function for Emergency Alert Trigger ---
async def trigger_emergency_alert(analysis_result: EmergencyDetectionResponse, request_data: MessageAnalysisRequest):
    logging.error(f"--- !!! EMERGENCY ALERT DETECTED !!! ---")
    logging.error(f"  Sender: {request_data.sender_user_id}")
    logging.error(f"  Recipient: {request_data.recipient_user_id}")
    logging.error(f"  Campus: {request_data.campus_id}")
    logging.error(f"  Reason: {analysis_result.reason}")
    logging.error(f"  Message: '{analysis_result.original_message}'")
    logging.error(f"--- !!! END EMERGENCY ALERT !!! ---")

    triggered_actions = ["Console Log Alert"]
    
    # In production, integrate with SMS/Email services here (e.g., Twilio, Africa's Talking)
    # Example placeholder:
    # print(f"Sending SMS to {Config.EMERGENCY_CONTACT_PHONE}")
    # print(f"Sending Email to {Config.EMERGENCY_CONTACT_EMAIL}")

    return triggered_actions

# Security setup for JWT tokens
security = HTTPBearer()

# Simple rate limiting in-memory storage
# For production, this should be replaced with Redis or similar distributed cache
rate_limit_store: Dict[str, Dict[str, int]] = {}
# Limits: 5 requests per 10 seconds per user
RATE_LIMIT = 5
RATE_LIMIT_WINDOW = 10  # seconds

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

# ADDED: Dependency to check for paid user status from JWT
async def get_current_paid_user(credentials: HTTPAuthorizationCredentials = Security(security)):
    token = credentials.credentials
    # This uses the verify_jwt_token function imported from auth.py
    payload = verify_jwt_token(token)
    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token or token has expired",
        )
    if not payload.get("is_paid"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This feature requires a paid subscription.",
        )
    return payload.get("sub")

# --- Endpoints ---

# --- Campus Auth & Student Oracle Routes ---
@app.post("/auth/student/create-account", summary="Create a new student account")
async def create_student_account_route(user_data: UserCreate, db: Session = Depends(get_db)):
    return await create_student_account(user_data, db)

@app.post("/auth/student/login", summary="Login a student")
async def student_login_route(user_data: UserLogin, db: Session = Depends(get_db)):
    return await student_login(user_data, db)

@app.post("/auth/student/affiliate", summary="Affiliate student account with a campus")
async def affiliate_student_account_route(affiliation_data: CampusAffiliation, db: Session = Depends(get_db)):
    return await affiliate_student_account(affiliation_data, db)

@app.post("/oracle/student/attest", response_model=SignedAttestationResponse, summary="Get signed attestation for a student")
async def get_student_attestation(request: AttestationRequest, db: Session = Depends(get_db)):
    db_user = db.query(StudentUser).filter(StudentUser.id == request.user_id).first()
    if not db_user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    if db_user.cardano_did != request.cardano_did:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cardano DID mismatch for user.")
    if not db_user.campus_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Student not affiliated with any campus.")

    attestation_data = {
        "did": db_user.cardano_did,
        "campusId": db_user.campus_id,
        "role": db_user.role,
        "timestamp": "2025-06-06T09:00:00Z" # Fixed timestamp for MVP
    }
    
    campus_oracle_private_key = Config.get_campus_oracle_private_key()

    signer = campus_oracle_private_key.signer(ec.ECDSA(hashes.SHA256()))
    signer.update(json.dumps(attestation_data, sort_keys=True).encode('utf-8'))
    signature = signer.finalize()

    return SignedAttestationResponse(
        attestation_data=attestation_data,
        signature=base64.b64encode(signature).decode('utf-8')
    )

# --- My Company Backend & Counselor Oracle Routes ---
@app.post("/admin/counselors/create", summary="Admin: Create a new counselor account")
async def create_counselor_account(counselor_data: CounselorCreateAdmin, db: Session = Depends(get_db)):
    # Check if school exists
    school = db.query(School).filter(School.id == counselor_data.campus_id).first()
    if not school:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail=f"School with ID '{counselor_data.campus_id}' not found"
        )
    
    # Check if email is already in use
    existing_counselor = db.query(CounselorUser).filter(CounselorUser.email == counselor_data.email).first()
    if existing_counselor:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Email '{counselor_data.email}' is already in use by another counselor"
        )
    
    # Generate ID from name (replace spaces with underscores and add prefix)
    formatted_name = counselor_data.name.replace(" ", "_").upper()
    generated_user_id = f"COUNSELOR_{formatted_name}"
    
    # Check if ID already exists and make it unique if needed
    count = 1
    original_id = generated_user_id
    while db.query(CounselorUser).filter(CounselorUser.id == generated_user_id).first():
        generated_user_id = f"{original_id}_{count}"
        count += 1
    
    hashed_password = get_password_hash(counselor_data.password)

    db_counselor = CounselorUser(
        id=generated_user_id,
        name=counselor_data.name,
        email=counselor_data.email,
        password_hash=hashed_password,
        campus_id=counselor_data.campus_id,
        cardano_did=None
    )
    
    db.add(db_counselor)
    try:
        db.commit()
        db.refresh(db_counselor)
        
        # Update school QR code with new counselor
        update_school_qr(counselor_data.campus_id, db)
        
        # Here you would send an email with login credentials
        # This is a placeholder for the email sending functionality
        logging.info(f"Would send email to {counselor_data.email} with credentials: user_id={db_counselor.id}, password={counselor_data.password}")
    
        return {
            "user_id": db_counselor.id,
            "name": db_counselor.name,
            "email": db_counselor.email,
            "password": counselor_data.password,
            "message": "Counselor account created successfully. Login credentials have been sent to the provided email."
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, 
            detail=f"Counselor creation failed: {e}"
        )

@app.post("/auth/counselor/login", response_model=TokenResponse, summary="Login as counselor using email")
async def api_counselor_email_login(
    login_data: CounselorEmailLogin, 
    response: Response,
    db: Session = Depends(get_db)
):
    """
    Authenticate a counselor using email and password and return a JWT token
    """
    return await counselor_email_login(login_data, response, db)

@app.post("/auth/counselor/update-did", summary="Update counselor's Cardano DID after first app login")
async def update_counselor_did_route(update_data: CounselorAffiliationUpdate, db: Session = Depends(get_db)):
    return await update_counselor_did(update_data, db)

@app.post("/oracle/counselor/attest", response_model=SignedAttestationResponse, summary="Get signed attestation for a counselor")
async def get_counselor_attestation(request: AttestationRequest, db: Session = Depends(get_db)):
    db_counselor = db.query(CounselorUser).filter(CounselorUser.id == request.user_id).first()
    if not db_counselor:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Counselor user not found")
    if db_counselor.cardano_did != request.cardano_did:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cardano DID mismatch for user.")
    if not db_counselor.campus_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Counselor not assigned to any campus.")

    attestation_data = {
        "did": db_counselor.cardano_did,
        "campusId": db_counselor.campus_id,
        "role": db_counselor.role,
        "timestamp": "2025-06-06T09:00:00Z" # Fixed timestamp for MVP
    }
    
    my_company_oracle_private_key = Config.get_my_company_oracle_private_key()

    signer = my_company_oracle_private_key.signer(ec.ECDSA(hashes.SHA256()))
    signer.update(json.dumps(attestation_data, sort_keys=True).encode('utf-8'))
    signature = signer.finalize()

    return SignedAttestationResponse(
        attestation_data=attestation_data,
        signature=base64.b64encode(signature).decode('utf-8')
    )

# --- NLP Danger Detection Route ---
@app.post("/nlp/detect-emergency", response_model=EmergencyDetectionResponse, summary="Analyze chat message for emergency intent")
async def analyze_message_for_emergency(request: MessageAnalysisRequest):
    is_emergency_detected = detect_danger_intent(request.chat_message)
    
    response_details = EmergencyDetectionResponse(
        is_emergency=is_emergency_detected,
        reason="Danger keywords/phrases detected." if is_emergency_detected else "No danger indicators.",
        original_message=request.chat_message
    )

    if is_emergency_detected:
        triggered_actions_list = await trigger_emergency_alert(response_details, request)
        response_details.triggered_actions = triggered_actions_list

    return response_details

# --- WebRTC Signaling Route ---
@app.websocket("/ws/test/{client_id}")
async def websocket_test_endpoint(websocket: WebSocket, client_id: str):
    await test_manager.connect(websocket, client_id)
    await test_manager.broadcast(f"Client '{client_id}' joined the chat.", sender_id=client_id)
    try:
        while True:
            data = await websocket.receive_text()
            # For testing, we broadcast any message received to all other clients
            logging.info(f"Test message from {client_id}: {data}")
            await test_manager.broadcast(f"{client_id}: {data}", sender_id=client_id)
    except WebSocketDisconnect:
        test_manager.disconnect(client_id)
        await test_manager.broadcast(f"Client '{client_id}' left the chat.", sender_id=client_id)

@app.websocket("/ws/{user_id}")
async def websocket_endpoint(websocket: WebSocket, user_id: str, db: Session = Depends(get_db)):
    await manager.connect(websocket, user_id)
    try:
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)
            
            # Required fields for proper message routing
            recipient_user_id = message.get("recipient_user_id")
            chat_message = message.get("message", "")
            message_id = message.get("message_id", str(uuid.uuid4()))
            timestamp = message.get("timestamp", datetime.utcnow().isoformat())
            message_type = message.get("type", "text")
            
            # Get campus_id for the sender
            sender = None
            is_counselor = False
            campus_id = None
            
            # Try to find the user in the counselor table
            sender = db.query(CounselorUser).filter(CounselorUser.id == user_id).first()
            if sender:
                is_counselor = True
                campus_id = sender.campus_id
            else:
                # If not a counselor, check if it's a student
                sender = db.query(StudentUser).filter(StudentUser.id == user_id).first()
                if sender:
                    campus_id = sender.campus_id
            
            if not sender:
                logging.warning(f"Unknown user {user_id} attempting to send messages")
                await manager.send_personal_message(json.dumps({
                    "error": "User not recognized",
                    "message_id": message_id
                }), user_id)
                continue
            
            # Verify the recipient exists and is valid for this sender
            recipient = None
            if is_counselor:
                # Counselors can only message students from their campus
                recipient = db.query(StudentUser).filter(
                    StudentUser.id == recipient_user_id,
                    StudentUser.campus_id == campus_id
                ).first()
            else:
                # Students can only message counselors from their campus
                recipient = db.query(CounselorUser).filter(
                    CounselorUser.id == recipient_user_id,
                    CounselorUser.campus_id == campus_id
                ).first()
            
            if not recipient:
                logging.warning(f"Invalid recipient {recipient_user_id} for user {user_id}")
                await manager.send_personal_message(json.dumps({
                    "error": "Invalid recipient",
                    "message_id": message_id
                }), user_id)
                continue
                
            # Process message content based on sender type
            if is_counselor:
                # Check counselor messages for inappropriate content
                misconduct_result = detect_counselor_misconduct(chat_message)
                if misconduct_result["detected"]:
                    # Log the misconduct
                    logging.error(f"COUNSELOR MISCONDUCT: {user_id} to {recipient_user_id}: {misconduct_result['type']}")
                    
                    # Flag message but still deliver it
                    message["flagged"] = True
                    message["misconduct_type"] = misconduct_result["type"]
                    
                    # In a production system, you might also notify admins here
            else:
                # Check student messages for danger signals
                is_emergency = detect_danger_intent(chat_message)
                if is_emergency:
                    # Log the emergency
                    logging.error(f"STUDENT EMERGENCY: {user_id} to {recipient_user_id}")
                    
                    # Flag message as emergency
                    message["emergency"] = True

            # Construct final message with all necessary metadata
            final_message = {
                "message_id": message_id,
                "sender_user_id": user_id,
                "sender_name": sender.name if hasattr(sender, "name") and sender.name else user_id,
                "recipient_user_id": recipient_user_id,
                "campus_id": campus_id,
                "timestamp": timestamp,
                "message": chat_message,
                "type": message_type,
                "sender_role": "Counselor" if is_counselor else "Student"
            }
            
            # Add any flags from processing
            if message.get("flagged"):
                final_message["flagged"] = True
                final_message["misconduct_type"] = message.get("misconduct_type")
            
            if message.get("emergency"):
                final_message["emergency"] = True
            
            # Send the message to the recipient if they're online
            if recipient_user_id in manager.active_connections:
                await manager.send_personal_message(json.dumps(final_message), recipient_user_id)
                logging.info(f"Relayed message from {user_id} to {recipient_user_id}")
                
                # Send delivery confirmation to sender
                await manager.send_personal_message(json.dumps({
                    "type": "delivery_receipt",
                    "message_id": message_id,
                    "status": "delivered",
                    "timestamp": datetime.utcnow().isoformat()
                }), user_id)
            else:
                logging.warning(f"Recipient {recipient_user_id} not connected.")
                # Send failed delivery notification to sender
                await manager.send_personal_message(json.dumps({
                    "type": "delivery_receipt",
                    "message_id": message_id,
                    "status": "pending",
                    "error": "Recipient not currently connected",
                    "timestamp": datetime.utcnow().isoformat()
                }), user_id)

    except WebSocketDisconnect:
        manager.disconnect(user_id)
        logging.info(f"User {user_id} disconnected")
    except Exception as e:
        logging.error(f"Error for user {user_id}: {e}")
        manager.disconnect(user_id)


ADMIN_SESSIONS = {} # Simple in-memory session store

# --- Admin Panel Routes ---
@app.post("/admin/login")
async def admin_login(response: Response, username: str = Form(...), password: str = Form(...)):
    if username == Config.ADMIN_USERNAME and password == Config.ADMIN_PASSWORD:
        # Create session cookie as before
        session_token = str(uuid.uuid4())
        ADMIN_SESSIONS[username] = session_token
        response.set_cookie(key="admin_session_token", value=session_token, httponly=True, samesite="lax")
        
        # Create JWT token for localStorage using the correct function from auth.py
        # Admins can be considered "paid" to access all features.
        jwt_token, _ = create_jwt_token(username, role="Admin", is_paid=True)
        
        return {"message": "Login successful", "token": jwt_token}
    raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid admin credentials.")

@app.get("/admin", response_class=HTMLResponse)
async def serve_admin_panel(request: Request):
    # First check for cookie-based authentication
    session_token = request.cookies.get("admin_session_token")
    if session_token and session_token in ADMIN_SESSIONS.values():
        with open("static/index.html", "r") as f:
            html_content = f.read()
        return HTMLResponse(content=html_content)
    
    # If cookie auth fails, let the frontend handle JWT validation
    with open("static/index.html", "r") as f:
        html_content = f.read()
    return HTMLResponse(content=html_content)

@app.get("/admin/login_page", response_class=HTMLResponse)
async def get_admin_login_page():
    try:
        with open("static/login.html", "r") as f:
            html_content = f.read()
        return HTMLResponse(content=html_content)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Admin login page not found.")

@app.post("/admin/schools/create", summary="Admin: Create a new school")
async def create_school(school_data: SchoolCreate, db: Session = Depends(get_db)):
    # Check if school already exists
    existing_school = db.query(School).filter(School.id == school_data.school_id).first()
    if existing_school:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, 
            detail=f"School with ID '{school_data.school_id}' already exists"
        )
    
    # Create new school
    new_school = School(
        id=school_data.school_id,
        name=school_data.name,
        location=school_data.location
    )
    
    db.add(new_school)
    try:
        db.commit()
        db.refresh(new_school)
        
        # Generate and save QR code
        qr_data = {
            "name": new_school.name,
            "school_id": new_school.id,
            "counselors": []
        }
        generate_and_save_qr(new_school.id, json.dumps(qr_data))
        
        return {
            "school_id": new_school.id,
            "name": new_school.name,
            "location": new_school.location,
            "message": "School created successfully."
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, 
            detail=f"School creation failed: {e}"
        )

@app.get("/admin/schools/list", response_model=dict, summary="Admin: List all schools with counselors")
async def list_schools(db: Session = Depends(get_db)):
    schools = db.query(School).all()
    result = []
    
    for school in schools:
        counselors_data = []
        counselors = db.query(CounselorUser).filter(CounselorUser.campus_id == school.id).all()
        
        for counselor in counselors:
            counselors_data.append({
                "user_id": counselor.id,
                "name": counselor.name,
                "campus_id": counselor.campus_id
            })
        
        result.append({
            "name": school.name,
            "school_id": school.id,
            "location": school.location,
            "counselors": counselors_data
        })
    
    return {"schools": result}

@app.get("/admin/schools/{school_id}/qrcode", summary="Get QR code for a school")
async def get_school_qrcode(school_id: str, db: Session = Depends(get_db)):
    # Check if school exists
    school = db.query(School).filter(School.id == school_id).first()
    if not school:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail=f"School with ID '{school_id}' not found"
        )
    
    # Get counselors for this school
    counselors = db.query(CounselorUser).filter(CounselorUser.campus_id == school_id).all()
    counselor_data = [{"id": c.id, "name": c.name} for c in counselors]
    
    # Generate QR code data
    qr_data = {
        "name": school.name,
        "school_id": school.id,
        "counselors": counselor_data
    }
    
    # Always generate a fresh QR code with current data
    qr_path = generate_and_save_qr(school_id, json.dumps(qr_data))
    
    return {"qr_url": f"/static/qrcodes/school_{school_id}.png", "data": qr_data}

@app.get("/admin/schools/{school_id}/qrcode/download", summary="Download QR code for a school")
async def download_school_qrcode(school_id: str, db: Session = Depends(get_db)):
    # Check if school exists
    school = db.query(School).filter(School.id == school_id).first()
    if not school:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail=f"School with ID '{school_id}' not found"
        )
    
    # Get counselors for this school
    counselors = db.query(CounselorUser).filter(CounselorUser.campus_id == school_id).all()
    counselor_data = [{"id": c.id, "name": c.name} for c in counselors]
    
    # Generate QR code data
    qr_data = {
        "name": school.name,
        "school_id": school.id,
        "counselors": counselor_data
    }
    
    # Ensure QR code is generated
    qr_path = f"static/qrcodes/school_{school_id}.png"
    if not os.path.exists(qr_path):
        generate_and_save_qr(school_id, json.dumps(qr_data))
    
    # Return file for download with appropriate filename
    return FileResponse(
        path=qr_path, 
        media_type="image/png",
        filename=f"school_{school_id}.png"
    )

# Helper function to generate and save QR codes
def generate_and_save_qr(school_id: str, data: str):
    # Create directory if it doesn't exist
    os.makedirs("static/qrcodes", exist_ok=True)
    
    # Instead of encoding all the data, create a URL to the API endpoint with auth info
    api_url = f"{Config.API_BASE_URL}/api/school/{school_id}"
    
    # Generate QR code
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_L,
        box_size=10,
        border=4,
    )
    qr.add_data(api_url)
    qr.make(fit=True)
    
    # Create an image from the QR Code
    img = qr.make_image(fill_color="black", back_color="white")
    
    # Save the image
    img.save(f"static/qrcodes/school_{school_id}.png")
    
    return f"static/qrcodes/school_{school_id}.png"

# Helper function to update school QR code when counselors change
def update_school_qr(school_id: str, db: Session):
    school = db.query(School).filter(School.id == school_id).first()
    if not school:
        return
    
    counselors = db.query(CounselorUser).filter(CounselorUser.campus_id == school_id).all()
    counselor_data = [{"id": c.id, "name": c.name} for c in counselors]
    
    qr_data = {
        "name": school.name,
        "school_id": school.id,
        "counselors": counselor_data
    }
    
    generate_and_save_qr(school_id, json.dumps(qr_data))

# Add endpoint to get schools for dropdown
@app.get("/admin/schools/options", summary="Get schools for dropdown selection")
async def get_school_options(db: Session = Depends(get_db)):
    schools = db.query(School).all()
    options = [{"id": school.id, "name": school.name} for school in schools]
    return {"schools": options}

# After the engine and SessionLocal setup, add this to ensure the DB is recreated
def init_db():
    # Create directories for static files if they don't exist
    os.makedirs("static/css", exist_ok=True)
    os.makedirs("static/qrcodes", exist_ok=True)
    
    # Only create tables if they don't exist
    # Remove the drop_all line to preserve existing data
    Base.metadata.create_all(bind=engine)
    
    print("Database initialized - existing tables preserved")

# Call this function at startup
init_db()

# --- Main execution block for development ---
if __name__ == "__main__":
    print(f"Cardano Chat Monolith Backend starting. Database: {Config.DATABASE_URL}")
    print(f"CORS Origins: {Config.FRONTEND_ORIGINS}")
    uvicorn.run(app, host="0.0.0.0", port=8000) # Running on port 8000 for all services

# Updated endpoint with authentication and rate limiting
@app.get("/api/school/{school_id}", summary="Get real-time school data (authenticated)")
async def get_school_data(
    school_id: str, 
    db: Session = Depends(get_db),
    user_id: str = Depends(check_rate_limit)  # This combines authentication and rate limiting
):
    # Check if school exists
    school = db.query(School).filter(School.id == school_id).first()
    if not school:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail=f"School with ID '{school_id}' not found"
        )
    
    # Log access for auditing
    logging.info(f"User {user_id} accessed school data for {school_id}")
    
    # Get counselors for this school - always gets fresh data
    counselors = db.query(CounselorUser).filter(CounselorUser.campus_id == school_id).all()
    counselor_data = [{"id": c.id, "name": c.name} for c in counselors]
    
    # Return real-time data about the school
    return {
        "name": school.name,
        "school_id": school.id,
        "location": school.location,
        "counselors": counselor_data
    }

@app.get("/auth/animals", summary="Get available animals for registration")
async def animals_route():
    return await get_available_animals()

@app.post("/auth/login", summary="Universal login for all users")
async def login_route(user_data: UserLogin, response: Response, db: Session = Depends(get_db)):
    return await login(user_data, response, db)

@app.post("/auth/register", response_model=TokenResponse, summary="Register a new user with animal-based ID")
async def register_route(user_data: UserRegistration, response: Response, db: Session = Depends(get_db)):
    return await register_user(user_data, db, response)

@app.post("/auth/logout", summary="Logout and clear session")
async def logout_route(response: Response):
    return await logout(response)

# Add this new endpoint
@app.post("/nlp/detect-counselor-misconduct", response_model=CounselorMisconductResponse, summary="Analyze counselor messages for inappropriate content")
async def analyze_counselor_message(request: CounselorMessageAnalysisRequest):
    from nlp_lite import detect_counselor_misconduct
    
    # Analyze the message
    misconduct_result = detect_counselor_misconduct(request.chat_message)
    
    response_details = CounselorMisconductResponse(
        is_misconduct=misconduct_result["detected"],
        misconduct_type=misconduct_result.get("type", None),
        original_message=request.chat_message
    )

    if misconduct_result["detected"]:
        # Log the misconduct
        logging.error(f"--- !!! COUNSELOR MISCONDUCT DETECTED !!! ---")
        logging.error(f"  Counselor: {request.counselor_id}")
        logging.error(f"  Student: {request.student_id}")
        logging.error(f"  Campus: {request.campus_id}")
        logging.error(f"  Type: {misconduct_result.get('type')}")
        logging.error(f"  Pattern: {misconduct_result.get('pattern')}")
        logging.error(f"  Message: '{request.chat_message}'")
        logging.error(f"--- !!! END COUNSELOR MISCONDUCT ALERT !!! ---")
        
        # In a real system, you'd trigger notifications to admins here
        response_details.triggered_actions = ["Console Log Alert", "Admin Notification"]
        
        # For serious misconduct, you could consider blocking the message
        # and temporarily suspending the counselor account

    return response_details

# ADDED: New endpoint for persistent messaging for paid users
@app.post("/chat/send-persistent", summary="Send a persistent message (Paid Subscription Required)")
async def send_persistent_message(
    message_data: PersistentMessageCreate,
    db: Session = Depends(get_db),
    sender_id: str = Depends(get_current_paid_user)
):
    """
    Stores a message by saving its IPFS hash to the database.
    This endpoint is only accessible to users with a paid subscription.
    """
    # In a real application, this is where you would upload message_data.message_content to IPFS
    # and get back a real hash. For this example, we'll simulate it.
    fake_ipfs_hash = f"Qm_fake_hash_for_testing_{uuid.uuid4()}"
    
    # Generate a consistent conversation ID for easy retrieval of message history
    user_ids = sorted([sender_id, message_data.recipient_id])
    conversation_id = f"conv_{user_ids[0]}_{user_ids[1]}"
    
    # Create and store the message metadata in the database
    new_message = ChatMessage(
        sender_id=sender_id,
        recipient_id=message_data.recipient_id,
        ipfs_hash=fake_ipfs_hash,
        conversation_id=conversation_id,
        timestamp=datetime.utcnow()
    )
    
    db.add(new_message)
    try:
        db.commit()
        db.refresh(new_message)
        logging.info(f"Stored persistent message from {sender_id} to {message_data.recipient_id} with IPFS hash {fake_ipfs_hash}")
        
        return {
            "message": "Message stored successfully.",
            "message_id": new_message.message_id,
            "ipfs_hash": new_message.ipfs_hash,
            "timestamp": new_message.timestamp
        }
    except Exception as e:
        db.rollback()
        logging.error(f"Failed to store persistent message: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to store message: {e}"
        )