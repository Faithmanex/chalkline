/*!
 * Chalkline — domain model for a tailoring shop.
 * Clients, people, measurement sets, orders, bookings, money.
 * Pure logic, no DOM: runs in the browser (window.Chalkline) and in node (require).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Chalkline = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  /* ------------------------------------------------------------------ garments */

  // Points live on a 100 x 140 figure so a measurement can be pinned on the body.
  const GARMENTS = {
    shirt: {
      label: 'Shirt',
      blurb: 'Collar to cuff, with a clean hem.',
      outline: [
        'M32,29 L44,26 L50,30 L56,26 L68,29 L72,33 L70,56 L64,56 L64,86 L36,86 L36,56 L30,56 L28,33 Z',
        'M44,26 L50,33 L56,26',
      ],
      fields: [
        { key: 'neck', label: 'Neck', hint: 'Around the base of the neck, one finger of ease.', pt: [50, 23], core: true },
        { key: 'shoulder', label: 'Shoulder', hint: 'Across the back, shoulder point to shoulder point.', pt: [34, 28], core: true },
        { key: 'chest', label: 'Chest', hint: 'Fullest part of the chest, tape level under the arms.', pt: [50, 42], core: true },
        { key: 'waist', label: 'Waist', hint: 'Natural waist, where the body creases when you bend.', pt: [50, 56] },
        { key: 'seat', label: 'Seat', hint: 'Fullest part of the seat, tape level.', pt: [50, 66] },
        { key: 'length', label: 'Shirt length', hint: 'Side of the neck down to the hem you want.', pt: [50, 80], core: true },
        { key: 'sleeve', label: 'Sleeve', hint: 'Shoulder point to wrist, arm slightly bent.', pt: [27, 68], core: true },
        { key: 'bicep', label: 'Bicep', hint: 'Around the fullest part of the upper arm.', pt: [30, 40] },
        { key: 'cuff', label: 'Cuff', hint: 'Around the wrist where the cuff closes.', pt: [27, 74] },
      ],
      style: { collar: ['Classic', 'Cutaway', 'Mandarin', 'Button-down'], cuff: ['Button', 'French', 'Convertible'], fit: ['Slim', 'Regular', 'Relaxed'], pocket: ['None', 'One', 'Two'] },
    },
    kurta: {
      label: 'Kurta',
      blurb: 'Long tunic, straight or with side slits.',
      outline: ['M32,29 L44,26 L50,31 L56,26 L68,29 L71,34 L69,98 L31,98 L29,34 Z', 'M44,26 L50,34 L56,26', 'M36,28 L36,92 M64,28 L64,92'],
      fields: [
        { key: 'neck', label: 'Neck', hint: 'Base of the neck; note the neckline you want.', pt: [50, 23], core: true },
        { key: 'shoulder', label: 'Shoulder', hint: 'Shoulder point to shoulder point.', pt: [34, 28], core: true },
        { key: 'chest', label: 'Chest', hint: 'Fullest chest, tape under the arms.', pt: [50, 42], core: true },
        { key: 'waist', label: 'Waist', hint: 'Natural waist.', pt: [50, 56] },
        { key: 'seat', label: 'Seat', hint: 'Fullest part of the seat.', pt: [50, 67] },
        { key: 'length', label: 'Kurta length', hint: 'Neck to hem — knee, mid-calf or full length.', pt: [50, 92], core: true },
        { key: 'sleeve', label: 'Sleeve', hint: 'Shoulder point to wrist (or elbow for half sleeve).', pt: [27, 68], core: true },
        { key: 'bicep', label: 'Bicep', hint: 'Around the upper arm.', pt: [30, 40] },
        { key: 'hem', label: 'Hem width', hint: 'Flat across the hem you want.', pt: [40, 95] },
      ],
      style: { neckline: ['Ban collar', 'Round', 'V', 'Collar'], fit: ['Straight', 'A-line'], slit: ['None', 'Side slits'], sleeves: ['Full', 'Half', 'Three-quarter'] },
    },
    trouser: {
      label: 'Trouser',
      blurb: 'Waist, rise, inseam, and the break you want.',
      outline: ['M36,62 L64,62 L63,90 L61,128 L52,128 L50,92 L48,128 L39,128 L37,90 Z', 'M36,66 L64,66'],
      fields: [
        { key: 'waist', label: 'Waist', hint: 'Where the trouser sits — high or on the hip.', pt: [50, 64], core: true },
        { key: 'seat', label: 'Seat', hint: 'Fullest part of the seat.', pt: [50, 71], core: true },
        { key: 'thigh', label: 'Thigh', hint: 'Around the fullest part of the thigh.', pt: [43, 80] },
        { key: 'knee', label: 'Knee', hint: 'Around the knee, slightly bent.', pt: [43, 100] },
        { key: 'bottom', label: 'Bottom', hint: 'Flat across the hem you want.', pt: [43, 126], core: true },
        { key: 'inseam', label: 'Inseam', hint: 'Crotch seam to the hem.', pt: [49, 110], core: true },
        { key: 'outseam', label: 'Outseam', hint: 'Waistband to hem along the side.', pt: [36, 110], core: true },
        { key: 'rise', label: 'Rise', hint: 'Front waistband to crotch seam.', pt: [50, 74] },
      ],
      style: { fit: ['Slim', 'Straight', 'Bootcut'], waist: ['Standard', 'Extended'], pleats: ['Flat front', 'Single pleat', 'Double pleat'], hem: ['Plain', 'Turn-up'] },
    },
    blazer: {
      label: 'Blazer / suit',
      blurb: 'Lapel, armhole, canvas — the shop piece.',
      outline: [
        'M32,29 L44,27 L50,42 L56,27 L68,29 L72,34 L70,82 L60,82 L58,50 L58,84 L42,84 L42,50 L40,82 L30,82 L28,34 Z',
        'M44,27 L50,42 L56,27',
      ],
      fields: [
        { key: 'chest', label: 'Chest', hint: 'Fullest chest, tape under the arms.', pt: [50, 44], core: true },
        { key: 'waist', label: 'Waist', hint: 'Natural waist — the button point.', pt: [50, 58], core: true },
        { key: 'seat', label: 'Seat', hint: 'Fullest part of the seat.', pt: [50, 68] },
        { key: 'shoulder', label: 'Shoulder', hint: 'Shoulder point to shoulder point.', pt: [34, 28], core: true },
        { key: 'sleeve', label: 'Sleeve', hint: 'Shoulder point to wrist bone.', pt: [27, 68], core: true },
        { key: 'backLength', label: 'Back length', hint: 'Collar seam to the jacket hem.', pt: [50, 78], core: true },
        { key: 'armhole', label: 'Armhole', hint: 'Around the arm, over the shoulder.', pt: [31, 42] },
        { key: 'bicep', label: 'Bicep', hint: 'Around the upper arm.', pt: [30, 44] },
        { key: 'cuff', label: 'Cuff', hint: 'Around the wrist, room for a shirt cuff.', pt: [27, 74] },
      ],
      style: { lapel: ['Notch', 'Peak', 'Shawl'], buttons: ['One', 'Two', 'Double-breasted'], vents: ['None', 'Single', 'Double'], lining: ['Full', 'Half', 'Unlined'] },
    },
    dress: {
      label: 'Dress',
      blurb: 'Bodice, waist, and the flare.',
      outline: ['M34,30 L44,27 L50,32 L56,27 L66,30 L64,46 L62,58 Q50,64 38,58 L36,46 Z', 'M38,58 Q50,66 62,58 L68,122 L32,122 Z'],
      fields: [
        { key: 'bust', label: 'Bust', hint: 'Fullest part of the bust, tape level.', pt: [50, 42], core: true },
        { key: 'underbust', label: 'Underbust', hint: 'Directly under the bust.', pt: [50, 50] },
        { key: 'waist', label: 'Waist', hint: 'Natural waist.', pt: [50, 57], core: true },
        { key: 'hip', label: 'Hip', hint: 'Fullest part of the hip, 20cm below the waist.', pt: [50, 68], core: true },
        { key: 'shoulder', label: 'Shoulder', hint: 'Shoulder point to shoulder point.', pt: [34, 29] },
        { key: 'sleeve', label: 'Sleeve', hint: 'Shoulder point to wrist.', pt: [27, 68] },
        { key: 'length', label: 'Dress length', hint: 'Shoulder to hem.', pt: [50, 116], core: true },
        { key: 'neckDepth', label: 'Neck depth', hint: 'Front neck depth you want.', pt: [50, 34] },
      ],
      style: { neckline: ['Round', 'V', 'Sweetheart', 'Square'], back: ['Closed', 'Keyhole', 'Low'], flare: ['A-line', 'Straight', 'Fit and flare'], lining: ['Lined', 'Unlined'] },
    },
    abaya: {
      label: 'Abaya / kaftan',
      blurb: 'Long line, generous sleeve, clean front.',
      outline: ['M32,28 L44,25 L50,31 L56,25 L68,28 L74,42 L76,126 L24,126 L26,42 Z', 'M44,25 L50,33 L56,25'],
      fields: [
        { key: 'shoulder', label: 'Shoulder', hint: 'Shoulder point to shoulder point.', pt: [34, 28], core: true },
        { key: 'bust', label: 'Bust', hint: 'Fullest part of the bust.', pt: [50, 42], core: true },
        { key: 'waist', label: 'Waist', hint: 'Natural waist, with the ease you want.', pt: [50, 56] },
        { key: 'hip', label: 'Hip', hint: 'Fullest part of the hip.', pt: [50, 68], core: true },
        { key: 'length', label: 'Length', hint: 'Shoulder to hem — floor or ankle.', pt: [50, 120], core: true },
        { key: 'sleeve', label: 'Sleeve', hint: 'Shoulder point to wrist.', pt: [27, 68], core: true },
        { key: 'neckWidth', label: 'Neck width', hint: 'Across the neckline opening.', pt: [50, 21] },
        { key: 'frontOpening', label: 'Front opening', hint: 'Length of the front slit or zip.', pt: [50, 50] },
      ],
      style: { front: ['Closed', 'Open front', 'Half zip'], sleeve: ['Straight', 'Bell', 'Cuff'], lining: ['Lined', 'Unlined'] },
    },
    alteration: {
      label: 'Alteration',
      blurb: 'Fitting work — no measurements required.',
      outline: ['M36,30 L50,34 L64,30 L70,44 L62,52 L60,86 L40,86 L38,52 L30,44 Z'],
      fields: [],
      style: { work: ['Take in', 'Let out', 'Shorten', 'Lengthen', 'Repair', 'Reshape'] },
    },
  };

  const GARMENT_KEYS = Object.keys(GARMENTS);

  const STAGES = [
    { key: 'booked', label: 'Booked', hint: 'Measurements taken, fabric chosen.' },
    { key: 'cut', label: 'Cutting', hint: 'Pattern laid, cloth cut.' },
    { key: 'stitch', label: 'Stitching', hint: 'At the machine.' },
    { key: 'trial', label: 'Trial', hint: 'Client fitting, pins in.' },
    { key: 'finish', label: 'Finishing', hint: 'Buttonholes, press, QC.' },
    { key: 'ready', label: 'Ready', hint: 'Waiting for pickup.' },
    { key: 'delivered', label: 'Delivered', hint: 'Out the door, balance settled.' },
  ];
  const STAGE_KEYS = STAGES.map((s) => s.key);
  const BOARD_STAGES = ['cut', 'stitch', 'trial', 'finish', 'ready'];

  const SERVICES = [
    { key: 'measure', label: 'Measure me for a new order', minutes: 30 },
    { key: 'fitting', label: 'Fitting / trial', minutes: 20 },
    { key: 'alteration', label: 'Alteration drop-off', minutes: 15 },
    { key: 'consult', label: 'Design consultation', minutes: 30 },
  ];

  const CURRENCIES = {
    PKR: { symbol: 'Rs ', label: 'PKR — Pakistani rupee' },
    INR: { symbol: '₹', label: 'INR — Indian rupee' },
    GBP: { symbol: '£', label: 'GBP — pound' },
    USD: { symbol: '$', label: 'USD — dollar' },
    AED: { symbol: 'AED ', label: 'AED — dirham' },
    EUR: { symbol: '€', label: 'EUR — euro' },
    NGN: { symbol: '₦', label: 'NGN — naira' },
    ZAR: { symbol: 'R', label: 'ZAR — rand' },
    CAD: { symbol: 'C$', label: 'CAD — Canadian dollar' },
  };

  /* -------------------------------------------------------------------- utils */

  const round = (n, dp) => {
    const f = Math.pow(10, dp == null ? 2 : dp);
    return Math.round((Number(n) + Number.EPSILON) * f) / f;
  };
  const uid = (p) => (p || 'x') + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-3);
  const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, Number(n) || 0));

  const todayISO = (d) => {
    const dt = d ? new Date(d) : new Date();
    return new Date(dt.getTime() - dt.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  };
  const addDaysISO = (iso, days) => {
    const d = new Date(iso + 'T12:00:00');
    d.setDate(d.getDate() + Number(days || 0));
    return todayISO(d);
  };
  const dayDiff = (a, b) => {
    const A = new Date(a + 'T12:00:00').getTime();
    const B = new Date(b + 'T12:00:00').getTime();
    return Math.round((A - B) / 86400000);
  };
  const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  function fmtDate(iso, opts) {
    if (!iso) return '—';
    const d = new Date(iso + 'T12:00:00');
    if (isNaN(d)) return '—';
    if (opts && opts.long) return WEEKDAYS[d.getDay()] + ' ' + d.getDate() + ' ' + MONTHS[d.getMonth()] + ' ' + d.getFullYear();
    return d.getDate() + ' ' + MONTHS[d.getMonth()];
  }

  function money(amount, stateOrCode) {
    const code = typeof stateOrCode === 'string' ? stateOrCode : (stateOrCode && stateOrCode.shop && stateOrCode.shop.currency) || 'PKR';
    const cur = CURRENCIES[code] || CURRENCIES.PKR;
    const value = round(Number(amount) || 0, 0);
    const neg = value < 0;
    const grouped = String(Math.abs(value)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return (neg ? '-' : '') + cur.symbol + grouped;
  }

  function length(value, unit) {
    if (value == null || value === '' || isNaN(Number(value))) return '—';
    const n = round(Number(value), 2);
    const s = String(n).replace(/\.0+$/, '').replace(/(\.\d)0$/, '$1');
    return s + (unit === 'cm' ? ' cm' : '"');
  }

  function convert(value, from, to) {
    if (from === to) return Number(value) || 0;
    if (from === 'in' && to === 'cm') return round((Number(value) || 0) * 2.54, 2);
    if (from === 'cm' && to === 'in') return round((Number(value) || 0) / 2.54, 2);
    return Number(value) || 0;
  }

  /** Last 10 digits: makes +92 300… and 0300… the same client. */
  function phoneKey(phone) {
    return String(phone || '').replace(/\D/g, '').slice(-10);
  }

  function waLink(phone, text) {
    const digits = String(phone || '').replace(/[^\d+]/g, '').replace(/^\+/, '');
    if (!digits) return '';
    return 'https://wa.me/' + digits + (text ? '?text=' + encodeURIComponent(text) : '');
  }

  /* ------------------------------------------------------------------ defaults */

  function blankState() {
    return {
      v: 1,
      shop: {
        name: '',
        tagline: 'Bespoke tailoring',
        phone: '',
        whatsapp: '',
        address: '',
        currency: 'PKR',
        units: 'in',
        openHour: 10,
        closeHour: 19,
        slotMinutes: 30,
        closedDays: [0],
        monogram: '',
      },
      plan: { tier: 'free', trialStarted: Date.now(), ordersCreated: 0, checkoutUrl: '' },
      numbering: { next: 1042 },
      clients: [],
      orders: [],
      bookings: [],
      seen: false,
    };
  }

  function hydrate(raw) {
    const base = blankState();
    if (!raw || typeof raw !== 'object') return base;
    const state = {
      v: 1,
      shop: Object.assign(base.shop, raw.shop || {}),
      plan: Object.assign(base.plan, raw.plan || {}),
      numbering: Object.assign(base.numbering, raw.numbering || {}),
      clients: Array.isArray(raw.clients) ? raw.clients : [],
      orders: Array.isArray(raw.orders) ? raw.orders : [],
      bookings: Array.isArray(raw.bookings) ? raw.bookings : [],
      seen: !!raw.seen,
    };
    return state;
  }

  const KEY = 'chalkline.v1';
  function storage() {
    try {
      if (typeof localStorage !== 'undefined') return localStorage;
    } catch (e) {}
    return null;
  }
  function load() {
    const ls = storage();
    if (!ls) return blankState();
    try {
      return hydrate(JSON.parse(ls.getItem(KEY) || 'null'));
    } catch (e) {
      return blankState();
    }
  }
  function save(state) {
    const ls = storage();
    if (!ls) return false;
    try {
      ls.setItem(KEY, JSON.stringify(state));
      return true;
    } catch (e) {
      return false;
    }
  }

  /* ------------------------------------------------------------------- people */

  function newClient(input) {
    const data = input || {};
    return {
      id: uid('c'),
      name: (data.name || '').trim(),
      phone: (data.phone || '').trim(),
      email: (data.email || '').trim(),
      address: (data.address || '').trim(),
      notes: (data.notes || '').trim(),
      createdAt: Date.now(),
      people: [
        {
          id: uid('p'),
          name: (data.name || '').trim() || 'Self',
          relation: 'Self',
          measures: {},
        },
      ],
    };
  }

  function addPerson(client, name, relation) {
    const person = { id: uid('p'), name: String(name || '').trim() || 'Unnamed', relation: String(relation || '').trim() || 'Family', measures: {} };
    client.people.push(person);
    return person;
  }

  function latestMeasurement(person, garment) {
    const set = person && person.measures ? person.measures[garment] : null;
    return set || null;
  }

  /** Saves a new measurement version, keeping the previous one in history. */
  function saveMeasurement(person, garment, unit, values, by) {
    if (!person.measures) person.measures = {};
    const prev = person.measures[garment];
    const clean = {};
    const fields = (GARMENTS[garment] || {}).fields || [];
    for (const f of fields) {
      const v = values[f.key];
      if (v !== '' && v != null && !isNaN(Number(v))) clean[f.key] = round(Number(v), 2);
    }
    const entry = { unit: unit === 'cm' ? 'cm' : 'in', values: clean, at: Date.now(), by: by || '', note: '' };
    if (prev) {
      entry.history = [{ unit: prev.unit, values: prev.values, at: prev.at, by: prev.by }].concat(prev.history || []).slice(0, 12);
    }
    person.measures[garment] = entry;
    return entry;
  }

  /** Values in the set's own unit, converted for display in the target unit. */
  function measurementsIn(entry, targetUnit) {
    if (!entry) return {};
    const out = {};
    for (const k of Object.keys(entry.values || {})) out[k] = convert(entry.values[k], entry.unit, targetUnit || entry.unit);
    return out;
  }

  function missingCore(garment, values) {
    const def = GARMENTS[garment];
    if (!def) return [];
    return def.fields.filter((f) => f.core && (values[f.key] == null || values[f.key] === '')).map((f) => f.label);
  }

  /* ------------------------------------------------------------------- orders */

  function newOrderNumber(state) {
    const n = (state.numbering && state.numbering.next) || 1042;
    if (state.numbering) state.numbering.next = n + 1;
    return '#' + n;
  }

  function newGarment(kind, opts) {
    const o = opts || {};
    const def = GARMENTS[kind] || GARMENTS.shirt;
    return {
      id: uid('g'),
      kind: def === GARMENTS[kind] ? kind : 'shirt',
      qty: Math.max(1, Number(o.qty) || 1),
      price: Math.max(0, Number(o.price) || 0),
      measurements: o.measurements || null,
      style: o.style || {},
      fabric: o.fabric || { name: '', colour: '', metres: '', supplier: '' },
      notes: o.notes || '',
    };
  }

  function createOrder(state, input) {
    const data = input || {};
    const client = state.clients.find((c) => c.id === data.clientId) || null;
    const personId = data.personId || (client && client.people[0] && client.people[0].id) || null;
    const person = client ? client.people.find((p) => p.id === personId) : null;
    const today = data.bookedAt || todayISO();
    const dueDate = data.dueDate || addDaysISO(today, 10);
    const garments = (data.garments || []).map((g) => {
      const def = GARMENTS[g.kind] ? g.kind : 'shirt';
      const set = g.measurements || (person ? person.measures[def] : null) || null;
      return newGarment(def, Object.assign({}, g, { measurements: set ? snapshot(set) : null }));
    });
    const order = {
      id: uid('o'),
      number: data.number || newOrderNumber(state),
      clientId: data.clientId || null,
      personId: person ? person.id : null,
      personName: person ? person.name : data.personName || '',
      garments,
      stage: STAGE_KEYS.indexOf(data.stage) > -1 ? data.stage : 'booked',
      priority: data.priority === 'rush' ? 'rush' : 'normal',
      dueDate,
      trialDate: data.trialDate || '',
      bookedAt: new Date().toISOString(),
      payments: [],
      discount: Math.max(0, Number(data.discount) || 0),
      notes: data.notes || '',
      assignee: data.assignee || '',
      board: data.board || null,
      timeline: [{ at: new Date().toISOString(), text: 'Order opened at booking' }],
      source: data.source || 'counter',
    };
    if (Number(data.deposit) > 0) {
      order.payments.push({ id: uid('pay'), amount: Number(data.deposit), at: new Date().toISOString(), method: data.depositMethod || 'cash' });
    }
    state.orders.unshift(order);
    if (state.plan) state.plan.ordersCreated = (state.plan.ordersCreated || 0) + 1;
    return order;
  }

  function snapshot(entry) {
    return { unit: entry.unit, values: Object.assign({}, entry.values), at: entry.at, by: entry.by || '' };
  }

  function orderTotal(order) {
    const items = (order.garments || []).reduce((sum, g) => sum + (Number(g.price) || 0) * (Number(g.qty) || 1), 0);
    return round(Math.max(0, items - (Number(order.discount) || 0)), 2);
  }
  function orderPaid(order) {
    return round((order.payments || []).reduce((s, p) => s + (Number(p.amount) || 0), 0), 2);
  }
  function orderBalance(order) {
    return round(Math.max(0, orderTotal(order) - orderPaid(order)), 2);
  }
  function garmentCount(order) {
    return (order.garments || []).reduce((s, g) => s + (Number(g.qty) || 1), 0);
  }

  function stageIndex(stage) {
    const i = STAGE_KEYS.indexOf(stage);
    return i < 0 ? 0 : i;
  }
  function nextStage(stage) {
    const i = stageIndex(stage);
    return STAGE_KEYS[Math.min(STAGE_KEYS.length - 1, i + 1)];
  }
  function advanceOrder(order, note) {
    const from = order.stage;
    order.stage = nextStage(from);
    if (order.stage === 'delivered') order.deliveredAt = new Date().toISOString();
    order.timeline = order.timeline || [];
    order.timeline.push({ at: new Date().toISOString(), text: note || 'Moved to ' + stageLabel(order.stage) });
    return order.stage;
  }
  function stageLabel(key) {
    const s = STAGES.find((x) => x.key === key);
    return s ? s.label : key;
  }

  /** Deadline state used for every due chip in the app. */
  function dueInfo(order, today) {
    const ref = today || todayISO();
    if (order.stage === 'delivered') return { key: 'done', label: 'Delivered', days: 0, sort: 9999 };
    const days = dayDiff(order.dueDate, ref);
    if (days < 0) return { key: 'overdue', label: Math.abs(days) + 'd late', days, sort: days };
    if (days === 0) return { key: 'today', label: 'Due today', days, sort: 0 };
    if (days === 1) return { key: 'soon', label: 'Tomorrow', days, sort: 1 };
    if (days <= 7) return { key: 'soon', label: 'In ' + days + ' days', days, sort: days };
    return { key: 'later', label: fmtDate(order.dueDate), days, sort: days };
  }

  function orderSearch(order, state, query) {
    if (!query) return true;
    const client = state.clients.find((c) => c.id === order.clientId);
    const hay = [
      order.number,
      order.personName,
      client && client.name,
      client && client.phone,
      order.assignee,
      order.notes,
      (order.garments || []).map((g) => (GARMENTS[g.kind] || {}).label + ' ' + (g.notes || '') + ' ' + ((g.fabric && g.fabric.name) || '')).join(' '),
    ].join(' ').toLowerCase();
    return hay.indexOf(String(query).toLowerCase()) > -1;
  }

  /* ------------------------------------------------------------------- money */

  function monthKey(iso) {
    return String(iso).slice(0, 7);
  }
  function stats(state, month) {
    const m = month || todayISO().slice(0, 7);
    let booked = 0;
    let collected = 0;
    let delivered = 0;
    let outstanding = 0;
    let rush = 0;
    const perGarment = {};
    for (const o of state.orders) {
      const total = orderTotal(o);
      const created = o.bookedAt ? String(o.bookedAt).slice(0, 7) : monthKey(o.dueDate);
      if (created === m) {
        booked += total;
        for (const g of o.garments || []) perGarment[g.kind] = (perGarment[g.kind] || 0) + (Number(g.price) || 0) * (Number(g.qty) || 1);
        if (o.priority === 'rush') rush++;
      }
      for (const p of o.payments || []) if (monthKey(p.at) === m) collected += Number(p.amount) || 0;
      if (o.stage === 'delivered' && o.deliveredAt && monthKey(o.deliveredAt) === m) delivered++;
      if (o.stage !== 'delivered') outstanding += orderBalance(o);
    }
    return { month: m, booked: round(booked), collected: round(collected), delivered, outstanding: round(outstanding), rush, perGarment };
  }

  function overdueOrders(state, today) {
    return state.orders.filter((o) => o.stage !== 'delivered' && orderBalance(o) > 0 && dueInfo(o, today).key === 'overdue');
  }

  /* ------------------------------------------------------------------ bookings */

  function slotsFor(dateISO, shop, taken) {
    const d = new Date(dateISO + 'T12:00:00');
    const closed = (shop.closedDays || []).indexOf(d.getDay()) > -1;
    const step = Number(shop.slotMinutes) || 30;
    const open = Number(shop.openHour) || 10;
    const close = Number(shop.closeHour) || 19;
    const out = [];
    for (let h = open; h < close; h++) {
      for (let m = 0; m < 60; m += step) {
        const hh = String(h).padStart(2, '0');
        const mm = String(m).padStart(2, '0');
        const slot = hh + ':' + mm;
        out.push({ slot, taken: closed || (taken || []).indexOf(slot) > -1, closed });
      }
    }
    return out;
  }

  function takenSlots(state, dateISO) {
    return state.bookings.filter((b) => b.date === dateISO && b.status !== 'declined').map((b) => b.slot);
  }

  function newBooking(input) {
    const b = input || {};
    return {
      id: uid('b'),
      name: String(b.name || '').trim(),
      phone: String(b.phone || '').trim(),
      garment: GARMENTS[b.garment] ? b.garment : 'shirt',
      service: b.service || 'measure',
      date: b.date || '',
      slot: b.slot || '',
      notes: String(b.notes || '').trim(),
      status: 'new',
      createdAt: Date.now(),
      clientId: null,
      orderId: null,
    };
    }

  function validateBooking(b) {
    const errors = {};
    if (!b.name || b.name.trim().length < 2) errors.name = 'Tell us your name.';
    if (!b.phone || String(b.phone).replace(/\D/g, '').length < 7) errors.phone = 'A phone number we can reach you on.';
    if (!b.date) errors.date = 'Pick a day.';
    if (!b.slot) errors.slot = 'Pick a time.';
    return { ok: Object.keys(errors).length === 0, errors };
  }

  /** Turns a booking into a client + order, keeping the paper trail. */
  function convertBooking(state, bookingId, opts) {
    const o = opts || {};
    const booking = state.bookings.find((b) => b.id === bookingId);
    if (!booking) return null;
    const key = phoneKey(booking.phone);
    let client = key ? state.clients.find((c) => phoneKey(c.phone) === key) : null;
    if (!client) {
      client = newClient({ name: booking.name, phone: booking.phone });
      state.clients.unshift(client);
    }
    const person = client.people[0];
    const order = createOrder(state, {
      clientId: client.id,
      personId: person.id,
      garments: [{ kind: booking.garment, price: o.price || 0 }],
      dueDate: o.dueDate,
      deposit: o.deposit || 0,
      notes: booking.notes ? 'Client asked: ' + booking.notes : '',
      source: 'booking',
    });
    booking.status = 'converted';
    booking.clientId = client.id;
    booking.orderId = order.id;
    return { client, order, booking };
  }

  /* ----------------------------------------------------------------- messages */

  function orderLines(order, state) {
    const lines = [];
    lines.push((state.shop.name || 'The shop') + ' · order ' + order.number);
    for (const g of order.garments || []) {
      const def = GARMENTS[g.kind] || {};
      lines.push('• ' + (def.label || g.kind) + ' ×' + (g.qty || 1) + (g.price ? ' — ' + money(g.price * (g.qty || 1), state) : ''));
    }
    const bal = orderBalance(order);
    if (bal > 0) lines.push('Balance ' + money(bal, state));
    return lines;
  }

  function messages(order, state) {
    const first = (order.garments && order.garments[0] && (GARMENTS[order.garments[0].kind] || {}).label) || 'order';
    const name = order.personName || (order.clientId && (state.clients.find((c) => c.id === order.clientId) || {}).name) || 'there';
    const due = fmtDate(order.dueDate, { long: true });
    const money1 = money(orderTotal(order), state);
    return {
      booked:
        'Hi ' + name + ', your ' + first.toLowerCase() + ' is booked in as ' + order.number + ' — ' + money1 +
        '. Collection is pencilled for ' + due + '. We will message you before the fitting.',
      trial:
        'Hi ' + name + ', ' + order.number + ' is ready for a fitting. Call in any time before ' + due + ' — bring the shoes or undergarments you will wear with it.',
      ready:
        'Hi ' + name + ', good news: ' + order.number + ' is finished and ready for collection. ' +
        (orderBalance(order) > 0 ? 'Balance ' + money(orderBalance(order), state) + ' on pickup. ' : '') +
        'Thank you for choosing ' + (state.shop.name || 'us') + '.',
      late:
        'Hi ' + name + ', quick update on ' + order.number + ': we are running a little behind and the new collection day is ' + due +
        '. Sorry for the shuffle — the fit will be worth it.',
      payment:
        'Hi ' + name + ', a reminder that ' + money(orderBalance(order), state) + ' is outstanding on ' + order.number + '. ' +
        'You can settle by transfer or at collection.',
    };
  }

  /* ------------------------------------------------------------------- sample */

  function sampleState() {
    const state = blankState();
    state.shop = Object.assign(state.shop, {
      name: 'Nusrat Tailors',
      tagline: 'Bespoke tailoring since 1987',
      phone: '+92 300 1234567',
      whatsapp: '+92 300 1234567',
      address: 'Shop 12, Gulberg Main Market, Lahore',
      currency: 'PKR',
      units: 'in',
      openHour: 11,
      closeHour: 20,
      slotMinutes: 30,
      closedDays: [0],
    });
    state.seen = true;
    const today = todayISO();

    const mk = (name, phone, address, people) => {
      const c = newClient({ name, phone, address });
      c.id = uid('c');
      c.people = people.map((p, i) => ({
        id: uid('p'),
        name: p.name,
        relation: p.relation || (i === 0 ? 'Self' : 'Family'),
        measures: p.measures || {},
      }));
      return c;
    };

    const ayesha = mk('Ayesha Khan', '+92 321 5550199', 'House 4, Model Town, Lahore', [
      {
        name: 'Ayesha Khan',
        measures: {
          dress: { unit: 'in', values: { bust: 38, underbust: 32, waist: 31, hip: 40, shoulder: 14.5, sleeve: 22, length: 44, neckDepth: 7 }, at: Date.now() - 86400000 * 9, by: 'Bilal', history: [] },
        },
      },
      { name: 'Zoya Khan', relation: 'Daughter', measures: { dress: { unit: 'in', values: { bust: 30, waist: 26, hip: 33, shoulder: 12, sleeve: 18, length: 36 }, at: Date.now() - 86400000 * 4, by: 'Bilal', history: [] } } },
    ]);
    const bilal = mk('Bilal Ahmed', '+92 333 5550222', 'Flat 7, Askari 11, Lahore', [
      {
        name: 'Bilal Ahmed',
        measures: {
          shirt: { unit: 'in', values: { neck: 15.5, shoulder: 18, chest: 40, waist: 35, seat: 39, length: 29, sleeve: 25, bicep: 13, cuff: 7.5 }, at: Date.now() - 86400000 * 21, by: 'Nusrat', history: [] },
          trouser: { unit: 'in', values: { waist: 34, seat: 40, thigh: 23, knee: 16, bottom: 15, inseam: 31, outseam: 41, rise: 10 }, at: Date.now() - 86400000 * 21, by: 'Nusrat', history: [] },
          blazer: { unit: 'in', values: { chest: 40.5, waist: 36, seat: 40, shoulder: 18.5, sleeve: 25, backLength: 30.5, armhole: 18, bicep: 13.5, cuff: 10 }, at: Date.now() - 86400000 * 21, by: 'Nusrat', history: [] },
        },
      },
    ]);
    const fatima = mk('Fatima Sheikh', '+92 345 5550812', '23-C, DHA Phase 5, Lahore', [
      {
        name: 'Fatima Sheikh',
        measures: {
          abaya: { unit: 'in', values: { shoulder: 15, bust: 40, waist: 34, hip: 42, length: 56, sleeve: 23, neckWidth: 5.5, frontOpening: 20 }, at: Date.now() - 86400000 * 3, by: 'Bilal', history: [] },
        },
      },
    ]);
    const imran = mk('Imran Qureshi', '+92 300 5550345', 'Gulberg III, Lahore', [
      {
        name: 'Imran Qureshi',
        measures: {
          kurta: { unit: 'in', values: { neck: 16, shoulder: 19, chest: 44, waist: 40, seat: 44, length: 42, sleeve: 26, bicep: 14.5, hem: 24 }, at: Date.now() - 86400000 * 12, by: 'Nusrat', history: [] },
        },
      },
    ]);

    const hassan = mk('Hassan Raza', '+92 301 5550900', 'Model Town Link Road, Lahore', [
      {
        name: 'Hassan Raza',
        measures: {
          blazer: { unit: 'in', values: { chest: 41, waist: 37, seat: 41, shoulder: 18.2, sleeve: 25.5, backLength: 30, armhole: 17.5, bicep: 13, cuff: 10 }, at: Date.now() - 86400000 * 62, by: 'Nusrat', history: [] },
        },
      },
    ]);

    state.clients = [ayesha, bilal, fatima, imran, hassan];

    const add = (opts) => {
      const client = state.clients.find((c) => c.name === opts.client);
      const person = client.people[0];
      const order = createOrder(state, {
        clientId: client.id,
        personId: person.id,
        garments: opts.garments.map((g) => {
          const set = person.measures[g.kind];
          return Object.assign({ measurements: set ? snapshot(set) : null }, g);
        }),
        dueDate: opts.dueDate || addDaysISO(today, 7),
        stage: opts.stage || 'booked',
        priority: opts.priority,
        deposit: opts.deposit || 0,
        discount: 0,
        notes: opts.notes || '',
        assignee: opts.assignee || 'Nusrat',
        trialDate: opts.trialDate || '',
      });
      order.number = opts.number;
      if (state.numbering.next <= Number(opts.number.replace('#', ''))) state.numbering.next = Number(opts.number.replace('#', '')) + 1;
      if (opts.paid) order.payments.push({ id: uid('pay'), amount: opts.paid, at: new Date().toISOString(), method: 'cash' });
      if (opts.payments) opts.payments.forEach((amount, i) => order.payments.push({ id: uid('pay'), amount, at: new Date(Date.now() - (i + 1) * 86400000 * 5).toISOString(), method: 'transfer' }));
      order.bookedAt = new Date(Date.now() - (opts.daysAgo || 4) * 86400000).toISOString();
      return order;
    };

    add({
      number: '#1041', client: 'Ayesha Khan', stage: 'trial', dueDate: addDaysISO(today, 2), daysAgo: 12, deposit: 6000, price: 18000,
      garments: [{ kind: 'dress', qty: 1, price: 18000, style: { neckline: 'Sweetheart', back: 'Keyhole', flare: 'Fit and flare', lining: 'Lined' }, fabric: { name: 'Raw silk', colour: 'Emerald', metres: '4.5', supplier: 'Liberty' }, notes: 'Hand-embroidered bodice, zip at back, cups sewn in.' }],
      notes: 'Wedding guest dress. Client wants the hem 2cm above the floor with her heels.',
    });
    add({
      number: '#1042', client: 'Bilal Ahmed', stage: 'stitch', dueDate: addDaysISO(today, 5), daysAgo: 9, deposit: 25000, payments: [15000],
      garments: [
        { kind: 'blazer', qty: 1, price: 42000, style: { lapel: 'Peak', buttons: 'Two', vents: 'Double', lining: 'Full' }, fabric: { name: 'Wool 120s', colour: 'Midnight', metres: '3.2', supplier: 'Ittehad' }, notes: 'Canvas front, working cuffs, ticket pocket.' },
        { kind: 'trouser', qty: 1, price: 12000, style: { fit: 'Slim', pleats: 'Flat front', hem: 'Plain' }, fabric: { name: 'Wool 120s', colour: 'Midnight', metres: '1.4', supplier: 'Ittehad' }, notes: 'Side adjusters instead of belt loops.' },
      ],
      notes: 'Wedding suit for his brother’s mehndi. Needs a second fitting before the 20th.',
    });
    add({
      number: '#1043', client: 'Fatima Sheikh', stage: 'cut', dueDate: addDaysISO(today, -2), daysAgo: 16, deposit: 4000, priority: 'rush',
      garments: [{ kind: 'abaya', qty: 2, price: 9500, style: { front: 'Open front', sleeve: 'Bell', lining: 'Unlined' }, fabric: { name: 'Nida', colour: 'Black', metres: '6', supplier: 'Local' }, notes: 'Bell sleeve 26in opening, press studs down the front.' }],
      notes: 'Ummrah trip — must be ready before Thursday.',
    });
    add({
      number: '#1044', client: 'Imran Qureshi', stage: 'ready', dueDate: addDaysISO(today, 0), daysAgo: 11, deposit: 0,
      garments: [{ kind: 'kurta', qty: 1, price: 11000, style: { neckline: 'Ban collar', sleeves: 'Full', slit: 'Side slits', fit: 'Straight' }, fabric: { name: 'Cotton lawn', colour: 'Ivory', metres: '3', supplier: 'Gul Ahmed' }, notes: 'Ban collar 1.5in, hidden placket, side pockets.' }],
      notes: 'Eid kurta. Pressed and bagged, waiting on the rack.',
    });
    const delivered = add({
      number: '#1039', client: 'Bilal Ahmed', stage: 'delivered', dueDate: addDaysISO(today, -14), daysAgo: 40,
      garments: [{ kind: 'shirt', qty: 3, price: 6500, style: { collar: 'Cutaway', cuff: 'French', fit: 'Slim', pocket: 'None' }, fabric: { name: 'Egyptian cotton', colour: 'White', metres: '5', supplier: 'Imported' }, notes: 'Monogram B.A. inside the collar band.' }],
      notes: 'Three office shirts, delivered and paid.',
    });
    delivered.payments.push({ id: uid('pay'), amount: 19500, at: new Date(Date.now() - 8 * 86400000).toISOString(), method: 'transfer' });
    delivered.deliveredAt = new Date(Date.now() - 6 * 86400000).toISOString();

    // history, so the money chart and the client books are not empty
    const past = (opts) => {
      const o = add(Object.assign({ stage: 'delivered' }, opts));
      o.payments = [{ id: uid('pay'), amount: opts.paid, at: new Date(Date.now() - (opts.daysAgo - 3) * 86400000).toISOString(), method: 'cash' }];
      o.deliveredAt = new Date(Date.now() - (opts.daysAgo - 3) * 86400000).toISOString();
      return o;
    };
    past({
      number: '#1036', client: 'Bilal Ahmed', dueDate: addDaysISO(today, -146), daysAgo: 152, paid: 13000,
      garments: [{ kind: 'shirt', qty: 2, price: 6500, style: { collar: 'Semi spread', cuff: 'Single', fit: 'Regular', pocket: 'One' }, fabric: { name: 'Poplin', colour: 'Sky', metres: '3.6' } }],
      notes: 'Two work shirts.',
    });
    past({
      number: '#1037', client: 'Fatima Sheikh', dueDate: addDaysISO(today, -98), daysAgo: 104, paid: 22000,
      garments: [{ kind: 'abaya', qty: 2, price: 11000, style: { front: 'Closed', sleeve: 'Straight', lining: 'Lined' }, fabric: { name: 'Nida', colour: 'Charcoal', metres: '6' } }],
      notes: 'Winter abayas, lined.',
    });
    past({
      number: '#1038', client: 'Hassan Raza', dueDate: addDaysISO(today, -50), daysAgo: 56, paid: 48000,
      garments: [{ kind: 'blazer', qty: 1, price: 48000, style: { lapel: 'Notch', buttons: 'Two', vents: 'Single', lining: 'Half' }, fabric: { name: 'Linen blend', colour: 'Sand', metres: '3' }, notes: 'Shoulders let out 1cm at the second fitting.' }],
      notes: 'Summer wedding suit.',
    });
    past({
      number: '#1040', client: 'Imran Qureshi', dueDate: addDaysISO(today, -24), daysAgo: 30, paid: 9000,
      garments: [{ kind: 'kurta', qty: 1, price: 9000, style: { neckline: 'Ban collar', sleeves: 'Short', slit: 'None', fit: 'Straight' }, fabric: { name: 'Cotton lawn', colour: 'Sage', metres: '2.8' } }],
      notes: 'Short sleeve kurta for summer.',
    });

    // hand-written numbers must not leave gaps in the book
    state.numbering.next = Math.max.apply(null, state.orders.map((o) => Number(String(o.number).replace('#', '')) || 0)) + 1;

    state.bookings = [
      Object.assign(newBooking({ name: 'Zara Iqbal', phone: '+92 331 5550444', garment: 'kurta', service: 'fitting', date: today, slot: '17:30', notes: 'First fitting on the ivory kurta — bring the matching buttons.' }), { id: uid('b'), status: 'confirmed', createdAt: Date.now() - 5400000 }),
      Object.assign(newBooking({ name: 'Sana Malik', phone: '+92 322 5550777', garment: 'dress', service: 'measure', date: addDaysISO(today, 1), slot: '12:00', notes: 'Wants a velvet dress for a walima. Sent her colour options on WhatsApp.' }), { id: uid('b'), createdAt: Date.now() - 3600000 }),
      Object.assign(newBooking({ name: 'Hassan Raza', phone: '+92 301 5550900', garment: 'blazer', service: 'fitting', date: addDaysISO(today, 2), slot: '16:30', notes: 'Second fitting on #1038, shoulders were tight.' }), { id: uid('b'), createdAt: Date.now() - 7200000 }),
      Object.assign(newBooking({ name: 'Mariam Yousuf', phone: '+92 335 5550111', garment: 'abaya', service: 'consult', date: addDaysISO(today, 4), slot: '18:00', notes: 'Wants fabric advice for a summer abaya.' }), { id: uid('b'), createdAt: Date.now() - 86400000 }),
    ];
    return state;
  }

  return {
    GARMENTS,
    GARMENT_KEYS,
    STAGES,
    STAGE_KEYS,
    BOARD_STAGES,
    SERVICES,
    CURRENCIES,
    round,
    uid,
    clamp,
    todayISO,
    addDaysISO,
    dayDiff,
    fmtDate,
    money,
    length,
    convert,
    waLink,
    phoneKey,
    blankState,
    hydrate,
    load,
    save,
    KEY,
    newClient,
    addPerson,
    latestMeasurement,
    saveMeasurement,
    measurementsIn,
    missingCore,
    newOrderNumber,
    newGarment,
    createOrder,
    snapshot,
    orderTotal,
    orderPaid,
    orderBalance,
    garmentCount,
    stageIndex,
    nextStage,
    advanceOrder,
    stageLabel,
    dueInfo,
    orderSearch,
    monthKey,
    stats,
    overdueOrders,
    slotsFor,
    takenSlots,
    newBooking,
    validateBooking,
    convertBooking,
    orderLines,
    messages,
    sampleState,
  };
});
