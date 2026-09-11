const assert = require('node:assert/strict');
const core = require('../core.js');

const state = core.defaultState();
core.setPlateAppearance(state, 0, 0, {
  inning: '1', playerIndex: 0, result: '1B', notation: '1B', batterBase: 1, memo: ''
});
const paEvent = core.upsertPlateAppearanceEvent(state, 0, 0);

assert.equal(paEvent.type, 'plate_appearance');
assert.equal(paEvent.batterBase, 1);
assert.equal('runnerNotation' in paEvent, false, 'PA event must not store later runner notation');
assert.equal('finalBase' in paEvent, false, 'PA event must not store later runner destination');
assert.equal('scored' in paEvent, false, 'PA event must not store later run state');

const pa = state.slots[0].plateAppearances[0];
assert.equal(pa.batterBase, 1);
assert.equal(pa.finalBase, 1, 'display starts at the base reached by the PA result');
assert.equal(pa.runnerNotation, '');
assert.equal(pa.scored, false);

const runnerEvent = core.addRunnerEvent(state, {
  inning: '1', runnerSlotIndex: 0, runnerPlayerIndex: 0, sourcePaIndex: 0,
  fromBase: 1, toBase: 2, reason: 'SB', batterOrder: 2, notation: 'SB2'
});
assert.equal(runnerEvent.type, 'runner_advance');
assert.equal(runnerEvent.sourcePaIndex, 0);
assert.equal(runnerEvent.notation, 'SB2');

core.applyRunnerEventToPlateAppearance(state, runnerEvent);
assert.equal(pa.finalBase, 2);
assert.equal(pa.runnerNotation, 'SB2');
assert.equal(pa.scored, false);

const edited = core.setPlateAppearance(state, 0, 0, {
  inning: '1', playerIndex: 0, result: 'E', notation: 'E6', batterBase: 1, memo: ''
});
assert.equal(edited.runnerNotation, 'SB2', 'editing PA preserves separately-recorded runner display');
assert.equal(edited.finalBase, 2);

console.log('event separation tests passed');
