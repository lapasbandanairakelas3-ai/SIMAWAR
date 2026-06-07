// SIMAWAR user.js v8 — 3 shift absen per hari
let currentUser=null, selectedKamar=null, selectedShift=null;
let absenData={}, wbpList=[], activeSessionId=null;

async function init(){
  setTimeout(()=>{const s=document.getElementById('splashScreen');if(s){s.style.opacity='0';setTimeout(()=>s.remove(),500);}},900);
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
  ['userPwdBaru','userPwdKonfirm'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
  setSimpanBtn(false);
  loadSiteConfigUser().catch(()=>{});
  loadKamarPicker().catch(()=>{});
}

async function loadSiteConfigUser(){
  const{data}=await sb.from('site_config').select('site_name,logo_url,favicon_url').maybeSingle();
  if(!data)return;
  if(data.site_name){document.title=`Petugas — ${data.site_name}`;document.getElementById('sidebarName').textContent=data.site_name;}
  if(data.logo_url){document.getElementById('sidebarLogoEmoji').style.display='none';const sl=document.getElementById('sidebarLogo');if(!sl.querySelector('img')){const img=document.createElement('img');img.src=data.logo_url;img.style.cssText='width:100%;height:100%;object-fit:cover;border-radius:8px';sl.appendChild(img);}}
  if(data.favicon_url)document.getElementById('faviconEl').href=data.favicon_url;
}

// ── NAV ──────────────────────────────────────────────────────
function goPage(page){
  document.querySelectorAll('.page-section').forEach(s=>s.classList.remove('active'));
  document.getElementById('page-'+page)?.classList.add('active');
  ['dashboard','absen','riwayat','profil'].forEach(id=>document.getElementById('nav-'+id)?.classList.toggle('active',id===page));
  const T={dashboard:'Dashboard',absen:'Absensi WBP',riwayat:'Riwayat',profil:'Profil'};
  document.getElementById('headerTitle').textContent=T[page]||page;
  closeSidebar();
  if(page==='dashboard')loadUserDashboard();
  if(page==='riwayat'){loadMyRiwayatFilter();loadMyRiwayat();}
  if(page==='profil')loadProfil();
}
function toggleSidebar(){document.getElementById('sidebar').classList.toggle('open');document.getElementById('mobileOverlay').classList.toggle('show');}
function closeSidebar(){document.getElementById('sidebar').classList.remove('open');document.getElementById('mobileOverlay').classList.remove('show');}
function openModal(id){const m=document.getElementById(id);m.style.display='flex';requestAnimationFrame(()=>m.classList.add('show'));}
function closeModal(id){const m=document.getElementById(id);m.classList.remove('show');setTimeout(()=>m.style.display='none',300);}
function togglePwd(id){const f=document.getElementById(id);if(!f)return;f.type=f.type==='password'?'text':'password';}
async function doLogout(){if(activeSessionId)await releaseSession();showConfirm('Keluar','Yakin ingin keluar?',async()=>{sessionStorage.clear();try{await sb.auth.signOut();}catch(e){}location.href='index.html';});}

// ── DASHBOARD USER ────────────────────────────────────────────
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

  // Status shift hari ini
  const shiftStatus=document.getElementById('dashShiftStatus');
  if(shiftStatus){
    const{data:shiftData}=await sb.from('absen_detail').select('shift').eq('tanggal',today);
    const done=new Set((shiftData||[]).map(d=>d.shift));
    shiftStatus.innerHTML=['Pagi','Siang','Sore'].map(sh=>{
      const ok=done.has(sh);
      return `<span style="display:inline-flex;align-items:center;gap:5px;padding:6px 12px;border-radius:20px;font-size:12px;font-weight:700;background:${ok?SHIFT_BG[sh]:'#f1f5f9'};color:${ok?SHIFT_TC[sh]:'#94a3b8'};border:1.5px solid ${ok?SHIFT_COLOR[sh]:'#e2e8f0'}">${SHIFT_ICON[sh]} ${sh}: ${ok?'✅':'⏳'}</span>`;
    }).join('');
  }

  // Status per kamar
  const container=document.getElementById('dashKamarStatus');
  container.innerHTML='<div style="height:50px;background:#f1f5f9;border-radius:10px;animation:swpulse 1.5s infinite"></div>'.repeat(2);
  const[blokRes,wbpRes,absenRes]=await Promise.all([
    sb.from('blok').select('id,nama'),
    sb.from('wbp').select('id,nama,blok_id'),
    sb.from('absen_detail').select('wbp_id,shift').eq('tanggal',today)
  ]);
  const bloks=blokRes.data||[], allWbp=wbpRes.data||[];
  const absenMap={};(absenRes.data||[]).forEach(a=>{if(!absenMap[a.wbp_id])absenMap[a.wbp_id]=[];absenMap[a.wbp_id].push(a.shift);});
  const currentShift=getShiftNow();
  if(!bloks.length){container.innerHTML=`<div style="padding:20px;text-align:center;color:#94a3b8;font-size:13px">Belum ada kamar</div>`;return;}
  container.innerHTML=bloks.map(b=>{
    const wbpBlok=allWbp.filter(w=>w.blok_id===b.id);
    const total=wbpBlok.length;
    const belumShiftIni=wbpBlok.filter(w=>!(absenMap[w.id]||[]).includes(currentShift));
    const sudah=total-belumShiftIni.length;
    const selesai=belumShiftIni.length===0&&total>0;
    return `<div style="border:1.5px solid ${selesai?'#86efac':'#e2e8f0'};border-radius:12px;padding:10px 14px;background:${selesai?'#f0fdf4':'white'};margin-bottom:8px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
        <div style="font-size:13px;font-weight:800;color:#1e293b">${b.nama}</div>
        <div style="display:flex;gap:4px">
          ${['Pagi','Siang','Sore'].map(sh=>{const c=wbpBlok.filter(w=>(absenMap[w.id]||[]).includes(sh)).length;return`<span style="font-size:10px;font-weight:700;padding:2px 6px;border-radius:8px;background:${c>0?SHIFT_BG[sh]:'#f1f5f9'};color:${c>0?SHIFT_TC[sh]:'#94a3b8'}">${SHIFT_ICON[sh]}${c>0?` ${c}`:''}</span>`;}).join('')}
        </div>
      </div>
      <div style="height:5px;background:#f1f5f9;border-radius:100px;overflow:hidden;margin-bottom:5px">
        <div style="height:100%;width:${total?Math.round(sudah/total*100):0}%;background:${selesai?'#10b981':'linear-gradient(90deg,#3b82f6,#6366f1)'};border-radius:100px;transition:width .3s"></div>
      </div>
      <div style="font-size:11px;color:#94a3b8">${sudah}/${total} WBP absen shift ${currentShift}</div>
      ${belumShiftIni.length>0?`<div style="font-size:10px;color:#ef4444;font-weight:600;margin-top:4px">Belum: ${belumShiftIni.map(w=>w.nama).join(', ')}</div>`:''}
    </div>`;
  }).join('');
}

