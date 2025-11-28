import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import type { Stats } from '../services/api';

interface LayoutProps {
  children: React.ReactNode;
  stats: Stats;
  onOpenAdminPanel?: () => void;
}

const Layout = ({ children, stats, onOpenAdminPanel }: LayoutProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout, isAdmin } = useAuth();

  const isActive = (path: string) => location.pathname === path;

  return (
    <div className="dashboard">
      {/* Sidebar */}
      <aside className="dashboard-sidebar">
        <div className="sidebar-header">
          <div className="sidebar-logo">
            <div className="logo-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2L2 7l10 5 10-5-10-5z" />
                <path d="M2 17l10 5 10-5" />
                <path d="M2 12l10 5 10-5" />
              </svg>
            </div>
            <div className="logo-text">
              <span className="logo-name">AYLUX</span>
              <span className="logo-tagline">Aufmaß System</span>
            </div>
          </div>
        </div>

        <nav className="sidebar-nav">
          <div className="nav-section">
            <span className="nav-section-title">Hauptmenü</span>
            <a href="#" className={`nav-item ${isActive('/') ? 'active' : ''}`} onClick={(e) => { e.preventDefault(); navigate('/'); }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="7" height="9" rx="2" />
                <rect x="14" y="3" width="7" height="5" rx="2" />
                <rect x="14" y="12" width="7" height="9" rx="2" />
                <rect x="3" y="16" width="7" height="5" rx="2" />
              </svg>
              <span>Dashboard</span>
            </a>
            <a href="#" className="nav-item" onClick={(e) => { e.preventDefault(); navigate('/form/new'); }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 5v14M5 12h14" />
              </svg>
              <span>Neues Aufmaß</span>
            </a>
          </div>

          <div className="nav-section">
            <span className="nav-section-title">Statistiken</span>
            <div className="sidebar-stats">
              <div className="sidebar-stat">
                <span className="stat-number">{stats.total}</span>
                <span className="stat-text">Gesamt</span>
              </div>
              <div className="sidebar-stat">
                <span className="stat-number completed">{stats.completed}</span>
                <span className="stat-text">Fertig</span>
              </div>
              <div className="sidebar-stat">
                <span className="stat-number draft">{stats.draft}</span>
                <span className="stat-text">Entwurf</span>
              </div>
            </div>
          </div>

          <div className="nav-section">
            <span className="nav-section-title">Teams</span>
            <a href="#" className={`nav-item ${isActive('/montageteam') ? 'active' : ''}`} onClick={(e) => { e.preventDefault(); navigate('/montageteam'); }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 00-3-3.87" />
                <path d="M16 3.13a4 4 0 010 7.75" />
              </svg>
              <span>Montageteams</span>
            </a>
          </div>

          {isAdmin && (
            <div className="nav-section">
              <span className="nav-section-title">Administration</span>
              <a href="#" className="nav-item" onClick={(e) => { e.preventDefault(); onOpenAdminPanel?.(); }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 00-3-3.87" />
                  <path d="M16 3.13a4 4 0 010 7.75" />
                </svg>
                <span>Benutzer verwalten</span>
              </a>
            </div>
          )}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div className="user-avatar">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            </div>
            <div className="user-info">
              <span className="user-name">{user?.name || 'Benutzer'}</span>
              <span className="user-role">{user?.role === 'admin' ? 'Administrator' : 'Benutzer'}</span>
            </div>
            <button
              className="logout-btn"
              onClick={() => { logout(); navigate('/login'); }}
              title="Abmelden"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="dashboard-content">
        {children}
      </main>
    </div>
  );
};

export default Layout;
