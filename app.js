(()=>{'use strict';
const STORAGE_KEY='bb-scorekeeper-dbv-2024-v8';
const TAB_SIDE_KEY='bb-scorekeeper-active-side';
const PLAYER_NAME_ROSTER_KEY='bb-scorekeeper-player-names-v1';
const SEASON_ROSTER_URL='data/rosters-2026.json';
const LEGACY_KEYS=['bb-scorekeeper-dbv-2024-v5-1'];
const {RULE_PROFILE,SLOT_COUNT,PA_COLUMNS,BATTER_STATS,PITCHER_STATS,PITCHER_FIELDS,PLAYER_FIELDS,defaultState,defaultPlateAppearance,ensureStateShape}=ScorekeeperCore;
const resultDefaults={'1B':[1,'1B'],'2B':[2,'2B'],'3B':[3,'3B'],HR:[4,'HR'],BB:[1,'BB'],IBB:[1,'IBB'],HBP:[1,'HBP'],K:[0,'K'],GO:[0,'6-3'],FO:[0,'F8'],LO:[0,'L6'],FC:[1,'FC'],E:[1,'E6'],SF:[0,'SF8'],SH:[0,'SH']};
let state=loadState();let seasonRoster={teams:[]};ScorekeeperCore.syncPlateAppearanceEvents(state);let undoStack=[],redoStack=[],activeCell=null,activeEventEditId=null,zoom=1,rbiManualTouched=false,pendingQuickResult='',lastQuickDirectionPoint=null,lastQuickDirection='';
const $=s=>document.querySelector(s),$$=s=>Array.from(document.querySelectorAll(s)),deep=v=>JSON.parse(JSON.stringify(v));

function loadState(){
  try{
    const raw=localStorage.getItem(STORAGE_KEY) || LEGACY_KEYS.map(k=>localStorage.getItem(k)).find(Boolean);
    const loaded=raw?ensureStateShape(JSON.parse(raw)):defaultState();
    const tabSide=sessionStorage.getItem(TAB_SIDE_KEY);
    if(tabSide==='guest'||tabSide==='home')ScorekeeperCore.activateTeam(loaded,tabSide);
    return loaded;
  }catch{return defaultState();}
}
function save(){sessionStorage.setItem(TAB_SIDE_KEY,state.activeSide);localStorage.setItem(STORAGE_KEY,JSON.stringify(state));window.BBFirebaseSync?.saveState(state);}
function normalizeTeamName(name){return String(name||'').trim().toLocaleLowerCase();}
function loadPlayerNameRoster(){
  const raw=localStorage.getItem(PLAYER_NAME_ROSTER_KEY);
  if(!raw)return {};
  try{
    const roster=JSON.parse(raw);
    return roster&&typeof roster==='object'&&!Array.isArray(roster)?roster:{};
  }catch(error){
    console.warn('Saved player name roster could not be read:',error);
    return {};
  }
}
function savePlayerName(teamName,name){
  const cleanName=String(name||'').trim();
  const teamKey=normalizeTeamName(teamName);
  if(!cleanName||!teamKey)return;
  const roster=loadPlayerNameRoster();
  const names=Array.isArray(roster[teamKey])?roster[teamKey]:[];
  if(!names.some(existing=>existing.localeCompare(cleanName,undefined,{sensitivity:'accent'})===0)){
    roster[teamKey]=[...names,cleanName].sort((a,b)=>a.localeCompare(b));
    localStorage.setItem(PLAYER_NAME_ROSTER_KEY,JSON.stringify(roster));
  }
}
async function loadSeasonRoster(){
  try{
    const response=await fetch(SEASON_ROSTER_URL,{cache:'no-store'});
    if(!response.ok)throw new Error(`HTTP ${response.status}`);
    const roster=await response.json();
    if(!roster||!Array.isArray(roster.teams))throw new Error('Invalid roster format');
    seasonRoster=roster;
  }catch(error){
    console.warn('Season roster could not be loaded; local names remain available:',error);
  }
  refreshTeamSuggestions();
  renderAll();
}
function refreshTeamSuggestions(){
  const list=$('#season-team-suggestions');
  if(!list)return;
  const current=[state.game?.guest,state.game?.home].map(name=>String(name||'').trim()).filter(Boolean);
  const names=[...seasonRoster.teams.map(team=>team.name),...current]
    .map(name=>String(name||'').trim()).filter(Boolean)
    .filter((name,index,all)=>all.findIndex(candidate=>candidate.localeCompare(name,undefined,{sensitivity:'accent'})===0)===index)
    .sort((a,b)=>a.localeCompare(b));
  list.replaceChildren(...names.map(name=>{const option=document.createElement('option');option.value=name;return option;}));
  $$('.team-picker').forEach(select=>{
    const selected=state.game?.[select.dataset.teamPicker]||'';
    select.replaceChildren(new Option('팀 선택', ''), ...names.map(name=>new Option(name,name)));
    select.value=names.includes(selected)?selected:'';
  });
}
function playerNameSuggestions(teamName){
  const teamKey=normalizeTeamName(teamName);
  const saved=loadPlayerNameRoster()[teamKey];
  const current=(state.teams?.[state.activeSide]?.slots||[]).flatMap(slot=>(slot.players||[]).map(player=>player.name));
  const imported=seasonRoster.teams
    .filter(team=>normalizeTeamName(team.name)===teamKey)
    .flatMap(team=>(Array.isArray(team.players)?team.players:[]).map(player=>player.name));
  return [...new Set([...(Array.isArray(saved)?saved:[]),...imported,...current].map(name=>String(name||'').trim()).filter(Boolean))]
    .sort((a,b)=>a.localeCompare(b));
}
function refreshPlayerNameSuggestions(){
  const teamName=state.game?.[state.activeSide]||'';
  const names=playerNameSuggestions(teamName);
  $$('.player-name-control input[list]').forEach(input=>{
    const list=document.getElementById(input.getAttribute('list'));
    if(!list)return;
    list.replaceChildren(...names.map(name=>{const option=document.createElement('option');option.value=name;return option;}));
  });
}
function downloadJson(){const payload={schemaVersion:'6.1',ruleProfile:RULE_PROFILE,game:state.game,lineScore:state.lineScore,teams:state.teams,slots:state.slots,pitchers:state.pitchers,catchers:state.catchers,events:[...(state.events||[])].sort((a,b)=>(Number(a.sequence)||0)-(Number(b.sequence)||0))};const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`BB_Scorekeeper_${state.game.gameNo||state.game.date||'game'}.json`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),0);}
function pushHistory(){undoStack.push(deep(state));if(undoStack.length>100)undoStack.shift();redoStack=[];updateUndo();}
function undo(){if(!undoStack.length)return;redoStack.push(deep(state));state=undoStack.pop();save();renderAll();updateUndo();}
function redo(){if(!redoStack.length)return;undoStack.push(deep(state));state=redoStack.pop();save();renderAll();updateUndo();}
function updateUndo(){$('#undoBtn').disabled=!undoStack.length;$('#redoBtn').disabled=!redoStack.length;}
function getPath(obj,path){return path.split('.').reduce((o,k)=>o?.[k],obj)}
function setPath(obj,path,value){const parts=path.split('.');const last=parts.pop();const target=parts.reduce((o,k)=>o[k],obj);target[last]=value;}
function bindPathInputs(root=document){root.querySelectorAll('[data-path]').forEach(el=>{const path=el.dataset.path;const value=getPath(state,path);if(el.type==='checkbox')el.checked=!!value;else el.value=value??'';el.onchange=()=>{pushHistory();const v=el.type==='checkbox'?el.checked:el.value;setPath(state,path,v);if((path==='teamPitcher'||path==='comments')&&state.teams?.[state.activeSide])state.teams[state.activeSide][path]=v;if(path===`game.${state.activeSide}`)refreshPlayerNameSuggestions();if(path==='game.guest'||path==='game.home'){refreshTeamSuggestions();refreshPlayerNameSuggestions();}save();};});}
$$('.team-picker').forEach(select=>select.onchange=()=>{const path=`game.${select.dataset.teamPicker}`;const input=document.querySelector(`[data-path="${path}"]`);if(!input)return;pushHistory();setPath(state,path,select.value);input.value=select.value;refreshTeamSuggestions();refreshPlayerNameSuggestions();save();});
function renderLineScore(){['guest','home'].forEach(team=>{const holder=$(`#${team}LineScore`);holder.innerHTML='';const row=document.createElement('div');row.className='line-score-row';state.lineScore[team].forEach((v,i)=>{const input=document.createElement('input');input.value=v;input.setAttribute('aria-label',`${team} line score ${i+1}`);input.onchange=()=>{pushHistory();state.lineScore[team][i]=input.value;save();};row.appendChild(input);});holder.appendChild(row);});}
function makeInput(value,onchange,cls='',field=''){const input=document.createElement('input');input.value=value??'';if(cls)input.className=cls;if(field)input.dataset.field=field;input.onchange=()=>{pushHistory();onchange(input.value);save();};return input;}
const POSITION_OPTIONS=[['',''],['1','1 · P'],['2','2 · C'],['3','3 · 1B'],['4','4 · 2B'],['5','5 · 3B'],['6','6 · SS'],['7','7 · LF'],['8','8 · CF'],['9','9 · RF'],['DH','DH']];
function makePositionSelect(value,onchange,field){
  const select=document.createElement('select');select.dataset.field=field;select.title='Defensive position';
  POSITION_OPTIONS.forEach(([code,label])=>{const option=document.createElement('option');option.value=code;option.textContent=label||'—';select.appendChild(option);});
  const current=String(value??'');if(current && !POSITION_OPTIONS.some(([code])=>code===current)){const option=document.createElement('option');option.value=current;option.textContent=current;select.appendChild(option);}
  select.value=current;select.onchange=()=>{pushHistory();onchange(select.value);save();};return select;
}

