import { NavLink, useNavigate } from 'react-router-dom'
import { useStore } from '../store'
import { sb } from '../lib/supabase'

const NAV = [
  {
    to: '/dashboard',
    label: 'نظرة عامة',
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" rx="1.5"/>
        <rect x="14" y="3" width="7" height="7" rx="1.5"/>
        <rect x="3" y="14" width="7" height="7" rx="1.5"/>
        <rect x="14" y="14" width="7" height="7" rx="1.5"/>
      </svg>
    ),
  },
  {
    to: '/members',
    label: 'الأعضاء',
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
        <circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
        <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
    ),
  },
  {
    to: '/requests',
    label: 'طلبات التسجيل',
    badge: true,
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
        <line x1="16" y1="13" x2="8" y2="13"/>
        <line x1="16" y1="17" x2="8" y2="17"/>
      </svg>
    ),
  },
  {
    to: '/marriages',
    label: 'الزيجات',
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
      </svg>
    ),
  },
  {
    to: '/wp-search',
    label: 'بحث WP',
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
        <line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/>
      </svg>
    ),
  },
  {
    to: '/privacy',
    label: 'الخصوصية',
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
      </svg>
    ),
  },
]

export default function Sidebar() {
  const { user, members, setUser } = useStore()
  const navigate = useNavigate()
  const pending  = members.filter(m => m.status === 'pending').length
  const initials = (user?.first_name || user?.full_name || '؟').charAt(0)

  async function logout() {
    if (!confirm('تسجيل الخروج من لوحة التحكم؟')) return
    await sb.auth.signOut()
    setUser(null)
    navigate('/login', { replace: true })
  }

  return (
    <aside className="sb">
      {/* Radial glow */}
      <div className="sb-glow" />

      {/* Logo + user */}
      <div className="sb-logo">
        <div className="sb-logo-row">
          <div className="sb-icon">🌳</div>
          <div className="sb-text">
            <div className="sb-t">الوابل</div>
            <div className="sb-s">Admin Panel</div>
          </div>
        </div>
        <div className="sb-user">
          <div className="sb-user-av">{initials}</div>
          <div className="sb-user-name">{user?.first_name || user?.full_name}</div>
          <div className="sb-user-dot" />
        </div>
      </div>

      {/* Nav */}
      <nav className="sb-nav">
        <div className="nav-section">القائمة الرئيسية</div>
        {NAV.map(({ to, label, icon, badge }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) => 'nav-a' + (isActive ? ' active' : '')}
          >
            <div className="nav-ico">{icon}</div>
            <span>{label}</span>
            {badge && pending > 0 && (
              <span className="nav-badge">{pending}</span>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="sb-foot">
        <button className="btn-logout" onClick={logout}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
            <polyline points="16 17 21 12 16 7"/>
            <line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
          <span>تسجيل الخروج</span>
        </button>
      </div>
    </aside>
  )
}
