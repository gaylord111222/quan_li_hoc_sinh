/* ============================================================
   CLASSROOM COMPANION — app.js
   All data is stored on THIS device only, using localStorage.
   No internet, no account, no server. Works fully offline.
   ============================================================ */

const STORAGE_KEY = 'classroomCompanion.v2';
const GRADES = [1,2,3,4,5,6,7,8,9];

/* ---------- Default / fake starter data ----------
   Two sample students placed in Grade 1 so you can see how it
   looks. Rename or delete them anytime from inside Grade 1. */
function defaultData(){
  return {
    students: [
      { id: uid(), grade: 1, studentName: 'Student A', parentName: '', studentPhone: '', parentPhone: '', notes: '' },
      { id: uid(), grade: 1, studentName: 'Student B', parentName: '', studentPhone: '', parentPhone: '', notes: '' },
    ],
    schedule: [],
    attendance: {}, // { "YYYY-MM-DD|grade": { studentId: "present"|"absent" } }
    wheelRemoved: {} // { grade: [studentId,...] }
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
    return JSON.parse(raw);
  }catch(e){
    console.error('Could not read saved data, starting fresh.', e);
    return defaultData();
  }
}
function saveData(){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

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

/* ============================================================
   NAVIGATION
   A simple back-stack so the back button always knows where to go.
   ============================================================ */
const screens = {
  'grades': document.getElementById('screen-grades'),
  'roster': document.getElementById('screen-roster'),
  'attendance-grades': document.getElementById('screen-attendance-grades'),
  'attendance': document.getElementById('screen-attendance'),
  'schedule': document.getElementById('screen-schedule'),
  'wheel-grades': document.getElementById('screen-wheel-grades'),
  'wheel': document.getElementById('screen-wheel'),
};
const titles = {
  'grades':'Roster', 'roster':'Grade', 'attendance-grades':'Attendance',
  'attendance':'Attendance', 'schedule':'Schedule', 'wheel-grades':'Name Wheel', 'wheel':'Name Wheel'
};
const topbarTitle = document.getElementById('topbarTitle');
const backBtn = document.getElementById('backBtn');

let activeGrade = null; // currently selected grade across roster/attendance/wheel
let currentScreen = 'grades';
let screenStack = []; // for back navigation within a tab

function showScreen(name, opts={}){
  Object.entries(screens).forEach(([key, el])=> el.hidden = key!==name);
  currentScreen = name;
  topbarTitle.textContent = opts.title || titles[name];
  backBtn.hidden = !opts.showBack;

  if(name==='grades') renderGradeList();
  if(name==='roster') renderRoster();
  if(name==='attendance-grades') renderGradeList('attendanceGradeList', 'attendance');
  if(name==='attendance') renderAttendance();
  if(name==='schedule') renderSchedule();
  if(name==='wheel-grades') renderGradeList('wheelGradeList', 'wheel');
  if(name==='wheel') renderWheel();
}

document.querySelectorAll('.tab').forEach(tab=>{
  tab.addEventListener('click', ()=>{
    const target = tab.dataset.screen;
    document.querySelectorAll('.tab').forEach(t=>t.classList.toggle('active', t===tab));
    activeGrade = null;
    showScreen(target, {showBack:false});
  });
});

backBtn.addEventListener('click', ()=>{
  if(currentScreen==='roster') showScreen('grades', {showBack:false});
  else if(currentScreen==='attendance') showScreen('attendance-grades', {showBack:false});
  else if(currentScreen==='wheel') showScreen('wheel-grades', {showBack:false});
});

/* ============================================================
   GRADE LIST (shared by Roster / Attendance / Wheel tabs)
   ============================================================ */
function renderGradeList(listId='gradeList', mode='roster'){
  const list = document.getElementById(listId);
  list.innerHTML = '';
  GRADES.forEach(g=>{
    const count = studentsInGrade(g).length;
    const li = document.createElement('li');
    li.className = 'grade-card';
    li.innerHTML = `
      <span class="grade-num">Grade ${g}</span>
      <span class="grade-label">${count} student${count===1?'':'s'}</span>
    `;
    li.addEventListener('click', ()=>{
      activeGrade = g;
      if(mode==='roster') showScreen('roster', {title:`Grade ${g}`, showBack:true});
      if(mode==='attendance') showScreen('attendance', {title:`Grade ${g} · Attendance`, showBack:true});
      if(mode==='wheel') showScreen('wheel', {title:`Grade ${g} · Wheel`, showBack:true});
    });
    list.appendChild(li);
  });
}

/* ============================================================
   ROSTER (students within a grade)
   ============================================================ */
const studentList = document.getElementById('studentList');
const rosterEmpty = document.getElementById('rosterEmpty');
const rosterSearch = document.getElementById('rosterSearch');

function renderRoster(){
  const q = rosterSearch.value.trim().toLowerCase();
  const list = studentsInGrade(activeGrade)
    .filter(s => s.studentName.toLowerCase().includes(q) || (s.parentName||'').toLowerCase().includes(q))
    .sort((a,b)=> a.studentName.localeCompare(b.studentName));

  studentList.innerHTML = '';
  rosterEmpty.hidden = studentsInGrade(activeGrade).length>0;

  list.forEach(s=>{
    const li = document.createElement('li');
    li.className = 'student-card';
    li.innerHTML = `
      <div class="student-avatar">${initials(s.studentName)}</div>
      <div class="student-info">
        <div class="student-name">${escapeHtml(s.studentName)}</div>
        <div class="student-meta">${escapeHtml(s.parentName ? 'PH: '+s.parentName : 'Chưa có tên phụ huynh')}</div>
      </div>`;
    li.addEventListener('click', ()=> openStudentModal(s.id));
    studentList.appendChild(li);
  });
}
rosterSearch.addEventListener('input', renderRoster);

/* ---------- Student modal (add/edit/delete) ---------- */
const studentModal = document.getElementById('studentModal');
const studentModalTitle = document.getElementById('studentModalTitle');
const studentNameInput = document.getElementById('studentName');
const parentNameInput = document.getElementById('parentName');
const studentPhoneInput = document.getElementById('studentPhone');
const parentPhoneInput = document.getElementById('parentPhone');
const studentNotesInput = document.getElementById('studentNotes');
const deleteStudentBtn = document.getElementById('deleteStudentBtn');
let editingStudentId = null;

function openStudentModal(id=null){
  editingStudentId = id;
  if(id){
    const s = state.students.find(x=>x.id===id);
    studentModalTitle.textContent = 'Edit Student';
    studentNameInput.value = s.studentName;
    parentNameInput.value = s.parentName||'';
    studentPhoneInput.value = s.studentPhone||'';
    parentPhoneInput.value = s.parentPhone||'';
    studentNotesInput.value = s.notes||'';
    deleteStudentBtn.hidden = false;
  }else{
    studentModalTitle.textContent = `Add Student — Grade ${activeGrade}`;
    studentNameInput.value=''; parentNameInput.value=''; studentPhoneInput.value='';
    parentPhoneInput.value=''; studentNotesInput.value='';
    deleteStudentBtn.hidden = true;
  }
  studentModal.hidden = false;
  setTimeout(()=>studentNameInput.focus(), 50);
}
function closeStudentModal(){ studentModal.hidden = true; editingStudentId=null; }

document.getElementById('addStudentBtn').addEventListener('click', ()=>openStudentModal());
document.getElementById('cancelStudentBtn').addEventListener('click', closeStudentModal);
studentModal.addEventListener('click', e=>{ if(e.target===studentModal) closeStudentModal(); });

document.getElementById('saveStudentBtn').addEventListener('click', ()=>{
  const studentName = studentNameInput.value.trim();
  if(!studentName){ studentNameInput.focus(); return; }
  const fields = {
    studentName,
    parentName: parentNameInput.value.trim(),
    studentPhone: studentPhoneInput.value.trim(),
    parentPhone: parentPhoneInput.value.trim(),
    notes: studentNotesInput.value.trim(),
  };
  if(editingStudentId){
    const s = state.students.find(x=>x.id===editingStudentId);
    Object.assign(s, fields);
  }else{
    state.students.push({ id:uid(), grade:activeGrade, ...fields });
  }
  saveData();
  renderRoster();
  closeStudentModal();
});

deleteStudentBtn.addEventListener('click', ()=>{
  if(!editingStudentId) return;
  if(confirm('Delete this student? This also removes their attendance history.')){
    state.students = state.students.filter(x=>x.id!==editingStudentId);
    saveData();
    renderRoster();
    closeStudentModal();
  }
});

/* ============================================================
   ATTENDANCE (within a grade)
   ============================================================ */
const attendanceDate = document.getElementById('attendanceDate');
const attendanceList = document.getElementById('attendanceList');
const attendanceEmpty = document.getElementById('attendanceEmpty');

function todayStr(){
  const d = new Date();
  const off = d.getTimezoneOffset();
  return new Date(d.getTime()-off*60000).toISOString().slice(0,10);
}
attendanceDate.value = todayStr();

function renderAttendance(){
  const date = attendanceDate.value;
  const key = `${date}|${activeGrade}`;
  if(!state.attendance[key]) state.attendance[key] = {};
  const dayRecord = state.attendance[key];

  const students = studentsInGrade(activeGrade).sort((a,b)=>a.studentName.localeCompare(b.studentName));
  attendanceEmpty.hidden = students.length>0;
  attendanceList.innerHTML='';

  students.forEach(s=>{
    const status = dayRecord[s.id] || null;
    const li = document.createElement('li');
    li.className='attendance-row';
    li.innerHTML = `
      <span class="student-name">${escapeHtml(s.studentName)}</span>
      <button class="status-btn present-btn ${status==='present'?'present':''}" aria-label="Mark present">✓</button>
      <button class="status-btn absent-btn ${status==='absent'?'absent':''}" aria-label="Mark absent">✕</button>
    `;
    li.querySelector('.present-btn').addEventListener('click', ()=> setAttendance(key, s.id, 'present'));
    li.querySelector('.absent-btn').addEventListener('click', ()=> setAttendance(key, s.id, 'absent'));
    attendanceList.appendChild(li);
  });
}

function setAttendance(key, studentId, status){
  const rec = state.attendance[key];
  const cleared = rec[studentId]===status;
  if(cleared) delete rec[studentId];
  else rec[studentId] = status;
  saveData();
  renderAttendance();
}

document.getElementById('markAllPresent').addEventListener('click', ()=>{
  const key = `${attendanceDate.value}|${activeGrade}`;
  if(!state.attendance[key]) state.attendance[key]={};
  studentsInGrade(activeGrade).forEach(s=> state.attendance[key][s.id]='present');
  saveData(); renderAttendance();
});
document.getElementById('markAllAbsent').addEventListener('click', ()=>{
  const key = `${attendanceDate.value}|${activeGrade}`;
  if(!state.attendance[key]) state.attendance[key]={};
  studentsInGrade(activeGrade).forEach(s=> state.attendance[key][s.id]='absent');
  saveData(); renderAttendance();
});
attendanceDate.addEventListener('change', renderAttendance);

/* ============================================================
   SCHEDULE SCREEN (unchanged — independent of grade structure)
   ============================================================ */
const scheduleDay = document.getElementById('scheduleDay');
const scheduleList = document.getElementById('scheduleList');
const scheduleEmpty = document.getElementById('scheduleEmpty');
scheduleDay.value = new Date().getDay();

function renderSchedule(){
  const day = parseInt(scheduleDay.value,10);
  const items = state.schedule
    .filter(i=>i.day===day)
    .sort((a,b)=> (a.start||'').localeCompare(b.start||''));

  scheduleEmpty.hidden = items.length>0;
  scheduleList.innerHTML='';
  items.forEach(i=>{
    const li = document.createElement('li');
    li.className='schedule-card';
    li.innerHTML = `
      <div class="schedule-time">${formatTime(i.start)} – ${formatTime(i.end)}</div>
      <div class="schedule-subject">${escapeHtml(i.subject)}</div>
      ${i.room? `<div class="schedule-room">${escapeHtml(i.room)}</div>`:''}
    `;
    li.addEventListener('click', ()=> openScheduleModal(i.id));
    scheduleList.appendChild(li);
  });
}
function formatTime(t){
  if(!t) return '--:--';
  const [h,m] = t.split(':').map(Number);
  const period = h>=12?'PM':'AM';
  const h12 = ((h+11)%12)+1;
  return `${h12}:${String(m).padStart(2,'0')} ${period}`;
}
scheduleDay.addEventListener('change', renderSchedule);

const scheduleModal = document.getElementById('scheduleModal');
const scheduleSubject = document.getElementById('scheduleSubject');
const scheduleStart = document.getElementById('scheduleStart');
const scheduleEnd = document.getElementById('scheduleEnd');
const scheduleRoom = document.getElementById('scheduleRoom');
const deleteScheduleBtn = document.getElementById('deleteScheduleBtn');
let editingScheduleId = null;

function openScheduleModal(id=null){
  editingScheduleId = id;
  if(id){
    const i = state.schedule.find(x=>x.id===id);
    scheduleSubject.value=i.subject; scheduleStart.value=i.start||''; scheduleEnd.value=i.end||''; scheduleRoom.value=i.room||'';
    deleteScheduleBtn.hidden=false;
  }else{
    scheduleSubject.value=''; scheduleStart.value=''; scheduleEnd.value=''; scheduleRoom.value='';
    deleteScheduleBtn.hidden=true;
  }
  scheduleModal.hidden=false;
  setTimeout(()=>scheduleSubject.focus(),50);
}
function closeScheduleModal(){ scheduleModal.hidden=true; editingScheduleId=null; }

document.getElementById('addScheduleBtn').addEventListener('click', ()=>openScheduleModal());
document.getElementById('cancelScheduleBtn').addEventListener('click', closeScheduleModal);
scheduleModal.addEventListener('click', e=>{ if(e.target===scheduleModal) closeScheduleModal(); });

document.getElementById('saveScheduleBtn').addEventListener('click', ()=>{
  const subject = scheduleSubject.value.trim();
  if(!subject){ scheduleSubject.focus(); return; }
  const day = parseInt(scheduleDay.value,10);
  if(editingScheduleId){
    const i = state.schedule.find(x=>x.id===editingScheduleId);
    i.subject=subject; i.start=scheduleStart.value; i.end=scheduleEnd.value; i.room=scheduleRoom.value.trim(); i.day=day;
  }else{
    state.schedule.push({ id:uid(), day, subject, start:scheduleStart.value, end:scheduleEnd.value, room:scheduleRoom.value.trim() });
  }
  saveData();
  renderSchedule();
  closeScheduleModal();
});
deleteScheduleBtn.addEventListener('click', ()=>{
  if(!editingScheduleId) return;
  state.schedule = state.schedule.filter(x=>x.id!==editingScheduleId);
  saveData(); renderSchedule(); closeScheduleModal();
});

/* ============================================================
   NAME WHEEL (within a grade)
   ============================================================ */
const wheelCanvas = document.getElementById('wheelCanvas');
const ctx = wheelCanvas.getContext('2d');
const wheelResult = document.getElementById('wheelResult');
const wheelEmpty = document.getElementById('wheelEmpty');
const removeOnPick = document.getElementById('removeOnPick');
const spinBtn = document.getElementById('spinBtn');

const WHEEL_COLORS = ['#2F4538','#3D5A48','#E8B84B','#C45B4D','#5C6B66','#7A8F82'];
let currentRotation = 0;
let spinning = false;

function getWheelStudents(){
  const removed = state.wheelRemoved[activeGrade] || [];
  return studentsInGrade(activeGrade).filter(s=> !removed.includes(s.id));
}

function renderWheel(){
  currentRotation = 0;
  wheelResult.textContent = '';
  drawWheel();
}

function drawWheel(){
  const students = getWheelStudents();
  const size = wheelCanvas.width;
  const cx = size/2, cy = size/2, r = size/2 - 4;
  ctx.clearRect(0,0,size,size);

  wheelEmpty.hidden = students.length>0;
  spinBtn.style.visibility = students.length>0 ? 'visible':'hidden';

  if(students.length===0) return;

  const slice = (2*Math.PI)/students.length;
  ctx.save();
  ctx.translate(cx,cy);
  ctx.rotate(currentRotation);

  students.forEach((s,i)=>{
    const start = i*slice;
    const end = start+slice;
    ctx.beginPath();
    ctx.moveTo(0,0);
    ctx.arc(0,0,r,start,end);
    ctx.closePath();
    ctx.fillStyle = WHEEL_COLORS[i % WHEEL_COLORS.length];
    ctx.fill();

    ctx.save();
    ctx.rotate(start+slice/2);
    ctx.textAlign='right';
    ctx.fillStyle='#F7F4EC';
    ctx.font = students.length>14 ? '600 10px sans-serif' : '700 13px sans-serif';
    const label = s.studentName.length>16? s.studentName.slice(0,15)+'…' : s.studentName;
    ctx.fillText(label, r-12, 4);
    ctx.restore();
  });

  ctx.restore();
}

spinBtn.addEventListener('click', ()=>{
  if(spinning) return;
  const students = getWheelStudents();
  if(students.length===0) return;
  spinning = true;
  wheelResult.textContent='';

  const slice = (2*Math.PI)/students.length;
  const winnerIndex = Math.floor(Math.random()*students.length);
  const targetSliceMiddle = winnerIndex*slice + slice/2;
  const extraSpins = 5 + Math.random()*2;
  const finalRotation = currentRotation
    + (extraSpins*2*Math.PI)
    + ( -Math.PI/2 - targetSliceMiddle - currentRotation % (2*Math.PI) );

  const duration = 4200;
  const startRotation = currentRotation;
  const delta = finalRotation - startRotation;
  const startTime = performance.now();

  function animate(now){
    const elapsed = now - startTime;
    const t = Math.min(elapsed/duration, 1);
    const eased = 1 - Math.pow(1-t, 4);
    currentRotation = startRotation + delta*eased;
    drawWheel();
    if(t<1){
      requestAnimationFrame(animate);
    }else{
      spinning = false;
      const winner = students[winnerIndex];
      wheelResult.textContent = winner.studentName;
      if(removeOnPick.checked){
        if(!state.wheelRemoved[activeGrade]) state.wheelRemoved[activeGrade]=[];
        state.wheelRemoved[activeGrade].push(winner.id);
        saveData();
        setTimeout(drawWheel, 600);
      }
      if(navigator.vibrate) navigator.vibrate(40);
    }
  }
  requestAnimationFrame(animate);
});

document.getElementById('resetWheelBtn').addEventListener('click', ()=>{
  state.wheelRemoved[activeGrade] = [];
  saveData();
  wheelResult.textContent='';
  drawWheel();
});

/* ============================================================
   INIT
   ============================================================ */
showScreen('grades', {showBack:false});

/* Register service worker for offline support (PWA) */
if('serviceWorker' in navigator){
  window.addEventListener('load', ()=>{
    navigator.serviceWorker.register('sw.js').catch(err=>console.log('SW registration failed:', err));
  });
}