function makePlayerNameControl(slotIndex,playerIndex,player){
  const wrap=document.createElement('div');wrap.className='player-name-control';
  const listId=`player-name-suggestions-${state.activeSide}`;
  let list=document.getElementById(listId);
  if(!list){list=document.createElement('datalist');list.id=listId;document.body.appendChild(list);}
  const input=makeInput(player.name,v=>{player.name=v;savePlayerName(state.game?.[state.activeSide],v);refreshPlayerNameSuggestions();},'','name');
  input.setAttribute('list',listId);
  input.placeholder='선수 이름 입력 또는 선택';
  input.title='등록된 이름을 선택하거나 새 이름을 직접 입력할 수 있습니다.';
  wrap.appendChild(input);
  if(playerIndex>0){const del=document.createElement('button');del.type='button';del.className='mini-delete';del.textContent='×';del.title='Ersatzspieler löschen';del.onclick=e=>{e.stopPropagation();const linked=state.slots[slotIndex].plateAppearances.some(pa=>pa&&Number(pa.playerIndex)===playerIndex);if(linked){alert('Diesem Spieler sind Plate Appearances zugeordnet. Ändern oder löschen Sie diese zuerst.');return;}pushHistory();ScorekeeperCore.removePlayer(state,slotIndex,playerIndex);save();renderMain();};wrap.appendChild(del);}
  return wrap;
}

