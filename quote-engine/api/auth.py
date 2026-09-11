"""
Who is calling, and what they may see.

IDENTITY COMES FROM MICROSOFT 365

The browser signs in against Entra ID and sends the access token it gets back;
this validates that token and reads the caller's identity and group membership
out of it. The app never sees a password and never holds one.

This replaced Windows integrated authentication at a reverse proxy, which passed
the caller and their on-premises Active Directory groups downstream as headers.
IT declined that arrangement — the estate is Microsoft 365, and a header the app
trusts is only as good as the guarantee that nothing can reach the app except
through the proxy that sets it. A signed token carries its own guarantee.

What the rest of the service needs is unchanged: a username and a list of
groups. Only how those are established has moved, which is why everything below
`Caller` is untouched.

ROLE RESOLUTION IS STILL SQL

``cpq.fn_effective_role`` decides what a set of groups means, because
sql/02_security.sql is where that is written down and a second copy here would
drift. It is a TABLE-valued function returning the role and where the role came
from, and a user who resolves to no row is denied, which is the correct failure.

Two things about the call below have to stay true, because neither fails until
the service meets a real database and both failed silently until August 2026:
the function is selected FROM (a scalar UDF cannot be), and the group list is
joined with newlines (the function delimits on CHAR(10)).

WHAT IS NOT DONE HERE

Nothing in this repository has been pointed at a real tenant. The token is
validated against the issuer, audience and signing keys named in the
environment; those values are IT's to supply, and until they do this refuses
every request rather than falling back to trusting anything.
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from functools import lru_cache
from typing import Any

import httpx
from fastapi import Header, HTTPException, status
from jose import jwt
from jose.exceptions import JWTError

import db

#: The Entra ID application registration this API is. IT supplies these; there is
#: deliberately no default, because a default here would be a tenant nobody chose.
TENANT_ID = os.environ.get("CPQ_ENTRA_TENANT_ID", "")
AUDIENCE = os.environ.get("CPQ_ENTRA_AUDIENCE", "")

#: The claim carrying group membership. A tenant that emits group object IDs uses
#: 'groups'; one that uses app roles instead uses 'roles'. Both are common and the
#: choice is the tenant's, so it is configurable rather than assumed.
GROUPS_CLAIM = os.environ.get("CPQ_ENTRA_GROUPS_CLAIM", "groups")

ISSUER = f"https://login.microsoftonline.com/{TENANT_ID}/v2.0"
JWKS_URL = f"https://login.microsoftonline.com/{TENANT_ID}/discovery/v2.0/keys"


@dataclass
class Caller:
    username: str
    role: str
    role_source: str
    display_name: str | None = None


@lru_cache(maxsize=1)
def _signing_keys() -> dict[str, Any]:
    """Entra's public signing keys.

    Cached because they change rarely and fetching them per request would put a
    network call in front of every API call. Entra rotates them, so a token signed
    by a key that is not here clears the cache once and tries again — see below.
    """
    return httpx.get(JWKS_URL, timeout=10).json()


def _claims(token: str) -> dict[str, Any]:
    for attempt in (1, 2):
        try:
            return jwt.decode(
                token,
                _signing_keys(),
                algorithms=["RS256"],
                audience=AUDIENCE,
                issuer=ISSUER,
            )
        except JWTError:
            # A rotated key looks exactly like a bad token. Drop the cache and try
            # once more before calling it a bad token, but only once — retrying a
            # genuinely invalid token forever is a denial-of-service on ourselves.
            if attempt == 1:
                _signing_keys.cache_clear()
                continue
            raise
    raise AssertionError("unreachable")


def current_user(
    authorization: str | None = Header(default=None),
) -> Caller:
    if not TENANT_ID or not AUDIENCE:
        raise HTTPException(
            status.HTTP_500_INTERNAL_SERVER_ERROR,
            "This service has no Microsoft 365 tenant configured. Set "
            "CPQ_ENTRA_TENANT_ID and CPQ_ENTRA_AUDIENCE.",
        )

    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED,
            "No Microsoft 365 token on this request.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        claims = _claims(authorization.split(" ", 1)[1].strip())
    except JWTError as exc:
        # The reason is deliberately not passed on: "audience mismatch" tells an
        # attacker what to change. It is worth logging on this side.
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED,
            "That Microsoft 365 token is not valid for this service.",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc

    # preferred_username is the sign-in name; oid is the immutable object ID and is
    # what to key anything permanent on. upn appears on some tenants and not others.
    username = (claims.get("preferred_username") or claims.get("upn")
                or claims.get("oid") or "")
    if not username:
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED, "That token names no user.")

    groups = claims.get(GROUPS_CLAIM) or []
    if isinstance(groups, str):
        groups = [groups]

    # Newline-separated, because cpq.fn_effective_role delimits on CHAR(10) and a
    # Microsoft 365 group display name may contain a comma but never a newline.
    # This joined with a comma while the function searched for newline-delimited
    # names, so anybody in more than one group resolved to no role and was denied.
    found = db.row(
        """
        SELECT r.role_cd, r.role_source, u.display_name
          FROM cpq.fn_effective_role(?, ?) AS r
          LEFT JOIN cpq.app_user AS u ON u.username = ?
        """,
        (username, "\n".join(str(g) for g in groups), username),
    )

    if not found or not found.get("role_cd"):
        # Denying is correct. Defaulting to 'rep' would hand quote visibility to
        # anyone in the tenant.
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            "Your account did not resolve to a CPQ role. Access is granted by "
            "Microsoft 365 group membership — ask IT to add you to the "
            "appropriate CPQ group.",
        )

    return Caller(
        username=username,
        role=found["role_cd"],
        role_source=found.get("role_source") or "entraGroup",
        display_name=found.get("display_name") or claims.get("name"),
    )


def require_admin(caller: Caller) -> None:
    if caller.role != "admin":
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            "Rules and mappings are edited by an administrator.",
        )


def require_approver(caller: Caller) -> None:
    if caller.role not in ("approver", "admin"):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only an approver may decide this.")
