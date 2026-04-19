# Terroir Fine-tuning Pipeline — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Collect ~800 Sentinel-2 vineyard image-text training pairs, generate agronomic labels using Claude, and fine-tune LFM2.5-VL-1.6B to produce winemaker-language vineyard assessments from multispectral satellite imagery.

**Architecture:** All scripts run on the gaming PC (Windows, RTX 5070). SimSat runs locally via Docker Compose during data collection. Data collection fetches RGB + SWIR PNG images for VLM input and raw band arrays for index computation. Claude API generates training labels. HuggingFace Trainer runs the full fine-tune with gradient checkpointing (fits in 12GB VRAM). Trained weights publish to HuggingFace as `gabinnocenzi/terroir-lfm25-vl`.

**Tech Stack:** Python 3.11, PyTorch 2.x + CUDA 12.8, HuggingFace Transformers, HuggingFace Datasets, Anthropic Python SDK, Pillow, numpy, requests, tqdm

**Machine:** All tasks run on Windows gaming PC (RTX 5070) unless noted.

**Prerequisites before Task 1:**
- SimSat repo cloned and `docker compose up` running (API at http://localhost:9005)
- ANTHROPIC_API_KEY set in environment
- HuggingFace account created at huggingface.co (username: gabinnocenzi)

---

## File Structure

```
finetune/
├── requirements.txt
├── config.py                    # Shared constants (API URLs, model ID, paths)
├── simsat_client.py             # Fetch images from SimSat API
├── weather_client.py            # Fetch weather from Open-Meteo (no key needed)
├── indices.py                   # Compute NDVI, NDRE, SWIR, NBR, canopy cover
├── history.py                   # Build temporal history per location
├── label_generator.py           # Generate agronomic labels via Claude API
├── collect_data.py              # Orchestrate full data collection → data/
├── prepare_dataset.py           # Convert collected data → HuggingFace Dataset
├── finetune.py                  # Fine-tune LFM2.5-VL-1.6B
├── evaluate.py                  # Compare base vs fine-tuned on 20 examples
├── publish.py                   # Push weights to HuggingFace Hub
├── data/
│   ├── vineyard_locations.json  # ~200 vineyard locations with coordinates
│   ├── raw/                     # Downloaded images + arrays per location
│   └── training_pairs.json      # Final assembled training dataset
└── tests/
    ├── test_indices.py
    ├── test_simsat_client.py
    └── test_weather_client.py
```

---

## Task 1: Set up gaming PC environment

**Files:**
- Create: `finetune/requirements.txt`
- Create: `finetune/config.py`

- [ ] **Step 1: Verify CUDA is available**

Open PowerShell and run:
```powershell
nvidia-smi
```
Expected: shows RTX 5070, CUDA 12.x

- [ ] **Step 2: Install Python dependencies**

```powershell
cd C:\Users\<your-username>\Desktop
mkdir terroir && cd terroir
mkdir finetune && cd finetune
pip install torch torchvision --index-url https://download.pytorch.org/whl/cu124
pip install transformers datasets accelerate pillow numpy requests tqdm anthropic huggingface_hub
pip freeze > requirements.txt
```

- [ ] **Step 3: Verify PyTorch sees the GPU**

```powershell
python -c "import torch; print(torch.cuda.is_available()); print(torch.cuda.get_device_name(0))"
```
Expected: `True` and `NVIDIA GeForce RTX 5070`

- [ ] **Step 4: Create config.py**

```python
# finetune/config.py
import os
from pathlib import Path

SIMSAT_API = "http://localhost:9005"
OPEN_METEO_API = "https://api.open-meteo.com/v1/forecast"
MODEL_ID = "LiquidAI/LFM2.5-VL-1.6B"
HF_REPO_ID = "gabinnocenzi/terroir-lfm25-vl"

DATA_DIR = Path("data")
RAW_DIR = DATA_DIR / "raw"
DATA_DIR.mkdir(exist_ok=True)
RAW_DIR.mkdir(exist_ok=True)

SENTINEL_BANDS_ARRAY = "nir,red,red_edge_1,swir_1,swir_2"
SENTINEL_BANDS_RGB = "red,green,blue"
SENTINEL_BANDS_SWIR = "swir_2,nir,red"
SENTINEL_BANDS_NIR = "nir,red,green"
SENTINEL_BANDS_REDEDGE = "red_edge_3,red_edge_2,red_edge_1"
IMAGE_SIZE_KM = 5.0
WINDOW_SECONDS = 864000  # 10 days
```

- [ ] **Step 5: Commit**

```powershell
git init
git add requirements.txt config.py
git commit -m "feat: finetune pipeline scaffold and config"
```

---

## Task 2: Build vineyard location dataset

**Files:**
- Create: `finetune/data/vineyard_locations.json`

- [ ] **Step 1: Create vineyard locations JSON**

Create `finetune/data/vineyard_locations.json`:
```json
[
  {"name": "Opus One", "lat": 38.4148, "lon": -122.4194, "region": "Napa Valley", "country": "USA"},
  {"name": "Stag's Leap Wine Cellars", "lat": 38.3977, "lon": -122.3680, "region": "Napa Valley", "country": "USA"},
  {"name": "Chateau Montelena", "lat": 38.5638, "lon": -122.5793, "region": "Napa Valley", "country": "USA"},
  {"name": "Far Niente", "lat": 38.4421, "lon": -122.4466, "region": "Napa Valley", "country": "USA"},
  {"name": "Beringer Vineyards", "lat": 38.5123, "lon": -122.4770, "region": "Napa Valley", "country": "USA"},
  {"name": "Duckhorn Vineyards", "lat": 38.4957, "lon": -122.4386, "region": "Napa Valley", "country": "USA"},
  {"name": "Screaming Eagle", "lat": 38.3899, "lon": -122.3572, "region": "Napa Valley", "country": "USA"},
  {"name": "Jordan Vineyard", "lat": 38.7234, "lon": -122.9432, "region": "Sonoma", "country": "USA"},
  {"name": "Ridge Vineyards Monte Bello", "lat": 37.3134, "lon": -122.1127, "region": "Santa Cruz Mountains", "country": "USA"},
  {"name": "Chateau Margaux", "lat": 45.0333, "lon": -0.6667, "region": "Bordeaux", "country": "France"},
  {"name": "Chateau Latour", "lat": 45.1833, "lon": -0.7667, "region": "Bordeaux", "country": "France"},
  {"name": "Chateau Petrus", "lat": 44.9333, "lon": -0.1833, "region": "Pomerol", "country": "France"},
  {"name": "Chateau Haut-Brion", "lat": 44.7833, "lon": -0.6167, "region": "Pessac-Leognan", "country": "France"},
  {"name": "Chateau Mouton Rothschild", "lat": 45.2167, "lon": -0.7833, "region": "Pauillac", "country": "France"},
  {"name": "Domaine de la Romanee-Conti", "lat": 47.1547, "lon": 4.9628, "region": "Burgundy", "country": "France"},
  {"name": "Domaine Leroy", "lat": 47.0667, "lon": 4.9333, "region": "Burgundy", "country": "France"},
  {"name": "Clos de Vougeot", "lat": 47.1667, "lon": 4.9500, "region": "Burgundy", "country": "France"},
  {"name": "Sassicaia", "lat": 43.1667, "lon": 10.6500, "region": "Bolgheri", "country": "Italy"},
  {"name": "Ornellaia", "lat": 43.1500, "lon": 10.6333, "region": "Bolgheri", "country": "Italy"},
  {"name": "Tignanello", "lat": 43.5333, "lon": 11.2167, "region": "Tuscany", "country": "Italy"},
  {"name": "Brunello di Montalcino", "lat": 43.0553, "lon": 11.4887, "region": "Montalcino", "country": "Italy"},
  {"name": "Cloudy Bay", "lat": -41.5167, "lon": 173.9500, "region": "Marlborough", "country": "New Zealand"},
  {"name": "Dog Point Vineyard", "lat": -41.5333, "lon": 173.9167, "region": "Marlborough", "country": "New Zealand"},
  {"name": "Penfolds Grange", "lat": -34.9500, "lon": 138.6000, "region": "Barossa Valley", "country": "Australia"},
  {"name": "Henschke Hill of Grace", "lat": -34.5500, "lon": 138.8833, "region": "Eden Valley", "country": "Australia"},
  {"name": "Vega Sicilia", "lat": 41.6833, "lon": -4.2167, "region": "Ribera del Duero", "country": "Spain"},
  {"name": "Alvaro Palacios L'Ermita", "lat": 41.2167, "lon": 0.7333, "region": "Priorat", "country": "Spain"},
  {"name": "Catena Zapata", "lat": -33.0667, "lon": -68.8500, "region": "Mendoza", "country": "Argentina"},
  {"name": "Concha y Toro Don Melchor", "lat": -33.5833, "lon": -70.9167, "region": "Maipo Valley", "country": "Chile"},
  {"name": "Temecula Valley", "lat": 33.4833, "lon": -117.0833, "region": "Temecula", "country": "USA"}
]
```

- [ ] **Step 2: Verify the file is valid JSON**

```powershell
python -c "import json; locs = json.load(open('data/vineyard_locations.json')); print(f'{len(locs)} locations loaded')"
```
Expected: `30 locations loaded`

- [ ] **Step 3: Commit**

```powershell
git add data/vineyard_locations.json
git commit -m "feat: add 30 vineyard locations across 10 wine regions"
```

---

## Task 3: Build SimSat image fetcher

**Files:**
- Create: `finetune/simsat_client.py`
- Create: `finetune/tests/test_simsat_client.py`

- [ ] **Step 1: Write the failing test**

Create `finetune/tests/test_simsat_client.py`:
```python
import pytest
from unittest.mock import patch, MagicMock
from pathlib import Path
import base64
import numpy as np
from simsat_client import fetch_image_png, fetch_band_array, ImageUnavailable

MOCK_PNG_B64 = base64.b64encode(b"\x89PNG\r\n\x1a\n" + b"\x00" * 100).decode()
MOCK_ARRAY_B64 = base64.b64encode(np.zeros((500, 500, 5), dtype=np.float32).tobytes()).decode()

@patch("simsat_client.requests.get")
def test_fetch_image_png_returns_bytes_on_success(mock_get):
    mock_get.return_value.status_code = 200
    mock_get.return_value.headers = {"content-type": "image/png"}
    mock_get.return_value.content = b"\x89PNG\r\n\x1a\n" + b"\x00" * 100
    
    result = fetch_image_png(lat=38.4, lon=-122.4, timestamp="2025-06-01T12:00:00Z", bands="red,green,blue")
    assert isinstance(result, bytes)
    assert result[:8] == b"\x89PNG\r\n\x1a\n"

@patch("simsat_client.requests.get")
def test_fetch_image_png_raises_on_unavailable(mock_get):
    mock_get.return_value.status_code = 200
    mock_get.return_value.headers = {"content-type": "application/json"}
    mock_get.return_value.json.return_value = {"image_available": False}
    
    with pytest.raises(ImageUnavailable):
        fetch_image_png(lat=38.4, lon=-122.4, timestamp="2025-06-01T12:00:00Z", bands="red,green,blue")

@patch("simsat_client.requests.get")
def test_fetch_band_array_returns_ndarray(mock_get):
    arr = np.zeros((500, 500, 5), dtype=np.float32)
    mock_get.return_value.status_code = 200
    mock_get.return_value.json.return_value = {
        "image_available": True,
        "image": base64.b64encode(arr.tobytes()).decode(),
        "cloud_cover": 5.0,
    }
    
    result, meta = fetch_band_array(lat=38.4, lon=-122.4, timestamp="2025-06-01T12:00:00Z", bands="nir,red,red_edge_1,swir_1,swir_2", n_bands=5)
    assert result.shape == (500, 500, 5)
    assert meta["cloud_cover"] == 5.0
```

- [ ] **Step 2: Run test to verify it fails**

```powershell
python -m pytest tests/test_simsat_client.py -v
```
Expected: `ERROR` — `ModuleNotFoundError: No module named 'simsat_client'`

- [ ] **Step 3: Implement simsat_client.py**

Create `finetune/simsat_client.py`:
```python
import base64
import requests
import numpy as np
from config import SIMSAT_API, IMAGE_SIZE_KM, WINDOW_SECONDS

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
    """Fetch all image types needed for one training example."""
    from config import SENTINEL_BANDS_RGB, SENTINEL_BANDS_SWIR, SENTINEL_BANDS_ARRAY
    return {
        "rgb": fetch_image_png(lat, lon, timestamp, SENTINEL_BANDS_RGB),
        "swir": fetch_image_png(lat, lon, timestamp, SENTINEL_BANDS_SWIR),
        "array": fetch_band_array(lat, lon, timestamp, SENTINEL_BANDS_ARRAY, n_bands=5),
    }
```

- [ ] **Step 4: Run tests to verify they pass**

```powershell
python -m pytest tests/test_simsat_client.py -v
```
Expected: `3 passed`

- [ ] **Step 5: Commit**

```powershell
git add simsat_client.py tests/test_simsat_client.py
git commit -m "feat: SimSat image fetcher with PNG and array support"
```

---

## Task 4: Build spectral index calculator

**Files:**
- Create: `finetune/indices.py`
- Create: `finetune/tests/test_indices.py`

- [ ] **Step 1: Write the failing tests**

Create `finetune/tests/test_indices.py`:
```python
import numpy as np
import pytest
from indices import compute_ndvi, compute_ndre, compute_swir_moisture, compute_nbr, compute_canopy_cover, compute_all_indices

def make_array(nir_val, red_val, rededge_val, swir1_val, swir2_val, size=10):
    """Create a (size, size, 5) array with constant band values."""
    arr = np.zeros((size, size, 5), dtype=np.float32)
    arr[:, :, 0] = nir_val      # NIR
    arr[:, :, 1] = red_val      # Red
    arr[:, :, 2] = rededge_val  # Red Edge
    arr[:, :, 3] = swir1_val    # SWIR1
    arr[:, :, 4] = swir2_val    # SWIR2
    return arr

def test_ndvi_healthy_vegetation():
    # Healthy veg: NIR high (0.8), Red low (0.1) → NDVI ~0.78
    arr = make_array(nir_val=0.8, red_val=0.1, rededge_val=0.5, swir1_val=0.2, swir2_val=0.15)
    ndvi = compute_ndvi(arr)
    assert 0.77 < ndvi < 0.79

def test_ndvi_bare_soil():
    # Bare soil: NIR ~0.3, Red ~0.3 → NDVI near 0
    arr = make_array(nir_val=0.3, red_val=0.28, rededge_val=0.29, swir1_val=0.3, swir2_val=0.3)
    ndvi = compute_ndvi(arr)
    assert -0.05 < ndvi < 0.05

def test_ndre_detects_chlorophyll_stress():
    # Stressed: NIR moderate (0.6), RedEdge higher relative to healthy (0.5)
    arr = make_array(nir_val=0.6, red_val=0.3, rededge_val=0.5, swir1_val=0.3, swir2_val=0.2)
    ndre = compute_ndre(arr)
    assert 0.08 < ndre < 0.12

def test_swir_moisture_wet():
    # Wet soil: NIR high (0.7), SWIR1 low (0.1) → moisture index near 0.75
    arr = make_array(nir_val=0.7, red_val=0.2, rededge_val=0.4, swir1_val=0.1, swir2_val=0.08)
    smi = compute_swir_moisture(arr)
    assert 0.73 < smi < 0.77

def test_canopy_cover_high_ndvi():
    arr = make_array(nir_val=0.85, red_val=0.05, rededge_val=0.5, swir1_val=0.15, swir2_val=0.1)
    ndvi = compute_ndvi(arr)
    cover = compute_canopy_cover(ndvi)
    assert cover > 80.0

def test_compute_all_indices_returns_dict():
    arr = make_array(nir_val=0.75, red_val=0.12, rededge_val=0.45, swir1_val=0.2, swir2_val=0.15)
    result = compute_all_indices(arr)
    assert set(result.keys()) == {"ndvi", "ndre", "swir_moisture", "nbr", "canopy_cover"}
    for v in result.values():
        assert isinstance(v, float)
```

- [ ] **Step 2: Run to verify failure**

```powershell
python -m pytest tests/test_indices.py -v
```
Expected: `ERROR` — `ModuleNotFoundError: No module named 'indices'`

- [ ] **Step 3: Implement indices.py**

Create `finetune/indices.py`:
```python
import numpy as np

# Band order in the 5-channel array from fetch_band_array:
# idx 0 = NIR, 1 = Red, 2 = RedEdge, 3 = SWIR1, 4 = SWIR2

def _safe_ratio(a: np.ndarray, b: np.ndarray) -> np.ndarray:
    return np.where((a + b) == 0, 0.0, (a - b) / (a + b + 1e-8))

def compute_ndvi(arr: np.ndarray) -> float:
    """NDVI = (NIR - Red) / (NIR + Red). Range [-1, 1]. Healthy vines: 0.6–0.85."""
    nir, red = arr[:, :, 0], arr[:, :, 1]
    return float(np.nanmean(_safe_ratio(nir, red)))

def compute_ndre(arr: np.ndarray) -> float:
    """NDRE = (NIR - RedEdge) / (NIR + RedEdge). Sensitive to chlorophyll content."""
    nir, re = arr[:, :, 0], arr[:, :, 2]
    return float(np.nanmean(_safe_ratio(nir, re)))

def compute_swir_moisture(arr: np.ndarray) -> float:
    """SWIR Moisture Index = (NIR - SWIR1) / (NIR + SWIR1). Higher = wetter."""
    nir, swir1 = arr[:, :, 0], arr[:, :, 3]
    return float(np.nanmean(_safe_ratio(nir, swir1)))

def compute_nbr(arr: np.ndarray) -> float:
    """NBR = (NIR - SWIR2) / (NIR + SWIR2). Low values indicate fire/burn."""
    nir, swir2 = arr[:, :, 0], arr[:, :, 4]
    return float(np.nanmean(_safe_ratio(nir, swir2)))

def compute_canopy_cover(ndvi: float) -> float:
    """Estimate % canopy cover from NDVI. Vines >0.4 considered canopy."""
    LOW, HIGH = 0.2, 0.85
    return float(max(0.0, min(100.0, (ndvi - LOW) / (HIGH - LOW) * 100)))

def compute_all_indices(arr: np.ndarray) -> dict:
    ndvi = compute_ndvi(arr)
    return {
        "ndvi": ndvi,
        "ndre": compute_ndre(arr),
        "swir_moisture": compute_swir_moisture(arr),
        "nbr": compute_nbr(arr),
        "canopy_cover": compute_canopy_cover(ndvi),
    }
```

- [ ] **Step 4: Run tests to verify they pass**

```powershell
python -m pytest tests/test_indices.py -v
```
Expected: `6 passed`

- [ ] **Step 5: Commit**

```powershell
git add indices.py tests/test_indices.py
git commit -m "feat: spectral index computation (NDVI, NDRE, SWIR, NBR, canopy)"
```

---

## Task 5: Build Open-Meteo weather fetcher

**Files:**
- Create: `finetune/weather_client.py`
- Create: `finetune/tests/test_weather_client.py`

- [ ] **Step 1: Write the failing test**

Create `finetune/tests/test_weather_client.py`:
```python
import pytest
from unittest.mock import patch
from weather_client import fetch_weather, WeatherUnavailable

MOCK_RESPONSE = {
    "current": {
        "temperature_2m": 24.5,
        "relative_humidity_2m": 72,
        "precipitation": 0.0,
        "wind_speed_10m": 12.3,
        "vapour_pressure_deficit": 1.8,
    }
}

@patch("weather_client.requests.get")
def test_fetch_weather_returns_dict(mock_get):
    mock_get.return_value.status_code = 200
    mock_get.return_value.json.return_value = MOCK_RESPONSE
    
    result = fetch_weather(lat=38.4, lon=-122.4)
    assert result["temperature_2m"] == 24.5
    assert result["relative_humidity_2m"] == 72
    assert result["precipitation"] == 0.0
    assert result["wind_speed_10m"] == 12.3
    assert result["vapour_pressure_deficit"] == 1.8

@patch("weather_client.requests.get")
def test_fetch_weather_raises_on_api_error(mock_get):
    mock_get.return_value.status_code = 500
    mock_get.return_value.raise_for_status.side_effect = Exception("Server error")
    
    with pytest.raises(Exception):
        fetch_weather(lat=38.4, lon=-122.4)
```

- [ ] **Step 2: Run to verify failure**

```powershell
python -m pytest tests/test_weather_client.py -v
```
Expected: `ERROR` — `ModuleNotFoundError: No module named 'weather_client'`

- [ ] **Step 3: Implement weather_client.py**

Create `finetune/weather_client.py`:
```python
import requests
from config import OPEN_METEO_API

class WeatherUnavailable(Exception):
    pass

def fetch_weather(lat: float, lon: float) -> dict:
    """Fetch current weather from Open-Meteo. No API key required."""
    resp = requests.get(
        OPEN_METEO_API,
        params={
            "latitude": lat,
            "longitude": lon,
            "current": "temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m,vapour_pressure_deficit",
            "wind_speed_unit": "kmh",
        },
        timeout=30,
    )
    resp.raise_for_status()
    data = resp.json()
    current = data.get("current", {})
    return {
        "temperature_2m": current.get("temperature_2m", 0.0),
        "relative_humidity_2m": current.get("relative_humidity_2m", 0),
        "precipitation": current.get("precipitation", 0.0),
        "wind_speed_10m": current.get("wind_speed_10m", 0.0),
        "vapour_pressure_deficit": current.get("vapour_pressure_deficit", 0.0),
    }
```

- [ ] **Step 4: Run tests to verify they pass**

```powershell
python -m pytest tests/test_weather_client.py -v
```
Expected: `2 passed`

- [ ] **Step 5: Commit**

```powershell
git add weather_client.py tests/test_weather_client.py
git commit -m "feat: Open-Meteo weather client (no API key required)"
```

---

## Task 6: Build temporal history tracker

**Files:**
- Create: `finetune/history.py`

- [ ] **Step 1: Write a test**

Add to `finetune/tests/test_indices.py`:
```python
from history import HistoryStore

def test_history_store_tracks_per_location():
    store = HistoryStore()
    store.add("napa_38.4_-122.4", {"timestamp": "2025-06-01T00:00:00Z", "ndvi": 0.72, "ndre": 0.15, "swir_moisture": 0.45})
    store.add("napa_38.4_-122.4", {"timestamp": "2025-06-06T00:00:00Z", "ndvi": 0.68, "ndre": 0.13, "swir_moisture": 0.40})
    
    history = store.get("napa_38.4_-122.4")
    assert len(history) == 2
    assert history[-1]["ndvi"] == 0.68

def test_history_store_returns_empty_for_unknown_location():
    store = HistoryStore()
    assert store.get("unknown_location") == []

def test_history_store_caps_at_five_entries():
    store = HistoryStore()
    key = "test_loc"
    for i in range(7):
        store.add(key, {"timestamp": f"2025-0{i+1}-01T00:00:00Z", "ndvi": 0.7, "ndre": 0.1, "swir_moisture": 0.4})
    assert len(store.get(key)) == 5
```

- [ ] **Step 2: Run to verify failure**

```powershell
python -m pytest tests/test_indices.py::test_history_store_tracks_per_location -v
```
Expected: `ERROR` — `ImportError`

- [ ] **Step 3: Implement history.py**

Create `finetune/history.py`:
```python
from collections import defaultdict, deque

class HistoryStore:
    """Tracks the last 5 satellite pass results per geographic location key."""

    def __init__(self, max_entries: int = 5):
        self._store: dict[str, deque] = defaultdict(lambda: deque(maxlen=max_entries))

    def add(self, location_key: str, entry: dict) -> None:
        self._store[location_key].append(entry)

    def get(self, location_key: str) -> list[dict]:
        return list(self._store.get(location_key, []))

    @staticmethod
    def make_key(lat: float, lon: float) -> str:
        return f"{lat:.4f}_{lon:.4f}"
```

- [ ] **Step 4: Run tests**

```powershell
python -m pytest tests/test_indices.py -v
```
Expected: all pass including the 3 new history tests

- [ ] **Step 5: Commit**

```powershell
git add history.py tests/test_indices.py
git commit -m "feat: temporal history store with 5-pass rolling window"
```

---

## Task 7: Build Claude label generator

**Files:**
- Create: `finetune/label_generator.py`

- [ ] **Step 1: Set ANTHROPIC_API_KEY**

```powershell
$env:ANTHROPIC_API_KEY = "sk-ant-..."
```

- [ ] **Step 2: Implement label_generator.py**

Create `finetune/label_generator.py`:
```python
import anthropic

client = anthropic.Anthropic()

SYSTEM_PROMPT = """You are an expert viticulture agronomist specializing in satellite-based vineyard monitoring. 
You interpret Sentinel-2 multispectral satellite imagery and spectral indices to provide actionable vineyard assessments.
Write in plain English for winemakers. Be specific and reference index values. Do not hedge excessively."""

def build_prompt(location: dict, timestamp: str, indices: dict, weather: dict, history: list[dict], cloud_cover: float) -> str:
    history_lines = "\n".join([
        f"  {h['timestamp']}: NDVI={h['ndvi']:.3f}, NDRE={h['ndre']:.3f}, SWIR={h['swir_moisture']:.3f}"
        for h in history[-4:]
    ]) or "  No previous passes available"

    return f"""Analyze this Sentinel-2 satellite pass over a vineyard.

Location: {location['name']}, {location['region']}, {location['country']}
Coordinates: {location['lat']:.4f}°N, {location['lon']:.4f}°E
Acquisition timestamp: {timestamp}
Cloud cover: {cloud_cover:.1f}%

Current spectral indices:
- NDVI: {indices['ndvi']:.3f} (healthy vine canopy: 0.60–0.85)
- NDRE (Red Edge): {indices['ndre']:.3f} (chlorophyll content; stressed vines: <0.20)
- SWIR Moisture Index: {indices['swir_moisture']:.3f} (water content; drought stress: <0.30)
- NBR: {indices['nbr']:.3f} (fire/burn indicator; active fire: <-0.10)
- Canopy Cover: {indices['canopy_cover']:.1f}%

Current weather:
- Temperature: {weather['temperature_2m']:.1f}°C
- Relative humidity: {weather['relative_humidity_2m']:.0f}%
- Precipitation: {weather['precipitation']:.1f}mm
- Wind speed: {weather['wind_speed_10m']:.1f} km/h
- Vapour pressure deficit: {weather['vapour_pressure_deficit']:.2f} kPa

Previous satellite passes (chronological):
{history_lines}

Write a 3–5 sentence agronomic assessment that:
1. States the current vine health status with severity (Healthy / Watch / Critical)
2. Identifies the primary concern (disease risk, water stress, fire/smoke threat, or none)
3. References specific index values that support the assessment
4. Gives one concrete, actionable recommendation
Do not use bullet points. Write as a single paragraph."""

def generate_label(location: dict, timestamp: str, indices: dict, weather: dict, history: list[dict], cloud_cover: float) -> str:
    """Generate an agronomic label using Claude with prompt caching."""
    message = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=350,
        system=[
            {
                "type": "text",
                "text": SYSTEM_PROMPT,
                "cache_control": {"type": "ephemeral"},
            }
        ],
        messages=[
            {"role": "user", "content": build_prompt(location, timestamp, indices, weather, history, cloud_cover)}
        ],
    )
    return message.content[0].text.strip()
```

- [ ] **Step 3: Smoke-test with a real call (requires ANTHROPIC_API_KEY and internet)**

```powershell
python -c "
from label_generator import generate_label
loc = {'name': 'Opus One', 'region': 'Napa Valley', 'country': 'USA', 'lat': 38.4148, 'lon': -122.4194}
indices = {'ndvi': 0.71, 'ndre': 0.18, 'swir_moisture': 0.52, 'nbr': 0.41, 'canopy_cover': 76.9}
weather = {'temperature_2m': 28.5, 'relative_humidity_2m': 65, 'precipitation': 0.0, 'wind_speed_10m': 15.2, 'vapour_pressure_deficit': 1.9}
label = generate_label(loc, '2025-08-15T10:00:00Z', indices, weather, [], 3.2)
print(label)
"
```
Expected: A paragraph describing healthy vine status with a recommendation

- [ ] **Step 4: Commit**

```powershell
git add label_generator.py
git commit -m "feat: Claude label generator with prompt caching"
```

---

## Task 8: Run full data collection

**Files:**
- Create: `finetune/collect_data.py`

- [ ] **Step 1: Implement collect_data.py**

Create `finetune/collect_data.py`:
```python
"""
Collect training data: for each vineyard × timestamp, fetch satellite images,
compute indices, fetch weather, generate Claude label.

Requires SimSat running: docker compose up (in SimSat repo dir)
Runtime estimate: 3-6 hours depending on SimSat API latency.
"""
import json
import os
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timedelta
from pathlib import Path

from config import DATA_DIR, RAW_DIR
from simsat_client import fetch_image_png, fetch_band_array, ImageUnavailable
from weather_client import fetch_weather
from indices import compute_all_indices
from history import HistoryStore
from label_generator import generate_label

LOCATIONS = json.load(open("data/vineyard_locations.json"))
TRAINING_PAIRS_PATH = DATA_DIR / "training_pairs.json"

# Generate timestamps: monthly from 2023-04 to 2025-10, growing season months only
GROWING_MONTHS = [4, 5, 6, 7, 8, 9, 10]
TIMESTAMPS = []
for year in [2023, 2024, 2025]:
    for month in GROWING_MONTHS:
        ts = f"{year}-{month:02d}-15T10:00:00Z"
        if ts < "2025-11-01T00:00:00Z":
            TIMESTAMPS.append(ts)

def collect_one(location: dict, timestamp: str, history_store: HistoryStore) -> dict | None:
    """Collect one training example. Returns None if image unavailable."""
    loc_key = f"{location['lat']:.4f}_{location['lon']:.4f}"
    out_dir = RAW_DIR / loc_key / timestamp.replace(":", "-")
    
    if (out_dir / "label.txt").exists():
        return None  # Already collected
    
    try:
        # Fetch images
        rgb_bytes = fetch_image_png(location["lat"], location["lon"], timestamp, "red,green,blue")
        swir_bytes = fetch_image_png(location["lat"], location["lon"], timestamp, "swir_2,nir,red")
        arr, meta = fetch_band_array(location["lat"], location["lon"], timestamp, "nir,red,red_edge_1,swir_1,swir_2", n_bands=5)
        
        if meta["cloud_cover"] > 70:
            return None  # Too cloudy
        
        # Compute indices
        indices = compute_all_indices(arr)
        
        # Fetch weather
        weather = fetch_weather(location["lat"], location["lon"])
        
        # Get temporal history
        history = history_store.get(loc_key)
        
        # Generate label
        label = generate_label(location, timestamp, indices, weather, history, meta["cloud_cover"])
        
        # Save to disk
        out_dir.mkdir(parents=True, exist_ok=True)
        (out_dir / "rgb.png").write_bytes(rgb_bytes)
        (out_dir / "swir.png").write_bytes(swir_bytes)
        (out_dir / "label.txt").write_text(label)
        json.dump({"indices": indices, "weather": weather, "meta": meta, "location": location, "timestamp": timestamp}, 
                  open(out_dir / "metadata.json", "w"), indent=2)
        
        # Update history
        history_store.add(loc_key, {"timestamp": timestamp, **indices})
        
        return {"path": str(out_dir), "location": location["name"], "timestamp": timestamp}
        
    except ImageUnavailable:
        return None
    except Exception as e:
        print(f"  ERROR {location['name']} {timestamp}: {e}")
        return None

def main():
    history_store = HistoryStore()
    pairs = []
    total = len(LOCATIONS) * len(TIMESTAMPS)
    print(f"Collecting {total} location×timestamp combinations ({len(LOCATIONS)} locations × {len(TIMESTAMPS)} timestamps)")
    
    # Sequential to respect SimSat rate limits and maintain history order
    for i, location in enumerate(LOCATIONS):
        print(f"\n[{i+1}/{len(LOCATIONS)}] {location['name']}")
        for timestamp in TIMESTAMPS:
            result = collect_one(location, timestamp, history_store)
            if result:
                pairs.append(result)
                print(f"  ✓ {timestamp} ({len(pairs)} total)")
            time.sleep(0.5)  # Respect SimSat API
    
    json.dump(pairs, open(TRAINING_PAIRS_PATH, "w"), indent=2)
    print(f"\nDone. {len(pairs)} training pairs saved to {TRAINING_PAIRS_PATH}")

if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Verify SimSat is running before launching**

```powershell
curl http://localhost:9005/data/current/position
```
Expected: JSON with `lon-lat-alt` field. If not, start SimSat first.

- [ ] **Step 3: Run a small test (3 locations, 2 timestamps) to verify end-to-end**

```powershell
python -c "
import json
from collect_data import collect_one
from history import HistoryStore

locs = json.load(open('data/vineyard_locations.json'))[:1]
timestamps = ['2024-06-15T10:00:00Z', '2024-07-15T10:00:00Z']
store = HistoryStore()
for ts in timestamps:
    result = collect_one(locs[0], ts, store)
    print(result)
"
```
Expected: either a dict with path or None (if image unavailable over ocean). No exceptions.

- [ ] **Step 4: Run full collection (runs for several hours — start before bed)**

```powershell
python collect_data.py
```
Expected: progress output with ✓ marks. Final line: `N training pairs saved`

- [ ] **Step 5: Commit**

```powershell
git add collect_data.py
git commit -m "feat: parallel data collection script with history tracking"
```

---

## Task 9: Prepare HuggingFace dataset

**Files:**
- Create: `finetune/prepare_dataset.py`

- [ ] **Step 1: Implement prepare_dataset.py**

Create `finetune/prepare_dataset.py`:
```python
"""Convert collected raw data into a HuggingFace Dataset for fine-tuning."""
import json
import random
from pathlib import Path
from datasets import Dataset, DatasetDict
from PIL import Image
import io

TRAINING_PAIRS_PATH = Path("data/training_pairs.json")
DATASET_PATH = Path("data/hf_dataset")

def load_pair(pair: dict) -> dict | None:
    out_dir = Path(pair["path"])
    rgb_path = out_dir / "rgb.png"
    swir_path = out_dir / "swir.png"
    label_path = out_dir / "label.txt"
    meta_path = out_dir / "metadata.json"
    
    if not all(p.exists() for p in [rgb_path, swir_path, label_path, meta_path]):
        return None
    
    meta = json.load(open(meta_path))
    label = label_path.read_text().strip()
    if len(label) < 50:
        return None

    def img_bytes(path):
        return open(path, "rb").read()

    return {
        "rgb_image": img_bytes(rgb_path),
        "swir_image": img_bytes(swir_path),
        "label": label,
        "ndvi": meta["indices"]["ndvi"],
        "ndre": meta["indices"]["ndre"],
        "swir_moisture": meta["indices"]["swir_moisture"],
        "nbr": meta["indices"]["nbr"],
        "canopy_cover": meta["indices"]["canopy_cover"],
        "temperature": meta["weather"]["temperature_2m"],
        "humidity": meta["weather"]["relative_humidity_2m"],
        "location_name": meta["location"]["name"],
        "region": meta["location"]["region"],
        "timestamp": meta["timestamp"],
    }

def main():
    pairs = json.load(open(TRAINING_PAIRS_PATH))
    print(f"Loading {len(pairs)} collected pairs...")
    
    records = [r for p in pairs if (r := load_pair(p)) is not None]
    print(f"{len(records)} valid records loaded")
    
    random.seed(42)
    random.shuffle(records)
    split = int(len(records) * 0.9)
    train_records = records[:split]
    val_records = records[split:]
    
    dataset = DatasetDict({
        "train": Dataset.from_list(train_records),
        "validation": Dataset.from_list(val_records),
    })
    dataset.save_to_disk(str(DATASET_PATH))
    print(f"Dataset saved: {len(train_records)} train, {len(val_records)} validation")
    print(f"Path: {DATASET_PATH}")

if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Run it**

```powershell
python prepare_dataset.py
```
Expected: `N valid records loaded` → `Dataset saved: X train, Y validation`

- [ ] **Step 3: Verify dataset structure**

```powershell
python -c "
from datasets import load_from_disk
ds = load_from_disk('data/hf_dataset')
print(ds)
print(ds['train'][0].keys())
print('Label sample:', ds['train'][0]['label'][:200])
"
```

- [ ] **Step 4: Commit**

```powershell
git add prepare_dataset.py
git commit -m "feat: dataset preparation with 90/10 train/val split"
```

---

## Task 10: Fine-tune LFM2.5-VL-1.6B

**Files:**
- Create: `finetune/finetune.py`

- [ ] **Step 1: Inspect the model's chat template before writing training code**

```powershell
python -c "
from transformers import AutoProcessor
p = AutoProcessor.from_pretrained('LiquidAI/LFM2.5-VL-1.6B')
print('Chat template:', p.tokenizer.chat_template[:500] if p.tokenizer.chat_template else 'None')
print('EOS token:', p.tokenizer.eos_token)
print('Special tokens:', p.tokenizer.all_special_tokens[:10])
"
```
Note the output — you'll need the exact assistant start token for label masking in the next step.

- [ ] **Step 2: Implement finetune.py**

Create `finetune/finetune.py`:
```python
"""Fine-tune LFM2.5-VL-1.6B on vineyard satellite imagery."""
import json
import torch
from pathlib import Path
from datasets import load_from_disk
from transformers import (
    AutoProcessor, AutoModelForCausalLM,
    TrainingArguments, Trainer,
)
from PIL import Image
import io

MODEL_ID = "LiquidAI/LFM2.5-VL-1.6B"
DATASET_PATH = Path("data/hf_dataset")
OUTPUT_DIR = Path("data/terroir-finetuned")

processor = AutoProcessor.from_pretrained(MODEL_ID)

def build_prompt(example: dict) -> str:
    return (
        f"Analyze these Sentinel-2 satellite images of a vineyard.\n"
        f"RGB composite (left) and SWIR false color (right).\n"
        f"Location: {example['location_name']}, {example['region']}\n"
        f"Spectral indices: NDVI={example['ndvi']:.3f}, NDRE={example['ndre']:.3f}, "
        f"SWIR moisture={example['swir_moisture']:.3f}, NBR={example['nbr']:.3f}, "
        f"Canopy cover={example['canopy_cover']:.1f}%\n"
        f"Weather: {example['temperature']:.1f}°C, {example['humidity']:.0f}% humidity\n"
        f"Provide an agronomic assessment."
    )

def preprocess(example: dict) -> dict:
    rgb = Image.open(io.BytesIO(example["rgb_image"])).convert("RGB")
    swir = Image.open(io.BytesIO(example["swir_image"])).convert("RGB")
    
    messages = [
        {
            "role": "user",
            "content": [
                {"type": "image"},
                {"type": "image"},
                {"type": "text", "text": build_prompt(example)},
            ],
        },
        {"role": "assistant", "content": example["label"]},
    ]
    
    text = processor.apply_chat_template(messages, tokenize=False, add_generation_prompt=False)
    inputs = processor(
        text=text, images=[rgb, swir],
        return_tensors="pt", padding=True,
        truncation=True, max_length=1024,
    )
    
    input_ids = inputs["input_ids"].squeeze(0)
    labels = input_ids.clone()
    
    # Mask everything before assistant response (-100 = ignored in loss)
    # Find the assistant turn start by locating the label text in the token sequence
    label_tokens = processor.tokenizer.encode(example["label"], add_special_tokens=False)
    label_len = len(label_tokens)
    # Set all tokens except the last label_len to -100
    labels[:-label_len] = -100
    
    return {
        "input_ids": input_ids,
        "attention_mask": inputs["attention_mask"].squeeze(0),
        "pixel_values": inputs["pixel_values"].squeeze(0),
        "labels": labels,
    }

def collate_fn(batch):
    pad_id = processor.tokenizer.pad_token_id or 0
    input_ids = torch.nn.utils.rnn.pad_sequence([b["input_ids"] for b in batch], batch_first=True, padding_value=pad_id)
    attention_mask = torch.nn.utils.rnn.pad_sequence([b["attention_mask"] for b in batch], batch_first=True, padding_value=0)
    labels = torch.nn.utils.rnn.pad_sequence([b["labels"] for b in batch], batch_first=True, padding_value=-100)
    pixel_values = torch.stack([b["pixel_values"] for b in batch])
    return {"input_ids": input_ids, "attention_mask": attention_mask, "pixel_values": pixel_values, "labels": labels}

def main():
    print(f"Loading model {MODEL_ID}...")
    model = AutoModelForCausalLM.from_pretrained(
        MODEL_ID, torch_dtype=torch.bfloat16, device_map="cuda",
    )
    model.gradient_checkpointing_enable()
    
    print("Loading dataset...")
    dataset = load_from_disk(str(DATASET_PATH))
    train_ds = dataset["train"].map(preprocess, remove_columns=dataset["train"].column_names)
    val_ds = dataset["validation"].map(preprocess, remove_columns=dataset["validation"].column_names)
    
    args = TrainingArguments(
        output_dir=str(OUTPUT_DIR),
        num_train_epochs=3,
        per_device_train_batch_size=2,
        per_device_eval_batch_size=2,
        gradient_accumulation_steps=8,
        learning_rate=2e-5,
        weight_decay=0.01,
        warmup_ratio=0.05,
        bf16=True,
        logging_steps=10,
        eval_strategy="epoch",
        save_strategy="epoch",
        save_total_limit=2,
        load_best_model_at_end=True,
        report_to="none",
        dataloader_num_workers=2,
    )
    
    trainer = Trainer(
        model=model,
        args=args,
        train_dataset=train_ds,
        eval_dataset=val_ds,
        data_collator=collate_fn,
    )
    
    print("Starting fine-tuning (estimated 6-10 hours)...")
    trainer.train()
    trainer.save_model(str(OUTPUT_DIR / "final"))
    processor.save_pretrained(str(OUTPUT_DIR / "final"))
    print(f"Model saved to {OUTPUT_DIR / 'final'}")

if __name__ == "__main__":
    main()
```

- [ ] **Step 3: Verify the preprocessing works on one example before running full training**

```powershell
python -c "
from datasets import load_from_disk
from finetune import preprocess
ds = load_from_disk('data/hf_dataset')
result = preprocess(ds['train'][0])
print('input_ids shape:', result['input_ids'].shape)
print('labels non-masked tokens:', (result['labels'] != -100).sum().item())
"
```
Expected: shapes printed, non-masked count matches label length roughly

- [ ] **Step 4: Start training (start before going to sleep)**

```powershell
python finetune.py
```
Expected: progress bar with loss decreasing. Takes 6-10 hours.

- [ ] **Step 5: Commit**

```powershell
git add finetune.py
git commit -m "feat: full fine-tune script for LFM2.5-VL-1.6B on vineyard imagery"
```

---

## Task 11: Evaluate and publish to HuggingFace

**Files:**
- Create: `finetune/evaluate.py`
- Create: `finetune/publish.py`

- [ ] **Step 1: Implement evaluate.py**

Create `finetune/evaluate.py`:
```python
"""Compare base LFM2.5-VL output vs fine-tuned output on 20 validation examples."""
import json
import torch
from pathlib import Path
from datasets import load_from_disk
from transformers import AutoProcessor, AutoModelForCausalLM
from PIL import Image
import io

MODEL_ID = "LiquidAI/LFM2.5-VL-1.6B"
FINETUNED_PATH = Path("data/terroir-finetuned/final")
DATASET_PATH = Path("data/hf_dataset")
RESULTS_PATH = Path("data/evaluation_results.json")

def generate_response(model, processor, example: dict) -> str:
    rgb = Image.open(io.BytesIO(example["rgb_image"])).convert("RGB")
    swir = Image.open(io.BytesIO(example["swir_image"])).convert("RGB")
    prompt = (
        f"Analyze these Sentinel-2 satellite images of a vineyard.\n"
        f"Spectral indices: NDVI={example['ndvi']:.3f}, NDRE={example['ndre']:.3f}, "
        f"SWIR moisture={example['swir_moisture']:.3f}\n"
        f"Weather: {example['temperature']:.1f}°C, {example['humidity']:.0f}% humidity\n"
        f"Provide an agronomic assessment."
    )
    messages = [{"role": "user", "content": [{"type": "image"}, {"type": "image"}, {"type": "text", "text": prompt}]}]
    text = processor.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)
    inputs = processor(text=text, images=[rgb, swir], return_tensors="pt").to("cuda")
    
    with torch.no_grad():
        output = model.generate(**inputs, max_new_tokens=300, do_sample=False)
    return processor.decode(output[0][inputs["input_ids"].shape[1]:], skip_special_tokens=True)

def main():
    dataset = load_from_disk(str(DATASET_PATH))
    val_examples = list(dataset["validation"])[:20]
    
    results = []
    for model_name, model_path in [("base", MODEL_ID), ("finetuned", str(FINETUNED_PATH))]:
        print(f"\nLoading {model_name} model...")
        processor = AutoProcessor.from_pretrained(model_path)
        model = AutoModelForCausalLM.from_pretrained(model_path, torch_dtype=torch.bfloat16, device_map="cuda")
        model.eval()
        
        for i, ex in enumerate(val_examples):
            response = generate_response(model, processor, ex)
            results.append({
                "model": model_name,
                "example_id": i,
                "location": ex["location_name"],
                "ground_truth": ex["label"],
                "prediction": response,
            })
            print(f"  [{i+1}/20] {ex['location_name']}: {response[:80]}...")
        
        del model
        torch.cuda.empty_cache()
    
    json.dump(results, open(RESULTS_PATH, "w"), indent=2)
    print(f"\nResults saved to {RESULTS_PATH}")
    print("\nSample comparison:")
    base = next(r for r in results if r["model"] == "base" and r["example_id"] == 0)
    ft = next(r for r in results if r["model"] == "finetuned" and r["example_id"] == 0)
    print(f"Base:      {base['prediction'][:200]}")
    print(f"Finetuned: {ft['prediction'][:200]}")

if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Run evaluation**

```powershell
python evaluate.py
```
Expected: two models run on 20 examples. Results saved. Fine-tuned output should reference viticulture terms (mildew, canopy, phenolic, SWIR) absent in base model output.

- [ ] **Step 3: Implement publish.py**

Create `finetune/publish.py`:
```python
"""Publish fine-tuned model and training code to HuggingFace Hub."""
from huggingface_hub import HfApi
from pathlib import Path
import json

HF_REPO_ID = "gabinnocenzi/terroir-lfm25-vl"
FINETUNED_PATH = Path("data/terroir-finetuned/final")

def main():
    api = HfApi()
    
    # Create repo if it doesn't exist
    api.create_repo(HF_REPO_ID, repo_type="model", exist_ok=True, private=False)
    
    # Upload model files
    api.upload_folder(
        folder_path=str(FINETUNED_PATH),
        repo_id=HF_REPO_ID,
        repo_type="model",
    )
    
    # Upload training code
    for f in ["finetune.py", "collect_data.py", "prepare_dataset.py", "evaluate.py", 
              "indices.py", "label_generator.py", "simsat_client.py", "weather_client.py",
              "config.py", "requirements.txt"]:
        api.upload_file(path_or_fileobj=f, path_in_repo=f"training_code/{f}", repo_id=HF_REPO_ID)
    
    print(f"Published to https://huggingface.co/{HF_REPO_ID}")

if __name__ == "__main__":
    main()
```

- [ ] **Step 4: Login to HuggingFace and publish**

```powershell
python -c "from huggingface_hub import login; login()"
python publish.py
```
Expected: `Published to https://huggingface.co/gabinnocenzi/terroir-lfm25-vl`

- [ ] **Step 5: Note the published model path for the inference service**

Open `finetune/config.py` and note `HF_REPO_ID = "gabinnocenzi/terroir-lfm25-vl"` — this is what the inference service will load.

- [ ] **Step 6: Commit everything**

```powershell
git add evaluate.py publish.py
git commit -m "feat: evaluation script and HuggingFace publish pipeline"
```

---

## Timeline

| Days | Tasks | Notes |
|---|---|---|
| Apr 19–20 | Tasks 1–7 | Setup + all client modules |
| Apr 21 | Task 8 | Start data collection overnight |
| Apr 22 | Task 9 | Prepare dataset |
| Apr 22–23 | Task 10 | Start fine-tuning overnight |
| Apr 24 | Task 11 | Evaluate + publish |
| Apr 25+ | Use model in application | Load from HuggingFace |
