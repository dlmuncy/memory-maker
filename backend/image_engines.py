"""Image generation engine for Memory Maker.

Uses fal.ai flux-pro/kontext-multi for high-fidelity subject reproduction.
Multiple reference photos are passed so the model can average facial features
across angles — improving likeness accuracy significantly over single-image input.
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

# fal-ai/flux-pro/kontext-multi: multi-image context inpainting
# Best-in-class for subject identity preservation across reference images
FAL_KONTEXT_MODEL = "fal-ai/flux-pro/kontext-max"

SCENE_INSTRUCTION = (
    "Photorealistic image placing these exact people into the following scene: {prompt}. "
    "Preserve every person's face with perfect likeness — identical skin tone, facial structure, "
    "eye color, hair color and style, age, and body proportions. "
    "Do NOT alter or stylize the subjects. Natural lighting, cinematic composition, photo-realistic quality, "
    "shot on a high-end DSLR camera."
)


def _strip(b64: str) -> str:
    return b64.split(",", 1)[1] if b64.startswith("data:") else b64


def _to_data_uri(b64: str) -> str:
    clean = _strip(b64)
    return f"data:image/jpeg;base64,{clean}"


async def generate_fal(prompt: str, images_b64: list[str]) -> str:
    """
    Generate a scene-placed image using fal.ai flux-pro/kontext-max.
    
    Passes all reference photos as context images so the model builds
    a composite understanding of the subject(s) — better accuracy than
    single-image input, especially for faces.
    """
    fal_key = os.environ.get("FAL_KEY", "")
    if not fal_key:
        raise RuntimeError("FAL_KEY is not configured")

    # Build image_urls list — all reference photos as context
    image_urls = [_to_data_uri(b64) for b64 in images_b64]
    full_prompt = SCENE_INSTRUCTION.format(prompt=prompt)

    # fal-ai/flux-pro/kontext-max REST API
    payload = {
        "prompt": full_prompt,
        "image_urls": image_urls,
        "num_images": 1,
        "output_format": "jpeg",
        "safety_tolerance": "2",
    }

    headers = {
        "Authorization": f"Key {fal_key}",
        "Content-Type": "application/json",
    }

    async with httpx.AsyncClient(timeout=120) as http:
        # Submit job
        resp = await http.post(
            f"https://fal.run/{FAL_KONTEXT_MODEL}",
            json=payload,
            headers=headers,
        )

        if resp.status_code == 422 or resp.status_code == 400:
            # Fallback: try the standard flux/dev/image-to-image with the first image
            logger.warning(f"kontext-max failed ({resp.status_code}), falling back to flux-dev")
            return await _generate_fal_fallback(prompt, images_b64, http, fal_key)

        if resp.status_code >= 400:
            raise RuntimeError(f"fal.ai error {resp.status_code}: {resp.text[:300]}")

        result = resp.json()

    images = (result or {}).get("images") or []
    if not images:
        raise RuntimeError("fal.ai returned no image")

    img = images[0]
    url = img.get("url", "")
    if url.startswith("data:"):
        return url.split(",", 1)[1]

    async with httpx.AsyncClient(timeout=60) as http:
        r = await http.get(url)
        r.raise_for_status()
        return base64.b64encode(r.content).decode()


async def _generate_fal_fallback(
    prompt: str, images_b64: list[str], http: httpx.AsyncClient, fal_key: str
) -> str:
    """
    Fallback to fal-ai/flux/dev/image-to-image using the first reference photo.
    Used if kontext-max rejects the request (e.g. payload too large).
    """
    FAL_FALLBACK = "fal-ai/flux/dev/image-to-image"
    full_prompt = SCENE_INSTRUCTION.format(prompt=prompt)

    payload = {
        "prompt": full_prompt,
        "image_url": _to_data_uri(images_b64[0]),
        "strength": 0.75,
        "num_images": 1,
        "output_format": "jpeg",
    }

    headers = {
        "Authorization": f"Key {fal_key}",
        "Content-Type": "application/json",
    }

    resp = await http.post(
        f"https://fal.run/{FAL_FALLBACK}",
        json=payload,
        headers=headers,
    )

    if resp.status_code >= 400:
        raise RuntimeError(f"fal.ai fallback error {resp.status_code}: {resp.text[:300]}")

    result = resp.json()
    images = (result or {}).get("images") or []
    if not images:
        raise RuntimeError("fal.ai fallback returned no image")

    img = images[0]
    url = img.get("url", "")
    if url.startswith("data:"):
        return url.split(",", 1)[1]

    async with httpx.AsyncClient(timeout=60) as dl:
        r = await dl.get(url)
        r.raise_for_status()
        return base64.b64encode(r.content).decode()
