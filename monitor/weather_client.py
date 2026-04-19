import requests

OPEN_METEO_API = "https://api.open-meteo.com/v1/forecast"

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
