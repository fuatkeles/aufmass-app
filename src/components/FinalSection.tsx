import { motion } from 'framer-motion';
import './FinalSection.css';
import './SectionStyles.css';

interface FinalSectionProps {
  bemerkungen: string;
  updateBemerkungen: (value: string) => void;
  onExport: () => void;
}

const FinalSection = ({ bemerkungen, updateBemerkungen, onExport }: FinalSectionProps) => {
  return (
    <div className="final-section">
      <motion.div
        className="section-header"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
      >
        <h2>Zusätzliche Informationen</h2>
        <p className="section-description">Bilder, Zeichnungen und Bemerkungen</p>
      </motion.div>

      <div className="final-content">
        <motion.div
          className="form-field full-width"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
        >
          <label htmlFor="bilder">
            Bilder hochladen
          </label>
          <div className="image-upload-area">
            <input
              type="file"
              id="bilder"
              accept="image/*"
              multiple
              className="file-input"
            />
            <label htmlFor="bilder" className="file-upload-label">
              <span className="upload-icon">+</span>
              <span className="upload-text">Klicken Sie hier oder ziehen Sie Bilder</span>
              <span className="upload-hint">PNG, JPG bis zu 10MB</span>
            </label>
          </div>
        </motion.div>

        <motion.div
          className="form-field full-width"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.2 }}
        >
          <label htmlFor="bemerkungen">
            Zeichnung & Bemerkungen
          </label>
          <textarea
            id="bemerkungen"
            value={bemerkungen}
            onChange={(e) => updateBemerkungen(e.target.value)}
            placeholder="Zusätzliche Notizen, Zeichnungen oder Bemerkungen..."
            rows={8}
          />
        </motion.div>

        <motion.div
          className="export-section"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, delay: 0.3 }}
        >
          <div className="export-info">
            <h3>Bereit zum Exportieren</h3>
            <p>Alle Daten wurden erfasst. Sie können jetzt das PDF-Dokument generieren.</p>
          </div>
          <motion.button
            className="export-button"
            onClick={onExport}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <span className="button-text">PDF Exportieren</span>
          </motion.button>
        </motion.div>
      </div>
    </div>
  );
};

export default FinalSection;
