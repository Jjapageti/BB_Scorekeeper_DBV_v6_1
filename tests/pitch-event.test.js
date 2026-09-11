const assert = require('node:assert/strict');
const core = require('../core.js');

const state = core.defaultState();
core.setPlateAppearance(state, 0, 0, { inning:'1', playerIndex:0, result:'1B', notation:'1B', batterBase:1 });
core.setPlateAppearance(state, 1, 0, { inning:'1', playerIndex:0, result:'2B', notation:'2B', batterBase:2 });

assert.equal(typeof core.addPitchEvent, 'function', 'Pitch Event API must exist');
assert.equal(typeof core.applyPitchEventToPlateAppearances, 'function', 'Pitch Event renderer API must exist');
assert.equal(core.suggestPitchNotation('WP', 3), 'WP3');
assert.equal(core.suggestPitchNotation('PB', 4), 'PB4');
assert.equal(core.suggestPitchNotation('BK', 5), 'BK5');

const event = core.addPitchEvent(state, {
  inning:'1', reason:'WP', batterOrder:3,
  movements:[
    {runnerSlotIndex:0, runnerPlayerIndex:0, sourcePaIndex:0, fromBase:1, toBase:2, out:false},
    {runnerSlotIndex:1, runnerPlayerIndex:0, sourcePaIndex:0, fromBase:2, toBase:3, out:false}
  ],
  memo:'one wild pitch, two runners advance'
});
assert.equal(event.type, 'pitch_event');
assert.equal(event.reason, 'WP');
assert.equal(event.notation, 'WP3');
assert.equal(event.movements.length, 2);
assert.equal(state.events.filter(e => e.type === 'pitch_event').length, 1, 'one WP must be one event even with multiple runner movements');

assert.equal(core.applyPitchEventToPlateAppearances(state, event), 2);
assert.equal(state.slots[0].plateAppearances[0].finalBase, 2);
assert.equal(state.slots[1].plateAppearances[0].finalBase, 3);
assert.match(state.slots[0].plateAppearances[0].runnerNotation, /WP3/);
assert.match(state.slots[1].plateAppearances[0].runnerNotation, /WP3/);

console.log('pitch event tests passed');
