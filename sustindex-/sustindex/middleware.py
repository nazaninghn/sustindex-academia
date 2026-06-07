"""
Custom middleware for sustindex project.
"""


class ContentSecurityPolicyMiddleware:
    """
    Fix R6-15: add a Content-Security-Policy header to every response.

    The policy is intentionally permissive on scripts/styles because
    CKEditor requires 'unsafe-inline'.  Tighten these directives when
    CKEditor is replaced with a nonce-based editor.

    Directives:
      default-src 'self'            — allow same-origin resources by default
      script-src  'self' 'unsafe-inline'  — CKEditor needs 'unsafe-inline';
                                            'unsafe-eval' removed (Fix R10-03)
      style-src   'self' 'unsafe-inline'  — inline styles (admin)
      img-src     'self' data: blob:      — thumbnails + previews
      font-src    'self'
      connect-src 'self'                  — fetch / XHR
      frame-ancestors 'none'             — equivalent to X-Frame-Options DENY
      object-src  'none'                 — block Flash / plugins
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)
        # Don't override if a view has already set its own CSP header.
        if 'Content-Security-Policy' not in response:
            response['Content-Security-Policy'] = (
                "default-src 'self'; "
                "script-src 'self' 'unsafe-inline'; "  # Fix R10-03: removed 'unsafe-eval' — not needed by CKEditor; weakens XSS protection
                "style-src 'self' 'unsafe-inline'; "
                "img-src 'self' data: blob:; "
                "font-src 'self'; "
                "connect-src 'self'; "
                "frame-ancestors 'none'; "
                "object-src 'none';"
            )
        return response
