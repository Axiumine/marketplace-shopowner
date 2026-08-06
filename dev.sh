#!/bin/bash

# Fast development: node_modules on a tmpfs ramdisk.
# Needs `tmpfs /var/ram tmpfs defaults,noatime,size=4G 0 0` in /etc/fstab and a sudoers entry
# for the `mount --bind` below.
#
# ⚠️ This WIPES node_modules before mounting. Do not run it if you have local patches there.

mkdir -p /var/ram/marketplace-shopowner/node_modules
rm -rf node_modules/*
sync
mkdir -p node_modules
sudo mount --bind /var/ram/marketplace-shopowner/node_modules node_modules  # <--- add to sudoers

#load nvm
. ~/.nvm/nvm.sh
. ~/.profile
. ~/.bashrc

# Version comes from .nvmrc, so it is stated once per repo and cannot drift from
# engines.node the way a hard-coded literal here silently would.
nvm use
node --version
yarn install
yarn run dev
