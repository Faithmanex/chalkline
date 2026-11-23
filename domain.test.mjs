import test from 'node:test';
import assert from 'node:assert/strict';
import D from './domain.js';

/* --------------------------------------------------------------- measurements */

test('inches and centimetres convert both ways', () => {
  assert.equal(D.convert(40, 'in', 'cm'), 101.6);
  assert.equal(D.convert(101.6, 'cm', 'in'), 40);
  assert.equal(D.convert(40, 'in', 'in'), 40);
  assert.equal(D.length(40.5, 'in'), '40.5"');
  assert.equal(D.length(101.6, 'cm'), '101.6 cm');
  assert.equal(D.length('', 'in'), '—');
});

test('a measurement set keeps its previous version as history', () => {
  const person = { id: 'p1', name: 'Ayesha', measures: {} };
  D.saveMeasurement(person, 'dress', 'in', { bust: 38, waist: 31, sleeve: 22 }, 'Bilal');
  const second = D.saveMeasurement(person, 'dress', 'in', { bust: 37.5, waist: 30, sleeve: 22 }, 'Nusrat');
  assert.equal(second.values.bust, 37.5);
  assert.equal(second.history.length, 1);
  assert.equal(second.history[0].values.bust, 38);
  assert.equal(second.by, 'Nusrat');
});

test('blank and junk measurement values are dropped, not stored as NaN', () => {
  const person = { id: 'p', measures: {} };
  const set = D.saveMeasurement(person, 'shirt', 'in', { chest: 40, waist: '', sleeve: 'x', neck: null }, '');
  assert.deepEqual(set.values, { chest: 40 });
});

test('core measurements are reported missing', () => {
  assert.deepEqual(D.missingCore('trouser', { waist: 34, seat: 40 }), ['Bottom', 'Inseam', 'Outseam']);
  assert.deepEqual(D.missingCore('trouser', { waist: 34, seat: 40, bottom: 15, inseam: 31, outseam: 41 }), []);
});

test('measurements display in the shop unit without changing the stored unit', () => {
  const person = { id: 'p', measures: {} };
  const set = D.saveMeasurement(person, 'shirt', 'cm', { chest: 101.6 }, '');
  assert.equal(D.measurementsIn(set, 'in').chest, 40);
  assert.equal(set.unit, 'cm');
});

/* ---------------------------------------------------------------------- money */

test('order total, payments and balance', () => {
  const order = {
    garments: [
      { kind: 'blazer', qty: 1, price: 42000 },
      { kind: 'trouser', qty: 2, price: 12000 },
    ],
    discount: 2000,
    payments: [{ amount: 25000 }, { amount: 5000 }],
  };
  assert.equal(D.orderTotal(order), 64000);
  assert.equal(D.orderPaid(order), 30000);
  assert.equal(D.orderBalance(order), 34000);
});

test('balance never goes negative when a client overpays', () => {
  const order = { garments: [{ qty: 1, price: 5000 }], payments: [{ amount: 6000 }] };
  assert.equal(D.orderBalance(order), 0);
});

test('money formatting per currency', () => {
  assert.equal(D.money(18500, 'PKR'), 'Rs 18,500');
  assert.equal(D.money(18500, 'INR'), '₹18,500');
  assert.equal(D.money(18500, 'GBP'), '£18,500');
  assert.equal(D.money(0, 'USD'), '$0');
  assert.equal(D.money(-50, 'USD'), '-$50');
  assert.equal(D.money(1234567, { shop: { currency: 'NGN' } }), '₦1,234,567');
});

test('garment quantity multiplies into the total', () => {
  const order = { garments: [{ k: 'shirt', qty: 3, price: 6500 }], payments: [] };
  assert.equal(D.orderTotal(order), 19500);
  assert.equal(D.garmentCount(order), 3);
});

/* --------------------------------------------------------------------- stages */

test('stages advance in order and stop at delivered', () => {
  const order = { stage: 'booked', timeline: [] };
  const seen = [];
  for (let i = 0; i < 10; i++) seen.push(D.advanceOrder(order, 'test'));
  assert.deepEqual(seen.slice(0, 7), ['cut', 'stitch', 'trial', 'finish', 'ready', 'delivered', 'delivered']);
  assert.ok(order.deliveredAt);
  assert.equal(order.timeline.length, 10);
});

