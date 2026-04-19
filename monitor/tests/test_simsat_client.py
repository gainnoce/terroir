import pytest
from unittest.mock import patch
import base64
import numpy as np
from simsat_client import fetch_image_png, fetch_band_array, ImageUnavailable

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
