# Terroir Application — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Terroir web application — a Next.js split-panel dashboard that shows a live satellite ground track, vineyard health alerts from fine-tuned LFM2.5-VL, and real-time spectral analysis delivered via WebSocket.

**Architecture:** Five Docker Compose services: SimSat (2 containers, official), monitor (Python FastAPI poller), inference (Python FastAPI + LFM2.5-VL), webapp (Next.js). Monitor polls SimSat every 30s, fetches Sentinel-2 images + Open-Meteo weather, computes indices, sends to inference service, broadcasts results via WebSocket on port 8001. Browser connects directly to ws://localhost:8001/ws for live updates.

**Tech Stack:** Python 3.11, FastAPI, uvicorn, Next.js 14, React, TypeScript, Tailwind CSS, Mapbox GL JS (react-map-gl), Recharts, Docker + Docker Compose, NVIDIA Container Toolkit (for GPU inference on Windows)

**Development machine:** Mac (webapp development). **Demo machine:** Windows gaming PC (runs full Docker Compose with GPU). Code is the same on both — Docker abstracts the difference.

**Important:** Build the inference service with the **base LFM2.5-VL model** first (for development). Swap `MODEL_PATH` to the fine-tuned HuggingFace repo once fine-tuning completes (see finetune plan).

---

## File Structure

```
terroir/                          ← project root (gaming PC and Mac)
├── docker-compose.yml
├── docker-compose.dev.yml        ← Mac dev override (CPU inference, no GPU)
├── .env.example
├── .gitignore
│
├── monitor/
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── main.py                   ← FastAPI app + polling loop + WebSocket
│   ├── simsat_client.py          ← SimSat API wrapper
│   ├── weather_client.py         ← Open-Meteo wrapper
│   ├── indices.py                ← NDVI, NDRE, SWIR, NBR, canopy cover
│   ├── history.py                ← Rolling 5-pass history per location
│   └── tests/
│       ├── test_indices.py
│       ├── test_simsat_client.py
│       └── test_weather_client.py
│
├── inference/
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── main.py                   ← FastAPI /analyze endpoint
│   ├── model.py                  ← Model loading + inference
│   ├── schemas.py                ← Pydantic request/response types
│   └── tests/
│       └── test_inference_api.py
│
└── webapp/
    ├── Dockerfile
    ├── package.json
    ├── next.config.ts
    ├── tailwind.config.ts
    ├── tsconfig.json
    └── src/
        ├── app/
        │   ├── layout.tsx
        │   ├── page.tsx
        │   └── globals.css
        ├── components/
        │   ├── Map.tsx            ← Mapbox GL JS satellite ground track + fire markers
        │   ├── AlertCard.tsx      ← Single incident card with images + analysis
        │   ├── ImageSlider.tsx    ← RGB→SWIR drag comparison
        │   ├── TrendChart.tsx     ← NDVI/NDRE line chart (Recharts)
        │   ├── WeatherStrip.tsx   ← Humidity, temp, VPD strip
        │   ├── PassHistory.tsx    ← Scrollable pass log
        │   ├── SatelliteStatus.tsx← Position, next scan countdown
        │   └── AlertPanel.tsx     ← Right panel assembling all components
        ├── hooks/
        │   ├── useWebSocket.ts    ← WebSocket connection + reconnect
        │   └── useTheme.ts        ← Auto dark/light by sunrise/sunset
        └── lib/
            └── types.ts           ← Shared TypeScript interfaces
```

---

## Task 1: Project scaffold

**Files:**
- Create: `terroir/docker-compose.yml`
- Create: `terroir/docker-compose.dev.yml`
- Create: `terroir/.env.example`
- Create: `terroir/.gitignore`

- [ ] **Step 1: Create the project root**

```bash
mkdir -p ~/Desktop/Files/STARTUPS/Terroir
cd ~/Desktop/Files/STARTUPS/Terroir
mkdir -p monitor/tests inference/tests webapp/src/{app,components,hooks,lib}
```

- [ ] **Step 2: Create .env.example**

Create `terroir/.env.example`:
```env
MAPBOX_ACCESS_TOKEN=your_mapbox_token_here
HF_MODEL_PATH=LiquidAI/LFM2.5-VL-1.6B
SIMSAT_API_URL=http://simsat-api:9005
SIMSAT_DASHBOARD_URL=http://simsat-dashboard:8000
INFERENCE_URL=http://inference:8002
MONITOR_WS_PORT=8001
```

- [ ] **Step 3: Create .gitignore**

Create `terroir/.gitignore`:
```
.env
node_modules/
.next/
__pycache__/
*.pyc
.pytest_cache/
data/raw/
data/hf_dataset/
data/terroir-finetuned/
*.pt
*.safetensors
.superpowers/
```

- [ ] **Step 4: Create docker-compose.yml**

Create `terroir/docker-compose.yml`:
```yaml
services:
  simsat-sim:
    image: dphi/simsat-sim:latest
    ports:
      - "8000:8000"
    environment:
      - MAPBOX_ACCESS_TOKEN=${MAPBOX_ACCESS_TOKEN}

  simsat-api:
    image: dphi/simsat-api:latest
    ports:
      - "9005:9005"
    depends_on:
      - simsat-sim

  inference:
    build: ./inference
    ports:
      - "8002:8002"
    environment:
      - HF_MODEL_PATH=${HF_MODEL_PATH:-LiquidAI/LFM2.5-VL-1.6B}
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: 1
              capabilities: [gpu]
    volumes:
      - hf_cache:/root/.cache/huggingface

  monitor:
    build: ./monitor
    ports:
      - "8001:8001"
    environment:
      - SIMSAT_API_URL=http://simsat-api:9005
      - INFERENCE_URL=http://inference:8002
    depends_on:
      - simsat-api
      - inference

  webapp:
    build: ./webapp
    ports:
      - "3000:3000"
    environment:
      - NEXT_PUBLIC_MONITOR_WS_URL=ws://localhost:8001/ws
      - NEXT_PUBLIC_MONITOR_API_URL=http://localhost:8001
      - NEXT_PUBLIC_MAPBOX_TOKEN=${MAPBOX_ACCESS_TOKEN}

volumes:
  hf_cache:
```

- [ ] **Step 5: Create docker-compose.dev.yml (Mac dev — no GPU)**

Create `terroir/docker-compose.dev.yml`:
```yaml
services:
  inference:
    deploy:
      resources: {}
    environment:
      - HF_MODEL_PATH=LiquidAI/LFM2.5-VL-450M
```

- [ ] **Step 6: Copy your Mapbox token into a real .env**

```bash
cp .env.example .env
# Edit .env and add your Mapbox token
```

