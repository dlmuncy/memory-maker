"""Photo library CRUD tests (auth-gated & user-scoped)."""
import requests
import pytest


@pytest.fixture(scope="module")
def created_photo_id(base_url, auth_headers, sample_jpeg_b64):
    """Create a photo once for the module and clean up at the end."""
    r = requests.post(
        f"{base_url}/api/photos",
        headers=auth_headers,
        json={"image_base64": sample_jpeg_b64},
    )
    assert r.status_code == 200, r.text
    body = r.json()
    photo_id = body["id"]
    yield photo_id
    # best-effort cleanup (delete tolerates 404)
    requests.delete(f"{base_url}/api/photos/{photo_id}", headers=auth_headers)


# ---- POST /api/photos -------------------------------------------------------
def test_create_photo_requires_auth(base_url, sample_jpeg_b64):
    r = requests.post(f"{base_url}/api/photos", json={"image_base64": sample_jpeg_b64})
    assert r.status_code == 401


def test_create_photo_success_and_strips_data_uri(base_url, auth_headers, sample_jpeg_b64):
    payload = {"image_base64": f"data:image/jpeg;base64,{sample_jpeg_b64}"}
    r = requests.post(f"{base_url}/api/photos", headers=auth_headers, json=payload)
    assert r.status_code == 200, r.text
    photo = r.json()
    assert photo["user_id"] == "user_testabc123"
    assert "id" in photo and "created_at" in photo
    # data URI prefix must have been stripped by the server
    assert not photo["image_base64"].startswith("data:")
    assert photo["image_base64"] == sample_jpeg_b64
    # cleanup
    requests.delete(f"{base_url}/api/photos/{photo['id']}", headers=auth_headers)


# ---- GET /api/photos --------------------------------------------------------
def test_list_photos_requires_auth(base_url):
    r = requests.get(f"{base_url}/api/photos")
    assert r.status_code == 401


def test_list_photos_returns_created_photo(base_url, auth_headers, created_photo_id):
    r = requests.get(f"{base_url}/api/photos", headers=auth_headers)
    assert r.status_code == 200, r.text
    photos = r.json()
    assert isinstance(photos, list)
    ids = [p["id"] for p in photos]
    assert created_photo_id in ids
    # ensure user scoping
    for p in photos:
        assert p["user_id"] == "user_testabc123"


# ---- DELETE /api/photos/{id} -----------------------------------------------
def test_delete_photo_requires_auth(base_url, created_photo_id):
    r = requests.delete(f"{base_url}/api/photos/{created_photo_id}")
    assert r.status_code == 401


def test_delete_photo_missing_returns_404(base_url, auth_headers):
    r = requests.delete(f"{base_url}/api/photos/does-not-exist-id", headers=auth_headers)
    assert r.status_code == 404


def test_delete_photo_success_then_gone(base_url, auth_headers, sample_jpeg_b64):
    # create -> delete -> verify not in list
    c = requests.post(
        f"{base_url}/api/photos",
        headers=auth_headers,
        json={"image_base64": sample_jpeg_b64},
    )
    assert c.status_code == 200
    pid = c.json()["id"]

    d = requests.delete(f"{base_url}/api/photos/{pid}", headers=auth_headers)
    assert d.status_code == 200, d.text
    assert d.json().get("ok") is True

    listing = requests.get(f"{base_url}/api/photos", headers=auth_headers)
    assert listing.status_code == 200
    assert pid not in [p["id"] for p in listing.json()]
