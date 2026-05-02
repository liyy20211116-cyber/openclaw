"""
Standardized skill output module for OpenClaw agents.

Usage:
    import sys, os
    sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
    from _shared.output import SkillOutput

    out = SkillOutput()
    out.summary = "Task completed successfully"
    out.data = {"key": "value"}
    out.add_artifact("report.md", "## Report content")
    out.emit()
"""

import json
import sys
import time
from typing import Any, Optional


class SkillOutput:
    def __init__(self):
        self._start_time = time.time()
        self.status: str = "success"
        self.summary: str = ""
        self.data: dict[str, Any] = {}
        self.artifacts: list[dict[str, Any]] = []
        self.error: Optional[str] = None
        self.next_action: Optional[dict[str, Any]] = None
        self.metrics: dict[str, Any] = {}

    def add_artifact(self, name: str, content: str, artifact_type: str = "text"):
        self.artifacts.append({
            "name": name,
            "content": content,
            "type": artifact_type,
        })

    def fail(self, error_message: str):
        self.status = "failed"
        self.error = error_message

    def suggest_next(self, skill_id: str, agent_id: str, params: Optional[dict] = None):
        self.next_action = {
            "skillId": skill_id,
            "agentId": agent_id,
            "params": params or {},
        }

    def emit(self):
        execution_ms = int((time.time() - self._start_time) * 1000)
        result = {
            "status": self.status,
            "summary": self.summary,
            "data": self.data,
            "artifacts": self.artifacts,
            "metrics": {
                "executionMs": execution_ms,
                **self.metrics,
            },
        }
        if self.error:
            result["error"] = self.error
        if self.next_action:
            result["nextAction"] = self.next_action

        print(json.dumps(result, ensure_ascii=False))
        sys.exit(0 if self.status != "failed" else 1)

    @staticmethod
    def quick_success(summary: str, data: Optional[dict] = None):
        out = SkillOutput()
        out.summary = summary
        if data:
            out.data = data
        out.emit()

    @staticmethod
    def quick_fail(error: str):
        out = SkillOutput()
        out.fail(error)
        out.emit()
