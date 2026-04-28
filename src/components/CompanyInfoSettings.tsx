import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { getBranchCompanyInfo, saveBranchCompanyInfo } from '../services/api';
import type { BranchCompanyInfo } from '../services/api';
import { invalidateCompanyInfoCache } from '../utils/companyInfoCache';
import { useToast } from './Toast';

interface CompanyInfoSettingsProps {
  onClose: () => void;
}

const emptyInfo: BranchCompanyInfo = {
  company_name: '',
  company_strasse: '',
  company_plz: '',
  company_ort: '',
  company_telefon: '',
  company_email: '',
  company_ust_id: '',
  company_web: '',
  company_steuernr: '',
  company_iban: '',
  company_bic: '',
  company_bank_name: '',
  company_geschaeftsfuehrer: '',
  company_handelsregister: ''
};

export default function CompanyInfoSettings({ onClose }: CompanyInfoSettingsProps) {
  const toast = useToast();
  const [info, setInfo] = useState<BranchCompanyInfo>(emptyInfo);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await getBranchCompanyInfo();
        if (!cancelled) setInfo({ ...emptyInfo, ...data });
      } catch (err) {
        console.error('Error loading company info:', err);
        toast.error('Fehler', 'Firmenangaben konnten nicht geladen werden.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const update = (field: keyof BranchCompanyInfo, value: string) => {
    setInfo(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    if (!info.company_name || !info.company_strasse || !info.company_plz ||
        !info.company_ort || !info.company_telefon || !info.company_email ||
        !info.company_ust_id) {
      toast.warning('Pflichtfelder fehlen', 'Bitte alle mit * markierten Felder ausfüllen.');
      return;
    }
    setSaving(true);
    try {
      await saveBranchCompanyInfo(info);
      invalidateCompanyInfoCache();
      toast.success('Gespeichert', 'Firmenangaben wurden erfolgreich gespeichert. Neue PDFs verwenden diese Angaben.');
    } catch (err) {
      toast.error('Fehler', err instanceof Error ? err.message : 'Speichern fehlgeschlagen');
    } finally {
      setSaving(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '8px 12px',
    fontSize: '14px',
    background: 'var(--bg-secondary)',
    border: '1px solid var(--border-primary)',
    borderRadius: '6px',
    color: 'var(--text-primary)',
    outline: 'none'
  };

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: '12px',
    color: 'var(--text-tertiary)',
    marginBottom: '6px',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    fontWeight: 600
  };

  const fieldGroup = (label: string, field: keyof BranchCompanyInfo, required = false, placeholder = '', halfWidth = false) => (
    <div style={{ flex: halfWidth ? '1' : '1 1 100%', minWidth: halfWidth ? '180px' : 'auto', marginBottom: '14px' }}>
      <label style={labelStyle}>{label}{required && <span style={{ color: '#ef4444' }}> *</span>}</label>
      <input
        type="text"
        value={info[field]}
        onChange={(e) => update(field, e.target.value)}
        placeholder={placeholder}
        style={inputStyle}
      />
    </div>
  );

  if (loading) {
    return (
      <motion.div
        className="modal-overlay-modern"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          className="admin-panel-modal"
          style={{ maxWidth: '640px', padding: '40px', textAlign: 'center' }}
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
        >
          <p style={{ color: 'var(--text-secondary)' }}>Wird geladen...</p>
        </motion.div>
      </motion.div>
    );
  }

  return (
    <motion.div
      className="modal-overlay-modern"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="admin-panel-modal"
        style={{ maxWidth: '720px', maxHeight: '90vh', overflowY: 'auto' }}
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="admin-panel-header">
          <h2>Firmenangaben</h2>
          <button className="close-btn" onClick={onClose}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
          </button>
        </div>

        <div style={{
          padding: '12px 16px', borderRadius: '8px', marginBottom: '20px',
          background: 'rgba(59, 130, 246, 0.08)', border: '1px solid rgba(59, 130, 246, 0.2)'
        }}>
          <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)' }}>
            Diese Angaben erscheinen auf allen PDFs (Aufmaß, Angebot, Abnahme, Rechnung) Ihrer Filiale.
          </p>
        </div>

        {/* Firmen-Grunddaten */}
        <h3 style={{ fontSize: '14px', textTransform: 'uppercase', color: 'var(--text-tertiary)', letterSpacing: '0.5px', marginBottom: '12px', marginTop: '4px' }}>
          Firmenangaben
        </h3>
        {fieldGroup('Firmenname', 'company_name', true, 'AYLUX Berlin GmbH')}
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          {fieldGroup('Strasse + Hausnr.', 'company_strasse', true, 'Musterstraße 1', true)}
        </div>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          {fieldGroup('PLZ', 'company_plz', true, '12345', true)}
          {fieldGroup('Ort', 'company_ort', true, 'Berlin', true)}
        </div>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          {fieldGroup('Telefon', 'company_telefon', true, '+49 30 12345678', true)}
          {fieldGroup('E-Mail', 'company_email', true, 'info@beispiel.de', true)}
        </div>
        {fieldGroup('Web', 'company_web', false, 'https://...')}

        {/* Steuer */}
        <h3 style={{ fontSize: '14px', textTransform: 'uppercase', color: 'var(--text-tertiary)', letterSpacing: '0.5px', marginBottom: '12px', marginTop: '20px' }}>
          Steuer
        </h3>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          {fieldGroup('USt-IdNr.', 'company_ust_id', true, 'DE123456789', true)}
          {fieldGroup('Steuernummer', 'company_steuernr', false, '12/345/67890', true)}
        </div>

        {/* Bank */}
        <h3 style={{ fontSize: '14px', textTransform: 'uppercase', color: 'var(--text-tertiary)', letterSpacing: '0.5px', marginBottom: '12px', marginTop: '20px' }}>
          Bankverbindung (optional)
        </h3>
        {fieldGroup('Bank', 'company_bank_name', false, 'Deutsche Bank')}
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          {fieldGroup('IBAN', 'company_iban', false, 'DE89 3704 0044 0532 0130 00', true)}
          {fieldGroup('BIC', 'company_bic', false, 'COBADEFFXXX', true)}
        </div>

        {/* Vertretung */}
        <h3 style={{ fontSize: '14px', textTransform: 'uppercase', color: 'var(--text-tertiary)', letterSpacing: '0.5px', marginBottom: '12px', marginTop: '20px' }}>
          Vertretung (optional)
        </h3>
        {fieldGroup('Geschäftsführer', 'company_geschaeftsfuehrer', false, 'Max Mustermann')}
        {fieldGroup('Handelsregister', 'company_handelsregister', false, 'HRB 12345 Berlin')}

        {/* Save */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '24px', paddingTop: '20px', borderTop: '1px solid var(--border-primary)' }}>
          <button
            onClick={onClose}
            style={{
              padding: '10px 20px', fontSize: '14px', borderRadius: '6px', cursor: 'pointer',
              border: '1px solid var(--border-primary)', background: 'var(--bg-secondary)', color: 'var(--text-primary)'
            }}
          >
            Abbrechen
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              padding: '10px 24px', fontSize: '14px', borderRadius: '6px', cursor: saving ? 'wait' : 'pointer',
              border: 'none', background: 'var(--accent-green)', color: '#fff', fontWeight: 600,
              opacity: saving ? 0.7 : 1
            }}
          >
            {saving ? 'Wird gespeichert...' : 'Speichern'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
