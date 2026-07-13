export const esc = (v) =>
  String(v ?? '').replace(
    /[&<>'"]/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[c],
  );
export function toast(message) {
  const el = document.querySelector('#toast');
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(toast.t);
  toast.t = setTimeout(() => el.classList.remove('show'), 1800);
}
export function confirmModal(title, message, confirmText = 'Confirm') {
  return new Promise((resolve) => {
    const d = document.querySelector('#modal'),
      c = document.querySelector('#modal-content');
    d.className = 'confirm-dialog';
    c.innerHTML = `<section class="confirm-alert" role="alertdialog" aria-labelledby="confirm-title" aria-describedby="confirm-message"><span class="confirm-alert__icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 8v5m0 3h.01M10.3 3.9 2.4 18a2 2 0 0 0 1.75 3h15.7a2 2 0 0 0 1.75-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/></svg></span><div class="confirm-alert__copy"><p class="eyebrow">Please Confirm</p><h2 id="confirm-title">${esc(title)}</h2><p id="confirm-message">${esc(message)}</p></div><div class="confirm-alert__actions"><button class="btn" data-answer="no">Cancel</button><button class="btn danger" data-answer="yes">${esc(confirmText)}</button></div></section>`;
    if (!d.open) d.showModal();
    const finish = (answer) => {
      c.onclick = null;
      d.onclick = null;
      d.oncancel = null;
      d.classList.remove('confirm-dialog');
      d.close();
      resolve(answer);
    };
    c.onclick = (e) => {
      const a = e.target.dataset.answer;
      if (a) finish(a === 'yes');
    };
    d.onclick = (event) => {
      if (event.target === d) finish(false);
    };
    d.oncancel = (event) => { event.preventDefault(); finish(false); };
    c.querySelector('[data-answer="no"]')?.focus();
  });
}
export const formatTime = (s) =>
  `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
