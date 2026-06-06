// SIMAWAR user.js v6
let currentUser=null, selectedKamar=null, absenData={}, wbpList=[], activeSessionId=null;

// ── INIT ─────────────────────────────────────────────────────
async function init(){
  setTimeout(()=>{const s=document.getElementById('splashScreen');if(s){s.style.opacity='0';setTimeout(()=>s.remove(),500);}},800);
  const swId=sessionStorage.getItem('sw_id');
  if(!swId){location.href='index.html';return;}
  const{data:p}=await sb.from('pegawai').select('*').eq('id',swId).maybeSingle();
  if(!p){sessionStorage.clear();location.href='index.html';return;}
  currentUser=p;
  document.getElementById('headerUname').textContent=p.nama;
  document.getElementById('headerAvatar').textContent=p.nama?.[0]?.toUpperCase()||'P';
  document.getElementById('headerDate').textContent=new Date().toLocaleDateString('id-ID',{weekday:'long',day:'numeric',month:'long',year:'numeric',timeZone:'Asia/Jayapura'});
  const today=todayWIT();
  document.getElementById('myRiwayatDari').value=today;
  document.getElementById('myRiwayatSampai').value=today;
  loadSiteConfigUser().catch(()=>{});
  loadKamarPicker().catch(()=>{});
  // Kosongkan password field saat init
  ['userPwdBaru','userPwdKonfirm'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
}
async function loadSiteConfigUser(){
  const{data}=await sb.from('site_config').select('*').maybeSingle();
  if(!data)return;
  if(data.site_name){document.title=`Petugas — ${data.site_name}`;document.getElementById('sidebarName').textContent=data.site_name;}
  if(data.logo_url){document.getElementById('sidebarLogoEmoji').style.display='none';const sl=document.getElementById('sidebarLogo');if(!sl.querySelector('img')){const img=document.createElement('img');img.src=data.logo_url;img.style.cssText='width:100%;height:100%;object-fit:cover;border-radius:8px';sl.appendChild(img);}}
  if(data.favicon_url)document.getElementById('faviconEl').href=data.favicon_url;
}

// ── NAV ──────────────────────────────────────────────────────
function goPage(page){
  document.querySelectorAll('.page-section').forEach(s=>s.classList.remove('active'));
  document.getElementById('page-'+page)?.classList.add('active');
  ['absen','riwayat','profil'].forEach(id=>document.getElementById('nav-'+id)?.classList.toggle('active',id===page));
  const T={absen:'Absensi WBP',riwayat:'Riwayat',profil:'Profil'};
  document.getElementById('headerTitle').textContent=T[page]||page;
  closeSidebar();
  if(page==='riwayat'){loadMyRiwayatFilter();loadMyRiwayat();}
  if(page==='profil')loadProfil();
}
function toggleSidebar(){document.getElementById('sidebar').classList.toggle('open');document.getElementById('mobileOverlay').classList.toggle('show');}
function closeSidebar(){document.getElementById('sidebar').classList.remove('open');document.getElementById('mobileOverlay').classList.remove('show');}
function openModal(id){const m=document.getElementById(id);m.style.display='flex';requestAnimationFrame(()=>m.classList.add('show'));}
function closeModal(id){const m=document.getElementById(id);m.classList.remove('show');setTimeout(()=>m.style.display='none',300);}
function togglePwd(id,btn){const f=document.getElementById(id);if(!f)return;f.type=f.type==='password'?'text':'password';}
async function doLogout(){if(activeSessionId)await releaseSession();showConfirm('Keluar','Yakin ingin keluar?',async()=>{sessionStorage.clear();try{await sb.auth.signOut();}catch(e){}location.href='index.html';});}

// ── KAMAR PICKER ─────────────────────────────────────────────
async function loadKamarPicker(){
  const grid=document.getElementById('kamarPickerGrid');
  grid.innerHTML=[1,2,3,4].map(()=>`<div style="height:100px;background:#f1f5f9;border-radius:16px;animation:swpulse 1.5s infinite"></div>`).join('');
  const{data:bloks}=await sb.from('blok').select('*,wbp(count)').order('nama');
  if(!bloks?.length){grid.innerHTML=`<div style="grid-column:1/-1">${emptyState('Belum Ada Kamar','Admin belum menambahkan kamar hunian')}</div>`;return;}
  const today=todayWIT();
  // Cek sesi aktif hari ini
  const{data:sessions}=await sb.from('absen_session').select('id,blok_id,pegawai_id,pegawai:pegawai_id(nama)').eq('tanggal',today).eq('selesai',false);
  // Cek blok yang semua WBPnya sudah diabsen hari ini
  const{data:doneBloks}=await sb.from('absen_detail').select('blok_id').eq('tanggal',today);
  const doneBlokIds=new Set((doneBloks||[]).map(d=>d.blok_id));

  grid.innerHTML=bloks.map(b=>{
    const sesi=sessions?.find(s=>s.blok_id===b.id);
    const isMySession=sesi?.pegawai_id===currentUser.id;
    const inUseByOther=sesi&&!isMySession;
    const cnt=b.wbp?.[0]?.count||0;
    // Cek apakah semua WBP di blok ini sudah diabsen hari ini
    const allDone=cnt>0&&doneBlokIds.has(b.id);

    if(allDone&&!isMySession){
      return `<div class="kamar-card" style="opacity:0.5;cursor:not-allowed;background:#f0fdf4;border-color:#86efac" title="Semua WBP sudah diabsen hari ini">
        <div class="kamar-icon">✅</div><div class="kamar-name">${b.nama}</div>
        <div class="kamar-count">${cnt} WBP</div>
        <div class="kamar-user" style="color:#16a34a">Selesai hari ini</div>
      </div>`;
    }
    if(inUseByOther){
      return `<div class="kamar-card in-use" title="Dipakai ${sesi.pegawai?.nama}">
        <div class="kamar-icon">🔒</div><div class="kamar-name">${b.nama}</div>
        <div class="kamar-count">${cnt} WBP</div>
        <div class="kamar-user">👤 ${sesi.pegawai?.nama||'Petugas lain'}</div>
      </div>`;
    }
    if(isMySession){
      return `<div class="kamar-card selected" onclick="pilihKamar('${b.id}','${b.nama}','${sesi.id}')">
        <div class="kamar-icon">📋</div><div class="kamar-name">${b.nama}</div>
        <div class="kamar-count">${cnt} WBP</div>
        <div class="kamar-user" style="color:#3b82f6">✓ Sesi Anda</div>
      </div>`;
    }
    return `<div class="kamar-card" onclick="pilihKamar('${b.id}','${b.nama}',null)">
      <div class="kamar-icon">🏠</div><div class="kamar-name">${b.nama}</div>
      <div class="kamar-count">${cnt} WBP</div>
      <div class="kamar-user" style="color:#10b981">✓ Tersedia</div>
    </div>`;
  }).join('');
}

async function pilihKamar(blokId,blokNama,existingSessionId){
  selectedKamar={id:blokId,nama:blokNama};activeSessionId=existingSessionId;absenData={};
  if(!existingSessionId){
    const{data:sesi,error}=await sb.from('absen_session').insert({pegawai_id:currentUser.id,blok_id:blokId,tanggal:todayWIT(),selesai:false}).select().single();
    if(!error&&sesi)activeSessionId=sesi.id;
    else if(error){
      const{data:ex}=await sb.from('absen_session').select('id').eq('blok_id',blokId).eq('tanggal',todayWIT()).eq('selesai',false).maybeSingle();
      if(ex)activeSessionId=ex.id;
    }
  }
  document.getElementById('step1').style.display='none';
  document.getElementById('step2').style.display='block';
  document.getElementById('step2KamarTitle').textContent=blokNama;
  document.getElementById('step2Tanggal').textContent=new Date().toLocaleString('id-ID',{timeZone:'Asia/Jayapura',dateStyle:'full',timeStyle:'short'});
  await loadWbpUntukAbsen(blokId);
}

// ── ABSEN WBP ────────────────────────────────────────────────
async function loadWbpUntukAbsen(blokId){
  const grid=document.getElementById('wbpAbsenGrid');
  grid.innerHTML=[1,2,3,4].map(()=>`<div style="height:220px;background:#f1f5f9;border-radius:16px;animation:swpulse 1.5s infinite"></div>`).join('');
  const{data:wbps}=await sb.from('wbp').select('*').eq('blok_id',blokId).order('nama');
  wbpList=wbps||[];
  if(!wbpList.length){grid.innerHTML=`<div style="grid-column:1/-1">${emptyState('Tidak Ada WBP','Belum ada WBP di kamar ini')}</div>`;document.getElementById('absenBar').style.display='none';return;}

  // Cek WBP yang sudah diabsen hari ini
  const today=todayWIT();
  const wbpIds=wbpList.map(w=>w.id);
  const{data:sudahAbsen}=await sb.from('absen_detail').select('wbp_id,status,keterangan').eq('tanggal',today).in('wbp_id',wbpIds);
  // Pre-fill absenData dari data yang sudah ada
  (sudahAbsen||[]).forEach(a=>{absenData[a.wbp_id]={status:a.status,keterangan:a.keterangan||'',sudahAbsen:true};});

  document.getElementById('absenBar').style.display='none'; // sticky bar dihapus
  renderKartu();updateProgress();
  // Tampilkan tombol simpan non-sticky di bawah grid
  const simpanWrap = document.getElementById('simpanWrap');
  if (simpanWrap) simpanWrap.style.display = 'block';
}

function renderKartu(){
  const grid=document.getElementById('wbpAbsenGrid');
  grid.innerHTML=wbpList.map(w=>{
    const d=absenData[w.id]||{};
    const isHadir=d.status==='Hadir',isTidak=d.status==='Tidak Hadir';
    const sudah=d.sudahAbsen; // sudah diabsen sebelumnya hari ini

    // Format tanggal bebas
    let expStr='',expColor='#64748b',expWarn=false;
    if(w.tgl_bebas){
      const tgl=new Date(w.tgl_bebas),sisa=Math.ceil((tgl-new Date())/(1000*60*60*24));
      const bln=['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
      expStr=`${String(tgl.getDate()).padStart(2,'0')} ${bln[tgl.getMonth()]} ${tgl.getFullYear()}`;
      expWarn=sisa<=90;expColor=sisa<=30?'#dc2626':sisa<=90?'#f59e0b':'#64748b';
    }

    return `<div class="wbp-absen-card ${isHadir?'hadir':isTidak?'tidak':''}" id="wcard-${w.id}" style="opacity:${sudah?'0.85':'1'}">
      <!-- Status badge pojok kanan atas -->
      <div style="position:relative">
        ${isHadir?`<div style="position:absolute;top:8px;right:8px;z-index:2;background:#10b981;border-radius:50%;width:24px;height:24px;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 6px rgba(0,0,0,0.15)"><svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" style="width:13px;height:13px"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5"/></svg></div>`:''}
        ${isTidak?`<div style="position:absolute;top:8px;right:8px;z-index:2;background:#ef4444;border-radius:50%;width:24px;height:24px;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 6px rgba(0,0,0,0.15)"><svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" style="width:13px;height:13px"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg></div>`:''}
        ${sudah?'<div style="position:absolute;top:8px;left:8px;z-index:2;background:rgba(0,0,0,0.5);color:white;font-size:9px;font-weight:700;padding:2px 6px;border-radius:4px">✓ Sudah</div>':''}
        <!-- Foto: lebih kompak, rasio 1:1 bukan 3:4 -->
        <div style="width:100%;aspect-ratio:1/1;background:linear-gradient(135deg,#dbeafe,#e0e7ff);overflow:hidden">
          <div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:40px;font-weight:900;color:rgba(59,130,246,0.25)">${w.nama?.[0]||'?'}</div>
        </div>
        <!-- Nama WBP di bawah foto, bukan nama kamar -->
        <div style="background:rgba(30,64,175,0.82);color:white;font-size:11px;font-weight:800;text-align:center;padding:4px 6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${w.nama}</div>
      </div>
      <!-- INFO: no reg, perkara, putusan (nama sudah di badge bawah foto) -->
      <div style="padding:8px 10px 0">
        <div style="font-size:10px;color:#94a3b8">${w.no_registrasi||'—'}</div>
        ${w.kasus?`<div style="font-size:10px;color:#64748b;margin-top:3px"><b style="color:#94a3b8">Perkara:</b> ${w.kasus}</div>`:''}
        ${w.masa_pidana?`<div style="font-size:10px;font-weight:700;color:#1e293b;margin-top:2px"><b style="color:#94a3b8">Putusan:</b> ${w.masa_pidana}</div>`:''}
      </div>
      <!-- Ekspirasi -->
      ${w.tgl_bebas?`<div style="margin:8px 8px 0;padding:5px 8px;border-radius:8px;background:${expWarn?'#fef2f2':'#f8fafc'};border:1px solid ${expWarn?'#fecaca':'#e2e8f0'};text-align:center">
        <div style="font-size:9px;font-weight:700;color:${expColor};text-transform:uppercase;letter-spacing:0.5px">Bebas</div>
        <div style="font-size:12px;font-weight:900;color:${expColor}">${expStr}</div>
      </div>`:''}
      <!-- Keterangan jika tidak hadir -->
      ${isTidak&&d.keterangan?`<div style="margin:6px 8px 0;padding:4px 8px;background:#fef3c7;border-radius:7px;font-size:10px;font-weight:600;color:#92400e">📌 ${d.keterangan}</div>`:''}
      <!-- Tombol -->
      <div style="display:flex;gap:6px;padding:8px">
        <button onclick="${sudah?`editAbsenUser('${w.id}','Hadir')`:`setHadir('${w.id}')`}"
          style="flex:1;padding:7px 4px;border:none;border-radius:10px;font-size:11px;font-weight:800;cursor:pointer;transition:all .15s;
          background:${isHadir?'#10b981':'#d1fae5'};color:${isHadir?'white':'#065f46'}">
          ✓ Hadir
        </button>
        <button onclick="${sudah?`editAbsenUser('${w.id}','Tidak Hadir')`:`setTidak('${w.id}','${w.nama.replace(/'/g,"\\'")}')`}"
          style="flex:1;padding:7px 4px;border:none;border-radius:10px;font-size:11px;font-weight:800;cursor:pointer;transition:all .15s;
          background:${isTidak?'#ef4444':'#fee2e2'};color:${isTidak?'white':'#991b1b'}">
          ✗ Tidak
        </button>
      </div>
    </div>`;
  }).join('');
}

function setHadir(wbpId){absenData[wbpId]={status:'Hadir'};renderKartu();updateProgress();}
function setTidak(wbpId,wbpNama){
  if(!absenData[wbpId])absenData[wbpId]={};
  absenData[wbpId].status='Tidak Hadir';
  document.getElementById('ketWbpId').value=wbpId;
  document.getElementById('ketWbpName').textContent=wbpNama;
  document.querySelectorAll('.ket-opsi-btn').forEach(b=>b.classList.remove('active'));
  document.getElementById('ketDetail').value='';
  const existing=absenData[wbpId]?.keterangan;
  if(existing){const btn=document.querySelector(`.ket-opsi-btn[data-val="${existing.split(' - ')[0]}"]`);if(btn)btn.classList.add('active');}
  openModal('ketModal');renderKartu();updateProgress();
}
// Edit absen yang sudah tersimpan (sudahAbsen=true)
async function editAbsenUser(wbpId, newStatus){
  const existing=absenData[wbpId];
  if(!existing?.sudahAbsen)return;
  // Ambil id absen_detail dari DB
  const today=todayWIT();
  const{data:row}=await sb.from('absen_detail').select('id').eq('wbp_id',wbpId).eq('tanggal',today).maybeSingle();
  if(!row){showAlert('error','Error','Data absen tidak ditemukan');return;}
  if(newStatus==='Tidak Hadir'){
    document.getElementById('ketWbpId').value=wbpId;
    document.getElementById('ketWbpName').textContent=wbpList.find(w=>w.id===wbpId)?.nama||'WBP';
    document.querySelectorAll('.ket-opsi-btn').forEach(b=>b.classList.remove('active'));
    document.getElementById('ketDetail').value=existing.keterangan||'';
    document.getElementById('editAbsenDetailId').value=row.id;
    openModal('ketModal');
  } else {
    const{error}=await sb.from('absen_detail').update({status:'Hadir',keterangan:null}).eq('id',row.id);
    if(error){showAlert('error','Gagal',error.message);return;}
    absenData[wbpId]={status:'Hadir',sudahAbsen:true};
    showAlert('success','Diperbarui!','Status diubah ke Hadir');
    renderKartu();updateProgress();
  }
}

function pilihAlasan(btn){document.querySelectorAll('.ket-opsi-btn').forEach(b=>b.classList.remove('active'));btn.classList.add('active');}

async function saveKeterangan(){
  const wbpId=document.getElementById('ketWbpId').value;
  const aktif=document.querySelector('.ket-opsi-btn.active');
  const detail=document.getElementById('ketDetail').value.trim();
  if(!aktif){showAlert('warning','Perhatian','Pilih alasan!');return;}
  const alasan=aktif.dataset.val;
  const ket=detail?`${alasan} - ${detail}`:alasan;

  // Cek apakah ini edit data sudah tersimpan
  const editId=document.getElementById('editAbsenDetailId')?.value;
  if(editId){
    const{error}=await sb.from('absen_detail').update({status:'Tidak Hadir',keterangan:ket}).eq('id',editId);
    if(error){showAlert('error','Gagal',error.message);return;}
    absenData[wbpId]={status:'Tidak Hadir',keterangan:ket,sudahAbsen:true};
    document.getElementById('editAbsenDetailId').value='';
    showAlert('success','Diperbarui!','Keterangan diperbarui');
  } else {
    absenData[wbpId]={status:'Tidak Hadir',keterangan:ket};
  }
  closeModal('ketModal');renderKartu();updateProgress();
}

function updateProgress(){
  const total=wbpList.length,hadir=Object.values(absenData).filter(d=>d.status==='Hadir').length,tidak=Object.values(absenData).filter(d=>d.status==='Tidak Hadir').length,done=hadir+tidak;
  const pct=total?Math.round(done/total*100):0;
  const pb=document.getElementById('progressBar');if(pb)pb.style.width=pct+'%';
  const pt=document.getElementById('progressText');if(pt)pt.textContent=`${done} / ${total}`;
  const elH=document.getElementById('cntHadir');if(elH)elH.textContent=`${hadir} Hadir`;
  const elT=document.getElementById('cntTidak');if(elT)elT.textContent=`${tidak} Tidak`;
  const elB=document.getElementById('cntBelum');if(elB)elB.textContent=`${total-done} Belum`;
  const bs=document.getElementById('barSummary');if(bs)bs.textContent=`${done} dari ${total} WBP sudah diabsen`;
  // Tampilkan progressInfo
  const pi=document.getElementById('progressInfo');if(pi)pi.style.display='flex';
}

async function backToStep1(){
  const done=Object.keys(absenData).filter(k=>!absenData[k].sudahAbsen).length;
  if(done>0){showConfirm('Kembali','Data yang belum disimpan akan hilang. Yakin?',async()=>{await releaseSession();resetStep();},'warning');}
  else{await releaseSession();resetStep();}
}
async function releaseSession(){if(!activeSessionId)return;await sb.from('absen_session').update({selesai:true}).eq('id',activeSessionId);activeSessionId=null;}
function resetStep(){
  selectedKamar=null;absenData={};wbpList=[];
  document.getElementById('step2').style.display='none';
  document.getElementById('step1').style.display='block';
  const sw=document.getElementById('simpanWrap');if(sw)sw.style.display='none';
  const pi=document.getElementById('progressInfo');if(pi)pi.style.display='none';
  loadKamarPicker();
}

async function submitAbsen(){
  const total=wbpList.length;
  // Hanya hitung yang belum tersimpan
  const newEntries=Object.keys(absenData).filter(k=>!absenData[k].sudahAbsen);
  if(newEntries.length===0){showAlert('warning','Belum Ada','Tidak ada data baru untuk disimpan!');return;}
  const unfinished=wbpList.filter(w=>!absenData[w.id]).length;
  const msg=unfinished>0?`${newEntries.length} WBP baru diabsen, ${unfinished} belum. Simpan sekarang?`:`Semua ${total} WBP sudah diabsen. Simpan?`;
  showConfirm('Simpan Absensi',msg,async()=>{
    const btn=document.getElementById('btnSubmit');btn.disabled=true;btn.textContent='Menyimpan...';
    try{
      const now=new Date().toISOString(),today=todayWIT();
      const rows=wbpList.filter(w=>absenData[w.id]&&!absenData[w.id].sudahAbsen).map(w=>({session_id:activeSessionId,pegawai_id:currentUser.id,blok_id:selectedKamar.id,wbp_id:w.id,tanggal:today,waktu:now,status:absenData[w.id].status,keterangan:absenData[w.id].keterangan||null}));
      const{error}=await sb.from('absen_detail').insert(rows);
      if(error)throw error;
      await sb.from('absen_session').update({selesai:true}).eq('id',activeSessionId);activeSessionId=null;
      showAlert('success','Tersimpan!',`${rows.length} data absensi berhasil dicatat`);resetStep();
    }catch(e){
      if(e.message?.includes('unique')){showAlert('error','Duplikat','Beberapa WBP sudah diabsen hari ini!');}
      else{showAlert('error','Gagal',e.message||'Terjadi kesalahan');}
    }finally{btn.disabled=false;btn.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5"/></svg> Simpan Absensi';}
  });
}

// ── RIWAYAT USER ─────────────────────────────────────────────
async function loadMyRiwayatFilter(){
  const bs=document.getElementById('myRiwayatBlok');
  if(bs?.options.length<=1){const{data:bl}=await sb.from('blok').select('id,nama').order('nama');bl?.forEach(b=>bs.add(new Option(b.nama,b.id)));}
}
async function loadMyRiwayat(){
  const search=document.getElementById('myRiwayatSearch')?.value.trim()||'';
  const dari=document.getElementById('myRiwayatDari')?.value||'';
  const sampai=document.getElementById('myRiwayatSampai')?.value||'';
  const blokId=document.getElementById('myRiwayatBlok')?.value||'';
  const tbody=document.getElementById('myRiwayatBody');
  tbody.innerHTML=`<tr><td colspan="7" style="padding:16px"><div style="display:flex;flex-direction:column;gap:8px">${[1,2,3].map(()=>`<div style="height:40px;background:#f1f5f9;border-radius:8px;animation:swpulse 1.5s infinite"></div>`).join('')}</div></td></tr>`;
  // Query HANYA untuk user ini — tidak ada filter admin
  let q=sb.from('absen_detail').select('*,wbp:wbp_id(nama,no_registrasi),blok:blok_id(nama)')
    .eq('pegawai_id',currentUser.id) // filter ketat hanya user ini
    .order('waktu',{ascending:false});
  if(dari)q=q.gte('tanggal',dari);
  if(sampai)q=q.lte('tanggal',sampai);
  if(blokId)q=q.eq('blok_id',blokId);
  const{data}=await q;
  let rows=data||[];
  if(search)rows=rows.filter(r=>(r.wbp?.nama||'').toLowerCase().includes(search.toLowerCase()));
  window._myRiwayatData=rows;
  document.getElementById('myRiwayatCount').textContent=`${rows.length} data`;
  if(!rows.length){tbody.innerHTML=`<tr><td colspan="7"><div style="padding:40px;text-align:center"><div style="font-size:32px;margin-bottom:8px">📋</div><div style="font-size:14px;font-weight:700;color:#374151">Belum Ada Data</div></div></td></tr>`;return;}
  tbody.innerHTML=rows.map((row,i)=>`<tr style="border-bottom:1px solid #f1f5f9">
    <td style="padding:10px 14px;font-size:12px;color:#94a3b8">${i+1}</td>
    <td style="padding:10px 14px;font-size:12px;color:#64748b">${formatWIT(row.waktu)}</td>
    <td style="padding:10px 14px"><span style="background:#dbeafe;color:#1d4ed8;padding:2px 8px;border-radius:12px;font-size:11px;font-weight:600">${row.blok?.nama||'—'}</span></td>
    <td style="padding:10px 14px"><div style="font-size:13px;font-weight:700">${row.wbp?.nama||'—'}</div><div style="font-size:11px;color:#94a3b8">${row.wbp?.no_registrasi||''}</div></td>
    <td style="padding:10px 14px"><span style="background:${row.status==='Hadir'?'#d1fae5':'#fee2e2'};color:${row.status==='Hadir'?'#065f46':'#991b1b'};padding:2px 10px;border-radius:12px;font-size:11px;font-weight:700">${row.status}</span></td>
    <td style="padding:10px 14px;font-size:12px;color:#64748b">${row.keterangan||'—'}</td>
    <td style="padding:10px 14px">
      <button class="btn btn-warning btn-sm btn-icon" onclick="editMyAbsen('${row.id}','${row.status}','${(row.keterangan||'').replace(/'/g,"\\'")}')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-3.5 h-3.5"><path stroke-linecap="round" stroke-linejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z"/></svg></button>
    </td>
  </tr>`).join('');
}
function editMyAbsen(id,status,keterangan){document.getElementById('editMyAbsenId').value=id;document.getElementById('editMyAbsenStatus').value=status||'Hadir';document.getElementById('editMyAbsenKet').value=keterangan||'';openModal('editMyAbsenModal');}
async function saveMyAbsen(){
  const id=document.getElementById('editMyAbsenId').value;
  const status=document.getElementById('editMyAbsenStatus').value;
  const keterangan=document.getElementById('editMyAbsenKet').value;
  const{error}=await sb.from('absen_detail').update({status,keterangan:keterangan||null}).eq('id',id).eq('pegawai_id',currentUser.id);
  if(error){showAlert('error','Gagal',error.message);return;}
  showAlert('success','Diperbarui!','Data absensi diperbarui');closeModal('editMyAbsenModal');loadMyRiwayat();
}
function resetMyRiwayat(){const today=todayWIT();document.getElementById('myRiwayatSearch').value='';document.getElementById('myRiwayatDari').value=today;document.getElementById('myRiwayatSampai').value=today;document.getElementById('myRiwayatBlok').value='';loadMyRiwayat();}
async function exportRiwayatUser(){
  const data=window._myRiwayatData;if(!data?.length){showAlert('warning','Perhatian','Tidak ada data!');return;}
  const dari=document.getElementById('myRiwayatDari')?.value||'',sampai=document.getElementById('myRiwayatSampai')?.value||'';
  try{const{jsPDF}=window.jspdf;const doc=new jsPDF();doc.setFontSize(14);doc.setFont('helvetica','bold');doc.text('RIWAYAT ABSENSI WBP',105,14,{align:'center'});doc.setFontSize(10);doc.setFont('helvetica','normal');doc.text(`Petugas: ${currentUser.nama}`,105,21,{align:'center'});doc.setFontSize(9);doc.text(`Periode: ${dari} s.d. ${sampai}  |  Dicetak: ${new Date().toLocaleDateString('id-ID',{timeZone:'Asia/Jayapura'})}`,105,27,{align:'center'});doc.line(14,30,196,30);
  doc.autoTable({startY:34,head:[['No','Waktu','Kamar','WBP','No. Reg','Status','Keterangan']],body:data.map((r,i)=>[i+1,formatWIT(r.waktu),r.blok?.nama||'—',r.wbp?.nama||'—',r.wbp?.no_registrasi||'—',r.status||'—',r.keterangan||'—']),styles:{fontSize:8,cellPadding:3},headStyles:{fillColor:[30,64,175],textColor:255,fontStyle:'bold'},alternateRowStyles:{fillColor:[248,250,252]}});
  doc.save(`riwayat_${currentUser.nama}_${dari}_${sampai}.pdf`);showAlert('success','Berhasil!','PDF diunduh');}catch(e){showAlert('error','Gagal',e.message);}
}

// ── PROFIL ───────────────────────────────────────────────────
async function loadProfil(){
  if(!currentUser)return;
  document.getElementById('profilNama').textContent=currentUser.nama||'—';
  document.getElementById('profilUsername').textContent=currentUser.username||'—';
  const av=document.getElementById('profilAvatar');if(av)av.textContent=currentUser.nama?.[0]?.toUpperCase()||'P';
  // Kosongkan field password
  ['userPwdBaru','userPwdKonfirm'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
}
async function userSavePassword(){
  const pwd=document.getElementById('userPwdBaru')?.value,konfirm=document.getElementById('userPwdKonfirm')?.value;
  if(!pwd||pwd.length<4){showAlert('warning','Perhatian','Password minimal 4 karakter!');return;}
  if(pwd!==konfirm){showAlert('error','Tidak Cocok','Konfirmasi tidak sesuai!');return;}
  showConfirm('Ganti Password','Yakin ganti password?',async()=>{
    const{error}=await sb.from('pegawai').update({password_plain:pwd}).eq('id',currentUser.id);
    if(error){showAlert('error','Gagal',error.message);return;}
    currentUser.password_plain=pwd;
    document.getElementById('userPwdBaru').value='';document.getElementById('userPwdKonfirm').value='';
    showAlert('success','Berhasil!','Password diganti');
  });
}
init();
