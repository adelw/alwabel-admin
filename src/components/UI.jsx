import { useState, useEffect, useRef } from 'react'
import { useStore } from '../store'
import { phoneVariants } from '../lib/supabase'

export function AutoComplete({ label, placeholder, gender, value, displayValue, onChange, disabled }) {
  const { members } = useStore()
  const [q, setQ]   = useState(displayValue || '')
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => setQ(displayValue || ''), [displayValue])

  useEffect(() => {
    const h = e => { if (!ref.current?.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const results = (() => {
    const raw = q.trim()
    if (!raw) return []
    const ql  = raw.toLowerCase()
    const phV = phoneVariants(raw)
    return members.filter(m => {
      if (gender && m.gender !== gender) return false
      if ((m.full_name || m.first_name || '').toLowerCase().includes(ql)) return true
      if (m.phone) {
        const ph = m.phone
        return phV.some(v =>
          ph === v ||
          ph.replace('+','').includes(v.replace('+','')) ||
          v.replace('+','').includes(ph.replace('+',''))
        )
      }
      return false
    }).slice(0, 12)
  })()

  const select = m => {
    const name = m.full_name || m.first_name || ''
    setQ(name); setOpen(false); onChange(m.id, name)
  }
  const clear = e => { e.stopPropagation(); setQ(''); onChange(null, '') }

  return (
    <div className="fg">
      {label && <label>{label}</label>}
      <div className="ac-wrap" ref={ref}>
        <div className="ac-row">
          <input
            className="fi" style={{ flex: 1 }}
            value={q}
            placeholder={placeholder || 'ابحث بالاسم أو الجوال...'}
            disabled={disabled}
            onChange={e => { setQ(e.target.value); setOpen(true) }}
            onFocus={() => setOpen(true)}
          />
          {value && <button type="button" className="btn btn-gh btn-sm" onMouseDown={clear}>✕</button>}
        </div>
        {open && results.length > 0 && (
          <div className="ac-list">
            {results.map(m => (
              <div key={m.id} className="ac-item" onMouseDown={() => select(m)}>
                <span>{m.gender === 'F' ? '👩' : '👨'}</span>
                <span>
                  {m.full_name || m.first_name}
                  <small>{[m.city, m.phone].filter(Boolean).join(' · ')}</small>
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export function ConfirmDialog() {
  const { confirm, doConfirm, cancelConfirm } = useStore()
  if (!confirm) return null
  return (
    <div className="confirm-overlay" onClick={cancelConfirm}>
      <div className="confirm-box" onClick={e => e.stopPropagation()}>
        <div className="c-ico">{confirm.ico || '⚠️'}</div>
        <div className="c-title">{confirm.title}</div>
        <div className="c-msg">{confirm.msg}</div>
        <div className="c-btns">
          <button style={{ background:'var(--bg)', color:'var(--mu)' }} onClick={cancelConfirm}>إلغاء</button>
          <button style={{ background:'var(--rd)', color:'#fff' }} onClick={doConfirm}>تأكيد</button>
        </div>
      </div>
    </div>
  )
}

export function LoadingOverlay() {
  const { loading, loadMsg } = useStore()
  if (!loading) return null
  return (
    <div className="loading-cover">
      <div className="spinner" />
      {loadMsg && <div className="load-txt">{loadMsg}</div>}
    </div>
  )
}

export function ToastContainer() {
  const { toasts } = useStore()
  return (
    <div className="toast-wrap">
      {toasts.map(t => <div key={t.id} className={`toast toast-${t.type}`}>{t.msg}</div>)}
    </div>
  )
}

export function Avatar({ m, size = 42 }) {
  const f = m?.gender === 'F'
  return (
    <div className={`m-av ${f ? 'av-f' : 'av-m'}`} style={{ width: size, height: size, fontSize: size * .48 }}>
      {m?.photo_url ? <img src={m.photo_url} alt="" onError={e => e.target.style.display='none'} /> : (f ? '👩' : '👨')}
    </div>
  )
}

const SL = { approved:'معتمد', pending:'معلق', rejected:'مرفوض', suspended:'موقوف' }
const RL = { admin:'مدير', supervisor:'مشرف', user:'مستخدم' }
export const sLabel = s => SL[s] || 'معتمد'
export const rLabel = r => RL[r] || r

export function StatusBadge({ status }) {
  return <span className={`badge b-${status || 'approved'}`}>{sLabel(status)}</span>
}
export function RoleBadge({ role }) {
  if (!role || role === 'user') return null
  return <span className={`badge b-${role}`}>{rLabel(role)}</span>
}

export function Modal({ title, onClose, children, footer, sm }) {
  return (
    <div className="overlay" onClick={onClose}>
      <div className={`dialog${sm ? ' sm' : ''}`} onClick={e => e.stopPropagation()}>
        <div className="dlg-head">
          <h3>{title}</h3>
          <button className="dlg-close" onClick={onClose}>✕</button>
        </div>
        <div className="dlg-body">{children}</div>
        {footer && <div className="dlg-foot">{footer}</div>}
      </div>
    </div>
  )
}
