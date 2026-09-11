const assert = require('node:assert/strict');
const core = require('../core.js');

function addPA(state, orderIndex, paIndex, inning, result) {
  core.setPlateAppearance(state, orderIndex, paIndex, {
    inning: String(inning), playerIndex: 0, result, notation: result
  });
  core.upsertPlateAppearanceEvent(state, orderIndex, paIndex, {});
}

// A stray future-inning event must NOT silently reset the game state before 3 outs.
{
  const s = core.defaultState();
  addPA(s, 0, 0, 1, 'K');
  addPA(s, 1, 0, 2, 'K'); // invalid: inning 1 is not over yet
  const gs = core.replayGameState(s);
  assert.equal(gs.inning, 1, 'invalid inning jump must not change current inning');
  assert.equal(gs.outs, 1, 'invalid future-inning PA must be ignored, not reset outs');
  assert.ok(gs.warnings.some(w => /inning/i.test(w) || /이닝/.test(w)), 'invalid jump should be reported');
}

// Three outs completes inning 1; next valid PA is automatically inning 2.
{
  const s = core.defaultState();
  addPA(s, 0, 0, 1, 'K');
  addPA(s, 1, 0, 1, 'K');
  addPA(s, 2, 0, 1, 'K');
  let gs = core.replayGameState(s);
  assert.equal(gs.inningComplete, true);
  assert.equal(core.expectedInningForNextPA(gs), 2);

  addPA(s, 3, 0, 2, '1B');
  gs = core.replayGameState(s);
  assert.equal(gs.inning, 2);
  assert.equal(gs.outs, 0);
  assert.equal(gs.inningComplete, false);
  assert.ok(gs.bases[1]);
  assert.equal(gs.currentBatterOrder, 5);
}

// Skipping directly from inning 1 to inning 3 is invalid even after 3 outs.
{
  const s = core.defaultState();
  addPA(s, 0, 0, 1, 'K');
  addPA(s, 1, 0, 1, 'K');
  addPA(s, 2, 0, 1, 'K');
  assert.throws(() => core.validatePlateAppearanceAgainstState(s, 3, 0, {
    inning: '3', playerIndex: 0, result: '1B', notation: '1B',
    batterBase: 1, outsOnPlay: 0, advances: []
  }), /2회|2 inning|다음 이닝/i);
}

console.log('inning transition tests passed');