function renderMain(){
  const derived=ScorekeeperCore.calculateBatterStats(state);
  const body=$('#mainScoreBody');body.innerHTML='';
  const listId=`player-name-suggestions-${state.activeSide}`;
  document.getElementById(listId)?.remove();
  const columnCount=Math.max(10,Math.min(PA_COLUMNS,Number(state.game.scoreColumns)||10));
  const header=$('#mainScoreTable thead tr');
  header.querySelectorAll('.inning-head').forEach(cell=>cell.remove());
  const statHeader=header.querySelector('.batter-stat-head');
  for(let i=1;i<=columnCount;i++){const th=document.createElement('th');th.className='inning-head';th.title=`Inning ${i}`;th.textContent=String(i);header.insertBefore(th,statHeader);}
  for(let s=0;s<SLOT_COUNT;s++){
    const slot=state.slots[s];
    const rowSpan=slot.players.length;
    slot.players.forEach((player,sub)=>{
      const tr=document.createElement('tr');tr.className='player-line'+(sub===0?' batting-slot batting-slot-start':'');tr.dataset.slot=s;tr.dataset.sub=sub;
      PLAYER_FIELDS.forEach(field=>{const td=document.createElement('td');if(field==='name'){td.className='player-name';td.appendChild(makePlayerNameControl(s,sub,player));}else if(field==='pos1'||field==='pos2'){td.appendChild(makePositionSelect(player[field],v=>player[field]=v,field));}else td.appendChild(makeInput(player[field],v=>player[field]=v,'',field));tr.appendChild(td);});
      if(sub===0){
        const order=document.createElement('td');order.className='order-cell';order.rowSpan=rowSpan;
        const num=document.createElement('strong');num.textContent=s+1;order.appendChild(num);
        const add=document.createElement('button');add.type='button';add.className='add-player-btn';add.textContent='＋';add.title='Ersatzspieler zu dieser Batting Order hinzufügen';add.onclick=e=>{e.stopPropagation();pushHistory();ScorekeeperCore.addPlayer(state,s);save();renderMain();};order.appendChild(add);tr.appendChild(order);
        for(let inningColumn=0;inningColumn<columnCount;inningColumn++){const td=createScoreCell(s,inningColumn);td.rowSpan=rowSpan;tr.appendChild(td);}
      }
      const statLine=derived[s]?.[sub]||{};
      BATTER_STATS.forEach(stat=>{const td=document.createElement('td');const inp=document.createElement('input');const value=Number(statLine[stat])||0;inp.value=value?String(value):'';inp.className='stat-input derived-stat';inp.readOnly=true;inp.title='Automatisch aus Ereignissen berechnet';td.appendChild(inp);tr.appendChild(td);});
      body.appendChild(tr);
    });
  }
  const foot=$('#mainScoreFoot');foot.innerHTML='';const tr=document.createElement('tr');const th=document.createElement('th');th.colSpan=13+columnCount;th.textContent='Gesamt';tr.appendChild(th);BATTER_STATS.forEach(stat=>{const td=document.createElement('td');const total=sumDerivedStat(derived,stat);td.textContent=total?String(total):'';tr.appendChild(td)});foot.appendChild(tr);
  refreshPlayerNameSuggestions();
}
function sumDerivedStat(derived,stat){let n=0;derived.forEach(slot=>slot.forEach(line=>{n+=Number(line?.[stat])||0;}));return n;}
function existingPaIndexForInning(slot,inning){
  return slot.plateAppearances.findIndex(pa=>pa&&Number(pa.inning)===Number(inning));
}
function newPaIndexForInning(slot,inning){
  const inningIndex=Number(inning)-1;
  if(inningIndex>=0&&inningIndex<slot.plateAppearances.length&&!slot.plateAppearances[inningIndex])return inningIndex;
  return slot.plateAppearances.findIndex(pa=>!pa);
}
function createScoreCell(slotIndex,inningColumn){
  const slot=state.slots[slotIndex];
  const paIndex=inningColumn;
  const raw=slot.plateAppearances[paIndex]||null;
  const data=raw?ScorekeeperCore.getPlateAppearanceDisplayState(state,slotIndex,paIndex):null;
  const td=document.createElement('td');td.className='score-slot';td.dataset.slot=slotIndex;td.dataset.paIndex=paIndex;td.dataset.inning=data?.inning||'';
  const paNo=document.createElement('span');paNo.className='pa-index';paNo.textContent=String(inningColumn+1);td.appendChild(paNo);
  if(data?.inning){const inn=document.createElement('span');inn.className='cell-inning-label';inn.textContent=`${data.inning}`;td.appendChild(inn);}
  const diamond=document.createElement('div');diamond.className='score-diamond';const activeEdges=new Set(ScorekeeperCore.getDiamondEdges(data?.finalBase||0));for(let i=1;i<=4;i++){const edgeName=`e${i}`;const e=document.createElement('span');e.className=`edge ${edgeName}${activeEdges.has(edgeName)?' on':''}`;diamond.appendChild(e);}td.appendChild(diamond);
  if(data?.scored){const dot=document.createElement('span');dot.className='run-dot';dot.textContent='●';td.appendChild(dot);}
  if(data?.result){const r=document.createElement('span');r.className='cell-result';r.textContent=data.result;td.appendChild(r);}
  if(data?.notation){const n=document.createElement('span');n.className='cell-notation';n.textContent=data.notation;td.appendChild(n);}
  if(data?.hitDirection){const d=document.createElement('span');d.className='cell-direction';d.textContent=data.hitDirection;td.appendChild(d);}
  if(data?.runnerNotation){const rn=document.createElement('span');rn.className='cell-runner-note';rn.textContent=data.runnerNotation;td.appendChild(rn);}
  if(raw && Number.isInteger(Number(raw.playerIndex))){const p=state.slots[slotIndex].players[Number(raw.playerIndex)];if(p){const who=document.createElement('span');who.className='cell-player-tag';who.textContent=p.number?`#${p.number}`:(p.name?String(p.name).slice(0,6):'');td.appendChild(who);}}
  td.title=data?.memo||'';
  if(paIndex>=0)td.onclick=()=>openEntry(slotIndex,paIndex);
  else td.classList.add('score-slot-empty');
  return td;
}

function renderPitchers(){
  const body=$('#pitcherBody');body.innerHTML='';
  const pitchingSide=state.activeSide==='home'?'home':'guest';
  const title=$('#pitcherTableTitle');
  if(title) title.textContent=`Pitcher · ${state.game?.[pitchingSide]|| (pitchingSide==='home'?'Heim':'Gast')}`;
  const label=$('#currentPitcherLabel');
  const defensiveSide=pitchingSide==='home'?'guest':'home';
  if(label) label.firstChild.textContent=`Defensiver Pitcher (${defensiveSide==='home'?'Heim':'Gast'} · ${state.game?.[defensiveSide]||''}) `;
  const pitchers=state.teams?.[pitchingSide]?.pitchers||state.pitchers;
  const derived=ScorekeeperCore.calculatePitcherStats(state,pitchingSide);
  pitchers.forEach((p,i)=>{const tr=document.createElement('tr');tr.className='pitcher-row';PITCHER_FIELDS.forEach(field=>{const td=document.createElement('td');if(field==='name'){td.className='pitcher-name';const wrap=document.createElement('div');wrap.className='pitcher-name-control';wrap.appendChild(makeInput(p[field],v=>p[field]=v));if(i>=4){const del=document.createElement('button');del.type='button';del.className='mini-delete';del.textContent='×';del.title='Pitcher löschen';del.onclick=e=>{e.stopPropagation();pushHistory();  ScorekeeperCore.removePitcher(state,i,pitchingSide);save();renderPitchers();};wrap.appendChild(del);}td.appendChild(wrap);}else if(PITCHER_STATS.includes(field)&&!['R','ER','WLS','WP','BK'].includes(field)){const input=document.createElement('input');input.value=p[field]!==''&&p[field]!==undefined?p[field]:(derived[i]?.[field]||'');input.className='derived-stat';input.title='Automatisch berechnet; manuell überschreibbar';input.onchange=()=>{pushHistory();p[field]=input.value;save();};td.appendChild(input);}else td.appendChild(makeInput(p[field],v=>p[field]=v));tr.appendChild(td)});body.appendChild(tr)});$('#pitcherTotals').textContent='';
}
function renderCatchers(){const body=$('#catcherBody');body.innerHTML='';state.catchers.forEach(c=>{const tr=document.createElement('tr');tr.className='catcher-row';['name','PB','SB','CS'].forEach(field=>{const td=document.createElement('td');if(field==='name')td.className='catcher-name';td.appendChild(makeInput(c[field],v=>c[field]=v));tr.appendChild(td)});body.appendChild(tr)});}

