/*!
 * Chalkline — public booking page.
 * Reads the same shop settings as the workbench and writes bookings into the
 * same book, so a client's appointment appears in the tailor's Bookings tab.
 */
(function () {
  'use strict';

  const D = window.Chalkline;
  const state = D.load();
  const shop = state.shop && state.shop.name ? state.shop : Object.assign(D.blankState().shop, {
    name: 'Nusrat Tailors',
    tagline: 'Bespoke tailoring since 1987',
    currency: 'PKR',
  });

  const $ = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));
  const esc = (v) =>
    String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const choice = {
    service: D.SERVICES[0].key,
    garment: 'shirt',
    date: '',
    slot: '',
  };

  /* ------------------------------------------------------------------- header */

  function paintHeader() {
    $('#book-shop').textContent = shop.name;
    $('#book-tag').textContent = shop.tagline || 'Bespoke tailoring';
    $('#book-monogram').textContent = (shop.name || 'C').trim().charAt(0).toUpperCase();
    document.title = 'Book a fitting — ' + shop.name;
    $('#book-contact').innerHTML = [
      shop.phone ? '<b>' + esc(shop.phone) + '</b>' : '',
      shop.address ? esc(shop.address) : '',
    ].filter(Boolean).join('<br>');
    $('#book-lede').textContent = 'Pick a service, a day and a time. Nothing to pay until the cloth is cut.';
  }

  /* ------------------------------------------------------------------ service */

  function paintServices() {
    $('#service-grid').innerHTML = D.SERVICES.map((s) =>
      '<button type="button" class="opt' + (choice.service === s.key ? ' is-on' : '') + '" data-service="' + s.key + '">' +
      '<span>' + esc(s.label) + '</span><span class="mins">' + s.minutes + ' min</span></button>'
    ).join('');
    $$('[data-service]').forEach((b) => b.addEventListener('click', () => {
      choice.service = b.dataset.service;
      paintServices();
    }));
  }

  function paintGarments() {
    $('#garment-grid').innerHTML = D.GARMENT_KEYS.map((k) =>
      '<button type="button" class="opt' + (choice.garment === k ? ' is-on' : '') + '" data-garment="' + k + '">' +
      '<span>' + esc(D.GARMENTS[k].label) + '</span><span class="mins">' + esc(D.GARMENTS[k].blurb.split(',')[0]) + '</span></button>'
    ).join('');
    $$('[data-garment]').forEach((b) => b.addEventListener('click', () => {
      choice.garment = b.dataset.garment;
      paintGarments();
      paintSlots();
    }));
  }

  /* --------------------------------------------------------------------- days */

  function days() {
    const out = [];
    const start = new Date();
    for (let i = 0; i < 14; i++) {
      const iso = D.todayISO(new Date(start.getTime() + i * 86400000));
      out.push(iso);
    }
    return out;
  }

  function paintDays() {
    const list = days();
    if (!choice.date) {
      const firstOpen = list.find((d) => !(shop.closedDays || []).includes(new Date(d + 'T12:00:00').getDay()));
      choice.date = firstOpen || list[0];
    }
    $('#day-strip').innerHTML = list.map((iso) => {
      const d = new Date(iso + 'T12:00:00');
      const closed = (shop.closedDays || []).includes(d.getDay());
      return '<button type="button" class="day' + (choice.date === iso ? ' is-on' : '') + '" data-date="' + iso + '"' + (closed ? ' disabled title="Closed"' : '') + '>' +
        '<span class="dow">' + ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()] + '</span>' +
        '<span class="dnum">' + d.getDate() + '</span>' +
        '<span class="mon">' + ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getMonth()] + '</span></button>';
    }).join('');
    $$('[data-date]').forEach((b) => b.addEventListener('click', () => {
      choice.date = b.dataset.date;
      choice.slot = '';
      paintDays();
      paintSlots();
    }));
  }

  function paintSlots() {
    if (!choice.date) return;
    const taken = D.takenSlots(state, choice.date);
    const slots = D.slotsFor(choice.date, shop, taken);
    const closed = slots.length && slots[0].closed;
    $('#slot-grid').innerHTML = closed
      ? ''
      : slots.map((s) => '<button type="button" class="slot' + (choice.slot === s.slot ? ' is-on' : '') + '" data-slot="' + s.slot + '"' +
        (s.taken ? ' disabled' : '') + '>' + s.slot + '</button>').join('');
    $$('[data-slot]').forEach((b) => b.addEventListener('click', () => {
      choice.slot = b.dataset.slot;
      paintSlots();
      $('#book-error').hidden = true;
    }));
    $('#slot-hint').textContent = closed
      ? 'Closed on ' + D.fmtDate(choice.date, { long: true }) + ' — try another day.'
      : choice.slot
        ? 'Holding ' + choice.slot + ' on ' + D.fmtDate(choice.date, { long: true }) + '.'
        : 'Open times for ' + D.fmtDate(choice.date, { long: true }) + '. Struck-through slots are taken.';
  }

  /* -------------------------------------------------------------------- submit */

  $('#book-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const booking = D.newBooking({
      name: String(fd.get('name') || ''),
      phone: String(fd.get('phone') || ''),
      notes: String(fd.get('notes') || ''),
      garment: choice.garment,
      service: choice.service,
      date: choice.date,
      slot: choice.slot,
    });
    const check = D.validateBooking(booking);
    const err = $('#book-error');
    if (!check.ok) {
      err.hidden = false;
      err.textContent = Object.values(check.errors).join(' ');
      return;
    }
    if (D.takenSlots(state, booking.date).includes(booking.slot)) {
      err.hidden = false;
      err.textContent = 'That slot was just taken. Pick another time.';
      paintSlots();
      return;
    }
    state.bookings.push(booking);
    state.seen = true;
    D.save(state);
    showSuccess(booking);
  });

  function showSuccess(booking) {
    const errLine = $('#book-error');
    errLine.hidden = true;
    errLine.textContent = '';
    const ref = 'BK-' + booking.id.slice(-5).toUpperCase();
    const service = D.SERVICES.find((s) => s.key === booking.service);
    const summary = 'Booked with ' + shop.name + '\n' +
      (service ? service.label : 'Appointment') + ' — ' + D.GARMENTS[booking.garment].label + '\n' +
      D.fmtDate(booking.date, { long: true }) + ' at ' + booking.slot + '\n' +
      'Name: ' + booking.name + '\nPhone: ' + booking.phone + '\n' +
      'Reference: ' + ref + (booking.notes ? '\nNote: ' + booking.notes : '');

    $('#book-form').hidden = true;
    $('.book-intro').hidden = true;
    const box = $('#book-success');
    box.hidden = false;
    box.innerHTML =
      '<div class="tick" aria-hidden="true">✓</div>' +
      '<h2>You are in the book.</h2>' +
      '<p class="when">' + esc(D.fmtDate(booking.date, { long: true })) + ' · ' + esc(booking.slot) + ' · ' + esc(D.GARMENTS[booking.garment].label) + '</p>' +
      '<p class="ref">Reference ' + esc(ref) + '</p>' +
      '<p class="muted" style="font-size:12.5px;max-width:42ch;margin:12px auto 0">' +
      esc(shop.name) + ' sees this booking in their workbench. If anything changes, message the shop on WhatsApp.</p>' +
      '<div class="acts">' +
      (shop.whatsapp || shop.phone
        ? '<a class="btn primary" target="_blank" rel="noopener" href="' + esc(D.waLink(shop.whatsapp || shop.phone, summary)) + '">Send it on WhatsApp</a>'
        : '') +
      '<button class="btn ghost" type="button" id="book-again">Book another</button>' +
      '</div>';
    $('#book-again').addEventListener('click', () => {
      booking = null;
      $('#book-form').hidden = false;
      $('.book-intro').hidden = false;
      box.hidden = true;
      choice.slot = '';
      paintSlots();
      window.scrollTo(0, 0);
    });
    window.scrollTo(0, 0);
  }

  /* ---------------------------------------------------------------------- boot */

  paintHeader();
  paintServices();
  paintGarments();
  paintDays();
  paintSlots();
})();
