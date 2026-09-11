const assert = require('node:assert/strict');
const core = require('../core.js');

assert.equal(core.RULE_PROFILE.id, 'DBV_BSVBB_2026');
assert.equal(core.RULE_PROFILE.automaticUmpireRulings, false);
assert.equal(core.RULE_PROFILE.includesMLBAutomation, false);
assert.ok(core.RULE_PROFILE.sources.some(s => s.includes('DBV Scoring-Lehrbuch')));
assert.ok(core.RULE_PROFILE.sources.some(s => s.includes('BuSpO 2026')));
assert.ok(core.RULE_PROFILE.sources.some(s => s.includes('BSVBB DVO 2026')));

const state = core.defaultState();
assert.deepEqual(state.events, []);
assert.equal(state.ruleProfileId, 'DBV_BSVBB_2026');

core.setPlateAppearance(state, 0, 0, {
  inning: '1', playerIndex: 0, result: '1B', notation: '1B', batterBase: 1
});
let ev = core.upsertPlateAppearanceEvent(state, 0, 0);
assert.equal(ev.type, 'plate_appearance');
assert.equal(ev.inning, '1');
assert.equal(ev.battingOrder, 1);
assert.equal(ev.result, '1B');
assert.equal(state.events.length, 1);

core.setPlateAppearance(state, 0, 0, {
  inning: '1', playerIndex: 0, result: 'E', notation: 'E6', batterBase: 1
});
ev = core.upsertPlateAppearanceEvent(state, 0, 0);
assert.equal(state.events.length, 1, 'editing a PA updates its event instead of duplicating it');
assert.equal(ev.result, 'E');
assert.equal(ev.revision, 2);

const runnerEvent = core.addRunnerEvent(state, {
  inning: '1', runnerSlotIndex: 0, runnerPlayerIndex: 0,
  fromBase: 1, toBase: 2, reason: 'SB', batterOrder: 2, notation: 'SB2'
});
assert.equal(runnerEvent.type, 'runner_advance');
assert.equal(runnerEvent.reason, 'SB');
assert.equal(runnerEvent.notation, 'SB2');
assert.equal(state.events.length, 2);

assert.equal(core.suggestRunnerNotation('SB', 2), 'SB2');
assert.equal(core.suggestPitchNotation('WP', 5), 'WP5');
assert.equal(core.suggestPitchNotation('PB', 5), 'PB5');
assert.equal(core.suggestPitchNotation('BK', 2), 'BK2');
assert.equal(core.suggestRunnerNotation('CS', 2), 'CS');

assert.equal(core.deletePlateAppearanceEvent(state, 0, 0), true);
assert.equal(state.events.some(e => e.type === 'plate_appearance'), false);

console.log('rule profile + event tests passed');
const legacy = core.defaultState();
legacy.events = [];
core.setPlateAppearance(legacy, 1, 0, { inning:'2', playerIndex:0, result:'K', notation:'K' });
assert.equal(core.syncPlateAppearanceEvents(legacy), 1);
assert.equal(legacy.events.length, 1);
assert.equal(core.syncPlateAppearanceEvents(legacy), 0, 'sync is idempotent when no PA changed');
