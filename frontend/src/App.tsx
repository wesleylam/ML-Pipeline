import React, { useState } from 'react'
import './styles/globals.css'
import { Dataset, TrainResult } from './api/client'
import { UploadPage } from './pages/UploadPage'
import { CleanPage } from './pages/CleanPage'
import { TrainPage } from './pages/TrainPage'
import { ResultsPage } from './pages/ResultsPage'

type Page = 'upload' | 'clean' | 'train' | 'results'

export default function App() {
  const [page, setPage] = useState<Page>('upload')
  const [dataset, setDataset] = useState<Dataset | null>(null)
  const [cleanedId, setCleanedId] = useState<string | null>(null)
  const [result, setResult] = useState<TrainResult | null>(null)
  const [jobId, setJobId] = useState<string | null>(null)

  const nav: { id: Page; label: string; icon: string; needs?: 'dataset' | 'result' }[] = [
    { id: 'upload',  label: 'Upload',    icon: '⬆' },
    { id: 'clean',   label: 'Clean',     icon: '🧹', needs: 'dataset' },
    { id: 'train',   label: 'Train',     icon: '🧠', needs: 'dataset' },
    { id: 'results', label: 'Visualize', icon: '📊', needs: 'result' },
  ]

  const titles: Record<Page, string> = {
    upload:  'Upload Dataset',
    clean:   'Clean & Transform',
    train:   'Pipeline Builder',
    results: 'Results & Plots',
  }

  const steps: Record<Page, string> = {
    upload: '01 / 04', clean: '02 / 04', train: '03 / 04', results: '04 / 04',
  }

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      {/* ── Sidebar ── */}
      <aside style={{ width: 220, minWidth: 220, background: 'var(--bg2)', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '20px 20px 16px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 13, fontWeight: 700, color: 'var(--accent)', letterSpacing: '.08em' }}>PIPELAB</div>
          <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 2, letterSpacing: '.1em', textTransform: 'uppercase' }}>ML Pipeline Studio</div>
        </div>

        <nav style={{ flex: 1, padding: '12px 0' }}>
          <div style={{ fontSize: 9, letterSpacing: '.15em', textTransform: 'uppercase', color: 'var(--text3)', padding: '8px 20px 4px', fontFamily: 'var(--mono)' }}>Workflow</div>
          {nav.map(item => {
            const disabled = item.needs === 'dataset' ? !dataset : item.needs === 'result' ? !result : false
            const done     = item.needs === 'dataset' ? !!dataset : item.needs === 'result' ? !!result : false
            const active   = page === item.id
            return (
              <div key={item.id}
                onClick={() => !disabled && setPage(item.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '9px 20px',
                  cursor: disabled ? 'not-allowed' : 'pointer',
                  color: active ? 'var(--accent)' : disabled ? 'var(--text3)' : 'var(--text2)',
                  borderLeft: `2px solid ${active ? 'var(--accent)' : 'transparent'}`,
                  background: active ? 'rgba(0,229,160,.05)' : 'transparent',
                  opacity: disabled ? 0.35 : 1,
                  transition: 'all .15s',
                  userSelect: 'none',
                }}>
                <span style={{ fontSize: 14, width: 18, textAlign: 'center' }}>{item.icon}</span>
                <span style={{ fontSize: 13, fontWeight: 500 }}>{item.label}</span>
                {done && !active && (
                  <span style={{ marginLeft: 'auto', background: 'var(--accent)', color: '#000', fontSize: 9, fontWeight: 700, fontFamily: 'var(--mono)', padding: '1px 5px', borderRadius: 3 }}>✓</span>
                )}
              </div>
            )
          })}
        </nav>

        {dataset && (
          <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)' }}>
            <div style={{ fontSize: 9, letterSpacing: '.15em', textTransform: 'uppercase', color: 'var(--text3)', fontFamily: 'var(--mono)', marginBottom: 8 }}>Active Dataset</div>
            <div style={{ background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 6, padding: '8px 10px' }}>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 11, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>📁 {dataset.name}</div>
              <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 3 }}>{dataset.rows.toLocaleString()} rows · {dataset.columns} cols</div>
              {cleanedId && <div style={{ fontSize: 10, color: 'var(--accent)', marginTop: 2 }}>✓ cleaned</div>}
            </div>
          </div>
        )}
      </aside>

      {/* ── Main ── */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {/* Topbar */}
        <div style={{ height: 52, minHeight: 52, borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', padding: '0 28px', gap: 12, background: 'var(--bg2)' }}>
          <span style={{ fontSize: 14, fontWeight: 600, fontFamily: 'var(--mono)' }}>{titles[page]}</span>
          <span style={{ fontSize: 11, color: 'var(--text3)', background: 'var(--bg3)', border: '1px solid var(--border)', padding: '3px 8px', borderRadius: 4, fontFamily: 'var(--mono)' }}>{steps[page]}</span>
          <div style={{ flex: 1 }} />
          {page === 'results' && result && (
            <button onClick={() => { setPage('train'); setResult(null); setJobId(null) }}
              style={{ background: 'var(--accent)', color: '#000', border: 'none', borderRadius: 6, padding: '6px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--sans)' }}>
              ＋ New Run
            </button>
          )}
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 28 }}>
          {page === 'upload' && (
            <UploadPage onDataset={ds => { setDataset(ds); setCleanedId(null); setPage('clean') }} />
          )}
          {page === 'clean' && (
            <CleanPage dataset={dataset} onCleanSaved={id => setCleanedId(id)} />
          )}
          {page === 'train' && (
            <TrainPage
              dataset={dataset}
              cleanedDatasetId={cleanedId}
              onResults={(r, jid) => { setResult(r); setJobId(jid); setPage('results') }}
            />
          )}
          {page === 'results' && (
            <ResultsPage result={result} jobId={jobId} />
          )}
        </div>
      </div>
    </div>
  )
}
