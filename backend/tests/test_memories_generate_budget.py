"""Iteration 3 focused test: /api/memories/generate must return a 4xx (402) with a
clear JSON `detail` when the Emergent Universal LLM key budget is exhausted —
NOT a 502 (which the ingress rewrites and hides the real message).

Preconditions:
- The Emergent LLM key budget is currently exhausted in this environment, so
  every real generation call is expected to trip the budget branch.
- We seed a valid photo for the test user via conftest's seeded session so the
  request gets past validation and actually reaches the LLM call.
"""
import base64
from pathlib import Path

import requests
import pytest


def _small_jpeg_b64():
    """Return a small real image, base64-encoded, for uploading as a photo."""
    for candidate in [
        Path("/app/frontend/assets/images/icon.png"),
        Path("/app/frontend/assets/images/splash-icon.png"),
    ]:
        if candidate.exists():
            return base64.b64encode(candidate.read_bytes()).decode()
    # Fallback: minimal 1x1 JPEG
    hexs = (
        "ffd8ffe000104a46494600010100000100010000ffdb004300080606070605080707070909080a0c14"
        "0d0c0b0b0c1912130f141d1a1f1e1d1a1c1c20242e2720222c231c1c2837292c30313434341f27393d"
        "38323c2e333432ffc00011080001000103012200021101031101ffc4001f00000105010101010101"
        "00000000000000000102030405060708090a0bffc400b5100002010303020403050504040000017d0102"
        "0300041105122131410613516107227114328191a1082342b1c11552d1f02433627282090a161718191a"
        "25262728292a3435363738393a434445464748494a535455565758595a636465666768696a7374757677"
        "78797a838485868788898a92939495969798999aa2a3a4a5a6a7a8a9aab2b3b4b5b6b7b8b9bac2c3c4c5"
        "c6c7c8c9cad2d3d4d5d6d7d8d9dae1e2e3e4e5e6e7e8e9eaf1f2f3f4f5f6f7f8f9faffda000c03010002"
        "1103110000003f00fbfbc000ffd9"
    )
    return base64.b64encode(bytes.fromhex(hexs)).decode()


@pytest.fixture(scope="module")
def photo_id(base_url, auth_headers):
    r = requests.post(
        f"{base_url}/api/photos",
        headers=auth_headers,
        json={"image_base64": _small_jpeg_b64()},
        timeout=30,
    )
    assert r.status_code == 200, r.text
    pid = r.json()["id"]
    yield pid
    requests.delete(f"{base_url}/api/photos/{pid}", headers=auth_headers)


# ---- Validation still returns 400 (regression) ------------------------------
def test_empty_prompt_returns_400_json(base_url, auth_headers, photo_id):
    r = requests.post(
        f"{base_url}/api/memories/generate",
        headers=auth_headers,
        json={"prompt": "   ", "photo_ids": [photo_id]},
        timeout=15,
    )
    assert r.status_code == 400, r.text
    body = r.json()
    assert body.get("detail"), f"400 missing detail: {body}"


def test_missing_photo_ids_returns_400_json(base_url, auth_headers):
    r = requests.post(
        f"{base_url}/api/memories/generate",
        headers=auth_headers,
        json={"prompt": "Visiting the Egyptian pyramids", "photo_ids": []},
        timeout=15,
    )
    assert r.status_code == 400, r.text
    body = r.json()
    assert body.get("detail"), f"400 missing detail: {body}"


def test_invalid_photo_ids_returns_400_json(base_url, auth_headers):
    r = requests.post(
        f"{base_url}/api/memories/generate",
        headers=auth_headers,
        json={
            "prompt": "Visiting the Egyptian pyramids",
            "photo_ids": ["nonexistent-photo-xyz"],
        },
        timeout=15,
    )
    assert r.status_code == 400, r.text
    body = r.json()
    assert body.get("detail"), f"400 missing detail: {body}"


# ---- Iteration 3 primary check: budget-exceeded -> 402 with clear detail ----
def test_generate_budget_exhausted_returns_402_with_actionable_detail(
    base_url, auth_headers, photo_id
):
    """This is the fix under test. With the Emergent LLM key budget exhausted,
    /api/memories/generate MUST return a 402 (a 4xx – so ingress does NOT rewrite
    it like a 502) with a JSON body containing a clear `detail` string that
    tells the user to add balance to the Universal Key.
    """
    payload = {
        "prompt": "Visiting the Egyptian pyramids",
        "photo_ids": [photo_id],
    }
    r = requests.post(
        f"{base_url}/api/memories/generate",
        headers=auth_headers,
        json=payload,
        timeout=120,
    )

    # Must NOT be a 5xx (would be rewritten by ingress and hide the real msg)
    assert r.status_code < 500, (
        f"Generate returned {r.status_code} (5xx) — ingress will rewrite this "
        f"and hide the message. Body: {r.text[:500]}"
    )

    # If budget was refilled we'd get 200. In current env it's exhausted -> 402.
    if r.status_code == 200:
        pytest.skip("Budget appears to be available; can't verify 402 branch in this run.")

    assert r.status_code == 402, (
        f"Expected 402 on budget-exhausted, got {r.status_code}. Body: {r.text[:500]}"
    )

    # Body must be valid JSON with an actionable `detail`
    ctype = r.headers.get("content-type", "")
    assert "application/json" in ctype, f"Not JSON content-type: {ctype}"
    body = r.json()
    assert "detail" in body, f"Missing `detail` field: {body}"
    detail = body["detail"]
    assert isinstance(detail, str) and detail.strip(), f"`detail` is empty: {body}"

    # Detail must be actionable — mention credits/balance/key/budget, not generic
    lowered = detail.lower()
    assert any(kw in lowered for kw in ("credit", "balance", "universal key", "budget")), (
        f"402 detail is not actionable (should mention credits/balance/key): {detail}"
    )

    # Explicitly NOT a generic message
    assert "something went wrong" not in lowered, (
        f"Detail is still generic: {detail}"
    )
