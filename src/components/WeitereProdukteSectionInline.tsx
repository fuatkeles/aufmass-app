import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import productConfigData from '../config/productConfig.json';
import { WeiteresProdukt } from '../types';
import './WeitereProdukte.css';
import './DynamicSpecificationForm.css';

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
const categories = Object.keys(productConfig);

const generateId = () => Math.random().toString(36).substr(2, 9);

const createEmptyProdukt = (): WeiteresProdukt => ({
  id: generateId(),
  category: '',
  productType: '',
  model: '',
  specifications: {}
});

interface WeitereProdukteSectionInlineProps {
  weitereProdukte: WeiteresProdukt[];
  updateWeitereProdukte: (data: WeiteresProdukt[]) => void;
}

const WeitereProdukteSectionInline = ({
  weitereProdukte,
  updateWeitereProdukte
}: WeitereProdukteSectionInlineProps) => {
  const [expandedProduktIndex, setExpandedProduktIndex] = useState<number>(-1);

  // Helper functions for Weitere Produkte
  const getWPProductTypes = (cat: string) => {
    if (!cat || !productConfig[cat]) return [];
    return Object.keys(productConfig[cat]);
  };

  const getWPModels = (cat: string, pType: string) => {
    if (!cat || !pType || !productConfig[cat]?.[pType]) return [];
    return productConfig[cat][pType].models || [];
  };

  const getWPFields = (cat: string, pType: string) => {
    if (!cat || !pType || !productConfig[cat]?.[pType]) return [];
    return productConfig[cat][pType].fields || [];
  };

  const getWPModelColors = (cat: string, pType: string, mod: string) => {
    if (!cat || !pType || !mod || !productConfig[cat]?.[pType]) return [];
    return productConfig[cat][pType].modelColors?.[mod] || [];
  };

  const handleWPCategoryChange = (index: number, value: string) => {
    const newProducts = [...weitereProdukte];
    newProducts[index] = {
      ...createEmptyProdukt(),
      id: newProducts[index].id,
      category: value
    };
    updateWeitereProdukte(newProducts);
  };

  const handleWPProductTypeChange = (index: number, value: string) => {
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
    const newProducts = [...weitereProdukte];
    newProducts[index] = {
      ...newProducts[index],
      model: value,
      specifications: {
        ...newProducts[index].specifications,
        gestellfarbe: '' // Reset color when model changes
      }
    };
    updateWeitereProdukte(newProducts);
  };

  const handleWPSpecChange = (index: number, fieldName: string, value: string | number | boolean | string[]) => {
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
    const newProducts = [...weitereProdukte, createEmptyProdukt()];
    updateWeitereProdukte(newProducts);
    setExpandedProduktIndex(newProducts.length - 1);
  };

  const removeWeitereProdukt = (index: number) => {
    const newProducts = weitereProdukte.filter((_, i) => i !== index);
    updateWeitereProdukte(newProducts);
    if (expandedProduktIndex >= newProducts.length) {
      setExpandedProduktIndex(newProducts.length - 1);
    }
  };

  const getWPProductLabel = (product: WeiteresProdukt, index: number) => {
    if (product.category && product.productType) {
      let label = `${product.category} - ${product.productType}`;
      if (product.model) {
        label += ` (${product.model})`;
      }
      return label;
    }
    return `Weiteres Produkt ${index + 1}`;
  };

  const renderWPSpecField = (product: WeiteresProdukt, index: number, field: FieldConfig) => {
    const value = product.specifications[field.name] ?? '';

    // Skip certain fields
    if (field.type === 'markise_trigger' || field.name === 'montageteam') return null;

    // Check showWhen condition (same logic as DynamicSpecificationForm)
    if (field.showWhen) {
      const dependentValue = product.specifications[field.showWhen.field];
      if (field.showWhen.value !== undefined) {
        if (dependentValue !== field.showWhen.value) return null;
      } else if (field.showWhen.notEquals !== undefined) {
        if (dependentValue === field.showWhen.notEquals || !dependentValue) return null;
      }
    }

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
        const colors = getWPModelColors(product.category, product.productType, product.model);
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

      case 'ja_nein':
        return (
          <div key={field.name} className="form-field full-width">
            <label>
              {field.label}
              {field.required && <span className="required">*</span>}
            </label>
            <div className="ja-nein-buttons">
              <button
                type="button"
                className={`ja-nein-btn ${value === true ? 'active' : ''}`}
                onClick={() => handleWPSpecChange(index, field.name, true)}
              >
                Ja
              </button>
              <button
                type="button"
                className={`ja-nein-btn ${value === false ? 'active' : ''}`}
                onClick={() => handleWPSpecChange(index, field.name, false)}
              >
                Nein
              </button>
            </div>
          </div>
        );

      case 'conditional':
        const activeValue = product.specifications[`${field.name}Active`];
        return (
          <div key={field.name} className="form-field full-width">
            <label>
              {field.label}
              {field.required && <span className="required">*</span>}
            </label>
            <div className="ja-nein-buttons">
              <button
                type="button"
                className={`ja-nein-btn ${activeValue === true ? 'active' : ''}`}
                onClick={() => handleWPSpecChange(index, `${field.name}Active`, true)}
              >
                Ja
              </button>
              <button
                type="button"
                className={`ja-nein-btn ${activeValue === false ? 'active' : ''}`}
                onClick={() => handleWPSpecChange(index, `${field.name}Active`, false)}
              >
                Nein
              </button>
            </div>
            {activeValue === true && (
              <div className="conditional-value-input">
                <label>{field.valueLabel || field.label} {field.valueUnit && `(${field.valueUnit})`}</label>
                <input
                  type="number"
                  value={value as number || ''}
                  onChange={(e) => handleWPSpecChange(index, field.name, parseFloat(e.target.value) || 0)}
                  placeholder="Wert eingeben"
                  min="0"
                />
              </div>
            )}
          </div>
        );

      case 'fundament':
        return (
          <div key={field.name} className="form-field full-width">
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
              <div className="fundament-value-input">
                <label>Fundament Details</label>
                <input
                  type="text"
                  value={product.specifications[`${field.name}Value`] as string || ''}
                  onChange={(e) => handleWPSpecChange(index, `${field.name}Value`, e.target.value)}
                  placeholder="z.B. 4 Stück, 80x80cm"
                />
              </div>
            )}
          </div>
        );

      case 'bauform':
        const bauformType = product.specifications['bauformType'] as string;
        return (
          <div key={field.name} className="form-field full-width bauform-field">
            <label>
              {field.label}
              {field.required && <span className="required">*</span>}
            </label>
            <div className="bauform-options">
              <label className="radio-option">
                <input
                  type="radio"
                  name={`bauform-${product.id}`}
                  checked={bauformType === 'BUNDIG'}
                  onChange={() => handleWPSpecChange(index, 'bauformType', 'BUNDIG')}
                />
                <span>BÜNDIG</span>
              </label>
              <label className="radio-option">
                <input
                  type="radio"
                  name={`bauform-${product.id}`}
                  checked={bauformType === 'EINGERUCKT'}
                  onChange={() => handleWPSpecChange(index, 'bauformType', 'EINGERUCKT')}
                />
                <span>EINGERÜCKT</span>
              </label>
            </div>
            {bauformType === 'EINGERUCKT' && (
              <div className="eingerueckt-options">
                <div className="eingerueckt-row">
                  <label className="checkbox-option">
                    <input
                      type="checkbox"
                      checked={product.specifications['bauformLinksActive'] as boolean || false}
                      onChange={(e) => handleWPSpecChange(index, 'bauformLinksActive', e.target.checked)}
                    />
                    <span>Links</span>
                  </label>
                  {product.specifications['bauformLinksActive'] && (
                    <input
                      className="eingerueckt-value"
                      type="number"
                      value={product.specifications.bauformLinksValue as number || ''}
                      onChange={(e) => handleWPSpecChange(index, 'bauformLinksValue', parseFloat(e.target.value) || 0)}
                      placeholder="mm"
                    />
                  )}
                </div>
                <div className="eingerueckt-row">
                  <label className="checkbox-option">
                    <input
                      type="checkbox"
                      checked={product.specifications['bauformRechtsActive'] as boolean || false}
                      onChange={(e) => handleWPSpecChange(index, 'bauformRechtsActive', e.target.checked)}
                    />
                    <span>Rechts</span>
                  </label>
                  {product.specifications['bauformRechtsActive'] && (
                    <input
                      className="eingerueckt-value"
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
        const currentMultiValue = (product.specifications[field.name] as string[]) || [];
        const handleMultiSelectChange = (option: string, checked: boolean) => {
          let newValue: string[];
          if (option === 'Keine') {
            newValue = checked ? ['Keine'] : [];
          } else {
            if (checked) {
              newValue = currentMultiValue.filter(v => v !== 'Keine');
              newValue.push(option);
            } else {
              newValue = currentMultiValue.filter(v => v !== option);
            }
          }
          handleWPSpecChange(index, field.name, newValue);
        };
        return (
          <div key={field.name} className="form-field full-width multiselect-field">
            <label>
              {field.label}
              {field.required && <span className="required">*</span>}
            </label>
            <div className="multiselect-options">
              {field.options?.map(option => {
                const isSelected = currentMultiValue.includes(option);
                const isDisabled = option !== 'Keine' && currentMultiValue.includes('Keine');
                return (
                  <label
                    key={option}
                    className={`multiselect-checkbox ${isSelected ? 'selected' : ''} ${isDisabled ? 'disabled' : ''}`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      disabled={isDisabled}
                      onChange={(e) => handleMultiSelectChange(option, e.target.checked)}
                    />
                    <span>{option}</span>
                  </label>
                );
              })}
            </div>
          </div>
        );

      case 'seitenmarkise':
        const positions = field.positions || ['Rechts', 'Links', 'Vorne', 'Hinten'];
        const seitenmarkiseValue = product.specifications[field.name];
        type SeitenmarkisePos = { active: boolean; aufteilung: string; links?: number; rechts?: number; breite?: number };
        let seitenmarkiseData: Record<string, SeitenmarkisePos> = {};

        if (typeof seitenmarkiseValue === 'string' && seitenmarkiseValue) {
          try {
            seitenmarkiseData = JSON.parse(seitenmarkiseValue);
          } catch {
            seitenmarkiseData = {};
          }
        } else if (typeof seitenmarkiseValue === 'object' && seitenmarkiseValue && !Array.isArray(seitenmarkiseValue)) {
          seitenmarkiseData = seitenmarkiseValue as Record<string, SeitenmarkisePos>;
        }

        const updateSeitenmarkiseWP = (position: string, data: Partial<typeof seitenmarkiseData[string]>) => {
          const newData = {
            ...seitenmarkiseData,
            [position]: {
              ...seitenmarkiseData[position],
              ...data
            }
          };
          handleWPSpecChange(index, field.name, JSON.stringify(newData));
        };

        return (
          <div key={field.name} className="form-field full-width seitenmarkise-field">
            <label className="seitenmarkise-main-label">
              {field.label}
              <span className="optional-hint">(optional)</span>
            </label>
            <div className="seitenmarkise-positions">
              {positions.map(position => {
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
                            updateSeitenmarkiseWP(position, { active: true, aufteilung: '' });
                          } else {
                            updateSeitenmarkiseWP(position, { active: false });
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
                              onChange={() => updateSeitenmarkiseWP(position, { aufteilung: 'mit', breite: undefined })}
                            />
                            <span>Mit Aufteilung</span>
                          </label>
                          <label className="aufteilung-option">
                            <input
                              type="radio"
                              name={`aufteilung-wp-${product.id}-${position}`}
                              checked={aufteilung === 'ohne'}
                              onChange={() => updateSeitenmarkiseWP(position, { aufteilung: 'ohne', links: undefined, rechts: undefined })}
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
                                  onChange={(e) => updateSeitenmarkiseWP(position, { links: parseFloat(e.target.value) || 0 })}
                                  placeholder="0"
                                  min="0"
                                />
                                <span className="unit">cm</span>
                              </div>
                            </div>
                            <div className="input-row">
                              <label>Rechts:</label>
                              <div className="input-with-unit">
                                <input
                                  type="number"
                                  value={posData.rechts || ''}
                                  onChange={(e) => updateSeitenmarkiseWP(position, { rechts: parseFloat(e.target.value) || 0 })}
                                  placeholder="0"
                                  min="0"
                                />
                                <span className="unit">cm</span>
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
                                  onChange={(e) => updateSeitenmarkiseWP(position, { breite: parseFloat(e.target.value) || 0 })}
                                  placeholder="0"
                                  min="0"
                                />
                                <span className="unit">cm</span>
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

      case 'text':
        return (
          <div key={field.name} className="form-field">
            <label>
              {field.label}
              {field.required && <span className="required">*</span>}
            </label>
            <input
              type="text"
              value={value as string || ''}
              onChange={(e) => handleWPSpecChange(index, field.name, e.target.value)}
              placeholder={field.placeholder || ''}
            />
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
  );
};

export default WeitereProdukteSectionInline;
