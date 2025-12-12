// script.js — AbsherAi Smart Simulation (Mode C, Mixed Layout)
// Author: modified for TTS for elderly, single read per option

// ---------- DOM ----------
const chat = document.getElementById('chat');
const input = document.getElementById('input');
const sendBtn = document.getElementById('send');
const micBtn = document.getElementById('mic');
const tplActions = document.getElementById('tpl-actions');

// ---------- helpers ----------
function addMsg(text, who='bot'){
  const d = document.createElement('div');
  d.className = 'msg ' + (who==='user'? 'user':'bot');
  d.textContent = text;
  chat.appendChild(d);
  chat.scrollTop = chat.scrollHeight;
  return d;
}
function addHTML(node){
  chat.appendChild(node);
  chat.scrollTop = chat.scrollHeight;
  return node;
}

// ---------- TTS (speakOnce) ----------
let isSpeaking = false;
function speakOnce(text, opts = {}) {
  if(isSpeaking) return;
  if(!('speechSynthesis' in window)) return;
  const ut = new SpeechSynthesisUtterance(text);
  ut.lang = 'ar-SA';
  ut.rate = opts.rate || 1;
  ut.pitch = opts.pitch || 1;
  const voices = speechSynthesis.getVoices();
  if(voices && voices.length){
    const prefer = voices.find(v=> /sa|arab|arabic|synth|google/i.test(v.name));
    if(prefer) ut.voice = prefer;
  }
  isSpeaking = true;
  ut.onend = ()=> { isSpeaking = false; };
  speechSynthesis.cancel();
  speechSynthesis.speak(ut);
}

// ---------- Speech Recognition ----------
let recognition = null;
if('webkitSpeechRecognition' in window || 'SpeechRecognition' in window){
  const R = window.SpeechRecognition || window.webkitSpeechRecognition;
  recognition = new R();
  recognition.lang = 'ar-SA';
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;
  recognition.onstart = ()=> addMsg('🎤 أبدأ التحدث...', 'bot');
  recognition.onresult = (e)=> {
    const txt = e.results[0][0].transcript;
    input.value = txt;
    handleUser(txt);
  };
  recognition.onerror = ()=> addMsg('تعذر الاستماع، تأكد من إذن الميكروفون.', 'bot');
} else {
  micBtn.style.opacity = 0.45;
  micBtn.title = 'الميكروفون غير مدعوم في هذا المتصفح';
}

// ---------- language helpers ----------
const yesWords = ["اي","ايه","ايوه","أيوه","نعم","تم","اوكي","طيب","تمام","يب","يلا","كملي","اكمل"];
const noWords = ["لا","الغاء","إلغاء","وقف","مو لازم","ماابغى","ما ابي"];
function includesAny(text, arr){
  const t = text.replace(/أ/g,'ا').toLowerCase();
  return arr.some(w => t.includes(w));
}
function isYes(text){ return includesAny(text, yesWords); }
function isNo(text){ return includesAny(text, noWords); }

