#!/usr/bin/env bash

# ANSI color codes for output messages
GREEN='\033[0;32m'  # Green for success
RED='\033[0;31m'    # Red for error
YELLOW='\033[0;33m' # Yellow for prompts
NC='\033[0m'        # No color

# Function to print colored messages
print_message() {
    local msg="$1"
    local color="$2"
    echo -e "${color}${msg}${NC}"
}

# Ensure domain argument is passed
if [ -z "$1" ]; then
    print_message "Error: No domain provided." "$RED"
    print_message "Usage: $0 <domain>" "$RED"
    exit 1
fi

DOMAIN=$1

# Prompt user if DNS propagation has been checked
print_message "Have you checked DNS propagation for $DOMAIN? (y/n)" "$YELLOW"
read -r dns_checked

if [ "$dns_checked" != "y" ]; then
    print_message "Please check DNS propagation and try again." "$RED"
    exit 1
fi

# Update and upgrade the system packages
print_message "Updating package lists..." "$GREEN"
if ! sudo apt update; then
    print_message "Failed to update package lists." "$RED"
    exit 1
fi

print_message "Upgrading installed packages..." "$GREEN"
if ! sudo apt upgrade -y; then
    print_message "Failed to upgrade installed packages." "$RED"
    exit 1
fi

# Install Certbot and NGINX plugin
print_message "Installing Certbot and the NGINX plugin..." "$GREEN"
if ! sudo apt install -y certbot python3-certbot-nginx; then
    print_message "Failed to install Certbot or NGINX plugin." "$RED"
    exit 1
fi

# Obtain SSL certificate using Certbot with NGINX
print_message "Running Certbot to obtain SSL certificate for $DOMAIN..." "$GREEN"
if ! sudo certbot --nginx -d "$DOMAIN"; then
    print_message "Certbot failed to obtain SSL certificate for $DOMAIN." "$RED"
    exit 1
fi

# Check SSL certificate symlinks
CERT_DIR="/etc/letsencrypt/live/$DOMAIN/"
print_message "Checking SSL certificate symlinks in $CERT_DIR ..." "$GREEN"
if [ -d "$CERT_DIR" ]; then
    ls -l "$CERT_DIR"
else
    print_message "Certificate directory $CERT_DIR not found!" "$RED"
    exit 1
fi

print_message "SSL certificate setup complete for $DOMAIN!" "$GREEN"
