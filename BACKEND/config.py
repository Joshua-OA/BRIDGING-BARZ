import os
from dotenv import load_dotenv
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.backends import default_backend

# Load environment variables from .env file
load_dotenv() # Looks for .env in the current directory

class Config:
    # --- Common Settings ---
    FRONTEND_ORIGINS = [
        "http://localhost",
        "http://localhost:3000",  # For web development
        "http://localhost:8000",
        "https://your-production-domain.com",
        "capacitor://localhost",  # For Capacitor-based mobile apps
        "ionic://localhost",      # For Ionic-based mobile apps
        "file://",                # For WebView file access
        "cardanochat://",         # Custom URI scheme for your mobile app
        "*"                       # Allow all origins (only for development!)
    ]
    DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./app_data.db")

    # --- Oracle Private Keys ---
    _campus_oracle_private_key = None
    _my_company_oracle_private_key = None

    @classmethod
    def _generate_or_load_key(cls, env_var_name, class_attr_name):
        pem_key = os.getenv(env_var_name)
        
        if getattr(cls, class_attr_name):
            return getattr(cls, class_attr_name)

        if pem_key:
            try:
                key_obj = serialization.load_pem_private_key(
                    pem_key.encode('utf-8'),
                    password=None,
                    backend=default_backend()
                )
                print(f"'{env_var_name}' loaded successfully from environment.")
                setattr(cls, class_attr_name, key_obj)
                return key_obj
            except ValueError:
                print(f"ERROR: Invalid '{env_var_name}'. Please check format.")
                exit(1)
        else:
            print(f"WARNING: '{env_var_name}' not set. Generating a new key pair for dev.")
            private_key_obj = ec.generate_private_key(ec.SECP256R1(), default_backend())
            public_key_obj = private_key_obj.public_key()
            setattr(cls, class_attr_name, private_key_obj)

            pem_private = private_key_obj.private_bytes(
                encoding=serialization.Encoding.PEM,
                format=serialization.PrivateFormat.PKCS8,
                encryption_algorithm=serialization.NoEncryption()
            ).decode('utf-8')
            pem_public = public_key_obj.public_bytes(
                encoding=serialization.Encoding.PEM,
                format=serialization.PublicFormat.SubjectPublicKeyInfo
            ).decode('utf-8')

            print(f"\n--- NEWLY GENERATED KEY PAIR FOR '{env_var_name}' (FOR DEV ONLY) ---")
            print(f"SAVE THIS PRIVATE KEY in your .env file for consistent dev:")
            print(f"{env_var_name}='''{pem_private}'''") # Use triple quotes for multiline
            print("\nSAVE THIS PUBLIC KEY for your Plutus contract:")
            print(pem_public)
            print("--- END NEW KEY PAIR ---\n")
            return private_key_obj

    @classmethod
    def get_campus_oracle_private_key(cls):
        return cls._generate_or_load_key("CAMPUS_ORACLE_PRIVATE_KEY_PEM", "_campus_oracle_private_key")

    @classmethod
    def get_my_company_oracle_private_key(cls):
        return cls._generate_or_load_key("MY_COMPANY_ORACLE_PRIVATE_KEY_PEM", "_my_company_oracle_private_key")

    # --- NLP Danger Detection Settings ---
    NLP_DANGER_KEYWORDS = [k.strip() for k in os.getenv("NLP_DANGER_KEYWORDS", "").split(',') if k.strip()]
    EMERGENCY_CONTACT_PHONE = os.getenv("EMERGENCY_CONTACT_PHONE", "+233551234567")
    EMERGENCY_CONTACT_EMAIL = os.getenv("EMERGENCY_CONTACT_EMAIL", "security@campus.edu")

    # --- Admin Panel Settings ---
    ADMIN_USERNAME = os.getenv("ADMIN_USERNAME", "admin")
    ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "supersecretpassword") # Default for dev if not set

    # Add this to your existing Config class
    API_BASE_URL = os.getenv("API_BASE_URL", "http://localhost:8000")