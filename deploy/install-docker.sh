#!/usr/bin/env bash
# Run ONCE on a fresh Hetzner Ubuntu/Debian server to install Docker Engine +
# the Compose plugin. Usage: scp this file over, then `bash install-docker.sh`.
set -euo pipefail

echo "Installing Docker via the official convenience script..."
curl -fsSL https://get.docker.com | sh

echo "Enabling and starting the Docker service..."
systemctl enable docker
systemctl start docker

if [ -n "${SUDO_USER:-}" ]; then
  echo "Adding $SUDO_USER to the docker group (log out/in for this to take effect)..."
  usermod -aG docker "$SUDO_USER"
fi

echo "Done. Verify with: docker --version && docker compose version"
