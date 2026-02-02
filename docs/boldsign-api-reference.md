# BoldSign API Reference

## Base URLs

| Region | URL |
|--------|-----|
| US (Stable) | `https://api.boldsign.com/v1` |
| US (Beta) | `https://api.boldsign.com/v1-beta` |
| EU (Stable) | `https://api-eu.boldsign.com/v1` |
| EU (Beta) | `https://api-eu.boldsign.com/v1-beta` |

## Authentication

### API Key (Onerilen)

```
Header: X-API-KEY: {your-api-key}
```

### OAuth 2.0 Bearer Token

```
Header: Authorization: Bearer {access-token}
```

---

## Document Endpoints

### 1. Send Document for Signature

Yeni bir imza talebi olusturur.

**Endpoint:** `POST /document/send`

**Content-Type:** `multipart/form-data` veya `application/json`

**Request Body (multipart/form-data):**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `Files` | File | Yes | PDF dosyasi |
| `Title` | string | No | Document basligi |
| `Message` | string | No | Imzalayicilara mesaj |
| `Signers` | JSON | Yes | Imzalayici bilgileri |

**Signers Object:**

```json
{
  "name": "John Doe",
  "emailAddress": "john@example.com",
  "signerType": "Signer",
  "signerOrder": 1,
  "authenticationType": "EmailOTP",
  "formFields": [
    {
      "id": "signature1",
      "fieldType": "Signature",
      "pageNumber": 1,
      "bounds": {
        "x": 350,
        "y": 700,
        "width": 150,
        "height": 50
      },
      "isRequired": true
    }
  ]
}
```

**FormField Types:**

| Type | Description |
|------|-------------|
| `Signature` | Imza alani |
| `Initial` | Paraf alani |
| `TextBox` | Metin girisi |
| `DateSigned` | Imza tarihi |
| `Checkbox` | Onay kutusu |
| `RadioButton` | Secim butonu |
| `Dropdown` | Acilir menu |

**Bounds (Rectangle):**

```json
{
  "x": 100,      // Sol pozisyon (px)
  "y": 200,      // Ust pozisyon (px)
  "width": 150,  // Genislik (px)
  "height": 50   // Yukseklik (px)
}
```

**Authentication Types:**

| Type | Description |
|------|-------------|
| `None` | Dogrulama yok |
| `EmailOTP` | Email ile OTP |
| `SMSOTP` | SMS ile OTP |
| `AccessCode` | Erisim kodu |

**Example cURL:**

```bash
curl -X 'POST' \
  'https://api.boldsign.com/v1/document/send' \
  -H 'accept: application/json' \
  -H 'X-API-KEY: {your-api-key}' \
  -H 'Content-Type: multipart/form-data' \
  -F 'Files=@document.pdf' \
  -F 'Title=Aufmass Bestatigung' \
  -F 'Signers={
    "name": "Max Mustermann",
    "emailAddress": "max@example.com",
    "signerType": "Signer",
    "formFields": [{
      "id": "sig1",
      "fieldType": "Signature",
      "pageNumber": 1,
      "bounds": {"x": 350, "y": 700, "width": 150, "height": 50},
      "isRequired": true
    }]
  }'
```

**Response:**

```json
{
  "documentId": "abc123-def456-...",
  "signers": [
    {
      "signerEmail": "max@example.com",
      "status": "NotYetViewed"
    }
  ]
}
```

**Onemli Notlar:**
- Islem asenkrondur
- Document ID hemen doner, ama dosya arka planda islenmeye devam edebilir
- Webhook'lar ile `Sent` veya `SendFailed` event'lerini dinleyin

---

### 2. Send Document from Template

Onceden tanimlanmis template'den document gonderir.

**Endpoint:** `POST /template/send`

**Request Body:**

```json
{
  "templateId": "template-id-here",
  "title": "Document Title",
  "roles": [
    {
      "roleIndex": 1,
      "signerEmail": "signer@example.com",
      "signerName": "Signer Name"
    }
  ]
}
```

