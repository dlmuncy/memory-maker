import os
import uuid
import hashlib
import secrets
import logging
from pathlib import Path
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Annotated

import httpx
from fastapi import FastAPI, APIRouter, Header, HTTPException, Depends
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, BeforeValidator, EmailStr

from backend import image_engines

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# ---------------------------------------------------------------------------
# Setup
# ---------------------------------------------------------------------------
mongo_url = os.environ.get('MONGO_URL', '')
db_name = os.environ.get('DB_NAME', 'memory_maker')
client = AsyncIOMotorClient(mongo_url) if mongo_url else None
db = client[db_name] if client else None

RESEND_API_KEY = os.environ.get('RESEND_API_KEY', '')
OTP_FROM_EMAIL = os.environ.get('OTP_FROM_EMAIL', 'Memory Maker <onboarding@resend.dev>')
RESEND_API_URL = "https://api.resend.com/emails"

OTP_TTL_MINUTES = 10
OTP_RESEND_COOLDOWN_SECONDS = 30
OTP_MAX_ATTEMPTS = 5

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("memory_maker")

app = FastAPI()
api_router = APIRouter(prefix="/api")


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------
PyObjectId = Annotated[str, BeforeValidator(str)]


class RequestOtpBody(BaseModel):
    email: EmailStr


class VerifyOtpBody(BaseModel):
    email: EmailStr
    code: str


class PhotoCreate(BaseModel):
    image_base64: str


class Photo(BaseModel):
    id: str
    user_id: str
    image_base64: str
    created_at: str


class MemoryGenerateRequest(BaseModel):
    prompt: str
    photo_ids: List[str] = Field(default_factory=list)


class Memory(BaseModel):
    id: str
    user_id: str
    title: str
    prompt: str
    image_base64: str
    source_photo_ids: List[str] = Field(default_factory=list)
    created_at: str


