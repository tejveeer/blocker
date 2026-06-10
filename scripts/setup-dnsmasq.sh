#!/usr/bin/env bash
#
# One-time setup: make dnsmasq the resolver (behind systemd-resolved) so the
# Blocker app can do wildcard domain blocking, AND prevent browsers/apps from
# bypassing it (DoH/DoT + hardcoded DNS). No browser settings required.
#
# Reversible with uninstall-dnsmasq.sh.
#
set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then
  echo "Please run with sudo:  sudo $0"
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
CONFIG="$REPO_DIR/server/data/config.json"

echo "==> Writing dnsmasq config before install (avoids a port-53 clash on first start)"
mkdir -p /etc/dnsmasq.d
cat > /etc/dnsmasq.d/blocker-base.conf <<'EOF'
# Blocker app base config.
# Listen only on loopback so we don't clash with systemd-resolved (127.0.0.53).
listen-address=127.0.0.1
listen-address=::1
bind-interfaces
# Use our own upstream resolvers instead of /etc/resolv.conf.
no-resolv
server=1.1.1.1
server=8.8.8.8
cache-size=1000
# Cap the TTL handed to clients so a site's real IP isn't cached for long after
# you unblock it -- this makes re-blocking take effect within ~30s instead of
# waiting out the upstream TTL (often several minutes).
max-ttl=30
# Make Firefox disable its automatic DNS-over-HTTPS: returning NXDOMAIN for the
# canary domain is Mozilla's documented opt-out for network operators.
local=/use-application-dns.net/
EOF
touch /etc/dnsmasq.d/blocker-managed.conf

echo "==> Installing dnsmasq and nftables"
apt-get update -qq
DEBIAN_FRONTEND=noninteractive apt-get install -y dnsmasq nftables

echo "==> Pointing systemd-resolved at dnsmasq (/etc/systemd/resolved.conf.d/blocker.conf)"
mkdir -p /etc/systemd/resolved.conf.d
cat > /etc/systemd/resolved.conf.d/blocker.conf <<'EOF'
[Resolve]
DNS=127.0.0.1
Domains=~.
DNSSEC=no
DNSOverTLS=no
EOF

echo "==> Writing firewall rules to keep traffic on the local resolver"
DNSMASQ_UID="$(id -u dnsmasq 2>/dev/null || echo 0)"
mkdir -p /etc/blocker
cat > /etc/blocker/doh.nft <<EOF
#!/usr/sbin/nft -f
# Blocker app: block DoH/DoT and force plaintext DNS through the local resolver.

table inet blocker_doh
delete table inet blocker_doh
table inet blocker_doh {
    set doh4 {
        type ipv4_addr
        flags interval
        elements = {
            1.1.1.1, 1.0.0.1,
            8.8.8.8, 8.8.4.4,
            9.9.9.9, 149.112.112.112,
            208.67.222.222, 208.67.220.220,
            94.140.14.14, 94.140.15.15,
            104.16.248.249, 104.16.249.249
        }
    }
    set doh6 {
        type ipv6_addr
        flags interval
        elements = {
            2606:4700:4700::1111, 2606:4700:4700::1001,
            2001:4860:4860::8888, 2001:4860:4860::8844,
            2620:fe::fe, 2620:fe::9
        }
    }
    chain output {
        type filter hook output priority 0; policy accept;
        # Block DNS-over-TLS
        tcp dport 853 reject with tcp reset
        udp dport 853 reject
        # Block DNS-over-HTTPS to known providers
        ip daddr @doh4 tcp dport 443 reject with tcp reset
        ip6 daddr @doh6 tcp dport 443 reject with tcp reset
    }
}

# Redirect all plaintext DNS (port 53) to the local dnsmasq, except dnsmasq's
# own upstream queries (matched by its uid) so we don't create a loop.
table ip blocker_nat
delete table ip blocker_nat
table ip blocker_nat {
    chain output {
        type nat hook output priority -100; policy accept;
        meta skuid != ${DNSMASQ_UID} udp dport 53 redirect to :53
        meta skuid != ${DNSMASQ_UID} tcp dport 53 redirect to :53
    }
}

table ip6 blocker_nat6
delete table ip6 blocker_nat6
table ip6 blocker_nat6 {
    chain output {
        type nat hook output priority -100; policy accept;
        meta skuid != ${DNSMASQ_UID} udp dport 53 redirect to :53
        meta skuid != ${DNSMASQ_UID} tcp dport 53 redirect to :53
    }
}
EOF

cat > /etc/systemd/system/blocker-doh.service <<'EOF'
[Unit]
Description=Blocker: force system DNS and block DoH/DoT
After=network-pre.target nftables.service dnsmasq.service
Wants=network-pre.target

[Service]
Type=oneshot
ExecStart=/usr/sbin/nft -f /etc/blocker/doh.nft
ExecStop=-/usr/sbin/nft delete table inet blocker_doh
ExecStop=-/usr/sbin/nft delete table ip blocker_nat
ExecStop=-/usr/sbin/nft delete table ip6 blocker_nat6
RemainAfterExit=yes

[Install]
WantedBy=multi-user.target
EOF

if [ -f "$CONFIG" ]; then
  echo "==> Cleaning old /etc/hosts blocking entries (backup at /etc/hosts.blocker.bak)"
  cp /etc/hosts /etc/hosts.blocker.bak
  node "$SCRIPT_DIR/clean-hosts.mjs" "$CONFIG" || echo "   (skipped hosts cleanup)"
fi

echo "==> Enabling and (re)starting services"
systemctl enable dnsmasq >/dev/null 2>&1 || true
systemctl restart dnsmasq
systemctl restart systemd-resolved
systemctl daemon-reload
systemctl enable --now blocker-doh.service

echo
echo "Done. dnsmasq now resolves DNS with wildcard blocking, and browsers/apps"
echo "can no longer bypass it via DoH/DoT or hardcoded DNS servers."
echo "No browser changes are needed."
echo
echo "Verify with:"
echo "  dig reddit.com @127.0.0.1     # 0.0.0.0 once blocked"
echo "  dig use-application-dns.net   # NXDOMAIN (Firefox DoH disabled)"
