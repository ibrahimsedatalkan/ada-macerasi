/* ============================================================
   hints.js — Düşünme tekniği öğreten ipuçları
   AMAÇ: Cevabı VERMEZ. Çocuğa "aklından nasıl hesaplanır" öğretir.
   7 yaş / 2. sınıf seviyesine göre yazıldı.
   ============================================================ */

/** Çarpan bazlı akıldan hesap teknikleri (2. sınıf kazanımları) */
const TECHNIQUE = {
  1: {
    name: 'Sayı kendisi kalır',
    teach: '1 ile çarpınca sayı değişmez. Kaç tane var? Sadece 1 tane. O yüzden sonuç sayının kendisi.'
  },
  2: {
    name: 'İki katı = iki tanesini topla',
    teach: '2 ile çarpmak, aynı sayıdan iki tane toplamak demek. Misal 2 × 7 için aklından "7 + 7" de.'
  },
  3: {
    name: 'Üçer üçer ritmik say',
    teach: '3 ile çarpmak, aynı sayıdan üç tane toplamak demek. Misal 3 × 4 için "4 + 4 + 4" de; ya da 3-6-9-12 diye üçer üçer say.'
  },
  4: {
    name: 'İki kere iki katı',
    teach: '4 ile çarpmak = önce 2 ile çarp, sonra sonucu bir daha 2 ile çarp. Misal 4 × 3 için önce 2 × 3 = 6, sonra 6 + 6 = 12.'
  },
  5: {
    name: 'Beşer beşer say',
    teach: '5 ile çarpmak, 5-10-15-20 diye beşer saymak demek. Sonuç her zaman 0 ya da 5 ile biter — cevabını buradan kontrol edebilirsin.'
  },
  6: {
    name: 'Beş katı + bir katı',
    teach: '6 ile çarpmak = 5 katı + 1 katı. Misal 6 × 4 için 5 × 4 = 20, üstüne 4 daha = 24.'
  },
  7: {
    name: 'Beş katı + iki katı',
    teach: '7 ile çarpmak = 5 katı + 2 katı. Misal 7 × 3 için 5 × 3 = 15, 2 × 3 = 6, topla = 21.'
  },
  8: {
    name: 'İki kere iki kere iki katı',
    teach: '8 ile çarpmak = üç kez iki katına çıkarmak. Misal 8 × 2 için 2 → 4 → 8.'
  },
  9: {
    name: 'On katı eksi bir katı',
    teach: '9 ile çarpmak = 10 katı eksi 1 katı. Misal 9 × 4 için 10 × 4 = 40, eksi 4 = 36.'
  },
  10: {
    name: 'Sonuna sıfır ekle',
    teach: '10 ile çarpınca sayının sonuna bir sıfır eklenir. Misal 10 × 6 = 60.'
  }
};

/** Soru tipine göre kısa bir "nasıl düşün" tavsiyesi */
function strategyLine(q) {
  if (q.kind === 'multiply' && q.mode === 'result') {
    return 'İpucu: Büyük sayıyı kolayına gelen tarafa al. 3 × 8 ile 8 × 3 aynı şeydir — hangisini saymak kolaysa onu seç.';
  }
  if (q.kind === 'multiply' && q.mode === 'missing') {
    return 'İpucu: Bu bir bölme sorusu gibi. "Kaç kere ekleyince bu sayı olur?" diye düşün.';
  }
  if (q.kind === 'multiply' && q.mode === 'reverse') {
    return 'İpucu: Çarpma tersine de çalışır. Sonuçtan geriye doğru saymayı dene.';
  }
  return '';
}

/**
 * Çarpım sorusu için düşünme tekniği ipucu.
 * @returns {{name:string, teach:string, strategy:string, countHint:string, canVisual:boolean}}
 */
export function multiplyTechnique(q) {
  if (!q) return null;
  // Zor olan çarpanı öğret: büyük olanı (teknik genelde onun için işe yarar)
  const harder = Math.max(q.a, q.b);
  const easier = Math.min(q.a, q.b);
  const t = TECHNIQUE[harder] || TECHNIQUE[2];

  // Sayma yardımı: sonucu SÖYLEMEZ, kaç adım sayacağını söyler
  const countHint = `Parmaklarınla ${easier}'er ${easier}'er say — ${harder} adım sayacaksın.`;

  return {
    name: t.name,
    teach: t.teach,
    strategy: strategyLine(q),
    countHint,
    // Nokta dizisi yalnızca küçük sayılarda gösterilir (somut destek)
    canVisual: q.a <= 6 && q.b <= 6 && q.mode === 'result'
  };
}

