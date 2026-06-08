// SIMAWAR laporan.js v2 — Laporan absensi sesuai permintaan
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
  container.innerHTML = '<div style="text-align:center;padding:40px;color:#94a3b8">Memuat...</div>';

  const [blokRes, absenRes, cfgRes, wbpRes] = await Promise.all([
    sb.from('blok').select('id,nama').order('nama'),
    sb.from('absen_detail')
      .select('id,wbp_id,blok_id,status,keterangan,waktu,pegawai:pegawai_id(nama)')
      .eq('tanggal', tgl).eq('shift', shift).order('waktu'),
    sb.from('site_config').select('site_name,instansi').maybeSingle(),
    sb.from('wbp').select('id,nama,blok_id').order('nama')
  ]);

  const bloks   = blokRes.data  || [];
  const absensi = absenRes.data || [];
  const cfg     = cfgRes.data   || {};
  const allWbp  = wbpRes.data   || [];

  if (!bloks.length) {
    container.innerHTML = emptyState('Belum Ada Kamar', 'Tambahkan kamar terlebih dahulu');
    return;
  }

  // Build absenMap & hitung rekap global
  const absenMap = {};
  const globalCount = {};
  absensi.forEach(a => {
    absenMap[a.wbp_id] = { status: a.status, keterangan: a.keterangan||'' };
    if(a.status) globalCount[a.status] = (globalCount[a.status]||0)+1;
  });

  // Total WBP yang ada di sistem
  let totalWbp = allWbp.length;
  const sudahAbsen = absensi.length;
  const belumAbsen = totalWbp - sudahAbsen;

  // Petugas: unique pegawai shift ini
  const petugasSet = new Set(absensi.map(a=>a.pegawai?.nama).filter(Boolean));
  const petugasStr = petugasSet.size ? [...petugasSet].join(', ') : '—';

  // Jam absen pertama
  let jamPertama = '—';
  if (absensi.length && absensi[0].waktu) {
    jamPertama = new Date(absensi[0].waktu).toLocaleString('id-ID',{
      timeZone:'Asia/Jayapura', hour:'2-digit', minute:'2-digit'
    }) + ' WIT';
  }

  // Format tanggal
  const tglFmt = formatTanggalWIT(tgl);

  // Build HTML preview
  let html = `
    <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:780px;margin:0 auto;padding:20px;background:white">
      <!-- Header -->
      <div style="text-align:center;margin-bottom:20px;border-bottom:2px solid #1e3a8a;padding-bottom:14px">
        <div style="font-size:18px;font-weight:900;color:#1e3a8a;text-transform:uppercase;letter-spacing:1px">Laporan Absensi WBP</div>
        <div style="font-size:13px;color:#475569;margin-top:4px">${cfg.instansi||cfg.site_name||'SIMAWAR'}</div>
        <div style="font-size:12px;color:#64748b;margin-top:6px"><strong>Periode / Waktu:</strong> ${tglFmt} / ${jamPertama}</div>
        <div style="font-size:12px;color:#64748b;margin-top:2px"><strong>Petugas:</strong> ${petugasStr}</div>
      </div>`;

  // Per kamar (tanpa rekap bawah)
  bloks.forEach(b => {
    const wbpBlok = allWbp.filter(w => w.blok_id === b.id);
    if (!wbpBlok.length) return;

    html += `
      <div style="margin-bottom:20px">
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
                <td style="border:1px solid #e2e8f0;padding:7px 10px;text-align:center;font-weight:700;color:${d.status?'#065f46':'#94a3b8'}">${d.status||'—'}</td>
                <td style="border:1px solid #e2e8f0;padding:7px 10px;color:#64748b">${d.keterangan||'—'}</td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>`;
  });

  // Tabel rekap "Jumlah WBP" — hanya status yang ADA (>0)
  const statusRows = Object.entries(globalCount).filter(([s,n])=>n>0);

  html += `
      <div style="border:2px solid #1e3a8a;border-radius:8px;overflow:hidden;margin-top:8px">
        <div style="background:#1e3a8a;color:white;padding:8px 14px;font-weight:800;font-size:13px">Jumlah WBP</div>
        <table style="width:100%;border-collapse:collapse;font-size:12px">
          <tbody>
            ${statusRows.map(([s,n])=>`<tr><td style="border:1px solid #e2e8f0;padding:7px 14px;font-weight:600">${s}</td><td style="border:1px solid #e2e8f0;padding:7px 14px;font-weight:800;color:#1e3a8a;text-align:right">${n}</td></tr>`).join('')}
            ${belumAbsen>0?`<tr style="background:#fef3c7"><td style="border:1px solid #fde68a;padding:7px 14px;font-weight:600;color:#92400e">Belum Diabsen</td><td style="border:1px solid #fde68a;padding:7px 14px;font-weight:800;color:#92400e;text-align:right">${belumAbsen}</td></tr>`:''}
            <tr style="background:#1e3a8a"><td style="border:1px solid #1e40af;padding:8px 14px;font-weight:800;color:white">TOTAL</td><td style="border:1px solid #1e40af;padding:8px 14px;font-weight:900;color:white;text-align:right;font-size:15px">${totalWbp}</td></tr>
          </tbody>
        </table>
      </div>
      <div style="text-align:right;font-size:10px;color:#94a3b8;margin-top:12px">Dicetak: ${new Date().toLocaleString('id-ID',{timeZone:'Asia/Jayapura'})}</div>
    </div>`;

  container.innerHTML = html;

  // Simpan data untuk PDF
  window._laporanData = { tgl, shift, tglFmt, jamPertama, petugasStr, bloks, allWbp, absenMap, globalCount, totalWbp, belumAbsen, statusRows, cfg };
}

