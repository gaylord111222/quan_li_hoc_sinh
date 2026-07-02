/* ============================================================
   CLASSROOM COMPANION — app.js  v5 (Firebase)
   Data syncs across all devices in real time via Firebase.
   ============================================================ */

/* Firebase loaded via CDN scripts in index.html */

const firebaseConfig = {
  apiKey: "AIzaSyDB0aBW3lBZEj-x6IxFOu6s3FwtnXimeTw",
  authDomain: "quan-li-hoc-sinh-fdd84.firebaseapp.com",
  databaseURL: "https://quan-li-hoc-sinh-fdd84-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "quan-li-hoc-sinh-fdd84",
  storageBucket: "quan-li-hoc-sinh-fdd84.firebasestorage.app",
  messagingSenderId: "275559965300",
  appId: "1:275559965300:web:8634e90495d2053fb46721"
};

const firebaseApp = firebase.initializeApp(firebaseConfig);
const db = firebase.database();
const DATA_REF = db.ref('appData');

/* ============================================================
   STATE — single object, mirrors Firebase
   ============================================================ */
let state = {
  students: [],
  schedules: [],
  attendance: {},
  wheelRemoved: {},
  feePayments: {},
  teachers: []
};
let appReady = false;

function saveData(){
  state.grades=GRADES;
  DATA_REF.set(state).catch(e=>console.error('Firebase save error:', e));
}

/* ============================================================
   CONSTANTS
   ============================================================ */
let GRADES = [1,2,3,4,5,6,7,8,9];
const DEFAULT_GRADES = [1,2,3,4,5,6,7,8,9];
const DAY_NAMES = ['Chủ nhật','Thứ hai','Thứ ba','Thứ tư','Thứ năm','Thứ sáu','Thứ bảy'];
const MONTH_NAMES = ['T1','T2','T3','T4','T5','T6','T7','T8','T9','T10','T11','T12'];
const SCHED_COLORS = [
  '#2F4538','#E8B84B','#C45B4D','#4A7FB5',
  '#7B5EA7','#3A9E7E','#D4813A','#5C8A3C','#B5507A'
];

