import { motion } from 'framer-motion';
import { FormData } from '../types';
import './FormSection.css';

interface FormSectionProps {
  formData: FormData;
  updateFormData: (field: string, value: any) => void;
  updateNestedData: (section: string, field: string, value: any) => void;
}

const FormSection = ({ formData, updateFormData }: FormSectionProps) => {
  return (
    <div className="form-section">
      <motion.div
        className="section-header"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
      >
        <h2>Grunddaten</h2>
        <p className="section-description">Bitte füllen Sie die grundlegenden Informationen aus</p>
      </motion.div>

      <div className="form-grid">
        <motion.div
          className="form-group"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <label htmlFor="aufmasser">Aufmasser / Berater</label>
          <input
            type="text"
            id="aufmasser"
            value={formData.aufmasser}
            onChange={(e) => updateFormData('aufmasser', e.target.value)}
            placeholder="Name eingeben"
          />
        </motion.div>

        <motion.div
          className="form-group"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <label htmlFor="montageteam">Montageteam</label>
          <input
            type="text"
            id="montageteam"
            value={formData.montageteam}
            onChange={(e) => updateFormData('montageteam', e.target.value)}
            placeholder="Team eingeben"
          />
        </motion.div>

        <motion.div
          className="form-group"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          <label htmlFor="kunde">Kunde</label>
          <input
            type="text"
            id="kunde"
            value={formData.kunde}
            onChange={(e) => updateFormData('kunde', e.target.value)}
            placeholder="Kundenname"
          />
        </motion.div>

        <motion.div
          className="form-group"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
        >
          <label htmlFor="datum">Datum</label>
          <input
            type="date"
            id="datum"
            value={formData.datum}
            onChange={(e) => updateFormData('datum', e.target.value)}
          />
        </motion.div>
      </div>

      <div className="dimension-section">
        <motion.h3
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.5 }}
        >
          Abmessungen
        </motion.h3>

        <div className="form-grid">
          <motion.div
            className="form-group"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.6 }}
          >
            <label htmlFor="anzahlStutzen">Anzahl Stützen</label>
            <input
              type="number"
              id="anzahlStutzen"
              value={formData.anzahlStutzen}
              onChange={(e) => updateFormData('anzahlStutzen', e.target.value)}
              placeholder="0"
              min="0"
            />
          </motion.div>

          <motion.div
            className="form-group"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.7 }}
          >
            <label htmlFor="hoheStutzen">Höhe Stützen (cm)</label>
            <input
              type="number"
              id="hoheStutzen"
              value={formData.hoheStutzen}
              onChange={(e) => updateFormData('hoheStutzen', e.target.value)}
              placeholder="0"
              min="0"
            />
          </motion.div>

          <motion.div
            className="form-group full-width"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.8 }}
          >
            <label htmlFor="gestellfarbe">Gestellfarbe</label>
            <input
              type="text"
              id="gestellfarbe"
              value={formData.gestellfarbe}
              onChange={(e) => updateFormData('gestellfarbe', e.target.value)}
              placeholder="Farbe eingeben"
            />
          </motion.div>
        </div>
      </div>

      <motion.div
        className="eindeckung-section"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.9 }}
      >
        <h3>Eindeckung</h3>
        <div className="radio-group">
          {[
            { value: '8mm', label: '8mm VSG (klar / milchig)' },
            { value: '10mm', label: '10mm VSG (klar / milchig)' },
            { value: '16mm', label: '16mm PCS (klar / milchig)' }
          ].map((option, index) => (
            <motion.label
              key={option.value}
              className="radio-option"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: 1 + index * 0.1 }}
            >
              <input
                type="radio"
                name="eindeckung"
                value={option.value}
                checked={formData.eindeckung === option.value}
                onChange={(e) => updateFormData('eindeckung', e.target.value)}
              />
              <span className="radio-label">{option.label}</span>
            </motion.label>
          ))}
        </div>
      </motion.div>
    </div>
  );
};

export default FormSection;
