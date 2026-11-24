/** RuangCohort v1.1 — Backend REST API (Google Apps Script). Rahasia hanya di Script Properties. */
const VER = '1.1.0', SESI_JAM = 12, PROPS = PropertiesService.getScriptProperties();
let _M = null, _SS = null;
function prop_(k) { if (!_M) _M = PROPS.getProperties(); return _M[k] || ''; }
function setProps_(o) { PROPS.setProperties(o); _M = null; }
function ss_() { return _SS || (_SS = SpreadsheetApp.openById(prop_('SPREADSHEET_ID'))); }

const SCHEMA = {
  Users: ['ID_User', 'Nama', 'Email', 'Password_Hash', 'Role', 'Status_Aktif', 'Tanggal_Daftar', 'No_WA', 'OptOut', 'StatusWA'],
  Cohorts: ['ID_Cohort', 'Nama_Cohort', 'Program', 'Tanggal_Mulai', 'Tanggal_Selesai', 'Status', 'Deskripsi'],
  Cohort_Members: ['ID', 'ID_Cohort', 'ID_User', 'Peran_di_Cohort', 'Tanggal_Gabung'],
  Modul: ['ID_Modul', 'ID_Cohort', 'Urutan', 'Judul', 'Deskripsi', 'Status_Publikasi'],
  Sesi_Kelas: ['ID_Sesi', 'ID_Modul', 'ID_Cohort', 'Judul_Sesi', 'Tipe', 'Tanggal', 'Jam_Mulai', 'Jam_Selesai', 'Lokasi_atau_Link_Meeting', 'ID_Instruktur', 'Catatan'],
  Materi: ['ID_Materi', 'ID_Sesi', 'Jenis', 'Judul', 'URL_YouTube', 'ID_File_Drive', 'Diunggah_Oleh', 'Tanggal_Unggah'],
  Progres: ['ID', 'ID_User', 'ID_Sesi', 'Status', 'Kehadiran', 'Tanggal_Update'],
  Log_Aktivitas: ['Timestamp', 'ID_User', 'Aksi', 'Detail'],
  AntrianNotif: ['ID', 'Kanal', 'Tujuan', 'Nama', 'Subjek', 'Pesan', 'Event', 'BlastID', 'Status', 'Percobaan', 'Respon', 'Dibuat', 'Dikirim'],
  Sertifikat: ['ID_Sertifikat', 'Nomor', 'ID_Cohort', 'ID_User', 'Nama', 'Kode_Verifikasi', 'Status', 'ID_File_Drive', 'Diterbitkan', 'Oleh']
};

