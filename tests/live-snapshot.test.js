const assert=require('node:assert/strict');
const c=require('../core.js');

const s=c.defaultState();
s.game.guest='Sluggers';
s.game.home='Wizards';
s.game.guestChecked=true;
s.slots[0].players[0].number='27';
s.slots[0].players[0].name='Choi';
s.slots[1].players[0].number='14';
s.slots[1].players[0].name='Ha';

c.setPlateAppearance(s,0,0,{inning:'1',playerIndex:0,result:'1B',notation:'1B'});
c.upsertPlateAppearanceEvent(s,0,0,{outsOnPlay:0,advances:[]});
const sb=c.validateRunnerEventAgainstState(s,{runnerSlotIndex:0,runnerPlayerIndex:0,sourcePaIndex:0,fromBase:1,toBase:2,reason:'SB'});
c.addRunnerEvent(s,sb);

const live=c.buildLiveSnapshot(s);
assert.equal(live.inning,1);
assert.equal(live.half,'TOP');
assert.equal(live.outs,0);
assert.equal(live.bases[1],null);
assert.equal(live.bases[2].name,'Choi');
assert.equal(live.currentBatter.order,2);
assert.equal(live.currentBatter.name,'Ha');
assert.equal(live.guest.name,'Sluggers');
assert.equal(live.home.name,'Wizards');
assert.equal(live.guest.runs,0);
assert.ok(live.plays.some(p=>/stole second/i.test(p.text)), 'play-by-play describes stolen base');
assert.ok(live.plays.some(p=>/singles/i.test(p.text)), 'play-by-play describes single');

const homeRunState = c.defaultState();
c.setPlateAppearance(homeRunState,0,0,{inning:'1',playerIndex:0,result:'HR',notation:'HR'});
c.upsertPlateAppearanceEvent(homeRunState,0,0,{outsOnPlay:0,advances:[]});
const homeRunLive = c.buildLiveSnapshot(homeRunState);
assert.equal(homeRunLive.guest.runs,1,'event-derived runs default to guest when no side is selected');
assert.equal(homeRunLive.home.runs,0);
console.log('live snapshot tests passed');
