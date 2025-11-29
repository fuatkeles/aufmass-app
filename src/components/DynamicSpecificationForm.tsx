import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import productConfigData from '../config/productConfig.json';
import type { DynamicFormData } from '../types/productConfig';
import { getMontageteams } from '../services/api';
import type { Montageteam } from '../services/api';
import './DynamicSpecificationForm.css';
import './SectionStyles.css';

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
}

const DynamicSpecificationForm = ({
  category,
  productType,
  model,
  formData,
  updateField
}: DynamicSpecificationFormProps) => {
  // State for dynamic Montageteams from database
  const [montageteams, setMontageteams] = useState<Montageteam[]>([]);

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
        const bauformType = formData['bauformType'] as string || 'BUNDIG';
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
            <div className="bauform-options">
              <label className="radio-option">
                <input
                  type="radio"
                  name="bauformType"
                  value="BUNDIG"
                  checked={bauformType === 'BUNDIG'}
                  onChange={() => {
                    updateField('bauformType', 'BUNDIG');
                    updateField('bauformLinksActive', false);
                    updateField('bauformRechtsActive', false);
                    updateField('bauformLinksValue', '');
                    updateField('bauformRechtsValue', '');
                    updateField(field.name, 'BUNDIG');
                  }}
                />
                <span>BÜNDIG</span>
              </label>
              <label className="radio-option">
                <input
                  type="radio"
                  name="bauformType"
                  value="EINGERUCKT"
                  checked={bauformType === 'EINGERUCKT'}
                  onChange={() => {
                    updateField('bauformType', 'EINGERUCKT');
                  }}
                />
                <span>EINGERÜCKT</span>
              </label>
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
    </div>
  );
};

export default DynamicSpecificationForm;
