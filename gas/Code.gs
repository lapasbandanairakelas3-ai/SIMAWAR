// ============================================================
// GOOGLE APPS SCRIPT — SiHadir Lapas
// Paste kode ini di Google Apps Script, lalu Deploy sebagai Web App
// Execute as: Me | Who has access: Anyone
// ============================================================

const SHEET_NAME_ABSEN = 'Absensi';
const SHEET_NAME_SESSION = 'AktifSesi';

function doGet(e) {
  const action = e.parameter.action;
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  try {
    if (action === 'getRiwayat') return getRiwayat(e, ss);
    if (action === 'getActiveSessions') return getActiveSessions(e, ss);
    return jsonResponse({ success: false, message: 'Action tidak dikenal' });
  } catch(err) {
    return jsonResponse({ success: false, message: err.message });
  }
}

function doPost(e) {
  const body = JSON.parse(e.postData.contents);
  const action = body.action;
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  try {
    if (action === 'saveAbsen') return saveAbsen(body, ss);
    if (action === 'startSession') return startSession(body, ss);
    if (action === 'endSession') return endSession(body, ss);
    return jsonResponse({ success: false, message: 'Action tidak dikenal' });
  } catch(err) {
    return jsonResponse({ success: false, message: err.message });
  }
}

// ---- SAVE ABSEN ----
function saveAbsen(body, ss) {
  const sheet = getOrCreateSheet(ss, SHEET_NAME_ABSEN, [
    'ID', 'Session ID', 'Waktu', 'Tanggal', 'Blok ID', 'Blok Nama',
    'Pegawai ID', 'Pegawai Nama', 'Pegawai Jabatan',
    'WBP ID', 'WBP Nama', 'No. Registrasi', 'Status', 'Keterangan'
  ]);

  const rows = body.rows || [];
  rows.forEach(row => {
    sheet.appendRow([
      Utilities.getUuid(),
      row.session_id || '',
      row.waktu || new Date().toISOString(),
      row.tanggal || '',
      row.blok_id || '',
      row.blok_nama || '',
      row.pegawai_id || '',
      row.pegawai_nama || '',
      row.pegawai_jabatan || '',
      row.wbp_id || '',
      row.wbp_nama || '',
      row.no_registrasi || '',
      row.status || '',
      row.keterangan || ''
    ]);
  });

  // End session after saving
  if (body.rows?.[0]?.session_id) {
    endSessionById(body.rows[0].session_id, ss);
  }

  return jsonResponse({ success: true, saved: rows.length });
}

// ---- START SESSION (lock blok) ----
function startSession(body, ss) {
  const sheet = getOrCreateSheet(ss, SHEET_NAME_SESSION, [
    'Session ID', 'Blok ID', 'Blok Nama', 'Pegawai ID', 'Pegawai Nama',
    'Pegawai Jabatan', 'Tanggal', 'Waktu Mulai', 'Status'
  ]);

  const sessionId = Utilities.getUuid();
  sheet.appendRow([
    sessionId,
    body.blok_id || '',
    body.blok_nama || '',
    body.pegawai_id || '',
    body.pegawai_nama || '',
    body.pegawai_jabatan || '',
    body.tanggal || new Date().toISOString().split('T')[0],
    new Date().toISOString(),
    'aktif'
  ]);

  return jsonResponse({ success: true, session_id: sessionId });
}

// ---- END SESSION ----
function endSession(body, ss) {
  endSessionById(body.session_id, ss);
  return jsonResponse({ success: true });
}

function endSessionById(sessionId, ss) {
  try {
    const sheet = ss.getSheetByName(SHEET_NAME_SESSION);
    if (!sheet) return;
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === sessionId) {
        sheet.getRange(i + 1, 9).setValue('selesai');
        break;
      }
    }
  } catch(e) {}
}

// ---- GET ACTIVE SESSIONS ----
function getActiveSessions(e, ss) {
  const tanggal = e.parameter.tanggal || new Date().toISOString().split('T')[0];
  const sheet = ss.getSheetByName(SHEET_NAME_SESSION);
  if (!sheet) return jsonResponse({ sessions: [] });

  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const sessions = [];

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (row[6] === tanggal && row[8] === 'aktif') {
      sessions.push({
        session_id: row[0],
        blok_id: row[1],
        blok_nama: row[2],
        pegawai_id: row[3],
        pegawai_nama: row[4],
        pegawai_jabatan: row[5]
      });
    }
  }

  return jsonResponse({ sessions });
}

// ---- GET RIWAYAT ----
function getRiwayat(e, ss) {
  const sheet = ss.getSheetByName(SHEET_NAME_ABSEN);
  if (!sheet) return jsonResponse({ data: [] });

  const dari = e.parameter.dari || '';
  const sampai = e.parameter.sampai || '';
  const blokId = e.parameter.blok_id || '';
  const pegawaiId = e.parameter.pegawai_id || '';
  const search = (e.parameter.search || '').toLowerCase();
  const isAdmin = e.parameter.isAdmin === 'true';

  const data = sheet.getDataRange().getValues();
  const result = [];

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    // Columns: ID, SessionID, Waktu, Tanggal, BlokID, BlokNama, PegawaiID, PegawaiNama, PegawaiJabatan, WBPID, WBPNama, NoReg, Status, Keterangan
    const tanggal = row[3]?.toString() || '';
    const rowBlokId = row[4]?.toString() || '';
    const rowPegawaiId = row[6]?.toString() || '';
    const wbpNama = row[10]?.toString().toLowerCase() || '';
    const pegawaiNama = row[7]?.toString().toLowerCase() || '';

    if (dari && tanggal < dari) continue;
    if (sampai && tanggal > sampai) continue;
    if (blokId && rowBlokId !== blokId) continue;
    if (!isAdmin && pegawaiId && rowPegawaiId !== pegawaiId) continue;
    if (isAdmin && pegawaiId && rowPegawaiId !== pegawaiId) continue;
    if (search && !wbpNama.includes(search) && !pegawaiNama.includes(search)) continue;

    result.push({
      id: row[0],
      session_id: row[1],
      waktu: row[2],
      tanggal: row[3],
      blok_id: row[4],
      blok_nama: row[5],
      pegawai_id: row[6],
      pegawai_nama: row[7],
      pegawai_jabatan: row[8],
      wbp_id: row[9],
      wbp_nama: row[10],
      no_registrasi: row[11],
      status: row[12],
      keterangan: row[13]
    });
  }

  // Sort descending by waktu
  result.sort((a, b) => new Date(b.waktu) - new Date(a.waktu));

  return jsonResponse({ data: result, total: result.length });
}

// ---- HELPERS ----
function getOrCreateSheet(ss, name, headers) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.appendRow(headers);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#1e40af').setFontColor('#ffffff');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