---

### 3. Get Document Properties/Status

Document detaylarini ve durumunu getirir.

**Endpoint:** `GET /document/properties?documentId={documentId}`

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `documentId` | string | Yes | Document ID |

**Example cURL:**

```bash
curl -X 'GET' \
  'https://api.boldsign.com/v1/document/properties?documentId={documentId}' \
  -H 'accept: application/json' \
  -H 'X-API-KEY: {your-api-key}'
```

**Response:**

```json
{
  "documentId": "abc123-def456-...",
  "brandId": "brand-id",
  "messageTitle": "Aufmass Bestatigung",
  "status": "InProgress",
  "files": [
    {
      "fileName": "document.pdf",
      "pageCount": 3
    }
  ],
  "senderDetail": {
    "name": "Sender Name",
    "emailAddress": "sender@example.com"
  },
  "signerDetails": [
    {
      "signerName": "Max Mustermann",
      "signerEmail": "max@example.com",
      "status": "NotYetViewed",
      "authenticationType": "EmailOTP"
    }
  ],
  "activityHistory": [
    {
      "activity": "Created",
      "dateTime": "2024-01-15T10:30:00Z"
    }
  ]
}
```

**Document Status Values:**

| Status | Description |
|--------|-------------|
| `Draft` | Taslak |
| `InProgress` | Devam ediyor |
| `Completed` | Tamamlandi |
| `Declined` | Reddedildi |
| `Revoked` | Iptal edildi |
| `Expired` | Suresi doldu |

---

### 4. Download Document

Imzali PDF'i indirir.

**Endpoint:** `GET /document/download?documentId={documentId}`

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `documentId` | string | Yes | Document ID |
| `onBehalfOf` | string | No | Baska kullanici adina |

**Example cURL:**

```bash
curl -X 'GET' \
  'https://api.boldsign.com/v1/document/download?documentId={documentId}' \
  -H 'X-API-KEY: {your-api-key}' \
  --output signed_document.pdf
```

**Response:** Binary PDF data

---

### 5. Download Audit Trail

Document audit log'unu indirir.

**Endpoint:** `GET /document/downloadAuditLog?documentId={documentId}`

**Example cURL:**

```bash
curl -X 'GET' \
  'https://api.boldsign.com/v1/document/downloadAuditLog?documentId={documentId}' \
  -H 'X-API-KEY: {your-api-key}' \
  --output audit_trail.pdf
```

---

### 6. List Documents

Document listesini getirir.

**Endpoint:** `GET /document/list`

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `page` | int | Sayfa numarasi (1-based) |
| `pageSize` | int | Sayfa basina sonuc (max: 100) |
| `status` | string | Filtreleme: InProgress, Completed, etc. |
| `searchKey` | string | Arama terimi |

**Example cURL:**

```bash
curl -X 'GET' \
  'https://api.boldsign.com/v1/document/list?page=1&pageSize=20&status=Completed' \
  -H 'X-API-KEY: {your-api-key}'
```

---

## Embedded Signing Endpoints

### 7. Get Embedded Signing Link

iframe icinde gosterilecek signing URL'i alir.

**Endpoint:** `GET /document/getEmbeddedSignLink`

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `documentId` | string | Yes | Document ID |
| `signerEmail` | string | Yes | Imzalayici email |
| `redirectUrl` | string | No | Imza sonrasi yonlendirme |

**Example cURL:**

```bash
curl -X 'GET' \
  'https://api.boldsign.com/v1/document/getEmbeddedSignLink?documentId={documentId}&signerEmail=signer@example.com' \
  -H 'X-API-KEY: {your-api-key}'
```

**Response:**

```json
{
  "signLink": "https://app.boldsign.com/sign/abc123..."
}
```

**iframe Kullanimi:**

