import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { getBranchSettings, updateBranchSettings, type BranchSettings } from '../services/api';
import './EsignatureAdmin.css';

interface EsignatureAdminProps {
  onClose: () => void;
}

const EsignatureAdmin = ({ onClose }: EsignatureAdminProps) => {
  const [branches, setBranches] = useState<BranchSettings[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadBranchSettings();
  }, []);

  const loadBranchSettings = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getBranchSettings();
      setBranches(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load branch settings');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleEsignature = async (slug: string, currentEnabled: boolean) => {
    try {
      setSaving(slug);
      setError(null);

      const branch = branches.find(b => b.slug === slug);
      await updateBranchSettings(slug, {
        esignature_enabled: !currentEnabled,
        esignature_sandbox: branch?.esignature_sandbox ?? true,
        esignature_provider: branch?.esignature_provider
      });

      // Update local state
      setBranches(prev => prev.map(b =>
        b.slug === slug ? { ...b, esignature_enabled: !currentEnabled } : b
      ));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update settings');
    } finally {
      setSaving(null);
    }
  };

  const handleToggleSandbox = async (slug: string, currentSandbox: boolean) => {
    try {
      setSaving(slug);
      setError(null);

      const branch = branches.find(b => b.slug === slug);
      await updateBranchSettings(slug, {
        esignature_enabled: branch?.esignature_enabled ?? false,
        esignature_sandbox: !currentSandbox,
        esignature_provider: branch?.esignature_provider
      });

      // Update local state
      setBranches(prev => prev.map(b =>
        b.slug === slug ? { ...b, esignature_sandbox: !currentSandbox } : b
      ));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update settings');
    } finally {
      setSaving(null);
    }
  };

  // Provider is always BoldSign AES - no need for selection

  return (
    <motion.div
      className="modal-overlay-modern"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="esignature-admin-modal"
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="esignature-admin-header">
          <h2>E-Signatur Verwaltung</h2>
          <button className="close-btn" onClick={onClose}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="esignature-admin-content">
          {error && (
            <div className="error-banner">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          {loading ? (
            <div className="loading-state">
              <div className="spinner"></div>
              <span>Lade Branch-Einstellungen...</span>
            </div>
          ) : branches.length === 0 ? (
            <div className="empty-state">
              <span>Keine Branches gefunden</span>
            </div>
          ) : (
            <div className="branches-list">
              <div className="branches-header">
                <span className="col-branch">Branch</span>
                <span className="col-status">Status</span>
                <span className="col-esign">E-Signatur (BoldSign AES)</span>
                <span className="col-mode">Modus</span>
              </div>

              {branches.map((branch) => (
                <div key={branch.slug} className={`branch-row ${!branch.is_active ? 'inactive' : ''}`}>
                  <div className="col-branch">
                    <span className="branch-name">{branch.name}</span>
                    <span className="branch-slug">{branch.slug}.cnsform.com</span>
                  </div>

                  <div className="col-status">
                    <span className={`status-badge ${branch.is_active ? 'active' : 'inactive'}`}>
                      {branch.is_active ? 'Aktiv' : 'Inaktiv'}
                    </span>
                  </div>

                  <div className="col-esign">
                    <label className="toggle-switch">
                      <input
                        type="checkbox"
                        checked={branch.esignature_enabled}
                        onChange={() => handleToggleEsignature(branch.slug, branch.esignature_enabled)}
                        disabled={saving === branch.slug}
                      />
                      <span className="toggle-slider"></span>
                    </label>
                    <span className={`toggle-label ${branch.esignature_enabled ? 'enabled' : 'disabled'}`}>
                      {branch.esignature_enabled ? 'Aktiviert' : 'Deaktiviert'}
                    </span>
                  </div>

                  <div className="col-mode">
                    {branch.esignature_enabled && (
                      <>
                        <label className="toggle-switch small">
                          <input
                            type="checkbox"
                            checked={!branch.esignature_sandbox}
                            onChange={() => handleToggleSandbox(branch.slug, branch.esignature_sandbox)}
                            disabled={saving === branch.slug}
                          />
                          <span className="toggle-slider"></span>
                        </label>
                        <span className={`mode-label ${branch.esignature_sandbox ? 'sandbox' : 'production'}`}>
                          {branch.esignature_sandbox ? 'Sandbox' : 'Production'}
                        </span>
                      </>
                    )}
                  </div>

                  {saving === branch.slug && (
                    <div className="saving-indicator">
                      <div className="spinner small"></div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="esignature-admin-info">
            <h4>Hinweise:</h4>
            <ul>
              <li><strong>E-Signatur (BoldSign AES):</strong> Gelismis Elektronik Imza - Email OTP dogrulama ile</li>
              <li><strong>Sandbox-Modus:</strong> Test-Umgebung ohne echte Signaturen (kostenlos)</li>
              <li><strong>Production-Modus:</strong> Echte rechtsgueltige Signaturen (kostenpflichtig)</li>
            </ul>
          </div>
        </div>

        <div className="esignature-admin-footer">
          <button className="btn-secondary" onClick={onClose}>
            Schliessen
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default EsignatureAdmin;
