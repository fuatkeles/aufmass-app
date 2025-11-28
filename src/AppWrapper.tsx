import { useState, useEffect, createContext, useContext } from 'react';
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import Dashboard from './pages/Dashboard';
import FormPage from './pages/FormPage';
import Montageteam from './pages/Montageteam';
import Login from './pages/Login';
import Register from './pages/Register';
import { getStats, getUsers, getInvitations, createInvitation, deleteInvitation, deleteUser, updateUser } from './services/api';
import type { Stats, User, Invitation } from './services/api';
import { AnimatePresence, motion } from 'framer-motion';
import './pages/Dashboard.css';

// Stats Context
interface StatsContextType {
  stats: Stats;
  refreshStats: () => void;
}

const StatsContext = createContext<StatsContextType>({ stats: { total: 0, completed: 0, draft: 0 }, refreshStats: () => {} });
export const useStats = () => useContext(StatsContext);

// Admin Panel Context
interface AdminPanelContextType {
  openAdminPanel: () => void;
}

const AdminPanelContext = createContext<AdminPanelContextType>({ openAdminPanel: () => {} });
export const useAdminPanel = () => useContext(AdminPanelContext);

function Layout({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout, isAdmin } = useAuth();
  const { stats } = useStats();
  const { openAdminPanel } = useAdminPanel();

  const isActive = (path: string) => location.pathname === path;

  return (
    <div className="dashboard">
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
              <a href="#" className="nav-item" onClick={(e) => { e.preventDefault(); openAdminPanel(); }}>
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

      <main className="dashboard-content">
        {children}
      </main>
    </div>
  );
}

function ProtectedContent() {
  const { user, isAdmin } = useAuth();
  const [stats, setStats] = useState<Stats>({ total: 0, completed: 0, draft: 0 });
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'user' | 'admin'>('user');
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const data = await getStats();
      setStats(data);
    } catch (err) {
      console.error('Error loading stats:', err);
    }
  };

  const loadAdminData = async () => {
    if (!isAdmin) return;
    try {
      const [usersData, invitesData] = await Promise.all([getUsers(), getInvitations()]);
      setUsers(usersData);
      setInvitations(invitesData);
    } catch (err) {
      console.error('Error loading admin data:', err);
    }
  };

  const openAdminPanel = () => {
    setShowAdminPanel(true);
    loadAdminData();
  };

  const handleInviteUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail) return;
    setInviteLoading(true);
    setInviteSuccess(null);
    try {
      const result = await createInvitation(inviteEmail, inviteRole);
      setInviteSuccess(`${window.location.origin}${result.inviteLink}`);
      setInviteEmail('');
      loadAdminData();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Fehler');
    } finally {
      setInviteLoading(false);
    }
  };

  return (
    <StatsContext.Provider value={{ stats, refreshStats: loadStats }}>
      <AdminPanelContext.Provider value={{ openAdminPanel }}>
        <Routes>
          {/* Form sayfası sidebar olmadan */}
          <Route path="/form/:id" element={<FormPage />} />

          {/* Diğer sayfalar Layout içinde (sidebar ile) */}
          <Route path="/*" element={
            <Layout>
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/montageteam" element={<Montageteam />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Layout>
          } />
        </Routes>

        {/* Admin Panel Modal */}
        <AnimatePresence>
          {showAdminPanel && (
            <motion.div
              className="modal-overlay-modern"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAdminPanel(false)}
            >
              <motion.div
                className="admin-panel-modal"
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="admin-panel-header">
                  <h2>Benutzerverwaltung</h2>
                  <button className="close-btn" onClick={() => setShowAdminPanel(false)}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M18 6L6 18M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <div className="admin-section">
                  <h3>Neuen Benutzer einladen</h3>
                  <form onSubmit={handleInviteUser} className="invite-form">
                    <input type="email" placeholder="E-Mail-Adresse" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} required />
                    <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value as 'user' | 'admin')}>
                      <option value="user">Benutzer</option>
                      <option value="admin">Administrator</option>
                    </select>
                    <button type="submit" disabled={inviteLoading}>{inviteLoading ? 'Lädt...' : 'Einladen'}</button>
                  </form>
                  {inviteSuccess && (
                    <div className="invite-success">
                      <p>Einladungslink erstellt!</p>
                      <div className="invite-link-box">
                        <input type="text" value={inviteSuccess} readOnly />
                        <button type="button" className="copy-btn" onClick={() => { navigator.clipboard.writeText(inviteSuccess); alert('Kopiert!'); }}>
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <rect x="9" y="9" width="13" height="13" rx="2" />
                            <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                          </svg>
                          Kopieren
                        </button>
                      </div>
                      <small>7 Tage gültig - manuell versenden</small>
                    </div>
                  )}
                </div>

                {invitations.filter(i => !i.used_at).length > 0 && (
                  <div className="admin-section">
                    <h3>Offene Einladungen</h3>
                    <div className="admin-list">
                      {invitations.filter(i => !i.used_at).map((inv) => (
                        <div key={inv.id} className="admin-list-item">
                          <div className="item-info">
                            <span className="item-email">{inv.email}</span>
                            <span className="item-role">{inv.role}</span>
                          </div>
                          <button className="item-delete" onClick={async () => { if (confirm('Löschen?')) { await deleteInvitation(inv.id); loadAdminData(); } }}>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="admin-section">
                  <h3>Benutzer ({users.length})</h3>
                  <div className="admin-list">
                    {users.map((u) => (
                      <div key={u.id} className={`admin-list-item ${!u.is_active ? 'inactive' : ''}`}>
                        <div className="item-info">
                          <span className="item-name">{u.name}</span>
                          <span className="item-email">{u.email}</span>
                          <span className={`item-role ${u.role}`}>{u.role}</span>
                        </div>
                        <div className="item-actions">
                          {u.id !== user?.id ? (
                            <>
                              <button className={`item-toggle ${u.is_active ? 'active' : ''}`} onClick={async () => { await updateUser(u.id, { is_active: !u.is_active }); loadAdminData(); }}>
                                {u.is_active ? 'Aktiv' : 'Inaktiv'}
                              </button>
                              <button className="item-delete" onClick={async () => { if (confirm('Löschen?')) { await deleteUser(u.id); loadAdminData(); } }}>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                              </button>
                            </>
                          ) : <span className="item-current">Sie</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </AdminPanelContext.Provider>
    </StatsContext.Provider>
  );
}

function AppWrapper() {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="dashboard">
        <div className="dashboard-loading">
          <div className="loading-spinner"></div>
          <p>Laden...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  return <ProtectedContent />;
}

export default AppWrapper;
