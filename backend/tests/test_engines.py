"""Dual image-engine tests (Gemini + fal.ai).

Real external APIs are called — fal.ai key is WORKING, Gemini key is
quota-exhausted (429 → surfaced as HTTP 402 with billing message).
"""
import base64
import requests
import pytest


# ---------------- validation ----------------
def test_generate_empty_prompt_400(base_url, auth_headers):
    r = requests.post(
        f"{base_url}/api/memories/generate",
        headers=auth_headers,
        json={"prompt": "  ", "photo_ids": ["x"], "engine": "fal"},
    )
    assert r.status_code == 400, r.text


def test_generate_missing_photos_400(base_url, auth_headers):
    r = requests.post(
        f"{base_url}/api/memories/generate",
        headers=auth_headers,
        json={"prompt": "Family beach day", "photo_ids": [], "engine": "fal"},
    )
    assert r.status_code == 400, r.text


def test_compare_empty_prompt_400(base_url, auth_headers):
    r = requests.post(
        f"{base_url}/api/memories/generate-compare",
        headers=auth_headers,
        json={"prompt": "", "photo_ids": ["x"]},
    )
    assert r.status_code == 400, r.text


def test_compare_missing_photos_400(base_url, auth_headers):
    r = requests.post(
        f"{base_url}/api/memories/generate-compare",
        headers=auth_headers,
        json={"prompt": "Family beach day", "photo_ids": []},
    )
    assert r.status_code == 400, r.text


def test_compare_requires_auth(base_url):
    r = requests.post(
        f"{base_url}/api/memories/generate-compare",
        json={"prompt": "x", "photo_ids": ["y"]},
    )
    assert r.status_code == 401


# ---------------- shared uploaded photo ----------------
@pytest.fixture(scope="module")
def uploaded_photo_id(base_url, auth_headers):
    b64 = None
    try:
        resp = requests.get("https://i.pravatar.cc/512", timeout=15)
        if resp.status_code == 200 and resp.content:
            b64 = base64.b64encode(resp.content).decode()
    except Exception:
        pass
    if not b64:
        pytest.skip("No reference photo available")

    r = requests.post(f"{base_url}/api/photos", headers=auth_headers, json={"image_base64": b64})
    assert r.status_code == 200, r.text
    pid = r.json()["id"]
    yield pid
    requests.delete(f"{base_url}/api/photos/{pid}", headers=auth_headers)


# ---------------- fal.ai engine (expected 200) ----------------
def test_generate_fal_success(base_url, auth_headers, uploaded_photo_id):
    r = requests.post(
        f"{base_url}/api/memories/generate",
        headers=auth_headers,
        json={
            "prompt": "on a family cruise through Antarctica at golden hour with penguins nearby",
            "photo_ids": [uploaded_photo_id],
            "engine": "fal",
        },
        timeout=180,
    )
    assert r.status_code == 200, f"fal generate returned {r.status_code}: {r.text[:400]}"
    mem = r.json()
    assert mem["engine"] == "fal"
    assert mem["user_id"] == "user_testabc123"
    assert isinstance(mem["image_base64"], str) and len(mem["image_base64"]) > 5000
    assert uploaded_photo_id in mem["source_photo_ids"]
    assert len(mem["title"]) <= 48
    # persistence check
    lr = requests.get(f"{base_url}/api/memories", headers=auth_headers)
    assert lr.status_code == 200
    all_ids = [m["id"] for m in lr.json()]
    assert mem["id"] in all_ids
    engines_in_gallery = {m["engine"] for m in lr.json()}
    assert "fal" in engines_in_gallery
    test_generate_fal_success.mem_id = mem["id"]


def test_get_fal_memory(base_url, auth_headers):
    mid = getattr(test_generate_fal_success, "mem_id", None)
    if not mid:
        pytest.skip("fal generation did not succeed")
    r = requests.get(f"{base_url}/api/memories/{mid}", headers=auth_headers)
    assert r.status_code == 200
    body = r.json()
    assert body["id"] == mid and body["engine"] == "fal"


# ---------------- Gemini engine (expected 402 billing message) ----------------
def test_generate_gemini_quota_402(base_url, auth_headers, uploaded_photo_id):
    r = requests.post(
        f"{base_url}/api/memories/generate",
        headers=auth_headers,
        json={
            "prompt": "on a snowy mountain lodge, hot cocoa, golden hour",
            "photo_ids": [uploaded_photo_id],
            "engine": "gemini",
        },
        timeout=120,
    )
    # Must be a proper 4xx (not 5xx) so ingress passes JSON through
    assert r.status_code == 402, f"expected 402 quota, got {r.status_code}: {r.text[:400]}"
    body = r.json()
    assert "detail" in body
    d = body["detail"].lower()
    assert "gemini" in d and ("quota" in d or "billing" in d or "429" in d)


# ---------------- generate-compare (fal ok, gemini fail) ----------------
def test_generate_compare_dual(base_url, auth_headers, uploaded_photo_id):
    r = requests.post(
        f"{base_url}/api/memories/generate-compare",
        headers=auth_headers,
        json={
            "prompt": "family portrait on a Tuscany vineyard at sunset",
            "photo_ids": [uploaded_photo_id],
        },
        timeout=240,
    )
    assert r.status_code == 200, f"compare returned {r.status_code}: {r.text[:500]}"
    body = r.json()
    assert set(body.keys()) >= {"gemini", "fal"}
    # fal expected OK
    fal = body["fal"]
    assert fal["ok"] is True, f"fal.ok=False → {fal}"
    assert "memory" in fal and isinstance(fal["memory"]["image_base64"], str)
    assert len(fal["memory"]["image_base64"]) > 5000
    assert fal["memory"]["engine"] == "fal"
    # gemini expected FAIL with a billing/quota message
    gem = body["gemini"]
    assert gem["ok"] is False, f"gemini.ok=True unexpected → {gem}"
    err = (gem.get("error") or "").lower()
    assert "gemini" in err and ("quota" in err or "billing" in err or "429" in err), (
        f"gemini error is not the billing message: {gem.get('error')}"
    )
    # saved fal memory should be visible in gallery
    lr = requests.get(f"{base_url}/api/memories", headers=auth_headers)
    assert lr.status_code == 200
    saved_ids = [m["id"] for m in lr.json()]
    assert fal["memory"]["id"] in saved_ids


# ---------------- regression: memory object has engine field ----------------
def test_list_memories_have_engine_field(base_url, auth_headers):
    r = requests.get(f"{base_url}/api/memories", headers=auth_headers)
    assert r.status_code == 200
    mems = r.json()
    if not mems:
        pytest.skip("No memories yet")
    for m in mems:
        assert "engine" in m and m["engine"] in ("gemini", "fal")