// ---------- Services engine ----------
const serviceFlows = {
  'تجديد الهوية': {
    section:'ahwal',
    name:'تجديد بطاقة الهوية الوطنية',
    steps: [
      { say: 'أشيّك على صلاحية الهوية...' },
      { say: 'أشيّك على الصورة الشخصية...' },
      { say: 'أشيّك على العنوان الوطني...' },
      { ask: 'هل تريد تجديد الهوية الآن؟' },
      { ask: 'طريقة الاستلام: التوصيل أم استلام من الفرع؟' },
      { say: 'جاري معالجة طلب التجديد...' }
    ],
    output: (ctx)=>{
      return `تم تجديد الهوية بنجاح${ctx.delivery==='branch' ? ' — تم حجز موعد للفرع: الخميس 10 صباحًا' : ' — سيتم التوصيل عبر البريد خلال 5 أيام'}.`;
    }
  },
  'بدل مفقود': {
    section:'ahwal',
    name:'إصدار بدل مفقود/تالف للهوية',
    steps:[
      { ask: 'هل تريد تقديم بلاغ فقدان/تلف الآن؟' },
      { say: 'تم تقديم البلاغ.' },
      { ask: 'هل تريد طلب بدل فاقد الآن؟' },
      { ask: 'اختر طريقة الاستلام: توصيل أو فرع' },
      { say: 'يتم تجهيز البدل الآن.' }
    ],
    output: ()=> 'تم إصدار طلب بدل الهوية وسيصلك إشعار بالمتابعة.'
  },
  'اصدار اول مرة': {
    section:'ahwal',
    name:'إصدار هوية وطنية لأول مرة',
    steps:[
      { ask: 'هل صاحب الطلب بلغ 15 سنة أو أكثر؟' },
      { ask: 'هل لديك سجل الأسرة لولي الأمر؟' },
      { say: 'حدد موعد لزيارة الفرع لإتمام الإصدار.' }
    ],
    output: ()=> 'تم حجز موعد لإصدار الهوية لأول مرة. راجع الفرع بالمستندات المطلوبة.'
  },
  'تجديد رخصة': {
    section:'muroor',
    name:'تجديد رخصة القيادة',
    steps:[
      { say: 'أشيّك صلاحية رخصتك...' },
      { say: 'أشيّك الفحص الطبي والتأمين...' },
      { ask: 'اختر مدة التجديد: سنتين / خمس سنوات / عشر سنوات' },
      { say: 'جاري تنفيذ التجديد...' }
    ],
    output:(ctx)=> `تم تجديد رخصتك (${ctx.period||'المدة المختارة'}) بنجاح.`
  },
  'نقل ملكية': {
    section:'muroor',
    name:'نقل ملكية مركبة',
    steps:[
      { ask: 'هل الطرف الثاني وافق عبر حسابه؟' },
      { say: 'جاري التحقق من الفحص والتأمين...' },
      { ask: 'هل تريد إتمام نقل الملكية الآن؟' }
    ],
    output: ()=> 'تم إرسال طلب نقل الملكية للطرف الثاني. بعد الموافقة يتم استكمال الإجراءات.'
  },
  'الاستعلام عن المخالفات': {
    section:'muroor',
    name:'الاستعلام عن المخالفات',
    steps:[
      { say: 'جاري جلب المخالفات المسجلة...' }
    ],
    output: ()=> 'لديك مخالفة واحدة بقيمة 300 ريال (محاكاة).'
  },
  'تجديد جواز': {
    section:'jawaz',
    name:'تجديد جواز السفر السعودي',
    steps:[
      { say: 'تحقق من صلاحية الجواز...' },
      { ask: 'اختر المدة: 5 سنوات / 10 سنوات' },
      { say: 'جاري تنفيذ طلب التجديد...' }
    ],
    output: (ctx)=> `تم تجديد الجواز (${ctx.period||'المدة المختارة'}) وسيتم التوصيل خلال أيام.`
  },
  'خروج وعودة': {
    section:'jawaz',
    name:'إصدار تأشيرة خروج وعودة',
    steps:[
      { ask: 'تأشيرة مفردة أم متعددة؟' },
      { ask: 'ما مدة التأشيرة بالأيام؟' },
      { say: 'جاري إصدار التأشيرة...' }
    ],
    output: ()=> 'تم إصدار تأشيرة خروج وعودة (محاكاة).'
  },
  'تجديد اقامة': {
    section:'iqama',
    name:'تجديد الإقامة',
    steps:[
      { say: 'جاري التحقق من صلاحية التأمين والرسوم...' },
      { ask: 'كم مدة التجديد؟' },
      { say: 'جاري تنفيذ التجديد...' }
    ],
    output: ()=> 'تم تجديد الإقامة (محاكاة).'
  },
  'نقل كفالة': {
    section:'iqama',
    name:'نقل كفالة عامل',
    steps:[
      { ask: 'هل صاحب العمل الجديد وافق؟' },
      { say: 'إرسال الطلب للطرف الآخر للموافقة...' },
      { ask: 'هل تريد متابعة الطلب الآن؟' }
    ],
    output: ()=> 'تم إرسال طلب نقل الكفالة (محاكاة).'
  },
  'تفويض خدمة': {
    section:'tafweed',
    name:'تفويض الخدمات',
    steps:[
      { ask: 'اختر نوع التفويض: مرور / جوازات / احوال' },
      { ask: 'أدخل رقم هوية المفوض له' },
      { say: 'إرسال طلب التفويض للطرف الآخر...' }
    ],
    output: ()=> 'تم إرسال طلب التفويض، في حال قبول الطرف يصل الإشعار.'
  },
  'استعلام عام': {
    section:'tafweed',
    name:'استعلامات عامة',
    steps:[
      { ask: 'ما نوع الاستعلام الذي ترغب به؟' }
    ],
    output: (ctx)=> `تمت معالجة الاستعلام: ${ctx.query||''}`
  }
};

// ---------- UI helpers ----------
function makeActionButton(label, data){
  const b = document.createElement('button');
  b.className = 'action-btn';
  b.textContent = label;
  if(data) b.dataset.value = JSON.stringify(data);
  return b;
}

