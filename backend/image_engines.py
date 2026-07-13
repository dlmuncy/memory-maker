"""Image generation engines for Memory Maker.

Two engines place the reference subjects into a described scene:
- Gemini (Nano Banana) via the user's direct Google GenAI API key.
- fal.ai `nano-banana/edit`.

Both take a list of base64 reference images + a scene prompt and return a base64 JPEG/PNG.
"""
import os
import base64
import asyncio
import logging
from pathlib import Path

import httpx
from dotenv import load_dotenv
from google import genai
from google.genai import types
import fal_client

load_dotenv(Path(__file__).parent / ".env")

logger = logging.getLogger("memory_maker.engines")

GEMINI_IMAGE_MODEL = "gemini-2.5-flash-image"
FAL_MODEL = "fal-ai/nano-banana/edit"

SCENE_INSTRUCTION = (
    "Using the reference photo(s) of the same person/people, create ONE new photorealistic "
    "image that places these exact subjects into the following scene: {prompt}. "
    "Keep their faces and identities perfectly recognizable, preserve age, skin tone, hair and "
    "body proportions. Natural lighting, realistic composition, high detail."
)


def _strip(b64: str) -> str:
    return b64.split(",", 1)[1] if b64.startswith("data:") else b64


# --------------------------------------------------------------------------
# Gemini (direct user key)
# --------------------------------------------------------------------------
def _gemini_sync(prompt: str, images_b64: list[str]) -> str:
    client = genai.Client(api_key=os.environ["GEMINI_API_KEY"])
    parts: list = [types.Part.from_text(text=SCENE_INSTRUCTION.format(prompt=prompt))]
    for b64 in images_b64:
        parts.append(types.Part.from_bytes(data=base64.b64decode(_strip(b64)), mime_type="image/jpeg"))

    resp = client.models.generate_content(model=GEMINI_IMAGE_MODEL, contents=parts)
    for cand in resp.candidates or []:
        for part in (cand.content.parts if cand.content else []):
            if getattr(part, "inline_data", None) and part.inline_data.data:
                return base64.b64encode(part.inline_data.data).decode()
    raise RuntimeError("Gemini returned no image")


async def generate_gemini(prompt: str, images_b64: list[str]) -> str:
    return await asyncio.to_thread(_gemini_sync, prompt, images_b64)


# --------------------------------------------------------------------------
# fal.ai nano-banana/edit
# --------------------------------------------------------------------------
async def generate_fal(prompt: str, images_b64: list[str]) -> str:
    data_uris = [f"data:image/jpeg;base64,{_strip(b64)}" for b64 in images_b64]
    result = await fal_client.run_async(
        FAL_MODEL,
        arguments={
            "prompt": SCENE_INSTRUCTION.format(prompt=prompt),
            "image_urls": data_uris,
            "num_images": 1,
        },
    )
    images = (result or {}).get("images") or []
    if not images:
        raise RuntimeError("fal.ai returned no image")

    img = images[0]
    # fal may return a URL or an inline data URI.
    url = img.get("url", "")
    if url.startswith("data:"):
        return url.split(",", 1)[1]
    async with httpx.AsyncClient(timeout=60) as http:
        r = await http.get(url)
        r.raise_for_status()
        return base64.b64encode(r.content).decode()
