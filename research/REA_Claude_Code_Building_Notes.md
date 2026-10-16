# Building with Reverse Engineer Anything (REA) and Claude Code
## Practical Notes, Workflow, and Reusable Prompt

> **Source:** Notes synthesized from the supplied video transcript about using Reverse Engineer Anything (REA) with Claude Code.
>
> **Purpose:** Use REA to study how software works, gather evidence about a feature, and build an independently implemented alternative. Treat the process as research and learning—not as permission to copy proprietary code, branding, assets, or a competitor's product for commercial use.

---

## 1. Executive summary

Reverse Engineer Anything (REA) is presented in the transcript as a structured workflow that connects an AI coding agent to analysis tools and computer/browser interaction.

The basic loop is:

1. **Ask a specific question** about an application or feature.
2. **Gather evidence** using REA and suitable analysis tools.
3. **Interpret the evidence** with Claude.
4. **Design and implement** the feature in a separate project.
5. **Test the implementation** against observed behavior.
6. **Return to the evidence** when behavior is unclear, then iterate.

REA can be used through a CLI or as an MCP server. In the transcript, Claude Code uses REA to coordinate analysis and obtain evidence. For native compiled applications, the workflow may use a disassembler/decompiler such as Ghidra or Hopper. For browser interaction, the transcript mentions tools such as Playwright and Puppeteer.

**Core lesson:** Do not begin by asking an agent to recreate a huge application all at once. Start with one well-defined feature, learn how it behaves, implement it, and validate it.

## 2. Important principles

### 2.1 The code is not the moat

The transcript emphasizes that a successful product's defensibility is not just its source code. Other sources of advantage include:

- Distribution and customer acquisition
- Customer support
- Product quality and reliability
- UI/UX and product presentation
- Onboarding and the user journey
- How quickly the team resolves problems
- Useful new features and customer understanding

A technically similar product does not automatically have the same business, users, trust, or distribution.

### 2.2 Use a narrow scope

Reconstructing a complete, mature application is expensive and difficult. The transcript reports long analysis times, high token usage, timeouts, and incomplete results when attempting a whole-app recreation.

Prefer a feature-sized question, for example:

- How does search index and rank results?
- How are nodes added and connected in a mind map?
- How are themes applied to an existing document?
- How does export to PNG work?
- How are keyboard shortcuts handled?

Avoid starting with “rebuild the entire application” unless there is a strong reason, ample time, and a plan to break the work into independently testable pieces.

### 2.3 Evidence before assumptions

Ask Claude to distinguish:
- **Observed facts:** directly visible in the UI, documentation, output, or analysis artifacts
- **Evidence-backed inferences:** conclusions supported by the evidence
- **Unknowns:** behavior that has not been verified

Do not treat a plausible explanation as proof. Keep a record of what was inspected and how conclusions were reached.

### 2.4 Test the implementation, not just the explanation

A feature is not finished because the agent says it is implemented. Validate it in the running application, including normal use, edge cases, persistence, and export/import where relevant.

---

## 3. Understand the components

### REA — Reverse Engineer Anything

In the transcript, REA coordinates the workflow: it helps select analysis tools, run them, collect evidence, and make the results available to the AI agent. It is described as usable through a CLI or MCP server.

### Claude Code

Claude Code is the agentic coding environment that:
- Receives the research question
- Uses REA and other tools
- Interprets the evidence
- Plans and implements the independent project
- Runs tests and inspects results
- Delegates separable tasks to sub-agents when useful

### Ghidra and Hopper

These tools analyze compiled binaries. A decompiler/disassembler can transform machine code into assembly or higher-level pseudocode that is easier to inspect. It does **not** generally recover the original source code exactly.

| Tool | Transcript's description | Practical consideration |
|---|---|---|
| **Ghidra** | Free, open-source, broad platform/architecture support, can be slower and heavier, requires Java | Good default to investigate first when its supported format fits the target |
| **Hopper** | Commercial tool with a demo, described as fast to open files and useful for Mac/iOS binaries | Check current licensing and demo restrictions before relying on it |

The transcript mentions a Hopper demo expiring during the workflow and switching to Ghidra. Product capabilities, prices, versions, and installation steps can change; verify current official documentation before setup.

### Browser and computer interaction

The transcript mentions browser automation technologies such as Playwright and Puppeteer, plus Claude's browser/computer-use features. These help the agent inspect interfaces, click controls, capture evidence, and validate behavior.

### MCP server

