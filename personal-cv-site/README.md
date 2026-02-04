# Personal CV Website

An interaction-driven personal CV designed as a small digital product.

This project explores non-standard navigation patterns, explicit UI state,
and scroll intent resolution instead of a traditional document layout.

---

## Interaction Model & Design Rationale (v1)

This is not a traditional CV or portfolio.

It is an **interaction-first personal CV** built to demonstrate how complex
user input and navigation intent can be handled deliberately and predictably.

v1 intentionally prioritizes **interaction correctness, explicit state,
and explainability** over visual polish or abstraction.

---

### Core Interaction Idea

The site is built around a **two-axis navigation model**:

- **Horizontal (x-axis):** high-level navigation between CV sections  
- **Vertical (y-axis):** detailed content browsing inside each section  

These axes are intentionally separated.
Each has a clear role and set of rules.

---

### Spatial Architecture

**Horizontal structure**
- A single `.sections-wrapper` scrolls horizontally
- Each `.cv-section` occupies exactly `100vw`
- Horizontal movement represents **section-level intent**

**Vertical structure**
- Each section contains a `.section-content`
- Only `.section-content` elements may scroll vertically
- Vertical movement represents **content exploration**

This separation prevents ambiguous scroll behavior
and keeps navigation intent legible.

---

### Navigation Modes

The UI operates in two explicit modes:

**1. Card Mode (Landing)**
- Initial state of the site
- Navigation cards act as the entry point
- Section content is not scrollable
- Scrolling down intentionally enters the site

**2. Section Mode**
- Normal browsing state
- Vertical scroll inside sections
- Horizontal navigation only at explicit boundaries
- Scrolling up at the top boundary can return to card mode

This creates a clear mental model:

> Enter the site → explore → exit the site

No state is implicit.

---

### Wheel Input Philosophy: *Wheel ≠ Intent*

A core principle of this project is:

> **A wheel event is not the same as user intent.**

Trackpads emit bursts of wheel events, momentum,
and residual input after animations complete.

Treating every wheel event as navigation intent
leads to accidental multi-section jumps
and unpredictable behavior.

---

### How Navigation Intent Is Determined

Wheel-based horizontal navigation is allowed **only when all conditions are met**:

1. The user is in **section mode**
2. The wheel event originates inside `.section-content`
3. Vertical scrolling is not possible, or the scroll position is at a stable boundary
4. No navigation animation is currently in progress
5. Cooldowns and post-navigation lockouts have expired
6. A **fresh wheel burst** is detected (not residual momentum)

This ensures horizontal navigation always feels **deliberate**, not accidental.

---

### Momentum & Burst Handling

To handle real-world trackpad behavior, v1 introduces two safeguards:

**Post-navigation lockout**
- Absorbs residual momentum after a wheel-initiated navigation
- Prevents immediate unintended second navigation

**Fresh burst requirement**
- Requires a short pause before a new wheel-based navigation
- Ensures each section change is intentional

These mechanisms do not add features.
They protect intent.

---

### Why the Code Is Explicit

The interaction logic in v1 is intentionally:
- State-heavy
- Verbose
- Defensive

Each state exists to prevent race conditions,
maintain debuggability,
and keep behavior explainable under edge cases.

Reducing this complexity without revisiting the interaction contract
risks reintroducing subtle bugs.

---

## v1 Status

v1 interaction behavior is considered **complete and frozen**.

- The model has been validated against real input
- Known edge cases are handled explicitly
- Interaction changes are deferred to v2

v2 will focus on visual refinement, narrative, and structure
without redefining interaction fundamentals.

---

## Final Note

This project is not meant to impress through animation or aesthetics.

It is meant to demonstrate:
- How interaction problems are framed
- How complex input is handled responsibly
- How architectural trade-offs are made deliberately

v1 focuses on **correctness**.  
v2 will focus on **expression**.
