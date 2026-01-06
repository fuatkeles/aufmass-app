import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import './UnterbauelementeStep.css';
import './SectionStyles.css';
import './DynamicSpecificationForm.css';
import productConfigData from '../config/productConfig.json';
import { WeiteresProdukt } from '../types';
import WeitereProdukteSectionInline from './WeitereProdukteSectionInline';

// Types
interface UnterbauelementData {
  id: string;
  produktTyp: string;
  modell: string;
  // Common fields
  breite?: number;
  hoehe?: number;
  gestellfarbe?: string;
  position?: string;
  oeffnungsrichtung?: string;
  anzahlFluegel?: string;
  fundament?: string;
  fundamentValue?: string;
  montageteam?: string;
  // Festes Element specific
  elementForm?: string;
  // Keil specific
  laenge?: number;
  hintenHoehe?: number;
  vorneHoehe?: number;
  // Dreh Tür specific
  drehrichtung?: string;
  schloss?: string;
}

interface UnterbauelementeStepProps {
  unterbauelemente: UnterbauelementData[];
  updateUnterbauelemente: (data: UnterbauelementData[]) => void;
  initialProduktTyp?: string;
  initialModell?: string;
  weitereProdukte?: WeiteresProdukt[];
  updateWeitereProdukte?: (data: WeiteresProdukt[]) => void;
  bemerkungen?: string;
  updateBemerkungen?: (value: string) => void;
}

interface ProductConfig {
  [category: string]: {
    [productType: string]: {
      models: string[];
      modelColors?: { [model: string]: string[] };
      fields: { name: string; label: string; type: string; unit?: string; options?: string[]; required: boolean; hasCustomOption?: boolean }[];
    };
  };
}

const productConfig = productConfigData as ProductConfig;

const produktTypen = [
  'GG Schiebe Element',
  'Rahmen Schiebe Element',
  'Festes Element',
  'Keil',
  'Dreh Tür'
];

const generateId = () => Math.random().toString(36).substr(2, 9);

const createEmptyElement = (): UnterbauelementData => ({
  id: generateId(),
  produktTyp: '',
  modell: '',
  gestellfarbe: '',
  position: '',
  fundament: '',
  fundamentValue: ''
});

