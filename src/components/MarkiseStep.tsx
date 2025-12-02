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

export interface MarkiseStepData {
  markisen: MarkiseData[];
  bemerkungen: string;
}

interface MarkiseStepProps {
  markiseData: MarkiseData | MarkiseData[] | null;
  updateMarkiseData: (data: MarkiseData | MarkiseData[]) => void;
  markiseBemerkungen?: string;
  updateMarkiseBemerkungen?: (bemerkungen: string) => void;
}

const markiseTypes = [
  {
    value: 'AUFGLAS',
    label: 'Aufglas Markise',
    models: ['W350', 'ANCONA AG'],
    showHeight: false,
    showZip: true,
    befestigungsOptions: []
  },
  {
    value: 'UNTERGLAS',
    label: 'Unterglas Markise',
    models: ['T350', 'ANCONA UG'],
    showHeight: false,
    showZip: true,
    befestigungsOptions: ['Innen Sparren', 'Unten Sparren']
  },
  {
    value: 'SENKRECHT',
    label: 'Senkrecht Markise',
    models: ['2020Z', '1616Z'],
    showHeight: true,
    showZip: true,
    befestigungsOptions: ['Zwischen Pfosten', 'Vor Pfosten'],
    showPosition: true
  },
  {
    value: 'VOLKASSETTE',
    label: 'Volkassette',
    models: ['TRENTINO'],
    showHeight: false,
    showZip: false,
    showVolanTyp: true,
    befestigungsOptions: ['Wand', 'Decke', 'Untenbalkon']
  },
  {
    value: 'HALBEKASSETTE',
    label: 'Halbekassette',
    models: ['AGUERO'],
    showHeight: false,
    showZip: false,
    showVolanTyp: true,
    befestigungsOptions: ['Wand', 'Decke', 'Untenbalkon']
  }
];

const positionOptions = ['LINKS', 'RECHTS', 'FRONT', 'FRONT LINKS', 'FRONT RECHTS', 'HINTEN LINKS', 'HINTEN RECHTS'];

const emptyMarkise: MarkiseData = {
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
};

