import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import productConfigData from '../config/productConfig.json';
import type { ProductConfig } from '../types/productConfig';
import './ProductSelectionSection.css';
import './SectionStyles.css';

const productConfig = productConfigData as ProductConfig;

interface ProductSelectionSectionProps {
  selection: {
    category: string;
    productType: string;
    model: string | string[];
  };
  updateSelection: (field: 'category' | 'productType' | 'model', value: string | string[]) => void;
}

const ProductSelectionSection = ({ selection, updateSelection }: ProductSelectionSectionProps) => {
  const categories = Object.keys(productConfig);
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const productTypes = selection.category
    ? Object.keys(productConfig[selection.category] || {})
    : [];

  const models = selection.category && selection.productType
    ? productConfig[selection.category]?.[selection.productType]?.models || []
    : [];

  const selectedModels = Array.isArray(selection.model) ? selection.model : (selection.model ? [selection.model] : []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsModelDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleCategorySelect = (category: string) => {
    updateSelection('category', category);
    updateSelection('productType', '');
    updateSelection('model', []);
  };

  const handleProductTypeSelect = (productType: string) => {
    updateSelection('productType', productType);
    updateSelection('model', []);
  };

  // Handle model multi-select toggle
  const handleModelToggle = (modelName: string) => {
    if (selectedModels.includes(modelName)) {
      updateSelection('model', selectedModels.filter(m => m !== modelName));
    } else {
      updateSelection('model', [...selectedModels, modelName]);
    }
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

      {/* Model Selection - Dropdown Multi Select */}
      {selection.productType && models.length > 0 && (
        <motion.div
          className="selection-step"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <h3 className="step-title">3. Modell wählen <span className="multi-hint">(Mehrfachauswahl möglich)</span></h3>
          <div className="model-dropdown-container" ref={dropdownRef}>
            <div
              className={`model-dropdown-trigger ${isModelDropdownOpen ? 'open' : ''}`}
              onClick={() => setIsModelDropdownOpen(!isModelDropdownOpen)}
            >
              <span className="model-dropdown-placeholder">
                {selectedModels.length === 0
                  ? 'Bitte Modell(e) wählen...'
                  : selectedModels.join(', ')}
              </span>
              <span className={`model-dropdown-arrow ${isModelDropdownOpen ? 'open' : ''}`}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="6,9 12,15 18,9" />
                </svg>
              </span>
            </div>
            <AnimatePresence>
              {isModelDropdownOpen && (
                <motion.div
                  className="model-dropdown-menu"
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                >
                  {models.map((model) => {
                    const isSelected = selectedModels.includes(model);
                    return (
                      <div
                        key={model}
                        className={`model-dropdown-item ${isSelected ? 'selected' : ''}`}
                        onClick={() => handleModelToggle(model)}
                      >
                        <span className={`model-dropdown-checkbox ${isSelected ? 'checked' : ''}`}>
                          {isSelected && '✓'}
                        </span>
                        <span className="model-dropdown-label">{model}</span>
                      </div>
                    );
                  })}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      )}

      {/* Selection Summary */}
      {selection.category && selection.productType && selectedModels.length > 0 && (
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
              <span className="summary-label">Modell{selectedModels.length > 1 ? 'e' : ''}:</span>
              <span className="summary-value">{selectedModels.join(', ')}</span>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default ProductSelectionSection;
