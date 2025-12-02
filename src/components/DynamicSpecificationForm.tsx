import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import productConfigData from '../config/productConfig.json';
import type { DynamicFormData } from '../types/productConfig';
import { getMontageteams } from '../services/api';
import type { Montageteam } from '../services/api';
import { WeiteresProdukt } from '../types';
import './DynamicSpecificationForm.css';
import './SectionStyles.css';
import './WeitereProdukte.css';

interface ProductConfig {
  [category: string]: {
    [productType: string]: {
      models: string[];
      modelColors?: { [model: string]: string[] };
      fields: FieldConfig[];
    };
  };
}

interface FieldConfig {
  name: string;
  label: string;
  type: string;
  options?: string[];
  unit?: string;
  required: boolean;
  placeholder?: string;
  hasCustomOption?: boolean;
  conditionalType?: string;
  valueUnit?: string;
  valueLabel?: string;
  conditionalField?: {
    trigger: string;
    field: string;
    type: string;
    unit?: string;
    label: string;
  };
}

const productConfig = productConfigData as ProductConfig;

interface DynamicSpecificationFormProps {
  category: string;
  productType: string;
  model: string;
  formData: DynamicFormData;
  updateField: (fieldName: string, value: string | number | boolean | string[]) => void;
  weitereProdukte?: WeiteresProdukt[];
  updateWeitereProdukte?: (data: WeiteresProdukt[]) => void;
}

const categories = Object.keys(productConfig);
const generateId = () => Math.random().toString(36).substr(2, 9);

const createEmptyProdukt = (): WeiteresProdukt => ({
  id: generateId(),
  category: '',
  productType: '',
  model: '',
  specifications: {}
});