const MarkiseStep = ({ markiseData, updateMarkiseData, markiseBemerkungen = '', updateMarkiseBemerkungen }: MarkiseStepProps) => {
  // Convert old single object format to array format
  const initialMarkisen = (): MarkiseData[] => {
    if (!markiseData) return [{ ...emptyMarkise }];
    if (Array.isArray(markiseData)) return markiseData.length > 0 ? markiseData : [{ ...emptyMarkise }];
    // Old single object format - convert to array
    return [markiseData];
  };

  const [markisen, setMarkisen] = useState<MarkiseData[]>(initialMarkisen);
  const [bemerkungen, setBemerkungen] = useState(markiseBemerkungen);
  const [expandedIndex, setExpandedIndex] = useState<number>(0);

  useEffect(() => {
    if (markiseData) {
      if (Array.isArray(markiseData)) {
        setMarkisen(markiseData.length > 0 ? markiseData : [{ ...emptyMarkise }]);
      } else {
        setMarkisen([markiseData]);
      }
    }
  }, [markiseData]);

  useEffect(() => {
    setBemerkungen(markiseBemerkungen);
  }, [markiseBemerkungen]);

  const handleChange = (index: number, field: keyof MarkiseData, value: string | number) => {
    const newMarkisen = [...markisen];
    newMarkisen[index] = { ...newMarkisen[index], [field]: value };
    setMarkisen(newMarkisen);
    updateMarkiseData(newMarkisen);
  };

  const handleTypeChange = (index: number, value: string) => {
    const newMarkisen = [...markisen];
    newMarkisen[index] = {
      ...newMarkisen[index],
      typ: value,
      modell: '',
      befestigungsart: '',
      position: '',
      zip: '',
      volanTyp: '',
      hoehe: 0
    };
    setMarkisen(newMarkisen);
    updateMarkiseData(newMarkisen);
  };

  const addMarkise = () => {
    const newMarkisen = [...markisen, { ...emptyMarkise }];
    setMarkisen(newMarkisen);
    updateMarkiseData(newMarkisen);
    setExpandedIndex(newMarkisen.length - 1);
  };

  const removeMarkise = (index: number) => {
    if (markisen.length <= 1) return; // Keep at least one
    const newMarkisen = markisen.filter((_, i) => i !== index);
    setMarkisen(newMarkisen);
    updateMarkiseData(newMarkisen);
    if (expandedIndex >= newMarkisen.length) {
      setExpandedIndex(newMarkisen.length - 1);
    }
  };

  const handleBemerkungenChange = (value: string) => {
    setBemerkungen(value);
    if (updateMarkiseBemerkungen) {
      updateMarkiseBemerkungen(value);
    }
  };

  const getMarkiseLabel = (markise: MarkiseData, index: number) => {
    if (markise.typ) {
      const typeLabel = markiseTypes.find(t => t.value === markise.typ)?.label || markise.typ;
      if (markise.position) {
        return `Markise ${index + 1}: ${typeLabel} - ${markise.position}`;
      }
      return `Markise ${index + 1}: ${typeLabel}`;
    }
    return `Markise ${index + 1}`;
  };

  const renderMarkiseForm = (markise: MarkiseData, index: number) => {
    const selectedType = markiseTypes.find(t => t.value === markise.typ);
    const availableModels = selectedType?.models || [];

    return (
      <div className="markise-form-grid">
        {/* Markise Typ */}
        <motion.div
          className="form-field"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0 }}
        >
          <label htmlFor={`markiseTyp-${index}`}>
            Markise Typ <span className="required">*</span>
          </label>
          <select
            id={`markiseTyp-${index}`}
            value={markise.typ}
            onChange={(e) => handleTypeChange(index, e.target.value)}
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
          {markise.typ && (
            <motion.div
              className="form-field"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3, delay: 0.05 }}
            >
              <label htmlFor={`markiseModell-${index}`}>
                Modell <span className="required">*</span>
              </label>
              <select
                id={`markiseModell-${index}`}
                value={markise.modell}
                onChange={(e) => handleChange(index, 'modell', e.target.value)}
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
              <label htmlFor={`befestigungsart-${index}`}>
                Befestigungsart <span className="required">*</span>
              </label>
              <select
                id={`befestigungsart-${index}`}
                value={markise.befestigungsart}
                onChange={(e) => handleChange(index, 'befestigungsart', e.target.value)}
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
              <label htmlFor={`position-${index}`}>
                Position <span className="required">*</span>
              </label>
              <select
                id={`position-${index}`}
                value={markise.position}
                onChange={(e) => handleChange(index, 'position', e.target.value)}
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
          <label htmlFor={`breite-${index}`}>
            Markisenbreite <span className="unit-label">(mm)</span> <span className="required">*</span>
          </label>
          <div className="number-input-wrapper">
            <input
              type="number"
              id={`breite-${index}`}
              value={markise.breite || ''}
              onChange={(e) => handleChange(index, 'breite', parseFloat(e.target.value) || 0)}
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
          <label htmlFor={`laenge-${index}`}>
            Markisenlänge <span className="unit-label">(mm)</span> <span className="required">*</span>
          </label>
          <div className="number-input-wrapper">
            <input
              type="number"
              id={`laenge-${index}`}
              value={markise.laenge || ''}
              onChange={(e) => handleChange(index, 'laenge', parseFloat(e.target.value) || 0)}
              placeholder="0"
              min="0"
              required
            />
            <span className="unit-suffix">mm</span>
          </div>
        </motion.div>

        {/* Höhe - only for SENKRECHT */}
        <AnimatePresence>
          {selectedType?.showHeight && (
            <motion.div
              className="form-field"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3, delay: 0.3 }}
            >
              <label htmlFor={`hoehe-${index}`}>
                Markisenhöhe <span className="unit-label">(mm)</span> <span className="required">*</span>
              </label>
              <div className="number-input-wrapper">
                <input
                  type="number"
                  id={`hoehe-${index}`}
                  value={markise.hoehe || ''}
                  onChange={(e) => handleChange(index, 'hoehe', parseFloat(e.target.value) || 0)}
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
          <label htmlFor={`stoffNummer-${index}`}>
            Stoff Nummer <span className="required">*</span>
          </label>
          <input
            type="text"
            id={`stoffNummer-${index}`}
            value={markise.stoffNummer}
            onChange={(e) => handleChange(index, 'stoffNummer', e.target.value)}
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
          <label htmlFor={`gestellfarbe-${index}`}>
            Gestellfarbe <span className="required">*</span>
          </label>
          <input
            type="text"
            id={`gestellfarbe-${index}`}
            value={markise.gestellfarbe}
            onChange={(e) => handleChange(index, 'gestellfarbe', e.target.value)}
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
              <label htmlFor={`zip-${index}`}>
                ZIP <span className="required">*</span>
              </label>
              <select
                id={`zip-${index}`}
                value={markise.zip}
                onChange={(e) => handleChange(index, 'zip', e.target.value)}
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
              <label htmlFor={`volanTyp-${index}`}>
                Volan Typ <span className="required">*</span>
              </label>
              <input
                type="text"
                id={`volanTyp-${index}`}
                value={markise.volanTyp}
                onChange={(e) => handleChange(index, 'volanTyp', e.target.value)}
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
          <label htmlFor={`antrieb-${index}`}>
            Antrieb <span className="required">*</span>
          </label>
          <select
            id={`antrieb-${index}`}
            value={markise.antrieb}
            onChange={(e) => handleChange(index, 'antrieb', e.target.value)}
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
          <label htmlFor={`antriebsseite-${index}`}>
            Antriebsseite <span className="required">*</span>
          </label>
          <select
            id={`antriebsseite-${index}`}
            value={markise.antriebsseite}
            onChange={(e) => handleChange(index, 'antriebsseite', e.target.value)}
            required
          >
            <option value="">Bitte wählen...</option>
            <option value="Links">Links</option>
            <option value="Rechts">Rechts</option>
          </select>
        </motion.div>
      </div>
    );
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
          Bitte geben Sie alle Details zu den Markisen an
        </p>
      </motion.div>

      {/* Markise Cards */}
      <div className="markise-cards">
        {markisen.map((markise, index) => (
          <motion.div
            key={index}
            className={`markise-card ${expandedIndex === index ? 'expanded' : 'collapsed'}`}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: index * 0.1 }}
          >
            <div
              className="markise-card-header"
              onClick={() => setExpandedIndex(expandedIndex === index ? -1 : index)}
            >
              <div className="markise-card-title">
                <span className="markise-number">{index + 1}</span>
                <span className="markise-label">{getMarkiseLabel(markise, index)}</span>
              </div>
              <div className="markise-card-actions">
                {markisen.length > 1 && (
                  <button
                    type="button"
                    className="remove-markise-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeMarkise(index);
                    }}
                    title="Markise entfernen"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                )}
                <span className={`expand-icon ${expandedIndex === index ? 'expanded' : ''}`}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="6,9 12,15 18,9" />
                  </svg>
                </span>
              </div>
            </div>
            <AnimatePresence>
              {expandedIndex === index && (
                <motion.div
                  className="markise-card-content"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  {renderMarkiseForm(markise, index)}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        ))}
      </div>

      {/* Add Markise Button */}
      <motion.button
        type="button"
        className="add-markise-btn"
        onClick={addMarkise}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3, delay: 0.2 }}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
        Weitere Markise hinzufügen
      </motion.button>

      {/* Bemerkungen */}
      <motion.div
        className="markise-bemerkungen"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.3 }}
      >
        <label htmlFor="markiseBemerkungen">
          Bemerkungen zur Markise
        </label>
        <textarea
          id="markiseBemerkungen"
          value={bemerkungen}
          onChange={(e) => handleBemerkungenChange(e.target.value)}
          placeholder="Zusätzliche Anmerkungen zur Markise..."
          rows={3}
        />
      </motion.div>
    </div>
  );
};

export default MarkiseStep;
