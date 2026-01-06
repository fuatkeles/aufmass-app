import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AufmassForm } from '../App';
import { FormData } from '../types';
import { DynamicFormData } from '../types/productConfig';
import { getForm, createForm, updateForm, uploadImages, savePdf, FormData as ApiFormData } from '../services/api';
import { generatePDF } from '../utils/pdfGenerator';

const FormPage = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [initialData, setInitialData] = useState<FormData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formStatus, setFormStatus] = useState<string>('neu');

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
      alert('Fehler beim Aktualisieren des Status');
    }
  };

  useEffect(() => {
    const loadForm = async () => {
      if (id === 'new') {
        setInitialData(null);
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
      const apiData: Omit<ApiFormData, 'id'> = {
        datum: data.datum,
        aufmasser: data.aufmasser,
        kundeVorname: data.kundeVorname,
        kundeNachname: data.kundeNachname,
        kundeEmail: data.kundeEmail || '',
        kundenlokation: data.kundenlokation,
        category: data.productSelection?.category || '',
        productType: data.productSelection?.productType || '',
        model: Array.isArray(data.productSelection?.model)
          ? JSON.stringify(data.productSelection.model)
          : (data.productSelection?.model || ''),
        specifications: data.specifications || {},
        markiseData: (data.specifications as Record<string, unknown>)?.markiseData,
        weitereProdukte: data.weitereProdukte || [],
        bemerkungen: data.bemerkungen || '',
        status: 'neu'
      };

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

      // Generate and save PDF - use data with updated id
      try {
        const dataWithId = { ...data, id: String(formId) };
        const pdfResult = await generatePDF(dataWithId, { returnBlob: true });
        if (pdfResult?.blob) {
          await savePdf(formId, pdfResult.blob);
          console.log('PDF generated and saved successfully');
        }
      } catch (pdfError) {
        console.error('Error generating/saving PDF:', pdfError);
        // Don't block form save if PDF generation fails
      }

      // Return formId for new forms so App.tsx can update state
      return formId;
    } catch (err) {
      console.error('Error saving form:', err);
      alert('Fehler beim Speichern. Bitte versuchen Sie es erneut.');
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
