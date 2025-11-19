import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import './App.css';
import GrunddatenSection from './components/GrunddatenSection';
import ProductSelectionSection from './components/ProductSelectionSection';
import DynamicSpecificationForm from './components/DynamicSpecificationForm';
import FinalSection from './components/FinalSection';
import StepIcon from './components/StepIcon';
import { FormData } from './types';
import { generatePDF } from './utils/pdfGenerator';

function App() {
  const [formData, setFormData] = useState<FormData>({
    datum: new Date().toISOString().split('T')[0],
    aufmasser: '',
    montageteam: '',
    kundeVorname: '',
    kundeNachname: '',
    kundenlokation: '',
    productSelection: {
      category: '',
      productType: '',
      model: ''
    },
    specifications: {},
    bilder: [],
    bemerkungen: ''
  });

  const [currentStep, setCurrentStep] = useState(0);

  // Update grunddaten fields
  const updateGrunddatenField = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // Update product selection
  const updateProductSelection = (field: 'category' | 'productType' | 'model', value: string) => {
    setFormData(prev => ({
      ...prev,
      productSelection: {
        ...prev.productSelection,
        [field]: value
      },
      // Reset specifications when product changes
      specifications: field === 'productType' || field === 'category' ? {} : prev.specifications
    }));
  };

  // Update specification field
  const updateSpecificationField = (fieldName: string, value: string | number | boolean) => {
    setFormData(prev => ({
      ...prev,
      specifications: {
        ...prev.specifications,
        [fieldName]: value
      }
    }));
  };

  // Update bemerkungen
  const updateBemerkungen = (value: string) => {
    setFormData(prev => ({ ...prev, bemerkungen: value }));
  };

  const steps = [
    {
      title: 'Grunddaten',
      icon: '1',
      component: GrunddatenSection,
      canProceed: () => {
        return formData.datum && formData.aufmasser && formData.montageteam &&
               formData.kundeVorname && formData.kundeNachname;
      }
    },
    {
      title: 'Produktauswahl',
      icon: '2',
      component: ProductSelectionSection,
      canProceed: () => {
        return formData.productSelection.category &&
               formData.productSelection.productType &&
               formData.productSelection.model;
      }
    },
    {
      title: 'Spezifikationen',
      icon: '3',
      component: DynamicSpecificationForm,
      canProceed: () => true // TODO: Add validation
    },
    {
      title: 'Abschluss',
      icon: '4',
      component: FinalSection,
      canProceed: () => true
    }
  ];

  const currentStepInfo = steps[currentStep];

  const nextStep = () => {
    if (currentStep < steps.length - 1 && currentStepInfo.canProceed()) {
      setCurrentStep(currentStep + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleExport = () => {
    generatePDF(formData);
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return (
          <GrunddatenSection
            formData={{
              datum: formData.datum,
              aufmasser: formData.aufmasser,
              montageteam: formData.montageteam,
              kundeVorname: formData.kundeVorname,
              kundeNachname: formData.kundeNachname,
              kundenlokation: formData.kundenlokation
            }}
            updateField={updateGrunddatenField}
          />
        );
      case 1:
        return (
          <ProductSelectionSection
            selection={formData.productSelection}
            updateSelection={updateProductSelection}
          />
        );
      case 2:
        return (
          <DynamicSpecificationForm
            category={formData.productSelection.category}
            productType={formData.productSelection.productType}
            model={formData.productSelection.model}
            formData={formData.specifications}
            updateField={updateSpecificationField}
          />
        );
      case 3:
        return (
          <FinalSection
            bemerkungen={formData.bemerkungen}
            updateBemerkungen={updateBemerkungen}
            onExport={handleExport}
          />
        );
      default:
        return null;
    }
  };

  const canProceed = currentStepInfo.canProceed();

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

      {/* Progress indicator */}
      <div className="progress-container">
        <div className="progress-steps">
          {steps.map((step, index) => (
            <motion.div
              key={index}
              className={`progress-step ${index === currentStep ? 'active' : ''} ${index < currentStep ? 'completed' : ''}`}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3, delay: index * 0.1 }}
              onClick={() => {
                if (index < currentStep) {
                  setCurrentStep(index);
                }
              }}
              style={{ cursor: index < currentStep ? 'pointer' : 'default' }}
            >
              <div className="step-number">
                <StepIcon step={index + 1} />
              </div>
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
            {renderStepContent()}
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

          {currentStep < steps.length - 1 && (
            <motion.button
              whileHover={canProceed ? { scale: 1.05 } : {}}
              whileTap={canProceed ? { scale: 0.95 } : {}}
              className={`btn btn-primary ${!canProceed ? 'disabled' : ''}`}
              onClick={nextStep}
              disabled={!canProceed}
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
