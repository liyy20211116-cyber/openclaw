# Autonomous Revenue Goal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a goal-driven autonomous revenue loop that turns "earn CNY 10,000 in one month" into project discovery, offer design, content production, sales assets, delivery planning, and CEO approval queues.

**Architecture:** Add a Python revenue-goal engine under `scripts/` that writes structured artifacts under `output/revenue_goals/`, then expose the latest active goal through `runtime_status.py` and the browser runtime page. The first version is deterministic and safety-gated: it creates plans, drafts, and approvals, but does not publish, message, quote, or book revenue.

**Tech Stack:** Python scripts and tests, JSON/Markdown artifacts, existing runtime status API, React runtime page.

---

### Task 1: Revenue Goal Engine

**Files:**
- Create: `scripts/revenue_goal_loop.py`
- Create: `scripts/test_revenue_goal_loop.py`

- [ ] **Step 1: Write the failing test**

Create `scripts/test_revenue_goal_loop.py` with assertions that `run_revenue_goal_loop(target_cny=10000, days=30)` returns at least three project candidates, one selected project, at least six department actions, zero booked revenue, and artifact paths for evidence, plan, and approvals.

- [ ] **Step 2: Run the test to verify it fails**

Run: `python scripts\test_revenue_goal_loop.py`

Expected: FAIL with `ModuleNotFoundError: No module named 'revenue_goal_loop'`.

- [ ] **Step 3: Implement the minimal engine**

Create `scripts/revenue_goal_loop.py` with:
- `build_project_candidates()`
- `score_candidates(candidates)`
- `select_primary_project(scored)`
- `build_department_actions(selected, target_cny)`
- `build_approval_queue(actions)`
- `run_revenue_goal_loop(target_cny, days, run_id=None, dry_run=True)`

The first three project candidates should be:
- "AI 一人公司诊断服务" priced at CNY 999-2999.
- "平台内容 SOP 搭建服务" priced at CNY 1999-4999.
- "OpenClaw / Jarvis 本地自动化部署陪跑" priced at CNY 2999-9999.

- [ ] **Step 4: Run the test to verify it passes**

Run: `python scripts\test_revenue_goal_loop.py`

Expected: PASS.

### Task 2: Runtime Status Integration

**Files:**
- Modify: `scripts/runtime_status.py`
- Modify: `scripts/test_runtime_status.py`

- [ ] **Step 1: Write the failing runtime test**

Extend `scripts/test_runtime_status.py` to assert that `build_runtime_status()` includes `revenue_goal`, with `target_cny`, `current_gap_cny`, `selected_project`, `approval_queue_count`, and `artifacts`.

- [ ] **Step 2: Run the test to verify it fails**

Run: `python scripts\test_runtime_status.py`

Expected: FAIL because `revenue_goal` is missing.

- [ ] **Step 3: Load latest revenue goal**

Add `_latest_revenue_goal()` to `scripts/runtime_status.py`. It should read the newest `output/revenue_goals/*/evidence.json`, return a compact object, and return an empty inactive object if none exists.

- [ ] **Step 4: Run tests**

Run: `python scripts\test_runtime_status.py`

Expected: PASS.

### Task 3: Browser Runtime Panel

**Files:**
- Modify: `jarvis-one-company-os/src/services/runtimeStatusService.ts`
- Modify: `jarvis-one-company-os/src/pages/RuntimePage.tsx`

- [ ] **Step 1: Add TypeScript types**

Add `RuntimeRevenueGoal` to `runtimeStatusService.ts` and add `revenue_goal` to `RuntimeStatusSnapshot`.

- [ ] **Step 2: Add runtime panel**

In `RuntimePage.tsx`, add a panel titled `营收目标` showing target, gap, selected project, department action count, and approval queue count.

- [ ] **Step 3: Build**

Run: `npm run build` in `jarvis-one-company-os`.

Expected: build succeeds.

### Task 4: Scheduler Hook

**Files:**
- Create: `scripts/register_autonomous_revenue_loop.ps1`
- Modify: `config/unattended-health-guardian.json`
- Modify: `scripts/test_unattended_health_guardian.py`

- [ ] **Step 1: Write failing guardian test**

Assert the health guardian config includes a scheduled job for `JarvisAutonomousRevenueLoop-Daily`.

- [ ] **Step 2: Add registration script**

Create a PowerShell script that registers a daily Windows scheduled task running:

`python scripts\revenue_goal_loop.py --target-cny 10000 --days 30`

- [ ] **Step 3: Add health guardian job**

Add a read-only health check job for the revenue loop task.

- [ ] **Step 4: Run guardian tests**

Run: `python scripts\test_unattended_health_guardian.py`

Expected: PASS.

### Task 5: End-to-End Verification

**Files:**
- Generated only under `output/revenue_goals/`

- [ ] **Step 1: Run revenue loop**

Run: `python scripts\revenue_goal_loop.py --target-cny 10000 --days 30 --dry-run`

Expected: prints JSON with `ok: true`, `target_cny: 10000`, at least one selected project, and artifact paths.

- [ ] **Step 2: Refresh runtime status**

Run: `python scripts\runtime_status.py`

Expected: runtime JSON contains `revenue_goal.active: true`.

- [ ] **Step 3: Verify browser API**

Run a POST to `http://localhost:5173/api/company/runtime-status` and confirm the returned snapshot includes the active revenue goal.

---

## Self-Review

- The plan covers goal intake, project discovery, scoring, offer/action generation, approval queue, runtime visibility, and scheduler hook.
- No external action is automated.
- The first version is deterministic so tests are stable and the company can start operating without relying on LLM availability.

