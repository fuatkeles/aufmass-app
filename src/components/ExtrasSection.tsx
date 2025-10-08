import { motion } from 'framer-motion';
import { FormData } from '../types';
import './ExtrasSection.css';

interface ExtrasSectionProps {
  formData: FormData;
  updateFormData: (field: string, value: any) => void;
  updateNestedData: (section: string, field: string, value: any) => void;
}

const ExtrasSection = ({ formData, updateNestedData }: ExtrasSectionProps) => {
  const toggleWasserablauf = (value: string) => {
    const current = formData.extras.wasserablauf || [];
    const newValue = current.includes(value)
      ? current.filter(v => v !== value)
      : [...current, value];
    updateNestedData('extras', 'wasserablauf', newValue);
  };

  return (
    <div className="extras-section">
      <motion.div
        className="section-header"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
      >
        <h2>Extras</h2>
        <p className="section-description">Zusätzliche Optionen und Spezifikationen</p>
      </motion.div>

      <div className="extras-grid">
        <motion.div
          className="extras-group"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <h3>Statikträger</h3>
          <div className="radio-group horizontal">
            <label className="radio-option">
              <input
                type="radio"
                name="statiktrager"
                value="ja"
                checked={formData.extras.statiktrager === 'ja'}
                onChange={(e) => updateNestedData('extras', 'statiktrager', e.target.value)}
              />
              <span>Ja</span>
            </label>
            <label className="radio-option">
              <input
                type="radio"
                name="statiktrager"
                value="nein"
                checked={formData.extras.statiktrager === 'nein'}
                onChange={(e) => updateNestedData('extras', 'statiktrager', e.target.value)}
              />
              <span>Nein</span>
            </label>
          </div>
        </motion.div>

        <motion.div
          className="extras-group"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <h3>Freistehend</h3>
          <div className="radio-group horizontal">
            <label className="radio-option">
              <input
                type="radio"
                name="freistehend"
                value="ja"
                checked={formData.extras.freistehend === 'ja'}
                onChange={(e) => updateNestedData('extras', 'freistehend', e.target.value)}
              />
              <span>Ja</span>
            </label>
            <label className="radio-option">
              <input
                type="radio"
                name="freistehend"
                value="nein"
                checked={formData.extras.freistehend === 'nein'}
                onChange={(e) => updateNestedData('extras', 'freistehend', e.target.value)}
              />
              <span>Nein</span>
            </label>
          </div>
        </motion.div>

        <motion.div
          className="extras-group"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          <h3>LED-Beleuchtung</h3>
          <div className="radio-group horizontal">
            <label className="radio-option">
              <input
                type="radio"
                name="ledBeleuchtung"
                value="1R"
                checked={formData.extras.ledBeleuchtung === '1R'}
                onChange={(e) => updateNestedData('extras', 'ledBeleuchtung', e.target.value)}
              />
              <span>1 R.</span>
            </label>
            <label className="radio-option">
              <input
                type="radio"
                name="ledBeleuchtung"
                value="2R"
                checked={formData.extras.ledBeleuchtung === '2R'}
                onChange={(e) => updateNestedData('extras', 'ledBeleuchtung', e.target.value)}
              />
              <span>2 R.</span>
            </label>
          </div>
        </motion.div>

        <motion.div
          className="extras-group"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
        >
          <h3>Fundament</h3>
          <div className="radio-group horizontal">
            <label className="radio-option">
              <input
                type="radio"
                name="fundament"
                value="aylux"
                checked={formData.extras.fundament === 'aylux'}
                onChange={(e) => updateNestedData('extras', 'fundament', e.target.value)}
              />
              <span>Aylux</span>
            </label>
            <label className="radio-option">
              <input
                type="radio"
                name="fundament"
                value="kunde"
                checked={formData.extras.fundament === 'kunde'}
                onChange={(e) => updateNestedData('extras', 'fundament', e.target.value)}
              />
              <span>Kunde</span>
            </label>
          </div>
        </motion.div>

        <motion.div
          className="extras-group full-width"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.5 }}
        >
          <h3>Wasserablauf</h3>
          <div className="checkbox-group horizontal">
            <label className="checkbox-option">
              <input
                type="checkbox"
                checked={formData.extras.wasserablauf?.includes('L')}
                onChange={() => toggleWasserablauf('L')}
              />
              <span>L</span>
            </label>
            <label className="checkbox-option">
              <input
                type="checkbox"
                checked={formData.extras.wasserablauf?.includes('M')}
                onChange={() => toggleWasserablauf('M')}
              />
              <span>M</span>
            </label>
            <label className="checkbox-option">
              <input
                type="checkbox"
                checked={formData.extras.wasserablauf?.includes('R')}
                onChange={() => toggleWasserablauf('R')}
              />
              <span>R</span>
            </label>
            <label className="checkbox-option">
              <input
                type="checkbox"
                checked={formData.extras.wasserablauf?.includes('bauseits')}
                onChange={() => toggleWasserablauf('bauseits')}
              />
              <span>Bauseits durch Auftraggeber</span>
            </label>
          </div>
        </motion.div>

        <motion.div
          className="extras-group full-width"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.6 }}
        >
          <h3>Bauform</h3>
          <div className="input-group">
            <label className="checkbox-option inline">
              <input
                type="checkbox"
                checked={formData.extras.bauform === 'bundig'}
                onChange={(e) => updateNestedData('extras', 'bauform', e.target.checked ? 'bundig' : '')}
              />
              <span>Bündig</span>
            </label>
            <input
              type="text"
              placeholder="Überstand eingeben"
              value={formData.extras.bauform !== 'bundig' ? formData.extras.bauform : ''}
              onChange={(e) => updateNestedData('extras', 'bauform', e.target.value)}
              disabled={formData.extras.bauform === 'bundig'}
            />
          </div>
        </motion.div>

        <motion.div
          className="extras-group full-width"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.7 }}
        >
          <h3>Stützen</h3>
          <div className="input-group">
            <label className="checkbox-option inline">
              <input
                type="checkbox"
                checked={formData.extras.stutzen === 'bundig'}
                onChange={(e) => updateNestedData('extras', 'stutzen', e.target.checked ? 'bundig' : '')}
              />
              <span>Bündig</span>
            </label>
            <input
              type="text"
              placeholder="Eingerückt eingeben"
              value={formData.extras.stutzen !== 'bundig' ? formData.extras.stutzen : ''}
              onChange={(e) => updateNestedData('extras', 'stutzen', e.target.value)}
              disabled={formData.extras.stutzen === 'bundig'}
            />
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default ExtrasSection;
