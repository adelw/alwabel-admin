import { useEffect, useState } from 'react'
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom'
import { sb } from './lib/supabase'
import { useStore } from './store'
import Sidebar from './components/Sidebar'
import { ConfirmDialog, LoadingOverlay, ToastContainer } from './components/UI'
import LoginPage from './pages/Login'
import Dashboard from './pages/Dashboard'
import Members from './pages/Members'
import MemberProfile from './pages/MemberProfile'
import { RequestsPage, MarriagesPage } from './pages/Other'
import WpSearch from './pages/WpSearch'
import Privacy from './pages/Privacy'
import BotKnowledge from './pages/BotKnowledge'

function Shell({ children }) {
  const { loadAll, showLoad, hideLoad, toast } = useStore()
  const navigate = useNavigate()

  async function refresh() {
    showLoad('جارٍ التحديث...')
    try { await loadAll(); toast('✅ تم التحديث','ok') }
    catch(e) { toast('خطأ: '+e.message,'er') }
    finally { hideLoad() }
  }

  const titles = { '/dashboard':'نظرة عامة', '/members':'الأعضاء', '/requests':'طلبات التسجيل', '/marriages':'الزيجات', '/wp-search':'بحث WP', '/privacy':'الخصوصية', '/bot-knowledge':'ذاكرة البوت' }
  const loc = useLocation()
  const title = loc.pathname.startsWith('/members/') && loc.pathname !== '/members/new'
    ? 'ملف العضو'
    : (titles[loc.pathname] || '')

  return (
    <div className="shell">
      <Sidebar />
      <div className="main">
        <div className="topbar">
          <div className="topbar-title">{title}</div>
          <button className="btn btn-ok" onClick={() => navigate('/members/new')}>➕ إضافة عضو</button>
          <button className="btn btn-bl" onClick={refresh}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M23 4v6h-6"/><path d="M1 20v-6h6"/>
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
            </svg>
            تحديث
          </button>
        </div>
        <div className="page">{children}</div>
      </div>
    </div>
  )
}

function Guard({ children }) {
  const { user, setUser, loadAll, loaded, showLoad, hideLoad } = useStore()
  const [checking, setChecking] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    sb.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { setChecking(false); navigate('/login', { replace:true }); return }
      if (!user) {
        let m = null
        const { data: d1 } = await sb.from('members').select('*').eq('auth_id', session.user.id).maybeSingle()
        m = d1
        if (!m) {
          const digits = session.user.email.replace('@family.app','')
          for (const v of ['+'+digits, '0'+digits.replace(/^966/,'')]) {
            const { data: d2 } = await sb.from('members').select('*').eq('phone',v).maybeSingle()
            if (d2) { m = d2; break }
          }
        }
        if (!m || !['admin','supervisor'].includes(m.role)) {
          await sb.auth.signOut(); navigate('/login', { replace:true }); return
        }
        setUser(m)
      }
      if (!loaded) {
        showLoad('جارٍ تحميل البيانات...')
        try { await loadAll() } catch(e) { console.error(e) }
        finally { hideLoad() }
      }
      setChecking(false)
    })
  }, [])

  if (checking) return null
  return children
}

export default function App() {
  return (
    <>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/*" element={
          <Guard>
            <Shell>
              <Routes>
                <Route path="/dashboard"      element={<Dashboard />} />
                <Route path="/members"        element={<Members />} />
                <Route path="/members/:id"    element={<MemberProfile />} />
                <Route path="/requests"       element={<RequestsPage />} />
                <Route path="/marriages"      element={<MarriagesPage />} />
                <Route path="/wp-search"      element={<WpSearch />} />
                <Route path="/privacy"        element={<Privacy />} />
                <Route path="/bot-knowledge"  element={<BotKnowledge />} />
                <Route path="*"               element={<Navigate to="/dashboard" replace />} />
              </Routes>
            </Shell>
          </Guard>
        } />
      </Routes>
      <ConfirmDialog />
      <LoadingOverlay />
      <ToastContainer />
    </>
  )
}
