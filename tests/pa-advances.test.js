const assert = require('node:assert/strict');
const core = require('../core.js');

const state = core.defaultState();
state.slots[0].players[0].name='Choi';
state.slots[1].players[0].name='Ha';
core.setPlateAppearance(state,0,0,{inning:'1',playerIndex:0,result:'1B',notation:'1B'});
core.upsertPlateAppearanceEvent(state,0,0,{outsOnPlay:0,advances:[]});

const before = core.replayGameState(state);
assert.equal(before.bases[1].slotIndex,0);

core.setPlateAppearance(state,1,0,{inning:'1',playerIndex:0,result:'1B',notation:'1B'});
assert.throws(()=>core.validatePlateAppearanceAgainstState(state,1,0,{inning:'1',playerIndex:0,result:'1B',outsOnPlay:0,advances:[]}),/1B.*주자|occupied/i,'new batter cannot occupy first while existing runner is left there');

const advances=[{runnerSlotIndex:0,runnerPlayerIndex:0,sourcePaIndex:0,fromBase:1,toBase:3,out:false,scored:false}];
assert.doesNotThrow(()=>core.validatePlateAppearanceAgainstState(state,1,0,{inning:'1',playerIndex:0,result:'1B',outsOnPlay:0,advances}));
core.upsertPlateAppearanceEvent(state,1,0,{outsOnPlay:0,advances});
const after = core.replayGameState(state);
assert.equal(after.bases[1].slotIndex,1);
assert.equal(after.bases[3].slotIndex,0);
assert.equal(after.currentBatterOrder,3);

console.log('PA advance validation tests passed');
