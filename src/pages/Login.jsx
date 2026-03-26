import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { sb, fmtPhone, phoneToEmail } from '../lib/supabase'
import { useStore } from '../store'

export default function LoginPage() {
  const { setUser, loadAll, showLoad, hideLoad } = useStore()
  const [phone, setPhone]   = useState('')
  const [pw,    setPw]      = useState('')
  const [showPw,setShowPw]  = useState(false)
  const [err,   setErr]     = useState('')
  const [busy,  setBusy]    = useState(false)
  const navigate = useNavigate()

  async function login(e) {
    e.preventDefault()
    setErr('')
    if (!phone) return setErr('أدخل رقم الجوال')
    if (!pw)    return setErr('أدخل كلمة المرور')
    setBusy(true)
    try {
      const email = phoneToEmail(phone) // ✅ alwabil.info
      const { data, error } = await sb.auth.signInWithPassword({ email, password: pw })
      if (error) {
        setErr(error.message.includes('Invalid') ? 'رقم الجوال أو كلمة المرور غير صحيحة' : error.message)
        return
      }

      // جلب الملف الشخصي
      let member = null
      const { data: d1 } = await sb.from('members').select('*').eq('auth_id', data.user.id).maybeSingle()
      member = d1

      if (!member) {
        // fallback: استخرج الرقم من الإيميل (يدعم alwabil.info و family.app)
        const digits = data.user.email
          .replace('@alwabil.info', '')
          .replace('@family.app', '')
        for (const v of ['+' + digits, '0' + digits.replace(/^966/, '')]) {
          const { data: d2 } = await sb.from('members').select('*').eq('phone', v).maybeSingle()
          if (d2) { member = d2; break }
        }
      }

      if (!member || !['admin', 'supervisor'].includes(member.role)) {
        await sb.auth.signOut()
        setErr('ليس لديك صلاحية للدخول')
        return
      }

      setUser(member)
      showLoad('جارٍ تحميل البيانات...')
      await loadAll()
      hideLoad()
      navigate('/dashboard', { replace: true })
    } catch (e) {
      setErr('خطأ في الاتصال: ' + e.message)
    } finally {
      setBusy(false)
      hideLoad()
    }
  }

  return (
    <div className="login-screen">
      <form className="login-card" onSubmit={login}>
        <div className="login-logo">
          <span className="login-icon">🌳</span>
          <div className="login-title">لوحة تحكم الوابل</div>
          <div className="login-sub">للمشرفين والمديرين فقط</div>
        </div>

        <div className="fg">
          <label>رقم الجوال</label>
          <div className="phone-wrap">
            <div className="phone-pfx">🇸🇦 +966</div>
            <input className="phone-inp" type="tel" value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="05XXXXXXXX" maxLength={10} />
          </div>
        </div>

        <div className="fg">
          <label>كلمة المرور</label>
          <div className="pw-wrap">
            <input className="pw-inp" type={showPw ? 'text' : 'password'} value={pw}
              onChange={e => setPw(e.target.value)} placeholder="كلمة المرور" />
            <button type="button" className="pw-tog" onClick={() => setShowPw(!showPw)}>
              {showPw ? '🙈' : '👁'}
            </button>
          </div>
        </div>

        {err && <div className="login-err">{err}</div>}

        <button type="submit" className="btn btn-pr btn-lg" disabled={busy}>
          {busy ? <div className="spinner sm" /> : null}
          {busy ? 'جارٍ الدخول...' : 'دخول'}
        </button>
      </form>
    </div>
  )
}
