// ── Requests Page ────────────────────────────────────
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store'
import { sb, now } from '../lib/supabase'
import { Avatar, AutoComplete, Modal } from '../components/UI'

export function RequestsPage() {
  const { members, updateMember, toast, showLoad, hideLoad } = useStore()
  const navigate = useNavigate()
  const pending = members.filter(m => m.status === 'pending')

  async function approve(m) {
    showLoad('')
    const { error } = await sb.from('members').update({ status:'approved', updated_at:now() }).eq('id', m.id)
    hideLoad()
    if (error) return toast('خطأ: '+error.message,'er')
    updateMember(m.id, { status:'approved' })
    toast(`✅ تم قبول ${m.first_name||m.full_name}`, 'ok')
  }

  async function reject(m) {
    const reason = prompt(`سبب رفض ${m.first_name||m.full_name} (اختياري):`)
    if (reason === null) return
    showLoad('')
    const { error } = await sb.from('members').update({ status:'rejected', notes:reason||null, updated_at:now() }).eq('id', m.id)
    hideLoad()
    if (error) return toast('خطأ: '+error.message,'er')
    updateMember(m.id, { status:'rejected', notes:reason||null })
    toast(`تم رفض ${m.first_name||m.full_name}`, 'inf')
  }

  return (
    <div>
      <div className="sh">
        <span className="sh-t">طلبات التسجيل المعلقة</span>
        <span className="sh-c">{pending.length} طلب</span>
      </div>
      {!pending.length && <div className="empty"><div className="empty-ico">✅</div><div>لا توجد طلبات معلقة</div></div>}
      <div className="m-list">
        {pending.map(m => (
          <div key={m.id} className="card" style={{ marginBottom:10 }}>
            <div style={{ display:'flex', alignItems:'center', gap:12, cursor:'pointer', marginBottom:12 }} onClick={()=>navigate('/members/'+m.id)}>
              <Avatar m={m} size={46} />
              <div style={{ flex:1 }}>
                <div style={{ fontSize:15, fontWeight:800 }}>{m.full_name||m.first_name}</div>
                <div style={{ fontSize:12, color:'var(--mu)' }}>{[m.phone,m.city].filter(Boolean).join(' · ')}</div>
              </div>
            </div>
            <div style={{ display:'flex', gap:8 }}>
              <button className="btn btn-ok" onClick={()=>approve(m)}>✅ قبول</button>
              <button className="btn btn-er" onClick={()=>reject(m)}>❌ رفض</button>
              <button className="btn btn-bl" onClick={()=>navigate('/members/'+m.id)}>👤 الملف</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Marriages Page ───────────────────────────────────
export function MarriagesPage() {
  const { members, marriages, addMarriage, removeMarriage, showConfirm, toast, showLoad, hideLoad } = useStore()
  const nm = id => { const m = members.find(x=>x.id===id); return m?.full_name||m?.first_name||'—' }
  const [q, setQ] = useState('')
  const [dlg, setDlg] = useState(null)

  const filtered = q.trim()
    ? marriages.filter(m => (nm(m.husband_id)+nm(m.wife_id)).toLowerCase().includes(q.toLowerCase()))
    : marriages

  async function saveMar() {
    if (!dlg.hId || !dlg.wId) return toast('اختر الزوج والزوجة','er')
    showLoad('')
    const newMar = { id:crypto.randomUUID(), husband_id:dlg.hId, wife_id:dlg.wId, wife_order:parseInt(dlg.order)||1, is_divorced:dlg.divorced }
    const { error } = await sb.from('marriages').insert(newMar)
    hideLoad()
    if (error) return toast('خطأ: '+error.message,'er')
    addMarriage(newMar)
    setDlg(null)
    toast('✅ تمت الإضافة','ok')
  }

  function del(id) {
    showConfirm('⚠️','حذف الزيجة','حذف هذه الزيجة نهائياً؟', async()=>{
      showLoad('')
      const { error } = await sb.from('marriages').delete().eq('id',id)
      hideLoad()
      if (error) return toast('خطأ: '+error.message,'er')
      removeMarriage(id)
      toast('تم الحذف','inf')
    })
  }

  return (
    <div>
      <div className="sh">
        <span className="sh-t">💍 الزيجات</span>
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          <span className="sh-c">{marriages.length.toLocaleString('ar')} زيجة</span>
          <button className="btn btn-ok" onClick={()=>setDlg({hId:null,hName:'',wId:null,wName:'',order:1,divorced:false})}>+ إضافة زيجة</button>
        </div>
      </div>
      <div className="sbar" style={{ marginBottom:14 }}>
        <div className="s-wrap" style={{ marginBottom:0 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          <input value={q} onChange={e=>setQ(e.target.value)} placeholder="بحث بالاسم..." />
        </div>
      </div>
      <div className="m-list">
        {filtered.map(m => (
          <div key={m.id} className="m-row">
            <div style={{ flex:1 }}>
              <div style={{ fontSize:13, fontWeight:700 }}>👨 {nm(m.husband_id)}</div>
              <div style={{ fontSize:12, color:'var(--mu)', marginTop:2 }}>💍 {nm(m.wife_id)}</div>
            </div>
            <div style={{ display:'flex', gap:7, alignItems:'center' }}>
              <span className={`badge ${m.is_divorced?'b-divorced':'b-approved'}`}>{m.is_divorced?'مطلق':'متزوج'}</span>
              <button className="btn btn-er btn-sm" onClick={()=>del(m.id)}>🗑️</button>
            </div>
          </div>
        ))}
      </div>

      {dlg && (
        <Modal title="💍 إضافة زيجة" onClose={()=>setDlg(null)} sm
          footer={<><button className="btn btn-gh" onClick={()=>setDlg(null)}>إلغاء</button><button className="btn btn-ok" style={{fontWeight:800}} onClick={saveMar}>💍 حفظ</button></>}>
          <AutoComplete label="الزوج" gender="M" value={dlg.hId} displayValue={dlg.hName}
            onChange={(id,name)=>setDlg(p=>({...p,hId:id,hName:name}))} />
          <AutoComplete label="الزوجة" gender="F" value={dlg.wId} displayValue={dlg.wName}
            onChange={(id,name)=>setDlg(p=>({...p,wId:id,wName:name}))} />
          <div className="fr">
            <div className="fg"><label>ترتيب الزوجة</label><input className="fi" type="number" value={dlg.order} onChange={e=>setDlg(p=>({...p,order:e.target.value}))} min="1" max="4" /></div>
            <div className="fg"><label>الحالة</label><select className="fs" value={String(dlg.divorced)} onChange={e=>setDlg(p=>({...p,divorced:e.target.value==='true'}))}><option value="false">متزوج</option><option value="true">مطلق</option></select></div>
          </div>
        </Modal>
      )}
    </div>
  )
}
