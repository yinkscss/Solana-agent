# Confirmation Flow Determinism Review

**Date:** 2025-02-23  
**Scope:** Full confirmation flow across dashboard frontend, agent-execute API, and agent-runtime.

---

## Summary

The flow is largely correct, but several issues can cause non-deterministic behavior, duplicate cards, wrong states, or stuck UI. Findings are ordered by severity.

---

## Issues Found

### 1. **Card stuck in "Processing..." forever when backend errors** (High)

**Location:** `apps/dashboard/src/app/dashboard/page.tsx` lines 341–351 (`handleToolAction` catch block)

**What happens:**

- User clicks Confirm → card goes to `status: 'confirmed'` (shows "Processing...")
- Request fails (network, 5xx, etc.)
- Catch block adds an error assistant message but **does not** update the confirmed card
- Card remains "Processing..." indefinitely

**Fix:** In the catch block, transition cards that were just set to `'confirmed'` back to `'pending'` (so user can retry) or add a `'failed'` status and show "Failed – try again".

```ts
} catch {
  // Revert confirmed tools to pending so user can retry
  if (confirmedTools?.length) {
    setMessages((prev) =>
      prev.map((msg) => {
        if (!msg.toolCalls) return msg;
        const updated = msg.toolCalls.map((tc) =>
          tc.status === 'confirmed' && confirmedTools.includes(tc.name)
            ? { ...tc, status: 'pending' as const }
            : tc,
        );
        return { ...msg, toolCalls: updated };
      }),
    );
  }
  setMessages((prev) => [...prev, { ...errorMsg }]);
}
```

Same pattern exists in `sendMessage` catch (lines 247–255) when `confirmedTools` was passed — though that path is less common since `sendMessage` is usually called without `confirmedTools`.

---

### 2. **Optimistic "Executed ✓" when tool never ran** (Medium)

**Location:** `apps/dashboard/src/app/dashboard/page.tsx` lines 234–246 and 328–339

**What happens:**

- User confirms; frontend sends `confirmedTools: ['transfer']`
- If the LLM returns **only text** (no tool calls) — e.g. "I've cancelled that" or an odd response — the response has no `toolCalls`
- Frontend still runs the transition: `tc.status === 'confirmed' && confirmedTools.includes(tc.name) → 'executed'`
- Card shows "Executed ✓" even though the tool was never run

**Cause:** Execution is inferred from `confirmedTools` alone, not from an actual tool result. The API does not indicate which tools were actually executed.

**Fix options:**

1. **Backend:** Have the API return `executedToolNames?: string[]` when tools actually run
2. **Frontend:** Only transition to `'executed'` when the response includes `toolCalls` for that tool
3. **Minimal:** Keep current behavior but add a short note in the UI that execution is best-effort

Recommended: Option 2 — only transition if `data.toolCalls?.some((tc) => tc.name === ...)` for the confirmed tool.

---

### 3. **Multiple same-name tools: confirming one executes all** (Medium)

**Location:**

- Backend: `services/agent-runtime/src/framework/base.adapter.ts` line 122
- Frontend: `handleToolAction` passes `confirmedTools: [toolName]` (name only)

**What happens:**

- One assistant message has two `transfer` calls (e.g. to different addresses)
- User confirms only one; `confirmedTools: ['transfer']`
- Backend checks `confirmedTools.has(toolCall.name)` per tool call
- Both `transfer` calls pass → both run

**Fix:** Confirm by tool call ID (or a stable key) instead of name:

- Include `id` in API response and `ToolCallInfo`
- Send `confirmedToolIds: string[]` instead of `confirmedTools: string[]`
- Backend: `confirmedTools.has(toolCall.id)` or equivalent

---

### 4. **User cancels → possible duplicate pending card** (Low)

**Location:** Backend LLM behavior; frontend correctly shows cancelled state

**What happens:**

- User clicks Cancel → card shows "Cancelled", message "No, cancel that" is sent
- LLM may call the tool again → backend yields `tool_call` again
- New assistant message has pending transfer card
- UI: old card "Cancelled", new card with Confirm/Cancel

This is LLM-dependent. Mitigations:

- System prompt: explicitly say that after "No, cancel that" the agent must not call the same tool again
- Optional: have backend track "user cancelled" and skip re-asking for that turn

---

### 5. **Duplicate tool_call outputs if same tool appears twice** (Low)

**Location:** `apps/dashboard/src/app/api/agent-execute/route.ts` lines 71–78

**What happens:**

- `normalizeAgentRuntimeResponse` appends every `tool_call` to `toolCalls`
- If backend yields multiple `tool_call` outputs for the same logical action, the frontend gets duplicates

In current base adapter flow this is unlikely (one confirmation yield per tool call), but worth noting for future changes.

---

## Verified Correct

| Check                                                                                             | Status |
| ------------------------------------------------------------------------------------------------- | ------ |
| `sendMessage` accepts `confirmedTools`                                                            | OK     |
| New tool calls mapped as `status: 'executed'` when `confirmedTools` passed                        | OK     |
| Previous confirmed tools transitioned to `'executed'` after response                              | OK     |
| `handleToolAction` extracts tool name from `messagesRef` and passes to `sendMessage`              | OK     |
| `CONFIRMATION_REQUIRED_TOOLS` contains transfer, swap, create_wallet                              | OK     |
| Confirmation-required path yields `tool_call`, pushes synthetic result, returns without executing | OK     |
| Confirmed path executes normally                                                                  | OK     |
| ConfirmationCard states: executed / confirmed / cancelled / pending                               | OK     |
| Double-click guard via `isLoading`                                                                | OK     |
| `messagesRef` used to avoid stale closures                                                        | OK     |
| React 18 batching of `setMessages`                                                                | OK     |

---

## Recommended Fix Order

1. **Error handling (Issue 1)** — prevents cards stuck in "Processing..."
2. **Optimistic executed (Issue 2)** — ensures we only show "Executed ✓" when tools actually ran
3. **Same-name tools (Issue 3)** — for correctness when multiple tools share a name

Issues 4 and 5 are lower priority and can be addressed later.
