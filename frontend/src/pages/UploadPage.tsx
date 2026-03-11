import React, { useState, useCallback } from 'react'
import { uploadDataset, Dataset } from '../api/client'
import { Btn, Card, CardTitle, Tag, ProgressBar } from '../components/ui'

interface Props { onDataset: (ds: Dataset) => void }

export const UploadPage: React.FC<Props> = ({ onDataset }) => {
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress]   = useState(0)
  const [error, setError]         = useState<string | null>(null)

  const handleFile = useCallback(async (file: File) => {
    setError(null)
    setUploading(true)
    setProgress(10)
    try {
      // Fake progress while real upload happens
      const ticker = setInterval(() => setProgress(p => Math.min(p + 8, 85)), 200)
      const ds = await uploadDataset(file)
      clearInterval(ticker)
      setProgress(100)
      setTimeout(() => { setUploading(false); onDataset(ds) }, 300)
    } catch (e: any) {
      setUploading(false)
      setProgress(0)
      setError(e?.response?.data?.detail || 'Upload failed')
    }
  }, [onDataset])

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }, [handleFile])

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  }

  return (
    <div className="fade-in">
      {/* Format badges */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        {[['CSV', 'Comma-separated values'], ['XLSX', 'Excel workbook'], ['Parquet', 'Columnar format']].map(([fmt, desc]) => (
          <div key={fmt} style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--accent)', fontWeight: 700 }}>{fmt}</span>
            <span style={{ fontSize: 11, color: 'var(--text3)' }}>{desc}</span>
          </div>
        ))}
      </div>

      {/* Drop zone */}
      <label
        htmlFor="file-input"
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        style={{
          display: 'block', border: `2px dashed ${dragging ? 'var(--accent)' : 'var(--border2)'}`,
          borderRadius: 12, padding: '60px 40px', textAlign: 'center', cursor: 'pointer',
          background: dragging ? 'rgba(0,229,160,.04)' : 'var(--bg2)', transition: 'all .2s',
        }}
      >
        {uploading ? (
          <>
            <div style={{ fontSize: 40, marginBottom: 16 }} className="pulsing">⚙️</div>
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 6 }}>Processing dataset…</div>
            <div style={{ maxWidth: 300, margin: '0 auto' }}>
              <ProgressBar value={progress} />
              <div style={{ fontSize: 11, color: 'var(--text3)', textAlign: 'center', fontFamily: 'var(--mono)' }}>{Math.round(progress)}%</div>
            </div>
          </>
        ) : (
          <>
            <div style={{ fontSize: 40, marginBottom: 16 }}>📂</div>
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 6 }}>Drop your dataset here</div>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 20 }}>or click to browse — CSV, XLSX, Parquet supported</div>
            <Btn variant="primary" style={{ pointerEvents: 'none' }}>Choose File</Btn>
          </>
        )}
        <input id="file-input" type="file" accept=".csv,.xlsx,.parquet" style={{ display: 'none' }} onChange={onInputChange} />
      </label>

      {error && (
        <div style={{ marginTop: 12, padding: '10px 14px', background: 'rgba(255,94,125,.1)', border: '1px solid rgba(255,94,125,.3)', borderRadius: 8, color: 'var(--accent3)', fontSize: 12 }}>
          ⚠ {error}
        </div>
      )}

      {/* Info */}
      <Card style={{ marginTop: 24 }}>
        <CardTitle>How it works</CardTitle>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
          {[
            ['01', '⬆ Upload', 'Drop any CSV, XLSX or Parquet file'],
            ['02', '🧹 Clean', 'Apply cleaning operations and save'],
            ['03', '🧠 Train', 'Build a sklearn pipeline and train'],
            ['04', '📊 Visualize', 'Explore results interactively'],
          ].map(([n, title, desc]) => (
            <div key={n} style={{ background: 'var(--bg3)', borderRadius: 8, padding: '14px 16px' }}>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text3)', marginBottom: 6 }}>{n}</div>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>{title}</div>
              <div style={{ fontSize: 12, color: 'var(--text3)' }}>{desc}</div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}