- [ ] **Step 7: Commit**

```bash
cd ~/Desktop/Files/STARTUPS/Terroir
git init
git add docker-compose.yml docker-compose.dev.yml .env.example .gitignore
git commit -m "feat: project scaffold with Docker Compose"
```

---

## Task 2: Monitor service — Python modules

**Files:**
- Create: `monitor/requirements.txt`
- Create: `monitor/simsat_client.py`
- Create: `monitor/weather_client.py`
- Create: `monitor/indices.py`
- Create: `monitor/history.py`
- Create: `monitor/tests/test_indices.py`
- Create: `monitor/tests/test_simsat_client.py`
- Create: `monitor/tests/test_weather_client.py`

- [ ] **Step 1: Create monitor/requirements.txt**

```
fastapi==0.115.0
uvicorn[standard]==0.30.0
requests==2.32.0
numpy==1.26.4
pillow==10.4.0
pytest==8.3.0
httpx==0.27.0
```

- [ ] **Step 2: Copy the tested modules from the finetune pipeline**

The monitor needs the same `simsat_client.py`, `weather_client.py`, `indices.py`, and `history.py` from the finetune pipeline. Copy them:

```bash
cp finetune/simsat_client.py monitor/simsat_client.py
cp finetune/weather_client.py monitor/weather_client.py
cp finetune/indices.py monitor/indices.py
cp finetune/history.py monitor/history.py
cp finetune/tests/test_indices.py monitor/tests/test_indices.py
cp finetune/tests/test_simsat_client.py monitor/tests/test_simsat_client.py
cp finetune/tests/test_weather_client.py monitor/tests/test_weather_client.py
```

- [ ] **Step 3: Update simsat_client.py to use env var instead of config.py**

Edit `monitor/simsat_client.py` — replace the config import with:
```python
import os
SIMSAT_API = os.getenv("SIMSAT_API_URL", "http://localhost:9005")
IMAGE_SIZE_KM = 5.0
WINDOW_SECONDS = 864000
```
Remove `from config import ...` at the top.

- [ ] **Step 4: Update weather_client.py to remove config import**

Edit `monitor/weather_client.py` — replace:
```python
from config import OPEN_METEO_API
```
with:
```python
OPEN_METEO_API = "https://api.open-meteo.com/v1/forecast"
```

- [ ] **Step 5: Run tests**

```bash
cd monitor
pip install -r requirements.txt
python -m pytest tests/ -v
```
Expected: all tests pass

- [ ] **Step 6: Commit**

```bash
cd ..
git add monitor/
git commit -m "feat: monitor service Python modules (simsat, weather, indices, history)"
```

---

## Task 3: Monitor service — main FastAPI app

**Files:**
- Create: `monitor/main.py`
- Create: `monitor/Dockerfile`

- [ ] **Step 1: Implement monitor/main.py**

Create `monitor/main.py`:
```python
"""
Terroir Monitor Service
- Polls SimSat every 30s for satellite position + Sentinel-2 imagery
- Fetches Open-Meteo weather at current coordinates
- Computes spectral indices (NDVI, NDRE, SWIR, NBR, canopy cover)
- Sends to inference service for LFM2-VL analysis
- Broadcasts results to connected webapp clients via WebSocket
- Exposes REST endpoints for initial state load
"""
import asyncio
import json
import os
import time
import logging
from contextlib import asynccontextmanager
from typing import Set

import requests
import numpy as np
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from simsat_client import fetch_image_png, fetch_band_array, ImageUnavailable
from weather_client import fetch_weather
from indices import compute_all_indices
from history import HistoryStore

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

SIMSAT_API = os.getenv("SIMSAT_API_URL", "http://localhost:9005")
INFERENCE_URL = os.getenv("INFERENCE_URL", "http://localhost:8002")
POLL_INTERVAL_SECONDS = 30

history_store = HistoryStore()
active_alerts: list[dict] = []
satellite_status: dict = {"position": None, "last_scan": None, "next_scan_in": POLL_INTERVAL_SECONDS}
connected_clients: Set[WebSocket] = set()


async def broadcast(message: dict):
    """Send a message to all connected WebSocket clients."""
    disconnected = set()
    for ws in connected_clients:
        try:
            await ws.send_json(message)
        except Exception:
            disconnected.add(ws)
    connected_clients.difference_update(disconnected)


def analyze_with_inference(image_set: dict, indices: dict, weather: dict, lat: float, lon: float, timestamp: str, history: list) -> dict | None:
    """Call the inference service with satellite data."""
    import base64
    payload = {
        "images": {
            "rgb": base64.b64encode(image_set["rgb"]).decode(),
            "swir": base64.b64encode(image_set["swir"]).decode(),
        },
        "indices": indices,
        "weather": weather,
        "location": {"lat": lat, "lon": lon},
        "timestamp": timestamp,
        "temporal_history": history,
    }
    try:
        resp = requests.post(f"{INFERENCE_URL}/analyze", json=payload, timeout=120)
        resp.raise_for_status()
        return resp.json()
    except Exception as e:
        logger.error(f"Inference failed: {e}")
        return None


async def polling_loop():
    """Main satellite monitoring loop. Runs every POLL_INTERVAL_SECONDS."""
    global satellite_status, active_alerts

    while True:
        try:
            # 1. Get current satellite position
            resp = requests.get(f"{SIMSAT_API}/data/current/position", timeout=10)
            resp.raise_for_status()
            pos = resp.json()
            lon, lat, alt = pos["lon-lat-alt"]
            timestamp = pos["timestamp"]

            satellite_status = {
                "position": {"lat": lat, "lon": lon, "alt_km": alt},
                "timestamp": timestamp,
                "last_scan": time.time(),
                "next_scan_in": POLL_INTERVAL_SECONDS,
            }
            await broadcast({"type": "satellite_position", "data": satellite_status})

            # 2. Fetch images (only over land — ImageUnavailable handles ocean)
            try:
                rgb_bytes = fetch_image_png(lat, lon, timestamp, "red,green,blue")
                swir_bytes = fetch_image_png(lat, lon, timestamp, "swir_2,nir,red")
                arr, meta = fetch_band_array(lat, lon, timestamp, "nir,red,red_edge_1,swir_1,swir_2", n_bands=5)
            except ImageUnavailable:
                logger.info(f"No image at ({lat:.2f}, {lon:.2f}) — likely ocean")
                await asyncio.sleep(POLL_INTERVAL_SECONDS)
                continue

            # 3. Compute spectral indices
            indices = compute_all_indices(arr)

            # 4. Fetch weather
            weather = fetch_weather(lat, lon)

            # 5. Get temporal history
            loc_key = f"{lat:.3f}_{lon:.3f}"
            history = history_store.get(loc_key)

            # 6. Run LFM2-VL inference
            result = analyze_with_inference(
                {"rgb": rgb_bytes, "swir": swir_bytes},
                indices, weather, lat, lon, timestamp, history,
            )

            if result:
                alert = {
                    "id": f"{lat:.3f}_{lon:.3f}_{timestamp}",
                    "timestamp": timestamp,
                    "location": {"lat": lat, "lon": lon},
                    "severity": result["severity"],
                    "confidence": result["confidence"],
                    "report": result["report"],
                    "harvest_signal": result.get("harvest_signal"),
                    "indices": indices,
                    "weather": weather,
                    "cloud_cover": meta["cloud_cover"],
                    "rgb_image": __import__("base64").b64encode(rgb_bytes).decode(),
                    "swir_image": __import__("base64").b64encode(swir_bytes).decode(),
                }
                
                # Keep only the last 10 alerts
                active_alerts = ([alert] + [a for a in active_alerts if a["id"] != alert["id"]])[:10]
                
                # Update history
                history_store.add(loc_key, {"timestamp": timestamp, **indices})

                await broadcast({"type": "alert", "data": alert})
                logger.info(f"Alert: {result['severity']} at ({lat:.2f}, {lon:.2f}) — {result['report'][:60]}")

        except Exception as e:
            logger.error(f"Polling error: {e}")

        await asyncio.sleep(POLL_INTERVAL_SECONDS)


@asynccontextmanager
async def lifespan(app: FastAPI):
    task = asyncio.create_task(polling_loop())
    yield
    task.cancel()


app = FastAPI(title="Terroir Monitor", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    connected_clients.add(websocket)
    # Send current state immediately on connect
    await websocket.send_json({"type": "initial_state", "data": {"alerts": active_alerts, "status": satellite_status}})
    try:
        while True:
            await websocket.receive_text()  # keep alive
    except WebSocketDisconnect:
        connected_clients.discard(websocket)


@app.get("/alerts")
def get_alerts():
    return {"alerts": active_alerts}


@app.get("/status")
def get_status():
    return satellite_status


@app.get("/health")
def health():
    return {"status": "ok"}
```