function populatePlayerSelect(slotIndex,selectedIndex){
  const select=$('#playerSelect');select.innerHTML='';state.slots[slotIndex].players.forEach((p,i)=>{const opt=document.createElement('option');opt.value=String(i);const identity=[p.number?`#${p.number}`:'',p.name||`Spieler ${i+1}`,p.pos1||''].filter(Boolean).join(' ');opt.textContent=identity;select.appendChild(opt);});select.value=String(Math.min(selectedIndex,state.slots[slotIndex].players.length-1));
}
function defaultPlayerIndexForPA(slotIndex,paIndex){
  const slot=state.slots[slotIndex];
  for(let i=paIndex-1;i>=0;i--){const prev=slot.plateAppearances[i];if(prev&&Number.isInteger(Number(prev.playerIndex)))return Number(prev.playerIndex);}
  const lastNamed=slot.players.map((p,i)=>({p,i})).filter(x=>x.p.name||x.p.number).at(-1);return lastNamed?.i??0;
}
function runnerLabel(ref){
  if(!ref)return '-';const p=state.slots?.[ref.slotIndex]?.players?.[ref.playerIndex];return `${ref.slotIndex+1}. ${p?.number?`#${p.number} `:''}${p?.name||'Spieler'}`;
}
function currentBatterLabel(gs){
  const slotIndex=Math.max(0,(Number(gs.currentBatterOrder)||1)-1);const slot=state.slots[slotIndex];
  const side=state.activeSide==='home'?'home':'guest';
  const recent=(state.events||[]).filter(e=>e.type==='plate_appearance'&&e.side===side&&Number(e.slotIndex)===slotIndex).sort((a,b)=>(Number(b.sequence)||0)-(Number(a.sequence)||0))[0];
  const idx=recent?Number(recent.playerIndex)||0:(slot.players.findIndex(p=>p.name||p.number)>=0?slot.players.findIndex(p=>p.name||p.number):0);const p=slot.players[idx];
  return `${gs.currentBatterOrder}${p?.name?` · ${p.name}`:''}`;
}
function stateText(gs){return `Inning ${gs.inning??'-'} · Schlagmann ${currentBatterLabel(gs)} · Aus ${gs.outs} · 1B ${runnerLabel(gs.bases[1])} · 2B ${runnerLabel(gs.bases[2])} · 3B ${runnerLabel(gs.bases[3])}`;}
function beforeStateForPA(slotIndex,paIndex){
  const side=state.activeSide==='home'?'home':'guest';
  const ev=(state.events||[]).find(e=>e.type==='plate_appearance'&&e.side===side&&Number(e.slotIndex)===slotIndex&&Number(e.paIndex)===paIndex);
  return ev?ScorekeeperCore.stateBeforeEvent(state,ev.id,{side}):ScorekeeperCore.nextPlateAppearanceState(state,side);
}
function renderPaRunnerMovements(gs,existingAdvances=[]){
  const box=$('#paRunnerMovements');box.innerHTML='';let count=0;
  [3,2,1].forEach(base=>{const runner=gs.bases[base];if(!runner)return;count++;
    const row=document.createElement('div');row.className='pa-runner-row';row.dataset.from=String(base);row.dataset.slot=String(runner.slotIndex);row.dataset.player=String(runner.playerIndex);row.dataset.sourcePa=String(runner.sourcePaIndex);
    const who=document.createElement('span');who.className='runner-fixed-label';who.textContent=`${base}B · ${runnerLabel(runner)}`;
    const select=document.createElement('select');select.className='pa-runner-action';
    const stay=document.createElement('option');stay.value='';stay.textContent='Stay';select.appendChild(stay);
    for(let b=base+1;b<=4;b++){const o=document.createElement('option');o.value=String(b);o.textContent=`→ ${b===4?'Home':`${b}B`}`;select.appendChild(o);}
    const out=document.createElement('option');out.value='OUT';out.textContent='→ OUT';select.appendChild(out);
    const old=existingAdvances.find(m=>Number(m.fromBase)===base&&Number(m.runnerSlotIndex)===runner.slotIndex&&Number(m.runnerPlayerIndex)===runner.playerIndex);
    if(old)select.value=old.out?'OUT':String(old.toBase);
    select.onchange=()=>updateRbiRecommendation(false);
    row.append(who,select);box.appendChild(row);
  });
  if(!count){const empty=document.createElement('div');empty.className='muted';empty.textContent='Keine Läufer auf den Bases.';box.appendChild(empty);}
}
function collectPaAdvances(){return $$('#paRunnerMovements .pa-runner-row').flatMap(row=>{const value=row.querySelector('.pa-runner-action').value;if(!value)return[];const fromBase=Number(row.dataset.from);return[{runnerSlotIndex:Number(row.dataset.slot),runnerPlayerIndex:Number(row.dataset.player),sourcePaIndex:Number(row.dataset.sourcePa),fromBase,toBase:value==='OUT'?fromBase:Number(value),out:value==='OUT'}];});}
function openEntry(slotIndex,paIndex,targetInning=null){
  activeCell={slotIndex,paIndex,targetInning:targetInning||null};activeEventEditId=null;const data=state.slots[slotIndex].plateAppearances[paIndex]||defaultPlateAppearance();const selected=data.playerIndex??defaultPlayerIndexForPA(slotIndex,paIndex);const side=state.activeSide==='home'?'home':'guest';const ev=(state.events||[]).find(e=>e.type==='plate_appearance'&&e.side===side&&Number(e.slotIndex)===slotIndex&&Number(e.paIndex)===paIndex);const gs=beforeStateForPA(slotIndex,paIndex);
  $('#dialogTitle').textContent=`Batting Order ${slotIndex+1} · PA ${paIndex+1}`;$('#dialogSubtitle').textContent=`Aktueller Spielstand: ${stateText(gs)}`;
  $('#inningInput').value=String(data.inning||targetInning||ScorekeeperCore.expectedInningForNextPA(gs));$('#inningInput').readOnly=!!data.inning;populatePlayerSelect(slotIndex,Number(selected)||0);$('#resultSelect').value=data.result||'';$('#notationInput').value=data.notation||'';$('#hitDirection').value=data.hitDirection||'';$('#memoInput').value=data.memo||'';
  $('#outsOnPlay').value=String(ev?.outsOnPlay??ScorekeeperCore.defaultOutsForResult(data.result));$('#paStateHint').textContent=gs.inningComplete?`${gs.inning}. Inning beendet (3 Aus) · nächstes Inning`:`${currentBatterLabel(gs)} / ${gs.outs} Aus`;
  renderPaRunnerMovements(gs,ev?.advances||[]);updateAutoReach();
  rbiManualTouched=String(ev?.rbiMode??data.rbiMode??'auto')==='manual';
  const savedRbi=Number.isFinite(Number(ev?.rbi??data.rbi))?Number(ev?.rbi??data.rbi):null;
  if(savedRbi!==null)$('#rbiInput').value=String(savedRbi);
  updateRbiRecommendation(savedRbi===null);
  $('#deleteEntryBtn').style.visibility=state.slots[slotIndex].plateAppearances[paIndex]?'visible':'hidden';$('#entryDialog').showModal();
}
function updateAutoReach(){const r=$('#resultSelect').value;const d=resultDefaults[r];$('#autoReachText').textContent=d?(['Kein Aus/Fortschritt','1B','2B','3B','Home'][d[0]]):'-';}
function updateRbiRecommendation(force=false){
  const suggestion=ScorekeeperCore.recommendPlateAppearanceRbi({result:$('#resultSelect').value,advances:collectPaAdvances()});
  $('#rbiHint').textContent=`Automatische Empfehlung: ${suggestion}${rbiManualTouched?' · manueller Wert':''}`;
  if(force||!rbiManualTouched)$('#rbiInput').value=String(suggestion);
}
function onResultChange(){const r=$('#resultSelect').value,d=resultDefaults[r];updateAutoReach();if(d){if(!$('#notationInput').value.trim())$('#notationInput').value=d[1];$('#outsOnPlay').value=String(ScorekeeperCore.defaultOutsForResult(r));}updateRbiRecommendation(false);}
function saveEntry(e){
  e.preventDefault();if(!activeCell)return;const {slotIndex,paIndex}=activeCell;
  const currentCount=state.game.currentAtBat||{balls:0,strikes:0,pitches:[]};
  const input={inning:activeCell.targetInning?String(activeCell.targetInning):$('#inningInput').value.trim(),playerIndex:Number($('#playerSelect').value||0),result:$('#resultSelect').value,notation:$('#notationInput').value.trim(),hitDirection:$('#hitDirection').value,balls:Number(currentCount.balls)||0,strikes:Number(currentCount.strikes)||0,pitches:Array.isArray(currentCount.pitches)?currentCount.pitches.slice():[],memo:$('#memoInput').value.trim(),batterBase:ScorekeeperCore.getResultBase($('#resultSelect').value),outsOnPlay:Number($('#outsOnPlay').value||0),advances:collectPaAdvances(),rbi:Math.max(0,Math.min(4,Number($('#rbiInput').value)||0)),rbiMode:rbiManualTouched?'manual':'auto'};
  if(!input.result&&!input.notation&&!input.memo){alert('Bitte Ergebnis oder Notation eingeben, bevor Sie speichern.');return;}
  let valid;try{valid=ScorekeeperCore.validatePlateAppearanceAgainstState(state,slotIndex,paIndex,input);}catch(err){alert(err.message);return;}
  const defensiveSide=state.activeSide==='home'?'guest':'home';
  pushHistory();ScorekeeperCore.setPlateAppearance(state,slotIndex,paIndex,valid);ScorekeeperCore.upsertPlateAppearanceEvent(state,slotIndex,paIndex,{pitcherIndex:state.game.currentPitcherIndex,pitcherSide:defensiveSide,hitDirection:valid.hitDirection,balls:valid.balls,strikes:valid.strikes,pitches:valid.pitches,outsOnPlay:valid.outsOnPlay,advances:valid.advances,rbi:valid.rbi,rbiMode:valid.rbiMode});state.game.currentAtBat={balls:0,strikes:0,pitches:[],hitDirection:''};save();$('#entryDialog').close();activeCell=null;renderAll();
}
function deleteEntry(){if(!activeCell)return;if(!confirm('Dieses Plate Appearance und nachfolgende verbundene Ereignisse stornieren?'))return;pushHistory();const side=state.activeSide==='home'?'home':'guest';const event=(state.events||[]).find(e=>e.type==='plate_appearance'&&e.side===side&&Number(e.slotIndex)===activeCell.slotIndex&&Number(e.paIndex)===activeCell.paIndex);if(event)ScorekeeperCore.removeEvent(state,event.id);else state.slots[activeCell.slotIndex].plateAppearances[activeCell.paIndex]=null;save();$('#entryDialog').close();activeCell=null;renderAll();}