const DynamicSpecificationForm = ({
  category,
  productType,
  model,
  formData,
  updateField,
  weitereProdukte = [],
  updateWeitereProdukte
}: DynamicSpecificationFormProps) => {
  // State for dynamic Montageteams from database
  const [montageteams, setMontageteams] = useState<Montageteam[]>([]);
  // State for expanded product in weitere produkte
  const [expandedProduktIndex, setExpandedProduktIndex] = useState<number>(-1);

  // Fetch Montageteams from database on mount
  useEffect(() => {
    const fetchTeams = async () => {
      try {
        const teams = await getMontageteams();
        setMontageteams(teams.filter(t => t.is_active));
      } catch (err) {
        console.error('Error fetching montageteams:', err);
      }
    };
    fetchTeams();
  }, []);

  // Get fields and model colors for selected product
  const productTypeConfig = productConfig[category]?.[productType];
  const fields = productTypeConfig?.fields || [];
  const modelColors = productTypeConfig?.modelColors?.[model] || [];

  if (fields.length === 0) {
    return (
      <div className="no-fields-message">
        <p>Keine Spezifikationen verfügbar für diese Auswahl.</p>
      </div>
    );
  }

  const renderField = (field: FieldConfig, index: number) => {
    const value = formData[field.name] ?? '';

    switch (field.type) {
      case 'text':
        return (
          <motion.div
            key={field.name}
            className="form-field"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: index * 0.03 }}
          >
            <label htmlFor={field.name}>
              {field.label}
              {field.required && <span className="required">*</span>}
            </label>
            <input
              type="text"
              id={field.name}
              value={value as string}
              onChange={(e) => updateField(field.name, e.target.value)}
              placeholder={field.placeholder || `${field.label} eingeben`}
              required={field.required}
            />
          </motion.div>
        );

      case 'number':
        return (
          <motion.div
            key={field.name}
            className="form-field"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: index * 0.03 }}
          >
            <label htmlFor={field.name}>
              {field.label}
              {field.unit && <span className="unit-label">({field.unit})</span>}
              {field.required && <span className="required">*</span>}
            </label>
            <div className="number-input-wrapper">
              <input
                type="number"
                id={field.name}
                value={value as number || ''}
                onChange={(e) => updateField(field.name, parseFloat(e.target.value) || 0)}
                placeholder="0"
                required={field.required}
                min="0"
                step="1"
              />
              {field.unit && <span className="unit-suffix">{field.unit}</span>}
            </div>
          </motion.div>
        );

      case 'select':
        // Use dynamic options for montageteam field
        const selectOptions = field.name === 'montageteam'
          ? montageteams.map(t => t.name)
          : field.options || [];

        return (
          <motion.div
            key={field.name}
            className="form-field"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: index * 0.03 }}
          >
            <label htmlFor={field.name}>
              {field.label}
              {field.required && <span className="required">*</span>}
            </label>
            <select
              id={field.name}
              value={value as string}
              onChange={(e) => {
                updateField(field.name, e.target.value);
                // Handle conditional field trigger
                if (field.conditionalField && e.target.value !== field.conditionalField.trigger) {
                  updateField(field.conditionalField.field, '');
                }
              }}
              required={field.required}
            >
              <option value="">Bitte wählen...</option>
              {selectOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            {/* Conditional field for Sondermass etc */}
            {field.conditionalField && value === field.conditionalField.trigger && (
              <motion.div
                className="conditional-field"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
              >
                <label htmlFor={field.conditionalField.field}>
                  {field.conditionalField.label}
                  {field.conditionalField.unit && <span className="unit-label">({field.conditionalField.unit})</span>}
                </label>
                <input
                  type="number"
                  id={field.conditionalField.field}
                  value={formData[field.conditionalField.field] as number || ''}
                  onChange={(e) => updateField(field.conditionalField!.field, parseFloat(e.target.value) || 0)}
                  placeholder="Wert eingeben"
                  min="0"
                />
              </motion.div>
            )}
          </motion.div>
        );

      case 'modelColorSelect':
        const colors = modelColors.length > 0 ? modelColors : [];
        const isCustomColor = formData[`${field.name}Custom`] !== undefined && formData[`${field.name}Custom`] !== '';
        const showCustomInput = formData[`${field.name}ShowCustom`] === true || isCustomColor;

        return (
          <motion.div
            key={field.name}
            className="form-field"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: index * 0.03 }}
          >
            <label htmlFor={field.name}>
              {field.label}
              {field.required && <span className="required">*</span>}
            </label>
            {colors.length > 0 ? (
              <>
                <select
                  id={field.name}
                  value={showCustomInput ? 'custom' : (value as string)}
                  onChange={(e) => {
                    if (e.target.value === 'custom') {
                      updateField(`${field.name}ShowCustom`, true);
                      updateField(field.name, '');
                    } else {
                      updateField(`${field.name}ShowCustom`, false);
                      updateField(field.name, e.target.value);
                      updateField(`${field.name}Custom`, '');
                    }
                  }}
                  required={field.required}
                >
                  <option value="">Bitte wählen...</option>
                  {colors.map((color) => (
                    <option key={color} value={color}>
                      {color}
                    </option>
                  ))}
                  {field.hasCustomOption && <option value="custom">Sonderfarbe...</option>}
                </select>
                <AnimatePresence>
                  {showCustomInput && (
                    <motion.div
                      className="custom-color-input"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                    >
                      <input
                        type="text"
                        value={formData[`${field.name}Custom`] as string || ''}
                        onChange={(e) => {
                          updateField(`${field.name}Custom`, e.target.value);
                          updateField(field.name, e.target.value);
                        }}
                        placeholder="RAL Nummer eingeben (z.B. RAL 5010)"
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </>
            ) : (
              <input
                type="text"
                id={field.name}
                value={value as string}
                onChange={(e) => updateField(field.name, e.target.value)}
                placeholder="Farbe eingeben (z.B. RAL 7016)"
                required={field.required}
              />
            )}
          </motion.div>
        );

      case 'conditional':
        if (field.conditionalType === 'ja_nein_with_value') {
          const isJa = formData[`${field.name}Active`] === true;
          return (
            <motion.div
              key={field.name}
              className="form-field conditional-ja-nein"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: index * 0.03 }}
            >
              <label>
                {field.label}
                {field.required && <span className="required">*</span>}
              </label>
              <div className="ja-nein-buttons">
                <button
                  type="button"
                  className={`ja-nein-btn ${isJa ? 'active' : ''}`}
                  onClick={() => {
                    updateField(`${field.name}Active`, true);
                  }}
                >
                  Ja
                </button>
                <button
                  type="button"
                  className={`ja-nein-btn ${!isJa && formData[`${field.name}Active`] !== undefined ? 'active' : ''}`}
                  onClick={() => {
                    updateField(`${field.name}Active`, false);
                    updateField(field.name, '');
                  }}
                >
                  Nein
                </button>
              </div>
              <AnimatePresence>
                {isJa && (
                  <motion.div
                    className="conditional-value-input"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                  >
                    <label>{field.valueLabel || 'Wert'} ({field.valueUnit || 'cm'})</label>
                    <input
                      type="number"
                      value={value as number || ''}
                      onChange={(e) => updateField(field.name, parseFloat(e.target.value) || 0)}
                      placeholder={`${field.valueUnit || 'cm'} eingeben`}
                      min="0"
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        }
        return null;

      case 'bauform':
        const bauformType = formData['bauformType'] as string || '';
        const eingeruecktLinks = formData['bauformLinksActive'] === true;
        const eingeruecktRechts = formData['bauformRechtsActive'] === true;

        return (
          <motion.div
            key={field.name}
            className="form-field bauform-field"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: index * 0.03 }}
          >
            <label>
              {field.label}
              {field.required && <span className="required">*</span>}
            </label>
            <div className="bauform-button-group">
              <button
                type="button"
                className={`bauform-option-btn ${bauformType === 'BUNDIG' ? 'selected' : ''}`}
                onClick={() => {
                  updateField('bauformType', 'BUNDIG');
                  updateField('bauformLinksActive', false);
                  updateField('bauformRechtsActive', false);
                  updateField('bauformLinksValue', '');
                  updateField('bauformRechtsValue', '');
                  updateField(field.name, 'BUNDIG');
                }}
              >
                BÜNDIG
              </button>
              <button
                type="button"
                className={`bauform-option-btn ${bauformType === 'EINGERUCKT' ? 'selected' : ''}`}
                onClick={() => {
                  updateField('bauformType', 'EINGERUCKT');
                }}
              >
                EINGERÜCKT
              </button>
            </div>

            <AnimatePresence>
              {bauformType === 'EINGERUCKT' && (
                <motion.div
                  className="eingerueckt-options"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                >
                  <div className="eingerueckt-row">
                    <label className="checkbox-option">
                      <input
                        type="checkbox"
                        checked={eingeruecktLinks}
                        onChange={(e) => {
                          updateField('bauformLinksActive', e.target.checked);
                          if (!e.target.checked) updateField('bauformLinksValue', '');
                          // Update combined value
                          const linksVal = e.target.checked ? (formData['bauformLinksValue'] || '') : '';
                          const rechtsVal = eingeruecktRechts ? (formData['bauformRechtsValue'] || '') : '';
                          updateField(field.name, `EINGERUCKT${linksVal ? ` LINKS ${linksVal} CM` : ''}${rechtsVal ? ` RECHTS ${rechtsVal} CM` : ''}`);
                        }}
                      />
                      <span>Links</span>
                    </label>
                    {eingeruecktLinks && (
                      <input
                        type="number"
                        className="eingerueckt-value"
                        value={formData['bauformLinksValue'] as number || ''}
                        onChange={(e) => {
                          updateField('bauformLinksValue', e.target.value);
                          const rechtsVal = eingeruecktRechts ? (formData['bauformRechtsValue'] || '') : '';
                          updateField(field.name, `EINGERUCKT LINKS ${e.target.value} CM${rechtsVal ? ` RECHTS ${rechtsVal} CM` : ''}`);
                        }}
                        placeholder="cm"
                        min="0"
                      />
                    )}
                  </div>
                  <div className="eingerueckt-row">
                    <label className="checkbox-option">
                      <input
                        type="checkbox"
                        checked={eingeruecktRechts}
                        onChange={(e) => {
                          updateField('bauformRechtsActive', e.target.checked);
                          if (!e.target.checked) updateField('bauformRechtsValue', '');
                          // Update combined value
                          const linksVal = eingeruecktLinks ? (formData['bauformLinksValue'] || '') : '';
                          const rechtsVal = e.target.checked ? (formData['bauformRechtsValue'] || '') : '';
                          updateField(field.name, `EINGERUCKT${linksVal ? ` LINKS ${linksVal} CM` : ''}${rechtsVal ? ` RECHTS ${rechtsVal} CM` : ''}`);
                        }}
                      />
                      <span>Rechts</span>
                    </label>
                    {eingeruecktRechts && (
                      <input
                        type="number"
                        className="eingerueckt-value"
                        value={formData['bauformRechtsValue'] as number || ''}
                        onChange={(e) => {
                          updateField('bauformRechtsValue', e.target.value);
                          const linksVal = eingeruecktLinks ? (formData['bauformLinksValue'] || '') : '';
                          updateField(field.name, `EINGERUCKT${linksVal ? ` LINKS ${linksVal} CM` : ''} RECHTS ${e.target.value} CM`);
                        }}
                        placeholder="cm"
                        min="0"
                      />
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        );

      case 'fundament':
        const fundamentValue = value as string;
        const showFundamentInput = fundamentValue === 'Aylux' || fundamentValue === 'Kunde';

        return (
          <motion.div
            key={field.name}
            className="form-field"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: index * 0.03 }}
          >
            <label htmlFor={field.name}>
              {field.label}
              {field.required && <span className="required">*</span>}
            </label>
            <select
              id={field.name}
              value={fundamentValue}
              onChange={(e) => {
                updateField(field.name, e.target.value);
                if (e.target.value !== 'Aylux' && e.target.value !== 'Kunde') {
                  updateField(`${field.name}Value`, '');
                }
              }}
              required={field.required}
            >
              <option value="">Bitte wählen...</option>
              {field.options?.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            <AnimatePresence>
              {showFundamentInput && (
                <motion.div
                  className="fundament-value-input"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                >
                  <label>Fundament Anzahl/Details</label>
                  <input
                    type="text"
                    value={formData[`${field.name}Value`] as string || ''}
                    onChange={(e) => updateField(`${field.name}Value`, e.target.value)}
                    placeholder="Anzahl oder Details eingeben"
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        );

      case 'markise_trigger':
        const markiseActive = formData['markiseActive'] === true;

        return (
          <motion.div
            key={field.name}
            className="form-field markise-trigger-field"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: index * 0.03 }}
          >
            <label>
              {field.label}
              {field.required && <span className="required">*</span>}
            </label>
            <div className="ja-nein-buttons">
              <button
                type="button"
                className={`ja-nein-btn ${markiseActive ? 'active' : ''}`}
                onClick={() => {
                  updateField('markiseActive', true);
                }}
              >
                Ja
              </button>
              <button
                type="button"
                className={`ja-nein-btn ${!markiseActive && formData['markiseActive'] !== undefined ? 'active' : ''}`}
                onClick={() => {
                  updateField('markiseActive', false);
                  updateField('markiseData', '');
                }}
              >
                Nein
              </button>
            </div>
            {markiseActive && (
              <div className="markise-info-hint">
                <span className="hint-icon">i</span>
                <span>Die Markise-Konfiguration erfolgt im nächsten Schritt.</span>
              </div>
            )}
          </motion.div>
        );

      case 'textarea':
        return (
          <motion.div
            key={field.name}
            className="form-field full-width"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: index * 0.03 }}
          >
            <label htmlFor={field.name}>
              {field.label}
              {field.required && <span className="required">*</span>}
            </label>
            <textarea
              id={field.name}
              value={value as string}
              onChange={(e) => updateField(field.name, e.target.value)}
              placeholder={field.placeholder || `${field.label} eingeben`}
              required={field.required}
              rows={4}
            />
          </motion.div>
        );

      default:
        return null;
    }
  };

  // Weitere Produkte helper functions
  const handleWPCategoryChange = (index: number, value: string) => {
    if (!updateWeitereProdukte) return;
    const newProducts = [...weitereProdukte];
    newProducts[index] = {
      ...newProducts[index],
      category: value,
      productType: '',
      model: '',
      specifications: {}
    };
    updateWeitereProdukte(newProducts);
  };

  const handleWPProductTypeChange = (index: number, value: string) => {
    if (!updateWeitereProdukte) return;
    const newProducts = [...weitereProdukte];
    newProducts[index] = {
      ...newProducts[index],
      productType: value,
      model: '',
      specifications: {}
    };
    updateWeitereProdukte(newProducts);
  };

  const handleWPModelChange = (index: number, value: string) => {
    if (!updateWeitereProdukte) return;
    const newProducts = [...weitereProdukte];
    newProducts[index] = {
      ...newProducts[index],
      model: value,
      specifications: {}
    };
    updateWeitereProdukte(newProducts);
  };

  const handleWPSpecChange = (index: number, fieldName: string, value: string | number | boolean) => {
    if (!updateWeitereProdukte) return;
    const newProducts = [...weitereProdukte];
    newProducts[index] = {
      ...newProducts[index],
      specifications: {
        ...newProducts[index].specifications,
        [fieldName]: value
      }
    };
    updateWeitereProdukte(newProducts);
  };

  const addWeitereProdukt = () => {
    if (!updateWeitereProdukte) return;
    const newProducts = [...weitereProdukte, createEmptyProdukt()];
    updateWeitereProdukte(newProducts);
    setExpandedProduktIndex(newProducts.length - 1);
  };

  const removeWeitereProdukt = (index: number) => {
    if (!updateWeitereProdukte) return;
    const newProducts = weitereProdukte.filter((_, i) => i !== index);
    updateWeitereProdukte(newProducts);
    if (expandedProduktIndex >= newProducts.length) {
      setExpandedProduktIndex(newProducts.length - 1);
    }
  };

  const getWPProductTypes = (cat: string) => {
    if (!cat) return [];
    return Object.keys(productConfig[cat] || {});
  };

  const getWPModels = (cat: string, pt: string) => {
    if (!cat || !pt) return [];
    return productConfig[cat]?.[pt]?.models || [];
  };

  const getWPFields = (cat: string, pt: string) => {
    if (!cat || !pt) return [];
    return productConfig[cat]?.[pt]?.fields || [];
  };

  const getWPColorsForModel = (cat: string, pt: string, mdl: string): string[] => {
    if (!cat || !pt || !mdl) return [];
    return productConfig[cat]?.[pt]?.modelColors?.[mdl] || [];
  };

  const getWPProductLabel = (product: WeiteresProdukt, index: number) => {
    if (product.category && product.productType) {
      return `${product.category} - ${product.productType}${product.model ? ` (${product.model})` : ''}`;
    }
    return `Weiteres Produkt ${index + 1}`;
  };

  const renderWPSpecField = (product: WeiteresProdukt, index: number, field: FieldConfig) => {
    const value = product.specifications[field.name];
    // Skip montageteam and markise_trigger fields in weitere produkte
    if (field.name === 'montageteam' || field.type === 'markise_trigger') return null;

    switch (field.type) {
      case 'number':
        return (
          <div key={field.name} className="form-field">
            <label>
              {field.label}
              {field.unit && <span className="unit-label">({field.unit})</span>}
              {field.required && <span className="required">*</span>}
            </label>
            <div className="number-input-wrapper">
              <input
                type="number"
                value={value as number || ''}
                onChange={(e) => handleWPSpecChange(index, field.name, parseFloat(e.target.value) || 0)}
                placeholder="0"
                min="0"
              />
              {field.unit && <span className="unit-suffix">{field.unit}</span>}
            </div>
          </div>
        );

      case 'select':
        return (
          <div key={field.name} className="form-field">
            <label>
              {field.label}
              {field.required && <span className="required">*</span>}
            </label>
            <select
              value={value as string || ''}
              onChange={(e) => handleWPSpecChange(index, field.name, e.target.value)}
            >
              <option value="">Bitte wählen...</option>
              {field.options?.map(opt => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </div>
        );

      case 'modelColorSelect':
        const colors = getWPColorsForModel(product.category, product.productType, product.model);
        return (
          <div key={field.name} className="form-field">
            <label>
              {field.label}
              {field.required && <span className="required">*</span>}
            </label>
            <select
              value={value as string || ''}
              onChange={(e) => handleWPSpecChange(index, field.name, e.target.value)}
              disabled={!product.model}
            >
              <option value="">Bitte wählen...</option>
              {colors.map(color => (
                <option key={color} value={color}>{color}</option>
              ))}
              {field.hasCustomOption && <option value="SONDERFARBE">SONDERFARBE</option>}
            </select>
          </div>
        );

      case 'conditional':
        const isActive = product.specifications[`${field.name}Active`] === true;
        return (
          <div key={field.name} className="form-field conditional-field">
            <label>
              {field.label}
              {field.required && <span className="required">*</span>}
            </label>
            <div className="button-group">
              <button
                type="button"
                className={`option-btn ${isActive ? 'selected' : ''}`}
                onClick={() => handleWPSpecChange(index, `${field.name}Active`, true)}
              >
                Ja
              </button>
              <button
                type="button"
                className={`option-btn ${product.specifications[`${field.name}Active`] === false ? 'selected' : ''}`}
                onClick={() => handleWPSpecChange(index, `${field.name}Active`, false)}
              >
                Nein
              </button>
            </div>
            {isActive && (
              <div className="conditional-value">
                <input
                  type="number"
                  value={value as number || ''}
                  onChange={(e) => handleWPSpecChange(index, field.name, parseFloat(e.target.value) || 0)}
                  placeholder="0"
                />
                {field.valueUnit && <span className="unit-suffix">{field.valueUnit}</span>}
              </div>
            )}
          </div>
        );

      case 'fundament':
        return (
          <div key={field.name} className="form-field">
            <label>
              {field.label}
              {field.required && <span className="required">*</span>}
            </label>
            <select
              value={value as string || ''}
              onChange={(e) => handleWPSpecChange(index, field.name, e.target.value)}
            >
              <option value="">Bitte wählen...</option>
              {field.options?.map(opt => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
            {value && (
              <div className="fundament-details">
                <label>Fundament Anzahl/Details</label>
                <input
                  type="text"
                  value={product.specifications.fundamentValue as string || ''}
                  onChange={(e) => handleWPSpecChange(index, 'fundamentValue', e.target.value)}
                  placeholder="z.B. 4 Stück, 80x80cm"
                />
              </div>
            )}
          </div>
        );

      case 'bauform':
        const bauformType = product.specifications.bauformType as string;
        return (
          <div key={field.name} className="form-field bauform-field">
            <label>
              {field.label}
              {field.required && <span className="required">*</span>}
            </label>
            <div className="button-group">
              <button
                type="button"
                className={`option-btn ${bauformType === 'BUNDIG' ? 'selected' : ''}`}
                onClick={() => handleWPSpecChange(index, 'bauformType', 'BUNDIG')}
              >
                BÜNDIG
              </button>
              <button
                type="button"
                className={`option-btn ${bauformType === 'EINGERUCKT' ? 'selected' : ''}`}
                onClick={() => handleWPSpecChange(index, 'bauformType', 'EINGERUCKT')}
              >
                EINGERÜCKT
              </button>
            </div>
            {bauformType === 'EINGERUCKT' && (
              <div className="bauform-details">
                <div className="bauform-option">
                  <label>
                    <input
                      type="checkbox"
                      checked={product.specifications.bauformLinksActive === true}
                      onChange={(e) => handleWPSpecChange(index, 'bauformLinksActive', e.target.checked)}
                    />
                    Links
                  </label>
                  {product.specifications.bauformLinksActive && (
                    <input
                      type="number"
                      value={product.specifications.bauformLinksValue as number || ''}
                      onChange={(e) => handleWPSpecChange(index, 'bauformLinksValue', parseFloat(e.target.value) || 0)}
                      placeholder="mm"
                    />
                  )}
                </div>
                <div className="bauform-option">
                  <label>
                    <input
                      type="checkbox"
                      checked={product.specifications.bauformRechtsActive === true}
                      onChange={(e) => handleWPSpecChange(index, 'bauformRechtsActive', e.target.checked)}
                    />
                    Rechts
                  </label>
                  {product.specifications.bauformRechtsActive && (
                    <input
                      type="number"
                      value={product.specifications.bauformRechtsValue as number || ''}
                      onChange={(e) => handleWPSpecChange(index, 'bauformRechtsValue', parseFloat(e.target.value) || 0)}
                      placeholder="mm"
                    />
                  )}
                </div>
              </div>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  const renderWPProductForm = (product: WeiteresProdukt, index: number) => {
    const productTypes = getWPProductTypes(product.category);
    const models = getWPModels(product.category, product.productType);
    const wpFields = getWPFields(product.category, product.productType);

    return (
      <div className="product-form-content">
        <div className="form-field">
          <label>Kategorie <span className="required">*</span></label>
          <select
            value={product.category}
            onChange={(e) => handleWPCategoryChange(index, e.target.value)}
          >
            <option value="">Bitte wählen...</option>
            {categories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>

        {product.category && (
          <div className="form-field">
            <label>Produkttyp <span className="required">*</span></label>
            <select
              value={product.productType}
              onChange={(e) => handleWPProductTypeChange(index, e.target.value)}
            >
              <option value="">Bitte wählen...</option>
              {productTypes.map(pt => (
                <option key={pt} value={pt}>{pt}</option>
              ))}
            </select>
          </div>
        )}

        {product.productType && models.length > 0 && (
          <div className="form-field">
            <label>Modell <span className="required">*</span></label>
            <select
              value={product.model}
              onChange={(e) => handleWPModelChange(index, e.target.value)}
            >
              <option value="">Bitte wählen...</option>
              {models.map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
        )}

        {product.model && (
          <div className="specs-grid">
            {wpFields.map(field => renderWPSpecField(product, index, field))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="dynamic-specification-form">
      <motion.div
        className="section-header"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
      >
        <h2>Spezifikationen</h2>
        <p className="section-description">
          {category} / {productType} / {model}
        </p>
      </motion.div>

      <div className="specifications-grid">
        {fields.map((field, index) => renderField(field, index))}
      </div>

      {/* Weitere Produkte Section */}
      {updateWeitereProdukte && (
        <div className="weitere-produkte-section">
          <motion.div
            className="section-divider"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <h3>Weitere Produkte</h3>
            <p className="section-description">Fügen Sie weitere Produkte für diesen Kunden hinzu (optional)</p>
          </motion.div>

          {/* Product Cards */}
          {weitereProdukte.length > 0 && (
            <div className="product-cards">
              {weitereProdukte.map((product, index) => (
                <motion.div
                  key={product.id}
                  className={`product-card ${expandedProduktIndex === index ? 'expanded' : 'collapsed'}`}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.1 }}
                >
                  <div
                    className="product-card-header"
                    onClick={() => setExpandedProduktIndex(expandedProduktIndex === index ? -1 : index)}
                  >
                    <div className="product-card-title">
                      <span className="product-number">{index + 1}</span>
                      <span className="product-label">{getWPProductLabel(product, index)}</span>
                    </div>
                    <div className="product-card-actions">
                      <button
                        type="button"
                        className="remove-product-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeWeitereProdukt(index);
                        }}
                        title="Produkt entfernen"
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                      <span className={`expand-icon ${expandedProduktIndex === index ? 'expanded' : ''}`}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="6,9 12,15 18,9" />
                        </svg>
                      </span>
                    </div>
                  </div>
                  <AnimatePresence>
                    {expandedProduktIndex === index && (
                      <motion.div
                        className="product-card-content"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3 }}
                      >
                        {renderWPProductForm(product, index)}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              ))}
            </div>
          )}

          {/* Add Product Button */}
          <motion.button
            type="button"
            className="add-product-btn"
            onClick={addWeitereProdukt}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3, delay: 0.2 }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Weiteres Produkt hinzufügen
          </motion.button>
        </div>
      )}
    </div>
  );
};

export default DynamicSpecificationForm;
