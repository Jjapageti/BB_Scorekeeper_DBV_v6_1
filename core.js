(function(root,factory){
  const api=factory();
  if(typeof module==='object' && module.exports) module.exports=api;
  if(root) root.ScorekeeperCore=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const RULE_PROFILE={
    id:'DBV_BSVBB_2026',
    label:'DBV / BSVBB 2026',
    automaticUmpireRulings:false,
    includesMLBAutomation:false,
    sources:[
      'DBV Scoring-Lehrbuch 6. Auflage, Version 1.3 (November 2024)',
      'DBV BuSpO 2026 (Bundesspielordnung)',
      'BSVBB DVO 2026 (Durchführungsverordnung)'
    ]
  };
  const SLOT_COUNT=9;
  const INITIAL_PLAYERS_PER_SLOT=4;
  const INITIAL_PITCHERS=4;
  const PA_COLUMNS=30;
  const LINE_SCORE_INNINGS=30;
  const LINE_SCORE_TOTALS=3;
  const LINE_SCORE_COLUMNS=LINE_SCORE_INNINGS+LINE_SCORE_TOTALS;
  const BATTER_STATS=['PA','AB','R','RBI','H','2B','3B','HR','K','BB/IBB','HP','SH','SF','SB','CS'];
  const PITCHER_STATS=['BF','AB','R','ER','H','2B','3B','HR','K','BB/IBB','HP','SH','SF','WP','BK','WLS'];
  const PLAYER_FIELDS=['A','PO','E','DP','IP','number','name','passNo','pos1','in1','pos2','in2'];
  const POSITION_NAMES={1:'P',2:'C',3:'1B',4:'2B',5:'3B',6:'SS',7:'LF',8:'CF',9:'RF',DH:'DH'};
  const PITCHER_FIELDS=['A','PO','E','DP','IP','number','name','passNo',...PITCHER_STATS];
  const RESULT_BASES={
    '1B':1,'2B':2,'3B':3,'HR':4,'BB':1,'IBB':1,'HBP':1,
    'K':0,'GO':0,'FO':0,'LO':0,'FC':1,'E':1,'SF':0,'SH':0,'OTHER':0
  };

  const defaultPlayer=()=>({A:'',PO:'',E:'',DP:'',IP:'',number:'',name:'',passNo:'',pos1:'',in1:'',pos2:'',in2:'',stats:Object.fromEntries(BATTER_STATS.map(k=>[k,'']))});
  const defaultPlateAppearance=()=>({inning:'',playerIndex:0,result:'',notation:'',hitDirection:'',balls:0,strikes:0,pitches:[],batterBase:0,runnerNotation:'',finalBase:0,scored:false,rbi:null,rbiMode:'auto',memo:''});
  const defaultSlot=()=>({players:Array.from({length:INITIAL_PLAYERS_PER_SLOT},defaultPlayer),plateAppearances:Array.from({length:PA_COLUMNS},()=>null)});
  const defaultPitcher=()=>Object.fromEntries(PITCHER_FIELDS.map(k=>[k,'']));
  const defaultCatcher=()=>({name:'',PB:'',SB:'',CS:''});
  const defaultTeam=()=>({
    slots:Array.from({length:SLOT_COUNT},defaultSlot),
    pitchers:Array.from({length:INITIAL_PITCHERS},defaultPitcher),
    catchers:Array.from({length:4},defaultCatcher),
    teamPitcher:'',comments:'',
    checks:{ab:'',bb:'',hp:'',sh:'',sf:'',pa:'',r:'',lob:'',opponentPo:'',pa2:''}
  });
  const defaultState=()=>{
    const guest=defaultTeam(), home=defaultTeam();
    return {
    game:{guest:'',home:'',guestChecked:false,homeChecked:false,date:'',place:'',bb:false,sb:false,league:'',association:'',gameNo:'',start:'',end:'',duration:'',spectators:'',innings:9,scoreColumns:10,status:'in_progress',endReason:'',currentAtBat:{balls:0,strikes:0,hitDirection:''},currentPitcherIndex:0},
    lineScore:{guest:Array(LINE_SCORE_COLUMNS).fill(''),home:Array(LINE_SCORE_COLUMNS).fill('')},
    teams:{guest,home},slots:guest.slots,pitchers:guest.pitchers,catchers:guest.catchers,checks:guest.checks,teamPitcher:'',comments:'',
    protestYes:false,protestNo:false,backCommentYes:false,backCommentNo:false,
    officials:{umpire1:'',umpire2:'',scorer:''},signatures:{scorer:'',umpire:'',homeManager:'',guestManager:''},
    ruleProfileId:RULE_PROFILE.id,
    events:[],activeSide:'guest'
  };};

  function addPlayer(state,slotIndex){
    state.slots[slotIndex].players.push(defaultPlayer());
    return state.slots[slotIndex].players.length-1;
  }
  function nextPlateAppearanceState(state,side=state.activeSide||'guest'){
    const gs=replayGameState(state,{side});
    const opponent=side==='home'?'guest':'home';
    const opponentState=replayGameState(state,{side:opponent});
    if(gs.inning===null){
      const opponentInning=Number(opponentState.inning)||1;
      const inning=side==='guest' && opponentState.inningComplete?opponentInning+1:opponentInning;
      return {...gs,inning,outs:0,bases:{1:null,2:null,3:null},inningComplete:false};
    }
    if(!gs.inningComplete)return gs;
    const ownInning=Number(gs.inning)||1;
    const opponentInning=Number(opponentState.inning)||0;
    if(opponentInning===ownInning && opponentState.inningComplete){
      return {...gs,inning:ownInning+1,outs:0,bases:{1:null,2:null,3:null},inningComplete:false};
    }
    if(opponentInning<ownInning)return gs;
    if(opponentInning===ownInning)return gs;
    const nextInning=opponentInning;
    return {...gs,inning:nextInning,outs:0,bases:{1:null,2:null,3:null},inningComplete:false};
  }
  function removePlayer(state,slotIndex,playerIndex){
    const slot=state.slots[slotIndex];
    if(slot.players.length<=1) return false;
    if(slot.plateAppearances.some(pa=>pa && Number(pa.playerIndex)===playerIndex)) return false;
    slot.players.splice(playerIndex,1);
    slot.plateAppearances.forEach(pa=>{if(pa && Number(pa.playerIndex)>playerIndex) pa.playerIndex=Number(pa.playerIndex)-1;});
    return true;
  }
  function addPitcher(state,side=state.activeSide){
    const pitchers=state.teams?.[side]?.pitchers||state.pitchers;
    pitchers.push(defaultPitcher());
    return pitchers.length-1;
  }
  function removePitcher(state,index,side=state.activeSide){
    const pitchers=state.teams?.[side]?.pitchers||state.pitchers;
    if(pitchers.length<=1)return false;
    pitchers.splice(index,1);
    return true;
  }
  function getResultBase(result){
    return RESULT_BASES[String(result||'').toUpperCase()] ?? 0;
  }
  function setPlateAppearance(state,slotIndex,paIndex,entry){
    if(!state.slots[slotIndex]) throw new Error('invalid slot');
    if(paIndex<0 || paIndex>=PA_COLUMNS) throw new Error('invalid plate appearance index');
    const existing=state.slots[slotIndex].plateAppearances[paIndex];
    const current=existing?{...defaultPlateAppearance(),...existing}:defaultPlateAppearance();
    const batterBase=entry.batterBase!==undefined ? Number(entry.batterBase)||0 : getResultBase(entry.result ?? current.result);
    const hadRunnerProgress=!!current.runnerNotation || Number(current.finalBase)>Number(current.batterBase||0) || !!current.scored;
    const next={...current,...entry,batterBase};
    if(!existing || !hadRunnerProgress){
      next.finalBase=batterBase;
      next.scored=batterBase===4;
      next.runnerNotation='';
    }else{
      next.finalBase=Math.max(batterBase,Number(current.finalBase)||0);
      next.scored=!!current.scored || batterBase===4;
      next.runnerNotation=current.runnerNotation||'';
    }
    state.slots[slotIndex].plateAppearances[paIndex]=next;
    return next;
  }
  function getDiamondEdges(finalBase){
    const route=['e3','e2','e1','e4'];
    const count=Math.max(0,Math.min(4,Number(finalBase)||0));
    return route.slice(0,count);
  }


  function nextEventSequence(state){
    return (state.events||[]).reduce((m,e)=>Math.max(m,Number(e.sequence)||0),0)+1;
  }
  function defaultOutsForResult(result){
    return ['K','GO','FO','LO','SF','SH'].includes(String(result||'').toUpperCase())?1:0;
  }
  function normalizeMovement(m){
    return {
      runnerSlotIndex:Number(m.runnerSlotIndex)||0,
      runnerPlayerIndex:Number(m.runnerPlayerIndex)||0,
      sourcePaIndex:Number.isInteger(Number(m.sourcePaIndex))?Number(m.sourcePaIndex):-1,
      fromBase:Number(m.fromBase)||0,
      toBase:Number(m.toBase)||0,
      out:!!m.out,
      scored:Number(m.toBase)===4 && !m.out
    };
  }
  function upsertPlateAppearanceEvent(state,slotIndex,paIndex,options={}){
    if(!Array.isArray(state.events)) state.events=[];
    const pa=state.slots?.[slotIndex]?.plateAppearances?.[paIndex];
    if(!pa) return null;
    const side=options.side||state.activeSide||'guest';
    const key=side==='guest'?`pa:${slotIndex}:${paIndex}`:`${side}:pa:${slotIndex}:${paIndex}`;
    const existingIndex=state.events.findIndex(e=>e.key===key || (e.type==='plate_appearance'&&e.side===side&&Number(e.slotIndex)===slotIndex&&Number(e.paIndex)===paIndex));
    const existing=existingIndex>=0?state.events[existingIndex]:null;
    const event={
      id:existing?.id||key,
      key,
      type:'plate_appearance',
      sequence:existing?.sequence||nextEventSequence(state),
      revision:(existing?.revision||0)+1,
      inning:String(pa.inning??''),
      battingOrder:slotIndex+1,
      slotIndex,
      paIndex,
      playerIndex:Number(pa.playerIndex)||0,
      pitcherIndex:Number(options.pitcherIndex ?? state.game?.currentPitcherIndex ?? 0)||0,
      pitcherSide:options.pitcherSide||(side==='guest'?'home':'guest'),
      result:pa.result||'',
      notation:pa.notation||'',
      hitDirection:pa.hitDirection||'',
      balls:Number(options.balls ?? pa.balls ?? existing?.balls)||0,
      strikes:Number(options.strikes ?? pa.strikes ?? existing?.strikes)||0,
      pitches:Array.isArray(options.pitches)?options.pitches.slice():Array.isArray(pa.pitches)?pa.pitches.slice():Array.isArray(existing?.pitches)?existing.pitches.slice():[],
      batterBase:Number(pa.batterBase ?? getResultBase(pa.result))||0,
      outsOnPlay:Number(options.outsOnPlay ?? existing?.outsOnPlay ?? defaultOutsForResult(pa.result))||0,
      advances:Array.isArray(options.advances)?options.advances.map(normalizeMovement):Array.isArray(existing?.advances)?existing.advances.map(normalizeMovement):[],
      rbi:Number.isFinite(Number(options.rbi ?? pa.rbi ?? existing?.rbi))?Math.max(0,Math.min(4,Number(options.rbi ?? pa.rbi ?? existing?.rbi))):null,
      rbiMode:String(options.rbiMode ?? pa.rbiMode ?? existing?.rbiMode ?? 'auto'),
      memo:pa.memo||'',
      source:'scorer'
    };
    event.side=side;
    if(existingIndex>=0) state.events[existingIndex]=event; else state.events.push(event);
    return event;
  }
  function deletePlateAppearanceEvent(state,slotIndex,paIndex){
    if(!Array.isArray(state.events)) return false;
    const key=`pa:${slotIndex}:${paIndex}`;
    const index=state.events.findIndex(e=>e.key===key);
    if(index<0) return false;
    state.events.splice(index,1);
    return true;
  }
  function suggestRunnerNotation(reason,batterOrder){
    const r=String(reason||'').toUpperCase();
    const n=Number(batterOrder)||0;
    if(r==='SB' && n>=1 && n<=9) return `${r}${n}`;
    if(r==='CS') return 'CS';
    if(r==='PK') return 'PK';
    return r;
  }
  function suggestPitchNotation(reason,batterOrder){
    const r=String(reason||'').toUpperCase();
    const n=Number(batterOrder)||0;
    if(['WP','PB','BK'].includes(r) && n>=1 && n<=9) return `${r}${n}`;
    return r;
  }
  function addRunnerEvent(state,input){
    if(!Array.isArray(state.events)) state.events=[];
    const sequence=nextEventSequence(state);
    const reason=String(input.reason||'').toUpperCase();
    if(['WP','PB','BK'].includes(reason)) throw new Error(`${reason} must be stored as pitch_event`);
    const event={
      id:`runner:${sequence}`,
      key:`runner:${sequence}`,
      type:'runner_advance',
      sequence,
      revision:1,
      inning:String(input.inning??''),
      runnerSlotIndex:Number(input.runnerSlotIndex)||0,
      runnerPlayerIndex:Number(input.runnerPlayerIndex)||0,
      sourcePaIndex:Number.isInteger(Number(input.sourcePaIndex))?Number(input.sourcePaIndex):-1,
      fromBase:Number(input.fromBase)||0,
      toBase:Number(input.toBase)||0,
      reason,
      batterOrder:Number(input.batterOrder)||0,
      notation:input.notation||suggestRunnerNotation(reason,input.batterOrder),
      out:!!input.out,
      scored:Number(input.toBase)===4 && !input.out,
      memo:input.memo||'',
      source:'scorer'
    };
    event.side=input.side||state.activeSide||'guest';
    state.events.push(event);
    return event;
  }


  function addPitchEvent(state,input){
    if(!Array.isArray(state.events)) state.events=[];
    const sequence=nextEventSequence(state);
    const reason=String(input.reason||'').toUpperCase();
    if(!['WP','PB','BK'].includes(reason)) throw new Error('pitch_event reason must be WP, PB, or BK');
    const movements=Array.isArray(input.movements)?input.movements.map(m=>({
      runnerSlotIndex:Number(m.runnerSlotIndex)||0,
      runnerPlayerIndex:Number(m.runnerPlayerIndex)||0,
      sourcePaIndex:Number.isInteger(Number(m.sourcePaIndex))?Number(m.sourcePaIndex):-1,
      fromBase:Number(m.fromBase)||0,
      toBase:Number(m.toBase)||0,
      out:!!m.out,
      scored:Number(m.toBase)===4 && !m.out
    })):[];
    const event={
      id:`pitch:${sequence}`,
      key:`pitch:${sequence}`,
      type:'pitch_event',
      sequence,
      revision:1,
      inning:String(input.inning??''),
      reason,
      batterOrder:Number(input.batterOrder)||0,
      notation:input.notation||suggestPitchNotation(reason,input.batterOrder),
      movements,
      memo:input.memo||'',
      source:'scorer'
    };
    event.side=input.side||state.activeSide||'guest';
    state.events.push(event);
    return event;
  }

  function applyMovementToPlateAppearance(state,movement,notation){
    const slot=state.slots?.[Number(movement.runnerSlotIndex)];
    const paIndex=Number(movement.sourcePaIndex);
    if(!slot || !Number.isInteger(paIndex) || paIndex<0 || paIndex>=slot.plateAppearances.length) return false;
    const pa=slot.plateAppearances[paIndex];
    if(!pa) return false;
    if(notation){
      const notes=String(pa.runnerNotation||'').split(/\s+/).filter(Boolean);
      if(!notes.includes(notation)) notes.push(notation);
      pa.runnerNotation=notes.join(' ');
    }
    if(!movement.out){
      pa.finalBase=Math.max(Number(pa.finalBase)||Number(pa.batterBase)||0,Number(movement.toBase)||0);
      if(Number(movement.toBase)===4) pa.scored=true;
    }
    return true;
  }

  function applyPitchEventToPlateAppearances(state,event){
    if(!event || event.type!=='pitch_event' || !Array.isArray(event.movements)) return 0;
    let applied=0;
    event.movements.forEach(movement=>{
      if(applyMovementToPlateAppearance(state,movement,event.notation||event.reason||'')) applied++;
    });
    return applied;
  }

  function applyRunnerEventToPlateAppearance(state,event){
    if(!event || event.type!=='runner_advance') return false;
    return applyMovementToPlateAppearance(state,event,event.notation||event.reason||'');
  }

  function orderedEvents(state,options={}){
    const beforeSequence=options.beforeSequence===undefined?Infinity:Number(options.beforeSequence);
    const excludeEventId=options.excludeEventId||null;
    const side=options.side||state.activeSide||'guest';
    return (state.events||[])
      .filter(e=>e && (!e.side || e.side===side))
      .filter(e=>e && e.id!==excludeEventId && Number(e.sequence||0)<beforeSequence)
      .slice()
      .sort((a,b)=>(Number(a.sequence)||0)-(Number(b.sequence)||0));
  }
  function runnerIdentity(r){
    if(!r) return '';
    return `${Number(r.slotIndex??r.runnerSlotIndex)}:${Number(r.playerIndex??r.runnerPlayerIndex)}:${Number(r.sourcePaIndex)}`;
  }
  function runnerRefFromPA(event){
    return {slotIndex:Number(event.slotIndex)||0,playerIndex:Number(event.playerIndex)||0,sourcePaIndex:Number(event.paIndex)||0};
  }
  function movementMatchesRunner(m,runner){
    return runner && Number(m.runnerSlotIndex)===Number(runner.slotIndex) && Number(m.runnerPlayerIndex)===Number(runner.playerIndex) && (Number(m.sourcePaIndex)<0 || Number(m.sourcePaIndex)===Number(runner.sourcePaIndex));
  }
  function expectedInningForNextPA(gs){
    if(!gs || gs.inning===null || gs.inning===undefined) return 1;
    return gs.inningComplete ? Number(gs.inning)+1 : Number(gs.inning);
  }
  function replayGameState(state,options={}){
    const gs={inning:null,outs:0,currentBatterOrder:1,bases:{1:null,2:null,3:null},runs:0,inningComplete:false,warnings:[],lastSequence:0};
    const events=orderedEvents(state,options);
    const beginInning=(inning)=>{gs.inning=Number(inning)||gs.inning||1;gs.outs=0;gs.bases={1:null,2:null,3:null};gs.inningComplete=false;};
    const placeRunner=(base,runner,context)=>{
      if(base===4){gs.runs++;return true;}
      if(base<1||base>3)return true;
      if(gs.bases[base]){gs.warnings.push(`${context}: ${base}B occupied`);return false;}
      gs.bases[base]=runner;return true;
    };
    const finishOuts=()=>{if(gs.outs>=3){gs.outs=3;gs.bases={1:null,2:null,3:null};gs.inningComplete=true;}};
    for(const event of events){
      gs.lastSequence=Math.max(gs.lastSequence,Number(event.sequence)||0);
      const evInning=Number(event.inning)||gs.inning||1;
      if(gs.inning===null){
        beginInning(evInning);
      }else if(evInning>Number(gs.inning)){
        beginInning(evInning);
      }else if(evInning!==gs.inning){
        gs.warnings.push(`${event.id}: invalid inning transition ${gs.inning} -> ${evInning}`);
        continue;
      }
      if(event.type==='plate_appearance'){
        const advances=Array.isArray(event.advances)?event.advances.map(normalizeMovement):[];
        const moved=[];
        for(const m of advances){
          const runner=gs.bases[m.fromBase];
          if(!movementMatchesRunner(m,runner)){gs.warnings.push(`${event.id}: no matching runner on ${m.fromBase}B`);continue;}
          gs.bases[m.fromBase]=null;
          moved.push({m,runner});
        }
        for(const {m,runner} of moved){
          if(m.out){gs.outs++;continue;}
          placeRunner(m.toBase,runner,event.id);
        }
        const batter=runnerRefFromPA(event);
        const batterBase=Number(event.batterBase)||0;
        if(batterBase===4) gs.runs++;
        else if(batterBase>=1&&batterBase<=3) placeRunner(batterBase,batter,event.id);
        gs.outs+=Math.max(0,Math.min(3,Number(event.outsOnPlay)||0));
        gs.currentBatterOrder=(Number(event.battingOrder)||1)%9+1;
        finishOuts();
      }else if(event.type==='runner_advance'){
        const from=Number(event.fromBase)||0;
        const runner=gs.bases[from];
        if(!movementMatchesRunner(event,runner)){gs.warnings.push(`${event.id}: no matching runner on ${from}B`);continue;}
        if(!event.out && Number(event.toBase)>=1 && Number(event.toBase)<=3 && gs.bases[Number(event.toBase)]){gs.warnings.push(`${event.id}: ${event.toBase}B occupied`);continue;}
        gs.bases[from]=null;
        if(event.out || ['CS','PK'].includes(String(event.reason||'').toUpperCase())) gs.outs++;
        else placeRunner(Number(event.toBase)||0,runner,event.id);
        finishOuts();
      }else if(event.type==='pitch_event'){
        const movements=Array.isArray(event.movements)?event.movements.map(normalizeMovement):[];
        const moved=[];let valid=true;
        for(const m of movements){
          const runner=gs.bases[m.fromBase];
          if(!movementMatchesRunner(m,runner)){gs.warnings.push(`${event.id}: no matching runner on ${m.fromBase}B`);valid=false;break;}
          moved.push({m,runner});
        }
        if(!valid) continue;
        const movingFrom=new Set(moved.map(x=>x.m.fromBase));
        const targets=new Set();
        for(const {m} of moved){
          if(m.out||m.toBase===4) continue;
          if(targets.has(m.toBase) || (gs.bases[m.toBase] && !movingFrom.has(m.toBase))){gs.warnings.push(`${event.id}: target ${m.toBase}B occupied`);valid=false;break;}
          targets.add(m.toBase);
        }
        if(!valid) continue;
        moved.forEach(({m})=>{gs.bases[m.fromBase]=null;});
        moved.forEach(({m,runner})=>{if(m.out)gs.outs++;else placeRunner(m.toBase,runner,event.id);});
        finishOuts();
      }
    }
    return gs;
  }
  function stateBeforeEvent(state,eventId,options={}){
    const event=(state.events||[]).find(e=>e.id===eventId);
    if(!event) return replayGameState(state);
    return replayGameState(state,{...options,beforeSequence:Number(event.sequence)||Infinity});
  }
  function validateRunnerEventAgainstState(state,input,options={}){
    const gs=options.beforeEventId?stateBeforeEvent(state,options.beforeEventId):nextPlateAppearanceState(state,options.side);
    if(gs.inningComplete) throw new Error('Dieses Inning ist bereits mit drei Aus beendet.');
    const from=Number(input.fromBase)||0,to=Number(input.toBase)||0;
    const runner=gs.bases[from];
    if(!runner || !movementMatchesRunner(input,runner)) throw new Error(`Auf der ${from}B befindet sich der ausgewählte Läufer nicht.`);
    const reason=String(input.reason||'').toUpperCase();
    const out=!!input.out || ['CS','PK'].includes(reason);
    if(!out){
      if(!(to>from && to<=4)) throw new Error('Ein Läufer darf nur zur nächsten freien Base vorrücken.');
      if(reason==='SB' && to!==from+1) throw new Error('SB wird in diesem Ablauf als Vorrücken um genau eine Base erfasst.');
      if(to<=3 && gs.bases[to]) throw new Error(`${to}B ist bereits besetzt.`);
    }
    return {...input,inning:String(gs.inning||input.inning||''),batterOrder:gs.currentBatterOrder,out};
  }
  function validatePitchEventAgainstState(state,input,options={}){
    const gs=options.beforeEventId?stateBeforeEvent(state,options.beforeEventId):replayGameState(state);
    if(gs.inningComplete) throw new Error('Dieses Inning ist bereits mit drei Aus beendet.');
    const movements=Array.isArray(input.movements)?input.movements.map(normalizeMovement):[];
    if(!movements.length) throw new Error('Wählen Sie mindestens eine Läuferbewegung aus.');
    const seenFrom=new Set(),targets=new Set();
    for(const m of movements){
      const runner=gs.bases[m.fromBase];
      if(!runner || !movementMatchesRunner(m,runner)) throw new Error(`Auf der ${m.fromBase}B befindet sich der ausgewählte Läufer nicht.`);
      if(seenFrom.has(m.fromBase)) throw new Error('Derselbe Läufer kann in einem Ereignis nicht zweimal bewegt werden.');
      seenFrom.add(m.fromBase);
      if(!m.out){
        if(!(m.toBase>m.fromBase && m.toBase<=4)) throw new Error('Ein Läufer darf nur zu einer vorderen Base vorrücken.');
        if(String(input.reason||'').toUpperCase()==='BK' && m.toBase!==m.fromBase+1) throw new Error('Bei BK rückt jeder Läufer in diesem Ablauf genau eine Base vor.');
        if(m.toBase<=3){if(targets.has(m.toBase))throw new Error(`Zwei Läufer können nicht gleichzeitig zur ${m.toBase}B vorrücken.`);targets.add(m.toBase);}
      }
    }
    for(const m of movements){
      if(!m.out && m.toBase<=3 && gs.bases[m.toBase] && !seenFrom.has(m.toBase)) throw new Error(`${m.toBase}B ist bereits besetzt.`);
    }
    return {...input,inning:String(gs.inning||input.inning||''),batterOrder:gs.currentBatterOrder,movements};
  }
  function validatePlateAppearanceAgainstState(state,slotIndex,paIndex,input){
    const side=state.activeSide==='home'?'home':'guest';
    const existing=(state.events||[]).find(e=>e.type==='plate_appearance'&&e.side===side&&Number(e.slotIndex)===slotIndex&&Number(e.paIndex)===paIndex);
    const gs=existing?stateBeforeEvent(state,existing.id,{side}):nextPlateAppearanceState(state,side);
    const inning=Number(input.inning)||0;
    if(!inning) throw new Error('Bitte ein Inning eingeben.');
    const advances=Array.isArray(input.advances)?input.advances.map(normalizeMovement):[];
    const movingFrom=new Set(),targets=new Set();
    for(const m of advances){
      const runner=gs.bases[m.fromBase];
      if(!runner || !movementMatchesRunner(m,runner)) throw new Error(`Auf der ${m.fromBase}B befindet sich kein passender Läufer.`);
      if(movingFrom.has(m.fromBase)) throw new Error('Derselbe Läufer kann nicht zweimal bewegt werden.');
      movingFrom.add(m.fromBase);
      if(!m.out){
        if(!(m.toBase>m.fromBase && m.toBase<=4)) throw new Error('Ein Läufer darf nur zu einer vorderen Base vorrücken.');
        if(m.toBase<=3){if(targets.has(m.toBase))throw new Error(`Zwei Läufer können nicht gleichzeitig zur ${m.toBase}B vorrücken.`);targets.add(m.toBase);}
      }
    }
    for(const m of advances){if(!m.out && m.toBase<=3 && gs.bases[m.toBase] && !movingFrom.has(m.toBase)) throw new Error(`${m.toBase}B ist bereits besetzt.`);}
    const batterBase=Number(input.batterBase ?? getResultBase(input.result))||0;
    const result=String(input.result||'').toUpperCase();
    if(batterBase>=1){
      for(let base=1;base<=Math.min(3,batterBase);base++){
        if(gs.bases[base] && !movingFrom.has(base)) throw new Error(`Der Läufer auf der ${base}B muss vorrücken, wenn der Schlagmann ${batterBase===4?'Home':`${batterBase}B`} erreicht.`);
      }
    }
    if(result==='HR'){
      for(let base=1;base<=3;base++){
        const runner=gs.bases[base];if(!runner)continue;
        const move=advances.find(m=>Number(m.fromBase)===base);
        if(!move || move.out || Number(move.toBase)!==4) throw new Error('Bei einem HR müssen alle vorhandenen Läufer Home erreichen.');
      }
    }
    if(['BB','IBB','HBP'].includes(result)){
      let forced=true;
      for(let base=1;base<=3 && forced;base++){
        const runner=gs.bases[base];
        if(!runner){forced=false;break;}
        const move=advances.find(m=>Number(m.fromBase)===base);
        if(!move || move.out || Number(move.toBase)!==base+1) throw new Error(`Bei ${result} muss ein erzwungener Läufer genau eine Base vorrücken.`);
      }
    }
    if(batterBase>=1&&batterBase<=3){
      if(targets.has(batterBase)) throw new Error(`${batterBase}B wird in diesem Spielzug bereits verwendet.`);
      if(gs.bases[batterBase] && !movingFrom.has(batterBase)) throw new Error(`${batterBase}B ist besetzt; der Schlagmann kann dort nicht platziert werden.`);
    }
    const outsOnPlay=Math.max(0,Math.min(3,Number(input.outsOnPlay)||0));
    if(Number(gs.outs)+outsOnPlay+advances.filter(m=>m.out).length>3) throw new Error('Dieser Spielzug würde mehr als drei Aus erzeugen.');
    return {...input,inning:String(inning),batterBase,outsOnPlay,advances};
  }
  function updateRunnerEvent(state,eventId,patch){
    const index=(state.events||[]).findIndex(e=>e.id===eventId&&e.type==='runner_advance');
    if(index<0) throw new Error('runner event not found');
    const current=state.events[index];
    const reason=String(patch.reason??current.reason??'').toUpperCase();
    const next={...current,...patch,reason,revision:(Number(current.revision)||1)+1};
    next.notation=patch.notation!==undefined?patch.notation:suggestRunnerNotation(reason,next.batterOrder);
    next.scored=Number(next.toBase)===4&&!next.out;
    state.events[index]=next;return next;
  }
  function updatePitchEvent(state,eventId,patch){
    const index=(state.events||[]).findIndex(e=>e.id===eventId&&e.type==='pitch_event');
    if(index<0) throw new Error('pitch event not found');
    const current=state.events[index];
    const reason=String(patch.reason??current.reason??'').toUpperCase();
    const next={...current,...patch,reason,revision:(Number(current.revision)||1)+1};
    if(Array.isArray(patch.movements))next.movements=patch.movements.map(normalizeMovement);
    next.notation=patch.notation!==undefined?patch.notation:suggestPitchNotation(reason,next.batterOrder);
    state.events[index]=next;return next;
  }
  function removeEvent(state,eventId){
    if(!Array.isArray(state.events))return false;
    const index=state.events.findIndex(e=>e.id===eventId);
    if(index<0)return false;
    const [event]=state.events.splice(index,1);
    if(event.type==='plate_appearance'){
      if(state.slots?.[event.slotIndex]?.plateAppearances) state.slots[event.slotIndex].plateAppearances[event.paIndex]=null;
      state.events=state.events.filter(e=>{
        if(e.type==='runner_advance') return !(Number(e.runnerSlotIndex)===Number(event.slotIndex)&&Number(e.sourcePaIndex)===Number(event.paIndex));
        if(e.type==='pitch_event'){
          e.movements=(e.movements||[]).filter(m=>!(Number(m.runnerSlotIndex)===Number(event.slotIndex)&&Number(m.sourcePaIndex)===Number(event.paIndex)));
          return e.movements.length>0;
        }
        if(e.type==='plate_appearance'){
          e.advances=(e.advances||[]).filter(m=>!(Number(m.runnerSlotIndex)===Number(event.slotIndex)&&Number(m.sourcePaIndex)===Number(event.paIndex)));
        }
        return true;
      });
    }
    return true;
  }
  function getPlateAppearanceDisplayState(state,slotIndex,paIndex){
    const pa=state.slots?.[slotIndex]?.plateAppearances?.[paIndex];
    if(!pa)return null;
    const notes=[];let finalBase=Number(pa.batterBase??getResultBase(pa.result))||0;let scored=finalBase===4;
    const events=orderedEvents(state);
    events.forEach(e=>{
      if(e.type==='runner_advance' && Number(e.runnerSlotIndex)===slotIndex && Number(e.sourcePaIndex)===paIndex){if(e.notation)notes.push(e.notation);if(!e.out){finalBase=Math.max(finalBase,Number(e.toBase)||0);if(Number(e.toBase)===4)scored=true;}}
      if(e.type==='pitch_event') (e.movements||[]).forEach(m=>{if(Number(m.runnerSlotIndex)===slotIndex&&Number(m.sourcePaIndex)===paIndex){if(e.notation)notes.push(e.notation);if(!m.out){finalBase=Math.max(finalBase,Number(m.toBase)||0);if(Number(m.toBase)===4)scored=true;}}});
      if(e.type==='plate_appearance') (e.advances||[]).forEach(m=>{if(Number(m.runnerSlotIndex)===slotIndex&&Number(m.sourcePaIndex)===paIndex&&!m.out){finalBase=Math.max(finalBase,Number(m.toBase)||0);if(Number(m.toBase)===4)scored=true;}});
    });
    return {...pa,finalBase,scored,runnerNotation:[...new Set(notes)].join(' ')};
  }

  function recommendPlateAppearanceRbi(input){
    const result=String(input?.result||'').toUpperCase();
    const scored=(input?.advances||[]).filter(m=>!m.out && Number(m.toBase)===4).length;
    if(result==='E') return 0;
    if(result==='HR') return Math.min(4,scored+1);
    return Math.min(4,scored);
  }

  function emptyBatterStatLine(){
    return Object.fromEntries(BATTER_STATS.map(k=>[k,0]));
  }

  function calculateBatterStats(state){
    const stats=(state.slots||[]).map(slot=>(slot.players||[]).map(()=>emptyBatterStatLine()));
    const ensure=(slotIndex,playerIndex)=>{
      while(stats.length<=slotIndex) stats.push([]);
      while(stats[slotIndex].length<=playerIndex) stats[slotIndex].push(emptyBatterStatLine());
      return stats[slotIndex][playerIndex];
    };
    const events=orderedEvents(state);
    const runKeys=new Set();

    for(const event of events){
      if(event.type!=='plate_appearance') continue;
      const line=ensure(Number(event.slotIndex)||0,Number(event.playerIndex)||0);
      const result=String(event.result||'').toUpperCase();
      line.PA+=1;
      if(!['BB','IBB','HBP','SH','SF'].includes(result)) line.AB+=1;
      if(['1B','2B','3B','HR'].includes(result)) line.H+=1;
      if(result==='2B') line['2B']+=1;
      if(result==='3B') line['3B']+=1;
      if(result==='HR') line.HR+=1;
      if(result==='K') line.K+=1;
      if(result==='BB'||result==='IBB') line['BB/IBB']+=1;
      if(result==='HBP') line.HP+=1;
      if(result==='SH') line.SH+=1;
      if(result==='SF') line.SF+=1;
      const rbi=Number.isFinite(Number(event.rbi))?Number(event.rbi):recommendPlateAppearanceRbi(event);
      line.RBI+=Math.max(0,Math.min(4,rbi||0));
      if(Number(event.batterBase)===4){
        const key=`${event.slotIndex}:${event.paIndex}`;
        if(!runKeys.has(key)){line.R+=1;runKeys.add(key);}
      }
    }

    const creditRun=(movement)=>{
      if(!movement || movement.out || Number(movement.toBase)!==4) return;
      const slotIndex=Number(movement.runnerSlotIndex)||0;
      const playerIndex=Number(movement.runnerPlayerIndex)||0;
      const sourcePaIndex=Number(movement.sourcePaIndex);
      const key=`${slotIndex}:${sourcePaIndex}`;
      if(runKeys.has(key)) return;
      ensure(slotIndex,playerIndex).R+=1;
      runKeys.add(key);
    };

    for(const event of events){
      if(event.type==='runner_advance'){
        const line=ensure(Number(event.runnerSlotIndex)||0,Number(event.runnerPlayerIndex)||0);
        const reason=String(event.reason||'').toUpperCase();
        if(reason==='SB') line.SB+=1;
        if(reason==='CS') line.CS+=1;
        creditRun(event);
      }else if(event.type==='pitch_event'){
        (event.movements||[]).forEach(creditRun);
      }else if(event.type==='plate_appearance'){
        (event.advances||[]).forEach(creditRun);
      }
    }
    return stats;
  }
  function calculatePitcherStats(state,side=state.activeSide==='home'?'guest':'home'){
    const blank=()=>Object.fromEntries(PITCHER_STATS.map(k=>[k,0]));
    const pitchers=state.teams?.[side]?.pitchers||state.pitchers||[];
    const stats=pitchers.map(blank);
    const ensure=index=>{while(stats.length<=index) stats.push(blank());return stats[index];};
    (state.events||[]).filter(e=>e.type==='plate_appearance').filter(event=>(event.pitcherSide||((event.side||'guest')==='guest'?'home':'guest'))===side).forEach(event=>{
      const line=ensure(Number(event.pitcherIndex)||0);
      const result=String(event.result||'').toUpperCase();
      line.BF+=1;
      if(!['BB','IBB','HBP','SH','SF'].includes(result)) line.AB+=1;
      if(['1B','2B','3B','HR'].includes(result)) line.H+=1;
      if(result==='2B') line['2B']+=1;
      if(result==='3B') line['3B']+=1;
      if(result==='HR') line.HR+=1;
      if(result==='K') line.K+=1;
      if(result==='BB'||result==='IBB') line['BB/IBB']+=1;
      if(result==='HBP') line.HP+=1;
      if(result==='SH') line.SH+=1;
      if(result==='SF') line.SF+=1;
    });
    return stats;
  }

  function livePlayerRef(state,slotIndex,playerIndex,side=state.activeSide){
    const teamSlots=state.teams?.[side]?.slots||state.slots;
    const player=teamSlots?.[Number(slotIndex)]?.players?.[Number(playerIndex)]||{};
    return {
      slotIndex:Number(slotIndex)||0,
      playerIndex:Number(playerIndex)||0,
      order:(Number(slotIndex)||0)+1,
      number:String(player.number||''),
      name:String(player.name||'').trim()||`#${(Number(slotIndex)||0)+1}`,
      position:POSITION_NAMES[String(player.pos1||'')]||String(player.pos1||'')
    };
  }
  function lineScoreRuns(row){
    const values=Array.isArray(row)?row:[];
    const totalIndex=values.length-3;
    const explicit=String(values[totalIndex]??'').trim();
    if(explicit!=='' && Number.isFinite(Number(explicit))) return Number(explicit);
    return values.slice(0,totalIndex).reduce((sum,v)=>sum+(Number.isFinite(Number(v))?Number(v):0),0);
  }
  function derivedLiveLineScore(state){
    const guest=Array(LINE_SCORE_COLUMNS).fill('');
    const home=Array(LINE_SCORE_COLUMNS).fill('');
    const calculateSide=(side,target)=>{
      const runsByInning=Array(LINE_SCORE_INNINGS).fill(0);
      const events=orderedEvents(state,{side});
      let previousRuns=0;
      events.forEach(event=>{
        const snapshot=replayGameState(state,{side,beforeSequence:(Number(event.sequence)||0)+1});
        const currentRuns=Number(snapshot.runs)||0;
        const delta=Math.max(0,currentRuns-previousRuns);
        const inning=Math.max(1,Math.min(LINE_SCORE_INNINGS,Number(event.inning)||1))-1;
        runsByInning[inning]+=delta;
        previousRuns=currentRuns;
      });
      runsByInning.forEach((runs,i)=>{if(runs) target[i]=String(runs);});
    };
    calculateSide('guest',guest);
    calculateSide('home',home);
    const existingGuest=Array.isArray(state?.lineScore?.guest)?state.lineScore.guest:[];
    const existingHome=Array.isArray(state?.lineScore?.home)?state.lineScore.home:[];
    const copyLineScore=(source,target)=>{
      if(!Array.isArray(source))return;
      const legacy=source.length<=15;
      source.slice(0,legacy?12:LINE_SCORE_INNINGS).forEach((value,i)=>{if(String(value??'').trim()!=='')target[i]=value;});
      const sourceTotals=legacy?12:source.length-3;
      for(let i=0;i<LINE_SCORE_TOTALS;i++){const value=source[sourceTotals+i];if(String(value??'').trim()!=='')target[LINE_SCORE_INNINGS+i]=value;}
    };
    copyLineScore(existingGuest,guest);
    copyLineScore(existingHome,home);
    return {guest,home};
  }
  function liveCurrentBatter(state,gs){
    const slotIndex=Math.max(0,Math.min(SLOT_COUNT-1,(Number(gs.currentBatterOrder)||1)-1));
    const slot=state.slots?.[slotIndex]||{players:[]};
    const side=state.activeSide==='home'?'home':'guest';
    const recent=(state.events||[])
      .filter(e=>e?.type==='plate_appearance' && e.side===side && Number(e.slotIndex)===slotIndex)
      .slice().sort((a,b)=>(Number(b.sequence)||0)-(Number(a.sequence)||0))[0];
    let playerIndex=recent?Number(recent.playerIndex)||0:slot.players.findIndex(p=>p?.name||p?.number);
    if(playerIndex<0) playerIndex=0;
    return livePlayerRef(state,slotIndex,playerIndex);
  }
  function liveRunner(state,runner,side=state.activeSide){
    if(!runner) return null;
    return {...livePlayerRef(state,runner.slotIndex,runner.playerIndex,side),sourcePaIndex:Number(runner.sourcePaIndex)};
  }
  function baseName(base){return Number(base)===4?'home':`${Number(base)}B`;}
  function baseLongName(base){return ({1:'first base',2:'second base',3:'third base',4:'home'})[Number(base)]||baseName(base);}
  function describeLiveEvent(state,event){
    const inning=Number(event?.inning)||null;
    if(event?.type==='plate_appearance'){
      const p=livePlayerRef(state,event.slotIndex,event.playerIndex,event.side);
      const result=String(event.result||'').toUpperCase();
      const phrases={
        '1B':'schlägt einen Single','2B':'schlägt einen Double','3B':'schlägt einen Triple','HR':'schlägt einen Home Run','BB':'erhält einen Walk','IBB':'erhält einen Intentional Walk','HBP':'wird vom Pitch getroffen',
        'K':'schlägt aus','GO':'schlägt einen Ground Out','FO':'schlägt einen Fly Out','LO':'schlägt einen Line Out','FC':'erreicht die Base durch Fielder’s Choice','E':'erreicht die Base durch einen Error',
        'SF':'schlägt einen Sacrifice Fly','SH':'schlägt einen Sacrifice Bunt','OTHER':'beendet das Plate Appearance'
      };
      const count=` (${Number(event.balls)||0}-${Number(event.strikes)||0})`;
      const direction=event.hitDirection?` nach ${event.hitDirection}`:'';
      const pitchSequence=Array.isArray(event.pitches)&&event.pitches.length?` ${event.pitches.map((pitch,i)=>`${i+1}. ${pitch==='B'?'Ball':'Strike'}`).join(', ')}`:'';
      return {id:event.id,sequence:Number(event.sequence)||0,inning,type:event.type,text:`${p.name} ${phrases[result]||String(event.notation||result||'records a play')}${direction}${count}.${pitchSequence}`};
    }
    if(event?.type==='runner_advance'){
      const p=livePlayerRef(state,event.runnerSlotIndex,event.runnerPlayerIndex);
      const reason=String(event.reason||'').toUpperCase();
      let text;
      if(reason==='SB') text=`${p.name} stole ${baseLongName(event.toBase)}.`;
      else if(reason==='CS') text=`${p.name} was caught stealing.`;
      else if(reason==='PK') text=`${p.name} was picked off.`;
      else if(event.out) text=`${p.name} was out on the bases.`;
      else text=`${p.name} advanced to ${baseName(event.toBase)} (${event.notation||reason||'runner event'}).`;
      return {id:event.id,sequence:Number(event.sequence)||0,inning,type:event.type,text};
    }
    if(event?.type==='pitch_event'){
      const reason=String(event.reason||'').toUpperCase();
      const moved=(event.movements||[]).map(m=>{const p=livePlayerRef(state,m.runnerSlotIndex,m.runnerPlayerIndex);return `${p.name} → ${m.out?'OUT':baseName(m.toBase)}`;}).join(', ');
      return {id:event.id,sequence:Number(event.sequence)||0,inning,type:event.type,text:`${event.notation||reason}${moved?`: ${moved}`:''}.`};
    }
    return null;
  }
  function buildLiveSnapshot(state){
    const trackedSide=state?.activeSide==='home'?'home':'guest';
    const gs=nextPlateAppearanceState(state,trackedSide);
    const derivedLineScore=derivedLiveLineScore(state);
    let guestRuns=lineScoreRuns(derivedLineScore.guest);
    let homeRuns=lineScoreRuns(derivedLineScore.home);
    const guestTotalIndex=(state?.lineScore?.guest?.length||LINE_SCORE_COLUMNS)-LINE_SCORE_TOTALS;
    const homeTotalIndex=(state?.lineScore?.home?.length||LINE_SCORE_COLUMNS)-LINE_SCORE_TOTALS;
    if(String(state?.lineScore?.guest?.[guestTotalIndex]??'').trim()!=='') guestRuns=lineScoreRuns(state.lineScore.guest);
    if(String(state?.lineScore?.home?.[homeTotalIndex]??'').trim()!=='') homeRuns=lineScoreRuns(state.lineScore.home);
    const plays=(state.events||[]).slice().sort((a,b)=>(Number(b.sequence)||0)-(Number(a.sequence)||0)).map(e=>{
      const play=describeLiveEvent(state,e);
      return play?{...play,half:e.side==='home'?'BOTTOM':'TOP'}:null;
    }).filter(Boolean);
    const currentAtBat={balls:Number(state?.game?.currentAtBat?.balls)||0,strikes:Number(state?.game?.currentAtBat?.strikes)||0,pitches:Array.isArray(state?.game?.currentAtBat?.pitches)?state.game.currentAtBat.pitches.slice():[],hitDirection:String(state?.game?.currentAtBat?.hitDirection||'')};
    return {
      inning:gs.inning||1,
      half:trackedSide==='home'?'BOTTOM':'TOP',
      inningLabel:`${gs.inning||1}. Inning ${trackedSide==='home'?'BOTTOM':'TOP'}`,
      outs:gs.outs,
      runs:gs.runs,
      inningComplete:gs.inningComplete,
      warning:gs.warnings?.[0]||'',
      status:state?.game?.status||'in_progress',
      endReason:String(state?.game?.endReason||''),
      endTime:String(state?.game?.end||''),
      currentBatter:liveCurrentBatter(state,gs),
      currentAtBat,
      bases:{1:liveRunner(state,gs.bases[1],trackedSide),2:liveRunner(state,gs.bases[2],trackedSide),3:liveRunner(state,gs.bases[3],trackedSide)},
      guest:{name:String(state?.game?.guest||'Gast'),runs:guestRuns},
      home:{name:String(state?.game?.home||'Heim'),runs:homeRuns},
      lineScore:derivedLineScore,
      plays
    };
  }


  function syncPlateAppearanceEvents(state){
    if(!Array.isArray(state.events)) state.events=[];
    let added=0;
    const side=state.activeSide||'guest';
    (state.slots||[]).forEach((slot,slotIndex)=>{
      (slot.plateAppearances||[]).forEach((pa,paIndex)=>{
        if(!pa) return;
        const key=side==='guest'?`pa:${slotIndex}:${paIndex}`:`${side}:pa:${slotIndex}:${paIndex}`;
        if(state.events.some(e=>e.key===key || (e.type==='plate_appearance'&&e.side===side&&Number(e.slotIndex)===slotIndex&&Number(e.paIndex)===paIndex))) return;
        upsertPlateAppearanceEvent(state,slotIndex,paIndex,{side});
        added++;
      });
    });
    return added;
  }

  function ensureStateShape(state){
    const base=defaultState();
    const out={...base,...state};
    out.game={...base.game,...(state?.game||{}),currentAtBat:{...base.game.currentAtBat,...(state?.game?.currentAtBat||{})}};
    out.lineScore={guest:[...base.lineScore.guest],home:[...base.lineScore.home]};
    const copyIncomingLine=(source,target)=>{
      if(!Array.isArray(source))return;
      const legacy=source.length<=15;
      source.slice(0,legacy?12:LINE_SCORE_INNINGS).forEach((v,i)=>{target[i]=v;});
      const sourceTotals=legacy?12:source.length-3;
      for(let i=0;i<LINE_SCORE_TOTALS;i++)target[LINE_SCORE_INNINGS+i]=source[sourceTotals+i]??'';
    };
    copyIncomingLine(state?.lineScore?.guest,out.lineScore.guest);
    copyIncomingLine(state?.lineScore?.home,out.lineScore.home);
    const normalizeTeam=(teamSource)=>{
      const teamBase=defaultTeam();
      const source=teamSource||{};
      const slots=Array.from({length:SLOT_COUNT},(_,s)=>{
       const incoming=source?.slots?.[s]||{};
      const players=Array.isArray(incoming.players)&&incoming.players.length?incoming.players.map(p=>({...defaultPlayer(),...p,stats:{...defaultPlayer().stats,...(p.stats||{})}})):Array.from({length:INITIAL_PLAYERS_PER_SLOT},defaultPlayer);
      while(players.length<INITIAL_PLAYERS_PER_SLOT) players.push(defaultPlayer());
      let pas=Array.isArray(incoming.plateAppearances)?incoming.plateAppearances.slice(0,PA_COLUMNS):null;
      if(!pas && Array.isArray(incoming.scores)){
        pas=incoming.scores.slice(0,PA_COLUMNS).map((score,i)=>score?{...defaultPlateAppearance(),...score,inning:String(i+1),playerIndex:0}:null);
      }
      if(!pas) pas=[];
      while(pas.length<PA_COLUMNS) pas.push(null);
      pas=pas.map(pa=>{
        if(!pa) return null;
        const migrated={...defaultPlateAppearance(),...pa};
        if(pa.batterBase===undefined || pa.batterBase===null || pa.batterBase==='') migrated.batterBase=getResultBase(pa.result);
        if(pa.finalBase===undefined || pa.finalBase===null || pa.finalBase==='') migrated.finalBase=migrated.batterBase;
        if(pa.scored===undefined) migrated.scored=Number(migrated.finalBase)===4;
        return migrated;
      });
       return {players,plateAppearances:pas};
      });
      const pitchers=Array.isArray(source?.pitchers)&&source.pitchers.length?source.pitchers.map(p=>({...defaultPitcher(),...p})):teamBase.pitchers;
      while(pitchers.length<INITIAL_PITCHERS) pitchers.push(defaultPitcher());
      const catchers=Array.isArray(source?.catchers)&&source.catchers.length?source.catchers.map(c=>({...defaultCatcher(),...c})):teamBase.catchers;
      return {slots,pitchers,catchers,checks:{...base.checks,...(source?.checks||{})},teamPitcher:source?.teamPitcher||'',comments:source?.comments||''};
    };
    const legacy={slots:state?.slots,pitchers:state?.pitchers,catchers:state?.catchers,checks:state?.checks,teamPitcher:state?.teamPitcher,comments:state?.comments};
    out.teams={
      guest:normalizeTeam(state?.teams?.guest||legacy),
      home:normalizeTeam(state?.teams?.home||{})
    };
    out.activeSide=state?.activeSide==='home'?'home':'guest';
    // Keep legacy aliases live for old consumers; the UI switches these to the active team.
    const active=out.teams[out.activeSide];
    out.slots=active.slots; out.pitchers=active.pitchers; out.catchers=active.catchers;
    out.checks=active.checks; out.teamPitcher=active.teamPitcher; out.comments=active.comments;
    out.officials={...base.officials,...(state?.officials||{})};
    out.signatures={...base.signatures,...(state?.signatures||{})};
    out.ruleProfileId=state?.ruleProfileId||RULE_PROFILE.id;
    out.events=Array.isArray(state?.events)?state.events.map(e=>({...e,side:e.side||'guest'})):[];
    out.events.filter(e=>e.type==='plate_appearance').forEach(event=>{
      const team=out.teams[event.side==='home'?'home':'guest'];
      const slotIndex=Number(event.slotIndex);
      const paIndex=Number(event.paIndex);
      if(!team?.slots?.[slotIndex] || !Number.isInteger(paIndex) || paIndex<0 || paIndex>=PA_COLUMNS)return;
      const existing=team.slots[slotIndex].plateAppearances[paIndex];
      if(existing)return;
      team.slots[slotIndex].plateAppearances[paIndex]={
        ...defaultPlateAppearance(),
        inning:String(event.inning||''),
        playerIndex:Number(event.playerIndex)||0,
        result:event.result||'',
        notation:event.notation||'',
        hitDirection:event.hitDirection||'',
        balls:Number(event.balls)||0,
        strikes:Number(event.strikes)||0,
        pitches:Array.isArray(event.pitches)?event.pitches.slice():[],
        batterBase:Number(event.batterBase)||0,
        outsOnPlay:Number(event.outsOnPlay)||0,
        advances:Array.isArray(event.advances)?event.advances.map(normalizeMovement):[],
        rbi:event.rbi,
        rbiMode:event.rbiMode||'auto',
        memo:event.memo||''
      };
    });
    const activeTeam=out.teams[out.activeSide];
    out.slots=activeTeam.slots; out.pitchers=activeTeam.pitchers; out.catchers=activeTeam.catchers;
    out.checks=activeTeam.checks; out.teamPitcher=activeTeam.teamPitcher; out.comments=activeTeam.comments;
    return out;
  }
  function activateTeam(state,side){
    const selected=side==='home'?'home':'guest';
    state.activeSide=selected;
    const team=state.teams?.[selected];
    if(!team)return state;
    state.slots=team.slots; state.pitchers=team.pitchers; state.catchers=team.catchers;
    state.checks=team.checks; state.teamPitcher=team.teamPitcher; state.comments=team.comments;
    return state;
  }
  return {RULE_PROFILE,SLOT_COUNT,INITIAL_PLAYERS_PER_SLOT,INITIAL_PITCHERS,PA_COLUMNS,BATTER_STATS,PITCHER_STATS,PLAYER_FIELDS,PITCHER_FIELDS,RESULT_BASES,getResultBase,defaultOutsForResult,defaultPlayer,defaultPlateAppearance,defaultSlot,defaultPitcher,defaultCatcher,defaultState,addPlayer,removePlayer,addPitcher,removePitcher,setPlateAppearance,getDiamondEdges,upsertPlateAppearanceEvent,deletePlateAppearanceEvent,suggestRunnerNotation,suggestPitchNotation,addRunnerEvent,addPitchEvent,applyRunnerEventToPlateAppearance,applyPitchEventToPlateAppearances,expectedInningForNextPA,nextPlateAppearanceState,replayGameState,stateBeforeEvent,validateRunnerEventAgainstState,validatePitchEventAgainstState,validatePlateAppearanceAgainstState,updateRunnerEvent,updatePitchEvent,removeEvent,getPlateAppearanceDisplayState,recommendPlateAppearanceRbi,calculateBatterStats,calculatePitcherStats,buildLiveSnapshot,syncPlateAppearanceEvents,ensureStateShape,activateTeam};
});