- [ ] **Step 2: Create monitor/Dockerfile**

Create `monitor/Dockerfile`:
```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8001"]
```

- [ ] **Step 3: Test locally (requires SimSat + inference running)**

```bash
cd monitor
SIMSAT_API_URL=http://localhost:9005 INFERENCE_URL=http://localhost:8002 uvicorn main:app --port 8001 --reload
```
In another terminal:
```bash
curl http://localhost:8001/health
```
Expected: `{"status": "ok"}`

- [ ] **Step 4: Commit**

```bash
cd ..
git add monitor/main.py monitor/Dockerfile
git commit -m "feat: monitor service with polling loop and WebSocket broadcast"
```

---

## Task 4: Inference service — schemas and model

**Files:**
- Create: `inference/requirements.txt`
- Create: `inference/schemas.py`
- Create: `inference/model.py`
- Create: `inference/tests/test_inference_api.py`

- [ ] **Step 1: Create inference/requirements.txt**

```
fastapi==0.115.0
uvicorn[standard]==0.30.0
transformers==4.46.0
torch==2.5.0
Pillow==10.4.0
numpy==1.26.4
huggingface_hub==0.25.0
pytest==8.3.0
httpx==0.27.0
```

- [ ] **Step 2: Create inference/schemas.py**

Create `inference/schemas.py`:
```python
from pydantic import BaseModel
from typing import Optional

class ImageSet(BaseModel):
    rgb: str    # base64-encoded PNG
    swir: str   # base64-encoded PNG

class IndicesPayload(BaseModel):
    ndvi: float
    ndre: float
    swir_moisture: float
    nbr: float
    canopy_cover: float

class WeatherPayload(BaseModel):
    temperature_2m: float
    relative_humidity_2m: float
    precipitation: float
    wind_speed_10m: float
    vapour_pressure_deficit: float

class LocationPayload(BaseModel):
    lat: float
    lon: float

class HistoryEntry(BaseModel):
    timestamp: str
    ndvi: float
    ndre: float
    swir_moisture: float

class AnalyzeRequest(BaseModel):
    images: ImageSet
    indices: IndicesPayload
    weather: WeatherPayload
    location: LocationPayload
    timestamp: str
    temporal_history: list[HistoryEntry] = []

class AnalyzeResponse(BaseModel):
    severity: str                          # "HEALTHY" | "WATCH" | "CRITICAL"
    confidence: float                      # 0.0–1.0
    report: str                            # Natural language analysis
    harvest_signal: Optional[str] = None   # "HARVEST_NOW" | "DELAY_7_DAYS" | "ON_TRACK" | None
    indices_summary: IndicesPayload
    weather_summary: WeatherPayload
```

- [ ] **Step 3: Write the failing inference API test**

Create `inference/tests/test_inference_api.py`:
```python
import pytest
import base64
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock
from PIL import Image
import io

def make_png_b64() -> str:
    img = Image.new("RGB", (100, 100), color=(128, 64, 32))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return base64.b64encode(buf.getvalue()).decode()

VALID_REQUEST = {
    "images": {"rgb": make_png_b64(), "swir": make_png_b64()},
    "indices": {"ndvi": 0.71, "ndre": 0.18, "swir_moisture": 0.52, "nbr": 0.41, "canopy_cover": 76.9},
    "weather": {"temperature_2m": 24.0, "relative_humidity_2m": 65, "precipitation": 0.0, "wind_speed_10m": 12.0, "vapour_pressure_deficit": 1.8},
    "location": {"lat": 38.4, "lon": -122.4},
    "timestamp": "2025-08-15T10:00:00Z",
    "temporal_history": [],
}

@patch("model.run_inference")
def test_analyze_returns_valid_response(mock_infer):
    mock_infer.return_value = {
        "severity": "WATCH",
        "confidence": 0.85,
        "report": "Moderate water stress detected. SWIR moisture index declining.",
        "harvest_signal": "DELAY_7_DAYS",
    }
    from main import app
    client = TestClient(app)
    resp = client.post("/analyze", json=VALID_REQUEST)
    assert resp.status_code == 200
    data = resp.json()
    assert data["severity"] in ("HEALTHY", "WATCH", "CRITICAL")
    assert 0.0 <= data["confidence"] <= 1.0
    assert len(data["report"]) > 20

@patch("model.run_inference")
def test_analyze_severity_healthy_when_all_good(mock_infer):
    mock_infer.return_value = {
        "severity": "HEALTHY",
        "confidence": 0.92,
        "report": "Vine canopy shows excellent health.",
        "harvest_signal": "ON_TRACK",
    }
    from main import app
    client = TestClient(app)
    resp = client.post("/analyze", json=VALID_REQUEST)
    assert resp.status_code == 200
    assert resp.json()["severity"] == "HEALTHY"
```

