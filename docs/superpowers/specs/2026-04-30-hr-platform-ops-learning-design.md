# HR Platform Ops Learning Design

## Decision

Use scheme B: Neville HR runs a semi-automated learning loop for platform operations. The system does not scrape, publish, comment, or message users automatically. HR collects learning inputs from public platform observations, manual notes, creator dashboards, internal post metrics, and approved playbooks, then turns them into reusable company knowledge.

## Role Owner

Neville HR is the owner. Its upgraded role is not only "performance and capability gap analysis", but "organizational learning and agent enablement".

Neville must learn continuously, distill what it learns, and train the other agents:

- Luna Growth: content angles, formats, hooks, rhythm, platform-native language.
- Fred Sales: lead signals, conversion paths, offer wording, objection patterns.
- Dobby Customer: comment handling, private-domain follow-up, FAQ signals.
- Snape Audit: content risk, interaction-bait risk, exaggerated-claim risk.
- Jarvis COO: operating cadence, task assignment, cross-agent learning review.
- McGonagall Product: service packaging, paid offer structure, user pain points.

## Architecture

The learning loop has four layers:

1. Source intake: public trend pages, creator dashboards, internal post metrics, competitor observations, and manual CEO notes.
2. HR distillation: Neville converts raw observations into structured lessons.
3. Knowledge base: evergreen platform playbooks live under `config/knowledge/platform-ops/`.
4. Department enablement: Neville sends weekly learning tasks and compact playbook deltas to the relevant agents.

## Knowledge Format

Every reusable lesson must answer:

- Source platform.
- Observed tactic.
- Why it may work.
- When to use it.
- When not to use it.
- Compliance risk.
- Reusable template.
- Next experiment.
- Owner agent.

This prevents vague "套路收藏" and forces each learning item to become a decision-ready operating asset.

## Operating Cadence

- Daily: Neville reviews yesterday's content data and records 1-3 tactical lessons.
- Twice weekly: Neville studies platform-native content examples and updates one playbook section.
- Weekly: Neville publishes a "department enablement memo" for Luna, Fred, Dobby, Snape, and Jarvis.
- After every rejected/underperforming post: Neville records a failure pattern and gives Snape/Luna a prevention rule.
- After every above-baseline post: Neville records a repeatable pattern and gives Luna/Fred a reuse rule.

## Safety Boundaries

- HR can recommend actions, drafts, and experiments.
- HR cannot publish content, send comments, send private messages, or impersonate users.
- Any tactic involving urgency, income, proof, medical/legal/financial claims, or engagement bait must pass Snape audit first.
- Lessons must not store cookies, tokens, passwords, private messages, or personal data.

## Success Criteria

Within 7 days:

- Neville produces a platform learning path.
- `config/knowledge/platform-ops/` contains reusable playbooks and a lesson template.
- Each operating department has at least one actionable enablement note.
- Xiaohongshu post learnings become reusable content rules for the next note cycle.
- COO can inspect what HR learned and which agent was trained from it.
