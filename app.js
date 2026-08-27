// ================= CONFIG =================
const CONFIG = {
  // Ganti dengan URL Web App Apps Script kamu setelah deploy
  // (lihat google-apps-script/SHEET_STRUCTURE.md)
  API_URL: 'https://script.google.com/macros/s/AKfycbys50cJt7-pofa37Qi-lCf5EOq87uRgFaKWkxfJQcH3SnsljODrWyxObGfGS9wuARAp/exec'
};

// ================= STATE =================
let currentUser = JSON.parse(localStorage.getItem('teman360_user') || 'null');
let activitiesCache = [];
let donationsCache = [];

// ================= API HELPERS =================
async function apiGet(action, params = {}) {
  const url = new URL(CONFIG.API_URL);
  url.searchParams.set('action', action);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url.toString());
  const json = await res.json();
  if (!json.ok) throw new Error(json.error || 'Terjadi kesalahan.');
  return json.data;
}

async function apiPost(action, payload = {}) {
  const res = await fetch(CONFIG.API_URL, {
    method: 'POST',
    // text/plain menghindari CORS preflight pada Apps Script Web App
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action, ...payload })
  });
  const json = await res.json();
  if (!json.ok) throw new Error(json.error || 'Terjadi kesalahan.');
  return json.data;
}

// ================= UTIL =================
function formatTanggal(d) {
  if (!d) return '-';
  const date = new Date(d);
  return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
}
function formatRupiah(n) {
  return 'Rp' + Number(n || 0).toLocaleString('id-ID');
}
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2600);
}
function el(html) {
  const div = document.createElement('div');
  div.innerHTML = html.trim();
  return div.firstChild;
}
function isOwner(item) {
  return !!currentUser && String(item.dibuatOlehId) === String(currentUser.id);
}
function showLoadingState() {
  ['home-upcoming', 'seru-list', 'peduli-list'].forEach(id => {
    const container = document.getElementById(id);
    container.innerHTML = '';
    container.appendChild(el(`<div class="empty-state">Memuat data...</div>`));
  });
}

// ================= AUTH =================
const authTabs = document.querySelectorAll('.auth-tab');
authTabs.forEach(tab => {
  tab.addEventListener('click', () => {
    authTabs.forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    const mode = tab.dataset.auth;
    document.getElementById('form-login').classList.toggle('hidden', mode !== 'login');
    document.getElementById('form-register').classList.toggle('hidden', mode !== 'register');
  });
});

document.getElementById('form-login').addEventListener('submit', async e => {
  e.preventDefault();
  const errorEl = document.getElementById('login-error');
  errorEl.textContent = '';
  const fd = new FormData(e.target);
  try {
    const user = await apiPost('login', { email: fd.get('email'), password: fd.get('password') });
    setSession(user);
  } catch (err) {
    errorEl.textContent = err.message;
  }
});

document.getElementById('form-register').addEventListener('submit', async e => {
  e.preventDefault();
  const errorEl = document.getElementById('register-error');
  errorEl.textContent = '';
  const fd = new FormData(e.target);
  try {
    const user = await apiPost('register', {
      nama: fd.get('nama'),
      unitKerja: fd.get('unitKerja'),
      email: fd.get('email'),
      password: fd.get('password')
    });
    setSession(user);
  } catch (err) {
    errorEl.textContent = err.message;
  }
});

function setSession(user) {
  currentUser = user;
  localStorage.setItem('teman360_user', JSON.stringify(user));
  enterApp();
}

document.getElementById('btn-logout').addEventListener('click', () => {
  localStorage.removeItem('teman360_user');
  currentUser = null;
  document.getElementById('view-app').classList.add('hidden');
  document.getElementById('view-auth').classList.remove('hidden');
});

// ================= APP SHELL / NAV =================
async function enterApp() {
  document.getElementById('view-auth').classList.add('hidden');
  document.getElementById('view-app').classList.remove('hidden');
  document.getElementById('app-bar-eyebrow').textContent = `Halo, ${currentUser.nama.split(' ')[0]}`;
  switchTab('home');
  showLoadingState();

  // Satu request gabungan (Home + Seru + Peduli) alih-alih 3 request terpisah,
  // supaya lebih cepat karena tiap request ke Apps Script punya overhead sendiri.
  try {
    const data = await apiGet('getInitialData', { userId: currentUser.id });
    activitiesCache = data.activities;
    donationsCache = data.donations;
    renderHomeList('home-upcoming', data.dashboard.akanBerlangsung, 'badge-upcoming', 'Akan Datang');
    renderHomeList('home-done', data.dashboard.sudahSelesai, 'badge-done', 'Selesai');
    renderActivities();
    renderDonations();
  } catch (err) {
    showToast(err.message);
  }
}

