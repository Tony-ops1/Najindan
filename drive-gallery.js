(function () {
  'use strict';
  // This is a public OAuth Client ID, not a Client Secret.
  const CLIENT_ID = '273381863324-ft40mrnu1kkuin77krvfmbtslu6366pt.apps.googleusercontent.com';
  const SCOPES = 'openid email https://www.googleapis.com/auth/drive.file';
  const FOLDER_NAME = 'NajinDan – Moja poroka';
  const BASE = 'https://www.googleapis.com/drive/v3/files';
  let root = null, user = null, token = '', validUntil = 0, folderId = '';
  let photos = [], nextPage = '', status = '', busy = false, generation = 0;
  let category = null; // Only the selected wedding category, never shared between accounts.
  const previews = new Map();
  const esc = value => String(value == null ? '' : value).replace(/[&<>"']/g, c => ({
    '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
  })[c]);
  const ready = () => Boolean(token && Date.now() < validUntil - 30000);
  const quoteQuery = value => String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  const active = gen => gen === generation && root && root.isConnected;
  const formatSize = size => size ? (Number(size) / 1024 / 1024).toFixed(1) + ' MB' : '';
  const closePreviews = () => { previews.forEach(url => URL.revokeObjectURL(url)); previews.clear(); };
  function message(error) {
    if (error && error.message) return error.message;
    return 'Prišlo je do napake. Poskusi znova.';
  }
  function paint() {
    if (!root || !root.isConnected) return;
    const connected = ready();
    let html = '<section class="nd-gallery">';
    html += '<div class="nd-gallery-intro">' + (category ? '<h3>Fotografije – ' + esc(category.name) + '</h3>' : '<h2>Vajine fotografije</h2>');
    html += '<p>' + (category ? 'Dodaj fotografije za to kategorijo. Posnetki in slike se shranijo na tvoj Google Drive, ločeno označeni za to kategorijo.' : 'Slike se shranjujejo v zasebno mapo na tvojem Google Drive, ne v Firebase ali Supabase. Vsak Google račun uporablja svoj prostor.') + '</p></div>';
    if (!user) {
      html += '<div class="card card-pad">Za dostop do fotografij se najprej prijavi z Googlom v NajinDan.</div>';
    } else if (!connected) {
      html += '<div class="card card-pad nd-drive-connect"><h3>Poveži Google Drive</h3>';
      html += '<p>Za fotografije je potrebno ločeno Google dovoljenje. Izberi isti Google račun kot za prijavo v NajinDan (' + esc(user.email || '') + ').</p>';
      html += '<button class="btn" type="button" data-dg-connect ' + (busy ? 'disabled' : '') + '>Poveži moj Google Drive</button>';
      html += '<p class="nd-gallery-hint">Dovoljenje velja samo za datoteke, ustvarjene ali odprte prek aplikacije. Ni dostopa do vseh datotek v tvojem Drive.</p></div>';
    } else {
      html += '<div class="nd-gallery-tools"><label class="btn nd-upload-label" for="nd-drive-files">Izberi iz galerije</label>';
      html += '<input id="nd-drive-files" class="nd-file" type="file" accept="image/*" multiple ' + (busy ? 'disabled' : '') + '>';
      html += '<label class="btn secondary nd-upload-label" for="nd-drive-camera">Fotografiraj</label>';
      html += '<input id="nd-drive-camera" class="nd-file" type="file" accept="image/*" capture="environment" ' + (busy ? 'disabled' : '') + '>';
      html += '<button type="button" class="btn secondary" data-dg-refresh ' + (busy ? 'disabled' : '') + '>Osveži</button>';
      html += '<button type="button" class="btn ghost" data-dg-disconnect>Odklopi Drive</button></div>';
      html += '<p class="nd-gallery-hint">Izberi obstoječe slike ali na telefonu fotografiraj s kamero. Fotografije pred nalaganjem zmanjšamo na največ 1800 px (JPEG). Izvirnikov ne zamenjamo. Največ 10 slik naenkrat.</p>';
      if (folderId) html += '<p><a href="https://drive.google.com/drive/u/0/folders/' + encodeURIComponent(folderId) + '" target="_blank" rel="noopener noreferrer">Odpri mapo NajinDan v Google Drive</a></p>';
      if (photos.length) {
        html += '<div class="nd-photo-grid">';
        photos.forEach(photo => {
          const id = esc(photo.id);
          html += '<article class="nd-photo-card"><div class="nd-photo-preview">';
          html += '<img data-dg-image="' + id + '" alt="' + esc(photo.name) + '" loading="lazy"></div>';
          html += '<div class="nd-photo-info"><strong title="' + esc(photo.name) + '">' + esc(photo.name) + '</strong>';
          html += '<small>' + esc(formatSize(photo.size)) + '</small>';
          html += '<div class="nd-photo-actions"><button type="button" data-dg-view="' + id + '">Odpri</button>';
          html += '<button type="button" data-dg-delete="' + id + '"' + (busy ? ' disabled' : '') + '>V koš</button></div></div></article>';
        });
        html += '</div>';
      } else if (!busy) {
        html += '<div class="card card-pad nd-gallery-empty">Tukaj še ni fotografij. Dodaj prvo sliko iz telefona ali računalnika. ♡</div>';
      }
      if (nextPage) html += '<button type="button" class="btn secondary nd-more" data-dg-more ' + (busy ? 'disabled' : '') + '>Pokaži več fotografij</button>';
    }
    if (status) html += '<p class="nd-gallery-status" role="status">' + esc(status) + '</p>';
    html += '</section>';
    root.innerHTML = html;
    previews.forEach((url, id) => {
      const image = Array.from(root.querySelectorAll('[data-dg-image]')).find(x => x.dataset.dgImage === id);
      if (image) image.src = url;
    });
  }
  async function api(url, options) {
    if (!ready()) throw new Error('Povezava Google Drive je potekla. Ponovno klikni »Poveži Google Drive«.');
    const opts = options || {};
    const response = await fetch(url, {
      method: opts.method || 'GET',
      headers: Object.assign({ Authorization: 'Bearer ' + token }, opts.headers || {}),
      body: opts.body
    });
    if (response.status === 401) {
      token = ''; validUntil = 0;
      throw new Error('Dovoljenje je poteklo. Ponovno poveži Google Drive.');
    }
    if (!response.ok) {
      let reason = 'Google Drive: napaka ' + response.status;
      try {
        const data = await response.json();
        if (data.error && data.error.message) reason += ' – ' + data.error.message;
      } catch (_) {}
      throw new Error(reason);
    }
    if (response.status === 204) return {};
    return response.json();
  }
  async function list(query, page, count) {
    const params = new URLSearchParams({
      q: query, fields: 'nextPageToken,files(id,name,mimeType,size,createdTime,appProperties)',
      pageSize: String(count || 50), orderBy: 'createdTime desc'
    });
    if (page) params.set('pageToken', page);
    return api(BASE + '?' + params.toString());
  }
  async function ensureFolder() {
    if (folderId) return folderId;
    const escapedName = FOLDER_NAME.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    const q = "name = '" + escapedName + "' and mimeType = 'application/vnd.google-apps.folder' and 'root' in parents and trashed = false";
    const found = await list(q, '', 10);
    if (found.files && found.files.length) folderId = found.files[0].id;
    else {
      const created = await api(BASE + '?fields=id', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: FOLDER_NAME, mimeType: 'application/vnd.google-apps.folder', parents: ['root'] })
      });
      folderId = created.id;
    }
    return folderId;
  }
  async function fetchPreview(photo, gen) {
    if (previews.has(photo.id) || !active(gen)) return;
    try {
      const response = await fetch(BASE + '/' + encodeURIComponent(photo.id) + '?alt=media', {
        headers: { Authorization: 'Bearer ' + token }
      });
      if (!response.ok) return;
      const blob = await response.blob();
      if (!active(gen) || !ready()) return;
      if (!blob.type.startsWith('image/')) return;
      const url = URL.createObjectURL(blob);
      previews.set(photo.id, url);
      const img = Array.from(root.querySelectorAll('[data-dg-image]')).find(x => x.dataset.dgImage === photo.id);
      if (img) img.src = url;
    } catch (_) {
      // Other images continue even if a thumbnail fails.
    }
  }
  async function showPreviews(gen) {
    let index = 0;
    const candidates = photos.filter(x => !previews.has(x.id));
    await Promise.all(Array.from({ length: Math.min(3, candidates.length) }, async () => {
      while (index < candidates.length && active(gen)) {
        const next = candidates[index++];
        await fetchPreview(next, gen);
      }
    }));
  }
  async function load(reset) {
    const gen = ++generation;
    busy = true;
    status = 'Nalagam fotografije iz Google Drive …';
    if (reset) { closePreviews(); photos = []; nextPage = ''; }
    paint();
    try {
      await ensureFolder();
      if (!active(gen)) return;
      const q = "'" + quoteQuery(folderId) + "' in parents and trashed = false" +
        (category ? " and appProperties has { key='najindanCategoryId' and value='" + quoteQuery(category.id) + "' }" : '');
      const result = await list(q, nextPage, 24);
      if (!active(gen)) return;
      photos = photos.concat((result.files || []).filter(x => x.mimeType && x.mimeType.startsWith('image/')));
      nextPage = result.nextPageToken || '';
      status = '';
    } catch (error) { if (active(gen)) status = message(error); }
    if (!active(gen)) return;
    busy = false; paint();
    showPreviews(gen);
  }
  async function compress(file) {
    if (!file.type.startsWith('image/')) throw new Error('Datoteka ni slika: ' + file.name);
    if (file.size > 30 * 1024 * 1024) throw new Error('Slika je prevelika (več kot 30 MB): ' + file.name);
    const image = await createImageBitmap(file);
    try {
      const scale = Math.min(1, 1800 / Math.max(image.width, image.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Brskalnik ne podpira obdelave te slike.');
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.8));
      if (!blob) throw new Error('Slike ni bilo mogoče pretvoriti v JPEG.');
      if (blob.size > 4.5 * 1024 * 1024) throw new Error('Slika je po obdelavi še vedno prevelika: ' + file.name);
      return blob;
    } finally { image.close(); }
  }
  async function uploadOne(file, categoryId) {
    const image = await compress(file);
    const filename = file.name.replace(/\.[^.]+$/, '').slice(0, 100) + '.jpg';
    const metadata = { name: filename, mimeType: 'image/jpeg', parents: [folderId] };
    if (categoryId) metadata.appProperties = { najindanCategoryId: categoryId };
    const boundary = 'najindan-' + Math.random().toString(36).slice(2);
    const body = new Blob([
      '--' + boundary + '\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n',
      JSON.stringify(metadata), '\r\n--' + boundary + '\r\nContent-Type: image/jpeg\r\n\r\n',
      image, '\r\n--' + boundary + '--'
    ], { type: 'multipart/related; boundary=' + boundary });
    await api('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id', {
      method: 'POST', headers: { 'Content-Type': body.type }, body
    });
  }
  async function upload(files) {
    if (!ready() || busy) return;
    if (files.length > 10) { status = 'Izberi največ 10 fotografij naenkrat.'; paint(); return; }
    const uploadCategoryId = category ? category.id : ''; // Keep the correct category even if the view changes.
    busy = true;
    try {
      await ensureFolder();
      for (let i = 0; i < files.length; i++) {
        status = 'Nalagam fotografijo ' + (i + 1) + ' od ' + files.length + ' …';
        paint();
        await uploadOne(files[i], uploadCategoryId);
      }
      busy = false;
      await load(true);
    } catch (error) { busy = false; status = message(error); paint(); }
  }
  async function trash(id) {
    if (!ready() || busy || !photos.some(x => x.id === id)) return;
    if (!window.confirm('Premaknem fotografijo v koš Google Drive?')) return;
    busy = true; status = 'Premikam fotografijo v koš …'; paint();
    try {
      await api(BASE + '/' + encodeURIComponent(id) + '?fields=id', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trashed: true })
      });
      busy = false; await load(true);
    } catch (error) { busy = false; status = message(error); paint(); }
  }
  // Optional single-consent login: this must run directly from a user click,
  // and must use the same Drive OAuth app as existing pictures.
  function requestLoginToken() {
    return new Promise((resolve, reject) => {
      if (!window.google?.accounts?.oauth2) {
        reject(new Error('Google prijavna knjižnica se še nalaga. Osveži stran.'));
        return;
      }
      let settled = false;
      const ok = value => { if (!settled) { settled = true; resolve(value); } };
      const fail = message => { if (!settled) { settled = true; reject(new Error(message)); } };
      const client = window.google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: 'openid email profile https://www.googleapis.com/auth/drive.file',
        callback: response => {
          if (response.error || !response.access_token) {
            fail('Google ni izdal dovoljenja za Google Drive.'); return;
          }
          const scopes = String(response.scope || '').split(/\s+/);
          if (!scopes.includes('https://www.googleapis.com/auth/drive.file')) {
            fail('Za fotografije mora biti potrjeno tudi dovoljenje Google Drive.'); return;
          }
          ok(response);
        },
        error_callback: () => fail('Googlovo prijavno okno ni bilo dokončano.')
      });
      try { client.requestAccessToken({ prompt: 'consent' }); }
      catch (_) { fail('Googlove prijave ni mogoče odpreti.'); }
    });
  }
  async function adoptLoginToken(signedInUser, response) {
    if (!signedInUser || !response?.access_token) return false;
    const expectedId = signedInUser.providerData?.find(x => x.providerId === 'google.com')?.uid;
    if (!expectedId) return false;
    const identity = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
      headers: { Authorization: 'Bearer ' + response.access_token }
    });
    if (!identity.ok) throw new Error('Povezanega Googlovega računa ni mogoče preveriti.');
    const profile = await identity.json();
    if (profile.sub !== expectedId) {
      throw new Error('Račun Google Drive se ne ujema z računom NajinDan.');
    }
    // Never persist short-lived Google access tokens in localStorage or Firestore.
    if (user && user.uid !== signedInUser.uid) signOut();
    token = response.access_token;
    validUntil = Date.now() + Math.max(60, Number(response.expires_in) || 3600) * 1000;
    folderId = ''; photos = []; nextPage = '';
    if (root?.isConnected) {
      user = signedInUser;
      await load(true);
    }
    return true;
  }
  function connect() {
    if (busy || !user) return;
    if (!window.google || !window.google.accounts || !window.google.accounts.oauth2) {
      status = 'Google prijavna knjižnica se še nalaga. Osveži stran in poskusi znova.';
      paint(); return;
    }
    const originalUser = user;
    const expectedId = (originalUser.providerData || []).find(x => x.providerId === 'google.com')?.uid;
    if (!expectedId) { status = 'Za Drive mora biti NajinDan prijavljen z Google računom.'; paint(); return; }
    busy = true; status = 'Čakam Googlovo dovoljenje …'; paint();
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID, scope: SCOPES, hint: originalUser.email || undefined,
      callback: async result => {
        if (user !== originalUser) return;
        if (result.error || !result.access_token) {
          busy = false; status = 'Google dovoljenje ni bilo izdano. ' + (result.error || 'Poskusi znova.'); paint(); return;
        }
        try {
          const identity = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
            headers: { Authorization: 'Bearer ' + result.access_token }
          });
          if (!identity.ok) throw new Error('Googlovega računa ni bilo mogoče preveriti.');
          const profile = await identity.json();
          if (profile.sub !== expectedId) throw new Error('Izbran je drug Google račun. Poveži isti račun kot pri prijavi v NajinDan.');
          token = result.access_token;
          validUntil = Date.now() + (Number(result.expires_in) || 3600) * 1000;
          folderId = ''; photos = []; nextPage = '';
          busy = false;
          await load(true);
        } catch (error) { busy = false; status = message(error); paint(); }
      },
      error_callback: () => { busy = false; status = 'Google okno se ni odprlo ali je bilo zaprto. Poskusi znova.'; paint(); }
    });
    client.requestAccessToken({ prompt: 'consent' });
  }
  function signOut() {
    generation++; closePreviews();
    token = ''; validUntil = 0; folderId = ''; photos = []; nextPage = '';
    user = null; root = null; category = null; busy = false; status = '';
  }
  function unmount() { generation++; closePreviews(); root = null; category = null; busy = false; }
  function mount(el, signedInUser, options = {}) {
    if (!el) return;
    if (user && user.uid !== signedInUser.uid) signOut();
    category = options.category && typeof options.category.id === 'string'
      ? { id: options.category.id, name: String(options.category.name || 'Kategorija') }
      : null;
    user = signedInUser; root = el; status = '';
    root.onclick = event => {
      const button = event.target.closest('button');
      if (!button) return;
      if (button.matches('[data-dg-connect]')) connect();
      else if (button.matches('[data-dg-refresh]')) load(true);
      else if (button.matches('[data-dg-more]')) load(false);
      else if (button.matches('[data-dg-disconnect]')) { signOut(); user = signedInUser; root = el; paint(); }
      else if (button.dataset.dgDelete) trash(button.dataset.dgDelete);
      else if (button.dataset.dgView) window.open(
        'https://drive.google.com/file/d/' + encodeURIComponent(button.dataset.dgView) + '/view',
        '_blank', 'noopener,noreferrer'
      );
    };
    root.onchange = event => {
      if (event.target.matches('#nd-drive-files, #nd-drive-camera')) {
        const files = Array.from(event.target.files || []);
        if (files.length) upload(files);
      }
    };
    paint();
    if (ready()) load(true);
  }
  window.NAJINDAN_DRIVE_GALLERY = { mount, unmount, signOut, requestLoginToken, adoptLoginToken };
})();