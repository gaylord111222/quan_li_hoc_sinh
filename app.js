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
  DATA_REF.set(state).catch(e=>console.error('Firebase save error:', e));
}

/* ============================================================
   CONSTANTS
   ============================================================ */
let GRADES = [1,2,3,4,5,6,7,8,9];
const DAY_NAMES = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
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

document.querySelectorAll('.tab').forEach(tab=>{
  tab.addEventListener('click',()=>{
    const target=tab.dataset.screen;
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
    else if(currentScreen==='attendance') showScreen('attendance-grades',{showBack:false});
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
      if(confirm(`Add Grade ${next}?`)){
        GRADES.push(next);
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
  document.getElementById('scheduleModalTitle').textContent=id?'Edit Schedule':'Add Schedule';
  if(id){
    const s=(state.schedules||[]).find(x=>x.id===id);
    document.getElementById('scheduleSubject').value=s.name||'';
    document.getElementById('scheduleTeacher').value=s.teacherName||'';
    document.getElementById('scheduleBaseFee').value=s.baseFee||'';
  }else{
    document.getElementById('scheduleSubject').value='';
    document.getElementById('scheduleTeacher').value='';
    document.getElementById('scheduleBaseFee').value='';
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
  if(editingScheduleId){
    const s=state.schedules.find(x=>x.id===editingScheduleId);
    if(s){ s.name=name; s.teacherName=teacherName; s.baseFee=baseFee; }
  }else{
    state.schedules.push({id:uid(),grade:activeGrade,name,teacherName,baseFee,timeBlocks:[],studentIds:[]});
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
document.getElementById('detailFeeBtn').addEventListener('click',()=>openFeeModal('schedule'));
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
   NAME WHEEL — grouped by schedule
   ============================================================ */
let activeWheelScheduleId=null;
let wheelCustomList=null; // null = use schedule's students, array = manually edited

function renderWheelGrades(){
  const list=document.getElementById('wheelGradeList');
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
      navigateTo('wheel',{title:`Grade ${g} · Wheel`,showBack:true});
    });
    list.appendChild(li);
  });
}

const wheelCanvas=document.getElementById('wheelCanvas');
const ctx=wheelCanvas.getContext('2d');
const wheelResult=document.getElementById('wheelResult');
const wheelEmpty=document.getElementById('wheelEmpty');
const removeOnPick=document.getElementById('removeOnPick');
const spinBtn=document.getElementById('spinBtn');
const WHEEL_COLORS=SCHED_COLORS;
let currentRotation=0;
let spinning=false;

function renderWheel(){
  // build schedule chips for this grade inside wheel screen
  let chipContainer=document.getElementById('wheelSchedChips');
  if(!chipContainer){
    chipContainer=document.createElement('div');
    chipContainer.id='wheelSchedChips';
    chipContainer.style.cssText='display:flex;flex-wrap:wrap;gap:8px;padding:0 0 14px;justify-content:center';
    wheelCanvas.parentElement.parentElement.insertBefore(chipContainer,wheelCanvas.parentElement);
  }
  chipContainer.innerHTML='';

  const gradeScheds=(state.schedules||[]).filter(s=>s.grade===activeGrade);

  // "All students" chip
  const allChip=document.createElement('button');
  allChip.className='schedule-chip'+(activeWheelScheduleId===null?' active':'');
  allChip.style.background=activeWheelScheduleId===null?'var(--green-deep)':'var(--slate)';
  allChip.textContent='Tất cả';
  allChip.addEventListener('click',()=>{ activeWheelScheduleId=null; wheelCustomList=null; currentRotation=0; renderWheel(); });
  chipContainer.appendChild(document.createElement('span').appendChild(allChip)||allChip);

  gradeScheds.forEach((s,i)=>{
    const color=SCHED_COLORS[(state.schedules||[]).indexOf(s)%SCHED_COLORS.length];
    const chip=document.createElement('button');
    chip.className='schedule-chip';
    chip.style.background=activeWheelScheduleId===s.id?color:color+'99';
    chip.textContent=s.name;
    chip.addEventListener('click',()=>{
      activeWheelScheduleId=s.id; wheelCustomList=null; currentRotation=0; renderWheel();
    });
    chipContainer.appendChild(chip);
  });

  // pencil button
  const editBtn=document.createElement('button');
  editBtn.className='btn-icon small';
  editBtn.style.cssText='background:var(--chalk-dim);color:var(--green-deep);margin-left:4px';
  editBtn.textContent='✏️';
  editBtn.addEventListener('click',()=>openWheelEditModal());
  chipContainer.appendChild(editBtn);

  currentRotation=0;
  wheelResult.textContent='';
  drawWheel();
}

function getWheelStudents(){
  if(wheelCustomList) return wheelCustomList;
  const removed=state.wheelRemoved?.[activeWheelScheduleId||('grade_'+activeGrade)]||[];
  let students;
  if(activeWheelScheduleId){
    const sc=(state.schedules||[]).find(x=>x.id===activeWheelScheduleId);
    students=(sc?.studentIds||[]).map(id=>(state.students||[]).find(x=>x.id===id)).filter(Boolean);
  }else{
    students=studentsInGrade(activeGrade);
  }
  return students.filter(s=>!removed.includes(s.id));
}

function drawWheel(){
  const students=getWheelStudents();
  const size=wheelCanvas.width;
  const cx=size/2,cy=size/2,r=size/2-4;
  ctx.clearRect(0,0,size,size);
  wheelEmpty.hidden=students.length>0;
  spinBtn.style.visibility=students.length>0?'visible':'hidden';
  if(students.length===0) return;
  const slice=(2*Math.PI)/students.length;
  ctx.save(); ctx.translate(cx,cy); ctx.rotate(currentRotation);
  students.forEach((s,i)=>{
    const start=i*slice,end=start+slice;
    ctx.beginPath(); ctx.moveTo(0,0); ctx.arc(0,0,r,start,end); ctx.closePath();
    ctx.fillStyle=WHEEL_COLORS[i%WHEEL_COLORS.length]; ctx.fill();
    ctx.save(); ctx.rotate(start+slice/2); ctx.textAlign='right';
    ctx.fillStyle='#F7F4EC';
    ctx.font=students.length>14?'600 10px sans-serif':'700 13px sans-serif';
    const label=s.studentName.length>16?s.studentName.slice(0,15)+'…':s.studentName;
    ctx.fillText(label,r-12,4); ctx.restore();
  });
  ctx.restore();
}

spinBtn.addEventListener('click',()=>{
  if(spinning) return;
  const students=getWheelStudents();
  if(students.length===0) return;
  spinning=true; wheelResult.textContent='';
  const slice=(2*Math.PI)/students.length;
  const winnerIndex=Math.floor(Math.random()*students.length);
  const target=winnerIndex*slice+slice/2;
  const extra=5+Math.random()*2;
  const final=currentRotation+(extra*2*Math.PI)+(-Math.PI/2-target-currentRotation%(2*Math.PI));
  const duration=4200,startRot=currentRotation,delta=final-startRot,startTime=performance.now();
  function animate(now){
    const elapsed=now-startTime,t=Math.min(elapsed/duration,1),eased=1-Math.pow(1-t,4);
    currentRotation=startRot+delta*eased; drawWheel();
    if(t<1){ requestAnimationFrame(animate); }
    else{
      spinning=false;
      const winner=students[winnerIndex];
      wheelResult.textContent=winner.studentName;
      if(removeOnPick.checked){
        const key=activeWheelScheduleId||('grade_'+activeGrade);
        if(!state.wheelRemoved) state.wheelRemoved={};
        if(!state.wheelRemoved[key]) state.wheelRemoved[key]=[];
        state.wheelRemoved[key].push(winner.id);
        saveData(); setTimeout(drawWheel,600);
      }
      if(navigator.vibrate) navigator.vibrate(40);
    }
  }
  requestAnimationFrame(animate);
});

document.getElementById('resetWheelBtn').addEventListener('click',()=>{
  const key=activeWheelScheduleId||('grade_'+activeGrade);
  if(!state.wheelRemoved) state.wheelRemoved={};
  state.wheelRemoved[key]=[];
  wheelCustomList=null;
  saveData(); wheelResult.textContent=''; drawWheel();
});

/* Wheel edit modal — manually add/remove names */
function openWheelEditModal(){
  closeAllModals();
  const students=getWheelStudents();
  // build a simple modal on the fly
  let modal=document.getElementById('wheelEditModal');
  if(!modal){
    modal=document.createElement('div');
    modal.id='wheelEditModal';
    modal.className='modal-backdrop';
    modal.innerHTML=`<div class="modal">
      <div class="modal-header">
        <h2>Edit Wheel List</h2>
        <button class="modal-close" id="closeWheelEditBtn">✕</button>
      </div>
      <p style="font-size:14px;color:var(--slate);margin:0 0 10px">One name per line. Edit freely — changes only affect this wheel session.</p>
      <textarea id="wheelEditArea" style="width:100%;min-height:200px;padding:11px;border-radius:10px;border:1.5px solid var(--chalk-dim);font-size:15px;font-family:inherit;resize:vertical"></textarea>
      <div class="modal-actions" style="margin-top:12px">
        <div class="modal-actions-right">
          <button class="btn-text" id="cancelWheelEditBtn">Cancel</button>
          <button class="btn-solid" id="saveWheelEditBtn">Apply</button>
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
      modal.hidden=true; currentRotation=0; drawWheel();
    });
  }
  document.getElementById('wheelEditArea').value=students.map(s=>s.studentName).join('\n');
  modal.hidden=false;
}

/* ============================================================
   FIREBASE INIT — load data then start app
   ============================================================ */
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
