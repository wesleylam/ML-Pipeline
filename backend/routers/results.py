import os, json
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
import pandas as pd
import io

router = APIRouter()
STORAGE_MODELS = os.path.join(os.path.dirname(__file__), "../storage/models")


def _load_meta(job_id: str) -> dict:
    path = os.path.join(STORAGE_MODELS, job_id, "metadata.json")
    if not os.path.exists(path):
        raise HTTPException(404, f"Result {job_id} not found")
    with open(path) as f:
        return json.load(f)


@router.get("")
def list_results():
    results = []
    if os.path.exists(STORAGE_MODELS):
        for job_id in os.listdir(STORAGE_MODELS):
            try:
                meta = _load_meta(job_id)
                results.append({
                    "job_id": job_id,
                    "dataset_id": meta.get("dataset_id"),
                    "target_column": meta.get("target_column"),
                    "is_classifier": meta.get("is_classifier"),
                    "metrics": meta.get("metrics"),
                })
            except Exception:
                pass
    return results


@router.get("/{job_id}")
def get_result(job_id: str):
    return _load_meta(job_id)


@router.get("/{job_id}/export")
def export_result(job_id: str):
    meta = _load_meta(job_id)
    predictions = meta.get("predictions", [])
    df = pd.DataFrame(predictions)
    stream = io.StringIO()
    df.to_csv(stream, index=False)
    stream.seek(0)
    return StreamingResponse(
        iter([stream.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=results_{job_id}.csv"}
    )
