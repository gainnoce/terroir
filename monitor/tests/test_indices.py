import numpy as np
import pytest
from indices import compute_ndvi, compute_ndre, compute_swir_moisture, compute_nbr, compute_canopy_cover, compute_all_indices
from history import HistoryStore

def make_array(nir_val, red_val, rededge_val, swir1_val, swir2_val, size=10):
    arr = np.zeros((size, size, 5), dtype=np.float32)
    arr[:, :, 0] = nir_val
    arr[:, :, 1] = red_val
    arr[:, :, 2] = rededge_val
    arr[:, :, 3] = swir1_val
    arr[:, :, 4] = swir2_val
    return arr

def test_ndvi_healthy_vegetation():
    arr = make_array(nir_val=0.8, red_val=0.1, rededge_val=0.5, swir1_val=0.2, swir2_val=0.15)
    ndvi = compute_ndvi(arr)
    assert 0.77 < ndvi < 0.79

def test_ndvi_bare_soil():
    arr = make_array(nir_val=0.3, red_val=0.28, rededge_val=0.29, swir1_val=0.3, swir2_val=0.3)
    ndvi = compute_ndvi(arr)
    assert -0.05 < ndvi < 0.05

def test_ndre_detects_chlorophyll_stress():
    arr = make_array(nir_val=0.6, red_val=0.3, rededge_val=0.5, swir1_val=0.3, swir2_val=0.2)
    ndre = compute_ndre(arr)
    assert 0.08 < ndre < 0.12

def test_swir_moisture_wet():
    arr = make_array(nir_val=0.7, red_val=0.2, rededge_val=0.4, swir1_val=0.1, swir2_val=0.08)
    smi = compute_swir_moisture(arr)
    assert 0.73 < smi < 0.77

def test_canopy_cover_high_ndvi():
    arr = make_array(nir_val=0.85, red_val=0.05, rededge_val=0.5, swir1_val=0.15, swir2_val=0.1)
    ndvi = compute_ndvi(arr)
    cover = compute_canopy_cover(ndvi)
    assert cover > 80.0

def test_compute_all_indices_returns_dict():
    arr = make_array(nir_val=0.75, red_val=0.12, rededge_val=0.45, swir1_val=0.2, swir2_val=0.15)
    result = compute_all_indices(arr)
    assert set(result.keys()) == {"ndvi", "ndre", "swir_moisture", "nbr", "canopy_cover"}
    for v in result.values():
        assert isinstance(v, float)

def test_history_store_tracks_per_location():
    store = HistoryStore()
    store.add("napa_38.4_-122.4", {"timestamp": "2025-06-01T00:00:00Z", "ndvi": 0.72, "ndre": 0.15, "swir_moisture": 0.45})
    store.add("napa_38.4_-122.4", {"timestamp": "2025-06-06T00:00:00Z", "ndvi": 0.68, "ndre": 0.13, "swir_moisture": 0.40})
    history = store.get("napa_38.4_-122.4")
    assert len(history) == 2
    assert history[-1]["ndvi"] == 0.68

def test_history_store_returns_empty_for_unknown_location():
    store = HistoryStore()
    assert store.get("unknown_location") == []

def test_history_store_caps_at_five_entries():
    store = HistoryStore()
    key = "test_loc"
    for i in range(7):
        store.add(key, {"timestamp": f"2025-0{i+1}-01T00:00:00Z", "ndvi": 0.7, "ndre": 0.1, "swir_moisture": 0.4})
    assert len(store.get(key)) == 5
