document.addEventListener('DOMContentLoaded',()=>{
const MORSE={A:'.-',B:'-...',C:'-.-.',D:'-..',E:'.',F:'..-.',G:'--.',H:'....',I:'..',J:'.---',K:'-.-',L:'.-..',M:'--',N:'-.',O:'---',P:'.--.',Q:'--.-',R:'.-.',S:'...',T:'-',U:'..-',V:'...-',W:'.--',X:'-..-',Y:'-.--',Z:'--..',0:'-----',1:'.----',2:'..---',3:'...--',4:'....-',5:'.....',6:'-....',7:'--...',8:'---..',9:'----.','.':'.-.-.-',',':'--..--','?':'..--..',"'":'.----.','!':'-.-.--','/':'-..-.','(':'-.--.',')':'-.--.-','&':'.-...',':':'---...',';':'-.-.-.','=':'-...-','+':'.-.-.','-':'-....-','_':'..--.-','"':'.-..-.','$':'...-..-','@':'.--.-.',' ':'/'};
const REV=Object.fromEntries(Object.entries(MORSE).map(([k,v])=>[v,k]));
const AUDIO_REV=Object.fromEntries(Object.entries(MORSE).filter(([k])=>/^[A-Z]$/.test(k)).map(([k,v])=>[v,k]));
const S={mode:'text-to-morse',speakText:'',ctx:null,buf:null,src:null,timer:null,utt:null,playing:false,questions:[],qi:0,score:0,streak:0,camPoll:null,camStream:null,camOn:false,camBackend:false,micOn:false,micPoll:null,micBackend:false,audioText:''};
const TOTAL=10,API='http://127.0.0.1:5000';
const $=id=>document.getElementById(id),cursor=document.querySelector('.custom-cursor'),body=document.body;
const input=$('input-text'),morseOut=$('morse-output'),textOut=$('text-output'),typeEl=$('translation-type'),audioPlayer=$('audio-player'),playBtn=$('play-audio'),progress=$('audio-progress'),curTime=$('current-time'),totTime=$('total-time');
const practiceQ=$('practice-question'),practiceIn=$('practice-input'),feedback=$('practice-feedback'),scoreEl=$('score'),totalEl=$('total-questions'),streakEl=$('streak'),fill=$('progress-fill'),percent=$('progress-percent');
const camBtn=$('start-camera-btn'),camOut=$('camera-output'),camClear=$('clear-camera-text'),camFeed=$('camera-feed'),camImg=$('camera-stream'),camPlaceholder=$('camera-placeholder');
const micBtn=$('start-audio-detection'),micOut=$('audio-detection-output'),micClear=$('clear-audio-detection');
initParticles();initCursor();initTheme();initNav();initTranslation();initChart();initPractice();initCamera();initMic();renderMorse(textToMorse(input.value.toUpperCase()));
function initParticles(){if(typeof window.particlesJS!=='function')return;const light=body.classList.contains('light-mode');const color=light?'#0f766e':'#64ffda';const linkOpacity=light?.28:.2;const particleOpacity=light?.42:.3;window.particlesJS('particles-js',{particles:{number:{value:light?70:60,density:{enable:true,value_area:800}},color:{value:color},shape:{type:'circle',stroke:{width:0,color:'#000'}},opacity:{value:particleOpacity,random:true,anim:{enable:true,speed:1,opacity_min:light?.16:.1,sync:false}},size:{value:light?2.4:2,random:true,anim:{enable:true,speed:2,size_min:.1,sync:false}},line_linked:{enable:true,distance:120,color:color,opacity:linkOpacity,width:1},move:{enable:true,speed:light?1:.8,direction:'none',random:true,straight:false,out_mode:'out',bounce:false}},interactivity:{detect_on:'canvas',events:{onhover:{enable:true,mode:'grab'},onclick:{enable:true,mode:'push'},resize:true},modes:{grab:{distance:120,line_linked:{opacity:light?.5:.4}},push:{particles_nb:3}}},retina_detect:true});}
function initCursor(){if(!cursor)return;const fine=matchMedia('(pointer: fine)').matches,reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;if(!fine||reduced){cursor.remove();return;}let mx=0,my=0,cx=0,cy=0;cursor.classList.add('active');document.addEventListener('mousemove',e=>{mx=e.clientX;my=e.clientY;});document.querySelectorAll('button,a,.chart-item,.text-area,input,textarea').forEach(el=>{el.addEventListener('mouseenter',()=>cursor.classList.add('hover'));el.addEventListener('mouseleave',()=>cursor.classList.remove('hover'));});(function tick(){cx+=(mx-cx)*.2;cy+=(my-cy)*.2;cursor.style.left=`${cx}px`;cursor.style.top=`${cy}px`;requestAnimationFrame(tick);})();}
function initTheme(){document.querySelector('.toggle-btn')?.addEventListener('click',()=>{body.classList.toggle('light-mode');initParticles();});}
function initNav(){document.querySelectorAll('.nav-pill-item').forEach(btn=>btn.addEventListener('click',()=>{document.querySelectorAll('.nav-pill-item').forEach(x=>{x.classList.remove('active');x.setAttribute('aria-selected','false');});document.querySelectorAll('.content-section').forEach(x=>x.classList.remove('active'));btn.classList.add('active');btn.setAttribute('aria-selected','true');const target=document.getElementById(btn.dataset.section);if(target){target.classList.add('active');window.scrollTo({top:0,behavior:'smooth'});}}));}
function initTranslation(){document.querySelectorAll('.mode-btn').forEach(btn=>btn.addEventListener('click',()=>{document.querySelectorAll('.mode-btn').forEach(x=>x.classList.remove('active'));btn.classList.add('active');S.mode=btn.dataset.mode;resetTranslation();}));$('translate-btn').addEventListener('click',()=>{const value=input.value.trim();if(!value){alert('Please enter some text or Morse code to translate.');return;}stopAudio();if(S.mode==='text-to-morse'){const morse=textToMorse(value.toUpperCase());typeEl.textContent='Text to Morse Code';renderMorse(morse);morseOut.style.display='block';textOut.style.display='none';prepareAudio(morse);audioPlayer.style.display='flex';return;}const text=morseToText(value);typeEl.textContent='Morse to Text';textOut.textContent=text;textOut.style.display='block';morseOut.style.display='none';S.speakText=text;resetAudioUi(Math.max(text.length*.2,.5));audioPlayer.style.display=text?'flex':'none';});playBtn.addEventListener('click',()=>{if(S.mode==='text-to-morse'){S.playing?stopAudio():playMorseAudio();return;}if(!S.speakText)return;S.playing?stopAudio():speakText(S.speakText);});}
function resetTranslation(){input.value='';morseOut.innerHTML='';textOut.textContent='';S.speakText='';stopAudio();audioPlayer.style.display='none';if(S.mode==='text-to-morse'){input.placeholder='Enter text to translate to Morse code...';typeEl.textContent='Text to Morse Code';morseOut.style.display='block';textOut.style.display='none';}else{input.placeholder='Enter Morse code to translate to text...';typeEl.textContent='Morse to Text';morseOut.style.display='none';textOut.style.display='block';}}
function textToMorse(text){return text.split('').map(ch=>MORSE[ch]||ch).join(' ');} function morseToText(text){return text.trim().split(/\s+/).map(code=>code==='/'?' ':REV[code]||'?').join('').replace(/\s+/g,' ').trim();}
function renderMorse(morse){const tokens=morse.split(' ');morseOut.innerHTML=tokens.map(token=>`<span class="morse-character">${esc(token)}</span>`).join(' ');} function syncMorseHighlight(elapsed){const chars=[...document.querySelectorAll('.morse-character')];if(!chars.length||!Array.isArray(S.timeline))return;let active=-1;for(const item of S.timeline){if(elapsed<item.end){active=item.index;break;}}chars.forEach((char,index)=>char.classList.toggle('active',index===active));} function clearMorseHighlight(){document.querySelectorAll('.morse-character').forEach(char=>char.classList.remove('active'));} function esc(v){return v.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');}
function ensureCtx(){if(!S.ctx){const AC=window.AudioContext||window.webkitAudioContext;if(!AC)throw new Error('Web Audio API is not supported.');S.ctx=new AC();}return S.ctx;}
function prepareAudio(morse){const ctx=ensureCtx(),dot=.1,dash=.3,gap=.1,charGap=.3,wordGap=.7,sr=ctx.sampleRate,tokens=morse.split(' '),timeline=[];let total=0;tokens.forEach((token,index)=>{let tokenDuration=0;if(token==='/'){tokenDuration=wordGap;}else{for(let i=0;i<token.length;i++){tokenDuration+=token[i]==='.'?dot:dash;if(i<token.length-1)tokenDuration+=gap;}}timeline.push({index,end:total+tokenDuration});total+=tokenDuration;if(index<tokens.length-1&&token!=='/'){total+=charGap;}});const len=Math.ceil(total*sr),buf=ctx.createBuffer(1,len,sr),data=buf.getChannelData(0);let si=0,t=0;tokens.forEach((token,index)=>{if(token==='/'){const wordSamples=Math.floor(wordGap*sr);for(let j=0;j<wordSamples&&si<len;j++){data[si]=0;si++;t+=1/sr;}}else{for(let i=0;i<token.length;i++){const dur=token[i]==='.'?dot:dash,tone=Math.floor(dur*sr);for(let j=0;j<tone&&si<len;j++){data[si]=Math.sin(2*Math.PI*600*t)*.5;si++;t+=1/sr;}if(i<token.length-1){const gs=Math.floor(gap*sr);for(let j=0;j<gs&&si<len;j++){data[si]=0;si++;t+=1/sr;}}}if(index<tokens.length-1){const charSamples=Math.floor(charGap*sr);for(let j=0;j<charSamples&&si<len;j++){data[si]=0;si++;t+=1/sr;}}}});S.buf=buf;S.timeline=timeline;resetAudioUi(total);} function playMorseAudio(){if(!S.buf)return;stopAudio();const ctx=ensureCtx(),src=ctx.createBufferSource(),gain=ctx.createGain();gain.gain.value=.5;src.buffer=S.buf;src.connect(gain);gain.connect(ctx.destination);src.start(0);S.src=src;S.playing=true;playBtn.innerHTML='<i class="fas fa-pause"></i>';const start=ctx.currentTime;S.timer=setInterval(()=>{const elapsed=ctx.currentTime-start,dur=S.buf.duration;if(elapsed>=dur){stopAudio();return;}syncMorseHighlight(elapsed);updateAudioUi(elapsed,dur);},50);src.onended=()=>stopAudio();}
function speakText(text){if(!('speechSynthesis' in window)){alert('Text-to-speech is not supported in this browser.');return;}stopAudio();const dur=Math.max(text.length*.2,.5),u=new SpeechSynthesisUtterance(text);u.rate=.9;u.pitch=1;u.volume=1;S.utt=u;S.playing=true;playBtn.innerHTML='<i class="fas fa-pause"></i>';resetAudioUi(dur);const start=Date.now();S.timer=setInterval(()=>{const elapsed=(Date.now()-start)/1000;updateAudioUi(elapsed,dur);if(elapsed>=dur)stopAudio();},50);u.onend=()=>stopAudio();u.onerror=()=>stopAudio();speechSynthesis.speak(u);} function stopAudio(){if(S.timer){clearInterval(S.timer);S.timer=null;}if(S.src){try{S.src.stop();}catch{}S.src.onended=null;S.src=null;}if(S.utt&&'speechSynthesis' in window){speechSynthesis.cancel();S.utt=null;}S.playing=false;clearMorseHighlight();playBtn.innerHTML='<i class="fas fa-play"></i>';progress.style.width='0%';curTime.textContent='0:00';}
function resetAudioUi(total){totTime.textContent=fmt(total);curTime.textContent='0:00';progress.style.width='0%';playBtn.innerHTML='<i class="fas fa-play"></i>';clearMorseHighlight();} function updateAudioUi(elapsed,dur){progress.style.width=`${Math.min(elapsed/dur*100,100)}%`;curTime.textContent=fmt(elapsed);totTime.textContent=fmt(dur);} function fmt(sec){const s=Math.max(0,Math.floor(sec)),m=Math.floor(s/60),r=s%60;return `${m}:${String(r).padStart(2,'0')}`;}
function initChart(){makeChart($('alphabet-chart'),'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split(''));makeChart($('numbers-chart'),'0123456789'.split(''));} function makeChart(el,list){el.innerHTML='';list.forEach(ch=>{const btn=document.createElement('button');btn.type='button';btn.className='chart-item';btn.innerHTML=`<span class="chart-char">${ch}</span><span class="chart-morse">${MORSE[ch]}</span>`;btn.addEventListener('click',()=>playSingle(MORSE[ch]));el.appendChild(btn);});}
function initPractice(){$('play-question').addEventListener('click',()=>{const q=S.questions[S.qi];if(q)playSingle(q.morse);});$('check-answer').addEventListener('click',()=>{const q=S.questions[S.qi];if(!q)return;const ans=practiceIn.value.trim().toUpperCase();if(!ans){showFeedback('Please enter an answer.','warning');return;}if(ans===q.char){S.score++;S.streak++;showFeedback(`Correct. ${q.morse} is ${q.char}.`,'success');}else{S.streak=0;showFeedback(`Incorrect. ${q.morse} is ${q.char}.`,'error');}updatePracticeStats();});$('next-question').addEventListener('click',()=>{if(S.qi<S.questions.length-1){S.qi++;loadQuestion();updateProgress();return;}showFeedback(`Practice completed. Final score: ${S.score}/${TOTAL}.`,'success');setTimeout(genQuestions,1200);});practiceIn.addEventListener('input',()=>{practiceIn.value=practiceIn.value.toUpperCase().slice(0,1);});genQuestions();}
function genQuestions(){const src=[...'ABCDEFGHIJKLMNOPQRSTUVWXYZ',...'0123456789'];S.questions=Array.from({length:TOTAL},()=>{const char=src[Math.floor(Math.random()*src.length)];return {char,morse:MORSE[char]};});S.qi=0;S.score=0;S.streak=0;updatePracticeStats();loadQuestion();updateProgress();}
function loadQuestion(){const q=S.questions[S.qi];if(!q)return;practiceQ.innerHTML=`What character does this Morse code represent?<br><span id="practice-morse" class="practice-morse">${esc(q.morse)}</span>`;practiceIn.value='';feedback.style.display='none';feedback.textContent='';feedback.className='practice-feedback';}
function updatePracticeStats(){scoreEl.textContent=String(S.score);totalEl.textContent=String(TOTAL);streakEl.textContent=String(S.streak);} function updateProgress(){const p=Math.min((S.qi+1)/TOTAL*100,100);fill.style.width=`${p}%`;percent.textContent=`${Math.round(p)}%`;}
function showFeedback(msg,type){feedback.textContent=msg;feedback.style.display='block';if(type==='success'){feedback.style.background='rgba(16, 185, 129, 0.2)';feedback.style.color='#10b981';feedback.style.border='1px solid rgba(16, 185, 129, 0.3)';return;}if(type==='error'){feedback.style.background='rgba(239, 68, 68, 0.2)';feedback.style.color='#ef4444';feedback.style.border='1px solid rgba(239, 68, 68, 0.3)';return;}feedback.style.background='rgba(245, 158, 11, 0.2)';feedback.style.color='#f59e0b';feedback.style.border='1px solid rgba(245, 158, 11, 0.3)';}
function playSingle(morse){const ctx=ensureCtx(),dot=.1,dash=.3,gap=.1,sr=ctx.sampleRate,total=morse.split('').reduce((sum,ch,i)=>sum+(ch==='.'?dot:dash)+(i<morse.length-1?gap:0),0),len=Math.ceil(total*sr),buf=ctx.createBuffer(1,len,sr),data=buf.getChannelData(0);let si=0,t=0;morse.split('').forEach((ch,i)=>{const dur=ch==='.'?dot:dash,tone=Math.floor(dur*sr);for(let j=0;j<tone&&si<len;j++){data[si]=Math.sin(2*Math.PI*600*t)*.5;si++;t+=1/sr;}if(i<morse.length-1){const gs=Math.floor(gap*sr);for(let j=0;j<gs&&si<len;j++){data[si]=0;si++;t+=1/sr;}}});const src=ctx.createBufferSource(),gain=ctx.createGain();gain.gain.value=.5;src.buffer=buf;src.connect(gain);gain.connect(ctx.destination);src.start(0);}
function initCamera(){camBtn.addEventListener('click',async()=>{if(S.camOn)await stopCamera();else await startCamera();});camClear.addEventListener('click',async()=>{try{await fetch(`${API}/clear_text`);}catch{}camOut.textContent=S.camBackend?'Listening for Morse input...':S.camOn?'Camera preview is active.':'Waiting for Morse input...';camClear.style.display='none';});}
async function startCamera(){try{if(!navigator.mediaDevices?.getUserMedia)throw new Error('Camera access is not supported in this browser.');await openCam();const res=await fetch(`${API}/start_camera`);if(!res.ok)throw new Error('Failed to start the local camera backend.');S.camOn=true;S.camBackend=true;showBackendCam();camBtn.innerHTML='<i class="fas fa-stop"></i> Stop Camera Detection';camOut.textContent='Listening for Morse input...';pollCamera();}catch(err){S.camOn=!!S.camStream;S.camBackend=false;stopCamPoll();camBtn.innerHTML=S.camOn?'<i class="fas fa-stop"></i> Stop Camera Detection':'<i class="fas fa-video"></i> Start Camera Detection';camOut.textContent=S.camStream?'Camera opened, but the local backend is not connected.':(err.message||'Unable to open camera.');}}
async function stopCamera(){S.camOn=false;S.camBackend=false;stopCamPoll();closeCam();camClear.style.display='none';try{await fetch(`${API}/stop_camera`);}catch{}camBtn.innerHTML='<i class="fas fa-video"></i> Start Camera Detection';camOut.textContent='Camera stopped.';}
async function openCam(){if(S.camStream)return S.camStream;S.camStream=await navigator.mediaDevices.getUserMedia({video:true,audio:false});camImg.src='';camImg.classList.add('camera-video-hidden');camFeed.srcObject=S.camStream;camFeed.classList.remove('camera-video-hidden');camPlaceholder.style.display='none';return S.camStream;} function closeCam(){if(S.camStream){S.camStream.getTracks().forEach(t=>t.stop());S.camStream=null;}camFeed.pause();camFeed.srcObject=null;camFeed.classList.add('camera-video-hidden');camImg.src='';camImg.classList.add('camera-video-hidden');camPlaceholder.style.display='block';} function showBackendCam(){camFeed.pause();camFeed.srcObject=null;camFeed.classList.add('camera-video-hidden');camImg.src=`${API}/video_feed`;camImg.classList.remove('camera-video-hidden');camPlaceholder.style.display='none';}
function pollCamera(){stopCamPoll();S.camPoll=setInterval(async()=>{try{const res=await fetch(`${API}/get_text`),data=await res.json(),text=(data.text||'').trim();camOut.textContent=text||'Listening for Morse input...';camClear.style.display=text?'block':'none';}catch{S.camBackend=false;stopCamPoll();camOut.textContent='Camera preview is on, but the local backend is not connected.';}},1000);} function stopCamPoll(){if(S.camPoll){clearInterval(S.camPoll);S.camPoll=null;}}
function initMic(){
  micClear.style.display='none';
  micBtn.addEventListener('click',async()=>{if(S.micOn)await stopMic();else await startMic();});
  micClear.addEventListener('click',async()=>{
    try{await fetch(`${API}/clear_audio_text`);}catch{}
    S.audioText='';
    renderMicText();
  });
}
async function startMic(){
  try{
    const res=await fetch(`${API}/start_audio`);
    if(!res.ok)throw new Error('Failed to start backend audio detection.');
    const data=await res.json();
    S.micOn=true;
    S.micBackend=Boolean(data.running);
    S.audioText='';
    micBtn.innerHTML='<i class="fas fa-stop"></i> Stop Audio Detection';
    micClear.style.display='none';
    renderMicText('Calibrating backend audio... keep silence for 1-2 seconds');
    pollMic();
  }catch(err){
    S.micOn=false;
    S.micBackend=false;
    renderMicText(err?.message||'Unable to start backend audio detection.');
  }
}
async function stopMic(){
  S.micOn=false;
  S.micBackend=false;
  stopMicPoll();
  try{await fetch(`${API}/stop_audio`);}catch{}
  micBtn.innerHTML='<i class="fas fa-microphone"></i> Start Audio Detection';
  renderMicText('Audio detection stopped.');
}
function pollMic(){
  stopMicPoll();
  S.micPoll=setInterval(async()=>{
    try{
      const [textRes,dbgRes]=await Promise.all([fetch(`${API}/get_audio_text`),fetch(`${API}/audio_debug`)]);
      const textData=await textRes.json();
      const dbg=await dbgRes.json();
      S.audioText=(textData.text||'').trim();
      if(S.audioText){
        renderMicText();
        return;
      }
      if(dbg.calibrating){renderMicText('Calibrating backend audio... keep silence for 1-2 seconds');return;}
      if(dbg.session_active){renderMicText('Listening...');return;}
      renderMicText('Waiting for Morse audio...');
    }catch{
      S.micBackend=false;
      stopMicPoll();
      renderMicText('Audio backend not connected.');
    }
  },250);
}
function stopMicPoll(){if(S.micPoll){clearInterval(S.micPoll);S.micPoll=null;}}
function renderMicText(status){
  micOut.textContent=S.audioText||status||'Waiting for Morse audio...';
  micClear.style.display=S.audioText?'block':'none';
}
});


