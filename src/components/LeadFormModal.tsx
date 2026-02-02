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
  dimensions: ProductDimensions;
}

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
        // Load dimensions for new product
        if (value) {
          loadDimensions(value as string).then(dims => {
            setProductRows(prev => prev.map(r =>
              r.id === rowId ? { ...r, dimensions: dims } : r
            ));
          });
        }
      } else if (field === 'breite') {
        updated.tiefe = '';
        updated.price = 0;
      } else if (field === 'tiefe' && updated.breite && updated.dimensions[updated.breite]) {
        // Calculate price when tiefe is selected
        const found = updated.dimensions[updated.breite].find(d => d.tiefe === value);
        updated.price = found?.price || 0;
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

  const calculateTotal = () => {
    const productsTotal = productRows
      .filter(r => r.price > 0)
      .reduce((sum, r) => sum + (r.price * r.quantity), 0);
    const extrasTotal = extras
      .filter(e => e.price)
      .reduce((sum, e) => sum + Number(e.price), 0);
    return productsTotal + extrasTotal;
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
          unit_price: r.price
        })),
        extras: validExtras.map(e => ({
          description: e.description.trim(),
          price: Number(e.price)
        }))
      });

      // Generate and save Angebot PDF
      try {
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
            total_price: r.price * r.quantity
          })),
          extras: validExtras.map(e => ({
            description: e.description.trim(),
            price: Number(e.price)
          })),
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
                        <label>Breite</label>
                        <select
                          value={row.breite}
                          onChange={e => updateRow(row.id, 'breite', Number(e.target.value) || '')}
                          disabled={!row.product_name}
                        >
                          <option value="">Breite...</option>
                          {Object.keys(row.dimensions).map(b => (
                            <option key={b} value={b}>{b} cm</option>
                          ))}
                        </select>
                      </div>

                      <div className="select-group">
                        <label>Tiefe</label>
                        <select
                          value={row.tiefe}
                          onChange={e => updateRow(row.id, 'tiefe', Number(e.target.value) || '')}
                          disabled={!row.breite}
                        >
                          <option value="">Tiefe...</option>
                          {row.breite && row.dimensions[row.breite]?.map(d => (
                            <option key={d.tiefe} value={d.tiefe}>{d.tiefe} cm</option>
                          ))}
                        </select>
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

                    {row.price > 0 && (
                      <div className="product-row-price">
                        <div className="price-breakdown">
                          <span className="price-dims">{row.breite} x {row.tiefe} cm</span>
                          {row.quantity > 1 && <span className="price-qty">x {row.quantity}</span>}
                        </div>
                        <span className="price-value">{formatPrice(row.price * row.quantity)}</span>
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

            {/* Total */}
            <div className="lead-total">
              <span>Gesamtsumme:</span>
              <span className="total-price">{formatPrice(calculateTotal())}</span>
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
