import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import './FinalSection.css';
import './SectionStyles.css';

interface FinalSectionProps {
  bemerkungen: string;
  bilder: File[];
  updateBemerkungen: (value: string) => void;
  updateBilder: (files: File[]) => void;
  onExport: () => Promise<void> | void;
}

const FinalSection = ({
  bemerkungen,
  bilder,
  updateBemerkungen,
  updateBilder,
  onExport
}: FinalSectionProps) => {
  const [dragActive, setDragActive] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const addMoreInputRef = useRef<HTMLInputElement>(null);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      await onExport();
    } finally {
      setIsExporting(false);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const files = Array.from(e.dataTransfer.files).filter(file =>
      file.type.startsWith('image/') || file.type === 'application/pdf'
    );

    if (files.length > 0) {
      const newFiles = [...bilder, ...files].slice(0, 10); // Max 10 files
      updateBilder(newFiles);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    const newFiles = [...bilder, ...files].slice(0, 10); // Max 10 files
    updateBilder(newFiles);
    // Reset input so same file can be selected again
    e.target.value = '';
  };

  const removeImage = (index: number) => {
    const newFiles = bilder.filter((_, i) => i !== index);
    updateBilder(newFiles);
  };

  const getFilePreview = (file: File) => {
    return URL.createObjectURL(file);
  };

  const isPdf = (file: File) => {
    return file.type === 'application/pdf';
  };

  const isValid = bilder.length >= 2;
  const canAddMore = bilder.length < 10;

  return (
    <div className="final-section">
      <motion.div
        className="section-header"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
      >
        <h2>Abschluss</h2>
        <p className="section-description">Bilder und Bemerkungen</p>
      </motion.div>

      <div className="final-content">
        {/* Bilder Upload Section */}
        <motion.div
          className="form-field full-width bilder-section"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
        >
          <div className="bilder-header">
            <label>
              Bilder hochladen <span className="required">*</span>
              <span className="label-hint">(Mindestens 2 Bilder erforderlich)</span>
            </label>
            {bilder.length > 0 && canAddMore && (
              <button
                type="button"
                className="add-more-btn"
                onClick={() => addMoreInputRef.current?.click()}
              >
                <span className="add-icon">+</span>
                Weitere Bilder hinzufügen
              </button>
            )}
          </div>

          <input
            ref={addMoreInputRef}
            type="file"
            accept="image/*,application/pdf"
            multiple
            onChange={handleFileSelect}
            style={{ display: 'none' }}
          />

          {/* Image Preview Grid */}
          <div className="image-preview-grid">
            <AnimatePresence>
              {bilder.map((file, index) => (
                <motion.div
                  key={`${file.name}-${index}`}
                  className={`image-preview-item ${isPdf(file) ? 'pdf-item' : ''}`}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                >
                  {isPdf(file) ? (
                    <a
                      href={getFilePreview(file)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="pdf-preview"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="pdf-icon">
                        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                        <polyline points="14,2 14,8 20,8" />
                        <path d="M9 13h6M9 17h6M9 9h1" />
                      </svg>
                      <span className="pdf-name">{file.name}</span>
                    </a>
                  ) : (
                    <img src={getFilePreview(file)} alt={`Bild ${index + 1}`} />
                  )}
                  <button
                    type="button"
                    className="remove-image-btn"
                    onClick={() => removeImage(index)}
                    title={isPdf(file) ? 'PDF entfernen' : 'Bild entfernen'}
                  >
                    ×
                  </button>
                  <span className="image-label">{isPdf(file) ? 'PDF' : 'Bild'} {index + 1}</span>
                </motion.div>
              ))}
            </AnimatePresence>

            {/* Upload placeholder - only show when no images or less than 2 */}
            {bilder.length < 2 && (
              <motion.div
                className={`image-upload-slot ${dragActive ? 'drag-active' : ''}`}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,application/pdf"
                  multiple
                  onChange={handleFileSelect}
                  style={{ display: 'none' }}
                />
                <span className="upload-icon">+</span>
                <span className="upload-text">
                  {bilder.length === 0
                    ? 'Klicken oder Dateien hierher ziehen'
                    : 'Noch 1 Datei erforderlich'
                  }
                </span>
              </motion.div>
            )}
          </div>

          {/* Image count indicator */}
          <div className="image-count">
            <span className={bilder.length >= 2 ? 'count-valid' : 'count-invalid'}>
              {bilder.length} von mindestens 2 Bildern
            </span>
            {bilder.length >= 2 && (
              <span className="check-icon">✓</span>
            )}
          </div>

          {/* Validation message */}
          {bilder.length < 2 && (
            <motion.div
              className="validation-message"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              Bitte laden Sie mindestens 2 Bilder hoch
            </motion.div>
          )}
        </motion.div>

        {/* Bemerkungen Section */}
        <motion.div
          className="form-field full-width"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.2 }}
        >
          <label htmlFor="bemerkungen">
            Bemerkungen
          </label>
          <textarea
            id="bemerkungen"
            value={bemerkungen}
            onChange={(e) => updateBemerkungen(e.target.value)}
            placeholder="Zusätzliche Notizen oder Bemerkungen..."
            rows={6}
          />
        </motion.div>

        {/* Export Section */}
        <motion.div
          className="export-section"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, delay: 0.3 }}
        >
          <div className="export-info">
            <h3>Bereit zum Exportieren</h3>
            <p>
              {isValid
                ? 'Alle Daten wurden erfasst. Sie können jetzt das PDF-Dokument generieren.'
                : 'Bitte laden Sie mindestens 2 Bilder hoch, um fortzufahren.'}
            </p>
          </div>
          <motion.button
            className={`export-button ${!isValid || isExporting ? 'disabled' : ''}`}
            onClick={handleExport}
            disabled={!isValid || isExporting}
            whileHover={isValid && !isExporting ? { scale: 1.02 } : {}}
            whileTap={isValid && !isExporting ? { scale: 0.98 } : {}}
          >
            <span className="button-text">
              {isExporting ? 'PDF wird erstellt...' : 'PDF Exportieren'}
            </span>
          </motion.button>
        </motion.div>
      </div>
    </div>
  );
};

export default FinalSection;
