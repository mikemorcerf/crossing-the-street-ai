const canvas=document.querySelector('canvas'),c=canvas.getContext('2d'),$=s=>document.querySelector(s);
const names=['City','Country','River','Beach','Latin Town','Airport','New York'];const palettes=[['#8eaa80','#525b59'],['#97b86e','#937d60'],['#729969','#4d97a8'],['#e7cf90','#58aabd'],['#beaa7a','#b57759'],['#9ba7a1','#5a666b'],['#819786','#485562']];
$('#route').innerHTML=names.map((n,i)=>`<span>${String(i+1).padStart(2,'0')} ${n}</span>`).join('');let audio,muted=false,running=false,paused=false,ended=false,level=0,progress=0,scroll=0,lives=3,player={x:280,y:540},rows=[],last=0,inv=0,beat=0,flight=0;
function tone(f=440,d=.1,type='square',v=.04){if(!audio||muted)return;let o=audio.createOscillator(),g=audio.createGain();o.type=type;o.frequency.value=f;g.gain.setValueAtTime(v,audio.currentTime);g.gain.exponentialRampToValueAtTime(.001,audio.currentTime+d);o.connect(g).connect(audio.destination);o.start();o.stop(audio.currentTime+d)}
// Each stage cycles through all six hazards, separated by rest lanes.
const hazards=[
 [['Taxi','🚕',85,70],['Bike courier','🚴',44,125],['Runaway dog','🐕',48,65,'zigzag'],['Open manhole','🕳️',48,0],['Roadworks','🚧',65,0],['Skater','🛹',48,100,'burst']],
 [['Tractor','🚜',90,42],['Cow','🐄',72,30,'zigzag'],['Hay bale','🌾',55,0],['Charging ram','🐏',55,100,'burst'],['Bee swarm','🐝',45,75,'zigzag'],['Fallen tree','🪵',90,0]],
 [['Floating log','🪵',145,40,'raft'],['Crocodile','🐊',85,80],['Whirlpool','🌀',60,0,'pulse'],['Speedboat','🚤',95,125],['Turtle ferry','🐢',100,32,'raft'],['Shark','🦈',80,90,'zigzag']],
 [['Crab','🦀',48,55,'zigzag'],['Beach ball','🏐',45,80,'zigzag'],['Umbrella','⛱️',65,0],['Surfer','🏄',70,105],['Jellyfish','🪼',55,30,'pulse'],['Sandcastle','🏰',65,0]],
 [['Scooter','🛵',65,100],['Dancing crowd','💃',55,45,'zigzag'],['Fruit cart','🍉',70,25],['Street drummer','🥁',60,0],['Football','⚽',40,125,'zigzag'],['Delivery truck','🚚',105,65]],
 [['Baggage cart','🧳',70,55],['Shuttle bus','🚌',110,65],['Running traveler','🏃',50,95,'burst'],['Safety barrier','🚧',65,0],['Service truck','🚒',100,80],['Taxiing plane','✈️',125,110]],
 [['Yellow cab','🚕',85,100],['Subway train','🚇',150,140],['Pizza courier','🍕',50,90,'zigzag'],['Steam vent','♨️',60,0,'pulse'],['Tourist crowd','🧑‍🤝‍🧑',85,35],['Hot dog stand','🌭',75,0]]
];
const SCROLL_SPEED=34; // pixels per second
let laneSerial=0,worldTime=0;
let godMode=false,cheatBuffer='';
function cheatKey(key){if(key.length!==1)return;cheatBuffer=(cheatBuffer+key.toLowerCase()).slice(-5);if(cheatBuffer==='iddqd'){godMode=!godMode;cheatBuffer='';clearInput();$('#god-mode').hidden=!godMode;tone(godMode?1046:262,.5,'triangle');}}

const held=new Set();let target=null,footstep=0;
// A repeating lane contains small clusters separated by generous random gaps.
function clusters(width){let items=[],x=25+Math.random()*90;while(x<1800){let count=1+Math.floor(Math.random()*3);for(let n=0;n<count;n++){items.push(x);x+=width+20+Math.random()*35}x+=110+Math.random()*170}return {items,period:x+120}}
function updateMovement(dt){let dx=Number(held.has('right'))-Number(held.has('left'));
if(dx){target=null;player.x+=dx*245*dt}else if(target){let delta=target.x-player.x;player.x+=Math.sign(delta)*Math.min(Math.abs(delta),245*dt);if(Math.abs(delta)<1)target=null}
player.x=Math.max(66,Math.min(494,player.x));player.y=520;
footstep-=dt;if(footstep<=0){tone(level===2?85+Math.random()*20:480+Math.random()*80,level===2?.18:.04,'triangle',.02);footstep=level===2?.2:.24}
}
function clearInput(){held.clear();target=null}

