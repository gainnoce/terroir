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
