import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store'
import { Avatar } from '../components/UI'

export default function WpSearch() {
  const { members } = useStore()
  const navigate = useNavigate()
  const [q, setQ] = useState('')

  const wpNum = q.trim()
  const result = wpNum
    ? members.find(m => m.wp_id != null && String(m.wp_id) === wpNum)
    : null
  const notFound = wpNum && !result

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', padding: '24px 16px' }}>
      <div className="sh" style={{ marginBottom: 20 }}>
        <span className="sh-t">بحث برقم WP</span>
      </div>

      {/* حقل البحث */}
      <div className="s-wrap" style={{ marginBottom: 24 }}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--mu2)" strokeWidth="2" strokeLinecap="round">
          <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
        </svg>
        <input
          type="number"
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="أدخل رقم WP مثال: 260"
          style={{ fontSize: 18, fontWeight: 600 }}
          autoFocus
        />
        {q && (
          <button onClick={() => setQ('')} style={{ border:'none', background:'none', cursor:'pointer', color:'var(--mu2)', padding:'0 4px', fontSize:16 }}>✕</button>
        )}
      </div>

      {/* نتيجة */}
      {result && (
        <div
          className="m-row"
          onClick={() => navigate('/members/' + result.id)}
          style={{
            borderRight: `3px solid ${result.is_verified ? '#22c55e' : '#e2e8f0'}`,
            cursor: 'pointer',
            padding: '12px 14px',
          }}
        >
          <Avatar m={result} />
          <div className="m-info">
            <div className="m-name" style={{ fontSize: 16 }}>
              {result.full_name || result.first_name}
              <small style={{ color:'var(--mu)', fontSize:11, marginRight:8 }}>#{result.wp_id}</small>
              {result.is_deceased && <small style={{ color:'var(--mu)', fontSize:10, marginRight:6 }}>رحمه الله</small>}
            </div>
            <div className="m-meta">
              {result.phone && <span>📞 {result.phone}</span>}
              {result.city  && <span>📍 {result.city}</span>}
              {result.job   && <span>💼 {result.job}</span>}
            </div>
            <div style={{ marginTop: 6, display:'flex', gap:6, flexWrap:'wrap' }}>
              <span style={{
                fontSize:11, padding:'2px 10px', borderRadius:20,
                background: result.is_verified ? '#dcfce7' : '#fef2f2',
                color:      result.is_verified ? '#16a34a' : '#ef4444',
                fontWeight: 600,
              }}>
                {result.is_verified ? '✓ موثق' : '✗ غير موثق'}
              </span>
              <span style={{
                fontSize:11, padding:'2px 10px', borderRadius:20,
                background:'var(--acl,#eff6ff)', color:'var(--ac,#2563eb)', fontWeight:600
              }}>
                {result.gender === 'M' ? '👦 ذكر' : '👧 أنثى'}
              </span>
            </div>
          </div>
        </div>
      )}

      {notFound && (
        <div className="empty">
          <div className="empty-ico">🔍</div>
          <div style={{ fontWeight:700, marginBottom:6 }}>لا يوجد عضو برقم WP: {wpNum}</div>
          <div style={{ fontSize:12, color:'var(--mu2)' }}>تأكد من الرقم وحاول مجدداً</div>
        </div>
      )}

      {!wpNum && (
        <div style={{ textAlign:'center', color:'var(--mu)', fontSize:13, marginTop:40 }}>
          <div style={{ fontSize:40, marginBottom:12 }}>🔢</div>
          أدخل رقم WP للبحث عن العضو مباشرة
        </div>
      )}
    </div>
  )
}
