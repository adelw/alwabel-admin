// ── Marriages Page ───────────────────────────────────
import { useState } from 'react'
import { useStore } from '../store'
import { sb } from '../lib/supabase'
import { AutoComplete, Modal } from '../components/UI'

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
              <span className={`badge ${m.is_divorced?'b-divorced':'b-approved'}`}>{m.is_divorced?'مطلقة':'قائمة'}</span>
              <span style={{ fontSize:11, color:'var(--mu)' }}>ترتيب: {m.wife_order||1}</span>
              <button className="btn btn-er btn-xs" onClick={()=>del(m.id)}>🗑️</button>
            </div>
          </div>
        ))}
      </div>

      {dlg && (
        <Modal onClose={()=>setDlg(null)} title="إضافة زيجة">
          <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
            <div>
              <label style={{ fontSize:12, fontWeight:600, marginBottom:4, display:'block' }}>الزوج</label>
              <AutoComplete
                members={members.filter(m=>m.gender==='M')}
                value={dlg.hName}
                onSelect={m=>setDlg(p=>({...p,hId:m.id,hName:m.full_name||m.first_name}))}
                onChange={v=>setDlg(p=>({...p,hName:v,hId:null}))}
                placeholder="ابحث عن الزوج..."
              />
            </div>
            <div>
              <label style={{ fontSize:12, fontWeight:600, marginBottom:4, display:'block' }}>الزوجة</label>
              <AutoComplete
                members={members.filter(m=>m.gender==='F')}
                value={dlg.wName}
                onSelect={m=>setDlg(p=>({...p,wId:m.id,wName:m.full_name||m.first_name}))}
                onChange={v=>setDlg(p=>({...p,wName:v,wId:null}))}
                placeholder="ابحث عن الزوجة..."
              />
            </div>
            <div style={{ display:'flex', gap:12 }}>
              <div style={{ flex:1 }}>
                <label style={{ fontSize:12, fontWeight:600, marginBottom:4, display:'block' }}>ترتيب الزوجة</label>
                <input type="number" min="1" max="4" value={dlg.order} onChange={e=>setDlg(p=>({...p,order:e.target.value}))} style={{ width:'100%', padding:'8px 12px', borderRadius:10, border:'1.5px solid var(--br)', fontSize:13, fontFamily:'inherit' }} />
              </div>
              <div style={{ flex:1, display:'flex', alignItems:'end' }}>
                <label style={{ display:'flex', alignItems:'center', gap:8, fontSize:12, fontWeight:600, cursor:'pointer' }}>
                  <input type="checkbox" checked={dlg.divorced} onChange={e=>setDlg(p=>({...p,divorced:e.target.checked}))} />
                  مطلقة
                </label>
              </div>
            </div>
            <button className="btn btn-ok" style={{ width:'100%', justifyContent:'center', marginTop:6 }} onClick={saveMar}>💾 حفظ الزيجة</button>
          </div>
        </Modal>
      )}
    </div>
  )
}