- [ ] **Step 4: Run to verify failure**

```bash
cd inference
pip install -r requirements.txt
python -m pytest tests/ -v
```
Expected: `ImportError` — module not found

- [ ] **Step 5: Create inference/model.py**

Create `inference/model.py`:
```python
"""LFM2.5-VL model loading and inference for Terroir."""
import base64
import io
import os
import re
import logging
import torch
from PIL import Image
from transformers import AutoProcessor, AutoModelForCausalLM

logger = logging.getLogger(__name__)

MODEL_PATH = os.getenv("HF_MODEL_PATH", "LiquidAI/LFM2.5-VL-1.6B")
_model = None
_processor = None


def load_model():
    global _model, _processor
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
```

- [ ] **Step 6: Create inference/main.py**

Create `inference/main.py`:
```python
import logging
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from schemas import AnalyzeRequest, AnalyzeResponse
import model as model_module

logging.basicConfig(level=logging.INFO)
app = FastAPI(title="Terroir Inference Service")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


@app.on_event("startup")
def startup():
    model_module.load_model()


@app.post("/analyze", response_model=AnalyzeResponse)
def analyze(req: AnalyzeRequest):
    try:
        result = model_module.run_inference(
            rgb_b64=req.images.rgb,
            swir_b64=req.images.swir,
            indices=req.indices.model_dump(),
            weather=req.weather.model_dump(),
            history=[h.model_dump() for h in req.temporal_history],
            lat=req.location.lat,
            lon=req.location.lon,
            timestamp=req.timestamp,
        )
        return AnalyzeResponse(
            severity=result["severity"],
            confidence=result["confidence"],
            report=result["report"],
            harvest_signal=result.get("harvest_signal"),
            indices_summary=req.indices,
            weather_summary=req.weather,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/health")
def health():
    return {"status": "ok", "model": model_module.MODEL_PATH}
```

- [ ] **Step 7: Run tests**

```bash
python -m pytest tests/test_inference_api.py -v
```
Expected: `2 passed`

- [ ] **Step 8: Create inference/Dockerfile**

Create `inference/Dockerfile`:
```dockerfile
FROM python:3.11-slim
WORKDIR /app
RUN apt-get update && apt-get install -y git && rm -rf /var/lib/apt/lists/*
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8002"]
```

- [ ] **Step 9: Commit**

```bash
cd ..
git add inference/
git commit -m "feat: inference service with FastAPI, LFM2.5-VL model loading, severity parsing"
```

---

## Task 5: Webapp — Next.js setup and TypeScript types

**Files:**
- Create: `webapp/package.json`
- Create: `webapp/next.config.ts`
- Create: `webapp/tailwind.config.ts`
- Create: `webapp/src/lib/types.ts`
- Create: `webapp/src/app/globals.css`

- [ ] **Step 1: Scaffold Next.js project**

```bash
cd webapp
npx create-next-app@latest . --typescript --tailwind --eslint --app --no-src-dir --import-alias "@/*"
# When it asks "Would you like to use src/ directory?" → No
# After creation, restructure to use src/:
mkdir -p src/{app,components,hooks,lib}
mv app/* src/app/ 2>/dev/null || true
```

Actually use this command which sets up correctly:
```bash
cd ~/Desktop/Files/STARTUPS/Terroir/webapp
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --no-turbopack
```

- [ ] **Step 2: Install additional dependencies**

```bash
npm install react-map-gl mapbox-gl recharts
npm install --save-dev @types/mapbox-gl
```

- [ ] **Step 3: Create src/lib/types.ts**

Create `webapp/src/lib/types.ts`:
```typescript
export interface SatellitePosition {
  lat: number;
  lon: number;
  alt_km: number;
}

export interface SatelliteStatus {
  position: SatellitePosition | null;
  timestamp: string;
  last_scan: number;
  next_scan_in: number;
}

export interface IndicesSummary {
  ndvi: number;
  ndre: number;
  swir_moisture: number;
  nbr: number;
  canopy_cover: number;
}

export interface WeatherSummary {
  temperature_2m: number;
  relative_humidity_2m: number;
  precipitation: number;
  wind_speed_10m: number;
  vapour_pressure_deficit: number;
}

export interface PassHistoryEntry {
  timestamp: string;
  ndvi: number;
  ndre: number;
  swir_moisture: number;
}

export type Severity = "HEALTHY" | "WATCH" | "CRITICAL";
export type HarvestSignal = "HARVEST_NOW" | "DELAY_7_DAYS" | "ON_TRACK" | null;

export interface Alert {
  id: string;
  timestamp: string;
  location: { lat: number; lon: number };
  severity: Severity;
  confidence: number;
  report: string;
  harvest_signal: HarvestSignal;
  indices: IndicesSummary;
  weather: WeatherSummary;
  cloud_cover: number;
  rgb_image: string;   // base64 PNG
  swir_image: string;  // base64 PNG
}

export type WsMessageType = "initial_state" | "alert" | "satellite_position";

export interface WsMessage {
  type: WsMessageType;
  data: Alert | SatelliteStatus | { alerts: Alert[]; status: SatelliteStatus };
}
```

- [ ] **Step 4: Update globals.css for base dark/light variables**

Replace contents of `webapp/src/app/globals.css`:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --brand: #FF4500;
  --satellite: #4a9fff;
  --critical: #dc2626;
  --watch: #f97316;
  --healthy: #22c55e;
}

* {
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Inter', sans-serif;
  overflow: hidden;
}
```

- [ ] **Step 5: Update next.config.ts to allow external image domains**

Replace `webapp/next.config.ts`:
```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [],
  },
};

export default nextConfig;
```

- [ ] **Step 6: Commit**

```bash
cd ..
git add webapp/
git commit -m "feat: Next.js webapp scaffold with TypeScript types"
```

---

## Task 6: Webapp — hooks (WebSocket + theme)

**Files:**
- Create: `webapp/src/hooks/useWebSocket.ts`
- Create: `webapp/src/hooks/useTheme.ts`

- [ ] **Step 1: Create useWebSocket.ts**

Create `webapp/src/hooks/useWebSocket.ts`:
```typescript
"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import type { WsMessage, Alert, SatelliteStatus } from "@/lib/types";

interface WebSocketState {
  alerts: Alert[];
  satelliteStatus: SatelliteStatus | null;
  connected: boolean;
}

