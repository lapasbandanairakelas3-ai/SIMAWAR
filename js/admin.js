// SIMAWAR admin.js v6
let currentAdmin=null, wbpPage=1, riwayatPage=1, siteConfigId=null;
let logoFile=null, favFile=null, wbpFotoFile=null, searchTimer=null;
const WBP_PER=15, RIW_PER=20;

function ss(k){return sessionStorage.getItem(k);}
function debounce(fn,ms=400){clearTimeout(searchTimer);searchTimer=setTimeout(fn,ms);}

// ── INIT ──────────────────────────────────────────────────────
async function init(){
  setTimeout(()=>{const s=document.getElementById('splashScreen');if(s){s.style.opacity='0';setTimeout(()=>s.remove(),500);}},800);
  const swId=ss('sw_id'),swRole=ss('sw_role');
  if(!swId||swRole!=='admin'){location.href='index.html';return;}
  const{data:p}=await sb.from('pegawai').select('*').eq('id',swId).maybeSingle();
  if(!p||p.role!=='admin'){sessionStorage.clear();location.href='index.html';return;}
  currentAdmin=p;
  document.getElementById('headerUname').textContent=p.nama;
  document.getElementById('headerAvatar').textContent=p.nama?.[0]?.toUpperCase()||'A';
  document.getElementById('headerDate').textContent=new Date().toLocaleDateString('id-ID',{weekday:'long',day:'numeric',month:'long',year:'numeric',timeZone:'Asia/Jayapura'});
  const today=todayWIT();
  document.getElementById('riwayatDari').value=today;
  document.getElementById('riwayatSampai').value=today;
  const last=ss('sw_admin_page')||'dashboard';
  goPage(last,false);
  loadSiteConfig().catch(()=>{});
}

// ── NAV ──────────────────────────────────────────────────────
function goPage(page,save=true){
  document.querySelectorAll('.page-section').forEach(s=>s.classList.remove('active'));
  document.getElementById('page-'+page)?.classList.add('active');
  ['dashboard','wbp','pegawai','blok','riwayat','siteconfig','akun'].forEach(id=>{
    document.getElementById('nav-'+id)?.classList.toggle('active',id===page);
  });
  const T={dashboard:'Dashboard',wbp:'Data WBP',pegawai:'Data Pegawai/Rupam',blok:'Blok/Kamar',riwayat:'Riwayat Absensi',siteconfig:'Konfigurasi',akun:'Akun Saya'};
  document.getElementById('headerTitle').textContent=T[page]||page;
  if(save)sessionStorage.setItem('sw_admin_page',page);
  closeSidebar();
  if(page==='dashboard')loadDashboard();
  if(page==='wbp'){wbpPage=1;loadWbp();}
  if(page==='pegawai')loadPegawai();
  if(page==='blok')loadBlok();
  if(page==='riwayat'){loadRiwayatFilters();loadRiwayat();}
  if(page==='akun')loadAkun();
  if(page==='siteconfig')loadSiteConfigForm();
}
function toggleSidebar(){document.getElementById('sidebar').classList.toggle('open');document.getElementById('mobileOverlay').classList.toggle('show');}
function closeSidebar(){document.getElementById('sidebar').classList.remove('open');document.getElementById('mobileOverlay').classList.remove('show');}
function openModal(id){const m=document.getElementById(id);m.style.display='flex';requestAnimationFrame(()=>m.classList.add('show'));}
function closeModal(id){const m=document.getElementById(id);m.classList.remove('show');setTimeout(()=>m.style.display='none',300);}
function togglePwd(id,btn){const f=document.getElementById(id);if(!f)return;f.type=f.type==='password'?'text':'password';}
async function doLogout(){showConfirm('Keluar','Yakin ingin keluar?',async()=>{sessionStorage.clear();try{await sb.auth.signOut();}catch(e){}location.href='index.html';});}

