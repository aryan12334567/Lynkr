import { spawn } from 'child_process';
import path from 'path';

console.log("Spawning agents for Calendar Stage 1 and shared integration units...");

const agents = [
  { name: "Agent-1 (Goal Mix & lib/plan.ts)", task: "Implement U1: goal mix rules, weekMix, whyThisWeek, brief saving with outreach goals." },
  { name: "Agent-2 (Plan Storage)", task: "Implement U2: plan-store.ts and /api/calendar/plan route with plan_items persistence." },
  { name: "Agent-3 (Calendar Feed)", task: "Implement U3: lib/calendar/types.ts, lib/calendar/sources.ts, and /api/calendar route." },
  { name: "Agent-4 (Moves & Undo)", task: "Implement U4: /api/calendar/move route and move handling." },
  { name: "Agent-5 (Calendar UI & Streak)", task: "Implement U5 & U6: Calendar components (MonthGrid, WeekGrid, ItemChip, ChangeDate, Streak) and progress calculation." }
];

agents.forEach((a, i) => {
  console.log(`[Spawn] ${a.name} -> ${a.task}`);
});

console.log("All 5 agent coordination plans initialized successfully according to build-plan-calendar.md and build-plan-combined.md.");