const titleByTab = { home: 'Home', seru: 'Seru', peduli: 'Peduli' };
document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.addEventListener('click', () => switchTab(btn.dataset.tab));
});
function switchTab(tab) {
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.getElementById('panel-' + tab).classList.add('active');
  document.getElementById('app-bar-title').textContent = titleByTab[tab];
}

// Home mini tabs
document.querySelectorAll('.mini-tab').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.mini-tab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('home-upcoming').classList.toggle('hidden', btn.dataset.home !== 'upcoming');
    document.getElementById('home-done').classList.toggle('hidden', btn.dataset.home !== 'done');
  });
});

// ================= HOME =================
// Dipakai untuk refresh Home saja setelah aksi tertentu (join dsb),
// tanpa perlu menarik ulang seluruh data lewat getInitialData.
async function loadHome() {
  try {
    const data = await apiGet('getDashboard', { userId: currentUser.id });
    renderHomeList('home-upcoming', data.akanBerlangsung, 'badge-upcoming', 'Akan Datang');
    renderHomeList('home-done', data.sudahSelesai, 'badge-done', 'Selesai');
  } catch (err) {
    showToast(err.message);
  }
}
function renderHomeList(containerId, items, badgeClass, badgeText) {
  const container = document.getElementById(containerId);
  container.innerHTML = '';
  if (!items.length) {
    container.appendChild(el(`<div class="empty-state">Belum ada kegiatan yang kamu ikuti di kategori ini.</div>`));
    return;
  }
  items.forEach(k => {
    container.appendChild(el(`
      <div class="card">
        <div class="card-top">
          <div>
            <p class="card-title">${k.judul}</p>
            <p class="card-meta">${formatTanggal(k.tanggal)} · ${k.lokasi || 'Lokasi menyusul'}</p>
          </div>
          <span class="badge ${badgeClass}">${badgeText}</span>
        </div>
      </div>
    `));
  });
}

// ================= SERU =================
document.getElementById('btn-add-activity').addEventListener('click', () => openModal('modal-add-activity'));

// Dipakai untuk refresh tab Seru saja setelah tambah/hapus/join,
// tanpa perlu menarik ulang seluruh data lewat getInitialData.
async function loadActivities() {
  try {
    activitiesCache = await apiGet('getActivities');
    renderActivities();
  } catch (err) {
    showToast(err.message);
  }
}
function renderActivities() {
  const container = document.getElementById('seru-list');
  container.innerHTML = '';
  if (!activitiesCache.length) {
    container.appendChild(el(`<div class="empty-state">Belum ada kegiatan. Jadi yang pertama menambahkan!</div>`));
    return;
  }
  activitiesCache.forEach(k => {
    const badge = k.status === 'Akan Datang' ? 'badge-upcoming' : 'badge-done';
    const card = el(`
      <div class="card">
        <div class="card-top">
          <div>
            <span class="badge badge-seru">${k.kategori}</span>
            <p class="card-title" style="margin-top:8px;">${k.judul}</p>
            <p class="card-meta">${formatTanggal(k.tanggal)} · ${k.jumlahPeserta} peserta</p>
          </div>
          <span class="badge ${badge}">${k.status}</span>
        </div>
      </div>
    `);
    card.addEventListener('click', () => openActivityDetail(k.id));
    container.appendChild(card);
  });
}

