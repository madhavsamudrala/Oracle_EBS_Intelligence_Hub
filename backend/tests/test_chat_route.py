"""Tests for POST /api/chat - uses a FAKE Langflow, so no network and no keys are needed."""
import httpx
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.routes import chat as chat_module

client = TestClient(app)

GOOD = ("COMP-008 says avoid SELECT * in production.\n"
        "Tool Trace: hybrid-query - Retrieved COMP-008 rule details.")
BAD_TOKEN = ("The knowledge graph tools are still returning \u201cInvalid token\u201d, so I can\u2019t "
             "answer.\nTool Trace: hybrid-query \u2013 failed twice (Invalid token).")


def langflow_body(text):
    """Same JSON shape Langflow returns; extract_ica_message() reads this path."""
    return {"outputs": [{"outputs": [{"results": {"message": {"text": text}}}]}]}


@pytest.fixture(autouse=True)
def configure_ica(monkeypatch):
    """Pretend ICA is configured. These values are fake and never leave the test."""
    monkeypatch.setattr(chat_module, "ICA_WORKFLOW_URL", "https://fake-langflow.test/run")
    monkeypatch.setattr(chat_module, "ICA_API_KEY", "fake-key-for-tests")
    monkeypatch.setattr(chat_module, "MAX_RETRIES", 1)


def fake_langflow(monkeypatch, status=200, body=None, raise_exc=None):
    """Replace the real HTTP call with a function that returns what we choose."""
    async def fake_post(self, url, **kwargs):
        if raise_exc:
            raise raise_exc
        return httpx.Response(status, json=body if body is not None else {},
                              request=httpx.Request("POST", url))
    monkeypatch.setattr(httpx.AsyncClient, "post", fake_post)


def ask(message="Why avoid SELECT *?"):
    return client.post("/api/chat", json={"message": message, "session_id": "t1"}).json()


# ---------- success ----------
def test_real_answer_is_success(monkeypatch):
    fake_langflow(monkeypatch, body=langflow_body(GOOD))
    data = ask()
    assert data["success"] is True
    assert data["source"] == "ica_live"
    assert data["error_kind"] is None
    assert "COMP-008" in data["message"]


# ---------- the Phase 0 fix: apology inside a 200 ----------
def test_invalid_token_apology_is_not_success(monkeypatch):
    fake_langflow(monkeypatch, body=langflow_body(BAD_TOKEN))
    data = ask()
    assert data["success"] is False
    assert data["source"] == "ica_tool_error"
    assert data["error_kind"] == "auth"
    assert "No answer was generated" in data["message"]
    assert "Invalid token" in data["message"]


def test_agent_request_failed_is_agent_error(monkeypatch):
    fake_langflow(monkeypatch, body=langflow_body("The agent request failed: boom"))
    data = ask()
    assert (data["success"], data["source"], data["error_kind"]) == (False, "ica_agent_error", "agent_error")


def test_empty_reply_is_rejected(monkeypatch):
    fake_langflow(monkeypatch, body=langflow_body(""))
    data = ask()
    assert data["success"] is False
    assert data["error_kind"] == "empty_reply"


# ---------- existing behaviour must be unchanged ----------
def test_langflow_401_is_auth_error(monkeypatch):
    fake_langflow(monkeypatch, status=401, body={"detail": "bad key"})
    data = ask()
    assert (data["success"], data["source"]) == (False, "ica_auth_error")


def test_langflow_500_is_server_error(monkeypatch):
    fake_langflow(monkeypatch, status=500, body={})
    data = ask()
    assert (data["success"], data["source"]) == (False, "ica_server_error")


def test_timeout_is_reported(monkeypatch):
    fake_langflow(monkeypatch, raise_exc=httpx.ReadTimeout("slow"))
    data = ask()
    assert (data["success"], data["source"]) == (False, "ica_timeout")


def test_connect_error_is_reported(monkeypatch):
    fake_langflow(monkeypatch, raise_exc=httpx.ConnectError("down"))
    data = ask()
    assert (data["success"], data["source"]) == (False, "ica_connection_error")


def test_empty_message_rejected():
    assert ask("   ")["source"] == "error"


def test_not_configured(monkeypatch):
    monkeypatch.setattr(chat_module, "ICA_API_KEY", "")
    data = ask()
    assert (data["success"], data["source"]) == (False, "config_error")


# ---------- secrets never leak into logs ----------
def test_key_in_reply_is_not_logged(monkeypatch, caplog):
    leaky = ("Invalid token for x-api-key=eyJhbGciOiJIUzUxMiIsInR5cCI6IkpXVCJ9.SECRETPART123\n"
             "Tool Trace: hybrid-query - failed (Invalid token).")
    fake_langflow(monkeypatch, body=langflow_body(leaky))
    with caplog.at_level("ERROR"):
        ask()
    assert "SECRETPART123" not in caplog.text
    assert "[redacted]" in caplog.text


# ---------- Phase 0: one retry for "unreachable" only ----------
UNREACHABLE = ("The knowledge graph is not currently accessible (connection failure).\n"
               "Tool Trace: hybrid-query - failed (connection failure).")
SESSION_EXPIRED = "The agent request failed: Session mint failed (401): exp claim"