function uid(){
  return Math.random().toString(36).slice(2,10)+Date.now().toString(36).slice(-4);
}
function escapeHtml(str=''){
  return str.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function initials(name){
  return (name||'').trim().split(/\s+/).slice(-2).map(w=>w[0]?.toUpperCase()||'').join('');
}
function formatTime(t){
  if(!t) return '--:--';
  const [h,m]=t.split(':').map(Number);
  const period=h>=12?'PM':'AM';
  const h12=((h+11)%12)+1;
  return `${h12}:${String(m).padStart(2,'0')} ${period}`;
}
function formatFee(n){
  if(!n&&n!==0) return '—';
  return Number(n).toLocaleString('vi-VN')+' ₫';
}
function studentsInGrade(grade){
  return (state.students||[]).filter(s=>s.grade===grade);
}
function schedColorIdx(scheduleId){
  const idx=(state.schedules||[]).findIndex(s=>s.id===scheduleId);
  return idx>=0?idx%SCHED_COLORS.length:0;
}
function timeToMins(t){
  if(!t) return 0;
  const [h,m]=t.split(':').map(Number);
  return h*60+m;
}
function minsToTime(m){
  const h=Math.floor(m/60),mn=m%60;
  return `${String(h).padStart(2,'0')}:${String(mn).padStart(2,'0')}`;
}

/* ============================================================
   LOADING SCREEN
   ============================================================ */
function showLoading(on){
  let el=document.getElementById('loadingOverlay');
  if(!el){
    el=document.createElement('div');
    el.id='loadingOverlay';
    el.style.cssText='position:fixed;inset:0;background:var(--green-deep);align-items:center;justify-content:center;z-index:999;color:var(--chalk);font-size:20px;font-weight:700;flex-direction:column;gap:16px';
    el.innerHTML='<div style="font-size:36px">📚</div><div>Loading Classroom Companion…</div>';
    document.body.appendChild(el);
  }
  el.style.display = on ? 'flex' : 'none';
}

/* ============================================================
   NAVIGATION
   ============================================================ */
const allScreens={
  'grades':document.getElementById('screen-grades'),
  'roster':document.getElementById('screen-roster'),
  'schedule':document.getElementById('screen-schedule'),
  'schedule-detail':document.getElementById('screen-schedule-detail'),
  'wheel-grades':document.getElementById('screen-wheel-grades'),
  'wheel':document.getElementById('screen-wheel'),
  'hoc-phi':document.getElementById('screen-hoc-phi'),
  'hoc-sinh':document.getElementById('screen-hoc-sinh'),
  'hoc-phi-detail':document.getElementById('screen-hoc-phi-detail'),
  'giao-vien':document.getElementById('screen-giao-vien'),
};
const titles={
  'grades':'Lớp học','roster':'Grade',
  'schedule':'Lịch dạy','schedule-detail':'Lịch dạy',
  'wheel-grades':'Name Wheel','wheel':'Name Wheel',
  'hoc-phi':'Học phí','hoc-phi-detail':'Học phí',
  'giao-vien':'Giáo viên','hoc-sinh':'Học sinh'
};
const topbarTitle=document.getElementById('topbarTitle');
const backBtn=document.getElementById('backBtn');
let activeGrade=null;
let activeScheduleId=null;
let currentScreen='grades';
let screenHistory=[];

function showScreen(name,opts={}){
  Object.entries(allScreens).forEach(([key,el])=>{ if(el) el.hidden=key!==name; });
  currentScreen=name;
  topbarTitle.textContent=opts.title||titles[name];
  backBtn.hidden=!opts.showBack;
  if(name==='grades') renderGradeList();
  if(name==='roster'){ renderGradeScheduleRow(); renderRoster(); }
  if(name==='hoc-sinh') renderHocSinh();
  if(name==='schedule') renderScheduleOverview();
  if(name==='schedule-detail') renderScheduleDetail();
  if(name==='wheel-grades') renderWheelGrades();
  if(name==='wheel') renderWheel();
  if(name==='hoc-phi') renderHocPhi();
  if(name==='hoc-phi-detail'){ hpActiveScheduleFilter=null; renderHocPhiDetail(); }
  if(name==='giao-vien') renderGiaoVien();
}

function navigateTo(name,opts={}){
  screenHistory.push({name:currentScreen,opts:{title:topbarTitle.textContent,showBack:!backBtn.hidden}});
  showScreen(name,opts);
}

const HOC_PHI_PASS='04081977';
let hocPhiUnlocked=false;
const FINGER_CRED_KEY='hocphi_fingerprint_registered';

async function isBiometricAvailable(){
  try{
    if(!window.PublicKeyCredential) return false;
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  }catch(e){ return false; }
}

async function registerFingerprint(){
  try{
    const challenge=new Uint8Array(32);
    crypto.getRandomValues(challenge);
    const cred=await navigator.credentials.create({
      publicKey:{
        challenge,
        rp:{name:'Classroom Companion'},
        user:{id:new Uint8Array(16),name:'teacher',displayName:'Teacher'},
        pubKeyCredParams:[{type:'public-key',alg:-7},{type:'public-key',alg:-257}],
        authenticatorSelection:{authenticatorAttachment:'platform',userVerification:'required'},
        timeout:60000,
      }
    });
    if(cred){
      localStorage.setItem(FINGER_CRED_KEY,'registered');
      alert('✅ Đã đăng ký vân tay thành công! Lần sau bạn có thể dùng vân tay để mở Học phí.');
      return true;
    }
  }catch(e){ console.log('Fingerprint register failed:',e); }
  return false;
}

async function verifyFingerprint(){
  try{
    const challenge=new Uint8Array(32);
    crypto.getRandomValues(challenge);
    const assertion=await navigator.credentials.get({
      publicKey:{
        challenge,
        userVerification:'required',
        timeout:60000,
      }
    });
    return !!assertion;
  }catch(e){ return false; }
}

async function unlockHocPhi(){
  const fingerprintRegistered=localStorage.getItem(FINGER_CRED_KEY)==='registered';
  const biometricAvailable=await isBiometricAvailable();

  if(fingerprintRegistered && biometricAvailable){
    // show choice: fingerprint or password
    const useFingerprint=confirm('Dùng vân tay để mở Học phí?\n\nBấm OK để dùng vân tay, Cancel để nhập mật khẩu.');
    if(useFingerprint){
      const ok=await verifyFingerprint();
      if(ok) return true;
      alert('Xác thực vân tay thất bại. Vui lòng thử lại hoặc dùng mật khẩu.');
      return false;
    }
  }

  // password fallback
  const input=prompt(
    biometricAvailable && !fingerprintRegistered
      ? 'Nhập mật khẩu để mở Học phí:\n\n(Sau khi đăng nhập bạn có thể đăng ký vân tay)'
      : 'Nhập mật khẩu để mở Học phí:'
  );
  if(input===null) return false;
  if(input!==HOC_PHI_PASS){ alert('Sai mật khẩu!'); return false; }

  // offer fingerprint registration if available and not yet registered
  if(biometricAvailable && !fingerprintRegistered){
    const wantFingerprint=confirm('Bạn có muốn đăng ký vân tay để lần sau không cần nhập mật khẩu không?');
    if(wantFingerprint) await registerFingerprint();
  }
  return true;
}

document.querySelectorAll('.tab').forEach(tab=>{
  tab.addEventListener('click',async()=>{
    const target=tab.dataset.screen;
    if(target==='hoc-phi'&&!hocPhiUnlocked){
      const ok=await unlockHocPhi();
      if(!ok) return;
      hocPhiUnlocked=true;
    }
    document.querySelectorAll('.tab').forEach(t=>t.classList.toggle('active',t===tab));
    activeGrade=null; screenHistory=[];
    showScreen(target,{showBack:false});
  });
});

backBtn.addEventListener('click',()=>{
  const prev=screenHistory.pop();
  if(prev) showScreen(prev.name,prev.opts);
  else{
    if(currentScreen==='roster') showScreen('grades',{showBack:false});
    
    else if(currentScreen==='schedule-detail'){
      if(activeGrade) showScreen('roster',{title:`Grade ${activeGrade}`,showBack:true});
      else showScreen('schedule',{showBack:false});
    }
    else if(currentScreen==='wheel') showScreen('wheel-grades',{showBack:false});
    else if(currentScreen==='hoc-phi-detail') showScreen('hoc-phi',{showBack:false});
  }
});

/* ============================================================
   GRADE LIST
   ============================================================ */
function renderGradeList(listId='gradeList',mode='roster'){
  const list=document.getElementById(listId);
  if(!list) return;
  list.innerHTML='';
  GRADES.forEach(g=>{
    const count=studentsInGrade(g).length;
    const li=document.createElement('li');
    li.className='grade-card';
    li.innerHTML=`<span class="grade-num">Grade ${g}</span>
      <span class="grade-label">${count} student${count===1?'':'s'}</span>`;
    li.addEventListener('click',()=>{
      activeGrade=g;
      if(mode==='roster') navigateTo('roster',{title:`Grade ${g}`,showBack:true});
      if(mode==='wheel') navigateTo('wheel',{title:`Grade ${g} · Wheel`,showBack:true});
    });
    list.appendChild(li);
  });
  // + add grade button (only on roster grade list)
  if(listId==='gradeList'){
    const li=document.createElement('li');
    li.className='grade-card';
    li.style.cssText='border:2px dashed var(--chalk-dim);background:transparent;align-items:center;justify-content:center;min-height:90px';
    li.innerHTML=`<span style="font-size:28px;color:var(--slate)">+</span>
      <span style="font-size:13px;color:var(--slate);font-weight:700">Add Grade</span>`;
    li.addEventListener('click',()=>{
      const next=Math.max(...GRADES)+1;
      if(confirm(`Thêm Khối ${next}?`)){
        GRADES.push(next);
        saveData();
        renderGradeList('gradeList','roster');
      }
    });
    list.appendChild(li);
  }
}

/* ============================================================
   GRADE SCHEDULE ROW
   ============================================================ */
function renderGradeScheduleRow(){
  const row=document.getElementById('gradeScheduleRow');
  if(!row) return;
  row.innerHTML='';
  const scheds=(state.schedules||[]).filter(s=>s.grade===activeGrade);
  if(scheds.length===0){
    row.innerHTML='<li style="font-size:14px;color:var(--slate);padding:4px 0">No schedules yet — tap + to add</li>';
    return;
  }
  scheds.forEach(s=>{
    const idx=(state.schedules||[]).indexOf(s)%SCHED_COLORS.length;
    const color=SCHED_COLORS[idx];
    const count=(s.studentIds||[]).length;
    const li=document.createElement('li');
    const btn=document.createElement('button');
    btn.className='schedule-chip';
    btn.style.background=color;
    btn.innerHTML=`${escapeHtml(s.name)} <span class="chip-count">${count}</span>`;
    btn.addEventListener('click',()=>{
      activeScheduleId=s.id;
      navigateTo('schedule-detail',{title:`${s.name}${s.grade?' · Grade '+s.grade:''}`,showBack:true});
    });
    li.appendChild(btn);
    row.appendChild(li);
  });
}

document.getElementById('addScheduleForGradeBtn').addEventListener('click',()=>openScheduleModal());

/* ============================================================
   ROSTER — grouped by schedule
   ============================================================ */
const studentList=document.getElementById('studentList');
const rosterEmpty=document.getElementById('rosterEmpty');
const rosterSearch=document.getElementById('rosterSearch');

function renderRoster(){
  const q=rosterSearch.value.trim().toLowerCase();
  const gradeStudents=studentsInGrade(activeGrade)
    .filter(s=>s.studentName.toLowerCase().includes(q)||(s.parentName||'').toLowerCase().includes(q));
  studentList.innerHTML='';
  rosterEmpty.hidden=studentsInGrade(activeGrade).length>0;

  const gradeScheds=(state.schedules||[]).filter(s=>s.grade===activeGrade);

  if(gradeScheds.length===0){
    // no schedules — just list all alphabetically
    gradeStudents.sort((a,b)=>a.studentName.localeCompare(b.studentName))
      .forEach(s=>studentList.appendChild(makeStudentCard(s)));
    return;
  }

  // group by schedule; multi-schedule students go last within each group
  const rendered=new Set();
  gradeScheds.forEach(sc=>{
    const idx=(state.schedules||[]).indexOf(sc)%SCHED_COLORS.length;
    const color=SCHED_COLORS[idx];

    // header separator
    const sep=document.createElement('li');
    sep.style.cssText='list-style:none;padding:10px 2px 4px;font-size:14px;font-weight:800;color:'+color;
    sep.textContent=sc.name;
    studentList.appendChild(sep);

    const inThis=gradeStudents.filter(s=>(sc.studentIds||[]).includes(s.id));
    const single=inThis.filter(s=>{
      const allScheds=(state.schedules||[]).filter(x=>(x.studentIds||[]).includes(s.id)&&x.grade===activeGrade);
      return allScheds.length===1;
    });
    const multi=inThis.filter(s=>{
      const allScheds=(state.schedules||[]).filter(x=>(x.studentIds||[]).includes(s.id)&&x.grade===activeGrade);
      return allScheds.length>1;
    });
    [...single.sort((a,b)=>a.studentName.localeCompare(b.studentName)),
     ...multi.sort((a,b)=>a.studentName.localeCompare(b.studentName))]
      .forEach(s=>{ studentList.appendChild(makeStudentCard(s)); rendered.add(s.id); });
  });

  // students with no schedule in this grade
  const noSched=gradeStudents.filter(s=>!(state.schedules||[]).some(sc=>(sc.studentIds||[]).includes(s.id)&&sc.grade===activeGrade));
  if(noSched.length>0){
    const sep=document.createElement('li');
    sep.style.cssText='list-style:none;padding:10px 2px 4px;font-size:14px;font-weight:800;color:var(--slate)';
    sep.textContent='Chưa có lịch';
    studentList.appendChild(sep);
    noSched.sort((a,b)=>a.studentName.localeCompare(b.studentName))
      .forEach(s=>studentList.appendChild(makeStudentCard(s)));
  }
}

function makeStudentCard(s){
  const enrolledScheds=(state.schedules||[]).filter(sc=>(sc.studentIds||[]).includes(s.id));
  const strips=enrolledScheds.map(sc=>{
    const idx=(state.schedules||[]).findIndex(x=>x.id===sc.id)%SCHED_COLORS.length;
    return `<div class="color-strip" style="background:${SCHED_COLORS[idx]}"></div>`;
  }).join('');
  const li=document.createElement('li');
  li.className='student-card';
  li.innerHTML=`
    <div class="student-avatar">${initials(s.studentName)}</div>
    <div class="student-info">
      <div class="student-name">${escapeHtml(s.studentName)}</div>
      <div class="student-meta">${escapeHtml(s.parentName?'PH: '+s.parentName:'Chưa có tên phụ huynh')}</div>
    </div>
    <div class="student-color-strips">${strips}</div>`;
  li.addEventListener('click',()=>openStudentModal(s.id));
  return li;
}

rosterSearch.addEventListener('input',renderRoster);

/* ============================================================
   STUDENT MODAL
   ============================================================ */
const studentModal=document.getElementById('studentModal');
const studentModalTitle=document.getElementById('studentModalTitle');
const studentNameInput=document.getElementById('studentName');
const parentNameInput=document.getElementById('parentName');
const studentPhoneInput=document.getElementById('studentPhone');
const parentPhoneInput=document.getElementById('parentPhone');
const studentNotesInput=document.getElementById('studentNotes');
const studentGradeSelect=document.getElementById('studentGrade');
const deleteStudentBtn=document.getElementById('deleteStudentBtn');
let editingStudentId=null;
let studentModalDraft={};

function saveDraft(){
  studentModalDraft={
    studentName:studentNameInput.value,
    parentName:parentNameInput.value,
    studentPhone:studentPhoneInput.value,
    parentPhone:parentPhoneInput.value,
    notes:studentNotesInput.value,
    grade:studentGradeSelect.value,
    enrollDate:document.getElementById('studentEnrollDate').value,
  };
}
function restoreDraft(){
  studentNameInput.value=studentModalDraft.studentName||'';
  parentNameInput.value=studentModalDraft.parentName||'';
  studentPhoneInput.value=studentModalDraft.studentPhone||'';
  parentPhoneInput.value=studentModalDraft.parentPhone||'';
  studentNotesInput.value=studentModalDraft.notes||'';
  document.getElementById('studentEnrollDate').value=studentModalDraft.enrollDate||'';
  if(studentModalDraft.grade) studentGradeSelect.value=studentModalDraft.grade;
}
function populateGradeSelect(){
  studentGradeSelect.innerHTML='';
  GRADES.forEach(g=>{
    const opt=document.createElement('option');
    opt.value=g; opt.textContent=`Grade ${g}`;
    studentGradeSelect.appendChild(opt);
  });
}
function renderStudentScheduleChecklist(studentId){
  const cl=document.getElementById('studentScheduleChecklist');
  cl.innerHTML='';
  const grade=parseInt(studentGradeSelect.value||activeGrade);
  const scheds=(state.schedules||[]).filter(s=>s.grade===grade);
  if(scheds.length===0){
    cl.innerHTML='<li style="font-size:14px;color:var(--slate);padding:6px 0">No schedules in this grade yet</li>';
    return;
  }
  scheds.forEach(s=>{
    const enrolled=(s.studentIds||[]).includes(studentId);
    const discount=studentId&&(state.students||[]).find(x=>x.id===studentId)?.scheduleDiscounts?.[s.id];
    const li=document.createElement('li');
    li.className=enrolled?'selected':'';
    li.dataset.scheduleId=s.id;
    li.innerHTML=`<span class="check-icon">${enrolled?'✓':'○'}</span>
      <span style="flex:1">${escapeHtml(s.name)}</span>
      ${discount?`<span class="discount-badge">${formatFee(discount)}</span>`:''}`;
    li.addEventListener('click',()=>{
      li.classList.toggle('selected');
      li.querySelector('.check-icon').textContent=li.classList.contains('selected')?'✓':'○';
    });
    cl.appendChild(li);
  });
}
function openStudentModal(id=null){
  closeAllModals();
  editingStudentId=id;
  populateGradeSelect();
  studentModalDraft={};
  if(id){
    const s=(state.students||[]).find(x=>x.id===id);
    studentModalTitle.textContent='Edit Student';
    studentNameInput.value=s.studentName;
    parentNameInput.value=s.parentName||'';
    studentPhoneInput.value=s.studentPhone||'';
    parentPhoneInput.value=s.parentPhone||'';
    studentNotesInput.value=s.notes||'';
    studentGradeSelect.value=s.grade;
    document.getElementById('studentEnrollDate').value=s.enrollDate||'';
    deleteStudentBtn.hidden=false;
  }else{
    studentModalTitle.textContent=`Add Student — Grade ${activeGrade}`;
    studentNameInput.value=''; parentNameInput.value='';
    studentPhoneInput.value=''; parentPhoneInput.value='';
    studentNotesInput.value='';
    document.getElementById('studentEnrollDate').value='';
    studentGradeSelect.value=activeGrade;
    deleteStudentBtn.hidden=true;
  }
  renderStudentScheduleChecklist(id);
  studentModal.hidden=false;
  setTimeout(()=>studentNameInput.focus(),50);
}
function closeStudentModal(){ studentModal.hidden=true; editingStudentId=null; }

studentModal.addEventListener('click',e=>{ if(e.target===studentModal){ saveDraft(); closeStudentModal(); } });
document.getElementById('addStudentBtn').addEventListener('click',()=>{
  openStudentModal();
  if(studentModalDraft.studentName!==undefined) restoreDraft();
});
document.getElementById('cancelStudentBtn').addEventListener('click',()=>{ studentModalDraft={}; closeStudentModal(); });
document.getElementById('closeStudentModalBtn').addEventListener('click',()=>{ saveDraft(); closeStudentModal(); });

document.getElementById('saveStudentBtn').addEventListener('click',()=>{
  const fields={
    studentName:studentNameInput.value.trim()||'(No name)',
    parentName:parentNameInput.value.trim(),
    studentPhone:studentPhoneInput.value.trim(),
    parentPhone:parentPhoneInput.value.trim(),
    notes:studentNotesInput.value.trim(),
    grade:parseInt(studentGradeSelect.value),
    enrollDate:document.getElementById('studentEnrollDate').value||'',
  };
  const checklist=document.querySelectorAll('#studentScheduleChecklist li[data-schedule-id]');
  if(editingStudentId){
    const idx=(state.students||[]).findIndex(x=>x.id===editingStudentId);
    if(idx>-1) Object.assign(state.students[idx],fields);
    checklist.forEach(li=>{
      const sc=(state.schedules||[]).find(x=>x.id===li.dataset.scheduleId);
      if(!sc) return;
      if(!sc.studentIds) sc.studentIds=[];
      if(li.classList.contains('selected')&&!sc.studentIds.includes(editingStudentId)) sc.studentIds.push(editingStudentId);
      else if(!li.classList.contains('selected')) sc.studentIds=sc.studentIds.filter(x=>x!==editingStudentId);
    });
  }else{
    const newId=uid();
    if(!state.students) state.students=[];
    state.students.push({id:newId,scheduleDiscounts:{},...fields});
    checklist.forEach(li=>{
      if(li.classList.contains('selected')){
        const sc=(state.schedules||[]).find(x=>x.id===li.dataset.scheduleId);
        if(sc){ if(!sc.studentIds) sc.studentIds=[]; sc.studentIds.push(newId); }
      }
    });
  }
  studentModalDraft={};
  saveData(); renderRoster(); renderGradeScheduleRow(); closeStudentModal();
});

deleteStudentBtn.addEventListener('click',()=>{
  if(!editingStudentId) return;
  if(confirm('Delete this student?')){
    state.students=(state.students||[]).filter(x=>x.id!==editingStudentId);
    (state.schedules||[]).forEach(s=>{ s.studentIds=(s.studentIds||[]).filter(x=>x!==editingStudentId); });
    saveData(); renderRoster(); closeStudentModal();
  }
});

/* ============================================================
   CLOSE ALL MODALS
   ============================================================ */
let editingScheduleId=null;
let feeModalContext=null;
let editingTeacherId=null;

function closeAllModals(){
  document.querySelectorAll('.modal-backdrop').forEach(el=>el.hidden=true);
  editingScheduleId=null;
}

/* ============================================================
   SCHEDULE MODAL
   ============================================================ */
const scheduleModal=document.getElementById('scheduleModal');
function openScheduleModal(id=null){
  closeAllModals();
  editingScheduleId=id;
  document.getElementById('scheduleModalTitle').textContent=id?'Sửa lịch dạy':'Thêm lịch dạy';
  // populate grade selector
  const gradeSelect=document.getElementById('scheduleGradeSelect');
  gradeSelect.innerHTML='';
  GRADES.forEach(g=>{
    const opt=document.createElement('option');
    opt.value=g; opt.textContent=`Khối ${g}`;
    gradeSelect.appendChild(opt);
  });
  if(id){
    const s=(state.schedules||[]).find(x=>x.id===id);
    document.getElementById('scheduleSubject').value=s.name||'';
    document.getElementById('scheduleTeacher').value=s.teacherName||'';
    document.getElementById('scheduleBaseFee').value=s.baseFee||'';
    gradeSelect.value=s.grade||GRADES[0];
  }else{
    document.getElementById('scheduleSubject').value='';
    document.getElementById('scheduleTeacher').value='';
    document.getElementById('scheduleBaseFee').value='';
    gradeSelect.value=activeGrade||GRADES[0];
  }
  scheduleModal.hidden=false;
  setTimeout(()=>document.getElementById('scheduleSubject').focus(),50);
}
function closeScheduleModal(){ scheduleModal.hidden=true; editingScheduleId=null; }
scheduleModal.addEventListener('click',e=>{ if(e.target===scheduleModal) closeScheduleModal(); });
document.getElementById('cancelScheduleBtn').addEventListener('click',closeScheduleModal);
document.getElementById('closeScheduleModalBtn').addEventListener('click',closeScheduleModal);
document.getElementById('saveScheduleBtn').addEventListener('click',()=>{
  const name=document.getElementById('scheduleSubject').value.trim()||'(Untitled)';
  const teacherName=document.getElementById('scheduleTeacher').value.trim();
  const baseFee=document.getElementById('scheduleBaseFee').value.trim();
  if(!state.schedules) state.schedules=[];
  const selectedGrade=parseInt(document.getElementById('scheduleGradeSelect').value);
  if(editingScheduleId){
    const s=state.schedules.find(x=>x.id===editingScheduleId);
    if(s){ s.name=name; s.teacherName=teacherName; s.baseFee=baseFee; s.grade=selectedGrade; }
  }else{
    state.schedules.push({id:uid(),grade:selectedGrade,name,teacherName,baseFee,timeBlocks:[],studentIds:[]});
  }
  saveData(); renderGradeScheduleRow(); renderScheduleOverview(); closeScheduleModal();
});

/* ============================================================
   SCHEDULE DETAIL
   ============================================================ */
function renderScheduleDetail(){
  const s=(state.schedules||[]).find(x=>x.id===activeScheduleId);
  if(!s) return;
  const gradeLabel=s.grade?` · Grade ${s.grade}`:'';
  topbarTitle.textContent=s.name+gradeLabel;
  document.getElementById('detailTeacher').textContent=(s.teacherName||'—')+' ✏️';
  document.getElementById('detailTeacher').style.cursor='pointer';
  document.getElementById('detailFeeBtn').textContent=s.baseFee?formatFee(s.baseFee):'Tap to set';
  document.getElementById('scheduleNotes').value=s.notes||'';
  document.getElementById('scheduleNotesTimestamp').textContent=s.notesTimestamp||'';

  const tbList=document.getElementById('detailTimeBlocks');
  tbList.innerHTML='';
  (s.timeBlocks||[]).forEach((tb,i)=>{
    const li=document.createElement('li');
    li.className='time-block-item';
    li.innerHTML=`${DAY_NAMES[tb.day]} ${formatTime(tb.start)}–${formatTime(tb.end)}
      <button class="time-block-del" data-idx="${i}">✕</button>`;
    tbList.appendChild(li);
  });
  tbList.querySelectorAll('.time-block-del').forEach(btn=>{
    btn.addEventListener('click',()=>{
      s.timeBlocks.splice(parseInt(btn.dataset.idx),1);
      saveData(); renderScheduleDetail();
    });
  });

  const sl=document.getElementById('detailStudentList');
  sl.innerHTML='';
  document.getElementById('detailStudentEmpty').hidden=(s.studentIds||[]).length>0;
  (s.studentIds||[]).forEach(sid=>{
    const st=(state.students||[]).find(x=>x.id===sid);
    if(!st) return;
    const discount=st.scheduleDiscounts?.[s.id];
    const li=document.createElement('li');
    li.className='student-card';
    li.innerHTML=`
      <div class="student-avatar">${initials(st.studentName)}</div>
      <div class="student-info">
        <div class="student-name">${escapeHtml(st.studentName)}
          ${discount?`<span class="discount-badge">${formatFee(discount)}</span>`:''}
        </div>
        <div class="student-meta">${escapeHtml(st.parentName?'PH: '+st.parentName:'')}</div>
      </div>
      <button class="chip" style="font-size:12px;padding:5px 12px;flex-shrink:0" data-sid="${sid}">
        ${discount?'Edit fee':'Discount ₫'}
      </button>`;
    li.querySelector('[data-sid]').addEventListener('click',e=>{
      e.stopPropagation();
      activeScheduleId=s.id;
      openFeeModal('student',sid,s.id);
    });
    li.addEventListener('click',()=>openStudentModal(sid));
    sl.appendChild(li);
  });
}

document.getElementById('detailTeacher').addEventListener('click',()=>openScheduleModal(activeScheduleId));
document.getElementById('detailFeeBtn').addEventListener('click',()=>{
  if(!activeScheduleId) return;
  openFeeModal('schedule', null, activeScheduleId);
});
document.getElementById('addTimeBlockBtn').addEventListener('click',()=>openTimeBlockModal());
document.getElementById('addStudentToScheduleBtn').addEventListener('click',()=>openAddToScheduleModal());
document.getElementById('saveScheduleNotesBtn').addEventListener('click',()=>{
  const s=(state.schedules||[]).find(x=>x.id===activeScheduleId);
  if(!s) return;
  s.notes=document.getElementById('scheduleNotes').value;
  const now=new Date();
  const days=['CN','Thứ 2','Thứ 3','Thứ 4','Thứ 5','Thứ 6','Thứ 7'];
  const dayName=days[now.getDay()];
  const dateStr=`${String(now.getDate()).padStart(2,'0')}/${String(now.getMonth()+1).padStart(2,'0')}/${now.getFullYear()}`;
  const timeStr=`${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
  s.notesTimestamp=`${dayName} ${dateStr} ${timeStr}`;
  saveData();
  const btn=document.getElementById('saveScheduleNotesBtn');
  btn.textContent='✓ Saved'; setTimeout(()=>btn.textContent='Lưu ghi chú',1500);
  document.getElementById('scheduleNotesTimestamp').textContent=s.notesTimestamp;
});
document.getElementById('deleteScheduleDetailBtn').addEventListener('click',()=>{
  if(confirm('Delete this schedule?')){
    state.schedules=(state.schedules||[]).filter(x=>x.id!==activeScheduleId);
    saveData();
    const prev=screenHistory.pop();
    if(prev) showScreen(prev.name,prev.opts);
    else showScreen('grades',{showBack:false});
  }
});

/* ============================================================
   SCHEDULE OVERVIEW (Lịch dạy tab)
   ============================================================ */
let calViewActive=false;

function populateScheduleGradeFilter(){
  const sel=document.getElementById('scheduleGradeFilter');
  const cur=sel.value;
  sel.innerHTML='<option value="">All grades</option>';
  GRADES.forEach(g=>{
    const opt=document.createElement('option');
    opt.value=g; opt.textContent=`Grade ${g}`;
    sel.appendChild(opt);
  });
  sel.value=cur;
}

function renderScheduleOverview(){
  populateScheduleGradeFilter();
  const filterGrade=document.getElementById('scheduleGradeFilter').value;
  const list=document.getElementById('scheduleList');
  const empty=document.getElementById('scheduleEmpty');
  list.innerHTML='';
  const filtered=filterGrade
    ?(state.schedules||[]).filter(s=>s.grade===parseInt(filterGrade))
    :(state.schedules||[]);
  empty.hidden=filtered.length>0;
  filtered.forEach(s=>{
    const idx=(state.schedules||[]).indexOf(s)%SCHED_COLORS.length;
    const color=SCHED_COLORS[idx];
    const div=document.createElement('div');
    div.className='schedule-card-full';
    div.style.borderLeftColor=color;
    const times=(s.timeBlocks||[]).map(tb=>`${DAY_NAMES[tb.day]} ${formatTime(tb.start)}–${formatTime(tb.end)}`).join(' · ')||'No times set';
    div.innerHTML=`
      <div style="display:flex;justify-content:space-between;align-items:flex-start">
        <div>
          <div class="sc-name">${escapeHtml(s.name)} <span style="font-size:13px;color:var(--slate)">· Grade ${s.grade}</span></div>
          <div class="sc-meta">${escapeHtml(s.teacherName||'No teacher')} · ${(s.studentIds||[]).length} students</div>
          <div class="sc-meta">${times}</div>
          <div class="sc-meta">${s.baseFee?formatFee(s.baseFee):'No fee set'}</div>
        </div>
        <button class="chip" style="font-size:12px;padding:5px 12px;flex-shrink:0;margin-left:10px" data-edit-id="${s.id}">Edit</button>
      </div>`;
    div.querySelector('[data-edit-id]').addEventListener('click',e=>{
      e.stopPropagation();
      activeGrade=s.grade;
      openScheduleModal(s.id);
    });
    div.addEventListener('click',()=>{
      activeScheduleId=s.id; activeGrade=s.grade;
      navigateTo('schedule-detail',{title:s.name,showBack:true});
    });
    list.appendChild(div);
  });
  if(calViewActive) renderCalendar();
}

document.getElementById('scheduleGradeFilter').addEventListener('change',renderScheduleOverview);
document.getElementById('addScheduleGlobalBtn').addEventListener('click',()=>{
  const filterGrade=document.getElementById('scheduleGradeFilter').value;
  activeGrade=filterGrade?parseInt(filterGrade):1;
  openScheduleModal();
});
document.getElementById('viewListBtn').addEventListener('click',()=>{
  calViewActive=false;
  document.getElementById('scheduleListView').hidden=false;
  document.getElementById('scheduleCalView').hidden=true;
  document.getElementById('viewListBtn').classList.add('active');
  document.getElementById('viewCalBtn').classList.remove('active');
});
document.getElementById('viewCalBtn').addEventListener('click',()=>{
  calViewActive=true;
  document.getElementById('scheduleListView').hidden=true;
  document.getElementById('scheduleCalView').hidden=false;
  document.getElementById('viewListBtn').classList.remove('active');
  document.getElementById('viewCalBtn').classList.add('active');
  renderCalendar();
});

/* ============================================================
   CALENDAR TIMETABLE
   1-hour slots, morning 7:00–12:00, lunch break, afternoon 13:00–22:00
   Schedules span proportionally based on their duration
   ============================================================ */
const MORNING_SLOTS=['7:00','8:00','9:00','10:00','11:00'];
const AFTERNOON_SLOTS=['13:00','14:00','15:00','16:00','17:00','18:00','19:00','20:00','21:00'];
const CAL_DAYS=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
const CAL_DAY_IDX=[1,2,3,4,5,6,0];
const SLOT_HEIGHT=54; // px per 1-hour row

function renderCalendar(){
  const table=document.getElementById('calendarTable');
  table.innerHTML='';

  // header
  const thead=document.createElement('thead');
  const hrow=document.createElement('tr');
  const thTime=document.createElement('th');
  thTime.className='time-col'; thTime.textContent='';
  hrow.appendChild(thTime);
  CAL_DAYS.forEach(d=>{ const th=document.createElement('th'); th.textContent=d; hrow.appendChild(th); });
  thead.appendChild(hrow); table.appendChild(thead);

  const tbody=document.createElement('tbody');
  const allSlots=[...MORNING_SLOTS,'LUNCH',...AFTERNOON_SLOTS];

  allSlots.forEach((slot)=>{
    const tr=document.createElement('tr');

    // time label cell
    const tdTime=document.createElement('td');
    tdTime.className='time-label';

    if(slot==='LUNCH'){
      tdTime.textContent='';
      tr.style.background='var(--chalk-dim)';
      tr.style.height='32px';
      const lunchTd=document.createElement('td');
      lunchTd.colSpan=7;
      lunchTd.style.cssText='text-align:center;font-weight:700;font-size:14px;color:var(--slate);padding:6px;border:1px solid var(--chalk-dim)';
      lunchTd.textContent='🌙 Giờ nghỉ trưa';
      tr.appendChild(tdTime); tr.appendChild(lunchTd);
      tbody.appendChild(tr);
      return;
    }

    tdTime.textContent=slot;
    tr.appendChild(tdTime);

    const slotStartMins=timeToMins(slot);
    const slotEndMins=slotStartMins+60;

    CAL_DAYS.forEach((day,dayCol)=>{
      const td=document.createElement('td');
      td.style.position='relative';
      td.style.height=SLOT_HEIGHT+'px';

      // find schedules whose timeBlocks overlap this slot+day
      const dayIdx=CAL_DAY_IDX[dayCol];
      const matches=(state.schedules||[]).filter(s=>
        (s.timeBlocks||[]).some(tb=>{
          if(parseInt(tb.day)!==dayIdx) return false;
          const tbStart=timeToMins(tb.start);
          const tbEnd=timeToMins(tb.end);
          return tbStart<slotEndMins && tbEnd>slotStartMins;
        })
      );

      const colWidth=matches.length>1?`${Math.floor(100/matches.length)}%`:'100%';

      matches.forEach((s,mi)=>{
        const tb=s.timeBlocks.find(tb=>
          parseInt(tb.day)===dayIdx&&timeToMins(tb.start)<slotEndMins&&timeToMins(tb.end)>slotStartMins
        );
        if(!tb) return;

        const tbStartMins=timeToMins(tb.start);
        const tbEndMins=timeToMins(tb.end);

        // calculate pixel position within this cell
        const overlapStart=Math.max(tbStartMins,slotStartMins);
        const overlapEnd=Math.min(tbEndMins,slotEndMins);
        const topPct=((overlapStart-slotStartMins)/60)*100;
        const heightPct=((overlapEnd-overlapStart)/60)*100;

        const idx=(state.schedules||[]).indexOf(s)%SCHED_COLORS.length;
        const block=document.createElement('div');
        block.className='cal-block';
        block.style.background=SCHED_COLORS[idx];
        block.style.top=topPct+'%';
        block.style.height=heightPct+'%';
        block.style.left=`calc(${mi*(100/matches.length)}% + 2px)`;
        block.style.right='auto';
        block.style.width=`calc(${colWidth} - 4px)`;
        block.style.bottom='auto';

        // only show label on the first cell of a block
        if(tbStartMins>=slotStartMins){
          block.innerHTML=`<span class="cal-block-name">${escapeHtml(s.name)}</span>
            <span class="cal-block-time">${tb.start}–${tb.end}</span>`;
        }

        block.addEventListener('click',e=>{
          e.stopPropagation();
          activeScheduleId=s.id; activeGrade=s.grade;
          navigateTo('schedule-detail',{title:s.name,showBack:true});
        });
        td.appendChild(block);
      });
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
}

/* ============================================================
   TIME BLOCK MODAL
   ============================================================ */
const timeBlockModal=document.getElementById('timeBlockModal');
function openTimeBlockModal(){
  closeAllModals();
  document.getElementById('timeBlockDay').value=0;
  document.getElementById('timeBlockStart').value='';
  document.getElementById('timeBlockEnd').value='';
  timeBlockModal.hidden=false;
}
function autoFillEndTime(){
  const startVal=document.getElementById('timeBlockStart').value;
  if(!startVal) return;
  const[h,m]=startVal.split(':').map(Number);
  const totalMins=h*60+m+90;
  const endH=Math.floor(totalMins/60)%24;
  const endM=totalMins%60;
  document.getElementById('timeBlockEnd').value=`${String(endH).padStart(2,'0')}:${String(endM).padStart(2,'0')}`;
}
function closeTimeBlockModal(){ timeBlockModal.hidden=true; }
timeBlockModal.addEventListener('click',e=>{ if(e.target===timeBlockModal) closeTimeBlockModal(); });
document.getElementById('cancelTimeBlockBtn').addEventListener('click',closeTimeBlockModal);
document.getElementById('closeTimeBlockModalBtn').addEventListener('click',closeTimeBlockModal);
document.getElementById('timeBlockStart').addEventListener('change',autoFillEndTime);
document.getElementById('saveTimeBlockBtn').addEventListener('click',()=>{
  const s=(state.schedules||[]).find(x=>x.id===activeScheduleId);
  if(!s) return;
  if(!s.timeBlocks) s.timeBlocks=[];
  s.timeBlocks.push({
    day:parseInt(document.getElementById('timeBlockDay').value),
    start:document.getElementById('timeBlockStart').value,
    end:document.getElementById('timeBlockEnd').value,
  });
  saveData(); renderScheduleDetail(); closeTimeBlockModal();
  if(calViewActive) renderCalendar();
});

/* ============================================================
   FEE MODAL
   ============================================================ */
const feeModal=document.getElementById('feeModal');
function openFeeModal(type,studentId=null,scheduleId=null){
  closeAllModals();
  feeModalContext={type,studentId,scheduleId:scheduleId||activeScheduleId};
  const s=(state.schedules||[]).find(x=>x.id===feeModalContext.scheduleId);
  if(type==='schedule'){
    document.getElementById('feeModalTitle').textContent='Edit Base Fee';
    document.getElementById('feeModalBaseLabel').textContent='Học phí / tháng (base fee for all students)';
    document.getElementById('feeModalInput').value=s?.baseFee||'';
    document.getElementById('feeModalNote').textContent='This applies to all students unless individually discounted.';
  }else{
    const st=(state.students||[]).find(x=>x.id===studentId);
    document.getElementById('feeModalTitle').textContent=`Discount — ${st?.studentName||''}`;
    document.getElementById('feeModalBaseLabel').textContent=`Discounted fee (base: ${formatFee(s?.baseFee)})`;
    document.getElementById('feeModalInput').value=st?.scheduleDiscounts?.[feeModalContext.scheduleId]||'';
    document.getElementById('feeModalNote').textContent='Leave blank to remove discount and use base fee.';
  }
  feeModal.hidden=false;
  setTimeout(()=>document.getElementById('feeModalInput').focus(),50);
}
function closeFeeModal(){ feeModal.hidden=true; feeModalContext=null; }
feeModal.addEventListener('click',e=>{ if(e.target===feeModal) closeFeeModal(); });
document.getElementById('cancelFeeBtn').addEventListener('click',closeFeeModal);
document.getElementById('closeFeeModalBtn').addEventListener('click',closeFeeModal);
document.getElementById('saveFeeBtn').addEventListener('click',()=>{
  const val=document.getElementById('feeModalInput').value.trim();
  if(feeModalContext.type==='schedule'){
    const s=(state.schedules||[]).find(x=>x.id===feeModalContext.scheduleId);
    if(s) s.baseFee=val;
  }else{
    const st=(state.students||[]).find(x=>x.id===feeModalContext.studentId);
    if(st){
      if(!st.scheduleDiscounts) st.scheduleDiscounts={};
      if(val) st.scheduleDiscounts[feeModalContext.scheduleId]=val;
      else delete st.scheduleDiscounts[feeModalContext.scheduleId];
    }
  }
  saveData(); renderScheduleDetail(); closeFeeModal();
});

/* ============================================================
   ADD STUDENT TO SCHEDULE MODAL
   ============================================================ */
const addToScheduleModal=document.getElementById('addToScheduleModal');
function openAddToScheduleModal(){
  closeAllModals();
  document.getElementById('addToScheduleSearch').value='';
  renderAddToScheduleList('');
  addToScheduleModal.hidden=false;
}
function renderAddToScheduleList(q){
  const s=(state.schedules||[]).find(x=>x.id===activeScheduleId);
  const list=document.getElementById('addToScheduleList');
  list.innerHTML='';
  studentsInGrade(activeGrade)
    .filter(st=>st.studentName.toLowerCase().includes(q.toLowerCase()))
    .sort((a,b)=>a.studentName.localeCompare(b.studentName))
    .forEach(st=>{
      const enrolled=(s?.studentIds||[]).includes(st.id);
      const li=document.createElement('li');
      li.className=enrolled?'selected':'';
      li.dataset.sid=st.id;
      li.innerHTML=`<span class="check-icon">${enrolled?'✓':'○'}</span> ${escapeHtml(st.studentName)}`;
      li.addEventListener('click',()=>{
        li.classList.toggle('selected');
        li.querySelector('.check-icon').textContent=li.classList.contains('selected')?'✓':'○';
      });
      list.appendChild(li);
    });
}
function closeAddToScheduleModal(){ addToScheduleModal.hidden=true; }
addToScheduleModal.addEventListener('click',e=>{ if(e.target===addToScheduleModal) closeAddToScheduleModal(); });
document.getElementById('cancelAddToScheduleBtn').addEventListener('click',closeAddToScheduleModal);
document.getElementById('closeAddToScheduleModalBtn').addEventListener('click',closeAddToScheduleModal);
document.getElementById('addToScheduleSearch').addEventListener('input',e=>renderAddToScheduleList(e.target.value));
document.getElementById('saveAddToScheduleBtn').addEventListener('click',()=>{
  const s=(state.schedules||[]).find(x=>x.id===activeScheduleId);
  if(!s) return;
  s.studentIds=[];
  document.querySelectorAll('#addToScheduleList li.selected').forEach(li=>s.studentIds.push(li.dataset.sid));
  saveData(); renderScheduleDetail(); closeAddToScheduleModal();
});

/* ============================================================
   HỌC SINH TAB
   ============================================================ */
let currentSort='az';

function renderHocSinh(){
  const allStudents=state.students||[];
  document.getElementById('hocSinhTotal').textContent=`${allStudents.length} học sinh`;
  document.getElementById('hocSinhEmpty').hidden=allStudents.length>0;
  const listEl=document.getElementById('hocSinhList');
  listEl.innerHTML='';

  if(currentSort==='az'){
    const sorted=[...allStudents].sort((a,b)=>a.studentName.localeCompare(b.studentName));
    sorted.forEach(s=>listEl.appendChild(makeStudentCard(s)));
  }
  else if(currentSort==='lop'){
    const grades=[...new Set(allStudents.map(s=>s.grade))].sort((a,b)=>a-b);
    grades.forEach(g=>{
      const div=document.createElement('div');
      div.className='hs-divider grade-divider';
      div.textContent=`Grade ${g}`;
      listEl.appendChild(div);
      allStudents.filter(s=>s.grade===g)
        .sort((a,b)=>a.studentName.localeCompare(b.studentName))
        .forEach(s=>listEl.appendChild(makeStudentCard(s)));
    });
  }
  else if(currentSort==='lich'){
    const scheds=state.schedules||[];
    const shownIds=new Set();
    scheds.forEach(sc=>{
      const idx=(state.schedules||[]).indexOf(sc)%SCHED_COLORS.length;
      const color=SCHED_COLORS[idx];
      const students=(sc.studentIds||[])
        .map(id=>allStudents.find(s=>s.id===id))
        .filter(Boolean)
        .sort((a,b)=>a.studentName.localeCompare(b.studentName));
      if(students.length===0) return;
      const div=document.createElement('div');
      div.className='hs-divider sched-divider';
      div.style.background=color;
      div.textContent=sc.name;
      listEl.appendChild(div);
      students.forEach(s=>{ listEl.appendChild(makeStudentCard(s)); shownIds.add(s.id); });
    });
    // students with no schedule
    const noSched=allStudents.filter(s=>!shownIds.has(s.id))
      .sort((a,b)=>a.studentName.localeCompare(b.studentName));
    if(noSched.length>0){
      const div=document.createElement('div');
      div.className='hs-divider grade-divider';
      div.textContent='Chưa có lịch học';
      listEl.appendChild(div);
      noSched.forEach(s=>listEl.appendChild(makeStudentCard(s)));
    }
  }
}

// sort toggle button
document.getElementById('sortStudentsBtn').addEventListener('click',()=>{
  const bar=document.getElementById('hocSinhSortBar');
  bar.hidden=!bar.hidden;
});

document.querySelectorAll('.sort-btn').forEach(btn=>{
  btn.addEventListener('click',()=>{
    currentSort=btn.dataset.sort;
    document.querySelectorAll('.sort-btn').forEach(b=>b.classList.toggle('active',b===btn));
    renderHocSinh();
  });
});

/* ============================================================
   HỌC PHÍ
   ============================================================ */
let activeHocPhiMonth=new Date().getMonth();
let activeHocPhiFilter='chua';
let hpActiveScheduleFilter=null;

function feeKey(studentId,scheduleId,mStr){ return `${mStr}|${studentId}|${scheduleId}`; }
function monthStr(idx){ return `${new Date().getFullYear()}-${String(idx+1).padStart(2,'0')}`; }
function isPaid(studentId,scheduleId,monthIdx){
  return !!(state.feePayments||{})[feeKey(studentId,scheduleId,monthStr(monthIdx))];
}
function togglePaid(studentId,scheduleId,monthIdx){
  if(!state.feePayments) state.feePayments={};
  const k=feeKey(studentId,scheduleId,monthStr(monthIdx));
  if(state.feePayments[k]) delete state.feePayments[k];
  else state.feePayments[k]=true;
  saveData();
}
function studentFeeStatus(s,monthIdx){
  const scheds=(state.schedules||[]).filter(sc=>(sc.studentIds||[]).includes(s.id));
  if(scheds.length===0) return 'no-schedule';
  const paidAll=scheds.every(sc=>isPaid(s.id,sc.id,monthIdx));
  const paidSome=scheds.some(sc=>isPaid(s.id,sc.id,monthIdx));
  if(paidAll) return 'paid';
  if(paidSome) return 'partial';
  return 'unpaid';
}
function isOverdue(s){
  if(!s.enrollDate) return false;
  const enroll=new Date(s.enrollDate);
  const now=new Date();
  return Math.floor((now-enroll)/(1000*60*60*24))>=40;
}
function renderHocPhi(){
  if(!state.feePayments) state.feePayments={};
  const monthRow=document.getElementById('monthRow');
  monthRow.innerHTML='';
  MONTH_NAMES.forEach((m,i)=>{
    const btn=document.createElement('button');
    btn.className='month-btn'+(i===activeHocPhiMonth?' active':'');
    btn.textContent=m;
    btn.addEventListener('click',()=>{ activeHocPhiMonth=i; renderHocPhi(); });
    monthRow.appendChild(btn);
  });
  const withSchedule=(state.students||[]).filter(s=>(state.schedules||[]).some(sc=>(sc.studentIds||[]).includes(s.id)));
  const noSchedule=(state.students||[]).filter(s=>!(state.schedules||[]).some(sc=>(sc.studentIds||[]).includes(s.id)));
  const unpaid=withSchedule.filter(s=>studentFeeStatus(s,activeHocPhiMonth)!=='paid');
  const paid=withSchedule.filter(s=>studentFeeStatus(s,activeHocPhiMonth)==='paid');
  document.getElementById('hpCountChuaDong').textContent=unpaid.length;
  document.getElementById('hpCountDaDong').textContent=paid.length;
  document.getElementById('hpCountTatCa').textContent=withSchedule.length;
  document.getElementById('hpCountChuaCoLich').textContent=noSchedule.length;
  document.getElementById('hpBoxChuaDong').onclick=()=>{ activeHocPhiFilter='chua'; navigateTo('hoc-phi-detail',{title:'Chưa đóng học phí',showBack:true}); };
  document.getElementById('hpBoxDaDong').onclick=()=>{ activeHocPhiFilter='da'; navigateTo('hoc-phi-detail',{title:'Đã đóng',showBack:true}); };
  document.getElementById('hpBoxTatCa').onclick=()=>{ activeHocPhiFilter='tat-ca'; navigateTo('hoc-phi-detail',{title:'Tất cả',showBack:true}); };
  document.getElementById('hpBoxChuaCoLich').onclick=()=>{ activeHocPhiFilter='chua-lich'; navigateTo('hoc-phi-detail',{title:'Học sinh chưa có lịch học',showBack:true}); };
}

function renderHocPhiDetail(){
  if(!state.feePayments) state.feePayments={};
  const withSchedule=(state.students||[]).filter(s=>(state.schedules||[]).some(sc=>(sc.studentIds||[]).includes(s.id)));
  const noSchedule=(state.students||[]).filter(s=>!(state.schedules||[]).some(sc=>(sc.studentIds||[]).includes(s.id)));
  const chipRow=document.getElementById('hpScheduleChipRow');
  chipRow.innerHTML='';
  if(activeHocPhiFilter!=='chua-lich'){
    (state.schedules||[]).forEach((sc,i)=>{
      const color=SCHED_COLORS[i%SCHED_COLORS.length];
      const btn=document.createElement('button');
      btn.className='hp-sched-chip'+(hpActiveScheduleFilter&&hpActiveScheduleFilter!==sc.id?' dim':'');
      btn.style.background=color;
      btn.textContent=sc.name;
      btn.addEventListener('click',()=>{ hpActiveScheduleFilter=hpActiveScheduleFilter===sc.id?null:sc.id; renderHocPhiDetail(); });
      chipRow.appendChild(btn);
    });
  }
  let list=[];
  if(activeHocPhiFilter==='chua') list=withSchedule.filter(s=>studentFeeStatus(s,activeHocPhiMonth)!=='paid');
  else if(activeHocPhiFilter==='da') list=withSchedule.filter(s=>studentFeeStatus(s,activeHocPhiMonth)==='paid');
  else if(activeHocPhiFilter==='tat-ca') list=withSchedule;
  else if(activeHocPhiFilter==='chua-lich') list=noSchedule;
  if(hpActiveScheduleFilter) list=list.filter(s=>((state.schedules||[]).find(sc=>sc.id===hpActiveScheduleFilter)?.studentIds||[]).includes(s.id));
  list.sort((a,b)=>a.studentName.localeCompare(b.studentName));
  const ul=document.getElementById('hocPhiStudentList');
  ul.innerHTML='';
  document.getElementById('hocPhiEmpty').hidden=list.length>0;
  list.forEach(s=>{
    const status=studentFeeStatus(s,activeHocPhiMonth);
    const overdue=isOverdue(s)&&status!=='paid';
    const partial=status==='partial';
    const scheds=(state.schedules||[]).filter(sc=>(sc.studentIds||[]).includes(s.id));
    const totalFee=scheds.reduce((sum,sc)=>{
      const fee=parseInt((s.scheduleDiscounts?.[sc.id])||sc.baseFee||0)||0;
      return sum+fee;
    },0);
    const row=document.createElement('div');
    row.className='hocphi-student-row'+(overdue?' overdue':'');
    row.innerHTML=`
      <div class="student-avatar">${initials(s.studentName)}</div>
      <span class="hp-name">${escapeHtml(s.studentName)}</span>
      ${partial?'<span class="hp-badge">!</span>':''}
      <span class="hp-total">${totalFee?formatFee(totalFee):''}</span>
      <div class="student-color-strips">
        ${scheds.map(sc=>{
          const idx=(state.schedules||[]).indexOf(sc)%SCHED_COLORS.length;
          const paid=isPaid(s.id,sc.id,activeHocPhiMonth);
          return `<div class="pay-circle${paid?' paid':''}" data-sid="${s.id}" data-scid="${sc.id}"
            style="border-color:${SCHED_COLORS[idx]};${paid?'background:'+SCHED_COLORS[idx]+';border-color:'+SCHED_COLORS[idx]:''}"
            title="${sc.name}">✓</div>`;
        }).join('')}
      </div>`;
    row.querySelectorAll('.pay-circle').forEach(btn=>{
      btn.addEventListener('click',e=>{
        e.stopPropagation();
        togglePaid(btn.dataset.sid,btn.dataset.scid,activeHocPhiMonth);
        renderHocPhiDetail();
      });
    });
    row.addEventListener('click',()=>openHocPhiStudentModal(s.id));
    ul.appendChild(row);
  });
}

const hocPhiStudentModal=document.getElementById('hocPhiStudentModal');
function openHocPhiStudentModal(studentId){
  closeAllModals();
  const s=(state.students||[]).find(x=>x.id===studentId);
  document.getElementById('hocPhiStudentName').textContent=s.studentName;
  document.getElementById('hocPhiStudentEnroll').textContent=s.enrollDate?`Ngày nhập học: ${s.enrollDate}`:'Chưa có ngày nhập học';
  const scheds=(state.schedules||[]).filter(sc=>(sc.studentIds||[]).includes(studentId));
  const ul=document.getElementById('hocPhiScheduleList');
  ul.innerHTML='';
  if(scheds.length===0){
    ul.innerHTML='<li style="font-size:14px;color:var(--slate)">Chưa có lịch học nào.</li>';
  }
  scheds.forEach(sc=>{
    const idx=(state.schedules||[]).indexOf(sc)%SCHED_COLORS.length;
    const discount=s.scheduleDiscounts?.[sc.id];
    const fee=discount||sc.baseFee||'—';
    const paid=isPaid(studentId,sc.id,activeHocPhiMonth);
    const li=document.createElement('li');
    li.className='hocphi-sched-row';
    li.innerHTML=`
      <div class="sched-dot" style="background:${SCHED_COLORS[idx]}"></div>
      <div class="sched-info">
        <div class="sched-sname">${escapeHtml(sc.name)}</div>
        <div class="sched-sfee">${formatFee(fee)}${discount?' (giảm)':''}</div>
      </div>
      <div class="pay-circle${paid?' paid':''}"
        style="${paid?'background:'+SCHED_COLORS[idx]+';border-color:'+SCHED_COLORS[idx]:'border-color:'+SCHED_COLORS[idx]}">✓</div>`;
    li.querySelector('.pay-circle').addEventListener('click',e=>{
      e.stopPropagation();
      togglePaid(studentId,sc.id,activeHocPhiMonth);
      openHocPhiStudentModal(studentId);
      renderHocPhiDetail();
    });
    ul.appendChild(li);
  });
  hocPhiStudentModal.hidden=false;
}
hocPhiStudentModal.addEventListener('click',e=>{ if(e.target===hocPhiStudentModal) hocPhiStudentModal.hidden=true; });
document.getElementById('closeHocPhiStudentModalBtn').addEventListener('click',()=>hocPhiStudentModal.hidden=true);

/* ============================================================
   GIÁO VIÊN
   ============================================================ */
function renderGiaoVien(){
  if(!state.teachers) state.teachers=[];
  const list=document.getElementById('teacherList');
  list.innerHTML='';
  document.getElementById('teacherEmpty').hidden=state.teachers.length>0;
  state.teachers.forEach(t=>{
    const myScheds=(state.schedules||[]).filter(s=>s.teacherName&&s.teacherName.trim().toLowerCase()===t.name.trim().toLowerCase());
    const studentCount=new Set(myScheds.flatMap(s=>s.studentIds||[])).size;
    const schedNames=myScheds.map(s=>s.name).join(', ')||'Chưa có lịch';
    const card=document.createElement('div');
    card.className='teacher-card';
    card.innerHTML=`
      <div class="teacher-avatar">${initials(t.name)}</div>
      <div class="teacher-info">
        <div class="teacher-name">${escapeHtml(t.name)}</div>
        <div class="teacher-meta">${escapeHtml(t.phone||'Chưa có SĐT')} · ${studentCount} học sinh</div>
        <div class="teacher-meta" style="margin-top:2px">${escapeHtml(schedNames)}</div>
      </div>`;
    card.addEventListener('click',()=>openTeacherModal(t.id));
    list.appendChild(card);
  });
}

function renderTeacherScheduleChecklist(teacherName){
  const cl=document.getElementById('teacherScheduleChecklist');
  cl.innerHTML='';
  if((state.schedules||[]).length===0){
    cl.innerHTML='<li style="font-size:14px;color:var(--slate);padding:6px 0">No schedules yet</li>';
    return;
  }
  (state.schedules||[]).forEach((s,i)=>{
    const linked=s.teacherName&&s.teacherName.trim().toLowerCase()===(teacherName||'').trim().toLowerCase();
    const li=document.createElement('li');
    li.className=linked?'selected':'';
    li.dataset.scheduleId=s.id;
    const color=SCHED_COLORS[i%SCHED_COLORS.length];
    li.innerHTML=`<span class="check-icon">${linked?'✓':'○'}</span>
      <span style="flex:1">${escapeHtml(s.name)}</span>
      <span style="width:12px;height:12px;border-radius:50%;background:${color};display:inline-block;flex-shrink:0"></span>`;
    li.addEventListener('click',()=>{
      li.classList.toggle('selected');
      li.querySelector('.check-icon').textContent=li.classList.contains('selected')?'✓':'○';
    });
    cl.appendChild(li);
  });
}

function openTeacherModal(id=null){
  closeAllModals();
  editingTeacherId=id;
  const modal=document.getElementById('teacherModal');
  document.getElementById('teacherModalTitle').textContent=id?'Edit Teacher':'Add Teacher';
  if(id){
    const t=state.teachers.find(x=>x.id===id);
    document.getElementById('teacherName').value=t.name||'';
    document.getElementById('teacherPhone').value=t.phone||'';
    document.getElementById('deleteTeacherBtn').hidden=false;
    renderTeacherScheduleChecklist(t.name);
  }else{
    document.getElementById('teacherName').value='';
    document.getElementById('teacherPhone').value='';
    document.getElementById('deleteTeacherBtn').hidden=true;
    renderTeacherScheduleChecklist('');
  }
  modal.hidden=false;
  setTimeout(()=>document.getElementById('teacherName').focus(),50);
}
function closeTeacherModal(){ document.getElementById('teacherModal').hidden=true; editingTeacherId=null; }
document.getElementById('addTeacherBtn').addEventListener('click',()=>openTeacherModal());
document.getElementById('cancelTeacherBtn').addEventListener('click',closeTeacherModal);
document.getElementById('closeTeacherModalBtn').addEventListener('click',closeTeacherModal);
document.getElementById('teacherModal').addEventListener('click',e=>{ if(e.target===document.getElementById('teacherModal')) closeTeacherModal(); });
document.getElementById('saveTeacherBtn').addEventListener('click',()=>{
  if(!state.teachers) state.teachers=[];
  const name=document.getElementById('teacherName').value.trim()||'(No name)';
  const phone=document.getElementById('teacherPhone').value.trim();
  if(editingTeacherId){
    const t=state.teachers.find(x=>x.id===editingTeacherId);
    t.name=name; t.phone=phone;
  }else{
    state.teachers.push({id:uid(),name,phone});
  }
  document.querySelectorAll('#teacherScheduleChecklist li[data-schedule-id]').forEach(li=>{
    const sc=(state.schedules||[]).find(x=>x.id===li.dataset.scheduleId);
    if(!sc) return;
    if(li.classList.contains('selected')) sc.teacherName=name;
    else if(sc.teacherName&&sc.teacherName.trim().toLowerCase()===name.trim().toLowerCase()) sc.teacherName='';
  });
  saveData(); renderGiaoVien(); closeTeacherModal();
});
document.getElementById('deleteTeacherBtn').addEventListener('click',()=>{
  if(!editingTeacherId) return;
  if(confirm('Xóa giáo viên này?')){
    state.teachers=state.teachers.filter(x=>x.id!==editingTeacherId);
    saveData(); renderGiaoVien(); closeTeacherModal();
  }
});

/* ============================================================
   DUCK RACE — Random picker
   ============================================================ */
let activeWheelScheduleId=null;
let wheelCustomList=null;
let raceRunning=false;
let raceAnimFrame=null;

function renderWheelGrades(){
  const list=document.getElementById('wheelGradeList');
  if(!list) return;
  list.innerHTML='';
  GRADES.forEach(g=>{
    const count=studentsInGrade(g).length;
    const li=document.createElement('li');
    li.className='grade-card';
    li.innerHTML=`<span class="grade-num">Grade ${g}</span>
      <span class="grade-label">${count} học sinh</span>`;
    li.addEventListener('click',()=>{
      activeGrade=g;
      navigateTo('wheel',{title:`Grade ${g} · Random`,showBack:true});
    });
    list.appendChild(li);
  });
}

function getDuckStudents(){
  if(wheelCustomList) return wheelCustomList;
  const removed=(state.wheelRemoved||{})[activeWheelScheduleId||('grade_'+activeGrade)]||[];
  let students;
  if(activeWheelScheduleId){
    const sc=(state.schedules||[]).find(x=>x.id===activeWheelScheduleId);
    students=(sc?.studentIds||[]).map(id=>(state.students||[]).find(x=>x.id===id)).filter(Boolean);
  }else{
    students=studentsInGrade(activeGrade);
  }
  return students.filter(s=>!removed.includes(s.id));
}

function renderWheel(){
  raceRunning=false;
  if(raceAnimFrame) cancelAnimationFrame(raceAnimFrame);
  document.getElementById('duckResult').textContent='';
  document.getElementById('raceStartBtn').textContent='🏁 Bắt đầu đua!';
  document.getElementById('raceStartBtn').disabled=false;

  // schedule chips
  let chipContainer=document.getElementById('wheelSchedChips');
  if(!chipContainer){
    chipContainer=document.createElement('div');
    chipContainer.id='wheelSchedChips';
    chipContainer.style.cssText='display:flex;flex-wrap:wrap;gap:8px;padding:0 0 14px;justify-content:center';
    document.getElementById('screen-wheel').insertBefore(chipContainer,document.getElementById('duckRaceWrap'));
  }
  chipContainer.innerHTML='';

  const gradeScheds=(state.schedules||[]).filter(s=>s.grade===activeGrade);
  const allChip=document.createElement('button');
  allChip.className='schedule-chip';
  allChip.style.background=activeWheelScheduleId===null?'var(--green-deep)':'var(--slate)';
  allChip.textContent='Tất cả';
  allChip.addEventListener('click',()=>{ activeWheelScheduleId=null; wheelCustomList=null; renderWheel(); });
  chipContainer.appendChild(allChip);
  gradeScheds.forEach(s=>{
    const idx=(state.schedules||[]).indexOf(s)%SCHED_COLORS.length;
    const color=SCHED_COLORS[idx];
    const chip=document.createElement('button');
    chip.className='schedule-chip';
    chip.style.background=activeWheelScheduleId===s.id?color:color+'99';
    chip.textContent=s.name;
    chip.addEventListener('click',()=>{ activeWheelScheduleId=s.id; wheelCustomList=null; renderWheel(); });
    chipContainer.appendChild(chip);
  });
  const editBtn=document.createElement('button');
  editBtn.className='btn-icon small';
  editBtn.style.cssText='background:var(--chalk-dim);color:var(--green-deep)';
  editBtn.textContent='✏️';
  editBtn.addEventListener('click',openWheelEditModal);
  chipContainer.appendChild(editBtn);

  buildDuckLanes();
}

const DUCK_LANE_H=52;
const DUCK_COLORS=['#F4C430','#FF6B6B','#4ECDC4','#45B7D1','#96CEB4','#FFEAA7','#DDA0DD','#98D8C8','#F7DC6F'];
let duckCanvas=document.getElementById('duckCanvas');
let duckCtx=duckCanvas?duckCanvas.getContext('2d'):null;
let duckRaceData=[];
let waveOffset=0;

function buildDuckLanes(){
  const students=getDuckStudents();
  document.getElementById('wheelEmpty').hidden=students.length>0;
  document.getElementById('raceStartBtn').style.display=students.length>0?'':'none';
  document.getElementById('duckResult').textContent='';

  // re-grab canvas each time screen becomes visible — fixes width=0 bug
  duckCanvas=document.getElementById('duckCanvas');
  duckCtx=duckCanvas?duckCanvas.getContext('2d'):null;
  if(!duckCanvas) return;

  const laneCount=students.length;
  // use window width as fallback if element not yet laid out
  const W=Math.max(duckCanvas.parentElement.offsetWidth||0, window.innerWidth-40, 300);
  const H=Math.max(180, laneCount*DUCK_LANE_H+40);
  duckCanvas.width=W;
  duckCanvas.height=H;
  duckCanvas.style.height=H+'px';

  duckRaceData=students.map((s,i)=>({
    id:s.id,
    name:s.studentName,
    x:30,
    y:30+i*DUCK_LANE_H,
    color:DUCK_COLORS[i%DUCK_COLORS.length],
    bobOffset:Math.random()*Math.PI*2,
    finished:false,
  }));

  drawDuckRace();
}

function roundRect(ctx,x,y,w,h,r){
  ctx.beginPath();
  ctx.moveTo(x+r,y);
  ctx.lineTo(x+w-r,y);
  ctx.quadraticCurveTo(x+w,y,x+w,y+r);
  ctx.lineTo(x+w,y+h-r);
  ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
  ctx.lineTo(x+r,y+h);
  ctx.quadraticCurveTo(x,y+h,x,y+r);
  ctx.lineTo(x,y+r);
  ctx.quadraticCurveTo(x,y,x+r,y);
  ctx.closePath();
  ctx.fill();
}

function drawDuckRace(){
  if(!duckCtx) return;
  const W=duckCanvas.width, H=duckCanvas.height;
  const finishX=W-30;
  duckCtx.clearRect(0,0,W,H);

  const grad=duckCtx.createLinearGradient(0,0,0,H);
  grad.addColorStop(0,'#5BB8D4');
  grad.addColorStop(1,'#2E86AB');
  duckCtx.fillStyle=grad;
  duckCtx.fillRect(0,0,W,H);

  duckRaceData.forEach(d=>{
    duckCtx.strokeStyle='rgba(255,255,255,0.15)';
    duckCtx.lineWidth=1;
    duckCtx.beginPath();
    duckCtx.moveTo(0,d.y+DUCK_LANE_H/2);
    duckCtx.lineTo(W,d.y+DUCK_LANE_H/2);
    duckCtx.stroke();

    if(!d.finished&&raceRunning){
      duckCtx.strokeStyle='rgba(255,255,255,0.3)';
      duckCtx.lineWidth=1.5;
      for(let r=1;r<=3;r++){
        duckCtx.beginPath();
        duckCtx.ellipse(d.x-10-r*8, d.y+4, r*4, r*2, 0, 0, Math.PI*2);
        duckCtx.stroke();
      }
    }
  });

  const checkH=10;
  for(let row=0;row<Math.ceil(H/checkH);row++){
    for(let col=0;col<2;col++){
      duckCtx.fillStyle=(row+col)%2===0?'#fff':'#222';
      duckCtx.fillRect(finishX+col*4,row*checkH,4,checkH);
    }
  }
  duckCtx.font='18px serif';
  duckCtx.fillText('🏁',finishX-4,20);

  duckRaceData.forEach(d=>{
    const bob=Math.sin(waveOffset+d.bobOffset)*3;
    const y=d.y+bob;

    duckCtx.fillStyle=d.color;
    duckCtx.beginPath();
    duckCtx.ellipse(d.x,y+18,13,10,0,0,Math.PI*2);
    duckCtx.fill();

    duckCtx.beginPath();
    duckCtx.arc(d.x+10,y+10,8,0,Math.PI*2);
    duckCtx.fill();

    duckCtx.fillStyle='#333';
    duckCtx.beginPath();
    duckCtx.arc(d.x+14,y+8,2,0,Math.PI*2);
    duckCtx.fill();

    duckCtx.fillStyle='#FF8C00';
    duckCtx.beginPath();
    duckCtx.moveTo(d.x+20,y+10);
    duckCtx.lineTo(d.x+26,y+9);
    duckCtx.lineTo(d.x+20,y+13);
    duckCtx.closePath();
    duckCtx.fill();

    const wingAngle=Math.sin(waveOffset*2+d.bobOffset)*0.3;
    duckCtx.fillStyle=d.color==='#F4C430'?'#D4A017':d.color+'CC';
    duckCtx.save();
    duckCtx.translate(d.x+2,y+16);
    duckCtx.rotate(wingAngle);
    duckCtx.beginPath();
    duckCtx.ellipse(0,0,8,4,0.3,0,Math.PI*2);
    duckCtx.fill();
    duckCtx.restore();

    const nameText=d.name.length>12?d.name.slice(0,11)+'…':d.name;
    duckCtx.font='bold 11px sans-serif';
    const tw=duckCtx.measureText(nameText).width;
    const tagX=d.x+28, tagY=y+8;
    duckCtx.fillStyle='rgba(0,0,0,0.5)';
    roundRect(duckCtx,tagX-3,tagY-10,tw+8,16,4);
    duckCtx.fillStyle='#fff';
    duckCtx.fillText(nameText,tagX+1,tagY+2);
  });
}

document.getElementById('raceStartBtn').addEventListener('click',()=>{
  if(raceRunning) return;
  const students=getDuckStudents();
  if(students.length===0) return;

  let count=3;
  document.getElementById('raceStartBtn').disabled=true;
  document.getElementById('duckResult').textContent=`${count}...`;
  const countInterval=setInterval(()=>{
    count--;
    if(count>0) document.getElementById('duckResult').textContent=`${count}...`;
    else if(count===0) document.getElementById('duckResult').textContent='🏁 Bắt đầu!';
    else{
      clearInterval(countInterval);
      document.getElementById('duckResult').textContent='';
      startDuckRace(students);
    }
  },800);
});

function startDuckRace(students){
  raceRunning=true;
  document.getElementById('raceStartBtn').textContent='🏃 Đang đua...';
  const W=duckCanvas.width;
  const finishX=W-30;
  const winnerIdx=Math.floor(Math.random()*students.length);

  duckRaceData.forEach((d,i)=>{
    d.baseSpeed=0.8+Math.random()*2;
    d.burstTimer=Math.floor(Math.random()*60);
    d.burstDuration=0;
    d.burstSpeed=0;
    d.lateBoost=i===winnerIdx;
    d.finished=false;
    d.x=30;
  });

  function frame(){
    waveOffset+=0.08;
    const maxX=Math.max(...duckRaceData.filter(d=>!d.finished).map(d=>d.x));
    let winner=null;

    duckRaceData.forEach(d=>{
      if(d.finished) return;
      if(d.burstDuration>0){ d.burstDuration--; }
      else if(--d.burstTimer<=0){
        d.burstTimer=20+Math.floor(Math.random()*80);
        const r=Math.random();
        if(r<0.4){ d.burstSpeed=1+Math.random()*2; d.burstDuration=10+Math.floor(Math.random()*25); }
        else if(r<0.6){ d.burstSpeed=-0.2; d.burstDuration=8; }
        else d.burstSpeed=0;
      }
      const progress=d.x/finishX;
      const lateBoost=(d.lateBoost&&progress>0.6&&d.x<maxX-15)?1.5:0;
      const speed=Math.max(0.2,d.baseSpeed+d.burstSpeed+lateBoost+(Math.random()-0.4)*0.3);
      d.x=Math.min(d.x+speed, finishX+5);
      if(d.x>=finishX){ d.finished=true; if(!winner) winner=d; }
    });

    drawDuckRace();

    if(winner){
      raceRunning=false;
      const winStudent=students.find(s=>s.id===winner.id);
      document.getElementById('duckResult').textContent=`🏆 ${winner.name} thắng!`;
      document.getElementById('raceStartBtn').disabled=false;
      document.getElementById('raceStartBtn').textContent='🏁 Đua lại!';
      if(document.getElementById('removeOnPick').checked&&winStudent){
        const key=activeWheelScheduleId||('grade_'+activeGrade);
        if(!state.wheelRemoved) state.wheelRemoved={};
        if(!state.wheelRemoved[key]) state.wheelRemoved[key]=[];
        state.wheelRemoved[key].push(winner.id);
        saveData(); setTimeout(()=>renderWheel(),1500);
      }
      if(navigator.vibrate) navigator.vibrate([100,50,200]);
      return;
    }
    raceAnimFrame=requestAnimationFrame(frame);
  }
  raceAnimFrame=requestAnimationFrame(frame);
}

// Fullscreen for duck race
document.getElementById('duckFullscreenBtn').addEventListener('click',()=>{
  const wrap=document.getElementById('duckRaceWrap');
  if(document.fullscreenElement){
    document.exitFullscreen();
  } else {
    wrap.requestFullscreen().catch(e=>{
      // fallback: open in new tab if fullscreen blocked
      alert('Trình duyệt không cho phép toàn màn hình. Hãy thử nhấn F11.');
    });
  }
});

// When fullscreen activates, resize canvas to fill screen
document.addEventListener('fullscreenchange',()=>{
  if(document.fullscreenElement){
    const W=window.screen.width;
    const H=window.screen.height;
    duckCanvas.width=W;
    duckCanvas.height=H;
    duckCanvas.style.width='100%';
    duckCanvas.style.height='100%';
    // recalculate duck Y positions for new height
    duckRaceData.forEach((d,i)=>{
      d.y=40+i*((H-80)/Math.max(duckRaceData.length,1));
    });
    drawDuckRace();
  } else {
    // restore normal size
    buildDuckLanes();
  }
});
document.getElementById('resetWheelBtn').addEventListener('click',()=>{
  const key=activeWheelScheduleId||('grade_'+activeGrade);
  if(!state.wheelRemoved) state.wheelRemoved={};
  state.wheelRemoved[key]=[];
  wheelCustomList=null;
  saveData(); renderWheel();
});

document.getElementById('editDuckListBtn').addEventListener('click',openWheelEditModal);

function openWheelEditModal(){
  closeAllModals();
  const students=getDuckStudents();
  let modal=document.getElementById('wheelEditModal');
  if(!modal){
    modal=document.createElement('div');
    modal.id='wheelEditModal';
    modal.className='modal-backdrop';
    modal.innerHTML=`<div class="modal">
      <div class="modal-header">
        <h2>Chỉnh sửa danh sách</h2>
        <button class="modal-close" id="closeWheelEditBtn">✕</button>
      </div>
      <p style="font-size:14px;color:var(--slate);margin:0 0 10px">Mỗi tên một dòng. Thay đổi chỉ áp dụng cho lần đua này.</p>
      <textarea id="wheelEditArea" style="width:100%;min-height:180px;padding:11px;border-radius:10px;border:1.5px solid var(--chalk-dim);font-size:15px;font-family:inherit;resize:vertical"></textarea>
      <div class="modal-actions" style="margin-top:12px">
        <div class="modal-actions-right">
          <button class="btn-text" id="cancelWheelEditBtn">Hủy</button>
          <button class="btn-solid" id="saveWheelEditBtn">Áp dụng</button>
        </div>
      </div>
    </div>`;
    document.body.appendChild(modal);
    modal.addEventListener('click',e=>{ if(e.target===modal) modal.hidden=true; });
    document.getElementById('closeWheelEditBtn').addEventListener('click',()=>modal.hidden=true);
    document.getElementById('cancelWheelEditBtn').addEventListener('click',()=>modal.hidden=true);
    document.getElementById('saveWheelEditBtn').addEventListener('click',()=>{
      const lines=document.getElementById('wheelEditArea').value.split('\n').map(l=>l.trim()).filter(Boolean);
      wheelCustomList=lines.map(name=>{
        const existing=(state.students||[]).find(s=>s.studentName===name);
        return existing||{id:'custom_'+uid(),studentName:name,parentName:'',grade:activeGrade};
      });
      modal.hidden=true; renderWheel();
    });
  }
  document.getElementById('wheelEditArea').value=students.map(s=>s.studentName).join('\n');
  modal.hidden=false;
}

/* ============================================================
   NHẬP FILE — Import students from Excel or Word
   ============================================================ */

// Column header synonyms — maps Vietnamese headers to internal field names
const HEADER_MAP={
  'tên học sinh':'studentName','ten hoc sinh':'studentName','họ và tên':'studentName',
  'ho va ten':'studentName','tên':'studentName','ten':'studentName','họ tên':'studentName',
  'tên phụ huynh':'parentName','ten phu huynh':'parentName','phụ huynh':'parentName',
  'phu huynh':'parentName','tên ph':'parentName',
  'sđt học sinh':'studentPhone','sdt hoc sinh':'studentPhone','đt học sinh':'studentPhone',
  'sđt hs':'studentPhone','phone học sinh':'studentPhone',
  'sđt phụ huynh':'parentPhone','sdt phu huynh':'parentPhone','đt phụ huynh':'parentPhone',
  'sđt ph':'parentPhone','phone phụ huynh':'parentPhone','số điện thoại':'parentPhone',
  'ngày nhập học':'enrollDate','ngay nhap hoc':'enrollDate','ngày vào':'enrollDate',
  'ghi chú':'notes','ghi chu':'notes','notes':'notes','note':'notes',
  'lớp':'grade','lop':'grade','khối':'grade','khoi':'grade','grade':'grade',
};

function normalizeHeader(h){
  return (h||'').toLowerCase().trim()
    .normalize('NFD').replace(/[\u0300-\u036f]/g,'') // remove diacritics for matching
    .replace(/\s+/g,' ');
}

function mapHeaders(headers){
  return headers.map(h=>{
    const norm=normalizeHeader(h);
    return HEADER_MAP[norm]||null;
  });
}

function importStudentsFromRows(dataRows, fieldMap, gradeOverride){
  let imported=0, skipped=0;
  dataRows.forEach(row=>{
    const obj={};
    fieldMap.forEach((field,i)=>{
      if(field&&row[i]!==undefined) obj[field]=(row[i]||'').toString().trim();
    });
    if(!obj.studentName){ skipped++; return; }
    // parse grade
    let grade=gradeOverride||1;
    if(obj.grade){
      const g=parseInt(obj.grade);
      if(!isNaN(g)) grade=g;
    }
    if(!GRADES.includes(grade)){ GRADES.push(grade); GRADES.sort((a,b)=>a-b); }
    if(!state.students) state.students=[];
    state.students.push({
      id:uid(),
      grade,
      studentName:obj.studentName||'(No name)',
      parentName:obj.parentName||'',
      studentPhone:obj.studentPhone||'',
      parentPhone:obj.parentPhone||'',
      enrollDate:obj.enrollDate||'',
      notes:obj.notes||'',
      scheduleDiscounts:{},
    });
    imported++;
  });
  saveData();
  return {imported,skipped};
}

// --- Excel import via SheetJS CDN ---
function loadSheetJS(cb){
  if(window.XLSX){ cb(); return; }
  const s=document.createElement('script');
  s.src='https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
  s.onload=cb; document.head.appendChild(s);
}

function importExcel(file, gradeOverride){
  loadSheetJS(()=>{
    const reader=new FileReader();
    reader.onload=e=>{
      try{
        const wb=XLSX.read(e.target.result,{type:'array'});
        const ws=wb.Sheets[wb.SheetNames[0]];
        const data=XLSX.utils.sheet_to_json(ws,{header:1,defval:''});
        if(data.length<2){ alert('File không có dữ liệu!'); return; }
        const fieldMap=mapHeaders(data[0]);
        const result=importStudentsFromRows(data.slice(1),fieldMap,gradeOverride);
        alert(`✅ Nhập thành công ${result.imported} học sinh${result.skipped>0?`, bỏ qua ${result.skipped} dòng trống`:''}.`);
        renderHocSinh(); renderGradeList();
      }catch(err){
        alert('Lỗi đọc file Excel: '+err.message);
      }
    };
    reader.readAsArrayBuffer(file);
  });
}

// --- Word import via mammoth.js CDN ---
function loadMammoth(cb){
  if(window.mammoth){ cb(); return; }
  const s=document.createElement('script');
  s.src='https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js';
  s.onload=cb; document.head.appendChild(s);
}

function importWord(file, gradeOverride){
  loadMammoth(()=>{
    const reader=new FileReader();
    reader.onload=e=>{
      mammoth.convertToHtml({arrayBuffer:e.target.result}).then(result=>{
        try{
          const parser=new DOMParser();
          const doc=parser.parseFromString(result.value,'text/html');
          const tables=doc.querySelectorAll('table');
          if(tables.length===0){ alert('Không tìm thấy bảng trong file Word!'); return; }
          const table=tables[0];
          const rows=[...table.querySelectorAll('tr')];
          if(rows.length<2){ alert('Bảng không có dữ liệu!'); return; }
          const headers=[...rows[0].querySelectorAll('td,th')].map(td=>td.textContent);
          const fieldMap=mapHeaders(headers);
          const dataRows=rows.slice(1).map(tr=>
            [...tr.querySelectorAll('td,th')].map(td=>td.textContent.trim())
          );
          const res=importStudentsFromRows(dataRows,fieldMap,gradeOverride);
          alert(`✅ Nhập thành công ${res.imported} học sinh${res.skipped>0?`, bỏ qua ${res.skipped} dòng trống`:''}.`);
          renderHocSinh(); renderGradeList();
        }catch(err){
          alert('Lỗi đọc file Word: '+err.message);
        }
      }).catch(err=>alert('Lỗi mở file Word: '+err.message));
    };
    reader.readAsArrayBuffer(file);
  });
}

// Wire up import button — created in HTML below
function openImportModal(){
  closeAllModals();
  let modal=document.getElementById('importModal');
  if(!modal){
    modal=document.createElement('div');
    modal.id='importModal';
    modal.className='modal-backdrop';
    modal.innerHTML=`<div class="modal">
      <div class="modal-header">
        <h2>Nhập danh sách học sinh</h2>
        <button class="modal-close" id="closeImportModalBtn">✕</button>
      </div>
      <p style="font-size:14px;font-weight:700;color:var(--green-deep);margin:0 0 8px">
        Bạn cần nhập file có bảng như này, thông tin tên học sinh là bắt buộc:
      </p>
      <div style="overflow-x:auto;margin-bottom:14px">
        <table class="import-template-table">
          <thead><tr>
            <th>Tên học sinh ✱</th>
            <th>Tên phụ huynh</th>
            <th>SĐT phụ huynh</th>
            <th>SĐT học sinh</th>
            <th>Ngày nhập học</th>
            <th>Lớp</th>
            <th>Ghi chú</th>
          </tr></thead>
          <tbody>
            <tr><td>Nguyễn Văn A</td><td>Nguyễn Văn B</td><td>0901234567</td><td>0912345678</td><td>01/09/2024</td><td>7</td><td>Học giỏi</td></tr>
            <tr><td>Trần Thị C</td><td>Trần Văn D</td><td>0987654321</td><td></td><td></td><td>7</td><td></td></tr>
          </tbody>
        </table>
      </div>
      <p style="font-size:12px;color:var(--slate);margin:0 0 12px">
        ✱ Bắt buộc. Các cột khác không bắt buộc. Tên cột nhận diện tự động, không phân biệt hoa thường.
      </p>
      <label style="display:block;font-size:14px;font-weight:700;color:var(--slate);margin-bottom:12px">
        Khối mặc định (nếu file không có cột Lớp)
        <select id="importGradeDefault" style="display:block;width:100%;margin-top:6px;padding:10px;border-radius:10px;border:1.5px solid var(--chalk-dim);font-size:15px"></select>
      </label>
      <input type="file" id="importFileInput" accept=".xlsx,.xls,.docx,.doc"
        style="display:block;width:100%;padding:10px;border-radius:10px;border:1.5px solid var(--chalk-dim);font-size:15px;margin-bottom:14px;background:#fff">
      <div class="modal-actions">
        <div class="modal-actions-right">
          <button class="btn-text" id="cancelImportBtn">Hủy</button>
          <button class="btn-solid" id="confirmImportBtn">Nhập file</button>
        </div>
      </div>
    </div>`;
    document.body.appendChild(modal);
    modal.addEventListener('click',e=>{ if(e.target===modal) modal.hidden=true; });
    document.getElementById('closeImportModalBtn').addEventListener('click',()=>modal.hidden=true);
    document.getElementById('cancelImportBtn').addEventListener('click',()=>modal.hidden=true);
    document.getElementById('confirmImportBtn').addEventListener('click',()=>{
      const file=document.getElementById('importFileInput').files[0];
      if(!file){ alert('Vui lòng chọn file!'); return; }
      const gradeOverride=parseInt(document.getElementById('importGradeDefault').value)||1;
      const ext=file.name.split('.').pop().toLowerCase();
      modal.hidden=true;
      if(ext==='xlsx'||ext==='xls') importExcel(file,gradeOverride);
      else if(ext==='docx'||ext==='doc') importWord(file,gradeOverride);
      else alert('Định dạng file không hỗ trợ. Vui lòng dùng .xlsx hoặc .docx');
    });
  }
  // populate grade select
  const sel=document.getElementById('importGradeDefault');
  sel.innerHTML='';
  GRADES.forEach(g=>{
    const opt=document.createElement('option');
    opt.value=g; opt.textContent=`Khối ${g}`;
    sel.appendChild(opt);
  });
  modal.hidden=false;
}
/* ============================================================
   XUẤT FILE — Export student list to Excel + Word
   ============================================================ */
document.getElementById('xuatFileBtn').addEventListener('click',()=>{
  closeAllModals();
  document.getElementById('xuatFileModal').hidden=false;
});
document.getElementById('closeXuatFileModalBtn').addEventListener('click',()=>{
  document.getElementById('xuatFileModal').hidden=true;
});
document.getElementById('xuatFileModal').addEventListener('click',e=>{
  if(e.target===document.getElementById('xuatFileModal'))
    document.getElementById('xuatFileModal').hidden=true;
});

function buildExportRows(sortMode){
  const rows=[];
  const students=state.students||[];
  let stt=1;

  function addStudent(s){
    rows.push({
      stt:stt++,
      ten:s.studentName||'',
      ph:s.parentName||'',
      sdt:s.parentPhone||'',
      ngay:s.enrollDate||'',
    });
  }

  if(sortMode==='khoi'){
    const grades=[...new Set(students.map(s=>s.grade))].sort((a,b)=>a-b);
    grades.forEach(g=>{
      rows.push({type:'grade',label:`Khối ${g}`});
      students.filter(s=>s.grade===g)
        .sort((a,b)=>a.studentName.localeCompare(b.studentName))
        .forEach(addStudent);
      rows.push({type:'empty'});
    });
  } else {
    const grades=[...new Set(students.map(s=>s.grade))].sort((a,b)=>a-b);
    grades.forEach(g=>{
      rows.push({type:'grade',label:`Khối ${g}`});
      const scheds=(state.schedules||[]).filter(s=>s.grade===g);
      const shownIds=new Set();
      scheds.forEach(sc=>{
        const inSched=students.filter(s=>s.grade===g&&(sc.studentIds||[]).includes(s.id));
        if(inSched.length===0) return;
        rows.push({type:'sched',label:`Suất: ${sc.name}${sc.teacherName?' — GV: '+sc.teacherName:''}`});
        inSched.sort((a,b)=>a.studentName.localeCompare(b.studentName)).forEach(s=>{ addStudent(s); shownIds.add(s.id); });
        rows.push({type:'empty'});
      });
      const noSched=students.filter(s=>s.grade===g&&!shownIds.has(s.id));
      if(noSched.length>0){
        rows.push({type:'sched',label:'Chưa có suất học'});
        noSched.sort((a,b)=>a.studentName.localeCompare(b.studentName)).forEach(addStudent);
        rows.push({type:'empty'});
      }
      rows.push({type:'empty'});
    });
  }
  return rows;
}

document.getElementById('xuatExcelBtn').addEventListener('click',()=>{
  const sortMode=document.querySelector('input[name="xuatSort"]:checked').value;
  const rows=buildExportRows(sortMode);

  // build CSV (universal, opens in Excel)
  const headers=['STT','Tên học sinh','Tên phụ huynh','SĐT phụ huynh','Ngày nhập học'];
  const csvLines=['\uFEFF'+headers.join(',')]; // BOM for Vietnamese characters in Excel

  rows.forEach(r=>{
    if(r.type==='empty'){ csvLines.push(''); return; }
    if(r.type==='grade'||r.type==='sched'){ csvLines.push(`"${r.label}",,,,`); return; }
    csvLines.push([r.stt,`"${r.ten}"`,`"${r.ph}"`,`"${r.sdt}"`,`"${r.ngay}"`].join(','));
  });

  const blob=new Blob([csvLines.join('\n')],{type:'text/csv;charset=utf-8'});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download=`danh_sach_hoc_sinh_${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  document.getElementById('xuatFileModal').hidden=true;
});

document.getElementById('xuatWordBtn').addEventListener('click',()=>{
  const sortMode=document.querySelector('input[name="xuatSort"]:checked').value;
  const rows=buildExportRows(sortMode);

  // build HTML table then wrap in Word-compatible HTML
  let tableRows='<tr style="background:#2F4538;color:#fff"><th>STT</th><th>Tên học sinh</th><th>Tên phụ huynh</th><th>SĐT phụ huynh</th><th>Ngày nhập học</th></tr>';
  rows.forEach(r=>{
    if(r.type==='empty'){ tableRows+=`<tr><td colspan="5">&nbsp;</td></tr>`; return; }
    if(r.type==='grade'){ tableRows+=`<tr style="background:#E9E4D6"><td colspan="5"><b>${r.label}</b></td></tr>`; return; }
    if(r.type==='sched'){ tableRows+=`<tr style="background:#F7F4EC"><td colspan="5"><i>${r.label}</i></td></tr>`; return; }
    tableRows+=`<tr><td>${r.stt}</td><td>${r.ten}</td><td>${r.ph}</td><td>${r.sdt}</td><td>${r.ngay}</td></tr>`;
  });

  const html=`<html xmlns:o="urn:schemas-microsoft-com:office:office"
    xmlns:w="urn:schemas-microsoft-com:office:word"
    xmlns="http://www.w3.org/TR/REC-html40">
    <head><meta charset="utf-8">
    <style>
      body{font-family:Arial,sans-serif;font-size:12pt}
      h1{font-size:16pt;text-align:center;color:#2F4538}
      table{border-collapse:collapse;width:100%}
      td,th{border:1px solid #ccc;padding:6px 10px;font-size:11pt}
      th{font-weight:bold}
    </style></head>
    <body>
    <h1>Danh sách học sinh</h1>
    <p style="text-align:center;color:#666">Xuất ngày: ${new Date().toLocaleDateString('vi-VN')}</p>
    <table>${tableRows}</table>
    </body></html>`;

  const blob=new Blob([html],{type:'application/msword'});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download=`danh_sach_hoc_sinh_${new Date().toISOString().slice(0,10)}.doc`;
  a.click();
  document.getElementById('xuatFileModal').hidden=true;
});
/* ============================================================
   FIREBASE INIT — load data then start app
   ============================================================ */
document.getElementById('importFileBtn').addEventListener('click',()=>openImportModal());
showLoading(true);
DATA_REF.on('value',(snapshot)=>{
  const data=snapshot.val();
  // always reset to safe defaults first
  state.students=[];
  state.schedules=[];
  state.attendance={};
  state.wheelRemoved={};
  state.feePayments={};
  state.teachers=[];
  if(data){
    // Firebase can return objects instead of arrays — convert safely
    state.students=Array.isArray(data.students)
      ?data.students:Object.values(data.students||{});
    state.schedules=Array.isArray(data.schedules)
      ?data.schedules:Object.values(data.schedules||{});
    state.teachers=Array.isArray(data.teachers)
      ?data.teachers:Object.values(data.teachers||{});
    state.attendance=data.attendance||{};
    state.wheelRemoved=data.wheelRemoved||{};
    state.feePayments=data.feePayments||{};
    GRADES=Array.isArray(data.grades)&&data.grades.length>0
      ?data.grades:DEFAULT_GRADES;
  }
  if(!appReady){
    appReady=true;
    showLoading(false);
    showScreen('grades',{showBack:false});
  }else{
    showScreen(currentScreen,{title:topbarTitle.textContent,showBack:!backBtn.hidden});
  }
},(error)=>{
  console.error('Firebase error:',error);
  showLoading(false);
  showScreen('grades',{showBack:false});
});

if('serviceWorker' in navigator){
  window.addEventListener('load',()=>{
    navigator.serviceWorker.register('sw.js').catch(e=>console.log('SW failed:',e));
  });
}
