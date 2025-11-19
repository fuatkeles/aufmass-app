import { motion } from 'framer-motion';
import productConfigData from '../config/productConfig.json';
import type { ProductConfig, FieldConfig, DynamicFormData } from '../types/productConfig';
import './DynamicSpecificationForm.css';
import './SectionStyles.css';

const productConfig = productConfigData as ProductConfig;

interface DynamicSpecificationFormProps {
  category: string;
  productType: string;
  model: string;
  formData: DynamicFormData;
  updateField: (fieldName: string, value: string | number | boolean) => void;
}

const DynamicSpecificationForm = ({
  category,
  productType,
  model,
  formData,
  updateField
}: DynamicSpecificationFormProps) => {
  // Get fields for selected product
  const fields = productConfig[category]?.[productType]?.fields || [];

  if (fields.length === 0) {
    return (
      <div className="no-fields-message">
        <p>⚠️ Keine Spezifikationen verfügbar für diese Auswahl.</p>
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
            transition={{ duration: 0.3, delay: index * 0.05 }}
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
            transition={{ duration: 0.3, delay: index * 0.05 }}
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
        return (
          <motion.div
            key={field.name}
            className="form-field"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: index * 0.05 }}
          >
            <label htmlFor={field.name}>
              {field.label}
              {field.required && <span className="required">*</span>}
            </label>
            <select
              id={field.name}
              value={value as string}
              onChange={(e) => updateField(field.name, e.target.value)}
              required={field.required}
            >
              <option value="">Bitte wählen...</option>
              {field.options?.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </motion.div>
        );

      case 'radio':
        return (
          <motion.div
            key={field.name}
            className="form-field radio-field"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: index * 0.05 }}
          >
            <label className="field-label">
              {field.label}
              {field.required && <span className="required">*</span>}
            </label>
            <div className="radio-group">
              {field.options?.map((option) => (
                <label key={option} className="radio-option">
                  <input
                    type="radio"
                    name={field.name}
                    value={option}
                    checked={value === option}
                    onChange={(e) => updateField(field.name, e.target.value)}
                    required={field.required}
                  />
                  <span className="radio-label">{option}</span>
                </label>
              ))}
            </div>
          </motion.div>
        );

      case 'boolean':
        return (
          <motion.div
            key={field.name}
            className="form-field checkbox-field"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: index * 0.05 }}
          >
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={value as boolean || false}
                onChange={(e) => updateField(field.name, e.target.checked)}
              />
              <span>{field.label}</span>
            </label>
          </motion.div>
        );

      case 'textarea':
        return (
          <motion.div
            key={field.name}
            className="form-field full-width"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: index * 0.05 }}
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
          {category} → {productType} → {model}
        </p>
      </motion.div>

      <div className="specifications-grid">
        {fields.map((field, index) => renderField(field, index))}
      </div>
    </div>
  );
};

export default DynamicSpecificationForm;
