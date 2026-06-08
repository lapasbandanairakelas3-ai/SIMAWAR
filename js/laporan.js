// SIMAWAR laporan.js v1 — Laporan absensi per shift per hari
// Generate PDF sesuai format: Laporan > Shift > Per Kamar > Tabel + Rekap

async function loadLaporan() {
  const today = todayWIT();
  document.getElementById('laporanTanggal').value = today;
  document.getElementById('laporanShift').value = getShiftNow();
  await previewLaporan();
}

async function previewLaporan() {
  const tgl   = document.getElementById('laporanTanggal').value || todayWIT();
  const shift = document.getElementById('laporanShift').value || 'Pagi';
  const container = document.getElementById('laporanPreview');
  container.innerHTML = '<div style="text-align:center;padding:40px;color:#94a3b8">Memuat data...</div>';

  // Ambil data
  const [blokRes, absenRes, cfgRes] = await Promise.all([
    sb.from('blok').select('id,nama').order('nama'),
    sb.from('absen_detail')
      .select('id,wbp_id,blok_id,status,keterangan,waktu,wbp:wbp_id(nama),pegawai:pegawai_id(nama)')
      .eq('tanggal', tgl)
      .eq('shift', shift)
      .order('waktu'),
    sb.from('site_config').select('site_name,instansi').maybeSingle()
  ]);

  const bloks   = blokRes.data  || [];
  const absensi = absenRes.data || [];
  const cfg     = cfgRes.data   || {};

  // Ambil semua WBP per blok
  const wbpRes = await sb.from('wbp').select('id,nama,blok_id').order('nama');
  const allWbp = wbpRes.data || [];

  // Ambil daftar status dari DB
  const stRes = await sb.from('status_absen').select('nama').eq('aktif',true).order('urutan');
  const statusList = (stRes.data||[]).map(s=>s.nama);

  if (!bloks.length) {
    container.innerHTML = emptyState('Belum Ada Kamar', 'Tambahkan kamar terlebih dahulu');
    return;
  }

  // Build absenMap: wbp_id → {status, keterangan}
  const absenMap = {};
  absensi.forEach(a => { absenMap[a.wbp_id] = { status: a.status, keterangan: a.keterangan||'', petugas: a.pegawai?.nama||'' }; });

  // Petugas shift ini (nama unik)
  const petugasSet = new Set(absensi.map(a=>a.pegawai?.nama).filter(Boolean));
  const petugasStr = petugasSet.size ? [...petugasSet].join(', ') : '—';

  // Format tanggal
  const tglFmt = formatTanggalWIT(tgl);
  const waktuStr = `${tglFmt} / ${SHIFT_ICON[shift]||''} Shift ${shift}`;

  // Rekap global
  let totalWbp=0;
  const globalCount = {};
  statusList.forEach(s=>globalCount[s]=0);

  // Build HTML preview
  let html = `
    <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:780px;margin:0 auto;padding:20px;background:white">
      <!-- Header -->
      <div style="text-align:center;margin-bottom:20px;border-bottom:2px solid #1e3a8a;padding-bottom:14px">
        <div style="font-size:18px;font-weight:900;color:#1e3a8a;text-transform:uppercase;letter-spacing:1px">Laporan Absensi WBP</div>
        <div style="font-size:13px;color:#475569;margin-top:4px">${cfg.instansi||cfg.site_name||'SIMAWAR'}</div>
        <div style="font-size:12px;color:#64748b;margin-top:6px">
          <strong>Periode / Waktu:</strong> ${waktuStr}
        </div>
        <div style="font-size:12px;color:#64748b;margin-top:2px">
          <strong>Petugas:</strong> ${petugasStr}
        </div>
      </div>`;

  // Per kamar
  bloks.forEach(b => {
    const wbpBlok = allWbp.filter(w => w.blok_id === b.id);
    if (!wbpBlok.length) return;

    // Hitung rekap kamar
    const kamarCount = {};
    statusList.forEach(s=>kamarCount[s]=0);
    wbpBlok.forEach(w=>{
      const st = absenMap[w.id]?.status;
      if(st && kamarCount[st]!==undefined) kamarCount[st]++;
      else if(st) kamarCount[st]=(kamarCount[st]||0)+1;
      totalWbp++;
      if(st && globalCount[st]!==undefined) globalCount[st]++;
      else if(st) globalCount[st]=(globalCount[st]||0)+1;
    });

    html += `
      <div style="margin-bottom:24px">
        <div style="background:#1e3a8a;color:white;padding:7px 14px;font-weight:800;font-size:13px;border-radius:6px 6px 0 0">${b.nama}</div>
        <table style="width:100%;border-collapse:collapse;font-size:12px">
          <thead>
            <tr style="background:#dbeafe">
              <th style="border:1px solid #93c5fd;padding:7px 10px;text-align:left;font-weight:700;width:40px">No</th>
              <th style="border:1px solid #93c5fd;padding:7px 10px;text-align:left;font-weight:700">Nama WBP</th>
              <th style="border:1px solid #93c5fd;padding:7px 10px;text-align:center;font-weight:700;width:120px">Status</th>
              <th style="border:1px solid #93c5fd;padding:7px 10px;text-align:left;font-weight:700">Keterangan</th>
            </tr>
          </thead>
          <tbody>
            ${wbpBlok.map((w,i)=>{
              const d=absenMap[w.id]||{};
              return`<tr style="background:${i%2===0?'white':'#f8fafc'}">
                <td style="border:1px solid #e2e8f0;padding:7px 10px;text-align:center;color:#64748b">${i+1}</td>
                <td style="border:1px solid #e2e8f0;padding:7px 10px;font-weight:600">${w.nama}</td>
                <td style="border:1px solid #e2e8f0;padding:7px 10px;text-align:center;font-weight:600;color:${d.status?'#065f46':'#94a3b8'}">${d.status||'—'}</td>
                <td style="border:1px solid #e2e8f0;padding:7px 10px;color:#64748b">${d.keterangan||'—'}</td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
        <!-- Rekap kamar -->
        <div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap">
          ${statusList.map(s=>`<span style="background:#f1f5f9;border:1px solid #e2e8f0;border-radius:8px;padding:3px 10px;font-size:11px;font-weight:700;color:#374151">${s}: <strong style="color:#1e3a8a">${kamarCount[s]||0}</strong></span>`).join('')}
        </div>
      </div>`;
  });

  // Rekap Total
  const belumAbsen = totalWbp - Object.values(globalCount).reduce((a,b)=>a+b,0);
  html += `
      <!-- Rekap Total -->
      <div style="border:2px solid #1e3a8a;border-radius:8px;overflow:hidden;margin-top:8px">
        <div style="background:#1e3a8a;color:white;padding:7px 14px;font-weight:800;font-size:13px">Jumlah WBP — Shift ${shift}</div>
        <table style="width:100%;border-collapse:collapse;font-size:12px">
          <tbody>
            ${statusList.map(s=>`<tr><td style="border:1px solid #e2e8f0;padding:7px 14px;font-weight:600">${s}</td><td style="border:1px solid #e2e8f0;padding:7px 14px;font-weight:800;color:#1e3a8a;text-align:right">${globalCount[s]||0}</td></tr>`).join('')}
            ${belumAbsen>0?`<tr style="background:#fef3c7"><td style="border:1px solid #fde68a;padding:7px 14px;font-weight:600;color:#92400e">Belum Diabsen</td><td style="border:1px solid #fde68a;padding:7px 14px;font-weight:800;color:#92400e;text-align:right">${belumAbsen}</td></tr>`:''}
            <tr style="background:#1e3a8a"><td style="border:1px solid #1e40af;padding:8px 14px;font-weight:800;color:white">TOTAL</td><td style="border:1px solid #1e40af;padding:8px 14px;font-weight:900;color:white;text-align:right;font-size:15px">${totalWbp}</td></tr>
          </tbody>
        </table>
      </div>
      <div style="text-align:right;font-size:10px;color:#94a3b8;margin-top:12px">Dicetak: ${new Date().toLocaleString('id-ID',{timeZone:'Asia/Jayapura'})}</div>
    </div>`;

  container.innerHTML = html;
  // Simpan data untuk PDF
  window._laporanData = { tgl, shift, tglFmt, petugasStr, bloks, allWbp, absenMap, statusList, globalCount, totalWbp, cfg };
}

async function downloadLaporanPDF() {
  const d = window._laporanData;
  if (!d) { showAlert('warning','Belum Ada Preview','Klik Preview terlebih dahulu.'); return; }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation:'portrait', format:'a4' });
  const PW = 210, ml = 15, mr = 15, cw = PW - ml - mr;
  let y = 15;

  function checkNewPage(needed=20) {
    if (y + needed > 280) { doc.addPage(); y = 15; }
  }

  // Header
  doc.setFontSize(14); doc.setFont('helvetica','bold');
  doc.text('LAPORAN ABSENSI WBP', PW/2, y, {align:'center'}); y+=7;
  doc.setFontSize(9); doc.setFont('helvetica','normal');
  doc.text(d.cfg.instansi||d.cfg.site_name||'SIMAWAR', PW/2, y, {align:'center'}); y+=5;
  doc.setFontSize(8);
  doc.text(`Periode / Waktu : ${d.tglFmt} / Shift ${d.shift}`, ml, y); y+=5;
  doc.text(`Petugas : ${d.petugasStr}`, ml, y); y+=6;
  doc.setDrawColor(30,58,138); doc.setLineWidth(0.8); doc.line(ml, y, PW-mr, y); y+=5;

  // Per kamar
  for (const b of d.bloks) {
    const wbpBlok = d.allWbp.filter(w => w.blok_id === b.id);
    if (!wbpBlok.length) continue;

    checkNewPage(30);
    // Kamar header bar
    doc.setFillColor(30,58,138); doc.rect(ml, y, cw, 8, 'F');
    doc.setFont('helvetica','bold'); doc.setFontSize(9); doc.setTextColor(255,255,255);
    doc.text(b.nama, ml+3, y+5.5); y+=8; doc.setTextColor(0,0,0);

    // Tabel WBP
    const rows = wbpBlok.map((w,i) => {
      const ab = d.absenMap[w.id]||{};
      return [String(i+1), w.nama, ab.status||'—', ab.keterangan||'—'];
    });
    doc.autoTable({
      startY: y,
      head: [['No','Nama WBP','Status','Keterangan']],
      body: rows,
      margin: {left: ml, right: mr},
      styles: {fontSize:8, cellPadding:2.5},
      headStyles: {fillColor:[219,234,254], textColor:[30,58,138], fontStyle:'bold', fontSize:8},
      columnStyles: {0:{cellWidth:12,halign:'center'},2:{cellWidth:28,halign:'center'},3:{cellWidth:50}},
      alternateRowStyles: {fillColor:[248,250,252]},
      tableLineColor:[200,210,230], tableLineWidth:0.3,
      didDrawPage: (data) => { y = data.cursor.y; }
    });
    y = doc.lastAutoTable.finalY + 3;

    // Rekap kamar
    checkNewPage(10);
    doc.setFont('helvetica','bold'); doc.setFontSize(7.5);
    const kamarCount = {};
    d.statusList.forEach(s=>kamarCount[s]=0);
    wbpBlok.forEach(w=>{const st=d.absenMap[w.id]?.status;if(st&&kamarCount[st]!==undefined)kamarCount[st]++;});
    const rekapStr = d.statusList.map(s=>`${s}: ${kamarCount[s]||0}`).join('   ');
    doc.text(rekapStr, ml, y); y+=8;
  }

  // Rekap total
  checkNewPage(40);
  doc.setDrawColor(30,58,138); doc.setLineWidth(0.5); doc.line(ml, y, PW-mr, y); y+=4;
  const totalRows = d.statusList.map(s => [s, String(d.globalCount[s]||0)]);
  const belum = d.totalWbp - Object.values(d.globalCount).reduce((a,b)=>a+b,0);
  if(belum>0) totalRows.push(['Belum Diabsen', String(belum)]);
  totalRows.push(['TOTAL', String(d.totalWbp)]);
  doc.autoTable({
    startY: y,
    head: [['Status', 'Jumlah']],
    body: totalRows,
    margin: {left: ml, right: mr},
    styles: {fontSize:8.5, cellPadding:3},
    headStyles: {fillColor:[30,58,138], textColor:255, fontStyle:'bold'},
    columnStyles: {1:{halign:'right', fontStyle:'bold'}},
    didParseCell: (data) => {
      if(data.row.index===totalRows.length-1&&data.section==='body'){
        data.cell.styles.fillColor=[30,58,138];data.cell.styles.textColor=255;data.cell.styles.fontStyle='bold';
      }
    }
  });

  // Footer
  const pages = doc.getNumberOfPages();
  for(let i=1;i<=pages;i++){
    doc.setPage(i);doc.setFontSize(7.5);doc.setFont('helvetica','normal');doc.setTextColor(150);
    doc.text(`Dicetak: ${new Date().toLocaleString('id-ID',{timeZone:'Asia/Jayapura'})} | Halaman ${i} dari ${pages}`, PW/2, 290, {align:'center'});
  }
  doc.save(`Laporan_Absensi_${d.shift}_${d.tgl}.pdf`);
  showAlert('success','Berhasil','PDF berhasil diunduh.');
}