// ── STEP 1: PILIH SHIFT + KAMAR ───────────────────────────────
async function loadKamarPicker(){
  const shiftNow=getShiftNow();
  // Tampilkan pilihan shift
  document.getElementById('shiftPicker').innerHTML=['Pagi','Siang','Sore'].map(sh=>`
    <button onclick="pilihShift('${sh}')" id="shiftBtn_${sh}"
      style="flex:1;padding:10px 8px;border-radius:12px;border:2px solid ${sh===shiftNow?SHIFT_COLOR[sh]:'#e2e8f0'};
      background:${sh===shiftNow?SHIFT_BG[sh]:'white'};color:${sh===shiftNow?SHIFT_TC[sh]:'#64748b'};
      font-size:12px;font-weight:800;cursor:pointer;transition:all .18s">
      ${SHIFT_ICON[sh]}<br><span style="font-size:13px">${sh}</span>
    </button>`).join('');
  selectedShift=shiftNow;
  document.getElementById('shiftLabel').textContent=`Shift ${shiftNow}`;
  loadKamarGrid(shiftNow);
}

function pilihShift(sh){
  selectedShift=sh;
  document.getElementById('shiftLabel').textContent=`Shift ${sh}`;
  ['Pagi','Siang','Sore'].forEach(s=>{
    const btn=document.getElementById('shiftBtn_'+s);
    if(!btn)return;
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
  const[blokRes,sessionRes,doneRes]=await Promise.all([
    sb.from('blok').select('id,nama,kapasitas'),
    sb.from('absen_session').select('id,blok_id,pegawai_id').eq('tanggal',today).eq('shift',shift).eq('selesai',false),
    sb.from('absen_detail').select('blok_id').eq('tanggal',today).eq('shift',shift)
  ]);
  const bloks=blokRes.data||[], sessions=sessionRes.data||[];
  const doneBlokCnt={};(doneRes.data||[]).forEach(d=>{doneBlokCnt[d.blok_id]=(doneBlokCnt[d.blok_id]||0)+1;});
  if(!bloks.length){grid.innerHTML=`<div style="grid-column:1/-1">${emptyState('Belum Ada Kamar')}</div>`;return;}
  const wbpCounts=await Promise.all(bloks.map(b=>sb.from('wbp').select('id',{count:'exact',head:true}).eq('blok_id',b.id)));
  grid.innerHTML=bloks.map((b,i)=>{
    const cnt=wbpCounts[i]?.count||0;
    const sesi=sessions.find(s=>s.blok_id===b.id);
    const isMySession=sesi?.pegawai_id===currentUser.id;
    const inUseByOther=sesi&&!isMySession;
    const absenCount=doneBlokCnt[b.id]||0;
    const kamarSelesai=!sesi&&absenCount>0&&absenCount>=cnt&&cnt>0;
    if(kamarSelesai)return`<div class="kamar-card done" onclick="showAlert('info','Selesai','Absensi ${shift} ${b.nama} sudah selesai.')"><div style="font-size:22px;margin-bottom:6px">✅</div><div style="font-size:13px;font-weight:800">${b.nama}</div><div style="font-size:10px;color:#16a34a;font-weight:600;margin-top:4px">Shift ${shift} selesai</div></div>`;
    if(inUseByOther)return`<div class="kamar-card locked" onclick="showAlert('info','Sedang Diproses','${b.nama} shift ${shift} sedang diproses.')"><div style="font-size:22px;margin-bottom:6px">🔒</div><div style="font-size:13px;font-weight:800">${b.nama}</div><div style="font-size:10px;color:#d97706;font-weight:600;margin-top:4px">Sedang diproses</div></div>`;
    if(isMySession)return`<div class="kamar-card my-session clickable" onclick="pilihKamar('${b.id}','${b.nama}','${sesi.id}')"><div style="font-size:22px;margin-bottom:6px">📋</div><div style="font-size:13px;font-weight:800">${b.nama}</div><div style="font-size:10px;color:#3b82f6;font-weight:600;margin-top:4px">Lanjutkan</div></div>`;
    return`<div class="kamar-card clickable" onclick="pilihKamar('${b.id}','${b.nama}',null)"><div style="font-size:22px;margin-bottom:6px">🏠</div><div style="font-size:13px;font-weight:800">${b.nama}</div><div style="font-size:11px;color:#94a3b8;margin-top:3px">${cnt} WBP</div></div>`;
  }).join('');
}

async function pilihKamar(blokId,blokNama,existingSessionId){
  selectedKamar={id:blokId,nama:blokNama};activeSessionId=existingSessionId;absenData={};
  if(!existingSessionId){
    const today=todayWIT();
    const{data:ex}=await sb.from('absen_session').select('id,pegawai_id').eq('blok_id',blokId).eq('tanggal',today).eq('shift',selectedShift).eq('selesai',false).maybeSingle();
    if(ex&&ex.pegawai_id!==currentUser.id){showAlert('info','Sedang Diproses','Kamar ini sedang diproses shift '+selectedShift+'. Pilih kamar lain.');loadKamarGrid(selectedShift);return;}
    if(ex&&ex.pegawai_id===currentUser.id){activeSessionId=ex.id;}
    else{
      const{data:sesi,error}=await sb.from('absen_session').insert({pegawai_id:currentUser.id,blok_id:blokId,tanggal:today,shift:selectedShift,selesai:false}).select('id').single();
      if(error){const{data:rs}=await sb.from('absen_session').select('id,pegawai_id').eq('blok_id',blokId).eq('tanggal',today).eq('shift',selectedShift).eq('selesai',false).maybeSingle();if(rs&&rs.pegawai_id!==currentUser.id){showAlert('info','Sedang Diproses','Kamar baru saja diambil.');loadKamarGrid(selectedShift);return;}if(rs)activeSessionId=rs.id;}
      else activeSessionId=sesi?.id||null;
    }
  }
  document.getElementById('step1').style.display='none';
  document.getElementById('step2').style.display='block';
  document.getElementById('step2KamarTitle').textContent=`${blokNama} — Shift ${selectedShift}`;
  document.getElementById('step2ShiftBadge').innerHTML=shiftBadge(selectedShift);
  document.getElementById('step2Tanggal').textContent=new Date().toLocaleString('id-ID',{timeZone:'Asia/Jayapura',dateStyle:'full',timeStyle:'short'});
  setSimpanBtn(false);
  await loadWbpUntukAbsen(blokId);
}

// ── STEP 2: ABSEN ─────────────────────────────────────────────
async function loadWbpUntukAbsen(blokId){
  const grid=document.getElementById('wbpAbsenGrid');
  grid.innerHTML='<div style="height:220px;background:#f1f5f9;border-radius:14px;animation:swpulse 1.5s infinite"></div>'.repeat(3);
  const sw=document.getElementById('simpanWrap');if(sw)sw.style.display='none';
  const{data:wbps}=await sb.from('wbp').select('id,nama,no_registrasi,kasus,masa_pidana,tgl_bebas').eq('blok_id',blokId).order('nama');
  wbpList=wbps||[];
  if(!wbpList.length){grid.innerHTML=`<div style="grid-column:1/-1">${emptyState('Tidak Ada WBP')}</div>`;setSimpanBtn(false);return;}
  const today=todayWIT();
  const{data:sudahData}=await sb.from('absen_detail').select('id,wbp_id,status,keterangan').eq('tanggal',today).eq('shift',selectedShift).in('wbp_id',wbpList.map(w=>w.id));
  absenData={};
  (sudahData||[]).forEach(a=>{absenData[a.wbp_id]={id:a.id,status:a.status,keterangan:a.keterangan||'',sudahAbsen:true};});
  renderKartu();updateProgressKamar();cekSimpanBolehAktif();
}

function renderKartu(){
  const grid=document.getElementById('wbpAbsenGrid');
  grid.innerHTML=wbpList.map(w=>{
    const d=absenData[w.id]||{};const st=d.status;
    const isDiKamar=st==='Di Kamar';const isLuar=st&&st!=='Di Kamar';
    let expStr='',expColor='#64748b',expWarn=false;
    if(w.tgl_bebas){const tgl=new Date(w.tgl_bebas+'T00:00:00'),sisa=Math.ceil((tgl-new Date())/(1000*60*60*24));const bln=['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];expStr=`${String(tgl.getDate()).padStart(2,'0')} ${bln[tgl.getMonth()]} ${tgl.getFullYear()}`;expWarn=sisa<=90;expColor=sisa<=30?'#dc2626':sisa<=90?'#f59e0b':'#64748b';}
    return`<div class="wbp-card ${isDiKamar?'hadir':isLuar?'tidak':''}" id="wcard-${w.id}">
      <div style="position:relative">
        ${isDiKamar?`<div style="position:absolute;top:8px;right:8px;z-index:2;background:#10b981;border-radius:50%;width:24px;height:24px;display:flex;align-items:center;justify-content:center"><svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" style="width:13px;height:13px"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5"/></svg></div>`:''}
        ${isLuar?`<div style="position:absolute;top:8px;right:8px;z-index:2;background:#f59e0b;border-radius:50%;width:24px;height:24px;display:flex;align-items:center;justify-content:center;font-size:13px">${STATUS_ICON[st]||'📌'}</div>`:''}
        <div style="width:100%;aspect-ratio:1/1;background:linear-gradient(135deg,#dbeafe,#e0e7ff);display:flex;align-items:center;justify-content:center"><span style="font-size:40px;font-weight:900;color:rgba(59,130,246,.18)">${w.nama?.[0]||'?'}</span></div>
        <div style="background:linear-gradient(135deg,#1e3a8a,#1e40af);color:white;font-size:11px;font-weight:800;text-align:center;padding:5px 6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${w.nama}</div>
      </div>
      <div style="padding:8px 10px 0">
        <div style="font-size:10px;color:#94a3b8">${w.no_registrasi||'—'}</div>
        ${w.kasus?`<div style="font-size:10px;color:#64748b;margin-top:3px"><span style="color:#94a3b8">Perkara: </span>${w.kasus}</div>`:''}
        ${w.masa_pidana?`<div style="font-size:10px;font-weight:700;color:#1e293b;margin-top:2px"><span style="color:#94a3b8;font-weight:400">Putusan: </span>${w.masa_pidana}</div>`:''}
      </div>
      ${w.tgl_bebas?`<div style="margin:6px 8px 0;padding:5px 8px;border-radius:8px;background:${expWarn?'#fef2f2':'#f8fafc'};border:1px solid ${expWarn?'#fecaca':'#e2e8f0'};text-align:center"><div style="font-size:9px;font-weight:700;color:${expColor};text-transform:uppercase">Bebas</div><div style="font-size:12px;font-weight:900;color:${expColor}">${expStr}</div></div>`:''}
      ${isLuar&&d.keterangan?`<div style="margin:5px 8px 0;padding:4px 7px;background:#fef3c7;border-radius:7px;font-size:10px;font-weight:600;color:#92400e">📌 ${d.keterangan}</div>`:''}
      <div style="display:flex;gap:5px;padding:8px">
        <button onclick="setDiKamar('${w.id}')" style="flex:1;padding:7px 4px;border:none;border-radius:10px;font-size:10px;font-weight:800;cursor:pointer;background:${isDiKamar?'#10b981':'#d1fae5'};color:${isDiKamar?'white':'#065f46'}">✓ Di Kamar</button>
        <button onclick="setLuarKamar('${w.id}','${w.nama.replace(/'/g,"\\'")}')" style="flex:1;padding:7px 4px;border:none;border-radius:10px;font-size:10px;font-weight:800;cursor:pointer;background:${isLuar?'#f59e0b':'#fef3c7'};color:${isLuar?'white':'#92400e'}">📍 Di Luar</button>
      </div>
    </div>`;
  }).join('');
}

function setDiKamar(wbpId){absenData[wbpId]={...(absenData[wbpId]||{}),status:'Di Kamar',keterangan:''};updateProgressKamar();renderKartu();cekSimpanBolehAktif();}
function setLuarKamar(wbpId,wbpNama){
  document.getElementById('ketWbpId').value=wbpId;
  document.getElementById('ketWbpName').textContent=wbpNama;
  document.getElementById('ketDetail').value='';
  document.querySelectorAll('.ket-opsi-btn').forEach(b=>b.classList.remove('active'));
  const existing=absenData[wbpId];
  if(existing?.status&&existing.status!=='Di Kamar'){const btn=document.querySelector(`.ket-opsi-btn[data-val="${existing.status}"]`);if(btn)btn.classList.add('active');}
  if(!absenData[wbpId])absenData[wbpId]={};
  absenData[wbpId].status='Di Bengkel';
  openModal('ketModal');
}
function pilihAlasan(btn){document.querySelectorAll('.ket-opsi-btn').forEach(b=>b.classList.remove('active'));btn.classList.add('active');const wbpId=document.getElementById('ketWbpId').value;if(absenData[wbpId])absenData[wbpId].status=btn.dataset.val;}
function saveKeterangan(){
  const wbpId=document.getElementById('ketWbpId').value;
  const aktif=document.querySelector('.ket-opsi-btn.active');
  const detail=document.getElementById('ketDetail').value.trim();
  if(!aktif){showAlert('warning','Pilih Lokasi','Pilih lokasi WBP saat ini.');return;}
  const ket=detail?`${aktif.dataset.val} - ${detail}`:aktif.dataset.val;
  absenData[wbpId]={...(absenData[wbpId]||{}),status:aktif.dataset.val,keterangan:ket};
  closeModal('ketModal');updateProgressKamar();renderKartu();cekSimpanBolehAktif();
}

function updateProgressKamar(){
  const total=wbpList.length;
  const wbpIdSet=new Set(wbpList.map(w=>w.id));
  const diKamar=Object.entries(absenData).filter(([id,d])=>wbpIdSet.has(id)&&d.status==='Di Kamar').length;
  const diLuar=Object.entries(absenData).filter(([id,d])=>wbpIdSet.has(id)&&d.status&&d.status!=='Di Kamar').length;
  const done=diKamar+diLuar;const pct=total?Math.round(done/total*100):0;
  const pb=document.getElementById('progressBar');if(pb)pb.style.width=pct+'%';
  const pt=document.getElementById('progressText');if(pt)pt.textContent=`${done} / ${total}`;
  const elH=document.getElementById('cntHadir');if(elH)elH.textContent=`${diKamar} Di Kamar`;
  const elT=document.getElementById('cntTidak');if(elT)elT.textContent=`${diLuar} Di Luar`;
  const elB=document.getElementById('cntBelum');if(elB)elB.textContent=`${total-done} Belum`;
  const ph=document.getElementById('progressHint');
  if(ph)ph.textContent=done===total&&total>0?'✅ Semua WBP sudah ditandai. Klik Simpan.':'Tandai semua WBP untuk mengaktifkan tombol Simpan.';
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
  if(adaBaru)showConfirm('Kembali','Data belum disimpan akan hilang.',async()=>{await releaseSession();resetStep();},'warning');
  else{await releaseSession();resetStep();}
}
async function releaseSession(){if(!activeSessionId)return;await sb.from('absen_session').update({selesai:true}).eq('id',activeSessionId);activeSessionId=null;}
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
  const{data:already}=await sb.from('absen_detail').select('wbp_id,wbp:wbp_id(nama)').eq('tanggal',today).eq('shift',selectedShift).in('wbp_id',newEntries.map(w=>w.id));
  if(already?.length){showAlert('warning','Sudah Ada',`${already.map(a=>a.wbp?.nama).join(', ')} sudah diabsen shift ${selectedShift}.`);await loadWbpUntukAbsen(selectedKamar.id);return;}
  showConfirm('Simpan Absensi',`Simpan absensi Shift ${selectedShift} — ${selectedKamar.nama}?`,async()=>{
    const btn=document.getElementById('btnSubmit');btn.disabled=true;btn.style.opacity='0.5';btn.textContent='Menyimpan...';
    try{
      const now=new Date().toISOString();
      const rows=newEntries.map(w=>({session_id:activeSessionId,pegawai_id:currentUser.id,blok_id:selectedKamar.id,wbp_id:w.id,tanggal:today,shift:selectedShift,waktu:now,status:absenData[w.id].status,keterangan:absenData[w.id].keterangan||null}));
      const{error}=await sb.from('absen_detail').insert(rows);
      if(error){if(error.code==='23505')showAlert('warning','Duplikat','Sebagian WBP sudah diabsen shift ini.');else showAlert('error','Gagal','Terjadi kesalahan.');await loadWbpUntukAbsen(selectedKamar.id);return;}
      if(activeSessionId){await sb.from('absen_session').update({selesai:true}).eq('id',activeSessionId);activeSessionId=null;}
      showAlert('success','Tersimpan!',`Absensi Shift ${selectedShift} — ${selectedKamar.nama} berhasil.`);
      resetStep();
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
  tbody.innerHTML=`<tr><td colspan="8" style="padding:16px">${'<div style="height:34px;background:#f1f5f9;border-radius:8px;margin-bottom:6px;animation:swpulse 1.5s infinite"></div>'.repeat(4)}</td></tr>`;
  // Filter preset
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
  if(!rows.length){tbody.innerHTML=`<tr><td colspan="8" style="padding:48px;text-align:center;color:#94a3b8">Belum ada data</td></tr>`;return;}
  tbody.innerHTML=rows.map((row,i)=>`<tr style="border-bottom:1px solid #f1f5f9">
    <td style="padding:9px 12px;font-size:12px;color:#94a3b8">${i+1}</td>
    <td style="padding:9px 12px;font-size:11px;color:#64748b">${formatWIT(row.waktu)}</td>
    <td style="padding:9px 12px">${shiftBadge(row.shift)}</td>
    <td style="padding:9px 12px;font-size:12px;font-weight:600">${row.pegawai?.nama||'—'}</td>
    <td style="padding:9px 12px"><span style="background:#dbeafe;color:#1d4ed8;padding:2px 7px;border-radius:10px;font-size:11px;font-weight:600">${row.blok?.nama||'—'}</span></td>
    <td style="padding:9px 12px"><div style="font-size:12px;font-weight:700">${row.wbp?.nama||'—'}</div><div style="font-size:10px;color:#94a3b8">${row.wbp?.no_registrasi||''}</div></td>
    <td style="padding:9px 12px">${statusBadge(row.status)}</td>
    <td style="padding:9px 12px"><div style="display:flex;gap:5px">
      <button class="btn btn-warning btn-sm btn-icon" onclick="editMyAbsen('${row.id}','${row.status}','${(row.keterangan||'').replace(/'/g,"\\'")}')" title="Edit"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-3.5 h-3.5"><path stroke-linecap="round" stroke-linejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z"/></svg></button>
      <button class="btn btn-danger btn-sm btn-icon" onclick="deleteMyAbsen('${row.id}')" title="Hapus"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-3.5 h-3.5"><path stroke-linecap="round" stroke-linejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"/></svg></button>
    </div></td>
  </tr>`).join('');
}
function editMyAbsen(id,status,ket){document.getElementById('editMyAbsenId').value=id;document.getElementById('editMyAbsenStatus').value=status||'Di Kamar';document.getElementById('editMyAbsenKet').value=ket||'';openModal('editMyAbsenModal');}
async function saveMyAbsen(){
  const id=document.getElementById('editMyAbsenId').value,status=document.getElementById('editMyAbsenStatus').value,ket=document.getElementById('editMyAbsenKet').value;
  const{error}=await sb.from('absen_detail').update({status,keterangan:ket||null}).eq('id',id);
  if(error){showAlert('error','Gagal',error.message);return;}
  showAlert('success','Diperbarui','Data diperbarui.');closeModal('editMyAbsenModal');loadMyRiwayat();
}
async function deleteMyAbsen(id){showConfirm('Hapus Data','Yakin hapus data absensi ini?',async()=>{const{error}=await sb.from('absen_detail').delete().eq('id',id);if(error){showAlert('error','Gagal',error.message);return;}showAlert('success','Dihapus','Data dihapus.');loadMyRiwayat();});}
function setPreset(val){const el=document.getElementById('myRiwayatPreset');if(el)el.value=val;loadMyRiwayat();}
function resetMyRiwayat(){
  const today=todayWIT();
  ['myRiwayatSearch','myRiwayatBlok','myRiwayatShift'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
  document.getElementById('myRiwayatDari').value=today;
  document.getElementById('myRiwayatSampai').value=today;
  document.getElementById('myRiwayatPreset').value='today';
  loadMyRiwayat();
}
async function exportRiwayatUser(){
  const data=window._myRiwayatData;if(!data?.length){showAlert('warning','Tidak Ada Data','Tidak ada data untuk diekspor.');return;}
  const dari=document.getElementById('myRiwayatDari')?.value||'',sampai=document.getElementById('myRiwayatSampai')?.value||'';
  try{
    const{jsPDF}=window.jspdf;const doc=new jsPDF({orientation:'landscape'});
    doc.setFontSize(14);doc.setFont('helvetica','bold');doc.text('LAPORAN ABSENSI WBP',148,14,{align:'center'});
    doc.setFontSize(9);doc.setFont('helvetica','normal');doc.text(`Periode: ${dari} s.d. ${sampai}  |  Dicetak: ${new Date().toLocaleDateString('id-ID',{timeZone:'Asia/Jayapura'})}`,148,21,{align:'center'});doc.line(14,24,283,24);
    doc.autoTable({startY:28,head:[['No','Waktu','Shift','Petugas','Kamar','WBP','No.Reg','Status','Keterangan']],
      body:data.map((r,i)=>[i+1,formatWIT(r.waktu),r.shift||'—',r.pegawai?.nama||'—',r.blok?.nama||'—',r.wbp?.nama||'—',r.wbp?.no_registrasi||'—',r.status||'—',r.keterangan||'—']),
      styles:{fontSize:7,cellPadding:2},headStyles:{fillColor:[30,64,175],textColor:255,fontStyle:'bold'},alternateRowStyles:{fillColor:[248,250,252]}});
    doc.save(`absensi_${dari}_${sampai}.pdf`);showAlert('success','Berhasil','PDF berhasil diunduh.');
  }catch(e){showAlert('error','Gagal','Gagal membuat PDF.');}
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
  if(!pwd||pwd.length<4){showAlert('warning','Terlalu Pendek','Password minimal 4 karakter.');return;}
  if(pwd!==konfirm){showAlert('error','Tidak Cocok','Konfirmasi tidak sesuai.');return;}
  showConfirm('Ganti Password','Yakin ganti password?',async()=>{
    const{error}=await sb.from('pegawai').update({password_plain:pwd}).eq('id',currentUser.id);
    if(error){showAlert('error','Gagal','Gagal menyimpan.');return;}
    document.getElementById('userPwdBaru').value='';document.getElementById('userPwdKonfirm').value='';
    showAlert('success','Berhasil','Password berhasil diganti.');
  });
}
init();
