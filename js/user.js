// SIMAWAR user.js v6c - async updates, lazy loading, anti-duplikat ketat
let currentUser=null, selectedKamar=null, absenData={}, wbpList=[], activeSessionId=null;
let realtimeChannel=null;

// ── INIT ─────────────────────────────────────────────────────
async function init(){
  setTimeout(()=>{const s=document.getElementById('splashScreen');if(s){s.style.opacity='0';setTimeout(()=>s.remove(),500);}},800);
  const swId=sessionStorage.getItem('sw_id');
  if(!swId){location.href='index.html';return;}
  const{data:p}=await sb.from('pegawai').select('id,nama,username,password_plain,role').eq('id',swId).maybeSingle();
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
  ['userPwdBaru','userPwdKonfirm'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
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
function togglePwd(id){const f=document.getElementById(id);if(!f)return;f.type=f.type==='password'?'text':'password';}
async function doLogout(){if(activeSessionId)await releaseSession();showConfirm('Keluar','Yakin ingin keluar?',async()=>{sessionStorage.clear();try{await sb.auth.signOut();}catch(e){}location.href='index.html';});}

// ── KAMAR PICKER ─────────────────────────────────────────────
async function loadKamarPicker(){
  const grid=document.getElementById('kamarPickerGrid');
  // Skeleton
  grid.innerHTML='<div style="height:100px;background:#f1f5f9;border-radius:16px;animation:swpulse 1.5s infinite"></div>'.repeat(4);

  const today=todayWIT();
  // Lazy: hanya ambil kolom yang dibutuhkan
  const[blokRes,sessionRes]=await Promise.all([
    sb.from('blok').select('id,nama,kapasitas'),
    sb.from('absen_session').select('id,blok_id,pegawai_id,pegawai:pegawai_id(nama)').eq('tanggal',today).eq('selesai',false)
  ]);
  const bloks=blokRes.data||[];
  const sessions=sessionRes.data||[];

  if(!bloks.length){grid.innerHTML=`<div style="grid-column:1/-1">${emptyState('Belum Ada Kamar','Admin belum menambahkan kamar hunian')}</div>`;return;}

  // Cek kamar mana yang sudah selesai semua WBP-nya hari ini
  // Lazy: hanya ambil blok_id unik
  const{data:doneData}=await sb.from('absen_detail').select('blok_id').eq('tanggal',today);
  const doneBlokSet=new Set((doneData||[]).map(d=>d.blok_id));

  // Hitung jumlah WBP per blok (lazy, hanya count)
  const wbpCountRes=await Promise.all(bloks.map(b=>
    sb.from('wbp').select('id',{count:'exact',head:true}).eq('blok_id',b.id)
  ));

  grid.innerHTML=bloks.map((b,i)=>{
    const cnt=wbpCountRes[i]?.count||0;
    const sesi=sessions.find(s=>s.blok_id===b.id);
    const isMySession=sesi?.pegawai_id===currentUser.id;
    const inUseByOther=sesi&&!isMySession;

    // Cek apakah kamar ini sudah selesai hari ini
    // Selesai = semua WBP sudah diabsen (jumlah absen_detail = jumlah WBP)
    // Kita cek dari sesi yang sudah selesai
    const{data:doneAbsen}={}; // akan dicek per card
    const kamarDone=doneBlokSet.has(b.id)&&!sesi; // ada data absen tapi tidak ada sesi aktif

    if(inUseByOther){
      return `<div class="kamar-card in-use" title="Dipakai ${sesi.pegawai?.nama||'petugas lain'}">
        <div style="font-size:26px;margin-bottom:8px">🔒</div>
        <div style="font-size:13px;font-weight:800;color:#1e293b">${b.nama}</div>
        <div style="font-size:11px;color:#94a3b8;margin-top:3px">${cnt} WBP</div>
        <div style="font-size:10px;font-weight:600;color:#f59e0b;margin-top:3px">👤 ${sesi.pegawai?.nama||'Petugas lain'}</div>
      </div>`;
    }
    if(isMySession){
      return `<div class="kamar-card selected" onclick="pilihKamar('${b.id}','${b.nama}','${sesi.id}')">
        <div style="font-size:26px;margin-bottom:8px">📋</div>
        <div style="font-size:13px;font-weight:800;color:#1e293b">${b.nama}</div>
        <div style="font-size:11px;color:#94a3b8;margin-top:3px">${cnt} WBP</div>
        <div style="font-size:10px;font-weight:600;color:#3b82f6;margin-top:3px">✓ Sesi Anda</div>
      </div>`;
    }
    if(kamarDone){
      return `<div class="kamar-card" style="opacity:.55;cursor:not-allowed;background:#f0fdf4;border-color:#86efac" title="Sudah selesai hari ini">
        <div style="font-size:26px;margin-bottom:8px">✅</div>
        <div style="font-size:13px;font-weight:800;color:#1e293b">${b.nama}</div>
        <div style="font-size:11px;color:#94a3b8;margin-top:3px">${cnt} WBP</div>
        <div style="font-size:10px;font-weight:600;color:#16a34a;margin-top:3px">Selesai hari ini</div>
      </div>`;
    }
    return `<div class="kamar-card" onclick="pilihKamar('${b.id}','${b.nama}',null)">
      <div style="font-size:26px;margin-bottom:8px">🏠</div>
      <div style="font-size:13px;font-weight:800;color:#1e293b">${b.nama}</div>
      <div style="font-size:11px;color:#94a3b8;margin-top:3px">${cnt} WBP</div>
      <div style="font-size:10px;font-weight:600;color:#10b981;margin-top:3px">✓ Tersedia</div>
    </div>`;
  }).join('');
}

async function pilihKamar(blokId,blokNama,existingSessionId){
  selectedKamar={id:blokId,nama:blokNama};
  activeSessionId=existingSessionId;
  absenData={};

  // Cegah duplikat sesi: cek dulu apakah blok ini sudah punya sesi aktif hari ini
  if(!existingSessionId){
    const today=todayWIT();
    // Cek apakah ada sesi aktif untuk blok ini hari ini
    const{data:existSesi}=await sb.from('absen_session')
      .select('id,pegawai_id,pegawai:pegawai_id(nama)')
      .eq('blok_id',blokId).eq('tanggal',today).eq('selesai',false).maybeSingle();

    if(existSesi){
      if(existSesi.pegawai_id===currentUser.id){
        // Sesi milik user ini sendiri
        activeSessionId=existSesi.id;
      } else {
        showAlert('error','Kamar Dikunci',`Kamar sedang dipakai oleh ${existSesi.pegawai?.nama||'petugas lain'}!`);
        return;
      }
    } else {
      // Buat sesi baru
      const{data:sesi,error}=await sb.from('absen_session')
        .insert({pegawai_id:currentUser.id,blok_id:blokId,tanggal:today,selesai:false})
        .select('id').single();
      if(error){
        // Mungkin ada race condition, cek lagi
        const{data:reSesi}=await sb.from('absen_session')
          .select('id,pegawai_id').eq('blok_id',blokId).eq('tanggal',today).eq('selesai',false).maybeSingle();
        if(reSesi&&reSesi.pegawai_id!==currentUser.id){
          showAlert('error','Kamar Dikunci','Kamar baru saja diambil petugas lain!');return;
        }
        if(reSesi)activeSessionId=reSesi.id;
      } else {
        activeSessionId=sesi?.id||null;
      }
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
  grid.innerHTML='<div style="height:240px;background:#f1f5f9;border-radius:16px;animation:swpulse 1.5s infinite"></div>'.repeat(3);

  // Lazy: hanya ambil field yang ditampilkan
  const{data:wbps}=await sb.from('wbp')
    .select('id,nama,no_registrasi,kasus,masa_pidana,tgl_bebas')
    .eq('blok_id',blokId).order('nama');
  wbpList=wbps||[];

  if(!wbpList.length){
    grid.innerHTML=`<div style="grid-column:1/-1">${emptyState('Tidak Ada WBP','Belum ada WBP di kamar ini')}</div>`;
    document.getElementById('simpanWrap').style.display='none';
    return;
  }

  // Lazy: cek WBP yang sudah diabsen hari ini di blok ini
  const today=todayWIT();
  const wbpIds=wbpList.map(w=>w.id);
  const{data:sudahAbsenData}=await sb.from('absen_detail')
    .select('id,wbp_id,status,keterangan')
    .eq('tanggal',today)
    .in('wbp_id',wbpIds);

  // Pre-fill absenData
  absenData={};
  (sudahAbsenData||[]).forEach(a=>{
    absenData[a.wbp_id]={id:a.id,status:a.status,keterangan:a.keterangan||'',sudahAbsen:true};
  });

  // Progress bar per kamar ini saja
  updateProgress();
  renderKartu();

  // Tampilkan tombol simpan hanya jika ada WBP yang belum diabsen
  const belumAbsen=wbpList.filter(w=>!absenData[w.id]).length;
  document.getElementById('simpanWrap').style.display=belumAbsen>0?'block':'none';
}

function renderKartu(){
  const grid=document.getElementById('wbpAbsenGrid');
  grid.innerHTML=wbpList.map(w=>{
    const d=absenData[w.id]||{};
    const isHadir=d.status==='Hadir', isTidak=d.status==='Tidak Hadir', sudah=!!d.sudahAbsen;

    let expStr='', expColor='#64748b', expWarn=false;
    if(w.tgl_bebas){
      const tgl=new Date(w.tgl_bebas+'T00:00:00');
      const sisa=Math.ceil((tgl-new Date())/(1000*60*60*24));
      const bln=['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
      expStr=`${String(tgl.getDate()).padStart(2,'0')} ${bln[tgl.getMonth()]} ${tgl.getFullYear()}`;
      expWarn=sisa<=90; expColor=sisa<=30?'#dc2626':sisa<=90?'#f59e0b':'#64748b';
    }

    return `<div class="wbp-absen-card ${isHadir?'hadir':isTidak?'tidak':''}" id="wcard-${w.id}">
      <div style="position:relative">
        ${isHadir?`<div style="position:absolute;top:8px;right:8px;z-index:2;background:#10b981;border-radius:50%;width:24px;height:24px;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 6px rgba(0,0,0,.15)"><svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" style="width:13px;height:13px"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5"/></svg></div>`:''}
        ${isTidak?`<div style="position:absolute;top:8px;right:8px;z-index:2;background:#ef4444;border-radius:50%;width:24px;height:24px;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 6px rgba(0,0,0,.15)"><svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" style="width:13px;height:13px"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg></div>`:''}
        <!-- Foto area 1:1 -->
        <div style="width:100%;aspect-ratio:1/1;background:linear-gradient(135deg,#dbeafe,#e0e7ff);overflow:hidden;display:flex;align-items:center;justify-content:center">
          <span style="font-size:42px;font-weight:900;color:rgba(59,130,246,.2)">${w.nama?.[0]||'?'}</span>
        </div>
        <!-- NAMA WBP di bawah foto, bukan nama kamar -->
        <div style="background:linear-gradient(135deg,#1e3a8a,#1e40af);color:white;font-size:11px;font-weight:800;text-align:center;padding:5px 6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${w.nama}</div>
      </div>
      <!-- Info: no reg, perkara, putusan, ekspirasi -->
      <div style="padding:8px 10px 0">
        <div style="font-size:10px;color:#94a3b8">${w.no_registrasi||'—'}</div>
        ${w.kasus?`<div style="font-size:10px;color:#64748b;margin-top:3px"><span style="color:#94a3b8">Perkara: </span>${w.kasus}</div>`:''}
        ${w.masa_pidana?`<div style="font-size:10px;font-weight:700;color:#1e293b;margin-top:2px"><span style="color:#94a3b8;font-weight:400">Putusan: </span>${w.masa_pidana}</div>`:''}
      </div>
      ${w.tgl_bebas?`<div style="margin:6px 8px 0;padding:5px 8px;border-radius:8px;background:${expWarn?'#fef2f2':'#f8fafc'};border:1px solid ${expWarn?'#fecaca':'#e2e8f0'};text-align:center">
        <div style="font-size:9px;font-weight:700;color:${expColor};text-transform:uppercase;letter-spacing:.5px">Bebas</div>
        <div style="font-size:12px;font-weight:900;color:${expColor}">${expStr}</div>
      </div>`:''}
      ${isTidak&&d.keterangan?`<div style="margin:5px 8px 0;padding:4px 7px;background:#fef3c7;border-radius:7px;font-size:10px;font-weight:600;color:#92400e">📌 ${d.keterangan}</div>`:''}
      <!-- Tombol Hadir / Tidak -->
      <div style="display:flex;gap:6px;padding:8px">
        <button onclick="setHadir('${w.id}')" style="flex:1;padding:7px 4px;border:none;border-radius:10px;font-size:11px;font-weight:800;cursor:pointer;transition:all .15s;background:${isHadir?'#10b981':'#d1fae5'};color:${isHadir?'white':'#065f46'}">✓ Hadir</button>
        <button onclick="setTidak('${w.id}','${w.nama.replace(/'/g,"\\'")}','${(d.keterangan||'').replace(/'/g,"\\'")}')
        " style="flex:1;padding:7px 4px;border:none;border-radius:10px;font-size:11px;font-weight:800;cursor:pointer;transition:all .15s;background:${isTidak?'#ef4444':'#fee2e2'};color:${isTidak?'white':'#991b1b'}">✗ Tidak</button>
      </div>
    </div>`;
  }).join('');
}

function setHadir(wbpId){
  absenData[wbpId]={...(absenData[wbpId]||{}),status:'Hadir',keterangan:''};
  updateProgress();renderKartu();updateSimpanBtn();
}
function setTidak(wbpId,wbpNama,existingKet){
  document.getElementById('ketWbpId').value=wbpId;
  document.getElementById('ketWbpName').textContent=wbpNama;
  document.getElementById('ketDetail').value='';
  document.getElementById('editAbsenDetailId').value='';
  document.querySelectorAll('.ket-opsi-btn').forEach(b=>b.classList.remove('active'));
  // Pre-select jika sudah ada keterangan
  if(existingKet){
    const btn=document.querySelector(`.ket-opsi-btn[data-val="${existingKet.split(' - ')[0]}"]`);
    if(btn)btn.classList.add('active');
    const sisa=existingKet.includes(' - ')?existingKet.split(' - ').slice(1).join(' - '):'';
    document.getElementById('ketDetail').value=sisa;
  }
  if(!absenData[wbpId])absenData[wbpId]={};
  absenData[wbpId].status='Tidak Hadir';
  openModal('ketModal');
  updateProgress();renderKartu();updateSimpanBtn();
}
function pilihAlasan(btn){document.querySelectorAll('.ket-opsi-btn').forEach(b=>b.classList.remove('active'));btn.classList.add('active');}
function saveKeterangan(){
  const wbpId=document.getElementById('ketWbpId').value;
  const aktif=document.querySelector('.ket-opsi-btn.active');
  const detail=document.getElementById('ketDetail').value.trim();
  if(!aktif){showAlert('warning','Perhatian','Pilih alasan!');return;}
  const ket=detail?`${aktif.dataset.val} - ${detail}`:aktif.dataset.val;
  absenData[wbpId]={...(absenData[wbpId]||{}),status:'Tidak Hadir',keterangan:ket};
  closeModal('ketModal');
  updateProgress();renderKartu();updateSimpanBtn();
}

function updateProgress(){
  const total=wbpList.length;
  // Progress hanya untuk WBP di kamar ini (wbpList = WBP kamar yang dipilih)
  const hadir=Object.values(absenData).filter(d=>d.status==='Hadir').length;
  const tidak=Object.values(absenData).filter(d=>d.status==='Tidak Hadir').length;
  const done=hadir+tidak;
  const pct=total?Math.round(done/total*100):0;
  const pb=document.getElementById('progressBar');if(pb)pb.style.width=pct+'%';
  const pt=document.getElementById('progressText');if(pt)pt.textContent=`${done} / ${total}`;
  const elH=document.getElementById('cntHadir');if(elH)elH.textContent=`${hadir} Hadir`;
  const elT=document.getElementById('cntTidak');if(elT)elT.textContent=`${tidak} Tidak`;
  const elB=document.getElementById('cntBelum');if(elB)elB.textContent=`${total-done} Belum`;
}

function updateSimpanBtn(){
  // Tampilkan tombol simpan hanya jika ada yang belum disimpan
  const adaBaru=wbpList.some(w=>absenData[w.id]&&!absenData[w.id].sudahAbsen);
  const sw=document.getElementById('simpanWrap');
  if(sw)sw.style.display=adaBaru?'block':'none';
}

async function backToStep1(){
  const adaBaru=wbpList.some(w=>absenData[w.id]&&!absenData[w.id].sudahAbsen);
  if(adaBaru){
    showConfirm('Kembali','Data yang belum disimpan akan hilang. Yakin?',async()=>{await releaseSession();resetStep();},'warning');
  } else {
    await releaseSession();resetStep();
  }
}
async function releaseSession(){
  if(!activeSessionId)return;
  await sb.from('absen_session').update({selesai:true}).eq('id',activeSessionId);
  activeSessionId=null;
}
function resetStep(){
  selectedKamar=null;absenData={};wbpList=[];
  document.getElementById('step2').style.display='none';
  document.getElementById('step1').style.display='block';
  const sw=document.getElementById('simpanWrap');if(sw)sw.style.display='none';
  loadKamarPicker();
}

async function submitAbsen(){
  const today=todayWIT();
  // Hanya WBP yang belum tersimpan
  const newEntries=wbpList.filter(w=>absenData[w.id]&&!absenData[w.id].sudahAbsen);
  if(!newEntries.length){showAlert('warning','Belum Ada','Tidak ada data baru!');return;}

  // Cek duplikat di database (anti-cheat): pastikan tidak ada yang sudah diabsen hari ini
  const newWbpIds=newEntries.map(w=>w.id);
  const{data:alreadyAbsen}=await sb.from('absen_detail')
    .select('wbp_id').eq('tanggal',today).in('wbp_id',newWbpIds);
  if(alreadyAbsen?.length){
    const dupNames=alreadyAbsen.map(a=>{const w=wbpList.find(x=>x.id===a.wbp_id);return w?.nama||a.wbp_id;});
    showAlert('error','Duplikat Terdeteksi',`WBP berikut sudah diabsen hari ini: ${dupNames.join(', ')}`);
    // Reload data terbaru
    await loadWbpUntukAbsen(selectedKamar.id);
    return;
  }

  const belum=wbpList.filter(w=>!absenData[w.id]).length;
  const msg=belum>0?`${newEntries.length} WBP diabsen, ${belum} belum. Simpan?`:`Semua ${wbpList.length} WBP diabsen. Simpan?`;

  showConfirm('Simpan Absensi',msg,async()=>{
    const btn=document.getElementById('btnSubmit');btn.disabled=true;btn.textContent='Menyimpan...';
    try{
      const now=new Date().toISOString();
      const rows=newEntries.map(w=>({
        session_id:activeSessionId,pegawai_id:currentUser.id,blok_id:selectedKamar.id,
        wbp_id:w.id,tanggal:today,waktu:now,
        status:absenData[w.id].status,keterangan:absenData[w.id].keterangan||null
      }));
      const{error}=await sb.from('absen_detail').insert(rows);
      if(error){
        if(error.message?.includes('unique')){showAlert('error','Duplikat','Beberapa WBP sudah diabsen hari ini oleh petugas lain!');}
        else throw error;
        await loadWbpUntukAbsen(selectedKamar.id);
        return;
      }
      // Tutup sesi hanya jika SEMUA WBP sudah diabsen
      const totalWbp=wbpList.length;
      const totalAbsen=Object.keys(absenData).length+newEntries.length;
      if(totalAbsen>=totalWbp&&activeSessionId){
        await sb.from('absen_session').update({selesai:true}).eq('id',activeSessionId);
        activeSessionId=null;
        showAlert('success','Selesai!',`Semua ${totalWbp} WBP berhasil diabsen. Kamar dikunci.`);
        resetStep();
      } else {
        showAlert('success','Tersimpan!',`${rows.length} data disimpan. ${totalWbp-totalAbsen} WBP belum diabsen.`);
        await loadWbpUntukAbsen(selectedKamar.id);
      }
    }catch(e){showAlert('error','Gagal',e.message||'Terjadi kesalahan');}
    finally{btn.disabled=false;btn.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5"/></svg> Simpan Absensi';}
  });
}

// ── RIWAYAT ──────────────────────────────────────────────────
async function loadMyRiwayatFilter(){
  const bs=document.getElementById('myRiwayatBlok');
  if(bs?.options.length<=1){
    // Lazy: hanya id dan nama
    const{data:bl}=await sb.from('blok').select('id,nama').order('nama');
    bl?.forEach(b=>bs.add(new Option(b.nama,b.id)));
  }
}
async function loadMyRiwayat(){
  const search=(document.getElementById('myRiwayatSearch')?.value||'').trim();
  const dari=document.getElementById('myRiwayatDari')?.value||'';
  const sampai=document.getElementById('myRiwayatSampai')?.value||'';
  const blokId=document.getElementById('myRiwayatBlok')?.value||'';
  const tbody=document.getElementById('myRiwayatBody');
  tbody.innerHTML=`<tr><td colspan="7" style="padding:16px"><div style="display:flex;flex-direction:column;gap:8px">${'<div style="height:40px;background:#f1f5f9;border-radius:8px;animation:swpulse 1.5s infinite"></div>'.repeat(3)}</div></td></tr>`;

  // Lazy: ambil data milik user ini saja, field terbatas, limit 100
  let q=sb.from('absen_detail')
    .select('id,waktu,tanggal,status,keterangan,wbp:wbp_id(nama,no_registrasi),blok:blok_id(nama)',{count:'exact'})
    .eq('pegawai_id',currentUser.id)
    .order('waktu',{ascending:false})
    .limit(100);
  if(dari)q=q.gte('tanggal',dari);
  if(sampai)q=q.lte('tanggal',sampai);
  if(blokId)q=q.eq('blok_id',blokId);
  const{data,count}=await q;
  let rows=data||[];
  if(search)rows=rows.filter(r=>(r.wbp?.nama||'').toLowerCase().includes(search.toLowerCase()));
  window._myRiwayatData=rows;
  document.getElementById('myRiwayatCount').textContent=`${rows.length} data`;
  if(!rows.length){tbody.innerHTML=`<tr><td colspan="7" style="padding:40px;text-align:center;color:#94a3b8">Belum ada data</td></tr>`;return;}
  tbody.innerHTML=rows.map((row,i)=>`<tr style="border-bottom:1px solid #f1f5f9">
    <td style="padding:10px 14px;font-size:12px;color:#94a3b8">${i+1}</td>
    <td style="padding:10px 14px;font-size:12px;color:#64748b">${formatWIT(row.waktu)}</td>
    <td style="padding:10px 14px"><span style="background:#dbeafe;color:#1d4ed8;padding:2px 8px;border-radius:12px;font-size:11px;font-weight:600">${row.blok?.nama||'—'}</span></td>
    <td style="padding:10px 14px"><div style="font-size:13px;font-weight:700">${row.wbp?.nama||'—'}</div><div style="font-size:11px;color:#94a3b8">${row.wbp?.no_registrasi||''}</div></td>
    <td style="padding:10px 14px"><span style="background:${row.status==='Hadir'?'#d1fae5':'#fee2e2'};color:${row.status==='Hadir'?'#065f46':'#991b1b'};padding:2px 10px;border-radius:12px;font-size:11px;font-weight:700">${row.status}</span></td>
    <td style="padding:10px 14px;font-size:12px;color:#64748b">${row.keterangan||'—'}</td>
    <td style="padding:10px 14px"><button class="btn btn-warning btn-sm btn-icon" onclick="editMyAbsen('${row.id}','${row.status}','${(row.keterangan||'').replace(/'/g,"\\'")}')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-3.5 h-3.5"><path stroke-linecap="round" stroke-linejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z"/></svg></button></td>
  </tr>`).join('');
}
function editMyAbsen(id,status,keterangan){
  document.getElementById('editMyAbsenId').value=id;
  document.getElementById('editMyAbsenStatus').value=status||'Hadir';
  document.getElementById('editMyAbsenKet').value=keterangan||'';
  openModal('editMyAbsenModal');
}
async function saveMyAbsen(){
  const id=document.getElementById('editMyAbsenId').value;
  const status=document.getElementById('editMyAbsenStatus').value;
  const keterangan=document.getElementById('editMyAbsenKet').value;
  const{error}=await sb.from('absen_detail').update({status,keterangan:keterangan||null}).eq('id',id).eq('pegawai_id',currentUser.id);
  if(error){showAlert('error','Gagal',error.message);return;}
  showAlert('success','Diperbarui!','Data absensi diperbarui');closeModal('editMyAbsenModal');loadMyRiwayat();
}
function resetMyRiwayat(){
  const today=todayWIT();
  document.getElementById('myRiwayatSearch').value='';
  document.getElementById('myRiwayatDari').value=today;
  document.getElementById('myRiwayatSampai').value=today;
  document.getElementById('myRiwayatBlok').value='';
  loadMyRiwayat();
}
async function exportRiwayatUser(){
  const data=window._myRiwayatData;if(!data?.length){showAlert('warning','Perhatian','Tidak ada data!');return;}
  const dari=document.getElementById('myRiwayatDari')?.value||'',sampai=document.getElementById('myRiwayatSampai')?.value||'';
  try{
    const{jsPDF}=window.jspdf;const doc=new jsPDF();
    doc.setFontSize(14);doc.setFont('helvetica','bold');doc.text('RIWAYAT ABSENSI WBP',105,14,{align:'center'});
    doc.setFontSize(10);doc.setFont('helvetica','normal');doc.text(`Petugas: ${currentUser.nama}`,105,21,{align:'center'});
    doc.setFontSize(9);doc.text(`Periode: ${dari} s.d. ${sampai}`,105,27,{align:'center'});doc.line(14,30,196,30);
    doc.autoTable({startY:34,head:[['No','Waktu','Kamar','WBP','No. Reg','Status','Keterangan']],body:data.map((r,i)=>[i+1,formatWIT(r.waktu),r.blok?.nama||'—',r.wbp?.nama||'—',r.wbp?.no_registrasi||'—',r.status||'—',r.keterangan||'—']),styles:{fontSize:8,cellPadding:3},headStyles:{fillColor:[30,64,175],textColor:255,fontStyle:'bold'},alternateRowStyles:{fillColor:[248,250,252]}});
    doc.save(`riwayat_${currentUser.nama}_${dari}_${sampai}.pdf`);
    showAlert('success','Berhasil!','PDF diunduh');
  }catch(e){showAlert('error','Gagal',e.message);}
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
  if(!pwd||pwd.length<4){showAlert('warning','Perhatian','Password minimal 4 karakter!');return;}
  if(pwd!==konfirm){showAlert('error','Tidak Cocok','Konfirmasi tidak sesuai!');return;}
  showConfirm('Ganti Password','Yakin ganti password?',async()=>{
    const{error}=await sb.from('pegawai').update({password_plain:pwd}).eq('id',currentUser.id);
    if(error){showAlert('error','Gagal',error.message);return;}
    document.getElementById('userPwdBaru').value='';document.getElementById('userPwdKonfirm').value='';
    showAlert('success','Berhasil!','Password diganti');
  });
}
init();
