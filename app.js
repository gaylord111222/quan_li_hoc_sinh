/* ============================================================
   CLASSROOM COMPANION — app.js  v4
   ============================================================ */

const STORAGE_KEY = 'classroomCompanion.v2';
const GRADES = [1,2,3,4,5,6,7,8,9];
const DAY_NAMES = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

function defaultData(){
  return {
    students: [
      { id: uid(), grade: 1, studentName: 'Student A', parentName: '', studentPhone: '', parentPhone: '', notes: '', scheduleDiscounts: {} },
      { id: uid(), grade: 1, studentName: 'Student B', parentName: '', studentPhone: '', parentPhone: '', notes: '', scheduleDiscounts: {} },
    ],
    schedules: [],   // NEW: replaces old flat schedule array
    attendance: {},
    wheelRemoved: {}
  };
}

function uid(){
  return Math.random().toString(36).slice(2,10) + Date.now().toString(36).slice(-4);
}

/* ---------- Storage ---------- */
function loadData(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    if(!raw) return defaultData();
    const d = JSON.parse(raw);
    // migrate old data: add scheduleDiscounts if missing
    (d.students||[]).forEach(s=>{ if(!s.scheduleDiscounts) s.scheduleDiscounts={}; });
    if(!d.schedules) d.schedules = [];
    return d;
  }catch(e){ return defaultData(); }
}
function saveData(){ localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }

let state = loadData();

