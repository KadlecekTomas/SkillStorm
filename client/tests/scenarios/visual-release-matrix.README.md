# SkillStorm visual release matrix

This acceptance gate captures the whole active product surface against the real seeded backend at three release breakpoints: 360×800, 768×1024, and 1440×900.

Covered audiences: anonymous/public, DIRECTOR, TEACHER, STUDENT, PARENT, and system-only SUPERADMIN.

The matrix covers every top-level role navigation destination plus changed people-management detail states (teacher invite, leadership invite, staff editor, student admin editor), and fails on page errors, console errors, API/document 4xx/5xx responses, empty/error pages, or page-level horizontal overflow.

Screenshots are uploaded by GitHub Actions as the `skillstorm-visual-matrix` artifact.
