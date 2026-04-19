"""LFM2.5-VL model loading and inference for Terroir."""
import base64
import io
import os
import re
import logging

logger = logging.getLogger(__name__)

try:
    import torch
    from transformers import AutoProcessor, AutoModelForCausalLM
    _TORCH_AVAILABLE = True
except ImportError:
    _TORCH_AVAILABLE = False

from PIL import Image

MODEL_PATH = os.getenv("HF_MODEL_PATH", "LiquidAI/LFM2.5-VL-1.6B")
_model = None
_processor = None


def load_model():
    global _model, _processor
    if not _TORCH_AVAILABLE:
        raise RuntimeError("torch and transformers are required for model inference")
    if _model is None:
        logger.info(f"Loading model: {MODEL_PATH}")
        device = "cuda" if torch.cuda.is_available() else "cpu"
        dtype = torch.bfloat16 if torch.cuda.is_available() else torch.float32
        _processor = AutoProcessor.from_pretrained(MODEL_PATH)
        _model = AutoModelForCausalLM.from_pretrained(MODEL_PATH, torch_dtype=dtype, device_map=device)
        _model.eval()
        logger.info(f"Model loaded on {device}")


def _build_prompt(indices: dict, weather: dict, history: list[dict], lat: float, lon: float, timestamp: str) -> str:
    history_lines = "\n".join([
        f"  {h['timestamp']}: NDVI={h['ndvi']:.3f}, NDRE={h['ndre']:.3f}, SWIR={h['swir_moisture']:.3f}"
        for h in history[-4:]
    ]) or "  No previous passes"

    return (
        f"Analyze these Sentinel-2 satellite images of a vineyard.\n"
        f"Coordinates: {lat:.4f}°, {lon:.4f}°\n"
        f"Timestamp: {timestamp}\n\n"
        f"Spectral indices:\n"
        f"- NDVI: {indices['ndvi']:.3f} (healthy: 0.60–0.85)\n"
        f"- NDRE: {indices['ndre']:.3f} (chlorophyll content)\n"
        f"- SWIR Moisture: {indices['swir_moisture']:.3f} (drought stress if <0.30)\n"
        f"- NBR: {indices['nbr']:.3f} (fire risk if <-0.10)\n"
        f"- Canopy Cover: {indices['canopy_cover']:.1f}%\n\n"
        f"Weather: {weather['temperature_2m']:.1f}°C, {weather['relative_humidity_2m']:.0f}% humidity, "
        f"{weather['precipitation']:.1f}mm rain, VPD {weather['vapour_pressure_deficit']:.2f} kPa\n\n"
        f"Previous passes:\n{history_lines}\n\n"
        f"Provide an agronomic assessment with severity (HEALTHY/WATCH/CRITICAL), "
        f"primary concern, specific index references, and one recommendation."
    )


def _parse_severity(text: str) -> str:
    text_upper = text.upper()
    if "CRITICAL" in text_upper:
        return "CRITICAL"
    if "WATCH" in text_upper:
        return "WATCH"
    return "HEALTHY"


def _parse_harvest_signal(text: str) -> str | None:
    text_upper = text.upper()
    if "HARVEST NOW" in text_upper or "HARVEST IMMEDIATELY" in text_upper:
        return "HARVEST_NOW"
    if "DELAY" in text_upper and ("DAY" in text_upper or "WEEK" in text_upper):
        return "DELAY_7_DAYS"
    if "ON TRACK" in text_upper or "OPTIMAL" in text_upper:
        return "ON_TRACK"
    return None


def run_inference(rgb_b64: str, swir_b64: str, indices: dict, weather: dict, history: list, lat: float, lon: float, timestamp: str) -> dict:
    """Run LFM2.5-VL inference on a satellite image pair."""
    load_model()

    rgb_img = Image.open(io.BytesIO(base64.b64decode(rgb_b64))).convert("RGB")
    swir_img = Image.open(io.BytesIO(base64.b64decode(swir_b64))).convert("RGB")

    prompt = _build_prompt(indices, weather, history, lat, lon, timestamp)
    messages = [
        {
            "role": "user",
            "content": [
                {"type": "image"},
                {"type": "image"},
                {"type": "text", "text": prompt},
            ],
        }
    ]

    text = _processor.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)
    inputs = _processor(text=text, images=[rgb_img, swir_img], return_tensors="pt").to(_model.device)

    with torch.no_grad():
        output = _model.generate(**inputs, max_new_tokens=350, do_sample=False, temperature=None, top_p=None)

    response_text = _processor.decode(output[0][inputs["input_ids"].shape[1]:], skip_special_tokens=True).strip()

    return {
        "severity": _parse_severity(response_text),
        "confidence": 0.85 if _parse_severity(response_text) != "HEALTHY" else 0.92,
        "report": response_text,
        "harvest_signal": _parse_harvest_signal(response_text),
    }
