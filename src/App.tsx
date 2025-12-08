import { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import './App.css';
import GrunddatenSection from './components/GrunddatenSection';
import ProductSelectionSection from './components/ProductSelectionSection';
import DynamicSpecificationForm from './components/DynamicSpecificationForm';
import MarkiseStep from './components/MarkiseStep';
import type { MarkiseData } from './components/MarkiseStep';
import UnterbauelementeStep from './components/UnterbauelementeStep';
import type { UnterbauelementData } from './components/UnterbauelementeStep';
import FinalSection from './components/FinalSection';
import StepIcon from './components/StepIcon';
import { FormData, ServerImage, WeiteresProdukt } from './types';
import { generatePDF } from './utils/pdfGenerator';
import productConfigData from './config/productConfig.json';
import { getStoredUser } from './services/api';

// Status options for breadcrumb - matches Dashboard STATUS_OPTIONS
const STATUS_STEPS = [
  { value: 'neu', label: 'Aufmaß Genommen', color: '#8b5cf6' },
  { value: 'auftrag_erteilt', label: 'Auftrag Erteilt', color: '#3b82f6' },
  { value: 'anzahlung', label: 'Anzahlung Erhalten', color: '#06b6d4' },
  { value: 'bestellt', label: 'Bestellt', color: '#f59e0b' },
  { value: 'montage_geplant', label: 'Montage Geplant', color: '#a855f7' },
  { value: 'montage_gestartet', label: 'Montage Gestartet', color: '#ec4899' },
  { value: 'abnahme', label: 'Abnahme', color: '#10b981' },
  { value: 'reklamation', label: 'Reklamation', color: '#ef4444' },
];

const isAdmin = () => {
  const user = getStoredUser();
  return user?.role === 'admin';
};

interface AufmassFormProps {
  initialData?: FormData | null;
  onSave?: (data: FormData) => void;
  onCancel?: () => void;
  formStatus?: string;
  onStatusChange?: (status: string) => void;
  isExistingForm?: boolean;
}

function AufmassForm({ initialData, onSave, onCancel, formStatus, onStatusChange, isExistingForm }: AufmassFormProps) {
  const [formData, setFormData] = useState<FormData>(initialData || {
    datum: new Date().toISOString().split('T')[0],
    aufmasser: '',
    kundeVorname: '',
    kundeNachname: '',
    kundeEmail: '',
    kundenlokation: '',
    productSelection: {
      category: '',
      productType: '',
      model: []
    },
    specifications: {},
    weitereProdukte: [],
    bilder: [],
    bemerkungen: ''
  });

  const [currentStep, setCurrentStep] = useState(0);

  // Check if Markise is active
  const hasMarkise = formData.specifications?.markiseActive === true;

  // Check if category is UNTERBAUELEMENTE
  const isUnterbauelemente = formData.productSelection.category === 'UNTERBAUELEMENTE';

  // Type for product config
  interface ProductConfig {
    [category: string]: {
      [productType: string]: {
        models: string[];
        fields: { name: string; required: boolean; type: string; allowZero?: boolean }[];
      };
    };
  }
  const productConfig = productConfigData as ProductConfig;

  // Check if all required specification fields are filled
  const checkSpecificationsValid = useCallback(() => {
    const { category, productType } = formData.productSelection;
    if (!category || !productType) return false;

    const productTypeConfig = productConfig[category]?.[productType];
    if (!productTypeConfig?.fields) return true;

    const requiredFields = productTypeConfig.fields.filter(f => f.required);

    for (const field of requiredFields) {
      const value = formData.specifications[field.name];

      // Skip markise_trigger field - it's handled separately
      if (field.type === 'markise_trigger') continue;

      // Handle conditional fields (ja_nein_with_value type like Überstand, Dämmung)
      if (field.type === 'conditional') {
        const activeValue = formData.specifications[`${field.name}Active`];
        // Must have selected Ja or Nein (activeValue must be boolean)
        if (activeValue === undefined) return false;
        // If Ja is selected, the value field must have a value
        if (activeValue === true) {
          // For fields that allow zero (like Dämmung), check if value is a number (including 0)
          const allowZero = field.allowZero === true;
          if (allowZero) {
            // Value must be a number (0 is allowed)
            if (value === undefined || value === null || value === '' || typeof value !== 'number') return false;
          } else {
            // Value must be > 0
            if (!value || (typeof value === 'number' && value <= 0)) return false;
          }
        }
        continue;
      }

      // Handle bauform field
      if (field.type === 'bauform') {
        const bauformType = formData.specifications['bauformType'];
        // Must have selected BUNDIG or EINGERUCKT
        if (!bauformType) return false;
        // If EINGERUCKT, at least one side must be active with value
        if (bauformType === 'EINGERUCKT') {
          const linksActive = formData.specifications['bauformLinksActive'];
          const rechtsActive = formData.specifications['bauformRechtsActive'];
          const linksValue = formData.specifications['bauformLinksValue'];
          const rechtsValue = formData.specifications['bauformRechtsValue'];
          // At least one side must be selected
          if (!linksActive && !rechtsActive) return false;
          // If a side is active, it must have a value
          if (linksActive && (!linksValue || Number(linksValue) <= 0)) return false;
          if (rechtsActive && (!rechtsValue || Number(rechtsValue) <= 0)) return false;
        }
        continue;
      }

      // Handle fundament field
      if (field.type === 'fundament') {
        // Just need to have selected an option (Aylux or Kunde)
        if (!value) return false;
        continue;
      }

      // Handle multiselect fields (arrays)
      if (field.type === 'multiselect') {
        if (!Array.isArray(value) || value.length === 0) return false;
        continue;
      }

      // Check if value exists and is not empty
      if (value === undefined || value === null || value === '') {
        return false;
      }

      // For number fields, check if it's a valid number > 0
      if (field.type === 'number' && (typeof value !== 'number' || value <= 0)) {
        return false;
      }
    }

    return true;
  }, [formData.productSelection, formData.specifications, productConfig]);

  // Update grunddaten fields
  const updateGrunddatenField = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // Update product selection
  const updateProductSelection = (field: 'category' | 'productType' | 'model', value: string | string[]) => {
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

  // Update markise data (supports both single and array)
  const updateMarkiseData = (data: MarkiseData | MarkiseData[]) => {
    setFormData(prev => ({
      ...prev,
      specifications: {
        ...prev.specifications,
        markiseData: JSON.stringify(data)
      }
    }));
  };

  // Update markise bemerkungen
  const updateMarkiseBemerkungen = (value: string) => {
    setFormData(prev => ({
      ...prev,
      specifications: {
        ...prev.specifications,
        markiseBemerkungen: value
      }
    }));
  };

  // Update unterbauelemente data
  const updateUnterbauelemente = (data: UnterbauelementData[]) => {
    setFormData(prev => ({
      ...prev,
      specifications: {
        ...prev.specifications,
        unterbauelementeData: JSON.stringify(data)
      }
    }));
  };

  // Update unterbauelemente bemerkungen
  const updateUnterbauelementeBemerkungen = (value: string) => {
    setFormData(prev => ({
      ...prev,
      specifications: {
        ...prev.specifications,
        unterbauelementeBemerkungen: value
      }
    }));
  };

  // Update weitere produkte
  const updateWeitereProdukte = (data: WeiteresProdukt[]) => {
    setFormData(prev => ({
      ...prev,
      weitereProdukte: data
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

  // Dynamic steps based on category and Markise selection
  const steps = useMemo(() => {
    const baseSteps: { id: string; title: string; icon: string; canProceed: () => boolean }[] = [
      {
        id: 'grunddaten',
        title: 'Grunddaten',
        icon: '1',
        canProceed: () => {
          return !!(formData.datum && formData.aufmasser &&
                 formData.kundeVorname && formData.kundeNachname && formData.kundenlokation);
        }
      },
      {
        id: 'produktauswahl',
        title: 'Produktauswahl',
        icon: '2',
        canProceed: () => {
          const models = formData.productSelection.model;
          const hasModels = Array.isArray(models) ? models.length > 0 : !!models;
          return !!(formData.productSelection.category &&
                 formData.productSelection.productType &&
                 hasModels);
        }
      }
    ];

    // For UNTERBAUELEMENTE, add a special step for multi-element selection
    if (isUnterbauelemente) {
      baseSteps.push({
        id: 'unterbauelemente',
        title: 'Unterbauelemente',
        icon: '3',
        canProceed: () => {
          const dataStr = formData.specifications?.unterbauelementeData as string;
          if (!dataStr) return false;
          try {
            const elements = JSON.parse(dataStr) as UnterbauelementData[];
            if (!Array.isArray(elements) || elements.length === 0) return false;

            // Validate each element has required fields
            return elements.every((el: UnterbauelementData) => {
              if (!el.produktTyp || !el.modell || !el.gestellfarbe || !el.position) return false;

              // Type-specific validation
              if (el.produktTyp === 'Keil') {
                if (!el.laenge || !el.hintenHoehe || !el.vorneHoehe) return false;
              } else if (el.produktTyp === 'Festes Element') {
                // Festes Element has conditional fields based on elementForm
                if (!el.breite || !el.elementForm) return false;
                if (el.elementForm === 'Rechteck' && !el.hoehe) return false;
                if (el.elementForm === 'Trapez' && (!el.hintenHoehe || !el.vorneHoehe)) return false;
              } else {
                if (!el.breite || !el.hoehe) return false;
              }

              // GG Schiebe and Rahmen Schiebe need extra fields
              if (el.produktTyp === 'GG Schiebe Element' || el.produktTyp === 'Rahmen Schiebe Element') {
                if (!el.oeffnungsrichtung || !el.anzahlFluegel) return false;
              }

              // Fundament check (except Keil which doesn't have it)
              if (el.produktTyp !== 'Keil' && !el.fundament) return false;

              return true;
            });
          } catch {
            return false;
          }
        }
      });
    } else {
      // Normal specification step for other categories
      baseSteps.push({
        id: 'spezifikationen',
        title: 'Spezifikationen',
        icon: '3',
        canProceed: () => checkSpecificationsValid()
      });
    }

    // Add Markise step if markiseActive is true
    if (hasMarkise) {
      baseSteps.push({
        id: 'markise',
        title: 'Markise',
        icon: String(baseSteps.length + 1),
        canProceed: () => {
          const markiseDataStr = formData.specifications?.markiseData as string;
          if (!markiseDataStr) return false;
          try {
            const parsed = JSON.parse(markiseDataStr);
            // Support both single object (legacy) and array format
            const markisen = Array.isArray(parsed) ? parsed : [parsed];
            if (markisen.length === 0) return false;

            // Validate each markise has required fields
            return markisen.every((data: MarkiseData) => {
              // Base required fields
              if (!data.typ || !data.modell || !data.breite || !data.laenge ||
                  !data.stoffNummer || !data.gestellfarbe || !data.antrieb || !data.antriebsseite) {
                return false;
              }

              // Check type-specific fields
              const markiseTypes: Record<string, { showHeight?: boolean; showPosition?: boolean; showZip?: boolean; showVolanTyp?: boolean; befestigungsOptions: string[] }> = {
                'AUFGLAS': { showZip: true, befestigungsOptions: [] },
                'UNTERGLAS': { showZip: true, befestigungsOptions: ['Innen Sparren', 'Unten Sparren'] },
                'SENKRECHT': { showHeight: true, showZip: true, showPosition: true, befestigungsOptions: ['Zwischen Pfosten', 'Vor Pfosten'] },
                'VOLKASSETTE': { showVolanTyp: true, befestigungsOptions: ['Wand', 'Decke', 'Untenbalkon'] },
                'HALBEKASSETTE': { showVolanTyp: true, befestigungsOptions: ['Wand', 'Decke', 'Untenbalkon'] }
              };

              const typeConfig = markiseTypes[data.typ];
              if (!typeConfig) return false;

              // Height (Bodenhöhe) is optional for SENKRECHT - no validation needed

              // Position required for SENKRECHT
              if (typeConfig.showPosition && !data.position) return false;

              // ZIP required for types that show it
              if (typeConfig.showZip && !data.zip) return false;

              // Volan Typ required for Volkassette/Halbekassette
              if (typeConfig.showVolanTyp && !data.volanTyp) return false;

              // Befestigungsart required if there are options
              if (typeConfig.befestigungsOptions.length > 0 && !data.befestigungsart) return false;

              return true;
            });
          } catch {
            return false;
          }
        }
      });
    }

    // Add Abschluss step - icon depends on number of steps
    const abschlussIcon = String(baseSteps.length + 1);
    baseSteps.push({
      id: 'abschluss',
      title: 'Abschluss',
      icon: abschlussIcon,
      canProceed: () => (formData.bilder as File[]).length >= 2
    });

    return baseSteps;
  }, [formData, hasMarkise, isUnterbauelemente, checkSpecificationsValid]);

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

  // Sadece PDF indir, kaydetme
  const handleExport = async () => {
    await generatePDF(formData);
  };

  const handleSaveOnly = async () => {
    if (onSave) {
      onSave(formData);
    }
  };

  const handleNewForm = () => {
    // Reset form to initial state
    setFormData({
      datum: new Date().toISOString().split('T')[0],
      aufmasser: '',
      kundeVorname: '',
      kundeNachname: '',
      kundenlokation: '',
      productSelection: {
        category: '',
        productType: '',
        model: []
      },
      specifications: {},
      weitereProdukte: [],
      bilder: [],
      bemerkungen: ''
    });
    setCurrentStep(0);
    window.scrollTo({ top: 0, behavior: 'smooth' });
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
              kundeEmail: formData.kundeEmail,
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
            weitereProdukte={formData.weitereProdukte || []}
            updateWeitereProdukte={updateWeitereProdukte}
          />
        );
      case 'unterbauelemente':
        const unterbauelementeDataStr = formData.specifications?.unterbauelementeData as string;
        let unterbauelementeData: UnterbauelementData[] = [];
        if (unterbauelementeDataStr) {
          try {
            unterbauelementeData = JSON.parse(unterbauelementeDataStr);
          } catch {
            unterbauelementeData = [];
          }
        }
        const unterbauelementeBemerkungen = (formData.specifications?.unterbauelementeBemerkungen as string) || '';
        return (
          <UnterbauelementeStep
            unterbauelemente={unterbauelementeData}
            updateUnterbauelemente={updateUnterbauelemente}
            bemerkungen={unterbauelementeBemerkungen}
            updateBemerkungen={updateUnterbauelementeBemerkungen}
            initialProduktTyp={formData.productSelection.productType}
            initialModell={Array.isArray(formData.productSelection.model) ? formData.productSelection.model[0] : formData.productSelection.model}
            weitereProdukte={formData.weitereProdukte || []}
            updateWeitereProdukte={updateWeitereProdukte}
          />
        );
      case 'markise':
        const markiseDataStr = formData.specifications?.markiseData as string;
        let markiseData: MarkiseData | MarkiseData[] | null = null;
        if (markiseDataStr) {
          try {
            markiseData = JSON.parse(markiseDataStr);
          } catch {
            markiseData = null;
          }
        }
        const markiseBemerkungen = (formData.specifications?.markiseBemerkungen as string) || '';
        return (
          <MarkiseStep
            markiseData={markiseData}
            updateMarkiseData={updateMarkiseData}
            markiseBemerkungen={markiseBemerkungen}
            updateMarkiseBemerkungen={updateMarkiseBemerkungen}
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
            onSave={handleSaveOnly}
            onNewForm={handleNewForm}
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
            {/* Status Breadcrumb - inside form card, only for admin and existing forms */}
            {isAdmin() && isExistingForm && formStatus && onStatusChange && (
              <div className="status-breadcrumb-inner">
                {STATUS_STEPS.map((step) => {
                  const isActive = step.value === formStatus;
                  const currentIndex = STATUS_STEPS.findIndex(s => s.value === formStatus);
                  const stepIndex = STATUS_STEPS.findIndex(s => s.value === step.value);
                  const isPast = stepIndex < currentIndex;

                  return (
                    <button
                      key={step.value}
                      className={`breadcrumb-step-inner ${isActive ? 'active' : ''} ${isPast ? 'past' : ''}`}
                      style={{ '--step-color': step.color } as React.CSSProperties}
                      onClick={() => onStatusChange(step.value)}
                    >
                      <span
                        className="step-dot-inner"
                        style={{
                          backgroundColor: isActive || isPast ? step.color : 'transparent',
                          borderColor: step.color
                        }}
                      />
                      <span className="step-text-inner">{step.label}</span>
                    </button>
                  );
                })}
              </div>
            )}
            {renderStepContent()}

            {/* Powered by Conais - inside form card */}
            <div className="powered-by-form">
              <span>Powered by</span>
              <a href="https://conais.com" target="_blank" rel="noopener noreferrer">
                <img src="https://conais.in/dev/wp-content/uploads/2020/10/logo2.png" alt="Conais" className="conais-logo" />
              </a>
            </div>
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
