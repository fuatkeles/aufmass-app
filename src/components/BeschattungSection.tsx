import { motion } from 'framer-motion';
import { FormData } from '../types';
import './BeschattungSection.css';

interface BeschattungSectionProps {
  formData: FormData;
  updateFormData: (field: string, value: any) => void;
  updateNestedData: (section: string, field: string, value: any) => void;
}

const BeschattungSection = ({ formData, updateFormData, updateNestedData }: BeschattungSectionProps) => {
  return (
    <div className="beschattung-section">
      <motion.div
        className="section-header"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
      >
        <h2>Beschattung</h2>
        <p className="section-description">Sonnenschutz-Optionen konfigurieren</p>
      </motion.div>

      <div className="beschattung-grid">
        <motion.div
          className="beschattung-group"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <h3>Beschattungstyp</h3>
          <div className="checkbox-group">
            <label className="checkbox-option">
              <input
                type="checkbox"
                checked={formData.beschattung.ancUnterglas}
                onChange={(e) => updateNestedData('beschattung', 'ancUnterglas', e.target.checked)}
              />
              <span>Anc. Unterglas</span>
            </label>
            <label className="checkbox-option">
              <input
                type="checkbox"
                checked={formData.beschattung.ancAufglas}
                onChange={(e) => updateNestedData('beschattung', 'ancAufglas', e.target.checked)}
              />
              <span>Anc. Aufglas</span>
            </label>
            <label className="checkbox-option">
              <input
                type="checkbox"
                checked={formData.beschattung.capri}
                onChange={(e) => updateNestedData('beschattung', 'capri', e.target.checked)}
              />
              <span>Capri</span>
            </label>
          </div>
        </motion.div>

        <motion.div
          className="beschattung-group"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <label htmlFor="markise">Markise</label>
          <input
            type="text"
            id="markise"
            value={formData.beschattung.markise}
            onChange={(e) => updateNestedData('beschattung', 'markise', e.target.value)}
            placeholder="Markise Modell"
          />
        </motion.div>

        <motion.div
          className="beschattung-group dimensions-group"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          <h3>Abmessungen</h3>
          <div className="dimensions-inputs">
            <div className="form-group">
              <label htmlFor="breite">Breite</label>
              <input
                type="number"
                id="breite"
                value={formData.beschattung.breite}
                onChange={(e) => updateNestedData('beschattung', 'breite', e.target.value)}
                placeholder="0"
              />
            </div>
            <div className="form-group">
              <label htmlFor="tiefe">Tiefe</label>
              <input
                type="number"
                id="tiefe"
                value={formData.beschattung.tiefe}
                onChange={(e) => updateNestedData('beschattung', 'tiefe', e.target.value)}
                placeholder="0"
              />
            </div>
          </div>
        </motion.div>

        <motion.div
          className="beschattung-group"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
        >
          <label htmlFor="volanTyp">Volan Typ</label>
          <div className="radio-group">
            <label className="radio-option">
              <input
                type="radio"
                name="volanTyp"
                value="f-motor"
                checked={formData.beschattung.volanTyp === 'f-motor'}
                onChange={(e) => updateNestedData('beschattung', 'volanTyp', e.target.value)}
              />
              <span>F-Motor mit Handsender</span>
            </label>
            <label className="radio-option">
              <input
                type="radio"
                name="volanTyp"
                value="e-motor"
                checked={formData.beschattung.volanTyp === 'e-motor'}
                onChange={(e) => updateNestedData('beschattung', 'volanTyp', e.target.value)}
              />
              <span>E-Motor</span>
            </label>
          </div>
        </motion.div>

        <motion.div
          className="beschattung-group"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.5 }}
        >
          <h3>Antrieb</h3>
          <input
            type="text"
            value={formData.beschattung.antrieb}
            onChange={(e) => updateNestedData('beschattung', 'antrieb', e.target.value)}
            placeholder="Antrieb Typ"
          />
        </motion.div>

        <motion.div
          className="beschattung-group"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.6 }}
        >
          <h3>Antriebsseite</h3>
          <div className="radio-group horizontal">
            <label className="radio-option">
              <input
                type="radio"
                name="antriebsseite"
                value="links"
                checked={formData.beschattung.antriebsseite === 'links'}
                onChange={(e) => updateNestedData('beschattung', 'antriebsseite', e.target.value)}
              />
              <span>Links</span>
            </label>
            <label className="radio-option">
              <input
                type="radio"
                name="antriebsseite"
                value="rechts"
                checked={formData.beschattung.antriebsseite === 'rechts'}
                onChange={(e) => updateNestedData('beschattung', 'antriebsseite', e.target.value)}
              />
              <span>Rechts</span>
            </label>
          </div>
        </motion.div>

        <motion.div
          className="beschattung-group full-width"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.7 }}
        >
          <label htmlFor="zeichnung">Zeichnung & Bemerkung</label>
          <textarea
            id="zeichnung"
            value={formData.zeichnung}
            onChange={(e) => updateFormData('zeichnung', e.target.value)}
            placeholder="Zusätzliche Notizen, Zeichnungen oder Bemerkungen..."
            rows={6}
          />
        </motion.div>
      </div>
    </div>
  );
};

export default BeschattungSection;
