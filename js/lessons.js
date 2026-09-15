/* ============================================================
   lessons.js — DERS ANLATIMI (alıştırmadan ÖNCE)

   NEDEN: Çocuk okulda konuyu henüz görmediyse alıştırmaya
   başlayamıyordu (kilitli bölümler). Ders ekranı:
     - Hiçbir kilide bağlı DEĞİL (her zaman açılır)
     - Slayt slayt anlatır: nedir → nerede görürüz → nasıl çizilir
     - Sonunda "Şimdi dene" ile ilgili alıştırmayı açar
   Slaytlar hem YAZILI hem SESLİ; ses kısa cümlelerle okunur.
   ============================================================ */

/** Şekil başına ders içeriği: 3 slayt */
export const SHAPE_LESSONS = {
  kare: {
    title: 'Kare',
    slides: [
      { baslik: 'Kare nedir?',
        metin: 'Karenin dört kenarı vardır ve hepsi birbirine eşittir. Dört köşesi vardır.',
        ses: 'Karenin dört kenarı var. Hepsi eşit. Dört köşesi var.' },
      { baslik: 'Nerede görürüz?',
        metin: 'Kitap kapağında, pencerede, fayans döşemede, zarda ve satranç tahtasında kare görürsün.',
        ses: 'Pencerede kare var. Kitap kapağında kare var. Fayanslarda kare var.' },
      { baslik: 'Nasıl çizilir?',
        metin: 'Sağa düz git. Sonra aşağı. Sonra sola. En son yukarı — başladığın yere dön.',
        ses: 'Sağa git. Aşağı git. Sola git. Yukarı git. Başladığın yere dön.' }
    ]
  },
  dikdortgen: {
    title: 'Dikdörtgen',
    slides: [
      { baslik: 'Dikdörtgen nedir?',
        metin: 'Dikdörtgenin dört kenarı var. Karşılıklı kenarlar birbirine eşit. İki kenarı uzun, iki kenarı kısa.',
        ses: 'Dikdörtgenin dört kenarı var. Karşılıklı kenarlar eşit. İki kenar uzun, iki kenar kısa.' },
      { baslik: 'Nerede görürüz?',
        metin: 'Kapıda, tahtada, cep telefonunda, kitapta ve masada dikdörtgen görürsün.',
        ses: 'Kapıda dikdörtgen var. Tahtada dikdörtgen var. Telefonunda da var.' },
      { baslik: 'Nasıl çizilir?',
        metin: 'Önce uzun kenarı çiz. Sonra kısa kenarı. Sonra tekrar uzun, en son kısa kenar.',
        ses: 'Önce uzun kenarı çiz. Sonra kısa kenarı. Sonra uzun, en son kısa.' }
    ]
  },
  ucgen: {
    title: 'Üçgen',
    slides: [
      { baslik: 'Üçgen nedir?',
        metin: 'Üçgenin üç kenarı ve üç köşesi vardır. Kenarlar birleşince sivri köşeler oluşur.',
        ses: 'Üçgenin üç kenarı var. Üç köşesi var.' },
      { baslik: 'Nerede görürüz?',
        metin: 'Çatıda, trafik levhasında, pizzanın diliminde ve dağların tepesinde üçgen görürsün.',
        ses: 'Çatıda üçgen var. Trafik levhasında üçgen var. Pizza diliminde de var.' },
      { baslik: 'Nasıl çizilir?',
        metin: 'Birden ikiye düz git. İkiden üçe düz git. Üçten bire geri dön — üçgen tamam.',
        ses: 'Birden ikiye git. İkiden üçe git. Üçten bire dön.' }
    ]
  },
  daire: {
    title: 'Daire',
    slides: [
      { baslik: 'Daire nedir?',
        metin: 'Dairenin kenarı ve köşesi yoktur. Yuvarlaktır, hiç sivri yeri yoktur.',
        ses: 'Dairenin kenarı yok. Köşesi yok. Yuvarlaktır.' },
      { baslik: 'Nerede görürüz?',
        metin: 'Saatte, tabakta, topta, direksiyonda ve güneşte daire görürsün.',
        ses: 'Saatte daire var. Tabakta daire var. Topta da var.' },
      { baslik: 'Nasıl çizilir?',
        metin: 'Birden başla ve saat yönünde yuvarlak çiz. Elin hiç durmasın, köşe yapma.',
        ses: 'Birden başla. Saat yönünde yuvarlak çiz. Elin hiç durmasın.' }
    ]
  },
  besgen: {
    title: 'Beşgen',
    slides: [
      { baslik: 'Beşgen nedir?',
        metin: 'Beşgenin beş kenarı ve beş köşesi vardır.',
        ses: 'Beşgenin beş kenarı var. Beş köşesi var.' },
      { baslik: 'Nerede görürüz?',
        metin: 'Futbol topundaki siyah parçalar, bal peteği ve bazı trafik levhaları beşgendir.',
        ses: 'Futbol topundaki siyah parçalar beşgen. Bal peteği de beşgen.' },
      { baslik: 'Nasıl çizilir?',
        metin: 'Numaraları sırayla takip et: bir, iki, üç, dört, beş, sonra bire dön.',
        ses: 'Numaraları sırayla takip et. Bir, iki, üç, dört, beş. Sonra bire dön.' }
    ]
  },
  altigen: {
    title: 'Altıgen',
    slides: [
      { baslik: 'Altıgen nedir?',
        metin: 'Altıgenin altı kenarı ve altı köşesi vardır. Bal peteği şeklidir.',
        ses: 'Altıgenin altı kenarı var. Altı köşesi var.' },
      { baslik: 'Nerede görürüz?',
        metin: 'Bal peteğinde, kurşun kalemin ucunda ve bazı fayanslarda altıgen görürsün.',
        ses: 'Bal peteğinde altıgen var. Kalemin ucunda da var.' },
      { baslik: 'Nasıl çizilir?',
        metin: 'Numaraları sırayla takip et: bir, iki, üç, dört, beş, altı, sonra bire dön.',
        ses: 'Numaraları sırayla takip et. Birden altıya kadar. Sonra bire dön.' }
    ]
  }
};

/** Dersin kimliği (kaydedilen "görüldü" işareti için) */
export function dersKey(shapeId) { return 'ders-' + shapeId; }

/** Geometriye giriş dersi */
export const GEO_INTRO = {
  title: 'Geometri: Şekiller',
  slides: [
    { baslik: 'Şekiller her yerde',
      metin: 'Etrafındaki her şey bir şekildir. Pencere kare, kapı dikdörtgen, top yuvarlak.',
      ses: 'Etrafındaki her şey bir şekildir. Pencere kare. Kapı dikdörtgen. Top yuvarlak.' },
    { baslik: 'Kenar ve köşe',
      metin: 'Şeklin düz çizgilerine kenar deriz. İki kenarın birleştiği sivri yere köşe deriz.',
      ses: 'Düz çizgilere kenar deriz. Kenarların birleştiği sivri yere köşe deriz.' },
    { baslik: 'Sayarak buluruz',
      metin: 'Bir şeklin kaç kenarı olduğunu sayabiliriz. Kenarı say, köşeyi say.',
      ses: 'Kenarları sayabiliriz. Köşeleri de sayabiliriz.' }
  ]
};

/** Bu şekli öğreten alıştırma bölümünü bul (kilidi aşmak için) */
export function practiceLevelFor(shapeId, worlds) {
  for (const w of worlds) {
    for (const l of w.levels) {
      if (l.type === 'draw' && (l.cfg?.shapes || []).includes(shapeId)) {
        return { world: w, level: l };
      }
    }
  }
  return null;
}
