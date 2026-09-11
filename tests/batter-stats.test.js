const assert=require('node:assert/strict');
const c=require('../core.js');

assert.equal(typeof c.calculateBatterStats,'function','v6 exposes automatic batter stats calculator');
assert.equal(typeof c.recommendPlateAppearanceRbi,'function','v6 exposes RBI recommendation helper');

// RBI recommendation: runs produced by the PA, but an error defaults to zero.
assert.equal(c.recommendPlateAppearanceRbi({result:'1B',advances:[{toBase:4,out:false}]}),1);
assert.equal(c.recommendPlateAppearanceRbi({result:'GO',advances:[{toBase:4,out:false}]}),1);
assert.equal(c.recommendPlateAppearanceRbi({result:'HR',advances:[{toBase:4,out:false},{toBase:4,out:false}]}),3);
assert.equal(c.recommendPlateAppearanceRbi({result:'E',advances:[{toBase:4,out:false}]}),0);

const s=c.defaultState();
s.slots[0].players[0].name='Choi';
s.slots[1].players[0].name='Ha';

// Choi singles.
c.setPlateAppearance(s,0,0,{inning:'1',playerIndex:0,result:'1B',notation:'1B',rbi:0,rbiMode:'manual'});
c.upsertPlateAppearanceEvent(s,0,0,{outsOnPlay:0,advances:[],rbi:0,rbiMode:'manual'});

// During Ha's PA, Choi steals second.
const sb=c.addRunnerEvent(s,c.validateRunnerEventAgainstState(s,{
  runnerSlotIndex:0,runnerPlayerIndex:0,sourcePaIndex:0,fromBase:1,toBase:2,reason:'SB'
}));
assert.equal(sb.notation,'SB2');

// Ha doubles, scoring Choi. RBI is auto-recommended as 1.
const beforeHa=c.replayGameState(s);
const haMove={runnerSlotIndex:0,runnerPlayerIndex:0,sourcePaIndex:0,fromBase:2,toBase:4,out:false};
const haValid=c.validatePlateAppearanceAgainstState(s,1,0,{
  inning:String(c.expectedInningForNextPA(beforeHa)),playerIndex:0,result:'2B',notation:'2B',
  batterBase:2,outsOnPlay:0,advances:[haMove]
});
const haRbi=c.recommendPlateAppearanceRbi(haValid);
c.setPlateAppearance(s,1,0,{...haValid,rbi:haRbi,rbiMode:'auto'});
c.upsertPlateAppearanceEvent(s,1,0,{outsOnPlay:0,advances:haValid.advances,rbi:haRbi,rbiMode:'auto'});

// Ha is then caught stealing third.
c.addRunnerEvent(s,c.validateRunnerEventAgainstState(s,{
  runnerSlotIndex:1,runnerPlayerIndex:0,sourcePaIndex:0,fromBase:2,toBase:3,reason:'CS',out:true
}));

let stats=c.calculateBatterStats(s);
assert.deepEqual(stats[0][0],{
  PA:1,AB:1,R:1,RBI:0,H:1,'2B':0,'3B':0,HR:0,K:0,'BB/IBB':0,HP:0,SH:0,SF:0,SB:1,CS:0
});
assert.deepEqual(stats[1][0],{
  PA:1,AB:1,R:0,RBI:1,H:1,'2B':1,'3B':0,HR:0,K:0,'BB/IBB':0,HP:0,SH:0,SF:0,SB:0,CS:1
});

// Manual RBI override must win even if the play would auto-recommend one.
const haEvent=s.events.find(e=>e.type==='plate_appearance'&&e.slotIndex===1&&e.paIndex===0);
haEvent.rbi=0;
haEvent.rbiMode='manual';
stats=c.calculateBatterStats(s);
assert.equal(stats[1][0].RBI,0,'manual RBI override wins');

// Editing/cancelling the SB is reflected immediately because stats are derived from events.
c.removeEvent(s,sb.id);
stats=c.calculateBatterStats(s);
assert.equal(stats[0][0].SB,0,'cancelled SB disappears from derived stats');

// AB formula: BB / IBB / HBP / SH / SF are PA but not AB.
const s2=c.defaultState();
['BB','IBB','HBP','SH','SF','K'].forEach((result,idx)=>{
  c.setPlateAppearance(s2,idx,0,{inning:'1',playerIndex:0,result,notation:result});
  c.upsertPlateAppearanceEvent(s2,idx,0,{outsOnPlay:c.defaultOutsForResult(result),advances:[],rbi:0,rbiMode:'manual'});
});
const st2=c.calculateBatterStats(s2);
assert.equal(st2[0][0].PA,1); assert.equal(st2[0][0].AB,0); assert.equal(st2[0][0]['BB/IBB'],1);
assert.equal(st2[1][0].PA,1); assert.equal(st2[1][0].AB,0); assert.equal(st2[1][0]['BB/IBB'],1);
assert.equal(st2[2][0].PA,1); assert.equal(st2[2][0].AB,0); assert.equal(st2[2][0].HP,1);
assert.equal(st2[3][0].PA,1); assert.equal(st2[3][0].AB,0); assert.equal(st2[3][0].SH,1);
assert.equal(st2[4][0].PA,1); assert.equal(st2[4][0].AB,0); assert.equal(st2[4][0].SF,1);
assert.equal(st2[5][0].PA,1); assert.equal(st2[5][0].AB,1); assert.equal(st2[5][0].K,1);

console.log('v6 batter stats tests passed');
