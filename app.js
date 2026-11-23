/*!
 * Chalkline app — routes, views, dialogs.
 * One sheet: today's board, orders, bookings, client measurement book, money.
 */
(function () {
  'use strict';

  const D = window.Chalkline;
  const C = window.ChalklineCanvas;

  /* ------------------------------------------------------------------- utils */

  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  const esc = (v) =>
    String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const ICONS = {
    board: '<path d="M3 4h18M3 10h18M3 16h10"/><path d="M17 13v6M14 16h6"/>',
    tag: '<path d="M20.6 12.6 12 21l-9-9 8.4-8.6L21 3z"/><circle cx="16.5" cy="7.5" r="1.2"/>',
    cal: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    people: '<circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5"/><path d="M16 8.4A3 3 0 0 1 16 14M18 20c0-2.4-.8-4.2-2.2-5.3"/>',
    coin: '<circle cx="12" cy="12" r="8.5"/><path d="M9 9.5h6M9 12h6M12 9.5V16"/>',
    cog: '<circle cx="12" cy="12" r="3"/><path d="M12 3v2.4M12 18.6V21M4.2 7.5l2.1 1.2M17.7 15.3l2.1 1.2M4.2 16.5l2.1-1.2M17.7 8.7l2.1-1.2"/>',
  };

  function paintIcons() {
    $$('[data-ico]').forEach((el) => {
      const name = el.dataset.ico;
      if (!ICONS[name] || el.firstElementChild) return;
      el.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true">' + ICONS[name] + '</svg>';
    });
  }

  /* ------------------------------------------------------------------- state */

  let state = D.load();
  if (location.search.indexOf('demo=1') > -1) {
    state = D.sampleState();
    state.demo = true;
    state.seen = true;
    D.save(state);
  }
  const freshRun = !state.clients.length && !state.orders.length && !state.seen;
  if (freshRun) {
    state = D.sampleState();
    state.demo = true;
    D.save(state);
  }

  const ui = { route: '/today', personId: null, tab: 'order', q: '', stage: 'all', board: null, saveTimer: 0, dialogData: {} };
  const FREE_LIMIT = 25;

  const saveSoon = () => {
    clearTimeout(ui.saveTimer);
    ui.saveTimer = setTimeout(() => D.save(state), 200);
  };
  const saveNow = () => {
    clearTimeout(ui.saveTimer);
    D.save(state);
  };

  const today = () => D.todayISO();
  const shop = () => state.shop;
  const money = (n) => D.money(n, state);
  const clientOf = (order) => state.clients.find((c) => c.id === order.clientId) || null;
  const personOf = (order) => {
    const c = clientOf(order);
    return c ? c.people.find((p) => p.id === order.personId) || c.people[0] : null;
  };
  const garmentLabel = (kind) => (D.GARMENTS[kind] || {}).label || kind;

  function toast(msg, actionLabel, action) {
    const host = $('#toasts');
    const node = document.createElement('div');
    node.className = 'toast';
    node.innerHTML = '<span>' + esc(msg) + '</span>';
    if (actionLabel && action) {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = actionLabel;
      b.addEventListener('click', () => {
        action();
        node.remove();
      });
      node.appendChild(b);
    }
    host.appendChild(node);
    setTimeout(() => node.remove(), actionLabel ? 8000 : 3600);
  }

  /* -------------------------------------------------------------------- icons */

  function pillFor(order) {
    const due = D.dueInfo(order, today());
    const cls = due.key === 'overdue' ? 'late' : due.key === 'today' || due.key === 'soon' ? 'due' : due.key === 'done' ? 'done' : due.key === 'ready' ? 'ready' : '';
    const label = order.stage === 'ready' ? 'Ready' : due.label;
    return '<span class="pill ' + cls + '">' + esc(label) + '</span>';
  }

  function stageBar(order) {
    const now = D.stageIndex(order.stage);
    return (
      '<div class="stage-bar">' +
      D.STAGES.map((s, i) => {
        const cls = i < now ? 'done' : i === now ? 'now' : '';
        return '<span class="stage-step ' + cls + '"><span class="dot"></span>' + esc(s.label) + '</span>' +
          (i < D.STAGES.length - 1 ? '<span class="stage-arrow" aria-hidden="true">·</span>' : '');
      }).join('') +
      '</div>'
    );
  }

  function measureGrid(entry, fields, opts) {
    const o = opts || {};
    if (!entry || !fields) return '<p class="muted" style="font-size:12px">No measurements yet.</p>';
    return (
      '<div class="measure-table">' +
      fields.map((f) => {
        const v = entry.values[f.key];
        return '<div class="measure-cell"><div class="k">' + esc(f.label) + '</div><div class="v' + (v == null ? ' miss' : '') + '">' +
          esc(v == null ? '—' : D.length(v, entry.unit)) + '</div></div>';
      }).join('') +
      '</div>' +
      (o.note !== false
        ? '<p class="muted" style="font-size:10.5px;margin-top:6px">' +
          (entry.at ? 'Taken ' + D.fmtDate(new Date(entry.at).toISOString().slice(0, 10), { long: true }) : '') +
          (entry.by ? ' by ' + esc(entry.by) : '') + ' · locked to this order</p>'
        : '')
    );
  }

  function figureSVG(garmentKey, opts) {
    const def = D.GARMENTS[garmentKey] || D.GARMENTS.shirt;
    const o = opts || {};
    const unit = o.unit || shop().units;
    return (
      '<svg viewBox="0 0 100 140" role="img" aria-label="' + esc(def.label) + ' measurement points">' +
      '<path class="fig-ref" d="M50,6.5 A6.5,6.5 0 1,1 49.9,6.5 M46,20 L46,25 M54,20 L54,25 M30,28 Q50,23 70,28 M30,28 L26,52 L27,74 M70,28 L74,52 L73,74 M34,30 L34,64 Q50,69 66,64 L66,30 M42,68 L41,100 L40,128 M58,68 L59,100 L60,128" />' +
      (def.outline || []).map((d) => '<path class="fig-outline" d="' + d + '"/>').join('') +
      def.fields.map((f) => {
        const raw = o.values ? o.values[f.key] : null;
        const shown = raw == null || raw === '' ? '' : D.length(raw, unit);
        const active = o.active === f.key;
        return (
          '<g>' +
          (active ? '<circle class="pin-ring" cx="' + f.pt[0] + '" cy="' + f.pt[1] + '" r="5.4"/>' : '') +
          '<circle class="pin-dot" cx="' + f.pt[0] + '" cy="' + f.pt[1] + '" r="2"/>' +
          (shown ? '<text class="pin-label" x="' + (f.pt[0] + 4) + '" y="' + (f.pt[1] + 1.4) + '">' + esc(shown) + '</text>' : '') +
          '</g>'
        );
      }).join('') +
      '</svg>'
    );
  }

  /* ------------------------------------------------------------------- router */

  function parseRoute() {
    const raw = (location.hash || '#/today').replace(/^#/, '');
    const parts = raw.split('/').filter(Boolean);
    return { section: parts[0] || 'today', id: parts[1] || null };
  }

  function render() {
    const r = parseRoute();
    ui.route = '/' + r.section;
    document.body.dataset.route = r.section;
    $$('.nav a, .rail-link[data-nav]').forEach((a) => {
      a.classList.toggle('is-active', a.getAttribute('href') === '#' + ui.route || a.dataset.nav === r.section);
    });

    if (ui.board) {
      ui.board.destroy();
      ui.board = null;
    }

    let html = '';
    if (r.section === 'today') html = viewToday();
    else if (r.section === 'orders') html = viewOrders();
    else if (r.section === 'order') html = viewOrder(r.id);
    else if (r.section === 'bookings') html = viewBookings();
    else if (r.section === 'clients') html = viewClients();
    else if (r.section === 'client') html = viewClient(r.id);
    else if (r.section === 'money') html = viewMoney();
    else if (r.section === 'settings') html = viewSettings();
    else html = '<div class="page"><h1>Not found</h1><p class="muted">That sheet is not in the book.</p></div>';

    const view = $('#view');
    view.innerHTML = html;
    view.scrollTop = 0;
    paintChrome();

    if (r.section === 'order' && r.id && ui.tab === 'board') mountBoard(r.id);
  }

  function paintChrome() {
    $('#shop-name').textContent = shop().name || 'Chalkline';
    $('#shop-tag').textContent = shop().tagline || 'The tailor\u2019s workbench';
    $('#monogram').textContent = (shop().monogram || shop().name || 'C').trim().charAt(0).toUpperCase() || 'C';
    const late = state.orders.filter((o) => o.stage !== 'delivered' && D.dueInfo(o, today()).key === 'overdue').length;
    const due = state.orders.filter((o) => o.stage !== 'delivered' && D.dueInfo(o, today()).key === 'today').length;
    $('#nav-today').textContent = late + due > 0 ? String(late + due) : '';
    const newBookings = state.bookings.filter((b) => b.status === 'new').length;
    $('#nav-bookings').textContent = newBookings ? String(newBookings) : '';
    const plan = state.plan || {};
    const left = FREE_LIMIT - (plan.ordersCreated || 0);
    $('#plan-chip').innerHTML = plan.tier === 'pro'
      ? '<b>Pro shop</b> · unlimited sheets'
      : '<b>Free</b> · ' + Math.max(0, left) + ' of ' + FREE_LIMIT + ' orders left';
  }

  /* -------------------------------------------------------------------- today */

  function viewToday() {
    const t = today();
    const live = state.orders.filter((o) => o.stage !== 'delivered');
    const dueToday = live.filter((o) => D.dueInfo(o, t).key === 'today').length;
    const late = live.filter((o) => D.dueInfo(o, t).key === 'overdue').length;
    const owed = live.reduce((sum, o) => sum + D.orderBalance(o), 0);
    const todaysBookings = state.bookings
      .filter((b) => b.date === t && b.status !== 'declined')
      .sort((a, b) => a.slot.localeCompare(b.slot));
    const newBookings = state.bookings.filter((b) => b.status === 'new');

    return (
      '<div class="page">' +
      demoBanner() +
      '<div class="page-head"><div><h1>Today</h1><div class="sub">' + esc(D.fmtDate(t, { long: true })) + ' · ' +
      esc(shop().name || 'Your shop') + ' · ' + live.length + ' job' + (live.length === 1 ? '' : 's') + ' on the floor</div></div>' +
      '<div class="head-actions"><button class="btn ghost" data-act="new-booking" type="button">Walk-in booking</button>' +
      '<button class="btn primary" data-act="new-order" type="button">New order</button></div></div>' +

      '<div class="stats">' +
      stat('Due today', dueToday, dueToday ? 'finish and call' : 'nothing promised for today', dueToday ? 'is-due' : '') +
      stat('Late', late, late ? 'sort these first' : 'nothing overdue', late ? 'is-late' : '') +
      stat('On the floor', live.length, 'booked \u2192 delivered pipeline', '') +
      stat('Owed to you', money(owed), 'balances on open orders', '') +
      '</div>' +

      '<div class="board">' +
      D.BOARD_STAGES.map((stageKey) => boardColumn(stageKey)).join('') +
      '</div>' +

      '<div class="card" style="margin-top:18px">' +
      '<div class="card-head"><h2>Bookings today</h2><a class="linkish" href="#/bookings">All bookings' + (newBookings.length ? ' (' + newBookings.length + ' new)' : '') + '</a></div>' +
      (todaysBookings.length
        ? todaysBookings.map(bookingRow).join('')
        : '<p class="muted" style="font-size:12.5px">No fittings booked today. The public booking page is how clients land here.</p>') +
      '</div></div>'
    );
  }

  function stat(k, v, n, cls) {
    return '<div class="stat ' + cls + '"><span class="k">' + esc(k) + '</span><span class="v">' + esc(v) + '</span><span class="n">' + esc(n) + '</span></div>';
  }

  function boardColumn(stageKey) {
    const stage = D.STAGES.find((s) => s.key === stageKey);
    const jobs = state.orders
      .filter((o) => o.stage === stageKey)
      .sort((a, b) => D.dueInfo(a).sort - D.dueInfo(b).sort);
    return (
      '<div class="col"><div class="col-head"><h3>' + esc(stage.label) + '</h3><span class="n">' + jobs.length + '</span></div>' +
      '<div class="col-body">' +
      (jobs.length ? jobs.map(jobCard).join('') : '<div class="col-empty">Empty</div>') +
      '</div></div>'
    );
  }

  function jobCard(order) {
    const client = clientOf(order);
    const due = D.dueInfo(order, today());
    const cls = due.key === 'overdue' ? 'is-overdue' : due.key === 'today' ? 'is-today' : '';
    const g = order.garments[0] || {};
    const bal = D.orderBalance(order);
    return (
      '<button type="button" class="job ' + cls + (order.priority === 'rush' ? ' is-rush' : '') + '" data-act="open-order" data-id="' + order.id + '">' +
      '<span class="job-top"><span class="job-name">' + esc(order.personName || (client && client.name) || 'Client') + '</span>' +
      '<span class="job-no">' + esc(order.number) + '</span></span>' +
      '<span class="job-foot"><span class="job-garment">' + esc(garmentLabel(g.kind)) + (order.garments.length > 1 ? ' +' + (order.garments.length - 1) : '') +
      (g.qty > 1 ? ' ×' + g.qty : '') + '</span>' + pillFor(order) + '</span>' +
      '<span class="job-money">' + esc(money(D.orderTotal(order))) +
      (bal > 0 ? ' · <span class="bal">' + esc(money(bal)) + ' due</span>' : '') + '</span></button>'
    );
  }

  /* ------------------------------------------------------------------- orders */

  function viewOrders() {
    const q = ui.q;
    const list = state.orders
      .filter((o) => (ui.stage === 'all' ? true : ui.stage === 'open' ? o.stage !== 'delivered' : o.stage === ui.stage))
      .filter((o) => D.orderSearch(o, state, q))
      .sort((a, b) => D.dueInfo(a).sort - D.dueInfo(b).sort);

    return (
      '<div class="page">' +
      '<div class="page-head"><div><h1>Orders</h1><div class="sub">' + state.orders.length + ' sheets in the book · ' + state.orders.filter((o) => o.stage !== 'delivered').length + ' open</div></div>' +
      '<div class="head-actions"><button class="btn primary" data-act="new-order" type="button">New order</button></div></div>' +
      '<div class="toolbar">' +
      '<input class="input" id="order-search" placeholder="Search number, client, fabric, note" value="' + esc(q) + '" aria-label="Search orders">' +
      '<select class="input" id="order-stage" style="width:auto" aria-label="Filter by stage">' +
      ['all', 'open'].concat(D.STAGE_KEYS).map((k) => '<option value="' + k + '"' + (ui.stage === k ? ' selected' : '') + '>' +
        (k === 'all' ? 'All stages' : k === 'open' ? 'Open only' : D.stageLabel(k)) + '</option>').join('') +
      '</select></div>' +
      '<div class="table-wrap"><table class="list"><thead><tr>' +
      '<th>Order</th><th>Client</th><th>Garment</th><th>Due</th><th>Stage</th><th class="right">Total</th><th class="right">Balance</th>' +
      '</tr></thead><tbody>' +
      (list.length
        ? list.map((o) => {
            const client = clientOf(o);
            const due = D.dueInfo(o, today());
            const bal = D.orderBalance(o);
            return '<tr data-act="open-order" data-id="' + o.id + '">' +
              '<td class="mono">' + esc(o.number) + '</td>' +
              '<td><div class="who">' + esc(o.personName || (client && client.name) || '—') + '</div>' +
              '<div class="sub">' + esc((client && client.phone) || '') + '</div></td>' +
              '<td>' + esc(o.garments.map((g) => garmentLabel(g.kind) + (g.qty > 1 ? ' ×' + g.qty : '')).join(', ')) + '</td>' +
              '<td><span class="pill ' + (due.key === 'overdue' ? 'late' : due.key === 'done' ? 'done' : 'due') + '">' + esc(due.label) + '</span></td>' +
              '<td>' + esc(D.stageLabel(o.stage)) + '</td>' +
              '<td class="money">' + esc(money(D.orderTotal(o))) + '</td>' +
              '<td class="money" style="color:' + (bal > 0 ? 'var(--thread-red)' : 'var(--stitch)') + '">' + esc(money(bal)) + '</td></tr>';
          }).join('')
        : '<tr><td colspan="7" class="empty-row">No orders match. ' + (q ? 'Clear the search, or ' : '') + 'open a new sheet.</td></tr>') +
      '</tbody></table></div></div>'
    );
  }

  /* -------------------------------------------------------------- order sheet */

  function viewOrder(id) {
    const order = state.orders.find((o) => o.id === id);
    if (!order) return '<div class="page"><h1>Order not found</h1><a class="linkish" href="#/orders">Back to orders</a></div>';
    const client = clientOf(order);
    const due = D.dueInfo(order, today());
    const total = D.orderTotal(order);
    const paid = D.orderPaid(order);
    const bal = D.orderBalance(order);
    const msgs = D.messages(order, state);

    const head =
      '<a class="back" href="#/orders">← Orders</a>' +
      '<div class="order-head">' +
      '<div><h1>' + esc(order.number) + '</h1>' +
      '<div class="who">' + esc(order.personName || (client && client.name) || 'Walk-in') + ' · ' +
      esc(order.garments.map((g) => garmentLabel(g.kind) + (g.qty > 1 ? ' ×' + g.qty : '')).join(' + ')) + '</div>' +
      stageBar(order) + '</div>' +
      '<div class="head-actions">' + (order.priority === 'rush' ? '<span class="pill rush">Rush</span>' : '') +
      '<span class="pill ' + (due.key === 'overdue' ? 'late' : 'due') + '">' + esc(due.label) + '</span>' +
      '<button class="btn ghost" data-act="print" data-id="' + order.id + '" type="button">Print ticket</button>' +
      (order.stage !== 'delivered'
        ? '<button class="btn primary" data-act="advance" data-id="' + order.id + '" type="button">Move to ' + esc(D.stageLabel(D.nextStage(order.stage))) + '</button>'
        : '<span class="pill done">Delivered</span>') +
      '</div></div>';

    const tabs =
      '<div class="tabs">' +
      '<button class="tab ' + (ui.tab === 'order' ? 'is-active' : '') + '" data-act="tab" data-tab="order" type="button">Order sheet</button>' +
      '<button class="tab ' + (ui.tab === 'board' ? 'is-active' : '') + '" data-act="tab" data-tab="board" type="button">Design board</button>' +
      '</div>';

    if (ui.tab === 'board') {
      return '<div class="page">' + head + tabs + boardView(order) + '</div>';
    }

    return (
      '<div class="page">' + head + tabs +
      '<div class="order-grid">' +
      '<div>' +
      order.garments.map((g) => {
        const def = D.GARMENTS[g.kind] || {};
        const style = Object.keys(g.style || {}).filter((k) => g.style[k]).map((k) => '<span class="spec"><b>' + esc(k) + '</b>' + esc(g.style[k]) + '</span>').join('');
        const fabric = g.fabric && (g.fabric.name || g.fabric.colour)
          ? '<span class="spec"><b>cloth</b>' + esc([g.fabric.name, g.fabric.colour, g.fabric.metres ? g.fabric.metres + 'm' : ''].filter(Boolean).join(' · ')) + '</span>'
          : '';
        return '<div class="garment-block">' +
          '<h3>' + esc(def.label || g.kind) + ' <span class="qty">×' + (g.qty || 1) + ' · ' + esc(money((g.price || 0) * (g.qty || 1))) + '</span></h3>' +
          '<div class="spec-row">' + style + fabric + '</div>' +
          (g.notes ? '<p class="sheet-note">' + esc(g.notes) + '</p>' : '') +
          measureGrid(g.measurements, def.fields) +
          '</div>';
      }).join('') +
      (order.notes ? '<div class="card"><div class="card-head"><h2>Notes for the shop</h2></div><p class="sheet-note" style="margin:0">' + esc(order.notes) + '</p></div>' : '') +
      '<div class="card"><div class="card-head"><h2>History</h2></div><ul class="timeline">' +
      (order.timeline || []).slice().reverse().map((t) => '<li><span class="dot"></span><span>' + esc(t.text) +
        '<span class="when">' + esc(new Date(t.at).toLocaleString()) + '</span></span></li>').join('') +
      '</ul></div></div>' +

      '<div>' +
      '<div class="card"><div class="card-head"><h2>Money</h2><button class="btn sm ghost" data-act="pay" data-id="' + order.id + '" type="button">Record payment</button></div>' +
      '<div class="money-rows">' +
      '<div class="money-row"><span>Total</span><span class="v">' + esc(money(total)) + '</span></div>' +
      '<div class="money-row"><span>Paid</span><span class="v">' + esc(money(paid)) + '</span></div>' +
      '<div class="money-row total ' + (bal > 0 ? 'due' : '') + '"><span>Balance</span><span class="v">' + esc(money(bal)) + '</span></div>' +
      '</div>' +
      ((order.payments || []).length
        ? '<ul class="pay-list">' + order.payments.map((p) => '<li><span>' + esc(D.fmtDate(new Date(p.at).toISOString().slice(0, 10))) + ' · ' + esc(p.method || 'cash') +
          '</span><span class="amt">' + esc(money(p.amount)) + '</span></li>').join('') + '</ul>'
        : '<p class="muted" style="font-size:11.5px;margin-top:10px">No payment logged yet.</p>') +
      '</div>' +

      '<div class="card"><div class="card-head"><h2>Message the client</h2></div>' +
      '<div style="display:flex;flex-direction:column;gap:6px">' +
      [['booked', 'Order confirmed'], ['trial', 'Ready for fitting'], ['ready', 'Ready for collection'], ['late', 'Running late'], ['payment', 'Balance reminder']]
        .map(([key, label]) => '<button class="btn ghost sm" style="justify-content:space-between" data-act="msg" data-id="' + order.id + '" data-kind="' + key + '" type="button">' +
          '<span>' + label + '</span><span class="mono" style="color:var(--faint)">WhatsApp</span></button>').join('') +
      '</div>' +
      '<p class="muted" style="font-size:11px;margin-top:8px">Copies the message if WhatsApp is not set up.</p>' +
      '</div>' +

      '<div class="card"><div class="card-head"><h2>Client</h2>' + (client ? '<a class="linkish" href="#/client/' + client.id + '">Open book</a>' : '') + '</div>' +
      (client
        ? '<div style="font-size:13px;font-weight:600">' + esc(client.name) + '</div>' +
          '<div class="mono" style="font-size:11.5px;color:var(--muted);margin-top:2px">' + esc(client.phone || '') + '</div>' +
          (order.personName && order.personName !== client.name ? '<div class="muted" style="font-size:11.5px;margin-top:6px">Measured for ' + esc(order.personName) + '</div>' : '') +
          '<div style="display:flex;gap:6px;margin-top:10px;flex-wrap:wrap">' +
          '<a class="btn sm ghost" href="#/client/' + client.id + '">Measurements</a>' +
          (client.phone ? '<button class="btn sm ghost" data-act="msg" data-id="' + order.id + '" data-kind="booked" type="button">WhatsApp</button>' : '') +
          '</div>'
        : '<p class="muted" style="font-size:12px">Walk-in order, no client book attached.</p>') +
      '</div>' +

      '<div class="card"><div class="card-head"><h2>Admin</h2></div>' +
      '<div style="display:flex;flex-direction:column;gap:6px">' +
      '<label class="label">Due date<input class="input" type="date" value="' + esc(order.dueDate) + '" data-field="dueDate" data-id="' + order.id + '"></label>' +
      '<label class="label">Assigned to<input class="input" value="' + esc(order.assignee || '') + '" data-field="assignee" data-id="' + order.id + '" placeholder="Who is cutting it?"></label>' +
      '<label class="label">Priority<select class="input" data-field="priority" data-id="' + order.id + '">' +
      '<option value="normal"' + (order.priority !== 'rush' ? ' selected' : '') + '>Normal</option>' +
      '<option value="rush"' + (order.priority === 'rush' ? ' selected' : '') + '>Rush</option></select></label>' +
      '<button class="btn sm danger" data-act="delete-order" data-id="' + order.id + '" type="button" style="margin-top:6px">Delete order</button>' +
      '</div></div>' +

      '</div></div></div>'
    );
  }

  /* -------------------------------------------------------------- design board */

  function boardView(order) {
    const g = order.garments[0] || { kind: 'shirt' };
    const entry = g.measurements || null;
    const def = D.GARMENTS[g.kind] || D.GARMENTS.shirt;
    const pins = (entry ? def.fields : []).map((f) => ({
      key: f.key,
      label: f.label,
      value: entry.values[f.key] != null ? D.length(entry.values[f.key], entry.unit) : '—',
    }));
    return (
      '<div class="board-wrap">' +
      '<div class="board-stage">' +
      '<div class="board-tools" id="board-tools">' +
      ['pen', 'line', 'arrow', 'text', 'pin', 'erase'].map((tool) => '<button class="tool' + (tool === 'pen' ? ' is-active' : '') + '" data-act="tool" data-tool="' + tool + '" type="button">' +
        ({ pen: 'Chalk', line: 'Line', arrow: 'Arrow', text: 'Note', pin: 'Pin measurement', erase: 'Erase' })[tool] + '</button>').join('') +
      '<span style="width:1px;height:20px;background:var(--line-2);margin:0 4px"></span>' +
      Object.keys(C.PALETTE).map((c) => '<button class="swatch' + (c === 'ink' ? ' is-active' : '') + '" data-act="colour" data-colour="' + C.PALETTE[c] + '" type="button" style="background:' + C.PALETTE[c] + '" aria-label="' + c + ' chalk"></button>').join('') +
      '<span style="width:1px;height:20px;background:var(--line-2);margin:0 4px"></span>' +
      '<button class="tool" data-act="undo" type="button">Undo</button>' +
      '<button class="tool" data-act="redo" type="button">Redo</button>' +
      '<button class="tool" data-act="grid" type="button" id="grid-toggle">Grid on</button>' +
      '<button class="tool" data-act="clear-board" type="button">Clear</button>' +
      '</div>' +
      '<div class="canvas-scroll"><div id="board"><canvas id="board-canvas"></canvas></div></div>' +
      '</div>' +

      '<div class="board-side">' +
      '<div class="card"><div class="card-head"><h2>What you are drawing on</h2></div>' +
      '<label class="label">Garment<select class="input" id="board-template">' +
      D.GARMENT_KEYS.map((k) => '<option value="' + k + '"' + (k === ((order.board && order.board.template) || g.kind) ? ' selected' : '') + '>' + esc(D.GARMENTS[k].label) + '</option>').join('') +
      '</select></label>' +
      '<p class="muted" style="font-size:11px;margin-top:8px">Sketch over the outline like pattern paper: seam allowances, dart placement, pocket shape, sleeve head.</p>' +
      '</div>' +

      '<div class="card"><div class="card-head"><h2>Pins</h2><span class="micro">' + pins.length + '</span></div>' +
      (pins.length
        ? '<ul class="pin-list">' + pins.map((p) => '<li><button type="button" data-act="pin-field" data-key="' + p.key + '">' +
          '<span>' + esc(p.label) + '</span><span class="v">' + esc(p.value) + '</span></button></li>').join('') + '</ul>' +
          '<p class="muted" style="font-size:11px;margin-top:8px">Pick a measurement, then tap a point on the sheet to pin it.</p>'
        : '<p class="muted" style="font-size:11.5px">This order has no measurements to pin. Take them from the client book first.</p>') +
      '</div>' +

      '<div class="card"><div class="card-head"><h2>Export</h2></div>' +
      '<div style="display:flex;flex-direction:column;gap:6px">' +
      '<button class="btn ghost sm" data-act="export-png" data-id="' + order.id + '" type="button">Download sheet as PNG</button>' +
      '<button class="btn ghost sm" data-act="print" data-id="' + order.id + '" type="button">Print with the ticket</button>' +
      '</div>' +
      '<p class="muted" style="font-size:11px;margin-top:8px">Saved automatically to this order.</p>' +
      '</div>' +
      '</div></div>'
    );
  }

  function mountBoard(orderId) {
    const order = state.orders.find((o) => o.id === orderId);
    const canvasEl = $('#board-canvas');
    if (!order || !canvasEl) return;
    const g = order.garments[0] || { kind: 'shirt' };
    const entry = g.measurements;
    const def = D.GARMENTS[g.kind] || D.GARMENTS.shirt;
    const measurements = entry ? def.fields.map((f) => ({ key: f.key, label: f.label, value: entry.values[f.key] != null ? D.length(entry.values[f.key], entry.unit) : '—' })) : [];

    const board = C.createBoard(canvasEl, {
      garmentDef: (k) => D.GARMENTS[k] || null,
      template: (order.board && order.board.template) || g.kind,
      onChange: (next) => {
        order.board = next;
        saveSoon();
      },
      onDirty: () => saveSoon(),
    });
    ui.board = board;
    board.setMeasurements(measurements);
    board.setState(order.board || { template: g.kind, showGrid: true, strokes: [], pins: [] });
    board.resize();

    const tpl = $('#board-template');
    if (tpl) tpl.addEventListener('change', () => {
      board.setTools({ template: tpl.value });
      order.board = board.getState();
      saveSoon();
    });

  }

  /* ----------------------------------------------------------------- bookings */

  function bookingRow(b) {
    return (
      '<div class="booking-row">' +
      '<div class="booking-time"><div class="t">' + esc(b.slot) + '</div><div class="d">' + esc(D.fmtDate(b.date)) + '</div></div>' +
      '<div class="booking-main"><div class="n">' + esc(b.name) + ' · ' + esc(garmentLabel(b.garment)) + '</div>' +
      '<div class="m">' + esc((D.SERVICES.find((s) => s.key === b.service) || {}).label || b.service) +
      (b.notes ? ' — ' + esc(b.notes) : '') + '</div></div>' +
      '<div class="booking-acts">' +
      (b.status === 'new'
        ? '<button class="btn sm chalk" data-act="confirm" data-id="' + b.id + '" type="button">Confirm</button>'
        : b.status === 'confirmed'
          ? '<button class="btn sm chalk" data-act="convert" data-id="' + b.id + '" type="button">Make order</button>'
          : b.status === 'converted' && b.orderId
            ? '<a class="btn sm ghost" href="#/order/' + b.orderId + '">Order sheet</a>'
            : '<span class="pill done">' + esc(b.status) + '</span>') +
      (b.phone ? '<a class="btn sm ghost" href="' + esc(D.waLink(b.phone, 'Hi ' + b.name + ', this is ' + (shop().name || 'the shop') + ' confirming your ' + (b.slot || '') + ' appointment.')) + '" target="_blank" rel="noopener">WhatsApp</a>' : '') +
      (b.status === 'new' || b.status === 'confirmed' ? '<button class="btn sm quiet" data-act="decline" data-id="' + b.id + '" type="button">Decline</button>' : '') +
      '</div></div>'
    );
  }

  function viewBookings() {
    const groups = [
      ['Needs an answer', (b) => b.status === 'new'],
      ['Today', (b) => b.status === 'confirmed' && b.date === today()],
      ['Upcoming', (b) => b.status === 'confirmed' && b.date > today()],
      ['Past & settled', (b) => b.status === 'converted' || b.status === 'declined' || (b.status === 'confirmed' && b.date < today())],
    ];
    const open = state.bookings.filter((b) => b.status === 'new' && b.date >= today()).length;
    return (
      '<div class="page">' +
      '<div class="page-head"><div><h1>Bookings</h1><div class="sub">' + open + ' waiting for an answer · clients book from your public page</div></div>' +
      '<div class="head-actions"><a class="btn ghost" href="book.html" target="_blank" rel="noopener">Open booking page</a>' +
      '<button class="btn primary" data-act="new-booking" type="button">Add walk-in</button></div></div>' +
      groups.map(([label, fn]) => {
        const rows = state.bookings.filter(fn).sort((a, b) => (a.date + a.slot).localeCompare(b.date + b.slot));
        if (!rows.length) return '';
        return '<div class="card"><div class="card-head"><h2>' + label + '</h2><span class="micro">' + rows.length + '</span></div>' + rows.map(bookingRow).join('') + '</div>';
      }).join('') +
      '</div>'
    );
  }

  /* ------------------------------------------------------------------ clients */

  function viewClients() {
    const q = ui.q.toLowerCase();
    const list = state.clients.filter((c) => !q || (c.name + ' ' + c.phone + ' ' + c.people.map((p) => p.name).join(' ')).toLowerCase().includes(q));
    return (
      '<div class="page">' +
      '<div class="page-head"><div><h1>Clients</h1><div class="sub">' + state.clients.length + ' books · measurements, family, history</div></div>' +
      '<div class="head-actions"><button class="btn primary" data-act="new-client" type="button">New client</button></div></div>' +
      '<div class="toolbar"><input class="input" id="client-search" placeholder="Search name or phone" value="' + esc(ui.q) + '" aria-label="Search clients"></div>' +
      '<div class="client-grid">' +
      list.map((c) => {
        const garments = new Set();
        c.people.forEach((p) => Object.keys(p.measures || {}).forEach((k) => garments.add(k)));
        const orders = state.orders.filter((o) => o.clientId === c.id);
        const owed = orders.filter((o) => o.stage !== 'delivered').reduce((s, o) => s + D.orderBalance(o), 0);
        return '<div class="client-card" data-act="open-client" data-id="' + c.id + '">' +
          '<div class="name">' + esc(c.name) + '</div>' +
          '<div class="contact">' + esc(c.phone || 'no phone') + '</div>' +
          '<div class="client-meta">' +
          Array.from(garments).slice(0, 4).map((g) => esc(garmentLabel(g))).join(' · ') +
          '<span class="sep">·</span>' + orders.length + ' order' + (orders.length === 1 ? '' : 's') +
          (c.people.length > 1 ? '<span class="sep">·</span>' + c.people.length + ' people' : '') +
          '</div>' +
          (owed > 0 ? '<div class="client-due">' + esc(money(owed)) + ' due</div>' : '') +
          '</div>';
      }).join('') +
      (list.length ? '' : '<div class="card"><p class="empty-row">No clients yet. Add the first one, or take a booking.</p></div>') +
      '</div></div>'
    );
  }

  function viewClient(id) {
    const client = state.clients.find((c) => c.id === id);
    if (!client) return '<div class="page"><h1>Client not found</h1><a class="linkish" href="#/clients">Back to clients</a></div>';
    if (!ui.personId || !client.people.some((p) => p.id === ui.personId)) ui.personId = client.people[0] && client.people[0].id;
    const person = client.people.find((p) => p.id === ui.personId) || client.people[0];
    const orders = state.orders.filter((o) => o.clientId === client.id);
    const sets = Object.keys(person.measures || {});
    const unit = shop().units;

    return (
      '<div class="page">' +
      '<a class="back" href="#/clients">← Clients</a>' +
      '<div class="page-head"><div><h1>' + esc(client.name) + '</h1>' +
      '<div class="sub mono">' + esc(client.phone || '') + (client.email ? ' · ' + esc(client.email) : '') + (client.address ? ' · ' + esc(client.address) : '') + '</div></div>' +
      '<div class="head-actions">' +
      (client.phone ? '<a class="btn ghost" target="_blank" rel="noopener" href="' + esc(D.waLink(client.phone, 'Hi ' + client.name + ', ' )) + '">WhatsApp</a>' : '') +
      '<button class="btn ghost" data-act="new-client" data-id="' + client.id + '" type="button">Add family member</button>' +
      '<button class="btn primary" data-act="new-order" data-id="' + client.id + '" type="button">New order</button>' +
      '</div></div>' +

      '<div class="people">' +
      client.people.map((p) => '<button class="person-btn' + (p.id === person.id ? ' is-active' : '') + '" data-act="person" data-id="' + p.id + '" type="button">' +
        esc(p.name) + '<small>' + esc(p.relation) + '</small></button>').join('') +
      '</div>' +

      '<div class="measure-layout">' +
      '<div class="figure">' + figureSVG(sets[0] || 'shirt', { values: (person.measures[sets[0]] || {}).values, unit: (person.measures[sets[0]] || {}).unit || unit }) +
      '<div class="cap">' + esc(person.name) + ' · ' + esc(sets.length ? garmentLabel(sets[0]) : 'no set yet') + '</div></div>' +

      '<div><div class="card"><div class="card-head"><h2>Measurement book</h2>' +
      '<button class="btn sm chalk" data-act="measure" data-id="' + client.id + '" type="button">Take measurements</button></div>' +
      (sets.length
        ? '<div class="measure-sets">' + sets.map((k) => {
            const e = person.measures[k];
            const def = D.GARMENTS[k] || {};
            return '<div class="mset"><div class="mset-head"><h3>' + esc(def.label || k) + '</h3>' +
              '<span class="meta">' + esc(e.unit) + ' · ' + (e.at ? D.fmtDate(new Date(e.at).toISOString().slice(0, 10)) : '') + (e.by ? ' · ' + esc(e.by) : '') + '</span></div>' +
              '<div class="vals">' + (def.fields || []).map((f) => '<span class="val">' + esc(f.label) + ' <b>' + esc(e.values[f.key] != null ? D.length(e.values[f.key], e.unit) : '—') + '</b></span>').join('') + '</div>' +
              (e.history && e.history.length ? '<p class="muted" style="font-size:10.5px;margin-top:8px">' + e.history.length + ' earlier version' + (e.history.length === 1 ? '' : 's') + ' kept</p>' : '') +
              '</div>';
          }).join('') + '</div>'
        : '<p class="muted" style="font-size:12.5px">Nothing on tape yet. Take the measurements once, reuse them on every order.</p>') +
      '</div>' +

      '<div class="card"><div class="card-head"><h2>Orders</h2><span class="micro">' + orders.length + '</span></div>' +
      (orders.length
        ? '<div class="table-wrap"><table class="list"><tbody>' + orders.map((o) => {
            const bal = D.orderBalance(o);
            return '<tr data-act="open-order" data-id="' + o.id + '">' +
              '<td class="mono">' + esc(o.number) + '</td>' +
              '<td>' + esc(o.garments.map((g) => garmentLabel(g.kind)).join(', ')) + '</td>' +
              '<td>' + esc(D.stageLabel(o.stage)) + '</td>' +
              '<td>' + pillFor(o) + '</td>' +
              '<td class="money" style="color:' + (bal > 0 ? 'var(--thread-red)' : 'var(--stitch)') + '">' + esc(money(bal)) + '</td></tr>';
          }).join('') + '</tbody></table></div>'
        : '<p class="muted" style="font-size:12.5px">No orders yet for ' + esc(client.name) + '.</p>') +
      '</div>' +
      (client.notes ? '<div class="card"><div class="card-head"><h2>Notes</h2></div><p class="sheet-note" style="margin:0">' + esc(client.notes) + '</p></div>' : '') +
      '</div></div></div>'
    );
  }

  /* -------------------------------------------------------------------- money */

  function viewMoney() {
    const month = today().slice(0, 7);
    const s = D.stats(state, month);
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setDate(1);
      d.setMonth(d.getMonth() - i);
      const key = d.toISOString().slice(0, 7);
      const booked = state.orders.filter((o) => o.bookedAt && String(o.bookedAt).slice(0, 7) === key).reduce((sum, o) => sum + D.orderTotal(o), 0);
      months.push({ key, label: D.fmtDate(key + '-01'), booked });
    }
    const max = Math.max(1, ...months.map((m) => m.booked));
    const unpaid = state.orders.filter((o) => o.stage !== 'delivered' && D.orderBalance(o) > 0)
      .sort((a, b) => D.dueInfo(a).sort - D.dueInfo(b).sort);
    const topGarments = Object.entries(s.perGarment).sort((a, b) => b[1] - a[1]).slice(0, 5);

    return (
      '<div class="page">' +
      '<div class="page-head"><div><h1>Money</h1><div class="sub">' + esc(new Date().toLocaleDateString(undefined, { month: 'long', year: 'numeric' })) + ' · booked, collected, still owed</div></div>' +
      '<div class="head-actions"><button class="btn ghost" data-act="export" type="button">Export records</button></div></div>' +
      '<div class="stats">' +
      stat('Booked this month', money(s.booked), s.delivered + ' delivered', '') +
      stat('Collected', money(s.collected), 'payments received', '') +
      stat('Outstanding', money(s.outstanding), 'across all open orders', s.outstanding > 0 ? 'is-late' : '') +
      stat('Rush jobs', String(s.rush), 'this month', '') +
      '</div>' +
      '<div class="order-grid">' +
      '<div class="card"><div class="card-head"><h2>Booked, last six months</h2></div>' +
      '<div class="bars">' + months.map((m) => '<div class="bar-col"><div class="bar' + (m.key === month ? '' : ' soft') + '" style="height:' + Math.max(2, (m.booked / max) * 100) + '%" title="' + esc(money(m.booked)) + '"></div>' +
        '<div class="bar-lbl">' + esc(m.label) + '</div></div>').join('') + '</div>' +
      '</div>' +
      '<div class="card"><div class="card-head"><h2>What the shop is making</h2></div>' +
      (topGarments.length
        ? topGarments.map(([k, v]) => '<div class="money-row" style="margin-bottom:5px"><span>' + esc(garmentLabel(k)) + '</span><span class="v">' + esc(money(v)) + '</span></div>').join('')
        : '<p class="muted" style="font-size:12px">No orders booked this month yet.</p>') +
      '</div></div>' +
      '<div class="card" style="margin-top:14px"><div class="card-head"><h2>Owed to you</h2><span class="micro">' + unpaid.length + ' order' + (unpaid.length === 1 ? '' : 's') + '</span></div>' +
      (unpaid.length
        ? '<div class="table-wrap"><table class="list"><thead><tr><th>Order</th><th>Client</th><th>Stage</th><th>Due</th><th class="right">Balance</th><th></th></tr></thead><tbody>' +
          unpaid.map((o) => {
            const c = clientOf(o);
            return '<tr data-act="open-order" data-id="' + o.id + '"><td class="mono">' + esc(o.number) + '</td>' +
              '<td>' + esc(o.personName || (c && c.name) || '—') + '</td>' +
              '<td>' + esc(D.stageLabel(o.stage)) + '</td>' +
              '<td>' + pillFor(o) + '</td>' +
              '<td class="money">' + esc(money(D.orderBalance(o))) + '</td>' +
              '<td class="acts"><button class="btn sm ghost" data-act="pay" data-id="' + o.id + '" type="button">Take payment</button></td></tr>';
          }).join('') + '</tbody></table></div>'
        : '<p class="muted" style="font-size:12.5px">Everyone is square.</p>') +
      '</div></div>'
    );
  }

  /* ----------------------------------------------------------------- settings */

  function viewSettings() {
    const s = shop();
    return (
      '<div class="page" style="max-width:820px">' +
      '<div class="page-head"><div><h1>Settings</h1><div class="sub">Shop details go on tickets and the booking page</div></div></div>' +
      '<form class="card" data-form="settings">' +
      '<div class="grid-2">' +
      '<label class="label span-2">Shop name<input class="input" name="name" value="' + esc(s.name) + '" placeholder="Nusrat Tailors"></label>' +
      '<label class="label span-2">Tagline<input class="input" name="tagline" value="' + esc(s.tagline) + '" placeholder="Bespoke tailoring since 1987"></label>' +
      '<label class="label">Phone<input class="input" name="phone" value="' + esc(s.phone) + '"></label>' +
      '<label class="label">WhatsApp<input class="input" name="whatsapp" value="' + esc(s.whatsapp) + '"></label>' +
      '<label class="label span-2">Address<textarea class="input" name="address" rows="2">' + esc(s.address) + '</textarea></label>' +
      '<label class="label">Currency<select class="input" name="currency">' +
      Object.keys(D.CURRENCIES).map((k) => '<option value="' + k + '"' + (s.currency === k ? ' selected' : '') + '>' + esc(D.CURRENCIES[k].label) + '</option>').join('') +
      '</select></label>' +
      '<label class="label">Measurements in<select class="input" name="units">' +
      '<option value="in"' + (s.units === 'in' ? ' selected' : '') + '>Inches</option>' +
      '<option value="cm"' + (s.units === 'cm' ? ' selected' : '') + '>Centimetres</option></select></label>' +
      '<label class="label">Opens at<input class="input" name="openHour" type="number" min="0" max="23" value="' + Number(s.openHour) + '"></label>' +
      '<label class="label">Closes at<input class="input" name="closeHour" type="number" min="1" max="24" value="' + Number(s.closeHour) + '"></label>' +
      '<label class="label">Booking slot (min)<input class="input" name="slotMinutes" type="number" min="15" max="120" step="15" value="' + Number(s.slotMinutes) + '"></label>' +
      '<label class="label">Closed day<select class="input" name="closedDay">' +
      ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((d, i) =>
        '<option value="' + i + '"' + ((s.closedDays || [0])[0] === i ? ' selected' : '') + '>' + d + '</option>').join('') +
      '</select></label>' +
      '</div>' +
      '<div class="sheet-foot" style="margin-top:14px"><button class="btn primary" type="submit">Save shop details</button></div>' +
      '</form>' +

      '<div class="card"><div class="card-head"><h2>Your booking page</h2></div>' +
      '<p class="muted" style="font-size:12.5px">Clients open this link, pick a slot, and the booking lands in your Bookings tab. Nothing to install.</p>' +
      '<div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap">' +
      '<a class="btn ghost" href="book.html" target="_blank" rel="noopener">Preview page</a>' +
      '<button class="btn ghost" data-act="copy-link" type="button">Copy link</button>' +
      '<code class="mono" style="font-size:11px;padding:8px 10px;background:#f6f1e4;border:1px solid var(--line);border-radius:4px" id="book-link">' + esc(bookingLink()) + '</code>' +
      '</div></div>' +

      '<div class="card"><div class="card-head"><h2>Plan</h2></div>' +
      (state.plan.tier === 'pro'
        ? '<p style="font-size:13px"><b>Pro shop</b> — unlimited orders, every device in the shop.</p>'
        : '<p class="muted" style="font-size:12.5px">Free plan: ' + FREE_LIMIT + ' orders. Used so far: ' + (state.plan.ordersCreated || 0) + '.</p>' +
          '<button class="btn chalk" data-act="upgrade" type="button" style="margin-top:10px">Upgrade the shop — $12/mo</button>') +
      '</div>' +

      '<div class="card"><div class="card-head"><h2>Data</h2></div>' +
      '<p class="muted" style="font-size:12.5px">Everything lives in this browser. Back it up before clearing site data.</p>' +
      '<div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap">' +
      '<button class="btn ghost" data-act="backup" type="button">Download backup</button>' +
      '<button class="btn ghost" data-act="restore" type="button">Restore backup</button>' +
      (state.demo ? '<button class="btn ghost danger" data-act="clear-demo" type="button">Clear the demo shop</button>' : '') +
      '</div></div></div>'
    );
  }

  function bookingLink() {
    return location.href.replace(/index\.html.*$/, '').replace(/#.*$/, '') + 'book.html?shop=' + encodeURIComponent(shop().name || 'chalkline');
  }

  function demoBanner() {
    if (!state.demo) return '';
    return '<div class="card" style="border-color:var(--chalk);background:var(--chalk-wash);margin-bottom:14px;display:flex;justify-content:space-between;gap:12px;align-items:center;flex-wrap:wrap">' +
      '<div><b style="font-size:13px">You are looking at a demo shop.</b><div class="muted" style="font-size:12px">Nusrat Tailors is sample data so you can try the board, the book and the booking page.</div></div>' +
      '<div style="display:flex;gap:6px"><button class="btn sm ghost" data-act="clear-demo" type="button">Start fresh</button>' +
      '<button class="btn sm chalk" data-act="new-order" type="button">Try a new order</button></div></div>';
  }

  /* ------------------------------------------------------------------ actions */

  const ACTIONS = {
    'new-order': (id) => openNewOrder(id),
    'new-client': (id) => (id ? openAddPerson(id) : openNewClient()),
    'open-order': (id) => {
      ui.tab = 'order';
      location.hash = '#/order/' + id;
    },
    'open-client': (id) => {
      ui.personId = null;
      location.hash = '#/client/' + id;
    },
    person: (id) => {
      ui.personId = id;
      render();
    },
    advance: (id) => {
      const order = state.orders.find((o) => o.id === id);
      if (!order) return;
      const to = D.advanceOrder(order);
      saveNow();
      render();
      if (to === 'trial') toast('At the fitting — send the fitting message?', 'WhatsApp', () => msgClient(order, 'trial'));
      else if (to === 'ready') toast('Ready for collection — tell the client?', 'WhatsApp', () => msgClient(order, 'ready'));
      else toast('Moved to ' + D.stageLabel(to));
    },
    tab: (id, el) => {
      ui.tab = el.dataset.tab;
      render();
    },
    pay: (id) => openPayment(id),
    msg: (id, el) => msgClient(state.orders.find((o) => o.id === id), el.dataset.kind),
    print: (id) => printOrder(state.orders.find((o) => o.id === id)),
    convert: (id) => openConvert(id),
    confirm: (id) => {
      const b = state.bookings.find((x) => x.id === id);
      if (!b) return;
      b.status = 'confirmed';
      saveNow();
      render();
      toast('Confirmed — ' + b.name + ' at ' + b.slot);
    },
    decline: (id) => {
      const b = state.bookings.find((x) => x.id === id);
      if (!b) return;
      b.status = 'declined';
      saveNow();
      render();
      toast('Booking declined');
    },
    'new-booking': () => openNewBooking(),
    measure: (id) => openMeasure(id),
    'delete-order': (id) => {
      const order = state.orders.find((o) => o.id === id);
      if (!order) return;
      if (!confirm('Delete ' + order.number + '? The measurements stay in the client book.')) return;
      state.orders = state.orders.filter((o) => o.id !== id);
      saveNow();
      location.hash = '#/orders';
      toast('Order deleted');
    },
    'clear-demo': () => {
      if (!confirm('Clear the demo shop and start with an empty book?')) return;
      const plan = state.plan;
      state = D.blankState();
      state.plan = plan;
      state.seen = true;
      D.save(state);
      location.hash = '#/today';
      render();
      toast('Fresh book. Add your shop name in Settings.');
    },
    upgrade: () => openUpgrade(),
    'copy-link': () => {
      copy(bookingLink()).then(() => toast('Booking link copied'));
    },
    backup: () => downloadBackup(),
    restore: () => $('#restore-input').click(),
    export: () => downloadBackup(),
    tool: (id, el) => {
      if (!ui.board) return;
      ui.board.setTools({ tool: el.dataset.tool });
      $$('.tool[data-act="tool"]').forEach((b) => b.classList.toggle('is-active', b === el));
    },
    colour: (id, el) => {
      if (!ui.board) return;
      ui.board.setTools({ colour: el.dataset.colour });
      $$('.swatch').forEach((b) => b.classList.toggle('is-active', b === el));
    },
    undo: () => ui.board && ui.board.undo(),
    redo: () => ui.board && ui.board.redo(),
    'clear-board': () => {
      if (ui.board && confirm('Clear every stroke on this sheet?')) ui.board.clear();
    },
    grid: () => {
      if (!ui.board) return;
      const on = !ui.board.getState().showGrid;
      ui.board.setTools({ showGrid: on });
      const b = $('#grid-toggle');
      if (b) b.textContent = on ? 'Grid on' : 'Grid off';
    },
    'pin-field': (id, el) => {
      if (!ui.board) return;
      ui.board.setTools({ tool: 'pin', pinField: el.dataset.key });
      $$('.pin-list button').forEach((b) => b.classList.toggle('is-active', b === el));
      toast('Tap the sheet to pin ' + (el.querySelector('span').textContent || 'the measurement'));
    },
    'export-png': (id) => {
      const order = state.orders.find((o) => o.id === id);
      if (!order || !order.board) return toast('Draw something first');
      const url = boardPNG(order);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'chalkline-' + order.number.replace('#', '') + '.png';
      a.click();
      toast('Sheet downloaded');
    },
  };

  function onViewClick(e) {
    const el = e.target.closest('[data-act]');
    if (!el) return;
    const act = el.dataset.act;
    if (!ACTIONS[act]) return;
    if (el.tagName === 'A' && act !== 'open-order') return;
    e.preventDefault();
    ACTIONS[act](el.dataset.id, el);
  }

  /* ------------------------------------------------------------------ messages */

  function msgClient(order, kind) {
    if (!order) return;
    const client = clientOf(order);
    const text = D.messages(order, state)[kind] || '';
    const phone = (client && (client.whatsapp || client.phone)) || '';
    if (phone) {
      window.open(D.waLink(phone, text), '_blank', 'noopener');
      toast('Opening WhatsApp');
    } else {
      copy(text).then(() => toast('Message copied — no phone on file'));
    }
  }

  function copy(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(text).catch(fallbackCopy);
    fallbackCopy(text);
    return Promise.resolve();
    function fallbackCopy(t) {
      const ta = document.createElement('textarea');
      ta.value = t;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); } catch (e) {}
      ta.remove();
    }
  }

  /* ------------------------------------------------------------------- tickets */

  function boardPNG(order) {
    const g = (order.garments || [])[0];
    const def = D.GARMENTS[g && g.kind] || D.GARMENTS.shirt;
    const entry = g && g.measurements;
    const measurements = entry
      ? def.fields.map((f) => ({ key: f.key, label: f.label, value: entry.values[f.key] != null ? D.length(entry.values[f.key], entry.unit) : '—' }))
      : [];
    const design = order.board || { template: g ? g.kind : 'shirt', showGrid: true, strokes: [], pins: [] };
    try {
      return C.renderPNG(design, { garmentDef: (k) => D.GARMENTS[k] || null, measurements, scale: 2 });
    } catch (e) {
      return '';
    }
  }

  function printOrder(order) {
    if (!order) return;
    const client = clientOf(order);
    const shopName = shop().name || 'Chalkline';
    const png = order.board ? boardPNG(order) : '';
    const tickets = order.garments.map((g) => {
      const def = D.GARMENTS[g.kind] || {};
      const m = g.measurements;
      const measures = m && def.fields
        ? def.fields.map((f) => '<div><div class="k">' + esc(f.label) + '</div><div class="v">' + esc(m.values[f.key] != null ? D.length(m.values[f.key], m.unit) : '—') + '</div></div>').join('')
        : '<div style="grid-column:1/-1"><div class="k">Alteration</div><div class="v">As described</div></div>';
      const styles = Object.keys(g.style || {}).filter((k) => g.style[k]).map((k) => '<span><b>' + esc(k) + '</b> ' + esc(g.style[k]) + '</span>').join('');
      return (
        '<div class="ticket">' +
        '<div class="ticket-head"><div><div class="shop">' + esc(shopName) + '</div>' +
        '<div>' + esc(shop().phone || '') + (shop().address ? ' · ' + esc(shop().address) : '') + '</div></div>' +
        '<div style="text-align:right"><div class="kind">' + (g.qty > 1 ? g.qty + ' × ' : '') + 'cutting ticket</div><div class="no">' + esc(order.number) + '</div></div></div>' +
        '<div class="ticket-meta">' +
        '<div><div class="k">Client</div><div class="v">' + esc(order.personName || (client && client.name) || '') + (client && client.phone ? ' · ' + esc(client.phone) : '') + '</div></div>' +
        '<div><div class="k">Garment</div><div class="v">' + esc(def.label || g.kind) + '</div></div>' +
        '<div><div class="k">Deliver by</div><div class="v">' + esc(D.fmtDate(order.dueDate, { long: true })) + '</div></div>' +
        '</div>' +
        '<div class="ticket-cols"><div>' +
        '<div class="ticket-measures">' + measures + '</div>' +
        (styles ? '<div class="ticket-styles">' + styles + '</div>' : '') +
        '</div><div>' +
        (png ? '<div class="ticket-sketch"><img src="' + png + '" alt="Design sketch"><div class="cap">Design board</div></div>' : '') +
        '</div></div>' +
        ((g.notes || order.notes) ? '<div class="ticket-note">' + esc([g.notes, order.notes].filter(Boolean).join('\n')) + '</div>' : '') +
        '<div class="ticket-check">' + ['Cut', 'Stitch', 'Trial', 'Finish', 'Press', 'QC'].map((s) => '<span>' + s + '</span>').join('') + '</div>' +
        '<div class="ticket-sign"><div>Cutter</div><div>Checked</div></div>' +
        '</div>'
      );
    }).join('');

    $('#print').innerHTML = tickets;
    saveNow();
    window.print();
  }

  /* ------------------------------------------------------------------- dialogs */

  const dlg = $('#dlg');

  function openDialog(html, opts) {
    dlg.className = 'sheet' + (opts && opts.wide ? ' wide' : '');
    dlg.innerHTML = html;
    if (!dlg.open) dlg.showModal();
    const first = dlg.querySelector('input, select, textarea, button');
    if (first && opts && opts.focus !== false) setTimeout(() => first.focus(), 30);
  }
  function closeDialog() {
    if (dlg.open) dlg.close();
  }
  dlg.addEventListener('click', (e) => {
    if (e.target.closest('[data-close]')) closeDialog();
    if (e.target === dlg) closeDialog();
  });

  function dialogShell(title, sub, body, foot) {
    return '<form class="sheet-body" data-form="' + esc(foot ? foot.form : '') + '">' +
      '<div class="sheet-head"><div><h2>' + esc(title) + '</h2>' + (sub ? '<div class="sub">' + esc(sub) + '</div>' : '') + '</div>' +
      '<button class="btn icon quiet" type="button" data-close aria-label="Close">✕</button></div>' +
      body +
      (foot ? '<div class="sheet-foot"><button class="btn ghost" type="button" data-close>Cancel</button>' +
        '<button class="btn primary" type="submit">' + esc(foot.submit) + '</button></div>' : '') +
      '</form>';
  }

  function openNewClient() {
    openDialog(
      dialogShell('New client', 'One book per household. Family members live inside it.', '' +
        '<label class="label">Name<input class="input" name="name" required placeholder="Ayesha Khan"></label>' +
        '<div class="grid-2"><label class="label">Phone<input class="input" name="phone" required placeholder="0300 1234567"></label>' +
        '<label class="label">Email<input class="input" name="email" type="email" placeholder="optional"></label></div>' +
        '<label class="label">Address<textarea class="input" name="address" rows="2"></textarea></label>' +
        '<label class="label">Notes<textarea class="input" name="notes" rows="2" placeholder="Prefers a loose fit, calls after 5pm."></textarea></label>',
        { form: 'new-client', submit: 'Add client' })
    );
  }

  function openAddPerson(clientId) {
    const client = state.clients.find((c) => c.id === clientId);
    if (!client) return;
    const newClient = !client.people.length;
    openDialog(
      dialogShell(newClient ? 'Add a person' : 'Add a family member', 'Measurements are kept per person.', '' +
        '<label class="label">Name<input class="input" name="name" required></label>' +
        '<label class="label">Relation<input class="input" name="relation" placeholder="Son, daughter, mother"></label>',
        { form: 'person', submit: 'Add' }).replace('<form', '<form data-client="' + clientId + '"')
    );
  }

  function openNewOrder(prefillClientId) {
    if ((state.plan.ordersCreated || 0) >= FREE_LIMIT && state.plan.tier !== 'pro') {
      return openUpgrade('You have used the ' + FREE_LIMIT + ' free orders.');
    }
    if (!state.clients.length) {
      toast('Add a client first — the measurements live in their book.');
      return openNewClient();
    }
    const clientId = prefillClientId || (state.clients[0] && state.clients[0].id);
    const client = state.clients.find((c) => c.id === clientId) || state.clients[0];
    const garment = 'shirt';
    const due = D.addDaysISO(today(), 10);
    openDialog(
      dialogShell('New order', 'One sheet per garment. Measurements lock to the order.', '' +
        '<div class="grid-2">' +
        '<label class="label">Client<select class="input" name="client" id="order-client">' +
        state.clients.map((c) => '<option value="' + c.id + '"' + (c.id === client.id ? ' selected' : '') + '>' + esc(c.name) + '</option>').join('') +
        '</select></label>' +
        '<label class="label">Measured for<select class="input" name="person" id="order-person">' +
        client.people.map((p) => '<option value="' + p.id + '">' + esc(p.name) + ' · ' + esc(p.relation) + '</option>').join('') +
        '</select></label>' +
        '<label class="label span-2">Garment<select class="input" name="garment" id="order-garment">' +
        D.GARMENT_KEYS.map((k) => '<option value="' + k + '"' + (k === garment ? ' selected' : '') + '>' + esc(D.GARMENTS[k].label) + '</option>').join('') +
        '</select></label>' +
        '<label class="label">Quantity<input class="input" name="qty" type="number" min="1" value="1"></label>' +
        '<label class="label">Price per piece<input class="input" name="price" type="number" min="0" step="1" placeholder="0"></label>' +
        '<label class="label">Due date<input class="input" name="dueDate" type="date" value="' + due + '"></label>' +
        '<label class="label">Trial date<input class="input" name="trialDate" type="date"></label>' +
        '<label class="label">Deposit taken<input class="input" name="deposit" type="number" min="0" step="1" value="0"></label>' +
        '<label class="label">Assigned to<input class="input" name="assignee" placeholder="Master cutter"></label>' +
        '<label class="label span-2">Notes for the cutter<textarea class="input" name="notes" rows="2" placeholder="Ban collar 1.5in, hidden placket, side pockets."></textarea></label>' +
        '</div>' +
        '<p class="hint err" data-error></p>' +
        '<p class="muted" style="font-size:11px">Uses the latest measurement set for this person. Edit it in their book — this order keeps the numbers it was booked with.</p>',
        { form: 'new-order', submit: 'Open order' })
    );
    const clientSel = $('#order-client');
    const personSel = $('#order-person');
    if (clientSel && personSel) {
      clientSel.addEventListener('change', () => {
        const c = state.clients.find((x) => x.id === clientSel.value);
        personSel.innerHTML = (c ? c.people : []).map((p) => '<option value="' + p.id + '">' + esc(p.name) + ' · ' + esc(p.relation) + '</option>').join('');
      });
    }
  }

  function openNewBooking() {
    openDialog(
      dialogShell('Add a walk-in booking', 'Same sheet the public booking page writes to.', '' +
        '<div class="grid-2">' +
        '<label class="label">Name<input class="input" name="name" required></label>' +
        '<label class="label">Phone<input class="input" name="phone" required placeholder="0300 1234567"></label>' +
        '<label class="label">Date<input class="input" name="date" type="date" value="' + today() + '"></label>' +
        '<label class="label">Time<input class="input" name="slot" type="time" value="11:00"></label>' +
        '<label class="label">Garment<select class="input" name="garment">' +
        D.GARMENT_KEYS.map((k) => '<option value="' + k + '">' + esc(D.GARMENTS[k].label) + '</option>').join('') + '</select></label>' +
        '<label class="label">Service<select class="input" name="service">' +
        D.SERVICES.map((s) => '<option value="' + s.key + '">' + esc(s.label) + '</option>').join('') + '</select></label>' +
        '</div>' +
        '<label class="label">Notes<textarea class="input" name="notes" rows="2"></textarea></label>',
        { form: 'new-booking', submit: 'Save booking' })
    );
  }

  function openConvert(bookingId) {
    const b = state.bookings.find((x) => x.id === bookingId);
    if (!b) return;
    openDialog(
      dialogShell('Make an order from ' + b.name, 'Creates the client book if this phone is new.', '' +
        '<div class="grid-2">' +
        '<label class="label">Garment<select class="input" name="garment">' +
        D.GARMENT_KEYS.map((k) => '<option value="' + k + '"' + (k === b.garment ? ' selected' : '') + '>' + esc(D.GARMENTS[k].label) + '</option>').join('') + '</select></label>' +
        '<label class="label">Price<input class="input" name="price" type="number" min="0" step="1"></label>' +
        '<label class="label">Due date<input class="input" name="dueDate" type="date" value="' + D.addDaysISO(today(), 10) + '"></label>' +
        '<label class="label">Deposit<input class="input" name="deposit" type="number" min="0" step="1" value="0"></label>' +
        '</div>',
        { form: 'convert', submit: 'Create order' }).replace('<form', '<form data-booking="' + b.id + '"')
    );
  }

  function openPayment(orderId) {
    const order = state.orders.find((o) => o.id === orderId);
    if (!order) return;
    const bal = D.orderBalance(order);
    openDialog(
      dialogShell('Record a payment', order.number + ' · balance ' + money(bal), '' +
        '<div class="grid-2">' +
        '<label class="label">Amount<input class="input" name="amount" type="number" min="0" step="1" value="' + bal + '" required></label>' +
        '<label class="label">Method<select class="input" name="method"><option value="cash">Cash</option><option value="transfer">Transfer</option><option value="card">Card</option><option value="easypaisa">EasyPaisa / JazzCash</option></select></label>' +
        '</div>',
        { form: 'payment', submit: 'Record' }).replace('<form', '<form data-order="' + order.id + '"')
    );
  }

  function openMeasure(clientId) {
    const client = state.clients.find((c) => c.id === clientId);
    if (!client) return;
    const person = client.people.find((p) => p.id === ui.personId) || client.people[0];
    const first = Object.keys(person.measures || {})[0] || 'shirt';
    const entry = person.measures[first];
    const unit = entry ? entry.unit : shop().units;
    const values = entry ? entry.values : {};

    openDialog(
      dialogShell('Measure ' + person.name, 'Tape on the body, never on the clothes.', '' +
        '<div class="measure-layout">' +
        '<div class="figure" id="measure-figure">' + figureSVG(first, { values, unit }) + '<div class="cap" id="measure-cap">' + esc(D.GARMENTS[first].label) + '</div></div>' +
        '<div>' +
        '<div class="grid-2" style="margin-bottom:10px">' +
        '<label class="label">Garment<select class="input" name="garment" id="measure-garment">' +
        D.GARMENT_KEYS.map((k) => '<option value="' + k + '"' + (k === first ? ' selected' : '') + '>' + esc(D.GARMENTS[k].label) + '</option>').join('') + '</select></label>' +
        '<label class="label">Unit<select class="input" name="unit" id="measure-unit">' +
        '<option value="in"' + (unit === 'in' ? ' selected' : '') + '>Inches</option><option value="cm"' + (unit === 'cm' ? ' selected' : '') + '>Centimetres</option></select></label>' +
        '</div>' +
        '<div id="measure-fields"></div>' +
        '<label class="label" style="margin-top:10px">Taken by<input class="input" name="by" placeholder="Who had the tape?"></label>' +
        '</div></div>',
        { form: 'measure', submit: 'Save measurements', wide: true }).replace('<form', '<form data-client="' + clientId + '" data-person="' + person.id + '"')
    );

    const state_ = { garment: first, unit, values: Object.assign({}, values) };
    const fieldsHost = $('#measure-fields');
    const figHost = $('#measure-figure');

    function paintFields() {
      const def = D.GARMENTS[state_.garment];
      fieldsHost.innerHTML =
        '<div class="grid-2">' + def.fields.map((f) => {
          const v = state_.values[f.key];
          return '<label class="label" title="' + esc(f.hint) + '">' + esc(f.label) +
            '<input class="input num" data-measure="' + f.key + '" type="number" step="0.25" min="0" value="' + (v == null ? '' : esc(v)) + '" placeholder="—">' +
            '</label>';
        }).join('') + '</div>' +
        '<p class="muted" style="font-size:10.5px;margin-top:6px">Hover a field for the measuring note. Blank fields are left out of the ticket.</p>';
      $$('input[data-measure]', fieldsHost).forEach((inp) => {
        inp.addEventListener('input', () => {
          state_.values[inp.dataset.measure] = inp.value;
          paintFigure();
        });
        inp.addEventListener('focus', () => paintFigure(inp.dataset.measure));
      });
      if (def.fields[0]) paintFigure(def.fields[0].key);
    }

    function paintFigure(active) {
      figHost.innerHTML = figureSVG(state_.garment, { values: state_.values, unit: state_.unit, active: active }) +
        '<div class="cap">' + esc(D.GARMENTS[state_.garment].label) + '</div>';
    }

    $('#measure-garment').addEventListener('change', (e) => {
      state_.garment = e.target.value;
      const existing = person.measures[state_.garment];
      state_.values = existing ? Object.assign({}, existing.values) : {};
      if (existing) {
        state_.unit = existing.unit;
        $('#measure-unit').value = existing.unit;
      }
      paintFields();
    });

    $('#measure-unit').addEventListener('change', (e) => {
      const to = e.target.value;
      const converted = {};
      for (const k of Object.keys(state_.values)) {
        if (state_.values[k] !== '' && !isNaN(Number(state_.values[k]))) converted[k] = D.convert(state_.values[k], state_.unit, to);
      }
      state_.unit = to;
      state_.values = converted;
      paintFields();
    });

    paintFields();
  }

  function openUpgrade(why) {
    const configured = state.plan.checkoutUrl && state.plan.checkoutUrl.indexOf('http') === 0;
    openDialog(
      dialogShell('Upgrade the shop', why || 'Unlimited orders for one shop, on every device in the workroom.', '' +
        '<div class="grid-2">' +
        '<div class="card"><div class="micro">Shop</div><div style="font-family:var(--display);font-size:30px">$12<span style="font-size:13px;color:var(--muted)">/mo</span></div>' +
        '<p class="muted" style="font-size:11.5px;margin-top:6px">Unlimited orders, all clients, design board, ticket printing.</p></div>' +
        '<div class="card" style="border-color:var(--ink)"><div class="micro">Yearly</div><div style="font-family:var(--display);font-size:30px">$99<span style="font-size:13px;color:var(--muted)">/yr</span></div>' +
        '<p class="muted" style="font-size:11.5px;margin-top:6px">Two months free. Most shops pick this once the season starts.</p></div>' +
        '</div>' +
        '<p class="muted" style="font-size:11.5px">Free plan stays at ' + FREE_LIMIT + ' orders: enough to run a test month.</p>',
        null)
    );
    const actions = document.createElement('div');
    actions.className = 'sheet-foot';
    actions.innerHTML = '<button class="btn ghost" type="button" data-close>Not yet</button>' +
      (configured
        ? '<a class="btn primary" href="' + esc(state.plan.checkoutUrl) + '" target="_blank" rel="noopener">Open checkout</a>'
        : '<button class="btn primary" type="button" id="buy-demo">Continue to checkout</button>');
    dlg.querySelector('form').appendChild(actions);
    const buy = $('#buy-demo');
    if (buy) buy.addEventListener('click', () => {
      state.plan.tier = 'pro';
      saveNow();
      closeDialog();
      render();
      toast('Pro enabled on this device (demo checkout).');
    });
  }

  /* ------------------------------------------------------------------- forms */

  document.addEventListener('submit', (e) => {
    const form = e.target.closest('[data-form]');
    if (!form) return;
    e.preventDefault();
    const kind = form.dataset.form;
    const fd = new FormData(form);
    const val = (k) => String(fd.get(k) || '').trim();

    if (kind === 'new-client') {
      if (!val('name') || !val('phone')) return showFormError(form, 'Name and phone are required.');
      const client = D.newClient({ name: val('name'), phone: val('phone'), email: val('email'), address: val('address'), notes: val('notes') });
      state.clients.unshift(client);
      saveNow();
      closeDialog();
      ui.personId = client.people[0].id;
      location.hash = '#/client/' + client.id;
      render();
      toast('Client added — take measurements next', 'Measure', () => openMeasure(client.id));
      return;
    }

    if (kind === 'person') {
      const client = state.clients.find((c) => c.id === form.dataset.client);
      if (!client) return;
      const person = D.addPerson(client, val('name'), val('relation'));
      saveNow();
      closeDialog();
      ui.personId = person.id;
      render();
      toast('Added ' + person.name);
      return;
    }

    if (kind === 'new-order') {
      const client = state.clients.find((c) => c.id === val('client'));
      if (!client) return showFormError(form, 'Pick a client.');
      const order = D.createOrder(state, {
        clientId: client.id,
        personId: val('person'),
        garments: [{ kind: val('garment'), qty: Number(val('qty')) || 1, price: Number(val('price')) || 0 }],
        dueDate: val('dueDate'),
        trialDate: val('trialDate'),
        deposit: Number(val('deposit')) || 0,
        assignee: val('assignee'),
        notes: val('notes'),
      });
      saveNow();
      closeDialog();
      ui.tab = 'order';
      location.hash = '#/order/' + order.id;
      render();
      const person = client.people.find((p) => p.id === order.personId);
      const set = person && person.measures[val('garment')];
      toast(set ? 'Order opened with the measurements on file' : 'Order opened — no measurements on file yet', set ? '' : 'Measure', set ? null : () => openMeasure(client.id));
      return;
    }

    if (kind === 'new-booking') {
      const b = D.newBooking({ name: val('name'), phone: val('phone'), date: val('date'), slot: val('slot'), garment: val('garment'), service: val('service'), notes: val('notes') });
      const check = D.validateBooking(b);
      if (!check.ok) return showFormError(form, Object.values(check.errors).join(' '));
      state.bookings.push(b);
      saveNow();
      closeDialog();
      render();
      toast('Booking saved for ' + D.fmtDate(b.date));
      return;
    }

    if (kind === 'convert') {
      const bookingId = form.dataset.booking;
      const result = D.convertBooking(state, bookingId, {
        price: Number(val('price')) || 0,
        dueDate: val('dueDate'),
        deposit: Number(val('deposit')) || 0,
      });
      if (!result) return;
      // the dialog's garment choice wins
      result.order.garments[0].kind = val('garment');
      saveNow();
      closeDialog();
      ui.tab = 'order';
      location.hash = '#/order/' + result.order.id;
      render();
      toast('Client book and order created', 'Measure now', () => openMeasure(result.client.id));
      return;
    }

    if (kind === 'payment') {
      const order = state.orders.find((o) => o.id === form.dataset.order);
      const amount = Number(val('amount'));
      if (!order || !(amount > 0)) return showFormError(form, 'Enter an amount.');
      order.payments.push({ id: D.uid('pay'), amount, at: new Date().toISOString(), method: val('method') || 'cash' });
      order.timeline = order.timeline || [];
      order.timeline.push({ at: new Date().toISOString(), text: 'Payment ' + money(amount) + ' (' + (val('method') || 'cash') + ')' });
      if (D.orderBalance(order) <= 0 && order.stage === 'ready') order.timeline.push({ at: new Date().toISOString(), text: 'Fully paid' });
      saveNow();
      closeDialog();
      render();
      toast('Payment recorded');
      return;
    }

    if (kind === 'measure') {
      const client = state.clients.find((c) => c.id === form.dataset.client);
      if (!client) return;
      const person = client.people.find((p) => p.id === form.dataset.person);
      if (!person) return;
      const values = {};
      form.querySelectorAll('[data-measure]').forEach((inp) => {
        if (inp.value !== '') values[inp.dataset.measure] = inp.value;
      });
      D.saveMeasurement(person, val('garment'), val('unit'), values, val('by'));
      saveNow();
      closeDialog();
      render();
      const missing = D.missingCore(val('garment'), values);
      toast(missing.length ? 'Saved — still missing ' + missing.join(', ') : 'Measurements saved');
      return;
    }

    if (kind === 'settings') {
      const s = shop();
      s.name = val('name') || s.name;
      s.tagline = val('tagline');
      s.phone = val('phone');
      s.whatsapp = val('whatsapp');
      s.address = val('address');
      s.currency = val('currency');
      s.units = val('units');
      s.openHour = D.clamp(val('openHour'), 0, 23);
      s.closeHour = D.clamp(val('closeHour'), 1, 24);
      s.slotMinutes = D.clamp(val('slotMinutes'), 15, 120);
      s.closedDays = [Number(val('closedDay'))];
      saveNow();
      paintChrome();
      render();
      toast('Shop details saved');
      return;
    }
  });

  function showFormError(form, msg) {
    let node = form.querySelector('[data-error]');
    if (!node) {
      node = document.createElement('p');
      node.className = 'err';
      node.dataset.error = '';
      form.querySelector('.sheet-head').after(node);
    }
    node.textContent = msg;
  }

  /* ------------------------------------------------------------------- files */

  function downloadBackup() {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'chalkline-backup-' + today() + '.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    toast('Backup downloaded');
  }

  $('#restore-input').addEventListener('change', (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const next = D.hydrate(JSON.parse(String(reader.result)));
        if (!next || (!next.clients.length && !next.orders.length)) throw new Error('empty');
        state = next;
        saveNow();
        render();
        toast('Backup restored');
      } catch (err) {
        toast('That file is not a Chalkline backup');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  });

  /* -------------------------------------------------------------------- wiring */

  $('#view').addEventListener('click', onViewClick);
  window.addEventListener('hashchange', () => {
    ui.q = '';
    render();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && dlg.open) closeDialog();
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      openNewOrder();
    }
  });

  // live filters
  document.addEventListener('input', (e) => {
    if (e.target.id === 'order-search') {
      ui.q = e.target.value;
      const pos = e.target.selectionStart;
      render();
      const next = $('#order-search');
      if (next) {
        next.focus();
        next.setSelectionRange(pos, pos);
      }
    }
    if (e.target.id === 'client-search') {
      ui.q = e.target.value;
      const pos = e.target.selectionStart;
      render();
      const next = $('#client-search');
      if (next) {
        next.focus();
        next.setSelectionRange(pos, pos);
      }
    }
  });
  document.addEventListener('change', (e) => {
    if (e.target.id === 'order-stage') {
      ui.stage = e.target.value;
      render();
    }
    if (e.target.dataset && e.target.dataset.field) {
      const order = state.orders.find((o) => o.id === e.target.dataset.id);
      if (!order) return;
      const field = e.target.dataset.field;
      order[field] = e.target.value;
      saveNow();
      paintChrome();
      render();
    }
  });

  /* ---------------------------------------------------------------------- boot */

  paintIcons();
  paintChrome();
  if (!location.hash) location.hash = '#/today';
  render();

  // first run: explain the demo rather than silently showing fake clients
  if (state.demo && !state.seen) {
    state.seen = true;
    D.save(state);
  }

  // exposed for smoke tests and screenshots
  window.ChalklineApp = {
    state: () => state,
    render,
    route: (hash) => {
      location.hash = hash;
    },
    reset: () => {
      state = D.blankState();
      state.seen = true;
      D.save(state);
      render();
    },
    demo: () => {
      state = D.sampleState();
      state.demo = true;
      D.save(state);
      render();
    },
  };
})();
