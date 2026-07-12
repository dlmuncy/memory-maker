import os
import uuid
import logging
from pathlib import Path
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Annotated

import httpx
from fastapi import FastAPI, APIRouter, Header, HTTPException, Depends
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, BeforeValidator

from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# ---------------------------------------------------------------------------
# Setup
# ---------------------------------------------------------------------------
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

EMERGENT_LLM_KEY = os.environ['EMERGENT_LLM_KEY']
GEMINI_IMAGE_MODEL = "gemini-3.1-flash-image-preview"
EMERGENT_SESSION_API = "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data"

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


class SessionRequest(BaseModel):
    session_id: str


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
# Auth routes
# ---------------------------------------------------------------------------
@api_router.post("/auth/session")
async def create_session(payload: SessionRequest):
    """Exchange the temporary session_id for a persistent session_token via Emergent,
    upsert the user, and create an app session."""
    async with httpx.AsyncClient(timeout=30) as http:
        resp = await http.get(
            EMERGENT_SESSION_API,
            headers={"X-Session-ID": payload.session_id},
        )
    if resp.status_code != 200:
        raise HTTPException(status_code=401, detail="Failed to verify session id")

    data = resp.json()
    email = data["email"]
    name = data.get("name", email.split("@")[0])
    picture = data.get("picture")
    session_token = data["session_token"]

    existing = await db.users.find_one({"email": email}, {"_id": 0})
    if existing:
        user_id = existing["user_id"]
    else:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        await db.users.insert_one({
            "user_id": user_id,
            "email": email,
            "name": name,
            "picture": picture,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })

    await db.user_sessions.update_one(
        {"session_token": session_token},
        {"$set": {
            "session_token": session_token,
            "user_id": user_id,
            "created_at": datetime.now(timezone.utc),
            "expires_at": datetime.now(timezone.utc) + timedelta(days=7),
        }},
        upsert=True,
    )

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
GENERATION_SYSTEM_MSG = (
    "You are an expert photorealistic image compositor. Your task is to recreate the "
    "exact people/subjects shown in the provided reference photos and place them naturally "
    "into a new scene. Preserve each person's facial features, identity, age, skin tone, "
    "hair and body proportions with extreme accuracy. Match lighting, perspective and shadows "
    "of the described environment so the result looks like a real candid photograph."
)


@api_router.post("/memories/generate", response_model=Memory)
async def generate_memory(payload: MemoryGenerateRequest, user: dict = Depends(get_current_user)):
    if not payload.prompt.strip():
        raise HTTPException(status_code=400, detail="A description of the memory is required")
    if not payload.photo_ids:
        raise HTTPException(status_code=400, detail="Select at least one photo")

    docs = await db.photos.find(
        {"id": {"$in": payload.photo_ids}, "user_id": user["user_id"]}, {"_id": 0}
    ).to_list(20)
    if not docs:
        raise HTTPException(status_code=400, detail="No valid photos found")

    file_contents = [ImageContent(_strip_data_uri(d["image_base64"])) for d in docs]

    scene_prompt = (
        f"Using the {len(file_contents)} reference photo(s) of the same person/people, "
        f"create ONE new photorealistic image that places these exact subjects into the "
        f"following scene: {payload.prompt.strip()}. "
        f"Keep their faces and identities perfectly recognizable. High detail, natural lighting, "
        f"realistic composition."
    )

    try:
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"memgen-{uuid.uuid4().hex}",
            system_message=GENERATION_SYSTEM_MSG,
        )
        chat.with_model("gemini", GEMINI_IMAGE_MODEL).with_params(modalities=["image", "text"])
        msg = UserMessage(text=scene_prompt, file_contents=file_contents)
        text, images = await chat.send_message_multimodal_response(msg)
    except Exception as e:
        logger.error(f"Gemini generation failed: {e}")
        raise HTTPException(status_code=502, detail="Image generation failed. Please try again.")

    if not images:
        logger.error(f"No image returned. Text: {str(text)[:200]}")
        raise HTTPException(status_code=502, detail="The model did not return an image. Try rephrasing your memory.")

    generated_b64 = images[0]["data"]

    title = payload.prompt.strip()
    if len(title) > 48:
        title = title[:45].rstrip() + "..."

    memory_id = str(uuid.uuid4())
    doc = {
        "id": memory_id,
        "user_id": user["user_id"],
        "title": title,
        "prompt": payload.prompt.strip(),
        "image_base64": generated_b64,
        "source_photo_ids": payload.photo_ids,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.memories.insert_one(doc)
    doc.pop("_id", None)
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
    return {"message": "Memory Maker API"}


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
    await db.users.create_index("email", unique=True)
    await db.users.create_index("user_id", unique=True)
    await db.user_sessions.create_index("session_token", unique=True)
    await db.user_sessions.create_index("user_id")
    await db.user_sessions.create_index("expires_at", expireAfterSeconds=0)
    await db.photos.create_index("user_id")
    await db.memories.create_index("user_id")
    logger.info("Indexes ensured")


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
