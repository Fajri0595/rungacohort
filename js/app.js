(function () {
'use strict';
var URL_ = (window.APP_CONFIG || {}).GAS_URL || '', tok = localStorage.getItem('rc_tok') || '', S = null, infl = {}, busy = false;
var $ = function (s) { return document.querySelector(s); };
var h = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
var uid = function (p) { return p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); };
var td = function () { var d = new Date(); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); };
var fd = function (s) { return s ? new Date(s + 'T00:00').toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) : '-'; };
function toast(m, t) { var e = document.createElement('div'); e.className = 't ' + (t || ''); e.textContent = m; $('#toast').appendChild(e); setTimeout(function () { e.remove(); }, 3200); }

// ---- API: dedupe baca in-flight, token di body POST ----
function api(action, data) {
  if (!URL_ || /GANTI|XXXX/.test(URL_)) { toast('Konfigurasi belum lengkap: isi js/config.js', 'err'); return Promise.resolve({ success: false }); }
  var k = action === 'boot' ? action : null; if (k && infl[k]) return infl[k];
  var p = fetch(URL_, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ action: action, token: tok, data: data || {} }) })
    .then(function (r) { return r.json(); }).then(function (r) { if (r.code === 'AUTH') logout(); return r; })
    .catch(function () { return { success: false, message: 'Koneksi bermasalah. Coba lagi.' }; });
  if (k) { infl[k] = p; p.then(function () { delete infl[k]; }); } return p;
}
function logout() { tok = ''; S = null; N = null; localStorage.removeItem('rc_tok'); localStorage.removeItem('rc_boot'); render(); }
function persist() { try { localStorage.setItem('rc_boot', JSON.stringify({ t: Date.now(), d: S })); } catch (e) { } }
function boot(force) { // SWR: tampil dari cache lokal dulu, segarkan di latar
  var c; try { c = JSON.parse(localStorage.getItem('rc_boot')); } catch (e) { }
  if (c && !S) { S = c.d; render(); }
  if (c && !force && Date.now() - c.t < 30000) return;
  return api('boot').then(function (r) { if (r.success) { S = r.data; persist(); render(); } else if (!S && r.message) toast(r.message, 'err'); });
}
// Optimistic UI: ubah state lokal dulu, kirim ke server, rollback bila gagal
function save(action, data, apply, msg) {
  var snap = JSON.stringify(S); if (apply) apply(); persist(); render();
  return api(action, data).then(function (r) {
    if (!r.success) { S = JSON.parse(snap); persist(); render(); toast(r.message || 'Gagal menyimpan', 'err'); } else { if (msg) toast(msg); boot(true); } return r;
  });
}

// ---- Data helper ----
var by = function (a, k, v) { return a.filter(function (x) { return x[k] === v; }); };
var one = function (a, k, v) { return by(a, k, v)[0]; };
var staff = function () { return S.me.role !== 'peserta'; };
var usr = function (id) { return (one(S.users, 'ID_User', id) || {}).Nama || '-'; };
var peserta = function (c) { return by(S.members, 'ID_Cohort', c).filter(function (m) { return m.Peran_di_Cohort === 'Peserta'; }); };
function pct(c) {
  var ss = by(S.sesi, 'ID_Cohort', c), ps = S.me.role === 'peserta' ? [{ ID_User: S.me.id }] : peserta(c); if (!ss.length || !ps.length) return 0;
  var n = 0; S.progres.forEach(function (p) { if (p.Status === 'Sudah' && ss.some(function (s) { return s.ID_Sesi === p.ID_Sesi; }) && ps.some(function (x) { return x.ID_User === p.ID_User; })) n++; });
  return Math.round(n * 100 / (ss.length * ps.length));
}
var chipT = function (t) { return '<span class="chip ' + (t === 'Offline' ? '' : t === 'Online' ? 'on' : 'pl') + '">' + h(t) + '</span>'; };
function ytId(u) { var m = String(u).match(/(?:youtu\.be\/|v=|embed\/|shorts\/)([\w-]{11})/); return m ? m[1] : ''; }

// ---- Modal & form ----
function modal(html) { var m = $('#modal'); m.innerHTML = '<div class="box">' + html + '</div>'; m.hidden = false; m.onclick = function (e) { if (e.target === m) close(); }; }
function close() { $('#modal').hidden = true; }
function form(title, fields, vals, ok) {
  var f = fields.map(function (x) {
    var v = vals[x.k] == null ? '' : vals[x.k], a = ' id="f_' + x.k + '"', i;
    if (x.t === 'select') i = '<select' + a + '>' + x.o.map(function (o) { return '<option value="' + h(o[0]) + '"' + (o[0] === v ? ' selected' : '') + '>' + h(o[1]) + '</option>'; }).join('') + '</select>';
    else if (x.t === 'area') i = '<textarea' + a + ' rows="3">' + h(v) + '</textarea>';
    else i = '<input' + a + ' type="' + (x.t || 'text') + '" value="' + (x.t === 'password' ? '' : h(v)) + '" autocomplete="off">';
    return '<label>' + h(x.l) + '</label>' + i;
  }).join('');
  modal('<h2>' + h(title) + '</h2>' + f + '<div class="acts"><button class="btn o" id="bx">Batal</button><button class="btn" id="bo">Simpan</button></div>');
  $('#bx').onclick = close;
  $('#bo').onclick = function () { var o = {}; fields.forEach(function (x) { o[x.k] = $('#f_' + x.k).value.trim(); }); for (var j = 0; j < fields.length; j++) if (fields[j].r && !o[fields[j].k]) { toast(fields[j].l + ' wajib diisi', 'err'); return; } close(); ok(o); };
}
var opt = function (a, k, l) { return a.map(function (x) { return [x[k], x[l]]; }); };
var confirmDo = function (m, fn) { if (window.confirm(m)) fn(); };

