import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import './App.css';
import FormSection from './components/FormSection';
import ProductSection from './components/ProductSection';
import ExtrasSection from './components/ExtrasSection';
import BeschattungSection from './components/BeschattungSection';
import { FormData } from './types';
import { generatePDF } from './utils/pdfGenerator';

function App() {
  const [formData, setFormData] = useState<FormData>({
    aufmasser: '',
    montageteam: '',
    kunde: '',
    datum: '',
    anzahlStutzen: '',
    hoheStutzen: '',
    gestellfarbe: '',
    eindeckung: '8mm',
    produkte: [],
    extras: {
      statiktrager: '',
      freistehend: '',
      ledBeleuchtung: '',
      fundament: '',
      wasserablauf: [],
      bauform: '',
      stutzen: ''
    },
    beschattung: {
      ancUnterglas: false,
      ancAufglas: false,
      capri: false,
      markise: '',
      breite: '',
      tiefe: '',
      volanTyp: '',
      antrieb: '',
      antriebsseite: ''
    },
    zeichnung: ''
  });

  const [currentStep, setCurrentStep] = useState(0);

  const updateFormData = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const updateNestedData = (section: string, field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [section]: { ...prev[section as keyof FormData], [field]: value }
    }));
  };

  const steps = [
    { title: 'Grunddaten', component: FormSection },
    { title: 'Produkte', component: ProductSection },
    { title: 'Extras', component: ExtrasSection },
    { title: 'Beschattung', component: BeschattungSection }
  ];

  const StepComponent = steps[currentStep].component;

  const nextStep = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleExport = () => {
    generatePDF(formData);
  };

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="header-content">
          <div className="logo-section">
            <motion.div
              className="logo"
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <span className="logo-text">AYLUX</span>
              <span className="logo-subtitle">SONNENSCHUTZSYSTEME</span>
            </motion.div>
          </div>
          <motion.h1
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            AUFMASS - DATENBLATT
          </motion.h1>
        </div>
      </header>

      <div className="progress-container">
        <div className="progress-steps">
          {steps.map((step, index) => (
            <motion.div
              key={index}
              className={`progress-step ${index === currentStep ? 'active' : ''} ${index < currentStep ? 'completed' : ''}`}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3, delay: index * 0.1 }}
            >
              <div className="step-number">{index + 1}</div>
              <div className="step-title">{step.title}</div>
            </motion.div>
          ))}
        </div>
        <div className="progress-bar">
          <motion.div
            className="progress-fill"
            initial={{ width: '0%' }}
            animate={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
            transition={{ duration: 0.5 }}
          />
        </div>
      </div>

      <main className="main-content">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            transition={{ duration: 0.4 }}
            className="form-wrapper"
          >
            <StepComponent
              formData={formData}
              updateFormData={updateFormData}
              updateNestedData={updateNestedData}
            />
          </motion.div>
        </AnimatePresence>

        <div className="navigation-buttons">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="btn btn-secondary"
            onClick={prevStep}
            disabled={currentStep === 0}
          >
            ← Zurück
          </motion.button>

          {currentStep === steps.length - 1 ? (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="btn btn-export"
              onClick={handleExport}
            >
              PDF Exportieren
            </motion.button>
          ) : (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="btn btn-primary"
              onClick={nextStep}
            >
              Weiter →
            </motion.button>
          )}
        </div>
      </main>
    </div>
  );
}

export default App;
