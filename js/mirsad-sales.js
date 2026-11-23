// Mirsad Analytics - sales estimate engine (amazon.ae / amazon.sa / amazon.eg)
// Uses only what Amazon shows, never an invented formula:
//  1. "bought in past month" badge, e.g. "200+" -> 200 to 299 units a month.
//  2. A product page we checked (it has a BSR) with no badge -> under 50 a month,
//     because Amazon shows the badge from 50 units up.
//  3. Nothing else -> no estimate.
// Revenue = units x price. Profit = units x (price - Amazon fees - your unit cost).
// Needs mirsad-fees.js for the fee part.

(function (root) {
  // Amazon's badge steps: 50+, 100+, 200+ ... 900+, 1K+, 2K+ ... 9K+, 10K+, 20K+ ...
  function nextStep(n) {
    if (n < 100) return 100;
    if (n < 1000) return n + 100;
    if (n < 10000) return n + 1000;
    return n + 10000;
  }

  // From the saved "bought_min" (e.g. 200) or the badge text ("1K+ bought in past month").
  function boughtMin(snap) {
    if (snap.bought_min) return Number(snap.bought_min);
    var m = String(snap.bought_past_month || '').match(/([\d.,]+)\s*([kK])?\s*\+/);
    if (!m) return null;
    var n = parseFloat(m[1].replace(/,/g, ''));
    return m[2] ? n * 1000 : n;
  }

  // Monthly units as a range. Returns null when there's nothing to go on.
  function units(snap) {
    if (!snap) return null;
    var min = boughtMin(snap);
    if (min) {
      var high = nextStep(min) - 1;
      return { low: min, high: high, mid: Math.round((min + high) / 2), basis: 'badge' };
    }
    if (snap.bsr) return { low: 0, high: 49, mid: 25, basis: 'no-badge' };
    return null;
  }

  // Full estimate for one product. product: {marketplace, category, weight, dimensions}, snap: latest snapshot.
  function estimate(product, snap, unitCost) {
    var u = units(snap);
    if (!u) return null;
    var price = snap.price != null ? Number(snap.price) : null;
    var out = {
      units: u,
      perDay: { low: u.low / 30, high: u.high / 30 },
      price: price,
      currency: snap.currency || null,
      revenue: price != null ? { low: u.low * price, high: u.high * price } : null,
      feesPerUnit: null, feeNote: null, profit: null, profitPerUnit: null
    };
    if (price == null || !root.MirsadFees) return out;
    var mp = String(product.marketplace || '').replace('amazon.', '');
    var fees = root.MirsadFees.calculate({
      marketplace: mp, price: price, fulfillment: 'FBA',
      category: snap.bsr_category || product.category || '',
      weightRaw: product.weight, dimensionsRaw: product.dimensions
    });
    if (fees.amazonFees == null || fees.feeReferralOnly) {
      out.feeNote = 'Weight unknown, so FBA fees could not be worked out.';
      return out;
    }
    out.feesPerUnit = fees.amazonFees;
    if (!product.dimensions) out.feeNote = 'Package size unknown; standard parcel size assumed.';
    if (unitCost != null && unitCost !== '' && !isNaN(unitCost)) {
      var per = price - fees.amazonFees - Number(unitCost);
      out.profitPerUnit = per;
      out.profit = { low: u.low * per, high: u.high * per };
    }
    return out;
  }

  root.MirsadSales = { units: units, estimate: estimate, boughtMin: boughtMin };
})(typeof window !== 'undefined' ? window : globalThis);
