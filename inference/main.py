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