async function openActivityDetail(id) {
  try {
    const k = await apiGet('getActivityDetail', { id });
    const body = document.getElementById('activity-detail-body');
    const sudahJoin = k.peserta.some(p => p.nama === currentUser.nama);
    const bolehHapus = isOwner(k);
    body.innerHTML = `
      <span class="badge badge-seru">${k.kategori}</span>
      <p class="detail-title">${k.judul}</p>
      <p class="detail-meta">${formatTanggal(k.tanggal)} · ${k.lokasi || 'Lokasi menyusul'} · dibuat oleh ${k.dibuatOlehNama}</p>
      <p class="detail-desc">${k.deskripsi}</p>
      <div class="detail-block">
        <h5>Peserta (${k.peserta.length})</h5>
        <div class="people-list">
          ${k.peserta.length ? k.peserta.map(p => `<span>• ${p.nama}</span>`).join('') : '<span>Belum ada peserta.</span>'}
        </div>
      </div>
      <button class="btn btn-seru" id="btn-join" style="width:100%;" ${sudahJoin ? 'disabled' : ''}>
        ${sudahJoin ? 'Kamu sudah bergabung' : 'Join Kegiatan'}
      </button>
      ${bolehHapus ? `<button class="btn btn-danger" id="btn-delete-activity" style="width:100%;margin-top:10px;">Hapus Kegiatan</button>` : ''}
    `;
    if (!sudahJoin) {
      document.getElementById('btn-join').addEventListener('click', async () => {
        try {
          await apiPost('joinActivity', { kegiatanId: id, userId: currentUser.id, userNama: currentUser.nama });
          showToast('Berhasil bergabung!');
          closeModals();
          loadActivities();
          loadHome();
        } catch (err) {
          showToast(err.message);
        }
      });
    }
    if (bolehHapus) {
      document.getElementById('btn-delete-activity').addEventListener('click', async () => {
        const yakin = window.confirm('Yakin ingin menghapus kegiatan ini? Semua data peserta juga akan terhapus dan tidak bisa dikembalikan.');
        if (!yakin) return;
        try {
          await apiPost('deleteActivity', { activityId: id, userId: currentUser.id });
          showToast('Kegiatan berhasil dihapus.');
          closeModals();
          loadActivities();
          loadHome();
        } catch (err) {
          showToast(err.message);
        }
      });
    }
    openModal('modal-activity-detail');
  } catch (err) {
    showToast(err.message);
  }
}

document.getElementById('form-add-activity').addEventListener('submit', async e => {
  e.preventDefault();
  const errorEl = document.getElementById('add-activity-error');
  errorEl.textContent = '';
  const fd = new FormData(e.target);
  try {
    await apiPost('createActivity', {
      judul: fd.get('judul'),
      kategori: fd.get('kategori'),
      deskripsi: fd.get('deskripsi'),
      tanggal: fd.get('tanggal'),
      lokasi: fd.get('lokasi'),
      userId: currentUser.id,
      userNama: currentUser.nama
    });
    showToast('Kegiatan berhasil ditambahkan!');
    e.target.reset();
    closeModals();
    loadActivities();
  } catch (err) {
    errorEl.textContent = err.message;
  }
});

// ================= PEDULI =================
document.getElementById('btn-add-donation').addEventListener('click', () => openModal('modal-add-donation'));

// Dipakai untuk refresh tab Peduli saja setelah tambah/hapus/kontribusi,
// tanpa perlu menarik ulang seluruh data lewat getInitialData.
async function loadDonations() {
  try {
    donationsCache = await apiGet('getDonations');
    renderDonations();
  } catch (err) {
    showToast(err.message);
  }
}
function renderDonations() {
  const container = document.getElementById('peduli-list');
  container.innerHTML = '';
  if (!donationsCache.length) {
    container.appendChild(el(`<div class="empty-state">Belum ada pengajuan donasi.</div>`));
    return;
  }
  donationsCache.forEach(d => {
    const pct = Math.min(100, Math.round((d.terkumpul / d.targetBiaya) * 100));
    const badgeClass = d.status === 'Tercapai' ? 'badge-achieved' : d.status === 'Berakhir' ? 'badge-ended' : 'badge-ongoing';
    const card = el(`
      <div class="card">
        <div class="card-top">
          <div>
            <p class="card-title">${d.judul}</p>
            <p class="card-meta">Batas: ${formatTanggal(d.tanggalSelesai)}</p>
          </div>
          <span class="badge ${badgeClass}">${d.status}</span>
        </div>
        <div class="progress-track"><div class="progress-fill" style="width:${pct}%"></div></div>
        <div class="progress-label">
          <span>${formatRupiah(d.terkumpul)}</span>
          <span>${pct}% dari ${formatRupiah(d.targetBiaya)}</span>
        </div>
      </div>
    `);
    card.addEventListener('click', () => openDonationDetail(d.id));
    container.appendChild(card);
  });
}