async function downloadLaporanPDF() {
  const d = window._laporanData;
  if (!d) { showAlert('warning','Belum Ada Preview','Klik Preview terlebih dahulu.'); return; }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation:'portrait', format:'a4' });
  const PW = 210, ml = 15, mr = 15, cw = PW - ml - mr;
  let y = 15;

  function checkNewPage(needed=20){ if(y+needed>275){ doc.addPage(); y=15; } }

  // Header
  doc.setFontSize(14); doc.setFont('helvetica','bold');
  doc.text('LAPORAN ABSENSI WBP', PW/2, y, {align:'center'}); y+=7;
  doc.setFontSize(9); doc.setFont('helvetica','normal');
  doc.text(d.cfg.instansi||d.cfg.site_name||'SIMAWAR', PW/2, y, {align:'center'}); y+=6;
  doc.setFontSize(8);
  doc.text(`Periode / Waktu : ${d.tglFmt} / ${d.jamPertama}`, ml, y); y+=5;
  doc.text(`Petugas        : ${d.petugasStr}`, ml, y); y+=6;
  doc.setDrawColor(30,58,138); doc.setLineWidth(0.8); doc.line(ml, y, PW-mr, y); y+=5;

  // Per kamar (tanpa rekap bawah)
  for (const b of d.bloks) {
    const wbpBlok = d.allWbp.filter(w => w.blok_id === b.id);
    if (!wbpBlok.length) continue;

    checkNewPage(30);
    doc.setFillColor(30,58,138); doc.rect(ml, y, cw, 8, 'F');
    doc.setFont('helvetica','bold'); doc.setFontSize(9); doc.setTextColor(255,255,255);
    doc.text(b.nama, ml+3, y+5.5); y+=8; doc.setTextColor(0,0,0);

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
      columnStyles: {0:{cellWidth:12,halign:'center'},2:{cellWidth:30,halign:'center',fontStyle:'bold'},3:{cellWidth:55}},
      alternateRowStyles: {fillColor:[248,250,252]},
      tableLineColor:[200,210,230], tableLineWidth:0.3,
      didDrawPage: (data) => { y = data.cursor.y; }
    });
    y = doc.lastAutoTable.finalY + 6;
  }

  // Rekap "Jumlah WBP"
  checkNewPage(60);
  const rekapRows = [...d.statusRows];
  if(d.belumAbsen>0) rekapRows.push(['Belum Diabsen', d.belumAbsen]);
  rekapRows.push(['TOTAL', d.totalWbp]);

  // Header rekap
  doc.setFillColor(30,58,138); doc.rect(ml, y, cw, 8, 'F');
  doc.setFont('helvetica','bold'); doc.setFontSize(10); doc.setTextColor(255,255,255);
  doc.text('Jumlah WBP', ml+3, y+5.5); y+=8; doc.setTextColor(0,0,0);

  doc.autoTable({
    startY: y,
    body: rekapRows.map(([s,n])=>[s, String(n)]),
    margin: {left: ml, right: mr},
    styles: {fontSize:9, cellPadding:3.5},
    columnStyles: {0:{cellWidth:cw*0.7, fontStyle:'bold'}, 1:{halign:'right', fontStyle:'bold'}},
    didParseCell: (data) => {
      const isTotal = data.row.index===rekapRows.length-1;
      const isBelum = d.belumAbsen>0 && data.row.index===rekapRows.length-2;
      if(isTotal){
        data.cell.styles.fillColor=[30,58,138];
        data.cell.styles.textColor=255;
        data.cell.styles.fontStyle='bold';
        data.cell.styles.fontSize=10;
      } else if(isBelum){
        data.cell.styles.fillColor=[254,243,199];
        data.cell.styles.textColor=[146,64,14];
      }
    }
  });

  // Footer
  const pages = doc.getNumberOfPages();
  for(let i=1;i<=pages;i++){
    doc.setPage(i); doc.setFontSize(7.5); doc.setFont('helvetica','normal'); doc.setTextColor(150);
    doc.text(`Dicetak: ${new Date().toLocaleString('id-ID',{timeZone:'Asia/Jayapura'})} | Halaman ${i}/${pages}`, PW/2, 290, {align:'center'});
  }
  doc.save(`Laporan_Absensi_${d.shift}_${d.tgl}.pdf`);
  showAlert('success','Berhasil','PDF berhasil diunduh.');
}