MCP allows Claude to access tools exposed by a server. The transcript notes that:
- A server added after a Claude Code session starts may not appear in that already-running session.
- Starting a **new Claude Code session** can allow it to load the updated server configuration.
- Claude Desktop may require a full restart after changing its configuration.
- MCP servers may appear in the coding session's tool/server list rather than the general Connectors interface.

Exact behavior depends on the client, version, and configuration. Verify that the REA tools are actually available in the current session instead of assuming setup succeeded.

---

## 4. Setup checklist

Use this as a checklist rather than blindly granting every permission.

### A. Prepare the project

- [ ] Create a dedicated folder for the new project.
- [ ] Keep the original/reference application separate from the implementation.
- [ ] Open the intended project folder in Claude Code.
- [ ] Read the REA repository's current installation instructions.
- [ ] Install REA using the documented method.
- [ ] Choose and install a suitable binary-analysis tool only if the target requires it.
- [ ] Verify dependencies and supported operating systems/architectures.
- [ ] Start a new Claude Code session after changing MCP configuration.
- [ ] Ask Claude to list or verify the REA tools available in this session.
- [ ] Run one small, harmless analysis to confirm the workflow works before starting a long task.

### B. Claude Code settings mentioned in the transcript

The creator discusses enabling browser tools, computer use, screen recording/accessibility permissions where required, and keeping the computer awake during long remote-control sessions.

Recommended cautious approach:
- Enable only the capabilities needed for the task.
- Prefer background operation or approval-before-control if you need to keep working on the computer.
- Restrict access to unrelated apps and folders where possible.
- Review permission requests before approving them.
- Do not enable broad permission bypass merely for convenience.
- Do not expose credentials, private data, or unrelated workspaces to the agent.
- Keep a recoverable copy of important work and use version control.

**Security note:** Permission-bypass modes and unrestricted computer access increase risk. Use them only when you understand the consequences and are working in a controlled environment.

### C. Verify setup

Ask Claude to report:
1. Whether REA is available in the current session
2. Which analysis tools are installed and usable
3. Which target formats are supported
4. Where reports and artifacts will be saved
5. What permissions or dependencies are missing
6. The smallest safe test to validate the setup

Do not start a costly whole-application analysis until this verification succeeds.

---

## 5. The recommended end-to-end workflow

### Phase 1 — Define one feature

Write a concise research question. Identify the feature's expected inputs, outputs, states, and user-visible behavior.

Example:
> “Study how a mind-map application creates a child node, positions it, updates the outline, saves the document, and restores the node after reopening.”

Define “done” before analysis begins.

### Phase 2 — Inspect the application

Use the UI, official documentation, and permitted tools to observe the feature.

Capture:
- Initial state
- User action
- Resulting state
- Relevant menus and settings
- Error and edge-case behavior
- Keyboard shortcuts
- Persistence after refresh/reopen
- Import/export behavior, if relevant

Record uncertainties rather than filling them with guesses.

### Phase 3 — Gather deeper evidence only if necessary

For web apps and Electron-style apps, browser inspection and accessible application resources may provide enough evidence for many features. Electron apps commonly contain web technologies, though packaging and implementation vary.

For native compiled apps or other binaries, REA may coordinate Ghidra or Hopper analysis. Use this only when it is necessary and authorized. Decompiled output can be incomplete, ambiguous, or difficult to map back to behavior.

### Phase 4 — Produce a feature specification

Before coding, have Claude summarize:
- What the feature does
- Its user-visible states
- Data structures and state transitions
- Important rules and edge cases
- Evidence supporting each conclusion
- Open questions
- Proposed independent implementation
- Acceptance tests

### Phase 5 — Implement in a separate project

Ask Claude to create a clean implementation using an appropriate stack. Do not copy proprietary source, assets, branding, or protected content. Reproduce general functionality through independent code and original design decisions.

Keep the implementation small enough to test. Avoid building unrelated features before the core behavior works.

### Phase 6 — Validate in the browser or app

Test each acceptance criterion:
- Does the control respond correctly?
- Is the resulting state correct?
- Does the layout remain usable?
- Does data persist after reload/reopen?
- Do keyboard interactions work?
- Are import/export files valid, if applicable?
- What happens on invalid input or empty states?

Use screenshots or recordings to compare the observed behavior with the new implementation. Log failures and fix them one by one.

### Phase 7 — Iterate

