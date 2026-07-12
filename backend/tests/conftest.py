"""Shared pytest fixtures for Memory Maker backend tests."""
import os
import base64
import asyncio
from datetime import datetime, timezone, timedelta
from pathlib import Path

import pytest
import requests
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

# Load backend env to reach the SAME MongoDB the app uses
load_dotenv(Path(__file__).parent.parent / ".env")
# Also load frontend env to get the public ingress URL users hit
load_dotenv(Path("/app/frontend/.env"))

# Use the public (ingress) URL – this is what real users hit
BASE_URL = (
    os.environ.get("EXPO_PUBLIC_BACKEND_URL")
    or os.environ.get("EXPO_BACKEND_URL")
).rstrip("/")

TEST_USER_ID = "user_testabc123"
TEST_SESSION_TOKEN = "test-token-abc"
TEST_EMAIL = "tester@example.com"


@pytest.fixture(scope="session")
def base_url():
    return BASE_URL


@pytest.fixture(scope="session")
def auth_headers():
    return {"Authorization": f"Bearer {TEST_SESSION_TOKEN}"}


@pytest.fixture(scope="session")
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session", autouse=True)
def seed_user_and_session():
    """Seed a user + session directly in MongoDB so we can hit auth-gated endpoints
    without going through Google OAuth. Cleaned up at the end of the run."""
    async def _seed():
        client = AsyncIOMotorClient(os.environ["MONGO_URL"])
        db = client[os.environ["DB_NAME"]]
        # Clean prior state
        await db.users.delete_many({"user_id": TEST_USER_ID})
        await db.user_sessions.delete_many({"session_token": TEST_SESSION_TOKEN})
        await db.photos.delete_many({"user_id": TEST_USER_ID})
        await db.memories.delete_many({"user_id": TEST_USER_ID})

        await db.users.insert_one({
            "user_id": TEST_USER_ID,
            "email": TEST_EMAIL,
            "name": "Tester",
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        await db.user_sessions.insert_one({
            "session_token": TEST_SESSION_TOKEN,
            "user_id": TEST_USER_ID,
            "created_at": datetime.now(timezone.utc),
            "expires_at": datetime.now(timezone.utc) + timedelta(days=7),
        })
        client.close()

    asyncio.run(_seed())
    yield

    async def _cleanup():
        client = AsyncIOMotorClient(os.environ["MONGO_URL"])
        db = client[os.environ["DB_NAME"]]
        await db.photos.delete_many({"user_id": TEST_USER_ID})
        await db.memories.delete_many({"user_id": TEST_USER_ID})
        await db.user_sessions.delete_many({"session_token": TEST_SESSION_TOKEN})
        await db.users.delete_many({"user_id": TEST_USER_ID})
        client.close()

    asyncio.run(_cleanup())


@pytest.fixture(scope="session")
def sample_jpeg_b64():
    """Return a base64-encoded small real JPEG. Prefer a bundled asset,
    otherwise fall back to a tiny valid JPEG byte stream."""
    # Try to find any image asset in the repo
    for candidate in [
        Path("/app/frontend/assets/images/icon.png"),
        Path("/app/frontend/assets/images/splash-icon.png"),
    ]:
        if candidate.exists():
            return base64.b64encode(candidate.read_bytes()).decode()

    # Minimal 1x1 white JPEG
    tiny_jpeg_hex = (
        "ffd8ffe000104a46494600010100000100010000ffdb004300080606070605080707070909080a0c140d0c0b0b0c1912130f141d1a"
        "1f1e1d1a1c1c20242e2720222c231c1c2837292c30313434341f27393d38323c2e333432ffdb0043010909090c0b0c180d0d1832"
        "211c213232323232323232323232323232323232323232323232323232323232323232323232323232323232323232323232323232"
        "ffc00011080001000103012200021101031101ffc4001f0000010501010101010100000000000000000102030405060708090a0b"
        "ffc400b5100002010303020403050504040000017d01020300041105122131410613516107227114328191a1082342b1c11552d1"
        "f02433627282090a161718191a25262728292a3435363738393a434445464748494a535455565758595a636465666768696a7374"
        "75767778797a838485868788898a92939495969798999aa2a3a4a5a6a7a8a9aab2b3b4b5b6b7b8b9bac2c3c4c5c6c7c8c9cad2d3"
        "d4d5d6d7d8d9dae1e2e3e4e5e6e7e8e9eaf1f2f3f4f5f6f7f8f9faffc4001f0100030101010101010101010000000000000102"
        "030405060708090a0bffc400b51100020102040403040705040400010277000102031104052131061241510761711322328108"
        "144291a1b1c109233352f0156272d10a162434e125f11718191a262728292a35363738393a434445464748494a535455565758"
        "595a636465666768696a737475767778797a82838485868788898a92939495969798999aa2a3a4a5a6a7a8a9aab2b3b4b5b6b7"
        "b8b9bac2c3c4c5c6c7c8c9cad2d3d4d5d6d7d8d9dae2e3e4e5e6e7e8e9eaf2f3f4f5f6f7f8f9faffda000c03010002110311003f"
        "00fbfbc000ffd9"
    )
    return base64.b64encode(bytes.fromhex(tiny_jpeg_hex)).decode()
