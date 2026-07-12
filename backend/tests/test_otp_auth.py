"""Email OTP authentication tests (Memory Maker)."""
import os
import time
import uuid
import hashlib
import asyncio
from datetime import datetime, timezone, timedelta

import pytest
import requests
from motor.motor_asyncio import AsyncIOMotorClient


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _fresh_email() -> str:
    # Resend test mode only delivers to the account owner OR its sandbox `delivered@resend.dev`.
    # Plus-addressing is accepted, giving us unique fresh emails per test.
    return f"delivered+{uuid.uuid4().hex[:12]}@resend.dev"


def _mongo():
    return AsyncIOMotorClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]


async def _read_hash(email: str) -> dict:
    return await _mongo().otp_codes.find_one({"email": email.lower()})


async def _delete_otp(email: str):
    await _mongo().otp_codes.delete_one({"email": email.lower()})


async def _delete_user(email: str):
    db = _mongo()
    user = await db.users.find_one({"email": email.lower()}, {"user_id": 1})
    if user:
        await db.user_sessions.delete_many({"user_id": user["user_id"]})
        await db.photos.delete_many({"user_id": user["user_id"]})
        await db.memories.delete_many({"user_id": user["user_id"]})
    await db.users.delete_many({"email": email.lower()})
    await db.otp_codes.delete_many({"email": email.lower()})


def _brute_force(email: str, code_hash: str) -> str:
    prefix = f"{email.lower()}:".encode()
    for i in range(1_000_000):
        h = hashlib.sha256(prefix + f"{i:06d}".encode()).hexdigest()
        if h == code_hash:
            return f"{i:06d}"
    raise AssertionError("Failed to brute-force OTP")


# ---------------------------------------------------------------------------
# request-otp
# ---------------------------------------------------------------------------
def test_request_otp_invalid_email_returns_422(base_url, api):
    r = api.post(f"{base_url}/api/auth/request-otp", json={"email": "not-an-email"})
    assert r.status_code == 422, r.text


def test_request_otp_success_stores_hashed_code(base_url, api):
    email = _fresh_email()
    try:
        r = api.post(f"{base_url}/api/auth/request-otp", json={"email": email})
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("ok") is True
        assert body.get("email") == email.lower()

        doc = asyncio.run(_read_hash(email))
        assert doc is not None, "otp_codes doc should be present"
        assert "code_hash" in doc and len(doc["code_hash"]) == 64
        # Plaintext code MUST NOT be stored
        assert "code" not in doc
        assert doc.get("attempts", 0) == 0
    finally:
        asyncio.run(_delete_user(email))


def test_request_otp_cooldown_returns_429(base_url, api):
    email = _fresh_email()
    try:
        r1 = api.post(f"{base_url}/api/auth/request-otp", json={"email": email})
        assert r1.status_code == 200, r1.text
        # Immediately request again — should be rate-limited (30s cooldown)
        r2 = api.post(f"{base_url}/api/auth/request-otp", json={"email": email})
        assert r2.status_code == 429, r2.text
    finally:
        asyncio.run(_delete_user(email))


# ---------------------------------------------------------------------------
# verify-otp
# ---------------------------------------------------------------------------
def test_verify_otp_wrong_code_400_and_increments_attempts(base_url, api):
    email = _fresh_email()
    try:
        assert api.post(f"{base_url}/api/auth/request-otp", json={"email": email}).status_code == 200

        r = api.post(f"{base_url}/api/auth/verify-otp", json={"email": email, "code": "000000"})
        # We might occasionally hit the real code by luck (1 in 1M) — accept both, but usually 400
        if r.status_code == 200:
            pytest.skip("Lucky guess hit the real OTP; skipping attempts check")
        assert r.status_code == 400, r.text

        doc = asyncio.run(_read_hash(email))
        assert doc is not None and doc.get("attempts", 0) >= 1
    finally:
        asyncio.run(_delete_user(email))


def test_verify_otp_lockout_after_5_wrong_attempts_returns_429(base_url, api):
    email = _fresh_email()
    try:
        assert api.post(f"{base_url}/api/auth/request-otp", json={"email": email}).status_code == 200

        wrong_codes = ["111111", "222222", "333333", "444444", "555555"]
        statuses = []
        for c in wrong_codes:
            r = api.post(f"{base_url}/api/auth/verify-otp", json={"email": email, "code": c})
            statuses.append(r.status_code)

        # 6th attempt should be locked out with 429
        r6 = api.post(f"{base_url}/api/auth/verify-otp", json={"email": email, "code": "666666"})
        assert r6.status_code == 429, f"Expected 429 after 5 wrong attempts, got {r6.status_code} ({r6.text}). Prior statuses: {statuses}"

        # After lockout, the OTP doc must be deleted
        doc = asyncio.run(_read_hash(email))
        assert doc is None, "OTP doc should be deleted after lockout"
    finally:
        asyncio.run(_delete_user(email))


