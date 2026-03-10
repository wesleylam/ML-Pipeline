# PipeLab — ML Pipeline Studio

A locally-hosted web app for the full ML data lifecycle: upload → clean → train → visualize.

## Stack

| Layer    | Tech                                      |
|----------|-------------------------------------------|
| Backend  | Python 3.11+, FastAPI, pandas, scikit-learn |
| Frontend | React 18, TypeScript, Vite, Recharts      |
| Storage  | Local filesystem (Parquet + joblib)       |

---

## Quick Start

### 1. Start the backend

```bash
chmod +x start_backend.sh
./start_backend.sh
```

Backend runs on **http://localhost:8000**  
Interactive API docs: **http://localhost:8000/docs**

### 2. Start the frontend (new terminal)

```bash
chmod +x start_frontend.sh
./start_frontend.sh
```

Frontend runs on **http://localhost:5173**

---

## Project Structure

```
pipelab/
├── backend/
│   ├── main.py                  # FastAPI app + CORS
│   ├── requirements.txt
│   ├── routers/
│   │   ├── upload.py            # POST /api/datasets/upload
│   │   ├── datasets.py          # GET  /api/datasets, /api/datasets/:id
│   │   ├── clean.py             # POST /api/datasets/:id/clean/preview|save
│   │   ├── train.py             # POST /api/train, GET /api/train/:id/status|results
│   │   └── results.py           # GET  /api/results, /api/results/:id/export
│   └── storage/
│       ├── raw/                 # Uploaded datasets (Parquet cache)
│       ├── clean/               # Cleaned datasets + ops history JSON
│       └── models/              # Trained models (joblib) + metadata JSON
│
└── frontend/
    └── src/
        ├── api/client.ts        # All API calls (axios)
        ├── components/
        │   ├── ui.tsx           # Shared UI primitives
        │   └── catalogue.ts     # sklearn step definitions
        └── pages/
            ├── UploadPage.tsx
            ├── CleanPage.tsx
            ├── TrainPage.tsx
            └── ResultsPage.tsx
```

---

## API Reference

### Upload
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/datasets/upload` | Upload CSV/XLSX/Parquet file |
| `GET`  | `/api/datasets` | List all uploaded datasets |
| `GET`  | `/api/datasets/:id` | Get dataset metadata + preview |

### Clean
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/datasets/:id/clean/preview` | Preview cleaning operations |
| `POST` | `/api/datasets/:id/clean/save` | Apply ops and save cleaned dataset |
| `GET`  | `/api/datasets/:id/clean/history` | Get ops history for cleaned dataset |

### Train
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/train` | Start training job (background thread) |
| `GET`  | `/api/train/:job_id/status` | Poll job status + log |
| `GET`  | `/api/train/:job_id/results` | Get full training results |

### Results
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET`  | `/api/results` | List all saved training runs |
| `GET`  | `/api/results/:job_id` | Get result metadata |
| `GET`  | `/api/results/:job_id/export` | Download predictions as CSV |

---

## Supported Pipeline Steps

### Preprocessing
- `StandardScaler` — zero mean, unit variance
- `MinMaxScaler` — scale to [0,1]
- `RobustScaler` — IQR-based, robust to outliers
- `Normalizer` — normalize samples to unit norm
- `SimpleImputer` — fill missing values (mean/median/mode/constant)
- `OneHotEncoder` — binary encode categorical columns
- `PolynomialFeatures` — generate polynomial/interaction features

### Feature Selection
- `SelectKBest` — select top K features by score
- `VarianceThreshold` — remove low-variance features
- `PCA` — principal component analysis

### Estimators
- `RandomForestClassifier` / `RandomForestRegressor`
- `LogisticRegression`
- `LinearRegression`
- `SVC` (Support Vector Classifier)
- `GradientBoostingClassifier`
- `KNeighborsClassifier`

---

## Cleaning Operations

| Operation | Description |
|-----------|-------------|
| `fill_missing` | Fill nulls with mean/median/mode/constant |
| `drop_nulls` | Drop rows with any null values |
| `drop_duplicates` | Remove duplicate rows |
| `drop_columns` | Remove specified columns |
| `filter_rows` | Filter rows by column condition |
| `cast_dtype` | Cast column to float64/int64/str/bool |
| `rename_column` | Rename a column |

---

## Extending

### Add a new sklearn step
Edit `frontend/src/components/catalogue.ts` — add a new entry to `STEP_CATALOGUE`.  
Then add the class to `CLASS_MAP` in `backend/routers/train.py`.

### Add a new cleaning operation
Add to `OP_DEFS` in `frontend/src/pages/CleanPage.tsx`.  
Add the handler to `apply_operation()` in `backend/routers/clean.py`.

## TO FIX
- file selection "Choose file" button does not work, the surrounding area works tho
- renamed column is not renamed in the feature columns
    - cannot train
- dataset select from train page
- prediction result is always the same
- color axis dont see to work on continuous value? (only discrete?)