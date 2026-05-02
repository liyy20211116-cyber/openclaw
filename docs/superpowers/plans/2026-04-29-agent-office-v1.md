# Agent Office V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a visual one-company office that makes agent work, blockers, operating cadence, and commercialization enablement visible.

**Architecture:** Extend `runtime_status.py` with an `office` object and `enablement_points` derived from the existing platform, funnel, campaign, and agent ops snapshot. Add a React `OfficePage` that consumes the same runtime status API, so the office is a second view of real operating data instead of a decorative mockup.

**Tech Stack:** Python snapshot builder, existing writeback API, React + TypeScript, current shell navigation.

---

### Task 1: Snapshot Contract

**Files:**
- Modify: `scripts/test_runtime_status.py`
- Modify: `scripts/runtime_status.py`

- [ ] Add failing checks for `office.zones`, `office.workstations`, `office.daily_rhythm`, and `enablement_points`.
- [ ] Build the office model from `agent_ops`, `platforms`, `campaigns`, and `lead_funnel`.
- [ ] Add enablement points for platform onboarding, lead ledger, content review, product shelf, agent daily report, and complaint handling.
- [ ] Verify `python scripts/test_runtime_status.py`.

### Task 2: Desktop Office Page

**Files:**
- Modify: `scripts/test_runtime_status_app.py`
- Modify: `jarvis-one-company-os/src/services/runtimeStatusService.ts`
- Create: `jarvis-one-company-os/src/pages/OfficePage.tsx`
- Modify: `jarvis-one-company-os/src/App.tsx`
- Modify: `jarvis-one-company-os/src/app/navigation.ts`

- [ ] Add failing app checks for `/office`, `OfficePage`, office sections, and new frontend types.
- [ ] Add typed office and enablement data models.
- [ ] Render a 2D office map with clickable-feeling workstations, operating rhythm, enablement points, and blockers.
- [ ] Verify `python scripts/test_runtime_status_app.py`.

### Task 3: Verification and Demo

**Files:**
- Generated: `output/coo_ops/runtime-status.json`
- Generated: `jarvis-one-company-os/dist-backend/writeback-api.js`

- [ ] Run `npm test`.
- [ ] Run `npm run lint`.
- [ ] Run `npm run build`.
- [ ] Run `npm run desktop:build`.
- [ ] Run `npm run backend:bundle`.
- [ ] Refresh runtime status and verify `/office` with Playwright.
