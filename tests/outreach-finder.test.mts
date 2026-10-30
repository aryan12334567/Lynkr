import { test } from 'node:test';
import assert from 'node:assert/strict';
import { targetLinks, signalIsStale } from '../lib/outreach/finder';
test('finder offers user-run searches suited to the goal', () => {
 const links = targetLinks('clients', 'design', ['Acme']);
 assert.match(links[0].label, /buyer/);
 assert.match(links[0].url, /linkedin\.com\/search/);
});
test('signals older than 60 days or invalid are stale', () => {
 const now = new Date('2026-11-01T00:00:00Z');
 assert.equal(signalIsStale('2026-10-01', now), false);
 assert.equal(signalIsStale('2026-01-01', now), true);
 assert.equal(signalIsStale('invalid', now), true);
});