async function openDonationDetail(id) {
  try {
    const d = await apiGet('getDonationDetail', { id });
    const pct = Math.min(100, Math.round((d.terkumpul / d.targetBiaya) * 100));
    const body = document.getElementById('donation-detail-body');
    const bolehHapus = isOwner(d);
    body.innerHTML = `
      <p class="detail-title">${d.judul}</p>
      <p class="detail-meta">${formatTanggal(d.tanggalMulai)} – ${formatTanggal(d.tanggalSelesai)} · diajukan oleh ${d.dibuatOlehNama}</p>
      <p class="detail-desc">${d.deskripsi}</p>
      <div class="progress-track"><div class="progress-fill" style="width:${pct}%"></div></div>
      <div class="progress-label" style="margin-bottom:16px;">
        <span>${formatRupiah(d.terkumpul)} terkumpul</span>
        <span>${pct}% dari ${formatRupiah(d.targetBiaya)}</span>
      </div>
      <div class="rekening-box">${d.noRekening}<br><span style="font-size:12px;font-weight:500;">a.n. ${d.atasNama}</span></div>
      <div class="detail-block">
        <h5>Sudah Membantu (${d.kontribusi.length})</h5>
        <div class="people-list">
          ${d.kontribusi.length ? d.kontribusi.map(k => `<span>• ${k.nama} — ${formatRupiah(k.jumlah)}</span>`).join('') : '<span>Jadilah yang pertama membantu.</span>'}
        </div>
      </div>
      <label style="margin-bottom:10px;">Nominal Transfer (Rp)
        <input type="number" id="input-nominal" min="1000" step="1000" placeholder="mis. 500000">
      </label>
      <button class="btn btn-peduli" id="btn-contribute" style="width:100%;">Saya Sudah Transfer</button>
      ${bolehHapus ? `<button class="btn btn-danger" id="btn-delete-donation" style="width:100%;margin-top:10px;">Hapus Donasi</button>` : ''}
    `;
    document.getElementById('btn-contribute').addEventListener('click', async () => {
      const inputEl = document.getElementById('input-nominal');
      const jumlah = Number(inputEl.value);
      if (!jumlah || jumlah <= 0) {
        showToast('Masukkan nominal transfer yang valid terlebih dahulu.');
        return;
      }
      try {
        await apiPost('contribute', { donasiId: id, userId: currentUser.id, userNama: currentUser.nama, jumlah });
        showToast(`Terima kasih! Kontribusi ${formatRupiah(jumlah)} berhasil dicatat 🙏`);
        loadDonations();       // refresh kartu di daftar Peduli
        openDonationDetail(id); // refresh modal ini dengan progress & daftar terbaru
      } catch (err) {
        showToast(err.message);
      }
    });
    if (bolehHapus) {
      document.getElementById('btn-delete-donation').addEventListener('click', async () => {
        const yakin = window.confirm('Yakin ingin menghapus donasi ini? Semua data kontribusi juga akan terhapus dan tidak bisa dikembalikan.');
        if (!yakin) return;
        try {
          await apiPost('deleteDonation', { donasiId: id, userId: currentUser.id });
          showToast('Donasi berhasil dihapus.');
          closeModals();
          loadDonations();
        } catch (err) {
          showToast(err.message);
        }
      });
    }
    openModal('modal-donation-detail');
  } catch (err) {
    showToast(err.message);
  }
}

document.getElementById('form-add-donation').addEventListener('submit', async e => {
  e.preventDefault();
  const errorEl = document.getElementById('add-donation-error');
  errorEl.textContent = '';
  const fd = new FormData(e.target);
  try {
    await apiPost('createDonation', {
      judul: fd.get('judul'),
      deskripsi: fd.get('deskripsi'),
      targetBiaya: fd.get('targetBiaya'),
      tanggalMulai: fd.get('tanggalMulai'),
      tanggalSelesai: fd.get('tanggalSelesai'),
      noRekening: fd.get('noRekening'),
      atasNama: fd.get('atasNama'),
      userId: currentUser.id,
      userNama: currentUser.nama
    });
    showToast('Donasi berhasil diajukan!');
    e.target.reset();
    closeModals();
    loadDonations();
  } catch (err) {
    errorEl.textContent = err.message;
  }
});

// ================= MODAL HELPERS =================
function openModal(id) {
  document.getElementById('modal-backdrop').classList.remove('hidden');
  document.querySelectorAll('.modal').forEach(m => m.classList.remove('open'));
  document.getElementById(id).classList.add('open');
}
function closeModals() {
  document.getElementById('modal-backdrop').classList.add('hidden');
  document.querySelectorAll('.modal').forEach(m => m.classList.remove('open'));
}
document.getElementById('modal-backdrop').addEventListener('click', e => {
  if (e.target.id === 'modal-backdrop') closeModals();
});
document.querySelectorAll('[data-close]').forEach(btn => btn.addEventListener('click', closeModals));

// ================= INIT =================
if (currentUser) {
  enterApp();
}