// ===== SETUP (aman dijalankan ulang: tidak menimpa data/rahasia, hanya menambah kolom yang kurang) =====
function setupAppEnvironment() {
  const ss = prop_('SPREADSHEET_ID') ? ss_() : SpreadsheetApp.create('🗃️ Database — RuangCohort');
  let root;
  if (prop_('ROOT_FOLDER_ID')) root = DriveApp.getFolderById(prop_('ROOT_FOLDER_ID'));
  else { root = DriveApp.createFolder('📁 RuangCohort'); DriveApp.getFileById(ss.getId()).moveTo(root); }
  setProps_({ SPREADSHEET_ID: ss.getId(), ROOT_FOLDER_ID: root.getId() }); _SS = null;
  Object.keys(SCHEMA).forEach(function (n) {
    const sh = ss.getSheetByName(n) || ss.insertSheet(n);
    const have = sh.getLastColumn() ? sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0] : [];
    SCHEMA[n].forEach(function (f) { if (have.indexOf(f) < 0) { sh.getRange(1, have.length + 1).setValue(f); have.push(f); } });
    sh.setFrozenRows(1); sh.getRange(1, 1, 1, have.length).setFontWeight('bold').setBackground('#2563eb').setFontColor('#fff');
    if (sh.getMaxRows() > 1) sh.getRange(2, 1, sh.getMaxRows() - 1, have.length).setNumberFormat('@');
  });
  const d = ss.getSheetByName('Sheet1'); if (d && ss.getSheets().length > 1) ss.deleteSheet(d);
  if (!prop_('SESSION_SECRET')) setProps_({ SESSION_SECRET: acak_(64) });
  if (ss.getSheetByName('Users').getLastRow() < 2) {
    const pw = acak_(12), em = (Session.getEffectiveUser().getEmail() || 'admin@ruangcohort.local').toLowerCase();
    put_('Users', { ID_User: uid_('U'), Nama: 'Admin', Email: em, Password_Hash: mkHash_(pw), Role: 'admin', Status_Aktif: 'Aktif', Tanggal_Daftar: new Date().toISOString().slice(0, 10) });
    Logger.log('🔐 LOGIN ADMIN AWAL (hanya tampil sekali, segera ganti sandi)\n   Email : ' + em + '\n   Sandi : ' + pw);
  }
  ScriptApp.getProjectTriggers().forEach(function (t) { ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('kirimPengingat').timeBased().everyDays(1).atHour(17).create();
  ScriptApp.newTrigger('prosesAntrian').timeBased().everyMinutes(1).create();
  ScriptApp.newTrigger('keepWarm').timeBased().everyMinutes(10).create();
  Logger.log('✅ Setup selesai. Spreadsheet: ' + ss.getUrl());
}
function resetSandiAdmin() { // jalankan manual bila sandi admin hilang
  const us = rd_('Users', true).filter(function (u) { return u.Role === 'admin'; })[0], pw = acak_(12);
  us.Password_Hash = mkHash_(pw); put_('Users', us); revoke_(us.Email); Logger.log('🔐 Sandi baru ' + us.Email + ' : ' + pw);
}
function matikanKeepWarm() { setProps_({ KEEP_WARM: 'off' }); }
function nyalakanKeepWarm() { setProps_({ KEEP_WARM: 'on' }); }

// ===== KEAMANAN =====
function acak_(n) {
  const c = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'; let s = '';
  while (s.length < n) Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, Utilities.getUuid()).forEach(function (b) { if (s.length < n) s += c[(b & 255) % c.length]; });
  return /\d/.test(s) && /[A-Za-z]/.test(s) ? s : acak_(n);
}
function uid_(p) { return p + Utilities.getUuid().replace(/-/g, '').slice(0, 10); }
function hash_(p, salt) { let h = String(p); for (let i = 0; i < 150; i++) h = Utilities.base64Encode(Utilities.computeHmacSha256Signature(h + salt, salt)); return h; }
function mkHash_(p) { const s = Utilities.getUuid(); return s + '$' + hash_(p, s); }
function same_(a, b) { a = String(a); b = String(b); if (a.length !== b.length) return false; let r = 0; for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i); return r === 0; }
function okPw_(p, st) { const x = String(st).split('$'); return x.length === 2 && same_(hash_(p, x[0]), x[1]); }
function hmac_(s) { return Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(s, prop_('SESSION_SECRET'))).replace(/=+$/, ''); }
function sign_(p) { const b = Utilities.base64EncodeWebSafe(JSON.stringify(p)).replace(/=+$/, ''); return b + '.' + hmac_(b); }
function revoke_(em) { const t = String(Date.now()); CacheService.getScriptCache().put('rev_' + em, t, 21600); setProps_({ ['REV_' + em]: t }); }
function auth_(t) {
  try {
    const x = String(t || '').split('.'); if (x.length !== 2 || !same_(hmac_(x[0]), x[1])) return null;
    let b = x[0]; while (b.length % 4) b += '=';
    const p = JSON.parse(Utilities.newBlob(Utilities.base64DecodeWebSafe(b)).getDataAsString());
    if (p.x < Date.now() || p.i < Number(CacheService.getScriptCache().get('rev_' + p.e) || prop_('REV_' + p.e) || 0)) return null;
    const u = rd_('Users').filter(function (r) { return r.Email === p.e && r.Status_Aktif !== 'Nonaktif'; })[0];
    return u ? { id: u.ID_User, email: u.Email, nama: u.Nama, role: u.Role } : null;
  } catch (e) { return null; }
}
function login_(d) {
  const c = CacheService.getScriptCache(), em = String(d.email || '').trim().toLowerCase(), n = Number(c.get('lf_' + em) || 0);
  if (n >= 5) return { success: false, message: 'Terlalu banyak percobaan. Coba lagi 15 menit lagi.' };
  const u = rd_('Users', true).filter(function (r) { return r.Email === em && r.Status_Aktif !== 'Nonaktif'; })[0];
  if (!u || !okPw_(d.password || '', u.Password_Hash)) { c.put('lf_' + em, String(n + 1), 900); Utilities.sleep(500); return { success: false, message: 'Email atau kata sandi salah.' }; }
  c.remove('lf_' + em); const now = Date.now();
  return { success: true, data: { token: sign_({ e: em, i: now, x: now + SESI_JAM * 3600e3 }) } };
}