const UnterbauelementeStep = ({
  unterbauelemente,
  updateUnterbauelemente,
  initialProduktTyp = '',
  initialModell = '',
  weitereProdukte = [],
  updateWeitereProdukte,
  bemerkungen = '',
  updateBemerkungen
}: UnterbauelementeStepProps) => {
  // Create initial element with values from ProductSelection
  const createInitialElement = (): UnterbauelementData => ({
    id: generateId(),
    produktTyp: initialProduktTyp,
    modell: initialModell,
    gestellfarbe: '',
    position: '',
    fundament: '',
    fundamentValue: ''
  });

  const [elements, setElements] = useState<UnterbauelementData[]>(() => {
    if (unterbauelemente.length > 0) return unterbauelemente;
    return [createInitialElement()];
  });
  const [expandedIndex, setExpandedIndex] = useState<number>(0);
  const [initialized, setInitialized] = useState(false);

  // Initialize first element with ProductSelection values if not already set
  useEffect(() => {
    if (!initialized && initialProduktTyp && initialModell) {
      if (unterbauelemente.length === 0 || (!unterbauelemente[0].produktTyp && !unterbauelemente[0].modell)) {
        const initialElement = createInitialElement();
        setElements([initialElement]);
        updateUnterbauelemente([initialElement]);
      }
      setInitialized(true);
    }
  }, [initialProduktTyp, initialModell, initialized, unterbauelemente, updateUnterbauelemente]);

  useEffect(() => {
    if (unterbauelemente.length > 0 && initialized) {
      setElements(unterbauelemente);
    }
  }, [unterbauelemente, initialized]);

  const handleFieldChange = (index: number, field: keyof UnterbauelementData, value: string | number) => {
    const newElements = [...elements];
    newElements[index] = { ...newElements[index], [field]: value };
    setElements(newElements);
    updateUnterbauelemente(newElements);
  };

  const handleProduktTypChange = (index: number, value: string) => {
    const newElements = [...elements];
    newElements[index] = {
      ...createEmptyElement(),
      id: newElements[index].id,
      produktTyp: value
    };
    setElements(newElements);
    updateUnterbauelemente(newElements);
  };

  const handleModellChange = (index: number, value: string) => {
    const newElements = [...elements];
    newElements[index] = {
      ...newElements[index],
      modell: value,
      gestellfarbe: '' // Reset color when model changes
    };
    setElements(newElements);
    updateUnterbauelemente(newElements);
  };

  const addElement = () => {
    const newElements = [...elements, createEmptyElement()];
    setElements(newElements);
    updateUnterbauelemente(newElements);
    setExpandedIndex(newElements.length - 1);
  };

  const removeElement = (index: number) => {
    if (elements.length <= 1) return;
    const newElements = elements.filter((_, i) => i !== index);
    setElements(newElements);
    updateUnterbauelemente(newElements);
    if (expandedIndex >= newElements.length) {
      setExpandedIndex(newElements.length - 1);
    }
  };

  const getElementLabel = (element: UnterbauelementData, index: number) => {
    if (element.produktTyp) {
      let label = `${index + 1}. ${element.produktTyp}`;
      if (element.position) {
        label += ` - ${element.position}`;
      }
      return label;
    }
    return `Unterbauelement ${index + 1}`;
  };

  const getModelsForType = (produktTyp: string): string[] => {
    if (!produktTyp) return [];
    return productConfig['UNTERBAUELEMENTE']?.[produktTyp]?.models || [];
  };

  const getColorsForModel = (produktTyp: string, modell: string): string[] => {
    if (!produktTyp || !modell) return [];
    return productConfig['UNTERBAUELEMENTE']?.[produktTyp]?.modelColors?.[modell] || [];
  };

  const getFieldsForType = (produktTyp: string) => {
    if (!produktTyp) return [];
    return productConfig['UNTERBAUELEMENTE']?.[produktTyp]?.fields || [];
  };

  const renderField = (element: UnterbauelementData, index: number, field: { name: string; label: string; type: string; unit?: string; options?: string[]; required: boolean; hasCustomOption?: boolean; showWhen?: { field: string; value: string } }) => {
    const value = element[field.name as keyof UnterbauelementData];

    // Skip montageteam - it's optional and handled at main form level
    if (field.name === 'montageteam') return null;

    // Check showWhen condition for conditional field visibility
    if (field.showWhen) {
      const dependentValue = element[field.showWhen.field as keyof UnterbauelementData];
      if (dependentValue !== field.showWhen.value) {
        return null; // Don't render this field
      }
    }

    switch (field.type) {
      case 'number':
        return (
          <motion.div
            key={field.name}
            className="form-field"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
          >
            <label>
              {field.label}
              {field.unit && <span className="unit-label">({field.unit})</span>}
              {field.required && <span className="required">*</span>}
            </label>
            <div className="number-input-wrapper">
              <input
                type="number"
                value={value as number || ''}
                onChange={(e) => handleFieldChange(index, field.name as keyof UnterbauelementData, parseFloat(e.target.value) || 0)}
                placeholder="0"
                min="0"
              />
              {field.unit && <span className="unit-suffix">{field.unit}</span>}
            </div>
          </motion.div>
        );

      case 'select':
        return (
          <motion.div
            key={field.name}
            className="form-field"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
          >
            <label>
              {field.label}
              {field.required && <span className="required">*</span>}
            </label>
            <select
              value={value as string || ''}
              onChange={(e) => handleFieldChange(index, field.name as keyof UnterbauelementData, e.target.value)}
            >
              <option value="">Bitte wählen...</option>
              {field.options?.map(opt => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </motion.div>
        );

      case 'modelColorSelect':
        const colors = getColorsForModel(element.produktTyp, element.modell);
        return (
          <motion.div
            key={field.name}
            className="form-field"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
          >
            <label>
              {field.label}
              {field.required && <span className="required">*</span>}
            </label>
            <select
              value={value as string || ''}
              onChange={(e) => handleFieldChange(index, field.name as keyof UnterbauelementData, e.target.value)}
              disabled={!element.modell}
            >
              <option value="">Bitte wählen...</option>
              {colors.map(color => (
                <option key={color} value={color}>{color}</option>
              ))}
              {field.hasCustomOption && <option value="SONDERFARBE">SONDERFARBE</option>}
            </select>
          </motion.div>
        );

      case 'fundament':
        return (
          <motion.div
            key={field.name}
            className="form-field fundament-field"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
          >
            <label>
              {field.label}
              {field.required && <span className="required">*</span>}
            </label>
            <select
              value={value as string || ''}
              onChange={(e) => handleFieldChange(index, field.name as keyof UnterbauelementData, e.target.value)}
            >
              <option value="">Bitte wählen...</option>
              {field.options?.map(opt => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
            {value && (
              <motion.div
                className="fundament-details"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
              >
                <label>Fundament Anzahl/Details</label>
                <input
                  type="text"
                  value={element.fundamentValue || ''}
                  onChange={(e) => handleFieldChange(index, 'fundamentValue', e.target.value)}
                  placeholder="z.B. 4 Stück, 80x80cm"
                />
              </motion.div>
            )}
          </motion.div>
        );

      default:
        return null;
    }
  };

  const renderElementForm = (element: UnterbauelementData, index: number) => {
    const fields = getFieldsForType(element.produktTyp);
    const models = getModelsForType(element.produktTyp);

    return (
      <div className="element-form-content">
        {/* Produkt Typ Selection */}
        <motion.div
          className="form-field"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
        >
          <label>
            Produkt Typ <span className="required">*</span>
          </label>
          <select
            value={element.produktTyp}
            onChange={(e) => handleProduktTypChange(index, e.target.value)}
          >
            <option value="">Bitte wählen...</option>
            {produktTypen.map(typ => (
              <option key={typ} value={typ}>{typ}</option>
            ))}
          </select>
        </motion.div>

        {/* Modell Selection */}
        <AnimatePresence>
          {element.produktTyp && (
            <motion.div
              className="form-field"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              <label>
                Modell <span className="required">*</span>
              </label>
              <select
                value={element.modell}
                onChange={(e) => handleModellChange(index, e.target.value)}
              >
                <option value="">Bitte wählen...</option>
                {models.map(model => (
                  <option key={model} value={model}>{model}</option>
                ))}
              </select>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Dynamic Fields based on Produkt Typ */}
        <AnimatePresence>
          {element.produktTyp && element.modell && (
            <motion.div
              className="dynamic-fields-grid"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              {fields.map(field => renderField(element, index, field))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  };

  return (
    <div className="unterbauelemente-step">
      <motion.div
        className="section-header"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
      >
        <h2>Unterbauelemente</h2>
        <p className="section-description">
          Fügen Sie alle benötigten Unterbauelemente hinzu
        </p>
      </motion.div>

      {/* Element Cards */}
      <div className="element-cards">
        {elements.map((element, index) => (
          <motion.div
            key={element.id}
            className={`element-card ${expandedIndex === index ? 'expanded' : 'collapsed'}`}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: index * 0.1 }}
          >
            <div
              className="element-card-header"
              onClick={() => setExpandedIndex(expandedIndex === index ? -1 : index)}
            >
              <div className="element-card-title">
                <span className="element-number">{index + 1}</span>
                <span className="element-label">{getElementLabel(element, index)}</span>
              </div>
              <div className="element-card-actions">
                {elements.length > 1 && (
                  <button
                    type="button"
                    className="remove-element-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeElement(index);
                    }}
                    title="Element entfernen"
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
                  className="element-card-content"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  {renderElementForm(element, index)}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        ))}
      </div>

      {/* Add Element Button */}
      <motion.button
        type="button"
        className="add-element-btn"
        onClick={addElement}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3, delay: 0.2 }}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
        Weiteres Unterbauelement hinzufügen
      </motion.button>

      {/* Weitere Produkte Section */}
      {updateWeitereProdukte && (
        <WeitereProdukteSectionInline
          weitereProdukte={weitereProdukte}
          updateWeitereProdukte={updateWeitereProdukte}
        />
      )}

      {/* Global Bemerkungen Section */}
      <motion.div
        className="global-bemerkungen-section"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.3 }}
      >
        <label htmlFor="globalBemerkungen">
          Bemerkungen
        </label>
        <textarea
          id="globalBemerkungen"
          value={bemerkungen}
          onChange={(e) => updateBemerkungen?.(e.target.value)}
          placeholder="Zusätzliche Anmerkungen oder Bemerkungen..."
          rows={4}
        />
      </motion.div>
    </div>
  );
};

export default UnterbauelementeStep;
export type { UnterbauelementData };
