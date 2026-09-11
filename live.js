(()=>{'use strict';
const STORAGE_KEY='bb-scorekeeper-dbv-2024-v8';
const $=s=>document.querySelector(s);
let lastRaw=null;
let selectedInning=null;
let followCurrent=true;

function loadState(){
  try{
    const raw=localStorage.getItem(STORAGE_KEY);
    if(!raw)return ScorekeeperCore.defaultState();
    return ScorekeeperCore.ensureStateShape(JSON.parse(raw));
  }catch{return ScorekeeperCore.defaultState();}
}
function runnerText(r){if(!r)return'-';return [r.number?`#${r.number}`:'',r.name].filter(Boolean).join(' ');}
function setBase(id,runner){
  const el=$(id);const label=el.querySelector('strong');const text=runnerText(runner);
  el.classList.toggle('occupied',!!runner);label.textContent=text;label.title=runner?text:'';
  el.setAttribute('aria-label',`${el.querySelector('span').textContent}: ${text}`);
}
const POSITION_NAMES={1:'P',2:'C',3:'1B',4:'2B',5:'3B',6:'SS',7:'LF',8:'CF',9:'RF',DH:'DH'};
function renderDefense(state,side){
  const box=$('#liveDefense');box.innerHTML='';
  const fieldBox=$('#fieldDefense');fieldBox.innerHTML='';
  const team=state.teams?.[side]||{};const rows=[];
  const positionCode=value=>POSITION_NAMES[String(value||'')]||String(value||'');
  const playerPosition=player=>[player?.pos1,player?.pos2].map(positionCode).find(code=>Object.prototype.hasOwnProperty.call(fieldPositions,code))||'';
  const fieldPositions={P:'field-p',C:'field-c','1B':'field-1b','2B':'field-2b','3B':'field-3b',SS:'field-ss',LF:'field-lf',CF:'field-cf',RF:'field-rf'};
  const teamSlots=(team.slots||[]).some(slot=>(slot.players||[]).some(player=>player.name||player.number))
    ? team.slots
    : (side===state.activeSide ? state.slots : []);
  const namedPlayers=[];
  teamSlots.forEach((slot,index)=>{
    const p=(slot.players||[]).find(player=>(player.name||player.number)&&playerPosition(player));
    if(!p)return;
    namedPlayers.push(p);
    rows.push([playerPosition(p)||`#${index+1}`,p]);
  });
  if(!rows.length){
    teamSlots.forEach(slot=>{
      const p=(slot.players||[]).find(player=>player.name||player.number);
      if(p)namedPlayers.push(p);
    });
    ['P','C','1B','2B','3B','SS','LF','CF','RF'].forEach((position,index)=>{
      if(namedPlayers[index])rows.push([position,namedPlayers[index]]);
    });
  }
  if(!rows.some(([position])=>position==='P')) (team.pitchers||[]).filter(p=>p.name||p.number).slice(0,1).forEach(p=>rows.push(['P',p]));
  if(!rows.some(([position])=>position==='C')) (team.catchers||[]).filter(p=>p.name||p.number).slice(0,1).forEach(p=>rows.push(['C',p]));
  const positionRows=new Map();
  rows.forEach(([position,p])=>{if(fieldPositions[position]&&!positionRows.has(position))positionRows.set(position,p);});
  Object.keys(fieldPositions).forEach(position=>{
    const p=positionRows.get(position)||{};
    if(!p.name&&!p.number)return;
    const code=fieldPositions[position];if(!code)return;
    const item=document.createElement('div');item.className=`field-position ${code}`;
    const name=document.createElement('span');name.textContent=p.name||`#${p.number}`;
    const badge=document.createElement('b');badge.textContent=position;
    item.title=`${name.textContent} · ${position}`;item.append(name,badge);fieldBox.appendChild(item);
  });
  if(!rows.length){box.innerHTML='<span class="defense-empty">No defensive lineup recorded.</span>';return;}
  rows.forEach(([position,p])=>{const item=document.createElement('div');item.className='defense-item';const pos=document.createElement('b');pos.textContent=position;const name=document.createElement('span');name.textContent=[p.number?`#${p.number}`:'',p.name||''].filter(Boolean).join(' ')||'-';item.append(pos,name);box.appendChild(item);});
}
function renderOuts(outs){Array.from($('#liveOuts').children).forEach((el,i)=>el.classList.toggle('on',i<Number(outs||0)));}
function lineValue(row,i){const v=row?.[i];return v===undefined||v===null||String(v).trim()===''?'·':String(v);}
function renderLineScore(live){
  const table=$('#liveLineScore'),head=table.querySelector('thead'),body=table.querySelector('tbody');head.innerHTML='';body.innerHTML='';
  const innings=Math.min(10,Math.max(1,(live.lineScore?.guest?.length||15)-3));
  const hr=document.createElement('tr');['',...Array.from({length:innings},(_,i)=>String(i+1)),'R','H','E'].forEach(x=>{const th=document.createElement('th');th.textContent=x;hr.appendChild(th)});head.appendChild(hr);
  [['guest',live.guest],['home',live.home]].forEach(([side,team])=>{const tr=document.createElement('tr');const th=document.createElement('th');th.textContent=team.name;tr.appendChild(th);for(let i=0;i<innings;i++){const td=document.createElement('td');td.textContent=lineValue(live.lineScore[side],i);tr.appendChild(td)};const totalIndex=Math.max(innings,(live.lineScore[side]?.length||3)-3);for(let i=0;i<3;i++){const td=document.createElement('td');td.textContent=i===0?String(team.runs):lineValue(live.lineScore[side],totalIndex+i);tr.appendChild(td)}body.appendChild(tr)});
}
function renderPlays(plays){
  const box=$('#playByPlay');box.innerHTML='';
  if(!plays.length){box.innerHTML='<div class="empty-play">Für dieses Inning sind noch keine Spielzüge erfasst.</div>';return;}
  const groups=new Map();
  plays.slice().reverse().forEach(p=>{
    const key=`${p.inning||''}-${p.half||''}`;
    if(!groups.has(key))groups.set(key,[]);
    groups.get(key).push(p);
  });
  groups.forEach((group)=>{
    const section=document.createElement('section');section.className='relay-inning';
    const heading=document.createElement('div');heading.className='relay-heading';
    heading.textContent=`${group[0].inning||''}. Inning · ${group[0].half==='BOTTOM'?'Heim':'Gast'} am Schlag`;
    section.appendChild(heading);
    group.reverse().forEach(p=>{
      const row=document.createElement('article');row.className='play';
      const meta=document.createElement('div');meta.className='play-inning';meta.textContent=p.half==='BOTTOM'?'BOTTOM':'TOP';
      const text=document.createElement('div');text.className='play-text';text.textContent=p.text;
      row.append(meta,text);section.appendChild(row);
    });
    box.appendChild(section);
  });
}
function renderInningSelector(current,plays){
  const box=$('#inningSelector');box.innerHTML='';
  if(selectedInning===null || followCurrent) selectedInning=Number(current)||1;
  const eventMax=plays.reduce((max,play)=>Math.max(max,Number(play.inning)||0),0);
  const max=Math.max(9,Number(current)||1,eventMax);
  for(let i=1;i<=max;i++){
    const button=document.createElement('button');
    button.type='button';button.textContent=`${i}. Inning`;button.className=selectedInning===i?'active':'';
    button.setAttribute('aria-selected',String(selectedInning===i));
    button.addEventListener('click',()=>{selectedInning=i;followCurrent=false;render();});
    box.appendChild(button);
  }
  const liveCount=selectedInning===Number(current)?` · Balls ${Number($('#liveBalls').textContent)||0} / Strikes ${Number($('#liveStrikes').textContent)||0}`:'';
  $('#selectedInningLabel').textContent=`${selectedInning}. Inning${liveCount}`;
}
function render(){
  const state=loadState();const live=ScorekeeperCore.buildLiveSnapshot(state);
  $('#guestName').textContent=live.guest.name;$('#homeName').textContent=live.home.name;$('#guestRuns').textContent=String(live.guest.runs);$('#homeRuns').textContent=String(live.home.runs);
  $('#liveHalf').textContent=live.half;$('#liveInning').textContent=`${live.inning||1}. Inning`;renderOuts(live.outs);
  setBase('#base1',live.bases[1]);setBase('#base2',live.bases[2]);setBase('#base3',live.bases[3]);
  const b=live.currentBatter;$('#liveBatter').textContent=`Order ${b.order} · ${[b.number?`#${b.number}`:'',b.name,b.position?`(${b.position})`:'' ].filter(Boolean).join(' ')}`;
  renderDefense(state,live.half==='BOTTOM'?'guest':'home');
  const balls=Number(live.currentAtBat?.balls||0);const strikes=Number(live.currentAtBat?.strikes||0);const outs=Number(live.outs||0);
  $('#liveBalls').textContent=String(balls);$('#liveStrikes').textContent=String(strikes);$('#liveOutCount').textContent=String(outs);
  document.querySelectorAll('.count-row').forEach(row=>{const count=row.classList.contains('count-balls')?balls:row.classList.contains('count-strikes')?strikes:outs;Array.from(row.querySelectorAll('i')).forEach((light,index)=>light.classList.toggle('on',index<count));});
  $('#liveDirection').textContent=live.currentAtBat?.hitDirection?`Direction ${live.currentAtBat.hitDirection}`:'';
  const pitches=Array.isArray(live.currentAtBat?.pitches)?live.currentAtBat.pitches:[];$('#livePitches').textContent=pitches.length?pitches.map((pitch,i)=>`${i+1}. ${pitch==='B'?'Ball':'Strike'}`).join(' · '):'No pitches recorded.';
  const warning=$('#liveWarning');warning.hidden=!live.warning;warning.textContent=live.warning||'';
  const status=$('#liveGameStatus');status.hidden=live.status!=='finished';status.textContent=live.status==='finished'?`Spiel beendet · ${live.endReason||'Beendet'}${live.endTime?` · ${live.endTime}`:''}`:'';
  renderInningSelector(live.inning,live.plays);
  const inningPlays=live.plays.filter(play=>Number(play.inning)===Number(selectedInning));
  renderPlays(inningPlays);renderLineScore(live);$('#lastUpdated').textContent=new Date().toLocaleTimeString('de-DE',{hour12:false});
}
function refreshIfChanged(){const raw=localStorage.getItem(STORAGE_KEY);if(raw!==lastRaw){lastRaw=raw;render();}}
window.addEventListener('storage',e=>{if(e.key===STORAGE_KEY){lastRaw=e.newValue;render();}});
lastRaw=localStorage.getItem(STORAGE_KEY);render();setInterval(refreshIfChanged,750);
window.BBFirebaseSync?.subscribe(remoteState=>{
  const next=JSON.stringify(remoteState);
  if(next===lastRaw)return;
  localStorage.setItem(STORAGE_KEY,next);
  lastRaw=next;
  render();
});
window.BBFirebaseSync?.watchPresence(presence=>{
  const connection=$('#connectionState');
  if(!connection)return;
  connection.textContent=presence.online?'SCORER ONLINE':'SCORER OFFLINE · SPIEL NICHT BEENDET';
});
})();