// ── SITE CONFIG ──────────────────────────────────────────────
async function loadSiteConfig(){
  const{data}=await sb.from('site_config').select('*').maybeSingle();
  if(!data)return;
  siteConfigId=data.id;
  if(data.site_name){document.title=`Admin — ${data.site_name}`;document.getElementById('sidebarName').textContent=data.site_name;}
  if(data.logo_url){
    document.getElementById('sidebarLogoEmoji').style.display='none';
    const sl=document.getElementById('sidebarLogo');
    if(!sl.querySelector('img')){const img=document.createElement('img');img.src=data.logo_url;img.style.cssText='width:100%;height:100%;object-fit:cover;border-radius:8px';sl.appendChild(img);}
  }
  if(data.favicon_url)document.getElementById('faviconEl').href=data.favicon_url;
}
async function loadSiteConfigForm(){
  const{data}=await sb.from('site_config').select('*').maybeSingle();
  if(!data)return;siteConfigId=data.id;
  const v=(id,val)=>{const el=document.getElementById(id);if(el)el.value=val||'';};
  v('cfgName',data.site_name);v('cfgDesc',data.site_desc);v('cfgInstansi',data.instansi);v('cfgAlamat',data.alamat);
  if(data.logo_url){const img=document.getElementById('logoPreview');if(img){img.src=data.logo_url;img.style.display='block';}const ph=document.getElementById('logoPlaceholder');if(ph)ph.style.display='none';const rb=document.getElementById('removeLogoBtn');if(rb)rb.style.display='inline-flex';updatePrevLogo(data.logo_url);}
  if(data.favicon_url){const img=document.getElementById('favPreview');if(img){img.src=data.favicon_url;img.style.display='block';}const ph=document.getElementById('favPlaceholder');if(ph)ph.style.display='none';}
  ['cfgName','cfgDesc'].forEach(id=>{const el=document.getElementById(id);if(el)el.oninput=()=>{const pn=document.getElementById('previewName');const pd=document.getElementById('previewDesc');if(pn)pn.textContent=document.getElementById('cfgName')?.value||'SIMAWAR';if(pd)pd.textContent=document.getElementById('cfgDesc')?.value?.split('\n')[0]||'';};});
}
function updatePrevLogo(url){const box=document.getElementById('previewLogoBox'),em=document.getElementById('previewLogoEmoji');if(!box)return;if(url){if(em)em.style.display='none';let img=box.querySelector('img');if(!img){img=document.createElement('img');box.appendChild(img);}img.src=url;img.style.cssText='width:100%;height:100%;object-fit:cover;border-radius:10px';}else{if(em)em.style.display='block';box.querySelector('img')?.remove();}}
function previewLogo(e){logoFile=e.target.files[0];if(!logoFile)return;const r=new FileReader();r.onload=ev=>{const img=document.getElementById('logoPreview');if(img){img.src=ev.target.result;img.style.display='block';}const ph=document.getElementById('logoPlaceholder');if(ph)ph.style.display='none';const rb=document.getElementById('removeLogoBtn');if(rb)rb.style.display='inline-flex';updatePrevLogo(ev.target.result);};r.readAsDataURL(logoFile);}
function previewFav(e){favFile=e.target.files[0];if(!favFile)return;const r=new FileReader();r.onload=ev=>{const img=document.getElementById('favPreview');if(img){img.src=ev.target.result;img.style.display='block';}const ph=document.getElementById('favPlaceholder');if(ph)ph.style.display='none';};r.readAsDataURL(favFile);}
function removeLogo(){showConfirm('Hapus Logo','Yakin hapus logo?',async()=>{if(siteConfigId)await sb.from('site_config').update({logo_url:null}).eq('id',siteConfigId);const img=document.getElementById('logoPreview');if(img)img.style.display='none';const ph=document.getElementById('logoPlaceholder');if(ph)ph.style.display='flex';const rb=document.getElementById('removeLogoBtn');if(rb)rb.style.display='none';logoFile=null;updatePrevLogo(null);showAlert('success','Dihapus!','Logo dihapus');loadSiteConfig();},'danger');}
async function uploadFile(file,bucket,path){if(file.size>3*1024*1024)throw new Error('File >3MB!');const{error}=await sb.storage.from(bucket).upload(path,file,{upsert:true});if(error)throw error;return sb.storage.from(bucket).getPublicUrl(path).data.publicUrl;}
async function saveSiteConfig(){
  const payload={site_name:document.getElementById('cfgName')?.value.trim(),site_desc:document.getElementById('cfgDesc')?.value,instansi:document.getElementById('cfgInstansi')?.value,alamat:document.getElementById('cfgAlamat')?.value};
  try{
    if(logoFile){showAlert('info','Upload','Mengupload logo...');payload.logo_url=await uploadFile(logoFile,'assets',`logo_${Date.now()}.${logoFile.name.split('.').pop()}`);}
    if(favFile){payload.favicon_url=await uploadFile(favFile,'assets',`fav_${Date.now()}.${favFile.name.split('.').pop()}`);}
    const res=siteConfigId?await sb.from('site_config').update(payload).eq('id',siteConfigId):await sb.from('site_config').insert(payload);
    if(res.error)throw res.error;
    showAlert('success','Berhasil!','Konfigurasi disimpan');logoFile=null;favFile=null;loadSiteConfig();
  }catch(e){showAlert('error','Gagal',e.message);}
}
function resetSiteConfig(){showConfirm('Reset','Reset konfigurasi ke default?',async()=>{await sb.from('site_config').update({site_name:'SIMAWAR',site_desc:'Sistem Informasi Monitoring Warga Binaan',logo_url:null,favicon_url:null}).eq('id',siteConfigId);showAlert('success','Reset!','Konfigurasi direset');loadSiteConfig();loadSiteConfigForm();},'danger');}

