import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { getForms, deleteForm, getMontageteamStats, getMontageteams, updateForm, getImageUrl, getStoredUser, getStatusHistory, getAbnahme, saveAbnahme, uploadAbnahmeImages, getAbnahmeImages, getAbnahmeImageUrl, deleteAbnahmeImage, uploadImages, getPdfUrl, getPdfStatus, getForm, savePdf } from '../services/api';
import { generatePDF } from '../utils/pdfGenerator';
import type { AbnahmeImage } from '../services/api';
import type { FormData, MontageteamStats, Montageteam, StatusHistoryEntry, AbnahmeData } from '../services/api';
import { useStats } from '../AppWrapper';
import './Dashboard.css';

// Check if current user is admin
const isAdmin = () => {
  const user = getStoredUser();
  return user?.role === 'admin';
};

// Status options for forms - ordered workflow
const STATUS_OPTIONS = [
  { value: 'alle', label: 'Alle Aufmaße', color: '#7fa93d' },
  { value: 'auftrag_abgelehnt', label: 'Auftrag Abgelehnt', color: '#6b7280' },
  { value: 'neu', label: 'Aufmaß Genommen', color: '#8b5cf6' },
  { value: 'angebot_versendet', label: 'Angebot Versendet', color: '#a78bfa' },
  { value: 'auftrag_erteilt', label: 'Auftrag Erteilt', color: '#3b82f6' },
  { value: 'anzahlung', label: 'Anzahlung Erhalten', color: '#06b6d4' },
  { value: 'bestellt', label: 'Bestellt/In Bearbeitung', color: '#f59e0b' },
  { value: 'montage_geplant', label: 'Montage Geplant', color: '#a855f7' },
  { value: 'montage_gestartet', label: 'Montage Gestartet', color: '#ec4899' },
  { value: 'abnahme', label: 'Abnahme', color: '#10b981' },
  { value: 'reklamation_eingegangen', label: 'Reklamation Eingegangen', color: '#ef4444' },
  { value: 'reklamation_anerkannt', label: 'Reklamation Anerkannt', color: '#dc2626' },
  { value: 'reklamation_abgelehnt', label: 'Reklamation Abgelehnt', color: '#b91c1c' },
  { value: 'reklamation_in_bearbeitung', label: 'Reklamation in Bearbeitung', color: '#f97316' },
  { value: 'reklamation_in_planung', label: 'Reklamation in Planung', color: '#fb923c' },
  { value: 'reklamation_behoben', label: 'Reklamation Behoben', color: '#22c55e' },
  { value: 'reklamation_geschlossen', label: 'Reklamation Geschlossen', color: '#16a34a' },
  { value: 'papierkorb', label: 'Papierkorb', color: '#71717a' },
];

// Status order for edit lock check (after auftrag_erteilt, editing is locked for non-admins)
const STATUS_ORDER = [
  'auftrag_abgelehnt',
  'neu',
  'angebot_versendet',
  'auftrag_erteilt',  // Index 3 - lock starts AFTER this
  'anzahlung',
  'bestellt',
  'montage_geplant',
  'montage_gestartet',
  'abnahme',
  'reklamation_eingegangen',
  'reklamation_anerkannt',
  'reklamation_abgelehnt',
  'reklamation_in_bearbeitung',
  'reklamation_in_planung',
  'reklamation_behoben',
  'reklamation_geschlossen',
];

// Check if form editing is locked (status is after auftrag_erteilt)
const isFormLocked = (status: string): boolean => {
  const statusIndex = STATUS_ORDER.indexOf(status);
  const lockThreshold = STATUS_ORDER.indexOf('auftrag_erteilt');
  return statusIndex > lockThreshold;
};

