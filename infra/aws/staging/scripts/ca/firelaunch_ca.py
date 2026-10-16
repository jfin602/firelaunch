#!/usr/bin/env python3
"""
FireLaunch staging - KMS-backed certificate authority for IAM Roles Anywhere.

The CA private key is the KMS key alias/firelaunch-staging-roles-anywhere-ca
(ECC_NIST_P256, SIGN_VERIFY) in account 363242105231 / us-east-2. It never
leaves KMS. This tool builds X.509 structures locally and asks KMS to sign the
to-be-signed bytes. Only the client admin role (or the account root user) is
allowed by the key policy to call kms:Sign.

Commands (run with CLIENT ADMIN credentials for account 363242105231):

  # one-time: create the self-signed CA certificate (already done 2026-10-15)
  python3 firelaunch_ca.py make-ca --out firelaunch-staging-ca.pem

  # every VPS certificate issuance / renewal
  python3 firelaunch_ca.py sign-csr --ca firelaunch-staging-ca.pem \
      --csr vps.csr --out firelaunch-staging-vps.pem

  # check any certificate against the CA
  python3 firelaunch_ca.py verify --ca firelaunch-staging-ca.pem --cert firelaunch-staging-vps.pem

Requirements: python3, boto3, asn1crypto, cryptography.
"""
import argparse
import datetime as dt
import hashlib
import secrets
import sys

from asn1crypto import csr as a_csr
from asn1crypto import keys as a_keys
from asn1crypto import pem as a_pem
from asn1crypto import x509 as a_x509

ACCOUNT_ID = "363242105231"
REGION = "us-east-2"
KEY_ID = "alias/firelaunch-staging-roles-anywhere-ca"
CA_COMMON_NAME = "FireLaunch Staging Roles Anywhere CA"
ORG = "FireLaunch"
VPS_COMMON_NAME = "firelaunch-staging-vps"
CA_DAYS = 3650
LEAF_DAYS_DEFAULT = 90
LEAF_DAYS_MAX = 397
SIG_ALGO = a_x509.SignedDigestAlgorithm({"algorithm": "sha256_ecdsa"})


# ----------------------------------------------------------------- helpers
def _serial() -> int:
    # 127-bit positive random serial; Roles Anywhere uses it as the role session name.
    return secrets.randbits(127) | (1 << 126)


def _ski(spki: a_keys.PublicKeyInfo) -> bytes:
    return hashlib.sha1(spki["public_key"].contents[1:]).digest()


def _time(t: dt.datetime) -> a_x509.Time:
    if t.year < 2050:
        return a_x509.Time({"utc_time": t})
    return a_x509.Time({"general_time": t})


def _now() -> dt.datetime:
    return dt.datetime.now(dt.timezone.utc).replace(microsecond=0)


def _assemble(tbs: a_x509.TbsCertificate, signature_der: bytes) -> bytes:
    cert = a_x509.Certificate({
        "tbs_certificate": tbs,
        "signature_algorithm": SIG_ALGO,
        "signature_value": signature_der,
    })
    return a_pem.armor("CERTIFICATE", cert.dump())


def _load_pem_cert(path: str) -> a_x509.Certificate:
    data = open(path, "rb").read()
    if a_pem.detect(data):
        _, _, data = a_pem.unarmor(data)
    return a_x509.Certificate.load(data)


# ------------------------------------------------------------- TBS builders
def build_ca_tbs(spki_der: bytes, days: int = CA_DAYS) -> a_x509.TbsCertificate:
    spki = a_keys.PublicKeyInfo.load(spki_der)
    name = a_x509.Name.build({"organization_name": ORG, "common_name": CA_COMMON_NAME})
    start = _now() - dt.timedelta(minutes=5)
    ski = _ski(spki)
    return a_x509.TbsCertificate({
        "version": "v3",
        "serial_number": _serial(),
        "signature": SIG_ALGO,
        "issuer": name,
        "validity": {"not_before": _time(start), "not_after": _time(start + dt.timedelta(days=days))},
        "subject": name,
        "subject_public_key_info": spki,
        "extensions": [
            {"extn_id": "basic_constraints", "critical": True, "extn_value": {"ca": True, "path_len_constraint": 0}},
            {"extn_id": "key_usage", "critical": True, "extn_value": {"key_cert_sign", "crl_sign"}},
            {"extn_id": "key_identifier", "critical": False, "extn_value": ski},
            {"extn_id": "authority_key_identifier", "critical": False, "extn_value": {"key_identifier": ski}},
        ],
    })