// ── DASHBOARD ────────────────────────────────────────────────
async function loadDashboard(){
  const[wR,pR,bR,aR]=await Promise.all([
    sb.from('wbp').select('id',{count:'exact',head:true}),
    sb.from('pegawai').select('id',{count:'exact',head:true}).eq('role','user'),
    sb.from('blok').select('id',{count:'exact',head:true}),
    sb.from('absen_detail').select('id',{count:'exact',head:true}).eq('tanggal',todayWIT())
  ]);
  const D=[
    {l:'Total WBP',v:wR.count||0,bg:'#eff6ff',ic:'#3b82f6',d:'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z'},
    {l:'Rupam Aktif',v:pR.count||0,bg:'#f0fdf4',ic:'#10b981',d:'M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6a4 4 0 11-8 0 4 4 0 018 0zm-4 9a9 9 0 00-9 9h18a9 9 0 00-9-9z'},
    {l:'Blok/Kamar',v:bR.count||0,bg:'#fffbeb',ic:'#f59e0b',d:'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6'},
    {l:'Absensi Hari Ini',v:aR.count||0,bg:'#fdf4ff',ic:'#a855f7',d:'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z'}
  ];
  document.getElementById('dashStats').innerHTML=D.map(s=>`<div class="stat-card"><div class="stat-icon" style="background:${s.bg};color:${s.ic}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="${s.d}"/></svg></div><div class="stat-value">${s.v}</div><div class="stat-label">${s.l}</div></div>`).join('');
  document.getElementById('dashTodayDate').textContent=new Date().toLocaleDateString('id-ID',{weekday:'long',day:'numeric',month:'long',year:'numeric',timeZone:'Asia/Jayapura'});
  const{data:bloks}=await sb.from('blok').select('*,wbp(count)');
  const bg=document.getElementById('dashBlokGrid');
  if(bg)bg.innerHTML=!bloks?.length?`<div style="grid-column:1/-1">${emptyState('Belum Ada Blok','Tambahkan di menu Blok/Kamar')}</div>`:bloks.map(b=>`<div class="kamar-card" onclick="goPage('blok')"><div style="font-size:28px;margin-bottom:8px">🏠</div><div style="font-size:13px;font-weight:800">${b.nama}</div><div style="font-size:11px;color:#94a3b8;margin-top:3px">${b.wbp?.[0]?.count||0} WBP</div></div>`).join('');
}

