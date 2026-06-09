// SIMAWAR user.js v8c — absen hadir+keterangan, tanpa sesi rupam
let currentUser=null, selectedKamar=null, selectedShift=null;
let absenData={}, wbpList=[];

async function init(){
  setTimeout(()=>{const s=document.getElementById('splashScreen');if(s){s.style.opacity='0';setTimeout(()=>s.remove(),500);}},800);
  const swId=sessionStorage.getItem('sw_id');
  if(!swId){location.href='index.html';return;}
  const{data:p}=await sb.from('pegawai').select('id,nama,username,password_plain,is_admin').eq('id',swId).maybeSingle();
  if(!p){sessionStorage.clear();location.href='index.html';return;}
  currentUser=p;
  document.getElementById('headerUname').textContent=p.nama;
  document.getElementById('headerAvatar').textContent=p.nama?.[0]?.toUpperCase()||'P';
  document.getElementById('headerDate').textContent=new Date().toLocaleDateString('id-ID',{weekday:'long',day:'numeric',month:'long',year:'numeric',timeZone:'Asia/Jayapura'});
  const today=todayWIT();
  document.getElementById('myRiwayatDari').value=today;
  document.getElementById('myRiwayatSampai').value=today;
  document.getElementById('myRiwayatPreset').value='today';
  setSimpanBtn(false);
  // Load status dari DB (fallback ke default jika tabel belum ada)
  await loadStatusList().catch(()=>{ console.log('status_absen table not found, using defaults'); });
  ['userPwdBaru','userPwdKonfirm'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
  loadSiteConfigUser().catch(()=>{});
  // Restore halaman terakhir (agar tidak kembali ke awal saat refresh)
  const lastPage = sessionStorage.getItem('sw_user_page') || 'dashboard';
  goPage(lastPage);
}

async function loadSiteConfigUser(){
  await applySiteIdentity({
    pageTitle: 'Petugas',
    sidebarLogo: 'sidebarLogo',
    sidebarName: 'sidebarName'
  });
  if (typeof window.updateManifestFromDB === 'function') window.updateManifestFromDB();
}

function goPage(page){
  document.querySelectorAll('.page-section').forEach(s=>s.classList.remove('active'));
  document.getElementById('page-'+page)?.classList.add('active');
  ['dashboard','absen','riwayat','laporan','aplikasi','profil'].forEach(id=>document.getElementById('nav-'+id)?.classList.toggle('active',id===page));
  const T={dashboard:'Dashboard',absen:'Absensi WBP',riwayat:'Riwayat',laporan:'Laporan',aplikasi:'Aplikasi',profil:'Profil'};
  document.getElementById('headerTitle').textContent=T[page]||page;
  // Simpan halaman aktif agar refresh tidak kembali ke menu awal
  sessionStorage.setItem('sw_user_page', page);
  closeSidebar();
  if(page==='dashboard')loadUserDashboard();
  if(page==='absen'){loadKamarPicker();} // load otomatis saat buka absen
  if(page==='riwayat'){loadMyRiwayatFilter();loadMyRiwayat();}
  if(page==='laporan')loadLaporan();
  if(page==='aplikasi')loadAplikasiUser();
  if(page==='profil')loadProfil();
}
function toggleSidebar(){document.getElementById('sidebar').classList.toggle('open');document.getElementById('mobileOverlay').classList.toggle('show');}
function closeSidebar(){document.getElementById('sidebar').classList.remove('open');document.getElementById('mobileOverlay').classList.remove('show');}
function openModal(id){const m=document.getElementById(id);m.style.display='flex';requestAnimationFrame(()=>m.classList.add('show'));}
function closeModal(id){const m=document.getElementById(id);m.classList.remove('show');setTimeout(()=>m.style.display='none',300);}
function togglePwd(id){const f=document.getElementById(id);if(!f)return;f.type=f.type==='password'?'text':'password';}
async function doLogout(){showConfirm('Keluar','Yakin ingin keluar?',async()=>{sessionStorage.clear();try{await sb.auth.signOut();}catch(e){}location.href='index.html';});}

// ── DASHBOARD ─────────────────────────────────────────────────
async function loadUserDashboard(){
  const today=todayWIT();
  const[wR,bR,aR]=await Promise.all([
    sb.from('wbp').select('id',{count:'exact',head:true}),
    sb.from('blok').select('id',{count:'exact',head:true}),
    sb.from('absen_detail').select('id',{count:'exact',head:true}).eq('tanggal',today)
  ]);
  document.getElementById('dashUserStatWbp').textContent=wR.count||0;
  document.getElementById('dashUserStatBlok').textContent=bR.count||0;
  document.getElementById('dashUserStatAbsen').textContent=aR.count||0;
  document.getElementById('dashUserDate').textContent=new Date().toLocaleDateString('id-ID',{weekday:'long',day:'numeric',month:'long',year:'numeric',timeZone:'Asia/Jayapura'});
  // Status shift
  const shiftEl=document.getElementById('dashShiftStatus');
  if(shiftEl){
    const{data:sd}=await sb.from('absen_detail').select('shift').eq('tanggal',today);
    const done=new Set((sd||[]).map(d=>d.shift));
    shiftEl.innerHTML=['Pagi','Siang','Malam'].map(sh=>{const ok=done.has(sh);return`<span style="display:inline-flex;align-items:center;gap:5px;padding:6px 14px;border-radius:20px;font-size:12px;font-weight:700;background:${ok?SHIFT_BG[sh]:'#f1f5f9'};color:${ok?SHIFT_TC[sh]:'#94a3b8'};border:1.5px solid ${ok?SHIFT_COLOR[sh]:'#e2e8f0'}">${SHIFT_ICON[sh]} ${sh}: ${ok?'✅':'⏳'}</span>`;}).join('');
  }
  // Status kamar
  const container=document.getElementById('dashKamarStatus');
  if(!container)return;
  container.innerHTML='<div style="height:50px;background:#f1f5f9;border-radius:10px;animation:swpulse 1.5s infinite"></div>'.repeat(2);
  const[blokRes,wbpRes,absenRes]=await Promise.all([
    sb.from('blok').select('id,nama'),
    sb.from('wbp').select('id,nama,blok_id'),
    sb.from('absen_detail').select('wbp_id,shift').eq('tanggal',today)
  ]);
  const bloks=blokRes.data||[],allWbp=wbpRes.data||[];
  const absenMap={};(absenRes.data||[]).forEach(a=>{if(!absenMap[a.wbp_id])absenMap[a.wbp_id]=[];absenMap[a.wbp_id].push(a.shift);});
  const currentShift=getShiftNow();
  if(!bloks.length){container.innerHTML=`<div style="padding:20px;text-align:center;color:#94a3b8;font-size:13px">Belum ada kamar</div>`;return;}
  container.innerHTML=bloks.map(b=>{
    const wbpBlok=allWbp.filter(w=>w.blok_id===b.id);
    const total=wbpBlok.length;
    const belumShift=wbpBlok.filter(w=>!(absenMap[w.id]||[]).includes(currentShift));
    const sudah=total-belumShift.length;
    const selesai=belumShift.length===0&&total>0;
    return`<div style="border:1.5px solid ${selesai?'#86efac':'#e2e8f0'};border-radius:12px;padding:10px 14px;background:${selesai?'#f0fdf4':'white'};margin-bottom:8px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
        <div style="font-size:13px;font-weight:800;color:#1e293b">${b.nama}</div>
        <div style="display:flex;gap:4px">${['Pagi','Siang','Malam'].map(sh=>{const c=wbpBlok.filter(w=>(absenMap[w.id]||[]).includes(sh)).length;return`<span style="font-size:10px;font-weight:700;padding:2px 6px;border-radius:8px;background:${c>0?SHIFT_BG[sh]:'#f1f5f9'};color:${c>0?SHIFT_TC[sh]:'#94a3b8'}">${SHIFT_ICON[sh]}${c>0?` ${c}`:''}</span>`;}).join('')}</div>
      </div>
      <div style="height:5px;background:#f1f5f9;border-radius:100px;overflow:hidden;margin-bottom:5px"><div style="height:100%;width:${total?Math.round(sudah/total*100):0}%;background:${selesai?'#10b981':'linear-gradient(90deg,#3b82f6,#6366f1)'};border-radius:100px;transition:width .3s"></div></div>
      <div style="font-size:11px;color:#94a3b8">${sudah}/${total} WBP | Shift ${currentShift}: ${selesai?'✅ Selesai':`⏳ ${belumShift.length} belum`}</div>
      ${belumShift.length>0?`<div style="font-size:10px;color:#ef4444;font-weight:600;margin-top:4px">Belum: ${belumShift.map(w=>w.nama).join(', ')}</div>`:''}
    </div>`;
  }).join('');
}

// ── PILIH SHIFT & KAMAR ───────────────────────────────────────
async function loadKamarPicker(){
  const shiftNow=getShiftNow();
  const picker=document.getElementById('shiftPicker');
  if(picker){
    picker.innerHTML=['Pagi','Siang','Malam'].map(sh=>`
      <button onclick="pilihShift('${sh}')" id="shiftBtn_${sh}"
        style="flex:1;padding:14px 8px;border-radius:12px;border:2px solid ${sh===shiftNow?SHIFT_COLOR[sh]:'#e2e8f0'};
        background:${sh===shiftNow?SHIFT_BG[sh]:'white'};color:${sh===shiftNow?SHIFT_TC[sh]:'#64748b'};
        font-size:13px;font-weight:800;cursor:pointer;transition:all .18s">
        <div style="font-size:22px;margin-bottom:4px">${SHIFT_ICON[sh]}</div>
        <div>${sh}</div>
        <div style="font-size:9px;font-weight:600;margin-top:3px;opacity:.8">${sh==='Pagi'?'s.d. 08.00':sh==='Siang'?'s.d. 14.00':'s.d. 20.00'}</div>
      </button>`).join('');
  }
  // Set shift sesuai jam sekarang, langsung load kamar
  selectedShift=shiftNow;
  const lbl=document.getElementById('shiftLabel');if(lbl)lbl.textContent=`Kamar — Shift ${shiftNow}`;
  await loadKamarGrid(shiftNow);
}
function pilihShift(sh){
  selectedShift=sh;
  document.getElementById('shiftLabel').textContent=`Kamar — Shift ${sh}`;
  ['Pagi','Siang','Malam'].forEach(s=>{
    const btn=document.getElementById('shiftBtn_'+s);if(!btn)return;
    btn.style.borderColor=s===sh?SHIFT_COLOR[sh]:'#e2e8f0';
    btn.style.background=s===sh?SHIFT_BG[sh]:'white';
    btn.style.color=s===sh?SHIFT_TC[sh]:'#64748b';
  });
  loadKamarGrid(sh);
}

async function loadKamarGrid(shift){
  const grid=document.getElementById('kamarPickerGrid');
  grid.innerHTML='<div style="height:90px;background:#f1f5f9;border-radius:14px;animation:swpulse 1.5s infinite"></div>'.repeat(3);
  const today=todayWIT();
  const[blokRes,doneRes]=await Promise.all([
    sb.from('blok').select('id,nama,kapasitas'),
    sb.from('absen_detail').select('blok_id').eq('tanggal',today).eq('shift',shift)
  ]);
  const bloks=blokRes.data||[];
  const doneBlokCnt={};(doneRes.data||[]).forEach(d=>{doneBlokCnt[d.blok_id]=(doneBlokCnt[d.blok_id]||0)+1;});
  if(!bloks.length){grid.innerHTML=`<div style="grid-column:1/-1">${emptyState('Belum Ada Kamar')}</div>`;return;}
  const wbpCounts=await Promise.all(bloks.map(b=>sb.from('wbp').select('id',{count:'exact',head:true}).eq('blok_id',b.id)));

  grid.innerHTML=bloks.map((b,i)=>{
    const cnt=wbpCounts[i]?.count||0;
    const absenCount=doneBlokCnt[b.id]||0;
    const kamarSelesai=absenCount>0&&absenCount>=cnt&&cnt>0;
    if(kamarSelesai)return`<div class="kamar-card done" onclick="showAlert('info','Selesai','Absensi ${shift} ${b.nama} sudah selesai.')"><div style="font-size:22px;margin-bottom:6px">✅</div><div style="font-size:13px;font-weight:800">${b.nama}</div><div style="font-size:10px;color:#16a34a;font-weight:600;margin-top:4px">Shift ${shift} selesai</div></div>`;
    return`<div class="kamar-card clickable" onclick="pilihKamar('${b.id}','${b.nama}')"><div style="font-size:22px;margin-bottom:6px">🏠</div><div style="font-size:13px;font-weight:800">${b.nama}</div><div style="font-size:11px;color:#94a3b8;margin-top:3px">${cnt} WBP · ${absenCount} sudah absen</div></div>`;
  }).join('');
}

async function pilihKamar(blokId,blokNama){
  selectedKamar={id:blokId,nama:blokNama};absenData={};
  document.getElementById('step1').style.display='none';
  document.getElementById('step2').style.display='block';
  document.getElementById('step2KamarTitle').textContent=`${blokNama}`;
  document.getElementById('step2ShiftBadge').innerHTML=shiftBadge(selectedShift);
  document.getElementById('step2Tanggal').textContent=new Date().toLocaleString('id-ID',{timeZone:'Asia/Jayapura',dateStyle:'full',timeStyle:'short'});
  setSimpanBtn(false);
  // Load status dari DB (fallback ke default jika tabel belum ada)
  await loadStatusList().catch(()=>{ console.log('status_absen table not found, using defaults'); });
  await loadWbpUntukAbsen(blokId);
}

async function loadWbpUntukAbsen(blokId){
  const grid=document.getElementById('wbpAbsenGrid');
  grid.innerHTML='<div style="height:260px;background:#f1f5f9;border-radius:14px;animation:swpulse 1.5s infinite"></div>'.repeat(3);
  const sw=document.getElementById('simpanWrap');if(sw)sw.style.display='none';
  // Pastikan status list ready
  await loadStatusList().catch(()=>{});
  const today=todayWIT();
  // Load WBP + data sudah absen PARAREL
  const [wbpRes,sudahRes]=await Promise.all([
    sb.from('wbp').select('id,nama,no_registrasi,kasus,masa_pidana,tgl_bebas').eq('blok_id',blokId).order('nama'),
    sb.from('absen_detail').select('id,wbp_id,status,keterangan').eq('tanggal',today).eq('shift',selectedShift)
  ]);
  wbpList=wbpRes.data||[];
  if(!wbpList.length){grid.innerHTML=`<div style="grid-column:1/-1">${emptyState('Tidak Ada WBP','Belum ada WBP di kamar ini')}</div>`;setSimpanBtn(false);return;}
  // Build absenData dari sudahData
  absenData={};
  const wbpIds=new Set(wbpList.map(w=>w.id));
  (sudahRes.data||[]).filter(a=>wbpIds.has(a.wbp_id)).forEach(a=>{
    absenData[a.wbp_id]={id:a.id,status:a.status,keterangan:a.keterangan||'',sudahAbsen:true};
  });
  renderKartu();updateProgress();cekSimpanBolehAktif();
}

function renderKartu(){
  const grid=document.getElementById('wbpAbsenGrid');
  grid.innerHTML=wbpList.map(w=>{
    const d=absenData[w.id]||{};
    const hadir=!!d.status;
    let expStr='',expColor='#64748b',expWarn=false;
    if(w.tgl_bebas){const tgl=new Date(w.tgl_bebas+'T00:00:00'),sisa=Math.ceil((tgl-new Date())/(1000*60*60*24));const bln=['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];expStr=`${String(tgl.getDate()).padStart(2,'0')} ${bln[tgl.getMonth()]} ${tgl.getFullYear()}`;expWarn=sisa<=90;expColor=sisa<=30?'#dc2626':sisa<=90?'#f59e0b':'#64748b';}
    const wname=w.nama.replace(/'/g,"\\'").replace(/"/g,'&quot;');
    return`<div class="wbp-card ${hadir?'hadir':''}" id="wcard-${w.id}"
      onclick="setHadir('${w.id}','${wname}')"
      style="cursor:pointer;border:2.5px solid ${hadir?'#10b981':'#e2e8f0'};border-radius:14px;overflow:hidden;background:white;transition:all .2s;position:relative;box-shadow:${hadir?'0 4px 12px rgba(16,185,129,.18)':'0 1px 3px rgba(0,0,0,.05)'}">
      <div style="position:relative">
        ${hadir?`<div style="position:absolute;top:8px;right:8px;z-index:2;background:#10b981;border-radius:50%;width:28px;height:28px;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(16,185,129,.4)"><svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" style="width:14px;height:14px"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5"/></svg></div>`:`<div style="position:absolute;top:8px;right:8px;z-index:2;background:#1e40af;color:white;border-radius:14px;padding:4px 12px;font-size:10px;font-weight:800;letter-spacing:.4px;box-shadow:0 2px 6px rgba(30,64,175,.3)">📋 ABSEN</div>`}
        <div style="width:100%;aspect-ratio:1/1;background:linear-gradient(135deg,#dbeafe,#e0e7ff);display:flex;align-items:center;justify-content:center"><span style="font-size:48px;font-weight:900;color:rgba(59,130,246,.22)">${w.nama?.[0]||'?'}</span></div>
        <div style="background:linear-gradient(135deg,#1e3a8a,#1e40af);color:white;font-size:12px;font-weight:800;text-align:center;padding:6px 8px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${w.nama}</div>
      </div>
      <div style="padding:8px 10px 0">
        <div style="font-size:10px;color:#94a3b8">${w.no_registrasi||'—'}</div>
        ${w.masa_pidana?`<div style="font-size:10px;font-weight:700;color:#1e293b;margin-top:2px"><span style="color:#94a3b8;font-weight:400">Putusan: </span>${w.masa_pidana}</div>`:''}
      </div>
      ${w.tgl_bebas?`<div style="margin:6px 8px 0;padding:5px 8px;border-radius:8px;background:${expWarn?'#fef2f2':'#f8fafc'};border:1px solid ${expWarn?'#fecaca':'#e2e8f0'};text-align:center"><div style="font-size:9px;font-weight:700;color:${expColor};text-transform:uppercase">Bebas</div><div style="font-size:12px;font-weight:900;color:${expColor}">${expStr}</div></div>`:''}
      ${hadir?`<div style="margin:6px 8px 8px;padding:7px 10px;background:#d1fae5;border-radius:10px;font-size:11px;font-weight:700;color:#065f46;text-align:center">✓ ${d.status||'Ada'}${d.keterangan?' • '+d.keterangan:''}</div>`:'<div style="height:8px"></div>'}
    </div>`;
  }).join('');
}

function setHadir(wbpId, wbpNama){
  // Buka modal pilih status (WBP belum dianggap absen sampai pilih status)
  document.getElementById('ketWbpId').value=wbpId;
  document.getElementById('ketWbpName').textContent=wbpNama;
  document.getElementById('ketDetail').value='';
  // Render tombol status dari DB
  renderStatusPicker('ketOpsiGrid', absenData[wbpId]);
  openModal('ketModal');
}

function renderStatusPicker(containerId, existingData){
  const cont=document.getElementById(containerId);if(!cont)return;
  const statusList=getStatusList();
  const list=statusList?.length?statusList:['Ada','Di Bengkel','Di Kebun','Di Rumah Sakit'];
  cont.innerHTML=list.map(s=>`<button type="button" class="ket-opsi-btn" data-val="${s}" onclick="pilihAlasan(this)">${s}</button>`).join('');
  if(existingData?.status){
    const btn=cont.querySelector(`.ket-opsi-btn[data-val="${existingData.status}"]`);
    if(btn)btn.classList.add('active');
    if(existingData.keterangan){
      const ket=document.getElementById('ketDetail');if(ket)ket.value=existingData.keterangan;
    }
  }
}
function pilihAlasan(btn){document.querySelectorAll('.ket-opsi-btn').forEach(b=>b.classList.remove('active'));btn.classList.add('active');}
function saveKeterangan(){
  const wbpId=document.getElementById('ketWbpId').value;
  const aktif=document.querySelector('#ketOpsiGrid .ket-opsi-btn.active');
  if(!aktif){showAlert('warning','Pilih Status','Pilih status WBP terlebih dahulu.');return;}
  const detail=document.getElementById('ketDetail').value.trim();
  const statusDipilih=aktif.dataset.val;
  absenData[wbpId]={...(absenData[wbpId]||{}),status:statusDipilih,keterangan:detail||null};
  closeModal('ketModal');updateProgress();renderKartu();cekSimpanBolehAktif();
}
function tutupKetModal(){
  // Jika WBP sudah punya status → boleh tutup (ubah/batalkan)
  // Jika belum ada status → jangan tutup (paksa pilih dulu)
  const wbpId=document.getElementById('ketWbpId').value;
  if(!absenData[wbpId]?.status){
    showAlert('info','Pilih Status','Pilih status WBP terlebih dahulu sebelum menutup.');
    return;
  }
  closeModal('ketModal');
}

function updateProgress(){
  const total=wbpList.length;
  const wbpIdSet=new Set(wbpList.map(w=>w.id));
  const sudahCount=Object.entries(absenData).filter(([id,d])=>wbpIdSet.has(id)&&d.status).length;
  const pct=total?Math.round(sudahCount/total*100):0;
  const pb=document.getElementById('progressBar');if(pb)pb.style.width=pct+'%';
  const pt=document.getElementById('progressText');if(pt)pt.textContent=`${sudahCount} / ${total}`;
  const elH=document.getElementById('cntHadir');if(elH)elH.textContent=`${sudahCount} Sudah`;
  const elT=document.getElementById('cntTidak');if(elT)elT.style.display='none';
  const elB=document.getElementById('cntBelum');if(elB)elB.textContent=`${total-sudahCount} Belum`;
  const ph=document.getElementById('progressHint');
  if(ph)ph.textContent=sudahCount===total&&total>0?'✅ Semua WBP sudah diabsen. Klik Simpan.':'Tap tombol "Absen" pada setiap WBP untuk mengaktifkan tombol Simpan.';
}
function cekSimpanBolehAktif(){
  const semuaDitandai=wbpList.every(w=>absenData[w.id]?.status);
  const adaBaru=wbpList.some(w=>absenData[w.id]&&!absenData[w.id].sudahAbsen);
  setSimpanBtn(semuaDitandai&&adaBaru);
  const sw=document.getElementById('simpanWrap');if(sw)sw.style.display=semuaDitandai&&adaBaru?'block':'none';
}
function setSimpanBtn(aktif){const btn=document.getElementById('btnSubmit');if(!btn)return;btn.disabled=!aktif;btn.style.opacity=aktif?'1':'0.45';btn.style.cursor=aktif?'pointer':'not-allowed';}

async function backToStep1(){
  const adaBaru=wbpList.some(w=>absenData[w.id]&&!absenData[w.id].sudahAbsen);
  if(adaBaru)showConfirm('Kembali','Data belum disimpan akan hilang.',async()=>resetStep(),'warning');
  else resetStep();
}
function resetStep(){
  selectedKamar=null;absenData={};wbpList=[];
  document.getElementById('step2').style.display='none';document.getElementById('step1').style.display='block';
  const sw=document.getElementById('simpanWrap');if(sw)sw.style.display='none';setSimpanBtn(false);
  loadKamarGrid(selectedShift||getShiftNow());
}

async function submitAbsen(){
  const today=todayWIT();
  const newEntries=wbpList.filter(w=>absenData[w.id]&&!absenData[w.id].sudahAbsen);
  if(!newEntries.length){showAlert('info','Info','Tidak ada data baru.');return;}
  // Cek duplikat
  const{data:already}=await sb.from('absen_detail').select('wbp_id,wbp:wbp_id(nama)').eq('tanggal',today).eq('shift',selectedShift).in('wbp_id',newEntries.map(w=>w.id));
  if(already?.length){showAlert('warning','Sudah Ada',`${already.map(a=>a.wbp?.nama||'WBP').join(', ')} sudah diabsen shift ${selectedShift}.`);await loadWbpUntukAbsen(selectedKamar.id);return;}
  showConfirm('Simpan Absensi',`Simpan absensi Shift ${selectedShift} — ${selectedKamar.nama}?`,async()=>{
    const btn=document.getElementById('btnSubmit');btn.disabled=true;btn.style.opacity='0.5';btn.textContent='Menyimpan...';
    try{
      const now=new Date().toISOString();
      const rows=newEntries.map(w=>({pegawai_id:currentUser.id,blok_id:selectedKamar.id,wbp_id:w.id,tanggal:today,shift:selectedShift,waktu:now,status:absenData[w.id].status||'Ada',keterangan:absenData[w.id].keterangan||null}));
      const{error}=await sb.from('absen_detail').insert(rows);
      if(error){if(error.code==='23505')showAlert('warning','Duplikat','Sebagian WBP sudah diabsen shift ini.');else showAlert('error','Gagal','Terjadi kesalahan.');await loadWbpUntukAbsen(selectedKamar.id);return;}
      showAlert('success','Tersimpan!',`Absensi Shift ${selectedShift} — ${selectedKamar.nama} berhasil.`);resetStep();
    }catch(e){showAlert('error','Gagal','Terjadi kesalahan.');}
    finally{if(btn){btn.disabled=false;btn.style.opacity='1';btn.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5"/></svg> Simpan Absensi';}}
  });
}

// ── RIWAYAT ──────────────────────────────────────────────────
async function loadMyRiwayatFilter(){
  const bs=document.getElementById('myRiwayatBlok');if(bs?.options.length<=1){const{data:bl}=await sb.from('blok').select('id,nama').order('nama');bl?.forEach(b=>bs.add(new Option(b.nama,b.id)));}
}
async function loadMyRiwayat(){
  const search=(document.getElementById('myRiwayatSearch')?.value||'').trim();
  const dari=document.getElementById('myRiwayatDari')?.value||'';
  const sampai=document.getElementById('myRiwayatSampai')?.value||'';
  const blokId=document.getElementById('myRiwayatBlok')?.value||'';
  const shiftF=document.getElementById('myRiwayatShift')?.value||'';
  const preset=document.getElementById('myRiwayatPreset')?.value||'';
  const tbody=document.getElementById('myRiwayatBody');
  tbody.innerHTML=`<tr><td colspan="9" style="padding:16px">${'<div style="height:34px;background:#f1f5f9;border-radius:8px;margin-bottom:6px;animation:swpulse 1.5s infinite"></div>'.repeat(4)}</td></tr>`;
  let realDari=dari,realSampai=sampai;
  if(preset==='today'){realDari=realSampai=todayWIT();}
  else if(preset==='month'){const d=new Date();const y=d.getFullYear();const m=String(d.getMonth()+1).padStart(2,'0');realDari=`${y}-${m}-01`;realSampai=todayWIT();}
  let q=sb.from('absen_detail').select('id,waktu,tanggal,shift,status,keterangan,wbp:wbp_id(nama,no_registrasi),blok:blok_id(nama),pegawai:pegawai_id(nama)').order('waktu',{ascending:false}).limit(150);
  if(realDari)q=q.gte('tanggal',realDari);if(realSampai)q=q.lte('tanggal',realSampai);if(blokId)q=q.eq('blok_id',blokId);if(shiftF)q=q.eq('shift',shiftF);
  const{data}=await q;
  let rows=data||[];
  if(search)rows=rows.filter(r=>(r.wbp?.nama||'').toLowerCase().includes(search.toLowerCase())||(r.pegawai?.nama||'').toLowerCase().includes(search.toLowerCase()));
  window._myRiwayatData=rows;
  document.getElementById('myRiwayatCount').textContent=`${rows.length} data`;
  const expBtn=document.getElementById('btnExportRiwayat');if(expBtn)expBtn.disabled=!rows.length;
  if(!rows.length){tbody.innerHTML=`<tr><td colspan="9" style="padding:48px;text-align:center;color:#94a3b8">Belum ada data</td></tr>`;return;}
  tbody.innerHTML=rows.map((row,i)=>`<tr style="border-bottom:1px solid #f1f5f9">
    <td style="padding:9px 12px;font-size:12px;color:#94a3b8">${i+1}</td>
    <td style="padding:9px 12px;font-size:11px;color:#64748b;white-space:nowrap">${formatWIT(row.waktu)}</td>
    <td style="padding:9px 12px">${shiftBadge(row.shift||'Pagi')}</td>
    <td style="padding:9px 12px;font-size:12px;font-weight:600">${row.pegawai?.nama||'—'}</td>
    <td style="padding:9px 12px"><span style="background:#dbeafe;color:#1d4ed8;padding:2px 7px;border-radius:10px;font-size:11px;font-weight:600">${row.blok?.nama||'—'}</span></td>
    <td style="padding:9px 12px"><div style="font-size:12px;font-weight:700">${row.wbp?.nama||'—'}</div><div style="font-size:10px;color:#94a3b8">${row.wbp?.no_registrasi||''}</div></td>
    <td style="padding:9px 12px">${statusBadge(row.status)}</td>
    <td style="padding:9px 12px;font-size:12px;color:#64748b;max-width:100px">${row.keterangan||'—'}</td>
    <td style="padding:9px 12px"><button class="btn btn-warning btn-sm btn-icon" onclick="editMyAbsen('${row.id}','${(row.keterangan||'').replace(/'/g,"\\'")}')" title="Edit Keterangan"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-3.5 h-3.5"><path stroke-linecap="round" stroke-linejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z"/></svg></button></td>
  </tr>`).join('');
}
function editMyAbsen(id,status,ket){
  document.getElementById('editMyAbsenId').value=id;
  document.getElementById('editMyAbsenKetExtra').value=ket||'';
  renderStatusPicker('editMyAbsenOpsiGrid', status?{status,keterangan:ket}:null);
  openModal('editMyAbsenModal');
}
async function saveMyAbsen(){
  const id=document.getElementById('editMyAbsenId').value;
  const aktif=document.querySelector('#editMyAbsenOpsiGrid .ket-opsi-btn.active');
  const extra=document.getElementById('editMyAbsenKetExtra')?.value.trim()||'';
  if(!aktif){showAlert('warning','Pilih Status','Pilih status terlebih dahulu.');return;}
  const{error}=await sb.from('absen_detail').update({status:aktif.dataset.val,keterangan:extra||null}).eq('id',id);
  if(error){showAlert('error','Gagal',error.message);return;}
  showAlert('success','Diperbarui','Data diperbarui.');closeModal('editMyAbsenModal');loadMyRiwayat();
}
async function deleteMyAbsen(id){
  showConfirm('Hapus Data','Yakin hapus data absensi ini?',async()=>{
    const{error}=await sb.from('absen_detail').delete().eq('id',id);
    if(error){showAlert('error','Gagal',error.message);return;}
    showAlert('success','Dihapus','Data absensi dihapus.');loadMyRiwayat();
  });
}

function setPreset(val, reload=true){
  const el=document.getElementById('myRiwayatPreset');if(el)el.value=val;
  const btns={today:'userPresetToday',month:'userPresetMonth',custom:'userPresetCustom'};
  Object.entries(btns).forEach(([k,id])=>{
    const btn=document.getElementById(id);if(!btn)return;
    const active=k===val;
    btn.style.background=active?'#1e40af':'white';
    btn.style.color=active?'white':'#64748b';
    btn.style.borderColor=active?'#1e40af':'#e2e8f0';
    btn.style.fontWeight=active?'800':'600';
  });
  const datePickers=document.querySelectorAll('#myRiwayatDari,#myRiwayatSampai');
  datePickers.forEach(el=>{if(el)el.style.display=val==='custom'?'':'none';});
  if(reload)loadMyRiwayat();
}
function resetMyRiwayat(){
  const today=todayWIT();
  ['myRiwayatSearch','myRiwayatBlok','myRiwayatShift'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
  document.getElementById('myRiwayatDari').value=today;
  document.getElementById('myRiwayatSampai').value=today;
  document.getElementById('myRiwayatPreset').value='today';
  setPreset('today');
}
async function exportRiwayatUser(){
  const data=window._myRiwayatData;if(!data?.length){showAlert('warning','Tidak Ada Data','Tidak ada data.');return;}
  const dari=document.getElementById('myRiwayatDari')?.value||'',sampai=document.getElementById('myRiwayatSampai')?.value||'';
  try{const{jsPDF}=window.jspdf;const doc=new jsPDF({orientation:'landscape'});doc.setFontSize(14);doc.setFont('helvetica','bold');doc.text('LAPORAN ABSENSI WBP',148,14,{align:'center'});doc.setFontSize(9);doc.setFont('helvetica','normal');doc.text(`Periode: ${dari} s.d. ${sampai}`,148,21,{align:'center'});doc.line(14,24,283,24);
  doc.autoTable({startY:28,head:[['No','Waktu','Shift','Petugas','Kamar','WBP','No.Reg','Status','Keterangan']],body:data.map((r,i)=>[i+1,formatWIT(r.waktu),r.shift||'—',r.pegawai?.nama||'—',r.blok?.nama||'—',r.wbp?.nama||'—',r.wbp?.no_registrasi||'—',r.status||'—',r.keterangan||'—']),styles:{fontSize:7,cellPadding:2},headStyles:{fillColor:[30,64,175],textColor:255,fontStyle:'bold'},alternateRowStyles:{fillColor:[248,250,252]}});
  doc.save(`absensi_${dari}_${sampai}.pdf`);showAlert('success','Berhasil','PDF diunduh.');}catch(e){showAlert('error','Gagal','Gagal buat PDF.');}
}

// ── APLIKASI / PWA ───────────────────────────────────────────
async function loadAplikasiUser(){
  // Update nama aplikasi dari DB
  try {
    const data = await loadSiteIdentity();
    const name = data.site_name || 'E-PRESINA';
    const el1 = document.getElementById('userAppName'); if(el1) el1.textContent = name;
    const el2 = document.getElementById('userAppNameDesc'); if(el2) el2.textContent = name;
  } catch(e){}
  updateUserPwaStatus();
  window.addEventListener('pwa-installable', updateUserPwaStatus);
  window.addEventListener('pwa-installed', updateUserPwaStatus);
}
function updateUserPwaStatus(){
  const box = document.getElementById('userPwaStatusBox');
  const btn = document.getElementById('userBtnInstallPwa');
  if(!box||!btn)return;
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
  if(isStandalone){
    box.innerHTML = '<div style="background:#d1fae5;border:1px solid #86efac;color:#065f46;padding:10px 12px;border-radius:10px;font-size:12px;font-weight:700">✅ Aplikasi sudah terinstall dan sedang berjalan.</div>';
    btn.disabled = true; btn.textContent = 'Sudah Terinstall'; btn.style.opacity = '0.5';
  } else if(window._pwaCanInstall){
    box.innerHTML = '<div style="background:#fef3c7;border:1px solid #fde68a;color:#92400e;padding:10px 12px;border-radius:10px;font-size:12px;font-weight:700">📲 Aplikasi siap untuk diinstall. Klik tombol di bawah.</div>';
    btn.disabled = false; btn.style.opacity = '1';
  } else {
    box.innerHTML = '<div style="background:#fee2e2;border:1px solid #fecaca;color:#991b1b;padding:10px 12px;border-radius:10px;font-size:12px;font-weight:600">⚠️ Browser belum siap. Buka di Chrome/Edge/Safari, atau ikuti panduan manual.</div>';
    btn.disabled = true; btn.style.opacity = '0.5';
  }
}
async function installPwaUser(){
  if(!window._pwaInstall){showAlert('warning','Tidak Tersedia','Browser tidak mendukung install otomatis.');return;}
  const ok = await window._pwaInstall();
  if(ok){showAlert('success','Berhasil','Aplikasi sedang diinstall.');setTimeout(updateUserPwaStatus,1500);}
  else showAlert('info','Dibatalkan','Install dibatalkan.');
}
async function showAndroidGuideUser(){
  const data = await loadSiteIdentity(); const name = data.site_name || 'E-PRESINA';
  const html = `<div style="font-size:12px;line-height:1.7;color:#374151;text-align:left">
    <div style="font-size:14px;font-weight:800;color:#1e3a8a;margin-bottom:8px">📱 Install di Android (Chrome)</div>
    <ol style="padding-left:20px">
      <li>Buka website ${name} di <strong>Chrome</strong>.</li>
      <li>Tap ikon <strong>⋮ (titik 3)</strong> di pojok kanan atas browser.</li>
      <li>Pilih <strong>"Install app"</strong> atau <strong>"Add to Home screen"</strong>.</li>
      <li>Tap <strong>"Install"</strong> pada popup yang muncul.</li>
      <li>Ikon ${name} akan muncul di home screen.</li>
    </ol>
    <div style="background:#f0fdf4;padding:8px 10px;border-radius:8px;margin-top:10px;font-size:11px;color:#166534">💡 Atau klik tombol "Install ke Perangkat Ini" di atas jika muncul.</div>
  </div>`;
  showConfirm('Panduan Android',html,()=>{},'info');
}
async function showIosGuideUser(){
  const data = await loadSiteIdentity(); const name = data.site_name || 'E-PRESINA';
  const html = `<div style="font-size:12px;line-height:1.7;color:#374151;text-align:left">
    <div style="font-size:14px;font-weight:800;color:#1e3a8a;margin-bottom:8px">🍎 Install di iPhone/iPad (Safari)</div>
    <ol style="padding-left:20px">
      <li>Buka website ${name} di <strong>Safari</strong>.</li>
      <li>Tap ikon <strong>Share (kotak dengan panah ke atas)</strong> di bawah layar.</li>
      <li>Scroll, pilih <strong>"Add to Home Screen"</strong>.</li>
      <li>Tap <strong>"Add"</strong> di pojok kanan atas.</li>
      <li>Ikon ${name} akan muncul di home screen.</li>
    </ol>
    <div style="background:#fff7ed;padding:8px 10px;border-radius:8px;margin-top:10px;font-size:11px;color:#9a3412">⚠️ Hanya bisa di Safari, bukan Chrome iOS.</div>
  </div>`;
  showConfirm('Panduan iOS',html,()=>{},'info');
}

// ── PROFIL ───────────────────────────────────────────────────
async function loadProfil(){
  if(!currentUser)return;
  document.getElementById('profilNama').textContent=currentUser.nama||'—';
  document.getElementById('profilUsername').textContent=currentUser.username||'—';
  const av=document.getElementById('profilAvatar');if(av)av.textContent=currentUser.nama?.[0]?.toUpperCase()||'P';
  ['userPwdBaru','userPwdKonfirm'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
}
async function userSavePassword(){
  const pwd=document.getElementById('userPwdBaru')?.value,konfirm=document.getElementById('userPwdKonfirm')?.value;
  if(!pwd||pwd.length<4){showAlert('warning','Terlalu Pendek','Minimal 4 karakter.');return;}
  if(pwd!==konfirm){showAlert('error','Tidak Cocok','Konfirmasi tidak sesuai.');return;}
  showConfirm('Ganti Password','Yakin?',async()=>{
    const{error}=await sb.from('pegawai').update({password_plain:pwd}).eq('id',currentUser.id);
    if(error){showAlert('error','Gagal','Gagal menyimpan.');return;}
    document.getElementById('userPwdBaru').value='';document.getElementById('userPwdKonfirm').value='';
    showAlert('success','Berhasil','Password diganti.');
  });
}
init();
