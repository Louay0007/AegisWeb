#!/usr/bin/env python3
"""Deploy AegisWeb to a VPS over SSH (password auth via paramiko)."""

from __future__ import annotations

import os
import sys
import tarfile
import time
from pathlib import Path

import paramiko

ROOT = Path(__file__).resolve().parents[1]
HOST = os.environ.get("VPS_HOST", "80.240.27.4")
USER = os.environ.get("VPS_USER", "root")
PASSWORD = os.environ.get("VPS_PASSWORD", "")
REMOTE_DIR = "/opt/aegisweb"
ARCHIVE = Path("/tmp/aegisweb-vps-deploy.tgz")

EXCLUDE_DIRS = {
    "node_modules",
    ".next",
    "dist",
    ".git",
    "coverage",
    "playwright-report",
    "test-results",
    "agent-transcripts",
    ".turbo",
    "terminals",
}
EXCLUDE_FILES = {".DS_Store"}


def die(msg: str) -> None:
    print(f"ERROR: {msg}", file=sys.stderr)
    sys.exit(1)


def build_archive() -> None:
    print(f"Packing {ROOT} -> {ARCHIVE}")
    if ARCHIVE.exists():
        ARCHIVE.unlink()

    def filter_tar(info: tarfile.TarInfo):
        parts = Path(info.name).parts
        if any(part in EXCLUDE_DIRS for part in parts):
            return None
        if Path(info.name).name in EXCLUDE_FILES:
            return None
        return info

    with tarfile.open(ARCHIVE, "w:gz") as tar:
        tar.add(ROOT, arcname="aegisweb", filter=filter_tar)
    print(f"Archive size: {ARCHIVE.stat().st_size / 1e6:.1f} MB")


def connect() -> paramiko.SSHClient:
    if not PASSWORD:
        die("Set VPS_PASSWORD")
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    print(f"Connecting to {USER}@{HOST} ...")
    client.connect(HOST, username=USER, password=PASSWORD, timeout=30, allow_agent=False, look_for_keys=False)
    return client


def run(client: paramiko.SSHClient, cmd: str, check: bool = True, timeout: int = 600) -> str:
    print(f"$ {cmd}")
    stdin, stdout, stderr = client.exec_command(cmd, timeout=timeout, get_pty=True)
    out = stdout.read().decode("utf-8", errors="replace")
    err = stderr.read().decode("utf-8", errors="replace")
    code = stdout.channel.recv_exit_status()
    if out.strip():
        print(out[-4000:])
    if err.strip() and code != 0:
        print(err[-2000:], file=sys.stderr)
    if check and code != 0:
        die(f"Remote command failed ({code}): {cmd}")
    return out


def main() -> None:
    if not (ROOT / ".env.vps").exists():
        die("Missing .env.vps — generate it first")
    if not (ROOT / "infra/docker-compose.vps.yml").exists():
        die("Missing infra/docker-compose.vps.yml")

    build_archive()
    client = connect()
    try:
        run(client, "uname -a && free -h | head -2 && df -h / | tail -1")

        # Base packages
        run(
            client,
            "export DEBIAN_FRONTEND=noninteractive; "
            "apt-get update -qq && "
            "apt-get install -y -qq ca-certificates curl gnupg nginx tar gzip",
            timeout=900,
        )

        # Docker
        run(
            client,
            "if ! command -v docker >/dev/null 2>&1; then "
            "curl -fsSL https://get.docker.com | sh; "
            "systemctl enable --now docker; "
            "fi; docker --version; docker compose version",
            timeout=900,
        )

        # Free port 80 if something else holds it (caddy/apache)
        run(
            client,
            "systemctl stop caddy apache2 2>/dev/null || true; "
            "docker ps --format '{{.Names}}' | grep -i caddy | xargs -r docker stop || true",
            check=False,
        )

        run(client, f"mkdir -p {REMOTE_DIR} && rm -rf {REMOTE_DIR}/aegisweb")

        print("Uploading archive ...")
        sftp = client.open_sftp()
        sftp.put(str(ARCHIVE), "/tmp/aegisweb-vps-deploy.tgz")
        sftp.close()

        run(client, f"tar -xzf /tmp/aegisweb-vps-deploy.tgz -C {REMOTE_DIR} && ls {REMOTE_DIR}/aegisweb | head")

        # Nginx site
        run(
            client,
            f"cp {REMOTE_DIR}/aegisweb/infra/vps/nginx-aegisweb.conf /etc/nginx/sites-available/aegisweb && "
            "rm -f /etc/nginx/sites-enabled/default && "
            "ln -sfn /etc/nginx/sites-available/aegisweb /etc/nginx/sites-enabled/aegisweb && "
            "nginx -t && systemctl enable nginx && systemctl restart nginx",
        )

        # Build + start stack (long)
        print("Building and starting Docker stack (this can take 15–40 minutes) ...")
        run(
            client,
            f"cd {REMOTE_DIR}/aegisweb && "
            "docker compose --env-file .env.vps -f infra/docker-compose.vps.yml up -d --build",
            timeout=3600,
        )

        time.sleep(8)
        run(client, f"cd {REMOTE_DIR}/aegisweb && docker compose --env-file .env.vps -f infra/docker-compose.vps.yml ps")
        run(client, "curl -fsS http://127.0.0.1/login >/dev/null && echo WEB_OK || echo WEB_FAIL", check=False)
        run(client, "curl -fsS http://127.0.0.1/v1/health/ready && echo && echo API_OK || echo API_FAIL", check=False)
        run(client, "curl -fsS http://127.0.0.1/sandbox/health && echo && echo SANDBOX_OK || echo SANDBOX_FAIL", check=False)

        print("\nDeploy finished.")
        print(f"  Dashboard: http://{HOST}")
        print(f"  API:       http://{HOST}/v1/health/ready")
        print(f"  Sandbox:   http://{HOST}/sandbox/")
        print(f"  Mail:      http://{HOST}/mail/")
        print("  Login:     founder@northstarlabs.dev / Password123!")
    finally:
        client.close()


if __name__ == "__main__":
    main()
