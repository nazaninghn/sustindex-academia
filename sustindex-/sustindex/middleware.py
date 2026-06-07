"""
Custom middleware for sustindex project.
"""


class SecurityHeadersMiddleware:
    """
    Adds security-related HTTP response headers that are not covered by
    Django's built-in SecurityMiddleware.

    Headers set on every response:
      Content-Security-Policy
        - intentionally permissive on scripts/styles because CKEditor requires
          'unsafe-inline'.  Tighten when CKEditor is replaced with a
          nonce-based editor.
        - 'unsafe-eval' is NOT included (Fix R10-03).
        - frame-ancestors 'none' is the CSP equivalent of X-Frame-Options DENY.
        - object-src 'none' blocks Flash / legacy plugins.
      Referrer-Policy
        - 'strict-origin-when-cross-origin' is the modern safe default: sends
          the full URL for same-origin requests and only the origin for
          cross-origin requests, and sends nothing for downgrade (HTTPS→HTTP).
      Permissions-Policy
        - Disables browser features not used by this application (camera,
          microphone, geolocation) to reduce the fingerprinting / abuse surface.
      X-Content-Type-Options
        - 'nosniff' prevents browsers from MIME-sniffing a response away from
          the declared Content-Type.  Django's SecurityMiddleware sets this only
          when SECURE_CONTENT_TYPE_NOSNIFF=True (production); this middleware
          sets it unconditionally so development is equally protected.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)

        # Don't override if a view has already set its own CSP header.
        if 'Content-Security-Policy' not in response:
            response['Content-Security-Policy'] = (
                "default-src 'self'; "
                "script-src 'self' 'unsafe-inline'; "
                "style-src 'self' 'unsafe-inline'; "
                "img-src 'self' data: blob:; "
                "font-src 'self'; "
                "connect-src 'self'; "
                "frame-ancestors 'none'; "
                "object-src 'none';"
            )

        if 'Referrer-Policy' not in response:
            response['Referrer-Policy'] = 'strict-origin-when-cross-origin'

        if 'Permissions-Policy' not in response:
            response['Permissions-Policy'] = (
                'camera=(), microphone=(), geolocation=()'
            )

        # Unconditional nosniff — Django's SecurityMiddleware sets this only in
        # production (SECURE_CONTENT_TYPE_NOSNIFF=True); set it here so that
        # development builds are equally protected.
        if 'X-Content-Type-Options' not in response:
            response['X-Content-Type-Options'] = 'nosniff'

        return response


# Keep the old name as an alias so existing MIDDLEWARE entries that reference
# ContentSecurityPolicyMiddleware continue to work without a settings change.
ContentSecurityPolicyMiddleware = SecurityHeadersMiddleware