test('due states are computed from the shop date', () => {
  const today = '2026-03-10';
  assert.equal(D.dueInfo({ stage: 'stitch', dueDate: '2026-03-07' }, today).key, 'overdue');
  assert.equal(D.dueInfo({ stage: 'stitch', dueDate: '2026-03-10' }, today).key, 'today');
  assert.equal(D.dueInfo({ stage: 'stitch', dueDate: '2026-03-11' }, today).label, 'Tomorrow');
  assert.equal(D.dueInfo({ stage: 'stitch', dueDate: '2026-03-15' }, today).label, 'In 5 days');
  assert.equal(D.dueInfo({ stage: 'delivered', dueDate: '2026-03-01' }, today).key, 'done');
});

/* ------------------------------------------------------------------- bookings */

test('booking slots respect opening hours, slot length and closed days', () => {
  const shop = { openHour: 11, closeHour: 13, slotMinutes: 30, closedDays: [0] };
  const monday = D.slotsFor('2026-03-09', shop, []);
  assert.deepEqual(monday.map((s) => s.slot), ['11:00', '11:30', '12:00', '12:30']);
  const sunday = D.slotsFor('2026-03-08', shop, []);
  assert.ok(sunday.every((s) => s.taken && s.closed));
  const booked = D.slotsFor('2026-03-09', shop, ['11:30']);
  assert.equal(booked.find((s) => s.slot === '11:30').taken, true);
});

test('booking validation catches the real mistakes', () => {
  assert.equal(D.validateBooking({ name: 'A', phone: '', date: '', slot: '' }).ok, false);
  const bad = D.validateBooking({ name: 'Alina', phone: '123', date: '2026-03-09', slot: '' });
  assert.equal(bad.ok, false);
  assert.ok(bad.errors.phone && bad.errors.slot && !bad.errors.name);
  assert.equal(D.validateBooking({ name: 'Alina', phone: '0300 1234567', date: '2026-03-09', slot: '11:00' }).ok, true);
});

test('a booking becomes a client and an order without retyping', () => {
  const state = D.blankState();
  state.bookings.push(Object.assign(D.newBooking({ name: 'Sana Malik', phone: '+92 322 5550777', garment: 'dress', date: '2026-03-09', slot: '12:00', notes: 'Velvet' }), {}));
  const result = D.convertBooking(state, state.bookings[0].id, { price: 14000, dueDate: '2026-03-20', deposit: 4000 });
  assert.equal(state.clients.length, 1);
  assert.equal(result.order.garments[0].kind, 'dress');
  assert.equal(result.order.garments[0].price, 14000);
  assert.equal(D.orderBalance(result.order), 10000);
  assert.equal(state.bookings[0].status, 'converted');
  // converting a second booking from the same phone reuses the client
  state.bookings.push(D.newBooking({ name: 'Sana Malik', phone: '0322 5550777', garment: 'kurta', date: '2026-03-10', slot: '13:00' }));
  D.convertBooking(state, state.bookings[1].id, { price: 5000, dueDate: '2026-03-21' });
  assert.equal(state.clients.length, 1);
  assert.equal(state.orders.length, 2);
});

test('order numbers never repeat', () => {
  const state = D.blankState();
  state.numbering.next = 1042;
  const a = D.createOrder(state, { garments: [{ kind: 'shirt', price: 100 }] });
  const b = D.createOrder(state, { garments: [{ kind: 'shirt', price: 100 }] });
  assert.equal(a.number, '#1042');
  assert.equal(b.number, '#1043');
});

test('creating an order snapshots measurements so later edits do not rewrite history', () => {
  const state = D.blankState();
  const client = D.newClient({ name: 'Bilal', phone: '0300' });
  D.saveMeasurement(client.people[0], 'shirt', 'in', { chest: 40, sleeve: 25 }, 'Nusrat');
  state.clients.push(client);
  const order = D.createOrder(state, { clientId: client.id, personId: client.people[0].id, garments: [{ kind: 'shirt', price: 6500 }] });
  assert.equal(order.garments[0].measurements.values.chest, 40);
  D.saveMeasurement(client.people[0], 'shirt', 'in', { chest: 42, sleeve: 25 }, 'Nusrat');
  assert.equal(order.garments[0].measurements.values.chest, 40, 'the ticket keeps the booking-time numbers');
});

test('deposit is recorded as a payment, not just a number', () => {
  const state = D.blankState();
  const order = D.createOrder(state, { garments: [{ kind: 'kurta', price: 11000 }], deposit: 3000 });
  assert.equal(order.payments.length, 1);
  assert.equal(D.orderBalance(order), 8000);
});

/* ------------------------------------------------------------------- messages */

