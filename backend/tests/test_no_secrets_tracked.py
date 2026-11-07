"""Guard: no credential-bearing file or secret-shaped value may be tracked by git.

This test never prints a secret. On failure it names the FILE and the pattern type only.
Test fixtures in backend/tests may contain INVENTED keys; they must carry an obvious marker
(fake / test / secret / leaky / abc123 / 1234) so a real key can never hide there.
"""
import re
import subprocess
from pathlib import Path

import pytest

REPO = Path(__file__).resolve().parents[2]

FORBIDDEN_NAMES = [
    re.compile(r"(^|/)\.env$"),
    re.compile(r"(^|/)ebs-credentials\.js$"),
    re.compile(r"(^|/)agent-orchestration-[^/]*\.ya?ml$"),
    re.compile(r"^Oracle_EBS_Intelligence_Hub\.jsonld$"),      # repo ROOT copy only (the ica-schema one is the real upload)
    re.compile(r"(^|/)\.bob/"),
    re.compile(r"\.(pem|key|p12|pfx)$"),
    re.compile(r"(^|/)ica-credentials[^/]*\.txt$"),
]

SECRET_SHAPES = {
    "jwt": re.compile(r"eyJ[A-Za-z0-9_\-]{10,}\.[A-Za-z0-9_\-]{6,}(?:\.[A-Za-z0-9_\-]{6,})?"),
    "sk-key": re.compile(r"\bsk-[A-Za-z0-9_\-]{16,}"),
    "langflow-key": re.compile(r"\blf-[A-Za-z]+-[A-Za-z0-9_\-]{16,}"),
    "github-token": re.compile(r"\b(?:ghp_|gho_|github_pat_)[A-Za-z0-9_]{20,}"),
    "private-key": re.compile(r"-----BEGIN [A-Z ]*PRIVATE KEY-----"),
    "aws-key": re.compile(r"\bAKIA[0-9A-Z]{16}\b"),
}
FAKE_MARKERS = ("fake", "test", "secret", "leaky", "abc123", "1234", "example", "placeholder", "xxxx")
TEXT_EXT = {".py", ".js", ".json", ".jsonld", ".csv", ".md", ".txt", ".yaml", ".yml", ".html", ".css",
            ".bat", ".ps1", ".example", ".cfg", ".ini", ".toml", ".code-workspace"}


def _tracked():
    try:
        out = subprocess.run(["git", "ls-files"], cwd=REPO, capture_output=True, text=True, check=True).stdout
    except Exception:
        pytest.skip("git not available")
    return out.splitlines()


def test_no_credential_files_are_tracked():
    bad = [f for f in _tracked() if any(p.search(f) for p in FORBIDDEN_NAMES)]
    assert not bad, f"credential-bearing files are tracked: {bad}"


def test_no_secret_shaped_values_in_tracked_files():
    problems = []
    for f in _tracked():
        p = REPO / f
        if p.suffix.lower() not in TEXT_EXT or not p.is_file() or p.stat().st_size > 8_000_000:
            continue
        is_test_file = f.startswith("backend/tests/")
        text = p.read_text("utf-8", errors="replace")
        for kind, rx in SECRET_SHAPES.items():
            for m in rx.finditer(text):
                value = m.group(0).lower()
                if is_test_file and any(mark in value or mark in text[max(0, m.start() - 80):m.end() + 80].lower()
                                        for mark in FAKE_MARKERS):
                    continue
                problems.append(f"{f}: {kind}")
    assert not problems, "secret-shaped value(s) in tracked files (values not shown): " + "; ".join(sorted(set(problems)))


def test_test_fixtures_do_not_contain_real_looking_keys():
    """Every key-shaped string inside backend/tests must be marked as invented."""
    for f in _tracked():
        if not f.startswith("backend/tests/") or not f.endswith(".py") or f.endswith("test_no_secrets_tracked.py"):
            continue
        text = (REPO / f).read_text("utf-8", errors="replace")
        for kind, rx in SECRET_SHAPES.items():
            for m in rx.finditer(text):
                around = (m.group(0) + text[max(0, m.start() - 80):m.end() + 80]).lower()
                assert any(mark in around for mark in FAKE_MARKERS), f"{f}: unmarked {kind} fixture"


def test_old_langflow_key_prefix_is_not_tracked():
    """The first characters of the previously used Langflow key must not appear anywhere tracked."""
    prefix = "sk-2T2" + "H"            # split so this file does not contain the literal prefix
    hits = []
    for f in _tracked():
        p = REPO / f
        if p.suffix.lower() in TEXT_EXT and p.is_file() and p.stat().st_size < 8_000_000:
            if prefix in p.read_text("utf-8", errors="replace"):
                hits.append(f)
    assert not hits, f"old key prefix found in: {hits}"


def test_sensitive_names_are_not_trackable_by_accident():
    """Self-test: the file-name rules do match the names we care about."""
    for name in ("backend/.env", "ebs-credentials.js", "agent-orchestration-creation.yaml",
                 "Oracle_EBS_Intelligence_Hub.jsonld", ".bob/settings.json"):
        assert any(p.search(name) for p in FORBIDDEN_NAMES), name
    assert not any(p.search("ica-schema/Oracle_EBS_Intelligence_Hub.jsonld") for p in FORBIDDEN_NAMES)
    assert not any(p.search("ebs-credentials.example.js") for p in FORBIDDEN_NAMES)
    assert not any(p.search("backend/.env.example") for p in FORBIDDEN_NAMES)
