---
name: autonomous-creative-production
description: Autonomous end-to-end creative production from source material to finished media. Use when the user asks the system to analyze a GitHub repository, website, document, presentation, or other source and autonomously create a finished video or other creative output. The system must research the source, establish evidence, plan the creative narrative, operate real applications when available, capture real product footage, generate supporting assets, produce narration, compose scenes, render real media, perform quality control, and regenerate failed sections without requiring manual production work from the user.
---

# Autonomous Creative Production

## Purpose

This skill governs the production engine of the Autonomous Creative Production Agent.

The fundamental contract is:

```text
SOURCE
  ↓
UNDERSTAND
  ↓
VERIFY
  ↓
DIRECT
  ↓
CAPTURE
  ↓
CREATE
  ↓
COMPOSE
  ↓
RENDER
  ↓
REVIEW
  ↓
DELIVER
```

The user's request describes the desired outcome.

The system performs the production.

Do not turn a production request into instructions for the user to perform manually.

---

# 1. Core Principle

## AI decides WHAT.

## Deterministic tools decide HOW.

The AI may decide:

* what the story should be
* what features matter
* what should appear on screen
* what should be narrated
* what footage is required
* how scenes should be ordered
* where cinematic material is useful
* what needs regeneration

The AI should NOT directly invent arbitrary rendering implementations.

Instead:

```text
AI
 ↓
Structured production manifest
 ↓
Deterministic renderer
 ↓
Real media
```

This keeps production reproducible, testable, and controllable.

---

# 2. Finished-Output Requirement

For a video request, success means a real playable video exists.

A response containing only:

* a script
* storyboard
* scene list
* prompts
* editing instructions
* recommendations
* screenshots

is NOT a completed production.

The production pipeline must continue until it either:

1. produces the requested media, or
2. reaches a genuine blocking failure that cannot safely be recovered.

Never claim that a video has been produced when only planning artifacts exist.

---

# 3. Source Priority

When multiple sources exist, establish the following hierarchy:

```text
REAL LIVE PRODUCT
      ↓
SOURCE CODE
      ↓
DOCUMENTATION
      ↓
USER-PROVIDED DESCRIPTION
      ↓
MODEL INFERENCE
```

The closer a claim is to the top of the hierarchy, the stronger its evidence.

Do not allow model inference to silently become factual product functionality.

---

# 4. Product Understanding

Before creating a product video, establish:

* product purpose
* target user
* problem
* solution
* important features
* primary workflows
* technical architecture when relevant
* integrations
* differentiating behavior
* actual available UI
* limitations
* unfinished functionality

For GitHub sources inspect:

* README
* package manifests
* source tree
* frontend routes
* backend routes
* API definitions
* configuration
* documentation
* tests
* deployment configuration where relevant

Do not blindly ingest the entire repository into the model context.

Filter irrelevant material.

---

# 5. Evidence System

Every important claim must have evidence.

Use:

```text
VERIFIED
PARTIAL
UNVERIFIED
FUTURE
```

### VERIFIED

The repository or live application clearly demonstrates the claim.

### PARTIAL

There is evidence for part of the claim, but not enough to represent the entire statement confidently.

### UNVERIFIED

The claim exists in documentation or description but cannot currently be confirmed.

### FUTURE

The feature is explicitly planned, marked coming soon, or otherwise not presently implemented.

Only VERIFIED claims should normally be presented as definitive product functionality.

PARTIAL claims may be used with qualified wording.

UNVERIFIED claims should not be confidently narrated as existing functionality.

FUTURE functionality must be clearly identified as future.

---

# 6. Live Product Exploration

When a live URL exists, prefer inspecting the actual application.

Use a real browser.

Preferred stack:

```text
Playwright
+
Chromium
+
browser-agent layer
```

The browser agent may:

* navigate
* click
* type
* scroll
* select
* wait
* inspect
* capture screenshots
* record video

Prefer semantic selectors:

```text
role
label
accessible name
text
placeholder
test id
```

Avoid fragile coordinate-based interaction whenever possible.

---

# 7. Browser Exploration Strategy

Do not randomly click through the application.

First establish:

```text
site map
↓
navigation
↓
important screens
↓
primary user journeys
↓
successful workflows
```

Prioritize flows that communicate the product's value.

For example:

