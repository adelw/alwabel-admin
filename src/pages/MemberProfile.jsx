import { useState, useMemo, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useStore } from '../store'
import { sb, now } from '../lib/supabase'
import { autoAssignTags, autoAssignTagsForMarriage } from '../lib/autoTags'
import { AutoComplete, Avatar, StatusBadge, RoleBadge, Modal, sLabel, rLabel } from '../components/UI'

const BRANCHES = ['علي','صالح','إبراهيم']

/* ── رحمه/رحمها حسب الجنس ── */
function rahimahu(gender) {
  return gender === 'F' ? 'رحمها الله' : 'رحمه الله'
}

function genFull(firstName, gender, fatherId, members) {
  if (!firstName || !gender || !fatherId) return firstName || ''
  const fa = members.find(m => m.id === fatherId)
  if (!fa) return firstName
  return `${firstName} ${gender==='M'?'بن':'بنت'} ${fa.full_name||fa.first_name}`
}

function Fg({ label, children }) {
  return <div className="fg"><label>{label}</label>{children}</div>
}

function SLabel({ color, children }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:8, fontSize:10, fontWeight:800, color:'var(--mu)', textTransform:'uppercase', letterSpacing:'.65px', marginBottom:11, marginTop:4 }}>
      <span style={{ display:'inline-block', width:3, height:13, borderRadius:2, background:color||'var(--ac)', flexShrink:0 }}/>
      {children}
    </div>
  )
}

function InfoItem({ label, value, ltr }) {
  if (!value && value !== 0) return null
  return (
    <div className="info-row">
      <span className="info-lbl">{label}</span>
      <span className="info-val" style={ltr?{direction:'ltr'}:{}}>{value}</span>
    </div>
  )
}

/* ── زر التحقق ✓ ── */
function VerifyBtn({ memberId }) {
  const { memberById, updateMember, toast } = useStore()
  const [busy, setBusy] = useState(false)
  const m = memberById(memberId)
  if (!m) return null
  const isVer = !!m.is_verified

  async function toggle(e) {
    e.stopPropagation()
    if (busy) return
    setBusy(true)
    const { error } = await sb.from('members').update({ is_verified: !isVer }).eq('id', memberId)
    setBusy(false)
    if (error) return toast('خطأ: ' + error.message, 'er')
    updateMember(memberId, { is_verified: !isVer })
  }

  return (
    <button
      onClick={toggle}
      title={isVer ? 'مؤكد — انقر لإلغاء' : 'غير مؤكد — انقر للتأكيد'}
      style={{
        width: 26, height: 26, borderRadius: 6,
        border: `2px solid ${isVer ? '#22c55e' : '#cbd5e1'}`,
        background: isVer ? '#22c55e' : 'transparent',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: busy ? 'wait' : 'pointer',
        flexShrink: 0, transition: 'all .15s', padding: 0,
      }}
    >
      {busy
        ? <span style={{ fontSize: 9, color: 'var(--mu)' }}>…</span>
        : <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
            stroke={isVer ? '#fff' : '#cbd5e1'} strokeWidth="3"
            strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
      }
    </button>
  )
}

function EditBtn({ onClick }) {
  return (
    <button className="btn btn-bl btn-xs" title="تعديل الملف" onClick={e=>{ e.stopPropagation(); onClick() }}>
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
      </svg>
    </button>
  )
}

function DragHandle() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--mu2)" strokeWidth="2" strokeLinecap="round" style={{ flexShrink:0, cursor:'grab' }}>
      <line x1="8" y1="6"  x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/>
      <line x1="3" y1="6"  x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
    </svg>
  )
}

/* ── Drag-sort list ── */
function DragList({ items, onReorder, renderItem }) {
  const dragIdx = useRef(null)
  const [list, setList] = useState(items)
  useEffect(() => setList(items), [JSON.stringify(items.map(i=>i.id))])

  function onDragStart(i) { dragIdx.current = i }
  function onDragOver(e, i) {
    e.preventDefault()
    if (dragIdx.current === null || dragIdx.current === i) return
    const next = [...list]
    const [moved] = next.splice(dragIdx.current, 1)
    next.splice(i, 0, moved)
    dragIdx.current = i
    setList(next)
  }
  function onDrop() { dragIdx.current = null; onReorder(list) }

  return (
    <div>
      {list.map((item, i) => (
        <div key={item.id} draggable onDragStart={()=>onDragStart(i)} onDragOver={e=>onDragOver(e,i)} onDrop={onDrop} style={{ cursor:'grab', userSelect:'none' }}>
          {renderItem(item, i)}
        </div>
      ))}
    </div>
  )
}

/* ── Edit Modal ── */
function EditModal({ member, onClose, onSave }) {
  const [form, setForm] = useState({ ...member })
  const [fatherName, setFatherName] = useState('')
  const [motherName, setMotherName] = useState('')
  const setF = (k,v) => setForm(p=>({...p,[k]:v}))

  return (
    <div className="overlay" onClick={onClose}>
      <div className="dialog" style={{ maxWidth:600 }} onClick={e=>e.stopPropagation()}>
        <div className="dlg-head">
          <h3>✏️ تعديل بيانات {member.first_name}</h3>
          <button className="dlg-close" onClick={onClose}>✕</button>
        </div>
        <div className="dlg-body">
          <SLabel color="var(--ac)">الاسم والجنس</SLabel>
          <div className="fr">
            <Fg label="الاسم الأول"><input className="fi" value={form.first_name} onChange={e=>setF('first_name',e.target.value)} /></Fg>
            <Fg label="الجنس">
              <select className="fs" value={form.gender||''} onChange={e=>setF('gender',e.target.value)}>
                <option value="">—</option><option value="M">ذكر</option><option value="F">أنثى</option>
              </select>
            </Fg>
          </div>
          <Fg label="الاسم الكامل"><input className="fi" value={form.full_name||''} onChange={e=>setF('full_name',e.target.value)} /></Fg>

          <SLabel color="var(--bl)">الحالة والصلاحية</SLabel>
          <div className="fr c3">
            <Fg label="الفرع">
              <select className="fs" value={form.branch||''} onChange={e=>setF('branch',e.target.value)}>
                <option value="">—</option>{BRANCHES.map(b=><option key={b} value={b}>فرع {b}</option>)}
              </select>
            </Fg>
            <Fg label="الحالة">
              <select className="fs" value={form.status} onChange={e=>setF('status',e.target.value)}>
                <option value="approved">معتمد</option><option value="pending">معلق</option><option value="rejected">مرفوض</option>
              </select>
            </Fg>
            <Fg label="الدور">
              <select className="fs" value={form.role} onChange={e=>setF('role',e.target.value)}>
                <option value="user">مستخدم</option><option value="supervisor">مشرف</option><option value="admin">مدير</option>
              </select>
            </Fg>
          </div>
          <div className="fr">
            <Fg label="الحالة الصحية">
              <select className="fs" value={String(form.is_deceased)} onChange={e=>setF('is_deceased',e.target.value==='true')}>
                <option value="false">حي</option>
                <option value="true">{form.gender==='F'?'متوفاة رحمها الله':'متوفى رحمه الله'}</option>
              </select>
            </Fg>
            <Fg label="ترتيب الولادة"><input className="fi" type="number" value={form.birth_order||''} onChange={e=>setF('birth_order',e.target.value)} min="1" placeholder="1" /></Fg>
          </div>

          <SLabel color="var(--gr)">بيانات التواصل</SLabel>
          <div className="fr">
            <Fg label="رقم الجوال"><input className="fi fi-ltr" value={form.phone||''} onChange={e=>setF('phone',e.target.value)} placeholder="05XXXXXXXX" /></Fg>
            <Fg label="البريد الإلكتروني"><input className="fi fi-ltr" value={form.email||''} onChange={e=>setF('email',e.target.value)} placeholder="name@example.com" /></Fg>
          </div>
          <div className="fr">
            <Fg label="المدينة"><input className="fi" value={form.city||''} onChange={e=>setF('city',e.target.value)} placeholder="الرياض" /></Fg>
            <Fg label="الوظيفة"><input className="fi" value={form.job||''} onChange={e=>setF('job',e.target.value)} placeholder="مهندس..." /></Fg>
          </div>
          <Fg label="تاريخ الميلاد"><input className="fi fi-ltr" style={{ maxWidth:210 }} value={form.birth_date||''} onChange={e=>setF('birth_date',e.target.value)} placeholder="YYYY-MM-DD" /></Fg>

          <SLabel color="var(--or)">الوالدان</SLabel>
          <div className="fr">
            <AutoComplete label="الأب" gender="M" value={form.father_id} displayValue={fatherName} onChange={(fid,fn)=>{ setF('father_id',fid); setFatherName(fn) }} />
            <AutoComplete label="الأم" gender="F" value={form.mother_id} displayValue={motherName} onChange={(mid,mn)=>{ setF('mother_id',mid); setMotherName(mn) }} />
          </div>
          <Fg label="ملاحظات"><textarea className="ft" rows={3} value={form.notes||''} onChange={e=>setF('notes',e.target.value)} placeholder="أي ملاحظات إضافية..." /></Fg>

          {/* ── انتماء العائلة ── */}
          <SLabel color="#7c3aed">الانتماء</SLabel>
          <div style={{ background:'var(--bg2)', borderRadius:10, padding:'12px 14px' }}>
            <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
              {[
                { val:'wabil',   label:'🌿 وابلي',               is_fam:true  },
                { val:'wife',    label:'👩 زوجة من خارج العائلة', is_fam:false, g:'F' },
                { val:'husband', label:'👨 زوج من خارج العائلة',  is_fam:false, g:'M' },
              ].map(opt => {
                const cur = form.is_family_member !== false ? 'wabil' : (form.gender === 'M' ? 'husband' : 'wife')
                const sel = cur === opt.val
                const extractLast = (n) => { if(!n) return ''; const p = n.trim().split(/\s+/); return p.length>1?p[p.length-1]:'' }
                return (
                  <label key={opt.val} style={{ display:'flex', alignItems:'center', gap:6, cursor:'pointer', padding:'7px 12px', borderRadius:20, border: sel?'2px solid var(--ac)':'2px solid var(--bg3)', background: sel?'var(--pul)':'var(--bg)', fontWeight: sel?800:500, fontSize:13, transition:'all .15s', userSelect:'none' }}>
                    <input type="radio" name="edit_member_type" value={opt.val} checked={sel}
                      onChange={() => {
                        const fn = opt.is_fam ? null : extractLast(form.full_name)
                        setF('is_family_member', opt.is_fam)
                        if (opt.g) setF('gender', opt.g)
                        if (!opt.is_fam && fn && !form.family_name) setF('family_name', fn)
                      }}
                      style={{ accentColor:'var(--ac)', cursor:'pointer' }} />
                    {opt.label}
                  </label>
                )
              })}
            </div>
            {form.is_family_member === false && (
              <div style={{ marginTop:10 }}>
                <Fg label="اسم العائلة">
                  <input className="fi" value={form.family_name||''} onChange={e=>setF('family_name',e.target.value)}
                    placeholder="يُستخرج تلقائياً من الاسم الكامل" />
                </Fg>
              </div>
            )}
          </div>
        </div>
        <div className="dlg-foot">
          <button className="btn btn-gh" style={{ padding:'10px 20px' }} onClick={onClose}>إلغاء</button>
          <button className="btn btn-ok" style={{ padding:'10px 26px', fontWeight:800 }} onClick={()=>onSave(form)}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
            حفظ التغييرات
          </button>
        </div>
      </div>
    </div>
  )
}

