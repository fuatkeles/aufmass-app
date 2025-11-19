# 🧪 AYLUX AUFMASS UYGULAMASI - TEST SENARYOSU

## 📱 Test Ortamı

**Uygulama URL'si:** http://localhost:5173/

**Test Edilecek Cihazlar:**
- 📱 Mobil (375px - 640px)
- 📱 Tablet (640px - 1024px)
- 💻 Desktop (> 1024px)

---

## ✅ TEST SENARYOSU 1: ÜBERDACHUNG - GLASDACH

### Adım 1: Grunddaten (Temel Bilgiler)
1. Tarayıcıda `http://localhost:5173/` adresini aç
2. **Datum** alanına bugünün tarihini seç
3. **Aufmasser / Berater** alanına: `Ahmet Yılmaz` yaz
4. **Montageteam** dropdown'ından: `SENOL` seç
5. **Kunde Vorname** alanına: `Max` yaz
6. **Kunde Nachname** alanına: `Mustermann` yaz
7. **Kundenlokation / Adresse** alanına: `Berlin, Hauptstraße 123` yaz
8. **"Weiter →"** butonuna tıkla

### Adım 2: Produktauswahl (Ürün Seçimi)
1. **ÜBERDACHUNG** kartına tıkla (yeşil olmalı)
2. **Glasdach** butonuna tıkla (seçilmiş olmalı)
3. **Modell** dropdown'ından: `Premiumline` seç
4. Yeşil özet kutusu görünmeli: "Ihre Auswahl: ÜBERDACHUNG → Glasdach → Premiumline"
5. **"Weiter →"** butonuna tıkla

### Adım 3: Spezifikationen (Özellikler)
1. **Modell** dropdown'ından: `Premiumline` seç
2. **Breite** alanına: `5000` yaz (mm cinsinden)
3. **Tiefe** alanına: `3000` yaz
4. **Anzahl Stützen** alanına: `4` yaz
5. **Höhe Stützen** alanına: `2700` yaz
6. **Gestellfarbe** alanına: `RAL 7016` yaz
7. **Befestigungsart** için: `Wand` seçeneğini seç
8. **Eindeckung** dropdown'ından: `8 MM KLAR` seç
9. **Freistehend** için: `NEIN` seç
10. **LED Beleuchtung** için: `6 Stück` seç
11. **Fundament** için: `Aylux` seç
12. **Wasserablauf** için: `Links` seç
13. **"Weiter →"** butonuna tıkla

### Adım 4: Abschluss (Son Adım)
1. **Zeichnung & Bemerkungen** alanına test notu yaz:
   ```
   Test ölçüm kaydı
   Müşteri ile görüşüldü
   Montaj tarihi: 15.12.2025
   ```
2. **"PDF Exportieren"** mor butonuna tıkla
3. PDF indirilmeli: `Aufmass_Max_Mustermann_2025-11-19.pdf`
4. PDF'i aç ve içeriğini kontrol et:
   - ✅ AYLUX logosu sağ üstte
   - ✅ Tüm temel bilgiler
   - ✅ Ürün seçimi bilgileri
   - ✅ Tüm spesifikasyonlar
   - ✅ Bemerkungen metni

---

## ✅ TEST SENARYOSU 2: MARKISE - AUFGLAS

### Adım 1: Grunddaten
1. Sayfayı yenile (F5)
2. Form sıfırlanmalı
3. **Datum**: Bugünün tarihi
4. **Aufmasser**: `Mehmet Demir`
5. **Montageteam**: `APO`
6. **Kunde Vorname**: `Anna`
7. **Kunde Nachname**: `Schmidt`
8. **Kundenlokation**: `München, Leopoldstraße 45`
9. **"Weiter →"**

### Adım 2: Produktauswahl
1. **MARKISE** kartına tıkla
2. **AUFGLAS** butonuna tıkla
3. **Modell** dropdown'ından: `W350` seç
4. Özet: "MARKISE → AUFGLAS → W350"
5. **"Weiter →"**

### Adım 3: Spezifikationen
1. **Modell**: `W350` olmalı
2. **Breite**: `4500`
3. **Tiefe**: `3500`
4. **Gestellfarbe**: `RAL 9010`
5. **Markisenbreite**: `4200`
6. **Markisenlänge**: `3200`
7. **Stoff Nummer**: `S123456`
8. **ZIP**: `JA` seç
9. **"Weiter →"**

### Adım 4: Abschluss
1. Bemerkungen: `Markise test kaydı - ZIP sistemi tercih edildi`
2. **"PDF Exportieren"**
3. PDF kontrol et

