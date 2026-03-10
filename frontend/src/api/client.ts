import axios from 'axios'

const api = axios.create({ baseURL: '/api' })

// ── Types ──────────────────────────────────────────────────────────────────
export interface Dataset {
  id: string
  name: string
  rows: number
  columns: number
  column_names: string[]
  dtypes: Record<string, string>
  null_counts: Record<string, number>
  preview: Record<string, unknown>[]
  stats?: Record<string, { min: number; max: number; mean: number; std: number }>
}

export interface Operation {
  op: string
  params: Record<string, unknown>
}

export interface PipelineStep {
  name: string
  category: string
  params: Record<string, unknown>
}

export interface TrainRequest {
  dataset_id: string
  target_column: string
  feature_columns?: string[]
  test_size: number
  random_state: number
  steps: PipelineStep[]
}

export interface TrainResult {
  job_id: string
  dataset_id: string
  target_column: string
  feature_columns: string[]
  steps: PipelineStep[]
  is_classifier: boolean
  metrics: Record<string, number | number[][]>
  feature_importance: { feature: string; importance: number }[]
  predictions: Record<string, unknown>[]
  column_names: string[]
}

export interface JobStatus {
  job_id: string
  status: 'pending' | 'running' | 'done' | 'failed'
  log: string[]
  error?: string
}

// ── Upload ─────────────────────────────────────────────────────────────────
export const uploadDataset = async (file: File): Promise<Dataset> => {
  const form = new FormData()
  form.append('file', file)
  const { data } = await api.post('/datasets/upload', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data
}

// ── Datasets ───────────────────────────────────────────────────────────────
export const listDatasets = async (): Promise<Dataset[]> => {
  const { data } = await api.get('/datasets')
  return data
}

export const getDataset = async (id: string): Promise<Dataset> => {
  const { data } = await api.get(`/datasets/${id}`)
  return data
}

// ── Clean ──────────────────────────────────────────────────────────────────
export const previewClean = async (dsId: string, operations: Operation[]) => {
  const { data } = await api.post(`/datasets/${dsId}/clean/preview`, { operations })
  return data
}

export const saveClean = async (dsId: string, operations: Operation[], saveAs?: string) => {
  const { data } = await api.post(`/datasets/${dsId}/clean/save`, { operations, save_as: saveAs })
  return data
}

// ── Train ──────────────────────────────────────────────────────────────────
export const startTraining = async (req: TrainRequest): Promise<{ job_id: string }> => {
  const { data } = await api.post('/train', req)
  return data
}

export const getJobStatus = async (jobId: string): Promise<JobStatus> => {
  const { data } = await api.get(`/train/${jobId}/status`)
  return data
}

export const getJobResults = async (jobId: string): Promise<TrainResult> => {
  const { data } = await api.get(`/train/${jobId}/results`)
  return data
}

// ── Results ────────────────────────────────────────────────────────────────
export const listResults = async () => {
  const { data } = await api.get('/results')
  return data
}

export const getResult = async (jobId: string): Promise<TrainResult> => {
  const { data } = await api.get(`/results/${jobId}`)
  return data
}

export const exportResultCSV = (jobId: string) => {
  window.open(`/api/results/${jobId}/export`, '_blank')
}