```html
<iframe
  src="https://app.boldsign.com/sign/abc123..."
  width="100%"
  height="600"
  frameborder="0"
></iframe>
```

---

## Webhook Endpoints

### Webhook Setup

BoldSign Dashboard uzerinden webhook URL tanimlanir.

### Webhook Event Payload

```json
{
  "event": {
    "eventType": "Completed",
    "eventTime": "2024-01-15T12:30:00Z"
  },
  "document": {
    "documentId": "abc123-def456-...",
    "status": "Completed",
    "senderDetail": {
      "name": "Sender",
      "emailAddress": "sender@example.com"
    },
    "signerDetails": [
      {
        "signerName": "Max Mustermann",
        "signerEmail": "max@example.com",
        "status": "Completed",
        "signedDate": "2024-01-15T12:28:00Z"
      }
    ]
  }
}
```

### Webhook Events

| Event | Aciklama | Kullanim |
|-------|----------|----------|
| `Sent` | Document gonderildi | Onay mesaji goster |
| `SendFailed` | Gonderim basarisiz | Hata isle |
| `Viewed` | Document goruntulendi | Progress guncelle |
| `Signed` | Bir signer imzaladi | Partial completion |
| `Completed` | Tum imzalar tamam | Document indir |
| `Declined` | Imza reddedildi | Kullaniciyi bilgilendir |
| `Revoked` | Sender iptal etti | Status guncelle |
| `Expired` | Sure doldu | Yeniden gonder |
| `DeliveryFailed` | Email teslim edilemedi | Email kontrol et |
| `AuthenticationFailed` | Signer dogrulama basarisiz | Guvenlik alarmi |

### Webhook Signature Verification

```javascript
const crypto = require('crypto');

function verifyBoldSignWebhook(payload, signature, secret) {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(payload))
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}
```

---

## Rate Limiting

### Response Headers

| Header | Description |
|--------|-------------|
| `X-RateLimit-Remaining` | Kalan request sayisi |
| `X-RateLimit-Reset` | Reset zamani (Unix timestamp) |

### Rate Limit Exceeded (429)

```json
{
  "error": "Rate limit exceeded",
  "retryAfter": 3600
}
```

### Best Practices

1. **Exponential Backoff:** 429 alinca bekle ve tekrar dene
2. **Webhook Kullan:** Polling yerine webhook tercih et
3. **Request'leri Yay:** Burst yerine esit dagit
4. **Header'lari Izle:** X-RateLimit-Remaining kontrol et

---

## Error Handling

### HTTP Status Codes

| Code | Description |
|------|-------------|
| `200` | Basarili |
| `400` | Bad Request - Gecersiz parametre |
| `401` | Unauthorized - API key gecersiz |
| `403` | Forbidden - Yetki yok |
| `404` | Not Found - Document bulunamadi |
| `429` | Rate Limit Exceeded |
| `500` | Server Error |

### Error Response Format

```json
{
  "error": "Error message here",
  "errorCode": "INVALID_DOCUMENT_ID",
  "details": {
    "field": "documentId",
    "message": "Document ID format is invalid"
  }
}
```

---

## Code Examples

### Node.js/TypeScript - Complete Flow

