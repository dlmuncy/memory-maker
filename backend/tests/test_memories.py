"""Memory generation + memories CRUD tests. Uses REAL Gemini Nano Banana."""
import base64
import requests
import pytest


AUTH_ONLY_ENDPOINTS = [
    ("GET", "/api/memories"),
    ("GET", "/api/memories/some-id"),
    ("DELETE", "/api/memories/some-id"),
    ("POST", "/api/memories/generate"),
]


@pytest.mark.parametrize("method,path", AUTH_ONLY_ENDPOINTS)
def test_memories_endpoints_require_auth(base_url, method, path):
    r = requests.request(method, f"{base_url}{path}", json={"prompt": "x", "photo_ids": ["a"]})
    assert r.status_code == 401, f"{method} {path} -> {r.status_code}"


# ---- Validation for /memories/generate --------------------------------------
def test_generate_empty_prompt_returns_400(base_url, auth_headers):
    r = requests.post(
        f"{base_url}/api/memories/generate",
        headers=auth_headers,
        json={"prompt": "   ", "photo_ids": ["anything"]},
    )
    assert r.status_code == 400, r.text


def test_generate_missing_photo_ids_returns_400(base_url, auth_headers):
    r = requests.post(
        f"{base_url}/api/memories/generate",
        headers=auth_headers,
        json={"prompt": "Family ski trip in Aspen", "photo_ids": []},
    )
    assert r.status_code == 400, r.text


def test_generate_with_no_matching_photos_returns_400(base_url, auth_headers):
    r = requests.post(
        f"{base_url}/api/memories/generate",
        headers=auth_headers,
        json={"prompt": "Cancun beach vacation", "photo_ids": ["nonexistent-photo-id"]},
    )
    assert r.status_code == 400, r.text


# ---- REAL generation --------------------------------------------------------
@pytest.fixture(scope="module")
def uploaded_person_photo_id(base_url, auth_headers):
    """Upload a real person photo for use in generation.

    We use a public 512x512 test photo of a person. If unavailable, fall back
    to any bundled asset."""
    b64 = None
    try:
        # A small stock face-like image (Unsplash-style avatar). Use pravatar.
        resp = requests.get("https://i.pravatar.cc/300", timeout=15)
        if resp.status_code == 200 and resp.content:
            b64 = base64.b64encode(resp.content).decode()
    except Exception:
        b64 = None

    if not b64:
        # Fallback to tiny bundled asset via fixture would need refactor; skip
        pytest.skip("Could not obtain a real reference photo for generation test")

    r = requests.post(f"{base_url}/api/photos", headers=auth_headers, json={"image_base64": b64})
    assert r.status_code == 200, r.text
    pid = r.json()["id"]
    yield pid
    requests.delete(f"{base_url}/api/photos/{pid}", headers=auth_headers)


def test_generate_memory_real_gemini_returns_image(base_url, auth_headers, uploaded_person_photo_id):
    """Hits the REAL Gemini Nano Banana model — consumes credits.
    Allowed up to ~120s."""
    payload = {
        "prompt": "The subject standing on a snowy mountain at a family ski lodge, holding a hot cocoa, golden hour light",
        "photo_ids": [uploaded_person_photo_id],
    }
    r = requests.post(
        f"{base_url}/api/memories/generate",
        headers=auth_headers,
        json=payload,
        timeout=180,
    )
    assert r.status_code == 200, f"Generate failed {r.status_code}: {r.text[:500]}"
    mem = r.json()
    assert mem["user_id"] == "user_testabc123"
    assert mem["prompt"].startswith("The subject standing on a snowy")
    assert uploaded_person_photo_id in mem["source_photo_ids"]
    assert isinstance(mem["image_base64"], str)
    assert len(mem["image_base64"]) > 5000, "Generated image_base64 too small — likely empty"
    # title truncation
    assert len(mem["title"]) <= 48
    # store id for downstream tests via env-like module attr
    test_generate_memory_real_gemini_returns_image.memory_id = mem["id"]


def test_list_memories_contains_generated(base_url, auth_headers):
    mem_id = getattr(test_generate_memory_real_gemini_returns_image, "memory_id", None)
    if not mem_id:
        pytest.skip("Generation test did not run/succeed")
    r = requests.get(f"{base_url}/api/memories", headers=auth_headers)
    assert r.status_code == 200
    ids = [m["id"] for m in r.json()]
    assert mem_id in ids


def test_get_memory_by_id(base_url, auth_headers):
    mem_id = getattr(test_generate_memory_real_gemini_returns_image, "memory_id", None)
    if not mem_id:
        pytest.skip("Generation test did not run/succeed")
    r = requests.get(f"{base_url}/api/memories/{mem_id}", headers=auth_headers)
    assert r.status_code == 200
    assert r.json()["id"] == mem_id


def test_get_memory_missing_returns_404(base_url, auth_headers):
    r = requests.get(f"{base_url}/api/memories/nope-not-real", headers=auth_headers)
    assert r.status_code == 404


def test_delete_memory_then_404(base_url, auth_headers):
    mem_id = getattr(test_generate_memory_real_gemini_returns_image, "memory_id", None)
    if not mem_id:
        pytest.skip("Generation test did not run/succeed")
    r = requests.delete(f"{base_url}/api/memories/{mem_id}", headers=auth_headers)
    assert r.status_code == 200
    r2 = requests.get(f"{base_url}/api/memories/{mem_id}", headers=auth_headers)
    assert r2.status_code == 404


def test_delete_memory_missing_returns_404(base_url, auth_headers):
    r = requests.delete(f"{base_url}/api/memories/does-not-exist", headers=auth_headers)
    assert r.status_code == 404
