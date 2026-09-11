const assert = require('node:assert/strict');
const core = require('../core.js');

const state = core.defaultState();
state.slots[0].players[0].name='Choi';
state.slots[1].players[0].name='Ha';

core.setPlateAppearance(state,0,0,{inning:'1',playerIndex:0,result:'1B',notation:'1B'});
core.upsertPlateAppearanceEvent(state,0,0,{outsOnPlay:0,advances:[]});
let gs = core.replayGameState(state);
assert.equal(gs.inning,1);
assert.equal(gs.currentBatterOrder,2,'after batting order 1 PA, order 2 is current');
assert.equal(gs.bases[1].slotIndex,0);
assert.equal(gs.bases[1].playerIndex,0);
assert.equal(gs.bases[2],null);
assert.equal(gs.outs,0);

const sb = core.addRunnerEvent(state,{
  runnerSlotIndex:0,runnerPlayerIndex:0,sourcePaIndex:0,
  fromBase:1,toBase:2,reason:'SB',batterOrder:2,inning:'1'
});
gs = core.replayGameState(state);
assert.equal(gs.bases[1],null);
assert.equal(gs.bases[2].slotIndex,0);
assert.equal(sb.notation,'SB2');

assert.throws(()=>core.validateRunnerEventAgainstState(state,{
  runnerSlotIndex:0,runnerPlayerIndex:0,fromBase:1,toBase:2,reason:'SB'
}),/1B.*주자|runner/i,'cannot move a runner from a base they no longer occupy');

const bk = core.addPitchEvent(state,{
  inning:'1',reason:'BK',batterOrder:2,
  movements:[{runnerSlotIndex:0,runnerPlayerIndex:0,sourcePaIndex:0,fromBase:2,toBase:3,out:false}]
});
gs = core.replayGameState(state);
assert.equal(gs.bases[2],null);
assert.equal(gs.bases[3].slotIndex,0);
assert.equal(bk.notation,'BK2');

assert.equal(core.removeEvent(state,bk.id),true);
gs = core.replayGameState(state);
assert.equal(gs.bases[2].slotIndex,0,'deleting pitch event rolls the runner back to second');
assert.equal(gs.bases[3],null);

console.log('game state tests passed');
