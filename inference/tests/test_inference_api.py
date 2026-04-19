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
