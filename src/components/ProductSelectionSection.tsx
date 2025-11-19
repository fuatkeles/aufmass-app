import { motion } from 'framer-motion';
import productConfigData from '../config/productConfig.json';
import type { ProductConfig } from '../types/productConfig';
import './ProductSelectionSection.css';
import './SectionStyles.css';

const productConfig = productConfigData as ProductConfig;

interface ProductSelectionSectionProps {
  selection: {
    category: string;
    productType: string;
    model: string;
  };
  updateSelection: (field: 'category' | 'productType' | 'model', value: string) => void;
}

const ProductSelectionSection = ({ selection, updateSelection }: ProductSelectionSectionProps) => {
  const categories = Object.keys(productConfig);

  const productTypes = selection.category
    ? Object.keys(productConfig[selection.category] || {})
    : [];

  const models = selection.category && selection.productType
    ? productConfig[selection.category]?.[selection.productType]?.models || []
    : [];

  const handleCategorySelect = (category: string) => {
    updateSelection('category', category);
    updateSelection('productType', '');
    updateSelection('model', '');
  };

  const handleProductTypeSelect = (productType: string) => {
    updateSelection('productType', productType);
    updateSelection('model', '');
  };

  return (
    <div className="product-selection-section">
      <motion.div
        className="section-header"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
      >
        <h2>Produktauswahl</h2>
        <p className="section-description">Wählen Sie Kategorie, Produkttyp und Modell</p>
      </motion.div>

      {/* Category Selection */}
      <div className="selection-step">
        <h3 className="step-title">1. Kategorie wählen</h3>
        <div className="category-grid">
          {categories.map((category, index) => {
            const isSelected = selection.category === category;

            return (
              <motion.button
                key={category}
                className={`category-card ${isSelected ? 'selected' : ''}`}
                onClick={() => handleCategorySelect(category)}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3, delay: index * 0.1 }}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
              >
                <span className="category-name">{category}</span>
                {isSelected && (
                  <motion.div
                    className="check-icon"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 500 }}
                  >
                    ✓
                  </motion.div>
                )}
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Product Type Selection */}
      {selection.category && (
        <motion.div
          className="selection-step"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <h3 className="step-title">2. Produkttyp wählen</h3>
          <div className="product-type-grid">
            {productTypes.map((productType, index) => {
              const isSelected = selection.productType === productType;

              return (
                <motion.button
                  key={productType}
                  className={`product-type-card ${isSelected ? 'selected' : ''}`}
                  onClick={() => handleProductTypeSelect(productType)}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.05 }}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <span className="product-type-name">{productType}</span>
                  {isSelected && (
                    <motion.div
                      className="check-icon-small"
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: 'spring', stiffness: 500 }}
                    >
                      ✓
                    </motion.div>
                  )}
                </motion.button>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* Model Selection */}
      {selection.productType && models.length > 0 && (
        <motion.div
          className="selection-step"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <h3 className="step-title">3. Modell wählen</h3>
          <div className="form-group">
            <select
              className="model-select"
              value={selection.model}
              onChange={(e) => updateSelection('model', e.target.value)}
            >
              <option value="">Bitte wählen Sie ein Modell...</option>
              {models.map((model) => (
                <option key={model} value={model}>
                  {model}
                </option>
              ))}
            </select>
          </div>
        </motion.div>
      )}

      {/* Selection Summary */}
      {selection.category && selection.productType && selection.model && (
        <motion.div
          className="selection-summary"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
        >
          <h4>Ihre Auswahl:</h4>
          <div className="summary-details">
            <div className="summary-item">
              <span className="summary-label">Kategorie:</span>
              <span className="summary-value">{selection.category}</span>
            </div>
            <div className="summary-item">
              <span className="summary-label">Produkttyp:</span>
              <span className="summary-value">{selection.productType}</span>
            </div>
            <div className="summary-item">
              <span className="summary-label">Modell:</span>
              <span className="summary-value">{selection.model}</span>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default ProductSelectionSection;