// ---- Halaman ----
function login() {
  return '<div class="login"><div class="card"><div class="logo" style="padding:0 0 8px">RuangCohort</div><p class="sub">Belajar tatap muka dan daring dalam satu ruang.</p>' +
    '<form id="lf"><label>Email</label><input id="em" type="email" required autocomplete="username"><label>Kata sandi</label><input id="pw" type="password" required autocomplete="current-password">' +
    '<p id="er" style="color:var(--er);min-height:20px"></p><button class="btn" style="width:100%" id="lb">Masuk</button></form><p style="text-align:center;margin:14px 0 0"><a href="#/verifikasi">Verifikasi sertifikat</a></p></div></div>';
}
function bindLogin() {
  $('#lf').onsubmit = function (e) { e.preventDefault(); var b = $('#lb'); b.disabled = true; b.textContent = 'Memeriksa…';
    api('login', { email: $('#em').value, password: $('#pw').value }).then(function (r) {
      if (r.success) { tok = r.data.token; localStorage.setItem('rc_tok', tok); boot(true); } else { b.disabled = false; b.textContent = 'Masuk'; $('#er').textContent = r.message || 'Gagal masuk'; } }); };
}
function dash() {
  var t = td(), up = S.sesi.filter(function (s) { return s.Tanggal >= t; }).sort(function (a, b) { return (a.Tanggal + a.Jam_Mulai).localeCompare(b.Tanggal + b.Jam_Mulai); }), avg = 0;
  S.cohorts.forEach(function (c) { avg += pct(c.ID_Cohort); }); avg = S.cohorts.length ? Math.round(avg / S.cohorts.length) : 0;
  var np = S.users.filter(function (u) { return u.Role === 'peserta'; }).length;
  return '<div class="head"><div><h1>Selamat datang, ' + h(S.me.nama) + '!</h1><p class="sub">Ringkasan pembelajaran Anda.</p></div></div>' +
    '<div class="grid"><div class="card kpi"><span>Cohort</span><b>' + S.cohorts.length + '</b></div><div class="card kpi"><span>Peserta</span><b>' + np + '</b></div><div class="card kpi"><span>Sesi hari ini</span><b>' + S.sesi.filter(function (s) { return s.Tanggal === t; }).length + '</b></div><div class="card kpi"><span>Rata-rata progres</span><b>' + avg + '%</b></div></div>' +
    '<div class="grid" style="margin-top:16px;grid-template-columns:repeat(auto-fit,minmax(300px,1fr))"><div class="card"><h2>Sesi mendatang</h2>' +
    (up.slice(0, 5).map(function (s) { return '<div class="row"><div class="g"><a href="#/sesi/' + h(s.ID_Sesi) + '"><b>' + h(s.Judul_Sesi) + '</b></a><br><small>' + fd(s.Tanggal) + ' · ' + h(s.Jam_Mulai) + '</small></div>' + chipT(s.Tipe) + '</div>'; }).join('') || '<div class="empty">Belum ada sesi terjadwal.</div>') + '</div>' +
    '<div class="card"><h2>Progres per cohort</h2>' + (S.cohorts.map(function (c) { var p = pct(c.ID_Cohort); return '<div style="margin-bottom:14px"><div class="row" style="border:0;padding:0 0 4px"><div class="g"><b>' + h(c.Nama_Cohort) + '</b></div><small>' + p + '%</small></div><div class="bar"><i style="width:' + p + '%"></i></div></div>'; }).join('') || '<div class="empty">Belum ada cohort.</div>') + '</div></div>';
}
function cohortPage() {
  return '<div class="head"><div><h1>Cohort</h1><p class="sub">Kelola angkatan, modul, dan anggota.</p></div><button class="btn" id="nc">+ Buat Cohort</button></div><div class="grid">' +
    (S.cohorts.map(function (c) {
      var ms = by(S.modul, 'ID_Cohort', c.ID_Cohort).sort(function (a, b) { return a.Urutan - b.Urutan; }), p = pct(c.ID_Cohort);
      return '<div class="card"><div class="row" style="border:0"><div class="g"><h2 style="margin:0">' + h(c.Nama_Cohort) + '</h2><small>' + h(c.Program) + ' · ' + fd(c.Tanggal_Mulai) + '</small></div><span class="chip ' + (c.Status === 'Aktif' ? 'on' : c.Status === 'Draft' ? 'pl' : 'gr') + '">' + h(c.Status) + '</span></div>' +
        '<div class="bar" style="margin:8px 0"><i style="width:' + p + '%"></i></div><small>' + by(S.members, 'ID_Cohort', c.ID_Cohort).length + ' anggota · ' + by(S.sesi, 'ID_Cohort', c.ID_Cohort).length + ' sesi · progres ' + p + '%</small>' +
        '<div style="margin:10px 0">' + (ms.map(function (m) { return '<div class="row"><div class="g">' + h(m.Urutan) + '. ' + h(m.Judul) + (m.Status_Publikasi === 'Draft' ? ' <span class="chip gr">Draft</span>' : '') + '</div><button class="btn s o" data-em="' + h(m.ID_Modul) + '">Ubah</button></div>'; }).join('') || '<small>Belum ada modul.</small>') + '</div>' +
        '<button class="btn s o" data-ec="' + h(c.ID_Cohort) + '">Ubah</button> <button class="btn s o" data-an="' + h(c.ID_Cohort) + '">Anggota</button> <button class="btn s o" data-nm="' + h(c.ID_Cohort) + '">+ Modul</button> <button class="btn s d" data-dc="' + h(c.ID_Cohort) + '">Hapus</button></div>';
    }).join('') || '<div class="card empty">Belum ada cohort. Klik “Buat Cohort”.</div>') + '</div>';
}
function bindCohort() {
  var cf = [{ k: 'Nama_Cohort', l: 'Nama cohort', r: 1 }, { k: 'Program', l: 'Program' }, { k: 'Tanggal_Mulai', l: 'Tanggal mulai', t: 'date' }, { k: 'Tanggal_Selesai', l: 'Tanggal selesai', t: 'date' }, { k: 'Status', l: 'Status', t: 'select', o: [['Draft', 'Draft'], ['Aktif', 'Aktif'], ['Selesai', 'Selesai']] }, { k: 'Deskripsi', l: 'Deskripsi', t: 'area' }];
  var sv = function (t, rec, old) { rec[t === 'cohort' ? 'ID_Cohort' : 'ID_Modul'] = old ? old : uid(t === 'cohort' ? 'C' : 'M'); var key = t === 'cohort' ? 'cohorts' : 'modul', idk = t === 'cohort' ? 'ID_Cohort' : 'ID_Modul'; save('simpan', { t: t, rec: rec }, function () { var i = S[key].findIndex(function (x) { return x[idk] === rec[idk]; }); if (i < 0) S[key].push(rec); else S[key][i] = Object.assign(S[key][i], rec); }, 'Tersimpan.'); };
  $('#nc').onclick = function () { form('Buat cohort', cf, { Status: 'Draft' }, function (o) { sv('cohort', o); }); };
  document.querySelectorAll('[data-ec]').forEach(function (b) { b.onclick = function () { var c = one(S.cohorts, 'ID_Cohort', b.dataset.ec); form('Ubah cohort', cf, c, function (o) { sv('cohort', o, c.ID_Cohort); }); }; });
  var mf = [{ k: 'Judul', l: 'Judul modul', r: 1 }, { k: 'Urutan', l: 'Urutan', t: 'number', r: 1 }, { k: 'Status_Publikasi', l: 'Status', t: 'select', o: [['Draft', 'Draft'], ['Terbit', 'Terbit']] }, { k: 'Deskripsi', l: 'Deskripsi', t: 'area' }];
  document.querySelectorAll('[data-nm]').forEach(function (b) { b.onclick = function () { form('Tambah modul', mf, { Status_Publikasi: 'Terbit', Urutan: by(S.modul, 'ID_Cohort', b.dataset.nm).length + 1 }, function (o) { o.ID_Cohort = b.dataset.nm; sv('modul', o); }); }; });
  document.querySelectorAll('[data-em]').forEach(function (b) { b.onclick = function () { var m = one(S.modul, 'ID_Modul', b.dataset.em); form('Ubah modul', mf, m, function (o) { o.ID_Cohort = m.ID_Cohort; sv('modul', o, m.ID_Modul); }); }; });
  document.querySelectorAll('[data-dc]').forEach(function (b) { b.onclick = function () { confirmDo('Hapus cohort ini? Sesi dan modulnya ikut tersembunyi.', function () { save('hapus', { t: 'cohort', id: b.dataset.dc }, function () { S.cohorts = S.cohorts.filter(function (c) { return c.ID_Cohort !== b.dataset.dc; }); }, 'Dihapus.'); }); }; });
  document.querySelectorAll('[data-an]').forEach(function (b) { b.onclick = function () { members(b.dataset.an); }; });
}
function members(c) {
  var cur = {}; by(S.members, 'ID_Cohort', c).forEach(function (m) { cur[m.ID_User] = m.Peran_di_Cohort; });
  modal('<h2>Anggota cohort</h2><div class="sc">' + S.users.filter(function (u) { return u.Role !== 'admin'; }).map(function (u) { return '<div class="row"><input type="checkbox" style="width:auto" data-u="' + h(u.ID_User) + '"' + (cur[u.ID_User] ? ' checked' : '') + '><div class="g">' + h(u.Nama) + '<br><small>' + h(u.Email) + ' · ' + h(u.Role) + '</small></div></div>'; }).join('') + '</div><div class="acts"><button class="btn o" id="bx">Batal</button><button class="btn" id="bo">Simpan</button></div>');
  $('#bx').onclick = close;
  $('#bo').onclick = function () { var a = []; document.querySelectorAll('[data-u]').forEach(function (i) { if (i.checked) { var u = one(S.users, 'ID_User', i.dataset.u); a.push({ id: u.ID_User, peran: u.Role === 'instruktur' ? 'Instruktur' : 'Peserta' }); } }); close();
    save('anggota.set', { cohort: c, anggota: a }, function () { S.members = S.members.filter(function (m) { return m.ID_Cohort !== c; }).concat(a.map(function (x) { return { ID: uid('A'), ID_Cohort: c, ID_User: x.id, Peran_di_Cohort: x.peran }; })); }, 'Anggota diperbarui.'); };
}
var selC = '';
function jadwal() {
  var l = S.sesi.filter(function (s) { return !selC || s.ID_Cohort === selC; }).sort(function (a, b) { return (a.Tanggal + a.Jam_Mulai).localeCompare(b.Tanggal + b.Jam_Mulai); }), g = {};
  l.forEach(function (s) { (g[s.Tanggal] = g[s.Tanggal] || []).push(s); });
  return '<div class="head"><div><h1>Jadwal</h1><p class="sub">Sesi online, offline, dan pre-learning.</p></div><div style="display:flex;gap:8px"><select id="fc" style="width:auto"><option value="">Semua cohort</option>' + S.cohorts.map(function (c) { return '<option value="' + h(c.ID_Cohort) + '"' + (c.ID_Cohort === selC ? ' selected' : '') + '>' + h(c.Nama_Cohort) + '</option>'; }).join('') + '</select>' + (staff() ? '<button class="btn" id="ns">+ Tambah Sesi</button>' : '') + '</div></div>' +
    (Object.keys(g).map(function (d) { return '<div class="card" style="margin-bottom:12px"><h2>' + fd(d) + (d === td() ? ' <span class="chip on">Hari ini</span>' : '') + '</h2>' + g[d].map(function (s) { return '<div class="row"><div class="g"><a href="#/sesi/' + h(s.ID_Sesi) + '"><b>' + h(s.Judul_Sesi) + '</b></a><br><small>' + h(s.Jam_Mulai) + '–' + h(s.Jam_Selesai) + ' · ' + h(s.Lokasi_atau_Link_Meeting) + '</small></div>' + chipT(s.Tipe) + (staff() ? '<button class="btn s o" data-es="' + h(s.ID_Sesi) + '">Ubah</button>' : '') + '</div>'; }).join('') + '</div>'; }).join('') || '<div class="card empty">Belum ada sesi.</div>');
}
function sesiForm(s) {
  if (!S.cohorts.length) return toast('Buat cohort terlebih dahulu', 'err');
  var ins = S.users.filter(function (u) { return u.Role !== 'peserta'; });
  var f = [{ k: 'ID_Cohort', l: 'Cohort', t: 'select', o: opt(S.cohorts, 'ID_Cohort', 'Nama_Cohort'), r: 1 }, { k: 'ID_Modul', l: 'Modul', t: 'select', o: [['', '— tanpa modul —']].concat(opt(S.modul, 'ID_Modul', 'Judul')) }, { k: 'Judul_Sesi', l: 'Judul sesi', r: 1 }, { k: 'Tipe', l: 'Tipe', t: 'select', o: [['Offline', 'Offline'], ['Online', 'Online'], ['Pre-learning', 'Pre-learning']] }, { k: 'Tanggal', l: 'Tanggal', t: 'date', r: 1 }, { k: 'Jam_Mulai', l: 'Jam mulai', t: 'time', r: 1 }, { k: 'Jam_Selesai', l: 'Jam selesai', t: 'time', r: 1 }, { k: 'Lokasi_atau_Link_Meeting', l: 'Lokasi / link meeting' }, { k: 'ID_Instruktur', l: 'Instruktur', t: 'select', o: [['', '—']].concat(opt(ins, 'ID_User', 'Nama')) }, { k: 'Catatan', l: 'Catatan', t: 'area' }];
  form(s ? 'Ubah sesi' : 'Tambah sesi', f, s || { Tipe: 'Offline', ID_Cohort: selC || S.cohorts[0].ID_Cohort }, function (o) {
    if (o.Jam_Selesai <= o.Jam_Mulai) return toast('Jam selesai harus setelah jam mulai', 'err');
    if (o.Tipe === 'Offline' && !o.Lokasi_atau_Link_Meeting) return toast('Sesi offline wajib berisi lokasi', 'err');
    o.ID_Sesi = s ? s.ID_Sesi : uid('S'); save('simpan', { t: 'sesi', rec: o }, function () { var i = S.sesi.findIndex(function (x) { return x.ID_Sesi === o.ID_Sesi; }); if (i < 0) S.sesi.push(o); else S.sesi[i] = Object.assign(S.sesi[i], o); }, 'Sesi tersimpan.'); });
}
function sesiPage(id) {
  var s = one(S.sesi, 'ID_Sesi', id); if (!s) return '<div class="card empty">Sesi tidak ditemukan. <a href="#/jadwal">Kembali</a></div>';
  var ms = by(S.materi, 'ID_Sesi', id), pr = one(S.progres, 'ID', S.me.id + '_' + id), done = pr && pr.Status === 'Sudah';
  var yt = ms.filter(function (m) { return m.Jenis === 'YouTube' && ytId(m.URL_YouTube); }), fl = ms.filter(function (m) { return m.Jenis === 'File'; });
  return '<p><a href="#/jadwal">← Jadwal</a></p><div class="head"><div><h1>' + h(s.Judul_Sesi) + '</h1><p class="sub">' + chipT(s.Tipe) + ' ' + fd(s.Tanggal) + ' · ' + h(s.Jam_Mulai) + '–' + h(s.Jam_Selesai) + ' · ' + h(s.Lokasi_atau_Link_Meeting) + '<br>Instruktur: ' + h(usr(s.ID_Instruktur)) + '</p></div>' +
    '<div>' + (S.me.role === 'peserta' ? '<button class="btn' + (done ? ' o' : '') + '" id="tp">' + (done ? 'Sudah dipelajari ✓' : 'Tandai sudah dipelajari') + '</button>' : '<a class="btn" href="#/hadir/' + h(id) + '">Catat kehadiran</a>') + '</div></div>' +
    (yt.map(function (m) { return '<div><div class="video"><iframe src="https://www.youtube-nocookie.com/embed/' + ytId(m.URL_YouTube) + '" allowfullscreen loading="lazy"></iframe></div><div class="row" style="border:0;padding-top:0"><div class="g"><b>' + h(m.Judul) + '</b></div>' + (staff() ? '<button class="btn s d" data-dm="' + h(m.ID_Materi) + '">Hapus</button>' : '') + '</div></div>'; }).join('') || '<div class="card empty" style="margin-bottom:12px">Rekaman belum tersedia.</div>') +
    '<div class="card"><div class="row" style="border:0"><h2 class="g" style="margin:0">Materi pendukung</h2>' + (staff() ? '<button class="btn s o" id="ay">+ YouTube</button><button class="btn s o" id="af">+ File</button><input type="file" id="fi" hidden>' : '') + '</div>' +
    (fl.map(function (m) { return '<div class="row"><div class="g">' + h(m.Judul) + '</div><button class="btn s o" data-dl="' + h(m.ID_Materi) + '">Unduh</button>' + (staff() ? '<button class="btn s d" data-dm="' + h(m.ID_Materi) + '">Hapus</button>' : '') + '</div>'; }).join('') || '<small>Belum ada file.</small>') + '</div>' +
    (s.Catatan ? '<div class="card" style="margin-top:12px"><h2>Catatan sesi</h2><p style="margin:0;white-space:pre-wrap">' + h(s.Catatan) + '</p></div>' : '');
}
function bindSesi(id) {
  var tp = $('#tp'); if (tp) tp.onclick = function () { var st = tp.textContent.indexOf('✓') > 0 ? 'Belum' : 'Sudah'; save('progres.tandai', { sesi: id, status: st }, function () { var i = S.progres.findIndex(function (p) { return p.ID === S.me.id + '_' + id; }); if (i < 0) S.progres.push({ ID: S.me.id + '_' + id, ID_User: S.me.id, ID_Sesi: id, Status: st }); else S.progres[i].Status = st; }); };
  var ay = $('#ay'); if (ay) ay.onclick = function () { form('Tambah video YouTube', [{ k: 'Judul', l: 'Judul', r: 1 }, { k: 'URL_YouTube', l: 'Link YouTube', r: 1 }], {}, function (o) { if (!ytId(o.URL_YouTube)) return toast('Link YouTube tidak valid', 'err'); o.ID_Materi = uid('T'); o.ID_Sesi = id; o.Jenis = 'YouTube'; save('simpan', { t: 'materi', rec: o }, function () { S.materi.push(o); }, 'Video ditambahkan.'); }); };
  var af = $('#af'), fi = $('#fi'); if (af) { af.onclick = function () { fi.click(); }; fi.onchange = function () { var f = fi.files[0]; if (!f) return; if (f.size > 5 * 1024 * 1024) return toast('Maksimal 5 MB per file', 'err'); toast('Mengunggah…'); var r = new FileReader(); r.onload = function () { api('materi.upload', { sesi: id, nama: f.name, mime: f.type, judul: f.name, b64: String(r.result).split(',')[1] }).then(function (x) { toast(x.message || 'Gagal', x.success ? '' : 'err'); if (x.success) boot(true); }); }; r.readAsDataURL(f); }; }
  document.querySelectorAll('[data-dm]').forEach(function (b) { b.onclick = function () { confirmDo('Hapus materi ini?', function () { save('hapus', { t: 'materi', id: b.dataset.dm }, function () { S.materi = S.materi.filter(function (m) { return m.ID_Materi !== b.dataset.dm; }); }, 'Dihapus.'); }); }; });
  document.querySelectorAll('[data-dl]').forEach(function (b) { b.onclick = function () { b.disabled = true; api('materi.unduh', { id: b.dataset.dl }).then(function (r) { b.disabled = false; if (!r.success) return toast(r.message, 'err'); var bin = atob(r.data.b64), u = new Uint8Array(bin.length); for (var i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([u], { type: r.data.mime })); a.download = r.data.nama; a.click(); }); }; });
}
function hadirPage(id) {
  var list = S.sesi.slice().sort(function (a, b) { return b.Tanggal.localeCompare(a.Tanggal); }); id = id || (list[0] || {}).ID_Sesi; var s = one(S.sesi, 'ID_Sesi', id);
  var rows = s ? peserta(s.ID_Cohort).map(function (m) { var p = one(S.progres, 'ID', m.ID_User + '_' + id) || {}; return '<tr><td>' + h(usr(m.ID_User)) + '</td><td><select data-k="' + h(m.ID_User) + '">' + ['', 'Hadir', 'Online', 'Tidak Hadir'].map(function (k) { return '<option' + (p.Kehadiran === k ? ' selected' : '') + ' value="' + k + '">' + (k || '— belum dicatat —') + '</option>'; }).join('') + '</select></td><td>' + (p.Status === 'Sudah' ? '<span class="chip on">Sudah dipelajari</span>' : '<span class="chip gr">Belum</span>') + '</td></tr>'; }).join('') : '';
  return '<div class="head"><div><h1>Kehadiran & Progres</h1></div><select id="hs" style="width:auto;max-width:100%">' + list.map(function (x) { return '<option value="' + h(x.ID_Sesi) + '"' + (x.ID_Sesi === id ? ' selected' : '') + '>' + fd(x.Tanggal) + ' — ' + h(x.Judul_Sesi) + '</option>'; }).join('') + '</select></div><div class="card sc">' + (rows ? '<table><tr><th>Peserta</th><th>Kehadiran</th><th>Progres</th></tr>' + rows + '</table><div class="acts"><button class="btn" id="sh">Simpan kehadiran</button></div>' : '<div class="empty">Belum ada peserta/sesi.</div>') + '</div>';
}
function bindHadir(id) {
  var hs = $('#hs'); if (hs) hs.onchange = function () { location.hash = '#/hadir/' + hs.value; };
  var sh = $('#sh'); if (sh) sh.onclick = function () { var rows = []; document.querySelectorAll('[data-k]').forEach(function (e) { rows.push({ id: e.dataset.k, k: e.value }); }); id = id || hs.value;
    save('hadir.simpan', { sesi: id, rows: rows }, function () { rows.forEach(function (r) { var pid = r.id + '_' + id, p = one(S.progres, 'ID', pid); if (p) p.Kehadiran = r.k; else S.progres.push({ ID: pid, ID_User: r.id, ID_Sesi: id, Status: 'Belum', Kehadiran: r.k }); }); }, 'Kehadiran tersimpan.'); };
}
function userPage() {
  return '<div class="head"><div><h1>Pengguna</h1><p class="sub">Daftarkan admin, instruktur, dan peserta.</p></div><button class="btn" id="nu">+ Tambah Pengguna</button></div><div class="card sc"><table><tr><th>Nama</th><th>Email</th><th>WhatsApp</th><th>Peran</th><th>Status</th><th></th></tr>' +
    S.users.map(function (u) { return '<tr><td>' + h(u.Nama) + '</td><td>' + h(u.Email) + '</td><td>' + h(u.No_WA || '-') + '</td><td><span class="chip ' + (u.Role === 'admin' ? 'pl' : u.Role === 'instruktur' ? '' : 'on') + '">' + h(u.Role) + '</span></td><td>' + h(u.Status_Aktif) + '</td><td><button class="btn s o" data-eu="' + h(u.ID_User) + '">Ubah</button></td></tr>'; }).join('') + '</table></div>';
}
function bindUser() {
  var f = function (n) { return [{ k: 'Nama', l: 'Nama', r: 1 }, { k: 'Email', l: 'Email', t: 'email', r: 1 }, { k: 'Role', l: 'Peran', t: 'select', o: [['peserta', 'Peserta'], ['instruktur', 'Instruktur'], ['admin', 'Admin']] }, { k: 'Status_Aktif', l: 'Status', t: 'select', o: [['Aktif', 'Aktif'], ['Nonaktif', 'Nonaktif']] }, { k: 'No_WA', l: 'Nomor WhatsApp (mis. 081234567890)' }, { k: 'OptOut', l: 'Terima pesan blast WA?', t: 'select', o: [['TIDAK', 'Ya, terima'], ['YA', 'Opt-out (jangan kirim blast)']] }, { k: 'password', l: n ? 'Kata sandi awal (min. 8 karakter)' : 'Kata sandi baru (kosongkan bila tidak diubah)', t: 'password', r: n }]; };
  var sv = function (o, id) { o.ID_User = id || ''; api('user.simpan', { rec: o }).then(function (r) { toast(r.message || 'Gagal', r.success ? '' : 'err'); if (r.success) boot(true); }); };
  $('#nu').onclick = function () { form('Tambah pengguna', f(1), { Role: 'peserta', Status_Aktif: 'Aktif' }, function (o) { sv(o); }); };
  document.querySelectorAll('[data-eu]').forEach(function (b) { b.onclick = function () { var u = one(S.users, 'ID_User', b.dataset.eu); form('Ubah pengguna', f(0), u, function (o) { sv(o, u.ID_User); }); }; });
}

