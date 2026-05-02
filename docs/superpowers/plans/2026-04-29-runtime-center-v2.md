# Runtime Center V2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the runtime center from a single Xiaohongshu post monitor into a cross-platform one-company operations command center.

**Architecture:** `scripts/runtime_status.py` remains the source of truth for the runtime snapshot and expands it with platform, campaign, lead funnel, agent ops, and risk structures. The desktop writeback API continues serving the JSON snapshot, while `RuntimePage.tsx` renders the richer view using typed frontend models.

**Tech Stack:** Python snapshot builder, JSON files under `config/` and `output/coo_ops/`, React + TypeScript desktop UI, existing writeback API.

---

### Task 1: Runtime Snapshot Contract

**Files:**
- Modify: `scripts/test_runtime_status.py`
- Modify: `scripts/runtime_status.py`

- [ ] Add failing tests for `platforms`, `campaigns`, `lead_funnel`, `agent_ops`, and `risk_alerts`.
- [ ] Implement platform synthesis from `config/integrations.json` and current XHS monitor CSV.
- [ ] Preserve the legacy `business_monitor` field for existing consumers.
- [ ] Verify `python scripts/test_runtime_status.py`.

### Task 2: Desktop App Contract

**Files:**
- Modify: `scripts/test_runtime_status_app.py`
- Modify: `jarvis-one-company-os/src/services/runtimeStatusService.ts`
- Modify: `jarvis-one-company-os/src/pages/RuntimePage.tsx`

- [ ] Add failing app integration checks for the V2 sections.
- [ ] Extend frontend types for platform matrix, campaigns, lead funnel, agent ops, and risk alerts.
- [ ] Rebuild the runtime center layout around cross-platform operations.
- [ ] Verify `python scripts/test_runtime_status_app.py`.

### Task 3: Verification and Demo

**Files:**
- Modify: `jarvis-one-company-os/dist-backend/writeback-api.js` via backend bundle.

- [ ] Run `npm test`.
- [ ] Run `npm run lint`.
- [ ] Run `npm run desktop:build`.
- [ ] Run `npm run backend:bundle`.
- [ ] Refresh `runtime-status.json`, restart/open the desktop app, and verify `/runtime`.
