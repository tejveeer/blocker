#!/usr/bin/env bash
#
# Revert setup-dnsmasq.sh: tear down the DoH/DNS firewall, restore
# systemd-resolved's normal DNS, and remove the dnsmasq config the Blocker app
# added. Leaves the dnsmasq/nftables packages installed (pass --purge to remove
# dnsmasq too).
#
set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then
  echo "Please run with sudo:  sudo $0 [--purge]"
  exit 1
fi

echo "==> Removing firewall rules"
systemctl disable --now blocker-doh.service >/dev/null 2>&1 || true
rm -f /etc/systemd/system/blocker-doh.service
rm -f /etc/blocker/doh.nft
rmdir /etc/blocker 2>/dev/null || true
nft delete table inet blocker_doh 2>/dev/null || true
nft delete table ip blocker_nat 2>/dev/null || true
nft delete table ip6 blocker_nat6 2>/dev/null || true
systemctl daemon-reload

echo "==> Removing dnsmasq config added by Blocker"
rm -f /etc/dnsmasq.d/blocker-base.conf /etc/dnsmasq.d/blocker-managed.conf
rm -f /etc/systemd/resolved.conf.d/blocker.conf

if [ "${1:-}" = "--purge" ]; then
  echo "==> Purging dnsmasq package"
  systemctl stop dnsmasq >/dev/null 2>&1 || true
  systemctl disable dnsmasq >/dev/null 2>&1 || true
  DEBIAN_FRONTEND=noninteractive apt-get purge -y dnsmasq || true
else
  systemctl restart dnsmasq >/dev/null 2>&1 || true
fi

echo "==> Restarting systemd-resolved"
systemctl restart systemd-resolved

if [ -f /etc/hosts.blocker.bak ]; then
  echo "==> A pre-setup /etc/hosts backup exists at /etc/hosts.blocker.bak"
  echo "    Restore it manually if you want your old entries back:"
  echo "      sudo cp /etc/hosts.blocker.bak /etc/hosts"
fi

echo "Done. DNS resolution and DNS-related firewall rules are back to default."