/* ── New Member Form ── */
function NewMemberForm() {
  const { members, marriages, addMember, toast, showLoad, hideLoad } = useStore()
  const navigate = useNavigate()
  const [f, setF] = useState({ first_name:'', full_name:'', gender:'', branch:'', status:'approved', role:'user', is_deceased:false, phone:'', email:'', city:'', job:'', birth_date:'', birth_order:'', notes:'', father_id:null, father_name:'', mother_id:null, mother_name:'', is_family_member:true, family_name:'' })
  const extractFamilyName = (fullName) => { if (!fullName) return ''; const parts = fullName.trim().split(/\s+/); return parts.length > 1 ? parts[parts.length - 1] : '' }
  const set = (k,v) => setF(p=>{ const n={...p,[k]:v}; if((k==='first_name'||k==='gender'||k==='father_id')&&n.father_id) n.full_name=genFull(n.first_name,n.gender,n.father_id,members); if((k==='full_name'||k==='first_name')&&!n.is_family_member){ const parts=(n.full_name||'').trim().split(/\s+/); n.family_name=parts.length>1?parts[parts.length-1]:'' }; return n })

  async function save(e) {
    e.preventDefault()
    if (!f.first_name) return toast('الاسم الأول مطلوب','er')
    showLoad('جارٍ الإضافة...')
    const id = crypto.randomUUID()
    const branch = f.branch||(f.father_id?members.find(m=>m.id===f.father_id)?.branch:null)||null
    const data = { id, first_name:f.first_name, full_name:f.full_name||f.first_name, gender:f.gender||null, branch, status:f.status, role:f.role, is_deceased:f.is_deceased, phone:f.phone||null, email:f.email||null, city:f.city||null, job:f.job||null, birth_date:f.birth_date||null, birth_order:f.birth_order?parseInt(f.birth_order):null, notes:f.notes||null, father_id:f.father_id||null, mother_id:f.mother_id||null, is_family_member:f.is_family_member, family_name:f.is_family_member ? null : (f.family_name || extractFamilyName(f.full_name) || null), created_at:now(), updated_at:now() }
    const { error } = await sb.from('members').insert(data)
    hideLoad()
    if (error) return toast('خطأ: '+error.message,'er')
    addMember(data)
    // Auto-assign tags based on lineage
    autoAssignTags(id, [...members, data], marriages).catch(() => {})
    toast('✅ تمت الإضافة','ok')
    setTimeout(() => navigate('/members/'+id), 400)
  }

  return (
    <div>
      <button className="back-btn" onClick={()=>navigate('/members')}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="15,18 9,12 15,6"/></svg>
        العودة
      </button>
      <div style={{ maxWidth:680 }}>
        <div className="card">
          <div style={{ display:'flex', alignItems:'center', gap:14, marginBottom:22, paddingBottom:18, borderBottom:'1px solid var(--bg2)' }}>
            <div style={{ width:46, height:46, borderRadius:13, background:'var(--grl)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:21 }}>➕</div>
            <div>
              <div style={{ fontSize:17, fontWeight:900 }}>إضافة عضو جديد</div>
              <div style={{ fontSize:12, color:'var(--mu)', marginTop:2 }}>أدخل بيانات العضو</div>
            </div>
          </div>
          <form onSubmit={save}>
            <div className="fr">
              <Fg label="الاسم الأول *"><input className="fi" value={f.first_name} onChange={e=>set('first_name',e.target.value)} placeholder="محمد" /></Fg>
              <Fg label="الجنس">
                <select className="fs" value={f.gender} onChange={e=>set('gender',e.target.value)}>
                  <option value="">— اختر —</option><option value="M">ذكر</option><option value="F">أنثى</option>
                </select>
              </Fg>
            </div>
            <div className="fr">
              <AutoComplete label="الأب" gender="M" value={f.father_id} displayValue={f.father_name} onChange={(id,name)=>{ set('father_id',id); setF(p=>({...p,father_name:name,father_id:id,full_name:genFull(p.first_name,p.gender,id,members)})) }} />
              <AutoComplete label="الأم" gender="F" value={f.mother_id} displayValue={f.mother_name} onChange={(id,name)=>setF(p=>({...p,mother_id:id,mother_name:name}))} />
            </div>
            <Fg label="الاسم الكامل (تلقائي)"><input className="fi" value={f.full_name} onChange={e=>set('full_name',e.target.value)} placeholder="يتكوّن تلقائياً عند اختيار الأب والجنس" /></Fg>
            <div className="fr">
              <Fg label="رقم الجوال"><input className="fi fi-ltr" value={f.phone} onChange={e=>set('phone',e.target.value)} placeholder="05XXXXXXXX" /></Fg>
              <Fg label="المدينة"><input className="fi" value={f.city} onChange={e=>set('city',e.target.value)} placeholder="الرياض" /></Fg>
            </div>
            <div className="fr">
              <Fg label="الفرع">
                <select className="fs" value={f.branch} onChange={e=>set('branch',e.target.value)}>
                  <option value="">— غير محدد —</option>{BRANCHES.map(b=><option key={b} value={b}>فرع {b}</option>)}
                </select>
              </Fg>
              <Fg label="ترتيب الولادة"><input className="fi" type="number" value={f.birth_order} onChange={e=>set('birth_order',e.target.value)} min="1" placeholder="1" /></Fg>
            </div>
            {/* ── الانتماء ── */}
            <div style={{ background:'var(--bg2)', borderRadius:10, padding:'12px 14px', marginTop:4 }}>
              <div style={{ fontSize:12, fontWeight:700, color:'var(--mu)', marginBottom:8 }}>الانتماء</div>
              <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                {[
                  { val: 'wabil',  label: '🌿 وابلي',              is_fam: true  },
                  { val: 'wife',   label: '👩 زوجة من خارج العائلة', is_fam: false },
                  { val: 'husband',label: '👨 زوج من خارج العائلة',  is_fam: false },
                ].map(opt => {
                  const cur = f.is_family_member ? 'wabil' : (f.gender === 'M' ? 'husband' : 'wife')
                  const sel = cur === opt.val
                  return (
                    <label key={opt.val} style={{ display:'flex', alignItems:'center', gap:6, cursor:'pointer', padding:'7px 12px', borderRadius:20, border: sel ? '2px solid var(--ac)' : '2px solid var(--bg3)', background: sel ? 'var(--pul)' : 'var(--bg)', fontWeight: sel ? 800 : 500, fontSize:13, transition:'all .15s', userSelect:'none' }}>
                      <input type="radio" name="member_type" value={opt.val}
                        checked={sel}
                        onChange={() => {
                          const fn = opt.is_fam ? null : extractFamilyName(f.full_name)
                          set('is_family_member', opt.is_fam)
                          if (opt.val === 'wife')    set('gender', 'F')
                          if (opt.val === 'husband') set('gender', 'M')
                          setF(p => ({ ...p, is_family_member: opt.is_fam, family_name: fn || p.family_name }))
                        }}
                        style={{ accentColor:'var(--ac)', cursor:'pointer' }} />
                      {opt.label}
                    </label>
                  )
                })}
              </div>
              {!f.is_family_member && (
                <div style={{ marginTop:10 }}>
                  <Fg label="اسم العائلة (من الاسم الكامل تلقائياً)">
                    <input className="fi" value={f.family_name} onChange={e=>set('family_name',e.target.value)} placeholder="يُستخرج تلقائياً من الاسم الكامل" />
                  </Fg>
                </div>
              )}
            </div>
            <div style={{ display:'flex', gap:10, marginTop:20, paddingTop:18, borderTop:'1px solid var(--bg2)' }}>
              <button type="submit" className="btn btn-ok" style={{ padding:'11px 28px', fontSize:14, fontWeight:800 }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                إضافة العضو
              </button>
              <button type="button" className="btn btn-gh" style={{ padding:'11px 20px' }} onClick={()=>navigate('/members')}>إلغاء</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

/* ── Quick Edit Modal (نفس الصفحة) ── */
function QuickEditModal({ memberId, onClose, onSaved }) {
  const { memberById, updateMember, toast, showLoad, hideLoad } = useStore()
  const m = memberById(memberId)
  const [form, setForm] = useState({})
  const setF = (k,v) => setForm(p=>({...p,[k]:v}))
  useEffect(() => {
    if (m) {
      const fm = {...m}
      if (fm.is_family_member === false && !fm.family_name && fm.full_name) {
        const parts = fm.full_name.trim().split(/\s+/)
        if (parts.length > 1) fm.family_name = parts[parts.length - 1]
      }
      setForm(fm)
    }
  }, [memberId])
  if (!m) return null

  async function save() {
    showLoad('جارٍ الحفظ...')
    const data = { first_name:form.first_name, full_name:form.full_name, gender:form.gender||null, branch:form.branch||null, status:form.status, role:form.role, is_deceased:form.is_deceased, phone:form.phone||null, city:form.city||null, job:form.job||null, birth_order:form.birth_order?parseInt(form.birth_order):null, notes:form.notes||null, is_family_member:!!form.is_family_member, family_name:form.is_family_member?null:(form.family_name||null), updated_at:now() }
    const { error } = await sb.from('members').update(data).eq('id', memberId)
    hideLoad()
    if (error) return toast('خطأ: '+error.message,'er')
    updateMember(memberId, data)
    toast('✅ تم الحفظ','ok')
    onSaved?.()
    onClose()
  }

  return (
    <div className="overlay" onClick={onClose}>
      <div className="dialog sm" onClick={e=>e.stopPropagation()}>
        <div className="dlg-head">
          <h3>✏️ تعديل سريع — {m.first_name}</h3>
          <button className="dlg-close" onClick={onClose}>✕</button>
        </div>
        <div className="dlg-body">
          <div className="fr">
            <Fg label="الاسم الأول"><input className="fi" value={form.first_name||''} onChange={e=>setF('first_name',e.target.value)} /></Fg>
            <Fg label="الجنس">
              <select className="fs" value={form.gender||''} onChange={e=>setF('gender',e.target.value)}>
                <option value="">—</option><option value="M">ذكر</option><option value="F">أنثى</option>
              </select>
            </Fg>
          </div>
          <Fg label="الاسم الكامل"><input className="fi" value={form.full_name||''} onChange={e=>setF('full_name',e.target.value)} /></Fg>
          <div className="fr">
            <Fg label="الجوال"><input className="fi fi-ltr" value={form.phone||''} onChange={e=>setF('phone',e.target.value)} placeholder="05XXXXXXXX" /></Fg>
            <Fg label="المدينة"><input className="fi" value={form.city||''} onChange={e=>setF('city',e.target.value)} /></Fg>
          </div>
          <div className="fr">
            <Fg label="الوظيفة"><input className="fi" value={form.job||''} onChange={e=>setF('job',e.target.value)} /></Fg>
            <Fg label="ترتيب الولادة"><input className="fi" type="number" value={form.birth_order||''} onChange={e=>setF('birth_order',e.target.value)} min="1" /></Fg>
          </div>
          <div className="fr">
            <Fg label="الحالة">
              <select className="fs" value={form.status||'approved'} onChange={e=>setF('status',e.target.value)}>
                <option value="approved">معتمد</option><option value="pending">معلق</option><option value="rejected">مرفوض</option>
              </select>
            </Fg>
            <Fg label="الحالة الصحية">
              <select className="fs" value={String(form.is_deceased||false)} onChange={e=>setF('is_deceased',e.target.value==='true')}>
                <option value="false">حي</option>
                <option value="true">{form.gender==='F'?'متوفاة رحمها الله':'متوفى رحمه الله'}</option>
              </select>
            </Fg>
          </div>
        </div>
        <div className="dlg-foot">
          <button className="btn btn-gh" onClick={onClose}>إلغاء</button>
          <button className="btn btn-ok" style={{ fontWeight:800 }} onClick={save}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
            حفظ
          </button>
        </div>
      </div>
    </div>
  )
}

function RelCard({ title, icon, count, onAdd, addLabel, children }) {
  return (
    <div className="rel-card">
      <div className="rel-head">
        <div className="rel-head-l">
          <div className="rel-head-icon">{icon}</div>
          {title}
          {count > 0 && <span className="rel-cnt">({count})</span>}
        </div>
        {onAdd && <button className="btn btn-ok btn-sm" onClick={onAdd}>{addLabel||'+ إضافة'}</button>}
      </div>
      {children}
    </div>
  )
}

/* ── Main Profile ── */
// ── اسم مميّز أقصر ما يكفي ──
function smartName(target, pool) {
  if (!target) return ''
  const parts = (target.full_name || target.first_name || '').trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return ''

  // دالة مساعدة لتقسيم الاسم
  const getP = (m) => (m.full_name || m.first_name || '').trim().split(/\s+/).filter(Boolean)
  // باقي الأعضاء في الـ pool (بدون نفس الشخص)
  const others = pool.filter(p => p.id !== target.id)

  // جرّب الاسم الأول فقط
  const first = parts[0]
  const firstDup = others.some(p => getP(p)[0] === first)
  if (!firstDup) return first

  // الاسم الأول مكرر — جرّب الأول + الأخير
  const last = parts[parts.length - 1]
  if (parts.length >= 2) {
    const firstLastDup = others.some(p => {
      const pp = getP(p)
      return pp[0] === first && pp[pp.length - 1] === last
    })
    if (!firstLastDup) return first + ' ' + last
  }

  // الأول + الأخير مكرران — أعطِ ثلاثي
  if (parts.length >= 3) return parts.slice(0, 3).join(' ')

  // كل شيء مكرر — أعطِ الاسم كاملاً
  return parts.join(' ')
}

export default function MemberProfile() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { members, marriages, memberById, updateMember, removeMember, addMember, addMarriage, removeMarriage, updateMarriage, showConfirm, toast, showLoad, hideLoad, loaded } = useStore()

  // ── كل الـ hooks لازم تكون هنا قبل أي return مشروط ──
  const member = id !== 'new' ? memberById(id) : null
  const [edit,      setEdit]     = useState(false)
  const [childQ,    setChildQ]   = useState('')
  const [sibQ,      setSibQ]     = useState('')
  const [marDlg,    setMarDlg]   = useState(null)
  const [childDlg,  setChildDlg] = useState(null)
  const [quickEdit, setQuickEdit] = useState(null)

  // Load tags for display
  const [treeTags, setTreeTags]     = useState([])
  const [memberTags, setMemberTags] = useState([])
  useEffect(() => {
    sb.from('tree_tags').select('*').then(({ data }) => setTreeTags(data || []))
    sb.from('member_tags').select('*').then(({ data }) => setMemberTags(data || []))
  }, [])

  const myMarriages     = useMemo(()=>marriages.filter(m=>m.husband_id===id||m.wife_id===id),[marriages,id])
  const sortedMarriages = useMemo(()=>[...myMarriages].sort((a,b)=>(a.wife_order||1)-(b.wife_order||1)),[myMarriages])
  const children        = useMemo(()=>members.filter(m=>m.father_id===id||m.mother_id===id).sort((a,b)=>(a.birth_order||99)-(b.birth_order||99)),[members,id])
  const siblings        = useMemo(()=>member?.father_id?members.filter(m=>m.father_id===member.father_id&&m.id!==id).sort((a,b)=>(a.birth_order||99)-(b.birth_order||99)):[],[members,member,id])

  if (id === 'new') return <NewMemberForm />

  const nm  = mid => { const m = memberById(mid); return m?.full_name||m?.first_name||'—' }
  const mbr = mid => memberById(mid)

  // لو البيانات لسا تُحمَّل أو العضو أُضيف للتو — انتظر
  if (!member && !loaded) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:200, color:'var(--mu)' }}>
      جارٍ التحميل...
    </div>
  )

  if (!member) return (
    <div>
      <button className="back-btn" onClick={()=>navigate('/members')}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="15,18 9,12 15,6"/></svg>
        العودة
      </button>
      <div className="empty"><div className="empty-ico">❓</div><div>العضو غير موجود</div></div>
    </div>
  )

  async function updateSpouseMembership(spouseId, is_family_member, family_name) {
    const upd = { is_family_member, family_name: is_family_member ? null : (family_name || null), updated_at: now() }
    const { error } = await sb.from('members').update(upd).eq('id', spouseId)
    if (error) return toast('خطأ: ' + error.message, 'er')
    updateMember(spouseId, upd)
    toast('✅ تم التحديث', 'ok')
  }

  // ── Bulk الأبناء ──
  function toggleSelChild(cid, e) { e.stopPropagation(); setSelChildren(p => { const n=new Set(p); n.has(cid)?n.delete(cid):n.add(cid); return n }) }
  function selectAllChildren() { setSelChildren(p => p.size===children.length ? new Set() : new Set(children.map(c=>c.id))) }

  async function bulkDetachMother() {
    if (!selChildren.size) return
    showConfirm('✂️','فصل الأم',`فصل الأم عن ${selChildren.size} ابن؟`, async()=>{
      showLoad('جارٍ الفصل...')
      const ids=[...selChildren]
      const{error}=await sb.from('members').update({mother_id:null,updated_at:now()}).in('id',ids)
      hideLoad(); if(error) return toast('خطأ: '+error.message,'er')
      ids.forEach(id=>updateMember(id,{mother_id:null}))
      setSelChildren(new Set()); toast('✅ تم الفصل','ok')
    })
  }

  async function bulkSetMother() {
    if (!selChildren.size || !bulkMomId) return toast('اختر الأم أولاً','er')
    showConfirm('👩','إضافة أم',`ربط "${bulkMomName}" كأم لـ ${selChildren.size} ابن؟`, async()=>{
      showLoad('جارٍ الربط...')
      const ids=[...selChildren]
      const{error}=await sb.from('members').update({mother_id:bulkMomId,updated_at:now()}).in('id',ids)
      hideLoad(); if(error) return toast('خطأ: '+error.message,'er')
      ids.forEach(id=>updateMember(id,{mother_id:bulkMomId}))
      setSelChildren(new Set()); setBulkMomId(null); setBulkMomName('')
      toast('✅ تم الربط','ok')
    })
  }

  async function save(form) {
    showLoad('جارٍ الحفظ...')
    const data = { first_name:form.first_name, full_name:form.full_name, gender:form.gender||null, branch:form.branch||null, status:form.status, role:form.role, is_deceased:form.is_deceased, phone:form.phone||null, email:form.email||null, city:form.city||null, job:form.job||null, birth_date:form.birth_date||null, birth_order:form.birth_order?parseInt(form.birth_order):null, notes:form.notes||null, father_id:form.father_id||null, mother_id:form.mother_id||null, is_family_member:!!form.is_family_member, family_name:form.is_family_member?null:(form.family_name||null), updated_at:now() }
    const { error } = await sb.from('members').update(data).eq('id',id)
    hideLoad()
    if (error) return toast('خطأ: '+error.message,'er')
    updateMember(id,data); toast('✅ تم الحفظ','ok'); setEdit(false)
    // Auto-assign tags if father/mother changed
    autoAssignTags(id, members, marriages).catch(() => {})
  }

  function del() {
    showConfirm('🗑️',`حذف ${member.first_name||member.full_name}`,`حذف "${member.full_name||member.first_name}" نهائياً؟`,async()=>{
      showLoad('جارٍ الحذف...')
      const { error } = await sb.from('members').delete().eq('id',id)
      hideLoad()
      if (error) return toast('خطأ: '+error.message,'er')
      removeMember(id); toast('تم الحذف','inf'); navigate('/members')
    })
  }

  async function unlink(type) {
    const field = type==='father'?'father_id':'mother_id'
    showConfirm('🔗','فصل الرابط',`فصل "${nm(member[field])}" من ملف "${member.first_name||member.full_name}"؟`,async()=>{
      showLoad('')
      const { error } = await sb.from('members').update({[field]:null,updated_at:now()}).eq('id',id)
      hideLoad()
      if (error) return toast('خطأ: '+error.message,'er')
      updateMember(id,{[field]:null}); toast('✅ تم الفصل','ok')
    })
  }

  async function reorderChildren(newList) {
    await Promise.all(newList.map((c,i) => sb.from('members').update({ birth_order:i+1, updated_at:now() }).eq('id',c.id)))
    newList.forEach((c,i) => updateMember(c.id,{ birth_order:i+1 }))
    toast('✅ تم حفظ الترتيب','ok')
  }

  async function reorderMarriages(newList) {
    await Promise.all(newList.map((m,i) => sb.from('marriages').update({ wife_order:i+1 }).eq('id',m.id)))
    newList.forEach((m,i) => updateMarriage(m.id,{ wife_order:i+1 }))
    toast('✅ تم حفظ الترتيب','ok')
  }

  async function saveMarriage() {
    if (!marDlg.otherId) return toast('اختر العضو الآخر','er')
    const isH = member.gender==='M'
    showLoad('')
    const newMar = { id:crypto.randomUUID(), husband_id:isH?id:marDlg.otherId, wife_id:isH?marDlg.otherId:id, wife_order:parseInt(marDlg.order)||1, is_divorced:marDlg.divorced, is_hidden:false }
    const { error } = await sb.from('marriages').insert(newMar)
    hideLoad()
    if (error) return toast('خطأ: '+error.message,'er')
    addMarriage(newMar); setMarDlg(null); toast('✅ تمت إضافة الزيجة','ok')
    // Auto-assign tags for both spouses
    autoAssignTagsForMarriage(newMar.husband_id, newMar.wife_id, members, [...marriages, newMar]).catch(() => {})
  }

  async function toggleDivorce(marId, cur) {
    showLoad('')
    const updates = { is_divorced:!cur }
    if (!cur) updates.is_hidden = true  // عند تسجيل الطلاق تُخفى تلقائياً
    const { error } = await sb.from('marriages').update(updates).eq('id',marId)
    hideLoad()
    if (error) return toast('خطأ: '+error.message,'er')
    updateMarriage(marId, updates)
    toast(!cur ? 'تم تسجيل الطلاق — مخفية عن العموم تلقائياً' : 'تم إلغاء الطلاق','inf')
  }

  async function toggleHidden(marId, cur) {
    showLoad('')
    const { error } = await sb.from('marriages').update({ is_hidden:!cur }).eq('id',marId)
    hideLoad()
    if (error) return toast('خطأ: '+error.message,'er')
    updateMarriage(marId,{ is_hidden:!cur })
    toast(!cur ? '🔒 مخفية عن العموم' : '👁️ ظاهرة للعموم','inf')
  }

  async function delMarriage(marId) {
    showConfirm('⚠️','حذف الزيجة','حذف هذه الزيجة نهائياً؟',async()=>{
      showLoad('')
      const { error } = await sb.from('marriages').delete().eq('id',marId)
      hideLoad()
      if (error) return toast('خطأ: '+error.message,'er')
      removeMarriage(marId); toast('تم الحذف','inf')
    })
  }

  const [childForm, setChildForm] = useState({ fn:'', gender:'', full:'', motherId:null, motherName:'', order:'' })
  const [selChildren, setSelChildren] = useState(new Set())
  const [bulkMomId,   setBulkMomId]   = useState(null)
  const [bulkMomName, setBulkMomName] = useState('')
  const setCF = (k,v) => setChildForm(p=>{ const n={...p,[k]:v}; if(k==='fn'||k==='gender') n.full=genFull(n.fn,n.gender,id,members); return n })

  async function saveChild() {
    if (!childForm.fn||!childForm.gender) return toast('الاسم والجنس مطلوبان','er')
    const fatherId = member.gender==='M'?id:null
    const motherId = member.gender==='F'?id:(childForm.motherId||null)
    showLoad('جارٍ الإضافة...')
    const cid = crypto.randomUUID()
    const data = { id:cid, first_name:childForm.fn, full_name:childForm.full||childForm.fn, gender:childForm.gender, father_id:fatherId, mother_id:motherId, branch:member.branch||null, birth_order:childForm.order?parseInt(childForm.order):null, status:'approved', role:'user', is_deceased:false, is_family_member:true, created_at:now(), updated_at:now() }
    const { error } = await sb.from('members').insert(data)
    hideLoad()
    if (error) return toast('خطأ: '+error.message,'er')
    addMember(data); setChildDlg(null); setChildForm({ fn:'', gender:'', full:'', motherId:null, motherName:'', order:'' }); toast('✅ تمت الإضافة','ok')
    // Auto-assign tags for the new child
    autoAssignTags(cid, [...members, data], marriages).catch(() => {})
  }

  const filteredChildren = childQ ? children.filter(c=>(c.full_name||c.first_name||'').includes(childQ)) : children
  const filteredSiblings = sibQ   ? siblings.filter(s=>(s.full_name||s.first_name||'').includes(sibQ))   : siblings

  return (
    <div>
      <button className="back-btn" onClick={()=>navigate('/members')}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="15,18 9,12 15,6"/></svg>
        العودة إلى الأعضاء
      </button>

      <div className="profile-grid">
        {/* ── اليسار ── */}
        <div>
          <div className="card">
            <div className="profile-head">
              <div className={`profile-av ${member.gender==='F'?'av-f':'av-m'}`}>
                {member.photo_url?<img src={member.photo_url} alt="" onError={e=>e.target.style.display='none'}/>:(member.is_deceased?'🪦':(member.gender==='F'?'👩':'👨'))}
              </div>
              <div className="profile-name">{member.full_name||member.first_name}</div>
              <div className="profile-badges">
                <StatusBadge status={member.status}/>
                {member.is_deceased && <span className="badge b-deceased">{rahimahu(member.gender)}</span>}
                <RoleBadge role={member.role}/>
                {member.is_family_member === false
                  ? <span style={{ fontSize:11, padding:'2px 8px', borderRadius:20, background:'#fef3c7', color:'#92400e', fontWeight:700, border:'1px solid #fcd34d' }}>
                      🔗 {member.family_name ? `عائلة ${member.family_name}` : 'خارج العائلة'}
                    </span>
                  : <span style={{ fontSize:11, padding:'2px 8px', borderRadius:20, background:'#d1fae5', color:'#065f46', fontWeight:700, border:'1px solid #6ee7b7' }}>
                      🌿 وابلي
                    </span>
                }
                {/* Tags */}
                {memberTags.filter(mt => mt.member_id === id).map(mt => {
                  const tag = treeTags.find(t => t.id === mt.tag_id)
                  if (!tag) return null
                  return (
                    <span key={mt.id} style={{
                      fontSize: 11, fontWeight: 700, padding: '2px 10px', borderRadius: 20,
                      background: (tag.color || '#2563eb') + '18',
                      color: tag.color || '#2563eb',
                      border: `1px solid ${(tag.color || '#2563eb')}40`,
                    }}>🏷️ {tag.name}</span>
                  )
                })}
              </div>
              <div className="profile-btns">
                <VerifyBtn memberId={id} />
                <button className="btn btn-bl" onClick={()=>setEdit(true)}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                  </svg>
                  تعديل
                </button>
                <button className="btn btn-er" onClick={del}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M9 6V4h6v2"/>
                  </svg>
                  حذف
                </button>
              </div>
            </div>
            <InfoItem label="الجوال"        value={member.phone}       ltr />
            <InfoItem label="البريد"         value={member.email}       ltr />
            <InfoItem label="المدينة"        value={member.city} />
            <InfoItem label="الوظيفة"        value={member.job} />
            <InfoItem label="الفرع"          value={member.branch?`فرع ${member.branch}`:null} />
            <InfoItem label="تاريخ الميلاد"  value={member.birth_date}  ltr />
            <InfoItem label="ترتيب الولادة"  value={member.birth_order} />
            <InfoItem label="ملاحظات"        value={member.notes} />
          </div>
        </div>

        {/* ── اليمين ── */}
        <div>

          {/* الأب */}
          <RelCard title="الأب" icon="👴" onAdd={()=>setEdit(true)} addLabel="ربط / تغيير">
            {member.father_id ? (
              <div className="rel-item">
                <div className="rel-av av-m" onClick={()=>navigate('/members/'+member.father_id)}>
                  {mbr(member.father_id)?.is_deceased ? '🪦' : '👨'}
                </div>
                <div className="rel-info" onClick={()=>navigate('/members/'+member.father_id)}>
                  <div className="rel-nm">{nm(member.father_id)}</div>
                  <div className="rel-sub">
                    {mbr(member.father_id)?.is_deceased
                      ? <span style={{ color:'var(--mu)', fontSize:11 }}>{rahimahu(mbr(member.father_id)?.gender)}</span>
                      : mbr(member.father_id)?.city||''}
                  </div>
                </div>
                <div className="rel-acts">
                  <VerifyBtn memberId={member.father_id} />
                  <EditBtn onClick={()=>setQuickEdit(member.father_id)} />
                  <button className="btn btn-er btn-xs" onClick={()=>unlink('father')}>فصل</button>
                </div>
              </div>
            ) : <div className="empty" style={{ padding:'12px 0' }}><small style={{ color:'var(--mu2)' }}>غير محدد</small></div>}
          </RelCard>

          {/* الأم */}
          <RelCard title="الأم" icon="👩" onAdd={()=>setEdit(true)} addLabel="ربط / تغيير">
            {member.mother_id ? (
              <div className="rel-item">
                <div className="rel-av av-f" onClick={()=>navigate('/members/'+member.mother_id)}>
                  {mbr(member.mother_id)?.is_deceased ? '🪦' : '👩'}
                </div>
                <div className="rel-info" onClick={()=>navigate('/members/'+member.mother_id)}>
                  <div className="rel-nm">{nm(member.mother_id)}</div>
                  <div className="rel-sub">
                    {mbr(member.mother_id)?.is_deceased
                      ? <span style={{ color:'var(--mu)', fontSize:11 }}>{rahimahu(mbr(member.mother_id)?.gender)}</span>
                      : mbr(member.mother_id)?.city||''}
                  </div>
                </div>
                <div className="rel-acts">
                  <VerifyBtn memberId={member.mother_id} />
                  <EditBtn onClick={()=>setQuickEdit(member.mother_id)} />
                  <button className="btn btn-er btn-xs" onClick={()=>unlink('mother')}>فصل</button>
                </div>
              </div>
            ) : <div className="empty" style={{ padding:'12px 0' }}><small style={{ color:'var(--mu2)' }}>غير محدد</small></div>}
          </RelCard>

          {/* الزيجات — سحب للترتيب */}
          <RelCard title="الزيجات" icon="💍" count={myMarriages.length} onAdd={()=>setMarDlg({otherId:null,otherName:'',order:1,divorced:false})} addLabel="+ إضافة">
            {!myMarriages.length && <div className="empty" style={{ padding:'12px 0' }}><small style={{ color:'var(--mu2)' }}>لا توجد زيجات</small></div>}
            {myMarriages.length > 1 && (
              <div style={{ fontSize:10, color:'var(--mu2)', marginBottom:6, display:'flex', alignItems:'center', gap:4 }}>
                <DragHandle/> اسحب لتغيير الترتيب
              </div>
            )}
            <DragList
              items={sortedMarriages}
              onReorder={reorderMarriages}
              renderItem={(mar) => {
                const spouseId = member.gender==='M' ? mar.wife_id : mar.husband_id
                const spouse   = mbr(spouseId)
                return (
                  <div className="rel-item" style={{ borderRight: mar.is_hidden ? '3px solid var(--mu3)' : 'none', opacity: mar.is_hidden ? .8 : 1 }}>
                    <DragHandle/>
                    <div className={`rel-av ${member.gender==='M'?'av-f':'av-m'}`}>
                      {spouse?.is_deceased ? '🪦' : (member.gender==='M'?'👩':'👨')}
                    </div>
                    <div className="rel-info">
                      <div className="rel-nm" onClick={()=>navigate('/members/'+spouseId)} style={{cursor:'pointer'}}>
                        {nm(spouseId)}
                        {mar.is_hidden && <span style={{ fontSize:9, color:'var(--mu2)', marginRight:5, border:'1px solid var(--mu3)', borderRadius:4, padding:'1px 5px' }}>مخفية</span>}
                      </div>
                      <div className="rel-sub" style={{ display:'flex', alignItems:'center', gap:6, flexWrap:'wrap' }}>
                        {spouse?.is_deceased
                          ? <span style={{ color:'var(--mu)', fontSize:11 }}>{rahimahu(spouse?.gender)}</span>
                          : mar.is_divorced
                            ? <span className="badge b-divorced" style={{ fontSize:9 }}>مطلق/ة</span>
                            : <span style={{ fontSize:11, color:'var(--gr)', fontWeight:700 }}>متزوج/ة ✓</span>
                        }
                        {/* ── خيار الانتماء مباشرة ── */}
                        {!spouse?.is_deceased && (() => {
                          const isFam = spouse?.is_family_member !== false
                          const famName = spouse?.family_name || (() => {
                            const parts = (spouse?.full_name||'').trim().split(/\s+/)
                            return parts.length > 1 ? parts[parts.length-1] : ''
                          })()
                          return (
                            <span style={{ display:'flex', alignItems:'center', gap:4 }} onClick={e=>e.stopPropagation()}>
                              {[
                                { val:'wabil',   emoji:'🌿', tip:'وابلي',               fam:true  },
                                { val:'outside', emoji:'🔗', tip:'من خارج العائلة',      fam:false },
                              ].map(opt => (
                                <button key={opt.val}
                                  title={opt.tip}
                                  onClick={() => {
                                    const fn = opt.fam ? null : famName
                                    updateSpouseMembership(spouseId, opt.fam, fn)
                                  }}
                                  style={{
                                    border: 'none', cursor:'pointer', padding:'2px 7px', borderRadius:12, fontSize:11, fontWeight:700, transition:'all .15s',
                                    background: (isFam === opt.fam) ? (opt.fam ? '#d1fae5' : '#fef3c7') : 'var(--bg2)',
                                    color:      (isFam === opt.fam) ? (opt.fam ? '#065f46' : '#92400e') : 'var(--mu)',
                                    outline:    (isFam === opt.fam) ? (opt.fam ? '2px solid #6ee7b7' : '2px solid #fcd34d') : 'none',
                                  }}>
                                  {opt.emoji} {opt.tip}
                                </button>
                              ))}
                              {!isFam && (
                                <input
                                  value={famName}
                                  placeholder="اسم العائلة"
                                  onChange={e => {
                                    const newName = e.target.value
                                    updateMember(spouseId, { family_name: newName })
                                  }}
                                  onBlur={e => updateSpouseMembership(spouseId, false, e.target.value)}
                                  onClick={e => e.stopPropagation()}
                                  style={{ fontSize:11, padding:'2px 7px', borderRadius:8, border:'1px solid var(--bg3)', background:'var(--bg)', width:90, outline:'none' }}
                                />
                              )}
                            </span>
                          )
                        })()}
                      </div>
                    </div>
                    <div className="rel-acts">
                      <VerifyBtn memberId={spouseId} />
                      <EditBtn onClick={()=>setQuickEdit(spouseId)} />
                      <button className="btn btn-or btn-xs" onClick={()=>{ showConfirm('🔗','فصل الزيجة',`فصل "${nm(spouseId)}"؟`,async()=>{ showLoad(''); const{error}=await sb.from('marriages').delete().eq('id',mar.id); hideLoad(); if(error) return toast('خطأ: '+error.message,'er'); removeMarriage(mar.id); toast('✅ تم الفصل','ok') }) }}>فصل</button>
                      {mar.is_divorced && (
                        <button
                          className={`btn btn-xs ${mar.is_hidden ? 'btn-ok' : 'btn-gh'}`}
                          title={mar.is_hidden ? 'إظهار للعموم' : 'إخفاء عن العموم'}
                          onClick={()=>toggleHidden(mar.id, mar.is_hidden)}
                        >
                          {mar.is_hidden
                            ? <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                            : <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                          }
                        </button>
                      )}
                      {mar.is_divorced
                        ? <button className="btn btn-ok btn-xs" onClick={()=>toggleDivorce(mar.id,true)}>إلغاء الطلاق</button>
                        : <button className="btn btn-or btn-xs" onClick={()=>toggleDivorce(mar.id,false)}>تسجيل طلاق</button>}
                      <button className="btn btn-er btn-xs" onClick={()=>delMarriage(mar.id)}>
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg>
                      </button>
                    </div>
                  </div>
                )
              }}
            />
          </RelCard>

          {/* الأبناء — سحب للترتيب + تفاصيل + bulk */}
          <RelCard title="الأبناء" icon="👶" count={children.length} onAdd={()=>setChildDlg(true)} addLabel="+ إضافة">
            {/* شريط الأدوات */}
            <div style={{ display:'flex', gap:8, marginBottom:8, flexWrap:'wrap', alignItems:'center' }}>
              {children.length > 3 && (
                <div className="rel-search" style={{ flex:1, minWidth:140 }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
                  <input value={childQ} onChange={e=>setChildQ(e.target.value)} placeholder="بحث في الأبناء..." />
                </div>
              )}
              {children.length > 0 && (
                <button className="btn btn-gh" style={{ fontSize:10, padding:'3px 9px' }} onClick={e=>{e.stopPropagation();selectAllChildren()}}>
                  {selChildren.size===children.length?'☑ إلغاء الكل':'☐ تحديد الكل'}
                </button>
              )}
            </div>

            {/* شريط Bulk Actions */}
            {selChildren.size > 0 && (() => {
              // زوجات الأب من الزيجات المسجلة
              const wivesOfFather = member.gender === 'M'
                ? (marriages||[]).filter(m=>m.husband_id===member.id).map(m=>{
                    const w=members.find(x=>x.id===m.wife_id)
                    return w?{id:w.id, name:w.first_name||w.full_name}:null
                  }).filter(Boolean)
                : []
              return (
                <div style={{ padding:'10px 12px', background:'#eff6ff', border:'1px solid #bfdbfe', borderRadius:10, marginBottom:10 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap', marginBottom: wivesOfFather.length>0?8:0 }}>
                    <span style={{ fontWeight:800, fontSize:12, color:'#1d4ed8' }}>✓ {selChildren.size} محدد</span>
                    <button className="btn btn-gh" style={{ fontSize:10, padding:'3px 9px' }} onClick={()=>setSelChildren(new Set())}>إلغاء التحديد</button>
                    <button className="btn btn-or" style={{ fontSize:11, padding:'4px 12px' }} onClick={bulkDetachMother}>✂️ فصل الأم</button>
                  </div>
                  {wivesOfFather.length > 0 && (
                    <div style={{ display:'flex', gap:6, flexWrap:'wrap', alignItems:'center' }}>
                      <span style={{ fontSize:11, color:'var(--mu)', fontWeight:600 }}>نقل إلى أم:</span>
                      {wivesOfFather.map(w => {
                        const wMember = members.find(x=>x.id===w.id)
                        const wPool = wivesOfFather.map(wf=>members.find(x=>x.id===wf.id)).filter(Boolean)
                        const wDisplay = wMember ? smartName(wMember, wPool) : w.name
                        return (
                        <button key={w.id}
                          onClick={()=>{ setBulkMomId(w.id); setBulkMomName(wDisplay); }}
                          style={{
                            fontSize:11, padding:'4px 12px', borderRadius:20, cursor:'pointer', border:'2px solid',
                            fontWeight:700, transition:'all .15s',
                            background: bulkMomId===w.id ? '#fce7f3' : 'var(--bg)',
                            color:      bulkMomId===w.id ? '#9d174d'  : 'var(--mu)',
                            borderColor:bulkMomId===w.id ? '#f9a8d4'  : '#e2e8f0',
                          }}>
                          👩 {wDisplay}
                        </button>
                        )
                      })}
                      {bulkMomId && (
                        <button className="btn btn-ok" style={{ fontSize:11, padding:'4px 14px', fontWeight:800 }} onClick={bulkSetMother}>
                          ✓ تأكيد النقل إلى {bulkMomName}
                        </button>
                      )}
                      {!bulkMomId && (
                        <div style={{ minWidth:160 }}>
                          <AutoComplete label="" gender="F" value={bulkMomId} displayValue={bulkMomName}
                            onChange={(mid,mn)=>{setBulkMomId(mid);setBulkMomName(mn)}} />
                        </div>
                      )}
                    </div>
                  )}
                  {wivesOfFather.length === 0 && (
                    <div style={{ display:'flex', gap:8, flexWrap:'wrap', alignItems:'center' }}>
                      <span style={{ fontSize:11, color:'var(--mu)' }}>اختر الأم:</span>
                      <div style={{ minWidth:180 }}>
                        <AutoComplete label="" gender="F" value={bulkMomId} displayValue={bulkMomName}
                          onChange={(mid,mn)=>{setBulkMomId(mid);setBulkMomName(mn)}} />
                      </div>
                      {bulkMomId && (
                        <button className="btn btn-ok" style={{ fontSize:11, padding:'4px 12px' }} onClick={bulkSetMother}>👩 تأكيد</button>
                      )}
                    </div>
                  )}
                </div>
              )
            })()}

            {!children.length && <div className="empty" style={{ padding:'12px 0' }}><small style={{ color:'var(--mu2)' }}>لا يوجد أبناء</small></div>}
            {children.length > 1 && (
              <div style={{ fontSize:10, color:'var(--mu2)', marginBottom:6, display:'flex', alignItems:'center', gap:4 }}>
                <DragHandle/> اسحب لتغيير الترتيب
              </div>
            )}
            <DragList
              items={filteredChildren}
              onReorder={reorderChildren}
              renderItem={(c, i) => {
                const cSpouses = marriages
                  ? marriages.filter(m=>m.husband_id===c.id||m.wife_id===c.id).map(m=>{
                      const sid=c.gender==='M'?m.wife_id:m.husband_id
                      const sp=members.find(x=>x.id===sid)
                      return sp?{name:sp.first_name||sp.full_name,divorced:m.is_divorced}:null
                    }).filter(Boolean)
                  : []
                const cMother = c.mother_id ? members.find(x=>x.id===c.mother_id) : null
                const cChildren = members.filter(x=>x.father_id===c.id||x.mother_id===c.id)
                const isSel = selChildren.has(c.id)
                // لون تمييز حسب الأم
                const motherColors = ['#f9a8d4','#86efac','#93c5fd','#fcd34d','#c4b5fd','#fdba74']
                const wivesIds = member.gender==='M' ? (marriages||[]).filter(m=>m.husband_id===member.id).map(m=>m.wife_id) : []
                const motherColorIdx = c.mother_id ? wivesIds.indexOf(c.mother_id) : -1
                const motherBorderColor = motherColorIdx>=0 ? motherColors[motherColorIdx%motherColors.length] : 'transparent'
                return (
                  <div className="rel-item" style={{ background:isSel?'#eff6ff':undefined, borderRadius:8, flexWrap:'wrap', gap:4, borderRight:`3px solid ${isSel?'var(--ac)':motherBorderColor}` }}>
                    {/* Checkbox */}
                    <div onClick={e=>toggleSelChild(c.id,e)} style={{ cursor:'pointer', flexShrink:0 }}>
                      <div style={{ width:16,height:16,borderRadius:3,border:`2px solid ${isSel?'var(--ac)':'#cbd5e1'}`,background:isSel?'var(--ac)':'transparent',display:'flex',alignItems:'center',justifyContent:'center',transition:'all .15s' }}>
                        {isSel&&<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>}
                      </div>
                    </div>
                    <DragHandle/>
                    <div style={{ width:22,height:22,borderRadius:6,background:'var(--bg2)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:10,fontWeight:800,color:'var(--mu)',flexShrink:0 }}>
                      {c.birth_order||i+1}
                    </div>
                    <div className={`rel-av ${c.gender==='F'?'av-f':'av-m'}`}>
                      {c.is_deceased?'🪦':(c.gender==='F'?'👧':'👦')}
                    </div>
                    {/* المعلومات التفصيلية */}
                    <div className="rel-info" style={{ flex:1 }} onClick={()=>navigate('/members/'+c.id)}>
                      <div className="rel-nm">{c.full_name||c.first_name}</div>

                      {/* سطر 1: الأم + الزوج/ة + حالة الوفاة */}
                      {(cMother || cSpouses.length > 0 || c.is_deceased) && (
                        <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginTop:2 }}>
                          {/* الأم — smartName لتمييز المتشابهات */}
                          {cMother && (() => {
                            // pool = كل الأمهات الفريدات لأبناء هذا الأب
                            const momsPool = [...new Map(
                              children.map(ch => ch.mother_id ? members.find(x=>x.id===ch.mother_id) : null)
                                .filter(Boolean)
                                .map(m => [m.id, m])
                            ).values()]
                            return (
                              <span style={{ fontSize:11, color:'#be185d', fontWeight:600 }}>
                                👩 {smartName(cMother, momsPool)}
                              </span>
                            )
                          })()}
                          {/* الزوج/ة */}
                          {cSpouses.map((sp,si)=>(
                            <span key={si} style={{ fontSize:11, color:sp.divorced?'var(--mu)':'#7c3aed', fontWeight:600 }}>
                              {c.gender==='M'?'👩':'👨'} {sp.name}
                              {sp.divorced&&<small style={{ fontSize:9, marginRight:2, color:'var(--mu)' }}>مطلق/ة</small>}
                            </span>
                          ))}
                          {c.is_deceased&&<span style={{ fontSize:11, color:'var(--mu)' }}>{rahimahu(c.gender)}</span>}
                        </div>
                      )}

                      {/* سطر 2: الهاتف + المدينة + الوظيفة */}
                      {(c.phone||c.city||c.job) && (
                        <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginTop:2 }}>
                          {c.phone&&<span style={{ fontSize:11, color:'var(--mu2)', direction:'ltr', display:'inline-block' }}>📞 {c.phone}</span>}
                          {c.city&&<span style={{ fontSize:11, color:'var(--mu2)' }}>📍 {c.city}</span>}
                          {c.job&&<span style={{ fontSize:11, color:'var(--mu2)' }}>💼 {c.job}</span>}
                        </div>
                      )}

                      {/* سطر 3: أبناء الابن كـ chips */}
                      {cChildren.length>0 && (
                        <div style={{ display:'flex', flexWrap:'wrap', gap:4, marginTop:3 }}>
                          {cChildren.slice(0,6).map(gc=>(
                            <span key={gc.id}
                              onClick={e=>{e.stopPropagation();navigate('/members/'+gc.id)}}
                              style={{ fontSize:10, padding:'1px 7px', borderRadius:20, cursor:'pointer', fontWeight:600,
                                background:gc.gender==='F'?'#fce7f3':'#dbeafe',
                                color:gc.gender==='F'?'#9d174d':'#1e40af',
                                border:'1px solid', borderColor:gc.gender==='F'?'#fbcfe8':'#bfdbfe' }}>
                              {gc.gender==='F'?'👧':'👦'} {gc.first_name||(gc.full_name||'').split(' ')[0]}
                            </span>
                          ))}
                          {cChildren.length>6&&(
                            <span style={{ fontSize:10, color:'var(--mu)', padding:'1px 5px' }}>+{cChildren.length-6}</span>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="rel-acts">
                      <VerifyBtn memberId={c.id} />
                      <button className="btn btn-bl btn-xs" title="تعديل سريع" onClick={e=>{ e.stopPropagation(); setQuickEdit(c.id) }}>
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                        </svg>
                      </button>
                      <button className="btn btn-or btn-xs" title="فصل" onClick={e=>{ e.stopPropagation(); showConfirm('🔗','فصل الابن',`فصل "${c.full_name||c.first_name}"؟`,async()=>{ showLoad(''); const field=member.gender==='M'?'father_id':'mother_id'; const{error}=await sb.from('members').update({[field]:null,updated_at:now()}).eq('id',c.id); hideLoad(); if(error) return toast('خطأ: '+error.message,'er'); updateMember(c.id,{[field]:null}); toast('✅ تم الفصل','ok') }) }}>فصل</button>
                      <button className="btn btn-er btn-xs" title="حذف" onClick={e=>{ e.stopPropagation(); showConfirm('🗑️',`حذف ${c.first_name||c.full_name}`,`حذف "${c.full_name||c.first_name}" نهائياً؟`,async()=>{ showLoad(''); const{error}=await sb.from('members').delete().eq('id',c.id); hideLoad(); if(error) return toast('خطأ: '+error.message,'er'); removeMember(c.id); toast('تم الحذف','inf') }) }}>
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg>
                      </button>
                    </div>
                  </div>
                )
              }}
            />
          </RelCard>

          {/* الإخوة — سحب + تعديل سريع */}
          {siblings.length > 0 && (
            <RelCard title="الإخوة والأخوات" icon="👥" count={siblings.length}>
              {siblings.length > 3 && (
                <div className="rel-search">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
                  <input value={sibQ} onChange={e=>setSibQ(e.target.value)} placeholder="بحث في الإخوة..." />
                </div>
              )}
              {siblings.length > 1 && (
                <div style={{ fontSize:10, color:'var(--mu2)', marginBottom:6, display:'flex', alignItems:'center', gap:4 }}>
                  <DragHandle/> اسحب لتغيير الترتيب
                </div>
              )}
              <DragList
                items={filteredSiblings.slice(0,20)}
                onReorder={async (newList) => {
                  await Promise.all(newList.map((s,i) => sb.from('members').update({ birth_order:i+1, updated_at:now() }).eq('id',s.id)))
                  newList.forEach((s,i) => updateMember(s.id,{ birth_order:i+1 }))
                  toast('✅ تم حفظ الترتيب','ok')
                }}
                renderItem={(s, i) => (
                  <div className="rel-item">
                    <DragHandle/>
                    <div style={{ width:22, height:22, borderRadius:6, background:'var(--bg2)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:800, color:'var(--mu)', flexShrink:0 }}>
                      {s.birth_order||i+1}
                    </div>
                    <div className={`rel-av ${s.gender==='F'?'av-f':'av-m'}`} onClick={()=>navigate('/members/'+s.id)}>
                      {s.is_deceased ? '🪦' : (s.gender==='F'?'👧':'👦')}
                    </div>
                    <div className="rel-info" onClick={()=>navigate('/members/'+s.id)}>
                      <div className="rel-nm">{s.full_name||s.first_name}</div>
                      <div className="rel-sub">
                        {s.is_deceased
                          ? <span style={{ color:'var(--mu)', fontSize:11 }}>{rahimahu(s.gender)}</span>
                          : s.city||''}
                      </div>
                    </div>
                    <div className="rel-acts">
                      <VerifyBtn memberId={s.id} />
                      <button className="btn btn-bl btn-xs" title="تعديل سريع" onClick={e=>{ e.stopPropagation(); setQuickEdit(s.id) }}>
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                        </svg>
                      </button>
                    </div>
                  </div>
                )}
              />
              {siblings.length > 20 && <div style={{ fontSize:12, color:'var(--mu)', padding:'8px 0', textAlign:'center', fontWeight:600 }}>و {siblings.length-20} آخرين...</div>}
            </RelCard>
          )}

        </div>
      </div>

      {quickEdit && <QuickEditModal memberId={quickEdit} onClose={()=>setQuickEdit(null)} />}

      {edit && <EditModal member={member} onClose={()=>setEdit(false)} onSave={save}/>}

      {marDlg && (
        <Modal title="💍 إضافة زيجة" onClose={()=>setMarDlg(null)} sm
          footer={<><button className="btn btn-gh" onClick={()=>setMarDlg(null)}>إلغاء</button><button className="btn btn-ok" style={{ fontWeight:800 }} onClick={saveMarriage}>💍 حفظ</button></>}>
          <AutoComplete label={`الطرف الآخر (${member.gender==='M'?'الزوجة':'الزوج'})`} gender={member.gender==='M'?'F':'M'} value={marDlg.otherId} displayValue={marDlg.otherName} onChange={(id,name)=>setMarDlg(p=>({...p,otherId:id,otherName:name}))} />
          <div className="fr">
            <Fg label="الترتيب"><input className="fi" type="number" value={marDlg.order} onChange={e=>setMarDlg(p=>({...p,order:e.target.value}))} min="1" max="4" /></Fg>
            <Fg label="الحالة"><select className="fs" value={String(marDlg.divorced)} onChange={e=>setMarDlg(p=>({...p,divorced:e.target.value==='true'}))}><option value="false">متزوج/ة</option><option value="true">مطلق/ة</option></select></Fg>
          </div>
        </Modal>
      )}

      {childDlg && (
        <Modal title="👶 إضافة ابن / بنت" onClose={()=>setChildDlg(null)} sm
          footer={<><button className="btn btn-gh" onClick={()=>setChildDlg(null)}>إلغاء</button><button className="btn btn-pu" style={{ fontWeight:800 }} onClick={saveChild}>👶 إضافة</button></>}>
          <div className="fr">
            <Fg label="الاسم الأول *"><input className="fi" value={childForm.fn} onChange={e=>setCF('fn',e.target.value)} /></Fg>
            <Fg label="الجنس *"><select className="fs" value={childForm.gender} onChange={e=>setCF('gender',e.target.value)}><option value="">—</option><option value="M">ذكر</option><option value="F">أنثى</option></select></Fg>
          </div>
          <Fg label="الاسم الكامل (تلقائي)"><input className="fi" value={childForm.full} onChange={e=>setChildForm(p=>({...p,full:e.target.value}))} /></Fg>
          {member.gender==='M' && <AutoComplete label="الأم" gender="F" value={childForm.motherId} displayValue={childForm.motherName} onChange={(mid,mn)=>setChildForm(p=>({...p,motherId:mid,motherName:mn}))} />}
          <Fg label="ترتيب الولادة"><input className="fi" type="number" value={childForm.order} onChange={e=>setChildForm(p=>({...p,order:e.target.value}))} min="1" placeholder="1" /></Fg>
        </Modal>
      )}

    </div>
  )
}
