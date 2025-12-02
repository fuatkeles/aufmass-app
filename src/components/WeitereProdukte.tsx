import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import './WeitereProdukte.css';
import './SectionStyles.css';
import productConfigData from '../config/productConfig.json';
import { WeiteresProdukt } from '../types';

interface WeitereProduktProps {
  produkte: WeiteresProdukt[];
  updateProdukte: (data: WeiteresProdukt[]) => void;
}

interface ProductConfig {
  [category: string]: {
    [productType: string]: {
      models: string[];
      modelColors?: { [model: string]: string[] };
      fields: { name: string; label: string; type: string; unit?: string; options?: string[]; required: boolean; hasCustomOption?: boolean; conditionalType?: string; valueUnit?: string; valueLabel?: string }[];
    };
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

const WeitereProdukte = ({ produkte, updateProdukte }: WeitereProduktProps) => {
  const [products, setProducts] = useState<WeiteresProdukt[]>(produkte);
  const [expandedIndex, setExpandedIndex] = useState<number>(-1);

  useEffect(() => {
    setProducts(produkte);
  }, [produkte]);

  const handleCategoryChange = (index: number, value: string) => {
    const newProducts = [...products];
    newProducts[index] = {
      ...newProducts[index],
      category: value,
      productType: '',
      model: '',
      specifications: {}
    };
    setProducts(newProducts);
    updateProdukte(newProducts);
  };

  const handleProductTypeChange = (index: number, value: string) => {
    const newProducts = [...products];
    newProducts[index] = {
      ...newProducts[index],
      productType: value,
      model: '',
      specifications: {}
    };
    setProducts(newProducts);
    updateProdukte(newProducts);
  };

  const handleModelChange = (index: number, value: string) => {
    const newProducts = [...products];
    newProducts[index] = {
      ...newProducts[index],
      model: value,
      specifications: {}
    };
    setProducts(newProducts);
    updateProdukte(newProducts);
  };

  const handleSpecChange = (index: number, fieldName: string, value: string | number | boolean) => {
    const newProducts = [...products];
    newProducts[index] = {
      ...newProducts[index],
      specifications: {
        ...newProducts[index].specifications,
        [fieldName]: value
      }
    };
    setProducts(newProducts);
    updateProdukte(newProducts);
  };

  const addProduct = () => {
    const newProducts = [...products, createEmptyProdukt()];
    setProducts(newProducts);
    updateProdukte(newProducts);
    setExpandedIndex(newProducts.length - 1);
  };

  const removeProduct = (index: number) => {
    const newProducts = products.filter((_, i) => i !== index);
    setProducts(newProducts);
    updateProdukte(newProducts);
    if (expandedIndex >= newProducts.length) {
      setExpandedIndex(newProducts.length - 1);
    }
  };

  const getProductTypes = (category: string) => {
    if (!category) return [];
    return Object.keys(productConfig[category] || {});
  };

  const getModels = (category: string, productType: string) => {
    if (!category || !productType) return [];
    return productConfig[category]?.[productType]?.models || [];
  };

  const getFields = (category: string, productType: string) => {
    if (!category || !productType) return [];
    return productConfig[category]?.[productType]?.fields || [];
  };

  const getColorsForModel = (category: string, productType: string, model: string): string[] => {
    if (!category || !productType || !model) return [];
    return productConfig[category]?.[productType]?.modelColors?.[model] || [];
  };

  const getProductLabel = (product: WeiteresProdukt, index: number) => {
    if (product.category && product.productType) {
      return `${index + 1}. ${product.category} - ${product.productType}${product.model ? ` (${product.model})` : ''}`;
    }
    return `Weiteres Produkt ${index + 1}`;
  };

  const renderSpecificationField = (product: WeiteresProdukt, index: number, field: { name: string; label: string; type: string; unit?: string; options?: string[]; required: boolean; hasCustomOption?: boolean; conditionalType?: string; valueUnit?: string; valueLabel?: string }) => {
    const value = product.specifications[field.name];

    // Skip certain fields
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
                onChange={(e) => handleSpecChange(index, field.name, parseFloat(e.target.value) || 0)}
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
              onChange={(e) => handleSpecChange(index, field.name, e.target.value)}
            >
              <option value="">Bitte wählen...</option>
              {field.options?.map(opt => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </div>
        );

      case 'modelColorSelect':
        const colors = getColorsForModel(product.category, product.productType, product.model);
        return (
          <div key={field.name} className="form-field">
            <label>
              {field.label}
              {field.required && <span className="required">*</span>}
            </label>
            <select
              value={value as string || ''}
              onChange={(e) => handleSpecChange(index, field.name, e.target.value)}
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
                onClick={() => handleSpecChange(index, `${field.name}Active`, true)}
              >
                Ja
              </button>
              <button
                type="button"
                className={`option-btn ${product.specifications[`${field.name}Active`] === false ? 'selected' : ''}`}
                onClick={() => handleSpecChange(index, `${field.name}Active`, false)}
              >
                Nein
              </button>
            </div>
            {isActive && (
              <div className="conditional-value">
                <input
                  type="number"
                  value={value as number || ''}
                  onChange={(e) => handleSpecChange(index, field.name, parseFloat(e.target.value) || 0)}
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
              onChange={(e) => handleSpecChange(index, field.name, e.target.value)}
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
                  onChange={(e) => handleSpecChange(index, 'fundamentValue', e.target.value)}
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
                onClick={() => handleSpecChange(index, 'bauformType', 'BUNDIG')}
              >
                BÜNDIG
              </button>
              <button
                type="button"
                className={`option-btn ${bauformType === 'EINGERUCKT' ? 'selected' : ''}`}
                onClick={() => handleSpecChange(index, 'bauformType', 'EINGERUCKT')}
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
                      onChange={(e) => handleSpecChange(index, 'bauformLinksActive', e.target.checked)}
                    />
                    Links
                  </label>
                  {product.specifications.bauformLinksActive && (
                    <input
                      type="number"
                      value={product.specifications.bauformLinksValue as number || ''}
                      onChange={(e) => handleSpecChange(index, 'bauformLinksValue', parseFloat(e.target.value) || 0)}
                      placeholder="mm"
                    />
                  )}
                </div>
                <div className="bauform-option">
                  <label>
                    <input
                      type="checkbox"
                      checked={product.specifications.bauformRechtsActive === true}
                      onChange={(e) => handleSpecChange(index, 'bauformRechtsActive', e.target.checked)}
                    />
                    Rechts
                  </label>
                  {product.specifications.bauformRechtsActive && (
                    <input
                      type="number"
                      value={product.specifications.bauformRechtsValue as number || ''}
                      onChange={(e) => handleSpecChange(index, 'bauformRechtsValue', parseFloat(e.target.value) || 0)}
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

  const renderProductForm = (product: WeiteresProdukt, index: number) => {
    const productTypes = getProductTypes(product.category);
    const models = getModels(product.category, product.productType);
    const fields = getFields(product.category, product.productType);

    return (
      <div className="product-form-content">
        {/* Category Selection */}
        <div className="form-field">
          <label>
            Kategorie <span className="required">*</span>
          </label>
          <select
            value={product.category}
            onChange={(e) => handleCategoryChange(index, e.target.value)}
          >
            <option value="">Bitte wählen...</option>
            {categories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>

        {/* Product Type Selection */}
        {product.category && (
          <div className="form-field">
            <label>
              Produkttyp <span className="required">*</span>
            </label>
            <select
              value={product.productType}
              onChange={(e) => handleProductTypeChange(index, e.target.value)}
            >
              <option value="">Bitte wählen...</option>
              {productTypes.map(pt => (
                <option key={pt} value={pt}>{pt}</option>
              ))}
            </select>
          </div>
        )}

        {/* Model Selection */}
        {product.productType && models.length > 0 && (
          <div className="form-field">
            <label>
              Modell <span className="required">*</span>
            </label>
            <select
              value={product.model}
              onChange={(e) => handleModelChange(index, e.target.value)}
            >
              <option value="">Bitte wählen...</option>
              {models.map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
        )}

        {/* Specification Fields */}
        {product.model && (
          <div className="specs-grid">
            {fields.map(field => renderSpecificationField(product, index, field))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="weitere-produkte-step">
      <motion.div
        className="section-header"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
      >
        <h2>Weitere Produkte</h2>
        <p className="section-description">
          Fügen Sie weitere Produkte für diesen Kunden hinzu (optional)
        </p>
      </motion.div>

      {/* Product Cards */}
      {products.length > 0 && (
        <div className="product-cards">
          {products.map((product, index) => (
            <motion.div
              key={product.id}
              className={`product-card ${expandedIndex === index ? 'expanded' : 'collapsed'}`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: index * 0.1 }}
            >
              <div
                className="product-card-header"
                onClick={() => setExpandedIndex(expandedIndex === index ? -1 : index)}
              >
                <div className="product-card-title">
                  <span className="product-number">{index + 1}</span>
                  <span className="product-label">{getProductLabel(product, index)}</span>
                </div>
                <div className="product-card-actions">
                  <button
                    type="button"
                    className="remove-product-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeProduct(index);
                    }}
                    title="Produkt entfernen"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
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
                    className="product-card-content"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    {renderProductForm(product, index)}
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
        onClick={addProduct}
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

      {products.length === 0 && (
        <motion.div
          className="no-products-hint"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <p>Keine weiteren Produkte hinzugefügt. Klicken Sie auf den Button oben, um ein weiteres Produkt hinzuzufügen.</p>
        </motion.div>
      )}
    </div>
  );
};

export default WeitereProdukte;
