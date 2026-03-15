import { useMemo } from 'react'
import { useStore } from '../store'
import { useNavigate } from 'react-router-dom'

/* ── Animated Progress Bar ── */
function PB({ label, value, total, color, icon }) {
  const pct = total ? Math.round(value / total * 100) : 0
  return (
    <div className="pb-row">
      <div className="pb-labels">
        <span style={{ display:'flex', alignItems:'center', gap:6 }}>
          {icon && <span style={{ fontSize:13 }}>{icon}</span>}
          {label}
        </span>
        <span style={{ display:'flex', alignItems:'center', gap:6, fontWeight:800 }}>
          <span style={{ color, fontSize:13 }}>{value.toLocaleString('ar')}</span>
          <span style={{ color:'var(--mu2)', fontWeight:500 }}>({pct}%)</span>
        </span>
      </div>
      <div className="pb-track">
        <div className="pb-fill" style={{ width: pct + '%', background: color }} />
      </div>
    </div>
  )
}

/* ── Stat Card ── */
function StatCard({ icon, iconBg, accentColor, value, label, valueColor, note }) {
  return (
    <div className="stat-card" style={{ '--stat-color': accentColor }}>
      <div className="stat-icon" style={{ background: iconBg }}>{icon}</div>
      <div>
        <div className="stat-val" style={{ color: valueColor || 'var(--tx)' }}>{value}</div>
        <div className="stat-lbl">{label}</div>
        {note && <div style={{ fontSize:10, color:'var(--mu2)', marginTop:3, fontWeight:600 }}>{note}</div>}
      </div>
    </div>
  )
}

