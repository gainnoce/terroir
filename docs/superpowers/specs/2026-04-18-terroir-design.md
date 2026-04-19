# Terroir — Design Spec
**Date:** 2026-04-18  
**Hackathon:** AI in Space — Liquid AI x DPhi Space  
**Track:** Liquid Track (LFM2.5-VL-1.6B)  
**Deadline:** May 9, 2026  
**Domain:** terroir.space  

---

## Problem

Winemakers lose millions annually to vine disease, mistimed harvests, and undetected stress — problems that develop over days but are only visible to a human walking the vineyard once a week. Ground sensors cover tiny areas. Drone surveys are expensive and weather-dependent.

Sentinel-2 provides 13 spectral bands across entire vineyard regions every 2–5 days. The signatures of powdery mildew, botrytis, water stress, and canopy health are all detectable in NDVI, SWIR, and NIR bands weeks before any visible symptom appears on the ground. But raw spectral data means nothing to a winemaker.

Terroir bridges that gap: a fine-tuned LFM2.5-VL-1.6B model running on orbital imagery that translates multispectral satellite passes — combined with real-time weather context — into actionable winemaker-language recommendations: disease warnings, block-by-block harvest timing, and stress assessments delivered before the image even reaches the ground.

---

## The Core Unlock

A traditional CV detection model outputs a bounding box or classification. LFM2.5-VL, fine-tuned on viticulture-specific satellite data and grounded with real-time weather context, outputs:

> *"Block 7 shows optimal controlled water stress (SWIR moisture index 0.34, within ideal 0.28–0.40 range). Canopy density stable at NDVI 0.71. Block 3 shows early NIR anomaly consistent with powdery mildew onset — current humidity 87% and temperature 24°C elevate disease pressure. Recommend sulphur treatment on Block 3 this week. Delay Block 7 harvest by 8 days for maximum phenolic development."*

This requires temporal reasoning across multiple satellite passes + real-time weather context + domain knowledge about viticulture + natural language synthesis. No detection model produces this. This is the LFM2-VL unlock.

---

## System Architecture

```
SimSat API (Sentinel-2 historical + current)    Open-Meteo API (free, no key)
    ↓                                                    ↓
Vineyard Monitor (Python) ←──────────────────────────────┘
  — polls satellite position every 30s
  — when over land, fetches RGB + SWIR + NIR bands
  — fetches weather at current coordinates (humidity, temp, VPD, precipitation)
  — computes NDVI, SWIR moisture index, NBR
  — maintains per-block temporal history (last 5 passes)
    ↓
Inference Service (FastAPI + LFM2.5-VL-1.6B fine-tuned)
  — receives image set + indices + temporal history + weather context
  — runs fine-tuned model
  — returns structured agronomic report JSON
    ↓
Alert Engine
  — severity classification (Critical / Watch / Healthy)
  — deduplication across passes
  — stores alert history per vineyard block
    ↓
Web App (Next.js)
  — split panel: Mapbox GL JS map + analysis panel
  — real-time updates via WebSocket
  — auto dark/light mode (sunrise/sunset)
```

Everything runs locally via Docker Compose. One command: `docker compose up`.

---

## Data & Fine-tuning

### Training Data Sources
- **Sentinel-2 vineyard imagery** via SimSat historical API (`/data/image/sentinel`) and Copernicus Dataspace
- **Known vineyard locations**: Napa Valley, Bordeaux, Burgundy, Tuscany, Marlborough (NZ) — publicly documented
- **EuroSAT dataset**: includes labeled vineyard land-use classes for Sentinel-2
- **Agronomic ground truth**: published viticultural research correlating spectral indices with disease/quality outcomes

### Dataset Construction
1. Query SimSat historical API for ~200 vineyard locations across 4–5 growing seasons
2. Fetch 4 band combinations per location per pass: RGB, SWIR (B12+B8A+B4), NIR false color (B8+B4+B3), Red Edge (B5+B6+B7)
3. Compute indices per image: NDVI, NDRE, SWIR moisture index, Normalised Burn Ratio, canopy cover %
4. Generate training labels using Claude API from spectral metadata + agronomic literature
5. Target: ~800 image-text training pairs

### Label Format
Each training example:
- **Input**: 3-band image set + computed indices + location metadata + temporal context (previous passes)
- **Output**: natural language agronomic report (disease status, stress level, harvest recommendation, vintage quality signal)

### Fine-tuning Setup
- **Model**: LFM2.5-VL-1.6B (HuggingFace: `LiquidAI/LFM2.5-VL-1.6B`)
- **Hardware**: NVIDIA RTX 5070 (12GB VRAM), gaming PC (Windows)
- **Framework**: HuggingFace Transformers + PyTorch + CUDA 12
- **Technique**: Full fine-tune with gradient checkpointing
- **Estimated training time**: 6–10 hours for 800 examples, 3 epochs
- **Published output**: `gabinnocenzi/terroir-lfm25-vl-1.6b` on HuggingFace (public weights + training code)

---

## Inference Pipeline

### Vineyard Monitor
- Polls SimSat `/data/current/position` every 30s
- When satellite is over land, calls `/data/current/image/sentinel` for RGB, SWIR, NIR
- Simultaneously fetches Open-Meteo current weather at those coordinates (humidity, temperature, VPD, precipitation — no API key required)
- Computes NDVI and SWIR moisture index locally
- Maintains rolling 5-pass temporal history per geographic tile
- Sends to inference service, broadcasts result via WebSocket