function dialogStateForEvent(eventId){return eventId?ScorekeeperCore.stateBeforeEvent(state,eventId):ScorekeeperCore.replayGameState(state);}
function actualRunners(gs){return [1,2,3].filter(b=>gs.bases[b]).map(base=>({base,runner:gs.bases[base]}));}
function fillRunnerSelect(gs,selectedBase){const select=$('#runnerPlayer');select.innerHTML='';actualRunners(gs).forEach(({base,runner})=>{const o=document.createElement('option');o.value=String(base);o.textContent=`${base}B · ${runnerLabel(runner)}`;select.appendChild(o);});if(selectedBase)select.value=String(selectedBase);updateRunnerFromTo();}
function updateRunnerFromTo(){const gs=dialogStateForEvent(activeEventEditId);const base=Number($('#runnerPlayer').value||0);$('#runnerFromBase').value=base?`${base}B`:'';const to=$('#runnerToBase');const old=to.value;const reason=$('#runnerReason').value;to.innerHTML='';const maxBase=['SB','CS','PK'].includes(reason)?Math.min(4,base+1):4;for(let b=base+1;b<=maxBase;b++){const o=document.createElement('option');o.value=String(b);o.textContent=b===4?'Home':`${b}B`;to.appendChild(o);}if([...to.options].some(o=>o.value===old))to.value=old;updateRunnerNotationSuggestion();}
function openRunnerDialog(eventId=null){
  const existing=eventId?(state.events||[]).find(e=>e.id===eventId&&e.type==='runner_advance'):null;const gs=dialogStateForEvent(eventId);if(!actualRunners(gs).length){alert('Keine Läufer auf den Bases. Bitte zuerst die Schlag- oder Laufereignisse prüfen.');return;}activeEventEditId=eventId;
  $('#runnerDialogTitle').textContent=existing?'Runner Event bearbeiten':'Runner Event';$('#runnerStateText').textContent=stateText(gs);fillRunnerSelect(gs,existing?.fromBase);$('#runnerReason').value=existing?.reason||'SB';$('#runnerMemo').value=existing?.memo||'';$('#runnerOut').checked=!!existing?.out;if(existing?.toBase)$('#runnerToBase').value=String(existing.toBase);$('#runnerNotation').value=existing?.notation||ScorekeeperCore.suggestRunnerNotation($('#runnerReason').value,gs.currentBatterOrder);updateRunnerReasonBehavior();$('#runnerDialog').showModal();
}
function updateRunnerReasonBehavior(){const reason=$('#runnerReason').value;if(['CS','PK'].includes(reason)){$('#runnerOut').checked=true;}else if(reason==='SB'){$('#runnerOut').checked=false;}updateRunnerFromTo();}
function updateRunnerNotationSuggestion(){const gs=dialogStateForEvent(activeEventEditId);$('#runnerNotation').value=ScorekeeperCore.suggestRunnerNotation($('#runnerReason').value,gs.currentBatterOrder);}
function saveRunnerEvent(e){
  e.preventDefault();const gs=dialogStateForEvent(activeEventEditId);const fromBase=Number($('#runnerPlayer').value);const runner=gs.bases[fromBase];if(!runner){alert('Auf der ausgewählten Base befindet sich kein Läufer mehr.');return;}
  const input={inning:String(gs.inning||''),runnerSlotIndex:runner.slotIndex,runnerPlayerIndex:runner.playerIndex,sourcePaIndex:runner.sourcePaIndex,fromBase,toBase:Number($('#runnerToBase').value),reason:$('#runnerReason').value,batterOrder:gs.currentBatterOrder,notation:$('#runnerNotation').value.trim(),out:$('#runnerOut').checked,memo:$('#runnerMemo').value.trim()};
  let valid;try{valid=ScorekeeperCore.validateRunnerEventAgainstState(state,input,{beforeEventId:activeEventEditId});}catch(err){alert(err.message);return;}
  pushHistory();if(activeEventEditId)ScorekeeperCore.updateRunnerEvent(state,activeEventEditId,valid);else ScorekeeperCore.addRunnerEvent(state,valid);save();$('#runnerDialog').close();activeEventEditId=null;renderAll();
}

