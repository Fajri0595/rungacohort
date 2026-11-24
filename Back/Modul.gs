/** RuangCohort v1.1 — Modul tambahan: Notifikasi WA (Fonnte)+Email, Kontak (CRM), Sertifikat PDF, Impor CSV/Spreadsheet.
 *  Aditif: hanya menambah sheet/kolom & rute. Token Fonnte hanya di Script Properties (tampil tersamar). */
const FONNTE_API = 'https://api.fonnte.com';
const NOTIF_EVENTS = {
  AKUN_DIBUAT: { label: 'Akun dibuat', wa: true, email: true, subjek: 'Akun {institusi} Anda', pesan: 'Halo {nama},\nAkun {institusi} Anda sudah dibuat.\nEmail login: {email}\nBuka: {link}\nSandi awal diberikan admin; segera ganti setelah masuk.' },
  SESI_BARU: { label: 'Sesi baru dijadwalkan', wa: true, email: true, subjek: 'Sesi baru: {judul}', pesan: 'Halo {nama},\nSesi baru: *{judul}* ({tipe})\n{tanggal} · {jam}\n{lokasi}\nDetail: {link}\n— {institusi}' },
  PENGINGAT_SESI: { label: 'Pengingat sesi (H-1)', wa: true, email: true, subjek: 'Besok: {judul}', pesan: 'Halo {nama},\nPengingat: besok ada sesi *{judul}* ({tipe}) pukul {jam}.\n{lokasi}\n{link}\n— {institusi}' },
  MATERI_BARU: { label: 'Materi baru ditambahkan', wa: false, email: true, subjek: 'Materi baru: {judul}', pesan: 'Halo {nama},\nMateri baru "{judul}" tersedia di sesi *{sesi}*.\n{link}\n— {institusi}' },
  SERTIFIKAT_TERBIT: { label: 'Sertifikat terbit', wa: true, email: true, subjek: 'Sertifikat Anda sudah terbit', pesan: 'Selamat {nama}! 🎉\nSertifikat *{program}* ({cohort}) sudah terbit.\nUnduh: {link}\nKode verifikasi: *{kode}*\n— {institusi}' }
};

// ===== Helper nomor & template =====
function hp08_(v) { let s = String(v == null ? '' : v).trim().replace(/\.0+$/, '').replace(/[^0-9+]/g, '').replace(/^\+/, ''); if (!s) return ''; if (s.indexOf('62') === 0) s = '0' + s.substring(2); else if (s.indexOf('8') === 0) s = '0' + s; return s; }
function hp62_(v) { const s = hp08_(v); return s ? (s[0] === '0' ? '62' + s.substring(1) : s) : ''; }
function hpValid_(v) { return /^08\d{8,12}$/.test(hp08_(v)); }
function emailValid_(e) { return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(e || '').trim()); }
function isi_(t, v) { return String(t || '').replace(/\{(\w+)\}/g, function (m, k) { return v[k] == null ? '' : String(v[k]); }); }
function samar_(v) { v = String(v || ''); return !v ? '' : v.length <= 8 ? '••••••' : v.slice(0, 4) + '••••••' + v.slice(-3); }
function waAktif_() { return prop_('NOTIF_WA') === 'YA' && !!prop_('FONNTE_TOKEN'); }
function emailAktif_() { return prop_('NOTIF_EMAIL') === 'YA'; }
function matriks_() {
  let s = {}; try { s = JSON.parse(prop_('NOTIF_MATRIKS') || '{}') || {}; } catch (e) { }
  const o = {}; Object.keys(NOTIF_EVENTS).forEach(function (k) { const d = NOTIF_EVENTS[k], x = s[k] || {}; o[k] = { kode: k, label: d.label, wa: x.wa !== undefined ? !!x.wa : d.wa, email: x.email !== undefined ? !!x.email : d.email }; }); return o;
}