### Inference Service
```
POST /analyze
{
  "images": { "rgb": "...", "swir": "...", "nir": "..." },
  "indices": { "ndvi": 0.71, "swir_moisture": 0.34, "nbr": 0.12 },
  "weather": { "humidity": 87, "temp_c": 24, "vpd": 1.2, "precip_mm": 0 },
  "location": { "lat": 38.5, "lon": -122.4 },
  "timestamp": "2026-04-18T14:00:00Z",
  "temporal_history": [ ...last 4 passes... ]
}

→ returns:
{
  "severity": "WATCH",
  "confidence": 0.87,
  "report": "Early NIR anomaly consistent with powdery mildew. High humidity elevates disease pressure.",
  "harvest_signal": "DELAY_8_DAYS",
  "indices_summary": { ... },
  "weather_summary": { ... }
}
```

---

## Web App

### Layout
Split panel, desktop-first (demo presented on laptop browser):
- **Left (60%)**: Mapbox GL JS map — satellite ground track as dotted line, vineyard block overlays color-coded by health status (green/amber/red), live satellite position dot
- **Right top (40%)**: Active alerts — LFM2-VL report card per flagged block, satellite image with RGB→SWIR comparison slider, spectral band toggle (RGB / SWIR / NIR), harvest recommendation badge, weather strip (humidity, temp, VPD)
- **Right middle**: NDVI + NDRE trend chart — dual line graph across last 5 passes; pass history log showing all previous outcomes per location (Healthy / Watch / Critical)
- **Right bottom**: Satellite status — current position, next scan countdown, bands active, last analysis timestamp; confidence score badge; "Download Report" export button

### Visual Design
- **Dark mode**: Deep navy (#0d1117), fire orange brand accent (#FF4500), satellite track in blue (#4a9fff)
- **Light mode**: White/slate, same accent colors, auto-switches at local sunrise/sunset
- **Typography**: System font stack (-apple-system, Inter), monospace for data readouts
- **Severity colors**: Red (#dc2626) = Critical disease/stress, Amber (#f97316) = Watch, Green (#22c55e) = Healthy

### Tech Stack
- **Frontend**: Next.js 14 (React), Mapbox GL JS, Tailwind CSS
- **Backend**: FastAPI (Python 3.11)
- **Inference**: HuggingFace Transformers, PyTorch, CUDA 12
- **Realtime**: WebSocket (FastAPI native)
- **Containerisation**: Docker + Docker Compose

---

## Docker Compose Services

| Service | Description |
|---|---|
| `simsat-sim` | Official SimSat simulator container |
| `simsat-api` | Official SimSat API container |
| `inference` | FastAPI + fine-tuned LFM2.5-VL model |
| `monitor` | Python poller — SimSat → inference → WebSocket |
| `webapp` | Next.js frontend |

---

## Demo Script

### Opening (30s) — personal hook
> *"Terroir is a French concept — it's the complete environment that gives a wine its character: the soil, the microclimate, the terrain. For centuries, understanding terroir meant walking your vineyard. Terroir.space means understanding it from orbit."*

### Live demo (2–3 min)
1. Open app — satellite moving in real time over Napa Valley / Bordeaux
2. Speed up SimSat simulation — satellite passes over vineyard region
3. Show three band views side by side: "This is what RGB sees. This is what SWIR sees. The human eye misses this entirely."
4. LFM2.5-VL generates analysis live — alert card appears with disease warning and harvest recommendation
5. Toggle dark/light mode
6. Show block health overlay on map — color-coded vineyard blocks

### Technical close (1 min)
> *"The base LFM2.5-VL model had no concept of SWIR moisture indices, powdery mildew spectral signatures, or phenolic development timing. We fine-tuned it on 800 Sentinel-2 vineyard images. Here are the published weights. Here's the base model vs fine-tuned on the same image — the difference is the domain knowledge."*

---

## Judging Criteria Mapping

| Criterion | Weight | How Terroir addresses it |
|---|---|---|
| Use of satellite imagery | 10% | Sentinel-2 SWIR+NIR+RGB, multispectral indices computed per pass |
| Innovation & problem-solution fit | 35% | Orbital viticulture is novel; LFM2-VL unlock is genuine (temporal reasoning → natural language agronomic advice) |
| Technical implementation | 35% | Runs via `docker compose up`; full fine-tune with documented methodology, public weights |
| Demo & communication | 20% | Personal origin story + live satellite pass + before/after model comparison |

---

## Accounts & Services (all free)
- **Mapbox**: access token set as `MAPBOX_ACCESS_TOKEN` env var
- **HuggingFace**: model download + weight publishing
- **Copernicus Dataspace**: Sentinel-2 historical data (SimSat dependency)
- **Domain**: terroir.space (registered via Porkbun)
- **Open-Meteo**: no account or API key required — free HTTP API

---

## Scope Decisions
- **Vineyard regions**: Napa Valley + Bordeaux as primary training regions (both have well-documented coordinates and public viticultural research)
- **Feature scope**: Disease detection + harvest timing + fire/smoke taint threat + weather context (Open-Meteo) + NDRE red edge bands + NDVI trend chart + RGB→SWIR comparison slider + canopy cover % metric + confidence score display + alert export + pass history log. Vintage quality prediction is out of scope for v1.
- **Demo hardware**: Inference service runs on gaming PC (RTX 5070). MacBook is used only for the frontend browser demo. The Docker Compose setup must work with the GPU service on Windows.