// ── WBP CRUD ─────────────────────────────────────────────────
async function loadWbp(){
  const search=document.getElementById('wbpSearch')?.value.trim()||'';
  const blokF=document.getElementById('wbpBlokFilter')?.value||'';
  const jkF=document.getElementById('wbpJkFilter')?.value||'';
  const tbody=document.getElementById('wbpTableBody');
  const blokSel=document.getElementById('wbpBlokFilter');
  if(blokSel?.options.length<=1){const{data:bl}=await sb.from('blok').select('id,nama').order('nama');bl?.forEach(b=>blokSel.add(new Option(b.nama,b.id)));}
  if(tbody)tbody.innerHTML=skel(16,7).repeat(4);
  let q=sb.from('wbp').select('*,blok(nama)',{count:'exact'});
  if(search)q=q.or(`nama.ilike.%${search}%,no_registrasi.ilike.%${search}%`);
  if(blokF)q=q.eq('blok_id',blokF);if(jkF)q=q.eq('jk',jkF);
  q=q.order('nama').range((wbpPage-1)*WBP_PER,wbpPage*WBP_PER-1);
  const{data,count}=await q;
  document.getElementById('wbpCount').textContent=`${count||0} data`;
  if(!data?.length){if(tbody)tbody.innerHTML=`<tr><td colspan="7">${emptyState('Belum Ada WBP','Tambahkan via tombol Tambah WBP')}</td></tr>`;document.getElementById('wbpPagination').innerHTML='';return;}
  const no0=(wbpPage-1)*WBP_PER;
  if(tbody)tbody.innerHTML=data.map((w,i)=>`<tr class="fade-in">
    <td style="font-size:12px;color:#94a3b8">${no0+i+1}</td>
    <td style="font-size:13px;font-weight:700">${w.nama}</td>
    <td><span class="badge badge-blue">${w.no_registrasi||'—'}</span></td>
    <td><span class="badge ${w.jk==='L'?'badge-blue':'badge-purple'}">${w.jk==='L'?'Laki-laki':'Perempuan'}</span></td>
    <td style="font-size:13px">${w.blok?.nama||'—'}</td>
    <td style="font-size:12px;color:#64748b">${w.masa_pidana||'—'}</td>
    <td><div style="display:flex;gap:6px">
      <button class="btn btn-warning btn-sm btn-icon" onclick="editWbp('${w.id}')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-3.5 h-3.5"><path stroke-linecap="round" stroke-linejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z"/></svg></button>
      <button class="btn btn-danger btn-sm btn-icon" onclick="deleteWbp('${w.id}','${w.nama.replace(/'/g,"\\'")}')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-3.5 h-3.5"><path stroke-linecap="round" stroke-linejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"/></svg></button>
    </div></td>
  </tr>`).join('');
  const tot=Math.ceil(count/WBP_PER);
  document.getElementById('wbpPagination').innerHTML=tot>1?Array.from({length:Math.min(tot,10)},(_,i)=>`<button onclick="wbpPage=${i+1};loadWbp()" class="btn btn-sm ${i+1===wbpPage?'btn-primary':'btn-ghost'}" style="min-width:32px">${i+1}</button>`).join(''):'';
}
async function openWbpModal(){
  ['wbpId','wbpNama','wbpNoreg','wbpTglBebas','wbpMasa','wbpKasus'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
  document.getElementById('wbpJk').value='L';
  const bs=document.getElementById('wbpBlok');bs.innerHTML='<option value="">— Pilih Blok —</option>';
  const{data:bl}=await sb.from('blok').select('id,nama').order('nama');bl?.forEach(b=>bs.add(new Option(b.nama,b.id)));
  document.getElementById('wbpModalTitle').textContent='Tambah WBP';
  openModal('wbpModal');
}
async function editWbp(id){
  await openWbpModal();
  const{data:w}=await sb.from('wbp').select('*').eq('id',id).maybeSingle();if(!w)return;
  document.getElementById('wbpModalTitle').textContent='Edit WBP';
  const v=(eid,val)=>{const el=document.getElementById(eid);if(el)el.value=val||'';};
  v('wbpId',w.id);v('wbpNama',w.nama);v('wbpNoreg',w.no_registrasi);v('wbpTglBebas',w.tgl_bebas);v('wbpMasa',w.masa_pidana);v('wbpKasus',w.kasus);
  document.getElementById('wbpJk').value=w.jk||'L';document.getElementById('wbpBlok').value=w.blok_id||'';
}
async function saveWbp(){
  const id=document.getElementById('wbpId').value,nama=document.getElementById('wbpNama').value.trim(),noreg=document.getElementById('wbpNoreg').value.trim();
  if(!nama||!noreg){showAlert('warning','Perhatian','Nama dan No. Registrasi wajib!');return;}
  const btn=document.getElementById('wbpSaveBtn');btn.disabled=true;btn.textContent='Menyimpan...';
  try{
    const payload={nama,no_registrasi:noreg,jk:document.getElementById('wbpJk').value,blok_id:document.getElementById('wbpBlok').value||null,tgl_bebas:document.getElementById('wbpTglBebas').value||null,masa_pidana:document.getElementById('wbpMasa').value,kasus:document.getElementById('wbpKasus').value};
    const res=id?await sb.from('wbp').update(payload).eq('id',id):await sb.from('wbp').insert(payload);
    if(res.error)throw res.error;
    showAlert('success','Berhasil!',id?'WBP diperbarui':'WBP ditambahkan');closeModal('wbpModal');loadWbp();
  }catch(e){showAlert('error','Gagal',e.message);}
  finally{btn.disabled=false;btn.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-4 h-4"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5"/></svg> Simpan';}
}
async function deleteWbp(id,nama){showConfirm('Hapus WBP',`Hapus WBP <b>${nama}</b>?`,async()=>{const{error}=await sb.from('wbp').delete().eq('id',id);if(error){showAlert('error','Gagal',error.message);return;}showAlert('success','Dihapus!',`${nama} dihapus`);loadWbp();});}

// ── PEGAWAI CRUD ─────────────────────────────────────────────
async function loadPegawai(){
  const search=document.getElementById('pegawaiSearch')?.value.trim()||'';
  const roleF=document.getElementById('pegawaiRoleFilter')?.value||'';
  const tbody=document.getElementById('pegawaiTableBody');
  if(tbody)tbody.innerHTML=skel(16,6).repeat(3);
  let q=sb.from('pegawai').select('*',{count:'exact'});
  if(search)q=q.or(`nama.ilike.%${search}%,username.ilike.%${search}%`);
  if(roleF)q=q.eq('role',roleF);q=q.order('nama');
  const{data,count}=await q;
  document.getElementById('pegawaiCount').textContent=`${count||0} data`;
  if(!data?.length){if(tbody)tbody.innerHTML=`<tr><td colspan="6">${emptyState('Belum Ada Petugas')}</td></tr>`;return;}
  if(tbody)tbody.innerHTML=data.map((p,i)=>`<tr class="fade-in">
    <td style="font-size:12px;color:#94a3b8">${i+1}</td>
    <td><div style="display:flex;align-items:center;gap:10px"><div class="table-avatar" style="background:${p.role==='admin'?'linear-gradient(135deg,#7c3aed,#4f46e5)':'linear-gradient(135deg,#3b82f6,#1e40af)'}">${p.nama?.[0]||'?'}</div><div style="font-size:13px;font-weight:700">${p.nama}</div></div></td>
    <td><code style="background:#f1f5f9;padding:3px 8px;border-radius:6px;font-size:12px">${p.username}</code></td>
    <td>
      ${p.password_plain?`<div style="display:flex;align-items:center;gap:6px"><code id="pwd_${p.id}" style="background:#fef9c3;border:1px solid #fde68a;padding:3px 8px;border-radius:6px;font-size:12px;color:#92400e;letter-spacing:2px">••••••••</code>
      <button onclick="togglePwdCell('${p.id}','${(p.password_plain||'').replace(/'/g,"\\'")}')" style="background:none;border:none;cursor:pointer;color:#94a3b8;padding:2px"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><path stroke-linecap="round" stroke-linejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.964-7.178z"/><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg></button></div>`:'<span style="color:#d1d5db;font-size:12px">—</span>'}
    </td>
    <td><span class="badge ${p.role==='admin'?'badge-purple':'badge-blue'}">${p.role==='admin'?'Admin':'Rupam'}</span></td>
    <td><div style="display:flex;gap:6px">
      <button class="btn btn-warning btn-sm btn-icon" onclick="editPegawai('${p.id}')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-3.5 h-3.5"><path stroke-linecap="round" stroke-linejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z"/></svg></button>
      ${p.id!==currentAdmin?.id?`<button class="btn btn-danger btn-sm btn-icon" onclick="deletePegawai('${p.id}','${p.nama.replace(/'/g,"\\'")}')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-3.5 h-3.5"><path stroke-linecap="round" stroke-linejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"/></svg></button>`:''}
    </div></td>
  </tr>`).join('');
}
function togglePwdCell(id,pwd){const el=document.getElementById('pwd_'+id);if(!el)return;if(el.textContent==='••••••••'){el.textContent=pwd||'(kosong)';el.style.letterSpacing='normal';el.style.background='#fef08a';}else{el.textContent='••••••••';el.style.letterSpacing='2px';el.style.background='#fef9c3';}}
function openPegawaiModal(){['pegawaiId','pegawaiNama','pegawaiUsername','pegawaiPassword'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});document.getElementById('pegawaiRole').value='user';document.getElementById('pegawaiModalTitle').textContent='Tambah Petugas (Rupam)';openModal('pegawaiModal');}
async function editPegawai(id){openPegawaiModal();const{data:p}=await sb.from('pegawai').select('*').eq('id',id).maybeSingle();if(!p)return;document.getElementById('pegawaiModalTitle').textContent='Edit Petugas';document.getElementById('pegawaiId').value=p.id||'';document.getElementById('pegawaiNama').value=p.nama||'';document.getElementById('pegawaiUsername').value=p.username||'';document.getElementById('pegawaiPassword').value=p.password_plain||'';document.getElementById('pegawaiRole').value=p.role||'user';}
async function savePegawai(){
  const id=document.getElementById('pegawaiId').value,nama=document.getElementById('pegawaiNama').value.trim(),username=document.getElementById('pegawaiUsername').value.trim().toLowerCase().replace(/\s+/g,''),password=document.getElementById('pegawaiPassword').value;
  if(!nama){showAlert('warning','Perhatian','Nama wajib!');return;}if(!username){showAlert('warning','Perhatian','Username wajib!');return;}if(!password){showAlert('warning','Perhatian','Password wajib!');return;}
  const btn=document.getElementById('pegawaiSaveBtn');btn.disabled=true;btn.textContent='Menyimpan...';
  try{
    if(!id){const{data:ex}=await sb.from('pegawai').select('id').eq('username',username).maybeSingle();if(ex)throw new Error(`Username "${username}" sudah dipakai!`);}
    const payload={nama,username,password_plain:password,role:document.getElementById('pegawaiRole').value||'user'};
    const res=id?await sb.from('pegawai').update(payload).eq('id',id):await sb.from('pegawai').insert(payload);
    if(res.error)throw res.error;
    showAlert('success','Berhasil!',id?`${nama} diperbarui`:`${nama} ditambahkan! Login: ${username} / ${password}`,id?3000:7000);closeModal('pegawaiModal');loadPegawai();
  }catch(e){showAlert('error','Gagal',e.message);}
  finally{btn.disabled=false;btn.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-4 h-4"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5"/></svg> Simpan';}
}
async function deletePegawai(id,nama){showConfirm('Hapus Petugas',`Hapus <b>${nama}</b>?`,async()=>{const{error}=await sb.from('pegawai').delete().eq('id',id);if(error){showAlert('error','Gagal',error.message);return;}showAlert('success','Dihapus!',`${nama} dihapus`);loadPegawai();});}

// ── BLOK CRUD ────────────────────────────────────────────────
async function loadBlok(){
  const search=document.getElementById('blokSearch')?.value.trim()||'';
  const tbody=document.getElementById('blokTableBody');
  if(tbody)tbody.innerHTML=skel(16,6).repeat(3);
  let q=sb.from('blok').select('*,wbp(count)',{count:'exact'});if(search)q=q.ilike('nama',`%${search}%`);q=q.order('nama');
  const{data,count}=await q;document.getElementById('blokCount').textContent=`${count||0} data`;
  if(!data?.length){if(tbody)tbody.innerHTML=`<tr><td colspan="6">${emptyState('Belum Ada Blok')}</td></tr>`;return;}
  if(tbody)tbody.innerHTML=data.map((b,i)=>`<tr class="fade-in">
    <td style="font-size:12px;color:#94a3b8">${i+1}</td>
    <td style="font-size:13px;font-weight:700">${b.nama}</td>
    <td><span class="badge badge-blue">${b.kapasitas||'—'} orang</span></td>
    <td><span class="badge ${b.jk==='L'?'badge-blue':b.jk==='P'?'badge-purple':'badge-gray'}">${b.jk==='L'?'Laki-laki':b.jk==='P'?'Perempuan':'Campur'}</span></td>
    <td><span style="font-size:13px;font-weight:800;color:${(b.wbp?.[0]?.count||0)>=(b.kapasitas||9999)?'#ef4444':'#10b981'}">${b.wbp?.[0]?.count||0}</span><span style="font-size:12px;color:#94a3b8"> / ${b.kapasitas||'?'}</span></td>
    <td><div style="display:flex;gap:6px">
      <button class="btn btn-warning btn-sm btn-icon" onclick="editBlok('${b.id}')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-3.5 h-3.5"><path stroke-linecap="round" stroke-linejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z"/></svg></button>
      <button class="btn btn-danger btn-sm btn-icon" onclick="deleteBlok('${b.id}','${b.nama.replace(/'/g,"\\'")}')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-3.5 h-3.5"><path stroke-linecap="round" stroke-linejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"/></svg></button>
    </div></td>
  </tr>`).join('');
}
function openBlokModal(){['blokId','blokNama','blokKapasitas','blokKet'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});document.getElementById('blokJk').value='L';document.getElementById('blokModalTitle').textContent='Tambah Blok/Kamar';openModal('blokModal');}
async function editBlok(id){const{data:b}=await sb.from('blok').select('*').eq('id',id).maybeSingle();if(!b)return;document.getElementById('blokModalTitle').textContent='Edit Blok';document.getElementById('blokId').value=b.id;document.getElementById('blokNama').value=b.nama;document.getElementById('blokKapasitas').value=b.kapasitas||'';document.getElementById('blokJk').value=b.jk||'L';document.getElementById('blokKet').value=b.keterangan||'';openModal('blokModal');}
async function saveBlok(){const id=document.getElementById('blokId').value,nama=document.getElementById('blokNama').value.trim();if(!nama){showAlert('warning','Perhatian','Nama blok wajib!');return;}const payload={nama,kapasitas:parseInt(document.getElementById('blokKapasitas').value)||null,jk:document.getElementById('blokJk').value,keterangan:document.getElementById('blokKet').value};const res=id?await sb.from('blok').update(payload).eq('id',id):await sb.from('blok').insert(payload);if(res.error){showAlert('error','Gagal',res.error.message);return;}showAlert('success','Berhasil!',id?'Blok diperbarui':'Blok ditambahkan');closeModal('blokModal');loadBlok();}
async function deleteBlok(id,nama){showConfirm('Hapus Blok',`Hapus blok <b>${nama}</b>?`,async()=>{const{error}=await sb.from('blok').delete().eq('id',id);if(error){showAlert('error','Gagal',error.message);return;}showAlert('success','Dihapus!',`${nama} dihapus`);loadBlok();});}

// ── RIWAYAT (Supabase, semua user, edit+hapus) ───────────────
async function loadRiwayatFilters(){
  const bs=document.getElementById('riwayatBlokFilter');if(bs?.options.length<=1){const{data:bl}=await sb.from('blok').select('id,nama').order('nama');bl?.forEach(b=>bs.add(new Option(b.nama,b.id)));}
  const ps=document.getElementById('riwayatPegawaiFilter');if(ps?.options.length<=1){const{data:pg}=await sb.from('pegawai').select('id,nama').order('nama');pg?.forEach(p=>ps.add(new Option(p.nama,p.id)));}
}
async function loadRiwayat(){
  const tbody=document.getElementById('riwayatTableBody');
  if(tbody)tbody.innerHTML=skel(16,8).repeat(4);
  try{
    const dari=document.getElementById('riwayatDari')?.value||'',sampai=document.getElementById('riwayatSampai')?.value||'';
    const blok=document.getElementById('riwayatBlokFilter')?.value||'',peg=document.getElementById('riwayatPegawaiFilter')?.value||'';
    const search=document.getElementById('riwayatSearch')?.value.trim()||'';
    let q=sb.from('absen_detail').select('*,wbp:wbp_id(nama,no_registrasi),blok:blok_id(nama),pegawai:pegawai_id(nama)',{count:'exact'}).order('waktu',{ascending:false});
    if(dari)q=q.gte('tanggal',dari);if(sampai)q=q.lte('tanggal',sampai);if(blok)q=q.eq('blok_id',blok);if(peg)q=q.eq('pegawai_id',peg);
    const{data,count}=await q;
    let rows=data||[];
    if(search)rows=rows.filter(r=>(r.wbp?.nama||'').toLowerCase().includes(search.toLowerCase())||(r.pegawai?.nama||'').toLowerCase().includes(search.toLowerCase()));
    window._riwayatData=rows;
    document.getElementById('riwayatCount').textContent=`${rows.length} data`;
    if(!rows.length){if(tbody)tbody.innerHTML=`<tr><td colspan="8">${emptyState('Tidak Ada Data','Coba ubah filter')}</td></tr>`;document.getElementById('riwayatPagination').innerHTML='';return;}
    const no0=(riwayatPage-1)*RIW_PER,pd=rows.slice(no0,no0+RIW_PER);
    if(tbody)tbody.innerHTML=pd.map((row,i)=>`<tr class="fade-in">
      <td style="font-size:12px;color:#94a3b8">${no0+i+1}</td>
      <td style="font-size:12px;color:#64748b">${formatWIT(row.waktu)}</td>
      <td style="font-size:13px;font-weight:700">${row.pegawai?.nama||'—'}</td>
      <td><span class="badge badge-blue">${row.blok?.nama||'—'}</span></td>
      <td><div style="font-size:13px;font-weight:600">${row.wbp?.nama||'—'}</div><div style="font-size:11px;color:#94a3b8">${row.wbp?.no_registrasi||''}</div></td>
      <td><span class="badge ${row.status==='Hadir'?'badge-green':'badge-red'}">${row.status||'—'}</span></td>
      <td style="font-size:12px;color:#64748b">${row.keterangan||'—'}</td>
      <td><div style="display:flex;gap:6px">
        <button class="btn btn-warning btn-sm btn-icon" title="Edit" onclick="editAbsen('${row.id}','${row.status}','${(row.keterangan||'').replace(/'/g,"\\'")}')" ><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-3.5 h-3.5"><path stroke-linecap="round" stroke-linejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z"/></svg></button>
        <button class="btn btn-danger btn-sm btn-icon" title="Hapus" onclick="deleteAbsen('${row.id}')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-3.5 h-3.5"><path stroke-linecap="round" stroke-linejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.114 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"/></svg></button>
      </div></td>
    </tr>`).join('');
    const tot=Math.ceil(rows.length/RIW_PER);
    document.getElementById('riwayatPagination').innerHTML=tot>1?Array.from({length:Math.min(tot,10)},(_,i)=>`<button onclick="riwayatPage=${i+1};loadRiwayat()" class="btn btn-sm ${i+1===riwayatPage?'btn-primary':'btn-ghost'}" style="min-width:32px">${i+1}</button>`).join(''):'';
  }catch(e){console.error(e);if(tbody)tbody.innerHTML=`<tr><td colspan="8">${emptyState('Gagal Memuat',e.message)}</td></tr>`;}
}
function editAbsen(id, status, keterangan){
  document.getElementById('editAbsenId').value=id;
  document.getElementById('editAbsenStatus').value=status||'Hadir';
  document.getElementById('editAbsenKet').value=keterangan||'';
  openModal('editAbsenModal');
}
async function saveAbsen(){
  const id=document.getElementById('editAbsenId').value;
  const status=document.getElementById('editAbsenStatus').value;
  const keterangan=document.getElementById('editAbsenKet').value;
  const{error}=await sb.from('absen_detail').update({status,keterangan:keterangan||null}).eq('id',id);
  if(error){showAlert('error','Gagal',error.message);return;}
  showAlert('success','Diperbarui!','Data absensi diperbarui');closeModal('editAbsenModal');loadRiwayat();
}
async function deleteAbsen(id){showConfirm('Hapus Absensi','Yakin hapus data absensi ini?',async()=>{const{error}=await sb.from('absen_detail').delete().eq('id',id);if(error){showAlert('error','Gagal',error.message);return;}showAlert('success','Dihapus!','Data absensi dihapus');loadRiwayat();});}
function resetRiwayatFilter(){const today=todayWIT();['riwayatSearch','riwayatBlokFilter','riwayatPegawaiFilter'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});document.getElementById('riwayatDari').value=today;document.getElementById('riwayatSampai').value=today;riwayatPage=1;loadRiwayat();}
async function exportRiwayat(){
  const data=window._riwayatData;if(!data?.length){showAlert('warning','Perhatian','Tidak ada data!');return;}
  const dari=document.getElementById('riwayatDari')?.value||'',sampai=document.getElementById('riwayatSampai')?.value||'';
  try{const{jsPDF}=window.jspdf;const doc=new jsPDF({orientation:'landscape'});doc.setFontSize(14);doc.setFont('helvetica','bold');doc.text('LAPORAN ABSENSI WBP',148,14,{align:'center'});doc.setFontSize(10);doc.setFont('helvetica','normal');doc.text(document.getElementById('sidebarName')?.textContent||'SIMAWAR',148,20,{align:'center'});doc.setFontSize(9);doc.text(`Periode: ${dari} s.d. ${sampai}  |  Dicetak: ${new Date().toLocaleDateString('id-ID',{timeZone:'Asia/Jayapura'})}`,148,26,{align:'center'});doc.line(14,29,283,29);
  doc.autoTable({startY:33,head:[['No','Waktu','Petugas','Blok','WBP','No. Reg','Status','Keterangan']],body:data.map((r,i)=>[i+1,formatWIT(r.waktu),r.pegawai?.nama||'—',r.blok?.nama||'—',r.wbp?.nama||'—',r.wbp?.no_registrasi||'—',r.status||'—',r.keterangan||'—']),styles:{fontSize:8,cellPadding:3},headStyles:{fillColor:[30,64,175],textColor:255,fontStyle:'bold'},alternateRowStyles:{fillColor:[248,250,252]}});
  doc.save(`laporan_absensi_${dari}_${sampai}.pdf`);showAlert('success','Berhasil!','PDF diunduh');}catch(e){showAlert('error','Gagal',e.message);}
}

// ── AKUN ─────────────────────────────────────────────────────
async function loadAkun(){
  if(!currentAdmin)return;
  const t=(id,v)=>{const el=document.getElementById(id);if(el)el.textContent=v||'—';};
  t('akunNamaDisplay',currentAdmin.nama);t('akunRoleDisplay',currentAdmin.role==='admin'?'Administrator':'Rupam');
  const av=document.getElementById('akunAvatarBig');if(av)av.textContent=currentAdmin.nama?.[0]?.toUpperCase()||'A';
  const un=document.getElementById('akunUsernameDisplay');if(un)un.textContent=currentAdmin.username||'—';
  const fn=document.getElementById('akunNama');if(fn)fn.value=currentAdmin.nama||'';
  const fu=document.getElementById('akunUsername');if(fu)fu.value=currentAdmin.username||'';
  // Kosongkan field password saat load
  ['akunPwdBaru','akunPwdKonfirm'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
}
async function saveAkun(){
  const nama=document.getElementById('akunNama')?.value.trim();
  if(!nama){showAlert('warning','Perhatian','Nama tidak boleh kosong!');return;}
  const{error}=await sb.from('pegawai').update({nama}).eq('id',currentAdmin.id);
  if(error){showAlert('error','Gagal',error.message);return;}
  currentAdmin.nama=nama;sessionStorage.setItem('sw_nama',nama);
  document.getElementById('headerUname').textContent=nama;document.getElementById('headerAvatar').textContent=nama[0].toUpperCase();
  document.getElementById('akunAvatarBig').textContent=nama[0].toUpperCase();document.getElementById('akunNamaDisplay').textContent=nama;
  showAlert('success','Berhasil!','Nama diperbarui');
}
async function savePassword(){
  const pwd=document.getElementById('akunPwdBaru')?.value,konfirm=document.getElementById('akunPwdKonfirm')?.value;
  if(!pwd||pwd.length<4){showAlert('warning','Perhatian','Password minimal 4 karakter!');return;}
  if(pwd!==konfirm){showAlert('error','Tidak Cocok','Konfirmasi tidak sesuai!');return;}
  showConfirm('Ganti Password','Yakin ganti password?',async()=>{
    const{error}=await sb.from('pegawai').update({password_plain:pwd}).eq('id',currentAdmin.id);
    if(error){showAlert('error','Gagal',error.message);return;}
    currentAdmin.password_plain=pwd;
    document.getElementById('akunPwdBaru').value='';document.getElementById('akunPwdKonfirm').value='';
    showAlert('success','Berhasil!','Password diganti');
  });
}
init();
