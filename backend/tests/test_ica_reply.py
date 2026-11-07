"""Tests for app/services/ica_reply.py - is a 200 reply a real answer or an apology?"""
import pytest
from app.services.ica_reply import classify_reply, redact_secrets

# ---- Real replies copied (shortened) from the live agent: must be ACCEPTED ----
REAL_GREETING = ("Hello. I am the Oracle EBS Intelligence Hub assistant for the Cook County "
                 "AMS Project. Ask me about EBS tables, reports, AP/AR/GL/PO/HRMS business rules, "
                 "or paste a SQL query to review.")

REAL_COMP008 = (
    'In this EBS hub, rule COMP-008 "No SELECT Star" says SELECT * must be avoided in production '
    "SQL because:\n- It fetches every column, causing unnecessary I/O.\n"
    "- It prevents efficient execution plans.\n- It breaks when the table structure changes.\n\n"
    "Tool Trace: ebs-hub-01a1a7d3-context-broker-hybrid-query - Retrieved COMP-008 rule details."
)

# ---- Apologies copied from test-ica.bat run of 2026-11-06: must be REJECTED ----
APOLOGY_AP = (
    "The Oracle EBS knowledge graph tools are still returning \u201cInvalid token\u201d for AP "
    "reporting queries, even after a retry, so I can\u2019t access the official list.\n\n"
    "Tool Trace: ebs-hub-01a1a7d3-context-broker-hybrid-query \u2013 failed twice (Invalid token; "
    "no AP report list retrieved).")

APOLOGY_UNREACHABLE = (
    "The Oracle EBS knowledge graph I must use isn\u2019t reachable right now (connection failure), "
    "so I can\u2019t pull the COMP\u2011008 text.\n\nTool Trace: ebs-hub-01a1a7d3-context-broker-"
    "hybrid-query \u2013 connection failed (no COMP-008 details retrievable).")

APOLOGY_NOT_ACCESSIBLE = (
    "The knowledge graph isn\u2019t currently accessible (token issue), so I can\u2019t retrieve the "
    "specific COMP-008 rule text.\n\nTool Trace: hybrid-query - failed twice (system startup, then "
    "invalid token); no usable COMP-008 rule text returned.")


@pytest.mark.parametrize("text", [REAL_GREETING, REAL_COMP008])
def test_real_answers_are_accepted(text):
    result = classify_reply(text)
    assert result.ok is True
    assert result.source == "ica_live"


def test_invalid_token_apology_is_rejected_as_auth():
    result = classify_reply(APOLOGY_AP)
    assert result.ok is False
    assert result.kind == "auth"
    assert result.source == "ica_tool_error"
    assert "No answer was generated" in result.user_message


def test_connection_failure_is_rejected_as_unreachable():
    result = classify_reply(APOLOGY_UNREACHABLE)
    assert (result.ok, result.kind) == (False, "unreachable")


def test_token_issue_apology_is_rejected():
    result = classify_reply(APOLOGY_NOT_ACCESSIBLE)
    assert result.ok is False
    assert result.kind in ("auth", "unreachable")


def test_agent_request_failed_is_agent_error():
    result = classify_reply("The agent request failed: upstream error")
    assert (result.ok, result.kind, result.source) == (False, "agent_error", "ica_agent_error")


@pytest.mark.parametrize("text", ["", "   ", None])
def test_empty_reply_is_rejected(text):
    result = classify_reply(text)
    assert (result.ok, result.kind) == (False, "empty_reply")


def test_long_real_answer_that_merely_mentions_invalid_token_is_accepted():
    """A rule description may legitimately contain the words 'invalid token'. Long
    answers without a failed Tool Trace must not be rejected."""
    long_answer = ("Explanation of ORA-01722 invalid number versus an invalid token in a "
                   "lexer. " * 40) + "\nTool Trace: hybrid-query - returned 3 matching rules."
    assert len(long_answer) > 1200
    assert classify_reply(long_answer).ok is True


def test_short_answer_with_successful_trace_is_accepted():
    text = "COMP-001 requires an ORG_ID filter.\nTool Trace: hybrid-query - returned 2 matching rules."
    assert classify_reply(text).ok is True


def test_failed_trace_in_long_reply_is_still_rejected():
    text = ("Some explanation. " * 100) + "\nTool Trace: hybrid-query - failed (Invalid token)."
    result = classify_reply(text)
    assert result.ok is False


def test_redact_secrets_removes_keys():
    # All three values are made up for this test (not real keys).
    dirty = ("x-api-key=eyJhbGciOiJIUzUxMiIsInR5cCI6IkpXVCJ9.abc123def456 and "
             "sk-TESTfakefake1234 and lf-user-fakefake123456")
    clean = redact_secrets(dirty)
    assert "eyJ" not in clean
    assert "sk-TESTfakefake1234" not in clean
    assert "lf-user-fakefake123456" not in clean
    assert "[redacted]" in clean


def test_langflow_session_expired_has_its_own_clear_message():
    """Real text captured from the live backend log on 2026-11-07."""
    text = ('The agent request failed: Session mint failed (401): Plan 26 token rejected: '
            '"exp" claim timestamp check failed (AUTHENTICATION_ERROR)')
    result = classify_reply(text)
    assert (result.ok, result.kind, result.source) == (False, "session_expired", "ica_agent_error")
    assert "Langflow" in result.user_message
    assert "reopen" in result.user_message