```text
Landing
 ↓
Primary action
 ↓
Input
 ↓
Processing
 ↓
Result
 ↓
Meaningful outcome
```

A successful workflow is more valuable than collecting many disconnected screenshots.

---

# 8. Recording Rules

Real product footage is the default for software demonstrations.

Capture:

* clean viewport
* actual application
* meaningful interactions
* sufficient context
* readable UI
* deliberate cursor movement
* stable states

Avoid:

* unnecessary browser chrome
* accidental clicks
* failed states unless narratively useful
* loading for excessive periods
* empty screens
* irrelevant navigation
* fake interaction

Record each meaningful workflow as an independent asset.

Example:

```text
recordings/
├── homepage.webm
├── primary-workflow.webm
├── dashboard.webm
├── result.webm
└── settings.webm
```

---

# 9. Creative Direction

The Creative Director receives:

```text
Creative Intent
+
Project Understanding
+
Evidence
+
Live Product Discovery
+
Available Assets
```

It outputs a structured Scene Manifest.

The Creative Director should determine:

* hook
* narrative arc
* pacing
* scene duration
* narration
* visual source
* transitions
* emphasis
* ending
* music behavior

Do not generate scenes simply because a feature exists.

Every scene must have a communication purpose.

---

# 10. Story Principle

A product video should generally answer:

```text
What is this?
Why does it matter?
How does it work?
What does it actually do?
Why should I care?
```

A typical structure may be:

```text
HOOK
 ↓
PROBLEM
 ↓
PRODUCT REVEAL
 ↓
PRIMARY WORKFLOW
 ↓
KEY FEATURE
 ↓
RESULT
 ↓
CLOSING
```

Do not force this structure when another narrative is clearly more appropriate.

---

# 11. Scene Manifest

The model must output structured data.

Example:

```json
{
  "version": 1,
  "durationSeconds": 90,
  "scenes": [
    {
      "id": "hook",
      "type": "hook",
      "durationSeconds": 6,
      "purpose": "Establish the problem",
      "narration": "...",
      "visualPlan": []
    }
  ]
}
```

Every scene must specify:

* purpose
* duration
* visual strategy
* narration when applicable
* asset requirements

---

# 12. Real Product vs Generated Media

Use this priority:

```text
REAL PRODUCT FOOTAGE
        ↓
SCREENSHOT / REAL PRODUCT IMAGE
        ↓
MOTION GRAPHIC
        ↓
GENERATED IMAGE
        ↓
GENERATED VIDEO
```

Generated media should supplement the product rather than falsify it.

For example:

Good:

```text
Generated cinematic visual
→ introduces cybersecurity problem
→ cut to real SentryNet interface
```

Bad:

```text
Generated fake SentryNet dashboard
→ presented as if it were the real application
```

---

# 13. Cinematic Material

Generated cinematic material may be used for:

* hooks
* conceptual metaphors
* atmospheric transitions
* abstract technology visuals
* emotional openings
* closing sequences

Keep generated material short unless the creative request specifically calls for a cinematic production.

For product demonstrations, the actual product should remain the visual authority.

---

# 14. Voice Production

Generate narration from:

```text
verified product understanding
+
scene purpose
+
user intent
```

Narration must not introduce unsupported functionality.

The narration should be synchronized with the visual sequence.

If narration refers to an action, the corresponding action should be visible whenever practical.

---

# 15. Captions

Captions must:

* synchronize with narration
* remain readable
* respect safe areas
* avoid covering important product UI
* maintain consistent typography
* support emphasis without becoming distracting

---

# 16. Music

Music is subordinate to narration.

Automatically determine:

* whether music is needed
* intensity
* entry point
* exit point
* volume
* ducking

Never allow music to make narration difficult to understand.

---

# 17. Motion Design

Use reusable deterministic components for:

* titles
* subtitles
* callouts
* highlights
* zooms
* pans
* transitions
* captions
* logo reveals
* progress indicators
* end cards

Do not create one-off implementations when an existing component can express the scene.

---

# 18. Rendering

Preferred renderer:

```text
Remotion
```

Supporting media tooling:

```text
FFmpeg
```

The renderer consumes the Scene Manifest.

Example:

```text
scene.type = "product_demo"
        ↓
<ProductDemoScene />
```

The renderer must not require an LLM during final frame rendering.

---

# 19. Media Normalization

