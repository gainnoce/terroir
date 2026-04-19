import binascii
import logging
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from schemas import AnalyzeRequest, AnalyzeResponse
import model as model_module

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Terroir Inference Service")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

_model_ready = False


@app.on_event("startup")
def startup():
    global _model_ready
    try:
        model_module.load_model()
        _model_ready = True
    except Exception as e:
        logger.error(f"Model failed to load: {e}")


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
    except (binascii.Error, OSError) as e:
        raise HTTPException(status_code=400, detail=f"Invalid image data: {e}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/health")
def health():
    return {"status": "ok" if _model_ready else "degraded", "model": model_module.MODEL_PATH}