// ---- Modul v1.1: Notifikasi, Kontak (CRM), Impor, Sertifikat, Verifikasi ----
var N = null, Nt = 0, selS = '', csvRows = null;
function loadN() { Nt = Date.now(); api('notif.baca').then(function (r) { if (r.success) { N = r.data; Nt = Date.now(); render(); } else toast(r.message, 'err'); }); }
function dl(action, data, b) { if (b) b.disabled = true; return api(action, data).then(function (r) { if (b) b.disabled = false; if (!r.success) return toast(r.message, 'err'); var bin = atob(r.data.b64), u = new Uint8Array(bin.length); for (var i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([u], { type: r.data.mime })); a.download = r.data.nama; a.click(); }); }
function chk(id, v) { return '<input type="checkbox" id="' + id + '" style="width:auto"' + (v ? ' checked' : '') + '>'; }
function notifPage() {
  if (!N) { loadN(); return '<div class="sk"></div><div class="sk"></div>'; }
  if (Date.now() - Nt > 30000) loadN();
  var ev = Object.keys(N.matriks).map(function (k) { var m = N.matriks[k]; return '<tr><td>' + h(m.label) + '</td><td>' + chk('mw_' + k, m.wa) + '</td><td>' + chk('me_' + k, m.email) + '</td></tr>'; }).join('');
  return '<div class="head"><div><h1>Notifikasi</h1><p class="sub">WhatsApp (Fonnte) dan email lewat antrean: tombol tetap instan.</p></div></div>' +
    '<div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(320px,1fr))"><div class="card"><h2>Pengaturan</h2>' +
    '<label><span>' + chk('n_wa', N.waAktif) + ' Aktifkan WhatsApp</span></label><label><span>' + chk('n_em', N.emailAktif) + ' Aktifkan email</span> <small>(sisa kuota hari ini: ' + N.sisaEmail + ')</small></label>' +
    '<label>Token Fonnte ' + (N.tokenAda ? '<small>(tersimpan: ' + h(N.token) + ', kosongkan = tidak diubah)</small>' : '') + '</label><input id="n_tk" type="password" autocomplete="off" placeholder="' + (N.tokenAda ? '••••••' : 'Tempel token dari fonnte.com') + '">' +
    '<label>Alamat aplikasi (untuk tautan di pesan)</label><input id="n_url" value="' + h(N.appUrl) + '" placeholder="https://username.github.io/ruangcohort">' +
    '<label>Nama institusi</label><input id="n_in" value="' + h(N.institusi) + '"><label>Ukuran batch blast</label><select id="n_bt">' + [10, 20, 50].map(function (x) { return '<option' + (x === N.batch ? ' selected' : '') + '>' + x + '</option>'; }).join('') + '</select>' +
    '<label>Jeda antar pesan (detik, mis. 5 atau 3-8)</label><input id="n_jd" value="' + h(N.jeda) + '"><label>Minimal progres untuk sertifikat (%)</label><input id="n_ms" type="number" min="1" max="100" value="' + N.minSert + '">' +
    '<label>Template sertifikat (link Google Slides; kosong = bawaan)</label><input id="n_tp" value="' + h(N.templateId) + '" placeholder="Pakai {{NAMA}} {{PROGRAM}} {{COHORT}} {{NOMOR}} {{TANGGAL}} {{KODE_VERIFIKASI}}">' +
    '<div class="acts" style="justify-content:flex-start;flex-wrap:wrap"><button class="btn" id="n_sv">Simpan</button><button class="btn o" id="n_dv">Cek perangkat</button><button class="btn o" id="n_tw">Tes WA</button><button class="btn o" id="n_te">Tes email</button><button class="btn d" id="n_ht">Hapus token</button></div></div>' +
    '<div><div class="card" style="margin-bottom:16px"><h2>Pemicu pesan otomatis</h2><div class="sc"><table><tr><th>Kejadian</th><th>WA</th><th>Email</th></tr>' + ev + '</table></div><small>Antrean: ' + N.antri.Antri + ' menunggu · ' + N.antri.Terkirim + ' terkirim · ' + N.antri.Gagal + ' gagal. Notifikasi sistem tetap terkirim ke kontak opt-out; blast tidak.</small></div>' +
    '<div class="card"><h2>Blast WhatsApp</h2><label>Penerima</label><select id="b_c"><option value="*">Semua pengguna aktif</option>' + S.cohorts.map(function (c) { return '<option value="' + h(c.ID_Cohort) + '">' + h(c.Nama_Cohort) + '</option>'; }).join('') + '</select><label>Pesan (pakai {nama})</label><textarea id="b_p" rows="4" placeholder="Halo {nama}, ..."></textarea><div class="acts"><button class="btn" id="b_go">Masukkan ke antrean</button></div><small>Dikirim bertahap per batch agar nomor aman dari blokir. Kontak opt-out dan nomor tidak valid dilewati otomatis.</small></div></div></div>';
}
function bindNotif() {
  if (!N) return;
  var g = function (i) { return $('#' + i); }, done = function (r) { if (r.success) { if (r.data && r.data.matriks) { N = r.data; Nt = Date.now(); } render(); } toast(r.message || 'Gagal', r.success ? '' : 'err'); };
  g('n_sv').onclick = function () { var m = {}; Object.keys(N.matriks).forEach(function (k) { m[k] = { wa: g('mw_' + k).checked, email: g('me_' + k).checked }; }); api('notif.simpan', { waAktif: g('n_wa').checked, emailAktif: g('n_em').checked, token: g('n_tk').value.trim(), appUrl: g('n_url').value.trim(), institusi: g('n_in').value.trim(), batch: g('n_bt').value, jeda: g('n_jd').value.trim(), minSert: g('n_ms').value, templateId: g('n_tp').value.trim(), matriks: m }).then(done); };
  g('n_ht').onclick = function () { confirmDo('Hapus token Fonnte? WhatsApp akan dimatikan.', function () { api('notif.simpan', { token: '__HAPUS__' }).then(done); }); };
  g('n_dv').onclick = function () { api('notif.perangkat').then(function (r) { toast(r.success ? 'Perangkat: ' + (r.data.status || '?') + ' · paket ' + (r.data.paket || '-') + ' · kuota ' + (r.data.kuota || '-') : r.message, r.success ? '' : 'err'); }); };
  g('n_tw').onclick = function () { var n = window.prompt('Kirim tes ke nomor WA:'); if (n) api('notif.tes', { kanal: 'wa', tujuan: n }).then(function (r) { toast(r.message, r.success ? '' : 'err'); }); };
  g('n_te').onclick = function () { var e = window.prompt('Kirim tes ke email:', S.me.email); if (e) api('notif.tes', { kanal: 'email', tujuan: e }).then(function (r) { toast(r.message, r.success ? '' : 'err'); }); };
  g('b_go').onclick = function () { var p = g('b_p').value.trim(); if (p.length < 5) return toast('Tulis pesan terlebih dahulu', 'err'); confirmDo('Masukkan pesan ke antrean untuk dikirim bertahap?', function () { api('wa.blast', { cohort: g('b_c').value, pesan: p }).then(function (r) { if (r.success) { g('b_p').value = ''; var d = r.data.dilewati; toast(r.data.total + ' pesan diantrekan (dilewati: ' + d.optout + ' opt-out, ' + d.invalid + ' tanpa WA valid)'); loadN(); } else toast(r.message, 'err'); }); }); };
}
var sel = {};
function kontakPage() {
  var us = S.users.filter(function (u) { return u.Role !== 'admin' || true; }), c = function (f) { return us.filter(f).length; }, ok = function (u) { return /^08\d{8,12}$/.test(u.No_WA || ''); };
  return '<div class="head"><div><h1>Kontak</h1><p class="sub">Nama, email, dan WhatsApp semua pengguna.</p></div><div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn o" id="kd">Deteksi WA</button><button class="btn" id="ki">⬆ Impor</button></div></div>' +
    '<div class="grid" style="margin-bottom:16px"><div class="card kpi"><span>Total kontak</span><b>' + us.length + '</b></div><div class="card kpi"><span>WA valid</span><b>' + c(ok) + '</b></div><div class="card kpi"><span>Terdaftar di WA</span><b>' + c(function (u) { return u.StatusWA === 'Terdaftar'; }) + '</b></div><div class="card kpi"><span>Belum dicek</span><b>' + c(function (u) { return ok(u) && !u.StatusWA; }) + '</b></div><div class="card kpi"><span>Opt-out</span><b>' + c(function (u) { return u.OptOut === 'YA'; }) + '</b></div><div class="card kpi"><span>Tanpa WA</span><b>' + c(function (u) { return !ok(u); }) + '</b></div></div>' +
    '<div class="card sc"><table><tr><th></th><th>Nama</th><th>Email</th><th>WhatsApp</th><th>Opt-out</th></tr>' + us.map(function (u) { return '<tr><td><input type="checkbox" style="width:auto" data-s="' + h(u.ID_User) + '"' + (sel[u.ID_User] ? ' checked' : '') + '></td><td>' + h(u.Nama) + '<br><span class="chip gr">' + h(u.Role) + '</span></td><td>' + h(u.Email) + '</td><td>' + (ok(u) ? '<a href="https://wa.me/62' + h(u.No_WA.slice(1)) + '" target="_blank" rel="noopener">' + h(u.No_WA) + '</a> ' + (u.StatusWA === 'Terdaftar' ? '<span class="chip on">✓ WA</span>' : u.StatusWA ? '<span class="chip er">✕ WA</span>' : '<span class="chip pl">?</span>') : '<span class="chip gr">tidak ada</span>') + '</td><td><button class="btn s ' + (u.OptOut === 'YA' ? 'd' : 'o') + '" data-oo="' + h(u.ID_User) + '">' + (u.OptOut === 'YA' ? 'Opt-out' : 'Terima') + '</button></td></tr>'; }).join('') + '</table></div>';
}
function bindKontak() {
  document.querySelectorAll('[data-s]').forEach(function (i) { i.onchange = function () { sel[i.dataset.s] = i.checked; }; });
  document.querySelectorAll('[data-oo]').forEach(function (b) { b.onclick = function () { var u = one(S.users, 'ID_User', b.dataset.oo), n = u.OptOut === 'YA' ? 'TIDAK' : 'YA'; save('user.simpan', { rec: { ID_User: u.ID_User, Nama: u.Nama, Email: u.Email, Role: u.Role, Status_Aktif: u.Status_Aktif, No_WA: u.No_WA, OptOut: n } }, function () { u.OptOut = n; }, n === 'YA' ? 'Kontak di-opt-out dari blast.' : 'Kontak menerima blast lagi.'); }; });
  $('#kd').onclick = function () { var ids = Object.keys(sel).filter(function (k) { return sel[k]; }); if (!ids.length) ids = S.users.filter(function (u) { return /^08/.test(u.No_WA || '') && !u.StatusWA; }).map(function (u) { return u.ID_User; }); ids = ids.slice(0, 50); if (!ids.length) return toast('Tidak ada nomor yang perlu dicek', 'err'); toast('Memeriksa ' + ids.length + ' nomor…'); api('wa.validate', { ids: ids }).then(function (r) { toast(r.message, r.success ? '' : 'err'); if (r.success) { sel = {}; boot(true); } }); };
  $('#ki').onclick = importModal;
}
// --- Impor CSV / spreadsheet lama ---
var ALI = { nama: ['nama', 'namalengkap'], email: ['email', 'surel'], wa: ['wa', 'nowa', 'whatsapp', 'nohp', 'hp', 'telepon'], role: ['role', 'peran'], cohort: ['cohort', 'angkatan', 'batch', 'kelas'] };
function parseCsv(t) {
  t = String(t).replace(/^\uFEFF/, ''); var first = t.split(/\r?\n/)[0] || '', d = [',', ';', '\t'].sort(function (a, b) { return first.split(b).length - first.split(a).length; })[0], rows = [], r = [], f = '', q = false;
  for (var i = 0; i < t.length; i++) { var c = t[i]; if (q) { if (c === '"') { if (t[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; } else if (c === '"') q = true; else if (c === d) { r.push(f); f = ''; } else if (c === '\n' || c === '\r') { if (c === '\r' && t[i + 1] === '\n') i++; r.push(f); f = ''; rows.push(r); r = []; } else f += c; }
  if (f || r.length) { r.push(f); rows.push(r); } rows = rows.filter(function (x) { return x.join('').trim() !== ''; }); if (rows.length < 2) return [];
  var H = rows[0].map(function (x) { return x.trim().toLowerCase().replace(/[\s_]+/g, ''); }), col = {}; Object.keys(ALI).forEach(function (k) { col[k] = H.findIndex(function (x) { return ALI[k].indexOf(x) >= 0; }); });
  return rows.slice(1).map(function (x) { var o = {}; Object.keys(col).forEach(function (k) { if (col[k] >= 0) o[k] = (x[col[k]] || '').trim(); }); return o; });
}
function importModal() {
  csvRows = null;
  modal('<h2>Impor pengguna</h2><p class="sub">Dari berkas CSV atau spreadsheet lama. Kolom: <b>nama, email, wa, role, cohort</b>. Aman diulang: email yang sudah ada tidak digandakan, dan peran/sandi tidak ditimpa.</p>' +
    '<label>Berkas CSV</label><input type="file" id="i_f" accept=".csv,.txt"><label>…atau tempel CSV</label><textarea id="i_t" rows="4" placeholder="nama,email,wa,role,cohort"></textarea><label>…atau link Google Sheets lama (sheet pertama)</label><input id="i_u" placeholder="https://docs.google.com/spreadsheets/d/…"><p><a href="#" id="i_tpl">Unduh template CSV</a></p><div id="i_r"></div>' +
    '<div class="acts"><button class="btn o" id="bx">Tutup</button><button class="btn o" id="i_d">Pindai dulu</button><button class="btn" id="i_g">Impor</button></div>');
  $('#bx').onclick = close; $('#i_f').onchange = function (e) { var f = e.target.files[0]; if (f) { var r = new FileReader(); r.onload = function () { $('#i_t').value = String(r.result); }; r.readAsText(f); } };
  $('#i_tpl').onclick = function (e) { e.preventDefault(); var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['nama,email,wa,role,cohort\nSari,sari@email.com,081234567890,peserta,Batch 1\n'], { type: 'text/csv' })); a.download = 'template-impor.csv'; a.click(); };
  var go = function (dry) { var u = $('#i_u').value.trim(), rows = u ? null : parseCsv($('#i_t').value); if (!u && !rows.length) return toast('Isi CSV (dengan baris judul) atau link spreadsheet', 'err'); if (!dry && !window.confirm('Impor sekarang?')) return; $('#i_r').innerHTML = '<div class="sk"></div>';
    api('kontak.impor', u ? { sumber: u, dry: dry } : { rows: rows, dry: dry }).then(function (r) { if (!r.success) { $('#i_r').innerHTML = ''; return toast(r.message, 'err'); } var l = r.data.lap;
      $('#i_r').innerHTML = '<div class="card" style="background:var(--lo)"><b>' + (dry ? 'Hasil pindai (belum ditulis)' : 'Impor selesai') + '</b><br>' + l.total + ' baris · ' + l.ditambah + ' ditambah · ' + l.diperbarui + ' diperbarui · ' + l.dilewati + ' dilewati · ' + l.anggota + ' masuk cohort' + (l.peringatan.length ? '<ul style="margin:8px 0;padding-left:18px">' + l.peringatan.slice(0, 8).map(function (x) { return '<li>' + h(x) + '</li>'; }).join('') + (l.peringatan.length > 8 ? '<li>…dan ' + (l.peringatan.length - 8) + ' lainnya</li>' : '') + '</ul>' : '') +
        (r.data.sandi.length ? '<p><b>Sandi awal (tampil sekali ini saja):</b></p><textarea id="i_s" rows="4" readonly>' + h(r.data.sandi.map(function (x) { return x.email + ',' + x.sandi; }).join('\n')) + '</textarea><button class="btn s o" id="i_c">Salin</button>' : '') + '</div>';
      var c = $('#i_c'); if (c) c.onclick = function () { $('#i_s').select(); document.execCommand('copy'); toast('Disalin'); }; if (!dry) boot(true); }); };
  $('#i_d').onclick = function () { go(true); }; $('#i_g').onclick = function () { go(false); };
}
// --- Sertifikat ---
function sertInfo(c, uid) { var ss = by(S.sesi, 'ID_Cohort', c), done = S.progres.filter(function (p) { return p.ID_User === uid && p.Status === 'Sudah' && ss.some(function (s) { return s.ID_Sesi === p.ID_Sesi; }); }).length, hd = S.progres.filter(function (p) { return p.ID_User === uid && (p.Kehadiran === 'Hadir' || p.Kehadiran === 'Online') && ss.some(function (s) { return s.ID_Sesi === p.ID_Sesi; }); }).length; return { pct: ss.length ? Math.round(done * 100 / ss.length) : 0, hadir: hd, sesi: ss.length }; }
function sertPage() {
  var vurl = location.href.split('#')[0] + '#/verifikasi/';
  if (S.me.role !== 'admin') return '<div class="head"><div><h1>Sertifikat</h1><p class="sub">Sertifikat Anda yang sudah terbit.</p></div></div>' + (S.sertifikat.filter(function (x) { return x.Status === 'Terbit' && x.ID_User === S.me.id; }).map(function (x) { var c = one(S.cohorts, 'ID_Cohort', x.ID_Cohort) || {}; return '<div class="card" style="margin-bottom:12px"><div class="row" style="border:0"><div class="g"><b>' + h(c.Program || c.Nama_Cohort) + '</b><br><small>' + h(x.Nomor) + ' · ' + fd(x.Diterbitkan) + ' · kode ' + h(x.Kode_Verifikasi) + '</small></div><button class="btn" data-sd="' + h(x.ID_Sertifikat) + '">Unduh PDF</button></div></div>'; }).join('') || '<div class="card empty">Belum ada sertifikat. Selesaikan sesi hingga mencapai ' + S.minSert + '% progres.</div>');
  var c = selS && one(S.cohorts, 'ID_Cohort', selS) ? selS : (S.cohorts[0] || {}).ID_Cohort, ps = c ? peserta(c) : [];
  return '<div class="head"><div><h1>Sertifikat</h1><p class="sub">Terbitkan PDF otomatis untuk peserta yang memenuhi syarat (minimal ' + S.minSert + '% progres).</p></div><select id="sc" style="width:auto">' + S.cohorts.map(function (x) { return '<option value="' + h(x.ID_Cohort) + '"' + (x.ID_Cohort === c ? ' selected' : '') + '>' + h(x.Nama_Cohort) + '</option>'; }).join('') + '</select></div>' +
    '<div class="card sc"><table><tr><th></th><th>Peserta</th><th>Progres</th><th>Hadir</th><th>Sertifikat</th></tr>' + (ps.map(function (m) { var i = sertInfo(c, m.ID_User), x = S.sertifikat.filter(function (z) { return z.ID_Cohort === c && z.ID_User === m.ID_User; })[0], ok = i.pct >= S.minSert; return '<tr><td>' + (!x || x.Status !== 'Terbit' ? '<input type="checkbox" style="width:auto" data-sp="' + h(m.ID_User) + '"' + (ok ? ' checked' : '') + '>' : '') + '</td><td>' + h(usr(m.ID_User)) + '</td><td><div class="bar" style="width:90px;display:inline-block;vertical-align:middle"><i style="width:' + i.pct + '%"></i></div> ' + i.pct + '%</td><td>' + i.hadir + '/' + i.sesi + '</td><td>' + (x ? (x.Status === 'Terbit' ? '<span class="chip on">Terbit</span> <small>' + h(x.Nomor) + '</small> <button class="btn s o" data-sd="' + h(x.ID_Sertifikat) + '">Unduh</button> <button class="btn s d" data-st="' + h(x.ID_Sertifikat) + '">Tarik</button>' : '<span class="chip er">Ditarik</span>') : ok ? '<span class="chip pl">Siap terbit</span>' : '<span class="chip gr">Belum memenuhi</span>') + '</td></tr>'; }).join('') || '<tr><td colspan="5" class="empty">Cohort belum punya peserta.</td></tr>') + '</table>' + (ps.length ? '<div class="acts"><button class="btn" id="sg">Terbitkan untuk yang dicentang</button></div>' : '') + '</div><p><small>Tautan verifikasi publik: ' + h(vurl) + '<i>KODE</i> — dicetak otomatis di tiap sertifikat. Penerbitan memakai template Slides (diatur di menu Notifikasi).</small></p>';
}
function bindSert() {
  var sc = $('#sc'); if (sc) sc.onchange = function () { selS = sc.value; render(); };
  document.querySelectorAll('[data-sd]').forEach(function (b) { b.onclick = function () { dl('sertifikat.unduh', { id: b.dataset.sd }, b); }; });
  document.querySelectorAll('[data-st]').forEach(function (b) { b.onclick = function () { confirmDo('Tarik sertifikat ini? Verifikasi publik akan menyatakan tidak valid.', function () { save('sertifikat.tarik', { id: b.dataset.st }, function () { (one(S.sertifikat, 'ID_Sertifikat', b.dataset.st) || {}).Status = 'Ditarik'; }, 'Sertifikat ditarik.'); }); }; });
  var sg = $('#sg'); if (sg) sg.onclick = function () {
    var ids = []; document.querySelectorAll('[data-sp]').forEach(function (i) { if (i.checked) ids.push(i.dataset.sp); }); if (!ids.length) return toast('Centang peserta terlebih dahulu', 'err'); var c = $('#sc').value, paksa = false, tot = 0, gagal = [];
    var belum = ids.filter(function (id) { return sertInfo(c, id).pct < S.minSert; }).length; if (belum) { if (!window.confirm(belum + ' peserta belum mencapai ' + S.minSert + '% progres. Terbitkan tetap?')) return; paksa = true; }
    sg.disabled = true; var n = 0, step = function () { var part = ids.slice(n, n + 5); if (!part.length) { sg.disabled = false; toast(tot + ' sertifikat terbit' + (gagal.length ? '; gagal: ' + gagal.slice(0, 2).join('; ') : ''), gagal.length ? 'err' : ''); return boot(true); } toast('Membuat sertifikat ' + (n + 1) + '–' + (n + part.length) + ' dari ' + ids.length + '…');
      api('sertifikat.terbit', { cohort: c, users: part, paksa: paksa }).then(function (r) { if (!r.success) { sg.disabled = false; return toast(r.message, 'err'); } tot += r.data.terbit; r.data.gagal.forEach(function (g) { gagal.push(g.alasan); }); n += 5; step(); }); }; step(); };
}
function verifPage(kode) {
  return '<div class="login"><div class="card"><div class="logo" style="padding:0 0 8px">Verifikasi Sertifikat</div><p class="sub">Masukkan kode verifikasi yang tertera di sertifikat.</p><input id="vk" value="' + h(kode || '') + '" placeholder="Kode verifikasi" style="text-transform:uppercase"><div class="acts"><button class="btn" id="vb">Periksa</button></div><div id="vr" style="margin-top:12px"></div><p style="text-align:center;margin:10px 0 0"><a href="#/">← Kembali</a></p></div></div>';
}
function bindVerif(kode) {
  var go = function () { var k = $('#vk').value.trim(); if (!k) return; $('#vr').innerHTML = '<div class="sk"></div>'; api('verifikasi', { kode: k }).then(function (r) { var d = r.data || {}; $('#vr').innerHTML = !r.success ? '<div class="card" style="background:#fee2e2">' + h(r.message || 'Gagal memeriksa') + '</div>' : d.valid ? '<div class="card" style="background:#dcfce7"><b>✓ Sertifikat ASLI</b><br>' + h(d.nama) + '<br>' + h(d.program) + ' — ' + h(d.cohort) + '<br><small>' + h(d.nomor) + ' · ' + fd(d.tanggal) + '</small></div>' : '<div class="card" style="background:#fee2e2"><b>✕ ' + (d.ditarik ? 'Sertifikat telah ditarik' : 'Kode tidak ditemukan') + '</b></div>'; }); };
  $('#vb').onclick = go; $('#vk').onkeydown = function (e) { if (e.key === 'Enter') go(); }; if (kode) go();
}

// ---- Router & render (navigasi instan: semua data sudah di memori) ----
function nav() { var r = S.me.role, a = [['', 'Ringkasan']]; if (r === 'admin') a.push(['cohort', 'Cohort']); a.push(['jadwal', 'Jadwal']); if (r !== 'peserta') a.push(['hadir', 'Kehadiran']); if (r === 'admin') a.push(['pengguna', 'Pengguna'], ['kontak', 'Kontak'], ['notifikasi', 'Notifikasi']); if (r !== 'instruktur') a.push(['sertifikat', 'Sertifikat']); return a; }
function render() {
  var app = $('#app'), hp = location.hash.replace(/^#\/?/, '').split('/'); if (hp[0] === 'verifikasi') { app.innerHTML = verifPage(hp[1]); bindVerif(hp[1]); return; }
  if (!tok) { app.innerHTML = login(); bindLogin(); return; }
  if (!S) { app.innerHTML = '<div class="shell"><main><div class="sk"></div><div class="sk"></div><div class="sk"></div></main></div>'; return; }
  var p = location.hash.replace(/^#\/?/, '').split('/'), pg = p[0], arg = p[1], body = '', bind = function () { };
  if (pg === 'sesi') { body = sesiPage(arg); bind = function () { bindSesi(arg); }; }
  else if (pg === 'cohort' && S.me.role === 'admin') { body = cohortPage(); bind = bindCohort; }
  else if (pg === 'jadwal') { body = jadwal(); bind = function () { $('#fc').onchange = function (e) { selC = e.target.value; render(); }; var n = $('#ns'); if (n) n.onclick = function () { sesiForm(); }; document.querySelectorAll('[data-es]').forEach(function (b) { b.onclick = function () { sesiForm(one(S.sesi, 'ID_Sesi', b.dataset.es)); }; }); }; }
  else if (pg === 'hadir' && S.me.role !== 'peserta') { body = hadirPage(arg); bind = function () { bindHadir(arg); }; }
  else if (pg === 'pengguna' && S.me.role === 'admin') { body = userPage(); bind = bindUser; }
  else if (pg === 'kontak' && S.me.role === 'admin') { body = kontakPage(); bind = bindKontak; }
  else if (pg === 'notifikasi' && S.me.role === 'admin') { body = notifPage(); bind = bindNotif; }
  else if (pg === 'sertifikat') { body = sertPage(); bind = bindSert; }
  else { pg = ''; body = dash(); }
  app.innerHTML = '<div class="shell"><nav class="side"><div class="logo">RuangCohort</div>' + nav().map(function (n) { return '<a href="#/' + n[0] + '" class="' + (n[0] === pg || (pg === 'sesi' && n[0] === 'jadwal') ? 'on' : '') + '">' + n[1] + '</a>'; }).join('') + '<div class="me"><b>' + h(S.me.nama) + '</b><br>' + h(S.me.role) + '<br><a href="#" id="pw">Ganti sandi</a> · <a href="#" id="lo">Keluar</a></div></nav><main>' + body + '</main></div>';
  $('#lo').onclick = function (e) { e.preventDefault(); logout(); };
  $('#pw').onclick = function (e) { e.preventDefault(); form('Ganti kata sandi', [{ k: 'lama', l: 'Sandi lama', t: 'password', r: 1 }, { k: 'baru', l: 'Sandi baru (min. 8 karakter)', t: 'password', r: 1 }], {}, function (o) { api('sandi.ganti', o).then(function (r) { toast(r.message || 'Gagal', r.success ? '' : 'err'); }); }); };
  bind();
}
window.addEventListener('hashchange', function () { if (!tok || location.hash.indexOf('#/verifikasi') === 0) { render(); return; } if (tok && S) { render(); window.scrollTo(0, 0); boot(); } });
document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible' && tok) boot(); });
render(); if (tok) boot();
})();
