import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import SignatureCanvas from '../components/SignatureCanvas';
import { useToast } from '../components/Toast';
import { getPublicAbnahmeSignRequest, submitPublicAbnahmeSignature, type PublicAbnahmeSignRequest } from '../services/api';
import { generatePDF } from '../utils/pdfGenerator';
import './AbnahmeSignPage.css';

const AbnahmeSignPage = () => {
  const { token } = useParams<{ token: string }>();
  const toast = useToast();
  const [request, setRequest] = useState<PublicAbnahmeSignRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [signerName, setSignerName] = useState('');
  const [signatureModalOpen, setSignatureModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [pdfGenerating, setPdfGenerating] = useState(false);

  useEffect(() => {
    const load = async () => {
      if (!token) {
        setError('Ungültiger Signaturlink.');
        setLoading(false);
        return;
      }

      try {
        const data = await getPublicAbnahmeSignRequest(token);
        setRequest(data);
        setSignerName(data.snapshot.abnahme.kundeName || `${data.snapshot.form.kundeVorname || ''} ${data.snapshot.form.kundeNachname || ''}`.trim());
        setSubmitted(data.status === 'signed');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Signaturlink konnte nicht geladen werden.');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [token]);

  const handleSubmit = async () => {
    if (!token || !signatureData || !signerName.trim()) {
      toast.warning('Unvollständig', 'Bitte Namen und Unterschrift erfassen.');
      return;
    }

    setSubmitting(true);
    try {
      await submitPublicAbnahmeSignature(token, {
        signerName: signerName.trim(),
        signatureData
      });
      setSubmitted(true);
      toast.success('Gespeichert', 'Die Abnahme wurde erfolgreich unterschrieben.');
    } catch (err) {
      toast.error('Fehler', err instanceof Error ? err.message : 'Unterschrift konnte nicht gespeichert werden.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDownloadPdf = async () => {
    if (!request) return;
    setPdfGenerating(true);
    try {
      const { form, abnahme, photos } = request.snapshot;

      // Build abnahme data with inline photos for PDF
      const abnahmeForPdf: Record<string, unknown> = {
        ...abnahme,
        signatureData: signatureData || abnahme.signatureData || null,
        kundeName: signerName || abnahme.kundeName,
        kundeUnterschrift: true,
        abnahmeDatum: abnahme.abnahmeDatum || new Date().toISOString(),
      };

      // Convert snapshot photos to maengelBilder format for PDF generator
      if (photos && photos.length > 0) {
        abnahmeForPdf.maengelBilderBase64 = photos;
      }

      const pdfData = {
        id: String(form.id),
        datum: form.datum || '',
        aufmasser: form.aufmasser || '',
        kundeVorname: form.kundeVorname || '',
        kundeNachname: form.kundeNachname || '',
        kundeEmail: form.kundeEmail || '',
        kundeTelefon: form.kundeTelefon || '',
        kundenlokation: form.kundenlokation || '',
        productSelection: {
          category: form.category || '',
          productType: form.productType || '',
          model: form.model || ''
        },
        specifications: {},
        bilder: [],
        bemerkungen: form.bemerkungen || '',
        status: 'abnahme' as const,
        abnahme: abnahmeForPdf
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await generatePDF(pdfData as any, { returnBlob: true, abnahmeOnly: true });
      if (result?.blob) {
        const link = document.createElement('a');
        link.href = URL.createObjectURL(result.blob);
        link.download = result.fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);
      }
    } catch (err) {
      console.error('PDF generation error:', err);
      toast.error('Fehler', 'PDF konnte nicht erstellt werden.');
    } finally {
      setPdfGenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="abnahme-sign-page">
        <div className="abnahme-sign-card">
          <div className="abnahme-loading">
            <div className="abnahme-spinner" />
            <p>Abnahme wird geladen...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !request) {
    return (
      <div className="abnahme-sign-page">
        <div className="abnahme-sign-card">
          <div className="abnahme-error-state">
            <div className="error-icon">!</div>
            <h1>Signaturlink nicht verfügbar</h1>
            <p>{error || 'Dieser Link ist ungültig.'}</p>
          </div>
        </div>
      </div>
    );
  }

  if (request.status === 'expired') {
    return (
      <div className="abnahme-sign-page">
        <div className="abnahme-sign-card">
          <div className="abnahme-error-state">
            <div className="error-icon expired-icon">&#8987;</div>
            <h1>Link abgelaufen</h1>
            <p>Bitte fordern Sie einen neuen Signaturlink an.</p>
          </div>
        </div>
      </div>
    );
  }

  const { form, abnahme, photos } = request.snapshot;

  return (
    <div className="abnahme-sign-page">
      <div className="abnahme-sign-card">
        {/* Header bar */}
        <div className="abnahme-sign-header">
          <div className="abnahme-logo-bar">
            <div className="abnahme-logo">
              <span className="logo-text">AYLUX</span>
              <span className="logo-sub">SONNENSCHUTZSYSTEME</span>
            </div>
          </div>
          <div className="header-info">
            <span className="eyebrow">Abnahmeprotokoll</span>
            <h1>Kundenbestätigung</h1>
            <p className="header-desc">Bitte prüfen Sie die Angaben und unterschreiben Sie anschließend.</p>
          </div>
        </div>

        {/* Two column layout */}
        <div className="abnahme-content">
          {/* Left: Project + Abnahme info */}
          <div className="abnahme-left-col">
            <div className="abnahme-sign-section">
              <div className="section-title">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                <h2>Projektübersicht</h2>
              </div>
              <div className="summary-grid">
                <div className="info-card">
                  <span className="info-label">Kunde</span>
                  <strong>{`${form.kundeVorname} ${form.kundeNachname}`.trim() || '-'}</strong>
                </div>
                <div className="info-card">
                  <span className="info-label">Adresse</span>
                  <strong>{form.kundenlokation || '-'}</strong>
                </div>
                <div className="info-card">
                  <span className="info-label">Datum</span>
                  <strong>{form.datum ? new Date(form.datum).toLocaleDateString('de-DE') : '-'}</strong>
                </div>
                <div className="info-card">
                  <span className="info-label">Aufnehmer</span>
                  <strong>{form.aufmasser || '-'}</strong>
                </div>
                <div className="info-card">
                  <span className="info-label">Kategorie</span>
                  <strong>{form.category || '-'}</strong>
                </div>
                <div className="info-card">
                  <span className="info-label">Produkttyp</span>
                  <strong>{form.productType || '-'}</strong>
                </div>
              </div>
            </div>

            <div className="abnahme-sign-section">
              <div className="section-title">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                <h2>Abnahmeübersicht</h2>
              </div>
              <div className="summary-grid">
                <div className={`info-card ${abnahme.istFertig ? 'status-positive' : 'status-negative'}`}>
                  <span className="info-label">Arbeit fertig</span>
                  <strong className="status-value">
                    <span className={`status-dot ${abnahme.istFertig ? 'dot-green' : 'dot-red'}`} />
                    {abnahme.istFertig ? 'Ja' : 'Nein'}
                  </strong>
                </div>
                <div className={`info-card ${!abnahme.hatProbleme ? 'status-positive' : 'status-negative'}`}>
                  <span className="info-label">Mängel</span>
                  <strong className="status-value">
                    <span className={`status-dot ${!abnahme.hatProbleme ? 'dot-green' : 'dot-red'}`} />
                    {abnahme.hatProbleme ? 'Ja' : 'Nein'}
                  </strong>
                </div>
                <div className={`info-card ${abnahme.baustelleSauber === 'ja' ? 'status-positive' : abnahme.baustelleSauber === 'nein' ? 'status-negative' : ''}`}>
                  <span className="info-label">Baustelle sauber</span>
                  <strong className="status-value">
                    {abnahme.baustelleSauber && <span className={`status-dot ${abnahme.baustelleSauber === 'ja' ? 'dot-green' : 'dot-red'}`} />}
                    {abnahme.baustelleSauber ? abnahme.baustelleSauber.toUpperCase() : '-'}
                  </strong>
                </div>
                <div className="info-card">
                  <span className="info-label">Monteur Note</span>
                  <strong className="note-badge">{abnahme.monteurNote ? String(abnahme.monteurNote) : '-'}</strong>
                </div>
              </div>

              {abnahme.maengelListe && abnahme.maengelListe.filter(Boolean).length > 0 && (
                <div className="summary-box maengel-box">
                  <span className="info-label">Mängelliste</span>
                  <ol className="maengel-list">
                    {abnahme.maengelListe.filter(Boolean).map((item, index) => (
                      <li key={`${item}-${index}`}>{item}</li>
                    ))}
                  </ol>
                </div>
              )}

              {abnahme.bemerkungen && (
                <div className="summary-box bemerkungen-box">
                  <span className="info-label">Bemerkungen</span>
                  <p>{abnahme.bemerkungen}</p>
                </div>
              )}
            </div>

            {/* Abnahme Photos */}
            {photos && photos.length > 0 && (
              <div className="abnahme-sign-section">
                <div className="section-title">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                  <h2>Abnahme Fotos</h2>
                </div>
                <div className="photos-grid">
                  {photos.map((photo) => (
                    <div key={photo.id} className="photo-card">
                      <img src={photo.base64} alt={photo.fileName} />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right: Signature */}
          <div className="abnahme-right-col">
            <div className="signature-section-inner">
              <div className="abnahme-sign-section">
                <div className="section-title">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.85 0 114 4L7.5 20.5 2 22l1.5-5.5z"/></svg>
                  <h2>Unterschrift</h2>
                </div>

                {submitted || request.status === 'signed' ? (
                  <div className="submit-success">
                    <div className="success-checkmark">
                      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                    </div>
                    <h3>Erfolgreich unterschrieben</h3>
                    <p>Die Abnahme wurde bestätigt. Vielen Dank!</p>
                    <button
                      type="button"
                      className="pdf-download-btn"
                      onClick={handleDownloadPdf}
                      disabled={pdfGenerating}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                      {pdfGenerating ? 'PDF wird erstellt...' : 'PDF Kopie herunterladen'}
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="signer-box">
                      <label>Name des Unterzeichners</label>
                      <input
                        type="text"
                        value={signerName}
                        onChange={(e) => setSignerName(e.target.value)}
                        placeholder="Vor- und Nachname"
                      />
                    </div>

                    {signatureData ? (
                      <div className="signature-preview-card">
                        <img src={signatureData} alt="Unterschrift" />
                        <button type="button" className="sign-btn secondary" onClick={() => setSignatureModalOpen(true)}>
                          Unterschrift ändern
                        </button>
                      </div>
                    ) : (
                      <button type="button" className="sign-btn primary" onClick={() => setSignatureModalOpen(true)}>
                        Unterschrift erfassen
                      </button>
                    )}

                    <button
                      type="button"
                      className="submit-btn"
                      onClick={handleSubmit}
                      disabled={!signatureData || !signerName.trim() || submitting}
                    >
                      {submitting ? 'Wird gesendet...' : 'Bestätigen und senden'}
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="abnahme-footer">
          <span>AYLUX Sonnenschutzsysteme</span>
        </div>
      </div>

      <SignatureCanvas
        isOpen={signatureModalOpen}
        onCancel={() => setSignatureModalOpen(false)}
        initialName={signerName}
        signerNameLabel="Name des Kunden"
        title="Abnahme unterschreiben"
        onSave={(data, name) => {
          setSignatureData(data);
          setSignerName(name);
          setSignatureModalOpen(false);
        }}
      />
    </div>
  );
};

export default AbnahmeSignPage;
