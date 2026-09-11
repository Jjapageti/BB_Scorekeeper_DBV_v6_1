const assert=require('node:assert/strict');
const c=require('../core.js');

function seeded(){const s=c.defaultState();s.slots[0].players[0].name='A';s.slots[1].players[0].name='B';s.slots[2].players[0].name='C';return s;}
let s=seeded();
c.setPlateAppearance(s,0,0,{inning:'1',playerIndex:0,result:'1B',notation:'1B'});c.upsertPlateAppearanceEvent(s,0,0,{outsOnPlay:0,advances:[]});
assert.throws(()=>c.validateRunnerEventAgainstState(s,{runnerSlotIndex:0,runnerPlayerIndex:0,sourcePaIndex:0,fromBase:1,toBase:3,reason:'SB'}),/한 베이스|one base|다음 베이스/i,'SB cannot skip second base');

c.setPlateAppearance(s,1,0,{inning:'1',playerIndex:0,result:'2B',notation:'2B'});
assert.throws(()=>c.validatePlateAppearanceAgainstState(s,1,0,{inning:'1',playerIndex:0,result:'2B',outsOnPlay:0,advances:[]}),/Stay|진루/i,'runner on first cannot stay while batter reaches second');

s=seeded();c.setPlateAppearance(s,0,0,{inning:'1',playerIndex:0,result:'1B',notation:'1B'});c.upsertPlateAppearanceEvent(s,0,0,{outsOnPlay:0,advances:[]});
c.setPlateAppearance(s,1,0,{inning:'1',playerIndex:0,result:'HR',notation:'HR'});
assert.throws(()=>c.validatePlateAppearanceAgainstState(s,1,0,{inning:'1',playerIndex:0,result:'HR',outsOnPlay:0,advances:[]}),/Home|홈/i,'HR must bring existing runners home');

let p=c.validatePitchEventAgainstState(s,{reason:'BK',movements:[{runnerSlotIndex:0,runnerPlayerIndex:0,sourcePaIndex:0,fromBase:1,toBase:2,out:false}]});assert.equal(p.movements[0].toBase,2);
assert.throws(()=>c.validatePitchEventAgainstState(s,{reason:'BK',movements:[{runnerSlotIndex:0,runnerPlayerIndex:0,sourcePaIndex:0,fromBase:1,toBase:3,out:false}]}),/한 베이스|one base|다음 베이스/i,'BK advancement is one base in this scoring workflow');
console.log('physical flow validation passed');
