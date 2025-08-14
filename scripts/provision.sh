#!/usr/bin/env bash
set -euo pipefail

export DEBIAN_FRONTEND=noninteractive

# Update apt and install prerequisites
apt-get update -y
apt-get upgrade -y
apt-get install -y curl ca-certificates gnupg build-essential

# Install Node.js 18 from NodeSource
if ! command -v node >/dev/null 2>&1; then
  curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
  apt-get install -y nodejs
fi

# Verify Node and npm
node -v
npm -v

# Install Docker Engine
if ! command -v docker >/dev/null 2>&1; then
  echo "Installing Docker Engine..."
  # Add Docker's official GPG key
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  chmod a+r /etc/apt/keyrings/docker.gpg
  
  # Set up the repository
  echo \
    "deb [arch="$(dpkg --print-architecture)" signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
    "$(. /etc/os-release && echo "$VERSION_CODENAME")" stable" | \
    tee /etc/apt/sources.list.d/docker.list > /dev/null
  
  # Install Docker Engine and Docker Compose plugin
  apt-get update -y
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  
  # Add vagrant user to docker group
  usermod -aG docker vagrant
  
  # Enable and start Docker service
  systemctl enable docker
  systemctl start docker
fi

# Verify Docker installation
docker --version
docker compose version

# Install project dependencies and build
cd /vagrant
npm ci || npm install
npm run build

echo "Provisioning complete. Use 'vagrant ssh' to enter the VM."
