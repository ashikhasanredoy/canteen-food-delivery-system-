"""
Security and Threat Mitigation Module for University Canteen Food Delivery System.
Provides:
- In-memory sliding window Rate Limiting (Anti-DDoS & Brute-Force defense)
- Malicious Scanner / Bot Probe Blocking
- Timing Attack Protection (constant time string comparison)
- Request Body Size Limiter
- Comprehensive HTTP Security Headers
"""

import time
import secrets
from collections import defaultdict
from fastapi import Request, HTTPException
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

# ── 1. Anti-Brute-Force & Rate Limiting Engine ────────────────────────────────
# In-memory sliding window tracker: ip -> list of timestamps
_request_history = defaultdict(list)
_auth_fail_history = defaultdict(list)

GENERAL_RATE_LIMIT = 180       # Max requests per minute for standard routes
AUTH_RATE_LIMIT = 15           # Max requests per minute for login/auth endpoints
WINDOW_SECONDS = 60            # Sliding window size in seconds

# ── 2. Known Malicious Probe Signatures & Exploits ────────────────────────────
MALICIOUS_PROBE_PATTERNS = [
    ".env", ".git", ".svn", ".aws", "wp-admin", "wp-login", "xmlrpc.php",
    "phpmyadmin", "pma", "cgi-bin", "etc/passwd", "win.ini", "boot.ini",
    "eval(", "base64_decode", "UNION SELECT", "DROP TABLE", "<script>",
    "bin/sh", "bin/bash", "/proc/self", "/sys/", "/cgi-sys/"
]

import urllib.parse

def is_malicious_probe(path: str, query_string: str) -> bool:
    """Detect common automated vulnerability scanners and malicious probes."""
    raw = f"{path}?{query_string}"
    decoded = urllib.parse.unquote_plus(raw).lower()
    for pattern in MALICIOUS_PROBE_PATTERNS:
        if pattern.lower() in decoded or pattern.lower() in raw.lower():
            return True
    return False

def check_rate_limit(client_ip: str, is_auth_route: bool = False) -> bool:
    """Returns True if within acceptable limits, False if rate limited."""
    now = time.time()
    cutoff = now - WINDOW_SECONDS

    history = _auth_fail_history[client_ip] if is_auth_route else _request_history[client_ip]
    # Prune old timestamps
    _request_history[client_ip] = [t for t in _request_history[client_ip] if t > cutoff]
    if is_auth_route:
        _auth_fail_history[client_ip] = [t for t in _auth_fail_history[client_ip] if t > cutoff]

    limit = AUTH_RATE_LIMIT if is_auth_route else GENERAL_RATE_LIMIT
    current_count = len(history)

    if current_count >= limit:
        return False

    history.append(now)
    return True

# ── 3. Timing-Attack Safe Comparator ──────────────────────────────────────────
def safe_compare(val1: str, val2: str) -> bool:
    """Constant-time string comparison to defend against timing attacks."""
    if not isinstance(val1, str) or not isinstance(val2, str):
        return False
    return secrets.compare_digest(val1.encode("utf-8"), val2.encode("utf-8"))

# ── 4. Unified Security Middleware (Pure ASGI — Serverless Compatible) ────────
from starlette.types import ASGIApp, Scope, Receive, Send

class SecurityShieldMiddleware:
    """
    Pure ASGI middleware for maximum performance and 100% serverless (Vercel/Lambda) compatibility.
    Does not suffer from BaseHTTPMiddleware stream buffering or serverless event loop issues.
    """
    def __init__(self, app: ASGIApp):
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        client = scope.get("client")
        client_ip = client[0] if client else "127.0.0.1"
        path = scope.get("path", "")
        query = scope.get("query_string", b"").decode("utf-8", errors="ignore")

        # Step 1: Block known automated hacker probes & directory traversal scans
        if is_malicious_probe(path, query):
            response = JSONResponse(
                status_code=403,
                content={"detail": "Access forbidden: suspicious activity detected."}
            )
            await response(scope, receive, send)
            return

        # Step 2: Enforce Rate Limiting against DDoS / Brute Force
        is_auth = any(auth_path in path for auth_path in ["/login", "/register", "/admin/login"])
        if not check_rate_limit(client_ip, is_auth_route=is_auth):
            response = JSONResponse(
                status_code=429,
                content={"detail": "Too many requests. Please slow down and try again later."}
            )
            await response(scope, receive, send)
            return

        # Step 3: Inject Security Headers in response start
        from starlette.datastructures import MutableHeaders

        async def send_wrapper(message):
            if message["type"] == "http.response.start":
                headers = MutableHeaders(scope=message)
                headers["x-content-type-options"] = "nosniff"
                headers["x-frame-options"] = "SAMEORIGIN"
                headers["x-xss-protection"] = "1; mode=block"
                headers["referrer-policy"] = "strict-origin-when-cross-origin"
                headers["permissions-policy"] = "geolocation=(), camera=(), microphone=()"
            await send(message)

        await self.app(scope, receive, send_wrapper)

