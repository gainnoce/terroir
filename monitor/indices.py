import numpy as np

# Band order in the 5-channel array from fetch_band_array:
# idx 0 = NIR, 1 = Red, 2 = RedEdge, 3 = SWIR1, 4 = SWIR2

def _safe_ratio(a: np.ndarray, b: np.ndarray) -> np.ndarray:
    return np.where((a + b) == 0, 0.0, (a - b) / (a + b + 1e-8))

def compute_ndvi(arr: np.ndarray) -> float:
    nir, red = arr[:, :, 0], arr[:, :, 1]
    return float(np.nanmean(_safe_ratio(nir, red)))

def compute_ndre(arr: np.ndarray) -> float:
    nir, re = arr[:, :, 0], arr[:, :, 2]
    return float(np.nanmean(_safe_ratio(nir, re)))

def compute_swir_moisture(arr: np.ndarray) -> float:
    nir, swir1 = arr[:, :, 0], arr[:, :, 3]
    return float(np.nanmean(_safe_ratio(nir, swir1)))

def compute_nbr(arr: np.ndarray) -> float:
    nir, swir2 = arr[:, :, 0], arr[:, :, 4]
    return float(np.nanmean(_safe_ratio(nir, swir2)))

def compute_canopy_cover(ndvi: float) -> float:
    LOW, HIGH = 0.2, 0.85
    return float(max(0.0, min(100.0, (ndvi - LOW) / (HIGH - LOW) * 100)))

def compute_all_indices(arr: np.ndarray) -> dict:
    ndvi = compute_ndvi(arr)
    return {
        "ndvi": ndvi,
        "ndre": compute_ndre(arr),
        "swir_moisture": compute_swir_moisture(arr),
        "nbr": compute_nbr(arr),
        "canopy_cover": compute_canopy_cover(ndvi),
    }
