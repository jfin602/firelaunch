#!/usr/bin/env bash
# FireLaunch staging VPS - step 1 of 3: create the workload private key and CSR ON THE VPS.
#
# The private key is generated here and never leaves this machine. Only the CSR
# (public) is sent to the client for signing with the FireLaunch staging CA.
#
# Run as the verified service user with a pre-created private service-owned
# directory, or as root with a restricted root-owned directory.
set -euo pipefail

DIR=/etc/firelaunch/aws
KEY=$DIR/firelaunch-staging-vps.key
CSR=$DIR/firelaunch-staging-vps.csr
CN=firelaunch-staging-vps          # MUST be exactly this - the IAM role trust policy checks it
APP_USER=${FIRELAUNCH_APP_USER:?Set FIRELAUNCH_APP_USER to the verified Unix service user}

id "$APP_USER" >/dev/null 2>&1 || { echo "Unix user '$APP_USER' does not exist" >&2; exit 1; }
[[ "$APP_USER" != root ]] || { echo "The app must not run as root" >&2; exit 1; }
APP_GROUP=$(id -gn "$APP_USER")
if [[ $EUID -eq 0 ]]; then
  EXPECTED_DIR="root:$APP_GROUP:750"
  EXPECTED_KEY="root:$APP_GROUP:640"
  EXPECTED_CSR="root:root:644"
  KEY_MODE=0640
  CSR_MODE=0644
elif [[ "$(id -un)" == "$APP_USER" ]]; then
  EXPECTED_DIR="$APP_USER:$APP_GROUP:700"
  EXPECTED_KEY="$APP_USER:$APP_GROUP:600"
  EXPECTED_CSR="$APP_USER:$APP_GROUP:600"
  KEY_MODE=0600
  CSR_MODE=0600
else
  echo "Run only as root or the verified service user $APP_USER" >&2; exit 1
fi
if [[ $EUID -eq 0 ]]; then
  SERVICE_CAN_TRAVERSE=$(sudo -u "$APP_USER" -H test -x "$(dirname "$DIR")" && echo yes || echo no)
else
  SERVICE_CAN_TRAVERSE=$(test -x "$(dirname "$DIR")" && echo yes || echo no)
fi
if [[ "$SERVICE_CAN_TRAVERSE" != yes ]]; then
  echo "Service user cannot traverse /etc/firelaunch; grant narrowly scoped directory access before generating the key" >&2
  exit 1
fi

if [[ -e "$DIR" || -L "$DIR" ]]; then
  [[ -d "$DIR" && ! -L "$DIR" ]] &&
    [[ "$(stat -c '%U:%G:%a' "$DIR")" == "$EXPECTED_DIR" ]] || {
      echo "Existing identity directory has unexpected owner, group, or mode; refusing to change it" >&2; exit 1;
    }
else
  [[ $EUID -eq 0 ]] || { echo "Service-owned identity directory must be prepared by an administrator" >&2; exit 1; }
  install -d -m 0750 -o root -g "$APP_GROUP" "$DIR"
fi
if [[ -e "$KEY" || -e "$CSR" ]]; then
  if [[ -f "$KEY" && -f "$CSR" ]] &&
    [[ "$(stat -c '%U:%G:%a' "$KEY")" == "$EXPECTED_KEY" ]] &&
    [[ "$(stat -c '%U:%G:%a' "$CSR")" == "$EXPECTED_CSR" ]] &&
    openssl req -in "$CSR" -noout -verify >/dev/null 2>&1 &&
    [[ "$(openssl req -in "$CSR" -noout -pubkey)" == "$(openssl pkey -in "$KEY" -pubout)" ]] &&
    [[ "$(openssl req -in "$CSR" -noout -subject -nameopt RFC2253)" == "subject=CN=$CN,O=FireLaunch" ]]; then
    echo "Existing matching key and CSR retained; send only $CSR for signing."
    exit 0
  fi
  echo "Existing key or CSR differs; refusing to overwrite. Rotate with a reviewed new filename." >&2; exit 1
fi

umask 077
openssl ecparam -name prime256v1 -genkey -noout -out "$KEY"
if [[ $EUID -eq 0 ]]; then chown root:"$APP_GROUP" "$KEY"; fi
chmod "$KEY_MODE" "$KEY"

openssl req -new -key "$KEY" -subj "/O=FireLaunch/CN=$CN" -sha256 -out "$CSR"
chmod "$CSR_MODE" "$CSR"

echo "Private key: $KEY  (stays on this VPS; readable only by root and $APP_USER)"
echo "CSR:         $CSR  (send THIS file to the client for signing)"
openssl req -in "$CSR" -noout -subject -verify
