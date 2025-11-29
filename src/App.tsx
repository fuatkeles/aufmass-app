import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import './App.css';
import GrunddatenSection from './components/GrunddatenSection';
import ProductSelectionSection from './components/ProductSelectionSection';
import DynamicSpecificationForm from './components/DynamicSpecificationForm';
import MarkiseStep from './components/MarkiseStep';
import type { MarkiseData } from './components/MarkiseStep';
import FinalSection from './components/FinalSection';
import StepIcon from './components/StepIcon';
import { FormData, ServerImage } from './types';
import { generatePDF } from './utils/pdfGenerator';

interface AufmassFormProps {
  initialData?: FormData | null;
  onSave?: (data: FormData) => void;
  onCancel?: () => void;
}

function AufmassForm({ initialData, onSave, onCancel }: AufmassFormProps) {
  const [formData, setFormData] = useState<FormData>(initialData || {
    datum: new Date().toISOString().split('T')[0],
    aufmasser: '',
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

  // Check if Markise is active
  const hasMarkise = formData.specifications?.markiseActive === true;

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
  const updateSpecificationField = (fieldName: string, value: string | number | boolean | string[]) => {
    setFormData(prev => ({
      ...prev,
      specifications: {
        ...prev.specifications,
        [fieldName]: value
      }
    }));
  };

  // Update markise data
  const updateMarkiseData = (data: MarkiseData) => {
    setFormData(prev => ({
      ...prev,
      specifications: {
        ...prev.specifications,
        markiseData: JSON.stringify(data)
      }
    }));
  };

  // Update bemerkungen
  const updateBemerkungen = (value: string) => {
    setFormData(prev => ({ ...prev, bemerkungen: value }));
  };

  // Update bilder
  const updateBilder = (files: (File | ServerImage)[]) => {
    setFormData(prev => ({ ...prev, bilder: files }));
  };

  // Dynamic steps based on whether Markise is selected
  const steps = useMemo(() => {
    const baseSteps = [
      {
        id: 'grunddaten',
        title: 'Grunddaten',
        icon: '1',
        canProceed: () => {
          return formData.datum && formData.aufmasser &&
                 formData.kundeVorname && formData.kundeNachname && formData.kundenlokation;
        }
      },
      {
        id: 'produktauswahl',
        title: 'Produktauswahl',
        icon: '2',
        canProceed: () => {
          return formData.productSelection.category &&
                 formData.productSelection.productType &&
                 formData.productSelection.model;
        }
      },
      {
        id: 'spezifikationen',
        title: 'Spezifikationen',
        icon: '3',
        canProceed: () => true
      }
    ];

    // Add Markise step if markiseActive is true
    if (hasMarkise) {
      baseSteps.push({
        id: 'markise',
        title: 'Markise',
        icon: '4',
        canProceed: () => {
          const markiseDataStr = formData.specifications?.markiseData as string;
          if (!markiseDataStr) return false;
          try {
            const data = JSON.parse(markiseDataStr) as MarkiseData;
            return !!(data.typ && data.modell && data.breite && data.laenge &&
                     data.stoffNummer && data.gestellfarbe && data.antrieb && data.antriebsseite);
          } catch {
            return false;
          }
        }
      });
    }

    // Add Abschluss step
    baseSteps.push({
      id: 'abschluss',
      title: 'Abschluss',
      icon: hasMarkise ? '5' : '4',
      canProceed: () => (formData.bilder as File[]).length >= 2
    });

    return baseSteps;
  }, [formData, hasMarkise]);

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

  const handleExport = async () => {
    await generatePDF(formData);
    if (onSave) {
      onSave(formData);
    }
  };

  const renderStepContent = () => {
    const stepId = currentStepInfo.id;

    switch (stepId) {
      case 'grunddaten':
        return (
          <GrunddatenSection
            formData={{
              datum: formData.datum,
              aufmasser: formData.aufmasser,
              kundeVorname: formData.kundeVorname,
              kundeNachname: formData.kundeNachname,
              kundenlokation: formData.kundenlokation
            }}
            updateField={updateGrunddatenField}
          />
        );
      case 'produktauswahl':
        return (
          <ProductSelectionSection
            selection={formData.productSelection}
            updateSelection={updateProductSelection}
          />
        );
      case 'spezifikationen':
        return (
          <DynamicSpecificationForm
            category={formData.productSelection.category}
            productType={formData.productSelection.productType}
            model={formData.productSelection.model}
            formData={formData.specifications}
            updateField={updateSpecificationField}
          />
        );
      case 'markise':
        const markiseDataStr = formData.specifications?.markiseData as string;
        let markiseData: MarkiseData | null = null;
        if (markiseDataStr) {
          try {
            markiseData = JSON.parse(markiseDataStr);
          } catch {
            markiseData = null;
          }
        }
        return (
          <MarkiseStep
            markiseData={markiseData}
            updateMarkiseData={updateMarkiseData}
          />
        );
      case 'abschluss':
        return (
          <FinalSection
            bemerkungen={formData.bemerkungen}
            bilder={formData.bilder}
            updateBemerkungen={updateBemerkungen}
            updateBilder={updateBilder}
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
              key={step.id}
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
            key={currentStepInfo.id}
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
          {onCancel && currentStep === 0 && (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="btn btn-secondary"
              onClick={onCancel}
            >
              Abbrechen
            </motion.button>
          )}

          {(currentStep > 0 || !onCancel) && (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="btn btn-secondary"
              onClick={prevStep}
              disabled={currentStep === 0}
            >
              Zurück
            </motion.button>
          )}

          {currentStep < steps.length - 1 && (
            <motion.button
              whileHover={canProceed ? { scale: 1.05 } : {}}
              whileTap={canProceed ? { scale: 0.95 } : {}}
              className={`btn btn-primary ${!canProceed ? 'disabled' : ''}`}
              onClick={nextStep}
              disabled={!canProceed}
            >
              Weiter
            </motion.button>
          )}
        </div>
      </main>
    </div>
  );
}

export default AufmassForm;
export { AufmassForm };
