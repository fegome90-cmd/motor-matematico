"""Run the pinned agent-docs-kit structural checker, without installing it."""
from pathlib import Path
import importlib.util
import os
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
PIN = "c1efd7bed2c2e74f47a7ce41a893839cfcdc6f57"
KIT = Path(os.environ.get("AGENT_DOCS_KIT_PATH", ROOT / ".tools/agent-docs-kit")).resolve()
if not (KIT / "agent_docs_kit.py").is_file():
    sys.exit("Missing agent-docs-kit. See docs/agent/RUNTIME.md for the pinned checkout.")
head = subprocess.run(
    ["git", "-C", str(KIT), "rev-parse", "HEAD"], capture_output=True, text=True, check=True
).stdout.strip()
if head != PIN:
    sys.exit(f"agent-docs-kit revision mismatch: expected {PIN}, got {head}")
dirty = subprocess.run(
    ["git", "-C", str(KIT), "status", "--porcelain", "--untracked-files=no"],
    capture_output=True, text=True, check=True,
).stdout.strip()
if dirty:
    sys.exit("agent-docs-kit has tracked changes; use the clean pinned checkout")
sys.path.insert(0, str(KIT))
spec = importlib.util.spec_from_file_location("agent_docs_kit", KIT / "agent_docs_kit.py")
module = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = module
spec.loader.exec_module(module)
findings = module.check(ROOT)
for finding in findings:
    print(finding)
if findings:
    sys.exit(1)
print(f"agent-docs-kit {PIN}: 5 documents, structural check PASS (not semantic attestation)")