function renderPitchMovementRows(gs,existing=null){const box=$('#pitchMovements');box.innerHTML='';actualRunners(gs).forEach(({base,runner})=>{const row=document.createElement('div');row.className='pitch-state-row';row.dataset.from=String(base);row.dataset.slot=String(runner.slotIndex);row.dataset.player=String(runner.playerIndex);row.dataset.sourcePa=String(runner.sourcePaIndex);const who=document.createElement('span');who.className='runner-fixed-label';who.textContent=`${base}B · ${runnerLabel(runner)}`;const sel=document.createElement('select');sel.className='pitch-state-action';const none=document.createElement('option');none.value='';none.textContent='No move';sel.appendChild(none);for(let b=base+1;b<=4;b++){const o=document.createElement('option');o.value=String(b);o.textContent=`→ ${b===4?'Home':`${b}B`}`;sel.appendChild(o);}const out=document.createElement('option');out.value='OUT';out.textContent='→ OUT';sel.appendChild(out);const old=existing?.movements?.find(m=>Number(m.fromBase)===base&&Number(m.runnerSlotIndex)===runner.slotIndex&&Number(m.runnerPlayerIndex)===runner.playerIndex);if(old)sel.value=old.out?'OUT':String(old.toBase);row.append(who,sel);box.appendChild(row);});}
function openPitchDialog(eventId=null){const existing=eventId?(state.events||[]).find(e=>e.id===eventId&&e.type==='pitch_event'):null;const gs=dialogStateForEvent(eventId);if(!actualRunners(gs).length){alert('Keine Läufer auf den Bases; WP/PB/BK kann nicht als Läuferbewegung erfasst werden.');return;}activeEventEditId=eventId;$('#pitchDialogTitle').textContent=existing?'Pitch Event bearbeiten':'Pitch Event';$('#pitchStateText').textContent=stateText(gs);$('#pitchReason').value=existing?.reason||'WP';$('#pitchNotation').value=existing?.notation||ScorekeeperCore.suggestPitchNotation($('#pitchReason').value,gs.currentBatterOrder);$('#pitchMemo').value=existing?.memo||'';renderPitchMovementRows(gs,existing);$('#pitchDialog').showModal();}
function updatePitchNotationSuggestion(){const gs=dialogStateForEvent(activeEventEditId);const reason=$('#pitchReason').value;$('#pitchNotation').value=ScorekeeperCore.suggestPitchNotation(reason,gs.currentBatterOrder);$$('#pitchMovements .pitch-state-row').forEach(row=>{const sel=row.querySelector('.pitch-state-action');const old=sel.value;const base=Number(row.dataset.from);sel.innerHTML='';const none=document.createElement('option');none.value='';none.textContent='No move';sel.appendChild(none);const maxBase=reason==='BK'?Math.min(4,base+1):4;for(let b=base+1;b<=maxBase;b++){const o=document.createElement('option');o.value=String(b);o.textContent=`→ ${b===4?'Home':`${b}B`}`;sel.appendChild(o);}const out=document.createElement('option');out.value='OUT';out.textContent='→ OUT';sel.appendChild(out);if([...sel.options].some(o=>o.value===old))sel.value=old;});}
function collectPitchMovements(){return $$('#pitchMovements .pitch-state-row').flatMap(row=>{const value=row.querySelector('.pitch-state-action').value;if(!value)return[];const fromBase=Number(row.dataset.from);return[{runnerSlotIndex:Number(row.dataset.slot),runnerPlayerIndex:Number(row.dataset.player),sourcePaIndex:Number(row.dataset.sourcePa),fromBase,toBase:value==='OUT'?fromBase:Number(value),out:value==='OUT'}];});}
function savePitchEvent(e){e.preventDefault();const gs=dialogStateForEvent(activeEventEditId);const input={inning:String(gs.inning||''),reason:$('#pitchReason').value,batterOrder:gs.currentBatterOrder,notation:$('#pitchNotation').value.trim(),movements:collectPitchMovements(),memo:$('#pitchMemo').value.trim()};let valid;try{valid=ScorekeeperCore.validatePitchEventAgainstState(state,input,{beforeEventId:activeEventEditId});}catch(err){alert(err.message);return;}pushHistory();if(activeEventEditId)ScorekeeperCore.updatePitchEvent(state,activeEventEditId,valid);else ScorekeeperCore.addPitchEvent(state,valid);save();$('#pitchDialog').close();activeEventEditId=null;renderAll();}