export function useWebSocket(url: string): WebSocketState {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [satelliteStatus, setSatelliteStatus] = useState<SatelliteStatus | null>(null);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeout = useRef<NodeJS.Timeout>();

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => setConnected(true);

    ws.onmessage = (event) => {
      const msg: WsMessage = JSON.parse(event.data);

      if (msg.type === "initial_state") {
        const data = msg.data as { alerts: Alert[]; status: SatelliteStatus };
        setAlerts(data.alerts ?? []);
        setSatelliteStatus(data.status ?? null);
      } else if (msg.type === "alert") {
        const alert = msg.data as Alert;
        setAlerts((prev) => [alert, ...prev.filter((a) => a.id !== alert.id)].slice(0, 10));
      } else if (msg.type === "satellite_position") {
        setSatelliteStatus(msg.data as SatelliteStatus);
      }
    };

    ws.onclose = () => {
      setConnected(false);
      reconnectTimeout.current = setTimeout(connect, 3000);
    };

    ws.onerror = () => ws.close();
  }, [url]);

  useEffect(() => {
    connect();
    return () => {
      clearTimeout(reconnectTimeout.current);
      wsRef.current?.close();
    };
  }, [connect]);

  return { alerts, satelliteStatus, connected };
}
```

- [ ] **Step 2: Create useTheme.ts**

Create `webapp/src/hooks/useTheme.ts`:
```typescript
"use client";
import { useEffect, useState } from "react";

function isDaytime(): boolean {
  const hour = new Date().getHours();
  return hour >= 6 && hour < 20; // 6am–8pm = day
}

export function useTheme(): "dark" | "light" {
  const [theme, setTheme] = useState<"dark" | "light">(isDaytime() ? "light" : "dark");

  useEffect(() => {
    const interval = setInterval(() => {
      const next = isDaytime() ? "light" : "dark";
      setTheme((prev) => (prev !== next ? next : prev));
    }, 60_000); // check every minute
    return () => clearInterval(interval);
  }, []);

  return theme;
}
```

- [ ] **Step 3: Commit**

```bash
git add webapp/src/hooks/
git commit -m "feat: useWebSocket hook with reconnect, useTheme with sunrise/sunset switching"
```

---

## Task 7: Webapp — Map component

**Files:**
- Create: `webapp/src/components/Map.tsx`

- [ ] **Step 1: Create Map.tsx**

Create `webapp/src/components/Map.tsx`:
```tsx
"use client";
import { useRef, useEffect } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import type { Alert, SatelliteStatus } from "@/lib/types";

interface MapProps {
  alerts: Alert[];
  satelliteStatus: SatelliteStatus | null;
  theme: "dark" | "light";
  onAlertClick: (alert: Alert) => void;
}

const SEVERITY_COLORS = {
  CRITICAL: "#dc2626",
  WATCH: "#f97316",
  HEALTHY: "#22c55e",
};

export function Map({ alerts, satelliteStatus, theme, onAlertClick }: MapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const satelliteMarkerRef = useRef<mapboxgl.Marker | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: theme === "dark" ? "mapbox://styles/mapbox/dark-v11" : "mapbox://styles/mapbox/satellite-streets-v12",
      center: [0, 20],
      zoom: 2,
    });
    mapRef.current = map;
    return () => map.remove();
  }, [theme]);

  // Update alert markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    alerts.forEach((alert) => {
      const el = document.createElement("div");
      el.className = "alert-marker";
      el.style.cssText = `
        width: 14px; height: 14px; border-radius: 50%;
        background: ${SEVERITY_COLORS[alert.severity]};
        border: 2px solid white;
        cursor: pointer;
        box-shadow: 0 0 8px ${SEVERITY_COLORS[alert.severity]}88;
      `;
      el.addEventListener("click", () => onAlertClick(alert));

      const marker = new mapboxgl.Marker(el)
        .setLngLat([alert.location.lon, alert.location.lat])
        .addTo(map);
      markersRef.current.push(marker);
    });
  }, [alerts, onAlertClick]);

  // Update satellite position
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !satelliteStatus?.position) return;

    const { lat, lon } = satelliteStatus.position;
    if (satelliteMarkerRef.current) {
      satelliteMarkerRef.current.setLngLat([lon, lat]);
    } else {
      const el = document.createElement("div");
      el.style.cssText = `
        width: 10px; height: 10px; border-radius: 50%;
        background: #4a9fff; border: 2px solid rgba(74,159,255,0.4);
        box-shadow: 0 0 8px rgba(74,159,255,0.6);
      `;
      satelliteMarkerRef.current = new mapboxgl.Marker(el).setLngLat([lon, lat]).addTo(map);
    }
  }, [satelliteStatus]);

  return <div ref={containerRef} className="w-full h-full" />;
}
```

- [ ] **Step 2: Commit**

```bash
git add webapp/src/components/Map.tsx
git commit -m "feat: Mapbox map with satellite position and alert markers"
```

---

## Task 8: Webapp — ImageSlider, TrendChart, WeatherStrip

**Files:**
- Create: `webapp/src/components/ImageSlider.tsx`
- Create: `webapp/src/components/TrendChart.tsx`
- Create: `webapp/src/components/WeatherStrip.tsx`

- [ ] **Step 1: Create ImageSlider.tsx**

Create `webapp/src/components/ImageSlider.tsx`:
```tsx
"use client";
import { useState } from "react";

interface ImageSliderProps {
  rgbImage: string;   // base64 PNG
  swirImage: string;  // base64 PNG
}

export function ImageSlider({ rgbImage, swirImage }: ImageSliderProps) {
  const [position, setPosition] = useState(50);

  return (
    <div className="relative w-full h-32 overflow-hidden rounded select-none cursor-col-resize"
         onMouseMove={(e) => {
           const rect = e.currentTarget.getBoundingClientRect();
           setPosition(((e.clientX - rect.left) / rect.width) * 100);
         }}>
      {/* SWIR (bottom layer) */}
      <img src={`data:image/png;base64,${swirImage}`} alt="SWIR"
           className="absolute inset-0 w-full h-full object-cover" />
      {/* RGB (top layer, clipped) */}
      <div className="absolute inset-0 overflow-hidden" style={{ width: `${position}%` }}>
        <img src={`data:image/png;base64,${rgbImage}`} alt="RGB"
             className="absolute inset-0 h-full object-cover" style={{ width: `${100 / (position / 100)}%` }} />
      </div>
      {/* Divider line */}
      <div className="absolute top-0 bottom-0 w-0.5 bg-white shadow-lg pointer-events-none"
           style={{ left: `${position}%` }} />
      {/* Labels */}
      <div className="absolute top-1 left-1 text-xs text-white bg-black/50 px-1 rounded">RGB</div>
      <div className="absolute top-1 right-1 text-xs text-white bg-black/50 px-1 rounded">SWIR</div>
    </div>
  );
}
```

- [ ] **Step 2: Create TrendChart.tsx**

Create `webapp/src/components/TrendChart.tsx`:
```tsx
"use client";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";

