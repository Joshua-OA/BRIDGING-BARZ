from sqlalchemy import Column, String, ForeignKey, Integer, Boolean, DateTime
from sqlalchemy.orm import declarative_base, relationship
import uuid
from datetime import datetime

Base = declarative_base()

class School(Base):
    __tablename__ = "schools"
    id = Column(String, primary_key=True, index=True)  # School ID (e.g., UGN-MAIN)
    name = Column(String, nullable=False)  # School name
    location = Column(String, nullable=True)  # School location
    
    # Relationship with counselors
    counselors = relationship("CounselorUser", back_populates="school")

class StudentUser(Base):
    __tablename__ = "student_users"
    id = Column(String, primary_key=True, index=True) # Generated User ID
    password_hash = Column(String)
    campus_id = Column(String, ForeignKey("schools.id"), index=True)
    role = Column(String, default="Student")
    cardano_did = Column(String, unique=True, nullable=True) # Linked on first login
    is_paid = Column(Boolean, default=False, nullable=False)
    
    # Relationship with school
    school = relationship("School")

class CounselorUser(Base):
    __tablename__ = "counselor_users"
    id = Column(String, primary_key=True, index=True) # Generated User ID
    name = Column(String, nullable=True)  # Counselor name
    email = Column(String, unique=True, nullable=True) # Email for login
    counselor_id = Column(String, unique=True, nullable=True) # Counselor ID for login
    password_hash = Column(String)
    campus_id = Column(String, ForeignKey("schools.id"), index=True) # Campus they are assigned to
    role = Column(String, default="Counselor")
    cardano_did = Column(String, unique=True, nullable=True) # Linked after first app login
    
    # Relationship with school
    school = relationship("School", back_populates="counselors")

class ChatMessage(Base):
    __tablename__ = "chat_messages"
    
    id = Column(Integer, primary_key=True, index=True)
    message_id = Column(String, unique=True, index=True, default=lambda: str(uuid.uuid4()))
    conversation_id = Column(String, nullable=False, index=True)
    sender_id = Column(String, nullable=False, index=True)
    recipient_id = Column(String, nullable=False, index=True)
    ipfs_hash = Column(String, nullable=False)
    timestamp = Column(DateTime, nullable=False, default=datetime.utcnow)