// ---------- Global state ----------
let currentFlow = null;
let awaitingContinue = false;
let pendingContinueKey = null;

// ---------- showSectionOptions ----------
function showSectionOptions(title, options){
  addMsg(title, 'bot'); speakOnce(title);
  const row = document.createElement('div'); row.className = 'action-row';
  options.forEach(opt=>{
    const b = makeActionButton(opt.label, { key: opt.key || opt.label, keyPrefix: opt.keyPrefix });
    row.appendChild(b);
    b.onclick = ()=>{
      addMsg(opt.label, 'user'); speakOnce(`تم اختيار: ${opt.label}`);
      const cont = makeActionButton('استمرار', { continueFor: opt.key || opt.label, prefix: opt.keyPrefix });
      cont.onclick = ()=>{
        cont.remove(); row.remove();
        if(opt.keyPrefix){
          if(opt.keyPrefix === 'ahwal_id') showAHWAL_ID_options();
          else { addMsg('قيد التطوير', 'bot'); speakOnce('قيد التطوير'); }
          return;
        }
        startFlow(opt.key || opt.label);
      };
      row.appendChild(cont);
      chat.appendChild(row); chat.scrollTop = chat.scrollHeight;
    };
  });
  chat.appendChild(row); chat.scrollTop = chat.scrollHeight;
}

// ---------- AHWAL ID submenu ----------
function showAHWAL_ID_options(){
  addMsg('خدمات الهوية الوطنية:', 'bot'); speakOnce('خدمات الهوية الوطنية');
  const row = document.createElement('div'); row.className = 'action-row';
  const options = [
    {label:'تجديد بطاقة الهوية الوطنية', key:'تجديد الهوية'},
    {label:'إصدار بدل مفقود/تالف', key:'بدل مفقود'},
    {label:'إصدار هوية لأول مرة', key:'اصدار اول مرة'}
  ];
  options.forEach(opt=>{
    const b = makeActionButton(opt.label, { key: opt.key });
    row.appendChild(b);
    b.onclick = ()=>{
      addMsg(opt.label,'user'); speakOnce(opt.label);
      const cont = makeActionButton('استمرار', { continueFor: opt.key });
      cont.onclick = ()=>{
        cont.remove(); row.remove(); startFlow(opt.key);
      };
      row.appendChild(cont);
      chat.appendChild(row); chat.scrollTop = chat.scrollHeight;
    };
  });
  chat.appendChild(row); chat.scrollTop = chat.scrollHeight;
}

// ---------- startFlow ----------
function startFlow(key){
  const flow = serviceFlows[key];
  if(!flow){
    addMsg('عذراً هذه الخدمة غير متاحة حالياً (محاكاة).', 'bot'); speakOnce('عذراً هذه الخدمة غير متاحة حالياً');
    return;
  }
  currentFlow = { key, idx:0, ctx:{} };
  proceedFlowStep();
}

// ---------- proceedFlowStep ----------
function proceedFlowStep(){
  if(!currentFlow) return;
  const flow = serviceFlows[currentFlow.key];
  if(!flow) return;
  const step = flow.steps[currentFlow.idx];
  if(!step){
    const out = (typeof flow.output === 'function') ? flow.output(currentFlow.ctx) : flow.output;
    addMsg(out, 'bot'); speakOnce(out);
    setTimeout(()=>{ addMsg('هل تريد خدمة أخرى؟', 'bot'); speakOnce('هل تريد خدمة أخرى؟'); showQuickMainOptions(); currentFlow = null; }, 700);
    return;
  }

  if(step.say){
    addMsg(step.say, 'bot'); speakOnce(step.say);
    const cont = makeActionButton('استمرار');
    cont.onclick = ()=>{
      cont.remove(); currentFlow.idx++; proceedFlowStep();
    };
    addHTML(cont); return;
  }

  if(step.ask){
    addMsg(step.ask, 'bot'); speakOnce(step.ask);
    const row = document.createElement('div'); row.className = 'action-row';
    const yes = makeActionButton('نعم'); const no = makeActionButton('لا'); const other = makeActionButton('أخرى');
    row.appendChild(yes); row.appendChild(no); row.appendChild(other);
    chat.appendChild(row); chat.scrollTop = chat.scrollHeight;
    yes.onclick = ()=> { row.remove(); handleFlowAnswer('yes'); };
    no.onclick = ()=> { row.remove(); handleFlowAnswer('no'); };
    other.onclick = ()=> { row.remove(); awaitingContinue = true; addMsg('فضلاً اكتب جوابك:', 'bot'); };
    return;
  }
}