test('client messages carry the order number, amount and balance', () => {
  const state = D.blankState();
  state.shop.name = 'Nusrat Tailors';
  const order = D.createOrder(state, {
    personName: 'Imran',
    garments: [{ kind: 'kurta', price: 11000 }],
    deposit: 3000,
    dueDate: '2026-03-20',
  });
  const m = D.messages(order, state);
  assert.match(m.ready, /#1042/);
  assert.match(m.ready, /Rs 8,000/);
  assert.match(m.ready, /Nusrat Tailors/);
  assert.match(m.late, /20 Mar 2026/);
  assert.match(m.booked, /Imran/);
});

test('whatsapp links strip punctuation and encode the message', () => {
  const link = D.waLink('+92 (300) 123-4567', 'Hi there & welcome');
  assert.match(link, /^https:\/\/wa\.me\/923001234567\?text=/);
  assert.match(link, /Hi%20there%20%26%20welcome/);
  assert.equal(D.waLink('', 'x'), '');
});

/* ---------------------------------------------------------------------- stats */

test('month stats separate booked, collected and outstanding', () => {
  const state = D.blankState();
  const o1 = D.createOrder(state, { garments: [{ kind: 'shirt', price: 10000 }], deposit: 4000 });
  const o2 = D.createOrder(state, { garments: [{ kind: 'kurta', price: 20000 }], deposit: 20000 });
  o2.stage = 'delivered';
  o2.deliveredAt = new Date().toISOString();
  const s = D.stats(state, D.monthKey(D.todayISO()));
  assert.equal(s.booked, 30000);
  assert.equal(s.collected, 24000);
  assert.equal(s.outstanding, 6000);
  assert.equal(s.delivered, 1);
  assert.equal(s.perGarment.shirt, 10000);
});

test('overdue list only includes undelivered orders with money owing', () => {
  const state = D.blankState();
  const today = D.todayISO();
  const a = D.createOrder(state, { garments: [{ kind: 'shirt', price: 5000 }], dueDate: D.addDaysISO(today, -3) });
  const b = D.createOrder(state, { garments: [{ kind: 'shirt', price: 5000 }], dueDate: D.addDaysISO(today, -3), deposit: 5000 });
  const c = D.createOrder(state, { garments: [{ kind: 'shirt', price: 5000 }], dueDate: D.addDaysISO(today, 3) });
  const list = D.overdueOrders(state, today);
  assert.deepEqual(list.map((o) => o.id), [a.id]);
  assert.ok(b && c);
});

test('search finds orders by client, number, garment or fabric', () => {
  const state = D.blankState();
  const client = D.newClient({ name: 'Fatima Sheikh', phone: '0345 5550812' });
  state.clients.push(client);
  const order = D.createOrder(state, {
    clientId: client.id,
    personId: client.people[0].id,
    garments: [{ kind: 'abaya', price: 9500, fabric: { name: 'Nida', colour: 'Black' } }],
  });
  assert.equal(D.orderSearch(order, state, 'fatima'), true);
  assert.equal(D.orderSearch(order, state, order.number), true);
  assert.equal(D.orderSearch(order, state, 'nida'), true);
  assert.equal(D.orderSearch(order, state, 'blazer'), false);
});

/* --------------------------------------------------------------------- sample */

test('sample shop is internally consistent', () => {
  const s = D.sampleState();
  assert.ok(s.clients.length >= 4);
  assert.ok(s.orders.length >= 5);
  assert.ok(s.bookings.length >= 2);
  const numbers = new Set();
  for (const o of s.orders) {
    assert.ok(D.STAGE_KEYS.includes(o.stage), 'bad stage ' + o.stage);
    assert.ok(!numbers.has(o.number), 'duplicate order number ' + o.number);
    numbers.add(o.number);
    assert.ok(D.orderBalance(o) >= 0);
    assert.ok(!isNaN(Date.parse(o.dueDate)));
    for (const g of o.garments) assert.ok(D.GARMENTS[g.kind], 'bad garment ' + g.kind);
  }
  for (const c of s.clients) {
    assert.ok(c.name && c.phone);
    for (const p of c.people) assert.ok(p.measures && typeof p.measures === 'object');
  }
  // the demo must show all three interesting states
  const dues = s.orders.map((o) => D.dueInfo(o).key);
  assert.ok(dues.includes('overdue') || dues.includes('today'), 'sample should show a due-today or overdue job');
});

test('hydrate fills missing fields instead of breaking', () => {
  const s = D.hydrate({ clients: [{ id: 'c1', name: 'X', people: [] }] });
  assert.equal(s.shop.currency, 'PKR');
  assert.equal(s.orders.length, 0);
  assert.equal(s.clients.length, 1);
  assert.equal(D.hydrate(null).clients.length, 0);
});