// Check if status change is going backward
const isStatusBackward = (currentStatus: string, newStatus: string): boolean => {
  const currentIndex = STATUS_ORDER.indexOf(currentStatus);
  const newIndex = STATUS_ORDER.indexOf(newStatus);
  return newIndex < currentIndex;
};

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
  const [, setMontageteamStats] = useState<MontageteamStats[]>([]);
  const [montageteams, setMontageteams] = useState<Montageteam[]>([]);
  const [teamDropdownOpen, setTeamDropdownOpen] = useState<number | null>(null);
  const [statusDropdownOpen, setStatusDropdownOpen] = useState<number | null>(null);
  const [filterDropdownOpen, setFilterDropdownOpen] = useState(false);
  const [attachmentDropdownOpen, setAttachmentDropdownOpen] = useState<number | null>(null);
  // Status history modal
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [selectedFormHistory, setSelectedFormHistory] = useState<StatusHistoryEntry[]>([]);
  const [, setSelectedFormId] = useState<number | null>(null);
  // Abnahme modal
  const [abnahmeModalOpen, setAbnahmeModalOpen] = useState(false);
  const [abnahmeFormId, setAbnahmeFormId] = useState<number | null>(null);
  const [abnahmeData, setAbnahmeData] = useState<Partial<AbnahmeData>>({
    istFertig: false,
    hatProbleme: false,
    problemBeschreibung: '',
    maengelListe: [''],
    baustelleSauber: null,
    monteurNote: null,
    kundeName: '',
    kundeUnterschrift: false,
    bemerkungen: ''
  });
  const [abnahmeSaving, setAbnahmeSaving] = useState(false);
  // Mängel images
  const [maengelImages, setMaengelImages] = useState<AbnahmeImage[]>([]);
  const [maengelImageFiles, setMaengelImageFiles] = useState<File[]>([]);
  // Status date modal (for all status changes)
  const [statusDateModalOpen, setStatusDateModalOpen] = useState(false);
  const [statusDateFormId, setStatusDateFormId] = useState<number | null>(null);
  const [statusDateValue, setStatusDateValue] = useState<string>('');
  const [pendingStatus, setPendingStatus] = useState<string>('');

  // Document/Video upload state
  const [uploadingDocFormId, setUploadingDocFormId] = useState<number | null>(null);
  const docInputRef = useRef<HTMLInputElement>(null);


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

  // Open attachment upload for locked forms (non-admin users)
  const handleOpenAttachmentUpload = (id: number) => {
    setUploadingDocFormId(id);
    docInputRef.current?.click();
  };

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
    // Get current form status
    const form = forms.find(f => f.id === formId);
    const currentStatus = form ? getFormStatus(form) : 'neu';

    // Prevent non-admin users from going backward in status
    if (!isAdmin() && isStatusBackward(currentStatus, newStatus)) {
      alert('Status kann nur von einem Admin zurückgesetzt werden.');
      setStatusDropdownOpen(null);
      return;
    }

    // If selecting abnahme status, open abnahme modal first
    if (newStatus === 'abnahme') {
      setAbnahmeFormId(formId);
      // Reset image states
      setMaengelImageFiles([]);
      // Load existing abnahme data and images
      try {
        const [existingAbnahme, existingImages] = await Promise.all([
          getAbnahme(formId),
          getAbnahmeImages(formId)
        ]);
        if (existingAbnahme) {
          setAbnahmeData(existingAbnahme);
        } else {
          setAbnahmeData({
            istFertig: false,
            hatProbleme: false,
            problemBeschreibung: '',
            maengelListe: [''],
            baustelleSauber: null,
            monteurNote: null,
            kundeName: '',
            kundeUnterschrift: false,
            bemerkungen: ''
          });
        }
        setMaengelImages(existingImages || []);
      } catch {
        setAbnahmeData({
          istFertig: false,
          hatProbleme: false,
          problemBeschreibung: '',
          maengelListe: [''],
          baustelleSauber: null,
          monteurNote: null,
          kundeName: '',
          kundeUnterschrift: false,
          bemerkungen: ''
        });
        setMaengelImages([]);
      }
      setAbnahmeModalOpen(true);
      setStatusDropdownOpen(null);
      return;
    }

    // For all other status changes, open date picker modal
    setStatusDateFormId(formId);
    setPendingStatus(newStatus);
    // Set default date to today
    const today = new Date().toISOString().split('T')[0];
    setStatusDateValue(today);
    setStatusDateModalOpen(true);
    setStatusDropdownOpen(null);
  };

  // Open status history modal
  const handleOpenHistory = async (formId: number) => {
    try {
      const history = await getStatusHistory(formId);
      setSelectedFormHistory(history);
      setSelectedFormId(formId);
      setHistoryModalOpen(true);
    } catch (err) {
      console.error('Error loading status history:', err);
      alert('Fehler beim Laden der Status-Historie');
    }
  };

  // Check if abnahme is locked (already completed with customer signature)
  const isAbnahmeLocked = !!(abnahmeData.kundeUnterschrift && abnahmeData.abnahmeDatum);

  // Check if Abnahme photos are required but missing (min 2 photos for both cases)
  const totalPhotos = maengelImages.length + maengelImageFiles.length;
  const abnahmePhotosRequired = (abnahmeData.istFertig || abnahmeData.hatProbleme) && totalPhotos < 2;

  // Save abnahme and update status
  const handleSaveAbnahme = async () => {
    if (!abnahmeFormId) return;

    // Validate: If ES GIBT MÄNGEL, photos are required
    if (abnahmeData.hatProbleme && (maengelImages.length + maengelImageFiles.length === 0)) {
      alert('Bitte fügen Sie mindestens ein Foto der Mängel hinzu.');
      return;
    }

    setAbnahmeSaving(true);
    try {
      // Save abnahme data
      await saveAbnahme(abnahmeFormId, abnahmeData);

      // Upload new mängel images if any
      if (maengelImageFiles.length > 0) {
        await uploadAbnahmeImages(abnahmeFormId, maengelImageFiles);
        setMaengelImageFiles([]);
      }

      // Determine status: ES GIBT MÄNGEL → reklamation_eingegangen, otherwise → abnahme
      const newStatus = abnahmeData.hatProbleme ? 'reklamation_eingegangen' : 'abnahme';

      await updateForm(abnahmeFormId, { status: newStatus });
      // Update local state
      setForms(forms.map(f =>
        f.id === abnahmeFormId
          ? { ...f, status: newStatus }
          : f
      ));
      setAbnahmeModalOpen(false);
      setAbnahmeFormId(null);
      setMaengelImages([]);
      refreshStats();
    } catch (err) {
      console.error('Error saving abnahme:', err);
      alert('Fehler beim Speichern der Abnahme');
    } finally {
      setAbnahmeSaving(false);
    }
  };

  // Handle document/video upload
  const handleDocumentUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !uploadingDocFormId) return;

    const file = files[0];
    const maxSize = 10 * 1024 * 1024; // 10MB

    if (file.size > maxSize) {
      alert('Die Datei ist zu groß. Maximale Größe: 10MB');
      return;
    }

    try {
      await uploadImages(uploadingDocFormId, [file]);
      // Refresh forms to show new file
      const formsData = await getForms();
      setForms(formsData);
      setAttachmentDropdownOpen(null);
    } catch (err) {
      console.error('Error uploading document:', err);
      alert('Fehler beim Hochladen der Datei');
    } finally {
      setUploadingDocFormId(null);
      if (docInputRef.current) {
        docInputRef.current.value = '';
      }
    }
  };

  // Format date for display
  const formatDateTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Generate mailto link with status-based email template
  const getEmailMailtoLink = (form: FormData): string => {
    const kundenName = `${form.kundeVorname} ${form.kundeNachname}`.trim();
    const status = getFormStatus(form);
    const montageDatumFormatted = form.montageDatum
      ? new Date(form.montageDatum).toLocaleDateString('de-DE')
      : '________';

    let subject = '';
    let body = '';

    switch (status) {
      case 'anzahlung':
        subject = 'Information zu Ihrer Bestellung/Anzahlung';
        body = `Sehr geehrte/r ${kundenName},

Ihre Anzahlung in Höhe von ______ Euro ist auf unserem Konto eingegangen. Sobald Ihre Bestellung in den Produktionsplan aufgenommen wurde, werden wir Sie zusätzlich informieren.

Vielen Dank, dass Sie sich für Aylux entschieden haben. Unsere voraussichtliche Montagefrist beträgt ca. 8–10 Wochen. Wir danken Ihnen für Ihre Geduld. Diese E-Mail stellt keinen Montagetermin dar. Nachdem Ihre Bestellung speziell nach den Maßen Ihres Hauses produziert wurde, werden wir Sie zur Vereinbarung eines Montagetermins erneut kontaktieren. Bitte verfolgen Sie daher unsere Informations-E-Mails.

Gerne beantworten wir Ihre Fragen, die Sie in dieser Zeit stellen möchten.

Mit freundlichen Grüßen
Aylux Team`;
        break;

      case 'bestellt':
        subject = 'Information zu Ihrer Bestellung';
        body = `Sehr geehrte/r ${kundenName},

Vielen Dank, dass Sie sich für Aylux entschieden haben. Ihre Bestellung wurde in die Produktion aufgenommen. Die Produktionszeit beträgt etwa 4 Wochen. Wir werden uns so bald wie möglich erneut mit Ihnen in Verbindung setzen, um einen Montagetermin zu vereinbaren. Bitte verfolgen Sie daher unsere Informations-E-Mails. Vielen Dank für Ihre Geduld.

Gerne beantworten wir Ihre Fragen, die Sie in dieser Zeit stellen möchten.

Mit freundlichen Grüßen
Aylux Team`;
        break;

      case 'montage_geplant':
        subject = 'Information zum Montagetermin Ihrer Bestellung';
        body = `Sehr geehrte/r ${kundenName},

der Produktionsprozess des von Ihnen bestellten Produkts ist abgeschlossen, und der vorgesehene Montagetermin ist der ${montageDatumFormatted}.

Bitte teilen Sie uns mit, ob der genannte Termin für Sie passend ist. Sollte der geplante Termin für Sie nicht geeignet sein, bitten wir Sie, uns die für Sie passenden Tage oder möglichen Zeiträume mitzuteilen. Nach Ihrer Bestätigung wird die Montageplanung finalisiert.

Bei Fragen stehen wir Ihnen jederzeit gerne zur Verfügung.

Vielen Dank für Ihr Interesse und Ihre Zusammenarbeit. Wir wünschen Ihnen einen schönen Tag.

Mit freundlichen Grüßen
Aylux Team`;
        break;

      case 'reklamation':
        subject = 'Information zu Reklamation / Restarbeiten';
        body = `Sehr geehrte/r ${kundenName},

wir möchten Sie darüber informieren, dass die erforderlichen Arbeiten im Zusammenhang mit Ihrer Reklamation / den Restarbeiten durchgeführt wurden. Die vorgenommenen bzw. noch vorzunehmenden Anpassungen sind in dem beigefügten Dokument detailliert aufgeführt. Wir bitten Sie, dieses entsprechend zu prüfen.

Wir werden Sie in kürzester Zeit bezüglich eines Montagetermins zur finalen Durchführung informieren. Bitte verfolgen Sie hierzu unsere weiteren Informations-E-Mails.

Sollten Sie in der Zwischenzeit Fragen haben, stehen wir Ihnen jederzeit gerne zur Verfügung.

Vielen Dank für Ihre Geduld und Ihr Verständnis.

Mit freundlichen Grüßen
Aylux Team`;
        break;

      default:
        // No template for other statuses, just open empty email
        return `mailto:${form.kundeEmail}`;
    }

    return `mailto:${form.kundeEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  // Open stored PDF in new tab - regenerate if outdated
  const [pdfGenerating, setPdfGenerating] = useState<number | null>(null);

  const handleOpenPDF = async (formId: number) => {
    try {
      // Check if PDF needs regeneration
      const status = await getPdfStatus(formId);

      if (status.needsRegeneration) {
        setPdfGenerating(formId);
        // Get fresh form data including abnahme
        const [formData, abnahmeData, abnahmeImages] = await Promise.all([
          getForm(formId),
          getAbnahme(formId),
          getAbnahmeImages(formId)
        ]);

        const result = await generatePDF({
          ...formData,
          id: String(formData.id),
          productSelection: {
            category: formData.category,
            productType: formData.productType,
            model: formData.model ? formData.model.split(',') : []
          },
          bilder: formData.bilder || [],
          abnahme: abnahmeData ? {
            ...abnahmeData,
            maengelBilder: abnahmeImages || []
          } : undefined
        }, { returnBlob: true });

        if (result && result.blob) {
          await savePdf(formId, result.blob);
        }
        setPdfGenerating(null);
      }

      // Open PDF in new tab
      window.open(getPdfUrl(formId), '_blank');
    } catch (err) {
      console.error('Error opening PDF:', err);
      setPdfGenerating(null);
      // Fallback - just try to open it
      window.open(getPdfUrl(formId), '_blank');
    }
  };

  const confirmDelete = async () => {
    if (formToDelete) {
      try {
        const form = forms.find(f => f.id === formToDelete);
        const isInTrash = form?.status === 'papierkorb';

        if (isInTrash) {
          // Permanently delete if already in trash
          await deleteForm(formToDelete);
          setForms(forms.filter(f => f.id !== formToDelete));
        } else {
          // Move to trash (papierkorb)
          await updateForm(formToDelete, { status: 'papierkorb' });
          setForms(forms.map(f =>
            f.id === formToDelete ? { ...f, status: 'papierkorb' } : f
          ));
        }
        refreshStats();
        setDeleteModalOpen(false);
        setFormToDelete(null);
      } catch (err) {
        alert('Fehler beim Löschen');
      }
    }
  };

  // Restore form from trash
  const handleRestore = async (formId: number) => {
    try {
      await updateForm(formId, { status: 'neu' });
      setForms(forms.map(f =>
        f.id === formId ? { ...f, status: 'neu' } : f
      ));
      refreshStats();
    } catch (err) {
      alert('Fehler beim Wiederherstellen');
    }
  };

  const filteredForms = forms.filter(form => {
    const matchesSearch =
      form.kundeVorname?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      form.kundeNachname?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      form.kundenlokation?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      form.category?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      form.productType?.toLowerCase().includes(searchTerm.toLowerCase());
    // "Alle" excludes Papierkorb, must explicitly select Papierkorb to see trash
    const matchesFilter = filterStatus === 'alle'
      ? form.status !== 'papierkorb'
      : form.status === filterStatus;
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

      {/* Toolbar */}
      <div className="content-toolbar">
        <div className="toolbar-left">
          <div className="search-container">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" /></svg>
            <input type="text" placeholder="Suchen..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            {searchTerm && <button className="clear-search" onClick={() => setSearchTerm('')}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg></button>}
          </div>
          <div className="view-toggle">
            <button className={`view-btn ${viewMode === 'grid' ? 'active' : ''}`} onClick={() => setViewMode('grid')}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></svg>
            </button>
            <button className={`view-btn ${viewMode === 'list' ? 'active' : ''}`} onClick={() => setViewMode('list')}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" /></svg>
            </button>
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
                    ? forms.filter(f => f.status !== 'papierkorb').length
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
              <span className="dropdown-count">{filterStatus === 'alle' ? forms.filter(f => f.status !== 'papierkorb').length : filteredForms.length}</span>
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
                          ? forms.filter(f => f.status !== 'papierkorb').length
                          : forms.filter(f => f.status === option.value).length}
                      </span>
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
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
                          {/* Status date under status dropdown - show for all statuses */}
                          {(form.statusDate || (getFormStatus(form) === 'montage_geplant' && form.montageDatum)) && getFormStatus(form) !== 'papierkorb' && (
                            <div className="montage-date-badge" style={{ '--badge-color': getStatusColor(getFormStatus(form)) } as React.CSSProperties}>
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
                              <span>{new Date(form.statusDate || form.montageDatum!).toLocaleDateString('de-DE')}</span>
                            </div>
                          )}
                          {/* Papierkorb deletion warning */}
                          {getFormStatus(form) === 'papierkorb' && form.papierkorbDate && (
                            <div className="montage-date-badge deletion-warning" style={{ '--badge-color': '#ef4444' } as React.CSSProperties}>
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
                              <span>Löschung: {(() => { const d = new Date(form.papierkorbDate); d.setDate(d.getDate() + 30); return d.toLocaleDateString('de-DE'); })()}</span>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="status-selector">
                          <div
                            className="status-pill-static"
                            style={{ backgroundColor: getStatusColor(getFormStatus(form)) }}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenHistory(form.id!);
                            }}
                            title="Status-Historie anzeigen"
                          >
                            {getStatusLabel(getFormStatus(form)).split('/')[0]}
                          </div>
                          {/* Status date under status for non-admin - show for all statuses */}
                          {(form.statusDate || (getFormStatus(form) === 'montage_geplant' && form.montageDatum)) && getFormStatus(form) !== 'papierkorb' && (
                            <div className="montage-date-badge" style={{ '--badge-color': getStatusColor(getFormStatus(form)) } as React.CSSProperties}>
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
                              <span>{new Date(form.statusDate || form.montageDatum!).toLocaleDateString('de-DE')}</span>
                            </div>
                          )}
                          {/* Papierkorb deletion warning */}
                          {getFormStatus(form) === 'papierkorb' && form.papierkorbDate && (
                            <div className="montage-date-badge deletion-warning" style={{ '--badge-color': '#ef4444' } as React.CSSProperties}>
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
                              <span>Löschung: {(() => { const d = new Date(form.papierkorbDate); d.setDate(d.getDate() + 30); return d.toLocaleDateString('de-DE'); })()}</span>
                            </div>
                          )}
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
                                handleOpenPDF(form.id!);
                                setAttachmentDropdownOpen(null);
                              }}
                            >
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14,2 14,8 20,8" /><path d="M12 11v6M9 14h6" /></svg>
                              <span>PDF Vorschau</span>
                            </button>
                            <button
                              className="attachment-option upload-doc"
                              onClick={() => {
                                setUploadingDocFormId(form.id!);
                                docInputRef.current?.click();
                              }}
                            >
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>
                              <span>Datei hochladen</span>
                              <span className="upload-hint">(max. 10MB)</span>
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
                            {form.media_files && form.media_files.length > 0 && (
                              <>
                                <div className="attachment-divider">Fotos & Videos</div>
                                {form.media_files.map((media) => (
                                  <a
                                    key={media.id}
                                    href={getImageUrl(media.id)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className={`attachment-option media-file ${media.file_type.startsWith('video/') ? 'video' : 'image'}`}
                                    onClick={() => setAttachmentDropdownOpen(null)}
                                  >
                                    {media.file_type.startsWith('video/') ? (
                                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="23 7 16 12 23 17 23 7" /><rect x="1" y="5" width="15" height="14" rx="2" ry="2" /></svg>
                                    ) : (
                                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></svg>
                                    )}
                                    <span className="media-filename">{media.file_name}</span>
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
                        href={getEmailMailtoLink(form)}
                        className="action-btn email"
                        title={`E-Mail an ${form.kundeEmail}`}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" /></svg>
                      </a>
                    )}
                    {/* BEARBEITEN - only for admin or unlocked forms */}
                    {(isAdmin() || !isFormLocked(getFormStatus(form))) ? (
                      <button className="action-btn edit" onClick={() => handleEditForm(form.id!)}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                        <span>Bearbeiten</span>
                      </button>
                    ) : (
                      <button className="action-btn attachment" onClick={() => handleOpenAttachmentUpload(form.id!)}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" /></svg>
                        <span>Anhang</span>
                      </button>
                    )}
                    {/* Restore button - only for forms in Papierkorb */}
                    {getFormStatus(form) === 'papierkorb' && (
                      <button className="action-btn restore" onClick={() => handleRestore(form.id!)} title="Wiederherstellen">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" /></svg>
                      </button>
                    )}
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
        {deleteModalOpen && (() => {
          const formToDeleteData = forms.find(f => f.id === formToDelete);
          const isInTrash = formToDeleteData?.status === 'papierkorb';
          // Calculate deletion date (30 days from now for new trash, or from papierkorbDate if exists)
          const deletionDate = new Date();
          deletionDate.setDate(deletionDate.getDate() + 30);
          const deletionDateStr = deletionDate.toLocaleDateString('de-DE');
          return (
            <motion.div className="modal-overlay-modern" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setDeleteModalOpen(false)}>
              <motion.div className="modal-modern" initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }} onClick={(e) => e.stopPropagation()}>
                <h3>{isInTrash ? 'Endgültig löschen?' : 'In Papierkorb verschieben?'}</h3>
                {isInTrash ? (
                  <p>Diese Aktion kann nicht rückgängig gemacht werden. Das Aufmaß wird endgültig gelöscht.</p>
                ) : (
                  <>
                    <p>Das Aufmaß wird in den Papierkorb verschoben.</p>
                    <div className="delete-warning-box">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                        <line x1="12" y1="9" x2="12" y2="13"/>
                        <line x1="12" y1="17" x2="12.01" y2="17"/>
                      </svg>
                      <div className="delete-warning-text">
                        <strong>Achtung:</strong> Das Aufmaß wird automatisch am <strong>{deletionDateStr}</strong> endgültig gelöscht, falls nicht wiederhergestellt.
                      </div>
                    </div>
                  </>
                )}
                <div className="modal-actions-modern">
                  <button className="modal-btn secondary" onClick={() => setDeleteModalOpen(false)}>Abbrechen</button>
                  <button className="modal-btn danger" onClick={confirmDelete}>
                    {isInTrash ? 'Endgültig löschen' : 'In Papierkorb'}
                  </button>
                </div>
              </motion.div>
            </motion.div>
          );
        })()}
      </AnimatePresence>

      {/* Status History Modal */}
      <AnimatePresence>
        {historyModalOpen && (
          <motion.div className="modal-overlay-modern" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setHistoryModalOpen(false)}>
            <motion.div className="modal-modern modal-large" initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }} onClick={(e) => e.stopPropagation()}>
              <h3>Status-Historie</h3>
              <div className="status-history-list">
                {selectedFormHistory.length === 0 ? (
                  <p className="history-empty">Keine Status-Änderungen vorhanden</p>
                ) : (
                  selectedFormHistory.map((entry) => (
                    <div key={entry.id} className="history-entry">
                      <div className="history-status">
                        <span className="status-dot" style={{ backgroundColor: getStatusColor(entry.status) }} />
                        <span className="status-label">{getStatusLabel(entry.status)}</span>
                      </div>
                      <div className="history-meta">
                        <span className="history-date">{formatDateTime(entry.changed_at)}</span>
                        {entry.changed_by_name && <span className="history-user">von {entry.changed_by_name}</span>}
                      </div>
                      {entry.notes && <div className="history-notes">{entry.notes}</div>}
                    </div>
                  ))
                )}
              </div>
              <div className="modal-actions-modern">
                <button className="modal-btn secondary" onClick={() => setHistoryModalOpen(false)}>Schließen</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Status Date Modal - for all status changes */}
      <AnimatePresence>
        {statusDateModalOpen && (
          <motion.div
            className="modal-overlay-modern"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setStatusDateModalOpen(false)}
          >
            <motion.div
              className="modal-modern montage-modal"
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3>{STATUS_OPTIONS.find(s => s.value === pendingStatus)?.label || 'Status ändern'}</h3>
              <p className="montage-modal-description">Datum für diese Statusänderung</p>
              <div className="montage-date-input">
                <label>Datum</label>
                <input
                  type="date"
                  value={statusDateValue}
                  onChange={(e) => setStatusDateValue(e.target.value)}
                />
              </div>
              <div className="modal-actions">
                <button
                  className="modal-cancel"
                  onClick={() => setStatusDateModalOpen(false)}
                >
                  Abbrechen
                </button>
                <button
                  className="modal-confirm"
                  disabled={!statusDateValue}
                  onClick={async () => {
                    if (!statusDateFormId || !statusDateValue || !pendingStatus) return;
                    try {
                      // Update form with status and date
                      const updateData: { status: string; statusDate?: string; montageDatum?: string } = {
                        status: pendingStatus,
                        statusDate: statusDateValue
                      };
                      // Also update montageDatum for montage_geplant status
                      if (pendingStatus === 'montage_geplant') {
                        updateData.montageDatum = statusDateValue;
                      }
                      await updateForm(statusDateFormId, updateData);
                      setForms(forms.map(f =>
                        f.id === statusDateFormId
                          ? {
                              ...f,
                              status: pendingStatus,
                              statusDate: statusDateValue,
                              ...(pendingStatus === 'montage_geplant' ? { montageDatum: statusDateValue } : {})
                            }
                          : f
                      ));
                      setStatusDateModalOpen(false);
                      setStatusDateFormId(null);
                      setStatusDateValue('');
                      setPendingStatus('');
                      refreshStats();
                    } catch (err) {
                      console.error('Error updating status:', err);
                      alert('Fehler beim Speichern des Status');
                    }
                  }}
                >
                  Speichern
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Abnahme Modal */}
      <AnimatePresence>
        {abnahmeModalOpen && (
          <motion.div className="modal-overlay-modern" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setAbnahmeModalOpen(false)}>
            <motion.div className="modal-modern modal-large abnahme-modal" initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }} onClick={(e) => e.stopPropagation()}>
              <h3>Abnahme-Protokoll</h3>
              {/* Locked Banner */}
              {isAbnahmeLocked && (
                <div className="abnahme-locked-banner">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0110 0v4" />
                  </svg>
                  <span>Diese Abnahme wurde bereits abgeschlossen und kann nicht mehr bearbeitet werden.</span>
                </div>
              )}
              <div className={`abnahme-form ${isAbnahmeLocked ? 'locked' : ''}`}>
                {/* Status Selection - Mutually Exclusive */}
                <div className="abnahme-status-selection">
                  <label className="abnahme-status-label">Status der Arbeit</label>
                  <div className="abnahme-radio-group">
                    <label className={`abnahme-radio-option ${abnahmeData.istFertig && !abnahmeData.hatProbleme ? 'selected' : ''}`}>
                      <input
                        type="radio"
                        name="abnahmeStatus"
                        checked={abnahmeData.istFertig === true && abnahmeData.hatProbleme === false}
                        disabled={isAbnahmeLocked}
                        onChange={() => setAbnahmeData({
                          ...abnahmeData,
                          istFertig: true,
                          hatProbleme: false,
                          maengelListe: ['']
                        })}
                      />
                      <span className="radio-icon"></span>
                      <span className="radio-text">ARBEIT IST FERTIG</span>
                    </label>
                    <label className={`abnahme-radio-option ${abnahmeData.hatProbleme ? 'selected' : ''}`}>
                      <input
                        type="radio"
                        name="abnahmeStatus"
                        checked={abnahmeData.hatProbleme === true}
                        disabled={isAbnahmeLocked}
                        onChange={() => setAbnahmeData({
                          ...abnahmeData,
                          istFertig: false,
                          hatProbleme: true
                        })}
                      />
                      <span className="radio-icon"></span>
                      <span className="radio-text">ES GIBT MÄNGEL</span>
                    </label>
                  </div>
                </div>

                {/* Common Fields - shown for both ARBEIT IST FERTIG and ES GIBT MÄNGEL */}
                {(abnahmeData.istFertig || abnahmeData.hatProbleme) && (
                  <motion.div
                    className="abnahme-common-section"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                  >
                    {/* Baustelle Sauber */}
                    <div className="abnahme-row">
                      <label className="abnahme-field-label">Baustelle wurde sauber und aufgeräumt gelassen</label>
                      <div className="abnahme-ja-nein-buttons">
                        <button
                          type="button"
                          className={`abnahme-ja-nein-btn ${abnahmeData.baustelleSauber === 'ja' ? 'active' : ''}`}
                          onClick={() => setAbnahmeData({ ...abnahmeData, baustelleSauber: 'ja' })}
                        >
                          JA
                        </button>
                        <button
                          type="button"
                          className={`abnahme-ja-nein-btn ${abnahmeData.baustelleSauber === 'nein' ? 'active' : ''}`}
                          onClick={() => setAbnahmeData({ ...abnahmeData, baustelleSauber: 'nein' })}
                        >
                          NEIN
                        </button>
                      </div>
                    </div>

                    {/* Monteur Note */}
                    <div className="abnahme-row">
                      <label className="abnahme-field-label">Bitte bewerten Sie Monteure Arbeit mit Schulnoten (1-6)</label>
                      <div className="abnahme-note-buttons">
                        {[1, 2, 3, 4, 5, 6].map(note => (
                          <button
                            key={note}
                            type="button"
                            className={`abnahme-note-btn ${abnahmeData.monteurNote === note ? 'active' : ''}`}
                            onClick={() => setAbnahmeData({ ...abnahmeData, monteurNote: note })}
                          >
                            {note}
                          </button>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* ES GIBT MÄNGEL - Mängelliste only */}
                {abnahmeData.hatProbleme && (
                  <motion.div
                    className="abnahme-maengel-section"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                  >
                    {/* Numbered Defects List */}
                    <div className="abnahme-row">
                      <label className="abnahme-field-label">Mängelliste</label>
                      <div className="abnahme-maengel-list">
                        {(abnahmeData.maengelListe || ['']).map((mangel, idx) => (
                          <div key={idx} className="abnahme-mangel-item">
                            <span className="mangel-number">{idx + 1})</span>
                            <input
                              type="text"
                              value={mangel}
                              onChange={(e) => {
                                const newList = [...(abnahmeData.maengelListe || [''])];
                                newList[idx] = e.target.value;
                                setAbnahmeData({ ...abnahmeData, maengelListe: newList });
                              }}
                              placeholder={`Mangel ${idx + 1} beschreiben...`}
                            />
                            {(abnahmeData.maengelListe || []).length > 1 && (
                              <button
                                type="button"
                                className="remove-mangel-btn"
                                onClick={() => {
                                  const newList = (abnahmeData.maengelListe || []).filter((_, i) => i !== idx);
                                  setAbnahmeData({ ...abnahmeData, maengelListe: newList });
                                }}
                              >
                                ×
                              </button>
                            )}
                          </div>
                        ))}
                        <button
                          type="button"
                          className="add-mangel-btn"
                          onClick={() => {
                            setAbnahmeData({
                              ...abnahmeData,
                              maengelListe: [...(abnahmeData.maengelListe || []), '']
                            });
                          }}
                        >
                          + Weiteren Mangel hinzufügen
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* Abnahme Fotos Section - shown for both ARBEIT IST FERTIG and ES GIBT MÄNGEL */}
                {(abnahmeData.istFertig || abnahmeData.hatProbleme) && (
                  <motion.div
                    className="abnahme-fotos-common-section"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                  >
                    <div className="abnahme-row">
                      <label className="abnahme-field-label">
                        Abnahme Fotos <span className="required" style={{ color: '#ef4444' }}>* (min. 2)</span>
                      </label>
                      {abnahmePhotosRequired && (
                        <div className="maengel-fotos-required">
                          Mindestens 2 Fotos sind erforderlich
                        </div>
                      )}
                      <div className="maengel-fotos-section">
                        {/* Existing images from DB */}
                        {maengelImages.length > 0 && (
                          <div className="maengel-fotos-grid">
                            {maengelImages.map((img) => (
                              <div key={img.id} className="maengel-foto-item">
                                <img
                                  src={getAbnahmeImageUrl(img.id)}
                                  alt={img.file_name}
                                  onClick={() => window.open(getAbnahmeImageUrl(img.id), '_blank')}
                                />
                                <button
                                  type="button"
                                  className="remove-foto-btn"
                                  onClick={async () => {
                                    try {
                                      await deleteAbnahmeImage(img.id);
                                      setMaengelImages(maengelImages.filter(i => i.id !== img.id));
                                    } catch (err) {
                                      console.error('Error deleting image:', err);
                                    }
                                  }}
                                >
                                  ×
                                </button>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* New images to upload */}
                        {maengelImageFiles.length > 0 && (
                          <div className="maengel-fotos-grid pending">
                            {maengelImageFiles.map((file, idx) => (
                              <div key={idx} className="maengel-foto-item pending">
                                <img
                                  src={URL.createObjectURL(file)}
                                  alt={file.name}
                                />
                                <span className="pending-badge">Neu</span>
                                <button
                                  type="button"
                                  className="remove-foto-btn"
                                  onClick={() => {
                                    setMaengelImageFiles(maengelImageFiles.filter((_, i) => i !== idx));
                                  }}
                                >
                                  ×
                                </button>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Upload button */}
                        <label className="add-foto-btn">
                          <input
                            type="file"
                            accept="image/*"
                            multiple
                            onChange={(e) => {
                              const files = Array.from(e.target.files || []);
                              setMaengelImageFiles([...maengelImageFiles, ...files]);
                              e.target.value = '';
                            }}
                          />
                          📷 Fotos hinzufügen
                        </label>
                      </div>
                    </div>
                  </motion.div>
                )}

                <div className="abnahme-row">
                  <label>Bemerkungen</label>
                  <textarea
                    value={abnahmeData.bemerkungen || ''}
                    onChange={(e) => setAbnahmeData({ ...abnahmeData, bemerkungen: e.target.value })}
                    placeholder="Zusätzliche Bemerkungen..."
                    rows={3}
                  />
                </div>

                <div className="abnahme-divider">Kundenbestätigung</div>

                <div className="abnahme-row">
                  <label>Name des Kunden</label>
                  <input
                    type="text"
                    value={abnahmeData.kundeName || ''}
                    onChange={(e) => setAbnahmeData({ ...abnahmeData, kundeName: e.target.value })}
                    placeholder="Vor- und Nachname"
                  />
                </div>

                <div className="abnahme-row">
                  <label className="abnahme-checkbox confirmation">
                    <input
                      type="checkbox"
                      checked={abnahmeData.kundeUnterschrift || false}
                      onChange={(e) => setAbnahmeData({ ...abnahmeData, kundeUnterschrift: e.target.checked })}
                    />
                    <span>Kunde hat die Abnahme bestätigt</span>
                  </label>
                </div>
              </div>

              <div className="modal-actions-modern">
                <button className="modal-btn secondary" onClick={() => setAbnahmeModalOpen(false)}>
                  {isAbnahmeLocked ? 'Schließen' : 'Abbrechen'}
                </button>
                {!isAbnahmeLocked && (
                  <button
                    className="modal-btn primary"
                    onClick={handleSaveAbnahme}
                    disabled={abnahmeSaving || abnahmePhotosRequired}
                    title={abnahmePhotosRequired ? 'Mindestens 2 Fotos sind erforderlich' : ''}
                  >
                    {abnahmeSaving ? 'Speichern...' : 'Abnahme speichern'}
                  </button>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hidden file input for document/video upload */}
      <input
        type="file"
        ref={docInputRef}
        style={{ display: 'none' }}
        accept=".pdf,.doc,.docx,.xls,.xlsx,.mp4,.mov,.avi,.webm,.jpg,.jpeg,.png,.gif"
        onChange={handleDocumentUpload}
      />

    </>
  );
};

export default Dashboard;