// ===== DATABASE (baca ber-cache berversi, tulis pendek ber-lock) =====
function rd_(n, fresh) {
  const c = CacheService.getScriptCache(), k = 't_' + n + '_' + (c.get('v_' + n) || '0');
  if (!fresh) { const h = c.get(k); if (h) return JSON.parse(h); }
  const v = ss_().getSheetByName(n).getDataRange().getValues(), H = v[0];
  const r = v.slice(1).filter(function (x) { return x[0] !== ''; }).map(function (x) { const o = {}; H.forEach(function (f, i) { o[f] = x[i] instanceof Date ? x[i].toISOString().slice(0, 10) : String(x[i]); }); return o; });
  try { c.put(k, JSON.stringify(r), 900); } catch (e) { }
  return r;
}
function bump_(n) { CacheService.getScriptCache().put('v_' + n, Date.now() + Math.random().toString(36).slice(2, 7), 21600); } // versi unik: tulis beruntun dalam 1 ms tidak menyisakan cache basi
function lock_(f) { const l = LockService.getScriptLock(); l.waitLock(15000); try { return f(); } finally { l.releaseLock(); } }
function put_(n, rec) {
  lock_(function () {
    const sh = ss_().getSheetByName(n), v = sh.getDataRange().getValues(), H = v[0]; let r = -1;
    for (let i = 1; i < v.length; i++) if (String(v[i][0]) === String(rec[H[0]])) { r = i; break; }
    const row = H.map(function (f, i) { return rec[f] !== undefined ? String(rec[f]) : (r >= 0 ? v[r][i] : ''); });
    sh.getRange(r >= 0 ? r + 1 : v.length + 1, 1, 1, H.length).setNumberFormat('@').setValues([row]);
  }); bump_(n);
}
function del_(n, id) {
  lock_(function () { const sh = ss_().getSheetByName(n), v = sh.getDataRange().getValues(); for (let i = 1; i < v.length; i++) if (String(v[i][0]) === String(id)) { sh.deleteRow(i + 1); break; } }); bump_(n);
}
function setAll_(n, rows) { lock_(function () { wAll_(n, rows); }); bump_(n); } // wAll_ ada di Modul.gs
function log_(me, a, d) { try { ss_().getSheetByName('Log_Aktivitas').appendRow([new Date().toISOString(), me.id, a, String(d || '').slice(0, 200)]); } catch (e) { } }

