# Task Plan: Address Security, Maintainability & Simplicity Findings

## Goal

Address all review findings for Security (C1-C3), Maintainability (I1-I6), and Simplicity from the code review and simplicity review sessions.

## Phases

### Phase 1: Security Fixes [pending]

**Task 1: Add API key auth to all Next.js proxy routes**

- Add `requireAuth()` helper that validates the API key from auth context
- Apply to: agent-execute, agent-provision, agent-update, agent-clear-state
- Files: `apps/dashboard/src/app/api/*/route.ts`

**Task 2: Add org-scoping to agent provisioning**

- `findFirstAgent()` currently returns ANY agent from DB
- Scope agent lookup by orgId (pass from client or derive from API key)
- File: `apps/dashboard/src/app/api/agent-provision/route.ts`

**Task 3: Allowlist fields in agent-update route**

- Create Zod schema that only allows: name, description, systemPrompt, model, walletId
- Apply to both Next.js proxy and agent-runtime controller
- Files: `apps/dashboard/src/app/api/agent-update/route.ts`, `services/agent-runtime/src/controllers/agent.controller.ts`

### Phase 2: Maintainability Fixes [pending]

**Task 4: Only clear state when wallet changes**

- In auth.tsx, compare old vs new walletId before calling clear-state
- Only clear when wallet actually changed
- File: `apps/dashboard/src/lib/auth.tsx`

**Task 5: Fix dead ternary in base.adapter.ts**

- Replace `this.config.maxTokens ? MAX_ITERATIONS_DEFAULT : MAX_ITERATIONS_DEFAULT` with just `MAX_ITERATIONS_DEFAULT`
- File: `services/agent-runtime/src/framework/base.adapter.ts`

**Task 6: Consolidate system prompt to single source**

- Remove SOLAGENT_SYSTEM_PROMPT from agent-execute/route.ts (used by OpenAI fallback)
- Remove OpenAI fallback entirely (YAGNI — ~110 lines)
- Return clear error when agent-runtime is down
- Canonical prompt lives in: agent-provision DEFAULT_AGENT.systemPrompt + execution.service BEHAVIORAL_RULES
- Files: `apps/dashboard/src/app/api/agent-execute/route.ts`

**Task 7: Add error logging in auth provisioning**

- Replace `.catch(() => {})` with `.catch(err => console.warn(...))`
- File: `apps/dashboard/src/lib/auth.tsx`

**Task 8: Extract shared response-processing helper in page.tsx**

- Extract duplicated ~40 lines between sendMessage and handleToolAction
- Create `processAgentResponse()` and `transitionConfirmedCards()` helpers
- File: `apps/dashboard/src/app/dashboard/page.tsx`

### Phase 3: Simplicity Fixes [pending]

**Task 9: Extract shared utilities**

- Create `apps/dashboard/src/lib/format.ts` with `truncateAddress()`
- Create `apps/dashboard/src/lib/use-copy-to-clipboard.ts` hook
- Create `services/agent-runtime/src/tools/constants.ts` with `FAILED_STATUSES`
- Update all consumers

**Task 10: Trim seed data to single agent**

- Remove 3 extra agent definitions (NFT Monitor, Yield Optimizer, Portfolio Rebalancer)
- Keep only 1 "SolAgent" matching DEFAULT_AGENT
- File: `packages/db/src/seed.ts`

**Task 11: Minor simplifications**

- Remove unnecessary `onboarded` state in page.tsx
- Inline trivial wrapper functions in onboarding-wizard.tsx
- Remove SolAgentError import from transfer.tool.ts (use Error consistently)
- Validate walletPublicKey as base58 in execution.service.ts

### Phase 4: Test & Verify [pending]

- Build the project to ensure no compile errors
- Verify lint passes
- Manual browser testing

## Errors Encountered

| Error      | Attempt | Resolution |
| ---------- | ------- | ---------- |
| (none yet) |         |            |