function studentsInGrade(grade){
  return state.students.filter(s=>s.grade===grade);
}
function escapeHtml(str=''){
  return str.replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function initials(name){
  return (name||'').trim().split(/\s+/).slice(-2).map(w=>w[0]?.toUpperCase()||'').join('');
}
function formatTime(t){
  if(!t) return '--:--';
  const [h,m] = t.split(':').map(Number);
  const period = h>=12?'PM':'AM';
  const h12 = ((h+11)%12)+1;
  return `${h12}:${String(m).padStart(2,'0')} ${period}`;
}
function formatFee(n){
  if(!n && n!==0) return '—';
  return Number(n).toLocaleString('vi-VN') + ' ₫';
}

/* ============================================================
   NAVIGATION
   ============================================================ */
const allScreens = {
  'grades': document.getElementById('screen-grades'),
  'roster': document.getElementById('screen-roster'),
  'attendance-grades': document.getElementById('screen-attendance-grades'),
  'attendance': document.getElementById('screen-attendance'),
  'schedule': document.getElementById('screen-schedule'),
  'schedule-detail': document.getElementById('screen-schedule-detail'),
  'wheel-grades': document.getElementById('screen-wheel-grades'),
  'wheel': document.getElementById('screen-wheel'),
};
const titles = {
  'grades':'Roster', 'roster':'Grade', 'attendance-grades':'Attendance',
  'attendance':'Attendance', 'schedule':'Schedules', 'schedule-detail':'Schedule',
  'wheel-grades':'Name Wheel', 'wheel':'Name Wheel'
};
const topbarTitle = document.getElementById('topbarTitle');
const backBtn = document.getElementById('backBtn');

let activeGrade = null;
let activeScheduleId = null;
let currentScreen = 'grades';
let screenHistory = [];

function showScreen(name, opts={}){
  Object.entries(allScreens).forEach(([key,el])=> el.hidden = key!==name);
  currentScreen = name;
  topbarTitle.textContent = opts.title || titles[name];
  backBtn.hidden = !opts.showBack;
  if(name==='grades') renderGradeList();
  if(name==='roster'){ renderGradeScheduleRow(); renderRoster(); }
  if(name==='attendance-grades') renderGradeList('attendanceGradeList','attendance');
  if(name==='attendance') renderAttendance();
  if(name==='schedule') renderScheduleOverview();
  if(name==='schedule-detail') renderScheduleDetail();
  if(name==='wheel-grades') renderGradeList('wheelGradeList','wheel');
  if(name==='wheel') renderWheel();
}

document.querySelectorAll('.tab').forEach(tab=>{
  tab.addEventListener('click',()=>{
    const target = tab.dataset.screen;
    document.querySelectorAll('.tab').forEach(t=>t.classList.toggle('active',t===tab));
    activeGrade = null;
    screenHistory = [];
    showScreen(target,{showBack:false});
  });
});

backBtn.addEventListener('click',()=>{
  const prev = screenHistory.pop();
  if(prev) showScreen(prev.name, prev.opts);
  else {
    // fallback by screen type
    if(currentScreen==='roster') showScreen('grades',{showBack:false});
    else if(currentScreen==='attendance') showScreen('attendance-grades',{showBack:false});
    else if(currentScreen==='schedule-detail'){
      // came from roster or schedule tab
      if(activeGrade) showScreen('roster',{title:`Grade ${activeGrade}`,showBack:true});
      else showScreen('schedule',{showBack:false});
    }
    else if(currentScreen==='wheel') showScreen('wheel-grades',{showBack:false});
  }
});

function navigateTo(name, opts={}){
  screenHistory.push({name:currentScreen, opts:{title:topbarTitle.textContent, showBack:!backBtn.hidden}});
  showScreen(name, opts);
}

/* ============================================================
   GRADE LIST
   ============================================================ */
function renderGradeList(listId='gradeList', mode='roster'){
  const list = document.getElementById(listId);
  list.innerHTML='';
  GRADES.forEach(g=>{
    const count = studentsInGrade(g).length;
    const li = document.createElement('li');
    li.className='grade-card';
    li.innerHTML=`
      <span class="grade-num">Grade ${g}</span>
      <span class="grade-label">${count} student${count===1?'':'s'}</span>`;
    li.addEventListener('click',()=>{
      activeGrade=g;
      if(mode==='roster') navigateTo('roster',{title:`Grade ${g}`,showBack:true});
      if(mode==='attendance') navigateTo('attendance',{title:`Grade ${g} · Attendance`,showBack:true});
      if(mode==='wheel') navigateTo('wheel',{title:`Grade ${g} · Wheel`,showBack:true});
    });
    list.appendChild(li);
  });
}

/* ============================================================
   GRADE SCHEDULE ROW (chips shown above student list)
   ============================================================ */
function renderGradeScheduleRow(){
  const row = document.getElementById('gradeScheduleRow');
  row.innerHTML='';
  const scheds = state.schedules.filter(s=>s.grade===activeGrade);
  if(scheds.length===0){
    row.innerHTML='<li style="font-size:13px;color:var(--slate);padding:4px 0">No schedules yet</li>';
    return;
  }
  scheds.forEach(s=>{
    const li = document.createElement('li');
    const btn = document.createElement('button');
    btn.className='schedule-chip';
    btn.textContent=s.name;
    btn.addEventListener('click',()=>{
      activeScheduleId=s.id;
      navigateTo('schedule-detail',{title:s.name,showBack:true});
    });
    li.appendChild(btn);
    row.appendChild(li);
  });
}

document.getElementById('addScheduleForGradeBtn').addEventListener('click',()=>openScheduleModal());

/* ============================================================
   ROSTER (student list within a grade)
   ============================================================ */
const studentList = document.getElementById('studentList');
const rosterEmpty = document.getElementById('rosterEmpty');
const rosterSearch = document.getElementById('rosterSearch');

function renderRoster(){
  const q = rosterSearch.value.trim().toLowerCase();
  const list = studentsInGrade(activeGrade)
    .filter(s=>s.studentName.toLowerCase().includes(q)||(s.parentName||'').toLowerCase().includes(q))
    .sort((a,b)=>a.studentName.localeCompare(b.studentName));
  studentList.innerHTML='';
  rosterEmpty.hidden = studentsInGrade(activeGrade).length>0;
  list.forEach(s=>{
    const li = document.createElement('li');
    li.className='student-card';
    li.innerHTML=`
      <div class="student-avatar">${initials(s.studentName)}</div>
      <div class="student-info">
        <div class="student-name">${escapeHtml(s.studentName)}</div>
        <div class="student-meta">${escapeHtml(s.parentName?'PH: '+s.parentName:'Chưa có tên phụ huynh')}</div>
      </div>`;
    li.addEventListener('click',()=>openStudentModal(s.id));
    studentList.appendChild(li);
  });
}
rosterSearch.addEventListener('input',renderRoster);

/* ============================================================
   STUDENT MODAL
   ============================================================ */
const studentModal = document.getElementById('studentModal');
const studentModalTitle = document.getElementById('studentModalTitle');
const studentNameInput = document.getElementById('studentName');
const parentNameInput = document.getElementById('parentName');
const studentPhoneInput = document.getElementById('studentPhone');
const parentPhoneInput = document.getElementById('parentPhone');
const studentNotesInput = document.getElementById('studentNotes');
const studentGradeSelect = document.getElementById('studentGrade');
const deleteStudentBtn = document.getElementById('deleteStudentBtn');
let editingStudentId = null;

/* ---- preserve typed data so clicking outside doesn't lose it ---- */
let studentModalDraft = {};
function saveDraft(){
  studentModalDraft = {
    studentName: studentNameInput.value,
    parentName: parentNameInput.value,
    studentPhone: studentPhoneInput.value,
    parentPhone: parentPhoneInput.value,
    notes: studentNotesInput.value,
    grade: studentGradeSelect.value,
  };
}
function restoreDraft(){
  studentNameInput.value = studentModalDraft.studentName||'';
  parentNameInput.value = studentModalDraft.parentName||'';
  studentPhoneInput.value = studentModalDraft.studentPhone||'';
  parentPhoneInput.value = studentModalDraft.parentPhone||'';
  studentNotesInput.value = studentModalDraft.notes||'';
  if(studentModalDraft.grade) studentGradeSelect.value = studentModalDraft.grade;
}

function populateGradeSelect(){
  studentGradeSelect.innerHTML='';
  GRADES.forEach(g=>{
    const opt = document.createElement('option');
    opt.value=g; opt.textContent=`Grade ${g}`;
    studentGradeSelect.appendChild(opt);
  });
}

function renderStudentScheduleChecklist(studentId){
  const cl = document.getElementById('studentScheduleChecklist');
  cl.innerHTML='';
  const grade = parseInt(studentGradeSelect.value||activeGrade);
  const scheds = state.schedules.filter(s=>s.grade===grade);
  if(scheds.length===0){
    cl.innerHTML='<li style="font-size:13px;color:var(--slate);padding:6px 0">No schedules in this grade yet</li>';
    return;
  }
  scheds.forEach(s=>{
    const enrolled = s.studentIds && s.studentIds.includes(studentId);
    const discount = studentId && state.students.find(x=>x.id===studentId)?.scheduleDiscounts?.[s.id];
    const li = document.createElement('li');
    li.className = enrolled?'selected':'';
    li.dataset.scheduleId = s.id;
    li.innerHTML=`
      <span class="check-icon">${enrolled?'✓':'○'}</span>
      <span style="flex:1">${escapeHtml(s.name)}</span>
      ${discount?`<span class="discount-badge">${formatFee(discount)}</span>`:''}`;
    li.addEventListener('click',()=>{
      li.classList.toggle('selected');
      li.querySelector('.check-icon').textContent = li.classList.contains('selected')?'✓':'○';
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
    const s=state.students.find(x=>x.id===id);
    studentModalTitle.textContent='Edit Student';
    studentNameInput.value=s.studentName;
    parentNameInput.value=s.parentName||'';
    studentPhoneInput.value=s.studentPhone||'';
    parentPhoneInput.value=s.parentPhone||'';
    studentNotesInput.value=s.notes||'';
    studentGradeSelect.value=s.grade;
    deleteStudentBtn.hidden=false;
  }else{
    studentModalTitle.textContent=`Add Student — Grade ${activeGrade}`;
    studentNameInput.value=''; parentNameInput.value='';
    studentPhoneInput.value=''; parentPhoneInput.value=''; studentNotesInput.value='';
    studentGradeSelect.value=activeGrade;
    deleteStudentBtn.hidden=true;
  }
  renderStudentScheduleChecklist(id);
  studentModal.hidden=false;
  setTimeout(()=>studentNameInput.focus(),50);
}

function closeStudentModal(){ studentModal.hidden=true; editingStudentId=null; }

/* clicking OUTSIDE the modal box saves draft so data isn't lost */
studentModal.addEventListener('click',e=>{
  if(e.target===studentModal){ saveDraft(); closeStudentModal(); }
});

document.getElementById('addStudentBtn').addEventListener('click',()=>{
  if(studentModal.hidden===false){ /* already open, ignore */ return; }
  // restore draft if any
  openStudentModal();
  if(studentModalDraft.studentName!==undefined) restoreDraft();
});
document.getElementById('cancelStudentBtn').addEventListener('click',()=>{ studentModalDraft={}; closeStudentModal(); });
document.getElementById('closeStudentModalBtn').addEventListener('click',()=>{ saveDraft(); closeStudentModal(); });

document.getElementById('saveStudentBtn').addEventListener('click',()=>{
  const fields={
    studentName: studentNameInput.value.trim()||'(No name)',
    parentName: parentNameInput.value.trim(),
    studentPhone: studentPhoneInput.value.trim(),
    parentPhone: parentPhoneInput.value.trim(),
    notes: studentNotesInput.value.trim(),
    grade: parseInt(studentGradeSelect.value),
  };
  // handle schedule enrollment changes
  const checklist = document.querySelectorAll('#studentScheduleChecklist li[data-schedule-id]');
  checklist.forEach(li=>{
    const sid = li.dataset.scheduleId;
    const sched = state.schedules.find(x=>x.id===sid);
    if(!sched) return;
    if(!sched.studentIds) sched.studentIds=[];
    const enrolled = li.classList.contains('selected');
    const already = sched.studentIds.includes(editingStudentId||'__new__');
    if(enrolled && editingStudentId && !sched.studentIds.includes(editingStudentId)){
      sched.studentIds.push(editingStudentId);
    } else if(!enrolled && editingStudentId){
      sched.studentIds = sched.studentIds.filter(x=>x!==editingStudentId);
    }
  });
  if(editingStudentId){
    const s=state.students.find(x=>x.id===editingStudentId);
    Object.assign(s,fields);
  }else{
    const newId=uid();
    state.students.push({id:newId, scheduleDiscounts:{}, ...fields});
    // enroll new student in selected schedules
    checklist.forEach(li=>{
      if(li.classList.contains('selected')){
        const sched=state.schedules.find(x=>x.id===li.dataset.scheduleId);
        if(sched){ if(!sched.studentIds) sched.studentIds=[]; sched.studentIds.push(newId); }
      }
    });
  }
  studentModalDraft={};
  saveData(); renderRoster(); renderGradeScheduleRow(); closeStudentModal();
});

deleteStudentBtn.addEventListener('click',()=>{
  if(!editingStudentId) return;
  if(confirm('Delete this student?')){
    state.students=state.students.filter(x=>x.id!==editingStudentId);
    state.schedules.forEach(s=>{ s.studentIds=(s.studentIds||[]).filter(x=>x!==editingStudentId); });
    saveData(); renderRoster(); closeStudentModal();
  }
});

/* ============================================================
   ALL MODALS: shared guard
   ============================================================ */
let editingStudentId_guard_already_declared = true; // just a marker
let editingScheduleId = null;
let editingTimeBlockIdx = null;
let feeModalContext = null; // {type:'schedule'} or {type:'student', studentId, scheduleId}

function closeAllModals(){
  document.querySelectorAll('.modal-backdrop').forEach(el=>el.hidden=true);
  editingScheduleId=null;
}

/* ============================================================
   SCHEDULE MODAL (add/edit a schedule for a grade)
   ============================================================ */
const scheduleModal = document.getElementById('scheduleModal');

function openScheduleModal(id=null){
  closeAllModals();
  editingScheduleId=id;
  document.getElementById('scheduleModalTitle').textContent = id?'Edit Schedule':'Add Schedule';
  if(id){
    const s=state.schedules.find(x=>x.id===id);
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
  if(editingScheduleId){
    const s=state.schedules.find(x=>x.id===editingScheduleId);
    s.name=name; s.teacherName=teacherName; s.baseFee=baseFee;
  }else{
    state.schedules.push({id:uid(), grade:activeGrade, name, teacherName, baseFee, timeBlocks:[], studentIds:[]});
  }
  saveData(); renderGradeScheduleRow(); renderScheduleOverview(); closeScheduleModal();
});

/* ============================================================
   SCHEDULE DETAIL
   ============================================================ */
function renderScheduleDetail(){
  const s=state.schedules.find(x=>x.id===activeScheduleId);
  if(!s) return;
  document.getElementById('detailTeacher').textContent=s.teacherName||'—';
  document.getElementById('detailFeeBtn').textContent=s.baseFee?formatFee(s.baseFee):'Tap to set';
  // time blocks
  const tbList=document.getElementById('detailTimeBlocks');
  tbList.innerHTML='';
  (s.timeBlocks||[]).forEach((tb,i)=>{
    const li=document.createElement('li');
    li.className='time-block-item';
    li.innerHTML=`${DAY_NAMES[tb.day]} ${formatTime(tb.start)}–${formatTime(tb.end)}
      <button class="time-block-del" data-idx="${i}" aria-label="Remove">✕</button>`;
    tbList.appendChild(li);
  });
  tbList.querySelectorAll('.time-block-del').forEach(btn=>{
    btn.addEventListener('click',()=>{
      s.timeBlocks.splice(parseInt(btn.dataset.idx),1);
      saveData(); renderScheduleDetail();
    });
  });
  // students
  const sl=document.getElementById('detailStudentList');
  sl.innerHTML='';
  document.getElementById('detailStudentEmpty').hidden=(s.studentIds||[]).length>0;
  (s.studentIds||[]).forEach(sid=>{
    const st=state.students.find(x=>x.id===sid);
    if(!st) return;
    const li=document.createElement('li');
    li.className='student-card';
    const discount=st.scheduleDiscounts?.[s.id];
    li.innerHTML=`
      <div class="student-avatar">${initials(st.studentName)}</div>
      <div class="student-info">
        <div class="student-name">${escapeHtml(st.studentName)}
          ${discount?`<span class="discount-badge">${formatFee(discount)}</span>`:''}
        </div>
        <div class="student-meta">${escapeHtml(st.parentName?'PH: '+st.parentName:'')}</div>
      </div>
      <button class="chip" style="font-size:11px;padding:5px 10px" data-sid="${sid}">
        ${discount?'Edit fee':'Discount'}
      </button>`;
    li.querySelector('[data-sid]').addEventListener('click',e=>{
      e.stopPropagation();
      openFeeModal('student', sid, s.id);
    });
    li.addEventListener('click',()=>openStudentModal(sid));
    sl.appendChild(li);
  });
}

document.getElementById('detailFeeBtn').addEventListener('click',()=>openFeeModal('schedule'));
document.getElementById('addTimeBlockBtn').addEventListener('click',()=>openTimeBlockModal());
document.getElementById('addStudentToScheduleBtn').addEventListener('click',()=>openAddToScheduleModal());
document.getElementById('deleteScheduleDetailBtn').addEventListener('click',()=>{
  if(confirm('Delete this schedule?')){
    state.schedules=state.schedules.filter(x=>x.id!==activeScheduleId);
    saveData();
    const prev=screenHistory.pop();
    if(prev) showScreen(prev.name,prev.opts);
    else showScreen('grades',{showBack:false});
  }
});

/* ============================================================
   SCHEDULE OVERVIEW (Schedule tab)
   ============================================================ */
function renderScheduleOverview(){
  const list=document.getElementById('scheduleList');
  const empty=document.getElementById('scheduleEmpty');
  list.innerHTML='';
  empty.hidden=state.schedules.length>0;
  state.schedules.forEach(s=>{
    const div=document.createElement('div');
    div.className='schedule-card-full';
    const times=(s.timeBlocks||[]).map(tb=>`${DAY_NAMES[tb.day]} ${formatTime(tb.start)}`).join(', ')||'No times set';
    div.innerHTML=`
      <div class="sc-name">${escapeHtml(s.name)} <span style="font-size:12px;color:var(--slate)">· Grade ${s.grade}</span></div>
      <div class="sc-meta">${escapeHtml(s.teacherName||'No teacher')} · ${times}</div>
      <div class="sc-meta">${(s.studentIds||[]).length} students · ${s.baseFee?formatFee(s.baseFee):'No fee set'}</div>`;
    div.addEventListener('click',()=>{
      activeScheduleId=s.id;
      activeGrade=s.grade;
      navigateTo('schedule-detail',{title:s.name,showBack:true});
    });
    list.appendChild(div);
  });
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
function closeTimeBlockModal(){ timeBlockModal.hidden=true; }
timeBlockModal.addEventListener('click',e=>{ if(e.target===timeBlockModal) closeTimeBlockModal(); });
document.getElementById('cancelTimeBlockBtn').addEventListener('click',closeTimeBlockModal);
document.getElementById('closeTimeBlockModalBtn').addEventListener('click',closeTimeBlockModal);
document.getElementById('saveTimeBlockBtn').addEventListener('click',()=>{
  const s=state.schedules.find(x=>x.id===activeScheduleId);
  if(!s) return;
  if(!s.timeBlocks) s.timeBlocks=[];
  s.timeBlocks.push({
    day:parseInt(document.getElementById('timeBlockDay').value),
    start:document.getElementById('timeBlockStart').value,
    end:document.getElementById('timeBlockEnd').value,
  });
  saveData(); renderScheduleDetail(); closeTimeBlockModal();
});

/* ============================================================
   FEE MODAL
   ============================================================ */
const feeModal=document.getElementById('feeModal');
function openFeeModal(type, studentId=null, scheduleId=null){
  closeAllModals();
  feeModalContext={type, studentId, scheduleId: scheduleId||activeScheduleId};
  const s=state.schedules.find(x=>x.id===feeModalContext.scheduleId);
  if(type==='schedule'){
    document.getElementById('feeModalTitle').textContent='Edit Base Fee';
    document.getElementById('feeModalBaseLabel').textContent='Học phí / tháng (base fee for all students)';
    document.getElementById('feeModalInput').value=s?.baseFee||'';
    document.getElementById('feeModalNote').textContent='This applies to all students unless individually discounted.';
  }else{
    const st=state.students.find(x=>x.id===studentId);
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
    const s=state.schedules.find(x=>x.id===feeModalContext.scheduleId);
    if(s) s.baseFee=val;
  }else{
    const st=state.students.find(x=>x.id===feeModalContext.studentId);
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
  renderAddToScheduleList('');
  document.getElementById('addToScheduleSearch').value='';
  addToScheduleModal.hidden=false;
}
function renderAddToScheduleList(q){
  const s=state.schedules.find(x=>x.id===activeScheduleId);
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
  const s=state.schedules.find(x=>x.id===activeScheduleId);
  if(!s) return;
  s.studentIds=[];
  document.querySelectorAll('#addToScheduleList li.selected').forEach(li=>s.studentIds.push(li.dataset.sid));
  saveData(); renderScheduleDetail(); closeAddToScheduleModal();
});

/* ============================================================
   ATTENDANCE
   ============================================================ */
const attendanceDate=document.getElementById('attendanceDate');
const attendanceList=document.getElementById('attendanceList');
const attendanceEmpty=document.getElementById('attendanceEmpty');
function todayStr(){
  const d=new Date(); const off=d.getTimezoneOffset();
  return new Date(d.getTime()-off*60000).toISOString().slice(0,10);
}
attendanceDate.value=todayStr();
function renderAttendance(){
  const date=attendanceDate.value;
  const key=`${date}|${activeGrade}`;
  if(!state.attendance[key]) state.attendance[key]={};
  const dayRecord=state.attendance[key];
  const students=studentsInGrade(activeGrade).sort((a,b)=>a.studentName.localeCompare(b.studentName));
  attendanceEmpty.hidden=students.length>0;
  attendanceList.innerHTML='';
  students.forEach(s=>{
    const status=dayRecord[s.id]||null;
    const li=document.createElement('li');
    li.className='attendance-row';
    li.innerHTML=`
      <span class="student-name">${escapeHtml(s.studentName)}</span>
      <button class="status-btn present-btn ${status==='present'?'present':''}" aria-label="Present">✓</button>
      <button class="status-btn absent-btn ${status==='absent'?'absent':''}" aria-label="Absent">✕</button>`;
    li.querySelector('.present-btn').addEventListener('click',()=>setAttendance(key,s.id,'present'));
    li.querySelector('.absent-btn').addEventListener('click',()=>setAttendance(key,s.id,'absent'));
    attendanceList.appendChild(li);
  });
}
function setAttendance(key,studentId,status){
  const rec=state.attendance[key];
  if(rec[studentId]===status) delete rec[studentId];
  else rec[studentId]=status;
  saveData(); renderAttendance();
}
document.getElementById('markAllPresent').addEventListener('click',()=>{
  const key=`${attendanceDate.value}|${activeGrade}`;
  if(!state.attendance[key]) state.attendance[key]={};
  studentsInGrade(activeGrade).forEach(s=>state.attendance[key][s.id]='present');
  saveData(); renderAttendance();
});
document.getElementById('markAllAbsent').addEventListener('click',()=>{
  const key=`${attendanceDate.value}|${activeGrade}`;
  if(!state.attendance[key]) state.attendance[key]={};
  studentsInGrade(activeGrade).forEach(s=>state.attendance[key][s.id]='absent');
  saveData(); renderAttendance();
});
attendanceDate.addEventListener('change',renderAttendance);

/* ============================================================
   NAME WHEEL
   ============================================================ */
const wheelCanvas=document.getElementById('wheelCanvas');
const ctx=wheelCanvas.getContext('2d');
const wheelResult=document.getElementById('wheelResult');
const wheelEmpty=document.getElementById('wheelEmpty');
const removeOnPick=document.getElementById('removeOnPick');
const spinBtn=document.getElementById('spinBtn');
const WHEEL_COLORS=['#2F4538','#3D5A48','#E8B84B','#C45B4D','#5C6B66','#7A8F82'];
let currentRotation=0;
let spinning=false;
function getWheelStudents(){
  const removed=state.wheelRemoved[activeGrade]||[];
  return studentsInGrade(activeGrade).filter(s=>!removed.includes(s.id));
}
function renderWheel(){ currentRotation=0; wheelResult.textContent=''; drawWheel(); }
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
    const start=i*slice, end=start+slice;
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
  const targetSliceMiddle=winnerIndex*slice+slice/2;
  const extraSpins=5+Math.random()*2;
  const finalRotation=currentRotation+(extraSpins*2*Math.PI)+(-Math.PI/2-targetSliceMiddle-currentRotation%(2*Math.PI));
  const duration=4200, startRotation=currentRotation, delta=finalRotation-startRotation, startTime=performance.now();
  function animate(now){
    const elapsed=now-startTime, t=Math.min(elapsed/duration,1), eased=1-Math.pow(1-t,4);
    currentRotation=startRotation+delta*eased; drawWheel();
    if(t<1){ requestAnimationFrame(animate); }
    else{
      spinning=false;
      const winner=students[winnerIndex];
      wheelResult.textContent=winner.studentName;
      if(removeOnPick.checked){
        if(!state.wheelRemoved[activeGrade]) state.wheelRemoved[activeGrade]=[];
        state.wheelRemoved[activeGrade].push(winner.id);
        saveData(); setTimeout(drawWheel,600);
      }
      if(navigator.vibrate) navigator.vibrate(40);
    }
  }
  requestAnimationFrame(animate);
});
document.getElementById('resetWheelBtn').addEventListener('click',()=>{
  state.wheelRemoved[activeGrade]=[];
  saveData(); wheelResult.textContent=''; drawWheel();
});

/* ============================================================
   INIT
   ============================================================ */
showScreen('grades',{showBack:false});

if('serviceWorker' in navigator){
  window.addEventListener('load',()=>{
    navigator.serviceWorker.register('sw.js').catch(err=>console.log('SW failed:',err));
  });
}
