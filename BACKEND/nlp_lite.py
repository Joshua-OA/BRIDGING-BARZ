import re
import logging
from config import Config

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

def detect_danger_intent(text: str) -> bool:
    """
    Detects specific 'danger' intents using a keyword and regex-based approach.
    This is an extremely lightweight alternative to large NLP models.
    """
    text_lower = text.lower()

    # Define a list of danger patterns (keywords and simple regexes)
    # Using regex word boundaries (\b) helps match whole words.
    danger_patterns = [
        r"\b(raped|sexual assault|molested)\b", # Specific "rape" comments
        r"\b(can't see|cannot see)\b",          # "I can't see"
        r"\b(overdose|od|taken too much|too many pills|pills taken)\b", # Overdose related
        r"\b(help|urgent|emergency|crisis|danger|unsafe|pain|bleeding)\b", # General distress
        r"\b(dying|unconscious|choking|can't breathe|breathing difficulty)\b", # Medical emergency
        r"\b(suicide|kill myself|ending it|end my life|can't go on|want to die)\b", # Self-harm/suicide ideation
        r"\b(attacked|assaulted|stabbed|shot|injured|hurt bad)\b", # Violence
        r"\b(trap|stuck|kidnapped|abducted)\b" # Being held against will
    ]

    for pattern in danger_patterns:
        if re.search(pattern, text_lower):
            logging.info(f"Danger intent detected by pattern: '{pattern}' in text: '{text}'")
            return True
            
    logging.info(f"No danger intent detected in text: '{text}'")
    return False

def detect_counselor_misconduct(text: str) -> dict:
    """
    Detects inappropriate behavior from counselors, such as:
    1. Suggesting in-person meetings (potential grooming)
    2. Encouraging drug or alcohol use
    3. Requesting excessive personal details
    
    Returns a dict with detection result and type of misconduct if found
    """
    text_lower = text.lower()
    
    # Patterns for detecting inappropriate meeting suggestions
    meeting_patterns = [
        r"\b(meet up|meet in person|get together|hang out|meet somewhere|coffee|outside school|my house|my place)\b",
        r"\b(give me your address|where do you live|your home|come over|visit me)\b",
        r"\b(private meeting|secret meeting|don't tell anyone|keep this between us)\b"
    ]
    
    # Patterns for detecting encouragement of drug/alcohol use
    substance_patterns = [
        r"\b(try drugs|take drugs|use drugs|should drink|try drinking|get high|get drunk)\b",
        r"\b(alcohol helps|drugs help|weed|marijuana|cocaine|pills will help|it's just alcohol)\b",
        r"\b(drinking age|smoking age|won't hurt you|makes you feel better|no one will know)\b"
    ]
    
    # Patterns for detecting inappropriate personal information requests
    personal_info_patterns = [
        r"\b(send photo|send picture|send selfie|picture of you|photo of you|selfie of you)\b",
        r"\b(what are you wearing|describe yourself|how do you look|your body)\b",
        r"\b(social media|instagram|snapchat|tiktok account|follow me|my account)\b",
        r"\b(phone number|address|where exactly|personal email|private contact)\b"
    ]
    
    # Check for meeting suggestions
    for pattern in meeting_patterns:
        if re.search(pattern, text_lower):
            logging.warning(f"Potential grooming detected: '{pattern}' in text: '{text}'")
            return {"detected": True, "type": "inappropriate_meeting", "pattern": pattern}
    
    # Check for substance encouragement
    for pattern in substance_patterns:
        if re.search(pattern, text_lower):
            logging.warning(f"Substance encouragement detected: '{pattern}' in text: '{text}'")
            return {"detected": True, "type": "substance_encouragement", "pattern": pattern}
            
    # Check for personal information requests
    for pattern in personal_info_patterns:
        if re.search(pattern, text_lower):
            logging.warning(f"Inappropriate personal info request detected: '{pattern}' in text: '{text}'")
            return {"detected": True, "type": "personal_info_request", "pattern": pattern}
    
    return {"detected": False}