# ---------------------------------------------------------------------------
# Auth helpers
# ---------------------------------------------------------------------------
async def get_current_user(authorization: Optional[str] = Header(None)) -> dict:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid Authorization header")
    token = authorization.split(" ", 1)[1].strip()

    session = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=401, detail="Invalid session")

    expires_at = session.get("expires_at")
    if isinstance(expires_at, datetime):
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        if expires_at < datetime.now(timezone.utc):
            raise HTTPException(status_code=401, detail="Session expired")

    user = await db.users.find_one({"user_id": session["user_id"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


# ---------------------------------------------------------------------------
# Auth routes (Email OTP via Resend)
# ---------------------------------------------------------------------------
def _hash_code(email: str, code: str) -> str:
    return hashlib.sha256(f"{email.lower()}:{code}".encode()).hexdigest()


def _otp_email_html(code: str) -> str:
    return f"""
    <div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;color:#191818;">
      <h1 style="font-size:20px;font-weight:600;margin:0 0 8px;">Your Memory Maker code</h1>
      <p style="font-size:15px;color:#4A4846;margin:0 0 24px;">Enter this code to sign in. It expires in {OTP_TTL_MINUTES} minutes.</p>
      <div style="font-size:34px;font-weight:700;letter-spacing:10px;color:#D46F54;background:#FCEAE5;border-radius:12px;padding:20px;text-align:center;">{code}</div>
      <p style="font-size:13px;color:#8E8B88;margin:24px 0 0;">If you didn't request this, you can safely ignore this email.</p>
    </div>
    """


async def _send_otp_email(email: str, code: str) -> None:
    payload = {
        "from": OTP_FROM_EMAIL,
        "to": [email],
        "subject": f"{code} is your Memory Maker code",
        "html": _otp_email_html(code),
    }
    async with httpx.AsyncClient(timeout=20) as http:
        resp = await http.post(
            RESEND_API_URL,
            headers={"Authorization": f"Bearer {RESEND_API_KEY}", "Content-Type": "application/json"},
            json=payload,
        )
    if resp.status_code >= 400:
        logger.error(f"Resend send failed ({resp.status_code}): {resp.text[:300]}")
        raise HTTPException(
            status_code=502,
            detail="Couldn't send the email. Please check the address and try again.",
        )


@api_router.post("/auth/request-otp")
async def request_otp(payload: RequestOtpBody):
    email = payload.email.lower().strip()
    now = datetime.now(timezone.utc)

    existing = await db.otp_codes.find_one({"email": email})
    if existing:
        created = existing.get("created_at")
        if isinstance(created, datetime):
            if created.tzinfo is None:
                created = created.replace(tzinfo=timezone.utc)
            if (now - created).total_seconds() < OTP_RESEND_COOLDOWN_SECONDS:
                raise HTTPException(status_code=429, detail="Please wait a moment before requesting another code.")

    code = f"{secrets.randbelow(1000000):06d}"
    await db.otp_codes.update_one(
        {"email": email},
        {"$set": {
            "email": email,
            "code_hash": _hash_code(email, code),
            "attempts": 0,
            "created_at": now,
            "expires_at": now + timedelta(minutes=OTP_TTL_MINUTES),
        }},
        upsert=True,
    )

    try:
        await _send_otp_email(email, code)
    except HTTPException:
        await db.otp_codes.delete_one({"email": email})
        raise
    return {"ok": True, "email": email}


@api_router.post("/auth/verify-otp")
async def verify_otp(payload: VerifyOtpBody):
    email = payload.email.lower().strip()
    code = payload.code.strip()
    now = datetime.now(timezone.utc)

    record = await db.otp_codes.find_one({"email": email})
    if not record:
        raise HTTPException(status_code=400, detail="Request a code first.")

    expires_at = record.get("expires_at")
    if isinstance(expires_at, datetime):
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        if expires_at < now:
            await db.otp_codes.delete_one({"email": email})
            raise HTTPException(status_code=400, detail="This code has expired. Request a new one.")

    if record.get("attempts", 0) >= OTP_MAX_ATTEMPTS:
        await db.otp_codes.delete_one({"email": email})
        raise HTTPException(status_code=429, detail="Too many attempts. Request a new code.")

    if _hash_code(email, code) != record.get("code_hash"):
        await db.otp_codes.update_one({"email": email}, {"$inc": {"attempts": 1}})
        raise HTTPException(status_code=400, detail="Incorrect code. Please try again.")

    await db.otp_codes.delete_one({"email": email})

    existing = await db.users.find_one({"email": email}, {"_id": 0})
    if existing:
        user_id = existing["user_id"]
    else:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        await db.users.insert_one({
            "user_id": user_id,
            "email": email,
            "name": email.split("@")[0],
            "picture": None,
            "created_at": now.isoformat(),
        })

    session_token = secrets.token_urlsafe(32)
    await db.user_sessions.insert_one({
        "session_token": session_token,
        "user_id": user_id,
        "created_at": now,
        "expires_at": now + timedelta(days=7),
    })

    user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    return {"session_token": session_token, "user": user}


@api_router.get("/auth/me")
async def auth_me(user: dict = Depends(get_current_user)):
    return user


@api_router.post("/auth/logout")
async def logout(authorization: Optional[str] = Header(None)):
    if authorization and authorization.startswith("Bearer "):
        token = authorization.split(" ", 1)[1].strip()
        await db.user_sessions.delete_one({"session_token": token})
    return {"ok": True}


# ---------------------------------------------------------------------------
# Photo library routes
# ---------------------------------------------------------------------------
def _strip_data_uri(b64: str) -> str:
    if b64.startswith("data:"):
        return b64.split(",", 1)[1]
    return b64


@api_router.post("/photos", response_model=Photo)
async def add_photo(payload: PhotoCreate, user: dict = Depends(get_current_user)):
    photo_id = str(uuid.uuid4())
    doc = {
        "id": photo_id,
        "user_id": user["user_id"],
        "image_base64": _strip_data_uri(payload.image_base64),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.photos.insert_one(doc)
    doc.pop("_id", None)
    return Photo(**doc)


@api_router.get("/photos", response_model=List[Photo])
async def list_photos(user: dict = Depends(get_current_user)):
    docs = await db.photos.find({"user_id": user["user_id"]}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return [Photo(**d) for d in docs]


@api_router.delete("/photos/{photo_id}")
async def delete_photo(photo_id: str, user: dict = Depends(get_current_user)):
    res = await db.photos.delete_one({"id": photo_id, "user_id": user["user_id"]})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Photo not found")
    return {"ok": True}


# ---------------------------------------------------------------------------
# Memory generation routes
# ---------------------------------------------------------------------------
async def _load_photos_b64(photo_ids: List[str], user_id: str) -> List[str]:
    docs = await db.photos.find({"id": {"$in": photo_ids}, "user_id": user_id}, {"_id": 0}).to_list(20)
    return [d["image_base64"] for d in docs]


async def _save_memory(user_id: str, prompt: str, image_b64: str, photo_ids: List[str]) -> dict:
    title = prompt.strip()
    if len(title) > 48:
        title = title[:45].rstrip() + "..."
    doc = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "title": title,
        "prompt": prompt.strip(),
        "image_base64": image_b64,
        "source_photo_ids": photo_ids,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.memories.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api_router.post("/memories/generate", response_model=Memory)
async def generate_memory(payload: MemoryGenerateRequest, user: dict = Depends(get_current_user)):
    if not payload.prompt.strip():
        raise HTTPException(status_code=400, detail="A description of the memory is required")
    if not payload.photo_ids:
        raise HTTPException(status_code=400, detail="Select at least one photo")

    images_b64 = await _load_photos_b64(payload.photo_ids, user["user_id"])
    if not images_b64:
        raise HTTPException(status_code=400, detail="No valid photos found")

    try:
        generated_b64 = await image_engines.generate_fal(payload.prompt.strip(), images_b64)
    except RuntimeError as e:
        err = str(e).lower()
        if "balance" in err or "quota" in err or "payment" in err or "credits" in err:
            raise HTTPException(status_code=402, detail="fal.ai account has insufficient credits. Top up at fal.ai/dashboard.")
        raise HTTPException(status_code=500, detail=f"Generation failed: {str(e)[:200]}")
    except Exception as e:
        logger.error(f"Generation error: {str(e)[:400]}")
        raise HTTPException(status_code=500, detail="Generation failed. Please try again.")

    doc = await _save_memory(user["user_id"], payload.prompt, generated_b64, payload.photo_ids)
    return Memory(**doc)


@api_router.get("/memories", response_model=List[Memory])
async def list_memories(user: dict = Depends(get_current_user)):
    docs = await db.memories.find({"user_id": user["user_id"]}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return [Memory(**d) for d in docs]


@api_router.get("/memories/{memory_id}", response_model=Memory)
async def get_memory(memory_id: str, user: dict = Depends(get_current_user)):
    doc = await db.memories.find_one({"id": memory_id, "user_id": user["user_id"]}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Memory not found")
    return Memory(**doc)


@api_router.delete("/memories/{memory_id}")
async def delete_memory(memory_id: str, user: dict = Depends(get_current_user)):
    res = await db.memories.delete_one({"id": memory_id, "user_id": user["user_id"]})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Memory not found")
    return {"ok": True}


@api_router.get("/")
async def root():
    return {"message": "Memory Maker API", "status": "ok"}


# ---------------------------------------------------------------------------
# App wiring
# ---------------------------------------------------------------------------
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def create_indexes():
    # Validate required env vars
    missing = [k for k in ['MONGO_URL','RESEND_API_KEY','FAL_KEY'] if not os.environ.get(k)]
    if missing:
        logger.error(f"MISSING ENV VARS: {missing} — set these in Render dashboard")
    else:
        logger.info(f"All required env vars present ✅")

    await db.users.create_index("email", unique=True)
    await db.users.create_index("user_id", unique=True)
    await db.user_sessions.create_index("session_token", unique=True)
    await db.user_sessions.create_index("user_id")
    await db.user_sessions.create_index("expires_at", expireAfterSeconds=0)
    await db.photos.create_index("user_id")
    await db.memories.create_index("user_id")
    await db.otp_codes.create_index("email", unique=True)
    await db.otp_codes.create_index("expires_at", expireAfterSeconds=0)
    logger.info("Memory Maker API ready")


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()


