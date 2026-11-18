// Mirsad Analytics - shared Amazon fee engine (amazon.ae / amazon.sa / amazon.eg)
// One source of truth for the website profit calculator AND the Chrome extension.
// Rates transcribed from sell.amazon.ae/pricing, sell.amazon.sa/pricing and
// sell.amazon.eg/pricing, checked 18 Nov 2026. All fees exclude VAT.
// Egypt: Amazon's table still shows promotional FBA rates (12% Apparel/Luggage/Shoes,
// 4.5% Major Appliances/Home Entertainment/TVs) whose footnote says they ran
// 15 Dec 2025 - 30 Jun 2026, so the standard rates (15% / 5%) are used here.

(function (root) {
  var INF = Infinity;
  function F(r, fba) { return { t: 'flat', r: r, fba: fba }; }            // one rate
  function SW(at, lo, hi) { return { t: 'switch', at: at, lo: lo, hi: hi }; } // whole price: <= at -> lo, else hi
  function PT(steps) { return { t: 'portion', steps: steps }; }          // rate per part of the price

  // Category keys, labels and the Amazon "Best Sellers Rank" category text they match.
  // Order matters: more specific categories first.
  var CATS = [
    ['jewelry', 'Jewelry', /jewel/i],
    ['watches', 'Watches', /\bwatch/i],
    ['furniture', 'Furniture', /furniture/i],
    ['elec_acc', 'Electronics accessories', /electronics? accessor|accessories.*electronic/i],
    ['portable_audio', 'Portable audio', /portable audio|headphone|earphone|earbud/i],
    ['wireless', 'Wireless', /wireless/i],
    ['grocery', 'Grocery', /grocery|gourmet|beverage|\bfood/i],
    ['pet', 'Pet products', /\bpet/i],
    ['pca', 'Personal care appliances', /personal care appliance/i],
    ['baby', 'Baby', /\bbaby/i],
    ['beauty', 'Beauty', /beauty|cosmetic|make-?up|skin ?care|hair ?care/i],
    ['perfume', 'Perfume', /perfume|fragrance/i],
    ['health', 'Health & personal care', /health|personal care|household/i],
    ['automotive', 'Automotive', /automotive|motorcycle|vehicle/i],
    ['business', 'Business, industrial & scientific', /business|industrial|scientific/i],
    ['camera', 'Camera', /camera|photo/i],
    ['mobile', 'Mobile phones', /mobile phone|cell phone|smartphone/i],
    ['tv', 'Televisions', /television|\btvs?\b/i],
    ['home_ent', 'Home entertainment', /home entertainment|home theat|home cinema/i],
    ['vg_console', 'Video game consoles', /game console/i],
    ['video_games', 'Video games', /video game|\bgaming/i],
    ['pc', 'Personal computers', /\bpcs?\b|computer|laptop/i],
    ['major_app', 'Major appliances', /major appliance|large appliance/i],
    ['small_app', 'Small appliances', /appliance/i],
    ['electronics', 'Consumer electronics', /electronic/i],
    ['gift_cards', 'Gift cards', /gift card/i],
    ['books', 'Books', /\bbooks?\b/i],
    ['software', 'Software', /software/i],
    ['mus_inst', 'Musical instruments', /musical? instrument/i],
    ['music', 'Music', /\bmusic\b|\bcds?\b|vinyl/i],
    ['office', 'Office products', /office|stationery/i],
    ['outdoor', 'Outdoor', /outdoor|garden|patio|lawn/i],
    ['sports', 'Sports', /sport|fitness|exercise/i],
    ['toys', 'Toys', /\btoy|\bgames\b/i],
    ['video_dvd', 'Video & DVD', /\bdvd|blu-?ray|\bmovie/i],
    ['stamps', 'Stamps & collectibles', /stamp|collectible/i],
    ['tools', 'Tools & home improvement', /\btools?\b|home improvement|\bdiy\b/i],
    ['kitchen', 'Kitchen', /kitchen|dining|cookware/i],
    ['home', 'Home', /\bhome\b/i],
    ['luggage', 'Luggage', /luggage|suitcase/i],
    ['shoes', 'Shoes', /\bshoe|footwear/i],
    ['apparel', 'Apparel / Clothing', /apparel|clothing|fashion/i]
  ];

  // FBA fee steps per tier: [maxKg, fee when price <= band, fee when price > band]
  var MARKETS = {
    ae: {
      currency: 'AED', band: 25, minFee: 1, minExempt: ['grocery', 'pet'], defaultRule: F(0.10),
      rules: {
        jewelry: PT([[1000, 0.16], [INF, 0.05]]), watches: PT([[5000, 0.15], [INF, 0.05]]),
        furniture: PT([[750, 0.15], [INF, 0.10]]), elec_acc: PT([[250, 0.15], [INF, 0.08]]),
        grocery: SW(50, 0.05, 0.11), pet: SW(50, 0.08, 0.15), pca: SW(50, 0.08, 0.15),
        baby: SW(50, 0.08, 0.15), beauty: SW(50, 0.08, 0.15), perfume: F(0.15, 0.13),
        health: SW(50, 0.08, 0.15), automotive: F(0.12), business: F(0.11), camera: F(0.08),
        mobile: F(0.05), home_ent: F(0.05), vg_console: F(0.06), video_games: F(0.15), pc: F(0.06),
        major_app: F(0.06), small_app: F(0.13), electronics: F(0.07), gift_cards: F(0.05),
        books: F(0.15), software: F(0.10), mus_inst: F(0.15), music: F(0.10), office: F(0.14),
        outdoor: F(0.15), sports: F(0.14), toys: F(0.14), video_dvd: F(0.10), stamps: F(0.10),
        tools: F(0.15), kitchen: F(0.15), home: F(0.15), luggage: F(0.15), shoes: F(0.15), apparel: F(0.15)
      },
      fba: {
        small_env: [[0.1, 5.5, 7.5]],
        std_env: [[0.1, 6.0, 8.0], [0.2, 6.2, 8.2], [0.5, 6.5, 8.5]],
        large_env: [[1, 7.0, 7.5]],
        std_parcel: [[0.25, 7.2, 9.2], [0.5, 7.5, 9.5], [1, 8.5, 10.5], [1.5, 9.0, 11.0], [2, 9.5, 11.5], [3, 10.5, 12.5], [4, 11.5, 13.5], [5, 12.5, 14.5], [6, 13.5, 15.5], [7, 14.5, 16.5], [8, 15.5, 17.5], [9, 16.5, 18.5], [10, 17.5, 19.5], [11, 18.5, 20.5], [12, 19.5, 21.5]],
        oversize: [[1, 10.5, 12.5], [2, 11.5, 13.5], [3, 12.5, 14.5], [4, 13.5, 15.5], [5, 14.5, 16.5], [6, 15.5, 17.5], [7, 16.5, 18.5], [8, 17.5, 19.5], [9, 18.5, 20.5], [10, 19.5, 21.5], [15, 24.5, 26.5], [20, 29.5, 31.5], [25, 34.5, 36.5], [30, 39.5, 41.5]],
        perKgOver30: 1
      }
    },
    sa: {
      currency: 'SAR', band: 25, minFee: 1, minExempt: [], defaultRule: F(0.10),
      rules: {
        jewelry: PT([[1000, 0.16], [INF, 0.05]]), watches: PT([[5000, 0.15], [INF, 0.05]]),
        furniture: PT([[750, 0.15], [INF, 0.10]]), elec_acc: PT([[250, 0.15], [INF, 0.08]]),
        wireless: PT([[250, 0.13], [INF, 0.08]]), grocery: SW(25, 0.03, 0.09), pet: F(0.15),
        pca: SW(50, 0.08, 0.13), baby: SW(50, 0.08, 0.15), beauty: SW(50, 0.085, 0.11), perfume: F(0.15),
        health: SW(50, 0.085, 0.11), automotive: F(0.12), camera: F(0.08), mobile: F(0.055),
        home_ent: F(0.065), vg_console: F(0.06), video_games: F(0.14), pc: F(0.06), major_app: F(0.06),
        small_app: F(0.12), electronics: F(0.055), gift_cards: F(0.10), books: F(0.15), mus_inst: F(0.15),
        music: F(0.15), office: F(0.15), outdoor: F(0.14), sports: F(0.13), toys: F(0.14), video_dvd: F(0.13),
        stamps: F(0.10), tools: F(0.14), kitchen: F(0.14), home: F(0.14), luggage: F(0.15), shoes: F(0.15), apparel: F(0.15)
      },
      fba: {
        small_env: [[0.1, 5.5, 7.5]],
        std_env: [[0.1, 6.0, 8.0], [0.2, 6.2, 8.2], [0.5, 6.5, 8.5]],
        large_env: [[1, 7.0, 9.0]],
        std_parcel: [[0.25, 7.2, 9.2], [0.5, 7.5, 9.5], [1, 8.0, 10.0], [1.5, 8.5, 11.5], [2, 9.0, 12.0], [3, 10.0, 13.0], [4, 11.0, 14.0], [5, 12.0, 15.0], [6, 13.0, 16.0], [7, 14.0, 17.0], [8, 15.0, 18.0], [9, 16.0, 19.0], [10, 17.0, 20.0], [11, 18.0, 21.0], [12, 19.0, 22.0]],
        oversize: [[1, 10, 14], [2, 11, 15], [3, 12, 16], [4, 13, 17], [5, 14, 18], [6, 15, 19], [7, 16, 20], [8, 17, 21], [9, 18, 22], [10, 19, 23], [15, 24, 28], [20, 29, 33], [25, 34, 38], [30, 39, 43]],
        perKgOver30: 1
      }
    },
    eg: {
      currency: 'EGP', band: 350, minFee: 5, minExempt: ['grocery'], defaultRule: F(0.10),
      rules: {
        jewelry: PT([[5000, 0.19], [INF, 0.05]]), watches: F(0.12), furniture: F(0.13),
        elec_acc: PT([[1000, 0.15], [INF, 0.08]]), portable_audio: PT([[1000, 0.15], [INF, 0.08]]),
        wireless: PT([[1000, 0.15], [INF, 0.08]]), grocery: PT([[250, 0.04], [INF, 0.10]]), pet: F(0.14),
        pca: F(0.11), baby: F(0.09), beauty: F(0.12), perfume: F(0.13), health: F(0.115), automotive: F(0.12),
        camera: F(0.07), mobile: F(0.045), tv: F(0.05), home_ent: F(0.05), vg_console: F(0.04),
        video_games: F(0.10), pc: F(0.04), major_app: F(0.05), small_app: F(0.07), electronics: F(0.08),
        gift_cards: F(0.10), books: F(0.07), software: F(0.10), mus_inst: F(0.12), music: F(0.10),
        office: F(0.12), outdoor: F(0.13), sports: F(0.115), toys: F(0.13), video_dvd: F(0.11), stamps: F(0.10),
        tools: F(0.11), kitchen: F(0.115), home: F(0.13), luggage: F(0.15), shoes: F(0.15), apparel: F(0.15)
      },
      fba: {
        small_env: [[0.1, 19.5, 24.5]],
        std_env: [[0.1, 19.5, 24.5], [0.25, 19.5, 24.5], [0.5, 20.5, 25.5]],
        large_env: [[1, 21, 26]],
        std_parcel: [[0.25, 19.5, 24.5], [0.5, 20.5, 25.5], [1, 21, 26], [1.5, 22, 27], [2, 22.5, 27.5], [3, 23.5, 28.5], [4, 24.5, 29.5], [5, 25.5, 30.5], [6, 26.5, 31.5], [7, 27.5, 32.5], [8, 28.5, 33.5], [9, 29.5, 34.5], [10, 30.5, 35.5], [11, 31.5, 36.5], [12, 32.5, 37.5]],
        oversize: [[1, 25, 30], [2, 27, 32], [3, 29, 34], [4, 31, 36], [5, 33, 38], [6, 35, 40], [7, 37, 42], [8, 39, 44], [9, 41, 46], [10, 43, 48], [15, 53, 58], [20, 63, 68], [25, 73, 78], [30, 83, 88]],
        perKgOver30: 2
      }
    }
  };

  var TIERS = [
    { key: 'small_env', label: 'Small envelope', dims: [20, 15, 1], kg: 0.1 },
    { key: 'std_env', label: 'Standard envelope', dims: [33, 23, 2.5], kg: 0.5 },
    { key: 'large_env', label: 'Large envelope', dims: [33, 23, 5], kg: 1 },
    { key: 'std_parcel', label: 'Standard parcel', dims: [45, 34, 26], kg: 12 },
    { key: 'oversize', label: 'Oversize', dims: null, kg: 30 }
  ];

  function market(mp) { return MARKETS[mp] || MARKETS.ae; }

  function categoriesFor(mp) {
    var m = market(mp), out = [{ key: 'default', label: 'All other categories' }];
    CATS.forEach(function (c) { if (m.rules[c[0]]) out.push({ key: c[0], label: c[1] }); });
    return out;
  }

  // Match an Amazon category string (e.g. "Home & Kitchen") to a fee category key for this marketplace.
  function categoryKey(categoryText, mp) {
    var m = market(mp), text = categoryText || '';
    for (var i = 0; i < CATS.length; i++) {
      if (m.rules[CATS[i][0]] && CATS[i][2].test(text)) return CATS[i][0];
    }
    return 'default';
  }

  function referralFee(price, key, mp, isFBA) {
    var m = market(mp), rule = m.rules[key] || m.defaultRule, fee;
    if (rule.t === 'flat') fee = price * (isFBA && rule.fba ? rule.fba : rule.r);
    else if (rule.t === 'switch') fee = price * (price <= rule.at ? rule.lo : rule.hi);
    else {
      fee = 0;
      var lower = 0;
      for (var i = 0; i < rule.steps.length; i++) {
        var s = rule.steps[i];
        fee += Math.max(0, Math.min(price, s[0]) - lower) * s[1];
        lower = s[0];
        if (price <= s[0]) break;
      }
    }
    var exempt = m.minExempt.indexOf(key) !== -1;
    return exempt ? fee : Math.max(fee, m.minFee);
  }

  // Size tier from weight (kg) and, when known, dimensions in cm [a, b, c].
  function detectTier(kg, dimsCm) {
    if (dimsCm && dimsCm.length === 3) {
      var d = dimsCm.slice().sort(function (a, b) { return b - a; });
      for (var i = 0; i < TIERS.length - 1; i++) {
        var t = TIERS[i];
        if (kg <= t.kg && d[0] <= t.dims[0] && d[1] <= t.dims[1] && d[2] <= t.dims[2]) return t.key;
      }
      return 'oversize';
    }
    return kg <= 12 ? 'std_parcel' : 'oversize';
  }

  // FBA fulfilment fee per unit. Returns null if the weight doesn't fit the tier.
  function fbaFee(tierKey, kg, price, mp) {
    var m = market(mp), steps = m.fba[tierKey], hi = price > m.band;
    if (!steps || kg == null || kg < 0) return null;
    for (var i = 0; i < steps.length; i++) {
      if (kg <= steps[i][0]) return hi ? steps[i][2] : steps[i][1];
    }
    if (tierKey === 'oversize') {
      var last = steps[steps.length - 1];
      return (hi ? last[2] : last[1]) + Math.ceil(kg - 30) * m.fba.perKgOver30;
    }
    return null;
  }

  function parseWeightToKg(weightRaw) {
    if (!weightRaw) return null;
    var match = String(weightRaw)
      .replace(/[‎‏]/g, '')
      .match(/([\d.]+)\s*(hundredths?\s*pounds?|kilograms?|kg|pounds?|lbs?|ounces?|oz|grams?|g|كيلوجرام|كيلوغرام|كجم|كغ|جرام|غرام|جم|غ)(?![a-z])/i);
    if (!match) return null;
    var value = parseFloat(match[1]), unit = match[2].toLowerCase();
    if (unit.indexOf('kilo') === 0 || unit === 'kg' || unit.charAt(0) === 'ك') return value;
    if (unit.indexOf('hundredth') === 0) return value * 0.01 * 0.453592;
    if (unit.indexOf('pound') === 0 || unit.indexOf('lb') === 0) return value * 0.453592;
    if (unit.indexOf('ounce') === 0 || unit === 'oz') return value * 0.0283495;
    if (unit.indexOf('gram') === 0 || unit === 'g' || /^[جغ]/.test(unit)) return value / 1000;
    return null;
  }

  // "173L x 61W x 0.4Th centimeters", "20 x 10 x 5 cm; 350 g", "8 x 4 x 2 inches" -> [cm, cm, cm]
  function parseDimsCm(dimsRaw) {
    if (!dimsRaw) return null;
    var s = String(dimsRaw).replace(/[‎‏]/g, '').split(';')[0];
    var nums = s.match(/[\d.]+/g);
    if (!nums || nums.length < 3) return null;
    var f = /inch|\bin\b|"/i.test(s) ? 2.54 : /millim|\bmm\b/i.test(s) ? 0.1 : /\bm\b|meter|metre/i.test(s) && !/centi/i.test(s) ? 100 : 1;
    return nums.slice(0, 3).map(function (n) { return parseFloat(n) * f; });
  }

  function tierLabel(key) {
    for (var i = 0; i < TIERS.length; i++) if (TIERS[i].key === key) return TIERS[i].label;
    return null;
  }

  // Extension API: fees for one listing.
  function calculate(o) {
    var mp = o.marketplace;
    if (o.price == null) return { amazonFees: null, netRevenue: null };
    var isFBA = o.fulfillment === 'FBA';
    var ref = referralFee(o.price, categoryKey(o.category, mp), mp, isFBA);
    if (!isFBA) return { amazonFees: ref, netRevenue: o.price - ref, feeReferralOnly: false };
    var kg = parseWeightToKg(o.weightRaw);
    if (kg == null) return { amazonFees: ref, netRevenue: null, feeReferralOnly: true };
    var fee = fbaFee(detectTier(kg, parseDimsCm(o.dimensionsRaw)), kg, o.price, mp);
    if (fee == null) return { amazonFees: null, netRevenue: null };
    var total = ref + fee;
    return { amazonFees: total, netRevenue: o.price - total, feeReferralOnly: false };
  }

  function sizeTier(weightRaw, mp, dimensionsRaw) {
    var kg = parseWeightToKg(weightRaw);
    if (kg == null) return null;
    return tierLabel(detectTier(kg, parseDimsCm(dimensionsRaw)));
  }

  root.MirsadFees = {
    MARKETS: MARKETS, TIERS: TIERS, categoriesFor: categoriesFor, categoryKey: categoryKey,
    referralFee: referralFee, detectTier: detectTier, fbaFee: fbaFee, tierLabel: tierLabel,
    parseWeightToKg: parseWeightToKg, parseDimsCm: parseDimsCm, calculate: calculate, sizeTier: sizeTier
  };
})(typeof window !== 'undefined' ? window : globalThis);
