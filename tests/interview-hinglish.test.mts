// A Hinglish answer becomes an English fact only when nothing was added in translation (audit P1).
import { test } from "node:test";
import assert from "node:assert/strict";
import { translationHolds } from "../lib/interview/judge";
import { judgeSystem } from "../lib/prompts";

const SAID = "Maine college fest ke liye 2 saal ka feedback survey data Excel me clean kiya aur committee ke liye charts banaye.";

test("an English fact that keeps the names and numbers of a Hinglish answer is accepted", () => {
  assert.equal(translationHolds("I cleaned 2 years of feedback survey data in Excel for my college fest and made charts for the committee.", SAID), true);
});

test("a translation that adds a number, a name, or a lot of new text is refused", () => {
  assert.equal(translationHolds("I cleaned 5 years of feedback survey data in Excel.", SAID), false, "a number nobody said");
  assert.equal(translationHolds("I cleaned feedback survey data in Excel and Tableau for the fest.", SAID), false, "a tool nobody named");
  assert.equal(translationHolds("I cleaned survey data at Infosys for my college fest.", SAID), false, "an employer nobody named");
  assert.equal(translationHolds(`I cleaned 2 years of feedback survey data in Excel. ${"It changed how the whole committee planned every event afterwards. ".repeat(4)}`, SAID), false, "far longer than what was said");
});

test("a fact that is still Hinglish is not counted as a translation, and an empty one is refused", () => {
  assert.equal(translationHolds("Maine feedback survey ka data Excel me clean kiya.", SAID), false);
  assert.equal(translationHolds("  ", SAID), false);
});

test("the judge is told to write facts in English for a Hinglish answer, keeping names and numbers", () => {
  assert.match(judgeSystem("fresher"), /Hinglish[^.]*plain English[^.]*name and number/i);
});
