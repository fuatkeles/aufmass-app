import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { api, saveLeadPdf } from '../services/api';
import { generateAngebotPDF } from '../utils/angebotPdfGenerator';
import './LeadFormModal.css';

interface LeadFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface ProductDimensions {
  [breite: number]: { tiefe: number; price: number }[];
}

interface ProductRow {
  id: string;
  product_name: string;
  breite: number | '';
  tiefe: number | '';
  quantity: number;
  price: number;
  discount: number; // Discount in Euro
  dimensions: ProductDimensions;
  // For rounding display
  roundedBreite?: number;
  roundedTiefe?: number;
  // Extra specification fields (informational, not affecting price)
  piOberKante: string;
  piUnterKante: string;
  piGestellFarbe: string;
  piSicherheitglas: string;
  piPfostenanzahl: string;
}

// Rounding functions for price calculation
const roundBreiteToGrid = (value: number): number => {
  // Breite grid: 200, 300, 400, 500, 600, 700, 800, 900, 1000, 1100, 1200
  const min = 200;
  const max = 1200;
  const step = 100;
  const rounded = Math.ceil(value / step) * step;
  return Math.max(min, Math.min(max, rounded));
};

const roundTiefeToGrid = (value: number): number => {
  // Tiefe grid: 150, 200, 250, 300, 350, 400, 450, 500, 550, 600
  const min = 150;
  const max = 600;
  const step = 50;
  const rounded = Math.ceil(value / step) * step;
  return Math.max(min, Math.min(max, rounded));
};

interface LeadExtra {
  id: string;
  description: string;
  price: number | '';
}

const generateId = () => Math.random().toString(36).substr(2, 9);