// ===== Antrean notifikasi: aksi hanya menulis antrean, trigger 1 menit yang mengirim =====
function baris_(k, t, n, s, p, ev, b) { return { ID: uid_('N'), Kanal: k, Tujuan: t, Nama: n || '', Subjek: s || '', Pesan: p, Event: ev || '', BlastID: b || '', Status: 'Antri', Percobaan: '0', Respon: '', Dibuat: new Date().toISOString(), Dikirim: '' }; }
function antri_(rows) {
  lock_(function () { const sh = ss_().getSheetByName('AntrianNotif'), H = SCHEMA.AntrianNotif, r = sh.getLastRow() + 1; sh.getRange(r, 1, rows.length, H.length).setNumberFormat('@').setValues(rows.map(function (x) { return H.map(function (f) { return String(x[f] == null ? '' : x[f]); }); })); });
  setProps_({ ANTRIAN_ADA: '1' });
}
function kirimBatch_(event, list) { // list: [{nama,hp,email,vars}] — tidak pernah melempar error ke pemanggil
  try {
    const wa = waAktif_(), em = emailAktif_(), m = matriks_()[event]; if ((!wa && !em) || !m || (!m.wa && !m.email)) return 0;
    const base = { institusi: prop_('NAMA_INSTITUSI') || 'RuangCohort', link: prop_('APP_URL') }, tpl = NOTIF_EVENTS[event], rows = [];
    list.forEach(function (p) {
      const v = Object.assign({}, base, { nama: p.nama || 'Bapak/Ibu', email: p.email }, p.vars || {});
      if (wa && m.wa && hpValid_(p.hp)) rows.push(baris_('WA', hp62_(p.hp), p.nama, '', isi_(tpl.pesan, v), event));
      if (em && m.email && emailValid_(p.email)) rows.push(baris_('EMAIL', p.email, p.nama, isi_(tpl.subjek, v), isi_(tpl.pesan, v), event));
    });
    if (rows.length) antri_(rows); return rows.length;
  } catch (e) { console.error('kirimBatch_ (tidak fatal): ' + e.message); return 0; }
}
function notifCohort_(event, cohortId, vars) {
  const ids = {}; rd_('Cohort_Members').forEach(function (m) { if (m.ID_Cohort === cohortId) ids[m.ID_User] = 1; });
  kirimBatch_(event, rd_('Users').filter(function (u) { return ids[u.ID_User] && u.Status_Aktif !== 'Nonaktif'; }).map(function (u) { return { nama: u.Nama, hp: u.No_WA, email: u.Email, vars: vars }; }));
}
function fonnte_(path, payload) {
  const token = prop_('FONNTE_TOKEN'); if (!token) return { status: false, reason: 'Token Fonnte belum diisi.' };
  try { const r = UrlFetchApp.fetch(FONNTE_API + path, { method: 'post', headers: { Authorization: token }, payload: payload || {}, muteHttpExceptions: true }); try { return JSON.parse(r.getContentText()); } catch (e) { return { status: false, reason: r.getContentText().substring(0, 120) }; } }
  catch (e) { return { status: false, reason: 'Koneksi Fonnte gagal: ' + e.message }; }
}
function fonnteKirimBanyak_(pesan, jeda) { // 1 request per batch; bila ditolak → 1 request per pesan (paralel)
  if (!pesan.length) return [];
  const res = fonnte_('/send', { data: JSON.stringify(pesan.map(function (m) { return { target: m.target, message: m.message, delay: String(jeda || '5'), countryCode: '62' }; })) });
  if (res && res.status) return pesan.map(function () { return { ok: true, respon: 'OK' }; });
  const token = prop_('FONNTE_TOKEN');
  return UrlFetchApp.fetchAll(pesan.map(function (m) { return { url: FONNTE_API + '/send', method: 'post', headers: { Authorization: token }, payload: { target: m.target, message: m.message, countryCode: '62' }, muteHttpExceptions: true }; })).map(function (r) {
    try { const j = JSON.parse(r.getContentText()); return { ok: !!j.status, respon: j.status ? 'OK' : (j.reason || 'Ditolak') }; } catch (e) { return { ok: false, respon: 'HTTP ' + r.getResponseCode() }; }
  });
}
function prosesAntrian() { // target trigger tiap 1 menit; keluar cepat bila antrean kosong
  if (prop_('ANTRIAN_ADA') !== '1') return;
  const l = LockService.getScriptLock(); if (!l.tryLock(8000)) return;
  try {
    const sh = ss_().getSheetByName('AntrianNotif'), H = SCHEMA.AntrianNotif, last = sh.getLastRow();
    if (last < 2) { setProps_({ ANTRIAN_ADA: '0' }); return; }
    const v = sh.getRange(2, 1, last - 1, H.length).getValues(), I = {}; H.forEach(function (f, i) { I[f] = i; });
    const batch = Number(prop_('WA_BATCH')) || 20, jeda = prop_('WA_JEDA') || '5', kuota = Math.max(0, Math.min(40, MailApp.getRemainingDailyQuota() - 2)), wa = [], em = [];
    for (let i = 0; i < v.length; i++) { if (v[i][I.Status] !== 'Antri') continue; if (v[i][I.Kanal] === 'WA') { if (wa.length < batch) wa.push(i); } else if (em.length < kuota) em.push(i); }
    const now = new Date().toISOString(), tandai = function (i, ok, res) { const r = v[i]; r[I.Percobaan] = String(Number(r[I.Percobaan] || 0) + 1); r[I.Respon] = String(res || '').slice(0, 100); if (ok) { r[I.Status] = 'Terkirim'; r[I.Dikirim] = now; } else if (Number(r[I.Percobaan]) >= 3) r[I.Status] = 'Gagal'; };
    if (wa.length) { const res = fonnteKirimBanyak_(wa.map(function (i) { return { target: v[i][I.Tujuan], message: v[i][I.Pesan] }; }), jeda); wa.forEach(function (i, k) { tandai(i, res[k] && res[k].ok, res[k] && res[k].respon); }); }
    em.forEach(function (i) { try { MailApp.sendEmail({ to: v[i][I.Tujuan], subject: v[i][I.Subjek], body: v[i][I.Pesan], name: prop_('NAMA_INSTITUSI') || 'RuangCohort' }); tandai(i, true, 'OK'); } catch (e) { tandai(i, false, e.message); } });
    const t = wa.concat(em); if (t.length) { const a = Math.min.apply(null, t), b = Math.max.apply(null, t); sh.getRange(a + 2, 1, b - a + 1, H.length).setNumberFormat('@').setValues(v.slice(a, b + 1)); }
    if (!v.some(function (r) { return r[I.Status] === 'Antri'; })) setProps_({ ANTRIAN_ADA: '0' });
  } finally { l.releaseLock(); }
}
function bersihkanAntrian_() { // dipanggil harian: buang yang selesai > 30 hari
  const batas = Date.now() - 30 * 864e5, rows = rd_('AntrianNotif', true), sisa = rows.filter(function (r) { return r.Status === 'Antri' || new Date(r.Dibuat).getTime() > batas; });
  if (sisa.length !== rows.length) lock_(function () { wAll_('AntrianNotif', sisa); }); bump_('AntrianNotif');
}

