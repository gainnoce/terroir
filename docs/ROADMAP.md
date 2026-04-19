# Terroir — Product Roadmap
**Last updated:** 2026-04-18  
**v1 (hackathon)** ships May 9, 2026. Everything below is post-hackathon.

---

## Phase 2 — Product (May–August 2026)
*Turn the hackathon demo into something real users can sign up for.*

### Core Platform
- User authentication + vineyard profile management
- Multi-vineyard dashboard (manage multiple blocks/properties)
- Email + SMS push alerts when severity crosses a threshold
- Historical report archive (searchable, downloadable)
- Mobile-responsive web (no native app yet — PWA first)

### Analysis Improvements
- **Vintage quality prediction** — cut from v1, bring back properly with seasonal accumulation data
- **Frost prediction** — degree-day accumulation tracking with Open-Meteo, critical for early-season budbreak protection
- **Irrigation efficiency scoring** — correlate SWIR moisture with precipitation data to recommend irrigation timing
- **Smoke taint risk timeline** — track cumulative smoke exposure across the growing season, not just single events
- **Cover crop health** — analyze inter-row vegetation separately from vine canopy

### Data & Model
- Expand training dataset to 2,000+ examples covering more regions and edge cases
- Quarterly fine-tuning cycles as new growing season data comes in
- Publish versioned model weights (v1.0, v1.1...) with changelog

---

## Phase 3 — Scale (Q4 2026–2027)
*Grow beyond early adopters to a real B2B business.*

### Product Expansion
- **Native iOS + Android app** — push notifications, offline map caching
- **API for third-party developers** — vineyard management software integrations (Vintrace, Wine Partner, Agrivi)
- **White-label platform** — agricultural consultants can offer Terroir under their own brand
- **Multi-crop support** — olive groves, coffee, citrus, specialty hops (same satellite pipeline, crop-specific fine-tuned models)
- **Agronomist collaboration tools** — annotate satellite images, share reports with consultants

### Intelligence Upgrades
- **Sentinel-1 SAR integration** — all-weather soil moisture mapping (radar penetrates clouds, Sentinel-2 cannot)
- **Landsat 8/9 thermal** — actual surface temperature mapping, not just proxy indices
- **Multi-pass change detection** — automated alerts when any index changes more than X% between passes
- **Phenological stage tracking** — automatically detect budbreak, flowering, veraison, harvest window from spectral signatures
- **Yield estimation** — pre-harvest crop load prediction from canopy density + stress history

### Business
- Tiered pricing: free (1 vineyard, delayed data) → Pro ($X/month, real-time, unlimited blocks) → Enterprise (API + white-label)
- Partnership with wine insurance providers — Terroir data as underwriting input
- Pilot programs with Napa Valley Vintners and CIVB (Bordeaux)

---

## Phase 4 — Intelligence Platform (2027+)
*Terroir becomes the data layer for agriculture.*

### Advanced AI
- **Hyperspectral support** — DESIS and PRISMA satellites provide 200+ bands vs Sentinel-2's 13. Dramatically more precise disease and soil analysis.
- **Autonomous management recommendations** — the model doesn't just alert, it tells you exactly what to do and when, with confidence intervals
- **Climate change adaptation planning** — multi-year trend analysis showing how a vineyard's terroir is shifting and what varietals will thrive in 10 years
- **Cross-vineyard benchmarking** — anonymised comparison of your vineyard health vs regional peers

### Data Moats
- **IoT ground sensor integration** — validate and calibrate satellite readings with in-field sensors (soil probes, weather stations)
- **Drone on-demand** — trigger a high-resolution drone survey when satellite flags an anomaly for ground-truth confirmation
- **Harvest outcome feedback loop** — winemakers report actual harvest quality, model learns from prediction vs reality
- **Proprietary training dataset** — years of labeled satellite + outcome data becomes a defensible competitive asset

### Market Expansion
- **Carbon markets** — monitor soil carbon sequestration for regenerative vineyards seeking carbon credits; provide satellite-verified certificates
- **Crop insurance** — satellite-verified damage assessment replacing manual field inspections
- **Commodity intelligence** — anonymised yield prediction data licensed to futures traders and food security analysts
- **Forestry & reforestation** — apply the same orbital monitoring pipeline to carbon offset forestry projects

---

## Moonshots (No Timeline)
*Big ideas to revisit if Terroir becomes a real company.*

- **Real-time constellation** — partner with satellite operators to get daily (not 5-day) revisit frequency for high-value wine regions
- **In-orbit inference at scale** — if on-board compute becomes affordable, run inference directly on the satellite and push only structured alerts down (10KB instead of 10MB images)
- **Terroir index** — a standardised, satellite-verified terroir quality score for a vineyard parcel, usable in wine labelling and property valuation
- **Autonomous vineyard** — Terroir as the sensing layer for a fully autonomous vineyard management system (robotic spraying, harvesting, irrigation triggered by satellite data)
- **Archaeological wine history** — use multispectral analysis to identify ancient vineyard terraces and historically significant growing sites

---

## Cut from v1 (Revisit for v2)
| Feature | Reason cut | Revisit when |
|---|---|---|
| Vintage quality prediction | Adds scope without clear judging benefit | Phase 2 |
| Mobile native app | Too much work for hackathon timeline | Phase 3 |
| Multi-vineyard management | SaaS complexity | Phase 2 |
| User authentication | Not needed for demo | Phase 2 |
| Soil organic matter mapping | Requires hyperspectral, Sentinel-2 insufficient | Phase 4 |
| Water quality monitoring | 10m resolution too coarse for vineyard scale | Phase 3 with Sentinel-1 |
| SAR all-weather monitoring | Great idea, different sensor | Phase 3 |
| IoT sensor integration | Requires hardware partnerships | Phase 3 |