If a test fails:
1. Describe the mismatch precisely.
2. Identify what evidence is missing.
3. Inspect only the relevant feature or state.
4. Update the specification if the evidence changes it.
5. Implement the smallest correction.
6. Rerun the failing test and nearby regression tests.

This targeted loop is usually more efficient than repeatedly analyzing the entire application.

---

## 6. Sub-agents and model selection

The transcript uses parallel sub-agents with different responsibilities and suggests assigning simpler work to a cheaper/faster model and complex reasoning to a stronger model.

A practical division of work:

| Agent/workstream | Responsibility | Deliverable |
|---|---|---|
| Research agent | Inspect documentation and user-visible behavior | Evidence log and uncertainties |
| Architecture agent | Propose data model and component structure | Technical plan |
| Implementation agent | Build the scoped feature | Code and tests |
| QA agent | Run acceptance tests and inspect failures | Test report and reproduction steps |
| Integration/review agent | Check consistency across workstreams | Integrated changes and unresolved issues |

Rules:
- Delegate work that can proceed independently.
- Give each agent a clear scope and expected output.
- Have one primary agent own integration and final decisions.
- Avoid multiple agents editing the same files simultaneously.
- Require evidence and test results, not just status updates.
- Use a stronger model for ambiguous analysis, architecture, and difficult debugging; use a cheaper model for bounded tasks when quality is sufficient.
- Model names, capabilities, and settings change; use what is available in the current environment.

---

## 7. Timeouts, context, and usage management

The transcript reports that whole-app analysis can take tens of minutes or longer, may time out, and can consume a large portion of the available usage. Its example involves extensive analysis of a compiled application and more than 200,000 functions; that should not be interpreted as a normal requirement for every project.

To control cost and complexity:
- Begin with a feature, not the whole product.
- Set a bounded objective and checkpoint.
- Ask for progress summaries and saved artifacts between phases.
- Store findings in Markdown files instead of relying on conversation context alone.
- Use sub-agents only where parallelism meaningfully helps.
- Avoid repeatedly re-reading the same evidence.
- Do not run expensive decompilation unless it can answer a concrete question.
- If a process is taking too long, ask what evidence remains missing and whether a narrower investigation would answer the question.

A longer timeout does not make a poorly scoped task efficient. Make the work smaller before simply increasing the time limit.

---

## 8. The screen-recording alternative

The creator's preferred alternative for many UI-heavy tasks is to record the application and let Claude analyze the recording, rather than immediately decompiling a complete application.

### Suggested process

1. Record a deliberate walkthrough of one feature.
2. Move slowly enough for each interaction to be visible.
3. Include the initial state, the action, and the result.
4. Include relevant settings, menus, and error states.
5. Provide the recording to a workflow that can extract/transcribe audio and inspect frames.
6. Ask Claude to align observations with timestamps.
7. Ask for a feature specification and test plan before implementation.
8. Implement and validate against the recording.

The transcript suggests inspecting many frames per minute and mentions sampling as densely as 10 frames per second for some visual work. Treat this as a task-dependent heuristic, not a universal requirement. Start with a lower sampling rate and inspect more densely around animations or subtle transitions. More frames increase processing cost.

### Copy-paste prompt for recording analysis

> Analyze the attached screen recording as evidence of how this feature behaves.
>
> 1. Extract or transcribe relevant audio if available.
> 2. Inspect the video over time and sample frames densely enough to capture meaningful interactions and transitions.
> 3. Build a timestamped sequence of user actions and visible state changes.
> 4. Identify controls, layout, typography, colors, animation, loading states, error states, and persistence behavior that are actually observable.
> 5. Separate observed facts from inferences and unknowns.
> 6. Produce a feature specification and acceptance-test checklist.
> 7. Do not start implementation until the specification is clear. Ask focused questions only when a missing detail materially blocks progress.
> 8. Implement an independent version in this project, then compare it against the recording and report discrepancies.
>
> Keep the investigation scoped to the feature shown. Do not infer hidden backend logic from visual evidence alone.

---

## 9. Reusable Claude Code master prompt

Use this prompt for a lawful research and independent implementation project. Replace the bracketed sections before running it.

