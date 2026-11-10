/**
 * Outreach evaluation (build plan U12). Demo mode only: the deterministic composer, plus local stand-ins for a model.
 * No key is read, no model is called, no network is used, whatever the environment holds.
 *
 *   npm run eval:outreach
 *
 * Runs 10 goals x 7 personas x 3 relationships x 4 channels (several variants each), the timeline steps through the real
 * draft handler, selected-text drafts, the injection fixtures and the sensitive-topic fixtures. Prints one JSON report and
 * exits 1 when any rule fails. The 20 drafts a reader scores by hand are printed under "samples"; the scores themselves are
 * in research/eval-vertical3.md.
 */
process.env.LYNKR_MOCK = "1";
delete process.env.OPENAI_API_KEY;
delete process.env.ANTHROPIC_API_KEY;

const { buildSamples, failuresByRule, groupFailures, levelOf, runFirstMessages, runInjections, runSelections, runSensitive, runTimeline } = await import("../tests/fixtures/contacts/matrix");

const first = await runFirstMessages();
const steps = await runTimeline();
const selections = await runSelections();
const injections = await runInjections();
const sensitive = await runSensitive();
const samples = await buildSamples();

const slim = (r: { combinations: number; drafts: number; verdicts: Record<string, number>; byChannel: Record<string, { total: number; ready: number; edit: number }>; byGoal: Record<string, { total: number; edit: number }>; editReasons: Record<string, number>; tells: Record<string, number>; draftsWithTells: number; failures: { id: string; rule: string; body: string; detail?: string }[] }) => ({
  combinations: r.combinations, drafts: r.drafts, verdicts: r.verdicts, byChannel: r.byChannel, byGoal: r.byGoal, editReasons: r.editReasons, tells: r.tells, draftsWithTells: r.draftsWithTells, failuresByRule: failuresByRule(r.failures),
});
const fixtureSlim = (r: typeof injections) => ({ cases: r.cases, runs: r.runs, failuresByRule: failuresByRule(r.failures), failuresByKind: Object.fromEntries([...new Set(r.failures.map(f => f.kind))].map(k => [k, r.failures.filter(f => f.kind === k).length])) });

const failures = [...first.failures, ...steps.failures, ...selections.failures, ...injections.failures, ...sensitive.failures];
console.log(JSON.stringify({
  mode: "demo only; no model, key or network",
  firstMessages: slim(first),
  timelineSteps: { ...slim(steps), draftsByStep: steps.byStep },
  selections: { ...slim(selections), quotedInLinkedinMessage: `${selections.quoted}/${selections.quotable}` },
  injections: fixtureSlim(injections),
  sensitive: fixtureSlim(sensitive),
  samples: samples.map(s => ({ n: s.n, id: s.id, verdict: s.verdict, tells: s.tells, body: s.body })),
  failureGroups: groupFailures(failures).map(g => ({ rule: g.rule, level: levelOf(g.rule), path: g.path, count: g.count, example: g.example.id, draft: g.example.body.slice(0, 240), cause: g.cause })),
  failures: failures.map(f => ({ id: f.id, rule: f.rule, detail: f.detail, body: f.body })),
}, null, 2));
if (failures.length) process.exitCode = 1;
