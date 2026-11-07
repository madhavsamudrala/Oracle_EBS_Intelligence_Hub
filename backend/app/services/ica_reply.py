"""
backend/app/services/ica_reply.py

Phase 0: decide whether a reply from the ICA agent is a REAL answer or an
agent apology about a failed tool call.

Why this file exists
--------------------
Langflow returns HTTP 200 even when the agent could not reach Context Studio
(for example "Invalid token"). The old code treated every 200 as success, so
the page showed an apology as if it were an answer. This module looks at the
reply text and classifies it. It has no side effects, so it is easy to test.

Limits (be honest about them)
-----------------------------
The agent does not give us a structured "tool failed" flag, so we read the
text. To avoid false alarms we only trust failure phrases in SHORT replies
(real answers are usually longer), or in a "Tool Trace:" line that says the
tool failed. Phase 3 of the plan replaces this with a structured status.
"""
import re
from dataclasses import dataclass

# Replies longer than this are treated as real answers unless the Tool Trace
# line itself says the tool failed.
SHORT_REPLY_LIMIT = 1200

# ---- Failure phrases (matched on lower-case text, curly quotes normalised) ----
_AGENT_ERROR = re.compile(r"^\s*the agent request failed")
# Langflow's own session to ICA has expired ("Session mint failed (401) ... exp claim").
# It clears when Langflow is closed and reopened, so it gets its own clear message.
_SESSION_EXPIRED = re.compile(r"session mint failed|\"exp\" claim|plan \d+ token rejected")
_TRACE_FAILED = re.compile(r"tool trace:[^\n]*\b(fail(ed|ure|s)?|error)\b")
_AUTH = re.compile(
    r"invalid token|unauthori[sz]ed|token (issue|expired|problem)|"
    r"token/connection|authentication (failed|error)"
)
_UNREACHABLE = re.compile(
    r"(connection|connect) (failure|failed|error)|unreachable|system startup|"
    r"gateway (error|timeout)|service unavailable|"
    r"(knowledge graph|context studio|graph|tools?)\b[^.\n]{0,60}?"
    r"(not|n't)\s+(currently\s+)?(accessible|reachable|available)"
)

# ---- Secret patterns removed before anything is logged or shown ----
_SECRETS = [
    re.compile(r"eyJ[A-Za-z0-9_\-]{5,}\.[A-Za-z0-9_\-\.\*]{3,}"),   # JWT / Context Studio key
    re.compile(r"\bsk-[A-Za-z0-9_\-]{8,}"),                          # sk- style keys
    re.compile(r"\blf-[A-Za-z]+-[A-Za-z0-9_\-]{8,}"),                # Langflow keys
    re.compile(r"(?i)x-api-key\s*[=:]\s*\S+"),                       # x-api-key=...
]

_MESSAGES = {
    "auth": (
        "The ICA agent could not read the Context Studio knowledge graph "
        "because its access token was rejected (Invalid token). "
        "No answer was generated. Ask the administrator to check the "
        "Context Studio key in the agent settings, then try again."
    ),
    "unreachable": (
        "The ICA agent could not reach the Context Studio knowledge graph "
        "(connection problem). No answer was generated. "
        "Wait a minute and try again."
    ),
    "tool_failed": (
        "The ICA agent's knowledge-graph lookup failed. "
        "No answer was generated. Please try again."
    ),
    "agent_error": (
        "The ICA agent reported an internal error. "
        "No answer was generated. Please try again."
    ),
    "session_expired": (
        "The ICA session in Langflow has expired. No answer was generated. "
        "Open Langflow, close and reopen it (or open its Playground and send "
        "'Hi'), then try again."
    ),
    "empty_reply": (
        "The ICA agent returned an empty reply. "
        "No answer was generated. Please try again."
    ),
}


@dataclass(frozen=True)
class ReplyCheck:
    ok: bool                 # True = treat as a real answer
    kind: str = "ok"         # ok | auth | unreachable | tool_failed | agent_error | empty_reply
    source: str = "ica_live"  # value for ChatResponse.source
    user_message: str = ""   # clear text to show the user when ok is False


def normalise(text: str) -> str:
    """Lower-case and straighten curly quotes/dashes so patterns match."""
    return (
        (text or "")
        .replace("\u2019", "'").replace("\u2018", "'")
        .replace("\u2011", "-").replace("\u2013", "-").replace("\u2014", "-")
        .lower()
    )


def redact_secrets(text: str) -> str:
    """Replace anything that looks like a key or token with [redacted]."""
    out = text or ""
    for pattern in _SECRETS:
        out = pattern.sub("[redacted]", out)
    return out


def _failure(kind: str) -> ReplyCheck:
    source = ("ica_agent_error"
              if kind in ("agent_error", "empty_reply", "session_expired")
              else "ica_tool_error")
    return ReplyCheck(ok=False, kind=kind, source=source, user_message=_MESSAGES[kind])


def classify_reply(text: str) -> ReplyCheck:
    """Return ReplyCheck(ok=True) for a real answer, otherwise the failure kind."""
    if not (text or "").strip():
        return _failure("empty_reply")

    t = normalise(text)

    if _AGENT_ERROR.search(t):
        if _SESSION_EXPIRED.search(t):
            return _failure("session_expired")
        return _failure("agent_error")

    trace_failed = bool(_TRACE_FAILED.search(t))
    is_short = len(t) <= SHORT_REPLY_LIMIT

    if trace_failed or is_short:
        if _AUTH.search(t):
            return _failure("auth")
        if _UNREACHABLE.search(t):
            return _failure("unreachable")
        if trace_failed:
            return _failure("tool_failed")

    return ReplyCheck(ok=True)