---

## ✅ TEST SENARYOSU 3: UNTERBAUELEMENTE - GG SCHIEBE ELEMENT

### Adım 1-2-3-4
Aynı şekilde:
- Grunddaten doldur
- **UNTERBAUELEMENTE** → **GG Schiebe Element** → **AL22** seç
- Spezifikasyonları doldur
- PDF'i test et

---

## 📱 MOBİL TEST (Önemli!)

### Chrome DevTools ile Mobil Test
1. Chrome'da F12'ye bas
2. Responsive Design Mode'a geç (Ctrl+Shift+M veya cihaz ikonu)
3. Cihaz seç:
   - **iPhone 12 Pro** (390x844)
   - **iPad Air** (820x1180)
   - **Samsung Galaxy S20** (360x800)

### Kontrol Listesi (Her Cihazda)
- [ ] Input'lar görünüyor mu? (beyaz arka plan)
- [ ] Yazılar okunuyor mu? (yeterince büyük)
- [ ] Butonlara kolayca tıklanabiliyor mu?
- [ ] Kategori kartları doğru boyutta mı?
- [ ] Progress bar çalışıyor mu?
- [ ] "Weiter" ve "Zurück" butonları tam genişlikte mi? (mobilde)
- [ ] Animasyonlar smooth mu?
- [ ] Klavye açıldığında input görünür kalıyor mu?

---

## 🐛 HATA KONTROL LİSTESİ

### Form Validasyonu
- [ ] Boş Grunddaten ile "Weiter" tıklandığında uyarı var mı?
- [ ] Ürün seçilmeden "Weiter" ile ilerlenemiyor mu?
- [ ] Required (*) alanlar boşsa buton disabled mı?

### Dinamik Alan Kontrolü
- [ ] Glasdach seçildiğinde "Eindeckung" alanı görünüyor mu?
- [ ] AUFGLAS seçildiğinde "Eindeckung" alanı gizli mi?
- [ ] Kategori değiştirildiğinde spesifikasyonlar sıfırlanıyor mu?
- [ ] Model değiştirildiğinde doğru field'ler gösteriliyor mu?

### PDF Export
- [ ] PDF doğru isimle indiriliyor mu?
- [ ] Tüm veriler PDF'de görünüyor mu?
- [ ] Türkçe karakterler bozulmuyor mu?
- [ ] Sayfa geçişleri doğru mu?
- [ ] Footer bilgileri (sayfa numarası, tarih) var mı?

### Responsive
- [ ] Mobilde tek kolon layout
- [ ] Tablette 2 kolon
- [ ] Desktop'ta 3 kolon (kategoriler)
- [ ] Progress bar mobilde görünüyor mu?
- [ ] Step başlıkları mobilde okunuyor mu?

---

## 🎯 BAŞARI KRİTERLERİ

✅ **Tüm testler başarılı ise:**
- Form her üç senaryoda çalışıyor
- Mobil, tablet, desktop responsive
- PDF doğru oluşturuluyor
- Tüm dinamik field'ler çalışıyor
- Input'lar görünür ve kullanılabilir
- Validasyon çalışıyor

---

## 💡 HATA BULURSAN

1. Hatayı not al (ekran görüntüsü + açıklama)
2. Hangi adımda oluştu?
3. Hangi cihazda? (mobil/tablet/desktop)
4. Console'da hata var mı? (F12)
5. Bana bildir, hemen düzeltelim!

---

## 🚀 KOLAY TEST AKIŞI

**5 Dakikalık Hızlı Test:**

1. **Desktop'ta Test** (2 dk)
   - Glasdach senaryosu
   - PDF indir ve kontrol et

2. **Mobilde Test** (2 dk)
   - Chrome DevTools → iPhone 12 Pro
   - Markise senaryosu
   - Input'ların görünürlüğünü kontrol et

3. **Geri Dön Kontrolü** (1 dk)
   - Son adımdan "Zurück" ile başa dön
   - Veriler korunuyor mu?
   - Tekrar ileri git ve PDF'i test et

---

## ✨ TEST SONUCU RAPORU

Test tamamlandığında bana şunları söyle:

1. **Hangi senaryoları test ettin?**
2. **Hangi cihazlarda test ettin?**
3. **Karşılaştığın sorunlar var mı?**
4. **PDF çıktısı nasıl?**
5. **Genel izlenim?** (kullanım kolaylığı, hız, görünüm)

Başarılar! 🎉
