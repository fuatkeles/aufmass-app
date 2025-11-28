import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import './MarkiseStep.css';
import './SectionStyles.css';

export interface MarkiseData {
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

interface MarkiseStepProps {
  markiseData: MarkiseData | null;
  updateMarkiseData: (data: MarkiseData) => void;
}

const markiseTypes = [
  {
    value: 'AUFGLAS',
    label: 'Aufglas Markise',
    models: ['W350', 'ANCONA AG'],
    showHeight: true,
    showZip: true,
    befestigungsOptions: []
  },
  {
    value: 'UNTERGLAS',
    label: 'Unterglas Markise',
    models: ['T350', 'ANCONA UG'],
    showHeight: true,
    showZip: true,
    befestigungsOptions: ['Innen Sparren', 'Unten Sparren']
  },
  {
    value: 'SENKRECHT',
    label: 'Senkrecht Markise',
    models: ['2020Z', '1616Z'],
    showHeight: false,
    showZip: true,
    befestigungsOptions: ['Zwischen Pfosten', 'Vor Pfosten'],
    showPosition: true
  },
  {
    value: 'VOLKASSETTE',
    label: 'Volkassette',
    models: ['TRENTINO'],
    showHeight: true,
    showZip: false,
    showVolanTyp: true,
    befestigungsOptions: ['Wand', 'Decke', 'Untenbalkon']
  },
  {
    value: 'HALBEKASSETTE',
    label: 'Halbekassette',
    models: ['AGUERO'],
    showHeight: true,
    showZip: false,
    showVolanTyp: true,
    befestigungsOptions: ['Wand', 'Decke', 'Untenbalkon']
  }
];

const positionOptions = ['LINKS', 'RECHTS', 'FRONT', 'FRONT LINKS', 'FRONT RECHTS'];

const MarkiseStep = ({ markiseData, updateMarkiseData }: MarkiseStepProps) => {
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
    if (markiseData) {
      setFormData(markiseData);
    }
  }, [markiseData]);

  const selectedType = markiseTypes.find(t => t.value === formData.typ);
  const availableModels = selectedType?.models || [];

  const handleChange = (field: keyof MarkiseData, value: string | number) => {
    const newData = { ...formData, [field]: value };
    setFormData(newData);
    updateMarkiseData(newData);
  };

  const handleTypeChange = (value: string) => {
    const newData = {
      ...formData,
      typ: value,
      modell: '',
      befestigungsart: '',
      position: '',
      zip: '',
      volanTyp: '',
      hoehe: 0
    };
    setFormData(newData);
    updateMarkiseData(newData);
  };

  return (
    <div className="markise-step">
      <motion.div
        className="section-header"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
      >
        <h2>Markise Konfiguration</h2>
        <p className="section-description">
          Bitte geben Sie alle Details zur Markise an
        </p>
      </motion.div>

      <div className="markise-form-grid">
        {/* Markise Typ */}
        <motion.div
          className="form-field"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0 }}
        >
          <label htmlFor="markiseTyp">
            Markise Typ <span className="required">*</span>
          </label>
          <select
            id="markiseTyp"
            value={formData.typ}
            onChange={(e) => handleTypeChange(e.target.value)}
            required
          >
            <option value="">Bitte wählen...</option>
            {markiseTypes.map(type => (
              <option key={type.value} value={type.value}>{type.label}</option>
            ))}
          </select>
        </motion.div>

        {/* Modell */}
        <AnimatePresence>
          {formData.typ && (
            <motion.div
              className="form-field"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3, delay: 0.05 }}
            >
              <label htmlFor="markiseModell">
                Modell <span className="required">*</span>
              </label>
              <select
                id="markiseModell"
                value={formData.modell}
                onChange={(e) => handleChange('modell', e.target.value)}
                required
              >
                <option value="">Bitte wählen...</option>
                {availableModels.map(model => (
                  <option key={model} value={model}>{model}</option>
                ))}
              </select>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Befestigungsart */}
        <AnimatePresence>
          {selectedType && selectedType.befestigungsOptions.length > 0 && (
            <motion.div
              className="form-field"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3, delay: 0.1 }}
            >
              <label htmlFor="befestigungsart">
                Befestigungsart <span className="required">*</span>
              </label>
              <select
                id="befestigungsart"
                value={formData.befestigungsart}
                onChange={(e) => handleChange('befestigungsart', e.target.value)}
                required
              >
                <option value="">Bitte wählen...</option>
                {selectedType.befestigungsOptions.map(opt => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Position for SENKRECHT */}
        <AnimatePresence>
          {selectedType?.showPosition && (
            <motion.div
              className="form-field"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3, delay: 0.15 }}
            >
              <label htmlFor="position">
                Position <span className="required">*</span>
              </label>
              <select
                id="position"
                value={formData.position}
                onChange={(e) => handleChange('position', e.target.value)}
                required
              >
                <option value="">Bitte wählen...</option>
                {positionOptions.map(pos => (
                  <option key={pos} value={pos}>{pos}</option>
                ))}
              </select>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Dimensions - always show Breite and Laenge */}
        <motion.div
          className="form-field"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.2 }}
        >
          <label htmlFor="breite">
            Markisenbreite <span className="unit-label">(mm)</span> <span className="required">*</span>
          </label>
          <div className="number-input-wrapper">
            <input
              type="number"
              id="breite"
              value={formData.breite || ''}
              onChange={(e) => handleChange('breite', parseFloat(e.target.value) || 0)}
              placeholder="0"
              min="0"
              required
            />
            <span className="unit-suffix">mm</span>
          </div>
        </motion.div>

        <motion.div
          className="form-field"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.25 }}
        >
          <label htmlFor="laenge">
            Markisenlänge <span className="unit-label">(mm)</span> <span className="required">*</span>
          </label>
          <div className="number-input-wrapper">
            <input
              type="number"
              id="laenge"
              value={formData.laenge || ''}
              onChange={(e) => handleChange('laenge', parseFloat(e.target.value) || 0)}
              placeholder="0"
              min="0"
              required
            />
            <span className="unit-suffix">mm</span>
          </div>
        </motion.div>

        {/* Höhe - conditional */}
        <AnimatePresence>
          {selectedType?.showHeight && (
            <motion.div
              className="form-field"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3, delay: 0.3 }}
            >
              <label htmlFor="hoehe">
                Markisenhöhe <span className="unit-label">(mm)</span> <span className="required">*</span>
              </label>
              <div className="number-input-wrapper">
                <input
                  type="number"
                  id="hoehe"
                  value={formData.hoehe || ''}
                  onChange={(e) => handleChange('hoehe', parseFloat(e.target.value) || 0)}
                  placeholder="0"
                  min="0"
                  required
                />
                <span className="unit-suffix">mm</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Stoff Nummer */}
        <motion.div
          className="form-field"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.35 }}
        >
          <label htmlFor="stoffNummer">
            Stoff Nummer <span className="required">*</span>
          </label>
          <input
            type="text"
            id="stoffNummer"
            value={formData.stoffNummer}
            onChange={(e) => handleChange('stoffNummer', e.target.value)}
            placeholder="Stoff Nummer eingeben"
            required
          />
        </motion.div>

        {/* Gestellfarbe */}
        <motion.div
          className="form-field"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.4 }}
        >
          <label htmlFor="gestellfarbe">
            Gestellfarbe <span className="required">*</span>
          </label>
          <input
            type="text"
            id="gestellfarbe"
            value={formData.gestellfarbe}
            onChange={(e) => handleChange('gestellfarbe', e.target.value)}
            placeholder="z.B. RAL 7016"
            required
          />
        </motion.div>

        {/* ZIP - conditional */}
        <AnimatePresence>
          {selectedType?.showZip && (
            <motion.div
              className="form-field"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3, delay: 0.45 }}
            >
              <label htmlFor="zip">
                ZIP <span className="required">*</span>
              </label>
              <select
                id="zip"
                value={formData.zip}
                onChange={(e) => handleChange('zip', e.target.value)}
                required
              >
                <option value="">Bitte wählen...</option>
                <option value="JA">JA</option>
                <option value="NEIN">NEIN</option>
              </select>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Volan Typ - conditional */}
        <AnimatePresence>
          {selectedType?.showVolanTyp && (
            <motion.div
              className="form-field"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3, delay: 0.5 }}
            >
              <label htmlFor="volanTyp">
                Volan Typ <span className="required">*</span>
              </label>
              <input
                type="text"
                id="volanTyp"
                value={formData.volanTyp}
                onChange={(e) => handleChange('volanTyp', e.target.value)}
                placeholder="Volan Typ eingeben"
                required
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Antrieb */}
        <motion.div
          className="form-field"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.55 }}
        >
          <label htmlFor="antrieb">
            Antrieb <span className="required">*</span>
          </label>
          <select
            id="antrieb"
            value={formData.antrieb}
            onChange={(e) => handleChange('antrieb', e.target.value)}
            required
          >
            <option value="">Bitte wählen...</option>
            <option value="Funk Motor">Funk Motor</option>
            <option value="E-Motor (Schalter)">E-Motor (Schalter)</option>
          </select>
        </motion.div>

        {/* Antriebsseite */}
        <motion.div
          className="form-field"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.6 }}
        >
          <label htmlFor="antriebsseite">
            Antriebsseite <span className="required">*</span>
          </label>
          <select
            id="antriebsseite"
            value={formData.antriebsseite}
            onChange={(e) => handleChange('antriebsseite', e.target.value)}
            required
          >
            <option value="">Bitte wählen...</option>
            <option value="Links">Links</option>
            <option value="Rechts">Rechts</option>
          </select>
        </motion.div>
      </div>
    </div>
  );
};

export default MarkiseStep;
