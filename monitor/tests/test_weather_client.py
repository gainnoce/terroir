import pytest
from unittest.mock import patch
from weather_client import fetch_weather

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
    mock_get.return_value.raise_for_status.side_effect = Exception("Server error")
    with pytest.raises(Exception):
        fetch_weather(lat=38.4, lon=-122.4)
