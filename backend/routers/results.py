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
    predictions_path = os.path.join(STORAGE_MODELS, job_id, "predictions.parquet")
    if not os.path.exists(predictions_path):
        raise HTTPException(404, f"Predictions for job {job_id} not found.")

    df = pd.read_parquet(predictions_path)
    stream = io.StringIO()
    df.to_csv(stream, index=False)
    stream.seek(0)
    return StreamingResponse(
        iter([stream.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=predictions_{job_id}.csv"}
    )
