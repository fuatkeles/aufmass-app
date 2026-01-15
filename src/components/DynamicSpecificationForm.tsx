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
  allowZero?: boolean;
  positions?: string[];
  gridGroup?: string;
  conditionalField?: {
    trigger: string;
    field: string;
    type: string;
    unit?: string;
    label: string;
  };
  showWhen?: {
    field: string;
    value?: string;
    notEquals?: string;
  };
}

const productConfig = productConfigData as ProductConfig;

interface MissingField {
  name: string;
  label: string;
}

interface DynamicSpecificationFormProps {
  category: string;
  productType: string;
  model: string | string[];
  formData: DynamicFormData;
  updateField: (fieldName: string, value: string | number | boolean | string[]) => void;
  weitereProdukte?: WeiteresProdukt[];
  updateWeitereProdukte?: (data: WeiteresProdukt[]) => void;
  showValidationErrors?: boolean;
  missingFields?: MissingField[];
  bemerkungen?: string;
  updateBemerkungen?: (value: string) => void;
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
  updateWeitereProdukte,
  showValidationErrors = false,
  missingFields = [],
  bemerkungen = '',
  updateBemerkungen
}: DynamicSpecificationFormProps) => {
  // State for dynamic Montageteams from database
  const [montageteams, setMontageteams] = useState<Montageteam[]>([]);
  // State for expanded product in weitere produkte
  const [expandedProduktIndex, setExpandedProduktIndex] = useState<number>(-1);
  // State for mobile missing fields dropdown
  const [showMissingDropdown, setShowMissingDropdown] = useState(false);

  // Scroll to field function
  const scrollToField = (fieldName: string) => {
    const fieldElement = document.getElementById(fieldName);
    if (fieldElement) {
      fieldElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // Add highlight animation
      fieldElement.classList.add('field-highlight');
      setTimeout(() => fieldElement.classList.remove('field-highlight'), 2000);
    }
    setShowMissingDropdown(false);
  };

  // Helper: Check if field should show required indicator
  // ALL fields are required EXCEPT: montageteam, bemerkungen
  const isFieldRequired = (fieldName: string): boolean => {
    const excludedFields = ['montageteam', 'bemerkungen'];
    return !excludedFields.includes(fieldName);
  };

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
  // Get total required fields count
  const totalRequiredFields = productTypeConfig?.fields?.filter((f: FieldConfig) => f.required).length || 0;
  const filledRequiredFields = totalRequiredFields - missingFields.length;
  const fields = productTypeConfig?.fields || [];
  // For model colors, use first selected model if array
  const firstModel = Array.isArray(model) ? model[0] : model;
  const modelColors = productTypeConfig?.modelColors?.[firstModel] || [];
  // Display string for model (join if array)
  const modelDisplay = Array.isArray(model) ? model.join(', ') : model;

  if (fields.length === 0) {
    return (
      <div className="no-fields-message">
        <p>Keine Spezifikationen verfügbar für diese Auswahl.</p>
      </div>
    );
  }

  const renderField = (field: FieldConfig, index: number, hasError: boolean = false) => {
    // Check showWhen condition
    if (field.showWhen) {
      const dependentValue = formData[field.showWhen.field];
      // Support both value (equals) and notEquals conditions
      if (field.showWhen.value !== undefined) {
        if (dependentValue !== field.showWhen.value) {
          return null; // Don't render this field
        }
      } else if (field.showWhen.notEquals !== undefined) {
        if (dependentValue === field.showWhen.notEquals || !dependentValue) {
          return null; // Don't render this field
        }
      }
    }

    const value = formData[field.name] ?? '';
    const errorClass = hasError ? ' field-error' : '';

    switch (field.type) {
      case 'text':
        return (
          <motion.div
            key={field.name}
            className={`form-field${errorClass}`}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: index * 0.03 }}
          >
            <label htmlFor={field.name}>
              {field.label}
              {isFieldRequired(field.name) && <span className="required">*</span>}
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
            className={`form-field${errorClass}`}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: index * 0.03 }}
          >
            <label htmlFor={field.name}>
              {field.label}
              {field.unit && <span className="unit-label">({field.unit})</span>}
              {isFieldRequired(field.name) && <span className="required">*</span>}
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
            className={`form-field${errorClass}`}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: index * 0.03 }}
          >
            <label htmlFor={field.name}>
              {field.label}
              {isFieldRequired(field.name) && <span className="required">*</span>}
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
              {isFieldRequired(field.name) && <span className="required">*</span>}
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

      case 'multiselect':
        const selectedValues = Array.isArray(value) ? value as string[] : [];
        return (
          <motion.div
            key={field.name}
            id={field.name}
            className={`form-field multiselect-field${errorClass}`}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: index * 0.03 }}
          >
            <label>
              {field.label}
              {isFieldRequired(field.name) && <span className="required">*</span>}
            </label>
            <div className="multiselect-options">
              {field.options?.map((option) => {
                const isSelected = selectedValues.includes(option);
                const isKeineSelected = selectedValues.includes('Keine');
                // If "Keine" is selected, disable other options; if other option selected, disable "Keine"
                const isDisabled = option === 'Keine'
                  ? selectedValues.length > 0 && !isKeineSelected
                  : isKeineSelected;

                return (
                  <label
                    key={option}
                    className={`multiselect-checkbox ${isSelected ? 'selected' : ''} ${isDisabled ? 'disabled' : ''}`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      disabled={isDisabled}
                      onChange={(e) => {
                        let newValues: string[];
                        if (option === 'Keine') {
                          // If selecting "Keine", clear all others
                          newValues = e.target.checked ? ['Keine'] : [];
                        } else {
                          if (e.target.checked) {
                            // Add this option, remove "Keine" if present
                            newValues = [...selectedValues.filter(v => v !== 'Keine'), option];
                          } else {
                            // Remove this option
                            newValues = selectedValues.filter(v => v !== option);
                          }
                        }
                        updateField(field.name, newValues);
                      }}
                    />
                    <span className="checkbox-label">{option}</span>
                  </label>
                );
              })}
            </div>
          </motion.div>
        );

      case 'seitenmarkise':
        // Parse existing seitenmarkise data
        type SeitenmarkisePosition = { active: boolean; aufteilung: string; breite?: number; links?: number; rechts?: number };
        type SeitenmarkiseData = Record<string, SeitenmarkisePosition>;

        let seitenmarkiseData: SeitenmarkiseData = {};
        const rawSeitenmarkise = formData[field.name];
        if (typeof rawSeitenmarkise === 'string' && rawSeitenmarkise) {
          try {
            seitenmarkiseData = JSON.parse(rawSeitenmarkise);
          } catch {
            seitenmarkiseData = {};
          }
        } else if (typeof rawSeitenmarkise === 'object' && rawSeitenmarkise && !Array.isArray(rawSeitenmarkise)) {
          seitenmarkiseData = rawSeitenmarkise as SeitenmarkiseData;
        }

        const positions = field.positions || ['Rechts', 'Links', 'Vorne', 'Hinten'];

        const updateSeitenmarkise = (position: string, updates: Partial<{ active: boolean; aufteilung: string; breite?: number; links?: number; rechts?: number }>) => {
          const newData = { ...seitenmarkiseData };
          newData[position] = { ...newData[position], ...updates };
          // If deactivating, clear the data for that position
          if (updates.active === false) {
            delete newData[position];
          }
          updateField(field.name, JSON.stringify(newData));
        };

        return (
          <motion.div
            key={field.name}
            id={field.name}
            className="form-field seitenmarkise-field full-width"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: index * 0.03 }}
          >
            <label className="seitenmarkise-main-label">
              {field.label}
              <span className="optional-hint">(Optional)</span>
            </label>
            <div className="seitenmarkise-positions">
              {positions.map((position) => {
                const posData = seitenmarkiseData[position] || { active: false, aufteilung: '' };
                const isActive = posData.active === true;
                const aufteilung = posData.aufteilung || '';

                return (
                  <div key={position} className={`seitenmarkise-position ${isActive ? 'active' : ''}`}>
                    <label className="position-checkbox">
                      <input
                        type="checkbox"
                        checked={isActive}
                        onChange={(e) => {
                          if (e.target.checked) {
                            updateSeitenmarkise(position, { active: true, aufteilung: '' });
                          } else {
                            updateSeitenmarkise(position, { active: false });
                          }
                        }}
                      />
                      <span className="position-label">{position}</span>
                    </label>

                    <AnimatePresence>
                      {isActive && (
                        <motion.div
                          className="position-details"
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                        >
                          <div className="aufteilung-selection">
                            <label className="aufteilung-option">
                              <input
                                type="radio"
                                name={`aufteilung-${field.name}-${position}`}
                                checked={aufteilung === 'mit'}
                                onChange={() => updateSeitenmarkise(position, {
                                  aufteilung: 'mit',
                                  breite: undefined,
                                  links: posData.links || undefined,
                                  rechts: posData.rechts || undefined
                                })}
                              />
                              <span>Mit Aufteilung</span>
                            </label>
                            <label className="aufteilung-option">
                              <input
                                type="radio"
                                name={`aufteilung-${field.name}-${position}`}
                                checked={aufteilung === 'ohne'}
                                onChange={() => updateSeitenmarkise(position, {
                                  aufteilung: 'ohne',
                                  links: undefined,
                                  rechts: undefined,
                                  breite: posData.breite || undefined
                                })}
                              />
                              <span>Ohne Aufteilung</span>
                            </label>
                          </div>

                          <AnimatePresence>
                            {aufteilung === 'mit' && (
                              <motion.div
                                className="aufteilung-inputs mit-aufteilung"
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                              >
                                <div className="input-row">
                                  <label>Links:</label>
                                  <div className="input-with-unit">
                                    <input
                                      type="number"
                                      value={posData.links || ''}
                                      onChange={(e) => updateSeitenmarkise(position, {
                                        links: e.target.value ? parseFloat(e.target.value) : undefined
                                      })}
                                      placeholder="0"
                                      min="0"
                                    />
                                    <span className="unit">mm</span>
                                  </div>
                                </div>
                                <div className="input-row">
                                  <label>Rechts:</label>
                                  <div className="input-with-unit">
                                    <input
                                      type="number"
                                      value={posData.rechts || ''}
                                      onChange={(e) => updateSeitenmarkise(position, {
                                        rechts: e.target.value ? parseFloat(e.target.value) : undefined
                                      })}
                                      placeholder="0"
                                      min="0"
                                    />
                                    <span className="unit">mm</span>
                                  </div>
                                </div>
                              </motion.div>
                            )}

                            {aufteilung === 'ohne' && (
                              <motion.div
                                className="aufteilung-inputs ohne-aufteilung"
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                              >
                                <div className="input-row">
                                  <label>Breite:</label>
                                  <div className="input-with-unit">
                                    <input
                                      type="number"
                                      value={posData.breite || ''}
                                      onChange={(e) => updateSeitenmarkise(position, {
                                        breite: e.target.value ? parseFloat(e.target.value) : undefined
                                      })}
                                      placeholder="0"
                                      min="0"
                                    />
                                    <span className="unit">mm</span>
                                  </div>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          </motion.div>
        );

      case 'conditional':
        if (field.conditionalType === 'ja_nein_with_value') {
          const isJa = formData[`${field.name}Active`] === true;
          const allowZero = field.allowZero === true;
          // For allowZero fields, show 0 as value; otherwise show empty string when 0
          const numValue = typeof value === 'number' ? value : (typeof value === 'string' ? parseFloat(value) : undefined);
          const displayValue: string | number = allowZero
            ? (numValue !== undefined && !isNaN(numValue) ? numValue : '')
            : (numValue || '');
          return (
            <motion.div
              key={field.name}
              id={field.name}
              className={`form-field conditional-ja-nein${errorClass}`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: index * 0.03 }}
            >
              <label>
                {field.label}
                {isFieldRequired(field.name) && <span className="required">*</span>}
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
                    <label>{field.valueLabel || 'Wert'} ({field.valueUnit || 'mm'})</label>
                    <input
                      type="number"
                      value={displayValue}
                      onChange={(e) => {
                        const inputValue = e.target.value;
                        if (inputValue === '') {
                          updateField(field.name, '');
                        } else {
                          updateField(field.name, parseFloat(inputValue));
                        }
                      }}
                      placeholder={`${field.valueUnit || 'mm'} eingeben`}
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
            id={field.name}
            className={`form-field bauform-field${errorClass}`}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: index * 0.03 }}
          >
            <label>
              {field.label}
              {isFieldRequired(field.name) && <span className="required">*</span>}
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
                          updateField(field.name, `EINGERUCKT LINKS ${e.target.value} MM${rechtsVal ? ` RECHTS ${rechtsVal} MM` : ''}`);
                        }}
                        placeholder="mm"
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
                          updateField(field.name, `EINGERUCKT${linksVal ? ` LINKS ${linksVal} MM` : ''}${rechtsVal ? ` RECHTS ${rechtsVal} MM` : ''}`);
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
                          updateField(field.name, `EINGERUCKT${linksVal ? ` LINKS ${linksVal} MM` : ''} RECHTS ${e.target.value} MM`);
                        }}
                        placeholder="mm"
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
            id={`${field.name}-container`}
            className={`form-field${errorClass}`}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: index * 0.03 }}
          >
            <label htmlFor={field.name}>
              {field.label}
              {isFieldRequired(field.name) && <span className="required">*</span>}
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
              {isFieldRequired(field.name) && <span className="required">*</span>}
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

      case 'senkrecht_section':
        const senkrechtActive = formData['senkrechtMarkiseActive'] === 'Ja';
        const senkrechtData = (() => {
          try {
            const data = formData['senkrechtMarkiseData'];
            if (typeof data === 'string') return JSON.parse(data);
            if (Array.isArray(data)) return data;
            return [];
          } catch { return []; }
        })();

        const emptySenkrecht = {
          position: '',
          modell: '',
          befestigungsart: '',
          breite: '',
          hoehe: '',
          zip: '',
          antrieb: '',
          antriebseite: '',
          anschlussseite: '',
          gestellfarbe: '',
          stoffNummer: ''
        };

        const updateSenkrechtData = (newData: typeof senkrechtData) => {
          updateField('senkrechtMarkiseData', JSON.stringify(newData));
        };

        const addSenkrecht = () => {
          updateSenkrechtData([...senkrechtData, { ...emptySenkrecht }]);
        };

        const removeSenkrecht = (idx: number) => {
          const newData = senkrechtData.filter((_: unknown, i: number) => i !== idx);
          updateSenkrechtData(newData);
        };

        const updateSenkrechtField = (idx: number, fieldName: string, fieldValue: string | number) => {
          const newData = [...senkrechtData];
          newData[idx] = { ...newData[idx], [fieldName]: fieldValue };
          updateSenkrechtData(newData);
        };

        return (
          <motion.div
            key={field.name}
            id={field.name}
            className="form-field senkrecht-section full-width"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: index * 0.03 }}
          >
            <div className="section-divider">
              <h3>SENKRECHT MARKISE</h3>
            </div>
            <div className="senkrecht-active-toggle">
              <label>Senkrecht Markise hinzufügen?</label>
              <div className="senkrecht-toggle-buttons">
                <button
                  type="button"
                  className={`senkrecht-toggle-btn ${senkrechtActive ? 'active' : ''}`}
                  onClick={() => {
                    updateField('senkrechtMarkiseActive', 'Ja');
                    if (senkrechtData.length === 0) {
                      updateSenkrechtData([{ ...emptySenkrecht }]);
                    }
                  }}
                >
                  Ja
                </button>
                <button
                  type="button"
                  className={`senkrecht-toggle-btn ${!senkrechtActive && formData['senkrechtMarkiseActive'] !== undefined ? 'active' : ''}`}
                  onClick={() => {
                    updateField('senkrechtMarkiseActive', 'Keine');
                    updateField('senkrechtMarkiseData', '[]');
                  }}
                >
                  Keine
                </button>
              </div>
            </div>

            <AnimatePresence>
              {senkrechtActive && senkrechtData.length > 0 && (
                <motion.div
                  className="senkrecht-items"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                >
                  {senkrechtData.map((senkrecht: typeof emptySenkrecht, idx: number) => (
                    <div key={idx} className="senkrecht-item-card">
                      <div className="senkrecht-item-header">
                        <span>Senkrecht Markise {idx + 1}</span>
                        {senkrechtData.length > 1 && (
                          <button
                            type="button"
                            className="remove-senkrecht-btn"
                            onClick={() => removeSenkrecht(idx)}
                          >
                            ×
                          </button>
                        )}
                      </div>
                      <div className="senkrecht-fields-grid">
                        {/* Row 1: Position, Modell, Befestigungsart */}
                        <div className="form-field">
                          <label>Position <span className="required">*</span></label>
                          <select
                            value={senkrecht.position || ''}
                            onChange={(e) => updateSenkrechtField(idx, 'position', e.target.value)}
                          >
                            <option value="">Bitte wählen</option>
                            <option value="LINKS">LINKS</option>
                            <option value="RECHTS">RECHTS</option>
                            <option value="FRONT">FRONT</option>
                            <option value="FRONT LINKS">FRONT LINKS</option>
                            <option value="FRONT RECHTS">FRONT RECHTS</option>
                            <option value="HINTEN LINKS">HINTEN LINKS</option>
                            <option value="HINTEN RECHTS">HINTEN RECHTS</option>
                          </select>
                        </div>
                        <div className="form-field">
                          <label>Modell <span className="required">*</span></label>
                          <select
                            value={senkrecht.modell || ''}
                            onChange={(e) => updateSenkrechtField(idx, 'modell', e.target.value)}
                          >
                            <option value="">Bitte wählen</option>
                            <option value="2020Z">2020Z</option>
                            <option value="1616Z">1616Z</option>
                          </select>
                        </div>
                        <div className="form-field">
                          <label>Befestigungsart <span className="required">*</span></label>
                          <select
                            value={senkrecht.befestigungsart || ''}
                            onChange={(e) => updateSenkrechtField(idx, 'befestigungsart', e.target.value)}
                          >
                            <option value="">Bitte wählen</option>
                            <option value="Zwischen Pfosten">Zwischen Pfosten</option>
                            <option value="Vor Pfosten">Vor Pfosten</option>
                          </select>
                        </div>
                        {/* Row 2: Breite, Höhe, ZIP */}
                        <div className="form-field">
                          <label>Breite <span className="unit-label">(mm)</span> <span className="required">*</span></label>
                          <input
                            type="number"
                            value={senkrecht.breite || ''}
                            onChange={(e) => updateSenkrechtField(idx, 'breite', e.target.value)}
                            placeholder="0"
                            min="0"
                          />
                        </div>
                        <div className="form-field">
                          <label>Höhe <span className="unit-label">(mm)</span> <span className="required">*</span></label>
                          <input
                            type="number"
                            value={senkrecht.hoehe || ''}
                            onChange={(e) => updateSenkrechtField(idx, 'hoehe', e.target.value)}
                            placeholder="0"
                            min="0"
                          />
                        </div>
                        <div className="form-field">
                          <label>ZIP <span className="required">*</span></label>
                          <select
                            value={senkrecht.zip || ''}
                            onChange={(e) => updateSenkrechtField(idx, 'zip', e.target.value)}
                          >
                            <option value="">Bitte wählen</option>
                            <option value="Ja">Ja</option>
                            <option value="Nein">Nein</option>
                          </select>
                        </div>
                        {/* Row 3: Antrieb, Antriebseite, Anschlussseite */}
                        <div className="form-field">
                          <label>Antrieb <span className="required">*</span></label>
                          <select
                            value={senkrecht.antrieb || ''}
                            onChange={(e) => updateSenkrechtField(idx, 'antrieb', e.target.value)}
                          >
                            <option value="">Bitte wählen</option>
                            <option value="Funk">Funk</option>
                            <option value="E-Motor">E-Motor</option>
                          </select>
                        </div>
                        <div className="form-field">
                          <label>Antriebseite <span className="required">*</span></label>
                          <select
                            value={senkrecht.antriebseite || ''}
                            onChange={(e) => updateSenkrechtField(idx, 'antriebseite', e.target.value)}
                          >
                            <option value="">Bitte wählen</option>
                            <option value="Links">Links</option>
                            <option value="Rechts">Rechts</option>
                          </select>
                        </div>
                        <div className="form-field">
                          <label>Anschlussseite <span className="required">*</span></label>
                          <select
                            value={senkrecht.anschlussseite || ''}
                            onChange={(e) => updateSenkrechtField(idx, 'anschlussseite', e.target.value)}
                          >
                            <option value="">Bitte wählen</option>
                            <option value="Links">Links</option>
                            <option value="Rechts">Rechts</option>
                          </select>
                        </div>
                        {/* Row 4: Gestellfarbe, Stoff Nummer */}
                        <div className="senkrecht-bottom-row">
                          <div className="form-field">
                            <label>Gestellfarbe <span className="required">*</span></label>
                            <input
                              type="text"
                              value={senkrecht.gestellfarbe || ''}
                              onChange={(e) => updateSenkrechtField(idx, 'gestellfarbe', e.target.value)}
                              placeholder="z.B. RAL 7016"
                            />
                          </div>
                          <div className="form-field">
                            <label>Stoff Nummer <span className="required">*</span></label>
                            <input
                              type="text"
                              value={senkrecht.stoffNummer || ''}
                              onChange={(e) => updateSenkrechtField(idx, 'stoffNummer', e.target.value)}
                              placeholder="Stoff Nummer eingeben"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                  <button
                    type="button"
                    className="add-senkrecht-btn"
                    onClick={addSenkrecht}
                  >
                    + Weitere Senkrecht Markise hinzufügen
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
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
              {isFieldRequired(field.name) && <span className="required">*</span>}
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

  const handleWPProductTypeChange = (index: number, value: string | string[]) => {
    if (!updateWeitereProdukte) return;
    const newProducts = [...weitereProdukte];
    newProducts[index] = {
      ...newProducts[index],
      productType: Array.isArray(value) ? value.join(', ') : value,
      model: '',
      specifications: {}
    };
    updateWeitereProdukte(newProducts);
  };

  // Handle multi-select product type toggle for Markise
  const handleWPProductTypeToggle = (index: number, productType: string) => {
    if (!updateWeitereProdukte) return;
    const product = weitereProdukte[index];
    const currentTypes = product.productType ? product.productType.split(', ').filter(t => t) : [];

    let newTypes: string[];
    if (currentTypes.includes(productType)) {
      newTypes = currentTypes.filter(t => t !== productType);
    } else {
      newTypes = [...currentTypes, productType];
    }

    const newProducts = [...weitereProdukte];
    newProducts[index] = {
      ...newProducts[index],
      productType: newTypes.join(', '),
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
    // Skip montageteam, markise_trigger, and senkrecht_section fields in weitere produkte
    if (field.name === 'montageteam' || field.type === 'markise_trigger' || field.type === 'senkrecht_section') return null;

    // Check showWhen condition for conditional field visibility
    if (field.showWhen) {
      const dependentValue = product.specifications[field.showWhen.field];
      // Support both value (equals) and notEquals conditions
      if (field.showWhen.value !== undefined) {
        if (dependentValue !== field.showWhen.value) {
          return null; // Don't render this field
        }
      } else if (field.showWhen.notEquals !== undefined) {
        if (dependentValue === field.showWhen.notEquals || !dependentValue) {
          return null; // Don't render this field
        }
      }
    }

    switch (field.type) {
      case 'number':
        return (
          <div key={field.name} className="form-field">
            <label>
              {field.label}
              {field.unit && <span className="unit-label">({field.unit})</span>}
              {isFieldRequired(field.name) && <span className="required">*</span>}
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
              {isFieldRequired(field.name) && <span className="required">*</span>}
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
              {isFieldRequired(field.name) && <span className="required">*</span>}
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
              {isFieldRequired(field.name) && <span className="required">*</span>}
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
              {isFieldRequired(field.name) && <span className="required">*</span>}
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
                  placeholder="z.B. 4 Stück, 80x80mm"
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
              {isFieldRequired(field.name) && <span className="required">*</span>}
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

      case 'multiselect':
        const wpMultiValue = (product.specifications[field.name] as string[]) || [];
        const handleWPMultiSelectChange = (option: string, checked: boolean) => {
          let newValue: string[];
          if (option === 'Keine') {
            newValue = checked ? ['Keine'] : [];
          } else {
            if (checked) {
              newValue = wpMultiValue.filter(v => v !== 'Keine');
              newValue.push(option);
            } else {
              newValue = wpMultiValue.filter(v => v !== option);
            }
          }
          handleWPSpecChange(index, field.name, newValue as unknown as string);
        };
        return (
          <div key={field.name} className="form-field full-width multiselect-field">
            <label>
              {field.label}
              {isFieldRequired(field.name) && <span className="required">*</span>}
            </label>
            <div className="multiselect-options">
              {field.options?.map(option => {
                const isSelected = wpMultiValue.includes(option);
                const isDisabled = option !== 'Keine' && wpMultiValue.includes('Keine');
                return (
                  <label
                    key={option}
                    className={`multiselect-checkbox ${isSelected ? 'selected' : ''} ${isDisabled ? 'disabled' : ''}`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      disabled={isDisabled}
                      onChange={(e) => handleWPMultiSelectChange(option, e.target.checked)}
                    />
                    <span>{option}</span>
                  </label>
                );
              })}
            </div>
          </div>
        );

      case 'seitenmarkise':
        const wpPositions = field.positions || ['Rechts', 'Links', 'Vorne', 'Hinten'];
        const wpSeitenmarkiseRaw = product.specifications[field.name];
        type WPSeitenmarkisePos = { active: boolean; aufteilung: string; links?: number; rechts?: number; breite?: number };
        let wpSeitenmarkiseData: Record<string, WPSeitenmarkisePos> = {};

        if (typeof wpSeitenmarkiseRaw === 'string' && wpSeitenmarkiseRaw) {
          try {
            wpSeitenmarkiseData = JSON.parse(wpSeitenmarkiseRaw);
          } catch {
            wpSeitenmarkiseData = {};
          }
        } else if (typeof wpSeitenmarkiseRaw === 'object' && wpSeitenmarkiseRaw && !Array.isArray(wpSeitenmarkiseRaw)) {
          wpSeitenmarkiseData = wpSeitenmarkiseRaw as Record<string, WPSeitenmarkisePos>;
        }

        const updateWPSeitenmarkise = (position: string, updates: Partial<WPSeitenmarkisePos>) => {
          const newData = { ...wpSeitenmarkiseData };
          newData[position] = { ...newData[position], ...updates };
          if (updates.active === false) {
            delete newData[position];
          }
          handleWPSpecChange(index, field.name, JSON.stringify(newData));
        };

        return (
          <div key={field.name} className="form-field full-width seitenmarkise-field">
            <label className="seitenmarkise-main-label">
              {field.label}
              <span className="optional-hint">(Optional)</span>
            </label>
            <div className="seitenmarkise-positions">
              {wpPositions.map(position => {
                const posData = wpSeitenmarkiseData[position] || { active: false, aufteilung: '' };
                const isActive = posData.active === true;
                const aufteilung = posData.aufteilung || '';

                return (
                  <div key={position} className={`seitenmarkise-position ${isActive ? 'active' : ''}`}>
                    <label className="position-checkbox">
                      <input
                        type="checkbox"
                        checked={isActive}
                        onChange={(e) => {
                          if (e.target.checked) {
                            updateWPSeitenmarkise(position, { active: true, aufteilung: '' });
                          } else {
                            updateWPSeitenmarkise(position, { active: false });
                          }
                        }}
                      />
                      <span className="position-label">{position}</span>
                    </label>

                    {isActive && (
                      <div className="position-details">
                        <div className="aufteilung-selection">
                          <label className="aufteilung-option">
                            <input
                              type="radio"
                              name={`aufteilung-wp-${product.id}-${position}`}
                              checked={aufteilung === 'mit'}
                              onChange={() => updateWPSeitenmarkise(position, { aufteilung: 'mit', breite: undefined })}
                            />
                            <span>Mit Aufteilung</span>
                          </label>
                          <label className="aufteilung-option">
                            <input
                              type="radio"
                              name={`aufteilung-wp-${product.id}-${position}`}
                              checked={aufteilung === 'ohne'}
                              onChange={() => updateWPSeitenmarkise(position, { aufteilung: 'ohne', links: undefined, rechts: undefined })}
                            />
                            <span>Ohne Aufteilung</span>
                          </label>
                        </div>

                        {aufteilung === 'mit' && (
                          <div className="aufteilung-inputs mit-aufteilung">
                            <div className="input-row">
                              <label>Links:</label>
                              <div className="input-with-unit">
                                <input
                                  type="number"
                                  value={posData.links || ''}
                                  onChange={(e) => updateWPSeitenmarkise(position, { links: parseFloat(e.target.value) || 0 })}
                                  placeholder="0"
                                  min="0"
                                />
                                <span className="unit">mm</span>
                              </div>
                            </div>
                            <div className="input-row">
                              <label>Rechts:</label>
                              <div className="input-with-unit">
                                <input
                                  type="number"
                                  value={posData.rechts || ''}
                                  onChange={(e) => updateWPSeitenmarkise(position, { rechts: parseFloat(e.target.value) || 0 })}
                                  placeholder="0"
                                  min="0"
                                />
                                <span className="unit">mm</span>
                              </div>
                            </div>
                          </div>
                        )}

                        {aufteilung === 'ohne' && (
                          <div className="aufteilung-inputs ohne-aufteilung">
                            <div className="input-row">
                              <label>Breite:</label>
                              <div className="input-with-unit">
                                <input
                                  type="number"
                                  value={posData.breite || ''}
                                  onChange={(e) => updateWPSeitenmarkise(position, { breite: parseFloat(e.target.value) || 0 })}
                                  placeholder="0"
                                  min="0"
                                />
                                <span className="unit">mm</span>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  const renderWPProductForm = (product: WeiteresProdukt, index: number) => {
    const productTypes = getWPProductTypes(product.category);
    const isMarkise = product.category === 'MARKISE';
    const selectedProductTypes = isMarkise && product.productType
      ? product.productType.split(', ').filter(t => t)
      : [];

    // For MARKISE, combine models from all selected produkttyps
    let models: string[] = [];
    if (isMarkise && selectedProductTypes.length > 0) {
      // Collect all models from all selected product types
      const allModels = selectedProductTypes.flatMap(pt => getWPModels(product.category, pt));
      // Remove duplicates
      models = [...new Set(allModels)];
    } else {
      models = getWPModels(product.category, product.productType);
    }

    // For fields, use first selected produkttyp (they share similar fields anyway)
    const effectiveProductType = isMarkise ? (selectedProductTypes[0] || '') : product.productType;
    const wpFields = getWPFields(product.category, effectiveProductType);

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

        {/* Produkttyp - MultiSelect dropdown for MARKISE, regular select for others */}
        {product.category && !isMarkise && (
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

        {/* MultiSelect Produkttyp dropdown for MARKISE */}
        {product.category && isMarkise && (
          <div className="form-field multiselect-field">
            <label>Produkttyp <span className="multi-hint">(Mehrfachauswahl möglich)</span></label>
            <div className="markise-multiselect-dropdown">
              <div className="multiselect-options markise-produkttyp-options">
                {productTypes.map(pt => {
                  const isSelected = selectedProductTypes.includes(pt);
                  return (
                    <label
                      key={pt}
                      className={`multiselect-checkbox ${isSelected ? 'selected' : ''}`}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleWPProductTypeToggle(index, pt)}
                      />
                      <span className="checkbox-label">{pt}</span>
                    </label>
                  );
                })}
              </div>
              {selectedProductTypes.length > 0 && (
                <div className="selected-types-summary">
                  Ausgewählt: {selectedProductTypes.join(', ')}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Model select for all products (including Markise) */}
        {((isMarkise && selectedProductTypes.length > 0) || (!isMarkise && product.productType)) && models.length > 0 && (
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

        {/* Specs for all products */}
        {product.model && (
          <div className="specs-grid">
            {wpFields.map(field => renderWPSpecField(product, index, field))}
          </div>
        )}

        {/* Markise Bemerkungen (Note field) for MARKISE category */}
        {isMarkise && product.model && (
          <div className="form-field full-width markise-bemerkungen-field">
            <label>Markise Bemerkung</label>
            <textarea
              value={product.specifications.markiseBemerkung as string || ''}
              onChange={(e) => handleWPSpecChange(index, 'markiseBemerkung', e.target.value)}
              placeholder="Zusätzliche Anmerkungen zur Markise..."
              rows={3}
            />
          </div>
        )}
      </div>
    );
  };

  // Helper function to check if a field is in the missing fields list
  const isFieldMissing = (fieldName: string): boolean => {
    return showValidationErrors && missingFields.some(f => f.name === fieldName || f.name.startsWith(fieldName));
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
          {category} / {productType} / {modelDisplay}
        </p>
      </motion.div>

      {/* Missing Fields Progress Bar - Always visible when there are missing fields */}
      <AnimatePresence>
        {missingFields.length > 0 && (
          <motion.div
            className="missing-fields-bar"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            <div className="missing-bar-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>

            {/* Desktop: Show field names */}
            <div className="missing-bar-content desktop-only">
              <span className="missing-label">Fehlt:</span>
              <div className="missing-fields-tags">
                {missingFields.slice(0, 4).map((field, idx) => (
                  <button
                    key={idx}
                    type="button"
                    className="missing-field-tag"
                    onClick={() => scrollToField(field.name)}
                  >
                    {field.label}
                  </button>
                ))}
                {missingFields.length > 4 && (
                  <span className="missing-more">+{missingFields.length - 4} weitere</span>
                )}
              </div>
            </div>

            {/* Mobile: Show count with dropdown */}
            <div className="missing-bar-content mobile-only">
              <button
                type="button"
                className="missing-count-btn"
                onClick={() => setShowMissingDropdown(!showMissingDropdown)}
              >
                <span>{missingFields.length} Felder fehlen</span>
                <svg className={`dropdown-arrow ${showMissingDropdown ? 'open' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="6,9 12,15 18,9" />
                </svg>
              </button>

              <AnimatePresence>
                {showMissingDropdown && (
                  <motion.div
                    className="missing-dropdown"
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                  >
                    {missingFields.map((field, idx) => (
                      <button
                        key={idx}
                        type="button"
                        className="missing-dropdown-item"
                        onClick={() => scrollToField(field.name)}
                      >
                        {field.label}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="missing-bar-progress">
              <span className="progress-text">{filledRequiredFields}/{totalRequiredFields}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* All fields complete message */}
      <AnimatePresence>
        {missingFields.length === 0 && totalRequiredFields > 0 && (
          <motion.div
            className="fields-complete-bar"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            <div className="complete-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22,4 12,14.01 9,11.01" />
              </svg>
            </div>
            <span>Alle Pflichtfelder ausgefüllt</span>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="specifications-grid">
        {(() => {
          const renderedGroups = new Set<string>();
          return fields.map((field, index) => {
            // If field has gridGroup, render as part of group
            if (field.gridGroup) {
              // Skip if already rendered this group
              if (renderedGroups.has(field.gridGroup)) {
                return null;
              }
              renderedGroups.add(field.gridGroup);

              // Get all fields in this group
              const groupFields = fields.filter(f => f.gridGroup === field.gridGroup);

              return (
                <div key={`group-${field.gridGroup}`} className={`field-grid-group field-grid-group-${groupFields.length}`}>
                  {groupFields.map((gf, gi) => renderField(gf, index + gi, isFieldMissing(gf.name)))}
                </div>
              );
            }

            // Regular field without group
            return renderField(field, index, isFieldMissing(field.name));
          });
        })()}
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
            <p className="section-description">Nur für komplett unabhängige Zusatzprodukte verwenden (z.B. 2. Überdachung am gleichen Haus, oder Wintergarten + separate Gelenkarmmarkise)</p>
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

export default DynamicSpecificationForm;
