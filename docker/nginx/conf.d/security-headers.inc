# Security headers — include this in the HTTPS server block AND in every
# location that has its own add_header: nginx drops all server-level
# add_header directives in a location that defines any of its own (the
# static-file locations used to be served without these headers).
# Not a *.conf file on purpose, so nginx does not auto-include it at http level.

add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
add_header X-Frame-Options           "SAMEORIGIN"                          always;
add_header X-Content-Type-Options    "nosniff"                             always;
add_header Referrer-Policy           "strict-origin-when-cross-origin"     always;
# The app uses none of these; clipboard stays allowed (copy buttons).
add_header Permissions-Policy        "camera=(), microphone=(), geolocation=(), payment=(), usb=()" always;
# Only directives that cannot break pages. A script/style policy needs
# per-request nonces in Next.js and comes later.
add_header Content-Security-Policy   "frame-ancestors 'self'; base-uri 'self'; object-src 'none'" always;