/** Kenar/köşe sorusu için düşünme tekniği (cevabı vermez) */
export function sidesTechnique(q) {
  if (!q) return null;
  if (q.shapeId === 'daire') {
    return { name: 'Dairenin özelliği', teach: 'Dairenin düz kenarı ve köşesi yoktur — sadece yuvarlak bir çizgisi vardır.', countHint: 'Parmağınla dairenin çevresini bir tur dolaş.' };
  }
  const isEdge = q.ask === 'kenar';
  return {
    name: isEdge ? 'Kenar = düz çizgi sayısı' : 'Köşe = sivri uç sayısı',
    teach: isEdge
      ? 'Kenar, şekli oluşturan her bir düz çizgidir. Kalemi bir kenardan başlat, düz gittiğin her çizgiyi say.'
      : 'Köşe, iki kenarın birleştiği sivri uçtur. Parmağınla her sivri uca dokun — dokunduğun her yer bir köşe.',
    countHint: isEdge ? 'Kenarları parmağınla sırayla takip et, her düz çizgide bir say.' : 'Sivri uçları parmağınla işaretle, her işarette bir say.',
    canVisual: true
  };
}

/** Toplama/çıkarma için akıldan hesap teknikleri (2. sınıf) */
export function addsubTechnique(q) {
  if (!q) return null;
  const ikiBasamak = q.a >= 10 || q.b >= 10;
  const eldeVar = q.mode === 'add' && (q.a % 10) + (q.b % 10) >= 10;
  const onlukBoz = q.mode === 'sub' && (q.a % 10) < (q.b % 10);

  if (q.mode === 'add') {
    if (!ikiBasamak) {
      return {
        name: "On'a tamamla",
        teach: 'Önce büyük sayıyı 10’a tamamla, kalanı üstüne ekle. Misal 8 + 7 için: 8 + 2 = 10, kalan 5, sonuç 15.',
        countHint: 'Parmaklarınla 10’a kadar say, sonra kalanı ekle.',
        canVisual: true
      };
    }
    if (eldeVar) {
      return {
        name: 'Elde var — birlerden başla',
        teach: 'Önce birler basamağını topla. Toplam 10’u geçerse "elde 1" deriz ve onlar basamağına ekleriz. Misal 27 + 8: 7 + 8 = 15, yani 5 yaz, elde 1; 20 + 10 = 30, sonuç 35.',
        countHint: 'Sayıyı onluk ve birlik diye ayır: 27 = 20 + 7. Önce birlikleri topla, sonra onlukları.',
        canVisual: false
      };
    }
    return {
      name: 'Onluk + birlik diye ayır',
      teach: 'Sayıyı parçala, kolay parçaları önce topla. Misal 23 + 5: 20 + 3 + 5 = 20 + 8 = 28. Onluklar yerinde kalsın, yalnız birlikleri topla.',
      countHint: 'Önce birler basamağını topla, sonra onluğu yanına koy.',
      canVisual: false
    };
  }

  // Çıkarma
  if (!ikiBasamak) {
    return {
      name: 'Geriye doğru say',
      teach: 'Çıkarırken 10’dan faydalan. Misal 15 − 8 için: 15 − 5 = 10, sonra 10 − 3 = 7.',
      countHint: 'Önce 10’a in, sonra kalanı çıkar.',
      canVisual: true
    };
  }
  if (onlukBoz) {
    return {
      name: 'Onluk boz',
      teach: 'Birler basamağı yetmiyorsa bir onluk bozarız. Misal 32 − 7: 2’den 7 çıkmaz, 30’dan bir onluk bozalım → 12 − 7 = 5, kalan 20, sonuç 25.',
      countHint: 'Önce 10’a tamamla: 32 − 2 = 30, sonra 30 − 5 = 25. Bu genelde daha kolay!',
      canVisual: false
    };
  }
  return {
    name: 'Onlukları ve birlikleri ayrı çıkar',
    teach: 'Onlukları ayrı, birlikleri ayrı çıkar. Misal 48 − 25: 40 − 20 = 20, 8 − 5 = 3, sonuç 23.',
    countHint: 'Sayıyı onluk + birlik diye ayır, ayrı ayrı çıkar, sonra birleştir.',
    canVisual: false
  };
}

/** Soru tipine göre doğru ipucunu döndür */
export function techniqueFor(q) {
  if (!q) return null;
  if (q.kind === 'multiply') return multiplyTechnique(q);
  if (q.kind === 'addsub') return addsubTechnique(q);
  if (q.kind === 'sides') return sidesTechnique(q);
  return null;
}

/** Sesli okunacak kısa ipucu metni (cevabı içermez) */
export function techniqueSpeech(q) {
  const t = techniqueFor(q);
  if (!t) return '';
  return `${t.name}. ${t.teach}`;
}
