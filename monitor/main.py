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
