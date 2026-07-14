"""Image generation engine for Memory Maker.

Uses fal.ai flux-pro/kontext-max for high-fidelity subject reproduction.
Images are uploaded to fal.ai CDN first (avoids payload size limits),
then submitted as a queued job with polling for completion.
"""
import os
import base64
import asyncio
import logging
from pathlib import Path

import httpx
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent / ".env")

logger = logging.getLogger("memory_maker.engines")

FAL_KONTEXT_MODEL = "fal-ai/flux-pro/kontext-max"
FAL_FALLBACK_MODEL = "fal-ai/flux-pro/kontext"   # faster, slightly lower quality

SCENE_INSTRUCTION = (
    "Photorealistic image placing these exact people into the following scene: {prompt}. "
    "Preserve every person's face with perfect likeness — identical skin tone, facial structure, "
    "eye color, hair color and style, age, and body proportions. "
    "Do NOT alter or stylize the subjects. Natural lighting, cinematic composition, photo-realistic quality, "
    "shot on a high-end DSLR camera."
)


def _strip(b64: str) -> str:
    return b64.split(",", 1)[1] if b64.startswith("data:") else b64


async def _upload_image_to_fal(b64: str, fal_key: str, http: httpx.AsyncClient) -> str:
    """
    Upload a base64 image to fal.ai storage and return the CDN URL.
    This avoids sending huge base64 payloads in the generation request.
    """
    clean = _strip(b64)
    raw_bytes = base64.b64decode(clean)

    # Step 1: request an upload URL
    init_resp = await http.post(
        "https://rest.alpha.fal.ai/storage/upload/initiate",
        headers={"Authorization": f"Key {fal_key}", "Content-Type": "application/json"},
        json={"content_type": "image/jpeg", "file_name": "ref.jpg"},
        timeout=20,
    )
    if init_resp.status_code >= 400:
        raise RuntimeError(f"fal.ai storage initiate failed {init_resp.status_code}: {init_resp.text[:200]}")

    init_data = init_resp.json()
    upload_url = init_data.get("upload_url") or init_data.get("url")
    file_url = init_data.get("file_url") or init_data.get("access_url")

    if not upload_url:
        raise RuntimeError(f"fal.ai storage response missing upload_url: {init_data}")

    # Step 2: PUT the raw bytes
    put_resp = await http.put(
        upload_url,
        content=raw_bytes,
        headers={"Content-Type": "image/jpeg"},
        timeout=60,
    )
    if put_resp.status_code >= 400:
        raise RuntimeError(f"fal.ai image upload PUT failed {put_resp.status_code}")

    return file_url


async def _upload_images(images_b64: list[str], fal_key: str) -> list[str]:
    """Upload all reference images to fal.ai CDN, return URLs."""
    async with httpx.AsyncClient(timeout=60) as http:
        tasks = [_upload_image_to_fal(b64, fal_key, http) for b64 in images_b64]
        urls = await asyncio.gather(*tasks)
    return list(urls)


async def _submit_and_poll(model: str, payload: dict, fal_key: str, max_wait: int = 180) -> dict:
    """
    Submit a job to fal.ai queue and poll until done.
    Returns the result dict on success.
    """
    headers = {
        "Authorization": f"Key {fal_key}",
        "Content-Type": "application/json",
    }
    queue_url = f"https://queue.fal.run/{model}"
    status_base = f"https://queue.fal.run/{model}/requests"

    async with httpx.AsyncClient(timeout=30) as http:
        # Submit
        resp = await http.post(queue_url, json=payload, headers=headers)
        if resp.status_code >= 400:
            raise RuntimeError(f"fal.ai submit failed {resp.status_code}: {resp.text[:300]}")

        job = resp.json()
        request_id = job.get("request_id") or job.get("id")
        if not request_id:
            raise RuntimeError(f"fal.ai did not return request_id: {job}")

        logger.info(f"fal.ai job queued: {request_id}")

        # Poll status
        elapsed = 0
        poll_interval = 3
        while elapsed < max_wait:
            await asyncio.sleep(poll_interval)
            elapsed += poll_interval

            status_resp = await http.get(
                f"{status_base}/{request_id}/status",
                headers=headers,
            )
            if status_resp.status_code >= 400:
                logger.warning(f"Status check failed {status_resp.status_code}, retrying...")
                continue

            status = status_resp.json()
            state = status.get("status", "")
            logger.info(f"fal.ai [{request_id}] status: {state} ({elapsed}s)")

            if state == "COMPLETED":
                # Fetch result
                result_resp = await http.get(
                    f"{status_base}/{request_id}",
                    headers=headers,
                )
                result_resp.raise_for_status()
                return result_resp.json()

            elif state in ("FAILED", "CANCELLED"):
                logs = status.get("logs", [])
                raise RuntimeError(f"fal.ai job {state}: {logs[-1] if logs else 'no details'}")

        raise RuntimeError(f"fal.ai job timed out after {max_wait}s (request_id={request_id})")


async def generate_fal(prompt: str, images_b64: list[str]) -> str:
    """
    Generate a memory using fal.ai flux-pro/kontext-max.
    
    1. Uploads reference photos to fal.ai CDN (avoids payload bloat)
    2. Submits to async queue
    3. Polls until complete
    4. Returns base64 of generated image
    """
    fal_key = os.environ.get("FAL_KEY", "")
    if not fal_key:
        raise RuntimeError("FAL_KEY is not configured")

    full_prompt = SCENE_INSTRUCTION.format(prompt=prompt)

    # Upload images to fal.ai CDN
    logger.info(f"Uploading {len(images_b64)} reference image(s) to fal.ai storage...")
    try:
        image_urls = await _upload_images(images_b64, fal_key)
        logger.info(f"Uploaded {len(image_urls)} images successfully")
    except Exception as e:
        logger.warning(f"fal.ai upload failed ({e}), falling back to inline data URI")
        # Fallback: try inline data URI with just the first image (smaller payload)
        image_urls = [f"data:image/jpeg;base64,{_strip(images_b64[0])}"]

    payload = {
        "prompt": full_prompt,
        "image_url": image_urls[0] if len(image_urls) == 1 else image_urls,
        "num_images": 1,
        "output_format": "jpeg",
        "safety_tolerance": "2",
        "enable_safety_checker": False,
    }

    # For multiple images, use image_urls (plural) — kontext-max supports it
    if len(image_urls) > 1:
        payload.pop("image_url", None)
        payload["image_urls"] = image_urls

    try:
        result = await _submit_and_poll(FAL_KONTEXT_MODEL, payload, fal_key, max_wait=180)
    except Exception as e:
        logger.warning(f"kontext-max failed: {e}. Trying kontext (standard)...")
        # Try the lighter kontext model
        try:
            payload_fallback = {**payload}
            if "image_urls" in payload_fallback:
                payload_fallback.pop("image_urls")
                payload_fallback["image_url"] = image_urls[0]
            result = await _submit_and_poll(FAL_FALLBACK_MODEL, payload_fallback, fal_key, max_wait=120)
        except Exception as e2:
            raise RuntimeError(f"Both kontext-max and kontext failed: {e2}")

    # Extract image from result
    images = (result or {}).get("images") or []
    if not images:
        raise RuntimeError(f"fal.ai returned no images in result: {result}")

    img = images[0]
    url = img.get("url", "")
    if not url:
        raise RuntimeError("fal.ai image has no URL")

    if url.startswith("data:"):
        return url.split(",", 1)[1]

    # Download the image and return base64
    async with httpx.AsyncClient(timeout=60) as http:
        r = await http.get(url)
        r.raise_for_status()
        return base64.b64encode(r.content).decode()