```text
You are the technical lead for a scoped software research and implementation project.

PROJECT
- Target application or reference: [name]
- Feature to study: [one specific feature]
- My project folder: [path or current workspace]
- Intended stack, if known: [stack]
- Desired outcome: [observable behavior and acceptance criteria]

IMPORTANT BOUNDARIES
- Work only with software and materials I am authorized to inspect.
- The purpose is learning and independent implementation.
- Do not copy proprietary source code, private assets, branding, or protected content.
- Do not bypass authentication, licensing, access controls, or other security protections.
- Build an original implementation with its own code and design.
- If a requested action raises legal, privacy, or security concerns, explain the concern and propose a safe alternative.

OPERATING RULES
1. First inspect the current workspace and explain the project state.
2. Verify whether REA and its tools are available in this session. Do not assume that installation or MCP configuration succeeded.
3. Identify the minimum tools needed. Use browser/UI inspection first when sufficient; use binary analysis only when authorized and necessary.
4. Before expensive or long-running analysis, state the question it is intended to answer and the expected evidence.
5. Investigate the specified feature only. Do not analyze the entire application unless I explicitly approve a reasoned scope expansion.
6. Maintain a research log with:
   - Observed facts
   - Evidence and artifact locations
   - Inferences
   - Unknowns
   - Decisions and rationale
7. Produce a feature specification and acceptance tests before substantial implementation.
8. Implement in the current project without damaging unrelated files. Explain the planned file changes first.
9. Use sub-agents only for separable tasks. Give each a clear deliverable and avoid conflicting file edits.
10. Run the application and test every acceptance criterion. Do not claim a feature works without evidence.
11. If a test fails, isolate the mismatch, gather only the missing evidence, make the smallest correction, and rerun the test.
12. Save durable progress notes in Markdown so work can resume in a new session.
13. Track long-running operations and usage. If the work is becoming too expensive or broad, recommend a narrower scope.

DELIVERABLES
- research/feature-evidence.md
- research/feature-spec.md
- research/acceptance-tests.md
- implementation and tests in the project
- research/validation-report.md

START NOW
Step 1: inspect the workspace and available tools.
Step 2: confirm the feature scope and identify missing information.
Step 3: propose a short research plan with checkpoints.
Step 4: begin with the smallest safe investigation.
Do not start a whole-application rebuild by default.
```

---

## 10. Validation checklist

Before calling a feature complete:

- [ ] The implementation matches the agreed feature specification.
- [ ] Each acceptance criterion has a test result.
- [ ] Important edge cases have been checked.
- [ ] Persistence works if it is part of the expected behavior.
- [ ] Import/export has been checked if relevant.
- [ ] No unrelated project files were changed unintentionally.
- [ ] Evidence, assumptions, and unresolved questions are documented.
- [ ] The application can be run from the documented instructions.
- [ ] A future Claude session can resume from the saved Markdown notes.

---

## 11. Common failure modes and responses

| Failure mode | Recommended response |
|---|---|
| Claude does not see REA tools | Verify installation/configuration; start a new Code session and check the available tool list. |
| The analysis is vague | Ask a narrower question and require evidence for each conclusion. |
| Decompilation is slow | Analyze only the relevant binary/component or use UI recording if sufficient. |
| The task times out | Save progress, reduce scope, split the task into checkpoints, and rerun only the unfinished part. |
| Token usage grows rapidly | Avoid repeated analysis, save findings to files, and delegate bounded tasks selectively. |
| The clone looks right but behaves incorrectly | Use acceptance tests and reproduce each mismatch in a controlled sequence. |
| Multiple agents conflict | Assign ownership by file or workstream and centralize integration. |
| UI behavior is unclear | Record a slow walkthrough and inspect timestamps/frames around the interaction. |
| The feature relies on hidden behavior | Mark it unknown until supported by evidence; do not invent the internal mechanism. |

---

## 12. Final takeaways

1. **REA organizes the investigation; it does not eliminate the need for engineering judgment.**
2. **Start with one feature.** Whole-app analysis is slow, costly, and difficult to validate.
3. **Use evidence, then specify, implement, and test.**
4. **Screen recordings can be a simpler first method for UI-heavy features.**
5. **Use sub-agents for independent work and keep a single integration owner.**
6. **Save progress in files** so context survives session changes.
7. **Protect your time and usage limits** by narrowing the scope and avoiding redundant analysis.
8. **Treat legal and ethical boundaries seriously.** Study behavior and build independently rather than commercially copying a proprietary product.
9. **A working product requires more than code:** distribution, support, onboarding, UX, and customer value matter.

*These notes reflect the supplied transcript. They are a practical synthesis, not a verification of REA's current repository, installation process, tool compatibility, pricing, or legal status. Check current official documentation for version-specific setup details.*