interface TrendPoint {
  timestamp: string;
  ndvi: number;
  ndre: number;
}

interface TrendChartProps {
  data: TrendPoint[];
  theme: "dark" | "light";
}

export function TrendChart({ data, theme }: TrendChartProps) {
  const isDark = theme === "dark";
  const textColor = isDark ? "#8da8cc" : "#64748b";

  const formatted = data.map((d) => ({
    ...d,
    label: new Date(d.timestamp).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
  }));

  return (
    <div className="w-full h-28">
      <p className={`text-xs mb-1 ${isDark ? "text-slate-400" : "text-slate-500"}`}>
        NDVI / NDRE trend (last {data.length} passes)
      </p>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={formatted} margin={{ top: 2, right: 8, left: -20, bottom: 0 }}>
          <XAxis dataKey="label" tick={{ fontSize: 9, fill: textColor }} />
          <YAxis domain={[0, 1]} tick={{ fontSize: 9, fill: textColor }} />
          <Tooltip
            contentStyle={{ background: isDark ? "#12192a" : "#fff", border: "1px solid #1e2d45", fontSize: 11 }}
          />
          <Line type="monotone" dataKey="ndvi" stroke="#22c55e" dot={false} strokeWidth={1.5} name="NDVI" />
          <Line type="monotone" dataKey="ndre" stroke="#4a9fff" dot={false} strokeWidth={1.5} name="NDRE" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
```

- [ ] **Step 3: Create WeatherStrip.tsx**

Create `webapp/src/components/WeatherStrip.tsx`:
```tsx
import type { WeatherSummary } from "@/lib/types";

interface WeatherStripProps {
  weather: WeatherSummary;
  theme: "dark" | "light";
}

export function WeatherStrip({ weather, theme }: WeatherStripProps) {
  const isDark = theme === "dark";
  const base = isDark ? "bg-[#0d1420] border-[#1a2840] text-slate-400" : "bg-slate-50 border-slate-200 text-slate-500";

  const items = [
    { label: "Temp", value: `${weather.temperature_2m.toFixed(1)}°C` },
    { label: "RH", value: `${weather.relative_humidity_2m.toFixed(0)}%` },
    { label: "Rain", value: `${weather.precipitation.toFixed(1)}mm` },
    { label: "VPD", value: `${weather.vapour_pressure_deficit.toFixed(2)} kPa` },
  ];

  return (
    <div className={`flex gap-2 p-2 rounded border text-xs ${base}`}>
      {items.map(({ label, value }) => (
        <div key={label} className="flex flex-col items-center flex-1">
          <span className="opacity-60 text-[10px]">{label}</span>
          <span className="font-mono font-medium">{value}</span>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add webapp/src/components/ImageSlider.tsx webapp/src/components/TrendChart.tsx webapp/src/components/WeatherStrip.tsx
git commit -m "feat: ImageSlider RGB→SWIR comparison, TrendChart, WeatherStrip"
```

---

## Task 9: Webapp — SatelliteStatus, PassHistory, AlertCard

**Files:**
- Create: `webapp/src/components/SatelliteStatus.tsx`
- Create: `webapp/src/components/PassHistory.tsx`
- Create: `webapp/src/components/AlertCard.tsx`

- [ ] **Step 1: Create SatelliteStatus.tsx**

Create `webapp/src/components/SatelliteStatus.tsx`:
```tsx
"use client";
import { useEffect, useState } from "react";
import type { SatelliteStatus as Status } from "@/lib/types";

interface SatelliteStatusProps {
  status: Status | null;
  connected: boolean;
  theme: "dark" | "light";
}

export function SatelliteStatus({ status, connected, theme }: SatelliteStatusProps) {
  const [countdown, setCountdown] = useState(30);
  const isDark = theme === "dark";

  useEffect(() => {
    if (!status) return;
    const elapsed = Math.floor((Date.now() / 1000) - status.last_scan);
    setCountdown(Math.max(0, 30 - elapsed));
    const interval = setInterval(() => setCountdown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(interval);
  }, [status]);

  const bg = isDark ? "bg-[#0d1420] border-[#1a2840]" : "bg-white border-slate-200";
  const text = isDark ? "text-slate-300" : "text-slate-600";
  const muted = isDark ? "text-slate-500" : "text-slate-400";

  return (
    <div className={`rounded border p-3 text-xs ${bg}`}>
      <div className="flex justify-between items-center mb-2">
        <span className={`font-mono uppercase tracking-wider text-[10px] ${muted}`}>Satellite</span>
        <div className="flex items-center gap-1.5">
          <div className={`w-1.5 h-1.5 rounded-full ${connected ? "bg-green-500" : "bg-red-500"}`} />
          <span className={muted}>{connected ? "LIVE" : "OFFLINE"}</span>
        </div>
      </div>
      {status?.position ? (
        <div className={`font-mono ${text} space-y-0.5`}>
          <div>{status.position.lat.toFixed(3)}°N {status.position.lon.toFixed(3)}°E</div>
          <div className={muted}>Alt {status.position.alt_km.toFixed(0)} km</div>
          <div className="mt-1">
            Next scan: <span style={{ color: "#4a9fff" }}>{countdown}s</span>
          </div>
        </div>
      ) : (
        <span className={muted}>Waiting for position...</span>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create PassHistory.tsx**

Create `webapp/src/components/PassHistory.tsx`:
```tsx
import type { Alert, Severity } from "@/lib/types";

const SEV_COLORS: Record<Severity, string> = {
  CRITICAL: "#dc2626",
  WATCH: "#f97316",
  HEALTHY: "#22c55e",
};

interface PassHistoryProps {
  alerts: Alert[];
  theme: "dark" | "light";
}

export function PassHistory({ alerts, theme }: PassHistoryProps) {
  const isDark = theme === "dark";
  const bg = isDark ? "bg-[#0d1420] border-[#1a2840]" : "bg-white border-slate-200";
  const row = isDark ? "border-[#1e2535] text-slate-400" : "border-slate-100 text-slate-500";

  return (
    <div className={`rounded border overflow-hidden ${bg}`}>
      <div className={`px-3 py-2 text-[10px] uppercase tracking-wider ${isDark ? "text-slate-500" : "text-slate-400"}`}>
        Pass History
      </div>
      <div className="max-h-32 overflow-y-auto">
        {alerts.length === 0 ? (
          <div className={`px-3 py-2 text-xs ${row}`}>No passes yet</div>
        ) : alerts.map((a) => (
          <div key={a.id} className={`flex justify-between items-center px-3 py-1.5 border-t text-xs ${row}`}>
            <span className="font-mono">{new Date(a.timestamp).toLocaleTimeString()}</span>
            <span style={{ color: SEV_COLORS[a.severity] }} className="font-bold text-[10px]">{a.severity}</span>
            <span className="font-mono">{a.indices.ndvi.toFixed(3)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create AlertCard.tsx**

Create `webapp/src/components/AlertCard.tsx`:
```tsx
"use client";
import { useState } from "react";
import type { Alert, Severity } from "@/lib/types";
import { ImageSlider } from "./ImageSlider";
import { WeatherStrip } from "./WeatherStrip";

const SEV_COLORS: Record<Severity, string> = {
  CRITICAL: "#dc2626",
  WATCH: "#f97316",
  HEALTHY: "#22c55e",
};

const SEV_BG: Record<Severity, string> = {
  CRITICAL: "rgba(220,38,38,0.1)",
  WATCH: "rgba(249,115,22,0.1)",
  HEALTHY: "rgba(34,197,94,0.1)",
};

interface AlertCardProps {
  alert: Alert;
  theme: "dark" | "light";
  isSelected: boolean;
  onClick: () => void;
}

export function AlertCard({ alert, theme, isSelected, onClick }: AlertCardProps) {
  const isDark = theme === "dark";
  const border = SEV_COLORS[alert.severity];
  const bg = isDark ? "#12192a" : "#ffffff";
  const text = isDark ? "#e2e8f0" : "#0f172a";
  const muted = isDark ? "#8da8cc" : "#64748b";

  const downloadReport = () => {
    const content = JSON.stringify({ ...alert, rgb_image: undefined, swir_image: undefined }, null, 2);
    const blob = new Blob([content], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `terroir-alert-${alert.timestamp.replace(/:/g, "-")}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div
      onClick={onClick}
      className="rounded cursor-pointer transition-all"
      style={{
        background: bg,
        border: `1px solid ${isSelected ? border : (isDark ? "#1e2d45" : "#e2e8f0")}`,
        borderLeft: `3px solid ${border}`,
      }}
    >
      {/* Header */}
      <div className="flex justify-between items-start p-3 pb-2">
        <div>
          <div className="text-[10px] font-bold tracking-wider" style={{ color: border }}>
            {alert.severity}
          </div>
          <div className="text-xs font-semibold mt-0.5" style={{ color: text }}>
            {alert.location.lat.toFixed(3)}°N {alert.location.lon.toFixed(3)}°E
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <div
            className="text-[9px] px-1.5 py-0.5 rounded"
            style={{ background: SEV_BG[alert.severity], color: border }}
          >
            {Math.round(alert.confidence * 100)}%
          </div>
          <div className="text-[9px] font-mono" style={{ color: muted }}>
            {new Date(alert.timestamp).toLocaleTimeString()}
          </div>
        </div>
      </div>

      {isSelected && (
        <div className="px-3 pb-3 space-y-2">
          {/* Image slider */}
          <ImageSlider rgbImage={alert.rgb_image} swirImage={alert.swir_image} />

          {/* AI Report */}
          <p className="text-[11px] leading-relaxed italic" style={{ color: muted }}>
            "{alert.report}"
          </p>

          {/* Indices badges */}
          <div className="flex flex-wrap gap-1">
            {[
              { k: "NDVI", v: alert.indices.ndvi.toFixed(3), color: "#22c55e" },
              { k: "NDRE", v: alert.indices.ndre.toFixed(3), color: "#4a9fff" },
              { k: "SWIR", v: alert.indices.swir_moisture.toFixed(3), color: "#a78bfa" },
              { k: "Canopy", v: `${alert.indices.canopy_cover.toFixed(0)}%`, color: "#fbbf24" },
            ].map(({ k, v, color }) => (
              <div key={k} className="text-[9px] px-1.5 py-0.5 rounded font-mono"
                   style={{ background: isDark ? "#0d1f35" : "#f1f5f9", border: `1px solid ${color}44`, color }}>
                {k} {v}
              </div>
            ))}
          </div>

          {/* Weather */}
          <WeatherStrip weather={alert.weather} theme={theme} />

          {/* Harvest signal */}
          {alert.harvest_signal && (
            <div className="text-[10px] px-2 py-1 rounded text-center font-semibold"
                 style={{ background: "#fbbf2422", color: "#fbbf24", border: "1px solid #fbbf2444" }}>
              {alert.harvest_signal.replace(/_/g, " ")}
            </div>
          )}

          {/* Download */}
          <button onClick={(e) => { e.stopPropagation(); downloadReport(); }}
                  className="w-full text-[10px] py-1 rounded border text-center"
                  style={{ borderColor: isDark ? "#1e2d45" : "#e2e8f0", color: muted }}>
            Download Report ↓
          </button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add webapp/src/components/SatelliteStatus.tsx webapp/src/components/PassHistory.tsx webapp/src/components/AlertCard.tsx
git commit -m "feat: SatelliteStatus, PassHistory, AlertCard with image slider and report download"
```

---

## Task 10: Webapp — AlertPanel and main page layout

**Files:**
- Create: `webapp/src/components/AlertPanel.tsx`
- Create: `webapp/src/app/page.tsx`
- Create: `webapp/src/app/layout.tsx`

- [ ] **Step 1: Create AlertPanel.tsx**

Create `webapp/src/components/AlertPanel.tsx`:
```tsx
"use client";
import { useState } from "react";
import type { Alert, SatelliteStatus } from "@/lib/types";
import { AlertCard } from "./AlertCard";
import { TrendChart } from "./TrendChart";
import { PassHistory } from "./PassHistory";
import { SatelliteStatus as SatStatus } from "./SatelliteStatus";

interface AlertPanelProps {
  alerts: Alert[];
  satelliteStatus: SatelliteStatus | null;
  connected: boolean;
  theme: "dark" | "light";
}

export function AlertPanel({ alerts, satelliteStatus, connected, theme }: AlertPanelProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const isDark = theme === "dark";
  const bg = isDark ? "bg-[#0d1117]" : "bg-slate-50";
  const border = isDark ? "border-[#1e2535]" : "border-slate-200";
  const heading = isDark ? "text-slate-400" : "text-slate-500";

  const selectedAlert = alerts.find((a) => a.id === selectedId) ?? alerts[0] ?? null;

  const trendData = alerts
    .slice(0, 5)
    .reverse()
    .map((a) => ({ timestamp: a.timestamp, ndvi: a.indices.ndvi, ndre: a.indices.ndre }));

  return (
    <div className={`h-full flex flex-col gap-3 p-3 overflow-y-auto border-l ${bg} ${border}`}>
      {/* Top bar */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded flex items-center justify-center text-sm" style={{ background: "#FF4500" }}>
            🌿
          </div>
          <span className={`text-xs font-bold ${isDark ? "text-white" : "text-slate-900"}`}>Terroir</span>
        </div>
        <span className={`text-[10px] font-mono ${heading}`}>
          {alerts.filter(a => a.severity !== "HEALTHY").length} active alerts
        </span>
      </div>

      {/* Alerts section */}
      <div>
        <div className={`text-[10px] uppercase tracking-wider mb-2 ${heading}`}>Active Incidents</div>
        {alerts.length === 0 ? (
          <div className={`text-xs ${heading} text-center py-4`}>Scanning for anomalies...</div>
        ) : (
          <div className="space-y-2">
            {alerts.map((alert) => (
              <AlertCard
                key={alert.id}
                alert={alert}
                theme={theme}
                isSelected={selectedId === alert.id || (selectedId === null && alert === alerts[0])}
                onClick={() => setSelectedId(alert.id === selectedId ? null : alert.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Trend chart */}
      {trendData.length > 1 && (
        <TrendChart data={trendData} theme={theme} />
      )}

      {/* Pass history */}
      <PassHistory alerts={alerts} theme={theme} />

      {/* Satellite status */}
      <SatStatus status={satelliteStatus} connected={connected} theme={theme} />
    </div>
  );
}
```

- [ ] **Step 2: Create the main page**

Create `webapp/src/app/page.tsx`:
```tsx
"use client";
import { useWebSocket } from "@/hooks/useWebSocket";
import { useTheme } from "@/hooks/useTheme";
import { Map } from "@/components/Map";
import { AlertPanel } from "@/components/AlertPanel";
import { useState } from "react";
import type { Alert } from "@/lib/types";

const WS_URL = process.env.NEXT_PUBLIC_MONITOR_WS_URL ?? "ws://localhost:8001/ws";

export default function Home() {
  const theme = useTheme();
  const { alerts, satelliteStatus, connected } = useWebSocket(WS_URL);
  const [focusedAlert, setFocusedAlert] = useState<Alert | null>(null);

  const isDark = theme === "dark";
  const bg = isDark ? "bg-[#0d1117]" : "bg-white";

  return (
    <div className={`flex h-screen w-screen overflow-hidden ${bg}`}>
      {/* Left: Map (60%) */}
      <div className="flex-[0_0_60%] relative">
        <Map
          alerts={alerts}
          satelliteStatus={satelliteStatus}
          theme={theme}
          onAlertClick={setFocusedAlert}
        />
      </div>

      {/* Right: Alert Panel (40%) */}
      <div className="flex-[0_0_40%] overflow-y-auto">
        <AlertPanel
          alerts={alerts}
          satelliteStatus={satelliteStatus}
          connected={connected}
          theme={theme}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Update layout.tsx**

Replace `webapp/src/app/layout.tsx`:
```tsx
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Terroir — Orbital Vineyard Intelligence",
  description: "Monitor vineyard health from orbit using LFM2.5-VL satellite AI",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
```

- [ ] **Step 4: Start dev server and verify the UI loads**

```bash
cd webapp
npm run dev
```
Open http://localhost:3000. Expected: split panel layout with map on left, alert panel on right. Map loads (may be empty until WebSocket connects). No console errors.

- [ ] **Step 5: Commit**

```bash
cd ..
git add webapp/src/
git commit -m "feat: complete webapp with split panel, AlertPanel, map, dark/light mode"
```

---

## Task 11: Docker Compose — full integration

**Files:**
- Modify: `docker-compose.yml` (verify SimSat service names match official repo)
- Create: `webapp/Dockerfile`

- [ ] **Step 1: Check SimSat's docker-compose.yml for actual service names**

```bash
cat ~/path/to/SimSat/docker-compose.yaml
```
Update `terroir/docker-compose.yml` service names (`simsat-sim`, `simsat-api`) to match exactly.

- [ ] **Step 2: Create webapp/Dockerfile**

Create `webapp/Dockerfile`:
```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/public ./public
CMD ["npm", "start"]
```

- [ ] **Step 3: Add .env to the project root if not already done**

```bash
cp .env.example .env
# Verify MAPBOX_ACCESS_TOKEN is set
```

- [ ] **Step 4: Build all services**

On the gaming PC (Windows, with NVIDIA Container Toolkit installed):
```powershell
cd C:\path\to\terroir
docker compose build
```
Expected: all services build without error

- [ ] **Step 5: Start the full stack**

```powershell
docker compose up
```
Open http://localhost:3000 in the browser. Expected: Terroir app loads, map shows, satellite position updates every 30 seconds.

- [ ] **Step 6: Speed up SimSat to demonstrate a real fire event for demo prep**

In another terminal:
```powershell
python -c "
import requests
requests.post('http://localhost:8000/api/commands/', json={'command': 'start', 'replay_speed': 20.0, 'step_size_seconds': 10})
print('Simulation sped up 20x')
"
```
Expected: satellite moves faster, more scans happen, alerts appear on right panel within a few minutes.

- [ ] **Step 7: Commit final state**

```powershell
git add webapp/Dockerfile docker-compose.yml
git commit -m "feat: Docker Compose integration — full stack running with one command"
```

---

## Timeline

| Days | Tasks | Notes |
|---|---|---|
| Apr 19–20 | Tasks 1–3 | Scaffold + monitor service |
| Apr 21–22 | Task 4 | Inference service (use base model) |
| Apr 22–23 | Tasks 5–7 | Next.js setup + hooks + map |
| Apr 24–25 | Tasks 8–10 | All UI components + page layout |
| Apr 26 | Task 11 | Full Docker Compose integration |
| Apr 27–May 3 | Polish + fine-tuned model swap | Swap `HF_MODEL_PATH` once fine-tuning completes |
| May 4–8 | Demo prep + speed optimisation | Practice demo script, fix rough edges |
| May 9 | Submit | |

## Swapping to fine-tuned model

Once `gabinnocenzi/terroir-lfm25-vl` is published to HuggingFace, update `.env`:
```env
HF_MODEL_PATH=gabinnocenzi/terroir-lfm25-vl
```
Then rebuild: `docker compose build inference && docker compose up inference`
