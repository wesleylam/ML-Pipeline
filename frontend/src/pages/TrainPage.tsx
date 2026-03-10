import React, { useState, useEffect, useRef } from 'react'
import { Dataset, TrainResult, startTraining, getJobStatus } from '../api/client'
import { Btn, Card, CardTitle, FormGroup, Select, EmptyState, LogBox, Divider } from '../components/ui'
import { STEP_CATALOGUE, ALL_STEP_DEFS, StepDef } from '../components/catalogue'

interface PipeStepInstance {
  uid: string
  defId: string
  name: string
  category: string
  params: Record<string, string | number>
}

interface Props {
  dataset: Dataset | null
  cleanedDatasetId: string | null
  onResults: (r: TrainResult, jobId: string) => void
}

// ── Single pipeline step card ──────────────────────────────────────────────
const PipeStepCard: React.FC<{
  step: PipeStepInstance
  index: number
  onRemove: (uid: string) => void
  onParamChange: (uid: string, key: string, val: string) => void
}> = ({ step, index, onRemove, onParamChange }) => {
  const [expanded, setExpanded] = useState(false)
  const def = ALL_STEP_DEFS.find(d => d.id === step.defId) || { params: [] as any[], name: step.name }
  const hasParams = def.params.length > 0

  const badgeColors: Record<string, string> = {
    preprocessing:     'rgba(0,144,255,.15)',
    feature_selection: 'rgba(255,159,67,.15)',
    estimators:        'rgba(0,229,160,.15)',
  }
  const badgeTextColors: Record<string, string> = {
    preprocessing:     'var(--accent2)',
    feature_selection: 'var(--orange)',
    estimators:        'var(--accent)',
  }

  return (
    <div style={{ background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 8, marginBottom: 4, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', cursor: hasParams ? 'pointer' : 'default' }}
        onClick={() => hasParams && setExpanded(e => !e)}>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text3)', width: 20 }}>{String(index+1).padStart(2,'0')}</span>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 9, padding: '2px 6px', borderRadius: 3, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', background: badgeColors[step.category] || 'var(--bg)', color: badgeTextColors[step.category] || 'var(--text2)' }}>
          {(step.category || '').replace('_',' ')}
        </span>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 12, flex: 1 }}>{step.name}</span>
        {hasParams && <span style={{ color: 'var(--text3)', fontSize: 12, transition: 'transform .2s', transform: expanded ? 'rotate(90deg)' : 'none' }}>›</span>}
        <button onClick={e => { e.stopPropagation(); onRemove(step.uid) }} style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', fontSize: 13, padding: '2px 4px', borderRadius: 3 }}>✕</button>
      </div>
      {expanded && hasParams && (
        <div style={{ padding: '0 12px 12px 42px', display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          {def.params.map((p: any) => (
            <FormGroup key={p.key} label={p.label} style={{ minWidth: 110, flex: 1 }}>
              {p.type === 'select' ? (
                <select value={step.params[p.key] !== undefined ? String(step.params[p.key]) : String(p.default)}
                  onChange={e => onParamChange(step.uid, p.key, e.target.value)}
                  style={{ background: 'var(--bg)', border: '1px solid var(--border2)', borderRadius: 5, padding: '5px 8px', color: 'var(--text)', fontSize: 12, fontFamily: 'var(--mono)', outline: 'none', width: '100%', appearance: 'none' }}>
                  {p.options?.map((o: string) => <option key={o} value={o}>{o}</option>)}
                </select>
              ) : (
                <input type="number"
                  value={step.params[p.key] !== undefined ? step.params[p.key] : p.default}
                  onChange={e => onParamChange(step.uid, p.key, e.target.value)}
                  style={{ background: 'var(--bg)', border: '1px solid var(--border2)', borderRadius: 5, padding: '5px 8px', color: 'var(--text)', fontSize: 12, fontFamily: 'var(--mono)', outline: 'none', width: '100%' }} />
              )}
            </FormGroup>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Train Page ─────────────────────────────────────────────────────────────
export const TrainPage: React.FC<Props> = ({ dataset, cleanedDatasetId, onResults }) => {
  const [steps, setSteps] = useState<PipeStepInstance[]>([])
  const [target, setTarget] = useState('')
  const [testSize, setTestSize] = useState('0.2')
  const [status, setStatus] = useState<'idle' | 'running' | 'done' | 'failed'>('idle')
  const [log, setLog] = useState<string[]>([])
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const effectiveDatasetId = cleanedDatasetId || dataset?.id
  const cols = dataset?.column_names || []

  useEffect(() => {
    if (cols.length > 0 && !target) setTarget(cols[cols.length - 1])
  }, [cols])

  const addStep = (def: StepDef, category: string) => {
    const initParams: Record<string, string | number> = {}
    def.params.forEach(p => { initParams[p.key] = p.default })
    setSteps(prev => [...prev, {
      uid: `${def.id}_${Date.now()}_${Math.floor(Math.random() * 9999)}`,
      defId: def.id, name: def.name,
      category: category,
      params: initParams,
    }])
  }

  const removeStep = (uid: string) => setSteps(prev => prev.filter(s => s.uid !== uid))
  const updateParam = (uid: string, key: string, val: string) =>
    setSteps(prev => prev.map(s => s.uid === uid ? { ...s, params: { ...s.params, [key]: val } } : s))

  const hasEstimator = steps.some(s => s.category === 'estimators')
  const canTrain = hasEstimator && !!effectiveDatasetId && status !== 'running'

  const handleTrain = async () => {
    if (!canTrain || !effectiveDatasetId) return
    setStatus('running'); setLog([])
    try {
      const { job_id } = await startTraining({
        dataset_id: effectiveDatasetId,
        target_column: target,
        test_size: parseFloat(testSize),
        random_state: 42,
        steps: steps.map(s => ({ name: s.name, category: s.category, params: s.params })),
      })

      pollRef.current = setInterval(async () => {
        const st = await getJobStatus(job_id)
        setLog(st.log)
        if (st.status === 'done') {
          clearInterval(pollRef.current!)
          setStatus('done')
          const { getJobResults } = await import('../api/client')
          const res = await getJobResults(job_id)
          onResults(res, job_id)
        } else if (st.status === 'failed') {
          clearInterval(pollRef.current!)
          setStatus('failed')
          setLog(prev => [...prev, `❌ ${st.error}`])
        }
      }, 800)
    } catch (e: any) {
      setStatus('failed')
      setLog([`❌ ${e?.response?.data?.detail || 'Training failed'}`])
    }
  }

  // Python code preview
  const codePreview = steps.length > 0
    ? `Pipeline([\n${steps.map(s => {
        const paramStr = Object.entries(s.params).map(([k,v]) => `${k}=${v}`).join(', ')
        return `  ("${s.name.toLowerCase()}", ${s.name}(${paramStr}))`
      }).join(',\n')}\n])`
    : null

  if (!dataset) return <EmptyState icon="🧠" title="No dataset loaded" sub="Upload a dataset first" />

  return (
    <div className="fade-in">
      {/* Config */}
      <Card style={{ marginBottom: 16 }}>
        <CardTitle>Run Configuration</CardTitle>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <FormGroup label="Dataset">
            <div style={{ fontFamily: 'var(--mono)', fontSize: 12, padding: '8px 10px', background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 6, color: cleanedDatasetId ? 'var(--accent)' : 'var(--text2)' }}>
              {cleanedDatasetId ? `${cleanedDatasetId} (cleaned)` : dataset.name}
            </div>
          </FormGroup>
          <FormGroup label="Target Column">
            <Select value={target} onChange={e => setTarget(e.target.value)} style={{ minWidth: 140 }}>
              {cols.map(c => <option key={c} value={c}>{c}</option>)}
            </Select>
          </FormGroup>
          <FormGroup label="Test Size">
            <Select value={testSize} onChange={e => setTestSize(e.target.value)}>
              {['0.1','0.15','0.2','0.25','0.3'].map(v => <option key={v} value={v}>{(parseFloat(v)*100).toFixed(0)}%</option>)}
            </Select>
          </FormGroup>
          <Btn variant="primary" onClick={handleTrain} disabled={!canTrain}>
            {status === 'running' ? '⚙️ Training…' : '▶ Run Pipeline'}
          </Btn>
          {!hasEstimator && steps.length > 0 && (
            <span style={{ fontSize: 11, color: 'var(--accent3)', paddingBottom: 4 }}>⚠ Add an estimator step</span>
          )}
        </div>
      </Card>

      <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 16, alignItems: 'start' }}>
        {/* Catalogue */}
        <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, padding: 14, maxHeight: 'calc(100vh - 300px)', overflowY: 'auto' }}>
          <CardTitle style={{ marginBottom: 4 }}>Step Catalogue</CardTitle>
          <div style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 12 }}>Click + to add to pipeline</div>
          {Object.entries(STEP_CATALOGUE).map(([cat, items]) => (
            <div key={cat} style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 9, letterSpacing: '.15em', textTransform: 'uppercase', color: 'var(--text3)', fontFamily: 'var(--mono)', marginBottom: 6 }}>{cat.replace('_',' ')}</div>
              {items.map(def => (
                <div key={def.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg3)', marginBottom: 4, transition: 'all .15s' }}
                  onMouseOver={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border2)' }}
                  onMouseOut={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)' }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: def.color, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text)' }}>{def.name}</div>
                    <div style={{ fontSize: 10, color: 'var(--text3)' }}>{def.desc}</div>
                  </div>
                  <button onClick={() => addStep(def, cat)}
                    style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: '0 2px', opacity: 0.7, transition: 'opacity .1s' }}
                    onMouseOver={e => (e.currentTarget.style.opacity = '1')}
                    onMouseOut={e => (e.currentTarget.style.opacity = '0.7')}>+</button>
                </div>
              ))}
            </div>
          ))}
        </div>

        {/* Canvas */}
        <div>
          <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, padding: 16, minHeight: 300 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <CardTitle style={{ margin: 0 }}>
                Pipeline
                <span style={{ color: 'var(--text3)', fontWeight: 400, marginLeft: 8 }}>
                  {steps.length === 0 ? 'empty' : `${steps.length} step${steps.length !== 1 ? 's' : ''}`}
                </span>
              </CardTitle>
              {steps.length > 0 && <Btn variant="secondary" size="sm" onClick={() => setSteps([])}>Clear all</Btn>}
            </div>

            {steps.length === 0 ? (
              <div style={{ border: '2px dashed var(--border)', borderRadius: 8, padding: '40px 20px', textAlign: 'center', color: 'var(--text3)', fontSize: 12 }}>
                <div style={{ fontSize: 28, marginBottom: 10 }}>🔗</div>
                <strong style={{ color: 'var(--text2)' }}>Build your sklearn pipeline</strong><br />
                <span style={{ marginTop: 4, display: 'block' }}>Click + on any step in the catalogue to add it here.</span>
              </div>
            ) : (
              steps.map((step, i) => (
                <div key={step.uid}>
                  <PipeStepCard step={step} index={i} onRemove={removeStep} onParamChange={updateParam} />
                  {i < steps.length - 1 && (
                    <div style={{ display: 'flex', justifyContent: 'center', height: 14, margin: '-2px 0' }}>
                      <div style={{ width: 2, height: '100%', background: 'var(--border2)' }} />
                    </div>
                  )}
                </div>
              ))
            )}

            {/* Code preview */}
            {codePreview && (
              <>
                <Divider />
                <div style={{ fontSize: 9, color: 'var(--text3)', fontFamily: 'var(--mono)', letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: 8 }}>sklearn equivalent</div>
                <pre style={{ background: 'var(--bg)', borderRadius: 6, padding: '10px 12px', fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text3)', lineHeight: 1.8, overflowX: 'auto' }}>
                  {codePreview}
                </pre>
              </>
            )}
          </div>

          {/* Log */}
          {(status === 'running' || status === 'done' || status === 'failed') && (
            <Card style={{ marginTop: 14 }}>
              <LogBox lines={log} status={status} />
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
