const assert = require('node:assert/strict');
const core = require('../core.js');

const state = core.defaultState();
assert.equal(state.slots.length, 9, 'nine batting-order slots');
assert.equal(state.slots[0].players.length, 4, 'each slot starts with four player rows');
assert.equal(state.pitchers.length, 4, 'pitcher table starts with four rows');

core.addPlayer(state, 0);
assert.equal(state.slots[0].players.length, 5, 'a fifth player can be added to one batting slot');
core.addPlayer(state, 0);
assert.equal(state.slots[0].players.length, 6, 'players are not capped at four');

core.addPitcher(state);
assert.equal(state.pitchers.length, 5, 'a fifth pitcher can be added');
core.addPitcher(state);
assert.equal(state.pitchers.length, 6, 'pitchers are not capped at four');

core.setPlateAppearance(state, 0, 0, { inning: 3, playerIndex: 0, result: '1B' });
core.setPlateAppearance(state, 0, 1, { inning: 3, playerIndex: 0, result: 'BB' });
assert.equal(state.slots[0].plateAppearances[0].inning, 3);
assert.equal(state.slots[0].plateAppearances[1].inning, 3, 'same batter may bat twice in one inning');
assert.equal(state.slots[0].plateAppearances[1].result, 'BB');

core.setPlateAppearance(state, 0, 2, { inning: 4, playerIndex: 4, result: 'K' });
assert.equal(state.slots[0].plateAppearances[2].playerIndex, 4, 'PA can belong to a substitute beyond the fourth player row');

console.log('core tests passed');

assert.deepEqual(core.getDiamondEdges(0), [], 'no advance lights no basepath');
assert.deepEqual(core.getDiamondEdges(1), ['e3'], '1B lights home-to-first edge');
assert.deepEqual(core.getDiamondEdges(2), ['e3','e2'], '2B lights home-to-first and first-to-second');
assert.deepEqual(core.getDiamondEdges(3), ['e3','e2','e1'], '3B lights through third');
assert.deepEqual(core.getDiamondEdges(4), ['e3','e2','e1','e4'], 'run lights full diamond');
