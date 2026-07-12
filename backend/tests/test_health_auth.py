"""Health + auth endpoint tests for Memory Maker."""
import requests


# ---- Health -----------------------------------------------------------------
def test_root_health(base_url, api):
    r = api.get(f"{base_url}/api/")
    assert r.status_code == 200, r.text
    body = r.json()
    assert body.get("message") == "Memory Maker API"


# ---- Auth -------------------------------------------------------------------
def test_auth_session_with_bogus_session_id_returns_401(base_url, api):
    r = api.post(f"{base_url}/api/auth/session", json={"session_id": "bogus-session-xyz-does-not-exist"})
    assert r.status_code == 401, f"Expected 401, got {r.status_code}: {r.text}"


def test_auth_me_without_token_returns_401(base_url, api):
    r = requests.get(f"{base_url}/api/auth/me")  # no auth header
    assert r.status_code == 401, r.text


def test_auth_me_with_invalid_token_returns_401(base_url, api):
    r = requests.get(f"{base_url}/api/auth/me", headers={"Authorization": "Bearer completely-bogus-token"})
    assert r.status_code == 401, r.text


def test_auth_me_with_valid_seeded_token_returns_user(base_url, auth_headers):
    r = requests.get(f"{base_url}/api/auth/me", headers=auth_headers)
    assert r.status_code == 200, r.text
    user = r.json()
    assert user.get("user_id") == "user_testabc123"
    assert user.get("email") == "tester@example.com"
    # _id should be excluded from response
    assert "_id" not in user
