import base64
import os
import requests
import numpy as np

SIMSAT_API = os.getenv("SIMSAT_API_URL", "http://localhost:9005")
IMAGE_SIZE_KM = 5.0
WINDOW_SECONDS = 864000

class ImageUnavailable(Exception):
    pass

def fetch_image_png(lat: float, lon: float, timestamp: str, bands: str) -> bytes:
    """Fetch a Sentinel-2 composite image as PNG bytes."""
    resp = requests.get(
        f"{SIMSAT_API}/data/image/sentinel",
        params={
            "lat": lat, "lon": lon, "timestamp": timestamp,
            "spectral_bands": bands, "size_km": IMAGE_SIZE_KM,
            "return_type": "png", "window_seconds": WINDOW_SECONDS,
        },
        timeout=60,
    )
    resp.raise_for_status()
    content_type = resp.headers.get("content-type", "")
    if "json" in content_type:
        data = resp.json()
        if not data.get("image_available", False):
            raise ImageUnavailable(f"No image at ({lat}, {lon}) for {timestamp}")
    return resp.content

def fetch_band_array(lat: float, lon: float, timestamp: str, bands: str, n_bands: int) -> tuple[np.ndarray, dict]:
    """Fetch Sentinel-2 bands as a numpy array for index computation."""
    resp = requests.get(
        f"{SIMSAT_API}/data/image/sentinel",
        params={
            "lat": lat, "lon": lon, "timestamp": timestamp,
            "spectral_bands": bands, "size_km": IMAGE_SIZE_KM,
            "return_type": "array", "window_seconds": WINDOW_SECONDS,
        },
        timeout=60,
    )
    resp.raise_for_status()
    data = resp.json()
    if not data.get("image_available", False):
        raise ImageUnavailable(f"No image at ({lat}, {lon}) for {timestamp}")

    raw = base64.b64decode(data["image"])
    arr = np.frombuffer(raw, dtype=np.float32).copy()
    side = int(np.sqrt(len(arr) / n_bands))
    arr = arr.reshape(side, side, n_bands)

    meta = {
        "cloud_cover": data.get("cloud_cover", 0.0),
        "datetime": data.get("datetime", timestamp),
        "source": data.get("source", "sentinel-2"),
    }
    return arr, meta

def fetch_image_set(lat: float, lon: float, timestamp: str) -> dict:
    """Fetch all image types needed for one analysis."""
    return {
        "rgb": fetch_image_png(lat, lon, timestamp, "red,green,blue"),
        "swir": fetch_image_png(lat, lon, timestamp, "swir_2,nir,red"),
        "array": fetch_band_array(lat, lon, timestamp, "nir,red,red_edge_1,swir_1,swir_2", n_bands=5),
    }