// ===== Konfigurasi, tes, deteksi WA, blast =====
function cfg_() {
  const a = rd_('AntrianNotif', true), n = { Antri: 0, Terkirim: 0, Gagal: 0 }; a.forEach(function (r) { if (n[r.Status] !== undefined) n[r.Status]++; });
  return { waAktif: prop_('NOTIF_WA') === 'YA', emailAktif: emailAktif_(), tokenAda: !!prop_('FONNTE_TOKEN'), token: samar_(prop_('FONNTE_TOKEN')), batch: Number(prop_('WA_BATCH')) || 20, jeda: prop_('WA_JEDA') || '5', appUrl: prop_('APP_URL'), institusi: prop_('NAMA_INSTITUSI') || 'RuangCohort', minSert: Number(prop_('SERT_MIN')) || 80, templateId: prop_('SERT_TEMPLATE_ID'), matriks: matriks_(), antri: n, sisaEmail: MailApp.getRemainingDailyQuota() };
}
function notifSimpan_(me, d) {
  const x = d || {}, set = {};
  if (x.token === '__HAPUS__') { PROPS.deleteProperty('FONNTE_TOKEN'); _M = null; set.NOTIF_WA = 'TIDAK'; }
  else if (x.token) { if (String(x.token).length > 200) return no_('Token terlalu panjang.'); set.FONNTE_TOKEN = String(x.token).trim(); }
  if (x.waAktif && !(set.FONNTE_TOKEN || prop_('FONNTE_TOKEN'))) return no_('Isi token Fonnte sebelum mengaktifkan WhatsApp.');
  if (x.waAktif !== undefined && x.token !== '__HAPUS__') set.NOTIF_WA = x.waAktif ? 'YA' : 'TIDAK';
  if (x.emailAktif !== undefined) set.NOTIF_EMAIL = x.emailAktif ? 'YA' : 'TIDAK';
  if (x.batch !== undefined) { if ([10, 20, 50].indexOf(Number(x.batch)) < 0) return no_('Ukuran batch harus 10, 20, atau 50.'); set.WA_BATCH = String(x.batch); }
  if (x.jeda !== undefined) { if (!/^\d{1,3}(-\d{1,3})?$/.test(String(x.jeda))) return no_('Jeda harus berupa detik, mis. 5 atau 3-8.'); set.WA_JEDA = String(x.jeda); }
  if (x.appUrl !== undefined) { if (x.appUrl && !/^https?:\/\/\S+$/.test(x.appUrl)) return no_('Alamat aplikasi harus diawali https://'); set.APP_URL = String(x.appUrl).replace(/[#?].*$/, '').replace(/\/+$/, ''); }
  if (x.institusi !== undefined) set.NAMA_INSTITUSI = String(x.institusi).slice(0, 60);
  if (x.minSert !== undefined) { const n = Number(x.minSert); if (!(n >= 1 && n <= 100)) return no_('Minimal progres sertifikat 1–100.'); set.SERT_MIN = String(Math.round(n)); }
  if (x.templateId !== undefined) {
    const m = String(x.templateId).match(/\/d\/([\w-]{20,})/), id = m ? m[1] : String(x.templateId).trim();
    if (id) { try { if (DriveApp.getFileById(id).getMimeType() !== 'application/vnd.google-apps.presentation') return no_('Template harus berupa Google Slides.'); } catch (e) { return no_('Template tidak bisa dibuka. Pastikan akun Anda punya akses.'); } }
    set.SERT_TEMPLATE_ID = id;
  }
  if (x.matriks) { const s = {}, m = matriks_(); Object.keys(m).forEach(function (k) { if (x.matriks[k]) s[k] = { wa: !!x.matriks[k].wa, email: !!x.matriks[k].email }; else s[k] = { wa: m[k].wa, email: m[k].email }; }); set.NOTIF_MATRIKS = JSON.stringify(s); }
  if (Object.keys(set).length) setProps_(set); return ok_(cfg_(), 'Pengaturan tersimpan.');
}
function wAll_(n, rows) { // tulis ulang isi tabel TANPA lock (pemanggil memegang lock)
  const sh = ss_().getSheetByName(n), H = SCHEMA[n], last = sh.getLastRow();
  if (last > 1) sh.getRange(2, 1, last - 1, H.length).clearContent();
  if (rows.length) sh.getRange(2, 1, rows.length, H.length).setNumberFormat('@').setValues(rows.map(function (r) { return H.map(function (f) { return String(r[f] == null ? '' : r[f]); }); }));
}
function waValidate_(me, d) {
  const us = rd_('Users', true), ids = (d.ids || []).slice(0, 50), peta = {};
  ids.forEach(function (id) { const u = us.filter(function (x) { return x.ID_User === id; })[0]; if (u && hpValid_(u.No_WA)) peta[hp62_(u.No_WA)] = id; });
  const nomor = Object.keys(peta); if (!nomor.length) return no_('Tidak ada nomor WA valid pada pilihan.');
  const r = fonnte_('/validate', { target: nomor.join(','), countryCode: '62' }); if (!r || !r.status) return no_((r && r.reason) || 'Fitur deteksi tidak tersedia di paket Fonnte Anda.');
  const reg = [].concat(r.registered || []).map(hp62_), hasil = {}; nomor.forEach(function (n) { hasil[peta[n]] = reg.indexOf(n) >= 0 ? 'Terdaftar' : 'Tidak Terdaftar'; });
  lock_(function () { const baru = rd_('Users', true); baru.forEach(function (u) { if (hasil[u.ID_User]) u.StatusWA = hasil[u.ID_User]; }); wAll_('Users', baru); }); bump_('Users');
  return ok_(hasil, nomor.length + ' nomor dicek.');
}
function waBlast_(me, d) {
  if (!waAktif_()) return no_('Aktifkan WhatsApp dan isi token Fonnte terlebih dahulu.');
  const pesan = String(d.pesan || '').trim(); if (pesan.length < 5 || pesan.length > 1000) return no_('Pesan 5–1000 karakter.');
  let ids = null; if (d.cohort && d.cohort !== '*') { ids = {}; rd_('Cohort_Members').forEach(function (m) { if (m.ID_Cohort === d.cohort) ids[m.ID_User] = 1; }); }
  const seen = {}, rows = [], bid = uid_('B'), skip = { optout: 0, invalid: 0, ganda: 0 }, base = { institusi: prop_('NAMA_INSTITUSI') || 'RuangCohort', link: prop_('APP_URL') };
  rd_('Users').forEach(function (u) {
    if ((ids && !ids[u.ID_User]) || u.Status_Aktif === 'Nonaktif') return;
    if (u.OptOut === 'YA') { skip.optout++; return; } if (!hpValid_(u.No_WA)) { skip.invalid++; return; }
    const t = hp62_(u.No_WA); if (seen[t]) { skip.ganda++; return; } seen[t] = 1;
    rows.push(baris_('WA', t, u.Nama, '', isi_(pesan, Object.assign({}, base, { nama: u.Nama })), 'BLAST', bid));
  });
  if (!rows.length) return no_('Tidak ada penerima valid (dilewati: ' + JSON.stringify(skip) + ').');
  antri_(rows); return ok_({ blast: bid, total: rows.length, dilewati: skip }, rows.length + ' pesan masuk antrean.');
}

// ===== Impor CSV / spreadsheet lama (aman diulang: upsert by email, dry-run, 1× tulis) =====
function bacaSumber_(s) {
  const m = String(s).match(/\/d\/([\w-]{20,})/), id = m ? m[1] : String(s).trim();
  if (id === prop_('SPREADSHEET_ID')) throw new Error('Itu spreadsheet database aplikasi ini. Tempel spreadsheet SUMBER.');
  let sh; try { sh = SpreadsheetApp.openById(id).getSheets()[0]; } catch (e) { throw new Error('Spreadsheet tidak bisa dibuka. Pastikan akun Anda punya akses.'); }
  const v = sh.getDataRange().getValues(); if (v.length < 2) return [];
  const H = v[0].map(function (x) { return String(x).trim().toLowerCase().replace(/[\s_]+/g, ''); }), al = { nama: ['nama', 'namalengkap'], email: ['email', 'surel'], wa: ['wa', 'nowa', 'whatsapp', 'nohp', 'hp', 'telepon'], role: ['role', 'peran'], cohort: ['cohort', 'angkatan', 'batch', 'kelas'] }, col = {};
  Object.keys(al).forEach(function (k) { col[k] = H.findIndex(function (h) { return al[k].indexOf(h) >= 0; }); });
  return v.slice(1).filter(function (r) { return r.join('') !== ''; }).map(function (r) { const o = {}; Object.keys(col).forEach(function (k) { if (col[k] >= 0) o[k] = String(r[col[k]]); }); return o; });
}
function impor_(me, d) {
  const rows = d.sumber ? bacaSumber_(d.sumber) : (d.rows || []); if (rows.length > 500) return no_('Maksimal 500 baris per impor (pecah file Anda).');
  const lap = { total: rows.length, ditambah: 0, diperbarui: 0, dilewati: 0, anggota: 0, peringatan: [] }, sandi = [], tgl = new Date().toISOString().slice(0, 10);
  const kerja = function () {
    const us = rd_('Users', true), idx = {}, cs = rd_('Cohorts', true), mem = rd_('Cohort_Members', true), seen = {}; us.forEach(function (u) { idx[u.Email] = u; });
    rows.forEach(function (r, n) {
      const em = String(r.email || '').trim().toLowerCase(), b = 'Baris ' + (n + 2) + ': ';
      if (!emailValid_(em)) { lap.dilewati++; lap.peringatan.push(b + 'email tidak valid'); return; }
      if (seen[em]) { lap.dilewati++; lap.peringatan.push(b + 'email ganda di sumber (' + em + ')'); return; } seen[em] = 1;
      const wa = hp08_(r.wa); if (r.wa && !hpValid_(wa)) lap.peringatan.push(b + 'nomor WA tidak valid, dikosongkan');
      const nama = String(r.nama || '').trim() || em.split('@')[0]; let role = String(r.role || 'peserta').toLowerCase();
      if (['peserta', 'instruktur'].indexOf(role) < 0) { if (r.role) lap.peringatan.push(b + 'peran "' + r.role + '" dijadikan peserta (admin tidak bisa diimpor)'); role = 'peserta'; }
      let u = idx[em];
      if (!u) { const pw = acak_(10); u = { ID_User: uid_('U'), Nama: nama, Email: em, Password_Hash: d.dry ? '' : mkHash_(pw), Role: role, Status_Aktif: 'Aktif', Tanggal_Daftar: tgl, No_WA: hpValid_(wa) ? wa : '', OptOut: 'TIDAK', StatusWA: '' }; us.push(u); idx[em] = u; lap.ditambah++; sandi.push({ email: em, sandi: pw }); }
      else { let ch = false; if (nama && u.Nama !== nama && r.nama) { u.Nama = nama; ch = true; } if (hpValid_(wa) && u.No_WA !== wa) { u.No_WA = wa; u.StatusWA = ''; ch = true; } ch ? lap.diperbarui++ : lap.dilewati++; } // peran/status/sandi tidak pernah ditimpa
      if (r.cohort) { const c = cs.filter(function (x) { return x.Nama_Cohort.toLowerCase() === String(r.cohort).trim().toLowerCase(); })[0];
        if (!c) lap.peringatan.push(b + 'cohort "' + r.cohort + '" tidak ditemukan'); else if (!mem.some(function (m) { return m.ID_Cohort === c.ID_Cohort && m.ID_User === u.ID_User; })) { mem.push({ ID: uid_('A'), ID_Cohort: c.ID_Cohort, ID_User: u.ID_User, Peran_di_Cohort: u.Role === 'instruktur' ? 'Instruktur' : 'Peserta', Tanggal_Gabung: tgl }); lap.anggota++; } }
    });
    if (!d.dry) { wAll_('Users', us); wAll_('Cohort_Members', mem); }
  };
  if (d.dry) kerja(); else { lock_(kerja); bump_('Users'); bump_('Cohort_Members'); }
  lap.peringatan = lap.peringatan.slice(0, 30); lap.dry = !!d.dry;
  return ok_({ lap: lap, sandi: d.dry ? [] : sandi }, d.dry ? 'Pindai selesai (belum ada data yang ditulis).' : 'Impor selesai.');
}

// ===== Sertifikat PDF (Google Slides → salinan → PDF; master tidak pernah disentuh) =====
function templateSert_() {
  let id = prop_('SERT_TEMPLATE_ID'); if (id) { try { DriveApp.getFileById(id); return id; } catch (e) { } }
  const p = SlidesApp.create('Template Sertifikat RuangCohort'), s = p.getSlides()[0];
  s.getPageElements().forEach(function (e) { e.remove(); }); s.getBackground().setSolidFill('#f8f9ff');
  const W = 720, tb = function (t, y, h, sz, bold, warna) { const x = s.insertTextBox(t, 40, y, W - 80, h), st = x.getText(); st.getParagraphStyle().setParagraphAlignment(SlidesApp.ParagraphAlignment.CENTER); st.getTextStyle().setFontSize(sz).setBold(bold).setForegroundColor(warna); return x; };
  const fr = s.insertShape(SlidesApp.ShapeType.RECTANGLE, 14, 14, W - 28, 377); fr.getFill().setTransparent(); fr.getBorder().getLineFill().setSolidFill('#2563eb'); fr.getBorder().setWeight(5);
  tb('SERTIFIKAT', 50, 50, 40, true, '#004ac6'); tb('Diberikan kepada', 112, 24, 15, false, '#434655'); tb('{{NAMA}}', 140, 56, 34, true, '#0b1c30');
  tb('telah menyelesaikan program {{PROGRAM}}\n{{COHORT}}', 205, 60, 17, false, '#0b1c30'); tb('Nomor {{NOMOR}} · {{TANGGAL}}', 300, 24, 12, false, '#434655');
  tb('Kode verifikasi: {{KODE_VERIFIKASI}}\n{{URL_VERIFIKASI}}', 330, 40, 11, false, '#434655');
  p.saveAndClose(); id = p.getId(); DriveApp.getFileById(id).moveTo(DriveApp.getFolderById(prop_('ROOT_FOLDER_ID'))); setProps_({ SERT_TEMPLATE_ID: id }); return id;
}
function renderSert_(tplId, v, folder, nama) {
  const salin = DriveApp.getFileById(tplId).makeCopy('tmp ' + v.NOMOR, folder);
  try { const p = SlidesApp.openById(salin.getId()); Object.keys(v).forEach(function (k) { p.replaceAllText('{{' + k + '}}', String(v[k])); }); p.saveAndClose(); return folder.createFile(DriveApp.getFileById(salin.getId()).getAs('application/pdf').setName(nama + '.pdf')).getId(); }
  finally { salin.setTrashed(true); }
}
function bulanId_(t) { return new Date(t + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }); }
function sertTerbit_(me, d) {
  const c = rd_('Cohorts').filter(function (x) { return x.ID_Cohort === d.cohort; })[0]; if (!c) return no_('Cohort tidak ditemukan.');
  const min = Number(prop_('SERT_MIN')) || 80, sesi = rd_('Sesi_Kelas').filter(function (s) { return s.ID_Cohort === c.ID_Cohort; }); if (!sesi.length) return no_('Cohort belum punya sesi.');
  const prog = rd_('Progres', true), ada = rd_('Sertifikat', true), us = rd_('Users'), mem = rd_('Cohort_Members').filter(function (m) { return m.ID_Cohort === c.ID_Cohort && m.Peran_di_Cohort === 'Peserta'; });
  const tpl = templateSert_(), folder = folder_(folder_(DriveApp.getFolderById(prop_('ROOT_FOLDER_ID')), c.ID_Cohort), 'Sertifikat'), terbit = [], gagal = [];
  (d.users || []).slice(0, 5).forEach(function (id) {
    const u = us.filter(function (x) { return x.ID_User === id; })[0];
    if (!u || !mem.some(function (m) { return m.ID_User === id; })) return gagal.push({ id: id, alasan: 'Bukan peserta cohort ini' });
    if (ada.some(function (s) { return s.ID_Cohort === c.ID_Cohort && s.ID_User === id && s.Status === 'Terbit'; })) return gagal.push({ id: id, alasan: 'Sudah diterbitkan' });
    const done = prog.filter(function (p) { return p.ID_User === id && p.Status === 'Sudah' && sesi.some(function (s) { return s.ID_Sesi === p.ID_Sesi; }); }).length, pct = Math.round(done * 100 / sesi.length);
    if (pct < min && !d.paksa) return gagal.push({ id: id, alasan: u.Nama + ': progres ' + pct + '% (minimal ' + min + '%)' });
    try {
      const th = new Date().getFullYear(); let urut = 0; lock_(function () { urut = Number(prop_('SERT_URUT_' + th) || 0) + 1; setProps_({ ['SERT_URUT_' + th]: String(urut) }); });
      const nomor = 'RC/' + th + '/' + ('0000' + urut).slice(-4), kode = acak_(10).toUpperCase(), tgl = new Date().toISOString().slice(0, 10), url = (prop_('APP_URL') || '') + '/#/verifikasi/' + kode;
      const f = renderSert_(tpl, { NAMA: u.Nama, PROGRAM: c.Program || c.Nama_Cohort, COHORT: c.Nama_Cohort, NOMOR: nomor, TANGGAL: bulanId_(tgl), KODE_VERIFIKASI: kode, URL_VERIFIKASI: url }, folder, 'Sertifikat ' + u.Nama);
      put_('Sertifikat', { ID_Sertifikat: uid_('K'), Nomor: nomor, ID_Cohort: c.ID_Cohort, ID_User: id, Nama: u.Nama, Kode_Verifikasi: kode, Status: 'Terbit', ID_File_Drive: f, Diterbitkan: tgl, Oleh: me.id });
      kirimBatch_('SERTIFIKAT_TERBIT', [{ nama: u.Nama, hp: u.No_WA, email: u.Email, vars: { program: c.Program || c.Nama_Cohort, cohort: c.Nama_Cohort, kode: kode } }]); terbit.push(id);
    } catch (e) { gagal.push({ id: id, alasan: u.Nama + ': gagal membuat PDF (' + e.message + ')' }); }
  });
  return ok_({ terbit: terbit.length, gagal: gagal }, terbit.length + ' sertifikat terbit.');
}
function sertAkses_(me, id) {
  const s = rd_('Sertifikat').filter(function (x) { return x.ID_Sertifikat === id; })[0]; if (!s) return null;
  return (me.role === 'admin' || (s.ID_User === me.id && s.Status === 'Terbit') || (me.role === 'instruktur' && mine_(me).indexOf(s.ID_Cohort) >= 0)) ? s : null;
}
function verifikasi_(d) {
  const k = String(d.kode || '').trim().toUpperCase(), s = /^[A-Z0-9]{6,12}$/.test(k) ? rd_('Sertifikat', true).filter(function (x) { return x.Kode_Verifikasi === k; })[0] : null;
  if (!s) return ok_({ valid: false }); const c = rd_('Cohorts').filter(function (x) { return x.ID_Cohort === s.ID_Cohort; })[0] || {};
  return ok_({ valid: s.Status === 'Terbit', ditarik: s.Status !== 'Terbit', nama: s.Nama, nomor: s.Nomor, program: c.Program || c.Nama_Cohort || '', cohort: c.Nama_Cohort || '', tanggal: s.Diterbitkan });
}

// ===== Rute tambahan (dibaca oleh route_ di Kode.gs) =====
function rutePlus_() {
  const A = ['admin'];
  return {
    'notif.baca': { roles: A, fn: function () { return ok_(cfg_()); } },
    'notif.simpan': { roles: A, w: 1, fn: notifSimpan_ },
    'notif.perangkat': { roles: A, fn: function () { const r = fonnte_('/device'); return r && r.status !== false ? ok_({ device: r.device, status: r.device_status, paket: r.package, kuota: r.quota }) : no_((r && r.reason) || 'Perangkat tidak terbaca.'); } },
    'notif.tes': { roles: A, w: 1, fn: function (me, d) {
      if (d.kanal === 'email') { if (!emailValid_(d.tujuan)) return no_('Email tidak valid.'); MailApp.sendEmail(d.tujuan, 'Tes notifikasi RuangCohort', 'Email tes berhasil.'); return ok_(null, 'Email tes terkirim.'); }
      if (!prop_('FONNTE_TOKEN')) return no_('Token Fonnte belum diisi.'); if (!hpValid_(d.tujuan)) return no_('Nomor WA tidak valid.');
      const r = fonnteKirimBanyak_([{ target: hp62_(d.tujuan), message: 'Tes notifikasi RuangCohort ✅' }], '1')[0]; return r.ok ? ok_(null, 'WA tes terkirim.') : no_(r.respon);
    } },
    'wa.validate': { roles: A, w: 1, fn: waValidate_ },
    'wa.blast': { roles: A, w: 1, fn: waBlast_ },
    'kontak.impor': { roles: A, w: 1, fn: impor_ },
    'sertifikat.terbit': { roles: A, w: 1, fn: sertTerbit_ },
    'sertifikat.tarik': { roles: A, w: 1, fn: function (me, d) { const s = rd_('Sertifikat', true).filter(function (x) { return x.ID_Sertifikat === d.id; })[0]; if (!s) return no_('Tidak ditemukan.'); s.Status = 'Ditarik'; put_('Sertifikat', s); return ok_(null, 'Sertifikat ditarik.'); } },
    'sertifikat.unduh': { roles: ['admin', 'instruktur', 'peserta'], fn: function (me, d) { const s = sertAkses_(me, d.id); if (!s || !s.ID_File_Drive) return no_('Sertifikat tidak tersedia.'); const f = DriveApp.getFileById(s.ID_File_Drive); return ok_({ nama: f.getName(), mime: 'application/pdf', b64: Utilities.base64Encode(f.getBlob().getBytes()) }); } }
  };
}