Before composition:

* normalize dimensions
* normalize frame rate
* normalize audio
* trim unusable footage
* detect missing assets
* validate codecs
* validate duration

Do not allow incompatible source media to reach the final composition stage unchecked.

---

# 20. Duration Management

The total scene duration must remain within the requested target.

Allow a small tolerance where natural pacing requires it.

If the script is too long:

1. tighten narration
2. remove redundant material
3. shorten low-value scenes
4. regenerate affected narration

Do not simply accelerate speech to an unnatural speed.

---

# 21. Quality Control

Every completed video must pass technical and creative checks.

## Technical

Verify:

* file exists
* MP4 container
* video stream
* audio stream
* expected resolution
* expected frame rate
* playable duration
* no failed render

## Visual

Check for:

* black frames
* frozen frames
* severe clipping
* unreadable captions
* accidental blank scenes
* broken assets
* awkward transitions

## Narrative

Check:

* story coherence
* narration/visual alignment
* claim accuracy
* requested duration
* requested tone
* requested audience
* product visibility

---

# 22. QC Failure

If QC fails, identify the smallest repairable unit.

Examples:

```text
Bad narration
→ regenerate narration only

Bad recording
→ re-run browser recording

Bad timing
→ modify scene timing

Wrong asset
→ replace asset

Bad composition
→ rerender affected scene
```

Do not restart the entire pipeline unless the underlying production plan is invalid.

---

# 23. User Feedback Loop

After a video exists, the user may issue natural-language changes:

```text
Make the opening stronger.
Show more of the product.
Make it more cinematic.
Make it technical.
Remove the architecture section.
Make it 60 seconds.
Make it vertical.
Use a deeper voice.
Make the ending more memorable.
```

Translate the request into production changes.

Preserve existing valid assets whenever possible.

---

# 24. Reproducibility

Every production must save:

```text
intent.json
understanding.json
evidence.json
discovery.json
scene-manifest.json
script.json
asset-manifest.json
render-config.json
qc-report.json
```

This allows regeneration and debugging.

---

# 25. Provider Abstraction

Do not hard-code the production engine around one AI provider.

Use interfaces such as:

```ts
AIProvider
VoiceProvider
ImageProvider
VideoProvider
StorageProvider
BrowserProvider
```

Initial implementations may use:

```text
Gemini
ElevenLabs
Playwright
Chromium
Remotion
FFmpeg
Local filesystem
```

Providers can be replaced later.

---

# 26. Cost Discipline

Do not use expensive generative media when deterministic media can achieve the same result.

Prefer:

```text
real recording
+
motion graphics
+
voice
```

over:

```text
generated video
+
generated video
+
generated video
```

Generative video should be used intentionally.

Do not generate assets merely because the capability exists.

---

# 27. Autonomy Rules

The system should make reasonable production decisions without asking the user for unnecessary confirmation.

Do not ask:

> "Should I use a zoom here?"

if the creative system can safely decide.

Do ask for user input when a genuine external dependency blocks production, such as:

* required login
* unavailable private repository
* missing secret
* destructive action
* ambiguous identity
* unavailable required asset

---

# 28. No Fake Completion

Never report:

```text
Video ready
```

unless a valid final media artifact has actually been generated and validated.

Never substitute:

```text
storyboard
script
preview
placeholder
mock video
```

for the requested finished output.

---

# 29. Engineering Quality

The system must remain:

* typed
* modular
* testable
* observable
* deterministic where possible
* recoverable
* provider-independent

Avoid:

* giant orchestration functions
* duplicated provider logic
* hardcoded project-specific behavior
* fake API responses
* arbitrary timeouts used as state simulation
* placeholder production stages
* unnecessary abstractions
* generated code that exists only to impress visually

---

# 30. Primary Acceptance Test

Given:

```text
GitHub repository
+
live application
+
natural-language video request
```

the system must be capable of executing:

```text
Analyze
→
Understand
→
Verify
→
Explore
→
Plan
→
Record
→
Generate
→
Compose
→
Render
→
QC
→
Deliver
```

with no manual video production steps required from the user.

The final artifact must be a real playable MP4.

---

# 31. Definition of Success

The user should be able to think:

> "I built the product. I gave it to my creative agent. It understood what I built and made the video."

That is the product.

Not:

> "The AI gave me instructions for making a video."
