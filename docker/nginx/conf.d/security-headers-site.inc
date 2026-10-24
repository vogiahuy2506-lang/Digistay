# Security headers for hotels' own domains (custom-domains.conf): the same as
# security-headers.inc, except HSTS: no includeSubDomains (the hotel's other
# subdomains are not ours) and one day (a hotel that leaves Digistay can serve
# its domain over plain HTTP again the next day).
# Not a *.conf file on purpose, so nginx does not auto-include it at http level.

add_header Strict-Transport-Security "max-age=86400"                       always;
add_header X-Frame-Options           "SAMEORIGIN"                          always;
add_header X-Content-Type-Options    "nosniff"                             always;
add_header Referrer-Policy           "strict-origin-when-cross-origin"     always;
add_header Permissions-Policy        "camera=(), microphone=(), geolocation=(), payment=(), usb=()" always;
add_header Content-Security-Policy   "frame-ancestors 'self'; base-uri 'self'; object-src 'none'" always;
