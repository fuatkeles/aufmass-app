import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { getForms, deleteForm, getMontageteamStats, getMontageteams, updateForm, getForm, getImageUrl, getStoredUser } from '../services/api';
import type { FormData, MontageteamStats, Montageteam } from '../services/api';
import { useStats } from '../AppWrapper';
import { generatePDF } from '../utils/pdfGenerator';
import './Dashboard.css';

// Check if current user is admin
const isAdmin = () => {
  const user = getStoredUser();
  return user?.role === 'admin';
};

// Status options for forms
const STATUS_OPTIONS = [
  { value: 'alle', label: 'Alle Aufmaße', color: '#7fa93d' },
  { value: 'neu', label: 'Aufmaß Genommen', color: '#8b5cf6' },
  { value: 'auftrag_erteilt', label: 'Auftrag Erteilt', color: '#3b82f6' },
  { value: 'bestellt', label: 'Bestellt/In Bearbeitung', color: '#f59e0b' },
  { value: 'abgeschlossen', label: 'Abgeschlossen', color: '#10b981' },
  { value: 'reklamation', label: 'Reklamation/Restarbeit', color: '#ef4444' },
];

const Dashboard = () => {
  const navigate = useNavigate();
  const { stats, refreshStats } = useStats();
  const [forms, setForms] = useState<FormData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('alle');
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [formToDelete, setFormToDelete] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [montageteamStats, setMontageteamStats] = useState<MontageteamStats[]>([]);
  const [montageteams, setMontageteams] = useState<Montageteam[]>([]);
  const [teamDropdownOpen, setTeamDropdownOpen] = useState<number | null>(null);
  const [statusDropdownOpen, setStatusDropdownOpen] = useState<number | null>(null);
  const [filterDropdownOpen, setFilterDropdownOpen] = useState(false);
  const [attachmentDropdownOpen, setAttachmentDropdownOpen] = useState<number | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [formsData, teamStats, teams] = await Promise.all([
        getForms(),
        getMontageteamStats(),
        getMontageteams()
      ]);
      setForms(formsData);
      setMontageteamStats(teamStats);
      setMontageteams(teams.filter(t => t.is_active));
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

  const handleMontageteamChange = async (formId: number, teamName: string) => {
    try {
      const form = forms.find(f => f.id === formId);
      if (!form) return;

      const updatedSpecs = {
        ...form.specifications,
        montageteam: teamName || null
      };

      await updateForm(formId, { specifications: updatedSpecs });

      // Update local state
      setForms(forms.map(f =>
        f.id === formId
          ? { ...f, specifications: updatedSpecs }
          : f
      ));
      setTeamDropdownOpen(null);
    } catch (err) {
      console.error('Error updating montageteam:', err);
      alert('Fehler beim Aktualisieren des Montageteams');
    }
  };

  const getFormMontageteam = (form: FormData): string => {
    const specs = form.specifications as Record<string, unknown>;
    return (specs?.montageteam as string) || '';
  };

  const getFormStatus = (form: FormData): string => {
    const status = form.status || 'neu';
    // Map legacy statuses to new ones
    if (status === 'completed' || status === 'draft') {
      return 'neu';
    }
    return status;
  };

  const getStatusLabel = (status: string): string => {
    const option = STATUS_OPTIONS.find(o => o.value === status);
    return option?.label || 'Alle Aufmaße';
  };

  const getStatusColor = (status: string): string => {
    const option = STATUS_OPTIONS.find(o => o.value === status);
    return option?.color || '#7fa93d';
  };

  const handleStatusChange = async (formId: number, newStatus: string) => {
    try {
      await updateForm(formId, { status: newStatus });

      // Update local state
      setForms(forms.map(f =>
        f.id === formId
          ? { ...f, status: newStatus }
          : f
      ));
      setStatusDropdownOpen(null);
      refreshStats();
    } catch (err) {
      console.error('Error updating status:', err);
      alert(`Fehler beim Aktualisieren des Status: ${err instanceof Error ? err.message : 'Unbekannter Fehler'}`);
    }
  };

  const handleDownloadPDF = async (formId: number) => {
    try {
      // Get full form data with images
      const fullFormData = await getForm(formId);

      // Transform to the format expected by generatePDF
      const pdfData = {
        id: String(fullFormData.id),
        datum: fullFormData.datum || '',
        aufmasser: fullFormData.aufmasser || '',
        kundeVorname: fullFormData.kundeVorname || '',
        kundeNachname: fullFormData.kundeNachname || '',
        kundenlokation: fullFormData.kundenlokation || '',
        productSelection: {
          category: fullFormData.category || '',
          productType: fullFormData.productType || '',
          model: fullFormData.model || ''
        },
        specifications: fullFormData.specifications as Record<string, string | number | boolean | string[]> || {},
        weitereProdukte: fullFormData.weitereProdukte || [],
        bilder: fullFormData.bilder || [],
        bemerkungen: fullFormData.bemerkungen || '',
        status: (fullFormData.status as 'draft' | 'completed' | 'archived') || 'draft',
        createdAt: fullFormData.created_at,
        updatedAt: fullFormData.updated_at
      };

      await generatePDF(pdfData);
    } catch (err) {
      console.error('Error generating PDF:', err);
      alert(`Fehler beim Erstellen der PDF: ${err instanceof Error ? err.message : 'Unbekannter Fehler'}`);
    }
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
    const matchesFilter = filterStatus === 'alle' || form.status === filterStatus;
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
          {/* Desktop: Horizontal tabs */}
          <div className="status-filter-tabs desktop-only">
            {STATUS_OPTIONS.map((option) => (
              <button
                key={option.value}
                className={`status-filter-tab ${filterStatus === option.value ? 'active' : ''}`}
                onClick={() => setFilterStatus(option.value)}
                style={{
                  '--tab-color': option.color,
                  borderColor: filterStatus === option.value ? option.color : 'transparent'
                } as React.CSSProperties}
              >
                <span className="status-dot" style={{ backgroundColor: option.color }} />
                <span className="tab-label">{option.label}</span>
                <span className="tab-count">
                  {option.value === 'alle'
                    ? stats.total
                    : forms.filter(f => f.status === option.value).length}
                </span>
              </button>
            ))}
          </div>
          {/* Mobile: Dropdown */}
          <div className="status-filter-dropdown-container mobile-only">
            <button
              className="status-filter-dropdown-btn"
              onClick={() => setFilterDropdownOpen(!filterDropdownOpen)}
              style={{ borderColor: getStatusColor(filterStatus) }}
            >
              <span className="status-dot" style={{ backgroundColor: getStatusColor(filterStatus) }} />
              <span>{getStatusLabel(filterStatus)}</span>
              <span className="dropdown-count">{filterStatus === 'alle' ? stats.total : filteredForms.length}</span>
              <svg className={`chevron ${filterDropdownOpen ? 'open' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6" /></svg>
            </button>
            <AnimatePresence>
              {filterDropdownOpen && (
                <motion.div
                  className="status-filter-dropdown"
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                >
                  {STATUS_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      className={`status-dropdown-option ${filterStatus === option.value ? 'selected' : ''}`}
                      onClick={() => {
                        setFilterStatus(option.value);
                        setFilterDropdownOpen(false);
                      }}
                    >
                      <span className="status-dot" style={{ backgroundColor: option.color }} />
                      <span>{option.label}</span>
                      <span className="option-count">
                        {option.value === 'alle'
                          ? stats.total
                          : forms.filter(f => f.status === option.value).length}
                      </span>
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
        <div className="toolbar-right">
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
                      {isAdmin() ? (
                        <div className="status-selector">
                          <button
                            className="status-pill-btn"
                            style={{ backgroundColor: getStatusColor(getFormStatus(form)) }}
                            onClick={(e) => {
                              e.stopPropagation();
                              setStatusDropdownOpen(statusDropdownOpen === form.id ? null : form.id!);
                            }}
                          >
                            {getStatusLabel(getFormStatus(form)).split('/')[0]}
                            <svg className="chevron-small" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6" /></svg>
                          </button>
                          <AnimatePresence>
                            {statusDropdownOpen === form.id && (
                              <motion.div
                                className="status-dropdown"
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                onClick={(e) => e.stopPropagation()}
                              >
                                {STATUS_OPTIONS.filter(o => o.value !== 'alle').map((option) => (
                                  <button
                                    key={option.value}
                                    className={`status-option ${getFormStatus(form) === option.value ? 'selected' : ''}`}
                                    onClick={() => handleStatusChange(form.id!, option.value)}
                                  >
                                    <span className="status-dot" style={{ backgroundColor: option.color }} />
                                    <span>{option.label}</span>
                                  </button>
                                ))}
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      ) : (
                        <div
                          className="status-pill-static"
                          style={{ backgroundColor: getStatusColor(getFormStatus(form)) }}
                        >
                          {getStatusLabel(getFormStatus(form)).split('/')[0]}
                        </div>
                      )}
                    </div>
                    <div className="card-body-modern">
                      <div className="product-tags">
                        {form.category && <span className="product-tag category">{form.category}</span>}
                        {form.productType && <span className="product-tag type">{form.productType}</span>}
                        {form.model && <span className="product-tag model">{form.model}</span>}
                        {form.weitereProdukte && form.weitereProdukte.length > 0 && (
                          <span className="product-tag weitere" title={`${form.weitereProdukte.length} weitere Produkte`}>
                            +{form.weitereProdukte.length} weitere
                          </span>
                        )}
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
                    <div className="team-selector">
                      <button
                        className={`team-selector-btn ${getFormMontageteam(form) ? 'has-team' : ''}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setTeamDropdownOpen(teamDropdownOpen === form.id ? null : form.id!);
                        }}
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" /></svg>
                        <span>{getFormMontageteam(form) || 'Team'}</span>
                        <svg className="chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6" /></svg>
                      </button>
                      <AnimatePresence>
                        {teamDropdownOpen === form.id && (
                          <motion.div
                            className="team-dropdown"
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              className={`team-option ${!getFormMontageteam(form) ? 'selected' : ''}`}
                              onClick={() => handleMontageteamChange(form.id!, '')}
                            >
                              Kein Team
                            </button>
                            {montageteams.map((team) => (
                              <button
                                key={team.id}
                                className={`team-option ${getFormMontageteam(form) === team.name ? 'selected' : ''}`}
                                onClick={() => handleMontageteamChange(form.id!, team.name)}
                              >
                                {team.name}
                              </button>
                            ))}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                    <div className="attachment-selector">
                      <button
                        className={`action-btn attachment ${(form.pdf_count || 0) > 0 ? 'has-files' : ''}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setAttachmentDropdownOpen(attachmentDropdownOpen === form.id ? null : form.id!);
                        }}
                        title="Dateien"
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14,2 14,8 20,8" /></svg>
                        {(form.pdf_count || 0) > 0 && <span className="file-count-badge">{form.pdf_count}</span>}
                      </button>
                      <AnimatePresence>
                        {attachmentDropdownOpen === form.id && (
                          <motion.div
                            className="attachment-dropdown"
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              className="attachment-option generate-pdf"
                              onClick={() => {
                                handleDownloadPDF(form.id!);
                                setAttachmentDropdownOpen(null);
                              }}
                            >
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14,2 14,8 20,8" /><line x1="12" y1="18" x2="12" y2="12" /><line x1="9" y1="15" x2="12" y2="18" /><line x1="15" y1="15" x2="12" y2="18" /></svg>
                              <span>PDF erstellen</span>
                            </button>
                            {form.pdf_files && form.pdf_files.length > 0 && (
                              <>
                                <div className="attachment-divider">Angehängte PDFs</div>
                                {form.pdf_files.map((pdf) => (
                                  <a
                                    key={pdf.id}
                                    href={getImageUrl(pdf.id)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="attachment-option pdf-file"
                                    onClick={() => setAttachmentDropdownOpen(null)}
                                  >
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14,2 14,8 20,8" /><path d="M9 15h6"/><path d="M9 11h6"/></svg>
                                    <span className="pdf-filename">{pdf.file_name}</span>
                                  </a>
                                ))}
                              </>
                            )}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                    {form.kundeEmail && (
                      <a
                        href={`mailto:${form.kundeEmail}`}
                        className="action-btn email"
                        title={`E-Mail an ${form.kundeEmail}`}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" /></svg>
                      </a>
                    )}
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

      {/* Powered by Conais Footer */}
      <footer className="powered-by-footer">
        <span>Powered by</span>
        <a href="https://conais.com" target="_blank" rel="noopener noreferrer">
          <img src="https://conais.in/dev/wp-content/uploads/2020/10/logo2.png" alt="Conais" className="conais-logo" />
        </a>
      </footer>
    </>
  );
};

export default Dashboard;
