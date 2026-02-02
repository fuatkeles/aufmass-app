import { useState, useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { AufmassForm } from '../App';
import { FormData } from '../types';
import { DynamicFormData } from '../types/productConfig';
import { getForm, createForm, updateForm, uploadImages, savePdf, updateLeadStatus, FormData as ApiFormData } from '../services/api';
import { generatePDF } from '../utils/pdfGenerator';
import { useToast } from '../components/Toast';

interface LeadItem {
  id: number;
  product_name: string;
  breite: number;
  tiefe: number;
  quantity: number;
  unit_price: number;
  total_price: number;
}

interface LeadExtra {
  id: number;
  description: string;
  price: number;
}

interface LocationState {
  fromLead?: boolean;
  leadId?: number;
  kundeVorname?: string;
  kundeNachname?: string;
  kundeEmail?: string;
  kundeTelefon?: string;
  kundenlokation?: string;
  leadItems?: LeadItem[];
  leadExtras?: LeadExtra[];
  leadNotes?: string;
}

const FormPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams<{ id: string }>();
  const toast = useToast();
  const [initialData, setInitialData] = useState<FormData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formStatus, setFormStatus] = useState<string>('neu');

  // Get lead data from navigation state
  const leadState = location.state as LocationState | null;

  const handleStatusChange = async (newStatus: string) => {
    if (!id || id === 'new') return;
    try {
      // Check if status includes date (format: status_value:2025-12-15)
      if (newStatus.includes(':')) {
        const [status, datum] = newStatus.split(':');
        const updateData: { status: string; statusDate: string; montageDatum?: string } = {
          status,
          statusDate: datum
        };
        // Also update montageDatum for montage_geplant
        if (status === 'montage_geplant') {
          updateData.montageDatum = datum;
        }
        await updateForm(parseInt(id), updateData);
        setFormStatus(status);
      } else {
        await updateForm(parseInt(id), { status: newStatus });
        setFormStatus(newStatus);
      }
    } catch (err) {
      console.error('Error updating status:', err);
      toast.error('Fehler', 'Status konnte nicht aktualisiert werden.');
    }
  };

  useEffect(() => {
    const loadForm = async () => {
      if (id === 'new') {
        // Check if coming from lead with pre-filled data
        if (leadState?.fromLead) {
          // Map lead product to form product selection
          let productSelection = { category: '', productType: '', model: '' };
          let specifications: DynamicFormData = {};

          // Get first lead item for main product
          const firstItem = leadState.leadItems?.[0];
          if (firstItem) {
            // Map PREMIUMLINE product to form structure
            if (firstItem.product_name.toUpperCase().includes('PREMIUMLINE')) {
              productSelection = {
                category: 'ÜBERDACHUNG',
                productType: 'Glasdach',
                model: 'Premiumline'
              };
            }
            // Convert cm to mm for the form (form uses mm)
            specifications.breite = firstItem.breite * 10;
            specifications.tiefe = firstItem.tiefe * 10;
          }

          // Build weitereProdukte from additional lead items
          const weitereProdukte = (leadState.leadItems || []).slice(1).map((item, index) => {
            const wpSpecs: DynamicFormData = {
              breite: item.breite * 10,
              tiefe: item.tiefe * 10
            };
            return {
              id: `lead-wp-${index}`,
              category: 'ÜBERDACHUNG',
              productType: 'Glasdach',
              model: 'Premiumline',
              specifications: wpSpecs
            };
          });

          setInitialData({
            datum: new Date().toISOString().split('T')[0],
            aufmasser: '',
            kundeVorname: leadState.kundeVorname || '',
            kundeNachname: leadState.kundeNachname || '',
            kundeEmail: leadState.kundeEmail || '',
            kundeTelefon: leadState.kundeTelefon || '',
            kundenlokation: leadState.kundenlokation || '',
            productSelection,
            specifications,
            weitereProdukte,
            bilder: [],
            bemerkungen: leadState.leadNotes || ''
          });
        } else {
          setInitialData(null);
        }
        setLoading(false);
      } else if (id) {
        try {
          const formId = parseInt(id);
          const apiData = await getForm(formId);

          // Transform API data to local FormData format
          const formData: FormData = {
            id: String(apiData.id),
            datum: apiData.datum || '',
            aufmasser: apiData.aufmasser || '',
            kundeVorname: apiData.kundeVorname || '',
            kundeNachname: apiData.kundeNachname || '',
            kundeEmail: apiData.kundeEmail || '',
            kundenlokation: apiData.kundenlokation || '',
            productSelection: {
              category: apiData.category || '',
              productType: apiData.productType || '',
              model: apiData.model || ''
            },
            specifications: (apiData.specifications || {}) as DynamicFormData,
            weitereProdukte: apiData.weitereProdukte || [],
            bilder: apiData.bilder || [],
            bemerkungen: apiData.bemerkungen || '',
            status: (apiData.status as 'draft' | 'completed' | 'archived') || 'draft',
            createdAt: apiData.created_at,
            updatedAt: apiData.updated_at
          };

          setInitialData(formData);
          setFormStatus(apiData.status || 'neu');
        } catch (err) {
          console.error('Error loading form:', err);
          setError('Formular konnte nicht geladen werden.');
        }
        setLoading(false);
      }
    };

    loadForm();
  }, [id]);

  const handleSave = async (data: FormData): Promise<number | void> => {
    try {
      // Transform local FormData to API format
      const apiData: Omit<ApiFormData, 'id'> & { status?: string } = {
        datum: data.datum,
        aufmasser: data.aufmasser,
        kundeVorname: data.kundeVorname,
        kundeNachname: data.kundeNachname,
        kundeEmail: data.kundeEmail || '',
        kundeTelefon: data.kundeTelefon || '',
        kundenlokation: data.kundenlokation,
        category: data.productSelection?.category || '',
        productType: data.productSelection?.productType || '',
        model: Array.isArray(data.productSelection?.model)
          ? JSON.stringify(data.productSelection.model)
          : (data.productSelection?.model || ''),
        specifications: data.specifications || {},
        markiseData: (data.specifications as Record<string, unknown>)?.markiseData,
        weitereProdukte: data.weitereProdukte || [],
        bemerkungen: data.bemerkungen || ''
      };

      // Only set status to 'neu' for new forms, preserve existing status for updates
      if (id === 'new') {
        apiData.status = 'neu';
      }

      // Pass lead_id if creating from a lead
      if (id === 'new' && leadState?.fromLead && leadState?.leadId) {
        (apiData as Record<string, unknown>).leadId = leadState.leadId;
      }

      let formId: number;

      if (id === 'new') {
        // Create new form
        const result = await createForm(apiData);
        formId = result.id;
      } else {
        // Update existing form
        formId = parseInt(id!);
        await updateForm(formId, apiData);
      }

      // Upload new images if any
      const newImages = data.bilder?.filter(b => b instanceof File) as File[];
      if (newImages && newImages.length > 0) {
        await uploadImages(formId, newImages);
      }

      // If this form was created from a lead, update lead status
      if (id === 'new' && leadState?.fromLead && leadState?.leadId) {
        try {
          await updateLeadStatus(leadState.leadId, 'aufmass_erstellt');
        } catch (statusErr) {
          console.error('Failed to update lead status:', statusErr);
        }
      }

      // Generate and save PDF in background (don't block the save)
      const bgFormId = formId;
      (async () => {
        try {
          const freshData = await getForm(bgFormId);
          const pdfData = {
            id: String(freshData.id),
            datum: freshData.datum || '',
            aufmasser: freshData.aufmasser || '',
            kundeVorname: freshData.kundeVorname || '',
            kundeNachname: freshData.kundeNachname || '',
            kundeEmail: freshData.kundeEmail || '',
            kundeTelefon: freshData.kundeTelefon || '',
            kundenlokation: freshData.kundenlokation || '',
            productSelection: {
              category: freshData.category || '',
              productType: freshData.productType || '',
              model: freshData.model || ''
            },
            specifications: (freshData.specifications || {}) as Record<string, string | number | boolean | string[]>,
            weitereProdukte: freshData.weitereProdukte || [],
            bilder: freshData.bilder || [],
            bemerkungen: freshData.bemerkungen || '',
            status: (freshData.status as 'draft' | 'completed' | 'archived') || 'draft'
          };
          const pdfResult = await generatePDF(pdfData, { returnBlob: true });
          if (pdfResult?.blob) {
            await savePdf(bgFormId, pdfResult.blob);
            console.log('PDF generated and saved successfully');
          }
        } catch (pdfErr) {
          console.error('PDF generation failed:', pdfErr);
        }
      })();

      return formId;
    } catch (err) {
      console.error('Error saving form:', err);
      toast.error('Fehler', 'Formular konnte nicht gespeichert werden.');
    }
  };

  const handleCancel = () => {
    navigate('/');
  };

  if (loading) {
    return (
      <div className="loading-container" style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        background: 'var(--bg-primary)'
      }}>
        <div className="loading-spinner" style={{
          width: '48px',
          height: '48px',
          border: '4px solid var(--border-color)',
          borderTopColor: 'var(--primary-color)',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }}></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-container" style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        background: 'var(--bg-primary)',
        gap: '1rem'
      }}>
        <p style={{ color: 'var(--text-primary)' }}>{error}</p>
        <button
          onClick={() => navigate('/')}
          style={{
            padding: '0.75rem 1.5rem',
            background: 'var(--primary-color)',
            color: 'var(--bg-primary)',
            border: 'none',
            borderRadius: '10px',
            cursor: 'pointer'
          }}
        >
          Zurück zum Dashboard
        </button>
      </div>
    );
  }

  return (
    <AufmassForm
      initialData={initialData}
      onSave={handleSave}
      onCancel={handleCancel}
      formStatus={formStatus}
      onStatusChange={handleStatusChange}
      isExistingForm={id !== 'new'}
    />
  );
};

export default FormPage;