// ---------- handleFlowAnswer ----------
function handleFlowAnswer(raw){
  const text = (typeof raw==='string') ? raw : (raw.target ? raw.target.value : '');
  const normalized = text.trim();
  if(!currentFlow) { addMsg('لا يوجد سؤال جاري.', 'bot'); return; }
  const flow = serviceFlows[currentFlow.key];
  if(isYes(normalized) || normalized==='yes'){ currentFlow.ctx.answer = true; currentFlow.idx++; proceedFlowStep(); return; }
  if(isNo(normalized) || normalized==='no'){ currentFlow.ctx.answer = false; currentFlow.idx++; proceedFlowStep(); return; }
  if(/(\d+)\s*سنة|\d+/.test(normalized)){ currentFlow.ctx.period = normalized; currentFlow.idx++; proceedFlowStep(); return; }
  if(/توصيل|بريد|استلام|فرع/.test(normalized)){
    currentFlow.ctx.delivery = /فرع|استلام/.test(normalized) ? 'branch' : 'post';
    currentFlow.idx++; proceedFlowStep(); return;
  }
  currentFlow.ctx.query = normalized; currentFlow.idx++; proceedFlowStep();
}

// ---------- handleUser ----------
function handleUser(txt){
  addMsg(txt, 'user');
  if(currentFlow && awaitingContinue){ awaitingContinue = false; handleFlowAnswer(txt); input.value=''; return; }
  if(currentFlow){ const step = serviceFlows[currentFlow.key].steps[currentFlow.idx]; if(step && step.ask){ handleFlowAnswer(txt); input.value=''; return; } }
  const found = findFlowByKeyword(txt);
  if(found){ addMsg(`عرفت خدمتك: ${found.name}`, 'bot'); speakOnce(`عرفت خدمتك ${found.name}`);
    const cont = makeActionButton('استمرار', { start: found.key }); addHTML(cont);
    cont.onclick = ()=>{ cont.remove(); startFlow(found.key); };
    return;
  }
  if(isYes(txt) && pendingContinueKey){ startFlow(pendingContinueKey); pendingContinueKey=null; return; }
  addMsg('ما فهمت خدمتك. هذه بعض الأقسام المتاحة:', 'bot'); speakOnce('ما فهمت خدمتك. هذه بعض الأقسام المتاحة'); showQuickMainOptions(); input.value='';
}

// ---------- find flow ----------
function findFlowByKeyword(txt){
  const t = txt.replace(/أ/g,'ا');
  for(const key in serviceFlows){
    const flow = serviceFlows[key];
    if(flow.name && flow.name.indexOf(txt)!==-1) return { key, name: flow.name };
    if(flow.name && flow.name.replace(/\s/g,'').indexOf(t.replace(/\s/g,''))!==-1) return { key, name: flow.name };
    if(key.indexOf(t)!==-1) return { key, name: flow.name };
  }
  return null;
}

// ---------- quick main options ----------
function showQuickMainOptions(){
  const row = document.createElement('div'); row.className='action-row';
  const opts = [
    {label:'خدمات الأحوال الوطنية', id:'ahwal'},
    {label:'خدمات المرور', id:'muroor'},
    {label:'خدمات الجوازات', id:'jawaz'},
    {label:'خدمات الإقامة', id:'iqama'},
    {label:'التفويض والاستعلامات', id:'tafweed'}
  ];
  opts.forEach(o=>{
    const b = makeActionButton(o.label);
    b.onclick = ()=>{ addMsg(o.label,'user'); const el=document.querySelector(`.sidebar .item[data-id="${o.id}"]`); if(el) el.click(); row.remove(); };
    row.appendChild(b);
  });
  chat.appendChild(row); chat.scrollTop=chat.scrollHeight;
}

// ---------- initial welcome ----------
window.onload = ()=>{
  addMsg('أهلاً، أنا AbsherAi — مساعدك الذكي لخدمات وزارة الداخلية. كيف أقدر أخدمك؟', 'bot');
  speakOnce('أهلاً، أنا أبشر أي آي، كيف أقدر أخدمك اليوم؟');
  showQuickMainOptions();
};

// ---------- send & mic ----------
sendBtn.onclick = ()=>{ if(!input.value.trim()) return; handleUser(input.value.trim()); input.value=''; };
micBtn.onclick = ()=>{ if(recognition) try{ recognition.start(); } catch(e) { console.warn(e); } };