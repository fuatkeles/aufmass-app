import { motion } from 'framer-motion';
import './GrunddatenSection.css';
import './SectionStyles.css';

interface GrunddatenSectionProps {
  formData: {
    datum: string;
    aufmasser: string;
    montageteam: string;
    kundeVorname: string;
    kundeNachname: string;
    kundenlokation: string;
  };
  updateField: (field: string, value: string) => void;
}

const GrunddatenSection = ({ formData, updateField }: GrunddatenSectionProps) => {
  const montageteams = ['SENOL', 'APO'];

  return (
    <div className="grunddaten-section">
      <motion.div
        className="section-header"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
      >
        <h2>Grunddaten</h2>
        <p className="section-description">Allgemeine Informationen zum Aufmaß</p>
      </motion.div>

      <div className="form-grid">
        <motion.div
          className="form-group full-width"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
        >
          <label htmlFor="datum">
            Datum <span className="required">*</span>
          </label>
          <input
            type="date"
            id="datum"
            value={formData.datum}
            onChange={(e) => updateField('datum', e.target.value)}
            required
          />
        </motion.div>

        <motion.div
          className="form-group"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.2 }}
        >
          <label htmlFor="aufmasser">
            Aufmasser / Berater <span className="required">*</span>
          </label>
          <input
            type="text"
            id="aufmasser"
            value={formData.aufmasser}
            onChange={(e) => updateField('aufmasser', e.target.value)}
            placeholder="Name des Aufmassers"
            required
          />
        </motion.div>

        <motion.div
          className="form-group"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.3 }}
        >
          <label htmlFor="montageteam">
            Montageteam <span className="required">*</span>
          </label>
          <select
            id="montageteam"
            value={formData.montageteam}
            onChange={(e) => updateField('montageteam', e.target.value)}
            required
          >
            <option value="">Bitte wählen...</option>
            {montageteams.map((team) => (
              <option key={team} value={team}>
                {team}
              </option>
            ))}
          </select>
        </motion.div>

        <motion.div
          className="form-group"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.4 }}
        >
          <label htmlFor="kundeVorname">
            Kunde Vorname <span className="required">*</span>
          </label>
          <input
            type="text"
            id="kundeVorname"
            value={formData.kundeVorname}
            onChange={(e) => updateField('kundeVorname', e.target.value)}
            placeholder="Vorname"
            required
          />
        </motion.div>

        <motion.div
          className="form-group"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.5 }}
        >
          <label htmlFor="kundeNachname">
            Kunde Nachname <span className="required">*</span>
          </label>
          <input
            type="text"
            id="kundeNachname"
            value={formData.kundeNachname}
            onChange={(e) => updateField('kundeNachname', e.target.value)}
            placeholder="Nachname"
            required
          />
        </motion.div>

        <motion.div
          className="form-group full-width"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.6 }}
        >
          <label htmlFor="kundenlokation">
            Kundenlokation / Adresse
          </label>
          <input
            type="text"
            id="kundenlokation"
            value={formData.kundenlokation}
            onChange={(e) => updateField('kundenlokation', e.target.value)}
            placeholder="Adresse oder Standort"
          />
        </motion.div>
      </div>
    </div>
  );
};

export default GrunddatenSection;
