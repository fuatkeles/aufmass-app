import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '../services/api';
import productConfigData from '../config/productConfig.json';
import type { ProductConfig } from '../types/productConfig';
import './ProductPricing.css';

const productConfig = productConfigData as ProductConfig;

interface Product {
  id: number;
  product_name: string;
  breite: number;
  tiefe: number;
  price: number;
  category?: string;
  product_type?: string;
  branch_id: string | null;
}

interface PendingColumn {
  breite: number;
  prices: Record<number, string>; // tiefe -> price
}

interface PendingRow {
  tiefe: number;
  prices: Record<number, string>; // breite -> price
}

export default function ProductPricing() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  // Filter state
  const [filterCategory, setFilterCategory] = useState('');
  const [filterProductType, setFilterProductType] = useState('');
  const [filterModel, setFilterModel] = useState('');

  // Expanded accordions
  const [expandedProducts, setExpandedProducts] = useState<Set<string>>(new Set());

  // Edit state for existing cells
  const [editingCell, setEditingCell] = useState<{ productName: string; breite: number; tiefe: number } | null>(null);
  const [editValue, setEditValue] = useState<string>('');

  // Pending new columns/rows per product (inline editing, no modal)
  const [pendingColumns, setPendingColumns] = useState<Record<string, PendingColumn[]>>({});
  const [pendingRows, setPendingRows] = useState<Record<string, PendingRow[]>>({});

  // New product modal state
  const [newProductModalOpen, setNewProductModalOpen] = useState(false);
  const [newProductName, setNewProductName] = useState('');
  const [newProductCategory, setNewProductCategory] = useState('');
  const [newProductType, setNewProductType] = useState('');
  const [newProductEntries, setNewProductEntries] = useState<{ breite: string; tiefe: string; price: string }[]>([
    { breite: '', tiefe: '', price: '' }
  ]);

  // Custom input mode for each dropdown
  const [customCategoryMode, setCustomCategoryMode] = useState(false);
  const [customProductTypeMode, setCustomProductTypeMode] = useState(false);
  const [customModelMode, setCustomModelMode] = useState(false);

  // Inline add price for empty cells (cells with "-")
  const [addingPrice, setAddingPrice] = useState<{ productName: string; breite: number; tiefe: number } | null>(null);
  const [addingPriceValue, setAddingPriceValue] = useState('');

  // Delete confirmation
  const [deleteConfirm, setDeleteConfirm] = useState<{ type: 'product' | 'row' | 'column'; productName: string; value?: number } | null>(null);

  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    try {
      setLoading(true);
      const data = await api.get<Product[]>('/lead-products');
      setProducts(data);
      const names = [...new Set(data.map(p => p.product_name))];
      if (names.length > 0) {
        setExpandedProducts(new Set([names[0]]));
      }
    } catch (err) {
      console.error('Failed to load products:', err);
      setError('Fehler beim Laden der Produkte');
    } finally {
      setLoading(false);
    }
  };

  // Group products by name and create matrix structure
  const productMatrices = useMemo(() => {
    const grouped: Record<string, {
      products: Product[];
      breiteValues: number[];
      tiefeValues: number[];
      matrix: Record<string, Record<string, Product>>;
    }> = {};

    products.forEach(p => {
      if (!grouped[p.product_name]) {
        grouped[p.product_name] = {
          products: [],
          breiteValues: [],
          tiefeValues: [],
          matrix: {}
        };
      }
      grouped[p.product_name].products.push(p);

      if (!grouped[p.product_name].breiteValues.includes(p.breite)) {
        grouped[p.product_name].breiteValues.push(p.breite);
      }
      if (!grouped[p.product_name].tiefeValues.includes(p.tiefe)) {
        grouped[p.product_name].tiefeValues.push(p.tiefe);
      }

      if (!grouped[p.product_name].matrix[p.breite]) {
        grouped[p.product_name].matrix[p.breite] = {};
      }
      grouped[p.product_name].matrix[p.breite][p.tiefe] = p;
    });

    Object.values(grouped).forEach(g => {
      g.breiteValues.sort((a, b) => a - b);
      g.tiefeValues.sort((a, b) => a - b);
    });

    return grouped;
  }, [products]);

  // Get unique categories and product types from actual products in DB
  const filterOptions = useMemo(() => {
    const categories = new Set<string>();
    const productTypes = new Map<string, Set<string>>(); // category -> product types
    const models = new Map<string, Set<string>>(); // "category|productType" -> models

    products.forEach(p => {
      if (p.category) {
        categories.add(p.category);
        if (!productTypes.has(p.category)) {
          productTypes.set(p.category, new Set());
        }
        if (p.product_type) {
          productTypes.get(p.category)!.add(p.product_type);
          const key = `${p.category}|${p.product_type}`;
          if (!models.has(key)) {
            models.set(key, new Set());
          }
          models.get(key)!.add(p.product_name);
        }
      }
      // Also include products without category in a special group
      if (!p.category) {
        categories.add('__uncategorized__');
      }
    });

    return {
      categories: Array.from(categories).sort(),
      getProductTypes: (cat: string) => Array.from(productTypes.get(cat) || []).sort(),
      getModels: (cat: string, pt: string) => Array.from(models.get(`${cat}|${pt}`) || []).sort()
    };
  }, [products]);

  // Filter product names based on selected filters
  const filteredProductNames = useMemo(() => {
    let filtered = Object.keys(productMatrices);

    if (filterCategory) {
      if (filterCategory === '__uncategorized__') {
        // Show products without category
        filtered = filtered.filter(name => {
          const p = products.find(pr => pr.product_name === name);
          return !p?.category;
        });
      } else {
        filtered = filtered.filter(name => {
          const p = products.find(pr => pr.product_name === name);
          return p?.category === filterCategory;
        });
      }
    }

    if (filterProductType) {
      filtered = filtered.filter(name => {
        const p = products.find(pr => pr.product_name === name);
        return p?.product_type === filterProductType;
      });
    }

    if (filterModel) {
      filtered = filtered.filter(name => name === filterModel);
    }

    return filtered.sort();
  }, [productMatrices, products, filterCategory, filterProductType, filterModel]);

  const toggleAccordion = (name: string) => {
    setExpandedProducts(prev => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }
      return next;
    });
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(price) + ' €';
  };

  // Check if product has pending changes
  const hasPendingChanges = (productName: string) => {
    const cols = pendingColumns[productName] || [];
    const rows = pendingRows[productName] || [];
    return cols.length > 0 || rows.length > 0;
  };

  // ========== EXISTING CELL EDITING ==========
  const startEdit = (productName: string, breite: number, tiefe: number, currentPrice: number) => {
    setEditingCell({ productName, breite, tiefe });
    setEditValue(currentPrice.toString());
  };

  const cancelEdit = () => {
    setEditingCell(null);
    setEditValue('');
  };

  const saveEdit = async () => {
    if (!editingCell) return;
    const product = productMatrices[editingCell.productName]?.matrix[editingCell.breite]?.[editingCell.tiefe];
    if (!product) return;

    const newPrice = parseFloat(editValue);
    if (isNaN(newPrice) || newPrice < 0) return;

    try {
      await api.put(`/lead-products/${product.id}`, { price: newPrice });
      await loadProducts();
      cancelEdit();
    } catch (err) {
      console.error('Failed to update price:', err);
    }
  };

  // ========== INLINE ADD COLUMN (NO MODAL) ==========
  const addPendingColumn = (productName: string) => {
    const data = productMatrices[productName];
    if (!data) return;

    const newCol: PendingColumn = {
      breite: 0,
      prices: {}
    };
    // Initialize price entries for all existing tiefe values
    data.tiefeValues.forEach(t => {
      newCol.prices[t] = '';
    });
    // Also add prices for pending rows
    (pendingRows[productName] || []).forEach(row => {
      if (row.tiefe > 0) {
        newCol.prices[row.tiefe] = '';
      }
    });

    setPendingColumns(prev => ({
      ...prev,
      [productName]: [...(prev[productName] || []), newCol]
    }));
  };

  const updatePendingColumnBreite = (productName: string, index: number, value: string) => {
    setPendingColumns(prev => {
      const cols = [...(prev[productName] || [])];
      cols[index] = { ...cols[index], breite: parseInt(value) || 0 };
      return { ...prev, [productName]: cols };
    });
  };

  const updatePendingColumnPrice = (productName: string, colIndex: number, tiefe: number, price: string) => {
    setPendingColumns(prev => {
      const cols = [...(prev[productName] || [])];
      cols[colIndex] = {
        ...cols[colIndex],
        prices: { ...cols[colIndex].prices, [tiefe]: price }
      };
      return { ...prev, [productName]: cols };
    });
  };

  const removePendingColumn = (productName: string, index: number) => {
    setPendingColumns(prev => {
      const cols = [...(prev[productName] || [])];
      cols.splice(index, 1);
      return { ...prev, [productName]: cols };
    });
  };

  // ========== INLINE ADD ROW (NO MODAL) ==========
  const addPendingRow = (productName: string) => {
    const data = productMatrices[productName];
    if (!data) return;

    const newRow: PendingRow = {
      tiefe: 0,
      prices: {}
    };
    // Initialize price entries for all existing breite values
    data.breiteValues.forEach(b => {
      newRow.prices[b] = '';
    });
    // Also add prices for pending columns
    (pendingColumns[productName] || []).forEach(col => {
      if (col.breite > 0) {
        newRow.prices[col.breite] = '';
      }
    });

    setPendingRows(prev => ({
      ...prev,
      [productName]: [...(prev[productName] || []), newRow]
    }));
  };

  const updatePendingRowTiefe = (productName: string, index: number, value: string) => {
    setPendingRows(prev => {
      const rows = [...(prev[productName] || [])];
      rows[index] = { ...rows[index], tiefe: parseInt(value) || 0 };
      return { ...prev, [productName]: rows };
    });
  };

  const updatePendingRowPrice = (productName: string, rowIndex: number, breite: number, price: string) => {
    setPendingRows(prev => {
      const rows = [...(prev[productName] || [])];
      rows[rowIndex] = {
        ...rows[rowIndex],
        prices: { ...rows[rowIndex].prices, [breite]: price }
      };
      return { ...prev, [productName]: rows };
    });
  };

  const removePendingRow = (productName: string, index: number) => {
    setPendingRows(prev => {
      const rows = [...(prev[productName] || [])];
      rows.splice(index, 1);
      return { ...prev, [productName]: rows };
    });
  };

  // ========== SAVE PENDING CHANGES ==========
  const savePendingChanges = async (productName: string) => {
    const cols = pendingColumns[productName] || [];
    const rows = pendingRows[productName] || [];
    const data = productMatrices[productName];

    if (!data) return;

    const entriesToSave: { breite: number; tiefe: number; price: number }[] = [];

    // Collect entries from pending columns
    cols.forEach(col => {
      if (col.breite > 0) {
        // For existing tiefe values
        data.tiefeValues.forEach(tiefe => {
          const priceStr = col.prices[tiefe];
          if (priceStr && parseFloat(priceStr) > 0) {
            entriesToSave.push({ breite: col.breite, tiefe, price: parseFloat(priceStr) });
          }
        });
        // For pending row tiefe values
        rows.forEach(row => {
          if (row.tiefe > 0) {
            const priceStr = col.prices[row.tiefe];
            if (priceStr && parseFloat(priceStr) > 0) {
              entriesToSave.push({ breite: col.breite, tiefe: row.tiefe, price: parseFloat(priceStr) });
            }
          }
        });
      }
    });

    // Collect entries from pending rows
    rows.forEach(row => {
      if (row.tiefe > 0) {
        // For existing breite values
        data.breiteValues.forEach(breite => {
          const priceStr = row.prices[breite];
          if (priceStr && parseFloat(priceStr) > 0) {
            // Check if not already added from columns
            const alreadyAdded = entriesToSave.some(e => e.breite === breite && e.tiefe === row.tiefe);
            if (!alreadyAdded) {
              entriesToSave.push({ breite, tiefe: row.tiefe, price: parseFloat(priceStr) });
            }
          }
        });
      }
    });

    if (entriesToSave.length === 0) {
      setError('Mindestens ein Preis muss eingegeben werden');
      return;
    }

    setSaving(true);
    setError('');

    try {
      await Promise.all(
        entriesToSave.map(entry =>
          api.post('/lead-products', {
            product_name: productName,
            breite: entry.breite,
            tiefe: entry.tiefe,
            price: entry.price
          })
        )
      );

      // Clear pending state
      setPendingColumns(prev => ({ ...prev, [productName]: [] }));
      setPendingRows(prev => ({ ...prev, [productName]: [] }));

      await loadProducts();
    } catch (err) {
      console.error('Save error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unbekannter Fehler';
      setError(`Fehler beim Speichern: ${errorMessage}`);
    } finally {
      setSaving(false);
    }
  };

  const cancelPendingChanges = (productName: string) => {
    setPendingColumns(prev => ({ ...prev, [productName]: [] }));
    setPendingRows(prev => ({ ...prev, [productName]: [] }));
  };

  // ========== NEW PRODUCT MODAL (MULTI-ADD) ==========
  const openNewProductModal = () => {
    setNewProductName('');
    setNewProductEntries([{ breite: '', tiefe: '', price: '' }]);
    setError('');
    setNewProductModalOpen(true);
  };

  const closeNewProductModal = () => {
    setNewProductModalOpen(false);
    setNewProductName('');
    setNewProductCategory('');
    setNewProductType('');
    setNewProductEntries([{ breite: '', tiefe: '', price: '' }]);
    setCustomCategoryMode(false);
    setCustomProductTypeMode(false);
    setCustomModelMode(false);
    setError('');
  };

  // Get available product types for selected category (only if not custom category)
  const availableProductTypes = !customCategoryMode && newProductCategory
    ? Object.keys(productConfig[newProductCategory] || {})
    : [];

  // Get available models for selected category + product type (only if not custom)
  const availableModels = !customCategoryMode && !customProductTypeMode && newProductCategory && newProductType
    ? productConfig[newProductCategory]?.[newProductType]?.models || []
    : [];

  const addNewProductEntry = () => {
    setNewProductEntries(prev => [...prev, { breite: '', tiefe: '', price: '' }]);
  };

  const updateNewProductEntry = (index: number, field: 'breite' | 'tiefe' | 'price', value: string) => {
    setNewProductEntries(prev => {
      const arr = [...prev];
      arr[index] = { ...arr[index], [field]: value };
      return arr;
    });
  };

  const removeNewProductEntry = (index: number) => {
    if (newProductEntries.length <= 1) return;
    setNewProductEntries(prev => prev.filter((_, i) => i !== index));
  };

  const saveNewProduct = async () => {
    if (!newProductCategory) {
      setError('Kategorie ist erforderlich');
      return;
    }
    if (!newProductType) {
      setError('Produkttyp ist erforderlich');
      return;
    }
    if (!newProductName.trim()) {
      setError('Produktname ist erforderlich');
      return;
    }

    const validEntries = newProductEntries.filter(e =>
      e.breite && parseInt(e.breite) > 0 &&
      e.tiefe && parseInt(e.tiefe) > 0 &&
      e.price && parseFloat(e.price) > 0
    );

    if (validEntries.length === 0) {
      setError('Mindestens ein vollständiger Eintrag (Breite, Tiefe, Preis) ist erforderlich');
      return;
    }

    setSaving(true);
    setError('');

    try {
      await Promise.all(
        validEntries.map(entry =>
          api.post('/lead-products', {
            product_name: newProductName.trim(),
            category: newProductCategory,
            product_type: newProductType,
            breite: parseInt(entry.breite),
            tiefe: parseInt(entry.tiefe),
            price: parseFloat(entry.price)
          })
        )
      );

      await loadProducts();
      setExpandedProducts(prev => new Set(prev).add(newProductName.trim()));
      closeNewProductModal();
    } catch (err) {
      console.error('Save error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unbekannter Fehler';
      setError(`Fehler beim Speichern: ${errorMessage}`);
    } finally {
      setSaving(false);
    }
  };

  // ========== DELETE HANDLERS ==========
  const handleDeleteProduct = async (productName: string) => {
    const productsToDelete = products.filter(p => p.product_name === productName);
    try {
      await Promise.all(productsToDelete.map(p => api.delete(`/lead-products/${p.id}`)));
      await loadProducts();
      setDeleteConfirm(null);
    } catch (err) {
      console.error('Delete error:', err);
    }
  };

  const handleDeleteRow = async (productName: string, tiefe: number) => {
    const productsToDelete = products.filter(p => p.product_name === productName && p.tiefe === tiefe);
    try {
      await Promise.all(productsToDelete.map(p => api.delete(`/lead-products/${p.id}`)));
      await loadProducts();
      setDeleteConfirm(null);
    } catch (err) {
      console.error('Delete error:', err);
    }
  };

  const handleDeleteColumn = async (productName: string, breite: number) => {
    const productsToDelete = products.filter(p => p.product_name === productName && p.breite === breite);
    try {
      await Promise.all(productsToDelete.map(p => api.delete(`/lead-products/${p.id}`)));
      await loadProducts();
      setDeleteConfirm(null);
    } catch (err) {
      console.error('Delete error:', err);
    }
  };

  // ========== ADD PRICE TO EMPTY CELL ==========
  const startAddingPrice = (productName: string, breite: number, tiefe: number) => {
    setAddingPrice({ productName, breite, tiefe });
    setAddingPriceValue('');
  };

  const cancelAddingPrice = () => {
    setAddingPrice(null);
    setAddingPriceValue('');
  };

  const saveAddingPrice = async () => {
    if (!addingPrice) return;
    const price = parseFloat(addingPriceValue);
    if (isNaN(price) || price <= 0) return;

    const { productName, breite, tiefe } = addingPrice;

    // Optimistic update - add to local state immediately
    const tempProduct: Product = {
      id: Date.now(), // temporary ID
      product_name: productName,
      breite,
      tiefe,
      price,
      branch_id: null
    };
    setProducts(prev => [...prev, tempProduct]);
    cancelAddingPrice();

    try {
      const newProduct = await api.post<Product>('/lead-products', {
        product_name: productName,
        breite,
        tiefe,
        price
      });
      // Replace temp product with real one from server
      setProducts(prev => prev.map(p =>
        p.id === tempProduct.id ? newProduct : p
      ));
    } catch (err) {
      console.error('Failed to add price:', err);
      // Rollback on error
      setProducts(prev => prev.filter(p => p.id !== tempProduct.id));
      setError('Fehler beim Speichern des Preises');
    }
  };

  // ========== RENDER ==========
  return (
    <div className="product-pricing-page">
      <header className="page-header">
        <div className="header-left">
          <h1>Produkte & Preise</h1>
          <span className="product-count">{filteredProductNames.length} Produkte</span>
        </div>
        <div className="header-right">
          <motion.button
            className="btn-primary"
            onClick={openNewProductModal}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 5v14M5 12h14" />
            </svg>
            Neues Produkt
          </motion.button>
        </div>
      </header>

      {/* Filter Section */}
      {!loading && Object.keys(productMatrices).length > 0 && (
        <div className="filter-section">
          <div className="filter-group">
            <label>Kategorie</label>
            <select
              value={filterCategory}
              onChange={e => {
                setFilterCategory(e.target.value);
                setFilterProductType('');
                setFilterModel('');
              }}
            >
              <option value="">Alle Kategorien</option>
              {filterOptions.categories.map(cat => (
                <option key={cat} value={cat}>
                  {cat === '__uncategorized__' ? 'Ohne Kategorie' : cat}
                </option>
              ))}
            </select>
          </div>

          {filterCategory && filterCategory !== '__uncategorized__' && filterOptions.getProductTypes(filterCategory).length > 0 && (
            <div className="filter-group">
              <label>Produkttyp</label>
              <select
                value={filterProductType}
                onChange={e => {
                  setFilterProductType(e.target.value);
                  setFilterModel('');
                }}
              >
                <option value="">Alle Produkttypen</option>
                {filterOptions.getProductTypes(filterCategory).map(pt => (
                  <option key={pt} value={pt}>{pt}</option>
                ))}
              </select>
            </div>
          )}

          {filterProductType && filterOptions.getModels(filterCategory, filterProductType).length > 0 && (
            <div className="filter-group">
              <label>Modell</label>
              <select
                value={filterModel}
                onChange={e => setFilterModel(e.target.value)}
              >
                <option value="">Alle Modelle</option>
                {filterOptions.getModels(filterCategory, filterProductType).map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
          )}

          {(filterCategory || filterProductType || filterModel) && (
            <button
              className="btn-clear-filter"
              onClick={() => {
                setFilterCategory('');
                setFilterProductType('');
                setFilterModel('');
              }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
              Filter zurücksetzen
            </button>
          )}
        </div>
      )}

      {error && <div className="page-error">{error}</div>}

      {loading ? (
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Lade Produkte...</p>
        </div>
      ) : Object.keys(productMatrices).length === 0 ? (
        <div className="empty-state">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
          </svg>
          <h3>Keine Produkte</h3>
          <p>Fügen Sie Ihr erstes Produkt hinzu</p>
          <button className="btn-primary" onClick={openNewProductModal}>
            Erstes Produkt hinzufügen
          </button>
        </div>
      ) : filteredProductNames.length === 0 ? (
        <div className="empty-state">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <h3>Keine Ergebnisse</h3>
          <p>Keine Produkte entsprechen den gewählten Filtern</p>
          <button
            className="btn-secondary"
            onClick={() => {
              setFilterCategory('');
              setFilterProductType('');
              setFilterModel('');
            }}
          >
            Filter zurücksetzen
          </button>
        </div>
      ) : (
        <div className="product-accordions">
          {filteredProductNames.map(productName => {
            const data = productMatrices[productName];
            const isExpanded = expandedProducts.has(productName);
            const totalPrices = data.products.length;
            const pCols = pendingColumns[productName] || [];
            const pRows = pendingRows[productName] || [];
            const hasChanges = hasPendingChanges(productName);

            return (
              <div key={productName} className={`product-accordion ${isExpanded ? 'expanded' : ''}`}>
                <div className="accordion-header" onClick={() => toggleAccordion(productName)}>
                  <div className="accordion-title">
                    <svg className="accordion-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                    <span className="product-name">{productName}</span>
                    <span className="price-count">{totalPrices} Preise</span>
                  </div>
                  <div className="accordion-actions" onClick={e => e.stopPropagation()}>
                    <button className="btn-icon-small" onClick={() => addPendingColumn(productName)}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M12 5v14M5 12h14" />
                      </svg>
                      Breite
                    </button>
                    <button className="btn-icon-small" onClick={() => addPendingRow(productName)}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M12 5v14M5 12h14" />
                      </svg>
                      Tiefe
                    </button>
                    <button
                      className="btn-icon-small delete"
                      onClick={() => setDeleteConfirm({ type: 'product', productName })}
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                      </svg>
                    </button>
                  </div>
                </div>

                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      className="accordion-content"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <div className="matrix-wrapper">
                        <table className="price-matrix">
                          <thead>
                            <tr>
                              <th className="corner-cell">
                                <span className="axis-label tiefe-label">TIEFE</span>
                                <span className="axis-label breite-label">BREITE</span>
                              </th>
                              {/* Existing Breite columns */}
                              {data.breiteValues.map(breite => (
                                <th key={breite} className="breite-header">
                                  <span>{breite}</span>
                                  <button
                                    className="delete-col-btn"
                                    onClick={() => setDeleteConfirm({ type: 'column', productName, value: breite })}
                                  >
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                      <path d="M18 6L6 18M6 6l12 12" />
                                    </svg>
                                  </button>
                                </th>
                              ))}
                              {/* Pending new columns */}
                              {pCols.map((col, colIdx) => (
                                <th key={`pending-col-${colIdx}`} className="breite-header pending-header">
                                  <input
                                    type="number"
                                    className="pending-dimension-input"
                                    placeholder="Breite"
                                    value={col.breite || ''}
                                    onChange={e => updatePendingColumnBreite(productName, colIdx, e.target.value)}
                                    onClick={e => e.stopPropagation()}
                                  />
                                  <button
                                    className="delete-col-btn"
                                    onClick={() => removePendingColumn(productName, colIdx)}
                                  >
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                      <path d="M18 6L6 18M6 6l12 12" />
                                    </svg>
                                  </button>
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {/* Existing Tiefe rows */}
                            {data.tiefeValues.map(tiefe => (
                              <tr key={tiefe}>
                                <td className="tiefe-header">
                                  <span>{tiefe}</span>
                                  <button
                                    className="delete-row-btn"
                                    onClick={() => setDeleteConfirm({ type: 'row', productName, value: tiefe })}
                                  >
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                      <path d="M18 6L6 18M6 6l12 12" />
                                    </svg>
                                  </button>
                                </td>
                                {/* Existing cells */}
                                {data.breiteValues.map(breite => {
                                  const product = data.matrix[breite]?.[tiefe];
                                  const isEditing = editingCell?.productName === productName &&
                                    editingCell?.breite === breite &&
                                    editingCell?.tiefe === tiefe;
                                  const isAddingPrice = addingPrice?.productName === productName &&
                                    addingPrice?.breite === breite &&
                                    addingPrice?.tiefe === tiefe;

                                  return (
                                    <td key={`${breite}-${tiefe}`} className={`price-cell ${isEditing ? 'editing' : ''} ${isAddingPrice ? 'adding' : ''}`}>
                                      {isEditing ? (
                                        <div className="edit-cell">
                                          <input
                                            type="number"
                                            value={editValue}
                                            onChange={e => setEditValue(e.target.value)}
                                            onKeyDown={e => {
                                              if (e.key === 'Enter') saveEdit();
                                              if (e.key === 'Escape') cancelEdit();
                                            }}
                                            autoFocus
                                          />
                                          <div className="edit-actions">
                                            <button className="save-btn" onClick={saveEdit}>
                                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                <polyline points="20 6 9 17 4 12" />
                                              </svg>
                                            </button>
                                            <button className="cancel-btn" onClick={cancelEdit}>
                                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                <path d="M18 6L6 18M6 6l12 12" />
                                              </svg>
                                            </button>
                                          </div>
                                        </div>
                                      ) : isAddingPrice ? (
                                        <div className="edit-cell">
                                          <input
                                            type="number"
                                            value={addingPriceValue}
                                            onChange={e => setAddingPriceValue(e.target.value)}
                                            onKeyDown={e => {
                                              if (e.key === 'Enter') saveAddingPrice();
                                              if (e.key === 'Escape') cancelAddingPrice();
                                            }}
                                            placeholder="€"
                                            autoFocus
                                          />
                                          <div className="edit-actions">
                                            <button className="save-btn" onClick={saveAddingPrice}>
                                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                <polyline points="20 6 9 17 4 12" />
                                              </svg>
                                            </button>
                                            <button className="cancel-btn" onClick={cancelAddingPrice}>
                                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                <path d="M18 6L6 18M6 6l12 12" />
                                              </svg>
                                            </button>
                                          </div>
                                        </div>
                                      ) : product ? (
                                        <button
                                          className="price-btn"
                                          onClick={() => startEdit(productName, breite, tiefe, product.price)}
                                        >
                                          {formatPrice(product.price)}
                                        </button>
                                      ) : (
                                        <button
                                          className="empty-price-btn"
                                          onClick={() => startAddingPrice(productName, breite, tiefe)}
                                          title="Klicken um Preis hinzuzufügen"
                                        >
                                          -
                                        </button>
                                      )}
                                    </td>
                                  );
                                })}
                                {/* Pending column cells for existing rows */}
                                {pCols.map((col, colIdx) => (
                                  <td key={`pending-col-${colIdx}-row-${tiefe}`} className="price-cell pending-cell">
                                    <input
                                      type="number"
                                      className="pending-price-input"
                                      placeholder="€"
                                      value={col.prices[tiefe] || ''}
                                      onChange={e => updatePendingColumnPrice(productName, colIdx, tiefe, e.target.value)}
                                    />
                                  </td>
                                ))}
                              </tr>
                            ))}
                            {/* Pending new rows */}
                            {pRows.map((row, rowIdx) => (
                              <tr key={`pending-row-${rowIdx}`}>
                                <td className="tiefe-header pending-header">
                                  <input
                                    type="number"
                                    className="pending-dimension-input"
                                    placeholder="Tiefe"
                                    value={row.tiefe || ''}
                                    onChange={e => updatePendingRowTiefe(productName, rowIdx, e.target.value)}
                                  />
                                  <button
                                    className="delete-row-btn"
                                    onClick={() => removePendingRow(productName, rowIdx)}
                                  >
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                      <path d="M18 6L6 18M6 6l12 12" />
                                    </svg>
                                  </button>
                                </td>
                                {/* Existing breite columns */}
                                {data.breiteValues.map(breite => (
                                  <td key={`pending-row-${rowIdx}-col-${breite}`} className="price-cell pending-cell">
                                    <input
                                      type="number"
                                      className="pending-price-input"
                                      placeholder="€"
                                      value={row.prices[breite] || ''}
                                      onChange={e => updatePendingRowPrice(productName, rowIdx, breite, e.target.value)}
                                    />
                                  </td>
                                ))}
                                {/* Pending column cells for pending rows */}
                                {pCols.map((col, colIdx) => (
                                  <td key={`pending-row-${rowIdx}-pending-col-${colIdx}`} className="price-cell pending-cell">
                                    <input
                                      type="number"
                                      className="pending-price-input"
                                      placeholder="€"
                                      value={col.prices[row.tiefe] || ''}
                                      onChange={e => {
                                        // Update in pending column's prices
                                        updatePendingColumnPrice(productName, colIdx, row.tiefe, e.target.value);
                                      }}
                                    />
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>

                        {/* Save/Cancel buttons when there are pending changes */}
                        {hasChanges && (
                          <div className="pending-actions">
                            <button className="btn-cancel" onClick={() => cancelPendingChanges(productName)}>
                              Abbrechen
                            </button>
                            <button
                              className="btn-save"
                              onClick={() => savePendingChanges(productName)}
                              disabled={saving}
                            >
                              {saving ? 'Speichern...' : 'Speichern'}
                            </button>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      )}

      {/* New Product Modal (Multi-Add) */}
      <AnimatePresence>
        {newProductModalOpen && (
          <motion.div
            className="modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeNewProductModal}
          >
            <motion.div
              className="product-modal new-product-modal"
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              onClick={e => e.stopPropagation()}
            >
              <div className="modal-header">
                <h2>Neues Produkt erstellen</h2>
                <button className="close-btn" onClick={closeNewProductModal}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="modal-body">
                {error && <div className="modal-error">{error}</div>}

                {/* Category Selection */}
                <div className="form-group">
                  <label>Kategorie *</label>
                  {customCategoryMode ? (
                    <div className="custom-input-wrapper">
                      <input
                        type="text"
                        value={newProductCategory}
                        onChange={e => setNewProductCategory(e.target.value)}
                        placeholder="Eigene Kategorie eingeben..."
                        autoFocus
                      />
                      <button
                        type="button"
                        className="btn-toggle-mode"
                        onClick={() => {
                          setCustomCategoryMode(false);
                          setNewProductCategory('');
                          setNewProductType('');
                          setNewProductName('');
                          setCustomProductTypeMode(false);
                          setCustomModelMode(false);
                        }}
                        title="Zurück zur Auswahl"
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M4 6h16M4 12h16M4 18h16" />
                        </svg>
                      </button>
                    </div>
                  ) : (
                    <select
                      value={newProductCategory}
                      onChange={e => {
                        if (e.target.value === '__custom__') {
                          setCustomCategoryMode(true);
                          setNewProductCategory('');
                          setNewProductType('');
                          setNewProductName('');
                        } else {
                          setNewProductCategory(e.target.value);
                          setNewProductType('');
                          setNewProductName('');
                        }
                      }}
                    >
                      <option value="">Kategorie wählen...</option>
                      {Object.keys(productConfig).map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                      <option value="__custom__">➕ Andere eingeben...</option>
                    </select>
                  )}
                </div>

                {/* Product Type Selection */}
                {newProductCategory && (
                  <div className="form-group">
                    <label>Produkttyp *</label>
                    {customCategoryMode || customProductTypeMode ? (
                      <div className="custom-input-wrapper">
                        <input
                          type="text"
                          value={newProductType}
                          onChange={e => setNewProductType(e.target.value)}
                          placeholder="Eigenen Produkttyp eingeben..."
                          autoFocus={customProductTypeMode}
                        />
                        {!customCategoryMode && (
                          <button
                            type="button"
                            className="btn-toggle-mode"
                            onClick={() => {
                              setCustomProductTypeMode(false);
                              setNewProductType('');
                              setNewProductName('');
                              setCustomModelMode(false);
                            }}
                            title="Zurück zur Auswahl"
                          >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M4 6h16M4 12h16M4 18h16" />
                            </svg>
                          </button>
                        )}
                      </div>
                    ) : (
                      <select
                        value={newProductType}
                        onChange={e => {
                          if (e.target.value === '__custom__') {
                            setCustomProductTypeMode(true);
                            setNewProductType('');
                            setNewProductName('');
                          } else {
                            setNewProductType(e.target.value);
                            setNewProductName('');
                          }
                        }}
                      >
                        <option value="">Produkttyp wählen...</option>
                        {availableProductTypes.map(pt => (
                          <option key={pt} value={pt}>{pt}</option>
                        ))}
                        <option value="__custom__">➕ Andere eingeben...</option>
                      </select>
                    )}
                  </div>
                )}

                {/* Model/Product Name Selection */}
                {newProductType && (
                  <div className="form-group">
                    <label>Modell / Produktname *</label>
                    {customCategoryMode || customProductTypeMode || customModelMode || availableModels.length === 0 ? (
                      <div className="custom-input-wrapper">
                        <input
                          type="text"
                          value={newProductName}
                          onChange={e => setNewProductName(e.target.value)}
                          placeholder="Produktname eingeben..."
                          autoFocus={customModelMode}
                        />
                        {!customCategoryMode && !customProductTypeMode && availableModels.length > 0 && (
                          <button
                            type="button"
                            className="btn-toggle-mode"
                            onClick={() => {
                              setCustomModelMode(false);
                              setNewProductName('');
                            }}
                            title="Zurück zur Auswahl"
                          >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M4 6h16M4 12h16M4 18h16" />
                            </svg>
                          </button>
                        )}
                      </div>
                    ) : (
                      <select
                        value={newProductName}
                        onChange={e => {
                          if (e.target.value === '__custom__') {
                            setCustomModelMode(true);
                            setNewProductName('');
                          } else {
                            setNewProductName(e.target.value);
                          }
                        }}
                      >
                        <option value="">Modell wählen...</option>
                        {availableModels.map(model => (
                          <option key={model} value={model}>{model}</option>
                        ))}
                        <option value="__custom__">➕ Andere eingeben...</option>
                      </select>
                    )}
                  </div>
                )}

                {/* Price entries - each row: Breite | Tiefe | Price */}
                <div className="price-entries-section">
                  <div className="entries-header">
                    <div className="entry-label">Breite (cm)</div>
                    <div className="entry-label">Tiefe (cm)</div>
                    <div className="entry-label">Preis (€)</div>
                    <div className="entry-action"></div>
                  </div>
                  {newProductEntries.map((entry, idx) => (
                    <div key={idx} className="price-entry-row">
                      <input
                        type="number"
                        value={entry.breite}
                        onChange={e => updateNewProductEntry(idx, 'breite', e.target.value)}
                        placeholder="200"
                      />
                      <input
                        type="number"
                        value={entry.tiefe}
                        onChange={e => updateNewProductEntry(idx, 'tiefe', e.target.value)}
                        placeholder="150"
                      />
                      <input
                        type="number"
                        value={entry.price}
                        onChange={e => updateNewProductEntry(idx, 'price', e.target.value)}
                        placeholder="1800"
                      />
                      {newProductEntries.length > 1 ? (
                        <button className="btn-remove-entry" onClick={() => removeNewProductEntry(idx)}>
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M18 6L6 18M6 6l12 12" />
                          </svg>
                        </button>
                      ) : (
                        <div className="entry-action-placeholder"></div>
                      )}
                    </div>
                  ))}
                  <button className="btn-add-entry" onClick={addNewProductEntry}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 5v14M5 12h14" />
                    </svg>
                    Weitere Zeile
                  </button>
                </div>
              </div>

              <div className="modal-footer">
                <button className="btn-cancel" onClick={closeNewProductModal}>Abbrechen</button>
                <button className="btn-save" onClick={saveNewProduct} disabled={saving}>
                  {saving ? 'Speichern...' : 'Produkt erstellen'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deleteConfirm && (
          <motion.div
            className="modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setDeleteConfirm(null)}
          >
            <motion.div
              className="delete-modal"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={e => e.stopPropagation()}
            >
              <h3>Löschen bestätigen</h3>
              <p>
                {deleteConfirm.type === 'product' && `Möchten Sie das gesamte Produkt "${deleteConfirm.productName}" mit allen Preisen löschen?`}
                {deleteConfirm.type === 'row' && `Möchten Sie die gesamte Zeile (Tiefe ${deleteConfirm.value} cm) löschen?`}
                {deleteConfirm.type === 'column' && `Möchten Sie die gesamte Spalte (Breite ${deleteConfirm.value} cm) löschen?`}
              </p>
              <div className="delete-modal-actions">
                <button className="btn-cancel" onClick={() => setDeleteConfirm(null)}>Abbrechen</button>
                <button
                  className="btn-delete"
                  onClick={() => {
                    if (deleteConfirm.type === 'product') {
                      handleDeleteProduct(deleteConfirm.productName);
                    } else if (deleteConfirm.type === 'row') {
                      handleDeleteRow(deleteConfirm.productName, deleteConfirm.value!);
                    } else if (deleteConfirm.type === 'column') {
                      handleDeleteColumn(deleteConfirm.productName, deleteConfirm.value!);
                    }
                  }}
                >
                  Löschen
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
