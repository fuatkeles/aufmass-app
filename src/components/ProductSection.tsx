import { motion } from 'framer-motion';
import { FormData } from '../types';
import './ProductSection.css';

interface ProductSectionProps {
  formData: FormData;
  updateFormData: (field: string, value: any) => void;
  updateNestedData: (section: string, field: string, value: any) => void;
}

const ProductSection = ({ formData, updateFormData }: ProductSectionProps) => {
  const products = [
    { id: 'trendline', name: 'Trendline' },
    { id: 'topline', name: 'Topline' },
    { id: 'designline', name: 'Designline' },
    { id: 'ultraline', name: 'Ultraline' },
    { id: 'm-integrale', name: 'M. Integrale' },
    { id: 'm-integrale-z', name: 'M. Integrale Z' },
    { id: 'm-vetro', name: 'M. Vetro' },
    { id: 'm-puro', name: 'M. Puro' },
    { id: 'sqope', name: 'Sqope' },
    { id: 'lamellendach', name: 'Lamellendach' },
    { id: 'premiumline', name: 'Premiumline' },
    { id: 'pergola', name: 'Pergola' }
  ];

  const toggleProduct = (productId: string) => {
    const currentProducts = formData.produkte || [];
    const newProducts = currentProducts.includes(productId)
      ? currentProducts.filter(p => p !== productId)
      : [...currentProducts, productId];
    updateFormData('produkte', newProducts);
  };

  return (
    <div className="product-section">
      <motion.div
        className="section-header"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
      >
        <h2>Produkte</h2>
        <p className="section-description">Wählen Sie die gewünschten Produkte aus</p>
      </motion.div>

      <div className="product-grid">
        {products.map((product, index) => {
          const isSelected = formData.produkte?.includes(product.id);
          return (
            <motion.div
              key={product.id}
              className={`product-card ${isSelected ? 'selected' : ''}`}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3, delay: index * 0.05 }}
              whileHover={{ scale: 1.05, y: -5 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => toggleProduct(product.id)}
            >
              <div className="product-checkbox">
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => {}}
                  readOnly
                />
                <span className="checkmark"></span>
              </div>
              <div className="product-name">{product.name}</div>
              {isSelected && (
                <motion.div
                  className="selected-indicator"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                >
                  ✓
                </motion.div>
              )}
            </motion.div>
          );
        })}
      </div>

      {formData.produkte && formData.produkte.length > 0 && (
        <motion.div
          className="selected-summary"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h4>Ausgewählte Produkte: {formData.produkte.length}</h4>
          <div className="selected-tags">
            {formData.produkte.map((productId, index) => {
              const product = products.find(p => p.id === productId);
              return (
                <motion.span
                  key={productId}
                  className="selected-tag"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.3, delay: index * 0.05 }}
                  onClick={() => toggleProduct(productId)}
                >
                  {product?.name} ×
                </motion.span>
              );
            })}
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default ProductSection;
