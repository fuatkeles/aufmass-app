import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { getMontageteamStats, getForms, getMontageteams, createMontageteam, updateMontageteam, deleteMontageteam } from '../services/api';
import type { MontageteamStats, FormData, Montageteam } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import './Dashboard.css';

const MontageteamPage = () => {
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const [teams, setTeams] = useState<MontageteamStats[]>([]);
  const [allTeams, setAllTeams] = useState<Montageteam[]>([]);
  const [forms, setForms] = useState<FormData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null);

  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [editingTeam, setEditingTeam] = useState<Montageteam | null>(null);
  const [newTeamName, setNewTeamName] = useState('');
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [teamStats, formsData, teamsData] = await Promise.all([
        getMontageteamStats(),
        getForms(),
        getMontageteams()
      ]);
      setTeams(teamStats);
      setForms(formsData);
      setAllTeams(teamsData);
    } catch (err) {
      console.error('Error loading data:', err);
    } finally {
      setLoading(false);
    }
  };

  const getTeamForms = (teamName: string) => {
    return forms.filter(f => {
      const specs = f.specifications as Record<string, unknown>;
      return specs?.montageteam === teamName;
    });
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('de-DE');
  };

  const handleAddTeam = async () => {
    if (!newTeamName.trim()) return;
    setModalLoading(true);
    setModalError(null);
    try {
      await createMontageteam(newTeamName.trim());
      setNewTeamName('');
      setShowAddModal(false);
      await loadData();
    } catch (err) {
      setModalError(err instanceof Error ? err.message : 'Fehler beim Erstellen');
    } finally {
      setModalLoading(false);
    }
  };

  const handleEditTeam = async () => {
    if (!editingTeam || !newTeamName.trim()) return;
    setModalLoading(true);
    setModalError(null);
    try {
      await updateMontageteam(editingTeam.id, { name: newTeamName.trim() });
      setNewTeamName('');
      setEditingTeam(null);
      setShowEditModal(false);
      await loadData();
    } catch (err) {
      setModalError(err instanceof Error ? err.message : 'Fehler beim Aktualisieren');
    } finally {
      setModalLoading(false);
    }
  };

  const handleDeleteTeam = async () => {
    if (!editingTeam) return;
    setModalLoading(true);
    setModalError(null);
    try {
      await deleteMontageteam(editingTeam.id);
      setEditingTeam(null);
      setShowDeleteModal(false);
      await loadData();
    } catch (err) {
      setModalError(err instanceof Error ? err.message : 'Fehler beim Löschen');
    } finally {
      setModalLoading(false);
    }
  };

  const openEditModal = (team: Montageteam) => {
    setEditingTeam(team);
    setNewTeamName(team.name);
    setModalError(null);
    setShowEditModal(true);
  };

  const openDeleteModal = (team: Montageteam) => {
    setEditingTeam(team);
    setModalError(null);
    setShowDeleteModal(true);
  };

  if (loading) {
    return (
      <div className="dashboard-loading">
        <div className="loading-spinner"></div>
        <p>Daten werden geladen...</p>
      </div>
    );
  }

  return (
    <>
      <header className="content-header">
        <div className="header-left">
          <h1>Montageteams</h1>
          <p className="header-subtitle">{allTeams.length} Teams registriert</p>
        </div>
        {isAdmin && (
          <div className="header-right">
            <motion.button
              className="btn-primary-new"
              onClick={() => { setNewTeamName(''); setModalError(null); setShowAddModal(true); }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 5v14M5 12h14" />
              </svg>
              Neues Team
            </motion.button>
          </div>
        )}
      </header>

      {/* Teams Grid */}
      <div className="montageteam-grid-new">
        {teams.length > 0 ? (
          teams.map((team, index) => (
            <motion.div
              key={team.id}
              className={`montageteam-card-new ${selectedTeam === team.montageteam ? 'selected' : ''}`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <div className="team-card-header">
                <div className="team-info">
                  <div className="team-avatar">
                    {team.montageteam.substring(0, 2).toUpperCase()}
                  </div>
                  <div className="team-details">
                    <h3>{team.montageteam}</h3>
                    <span className="team-created">Erstellt: {formatDate(team.created_at)}</span>
                  </div>
                </div>
                {isAdmin && (
                  <div className="team-actions">
                    <button
                      className="team-action-btn edit"
                      onClick={(e) => {
                        e.stopPropagation();
                        const fullTeam = allTeams.find(t => t.name === team.montageteam);
                        if (fullTeam) openEditModal(fullTeam);
                      }}
                      title="Bearbeiten"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button
                      className="team-action-btn delete"
                      onClick={(e) => {
                        e.stopPropagation();
                        const fullTeam = allTeams.find(t => t.name === team.montageteam);
                        if (fullTeam) openDeleteModal(fullTeam);
                      }}
                      title="Löschen"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                )}
              </div>

              <div className="team-stats-grid">
                <div className="team-stat">
                  <span className="stat-value">{team.count}</span>
                  <span className="stat-label">Projekte</span>
                </div>
                <div className="team-stat completed">
                  <span className="stat-value">{team.completed}</span>
                  <span className="stat-label">Fertig</span>
                </div>
                <div className="team-stat draft">
                  <span className="stat-value">{team.draft}</span>
                  <span className="stat-label">Entwurf</span>
                </div>
                <div className="team-stat percentage">
                  <span className="stat-value">{team.count > 0 ? Math.round((team.completed / team.count) * 100) : 0}%</span>
                  <span className="stat-label">Quote</span>
                </div>
              </div>

              <div className="team-progress-bar">
                <div className="progress-fill" style={{ width: `${team.count > 0 ? (team.completed / team.count) * 100 : 0}%` }} />
              </div>

              <button
                className="team-expand-btn"
                onClick={() => setSelectedTeam(selectedTeam === team.montageteam ? null : team.montageteam)}
              >
                {selectedTeam === team.montageteam ? 'Projekte ausblenden' : 'Projekte anzeigen'}
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ transform: selectedTeam === team.montageteam ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>
                  <path d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              <AnimatePresence>
                {selectedTeam === team.montageteam && (
                  <motion.div
                    className="team-projects-inline"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    {getTeamForms(team.montageteam).length > 0 ? (
                      getTeamForms(team.montageteam).map((form) => (
                        <div
                          key={form.id}
                          className="inline-project-row"
                          onClick={() => navigate(`/form/${form.id}`)}
                        >
                          <div className="project-info">
                            <span className="project-customer">{form.kundeVorname} {form.kundeNachname}</span>
                            <span className="project-location">{form.kundenlokation}</span>
                          </div>
                          <span className={`project-status-badge ${form.status || 'draft'}`}>
                            {form.status === 'completed' ? 'Fertig' : 'Entwurf'}
                          </span>
                        </div>
                      ))
                    ) : (
                      <div className="no-projects">Keine Projekte zugewiesen</div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))
        ) : allTeams.length > 0 ? (
          // Show teams without stats
          allTeams.map((team, index) => (
            <motion.div
              key={team.id}
              className="montageteam-card-new empty"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <div className="team-card-header">
                <div className="team-info">
                  <div className="team-avatar">
                    {team.name.substring(0, 2).toUpperCase()}
                  </div>
                  <div className="team-details">
                    <h3>{team.name}</h3>
                    <span className="team-created">Erstellt: {formatDate(team.created_at)}</span>
                  </div>
                </div>
                {isAdmin && (
                  <div className="team-actions">
                    <button className="team-action-btn edit" onClick={() => openEditModal(team)} title="Bearbeiten">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button className="team-action-btn delete" onClick={() => openDeleteModal(team)} title="Löschen">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                )}
              </div>
              <div className="team-stats-grid">
                <div className="team-stat">
                  <span className="stat-value">0</span>
                  <span className="stat-label">Projekte</span>
                </div>
                <div className="team-stat completed">
                  <span className="stat-value">0</span>
                  <span className="stat-label">Fertig</span>
                </div>
                <div className="team-stat draft">
                  <span className="stat-value">0</span>
                  <span className="stat-label">Entwurf</span>
                </div>
                <div className="team-stat percentage">
                  <span className="stat-value">0%</span>
                  <span className="stat-label">Quote</span>
                </div>
              </div>
              <div className="team-progress-bar">
                <div className="progress-fill" style={{ width: '0%' }} />
              </div>
              <div className="no-projects-notice">Keine Projekte zugewiesen</div>
            </motion.div>
          ))
        ) : (
          <div className="empty-state-modern">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ width: 64, height: 64, marginBottom: 16, opacity: 0.5 }}>
              <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 00-3-3.87" />
              <path d="M16 3.13a4 4 0 010 7.75" />
            </svg>
            <h3>Keine Montageteams</h3>
            <p>Erstellen Sie Ihr erstes Montageteam</p>
            {isAdmin && (
              <button className="btn-primary-new" onClick={() => setShowAddModal(true)}>
                Erstes Team erstellen
              </button>
            )}
          </div>
        )}
      </div>

      {/* Add Team Modal */}
      <AnimatePresence>
        {showAddModal && (
          <motion.div
            className="modal-overlay-modern"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowAddModal(false)}
          >
            <motion.div
              className="modal-modern"
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3>Neues Montageteam</h3>
              <input
                type="text"
                placeholder="Teamname eingeben..."
                value={newTeamName}
                onChange={(e) => setNewTeamName(e.target.value)}
                className="modal-input"
                autoFocus
              />
              {modalError && <p className="modal-error">{modalError}</p>}
              <div className="modal-actions-modern">
                <button className="modal-btn secondary" onClick={() => setShowAddModal(false)}>Abbrechen</button>
                <button className="modal-btn primary" onClick={handleAddTeam} disabled={modalLoading || !newTeamName.trim()}>
                  {modalLoading ? 'Wird erstellt...' : 'Erstellen'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Edit Team Modal */}
      <AnimatePresence>
        {showEditModal && editingTeam && (
          <motion.div
            className="modal-overlay-modern"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowEditModal(false)}
          >
            <motion.div
              className="modal-modern"
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3>Team bearbeiten</h3>
              <input
                type="text"
                placeholder="Teamname eingeben..."
                value={newTeamName}
                onChange={(e) => setNewTeamName(e.target.value)}
                className="modal-input"
                autoFocus
              />
              {modalError && <p className="modal-error">{modalError}</p>}
              <div className="modal-actions-modern">
                <button className="modal-btn secondary" onClick={() => setShowEditModal(false)}>Abbrechen</button>
                <button className="modal-btn primary" onClick={handleEditTeam} disabled={modalLoading || !newTeamName.trim()}>
                  {modalLoading ? 'Wird gespeichert...' : 'Speichern'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Team Modal */}
      <AnimatePresence>
        {showDeleteModal && editingTeam && (
          <motion.div
            className="modal-overlay-modern"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowDeleteModal(false)}
          >
            <motion.div
              className="modal-modern"
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3>Team löschen?</h3>
              <p>Möchten Sie das Team "{editingTeam.name}" wirklich löschen?</p>
              {modalError && <p className="modal-error">{modalError}</p>}
              <div className="modal-actions-modern">
                <button className="modal-btn secondary" onClick={() => setShowDeleteModal(false)}>Abbrechen</button>
                <button className="modal-btn danger" onClick={handleDeleteTeam} disabled={modalLoading}>
                  {modalLoading ? 'Wird gelöscht...' : 'Löschen'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default MontageteamPage;