export default function LeadFormModal({ isOpen, onClose, onSuccess }: LeadFormModalProps) {
  // Customer info
  const [firstname, setFirstname] = useState('');
  const [lastname, setLastname] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');

  // Products
  const [productNames, setProductNames] = useState<string[]>([]);
  const [productRows, setProductRows] = useState<ProductRow[]>([]);
  const [extras, setExtras] = useState<LeadExtra[]>([]);

  // Discounts
  const [showItemDiscounts, setShowItemDiscounts] = useState(false);
  const [totalDiscount, setTotalDiscount] = useState<number>(0);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Initialize with one empty product row
  useEffect(() => {
    if (isOpen) {
      loadProductNames();
      if (productRows.length === 0) {
        setProductRows([createEmptyRow()]);
      }
    }
  }, [isOpen]);

  const createEmptyRow = (): ProductRow => ({
    id: generateId(),
    product_name: '',
    breite: '',
    tiefe: '',
    quantity: 1,
    price: 0,
    discount: 0,
    piOberKante: '',
    piUnterKante: '',
    piGestellFarbe: '',
    piSicherheitglas: '',
    piPfostenanzahl: '',
    dimensions: {}
  });

  const loadProductNames = async () => {
    try {
      const data = await api.get<string[]>('/lead-products/names');
      setProductNames(data);
    } catch (err) {
      console.error('Failed to load products:', err);
    }
  };

  const loadDimensions = async (productName: string): Promise<ProductDimensions> => {
    try {
      return await api.get<ProductDimensions>(`/lead-products/${encodeURIComponent(productName)}/dimensions`);
    } catch (err) {
      console.error('Failed to load dimensions:', err);
      return {};
    }
  };

  const updateRow = useCallback(async (rowId: string, field: string, value: string | number) => {
    setProductRows(prev => prev.map(row => {
      if (row.id !== rowId) return row;

      const updated = { ...row, [field]: value };

      // Reset dependent fields
      if (field === 'product_name') {
        updated.breite = '';
        updated.tiefe = '';
        updated.price = 0;
        updated.dimensions = {};
        updated.roundedBreite = undefined;
        updated.roundedTiefe = undefined;
        // Load dimensions for new product
        if (value) {
          loadDimensions(value as string).then(dims => {
            setProductRows(prev => prev.map(r =>
              r.id === rowId ? { ...r, dimensions: dims } : r
            ));
          });
        }
      } else if (field === 'breite' || field === 'tiefe') {
        // Calculate price using rounded values
        const breiteValue = field === 'breite' ? (value as number) : (updated.breite as number);
        const tiefeValue = field === 'tiefe' ? (value as number) : (updated.tiefe as number);

        if (breiteValue && tiefeValue && Object.keys(updated.dimensions).length > 0) {
          // Round values for price lookup
          const roundedBreite = roundBreiteToGrid(breiteValue);
          const roundedTiefe = roundTiefeToGrid(tiefeValue);

          updated.roundedBreite = roundedBreite;
          updated.roundedTiefe = roundedTiefe;

          // Find price from dimensions matrix using rounded values
          const breiteKey = Object.keys(updated.dimensions).find(b => Number(b) === roundedBreite);
          if (breiteKey && updated.dimensions[Number(breiteKey)]) {
            const found = updated.dimensions[Number(breiteKey)].find(d => d.tiefe === roundedTiefe);
            updated.price = found?.price || 0;
          } else {
            updated.price = 0;
          }
        } else {
          updated.price = 0;
          updated.roundedBreite = undefined;
          updated.roundedTiefe = undefined;
        }
      }

      return updated;
    }));
  }, []);

  const addProductRow = () => {
    setProductRows(prev => [...prev, createEmptyRow()]);
  };

  const removeProductRow = (rowId: string) => {
    setProductRows(prev => {
      const filtered = prev.filter(r => r.id !== rowId);
      // Always keep at least one row
      return filtered.length === 0 ? [createEmptyRow()] : filtered;
    });
  };

  const updateRowDiscount = (rowId: string, discount: number) => {
    setProductRows(prev => prev.map(r =>
      r.id === rowId ? { ...r, discount: Math.max(0, discount) } : r
    ));
  };

  const addExtra = () => {
    setExtras(prev => [...prev, { id: generateId(), description: '', price: '' }]);
  };

  const updateExtra = (id: string, field: 'description' | 'price', value: string | number) => {
    setExtras(prev => prev.map(e =>
      e.id === id ? { ...e, [field]: value } : e
    ));
  };

  const removeExtra = (id: string) => {
    setExtras(prev => prev.filter(e => e.id !== id));
  };

  // Calculate subtotal (before discounts)
  const calculateSubtotal = () => {
    const productsTotal = productRows
      .filter(r => r.price > 0)
      .reduce((sum, r) => sum + (r.price * r.quantity), 0);
    const extrasTotal = extras
      .filter(e => e.price)
      .reduce((sum, e) => sum + Number(e.price), 0);
    return productsTotal + extrasTotal;
  };

  // Calculate total item discounts
  const calculateItemDiscounts = () => {
    return productRows
      .filter(r => r.discount > 0)
      .reduce((sum, r) => sum + r.discount, 0);
  };

  // Calculate total (after all discounts)
  const calculateTotal = () => {
    const subtotal = calculateSubtotal();
    const itemDiscounts = calculateItemDiscounts();
    const totalDisc = totalDiscount || 0;
    return Math.max(0, subtotal - itemDiscounts - totalDisc);
  };

  // Calculate discount percentage for a single row
  const getRowDiscountPercent = (row: ProductRow) => {
    const rowTotal = row.price * row.quantity;
    if (rowTotal <= 0 || row.discount <= 0) return 0;
    return Math.round((row.discount / rowTotal) * 100);
  };

  // Calculate total discount percentage
  const getTotalDiscountPercent = () => {
    const subtotal = calculateSubtotal();
    const allDiscounts = calculateItemDiscounts() + (totalDiscount || 0);
    if (subtotal <= 0 || allDiscounts <= 0) return 0;
    return Math.round((allDiscounts / subtotal) * 100);
  };

  const getValidItems = () => {
    return productRows.filter(r => r.product_name && r.breite && r.tiefe && r.price > 0);
  };

  const getValidExtras = () => {
    return extras.filter(e => e.description.trim() && e.price && Number(e.price) > 0);
  };

  const handleSubmit = async () => {
    if (!firstname.trim() || !lastname.trim()) {
      setError('Vorname und Nachname sind erforderlich');
      return;
    }

    if (!email.trim() || !email.includes('@')) {
      setError('Gültige E-Mail-Adresse erforderlich');
      return;
    }

    const validItems = getValidItems();
    const validExtras = getValidExtras();

    if (validItems.length === 0 && validExtras.length === 0) {
      setError('Mindestens ein Produkt oder eine Zusatzleistung erforderlich');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const result = await api.post<{ id: number }>('/leads', {
        customer_firstname: firstname.trim(),
        customer_lastname: lastname.trim(),
        customer_email: email.trim(),
        customer_phone: phone.trim() || null,
        customer_address: address.trim() || null,
        notes: notes.trim() || null,
        items: validItems.map(r => ({
          product_name: r.product_name,
          breite: r.breite,
          tiefe: r.tiefe,
          quantity: r.quantity,
          unit_price: r.price,
          discount: r.discount || 0,
          piOberKante: r.piOberKante || null,
          piUnterKante: r.piUnterKante || null,
          piGestellFarbe: r.piGestellFarbe || null,
          piSicherheitglas: r.piSicherheitglas || null,
          piPfostenanzahl: r.piPfostenanzahl || null
        })),
        extras: validExtras.map(e => ({
          description: e.description.trim(),
          price: Number(e.price)
        })),
        total_discount: totalDiscount || 0,
        subtotal: calculateSubtotal(),
        total_price: calculateTotal()
      });

      // Generate and save Angebot PDF
      try {
        const itemDiscountsTotal = calculateItemDiscounts();
        const pdfResult = await generateAngebotPDF({
          customer_firstname: firstname.trim(),
          customer_lastname: lastname.trim(),
          customer_email: email.trim(),
          customer_phone: phone.trim() || undefined,
          customer_address: address.trim() || undefined,
          notes: notes.trim() || undefined,
          items: validItems.map(r => ({
            product_name: r.product_name,
            breite: r.breite as number,
            tiefe: r.tiefe as number,
            quantity: r.quantity,
            unit_price: r.price,
            discount: r.discount || 0,
            discount_percent: getRowDiscountPercent(r),
            total_price: (r.price * r.quantity) - (r.discount || 0),
            piOberKante: r.piOberKante || undefined,
            piUnterKante: r.piUnterKante || undefined,
            piGestellFarbe: r.piGestellFarbe || undefined,
            piSicherheitglas: r.piSicherheitglas || undefined,
            piPfostenanzahl: r.piPfostenanzahl || undefined
          })),
          extras: validExtras.map(e => ({
            description: e.description.trim(),
            price: Number(e.price)
          })),
          subtotal: calculateSubtotal(),
          item_discounts: itemDiscountsTotal,
          total_discount: totalDiscount || 0,
          total_discount_percent: getTotalDiscountPercent(),
          total_price: calculateTotal()
        }, { returnBlob: true });

        if (pdfResult?.blob) {
          await saveLeadPdf(result.id, pdfResult.blob);
          console.log('Angebot PDF generated and saved');
        }
      } catch (pdfErr) {
        console.error('Angebot PDF generation failed:', pdfErr);
      }

      onSuccess();
      resetForm();
      onClose();
    } catch (err) {
      setError('Fehler beim Erstellen des Angebots');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFirstname('');
    setLastname('');
    setEmail('');
    setPhone('');
    setAddress('');
    setNotes('');
    setProductRows([createEmptyRow()]);
    setExtras([]);
    setTotalDiscount(0);
    setError('');
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(price);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        className="lead-modal-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          className="lead-modal"
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          onClick={e => e.stopPropagation()}
        >
          <div className="lead-modal-header">
            <h2>Neues Angebot erstellen</h2>
            <button className="close-btn" onClick={onClose}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="lead-modal-body">
            {error && <div className="lead-error">{error}</div>}

            {/* Customer Info Section */}
            <section className="lead-section">
              <h3>Kundendaten</h3>
              <div className="lead-form-grid">
                <div className="form-group">
                  <label>Vorname *</label>
                  <input
                    type="text"
                    value={firstname}
                    onChange={e => setFirstname(e.target.value)}
                    placeholder="Vorname"
                  />
                </div>
                <div className="form-group">
                  <label>Nachname *</label>
                  <input
                    type="text"
                    value={lastname}
                    onChange={e => setLastname(e.target.value)}
                    placeholder="Nachname"
                  />
                </div>
                <div className="form-group">
                  <label>E-Mail *</label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="email@beispiel.de"
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Telefon</label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    placeholder="+49 123 456789"
                  />
                </div>
                <div className="form-group full-width">
                  <label>Adresse</label>
                  <input
                    type="text"
                    value={address}
                    onChange={e => setAddress(e.target.value)}
                    placeholder="Straße, PLZ, Ort"
                  />
                </div>
              </div>
            </section>

            {/* Products Section */}
            <section className="lead-section">
              <h3>Produkte</h3>

              <div className="product-rows">
                {productRows.map((row, index) => (
                  <div key={row.id} className="product-row-card">
                    <div className="product-row-header">
                      <span className="lead-product-number">Produkt {index + 1}</span>
                      {productRows.length > 1 && (
                        <button className="btn-remove-row" onClick={() => removeProductRow(row.id)}>
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M18 6L6 18M6 6l12 12" />
                          </svg>
                        </button>
                      )}
                    </div>

                    <div className="product-row-selects">
                      <div className="select-group">
                        <label>Produkt</label>
                        <select
                          value={row.product_name}
                          onChange={e => updateRow(row.id, 'product_name', e.target.value)}
                        >
                          <option value="">Produkt wählen...</option>
                          {productNames.map(name => (
                            <option key={name} value={name}>{name}</option>
                          ))}
                        </select>
                      </div>

                      <div className="select-group">
                        <label>Breite (cm)</label>
                        <input
                          type="number"
                          min="1"
                          max="1200"
                          value={row.breite}
                          onChange={e => updateRow(row.id, 'breite', e.target.value ? Number(e.target.value) : '')}
                          disabled={!row.product_name}
                          placeholder="z.B. 485"
                          className="dimension-input"
                        />
                      </div>

                      <div className="select-group">
                        <label>Tiefe (cm)</label>
                        <input
                          type="number"
                          min="1"
                          max="600"
                          value={row.tiefe}
                          onChange={e => updateRow(row.id, 'tiefe', e.target.value ? Number(e.target.value) : '')}
                          disabled={!row.product_name}
                          placeholder="z.B. 287"
                          className="dimension-input"
                        />
                      </div>

                      <div className="select-group quantity-group">
                        <label>Menge</label>
                        <input
                          type="number"
                          min="1"
                          value={row.quantity}
                          onChange={e => updateRow(row.id, 'quantity', Math.max(1, parseInt(e.target.value) || 1))}
                          disabled={!row.price}
                        />
                      </div>
                    </div>

                    {/* Extra specification fields - show after dimensions are entered */}
                    {row.breite && row.tiefe && (
                      <div className="product-extra-specs">
                        <div className="extra-specs-grid">
                          <div className="spec-field">
                            <label>Ober Kante</label>
                            <input
                              type="text"
                              value={row.piOberKante}
                              onChange={e => setProductRows(prev => prev.map(r => r.id === row.id ? { ...r, piOberKante: e.target.value } : r))}
                              placeholder="z.B. 280 cm"
                            />
                          </div>
                          <div className="spec-field">
                            <label>Unter Kante</label>
                            <input
                              type="text"
                              value={row.piUnterKante}
                              onChange={e => setProductRows(prev => prev.map(r => r.id === row.id ? { ...r, piUnterKante: e.target.value } : r))}
                              placeholder="z.B. 240 cm"
                            />
                          </div>
                          <div className="spec-field">
                            <label>Gestell Farbe</label>
                            <input
                              type="text"
                              value={row.piGestellFarbe}
                              onChange={e => setProductRows(prev => prev.map(r => r.id === row.id ? { ...r, piGestellFarbe: e.target.value } : r))}
                              placeholder="z.B. RAL 7016"
                            />
                          </div>
                          <div className="spec-field">
                            <label>Sicherheitglas</label>
                            <input
                              type="text"
                              value={row.piSicherheitglas}
                              onChange={e => setProductRows(prev => prev.map(r => r.id === row.id ? { ...r, piSicherheitglas: e.target.value } : r))}
                              placeholder="z.B. VSG 8 mm Klar"
                            />
                          </div>
                          <div className="spec-field">
                            <label>Pfostenanzahl</label>
                            <input
                              type="text"
                              value={row.piPfostenanzahl}
                              onChange={e => setProductRows(prev => prev.map(r => r.id === row.id ? { ...r, piPfostenanzahl: e.target.value } : r))}
                              placeholder="z.B. 3"
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {row.price > 0 && (
                      <div className="product-row-price-section">
                        <div className="product-row-price">
                          <div className="price-breakdown">
                            <span className="price-dims">{row.breite} x {row.tiefe} cm</span>
                            {(row.roundedBreite !== row.breite || row.roundedTiefe !== row.tiefe) && (
                              <span className="price-rounded">→ Preis für {row.roundedBreite} x {row.roundedTiefe} cm</span>
                            )}
                            {row.quantity > 1 && <span className="price-qty">x {row.quantity}</span>}
                          </div>
                          <span className="price-value">{formatPrice(row.price * row.quantity)}</span>
                        </div>

                        {/* Discount input for this product - only show when enabled */}
                        {showItemDiscounts && (
                          <div className="product-discount-row">
                            <label>Rabatt (€)</label>
                            <div className="discount-input-wrapper">
                              <input
                                type="number"
                                min="0"
                                step="1"
                                value={row.discount || ''}
                                onChange={e => updateRowDiscount(row.id, parseFloat(e.target.value) || 0)}
                                placeholder="0"
                                className="discount-input"
                              />
                              {row.discount > 0 && (
                                <span className="discount-percent">-{getRowDiscountPercent(row)}%</span>
                              )}
                            </div>
                            {row.discount > 0 && (
                              <span className="price-after-discount">
                                → {formatPrice((row.price * row.quantity) - row.discount)}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                    {row.breite && row.tiefe && row.price === 0 && Object.keys(row.dimensions).length > 0 && (
                      <div className="product-row-warning">
                        Keine Preisdaten für diese Größe verfügbar
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <button type="button" className="btn-add-row" onClick={addProductRow}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 5v14M5 12h14" />
                </svg>
                Weiteres Produkt hinzufügen
              </button>

              {/* Per-item discount toggle */}
              <label className="discount-toggle-label product-discount-toggle">
                <input
                  type="checkbox"
                  checked={showItemDiscounts}
                  onChange={e => {
                    const enabled = e.target.checked;
                    setShowItemDiscounts(enabled);
                    if (!enabled) {
                      setProductRows(prev => prev.map(r => ({ ...r, discount: 0 })));
                    }
                  }}
                />
                <span>Artikel-Rabatte aktivieren</span>
              </label>
            </section>

            {/* Extras Section */}
            <section className="lead-section">
              <h3>Zusatzleistungen (optional)</h3>

              {extras.length > 0 && (
                <div className="extras-list">
                  {extras.map(extra => (
                    <div key={extra.id} className="extra-row">
                      <input
                        type="text"
                        value={extra.description}
                        onChange={e => updateExtra(extra.id, 'description', e.target.value)}
                        placeholder="Beschreibung (z.B. Montage)"
                        className="extra-desc"
                      />
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={extra.price}
                        onChange={e => updateExtra(extra.id, 'price', e.target.value)}
                        placeholder="Preis €"
                        className="extra-price"
                      />
                      <button className="btn-remove-extra" onClick={() => removeExtra(extra.id)}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M18 6L6 18M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <button type="button" className="btn-add-extra" onClick={addExtra}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 5v14M5 12h14" />
                </svg>
                Zusatzleistung hinzufügen
              </button>
            </section>

            {/* Notes */}
            <section className="lead-section">
              <h3>Notizen</h3>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Zusätzliche Bemerkungen..."
                rows={4}
              />
            </section>

            {/* Pricing Summary */}
            <div className="lead-pricing-summary">
              {/* Subtotal */}
              <div className="pricing-row subtotal-row">
                <span>Zwischensumme:</span>
                <span className="pricing-value">{formatPrice(calculateSubtotal())}</span>
              </div>

              {/* Item discounts (if any) */}
              {showItemDiscounts && calculateItemDiscounts() > 0 && (
                <div className="pricing-row discount-row">
                  <span>Produktrabatte:</span>
                  <span className="pricing-value discount-value">-{formatPrice(calculateItemDiscounts())}</span>
                </div>
              )}

              {/* Total discount input */}
              <div className="pricing-row total-discount-row">
                <div className="total-discount-label">
                  <span>Gesamtrabatt (€):</span>
                  {totalDiscount > 0 && (
                    <span className="total-discount-percent">
                      -{Math.round((totalDiscount / calculateSubtotal()) * 100)}%
                    </span>
                  )}
                </div>
                <div className="total-discount-input-wrapper">
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={totalDiscount || ''}
                    onChange={e => setTotalDiscount(parseFloat(e.target.value) || 0)}
                    placeholder="0"
                    className="total-discount-input"
                  />
                </div>
              </div>

              {/* Final Total */}
              <div className="pricing-row total-row">
                <span>Gesamtsumme:</span>
                <div className="total-with-discount">
                  <span className="total-price">{formatPrice(calculateTotal())}</span>
                  {getTotalDiscountPercent() > 0 && (
                    <span className="total-savings">Sie sparen {getTotalDiscountPercent()}%</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="lead-modal-footer">
            <button className="btn-cancel" onClick={onClose}>Abbrechen</button>
            <button className="btn-save" onClick={handleSubmit} disabled={loading}>
              {loading ? 'Speichern...' : 'Angebot speichern'}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