def build_leaf_tbs(csr_der: bytes, ca: a_x509.Certificate, days: int,
                   expected_cn: str = VPS_COMMON_NAME) -> a_x509.TbsCertificate:
    req = a_csr.CertificationRequest.load(csr_der)
    info = req["certification_request_info"]
    _verify_csr_signature(req)
    subject_cn = info["subject"].native.get("common_name")
    if subject_cn != expected_cn:
        raise SystemExit(f"Refusing to sign: CSR common name is {subject_cn!r}, expected {expected_cn!r}")
    algo = info["subject_pk_info"].algorithm
    if algo not in ("ec", "rsa"):
        raise SystemExit(f"Refusing to sign: unsupported key type {algo}")
    if algo == "rsa" and info["subject_pk_info"].bit_size < 2048:
        raise SystemExit("Refusing to sign: RSA keys must be at least 2048 bits")
    if not (1 <= days <= LEAF_DAYS_MAX):
        raise SystemExit(f"--days must be between 1 and {LEAF_DAYS_MAX}")
    spki = info["subject_pk_info"]
    start = _now() - dt.timedelta(minutes=5)
    ca_not_after = ca["tbs_certificate"]["validity"]["not_after"].native
    end = min(start + dt.timedelta(days=days), ca_not_after)
    # Subject is rebuilt by the CA: only O + CN are carried, requested extensions are ignored.
    subject = a_x509.Name.build({"organization_name": ORG, "common_name": expected_cn})
    ca_ski = ca.key_identifier
    return a_x509.TbsCertificate({
        "version": "v3",
        "serial_number": _serial(),
        "signature": SIG_ALGO,
        "issuer": ca.subject,
        "validity": {"not_before": _time(start), "not_after": _time(end)},
        "subject": subject,
        "subject_public_key_info": spki,
        "extensions": [
            {"extn_id": "basic_constraints", "critical": True, "extn_value": {"ca": False}},
            {"extn_id": "key_usage", "critical": True, "extn_value": {"digital_signature"}},
            {"extn_id": "extended_key_usage", "critical": False, "extn_value": ["client_auth"]},
            {"extn_id": "key_identifier", "critical": False, "extn_value": _ski(spki)},
            {"extn_id": "authority_key_identifier", "critical": False, "extn_value": {"key_identifier": ca_ski}},
        ],
    })


# ------------------------------------------------------------ verification
def _verify_csr_signature(req: a_csr.CertificationRequest) -> None:
    from cryptography import x509 as cx509
    loaded = cx509.load_der_x509_csr(req.dump())
    if not loaded.is_signature_valid:
        raise SystemExit("Refusing to sign: CSR signature is invalid (key/CSR mismatch)")


