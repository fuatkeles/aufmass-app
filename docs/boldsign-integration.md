# BoldSign eSignature Entegrasyon Rehberi

## 1. Genel Bakis

### BoldSign Nedir?
BoldSign, Syncfusion tarafindan gelistirilen, hizli ve guvenilir bir eSignature API servisidir. Mevcut OpenAPI.com entegrasyonuna alternatif olarak degerlendirilmektedir.

**Ana Avantajlar:**
- Hizli document processing
- Guvenilir webhook/callback sistemi
- Kapsamli SDK destegi (Node.js, Python, C#)
- Uygun fiyatlandirma
- eIDAS uyumlulugu (SES/AES/QES destegi)

### eIDAS Uyumlulugu

BoldSign, AB eIDAS regulasyonuna tam uyumludur:

| Imza Tipi | Aciklama | BoldSign Destegi |
|-----------|----------|------------------|
| **SES (Simple Electronic Signature)** | Basit elektronik imza | Tam destek |
| **AES (Advanced Electronic Signature)** | Gelismis elektronik imza | Tam destek |
| **QES (Qualified Electronic Signature)** | Nitelikli elektronik imza | Evrotrust ortakligi ile |

**QES Detaylari:**
- Evrotrust (EU Trusted List QTSP) ortakligi ile saglanir
- AB genelinde mahkemede gecerli
- $3/imza (pay-as-you-go model)
- Business, Premium veya Enterprise planlarda kullanilabilir

### Fiyatlandirma

| Plan | Aylik Fiyat | Envelope Limiti | Ek Envelope |
|------|-------------|-----------------|-------------|
| **Essentials (Free)** | $0 | 25/ay | - |
| **Growth** | $5/kullanici (yillik) | 50/ay | - |
| **Business** | $20/ay | Daha yuksek | $0.50/envelope |
| **Premium** | $99/ay (yillik) | 3000/ay | $0.50/envelope |
| **Enterprise API** | $30/ay | 40/ay | $0.75/envelope |

**Ek Ucretler:**
- QES: $3/imza
- Bulk links: $0.25/imza
- SMS teslim: $0.20/SMS
- WhatsApp teslim: $0.10/mesaj

---

## 2. Sandbox/Test Ortami

### Developer Sandbox Hesabi
BoldSign, ucretsiz developer sandbox hesabi sunmaktadir:

- **Ozellikler:**
  - Tam API erisimi
  - Tum imza turleri test edilebilir
  - Imzali belgeler watermark icerir
  - Belgeler 14 gun sonra otomatik silinir

- **Sandbox vs Production:**
  - Ayni API URL'i kullanilir
  - Fark API key tipinde (sandbox key vs production key)
  - Her ortamda maksimum 2 API key olusturulabilir

### Rate Limits

| Ortam | Limit |
|-------|-------|
| **Sandbox** | 50 request/saat |
| **Production** | 2000 request/saat |

**Onemli:** Rate limit hesap bazinda uygulanir, OAuth app veya kullanici bazinda degil.

---

## 3. Authentication

BoldSign iki authentication yontemi destekler:

### API Key Authentication (Onerilen)

```javascript
// Request header
{
  'X-API-KEY': 'your-api-key-here',
  'Content-Type': 'application/json'
}
```

**cURL Ornegi:**
```bash
curl -X GET 'https://api.boldsign.com/v1/document/list' \
  -H 'X-API-KEY: {your-api-key}'
```

### OAuth 2.0 Authentication

OAuth 2.0 ile Bearer token kullanilir:

```javascript
// Request header
{
  'Authorization': 'Bearer eyJhbGci...',
  'Content-Type': 'application/json'
}
```

**Desteklenen OAuth Flowlari:**
- Client Credentials
- Authorization Code Grant
- PKCE (Proof Key for Code Exchange)

---

## 4. API Base URLs

### Region-based URLs

| Region | Stable | Beta |
|--------|--------|------|
| **US** | `https://api.boldsign.com/v1` | `https://api.boldsign.com/v1-beta` |
| **EU** | `https://api-eu.boldsign.com/v1` | `https://api-eu.boldsign.com/v1-beta` |

**Not:** AB veri residency gereksinimleri icin EU region onerilir (GDPR uyumlu sunucular Hollanda'da).

---

## 5. Node.js SDK

### Kurulum

```bash
npm install boldsign
```

### Temel Kullanim

```typescript
import { DocumentApi, Configuration } from 'boldsign';

// API Key ile konfigurasyonu
const configuration = new Configuration({
  apiKey: process.env.BOLDSIGN_API_KEY
});

const documentApi = new DocumentApi(configuration);
```

### Ornek: Document Gonderme

```typescript
import {
  DocumentApi,
  DocumentSigner,
  FormField,
  Rectangle,
  SendForSign
} from 'boldsign';

async function sendDocumentForSignature(pdfBuffer: Buffer, signerEmail: string, signerName: string) {
  const configuration = new Configuration({
    apiKey: process.env.BOLDSIGN_API_KEY
  });

  const documentApi = new DocumentApi(configuration);

  // Signature field tanimla
  const signatureField: FormField = {
    id: 'signature1',
    fieldType: 'Signature',
    pageNumber: 1,
    bounds: {
      x: 350,
      y: 700,
      width: 150,
      height: 50
    },
    isRequired: true
  };

  // Signer tanimla
  const signer: DocumentSigner = {
    name: signerName,
    emailAddress: signerEmail,
    signerType: 'Signer',
    formFields: [signatureField]
  };

  // Document gonder
  const sendRequest: SendForSign = {
    title: 'Aufmass Bestatigung',
    files: [pdfBuffer],
    signers: [signer],
    message: 'Bitte unterschreiben Sie das Dokument.'
  };

  const response = await documentApi.sendDocument(sendRequest);

  return {
    documentId: response.documentId,
    signers: response.signers
  };
}
```

---

## 6. Aufmass App Entegrasyon Plani

### Mevcut Yapi

Mevcut OpenAPI.com entegrasyonu:
- `aufmass_esignature_requests` tablosu
- `aufmass_branch_settings` tablosu (branch bazli enable/disable)
- SES ve QES imza turleri
- Webhook callback endpoint

### BoldSign Migration Stratejisi

#### Secenek A: Paralel Entegrasyon (Onerilen)

Her iki provider'i ayni anda destekle:

```javascript
// server/services/esignatureService.js

const PROVIDERS = {
  OPENAPI: 'openapi',
  BOLDSIGN: 'boldsign'
};

async function sendForSignature(formId, signerInfo, provider = PROVIDERS.BOLDSIGN) {
  if (provider === PROVIDERS.BOLDSIGN) {
    return await sendViaBoldSign(formId, signerInfo);
  } else {
    return await sendViaOpenAPI(formId, signerInfo);
  }
}
```

#### Secenek B: Tam Gecis

OpenAPI.com entegrasyonunu tamamen kaldir ve BoldSign'a gec.

### Gerekli Environment Variables

```env
# BoldSign Configuration
BOLDSIGN_API_KEY=your-api-key-here
BOLDSIGN_API_URL=https://api.boldsign.com/v1
BOLDSIGN_WEBHOOK_SECRET=your-webhook-secret

# EU Region icin (opsiyonel)
# BOLDSIGN_API_URL=https://api-eu.boldsign.com/v1

# Sandbox/Production toggle
BOLDSIGN_SANDBOX=true
```

### Database Schema Guncelleme

```sql
-- Mevcut tabloya provider kolonu ekle
ALTER TABLE aufmass_esignature_requests
ADD provider NVARCHAR(20) DEFAULT 'openapi';

-- Provider-specific ID kolonu (BoldSign document ID)
ALTER TABLE aufmass_esignature_requests
ADD boldsign_document_id NVARCHAR(100);

-- Index ekle
CREATE INDEX IX_aufmass_esignature_requests_boldsign_id
ON aufmass_esignature_requests(boldsign_document_id);
```

### Yeni Endpoint Yapisi

```javascript
// BoldSign SES imza gonderme
app.post('/api/esignature/boldsign/send-ses', authenticateToken, async (req, res) => {
  // Implementation
});

// BoldSign webhook callback
app.post('/api/webhooks/boldsign', async (req, res) => {
  // Verify signature
  const signature = req.headers['x-boldsign-signature'];
  // Process webhook
});

// Document download
app.get('/api/esignature/boldsign/download/:documentId', authenticateToken, async (req, res) => {
  // Implementation
});
```

---

## 7. Webhook Sistemi

### Kullanilabilir Event'ler

| Event | Aciklama |
|-------|----------|
| `Sent` | Document basariyla gonderildi |
| `Viewed` | Document goruntulendi |
| `Signed` | Bir signer imzaladi |
| `Completed` | Tum imzalar tamamlandi |
| `Declined` | Imza reddedildi |
| `Revoked` | Sender tarafindan iptal edildi |
| `Expired` | Suresi doldu |
| `DeliveryFailed` | Email teslim edilemedi |
| `AuthenticationFailed` | Signer dogrulamasi basarisiz |

### Webhook Verification

BoldSign webhook'lari `X-BoldSign-Signature` header'i ile imzalar:

```javascript
const crypto = require('crypto');

function verifyWebhookSignature(payload, signature, secret) {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(payload))
    .digest('hex');

  return signature === expectedSignature;
}

app.post('/api/webhooks/boldsign', async (req, res) => {
  const signature = req.headers['x-boldsign-signature'];

  if (!verifyWebhookSignature(req.body, signature, process.env.BOLDSIGN_WEBHOOK_SECRET)) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  // Process webhook...
});
```

### Retry Mechanism

- BoldSign 6 deneme yapar
- Basarisiz olursa webhook disable edilir ve email ile bilgilendirilir
- Maximum response time: 6 saniye (onerilen)

---

## 8. Embedded Signing

BoldSign, iframe icinde signing destekler:

```javascript
// Embedded signing URL alma
async function getEmbeddedSigningUrl(documentId: string, signerEmail: string) {
  const url = `${BOLDSIGN_API_URL}/document/getEmbeddedSignLink`;

  const response = await fetch(`${url}?documentId=${documentId}&signerEmail=${signerEmail}`, {
    headers: {
      'X-API-KEY': process.env.BOLDSIGN_API_KEY
    }
  });

  const data = await response.json();
  return data.signLink;
}
```

**Onemli:** Embedded signing kullanirken, signer identity dogrulamasini kendi sisteminizde yapmaniz gerekir.

---

## 9. Migration Checklist

- [ ] BoldSign hesabi olustur (sandbox)
- [ ] API key al
- [ ] npm package'i kur (`npm install boldsign`)
- [ ] Environment variables tanimla
- [ ] Database schema guncelle
- [ ] BoldSign service modulu olustur
- [ ] Webhook endpoint olustur
- [ ] Branch settings'e provider secenegi ekle
- [ ] Frontend'de provider secimi ekle
- [ ] Sandbox'ta test et
- [ ] Production'a gec

---

## 10. Kaynaklar

- [BoldSign Resmi Websitesi](https://boldsign.com/)
- [API Documentation](https://developers.boldsign.com/)
- [Node.js SDK](https://developers.boldsign.com/sdks/node-sdk/)
- [GitHub Repository](https://github.com/boldsign/boldsign-node-sdk)
- [Pricing](https://boldsign.com/electronic-signature-pricing/)
- [QES Documentation](https://boldsign.com/qes/)
- [Webhook Documentation](https://developers.boldsign.com/webhooks/introduction/)