```typescript
import {
  DocumentApi,
  Configuration,
  DocumentSigner,
  FormField,
  SendForSign
} from 'boldsign';

const config = new Configuration({
  apiKey: process.env.BOLDSIGN_API_KEY,
  basePath: 'https://api.boldsign.com/v1'
});

const documentApi = new DocumentApi(config);

// 1. Document Gonder
async function sendForSignature(pdfBuffer: Buffer, signer: { email: string; name: string }) {
  const signatureField: FormField = {
    id: 'sig1',
    fieldType: 'Signature',
    pageNumber: 1,
    bounds: { x: 350, y: 700, width: 150, height: 50 },
    isRequired: true
  };

  const signerConfig: DocumentSigner = {
    name: signer.name,
    emailAddress: signer.email,
    signerType: 'Signer',
    authenticationType: 'EmailOTP',
    formFields: [signatureField]
  };

  const request: SendForSign = {
    title: 'Aufmass Bestatigung',
    files: [pdfBuffer],
    signers: [signerConfig],
    message: 'Bitte unterschreiben Sie das angehangte Dokument.'
  };

  const response = await documentApi.sendDocument(request);
  return response.documentId;
}

// 2. Status Kontrol
async function checkStatus(documentId: string) {
  const properties = await documentApi.getProperties(documentId);
  return {
    status: properties.status,
    signers: properties.signerDetails
  };
}

// 3. Document Indir
async function downloadSigned(documentId: string): Promise<Buffer> {
  const stream = await documentApi.downloadDocument(documentId);
  // Stream to buffer conversion
  return Buffer.from(await stream.arrayBuffer());
}

// 4. Embedded Signing Link Al
async function getSigningUrl(documentId: string, signerEmail: string) {
  const response = await documentApi.getEmbeddedSignLink(documentId, signerEmail);
  return response.signLink;
}
```

### Express.js Webhook Handler

```typescript
import express from 'express';
import crypto from 'crypto';

const app = express();
app.use(express.json());

const WEBHOOK_SECRET = process.env.BOLDSIGN_WEBHOOK_SECRET;

app.post('/api/webhooks/boldsign', async (req, res) => {
  // 1. Signature Verify
  const signature = req.headers['x-boldsign-signature'] as string;

  if (!verifySignature(req.body, signature, WEBHOOK_SECRET)) {
    console.error('Invalid webhook signature');
    return res.status(401).json({ error: 'Invalid signature' });
  }

  // 2. Event Handle
  const { event, document } = req.body;
  const { eventType } = event;
  const { documentId, status, signerDetails } = document;

  console.log(`Webhook received: ${eventType} for document ${documentId}`);

  switch (eventType) {
    case 'Completed':
      // Tum imzalar tamamlandi - document'i indir
      await handleDocumentCompleted(documentId);
      break;

    case 'Signed':
      // Bir signer imzaladi
      await handleSignerSigned(documentId, signerDetails);
      break;

    case 'Declined':
      // Imza reddedildi
      await handleDocumentDeclined(documentId);
      break;

    case 'Expired':
      // Sure doldu
      await handleDocumentExpired(documentId);
      break;

    default:
      console.log(`Unhandled event type: ${eventType}`);
  }

  // 3. Acknowledge
  res.status(200).json({ message: 'Webhook processed' });
});

function verifySignature(payload: any, signature: string, secret: string): boolean {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(payload))
    .digest('hex');

  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  } catch {
    return false;
  }
}

async function handleDocumentCompleted(documentId: string) {
  // Database guncelle
  // Signed PDF'i indir ve sakla
  // Kullaniciya bildirim gonder
}

async function handleSignerSigned(documentId: string, signerDetails: any[]) {
  // Progress guncelle
}

async function handleDocumentDeclined(documentId: string) {
  // Status guncelle
  // Kullaniciyi bilgilendir
}

async function handleDocumentExpired(documentId: string) {
  // Yeniden gonderme secenegi sun
}
```

---

## SDK Installation

### npm

```bash
npm install boldsign
```

### yarn

```bash
yarn add boldsign
```

### GitHub

```
https://github.com/boldsign/boldsign-node-sdk
```

---

## Useful Links

- [API Explorer](https://developers.boldsign.com/api-overview/api-explorer/)
- [Postman Collection](https://www.postman.com/boldsign/boldsign-s-public-workspace/)
- [SDK Documentation](https://developers.boldsign.com/sdks/node-sdk/)
- [Webhook Testing](https://developers.boldsign.com/webhooks/test-webhooks/)
- [Rate Limits Guide](https://developers.boldsign.com/api-overview/rate-limit/)