function row(y,i){let safe=i%4===0;let index=(i-Math.floor(i/4)-1+600)%6;let h=hazards[level][index];return {y,safe,h,water:!safe&&h[4]==='raft',dir:i%2?1:-1,speed:h[3],offset:70+(i%3)*53,phase:i,...clusters(h[2])}}
// Clear three lanes around spawn, including the first step forward.
let guards=[],chaseTime=0,nextGuard=2.5,streetOffset=0;
function safeSpawn(){traffic=traffic.filter(v=>Math.abs(v.y-520)>220);clearInput();player={x:280,y:520};guards=guards.filter(g=>Math.hypot(g.x-player.x,g.y-player.y)>200)}
function setup(){if(running)announce(['Welcome to the City!','Welcome to the Country!','Welcome to the River!','Welcome to the Beach!','Welcome to Latin Town!','Welcome to the Airport!','Welcome to New York!'][level]);clearInput();musicLevel=-1;lastGuardShout=-Infinity;guards=[];traffic=[];nextTraffic=3;trafficSerial=0;chaseTime=0;nextGuard=2.5;safeSpawn();scroll=0;document.querySelectorAll('.route span').forEach((e,i)=>e.classList.toggle('active',i===level));$('#location').innerHTML=names.map((name,i)=>`<span class="stage-crumb ${i===level?'current':i<level?'complete':''}" ${i===level?'aria-current="step"':''} aria-label="${name}${i===level?', current area':i<level?', completed':''}" title="${name}"><span aria-hidden="true">${['🏙️','🌾','🏞️','🏖️','🌮','✈️','🗽'][i]}</span></span>${i<names.length-1?'<span class="crumb-arrow" aria-hidden="true">›</span>':''}`).join('')}
function start(){stopVictorySong();if('speechSynthesis'in window)speechSynthesis.cancel();audio??=new(window.AudioContext||window.webkitAudioContext)();audio.resume();level=0;progress=0;lives=3;flight=0;finale=null;finaleTime=0;inv=2;ended=false;paused=false;running=true;$('#pause').textContent='Ⅱ PAUSE';$('#overlay').style.display='none';if(!muted&&'speechSynthesis'in window){let s=new SpeechSynthesisUtterance('Catch him!');s.rate=1.15;s.pitch=.7;speechSynthesis.speak(s)}setup();tone(220,.3)}
function move(dx){if(!running||paused||flight||!dx)return;target={x:Math.max(66,Math.min(494,player.x+dx*80))}}
function rewardStageClear(){lives=3;$('#lives').textContent='♥ ♥ ♥ ';announce('Good job! Keep going!')}
function finish(win){if(win)rewardStageClear();running=false;ended=true;tone(win?880:100,.8,'sawtooth');$('#overlay').style.display='flex';$('#overlay h2').innerHTML=win?'Congratulations!':'End of<br>the road.';$('#overlay p').textContent=win?'You escaped! New York is throwing you a party.':`${Math.floor(progress)} metres. Take a breath. Try again.`;$('#start').textContent=win?'RUN IT AGAIN ↗':'TRY AGAIN ↗'}
function hit(){if(godMode||inv)return;clearInput();lives--;tone(90,.3,'sawtooth');inv=2;safeSpawn();if(lives<=0)finish(false)}
function rect(x,y,w,h,color){c.fillStyle=color;c.fillRect(x,y,w,h)}
function drawBoat(x,y,enemy=false){
c.save();c.translate(x,y);
// Wake trails behind the stern, following the scrolling water.
c.strokeStyle='#b5f5ff';c.lineWidth=3;for(let i=0;i<3;i++){let tail=38+i*12+(streetOffset%12);c.beginPath();c.moveTo(-14-i*5,tail);c.lineTo(0,tail+6);c.lineTo(14+i*5,tail);c.stroke()}
c.fillStyle=enemy?'#bd294b':'#ffcf42';c.beginPath();c.moveTo(0,-49);c.lineTo(25,-16);c.lineTo(22,38);c.lineTo(-22,38);c.lineTo(-25,-16);c.closePath();c.fill();c.strokeStyle=enemy?'#ff8b9b':'#fff4bc';c.lineWidth=3;c.stroke();rect(-16,-12,32,39,enemy?'#78223c':'#a96e32');rect(-13,-19,26,7,'#a5edf6');rect(-8,33,16,11,'#29364d');c.restore();
}
function drawRiver(){rect(0,0,560,672,'#467b62');rect(43,0,474,672,'#d4c28c');rect(55,0,450,672,'#228caf');for(let y=streetOffset-120;y<750;y+=120){for(let i=0;i<7;i++){let x=70+i*64+Math.sin(y*.02+i)*8;rect(x,y+(i%3)*25,25,3,'#6dd2e1');rect(x+7,y+(i%3)*25+8,13,2,'#3ea9c6')}for(const x of [10,530]){rect(x,y,5,35,'#b1ba62');rect(x-6,y+7,17,4,'#80a963');rect(x-4,y+48,20,13,'#7c8071')}}}
const trafficThemes=[{kind:'car',w:42,h:72,pitch:150},{kind:'tractor',w:54,h:76,pitch:75},{kind:'ship',w:66,h:125,pitch:52},{kind:'buggy',w:48,h:60,pitch:220},{kind:'scooter',w:30,h:55,pitch:300},{kind:'plane',w:96,h:110,pitch:95}];
let traffic=[],nextTraffic=3,trafficSerial=0;
function passSound(theme){if(!audio||muted)return;let o=audio.createOscillator(),g=audio.createGain();o.type=theme.kind==='ship'?'sine':'sawtooth';o.frequency.setValueAtTime(theme.pitch*1.7,audio.currentTime);o.frequency.exponentialRampToValueAtTime(theme.pitch*.5,audio.currentTime+.65);g.gain.setValueAtTime(.001,audio.currentTime);g.gain.linearRampToValueAtTime(.055,audio.currentTime+.12);g.gain.exponentialRampToValueAtTime(.001,audio.currentTime+.8);o.connect(g).connect(audio.destination);o.start();o.stop(audio.currentTime+.8)}
function updateTraffic(dt){if(level>=6)return;nextTraffic-=dt;if(nextTraffic<=0){let lane=trafficSerial++%2;traffic.push({x:(lane?330:120)+Math.random()*90,y:-150,velocity:230,theme:trafficThemes[level],heard:false});nextTraffic=1.8+Math.random()*1.8}
for(const v of traffic){let old=v.y;v.y+=v.velocity*dt;if(!v.heard&&Math.min(Math.abs(v.y-player.y),Math.abs(old-player.y))<170){v.heard=true;passSound(v.theme)}if(Math.abs(v.x-player.x)<v.theme.w/2+(level===2?22:10)&&Math.abs(v.y-player.y)<v.theme.h/2+(level===2?40:18))hit()}
traffic=traffic.filter(v=>v.y>-200&&v.y<900)}
function drawTraffic(){for(const v of traffic){let{w,h,kind}=v.theme;c.save();c.translate(v.x,v.y);if(v.velocity>0)c.rotate(Math.PI);if(kind==='ship'){c.fillStyle='#bd294b';c.beginPath();c.moveTo(0,-h/2);c.lineTo(w/2,-h/3);c.lineTo(w/2,h/2);c.lineTo(-w/2,h/2);c.lineTo(-w/2,-h/3);c.closePath();c.fill();rect(-22,-20,44,50,'#f16c7e');rect(-15,-15,30,15,'#513755');rect(-8,10,16,25,'#7c2038')}else if(kind==='plane'){rect(-10,-h/2,20,h,'#e43a57');rect(-w/2,-8,w,20,'#f16c7e');rect(-28,h/2-18,56,12,'#cf234d');rect(-7,-h/2+15,14,18,'#f6bdc7')}else{rect(-w/2-4,-h/2+8,8,20,'#322635');rect(w/2-4,-h/2+8,8,20,'#322635');rect(-w/2-4,h/2-26,8,20,'#322635');rect(w/2-4,h/2-26,8,20,'#322635');rect(-w/2,-h/2,w,h,'#d52c4e');rect(-w/2+5,-h/2+8,w-10,17,'#ffa4ad');rect(-w/2+5,h/2-22,w-10,12,'#6d294b');if(kind==='tractor'){rect(-6,-h/2-8,12,22,'#52273e')}if(kind==='buggy'){rect(-w/2+5,-8,w-10,22,'#792940')}if(kind==='scooter'){rect(-24,-15,48,5,'#ff7c93')}}c.restore()}}
function scenery(){if(level===2){drawRiver();return}let ground=['#555369','#ba975e','#228caf','#f5d38c','#b97962','#626c80','#454b65'][level];rect(0,0,560,672,ground);
for(let y=streetOffset-120;y<750;y+=120){if(level===3){rect(0,y,43,120,'#39b9cc');rect(43,y,8,100,'#d6f9ed');for(const x of [22,534]){rect(x-2,y+25,5,45,'#b06d43');c.fillStyle='#f76e9d';c.beginPath();c.arc(x,y+24,23,Math.PI,0);c.fill()}rect(100,y+30,12,5,'#dfb16e');rect(450,y+80,8,4,'#fff2c9')}
else if(level===1){for(const x of [0,520]){rect(x,y,40,120,'#7b9a4c');for(let n=0;n<4;n++)rect(x+n*10,y+12,4,65,'#e1c25b');rect(x,y+85,40,6,'#fff0cd')}rect(140,y,3,50,'#a47e4e');rect(420,y,3,50,'#a47e4e')}
else if(level===5){rect(50,y,5,120,'#ffdc58');rect(505,y,5,120,'#ffdc58');rect(276,y,8,55,'#fff8dc');for(const x of [12,535]){rect(x,y,13,12,'#68e9f5');rect(x,y+60,13,12,'#68e9f5')}for(let n=0;n<4;n++)rect(190+n*48,y+85,25,25,'#ffffff')}
else{rect(276,y,8,48,'#ffe1ab');for(const x of [0,526]){rect(x,y,34,100,level===4?['#f1b34e','#ea7798','#6bd3d1'][Math.abs(Math.floor(y/120))%3]:'#8a8cad');rect(x+7,y+12,18,20,'#352b55');rect(x+7,y+50,18,20,'#352b55')}if(level===4){for(let x=60;x<500;x+=40){c.fillStyle=x%80?'#ffdf53':'#ef6b9a';c.beginPath();c.moveTo(x,y);c.lineTo(x+22,y);c.lineTo(x+11,y+17);c.fill()}}}}
}
function guardOutfit(g){if(level===3){rect(-16,-14,32,20,'#e9a582');rect(-12,4,24,8,'#e12a50');rect(-15,-13,30,5,'#e12a50');rect(-13,-31,26,9,'#f34869')}else if(level===1){rect(-21,-30,42,5,'#ce8466');rect(-11,-39,22,10,'#a6334b');rect(-13,-3,26,12,'#8f243f')}else if(level===2){rect(-16,-14,9,23,'#ff6475');rect(7,-14,9,23,'#ff6475')}else if(level===4){rect(-20,-30,40,5,'#f1627b');rect(-6,-13,12,5,'#ffe2a5')}else if(level===5){rect(-15,-12,30,5,'#ff9aa5');rect(-15,0,30,4,'#ff9aa5');rect(-16,-23,4,15,'#2d2444')}}
let lastGuardShout=-Infinity;
function guardShout(){if(muted||!('speechSynthesis'in window)||worldTime-lastGuardShout<2.5)return;
// Avoid building a speech queue behind stage announcements.
if(speechSynthesis.speaking||speechSynthesis.pending)return;
let voices=speechSynthesis.getVoices(),portuguese=voices.filter(v=>/^pt/i.test(v.lang));
let male=/male|masculin|antonio|antônio|daniel|duarte|felipe|ricardo|joao|joão|jorge|paulo/i;
let voice=portuguese.find(v=>male.test(v.name)&&!/female/i.test(v.name))||portuguese[0];
const phrases=['Pega ele!','Vem aqui','Vou te pegar','Vem nenem!'];let shout=new SpeechSynthesisUtterance(phrases[Math.floor(Math.random()*phrases.length)]);shout.lang='pt-BR';if(voice)shout.voice=voice;shout.pitch=.65;shout.rate=1.15;shout.volume=1;lastGuardShout=worldTime;speechSynthesis.speak(shout);
}
function drawRunner(x,y,{guard=false,seated=false,phase=0,animate=false}={}){
let stride=animate&&!seated?Math.sin(worldTime*13+phase):0,bounce=animate&&!seated?Math.abs(Math.sin(worldTime*13+phase))*4:0;
c.save();c.translate(x,y);rect(-16,23,32,5,'#24203755');c.translate(0,-bounce);
const skin='#dfab84',legs=guard?(level===3?skin:'#711d35'):'#273f4c';
function limb(ax,ay,bx,by,cx,cy,color,width){c.strokeStyle=color;c.lineWidth=width;c.lineCap='square';c.lineJoin='round';c.beginPath();c.moveTo(ax,ay);c.lineTo(bx,by);c.lineTo(cx,cy);c.stroke()}
if(seated){rect(-10,5,7,8,legs);rect(3,5,7,8,legs);rect(-18,-7,6,14,skin);rect(12,-7,6,14,skin)}else{
// Bent knees and opposing elbow swings make the forward run readable on phones.
for(const side of [-1,1]){let swing=stride*side,footX=side*(9+Math.abs(swing)*5),footY=22+swing*12;
limb(side*6,7,side*(8+Math.max(0,-swing)*7),16+swing*5,footX,footY,legs,7);
rect(footX-5,footY-2,11,6,'#292238');rect(footX-5,footY+3,11,2,'#f9e7ce');
limb(side*12,-9,side*(19+Math.abs(swing)*3),-3-swing*9,side*17,5-swing*13,skin,6);
}
}
rect(-12,-13,24,23,guard?'#d63050':'#ffd64f');rect(-8,-27,16,16,skin);rect(-9,-29,18,7,guard?'#8e183e':'#33382e');
if(guard){rect(-13,-31,26,9,'#8e183e');rect(-4,-29,8,4,'#ffdd54');rect(-6,-21,4,3,'#251345');rect(3,-21,4,3,'#251345');guardOutfit()}
c.restore();}
function draw(dt){
if(finale){drawFinale();return}
const moving=running&&!paused&&!flight;
if(moving){streetOffset=(streetOffset+dt*180)%120;chaseTime+=dt;nextGuard-=dt;updateTraffic(dt);
if(nextGuard<=0){guards.push({x:75+Math.random()*410,y:-60,kind:'interceptor',speed:70+level*7,age:0,shouted:false});nextGuard=Math.max(1.1,2.8-level*.18)+Math.random()*.8;tone(180,.12,'sawtooth',.025)}
for(const g of guards){g.age+=dt;let dx=player.x-g.x;g.x+=Math.sign(dx)*Math.min(Math.abs(dx),g.speed*dt);g.y+=dt*115;if(!g.shouted&&Math.hypot(g.x-player.x,g.y-player.y)<175){g.shouted=true;if(Math.random()<.35)guardShout()}if(level===2?Math.abs(g.x-player.x)<44&&Math.abs(g.y-player.y)<76:Math.hypot(g.x-player.x,g.y-player.y)<29)hit()}
guards=guards.filter(g=>g.y<760&&g.y>-100&&g.age<12);
}
scenery();drawTraffic();
for(const g of guards){if(level===2)drawBoat(g.x,g.y,true);drawRunner(g.x,g.y,{guard:true,seated:level===2,phase:g.x*.04,animate:level!==2&&running})}

if(flight){rect(0,0,560,672,'#88bcc9');for(let i=0;i<8;i++){let y=(i*120+flight*50)%760-70;rect(i%2*280+30,y,160,30,'#d9e7df')}c.save();c.translate(280,330);rect(-12,-65,24,130,'#f7f4dc');rect(-100,-5,200,22,'#f7f4dc');rect(-44,48,88,15,'#f7f4dc');rect(-8,-40,16,22,'#304e5d');c.restore();c.fillStyle='#203e4b';c.font='bold 19px sans-serif';c.textAlign='center';c.fillText('NEXT STOP: NEW YORK',280,530)}else if(!inv||Math.floor(inv*10)%2===0){let{x,y}=player;if(level===2)drawBoat(x,y);drawRunner(x,y,{seated:level===2,animate:level!==2&&running})}
}
// Scripted finale: board (5s), cruise (10s), land (5s), celebrate (10s).
let finale=null,finaleTime=0;
function announce(text){if(!muted&&'speechSynthesis'in window){let voice=new SpeechSynthesisUtterance(text);voice.rate=1.15;speechSynthesis.speak(voice)}}
let songGeneration=0;
const victoryLyrics=[
"Baby, I'm from New York (Oh, yeah)",
"Concrete jungle where dreams are made of (Oh, come on)",
"There's nothin' you can't do (Come on)",
"Now you're in New York (Oh, yeah)",
"These streets will make you feel brand-new (Oh, come on)",
"Big lights will inspire you (Big shine)",
"Hear it for New York (Uh), New York (Yeah), New York (Uh)"
];
let songPlaying=false;
function stopVictorySong(){songGeneration++;songPlaying=false;$('#victory-lyrics').textContent=''}
function speakVictory(){if(muted||!('speechSynthesis'in window))return;const generation=++songGeneration;let line=0;songPlaying=true;
function next(){if(generation!==songGeneration)return;if(muted||line>=victoryLyrics.length){songPlaying=false;$('#victory-lyrics').textContent='';return}let text=victoryLyrics[line++],voice=new SpeechSynthesisUtterance(text);voice.lang='en-US';voice.rate=1;voice.pitch=1;voice.onstart=()=>{if(generation===songGeneration)$('#victory-lyrics').textContent=text};voice.onend=next;voice.onerror=()=>{if(generation===songGeneration){songPlaying=false;$('#victory-lyrics').textContent=''}};speechSynthesis.speak(voice)}next()}
let fireworks=[],fireworkClock=0;
function fireworkBoom(){if(!audio||muted)return;let buffer=audio.createBuffer(1,Math.floor(audio.sampleRate*.65),audio.sampleRate),data=buffer.getChannelData(0);for(let i=0;i<data.length;i++)data[i]=(Math.random()*2-1)*Math.exp(-i/data.length*7);let source=audio.createBufferSource(),gain=audio.createGain();source.buffer=buffer;gain.gain.value=.13;source.connect(gain).connect(audio.destination);source.start();tone(55,.45,'sine',.09)}
function updateFireworks(dt){fireworkClock-=dt;if(fireworkClock<=0){fireworkClock=.7+Math.random()*.6;fireworks.push({x:60+Math.random()*440,y:310,target:65+Math.random()*150,age:0,burst:false,color:['#ff4f92','#ffdf42','#63f2e7','#c28aff'][Math.floor(Math.random()*4)]});tone(650+Math.random()*400,.3,'sine',.018)}for(const f of fireworks){if(!f.burst){f.y-=dt*220;if(f.y<=f.target){f.burst=true;f.age=0;fireworkBoom()}}else f.age+=dt}fireworks=fireworks.filter(f=>f.age<1.6)}
function drawFireworks(){for(const f of fireworks){if(!f.burst){rect(f.x,f.y,3,16,'#fff1ad');continue}c.save();c.globalAlpha=1-f.age/1.6;c.strokeStyle=f.color;c.lineWidth=3;for(let i=0;i<20;i++){let angle=i*Math.PI/10,r=f.age*65;c.beginPath();c.moveTo(f.x+Math.cos(angle)*r*.7,f.y+Math.sin(angle)*r*.7+f.age*f.age*12);c.lineTo(f.x+Math.cos(angle)*r,f.y+Math.sin(angle)*r+f.age*f.age*12);c.stroke()}c.restore()}}
function beginFinale(){fireworks=[];fireworkClock=0;guards=[];traffic=[];clearInput();flight=30;finale='boarding';finaleTime=0;announce('Go! Go! Go!');tone(660,.3)}
function advanceFinale(dt){if(finale==='party')updateFireworks(dt);finaleTime+=dt;flight=Math.max(.01,30-finaleTime);let next=finaleTime<5?'boarding':finaleTime<15?'cruise':finaleTime<20?'landing':'party';if(next!==finale){finale=next;if(next==='cruise')tone(100,2,'sawtooth',.025);if(next==='landing'){level=6;setup();tone(180,1,'triangle')}if(next==='party'){tone(880,.5);speakVictory()}}if(finaleTime>=30&&!songPlaying){flight=0;finish(true);announce('Congratulations!')}}
function person(x,y,shirt,arms=false){rect(x-9,y+10,7,18,'#293451');rect(x+3,y+10,7,18,'#293451');rect(x-12,y-10,24,24,shirt);rect(x-8,y-26,16,16,'#dfab84');rect(x-9,y-29,18,6,'#352a38');rect(x-19,y+(arms?-20:-5),6,17,'#dfab84');rect(x+13,y+(arms?-20:-5),6,17,'#dfab84')}
function plane(x,y,scale=1){c.save();c.translate(x,y);c.scale(scale,scale);rect(-105,-16,210,34,'#fff5e1');rect(-22,-70,35,140,'#e0e4ef');rect(-95,-45,18,90,'#f65289');rect(60,-12,25,14,'#53b6cf');for(let i=-65;i<55;i+=25)rect(i,-10,12,10,'#50688a');rect(-47,5,18,29,'#34243b');c.restore()}
function caption(text,y=90){c.textAlign='center';c.font='bold 25px sans-serif';c.fillStyle='#251345';c.fillText(text,280,y)}
function drawFinale(){let t=finaleTime;rect(0,0,560,672,finale==='party'?'#ffe6ab':'#9dd8f3');
if(finale==='boarding'){rect(0,300,560,372,'#73798a');for(let y=340;y<670;y+=90)rect(265,y,12,45,'#fff4c4');plane(320,290);let walk=Math.min(1,t/3.8);if(t<4.1)drawRunner(120+walk*162,560-walk*245,{animate:t<3.8});person(378,380,'#6b40bc',Math.sin(t*12)>0);rect(320,395,210,50,'#fff4c4');caption('Go! Go! Go!',429);caption('LAST CALL. FIRST CHANCE.');}
else if(finale==='cruise'){for(let i=0;i<9;i++){let x=((i*157-(t-5)*90)%750+750)%750-150;rect(x,130+i%4*120,135,24,'#fff8e9')}plane(280+Math.sin(t)*15,330+Math.sin(t*2)*12);caption('NEXT STOP: NEW YORK');caption('Somewhere above the clouds…',585)}
else{for(let i=0;i<10;i++){let h=80+(i*47)%145;rect(i*60,310-h,48,h,['#7965b5','#576c9e','#a276b2'][i%3]);for(let y=320-h;y<300;y+=25)rect(i*60+10,y,8,10,'#ffe69c')}rect(0,310,560,362,'#646783');rect(0,400,560,7,'#fff0b6');if(finale==='landing'){let f=Math.min(1,(t-15)/5);plane(70+f*290,150+f*215,.6+f*.4);caption('WELCOME TO NYC!')}else{plane(370,360,.65);for(let i=0;i<12;i++){let x=35+(i%6)*96,y=450+Math.floor(i/6)*150;person(x,y+Math.sin(t*6+i)*5,['#fa6b9c','#53cbd5','#9d73dd'][i%3],true)}person(280,510+Math.sin(t*7)*5,'#ffd64f',true);for(let i=0;i<90;i++){let x=(i*73+t*18)%560,y=(i*91+t*100)%672;rect(x,y,5,9,['#ff4c83','#ffdf38','#57e4ec','#9150d5'][i%4])}caption(t>25?'Congratulations!':'YOU MADE IT!',80);drawFireworks();caption('NEW YORK LOVES YOU.',120)}}}
// Original looping stage themes. Null melody steps are intentional rests.
const stageMusic=[
{name:'Downtown Dash',bpm:126,root:146.83,wave:'square',melody:[12,null,15,19,17,15,null,10,12,19,22,null,19,17,15,10],bass:[0,0,3,5],chords:[0,3,5,3],swing:0},
{name:'Country Getaway',bpm:104,root:130.81,wave:'triangle',melody:[12,16,19,16,14,17,21,17,16,19,24,19,14,17,19,12],bass:[0,7,5,7],chords:[0,5,0,7],swing:.16},
{name:'River Current',bpm:88,root:164.81,wave:'sine',melody:[12,null,19,24,null,22,19,null,17,null,21,26,24,null,21,17],bass:[0,5,9,7],chords:[0,5,9,7],swing:0},
{name:'Sunburn Sprint',bpm:116,root:174.61,wave:'sine',melody:[12,19,null,21,24,null,21,19,17,21,null,24,26,24,21,null],bass:[0,7,5,7],chords:[0,0,5,7],swing:.08},
{name:'Plaza Pursuit',bpm:138,root:146.83,wave:'triangle',melody:[12,null,15,19,null,20,19,15,17,null,20,24,22,null,20,17],bass:[0,7,5,7],chords:[0,5,7,0],swing:0},
{name:'Final Boarding',bpm:144,root:123.47,wave:'sawtooth',melody:[12,19,24,19,14,21,26,21,15,22,27,22,14,21,26,33],bass:[0,2,3,2],chords:[0,2,3,7],swing:0},
{name:'New York Homecoming',bpm:112,root:130.81,wave:'triangle',melody:[12,16,19,null,24,23,21,19,17,21,24,null,26,24,23,24],bass:[0,5,9,7],chords:[0,5,9,7],swing:.1}
];
let musicStep=0,musicClock=0,musicLevel=-1;
function playStageMusic(dt){if(songPlaying)return;if(musicLevel!==level){musicLevel=level;musicStep=0;musicClock=0}musicClock-=dt;if(musicClock>0)return;
const theme=stageMusic[level],step=musicStep++%16,quarter=60/theme.bpm,unit=quarter/2;
musicClock+=unit*(1+(step%2?-theme.swing:theme.swing));let note=theme.melody[step];
if(note!==null)tone(theme.root*2**(note/12),unit*.85,theme.wave,level===5?.018:.035);
if(step%4===0){let bass=theme.bass[Math.floor(step/4)];tone(theme.root/2*2**(bass/12),quarter*.8,'triangle',.065)}
if(level===0){if(step%4===0)tone(55,.11,'sine',.08);if(step%4===2)tone(175,.055,'triangle',.035);if(step%2)tone(2600,.025,'square',.008)}
if(level===1){if(step%2===0)tone(theme.root*2**((theme.chords[Math.floor(step/4)]+7)/12),.09,'triangle',.025)}
if(level===2&&step%4===2){tone(theme.root*4,.5,'sine',.018);tone(110,.12,'sine',.035)}
if(level===3&&step%2===1){let chord=theme.root*2**(theme.chords[Math.floor(step/4)]/12);tone(chord,.1,'triangle',.025);tone(chord*1.25,.1,'sine',.025)}
if(level===4){if([0,3,6,10,12].includes(step))tone(850,.035,'square',.018);if([2,5,8,14].includes(step))tone(190,.09,'sine',.05)}
if(level===5){if(step%2===0)tone(50,.1,'sine',.08);tone(3200,.02,'square',.006)}
if(level===6&&step%4===0){let chord=theme.root*2**(theme.chords[Math.floor(step/4)]/12);for(let ratio of [1,1.25,1.5])tone(chord*ratio,quarter*1.6,'sine',.02)}
}
function frame(t){let dt=Math.min((t-last)/1000,.04);last=t;if(running&&!paused){worldTime+=dt;if(!flight&&!finale)updateMovement(dt);inv=Math.max(0,inv-dt);playStageMusic(dt);if(flight){advanceFinale(dt)}else{progress+=dt*14;scroll+=dt*8;if(godMode){player.y=Math.min(640,player.y);player.x=Math.max(18,Math.min(542,player.x))}if(player.y>660||player.x<0||player.x>560)hit();if(scroll>160){if(level<6)rewardStageClear();tone(880,.4);if(level===6)finish(true);else if(level===5){beginFinale()}else{level++;setup();inv=2}}}}draw(dt);$('#lives').textContent='♥ '.repeat(lives);$('#distance').textContent=String(Math.floor(progress)).padStart(4,'0')+' M';requestAnimationFrame(frame)}
$('#start').onclick=start;$('#sound').onclick=()=>{muted=!muted;if(muted){stopVictorySong();if('speechSynthesis'in window)speechSynthesis.cancel();}$('#sound').textContent=muted?'SOUND OFF':'SOUND ON ♫'};$('#pause').onclick=()=>{if(!running)return;paused=!paused;if('speechSynthesis'in window){if(paused)speechSynthesis.pause();else speechSynthesis.resume()}clearInput();$('#pause').textContent=paused?'▶ RESUME':'Ⅱ PAUSE';tone(330)};const keys={ArrowLeft:'left',a:'left',ArrowRight:'right',d:'right'};
document.addEventListener('keydown',e=>{if(!e.repeat&&!e.ctrlKey&&!e.metaKey&&!e.altKey)cheatKey(e.key);let direction=keys[e.key]||keys[e.key.toLowerCase()];if(direction){e.preventDefault();if(running&&!paused&&!flight)held.add(direction)}if(e.code==='Space'&&!e.repeat){e.preventDefault();$('#pause').click()}});
document.addEventListener('keyup',e=>{let direction=keys[e.key]||keys[e.key.toLowerCase()];if(direction){held.delete(direction);e.preventDefault()}});
window.addEventListener('blur',clearInput);document.addEventListener('visibilitychange',()=>{if(document.hidden)clearInput()});
document.querySelectorAll('[data-m]').forEach(b=>{const [dx,dy]=b.dataset.m.split(',').map(Number),direction=dx<0?'left':dx>0?'right':dy<0?'up':'down';b.style.touchAction='none';b.addEventListener('pointerdown',e=>{if(!running||paused||flight)return;e.preventDefault();held.add(direction);b.setPointerCapture(e.pointerId)});for(const event of ['pointerup','pointercancel','lostpointercapture'])b.addEventListener(event,()=>held.delete(direction));b.onclick=e=>{if(e.detail===0)move(dx,dy)}});
let drag=null;
canvas.addEventListener('pointerdown',e=>{if(!running||paused||flight||drag)return;e.preventDefault();drag={id:e.pointerId,startX:e.clientX,playerX:player.x};held.clear();canvas.setPointerCapture(e.pointerId)});
canvas.addEventListener('pointermove',e=>{if(!drag||e.pointerId!==drag.id||!running||paused||flight)return;e.preventDefault();let scale=canvas.width/canvas.getBoundingClientRect().width;target={x:Math.max(66,Math.min(494,drag.playerX+(e.clientX-drag.startX)*scale))}});
function releaseDrag(e){if(drag&&e.pointerId===drag.id){drag=null;target=null}}
for(const event of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(event,releaseDrag);
window.addEventListener('blur',()=>{drag=null});
setup();requestAnimationFrame(frame);

for(const event of ['contextmenu','selectstart','dragstart'])document.addEventListener(event,e=>e.preventDefault());
