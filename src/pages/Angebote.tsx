import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { api, getLeadPdfUrl } from '../services/api';
import LeadFormModal from '../components/LeadFormModal';
import './Angebote.css';

interface Lead {
  id: number;
  customer_firstname: string;
  customer_lastname: string;
  customer_email: string;
  customer_phone: string;
  customer_address: string;
  notes: string;
  total_price: number;
  subtotal?: number;
  total_discount?: number;
  status: string;
  created_by_name: string;
  created_at: string;
}

interface LeadItem {
  id: number;
  product_name: string;
  breite: number;
  tiefe: number;
  quantity: number;
  unit_price: number;
  discount?: number;
  total_price: number;
  pi_ober_kante?: string;
  pi_unter_kante?: string;
  pi_gestell_farbe?: string;
  pi_sicherheitglas?: string;
  pi_pfostenanzahl?: string;
}

interface LeadExtra {
  id: number;
  description: string;
  price: number;
}

interface LeadDetail extends Lead {
  items: LeadItem[];
  extras: LeadExtra[];
}

const LEAD_STATUS_OPTIONS = [
  { value: 'alle', label: 'Alle Angebote', color: '#7fa93d' },
  { value: 'offen', label: 'Offen', color: '#fbbf24' },
  { value: 'aufmass_erstellt', label: 'Aufmaß Erstellt', color: '#10b981' },
];

const getLeadStatusLabel = (status: string) => {
  const opt = LEAD_STATUS_OPTIONS.find(o => o.value === status);
  return opt?.label || status;
};

const getLeadStatusColor = (status: string) => {
  const opt = LEAD_STATUS_OPTIONS.find(o => o.value === status);
  return opt?.color || '#6b7280';
};