def sequence_langflow(monkeypatch, texts):
    """Fake Langflow that returns each text in turn (the last one repeats). Returns the call counter."""
    calls = {"n": 0}

    async def fake_post(self, url, **kwargs):
        i = min(calls["n"], len(texts) - 1)
        calls["n"] += 1
        return httpx.Response(200, json=langflow_body(texts[i]),
                              request=httpx.Request("POST", url))
    monkeypatch.setattr(httpx.AsyncClient, "post", fake_post)
    return calls


@pytest.fixture(autouse=True)
def no_real_sleep(monkeypatch):
    """Do not wait 1.5 seconds in every test."""
    monkeypatch.setattr(chat_module, "UNREACHABLE_RETRY_DELAY", 0)


def test_unreachable_then_success_is_success(monkeypatch):
    calls = sequence_langflow(monkeypatch, [UNREACHABLE, GOOD])
    data = ask()
    assert data["success"] is True
    assert "COMP-008" in data["message"]
    assert calls["n"] == 2


def test_unreachable_twice_reports_failure_after_exactly_two_calls(monkeypatch):
    calls = sequence_langflow(monkeypatch, [UNREACHABLE, UNREACHABLE])
    data = ask()
    assert (data["success"], data["error_kind"]) == (False, "unreachable")
    assert calls["n"] == 2          # one original + ONE retry, never more


def test_unreachable_then_auth_reports_auth(monkeypatch):
    sequence_langflow(monkeypatch, [UNREACHABLE, BAD_TOKEN])
    assert ask()["error_kind"] == "auth"


def test_unreachable_then_network_error_keeps_unreachable(monkeypatch):
    state = {"n": 0}

    async def fake_post(self, url, **kwargs):
        state["n"] += 1
        if state["n"] == 1:
            return httpx.Response(200, json=langflow_body(UNREACHABLE),
                                  request=httpx.Request("POST", url))
        raise httpx.ConnectError("down")
    monkeypatch.setattr(httpx.AsyncClient, "post", fake_post)
    data = ask()
    assert (data["success"], data["error_kind"]) == (False, "unreachable")
    assert state["n"] == 2


@pytest.mark.parametrize("text,kind", [
    (BAD_TOKEN, "auth"),
    (SESSION_EXPIRED, "session_expired"),
    ("The agent request failed: boom", "agent_error"),
    ("", "empty_reply"),
])
def test_other_failures_are_never_retried(monkeypatch, text, kind):
    calls = sequence_langflow(monkeypatch, [text, GOOD])   # a retry WOULD succeed - it must not happen
    data = ask()
    assert (data["success"], data["error_kind"]) == (False, kind)
    assert calls["n"] == 1


def test_good_answer_makes_one_call(monkeypatch):
    calls = sequence_langflow(monkeypatch, [GOOD])
    assert ask()["success"] is True
    assert calls["n"] == 1


# ---------- Phase 0: the final message reflects BOTH attempts ----------
def test_unreachable_twice_message_lists_both_attempts(monkeypatch):
    sequence_langflow(monkeypatch, [UNREACHABLE, UNREACHABLE])
    data = ask()
    assert data["attempts"] == 2
    assert "Tried 2 times (1: unreachable; 2: unreachable)" in data["message"]


def test_unreachable_then_auth_message_shows_changed_outcome(monkeypatch):
    sequence_langflow(monkeypatch, [UNREACHABLE, BAD_TOKEN])
    data = ask()
    assert data["error_kind"] == "auth"
    assert "Tried 2 times (1: unreachable; 2: auth)" in data["message"]


def test_unreachable_then_network_error_names_only_the_exception_class(monkeypatch):
    state = {"n": 0}

    async def fake_post(self, url, **kwargs):
        state["n"] += 1
        if state["n"] == 1:
            return httpx.Response(200, json=langflow_body(UNREACHABLE),
                                  request=httpx.Request("POST", url))
        raise httpx.ConnectError("secret-host-detail-should-not-appear")
    monkeypatch.setattr(httpx.AsyncClient, "post", fake_post)
    data = ask()
    assert "2: ConnectError" in data["message"]
    assert "secret-host-detail" not in data["message"]


def test_attempt_details_never_contain_reply_text_or_keys(monkeypatch):
    leaky = ("Connection failure, x-api-key=eyJhbGciOiJIUzUxMiJ9.LEAKYPART999 not reachable.\n"
             "Tool Trace: hybrid-query - failed (connection failure).")
    sequence_langflow(monkeypatch, [leaky, leaky])
    data = ask()
    assert "LEAKYPART999" not in data["message"]
    assert "eyJ" not in data["message"]
    assert "Tried 2 times" in data["message"]


def test_single_attempt_failures_have_no_tried_text(monkeypatch):
    sequence_langflow(monkeypatch, [BAD_TOKEN])
    data = ask()
    assert data["attempts"] == 1
    assert "Tried" not in data["message"]


def test_success_after_retry_reports_two_attempts(monkeypatch):
    sequence_langflow(monkeypatch, [UNREACHABLE, GOOD])
    assert ask()["attempts"] == 2


def test_plain_success_reports_one_attempt(monkeypatch):
    sequence_langflow(monkeypatch, [GOOD])
    assert ask()["attempts"] == 1
