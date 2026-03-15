import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store'
import { sb, phoneVariants } from '../lib/supabase'
import { Avatar, StatusBadge, RoleBadge } from '../components/UI'

export default function Members() {
  const { members, showConfirm, removeMember, updateMember, toast, showLoad, hideLoad } = useStore()
  const navigate = useNavigate()
  const [q,       setQ]       = useState('')
  const [statusF, setStatusF] = useState(null)
  const [genderF, setGenderF] = useState(null)
  const [toggling, setToggling] = useState({})
  const [verifyF,  setVerifyF]  = useState(null)
  const [limit,    setLimit]    = useState(200)

  const filtered = useMemo(() => {
    let l = members
    if (statusF) l = l.filter(m => m.status === statusF)
    if (genderF) l = l.filter(m => m.gender === genderF)
    if (q.trim()) {
      const raw   = q.trim()
      const ql    = raw.toLowerCase()
      const phV   = phoneVariants(raw)
      const isNum = /^\d+$/.test(raw)
      l = l.filter(m =>
        (m.full_name  || '').includes(raw) ||
        (m.first_name || '').toLowerCase().includes(ql) ||
        (m.city   || '').includes(raw) ||
        (m.job    || '').includes(raw) ||
        (m.branch || '').includes(raw) ||
        (isNum && m.wp_id != null && String(m.wp_id) === raw) ||
        (m.phone && phV.some(v =>
          m.phone === v ||
          m.phone.replace('+','').includes(v.replace('+','')) ||
          v.replace('+','').includes(m.phone.replace('+',''))
        ))
      )
    }
    if (verifyF === true)  l = l.filter(m =>  m.is_verified)
    if (verifyF === false) l = l.filter(m => !m.is_verified)
    return l
  }, [members, q, statusF, genderF, verifyF])

  const duplicateNames = useMemo(() => {
    const counts = {}
    members.forEach(m => {
      const name = (m.full_name || m.first_name || '').trim()
      if (name) counts[name] = (counts[name] || 0) + 1
    })
    return new Set(Object.keys(counts).filter(n => counts[n] > 1))
  }, [members])

  const verifiedCount   = useMemo(() => filtered.filter(m => m.is_verified).length, [filtered])
  const unverifiedCount = filtered.length - verifiedCount

  async function toggleVerify(m, e) {
    e.stopPropagation()
    const newVal = !m.is_verified
    setToggling(t => ({ ...t, [m.id]: true }))
    const { error } = await sb.from('members').update({ is_verified: newVal }).eq('id', m.id)
    setToggling(t => { const n = { ...t }; delete n[m.id]; return n })
    if (error) return toast('خطأ: ' + error.message, 'er')
    updateMember(m.id, { is_verified: newVal })
  }

  function del(m) {
    showConfirm('🗑️', `حذف ${m.first_name || m.full_name}`,
      `حذف "${m.full_name || m.first_name}" نهائياً؟ لا يمكن التراجع.`,
      async () => {
        showLoad('جارٍ الحذف...')
        const { error } = await sb.from('members').delete().eq('id', m.id)
        hideLoad()
        if (error) return toast('خطأ: ' + error.message, 'er')
        removeMember(m.id)
        toast('تم الحذف', 'inf')
      }
    )
  }

  function deleteDuplicates() {
    const dupCount = members.filter(m => duplicateNames.has((m.full_name || m.first_name || '').trim())).length
    if (dupCount === 0) return toast('لا توجد أسماء مكررة', 'inf')
    showConfirm('🗑️', 'حذف الأسماء المكررة',
      `وُجد ${dupCount.toLocaleString('ar')} سجل بأسماء مكررة. سيتم الاحتفاظ بالسجل الأول لكل اسم وحذف الباقي. هل تريد المتابعة؟`,
      async () => {
        showLoad('جارٍ فحص المكررات...')
        const seen = {}
        const toDelete = []
        const sorted = [...members].sort((a, b) => a.id > b.id ? 1 : -1)
        sorted.forEach(m => {
          const name = (m.full_name || m.first_name || '').trim()
          if (!name) return
          if (duplicateNames.has(name)) {
            if (!seen[name]) seen[name] = m.id
            else toDelete.push(m.id)
          }
        })
        if (toDelete.length === 0) { hideLoad(); return toast('لا توجد مكررات للحذف', 'inf') }
        const { error } = await sb.from('members').delete().in('id', toDelete)
        hideLoad()
        if (error) return toast('خطأ: ' + error.message, 'er')
        toDelete.forEach(id => removeMember(id))
        toast(`تم حذف ${toDelete.length.toLocaleString('ar')} سجل مكرر`, 'inf')
      }
    )
  }

  const pendingCount = members.filter(m => m.status === 'pending').length

  return (
    <div>
      {/* Search + Filters */}
      <div className="sbar">
        <div className="s-wrap">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--mu2)" strokeWidth="2" strokeLinecap="round">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input
            value={q} onChange={e => setQ(e.target.value)}
            placeholder="بحث بالاسم أو الجوال أو المدينة أو رقم WP..."
          />
          {q && (
            <button onClick={()=>setQ('')} style={{ border:'none', background:'none', cursor:'pointer', color:'var(--mu2)', padding:'0 4px', fontSize:16, lineHeight:1 }}>✕</button>
          )}
        </div>
        <div className="chips">
          {[
            ['الكل',null],['معتمد','approved'],['معلق','pending'],['مرفوض','rejected'],
          ].map(([l,v]) => (
            <span key={l} className={`chip${statusF===v?' on':''}`} onClick={() => setStatusF(statusF===v?null:v)}>
              {v==='approved'&&'✅ '}{v==='pending'&&'⏳ '}{v==='rejected'&&'❌ '}{l}
              {v==='pending' && pendingCount > 0 && (
                <span style={{ marginRight:5, background:'var(--rd)', color:'#fff', fontSize:9, fontWeight:800, padding:'1px 6px', borderRadius:20 }}>{pendingCount}</span>
              )}
            </span>
          ))}
          <span style={{ display:'inline-block', width:1, height:20, background:'var(--br)', margin:'0 3px', alignSelf:'center' }} />
          {[['الجنسان',null],['ذكور','M'],['إناث','F']].map(([l,v]) => (
            <span key={l} className={`chip${genderF===v?' on':''}`} onClick={() => setGenderF(genderF===v?null:v)}>
              {v==='M'&&'👦 '}{v==='F'&&'👧 '}{l}
            </span>
          ))}
          <span style={{ display:'inline-block', width:1, height:20, background:'var(--br)', margin:'0 3px', alignSelf:'center' }} />
          {[['الكل',null],['✓ متحقق',true],['✗ غير متحقق',false]].map(([l,v]) => (
            <span key={l} className={`chip${verifyF===v?' on':''}`}
              style={v===true&&verifyF===true?{background:'var(--grl)',color:'var(--gr2)',borderColor:'var(--gr)'}:v===false&&verifyF===false?{background:'var(--rdl,#fef2f2)',color:'var(--rd2,#ef4444)',borderColor:'var(--rd,#ef4444)'}:{}}
              onClick={() => setVerifyF(verifyF===v?null:v)}>
              {l}
            </span>
          ))}
        </div>
      </div>

      {/* Header */}
      <div className="sh">
        <span className="sh-t">قائمة الأعضاء</span>
        <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
          <span className="sh-c">{filtered.length.toLocaleString('ar')} عضو</span>
          <select
            value={limit}
            onChange={e => setLimit(e.target.value === 'all' ? Infinity : Number(e.target.value))}
            style={{ fontSize:11, padding:'4px 8px', borderRadius:6, border:'1px solid var(--br)', background:'var(--card)', color:'var(--tx)', cursor:'pointer' }}
          >
            <option value={50}>عرض 50</option>
            <option value={200}>عرض 200</option>
            <option value={500}>عرض 500</option>
            <option value="all">عرض الكل</option>
          </select>
          <span style={{ fontSize:11, color:'var(--mu)', display:'flex', alignItems:'center', gap:5 }}>
            <span style={{ color:'#22c55e', fontWeight:700 }}>✓ {verifiedCount.toLocaleString('ar')}</span>
            <span style={{ color:'var(--mu)' }}>/</span>
            <span style={{ color:'var(--mu)' }}>{filtered.length.toLocaleString('ar')}</span>
            {unverifiedCount > 0 && (
              <span style={{ color:'#ef4444', fontWeight:600 }}>({unverifiedCount.toLocaleString('ar')} متبقي)</span>
            )}
          </span>
          {duplicateNames.size > 0 && (
            <button className="btn btn-er" style={{ fontSize:11 }} onClick={deleteDuplicates}>
              🗑️ حذف المكررات ({duplicateNames.size.toLocaleString('ar')} اسم)
            </button>
          )}
          <button className="btn btn-ok" onClick={() => navigate('/members/new')}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            إضافة
          </button>
        </div>
      </div>

      {/* Empty state */}
      {!filtered.length && (
        <div className="empty">
          <div className="empty-ico">🔍</div>
          <div style={{ fontWeight:700, marginBottom:6 }}>لا نتائج مطابقة</div>
          <div style={{ fontSize:12, color:'var(--mu2)' }}>جرّب تعديل كلمات البحث أو الفلاتر</div>
        </div>
      )}

      {/* List */}
      <div className="m-list">
        {(limit === Infinity ? filtered : filtered.slice(0, limit)).map(m => {
          const isVer = !!m.is_verified
          const busy  = !!toggling[m.id]
          const isDup = duplicateNames.has((m.full_name || m.first_name || '').trim())
          return (
            <div
              key={m.id}
              className="m-row"
              onClick={() => navigate('/members/' + m.id)}
              style={{ borderRight: `3px solid ${isVer ? '#22c55e' : '#e2e8f0'}` }}
            >
              <Avatar m={m} />
              <div className="m-info">
                <div className="m-name">
                  {m.full_name || m.first_name}
                  {m.wp_id && <small style={{ color:'var(--mu)', fontSize:10, fontWeight:500, marginRight:6 }}>#{m.wp_id}</small>}
                  {m.is_deceased && (
                    <small style={{ color:'var(--mu)', fontSize:10, fontWeight:500, marginRight:6 }}>رحمه الله</small>
                  )}
                  {isDup && (
                    <small style={{ color:'#f59e0b', fontSize:10, fontWeight:600, marginRight:6, background:'rgba(245,158,11,0.1)', padding:'1px 6px', borderRadius:4 }}>
                      مكرر
                    </small>
                  )}
                </div>
                <div className="m-meta">
                  {m.phone && (
                    <span>
                      <svg style={{ verticalAlign:'middle', marginLeft:3 }} width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.38 2 2 0 0 1 3.6 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.58a16 16 0 0 0 6 6l.95-.95a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
                      </svg>
                      {m.phone}
                    </span>
                  )}
                  {m.city && (
                    <span>
                      <svg style={{ verticalAlign:'middle', marginLeft:3 }} width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
                      </svg>
                      {m.city}
                    </span>
                  )}
                  {m.job && (
                    <span>
                      <svg style={{ verticalAlign:'middle', marginLeft:3 }} width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                        <rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>
                      </svg>
                      {m.job}
                    </span>
                  )}
                  {m.branch && <span style={{ color:'var(--mu3)' }}>فرع {m.branch}</span>}
                </div>
              </div>

              <div className="m-acts">
                <button
                  onClick={e => { e.stopPropagation(); !busy && toggleVerify(m, e) }}
                  title={isVer ? 'مؤكد — انقر لإلغاء' : 'غير مؤكد — انقر للتأكيد'}
                  style={{
                    width: 28, height: 28, borderRadius: 6,
                    border: `2px solid ${isVer ? '#22c55e' : '#cbd5e1'}`,
                    background: isVer ? '#22c55e' : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: busy ? 'wait' : 'pointer',
                    flexShrink: 0, transition: 'all .15s', padding: 0,
                  }}
                >
                  {busy
                    ? <span style={{ fontSize:9, color:'var(--mu)' }}>…</span>
                    : isVer
                      ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                      : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                  }
                </button>
                <StatusBadge status={m.status} />
                {m.is_deceased && <span className="badge b-deceased">متوفى</span>}
                <RoleBadge role={m.role} />
                <button
                  className="btn btn-er btn-xs"
                  onClick={e => { e.stopPropagation(); del(m) }}
                  title="حذف العضو"
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/>
                    <path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
                  </svg>
                </button>
              </div>
            </div>
          )
        })}
        {limit !== Infinity && filtered.length > limit && (
          <div style={{ textAlign:'center', padding:'14px 12px', color:'var(--mu)', fontSize:12, background:'var(--card)', borderRadius:'var(--r)', border:'1px solid var(--br)', cursor:'pointer' }}
            onClick={() => setLimit(Infinity)}>
            يعرض أول {limit} نتيجة من {filtered.length.toLocaleString('ar')} — <span style={{color:'var(--ac)',fontWeight:700}}>اضغط لعرض الكل</span>
          </div>
        )}
      </div>
    </div>
  )
}
