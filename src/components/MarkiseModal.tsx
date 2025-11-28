import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import './MarkiseModal.css';

interface MarkiseData {
  typ: string;
  modell: string;
  breite: number;
  laenge: number;
  hoehe: number;
  stoffNummer: string;
  gestellfarbe: string;
  antrieb: string;
  antriebsseite: string;
  volanTyp?: string;
  zip?: string;
  befestigungsart?: string;
  position?: string;
}

interface MarkiseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: MarkiseData) => void;
  initialData: MarkiseData | null;
}

const markiseTypes = [
  { value: 'AUFGLAS', label: 'Aufglas Markise', models: ['W350', 'ANCONA AG'] },
  { value: 'UNTERGLAS', label: 'Unterglas Markise', models: ['T350', 'ANCONA UG'] },
  { value: 'SENKRECHT', label: 'Senkrecht Markise', models: ['2020Z', '1616Z'] },
  { value: 'VOLKASSETTE', label: 'Volkassette', models: ['TRENTINO'] },
  { value: 'HALBEKASSETTE', label: 'Halbekassette', models: ['AGUERO'] }
];

const MarkiseModal = ({ isOpen, onClose, onSave, initialData }: MarkiseModalProps) => {
  const [formData, setFormData] = useState<MarkiseData>({
    typ: '',
    modell: '',
    breite: 0,
    laenge: 0,
    hoehe: 0,
    stoffNummer: '',
    gestellfarbe: '',
    antrieb: '',
    antriebsseite: '',
    volanTyp: '',
    zip: '',
    befestigungsart: '',
    position: ''
  });

  useEffect(() => {
    if (initialData) {
      setFormData(initialData);
    }
  }, [initialData]);

  const selectedType = markiseTypes.find(t => t.value === formData.typ);
  const availableModels = selectedType?.models || [];

  const handleChange = (field: keyof MarkiseData, value: string | number) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  if (!isOpen) return null;

  return (
    <motion.div
      className="markise-modal-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="markise-modal"
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2>Markise Konfiguration</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <form onSubmit={handleSubmit} className="modal-body">
          <div className="modal-grid">
            {/* Markise Typ */}
            <div className="form-field">
              <label>Markise Typ <span className="required">*</span></label>
              <select
                value={formData.typ}
                onChange={(e) => {
                  handleChange('typ', e.target.value);
                  handleChange('modell', '');
                }}
                required
              >
                <option value="">Bitte wählen...</option>
                {markiseTypes.map(type => (
                  <option key={type.value} value={type.value}>{type.label}</option>
                ))}
              </select>
            </div>

            {/* Modell */}
            {formData.typ && (
              <div className="form-field">
                <label>Modell <span className="required">*</span></label>
                <select
                  value={formData.modell}
                  onChange={(e) => handleChange('modell', e.target.value)}
                  required
                >
                  <option value="">Bitte wählen...</option>
                  {availableModels.map(model => (
                    <option key={model} value={model}>{model}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Befestigungsart for UNTERGLAS, VOLKASSETTE, HALBEKASSETTE */}
            {(formData.typ === 'UNTERGLAS') && (
              <div className="form-field">
                <label>Befestigungsart <span className="required">*</span></label>
                <select
                  value={formData.befestigungsart}
                  onChange={(e) => handleChange('befestigungsart', e.target.value)}
                  required
                >
                  <option value="">Bitte wählen...</option>
                  <option value="Innen Sparren">Innen Sparren</option>
                  <option value="Unten Sparren">Unten Sparren</option>
                </select>
              </div>
            )}

            {(formData.typ === 'VOLKASSETTE' || formData.typ === 'HALBEKASSETTE') && (
              <div className="form-field">
                <label>Befestigungsart <span className="required">*</span></label>
                <select
                  value={formData.befestigungsart}
                  onChange={(e) => handleChange('befestigungsart', e.target.value)}
                  required
                >
                  <option value="">Bitte wählen...</option>
                  <option value="Wand">Wand</option>
                  <option value="Decke">Decke</option>
                  <option value="Untenbalkon">Untenbalkon</option>
                </select>
              </div>
            )}

            {/* Position for SENKRECHT */}
            {formData.typ === 'SENKRECHT' && (
              <>
                <div className="form-field">
                  <label>Befestigungsart <span className="required">*</span></label>
                  <select
                    value={formData.befestigungsart}
                    onChange={(e) => handleChange('befestigungsart', e.target.value)}
                    required
                  >
                    <option value="">Bitte wählen...</option>
                    <option value="Zwischen Pfosten">Zwischen Pfosten</option>
                    <option value="Vor Pfosten">Vor Pfosten</option>
                  </select>
                </div>
                <div className="form-field">
                  <label>Position <span className="required">*</span></label>
                  <select
                    value={formData.position}
                    onChange={(e) => handleChange('position', e.target.value)}
                    required
                  >
                    <option value="">Bitte wählen...</option>
                    <option value="LINKS">LINKS</option>
                    <option value="RECHTS">RECHTS</option>
                    <option value="FRONT">FRONT</option>
                    <option value="FRONT LINKS">FRONT LINKS</option>
                    <option value="FRONT RECHTS">FRONT RECHTS</option>
                  </select>
                </div>
              </>
            )}

            {/* Dimensions */}
            <div className="form-field">
              <label>Markisenbreite (mm) <span className="required">*</span></label>
              <input
                type="number"
                value={formData.breite || ''}
                onChange={(e) => handleChange('breite', parseFloat(e.target.value) || 0)}
                placeholder="0"
                min="0"
                required
              />
            </div>

            <div className="form-field">
              <label>Markisenlänge (mm) <span className="required">*</span></label>
              <input
                type="number"
                value={formData.laenge || ''}
                onChange={(e) => handleChange('laenge', parseFloat(e.target.value) || 0)}
                placeholder="0"
                min="0"
                required
              />
            </div>

            {(formData.typ === 'AUFGLAS' || formData.typ === 'UNTERGLAS' || formData.typ === 'VOLKASSETTE' || formData.typ === 'HALBEKASSETTE') && (
              <div className="form-field">
                <label>Markisenhöhe (mm) <span className="required">*</span></label>
                <input
                  type="number"
                  value={formData.hoehe || ''}
                  onChange={(e) => handleChange('hoehe', parseFloat(e.target.value) || 0)}
                  placeholder="0"
                  min="0"
                  required
                />
              </div>
            )}

            {/* Stoff Nummer */}
            <div className="form-field">
              <label>Stoff Nummer <span className="required">*</span></label>
              <input
                type="text"
                value={formData.stoffNummer}
                onChange={(e) => handleChange('stoffNummer', e.target.value)}
                placeholder="Stoff Nummer eingeben"
                required
              />
            </div>

            {/* Gestellfarbe */}
            <div className="form-field">
              <label>Gestellfarbe <span className="required">*</span></label>
              <input
                type="text"
                value={formData.gestellfarbe}
                onChange={(e) => handleChange('gestellfarbe', e.target.value)}
                placeholder="z.B. RAL 7016"
                required
              />
            </div>

            {/* ZIP for AUFGLAS, UNTERGLAS, SENKRECHT */}
            {(formData.typ === 'AUFGLAS' || formData.typ === 'UNTERGLAS' || formData.typ === 'SENKRECHT') && (
              <div className="form-field">
                <label>ZIP <span className="required">*</span></label>
                <select
                  value={formData.zip}
                  onChange={(e) => handleChange('zip', e.target.value)}
                  required
                >
                  <option value="">Bitte wählen...</option>
                  <option value="JA">JA</option>
                  <option value="NEIN">NEIN</option>
                </select>
              </div>
            )}

            {/* Volan Typ for VOLKASSETTE, HALBEKASSETTE */}
            {(formData.typ === 'VOLKASSETTE' || formData.typ === 'HALBEKASSETTE') && (
              <div className="form-field">
                <label>Volan Typ <span className="required">*</span></label>
                <input
                  type="text"
                  value={formData.volanTyp}
                  onChange={(e) => handleChange('volanTyp', e.target.value)}
                  placeholder="Volan Typ eingeben"
                  required
                />
              </div>
            )}

            {/* Antrieb */}
            <div className="form-field">
              <label>Antrieb <span className="required">*</span></label>
              <select
                value={formData.antrieb}
                onChange={(e) => handleChange('antrieb', e.target.value)}
                required
              >
                <option value="">Bitte wählen...</option>
                <option value="Funk Motor">Funk Motor</option>
                <option value="E-Motor (Schalter)">E-Motor (Schalter)</option>
              </select>
            </div>

            {/* Antriebsseite */}
            <div className="form-field">
              <label>Antriebsseite <span className="required">*</span></label>
              <select
                value={formData.antriebsseite}
                onChange={(e) => handleChange('antriebsseite', e.target.value)}
                required
              >
                <option value="">Bitte wählen...</option>
                <option value="Links">Links</option>
                <option value="Rechts">Rechts</option>
              </select>
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Abbrechen
            </button>
            <button type="submit" className="btn btn-primary">
              Speichern
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
};

export default MarkiseModal;