def verify(ca_pem: bytes, cert_pem: bytes) -> dict:
    """Checks issuer signature, validity and the Roles Anywhere profile constraints."""
    from cryptography import x509 as cx509
    from cryptography.hazmat.primitives import hashes
    from cryptography.hazmat.primitives.asymmetric import ec

    ca = cx509.load_pem_x509_certificate(ca_pem)
    cert = cx509.load_pem_x509_certificate(cert_pem)
    ca.public_key().verify(cert.signature, cert.tbs_certificate_bytes, ec.ECDSA(hashes.SHA256()))
    if cert.issuer != ca.subject:
        raise ValueError("issuer does not match CA subject")
    now = dt.datetime.now(dt.timezone.utc)
    if not (cert.not_valid_before_utc <= now <= cert.not_valid_after_utc):
        raise ValueError("certificate is outside its validity period")
    if cert.version != cx509.Version.v3:
        raise ValueError("certificate is not X.509 v3")
    if cert.signature_hash_algorithm.name not in ("sha256", "sha384", "sha512"):
        raise ValueError("signature hash weaker than SHA-256")
    bc = cert.extensions.get_extension_for_class(cx509.BasicConstraints).value
    ku = cert.extensions.get_extension_for_class(cx509.KeyUsage).value
    is_self = cert.subject == cert.issuer
    if is_self:
        if not (bc.ca and ku.key_cert_sign):
            raise ValueError("CA certificate must have CA:true and keyCertSign")
    else:
        if bc.ca or not ku.digital_signature:
            raise ValueError("end-entity certificate must have CA:false and digitalSignature")
    return {
        "subject": cert.subject.rfc4514_string(),
        "issuer": cert.issuer.rfc4514_string(),
        "serial_hex": format(cert.serial_number, "x"),
        "not_before": cert.not_valid_before_utc.isoformat(),
        "not_after": cert.not_valid_after_utc.isoformat(),
        "ca": bc.ca,
        "sha256_fingerprint": cert.fingerprint(hashes.SHA256()).hex(),
    }


# ---------------------------------------------------------------- KMS glue
def _kms():
    import boto3
    session = boto3.session.Session(region_name=REGION)
    ident = session.client("sts").get_caller_identity()
    if ident["Account"] != ACCOUNT_ID:
        raise SystemExit(f"Wrong AWS account {ident['Account']}; expected {ACCOUNT_ID}. Aborting.")
    return session.client("kms")


def kms_sign(tbs: a_x509.TbsCertificate) -> bytes:
    resp = _kms().sign(KeyId=KEY_ID, Message=tbs.dump(), MessageType="RAW",
                       SigningAlgorithm="ECDSA_SHA_256")
    return resp["Signature"]


def kms_public_key() -> bytes:
    resp = _kms().get_public_key(KeyId=KEY_ID)
    if resp["KeySpec"] != "ECC_NIST_P256" or resp["KeyUsage"] != "SIGN_VERIFY":
        raise SystemExit("Unexpected KMS key type")
    return resp["PublicKey"]


# --------------------------------------------------------------------- CLI
def main(argv=None):
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = p.add_subparsers(dest="cmd", required=True)
    m = sub.add_parser("make-ca")
    m.add_argument("--out", required=True)
    s = sub.add_parser("sign-csr")
    s.add_argument("--ca", required=True)
    s.add_argument("--csr", required=True)
    s.add_argument("--out", required=True)
    s.add_argument("--days", type=int, default=LEAF_DAYS_DEFAULT)
    s.add_argument("--cn", default=VPS_COMMON_NAME)
    v = sub.add_parser("verify")
    v.add_argument("--ca", required=True)
    v.add_argument("--cert", required=True)
    a = p.parse_args(argv)

    if a.cmd == "make-ca":
        tbs = build_ca_tbs(kms_public_key())
        pem = _assemble(tbs, kms_sign(tbs))
        print(verify(pem, pem))
        open(a.out, "wb").write(pem)
    elif a.cmd == "sign-csr":
        csr_data = open(a.csr, "rb").read()
        if a_pem.detect(csr_data):
            _, _, csr_data = a_pem.unarmor(csr_data)
        ca = _load_pem_cert(a.ca)
        tbs = build_leaf_tbs(csr_data, ca, a.days, a.cn)
        pem = _assemble(tbs, kms_sign(tbs))
        ca_pem = open(a.ca, "rb").read()
        print(verify(ca_pem, pem))
        open(a.out, "wb").write(pem)
    elif a.cmd == "verify":
        print(verify(open(a.ca, "rb").read(), open(a.cert, "rb").read()))


if __name__ == "__main__":
    sys.exit(main())