function eventLabel(event){
  if(event.type==='plate_appearance'){const p=state.slots?.[event.slotIndex]?.players?.[event.playerIndex];return `#${event.sequence} · Inning ${event.inning} · Order ${event.battingOrder} ${p?.name||''} · ${event.notation||event.result||'PA'}`;}
  if(event.type==='runner_advance')return `#${event.sequence} · Inning ${event.inning} · ${runnerLabel({slotIndex:event.runnerSlotIndex,playerIndex:event.runnerPlayerIndex,sourcePaIndex:event.sourcePaIndex})} · ${event.notation||event.reason}`;
  if(event.type==='pitch_event')return `#${event.sequence} · Inning ${event.inning} · ${event.notation||event.reason} · ${(event.movements||[]).length} runner(s)`;
  return `#${event.sequence} · ${event.type}`;
}
function editEvent(event){if(event.type==='plate_appearance')openEntry(Number(event.slotIndex),Number(event.paIndex));else if(event.type==='runner_advance')openRunnerDialog(event.id);else if(event.type==='pitch_event')openPitchDialog(event.id);}
function cancelEvent(event){if(!confirm(`${eventLabel(event)}
Dieses Ereignis stornieren? Der Spielstand wird danach neu berechnet.`))return;pushHistory();ScorekeeperCore.removeEvent(state,event.id);save();renderAll();}
function renderEventLog(){const box=$('#eventLog');box.innerHTML='';const events=[...(state.events||[])].sort((a,b)=>(Number(a.sequence)||0)-(Number(b.sequence)||0));if(!events.length){box.textContent='Noch keine Ereignisse gespeichert.';return;}events.forEach(event=>{const row=document.createElement('div');row.className='event-log-row';const txt=document.createElement('span');txt.textContent=eventLabel(event);const tools=document.createElement('span');tools.className='event-log-tools';const edit=document.createElement('button');edit.type='button';edit.textContent='Bearbeiten';edit.onclick=()=>editEvent(event);const del=document.createElement('button');del.type='button';del.className='danger';del.textContent='Stornieren';del.onclick=()=>cancelEvent(event);tools.append(edit,del);row.append(txt,tools);box.appendChild(row);});}
function renderGameState(){const gs=ScorekeeperCore.nextPlateAppearanceState(state,state.activeSide);$('#stateInning').textContent=gs.inning??'-';$('#stateBatter').textContent=currentBatterLabel(gs);$('#stateOuts').textContent=String(gs.outs);$('#stateBase1').textContent=runnerLabel(gs.bases[1]);$('#stateBase2').textContent=runnerLabel(gs.bases[2]);$('#stateBase3').textContent=runnerLabel(gs.bases[3]);$('#stateRuns').textContent=String(gs.runs);const warning=$('#stateWarning');if(gs.inningComplete){warning.textContent=`Inning ${gs.inning} mit 3 Aus beendet · zum Scoresheet des nächsten Teams wechseln`;warning.classList.add('active');}else if(gs.warnings.length){warning.textContent=`Datenwarnung: ${gs.warnings[0]}`;warning.classList.add('active');}else{warning.textContent='';warning.classList.remove('active');}}
function quickScoringTarget(){const gs=ScorekeeperCore.nextPlateAppearanceState(state,state.activeSide);const slotIndex=Math.max(0,(Number(gs.currentBatterOrder)||1)-1);const slot=state.slots[slotIndex];const paIndex=newPaIndexForInning(slot,ScorekeeperCore.expectedInningForNextPA(gs));return {gs,slotIndex,paIndex};}
function quickRecord(result){
  const target=quickScoringTarget();
  const defensiveSide=state.activeSide==='home'?'guest':'home';
  if(target.gs.inningComplete)return;
  if(target.paIndex<0){alert('Für diese Batting Order sind keine freien Plate-Appearance-Spalten vorhanden.');return;}
  const playerIndex=defaultPlayerIndexForPA(target.slotIndex,target.paIndex);
  const notation=result==='GO'?'6-3':result==='FO'?'F8':result==='LO'?'L6':result;
  const count=state.game.currentAtBat||{balls:0,strikes:0};
  const input={inning:String(ScorekeeperCore.expectedInningForNextPA(target.gs)),playerIndex,result,notation,hitDirection:$('#quickHitDirection').value,balls:Number(count.balls)||0,strikes:Number(count.strikes)||0,pitches:Array.isArray(count.pitches)?count.pitches.slice():[],memo:'',batterBase:ScorekeeperCore.getResultBase(result),outsOnPlay:ScorekeeperCore.defaultOutsForResult(result),advances:[],rbi:0,rbiMode:'auto'};
  let valid;
  try{valid=ScorekeeperCore.validatePlateAppearanceAgainstState(state,target.slotIndex,target.paIndex,input);}
  catch(err){
    openEntry(target.slotIndex,target.paIndex);
    $('#resultSelect').value=result;onResultChange();$('#notationInput').value=notation;$('#hitDirection').value=input.hitDirection;
    return;
  }
  pushHistory();ScorekeeperCore.setPlateAppearance(state,target.slotIndex,target.paIndex,valid);ScorekeeperCore.upsertPlateAppearanceEvent(state,target.slotIndex,target.paIndex,{pitcherIndex:state.game.currentPitcherIndex,pitcherSide:defensiveSide,hitDirection:valid.hitDirection,balls:valid.balls,strikes:valid.strikes,pitches:valid.pitches,outsOnPlay:valid.outsOnPlay,advances:valid.advances,rbi:valid.rbi,rbiMode:valid.rbiMode});state.game.currentAtBat={balls:0,strikes:0,pitches:[],hitDirection:''};save();renderAll();
  const after=ScorekeeperCore.replayGameState(state,{side:state.activeSide});
  if(after.inningComplete){ScorekeeperCore.activateTeam(state,state.activeSide==='home'?'guest':'home');state.game.currentAtBat={balls:0,strikes:0,pitches:[],hitDirection:''};save();renderAll();}
}
function changePitchCount(kind){
  const count=state.game.currentAtBat||{balls:0,strikes:0,pitches:[]};
  if(ScorekeeperCore.nextPlateAppearanceState(state,state.activeSide).inningComplete)return;
  const max=kind==='balls'?4:3;
  if(Number(count[kind]||0)>=max)return;
  count[kind]=Number(count[kind]||0)+1;
  count.pitches=Array.isArray(count.pitches)?count.pitches:[];count.pitches.push(kind==='balls'?'B':'S');
  state.game.currentAtBat=count;save();renderQuickScoring();
}
function resetPitchCount(){state.game.currentAtBat={balls:0,strikes:0,pitches:[],hitDirection:''};$('#quickHitDirection').value='';save();renderQuickScoring();}
function saveQuickDirection(){state.game.currentAtBat={...(state.game.currentAtBat||{balls:0,strikes:0}),hitDirection:$('#quickHitDirection').value};save();}
function selectQuickDirection(direction){$('#quickHitDirection').value=direction;saveQuickDirection();renderQuickDirection();}
function renderQuickDirection(){const direction=$('#quickHitDirection').value||lastQuickDirection;$$('[data-hit-direction]').forEach(button=>{button.classList.toggle('selected',button.dataset.hitDirection===direction);});const line=$('#quickDirectionLine');if(line){const point=lastQuickDirectionPoint||{x:150,y:142};line.setAttribute('x2',String(point.x));line.setAttribute('y2',String(point.y));}}
function directionForPoint(x,y){const points=[['LF',18,35],['LC',76,21],['CF',150,14],['RC',224,21],['RF',282,35],['3B',76,105],['SS',105,69],['P',150,91],['2B',195,69],['1B',224,105],['C',150,140]];return points.reduce((best,point)=>{const distance=(point[1]-x)**2+(point[2]-y)**2;return distance<best.distance?{direction:point[0],distance}:{direction:best.direction,distance:best.distance};},{direction:'CF',distance:Infinity}).direction;}
function beginQuickHit(result){pendingQuickResult=result;lastQuickDirectionPoint=null;lastQuickDirection='';$('#quickDirectionPicker').classList.add('pending');$('#quickDirectionPicker').hidden=false;$('#quickDirectionState').textContent=`${result} · Richtung auf dem Feld anklicken`;$('#quickHitDirection').value='';state.game.currentAtBat={...(state.game.currentAtBat||{balls:0,strikes:0}),hitDirection:''};save();renderQuickDirection();}
function cancelQuickHit(){pendingQuickResult='';$('#quickDirectionPicker').classList.remove('pending');$('#quickDirectionPicker').hidden=false;$('#quickDirectionState').textContent='Treffpunkt auswählen';$('#quickHitDirection').value='';lastQuickDirection='';lastQuickDirectionPoint=null;saveQuickDirection();renderQuickDirection();}
function confirmQuickHit(direction,x,y){if(!pendingQuickResult)return;const result=pendingQuickResult;pendingQuickResult='';lastQuickDirection=direction;lastQuickDirectionPoint={x,y};$('#quickDirectionPicker').classList.remove('pending');$('#quickDirectionPicker').hidden=false;$('#quickDirectionState').textContent=`${result} gespeichert · ${direction} · schwarze Linie = getroffener Bereich`;$('#quickHitDirection').value=direction;const line=$('#quickDirectionLine');if(line){line.setAttribute('x2',String(x));line.setAttribute('y2',String(y));}quickRecord(result);}
function renderQuickScoring(){const gs=ScorekeeperCore.nextPlateAppearanceState(state,state.activeSide);const name=currentBatterLabel(gs);const count=state.game.currentAtBat||{balls:0,strikes:0};const defensiveSide=state.activeSide==='home'?'guest':'home';const select=$('#currentPitcherSelect');select.innerHTML='';(state.teams?.[defensiveSide]?.pitchers||state.pitchers).forEach((p,i)=>{const option=document.createElement('option');option.value=String(i);option.textContent=p.name||p.number||`Pitcher ${i+1}`;select.appendChild(option);});select.value=String(state.game.currentPitcherIndex||0);$('#quickScoringState').textContent=`Inning ${gs.inning??1} · ${name} · ${gs.outs} Aus`;$('#quickBalls').textContent=String(count.balls||0);$('#quickStrikes').textContent=String(count.strikes||0);$('#quickHitDirection').value=count.hitDirection||'';renderQuickDirection();$('#quickScoringPanel').classList.toggle('disabled',gs.inningComplete);}
function saveCurrentPitcher(){state.game.currentPitcherIndex=Number($('#currentPitcherSelect').value)||0;save();renderPitchers();}

