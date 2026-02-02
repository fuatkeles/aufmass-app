# eSignature Servisleri Karsilastirma Raporu

**Tarih:** Ocak 2026
**Amac:** OpenAPI.com eSignature servisi sandbox'ta yavs calisma sorununa karsi alternatif degerlendirmesi
**Hedef Pazar:** Almanya/Avrupa

---

## Icindekiler

1. [Ozet ve Oneriler](#ozet-ve-oneriler)
2. [Karsilastirma Tablosu](#karsilastirma-tablosu)
3. [Detayli Servis Incelemeleri](#detayli-servis-incelemeleri)
4. [Sonuc](#sonuc)

---

## Ozet ve Oneriler

### En Iyi Secenekler (Siralama)

| Siralama | Servis | Neden |
|----------|--------|-------|
| 1 | **Yousign** | Avrupa merkezli, eIDAS sertifikali, makul fiyat, iyi API |
| 2 | **Zoho Sign** | Pay-per-use ($0.50/envelope), eID Easy entegrasyonu ile QES |
| 3 | **Dropbox Sign** | Hizli, basit API, eIDAS uyumlu, IDnow ile QES |
| 4 | **SignRequest** | Uygun fiyat (EUR0.50/doc), sandbox mevcut |
| 5 | **Swisscom Trust Services** | Gercek QTSP, EU+Swiss QES, CHF 2.40/QES |

### Hizli Karar Matrisi

| Ihtiyac | Onerilen Servis |
|---------|-----------------|
| En dusuk maliyet | SignRequest, Zoho Sign |
| En hizli entegrasyon | Dropbox Sign, Yousign |
| En yuksek guvenilirlik (QES) | Swisscom, InfoCert, Namirial |
| Avrupa veri yerlesimi | Yousign, Swisscom, InfoCert |
| En iyi SDK | DocuSign, Dropbox Sign |

---

## Karsilastirma Tablosu

### Genel Bakis

| Servis | eIDAS Uyumu | SES | AES | QES | API | Sandbox | Node.js SDK |
|--------|-------------|-----|-----|-----|-----|---------|-------------|
| DocuSign | Evet | Evet | Evet | Evet* | Evet | Evet | Resmi |
| Adobe Sign | Evet | Evet | Evet | Evet | Evet | Evet | - |
| SignRequest | Evet | Evet | Evet | - | Evet | Evet | - |
| Yousign | Evet | Evet | Evet | Evet | Evet | Evet | Ornek kod |
| PandaDoc | Evet | Evet | Evet | Evet** | Evet | Evet | - |
| Dropbox Sign | Evet | Evet | Evet | Evet | Evet | Evet | Resmi |
| eSign Genie | Kismi | Evet | - | - | Evet | - | - |
| Signaturely | Evet | Evet | - | - | Evet | - | - |
| Zoho Sign | Evet | Evet | Evet | Evet*** | Evet | Evet | - |
| Swisscom | Evet | Evet | Evet | Evet | Evet | - | - |
| InfoCert | Evet | Evet | Evet | Evet | Evet | - | - |
| Namirial | Evet | Evet | Evet | Evet | Evet | - | - |
| D4Sign | Hayir | Evet | - | - | Evet | - | - |

*QES ek ucret
**QES API ile kullanilamaz
***eID Easy entegrasyonu ile

### Fiyatlandirma Karsilastirmasi

| Servis | Baslangic Fiyati | Per-Signature/Envelope | API Fiyati | Notlar |
|--------|------------------|------------------------|------------|--------|
| **DocuSign** | $600/yil (API Starter) | ~40 env/ay | $5,760/yil (QES dahil) | QES ek maliyet |
| **Adobe Sign** | $14.99/kullanici/ay | Envelope bazli | Enterprise (ozel fiyat) | API icin Enterprise gerekli |
| **SignRequest** | EUR9/ay | EUR0.50/doc | EUR0.50/doc | Sandbox ucretsiz |
| **Yousign** | EUR11/ay | 10 imza dahil | EUR125+/ay | API planinda minimum |
| **PandaDoc** | $19/kullanici/ay | Envelope bazli | Enterprise (ozel fiyat) | QES API'da yok |
| **Dropbox Sign** | $15/ay | 20 env/ay | Premium + ek | eID ek ucret |
| **Zoho Sign** | $0.50/envelope | $0.50/envelope | $0.50/envelope | En iyi pay-per-use |
| **Swisscom** | Paket bazli | CHF 0.95-2.40 | Ozel fiyat | SES:0.95, AES:1.50, QES:2.40 |
| **InfoCert** | Ozel fiyat | ~EUR5/QES | Ozel fiyat | OpenAPI uzerinden de |
| **Namirial** | EUR0 baslangic | EUR0.013-0.05 | EUR137 (3 yillik sertifika) | En dusuk per-use |

---

## Detayli Servis Incelemeleri

### 1. DocuSign

**Genel Bakis:**
Pazar lideri, en genis ozellik seti, ancak en yuksek maliyet.

**eIDAS Uyumu:**
- Tum seviyeler desteklenir (SES, AES, QES)
- EU Trust List'te kayitli Trust Service Provider
- Standards-Based Signatures: PAdES, XAdES, CAdES

**API & SDK:**
- Resmi Node.js SDK: `npm install docusign-esign`
- Kapsamli dokumantasyon: https://developers.docusign.com/docs/esign-rest-api/sdks/node/
- OAuth 2.0 (Authorization Code Grant, JWT)
- Sandbox: Evet (Developer hesabi ile)

**Fiyatlandirma:**
- API Starter: $600/yil (40 env/ay)
- Advanced (QES): $5,760/yil
- Enterprise: Ozel fiyat

**Artilari:**
- En genis entegrasyon ekosistemi
- En iyi SDK ve dokumantasyon
- Yuksek guvenilirlik

**Eksileri:**
- Yuksek maliyet
- QES icin ek lisans gerekli
- Kucuk projeler icin asiri

---

### 2. Adobe Sign

**Genel Bakis:**
Adobe ekosistemi ile entegre, kurumsal musteriler icin ideal.

**eIDAS Uyumu:**
- SES, AES, QES destekli
- eIDAS-compliant cloud-based digital signatures
- SSCD destegi (smart cards, USB tokens)

**API & SDK:**
- REST API mevcut
- Resmi Node.js SDK yok (REST ile kullanim)
- Dokumantasyon: https://helpx.adobe.com/sign/

**Fiyatlandirma:**
- Standard: $14.99/kullanici/ay
- Pro: $23.99/kullanici/ay
- Enterprise: Ozel fiyat (API erisimi icin zorunlu)

**Artilari:**
- Adobe ekosistemi entegrasyonu
- Genis ozellik seti
- Guvenilir marka

**Eksileri:**
- API icin Enterprise gerekli
- Yuksek maliyet
- SDK eksik

---

### 3. SignRequest

**Genel Bakis:**
Hollanda merkezli, uygun fiyatli, basit API.

**eIDAS Uyumu:**
- SES ve AES destekli
- GDPR uyumlu
- QES mevcut degil

**API & SDK:**
- REST API
- Sandbox: Evet (watermark ile)
- Dokumantasyon: https://signrequest.com/en/plans-2/api-pricing

**Fiyatlandirma:**
- Professional: EUR9/ay
- Business: EUR15/ay
- API: EUR0.50/doc (pay-per-use)
- Enterprise: ~$25+/kullanici/ay

**Artilari:**
- Uygun fiyat
- Basit API
- Sandbox mevcut

**Eksileri:**
- QES destegi yok
- Sinirli ozellikler

---

### 4. Yousign (ONERILEN)

**Genel Bakis:**
Fransiz sirketi, Avrupa'ya odakli, eIDAS sertifikali QTSP.

**eIDAS Uyumu:**
- SES, AES, QES tam destek
- EU Trust List'te kayitli
- Avrupa Komisyonu onayil Trusted Third Party
- Tum veriler EU icinde barindiriliyor

**API & SDK:**
- REST API (v3 guncel)
- Base URL: https://api.yousign.app/v3
- Sandbox: https://api-sandbox.yousign.app/v3
- Node.js ornekleri: https://developers.yousign.com/docs/nodejs
- iFrame embed destegi

**Fiyatlandirma:**
- Free: 2 imza/ay
- One: EUR11/ay (10 imza)
- Plus: EUR25/kullanici/ay (sinirsiz)
- Pro: EUR48/kullanici/ay (API erisimi)
- API: EUR125+/ay (baslangic)

**Artilari:**
- Avrupa merkezli (GDPR uyumu kolay)
- Gercek QTSP
- Makul fiyatlandirma
- Iyi API dokumantasyonu

**Eksileri:**
- SDK kalitesi elestiriliyor
- Log erisimi icin yuksek plan gerekli
- Minimum aylik API ucreti

---

### 5. PandaDoc

**Genel Bakis:**
Dokuman yonetimi + eSignature, CRM entegrasyonlari guclu.

**eIDAS Uyumu:**
- SES, AES, QES destekli
- ESIGN, UETA, eIDAS, GDPR uyumlu
- **ONEMLI:** QES API uzerinden kullanilamaz!

**API & SDK:**
- REST API
- Sandbox: 14 gun deneme
- Dokumantasyon: https://www.pandadoc.com/api/

**Fiyatlandirma:**
- Starter: $19/kullanici/ay
- Business: $49/kullanici/ay
- Enterprise: Ozel fiyat (API icin zorunlu)

**Artilari:**
- CRM entegrasyonlari
- Dokuman yonetimi dahil

**Eksileri:**
- QES API'da yok (buyuk dezavantaj)
- API icin Enterprise gerekli
- Yuksek maliyet

---

### 6. Dropbox Sign (HelloSign)

**Genel Bakis:**
Basit, hizli, Dropbox ekosistemi entegrasyonu.

**eIDAS Uyumu:**
- SES, AES, QES destekli
- SOC 2 Type II, ISO 27001, eIDAS, GDPR
- IDnow ile QES (video dogrulama)
- EvroTrust ile QES (liveness check)

**API & SDK:**
- REST API
- Resmi Node.js SDK: https://developers.hellosign.com/
- Sandbox: Evet
- eID add-on: Premium plan gerekli

**Fiyatlandirma:**
- Essentials: $15/ay (20 env)
- Standard: $25/kullanici/ay (100 env)
- Premium: $40/ay veya ozel
- eID/QES: Ek ucret (satis ile)

**Artilari:**
- Hizli entegrasyon
- Iyi SDK
- Basit arayuz

**Eksileri:**
- QES icin Premium + add-on gerekli
- Sinirli enterprise ozellikleri

---

### 7. Zoho Sign (ONERILEN - Pay-per-use)

**Genel Bakis:**
Zoho ekosistemi, en iyi pay-per-use fiyatlandirma.

**eIDAS Uyumu:**
- SES, AES destekli
- QES: eID Easy entegrasyonu ile
- ESIGN, eIDAS, GDPR uyumlu

**API & SDK:**
- REST API
- OAuth 2.0
- Dokumantasyon: https://www.zoho.com/sign/pricing-api.html
- Webhook destegi

**Fiyatlandirma:**
- **$0.50/envelope (pay-per-use)** - En iyi oran!
- Hic aylik/yillik baglilik yok
- Tum ozellikler dahil (templates, webhooks, audit trails)
- OEM/White-label: Ozel fiyat

**Artilari:**
- En iyi pay-per-use model
- Zoho ekosistemi entegrasyonu
- Dil destegi (Almanca dahil)
- Dusuk baslangic maliyeti

**Eksileri:**
- QES icin eID Easy gerekli
- Enterprise QES icin Enterprise plan

---

### 8. Swisscom Trust Services (QES icin ONERILEN)

**Genel Bakis:**
Isvicre merkezli, AB ve Isvicre icin cift QTSP, en gercek QES saglayicisi.

**eIDAS Uyumu:**
- SES, AES, QES tam destek
- Avrupa'nin tek EU+Swiss cift QTSP'si
- eIDAS ve ZertES uyumlu

**API & SDK:**
- Embedded remote signature platform
- Broker sistemi ile entegrasyon
- Farkli onay yontemleri

**Fiyatlandirma:**
- SES: CHF 0.95/imza
- AES: CHF 1.50/imza
- QES: CHF 2.40/imza
- Partner paketleri mevcut

**Artilari:**
- Gercek QTSP
- Dusuk per-signature maliyeti (QES)
- Isvicre + AB gecerliligi
- Yuksek guvenilirlik

**Eksileri:**
- Entegrasyon karmasikligi
- Dokumantasyon sinirli
- Baslangic setup gerekli

---

### 9. InfoCert

**Genel Bakis:**
Italyan QTSP, AB genelinde guvenilir, Tinexta Group uygesi.

**eIDAS Uyumu:**
- SES, AES, QES tam destek
- 2017'den beri EU QTSP
- Adobe AATL listesinde

**API & SDK:**
- REST API
- OpenAPI.com uzerinden de erisim
- Video dogrulama seçenekleri

**Fiyatlandirma:**
- Ozel fiyat (satis ile)
- OpenAPI uzerinden: ~EUR5/QES

**Artilari:**
- Kurumsal guvenilirlik
- Video ID secenekleri
- AB genelinde gecerlilik

**Eksileri:**
- Saydam fiyatlandirma yok
- SDK eksik
- Entegrasyon suresi uzun olabilir

---

### 10. Namirial (QTSP icin ONERILEN)

**Genel Bakis:**
Italyan QTSP, eIDAS 2.0'a ilk uyumlu sirketlerden, en dusuk per-use maliyeti.

**eIDAS Uyumu:**
- SES, AES, QES tam destek
- eIDAS 2.0 sertifikali (Mayis 2026 oncesi hazir)
- PAdES, CAdES, XAdES destegi
- German BaFin AML uyumlu

**API & SDK:**
- REST/SOAP API (eSignAnyWhere)
- Iyi dokumantasyon
- Web ve API erisimi

**Fiyatlandirma (OpenAPI uzerinden):**
- Yillik ucret: EUR0
- Per-signature: EUR0.013-0.05
- 3 yillik sertifika + Video ID: EUR137
- Kullandikca ode modeli

**Artilari:**
- En dusuk per-use maliyeti
- eIDAS 2.0 hazir
- Almanya uyumlu (BaFin)
- Esnek fiyatlandirma

**Eksileri:**
- Sertifika on maliyeti
- Entegrasyon sureci

---

### Diger Servisler

#### eSign Genie (Foxit eSign)
- UETA, ESIGN uyumlu
- eIDAS destegi sinirli
- API mevcut ama ozellikler ek ucretli
- Avrupa odakli degil

#### Signaturely
- ESIGN, eIDAS, GDPR uyumlu
- Basit SES icin uygun
- AES/QES destegi sinirli
- $16/ay baslangic

#### D4Sign
- Brezilya odakli
- eIDAS uyumu yok
- Avrupa icin onerilmez

---

## Bonus: eID Easy (Aggregator)

**eID Easy, birden fazla QTSP'yi tek API ile birlestirir.**

**Ozellikler:**
- 80+ kimlik saglayicisi
- Tek API ile coklu QTSP erisimi
- Zoho Sign ile entegre
- SES, AES, QES destegi

**Fiyatlandirma:**
- Bolge bazli paketler
- Yuksek hacim indirimleri
- Ozel fiyatlandirma

**Dokumantasyon:** https://docs.eideasy.com/

---

## Sonuc

### Senaryo Bazli Oneriler

#### Senaryo 1: Hizli MVP / Dusuk Maliyet
**Oneri: Zoho Sign + eID Easy**
- $0.50/envelope pay-per-use
- QES icin eID Easy entegrasyonu
- Minimum baslangic maliyeti

#### Senaryo 2: Kurumsal / Yuksek Hacim
**Oneri: Yousign veya DocuSign**
- Kapsamli ozellikler
- Guvenilir altyapi
- Iyi SDK/dokumantasyon

#### Senaryo 3: Sadece QES Gerekli
**Oneri: Swisscom veya Namirial**
- Gercek QTSP
- Dusuk per-signature maliyeti
- eIDAS 2.0 hazir

#### Senaryo 4: Almanya Odakli
**Oneri: Namirial + Yousign**
- BaFin uyumu (Namirial)
- Almanca dil destegi
- AB veri yerlesimi

### Hiz Karsilastirmasi

Arastirma sirasinda spesifik document processing hiz metrikleri bulunamadi. Ancak:

1. **Cloud-native cozumler (Dropbox Sign, Yousign)** genellikle daha hizli
2. **On-premise QTSP'ler (Swisscom, InfoCert)** video ID nedeniyle daha yavas olabilir
3. **Pay-per-use modeller (Zoho Sign)** genellikle optimize edilmis

### Sonraki Adimlar

1. **POC icin:** Zoho Sign ($0.50/env) veya SignRequest (EUR0.50/doc) ile baslat
2. **QES gerekiyorsa:** Swisscom veya Namirial sandbox test et
3. **Olceklendirme oncesi:** Yousign veya DocuSign Enterprise degerlendirmesi

---

## Kaynaklar

### API Dokumantasyonlari

| Servis | URL |
|--------|-----|
| DocuSign | https://developers.docusign.com/docs/esign-rest-api/sdks/node/ |
| Adobe Sign | https://helpx.adobe.com/sign/ |
| SignRequest | https://signrequest.com/en/plans-2/api-pricing |
| Yousign | https://developers.yousign.com/ |
| PandaDoc | https://www.pandadoc.com/api/ |
| Dropbox Sign | https://developers.hellosign.com/ |
| Zoho Sign | https://www.zoho.com/sign/pricing-api.html |
| Swisscom | https://trustservices.swisscom.com/ |
| InfoCert | https://infocert.digital/ |
| Namirial | https://www.namirial.com/en/sign/ |
| eID Easy | https://docs.eideasy.com/ |

### Fiyatlandirma Sayfalari

| Servis | URL |
|--------|-----|
| DocuSign | https://www.docusign.com/products-and-pricing |
| Yousign | https://yousign.com/pricing-api |
| Zoho Sign | https://www.zoho.com/sign/pricing-api.html |
| Dropbox Sign | https://sign.dropbox.com/products/dropbox-sign-api/pricing |
| Swisscom | https://www.swisscom.ch/en/business/sme/sign.html |
| eID Easy | https://www.eideasy.com/pricing |

---

*Bu dokuman Ocak 2026 itibariyle gunceldir. Fiyatlar ve ozellikler degisebilir.*