// ===== AKSES & ROUTER =====
function mine_(me) { return me.role === 'admin' ? rd_('Cohorts').map(function (c) { return c.ID_Cohort; }) : rd_('Cohort_Members').filter(function (m) { return m.ID_User === me.id; }).map(function (m) { return m.ID_Cohort; }); }
function ok_(d, m) { return { success: true, data: d, message: m }; }
function no_(m) { return { success: false, message: m }; }
const TB = {
  cohort: { s: 'Cohorts', k: 'ID_Cohort', p: 'C', r: ['admin'] },
  modul: { s: 'Modul', k: 'ID_Modul', p: 'M', r: ['admin', 'instruktur'], c: 'ID_Cohort' },
  sesi: { s: 'Sesi_Kelas', k: 'ID_Sesi', p: 'S', r: ['admin', 'instruktur'], c: 'ID_Cohort' },
  materi: { s: 'Materi', k: 'ID_Materi', p: 'T', r: ['admin', 'instruktur'] }
};
function cohortOf_(t, r) { return TB[t].c ? r[TB[t].c] : t === 'materi' ? (rd_('Sesi_Kelas').filter(function (s) { return s.ID_Sesi === r.ID_Sesi; })[0] || {}).ID_Cohort : ''; }
function inScope_(me, t, r) { return me.role === 'admin' || mine_(me).indexOf(cohortOf_(t, r)) >= 0; }
const R = {
  boot: { roles: ['admin', 'instruktur', 'peserta'], fn: boot_ },
  simpan: { roles: ['admin', 'instruktur'], w: 1, fn: function (me, d) {
    const t = TB[d.t]; if (!t || t.r.indexOf(me.role) < 0) return no_('Tidak punya akses.');
    const rec = {}; SCHEMA[t.s].forEach(function (f) { if (d.rec[f] !== undefined) rec[f] = d.rec[f]; });
    const id = String(rec[t.k] || ''), old = /^[\w-]{3,40}$/.test(id) ? rd_(t.s, true).filter(function (x) { return x[t.k] === id; })[0] : null;
    if (old && !inScope_(me, d.t, old)) return no_('Data di luar cohort Anda.');
    if (!inScope_(me, d.t, old ? Object.assign({}, old, rec) : rec)) return no_('Cohort tidak valid.');
    if (!old) rec[t.k] = /^[\w-]{3,40}$/.test(id) ? id : uid_(t.p);
    delete rec.ID_File_Drive; // hanya diisi lewat materi.upload (cegah akses file Drive sembarang)
    if (d.t === 'materi') { rec.Diunggah_Oleh = me.id; rec.Tanggal_Unggah = rec.Tanggal_Unggah || new Date().toISOString().slice(0, 10); }
    put_(t.s, rec);
    if (!old && d.t === 'sesi') notifCohort_('SESI_BARU', rec.ID_Cohort, { judul: rec.Judul_Sesi, tipe: rec.Tipe, tanggal: rec.Tanggal, jam: rec.Jam_Mulai, lokasi: rec.Lokasi_atau_Link_Meeting });
    if (!old && d.t === 'materi') { const sx = rd_('Sesi_Kelas').filter(function (x) { return x.ID_Sesi === rec.ID_Sesi; })[0]; if (sx) notifCohort_('MATERI_BARU', sx.ID_Cohort, { judul: rec.Judul, sesi: sx.Judul_Sesi }); }
    return ok_({ id: rec[t.k] }, 'Tersimpan.');
  } },
  hapus: { roles: ['admin', 'instruktur'], w: 1, fn: function (me, d) {
    const t = TB[d.t]; if (!t || t.r.indexOf(me.role) < 0) return no_('Tidak punya akses.');
    const old = rd_(t.s, true).filter(function (x) { return x[t.k] === d.id; })[0]; if (!old || !inScope_(me, d.t, old)) return no_('Data tidak ditemukan.');
    if (d.t === 'materi' && old.ID_File_Drive) try { DriveApp.getFileById(old.ID_File_Drive).setTrashed(true); } catch (e) { }
    del_(t.s, d.id); return ok_(null, 'Dihapus.');
  } },
  'user.simpan': { roles: ['admin'], w: 1, fn: function (me, d) {
    const r = d.rec || {}, em = String(r.Email || '').trim().toLowerCase(); if (!/^\S+@\S+\.\S+$/.test(em)) return no_('Email tidak valid.');
    if (['admin', 'instruktur', 'peserta'].indexOf(r.Role) < 0) return no_('Peran tidak valid.');
    const us = rd_('Users', true), old = us.filter(function (u) { return u.ID_User === r.ID_User; })[0];
    if (us.some(function (u) { return u.Email === em && (!old || u.ID_User !== old.ID_User); })) return no_('Email sudah terdaftar.');
    const wa = hp08_(r.No_WA); if (r.No_WA && !hpValid_(wa)) return no_('Nomor WA tidak valid (contoh 081234567890).');
    if (!old && String(r.password || '').length < 8) return no_('Kata sandi awal minimal 8 karakter.');
    const rec = { ID_User: old ? old.ID_User : uid_('U'), Nama: String(r.Nama || '').trim(), Email: em, Role: r.Role, Status_Aktif: r.Status_Aktif === 'Nonaktif' ? 'Nonaktif' : 'Aktif', Tanggal_Daftar: old ? old.Tanggal_Daftar : new Date().toISOString().slice(0, 10), No_WA: wa, OptOut: r.OptOut === 'YA' ? 'YA' : 'TIDAK' };
    if (!old || old.No_WA !== wa) rec.StatusWA = '';
    if (r.password) rec.Password_Hash = mkHash_(r.password);
    put_('Users', rec); if (old && (r.password || rec.Status_Aktif === 'Nonaktif')) revoke_(old.Email);
    if (!old) kirimBatch_('AKUN_DIBUAT', [{ nama: rec.Nama, hp: wa, email: em }]);
    return ok_({ id: rec.ID_User }, 'Pengguna tersimpan.');
  } },
  'anggota.set': { roles: ['admin'], w: 1, fn: function (me, d) {
    const keep = rd_('Cohort_Members', true).filter(function (m) { return m.ID_Cohort !== d.cohort; }), us = rd_('Users');
    (d.anggota || []).forEach(function (a) { if (us.some(function (u) { return u.ID_User === a.id; })) keep.push({ ID: uid_('A'), ID_Cohort: d.cohort, ID_User: a.id, Peran_di_Cohort: a.peran === 'Instruktur' ? 'Instruktur' : 'Peserta', Tanggal_Gabung: new Date().toISOString().slice(0, 10) }); });
    setAll_('Cohort_Members', keep); return ok_(null, 'Anggota cohort diperbarui.');
  } },
  'progres.tandai': { roles: ['peserta', 'instruktur', 'admin'], w: 1, fn: function (me, d) {
    const s = rd_('Sesi_Kelas').filter(function (x) { return x.ID_Sesi === d.sesi; })[0]; if (!s || mine_(me).indexOf(s.ID_Cohort) < 0) return no_('Sesi tidak ditemukan.');
    const id = me.id + '_' + s.ID_Sesi, old = rd_('Progres', true).filter(function (p) { return p.ID === id; })[0] || {};
    put_('Progres', { ID: id, ID_User: me.id, ID_Sesi: s.ID_Sesi, Status: d.status === 'Belum' ? 'Belum' : 'Sudah', Kehadiran: old.Kehadiran || '', Tanggal_Update: new Date().toISOString().slice(0, 10) });
    return ok_(null, 'Progres diperbarui.');
  } },
  'hadir.simpan': { roles: ['admin', 'instruktur'], w: 1, fn: function (me, d) {
    const s = rd_('Sesi_Kelas').filter(function (x) { return x.ID_Sesi === d.sesi; })[0]; if (!s || !inScope_(me, 'sesi', s)) return no_('Sesi tidak ditemukan.');
    const peserta = rd_('Cohort_Members').filter(function (m) { return m.ID_Cohort === s.ID_Cohort; }).map(function (m) { return m.ID_User; });
    const all = rd_('Progres', true), map = {}, tgl = new Date().toISOString().slice(0, 10);
    all.forEach(function (p) { map[p.ID] = p; });
    (d.rows || []).forEach(function (r) { if (peserta.indexOf(r.id) < 0 || ['Hadir', 'Online', 'Tidak Hadir', ''].indexOf(r.k) < 0) return; const id = r.id + '_' + s.ID_Sesi; const o = map[id] || { ID: id, ID_User: r.id, ID_Sesi: s.ID_Sesi, Status: 'Belum' }; o.Kehadiran = r.k; o.Tanggal_Update = tgl; map[id] = o; });
    setAll_('Progres', Object.keys(map).map(function (k) { return map[k]; })); return ok_(null, 'Kehadiran tersimpan.');
  } },
  'materi.upload': { roles: ['admin', 'instruktur'], w: 1, fn: function (me, d) {
    const s = rd_('Sesi_Kelas').filter(function (x) { return x.ID_Sesi === d.sesi; })[0]; if (!s || !inScope_(me, 'sesi', s)) return no_('Sesi tidak ditemukan.');
    if (!/\.(pdf|pptx?|docx?|xlsx?|csv|txt|zip|png|jpe?g)$/i.test(d.nama || '')) return no_('Tipe file tidak diizinkan.');
    if (String(d.b64 || '').length > 7e6) return no_('Ukuran file maksimal ±5 MB.');
    const f = folder_(folder_(DriveApp.getFolderById(prop_('ROOT_FOLDER_ID')), s.ID_Cohort), s.ID_Sesi).createFile(Utilities.newBlob(Utilities.base64Decode(d.b64), d.mime || 'application/octet-stream', d.nama));
    const id = uid_('T'); put_('Materi', { ID_Materi: id, ID_Sesi: s.ID_Sesi, Jenis: 'File', Judul: String(d.judul || d.nama).slice(0, 120), ID_File_Drive: f.getId(), Diunggah_Oleh: me.id, Tanggal_Unggah: new Date().toISOString().slice(0, 10) });
    return ok_({ id: id }, 'File terunggah.');
  } },
  'materi.unduh': { roles: ['admin', 'instruktur', 'peserta'], fn: function (me, d) {
    const m = rd_('Materi').filter(function (x) { return x.ID_Materi === d.id; })[0], s = m && rd_('Sesi_Kelas').filter(function (x) { return x.ID_Sesi === m.ID_Sesi; })[0];
    if (!m || !m.ID_File_Drive || !s || mine_(me).indexOf(s.ID_Cohort) < 0) return no_('File tidak tersedia.');
    const f = DriveApp.getFileById(m.ID_File_Drive); return ok_({ nama: f.getName(), mime: f.getMimeType(), b64: Utilities.base64Encode(f.getBlob().getBytes()) });
  } },
  'sandi.ganti': { roles: ['admin', 'instruktur', 'peserta'], w: 1, fn: function (me, d) {
    const u = rd_('Users', true).filter(function (x) { return x.ID_User === me.id; })[0];
    if (!okPw_(d.lama || '', u.Password_Hash) || String(d.baru || '').length < 8) return no_('Sandi lama salah atau sandi baru kurang dari 8 karakter.');
    u.Password_Hash = mkHash_(d.baru); put_('Users', u); return ok_(null, 'Sandi diganti.');
  } }
};
function folder_(p, n) { const i = p.getFoldersByName(n); return i.hasNext() ? i.next() : p.createFolder(n); }
function boot_(me) {
  const ids = mine_(me), has = function (c) { return ids.indexOf(c) >= 0; }, st = me.role !== 'peserta';
  const cohorts = rd_('Cohorts').filter(function (c) { return has(c.ID_Cohort); });
  const modul = rd_('Modul').filter(function (m) { return has(m.ID_Cohort) && (st || m.Status_Publikasi !== 'Draft'); });
  const sesi = rd_('Sesi_Kelas').filter(function (s) { return has(s.ID_Cohort); }), sid = {}; sesi.forEach(function (s) { sid[s.ID_Sesi] = 1; });
  const materi = rd_('Materi').filter(function (m) { return sid[m.ID_Sesi]; }).map(function (m) { return Object.assign({}, m, { ID_File_Drive: m.ID_File_Drive ? '1' : '' }); });
  const members = rd_('Cohort_Members').filter(function (m) { return has(m.ID_Cohort); }), uid = {}; members.forEach(function (m) { uid[m.ID_User] = 1; });
  const users = rd_('Users').filter(function (u) { return me.role === 'admin' || uid[u.ID_User]; }).map(function (u) { return { ID_User: u.ID_User, Nama: u.Nama, Email: me.role === 'admin' ? u.Email : '', Role: u.Role, Status_Aktif: u.Status_Aktif, No_WA: me.role === 'admin' ? u.No_WA : '', OptOut: u.OptOut, StatusWA: me.role === 'admin' ? u.StatusWA : '' }; });
  const progres = rd_('Progres').filter(function (p) { return sid[p.ID_Sesi] && (st || p.ID_User === me.id); });
  const sert = rd_('Sertifikat').filter(function (x) { return has(x.ID_Cohort) && (st || x.ID_User === me.id); }).map(function (x) { return { ID_Sertifikat: x.ID_Sertifikat, Nomor: x.Nomor, ID_Cohort: x.ID_Cohort, ID_User: x.ID_User, Nama: x.Nama, Kode_Verifikasi: x.Kode_Verifikasi, Status: x.Status, Diterbitkan: x.Diterbitkan }; });
  return ok_({ minSert: Number(prop_('SERT_MIN')) || 80, sertifikat: sert, me: me, cohorts: cohorts, modul: modul, sesi: sesi, materi: materi, members: members, users: users, progres: progres });
}
function route_(a) { return R[a] || rutePlus_()[a]; }
function run_(a, me, d) {
  const r = route_(a); if (!r) return no_('Aksi tidak dikenal.'); if (r.roles.indexOf(me.role) < 0) return no_('Anda tidak punya akses.');
  const res = r.fn(me, d || {}); if (r.w && res.success) log_(me, a, JSON.stringify({ t: d && d.t, id: d && (d.id || d.sesi || d.cohort) })); return res;
}
function handle_(a, tok, d) {
  if (a === 'login') return login_(d);
  if (a === 'verifikasi') return verifikasi_(d); // publik: cek keaslian sertifikat
  const me = auth_(tok); if (!me) return { success: false, code: 'AUTH', message: 'Sesi berakhir, silakan masuk lagi.' };
  if (a === 'batch') return ok_((d.calls || []).slice(0, 10).map(function (c) { return route_(c.action) && !route_(c.action).w ? run_(c.action, me, c.data) : no_('Aksi tidak boleh di-batch.'); }));
  return run_(a, me, d);
}
function out_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function doGet(e) { if (e && e.parameter && e.parameter.w) { try { warm_(); } catch (x) { } } return out_({ success: true, app: 'RuangCohort', v: VER }); }
function doPost(e) {
  const t0 = Date.now(); let res;
  try { const b = JSON.parse(e.postData.contents); res = handle_(String(b.action || ''), b.token, b.data || {}); }
  catch (err) { console.error(err.message); res = { success: false, message: 'Terjadi kesalahan server. Coba lagi.' }; }
  res.ms = Date.now() - t0; res.v = VER; return out_(res);
}
function warm_() { const c = CacheService.getScriptCache(); if (c.get('warm')) return; c.put('warm', '1', 50); ['Users', 'Cohorts', 'Cohort_Members', 'Modul', 'Sesi_Kelas', 'Materi', 'Progres'].forEach(function (n) { rd_(n); }); }
function keepWarm() { if (prop_('KEEP_WARM') !== 'off') warm_(); }
function kirimPengingat() { // trigger harian: pengingat H-1 lewat antrean (WA/Email sesuai saklar & matriks) + bersihkan antrean lama
  const b = Utilities.formatDate(new Date(Date.now() + 864e5), Session.getScriptTimeZone(), 'yyyy-MM-dd');
  rd_('Sesi_Kelas', true).filter(function (s) { return s.Tanggal === b; }).forEach(function (s) { notifCohort_('PENGINGAT_SESI', s.ID_Cohort, { judul: s.Judul_Sesi, tipe: s.Tipe, jam: s.Jam_Mulai + '–' + s.Jam_Selesai, lokasi: s.Lokasi_atau_Link_Meeting }); });
  bersihkanAntrian_();
}