export default function Dashboard() {
  const { members, marriages } = useStore()
  const navigate = useNavigate()

  // فقط المتحقق منهم يدخلون في الإحصاءات
  const verified   = members.filter(m => m.is_verified)
  const totalAll   = members.length
  const total      = verified.length
  const unverified = totalAll - total
  const males      = verified.filter(m => m.gender === 'M').length
  const females    = verified.filter(m => m.gender === 'F').length
  const deceased   = verified.filter(m => m.is_deceased).length
  const pending    = members.filter(m => m.status === 'pending').length
  const approved   = verified.filter(m => m.status === 'approved').length

  const thisMonth = useMemo(() => {
    const now = new Date()
    return verified.filter(m => {
      if (!m.created_at) return false
      const d = new Date(m.created_at)
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
    }).length
  }, [verified])

  const withPhone  = verified.filter(m => m.phone).length
  const withJob    = verified.filter(m => m.job).length
  const withCity   = verified.filter(m => m.city).length
  const withMom    = verified.filter(m => m.mother_id).length
  const withBranch = verified.filter(m => m.branch).length

  // إحصاء الانتماء
  const wabilMembers   = verified.filter(m => m.is_family_member !== false).length
  const outsideMembers = verified.filter(m => m.is_family_member === false).length
  const familyNames = useMemo(() => {
    const fm = {}
    verified.forEach(m => {
      if (m.is_family_member === false && m.family_name) {
        fm[m.family_name] = (fm[m.family_name] || 0) + 1
      }
    })
    return Object.entries(fm).sort((a,b) => b[1]-a[1]).slice(0, 10)
  }, [verified])

  const topCities = useMemo(() => {
    const cm = {}
    verified.forEach(m => { if (m.city) cm[m.city] = (cm[m.city] || 0) + 1 })
    return Object.entries(cm).sort((a,b) => b[1]-a[1]).slice(0, 9)
  }, [verified])

  const branches = useMemo(() => {
    const bm = {}
    verified.forEach(m => { if (m.branch) bm[m.branch] = (bm[m.branch] || 0) + 1 })
    return Object.entries(bm).sort((a,b) => b[1]-a[1])
  }, [verified])

  const branchColors = { 'علي':'var(--bl)', 'صالح':'var(--gr)', 'إبراهيم':'var(--or)' }

  return (
    <div>

      {/* ── Stat Cards ── */}
      <div className="stats-grid">
        <StatCard
          icon="👨‍👩‍👧‍👦" iconBg="linear-gradient(135deg,#EEF2FF,#DBEAFE)"
          accentColor="var(--bl)" value={total.toLocaleString('ar')}
          label="إجمالي الأعضاء ✓"
          note={`${approved.toLocaleString('ar')} معتمد · ${unverified.toLocaleString('ar')} غير متحقق`}
        />
        <StatCard
          icon="⏳" iconBg="linear-gradient(135deg,var(--orl),var(--or3))"
          accentColor="var(--or)" value={pending}
          valueColor="var(--or2)" label="طلبات معلقة"
          note={pending > 0 ? 'تحتاج مراجعة' : 'لا توجد طلبات'}
        />
        <StatCard
          icon="🆕" iconBg="linear-gradient(135deg,var(--grl),var(--gr3))"
          accentColor="var(--gr)" value={`+${thisMonth}`}
          valueColor="var(--gr2)" label="هذا الشهر"
          note="عضو جديد"
        />
        <StatCard
          icon="💍" iconBg="linear-gradient(135deg,var(--pul),var(--pu3))"
          accentColor="var(--pu)" value={marriages.length.toLocaleString('ar')}
          valueColor="var(--pu2)" label="زيجة مسجلة"
          note={`${marriages.filter(m=>m.is_divorced).length} مطلق/ة`}
        />
      </div>

      {/* ── Row 2 ── */}
      <div className="ov-grid" style={{ marginBottom:16 }}>

        {/* Gender + Status */}
        <div className="card">
          <div className="card-head">
            <span>👥 توزيع الأعضاء</span>
            <button className="btn btn-gh btn-sm" onClick={()=>navigate('/members')}>عرض الكل</button>
          </div>

          {/* Gender visual */}
          <div style={{ display:'flex', gap:10, marginBottom:18 }}>
            <div style={{ flex:males, minWidth:0, background:'linear-gradient(135deg,var(--bll),var(--bl3))', borderRadius:10, padding:'12px 14px', textAlign:'center' }}>
              <div style={{ fontSize:22, marginBottom:4 }}>👦</div>
              <div style={{ fontSize:20, fontWeight:900, color:'var(--bl2)', letterSpacing:-1 }}>{males.toLocaleString('ar')}</div>
              <div style={{ fontSize:11, color:'var(--bl)', fontWeight:600 }}>ذكور</div>
            </div>
            <div style={{ flex:females, minWidth:0, background:'linear-gradient(135deg,var(--pil),#F9D4E8)', borderRadius:10, padding:'12px 14px', textAlign:'center' }}>
              <div style={{ fontSize:22, marginBottom:4 }}>👧</div>
              <div style={{ fontSize:20, fontWeight:900, color:'var(--pi)', letterSpacing:-1 }}>{females.toLocaleString('ar')}</div>
              <div style={{ fontSize:11, color:'var(--pi)', fontWeight:600 }}>إناث</div>
            </div>
            {deceased > 0 && (
              <div style={{ background:'var(--bg2)', borderRadius:10, padding:'12px 14px', textAlign:'center', minWidth:80 }}>
                <div style={{ fontSize:22, marginBottom:4 }}>🕊️</div>
                <div style={{ fontSize:20, fontWeight:900, color:'var(--mu)', letterSpacing:-1 }}>{deceased.toLocaleString('ar')}</div>
                <div style={{ fontSize:11, color:'var(--mu2)', fontWeight:600 }}>متوفى</div>
              </div>
            )}
          </div>

          {/* Status breakdown */}
          <div style={{ borderTop:'1px solid var(--bg2)', paddingTop:14 }}>
            <div style={{ fontSize:11, fontWeight:800, color:'var(--mu)', textTransform:'uppercase', letterSpacing:'.5px', marginBottom:10 }}>حالة الأعضاء</div>
            {[
              { label:'معتمد',  value:approved,                          color:'var(--gr2)', bg:'var(--grl)' },
              { label:'معلق',   value:pending,                           color:'var(--or2)', bg:'var(--orl)' },
              { label:'مرفوض',  value:members.filter(m=>m.status==='rejected').length, color:'var(--rd2)', bg:'var(--rdl)' },
            ].map(s => (
              <div key={s.label} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'6px 0', borderBottom:'1px solid var(--bg2)' }}>
                <span style={{ fontSize:12, color:'var(--tx3)', fontWeight:600 }}>{s.label}</span>
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <div style={{ width:80, height:5, background:'var(--bg2)', borderRadius:4, overflow:'hidden' }}>
                    <div style={{ height:'100%', width:(total?(s.value/total*100):0)+'%', background:s.color, borderRadius:4 }}/>
                  </div>
                  <span style={{ fontSize:12, fontWeight:800, color:s.color, minWidth:30, textAlign:'left' }}>{s.value.toLocaleString('ar')}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Data completeness */}
        <div className="card">
          <div className="card-head">📊 اكتمال البيانات</div>
          <PB icon="📞" label="رقم الجوال"  value={withPhone}  total={total} color="var(--bl)" />
          <PB icon="🏙️" label="المدينة"     value={withCity}   total={total} color="var(--or)" />
          <PB icon="💼" label="الوظيفة"     value={withJob}    total={total} color="var(--gr)" />
          <PB icon="👩" label="ربط الأم"    value={withMom}    total={total} color="var(--pi)" />
          <PB icon="🌿" label="الفرع"       value={withBranch} total={total} color="var(--pu)" />

          {/* Quick actions */}
          <div style={{ borderTop:'1px solid var(--bg2)', paddingTop:14, marginTop:6, display:'flex', gap:8 }}>
            <button className="btn btn-ok btn-sm" style={{ flex:1, justifyContent:'center' }} onClick={()=>navigate('/members/new')}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              إضافة عضو
            </button>
            {pending > 0 && (
              <button className="btn btn-or btn-sm" style={{ flex:1, justifyContent:'center' }} onClick={()=>navigate('/requests')}>
                ⏳ طلبات ({pending})
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Row 3: Cities + Branches ── */}
      <div className="ov-grid">

        {/* Top cities */}
        <div className="card">
          <div className="card-head">🏙️ توزيع المدن</div>
          <div className="city-grid">
            {topCities.map(([city, n], i) => (
              <div key={city} className="city-item">
                <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                  <div style={{ width:20, height:20, borderRadius:6, background:'var(--bll)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:9, fontWeight:800, color:'var(--bl2)' }}>
                    {i+1}
                  </div>
                  <span className="city-name">{city}</span>
                </div>
                <span className="city-num">{n.toLocaleString('ar')}</span>
              </div>
            ))}
          </div>
          {topCities.length === 0 && <div className="empty" style={{ padding:'24px 0' }}><small>لا توجد بيانات مدن</small></div>}
        </div>

        {/* Branches */}
        <div className="card">
          <div className="card-head">🌿 توزيع الفروع</div>
          {branches.length === 0 && <div className="empty" style={{ padding:'24px 0' }}><small>لا توجد بيانات فروع</small></div>}
          {branches.map(([branch, n]) => (
            <div key={branch} style={{ marginBottom:14 }}>
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:5 }}>
                <span style={{ fontSize:13, fontWeight:700 }}>فرع {branch}</span>
                <span style={{ fontSize:13, fontWeight:800, color: branchColors[branch] || 'var(--tx)' }}>
                  {n.toLocaleString('ar')} <span style={{ fontSize:11, fontWeight:500, color:'var(--mu)' }}>({total ? Math.round(n/total*100) : 0}%)</span>
                </span>
              </div>
              <div className="pb-track" style={{ height:9, borderRadius:10 }}>
                <div className="pb-fill" style={{ width:(total?n/total*100:0)+'%', background: branchColors[branch] || 'var(--ac)', borderRadius:10 }} />
              </div>
            </div>
          ))}

          {/* Marriages stats */}
          {marriages.length > 0 && (
            <div style={{ borderTop:'1px solid var(--bg2)', paddingTop:14, marginTop:6 }}>
              <div style={{ fontSize:11, fontWeight:800, color:'var(--mu)', textTransform:'uppercase', letterSpacing:'.5px', marginBottom:10 }}>الزيجات</div>
              <div style={{ display:'flex', gap:8 }}>
                <div style={{ flex:1, background:'var(--pul)', borderRadius:10, padding:'10px 12px', textAlign:'center' }}>
                  <div style={{ fontSize:18, fontWeight:900, color:'var(--pu2)' }}>{marriages.filter(m=>!m.is_divorced).length}</div>
                  <div style={{ fontSize:10, color:'var(--pu)', fontWeight:600 }}>زواج قائم</div>
                </div>
                <div style={{ flex:1, background:'var(--pil)', borderRadius:10, padding:'10px 12px', textAlign:'center' }}>
                  <div style={{ fontSize:18, fontWeight:900, color:'var(--pi)' }}>{marriages.filter(m=>m.is_divorced).length}</div>
                  <div style={{ fontSize:10, color:'var(--pi)', fontWeight:600 }}>مطلق/ة</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── بطاقة الانتماء وأسماء العوائل ── */}
      <div className="card" style={{ marginTop:20 }}>
        <div className="card-head">👥 الانتماء للعائلة</div>
        <div style={{ display:'flex', gap:12, marginBottom:16 }}>
          <div style={{ flex:1, background:'#d1fae5', borderRadius:12, padding:'14px 16px', textAlign:'center' }}>
            <div style={{ fontSize:26, fontWeight:900, color:'#065f46' }}>{wabilMembers.toLocaleString('ar')}</div>
            <div style={{ fontSize:12, color:'#047857', fontWeight:700, marginTop:2 }}>🌿 من عائلة الوابل</div>
            <div style={{ fontSize:11, color:'#6ee7b7', marginTop:2 }}>{total ? Math.round(wabilMembers/total*100) : 0}%</div>
          </div>
          <div style={{ flex:1, background:'#fef3c7', borderRadius:12, padding:'14px 16px', textAlign:'center' }}>
            <div style={{ fontSize:26, fontWeight:900, color:'#92400e' }}>{outsideMembers.toLocaleString('ar')}</div>
            <div style={{ fontSize:12, color:'#b45309', fontWeight:700, marginTop:2 }}>🔗 من خارج العائلة</div>
            <div style={{ fontSize:11, color:'#fcd34d', marginTop:2 }}>{total ? Math.round(outsideMembers/total*100) : 0}%</div>
          </div>
        </div>

        {familyNames.length > 0 && (
          <>
            <div style={{ fontSize:11, fontWeight:800, color:'var(--mu)', textTransform:'uppercase', letterSpacing:'.5px', marginBottom:10 }}>أكثر العوائل تكراراً</div>
            {familyNames.map(([name, n]) => (
              <div key={name} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'7px 0', borderBottom:'1px solid var(--bg2)' }}>
                <span style={{ fontSize:13, fontWeight:700 }}>عائلة {name}</span>
                <span style={{ fontSize:13, fontWeight:800, color:'#92400e', background:'#fef3c7', padding:'2px 10px', borderRadius:20 }}>
                  {n.toLocaleString('ar')} شخص
                </span>
              </div>
            ))}
          </>
        )}
        {familyNames.length === 0 && outsideMembers === 0 && (
          <div style={{ textAlign:'center', color:'var(--mu)', fontSize:13, padding:'10px 0' }}>لم يُحدَّد بعد انتماء أي عضو خارج العائلة</div>
        )}
      </div>

    </div>
  )
}
