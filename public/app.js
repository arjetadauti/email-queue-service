'use strict';

// Small frontend for the email queue. It only talks to the public API:
//   POST /emails   queue a new email
//   GET  /emails   list jobs (optionally ?status=pending|sent|failed)
//   GET  /health   app + database status

const REFRESH_MS = 3000;

const els = {
  form: document.getElementById('email-form'),
  submit: document.getElementById('submit'),
  formMessage: document.getElementById('form-message'),
  health: document.getElementById('health'),
  healthText: document.getElementById('health-text'),
  body: document.getElementById('jobs-body'),
  stats: document.querySelectorAll('.stat'),
  counts: {
    all: document.getElementById('count-all'),
    pending: document.getElementById('count-pending'),
    sent: document.getElementById('count-sent'),
    failed: document.getElementById('count-failed'),
  },
};

let currentFilter = '';
let knownIds = new Set();
let firstLoad = true;

// ---------- helpers ----------

/** Creates an element with optional class and text — never uses innerHTML, so user input can't inject HTML. */
function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined && text !== null) node.textContent = text;
  return node;
}

function timeAgo(iso) {
  if (!iso) return '';
  const seconds = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 5) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return new Date(iso).toLocaleString();
}

function timeUntil(iso) {
  const seconds = Math.max(0, Math.round((new Date(iso).getTime() - Date.now()) / 1000));
  return seconds <= 1 ? 'any moment' : `in ${seconds}s`;
}

async function api(path, options) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    cache: 'no-store',
    ...options,
  });
  const body = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, body };
}

// ---------- health ----------

async function loadHealth() {
  try {
    const { status, body } = await api('/health');
    if (status === 200) {
      els.health.className = 'health health--ok';
      els.healthText.textContent = `Healthy · database ${body.database.latencyMs} ms`;
    } else {
      els.health.className = 'health health--down';
      els.healthText.textContent = 'Database unreachable (503)';
    }
    if (body.queue) {
      const { pending, sent, failed } = body.queue;
      els.counts.pending.textContent = pending;
      els.counts.sent.textContent = sent;
      els.counts.failed.textContent = failed;
      els.counts.all.textContent = pending + sent + failed;
    }
  } catch {
    els.health.className = 'health health--down';
    els.healthText.textContent = 'API unreachable';
  }
}

// ---------- jobs table ----------

function detailsFor(job) {
  const cell = el('td', 'cell-details');
  if (job.status === 'sent') {
    cell.append(`Sent ${timeAgo(job.sentAt)}`);
  } else if (job.status === 'failed') {
    cell.append(el('span', 'error', job.lastError || 'Failed'));
  } else if (job.attempts > 0) {
    cell.append(el('span', 'error', job.lastError || 'Previous attempt failed'));
    cell.append(el('br'));
    cell.append(`Next retry ${timeUntil(job.nextAttemptAt)}`);
  } else {
    cell.append('Waiting for the worker');
  }
  return cell;
}

function rowFor(job) {
  const tr = el('tr');
  if (!firstLoad && !knownIds.has(job.id)) tr.classList.add('is-new');

  const statusCell = el('td');
  statusCell.append(el('span', `badge badge--${job.status}`, job.status));

  tr.append(
    statusCell,
    el('td', 'cell-to', job.to),
    el('td', 'cell-subject', job.subject),
    el('td', 'cell-attempts', `${job.attempts} / ${job.maxAttempts}`),
    detailsFor(job),
    el('td', 'cell-time', timeAgo(job.createdAt)),
  );
  tr.title = `Job ${job.id}`;
  return tr;
}

async function loadJobs() {
  try {
    const query = currentFilter ? `?status=${currentFilter}&limit=50` : '?limit=50';
    const { ok, body } = await api(`/emails${query}`);
    if (!ok) throw new Error(body.message || 'Request failed');

    els.body.replaceChildren();
    if (body.jobs.length === 0) {
      const tr = el('tr');
      const td = el('td', 'empty', currentFilter ? `No ${currentFilter} emails yet.` : 'No emails yet. Send one with the form.');
      td.colSpan = 6;
      tr.append(td);
      els.body.append(tr);
    } else {
      for (const job of body.jobs) els.body.append(rowFor(job));
    }
    knownIds = new Set(body.jobs.map((j) => j.id));
    firstLoad = false;
  } catch (err) {
    els.body.replaceChildren();
    const tr = el('tr');
    const td = el('td', 'empty', `Could not load emails: ${err.message}`);
    td.colSpan = 6;
    tr.append(td);
    els.body.append(tr);
  }
}

function refresh() {
  return Promise.all([loadHealth(), loadJobs()]);
}

// ---------- filters ----------

for (const button of els.stats) {
  button.addEventListener('click', () => {
    currentFilter = button.dataset.filter;
    for (const b of els.stats) b.classList.toggle('stat--active', b === button);
    firstLoad = true;
    loadJobs();
  });
}

// ---------- form ----------

function showFormMessage(text, kind) {
  els.formMessage.textContent = text;
  els.formMessage.className = `form-message form-message--${kind}`;
}

els.form.addEventListener('submit', async (event) => {
  event.preventDefault();
  for (const field of els.form.elements) field.removeAttribute?.('aria-invalid');

  const payload = {
    to: els.form.to.value.trim(),
    subject: els.form.subject.value.trim(),
    text: els.form.text.value.trim(),
  };
  // Let the API's own validation explain a missing body ("Provide html or text").
  if (!payload.text) delete payload.text;

  els.submit.disabled = true;
  els.submit.textContent = 'Queueing…';
  try {
    const { status, body } = await api('/emails', { method: 'POST', body: JSON.stringify(payload) });
    if (status === 202) {
      showFormMessage('Queued! Watch it move from pending to sent below.', 'ok');
      els.form.subject.value = '';
      els.form.text.value = '';
      await refresh();
    } else if (status === 400 && body.details) {
      for (const d of body.details) {
        const field = els.form.elements[d.field === 'html' ? 'text' : d.field];
        if (field) field.setAttribute('aria-invalid', 'true');
      }
      showFormMessage(body.details.map((d) => d.message).join(' · '), 'error');
    } else {
      showFormMessage(body.message || `Something went wrong (${status}).`, 'error');
    }
  } catch {
    showFormMessage('Could not reach the API.', 'error');
  } finally {
    els.submit.disabled = false;
    els.submit.textContent = 'Queue email';
  }
});

// ---------- start ----------

refresh();
setInterval(() => {
  if (!document.hidden) refresh();
}, REFRESH_MS);