export default function Angebote() {
  const navigate = useNavigate();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [leadModalOpen, setLeadModalOpen] = useState(false);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<LeadDetail | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [filterStatus, setFilterStatus] = useState('alle');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadLeads();
  }, []);

  const loadLeads = async () => {
    try {
      const data = await api.get<Lead[]>('/leads');
      setLeads(data);
    } catch (err) {
      console.error('Failed to load leads:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetails = async (id: number) => {
    try {
      const data = await api.get<LeadDetail>(`/leads/${id}`);
      setSelectedLead(data);
      setDetailModalOpen(true);
    } catch (err) {
      console.error('Failed to load lead details:', err);
    }
  };

  const handleCreateAufmass = async (lead: Lead | LeadDetail) => {
    try {
      // Fetch full lead details if not already loaded
      let leadDetail: LeadDetail;
      if ('items' in lead) {
        leadDetail = lead;
      } else {
        leadDetail = await api.get<LeadDetail>(`/leads/${lead.id}`);
      }

      // Navigate to form with lead data pre-filled including products
      navigate('/form/new', {
        state: {
          fromLead: true,
          leadId: leadDetail.id,
          kundeVorname: leadDetail.customer_firstname,
          kundeNachname: leadDetail.customer_lastname,
          kundeEmail: leadDetail.customer_email,
          kundeTelefon: leadDetail.customer_phone,
          kundenlokation: leadDetail.customer_address,
          leadItems: leadDetail.items,
          leadExtras: leadDetail.extras,
          leadNotes: leadDetail.notes
        }
      });
    } catch (err) {
      console.error('Failed to load lead details:', err);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await api.delete(`/leads/${id}`);
      setLeads(leads.filter(l => l.id !== id));
      setDeleteConfirmId(null);
    } catch (err) {
      console.error('Failed to delete lead:', err);
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(price);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const filteredLeads = leads.filter(lead => {
    const matchesStatus = filterStatus === 'alle' || lead.status === filterStatus;
    const q = searchQuery.toLowerCase();
    const matchesSearch = !q ||
      `${lead.customer_firstname} ${lead.customer_lastname}`.toLowerCase().includes(q) ||
      lead.customer_email?.toLowerCase().includes(q) ||
      lead.customer_phone?.toLowerCase().includes(q) ||
      lead.customer_address?.toLowerCase().includes(q);
    return matchesStatus && matchesSearch;
  });

  return (
    <div className="angebote-page">
      <header className="page-header">
        <div className="header-left">
          <h1>Angebote</h1>
        </div>
        <div className="header-right">
          <motion.button
            className="btn-primary"
            onClick={() => setLeadModalOpen(true)}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 5v14M5 12h14" />
            </svg>
            Neues Angebot
          </motion.button>
        </div>
      </header>

      {/* Filter Tabs + Search */}
      <div className="lead-filters">
        <div className="lead-filter-tabs">
          {LEAD_STATUS_OPTIONS.map(option => (
            <button
              key={option.value}
              className={`lead-filter-tab ${filterStatus === option.value ? 'active' : ''}`}
              onClick={() => setFilterStatus(option.value)}
              style={{ '--tab-color': option.color } as React.CSSProperties}
            >
              <span className="lead-status-dot" style={{ backgroundColor: option.color }} />
              <span>{option.label}</span>
              <span className="lead-tab-count">
                {option.value === 'alle'
                  ? leads.length
                  : leads.filter(l => l.status === option.value).length}
              </span>
            </button>
          ))}
        </div>
        <div className="lead-search-box">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            placeholder="Suche nach Name, E-Mail, Adresse..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button className="search-clear" onClick={() => setSearchQuery('')}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Lade Angebote...</p>
        </div>
      ) : filteredLeads.length === 0 ? (
        <div className="empty-state">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
          </svg>
          <h3>{searchQuery || filterStatus !== 'alle' ? 'Keine Ergebnisse' : 'Keine Angebote'}</h3>
          <p>{searchQuery || filterStatus !== 'alle' ? 'Versuchen Sie andere Filter oder Suchbegriffe' : 'Erstellen Sie Ihr erstes Angebot'}</p>
          {!searchQuery && filterStatus === 'alle' && (
            <button className="btn-primary" onClick={() => setLeadModalOpen(true)}>
              Erstes Angebot erstellen
            </button>
          )}
        </div>
      ) : (
        <div className="leads-list">
          {filteredLeads.map(lead => (
            <motion.div
              key={lead.id}
              className="lead-card"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <div className="lead-header">
                <div className="lead-customer">
                  <h3>{lead.customer_firstname} {lead.customer_lastname}</h3>
                  <span className="lead-email">{lead.customer_email}</span>
                </div>
                <div className="lead-status">
                  <span
                    className="status-badge"
                    style={{
                      background: `${getLeadStatusColor(lead.status)}20`,
                      color: getLeadStatusColor(lead.status)
                    }}
                  >
                    {getLeadStatusLabel(lead.status)}
                  </span>
                </div>
              </div>

              <div className="lead-details">
                {lead.customer_phone && (
                  <div className="detail-item">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z" />
                    </svg>
                    <span>{lead.customer_phone}</span>
                  </div>
                )}
                {lead.customer_address && (
                  <div className="detail-item">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
                      <circle cx="12" cy="10" r="3" />
                    </svg>
                    <span>{lead.customer_address}</span>
                  </div>
                )}
                <div className="detail-item">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                    <line x1="8" y1="2" x2="8" y2="6" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                  </svg>
                  <span>{formatDate(lead.created_at)}</span>
                </div>
              </div>

              <div className="lead-footer">
                <div className="lead-price">
                  <span className="price-label">Gesamtsumme</span>
                  <span className="price-value">{formatPrice(lead.total_price)}</span>
                </div>
                <div className="lead-actions">
                  <button
                    className="btn-icon"
                    title="PDF anzeigen"
                    onClick={() => window.open(getLeadPdfUrl(lead.id), '_blank')}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                    </svg>
                  </button>
                  <button
                    className="btn-icon"
                    title="Details anzeigen"
                    onClick={() => handleViewDetails(lead.id)}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  </button>
                  <button
                    className="btn-icon delete"
                    title="Löschen"
                    onClick={() => setDeleteConfirmId(lead.id)}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                    </svg>
                  </button>
                  <button
                    className="btn-aufmass"
                    onClick={() => handleCreateAufmass(lead)}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" />
                      <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                      <line x1="12" y1="22.08" x2="12" y2="12" />
                    </svg>
                    Aufmaß erstellen
                  </button>
                </div>
              </div>

              {/* Delete Confirmation */}
              {deleteConfirmId === lead.id && (
                <div className="delete-confirm">
                  <p>Angebot wirklich löschen?</p>
                  <div className="confirm-actions">
                    <button className="btn-cancel" onClick={() => setDeleteConfirmId(null)}>Abbrechen</button>
                    <button className="btn-delete" onClick={() => handleDelete(lead.id)}>Löschen</button>
                  </div>
                </div>
              )}
            </motion.div>
          ))}
        </div>
      )}

      {/* Lead Form Modal */}
      <LeadFormModal
        isOpen={leadModalOpen}
        onClose={() => setLeadModalOpen(false)}
        onSuccess={() => {
          setLeadModalOpen(false);
          loadLeads();
        }}
      />

      {/* Detail Modal */}
      <AnimatePresence>
        {detailModalOpen && selectedLead && (
          <motion.div
            className="modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setDetailModalOpen(false)}
          >
            <motion.div
              className="detail-modal"
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              onClick={e => e.stopPropagation()}
            >
              <div className="modal-header">
                <h2>Angebot Details</h2>
                <button className="close-btn" onClick={() => setDetailModalOpen(false)}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="modal-body">
                <section className="detail-section">
                  <h3>Kunde</h3>
                  <p><strong>{selectedLead.customer_firstname} {selectedLead.customer_lastname}</strong></p>
                  <p>{selectedLead.customer_email}</p>
                  {selectedLead.customer_phone && <p>{selectedLead.customer_phone}</p>}
                  {selectedLead.customer_address && <p>{selectedLead.customer_address}</p>}
                </section>

                {selectedLead.items.length > 0 && (
                  <section className="detail-section">
                    <h3>Produkte</h3>
                    <div className="items-table">
                      {selectedLead.items.map(item => (
                        <div key={item.id} className="item-row">
                          <div className="item-info">
                            <span className="item-name">{item.product_name}</span>
                            <span className="item-dims">{item.breite} x {item.tiefe} cm</span>
                            <span className="item-qty">x {item.quantity}</span>
                          </div>
                          <span className="item-price">{formatPrice(item.total_price)}</span>
                          {(item.pi_ober_kante || item.pi_unter_kante || item.pi_gestell_farbe || item.pi_sicherheitglas || item.pi_pfostenanzahl) && (
                            <div className="item-specs">
                              {item.pi_ober_kante && <span>Ober Kante: {item.pi_ober_kante}</span>}
                              {item.pi_unter_kante && <span>Unter Kante: {item.pi_unter_kante}</span>}
                              {item.pi_gestell_farbe && <span>Gestell Farbe: {item.pi_gestell_farbe}</span>}
                              {item.pi_sicherheitglas && <span>Sicherheitglas: {item.pi_sicherheitglas}</span>}
                              {item.pi_pfostenanzahl && <span>Pfostenanzahl: {item.pi_pfostenanzahl}</span>}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {selectedLead.extras.length > 0 && (
                  <section className="detail-section">
                    <h3>Zusatzleistungen</h3>
                    <div className="items-table">
                      {selectedLead.extras.map(extra => (
                        <div key={extra.id} className="item-row">
                          <span className="item-name">{extra.description}</span>
                          <span className="item-price">{formatPrice(extra.price)}</span>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {selectedLead.notes && (
                  <section className="detail-section">
                    <h3>Notizen</h3>
                    <p className="notes-text">{selectedLead.notes}</p>
                  </section>
                )}

                <div className="detail-total">
                  {selectedLead.total_discount && selectedLead.total_discount > 0 ? (
                    <>
                      <div className="total-row subtotal-row">
                        <span>Zwischensumme:</span>
                        <span>{formatPrice(selectedLead.subtotal || (selectedLead.total_price + selectedLead.total_discount))}</span>
                      </div>
                      <div className="total-row discount-row">
                        <span>Rabatt:</span>
                        <span className="discount-value">-{formatPrice(selectedLead.total_discount)}</span>
                      </div>
                      <div className="total-row final-row">
                        <span>Gesamtsumme:</span>
                        <span className="total-price">{formatPrice(selectedLead.total_price)}</span>
                      </div>
                    </>
                  ) : (
                    <>
                      <span>Gesamtsumme:</span>
                      <span className="total-price">{formatPrice(selectedLead.total_price)}</span>
                    </>
                  )}
                </div>
              </div>

              <div className="modal-footer">
                <button className="btn-cancel" onClick={() => setDetailModalOpen(false)}>Schließen</button>
                <button
                  className="btn-secondary"
                  onClick={() => window.open(getLeadPdfUrl(selectedLead.id), '_blank')}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 16, height: 16 }}>
                    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="16" y1="13" x2="8" y2="13" />
                    <line x1="16" y1="17" x2="8" y2="17" />
                  </svg>
                  PDF anzeigen
                </button>
                <button className="btn-primary" onClick={() => {
                  setDetailModalOpen(false);
                  handleCreateAufmass(selectedLead);
                }}>
                  Aufmaß erstellen
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