def test_verify_otp_expired_returns_400(base_url, api):
    email = _fresh_email()
    try:
        assert api.post(f"{base_url}/api/auth/request-otp", json={"email": email}).status_code == 200

        # Force the doc to be expired
        async def _expire():
            await _mongo().otp_codes.update_one(
                {"email": email.lower()},
                {"$set": {"expires_at": datetime.now(timezone.utc) - timedelta(minutes=1)}},
            )
        asyncio.run(_expire())

        r = api.post(f"{base_url}/api/auth/verify-otp", json={"email": email, "code": "000000"})
        assert r.status_code == 400, r.text
        assert "expired" in r.text.lower()

        # Expired doc should be removed
        assert asyncio.run(_read_hash(email)) is None
    finally:
        asyncio.run(_delete_user(email))


def test_verify_otp_without_request_returns_400(base_url, api):
    email = _fresh_email()
    r = api.post(f"{base_url}/api/auth/verify-otp", json={"email": email, "code": "123456"})
    assert r.status_code == 400, r.text


def test_end_to_end_login_returns_session_token_and_consumes_otp(base_url, api):
    """Full happy path: request-otp -> brute-force code from Mongo hash -> verify-otp -> /auth/me."""
    email = _fresh_email()
    try:
        r = api.post(f"{base_url}/api/auth/request-otp", json={"email": email})
        assert r.status_code == 200, r.text

        doc = asyncio.run(_read_hash(email))
        assert doc, "otp doc should exist"
        code = _brute_force(email, doc["code_hash"])

        v = api.post(f"{base_url}/api/auth/verify-otp", json={"email": email, "code": code})
        assert v.status_code == 200, v.text
        data = v.json()
        assert "session_token" in data and len(data["session_token"]) > 10
        assert data["user"]["email"] == email.lower()
        assert "user_id" in data["user"]
        assert "_id" not in data["user"]

        # OTP must be consumed
        assert asyncio.run(_read_hash(email)) is None

        # /auth/me with the new session_token
        me = requests.get(
            f"{base_url}/api/auth/me",
            headers={"Authorization": f"Bearer {data['session_token']}"},
        )
        assert me.status_code == 200, me.text
        assert me.json()["email"] == email.lower()

        # /auth/me without token -> 401
        assert requests.get(f"{base_url}/api/auth/me").status_code == 401
    finally:
        asyncio.run(_delete_user(email))


# ---------------------------------------------------------------------------
# Regression: authed endpoints work with an OTP-issued session_token
# ---------------------------------------------------------------------------
@pytest.fixture(scope="module")
def otp_session(base_url, api):
    email = _fresh_email()
    r = api.post(f"{base_url}/api/auth/request-otp", json={"email": email})
    assert r.status_code == 200, r.text
    doc = asyncio.run(_read_hash(email))
    code = _brute_force(email, doc["code_hash"])
    v = api.post(f"{base_url}/api/auth/verify-otp", json={"email": email, "code": code})
    assert v.status_code == 200, v.text
    token = v.json()["session_token"]
    yield {"email": email, "token": token, "headers": {"Authorization": f"Bearer {token}"}}
    asyncio.run(_delete_user(email))


def test_photos_crud_with_otp_session(base_url, otp_session, sample_jpeg_b64):
    h = otp_session["headers"]

    # Create
    r = requests.post(f"{base_url}/api/photos", json={"image_base64": sample_jpeg_b64}, headers=h)
    assert r.status_code == 200, r.text
    photo = r.json()
    assert photo.get("id") and photo.get("user_id") and photo.get("image_base64")
    photo_id = photo["id"]

    # List
    r = requests.get(f"{base_url}/api/photos", headers=h)
    assert r.status_code == 200, r.text
    ids = [p["id"] for p in r.json()]
    assert photo_id in ids

    # Delete
    r = requests.delete(f"{base_url}/api/photos/{photo_id}", headers=h)
    assert r.status_code == 200, r.text
    assert r.json().get("ok") is True

    # Confirm gone
    r = requests.get(f"{base_url}/api/photos", headers=h)
    assert photo_id not in [p["id"] for p in r.json()]


def test_memories_list_and_generation_validation_with_otp_session(base_url, otp_session):
    h = otp_session["headers"]

    # Empty prompt -> 400
    r = requests.post(
        f"{base_url}/api/memories/generate",
        json={"prompt": "  ", "photo_ids": ["nope"]},
        headers=h,
    )
    assert r.status_code == 400, r.text

    # No photo_ids -> 400
    r = requests.post(
        f"{base_url}/api/memories/generate",
        json={"prompt": "a nice memory", "photo_ids": []},
        headers=h,
    )
    assert r.status_code == 400, r.text

    # Invalid photo_ids -> 400 ("No valid photos found")
    r = requests.post(
        f"{base_url}/api/memories/generate",
        json={"prompt": "a nice memory", "photo_ids": ["does-not-exist"]},
        headers=h,
    )
    assert r.status_code == 400, r.text

    # List memories (empty is fine)
    r = requests.get(f"{base_url}/api/memories", headers=h)
    assert r.status_code == 200, r.text
    assert isinstance(r.json(), list)
