# Mobile Layout Adaptation for Admin Console

## Purpose

Improve the React admin console so the mobile phone experience is readable,
structured, and easy to operate instead of feeling like a compressed desktop UI.

---

## Problem

The current desktop layout is already usable, but the phone layout still shows
several desktop-era issues:

- The shared shell keeps a dense header and action rail.
- Page-level controls and segmented tabs consume too much vertical space.
- Key pages still feel crowded because card spacing, section ordering, and small-screen
  density have not been reworked together.

---

## Scope

### Shared Shell

- Rework the mobile header density and stacking behavior.
- Improve small-screen spacing in the main content shell.
- Make mobile navigation and global actions feel less crowded.

### Shared Components

- Improve reusable page hero and segmented tabs behavior on narrow screens.
- Reduce excessive padding and fixed desktop sizing where it hurts mobile reading.

### Priority Pages

- Dashboard
- Monitor
- AI Providers
- Quota
- System

---

## Constraints

- Keep the existing product copy unless layout changes require a structural wrapper.
- Preserve desktop usability while improving phone behavior.
- Prefer shared fixes before page-specific overrides.

---

## Deliverables

- Updated mobile shell behavior.
- Updated shared small-screen component rules.
- Mobile-friendly layout pass across the priority pages.
- Passing production build with `dist/index.html` generated.

---

## Verification

- `npm run build`
- Manual viewport audit through the updated shell and priority pages
