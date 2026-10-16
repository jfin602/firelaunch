#!/usr/bin/env bash
# FireLaunch staging VPS - step 2 of 3: install the signed certificate, the CA chain
# and the AWS IAM Roles Anywhere credential helper, then write the AWS profile.
#
# Usage (as the verified service user for a service-owned identity directory,
# or root for a root-owned directory): ./02-install-certificate-and-helper.sh cert.pem ca.pem
set -euo pipefail

CERT_IN=${1:?signed certificate PEM from the client}
CA_IN=${2:?FireLaunch staging CA certificate PEM}
DIR=/etc/firelaunch/aws
APP_USER=${FIRELAUNCH_APP_USER:?Set FIRELAUNCH_APP_USER to the verified Unix service user}
id "$APP_USER" >/dev/null 2>&1 || { echo "Unix service user does not exist" >&2; exit 1; }
[[ "$APP_USER" != root ]] || { echo "The app must not run as root" >&2; exit 1; }
APP_HOME=$(getent passwd "$APP_USER" | cut -d: -f6)
[[ -d "$APP_HOME" && -f "$DIR/firelaunch-staging-vps.key" ]] || { echo "Service home or VPS private key missing" >&2; exit 1; }
APP_GROUP=$(id -gn "$APP_USER")
if [[ $EUID -eq 0 ]]; then
  [[ "$(stat -c '%U:%G:%a' "$DIR")" == "root:$APP_GROUP:750" &&
     "$(stat -c '%U:%G:%a' "$DIR/firelaunch-staging-vps.key")" == "root:$APP_GROUP:640" ]] || {
    echo "Unexpected root-owned identity permissions" >&2; exit 1;
  }
else
  [[ "$(id -un)" == "$APP_USER" &&
     "$(stat -c '%U:%G:%a' "$DIR")" == "$APP_USER:$APP_GROUP:700" &&
     "$(stat -c '%U:%G:%a' "$DIR/firelaunch-staging-vps.key")" == "$APP_USER:$APP_GROUP:600" ]] || {
    echo "Unexpected service-owned identity permissions" >&2; exit 1;
  }
fi
HELPER="$APP_HOME/.local/bin/aws_signing_helper"

# Values from CloudFormation outputs (account 363242105231, us-east-2) - filled in by the handoff
TRUST_ANCHOR_ARN="arn:aws:rolesanywhere:us-east-2:363242105231:trust-anchor/a6180607-0f41-4054-9654-d5f16df17d56"
PROFILE_ARN="arn:aws:rolesanywhere:us-east-2:363242105231:profile/709699e9-1312-4eb6-ac48-9bb129335911"
ROLE_ARN="arn:aws:iam::363242105231:role/firelaunch/firelaunch-staging-app"
REGION=us-east-2

# The certificate must match the private key generated in step 1
[[ "$(openssl x509 -in "$CERT_IN" -noout -pubkey)" == \
   "$(openssl pkey -in "$DIR/firelaunch-staging-vps.key" -pubout)" ]] || { echo "Certificate does not match the VPS key" >&2; exit 1; }
[[ "$(openssl x509 -in "$CA_IN" -noout -fingerprint -sha256 | cut -d= -f2)" == \
   "FB:96:F1:29:C0:77:BB:A3:C4:2C:FD:42:D7:A6:89:F6:FA:5C:34:2D:DA:EA:AE:E6:A1:3E:8B:8B:68:6D:9B:B7" ]] || {
  echo "CA certificate differs from the verified staging trust anchor" >&2; exit 1;
}
openssl verify -CAfile "$CA_IN" "$CERT_IN"
[[ "$(openssl x509 -in "$CERT_IN" -noout -subject -nameopt RFC2253)" == "subject=CN=firelaunch-staging-vps,O=FireLaunch" ]] || {
  echo "Certificate common name differs" >&2; exit 1;
}

# The verified AWS helper is installed under the service account, so this does
# not depend on a root-owned system installation or the caller's PATH.
[[ -x "$HELPER" && ! -L "$HELPER" ]] || { echo "Verified service-user aws_signing_helper is missing" >&2; exit 1; }

for name in firelaunch-staging-vps.pem firelaunch-staging-ca.pem; do
  source_file=$CERT_IN
  [[ "$name" == firelaunch-staging-ca.pem ]] && source_file=$CA_IN
  if [[ -e "$DIR/$name" ]] && ! cmp -s "$source_file" "$DIR/$name"; then
    echo "Existing $name differs; review certificate rotation before replacing it" >&2; exit 1
  fi
done
if [[ $EUID -eq 0 ]]; then
  install -m 0644 -o root -g "$APP_GROUP" "$CERT_IN" "$DIR/firelaunch-staging-vps.pem"
  install -m 0644 -o root -g "$APP_GROUP" "$CA_IN" "$DIR/firelaunch-staging-ca.pem"
  install -d -m 0700 -o "$APP_USER" -g "$APP_GROUP" "$APP_HOME/.aws"
else
  install -m 0600 "$CERT_IN" "$DIR/firelaunch-staging-vps.pem"
  install -m 0600 "$CA_IN" "$DIR/firelaunch-staging-ca.pem"
  install -d -m 0700 "$APP_HOME/.aws"
fi
AWS_CONFIG="$APP_HOME/.aws/config"
export AWS_CONFIG APP_USER APP_HOME REGION DIR TRUST_ANCHOR_ARN PROFILE_ARN ROLE_ARN HELPER
python3 - <<'PY'
import configparser, os, pathlib, tempfile
path = pathlib.Path(os.environ['AWS_CONFIG'])
if path.is_symlink():
    raise SystemExit('Refusing to replace a symlinked AWS config')
section = 'profile firelaunch-staging-app'
expected = {
    'region': os.environ['REGION'],
    'credential_process': (os.environ['HELPER'] + ' credential-process '
      f"--certificate {os.environ['DIR']}/firelaunch-staging-vps.pem "
      f"--private-key {os.environ['DIR']}/firelaunch-staging-vps.key "
      f"--trust-anchor-arn {os.environ['TRUST_ANCHOR_ARN']} "
      f"--profile-arn {os.environ['PROFILE_ARN']} --role-arn {os.environ['ROLE_ARN']}"),
}
current = path.read_text() if path.exists() else ''
parser = configparser.RawConfigParser()
parser.read_string(current or '')
if parser.has_section(section):
    if dict(parser.items(section)) != expected:
        raise SystemExit('Existing staging app profile differs; review it before changing AWS config')
    print(f'Existing {section} retained')
else:
    updated = current.rstrip() + ('\n\n' if current.strip() else '')
    updated += f'[{section}]\nregion = {expected["region"]}\ncredential_process = {expected["credential_process"]}\n'
    fd, temporary = tempfile.mkstemp(dir=path.parent, prefix='.firelaunch-aws-config-')
    try:
        os.fchmod(fd, 0o600)
        with os.fdopen(fd, 'w') as output:
            output.write(updated)
            output.flush()
            os.fsync(output.fileno())
        service = __import__('pwd').getpwnam(os.environ['APP_USER'])
        if os.geteuid() == 0:
            os.chown(temporary, service.pw_uid, service.pw_gid)
        elif os.geteuid() != service.pw_uid:
            raise SystemExit('Only the service user may update its AWS config')
        os.replace(temporary, path)
    finally:
        if os.path.exists(temporary): os.unlink(temporary)
    print(f'Added {section} while preserving other AWS profiles')
PY
