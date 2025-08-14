# -*- mode: ruby -*-
# vi: set ft=ruby :

Vagrant.configure("2") do |config|
  config.vm.box = "ubuntu/jammy64"
  config.vm.hostname = "ai-flock-vm"

  # Forward port 3000 to host for parity with Docker setup (app is console-only by default)
  config.vm.network "forwarded_port", guest: 3000, host: 3000, auto_correct: true

  # Provider-specific tweaks (optional)
  config.vm.provider "virtualbox" do |vb|
    vb.memory = 2048
    vb.cpus = 2
    # Disable some features that might cause issues
    vb.customize ["modifyvm", :id, "--natdnshostresolver1", "on"]
    vb.customize ["modifyvm", :id, "--natdnsproxy1", "on"]
  end

  # Use the project directory as the synced folder inside the VM
  config.vm.synced_folder ".", "/vagrant"

  # Provision the VM with Node.js and project dependencies using bash
  config.vm.provision "shell", path: "scripts/provision.sh", binary: "/bin/bash"
end