function renderAll(){$$('[data-team-side]').forEach(button=>button.classList.toggle('active',button.dataset.teamSide===state.activeSide));refreshTeamSuggestions();renderLineScore();renderMain();renderPitchers();renderCatchers();bindPathInputs();renderGameState();renderQuickScoring();renderEventLog();$('#ruleProfileBadge').textContent=`Regelprofil: ${RULE_PROFILE.label} · Game State + Auto Batting Stats`;}
function finishGame(){
  const reason=state.game.endReason||'completed';
  state.game.status='finished';
  state.game.endReason=reason;
  if(!state.game.end)state.game.end=new Date().toTimeString().slice(0,5);
  save();renderAll();
}
function setZoom(v){zoom=Math.max(.65,Math.min(1.25,v));$('#paper').style.transform=`scale(${zoom})`;$('#zoomLabel').textContent=`${Math.round(zoom*100)}%`;}
window.addEventListener('storage',event=>{
  if(event.key!==STORAGE_KEY || !event.newValue)return;
  const tabSide=state.activeSide;
  state=ensureStateShape(JSON.parse(event.newValue));
  if(tabSide==='guest'||tabSide==='home')ScorekeeperCore.activateTeam(state,tabSide);
  ScorekeeperCore.syncPlateAppearanceEvents(state);
  renderAll();
});

$('#entryForm').addEventListener('submit',saveEntry);
$$('[data-team-side]').forEach(button=>button.addEventListener('click',()=>{
  const side=button.dataset.teamSide;
  if(side===state.activeSide)return;
  pushHistory();
  ScorekeeperCore.activateTeam(state,side);
  sessionStorage.setItem(TAB_SIDE_KEY,side);
  ScorekeeperCore.syncPlateAppearanceEvents(state);
  $$('[data-team-side]').forEach(b=>b.classList.toggle('active',b.dataset.teamSide===state.activeSide));
  save();renderAll();
}));
$$('[data-pitch-count]').forEach(button=>button.addEventListener('click',()=>changePitchCount(button.dataset.pitchCount)));
$('#quickCountReset').addEventListener('click',resetPitchCount);
$('#quickHitDirection').addEventListener('change',saveQuickDirection);
$('.quick-direction-field').addEventListener('click',event=>{const field=event.currentTarget;const rect=field.getBoundingClientRect();const x=Math.max(0,Math.min(300,(event.clientX-rect.left)*300/rect.width));const y=Math.max(0,Math.min(150,(event.clientY-rect.top)*150/rect.height));if(pendingQuickResult)confirmQuickHit(directionForPoint(x,y),x,y);else{lastQuickDirection=directionForPoint(x,y);lastQuickDirectionPoint={x,y};selectQuickDirection(lastQuickDirection);renderQuickDirection();}});
$('#quickDirectionClear').addEventListener('click',()=>selectQuickDirection(''));
$('#quickDirectionCancel').addEventListener('click',cancelQuickHit);
$$('[data-quick-result]').forEach(button=>button.addEventListener('click',()=>['1B','2B','3B','HR'].includes(button.dataset.quickResult)?beginQuickHit(button.dataset.quickResult):quickRecord(button.dataset.quickResult)));
$('#currentPitcherSelect').addEventListener('change',saveCurrentPitcher);
$('#quickMoreBtn').addEventListener('click',()=>{const target=quickScoringTarget();if(target.gs.inningComplete)return;if(target.paIndex<0){alert('Für diese Batting Order sind keine freien Plate-Appearance-Spalten vorhanden.');return;}openEntry(target.slotIndex,target.paIndex);});
$('#quickRunnerBtn').addEventListener('click',()=>openRunnerDialog());
$('#runnerEventBtn').addEventListener('click',()=>openRunnerDialog());$('#pitchEventBtn').addEventListener('click',()=>openPitchDialog());$('#exportJsonBtn').addEventListener('click',downloadJson);$('#openLiveBtn').addEventListener('click',()=>window.open('live.html','bb-scorekeeper-live'));
$('#runnerForm').addEventListener('submit',saveRunnerEvent);$('#runnerPlayer').addEventListener('change',updateRunnerFromTo);$('#runnerReason').addEventListener('change',updateRunnerReasonBehavior);$('#runnerCloseBtn').addEventListener('click',()=>{$('#runnerDialog').close();activeEventEditId=null;});$('#runnerCancelBtn').addEventListener('click',()=>{$('#runnerDialog').close();activeEventEditId=null;});
$('#pitchForm').addEventListener('submit',savePitchEvent);$('#pitchReason').addEventListener('change',updatePitchNotationSuggestion);$('#pitchCloseBtn').addEventListener('click',()=>{$('#pitchDialog').close();activeEventEditId=null;});$('#pitchCancelBtn').addEventListener('click',()=>{$('#pitchDialog').close();activeEventEditId=null;});
$('#resultSelect').addEventListener('change',onResultChange);$('#rbiInput').addEventListener('input',()=>{rbiManualTouched=true;updateRbiRecommendation(false);});$('#rbiAutoBtn').addEventListener('click',()=>{rbiManualTouched=false;updateRbiRecommendation(true);});$('#deleteEntryBtn').addEventListener('click',deleteEntry);$('#cancelEntryBtn').addEventListener('click',()=>{$('#entryDialog').close();activeCell=null;});$('#dialogCloseBtn').addEventListener('click',()=>{$('#entryDialog').close();activeCell=null;});$('#undoBtn').addEventListener('click',undo);$('#redoBtn').addEventListener('click',redo);$('#zoomOutBtn').addEventListener('click',()=>setZoom(zoom-.05));$('#zoomInBtn').addEventListener('click',()=>setZoom(zoom+.05));$('#addPitcherBtn').addEventListener('click',()=>{pushHistory();const defensiveSide=state.activeSide==='home'?'guest':'home';ScorekeeperCore.addPitcher(state,defensiveSide);save();renderPitchers();});$('#resetBtn').addEventListener('click',()=>{if(!confirm('Alle Eingaben des aktuellen Scoresheets löschen?'))return;pushHistory();state=defaultState();save();renderAll();});
$('#addInningSheetBtn').addEventListener('click',()=>{const current=Math.max(10,Number(state.game.scoreColumns)||10);if(current>=PA_COLUMNS){alert(`Maximal ${PA_COLUMNS} Innings können hinzugefügt werden.`);return;}pushHistory();state.game.scoreColumns=Math.min(PA_COLUMNS,current+10);save();renderAll();});
$('#finishGameBtn').addEventListener('click',()=>{const reason=state.game.endReason||'completed';if(!confirm(`Spiel mit dem Grund „${reason}“ beenden?`))return;pushHistory();finishGame();});
renderAll();updateUndo();setZoom(1);loadSeasonRoster();
window.BBFirebaseSync?.startPresence();
window.BBFirebaseSync?.subscribe(remoteState=>{
  const activeSide=state.activeSide;
  state=ensureStateShape(remoteState);
  if(activeSide==='guest'||activeSide==='home')ScorekeeperCore.activateTeam(state,activeSide);
  ScorekeeperCore.syncPlateAppearanceEvents(state);
  localStorage.setItem(STORAGE_KEY,JSON.stringify(state));
  renderAll();
});
})();
