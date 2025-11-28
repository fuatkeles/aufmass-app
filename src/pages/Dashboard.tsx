import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { getForms, deleteForm, getMontageteamStats } from '../services/api';
import type { FormData, MontageteamStats } from '../services/api';
import { useStats } from '../AppWrapper';
import './Dashboard.css';

const Dashboard = () => {
  const navigate = useNavigate();
  const { stats, refreshStats } = useStats();
  const [forms, setForms] = useState<FormData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'draft' | 'completed'>('all');
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [formToDelete, setFormToDelete] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [montageteamStats, setMontageteamStats] = useState<MontageteamStats[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [formsData, teamStats] = await Promise.all([
        getForms(),
        getMontageteamStats()
      ]);
      setForms(formsData);
      setMontageteamStats(teamStats);
      refreshStats();
    } catch (err) {
      console.error('Error loading data:', err);
      setError('Daten konnten nicht geladen werden.');
    } finally {
      setLoading(false);
    }
  };

  const handleNewForm = () => navigate('/form/new');
  const handleEditForm = (id: number) => navigate(`/form/${id}`);

  const handleDeleteForm = (id: number) => {
    setFormToDelete(id);
    setDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (formToDelete) {
      try {
        await deleteForm(formToDelete);
        setForms(forms.filter(f => f.id !== formToDelete));
        refreshStats();
        setDeleteModalOpen(false);
        setFormToDelete(null);
      } catch (err) {
        alert('Fehler beim Löschen');
      }
    }
  };

  const filteredForms = forms.filter(form => {
    const matchesSearch =
      form.kundeVorname?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      form.kundeNachname?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      form.kundenlokation?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      form.category?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      form.productType?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filterStatus === 'all' || form.status === filterStatus;
    return matchesSearch && matchesFilter;
  });

  const getTimeAgo = (dateString?: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (days === 0) return 'Heute';
    if (days === 1) return 'Gestern';
    if (days < 7) return `vor ${days} Tagen`;
    return new Date(dateString).toLocaleDateString('de-DE');
  };

  if (loading) {
    return (
      <div className="dashboard-loading">
        <div className="loading-spinner"></div>
        <p>Daten werden geladen...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="dashboard-error">
        <h3>Fehler</h3>
        <p>{error}</p>
        <button onClick={loadData}>Erneut versuchen</button>
      </div>
    );
  }

  return (
    <>
      {/* Header */}
      <header className="content-header">
        <div className="header-left">
          <h1>Aufmaß Übersicht</h1>
          <p className="header-subtitle">Verwalten Sie Ihre Aufmaße</p>
        </div>
        <div className="header-right">
          <motion.button className="btn-primary-new" onClick={handleNewForm} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14" /></svg>
            Neues Aufmaß
          </motion.button>
        </div>
      </header>

      {/* Quick Stats */}
      <div className="quick-stats">
        <motion.div className="quick-stat-card" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <div className="quick-stat-content">
            <div className="quick-stat-icon total">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            </div>
            <div className="quick-stat-info">
              <span className="quick-stat-value">{stats.total}</span>
              <span className="quick-stat-label">Alle Aufmaße</span>
            </div>
          </div>
        </motion.div>

        <motion.div className="quick-stat-card" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <div className="quick-stat-content">
            <div className="quick-stat-icon completed">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </div>
            <div className="quick-stat-info">
              <span className="quick-stat-value">{stats.completed}</span>
              <span className="quick-stat-label">Abgeschlossen</span>
            </div>
          </div>
          <div className="quick-stat-percentage">{stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0}%</div>
        </motion.div>

        <motion.div className="quick-stat-card" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <div className="quick-stat-content">
            <div className="quick-stat-icon draft">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
            </div>
            <div className="quick-stat-info">
              <span className="quick-stat-value">{stats.draft}</span>
              <span className="quick-stat-label">In Bearbeitung</span>
            </div>
          </div>
          <div className="quick-stat-percentage">{stats.total > 0 ? Math.round((stats.draft / stats.total) * 100) : 0}%</div>
        </motion.div>
      </div>

      {/* Montageteams Section */}
      <motion.div className="montageteams-section" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
        <div className="section-header">
          <h2>Montageteams</h2>
          <button className="section-link" onClick={() => navigate('/montageteam')}>
            Verwalten
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6" /></svg>
          </button>
        </div>
        {montageteamStats.length > 0 ? (
          <div className="teams-grid">
            {montageteamStats.slice(0, 6).map((team) => (
              <div key={team.montageteam} className="team-card-small" onClick={() => navigate('/montageteam')}>
                <div className="team-name">{team.montageteam}</div>
                <div className="team-stats-row">
                  <span className="team-total">{team.count} Projekte</span>
                  <span className="team-completed">{team.completed} fertig</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="teams-empty">
            <p>Noch keine Montageteams erstellt</p>
            <button className="btn-secondary-small" onClick={() => navigate('/montageteam')}>
              Team erstellen
            </button>
          </div>
        )}
      </motion.div>

      {/* Toolbar */}
      <div className="content-toolbar">
        <div className="toolbar-left">
          <div className="search-container">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" /></svg>
            <input type="text" placeholder="Suchen..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            {searchTerm && <button className="clear-search" onClick={() => setSearchTerm('')}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg></button>}
          </div>
        </div>
        <div className="toolbar-right">
          <div className="filter-tabs">
            <button className={`filter-tab ${filterStatus === 'all' ? 'active' : ''}`} onClick={() => setFilterStatus('all')}>Alle</button>
            <button className={`filter-tab ${filterStatus === 'completed' ? 'active' : ''}`} onClick={() => setFilterStatus('completed')}>Abgeschlossen</button>
            <button className={`filter-tab ${filterStatus === 'draft' ? 'active' : ''}`} onClick={() => setFilterStatus('draft')}>Entwürfe</button>
          </div>
          <div className="view-toggle">
            <button className={`view-btn ${viewMode === 'grid' ? 'active' : ''}`} onClick={() => setViewMode('grid')}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></svg>
            </button>
            <button className={`view-btn ${viewMode === 'list' ? 'active' : ''}`} onClick={() => setViewMode('list')}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" /></svg>
            </button>
          </div>
        </div>
      </div>

      {/* Forms Grid */}
      <div className="content-area">
        {filteredForms.length === 0 ? (
          <div className="empty-state-modern">
            <h3>{searchTerm || filterStatus !== 'all' ? 'Keine Ergebnisse' : 'Keine Aufmaße'}</h3>
            <p>{searchTerm || filterStatus !== 'all' ? 'Andere Suchbegriffe probieren' : 'Erstellen Sie Ihr erstes Aufmaß'}</p>
            {!searchTerm && filterStatus === 'all' && (
              <button className="btn-primary-new" onClick={handleNewForm}>Erstes Aufmaß erstellen</button>
            )}
          </div>
        ) : (
          <div className={`forms-${viewMode}`}>
            <AnimatePresence mode="popLayout">
              {filteredForms.map((form, index) => (
                <motion.div key={form.id} className={`form-card-modern ${viewMode}`} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ delay: index * 0.03 }} layout>
                  <div className="card-status-indicator" data-status={form.status || 'draft'} />
                  <div className="card-main">
                    <div className="card-header-modern">
                      <div className="customer-avatar">{(form.kundeVorname?.[0] || 'K').toUpperCase()}{(form.kundeNachname?.[0] || '').toUpperCase()}</div>
                      <div className="customer-details">
                        <h3>{form.kundeVorname} {form.kundeNachname}</h3>
                        <p className="customer-location">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" /><circle cx="12" cy="10" r="3" /></svg>
                          {form.kundenlokation || 'Keine Adresse'}
                        </p>
                      </div>
                      <span className={`status-pill ${form.status || 'draft'}`}>{form.status === 'completed' ? 'Fertig' : 'Entwurf'}</span>
                    </div>
                    <div className="card-body-modern">
                      <div className="product-tags">
                        {form.category && <span className="product-tag category">{form.category}</span>}
                        {form.productType && <span className="product-tag type">{form.productType}</span>}
                        {form.model && <span className="product-tag model">{form.model}</span>}
                      </div>
                      <div className="card-meta">
                        <div className="meta-item-modern">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
                          <span>{getTimeAgo(form.datum || form.created_at)}</span>
                        </div>
                        <div className="meta-item-modern">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
                          <span>{form.aufmasser || '-'}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="card-actions-modern">
                    <button className="action-btn edit" onClick={() => handleEditForm(form.id!)}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                      <span>Bearbeiten</span>
                    </button>
                    <button className="action-btn delete" onClick={() => handleDeleteForm(form.id!)}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Delete Modal */}
      <AnimatePresence>
        {deleteModalOpen && (
          <motion.div className="modal-overlay-modern" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setDeleteModalOpen(false)}>
            <motion.div className="modal-modern" initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }} onClick={(e) => e.stopPropagation()}>
              <h3>Aufmaß löschen?</h3>
              <p>Diese Aktion kann nicht rückgängig gemacht werden.</p>
              <div className="modal-actions-modern">
                <button className="modal-btn secondary" onClick={() => setDeleteModalOpen(false)}>Abbrechen</button>
                <button className="modal-btn danger" onClick={confirmDelete}>Löschen</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default Dashboard;
