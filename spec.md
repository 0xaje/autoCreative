# Autonomous Creative Production Agent — Technical Specification

## 1. Architecture

```text
                    ┌───────────────┐
                    │   React UI    │
                    └───────┬───────┘
                            │
                       REST / WS
                            │
                    ┌───────▼───────┐
                    │  Orchestrator │
                    └───────┬───────┘
                            │
          ┌─────────────────┼─────────────────┐
          │                 │                 │
          ▼                 ▼                 ▼
   Intent Engine      Source Analyzer    Browser Agent
          │                 │                 │
          └─────────────────┼─────────────────┘
                            ▼
                    Evidence Store
                            │
                            ▼
                    Creative Director
                            │
                            ▼
                    Scene Manifest
                            │
              ┌─────────────┼─────────────┐
              ▼             ▼             ▼
        Voice Producer  Asset Producer  Recorder
              │             │             │
              └─────────────┼─────────────┘
                            ▼
                     Remotion Renderer
                            │
                            ▼
                         FFmpeg
                            │
                            ▼
                       Quality Control
                            │
                            ▼
                           MP4
```

---

## 2. Repository Structure

```text
creative-agent/
│
├── apps/
│   ├── web/
│   │   ├── src/
│   │   │   ├── components/
│   │   │   ├── pages/
│   │   │   ├── hooks/
│   │   │   ├── lib/
│   │   │   └── types/
│   │   └── package.json
│   │
│   ├── api/
│   │   ├── src/
│   │   │   ├── routes/
│   │   │   ├── services/
│   │   │   ├── agents/
│   │   │   ├── providers/
│   │   │   ├── jobs/
│   │   │   └── db/
│   │   └── package.json
│   │
│   └── renderer/
│       ├── src/
│       │   ├── compositions/
│       │   ├── scenes/
│       │   ├── components/
│       │   ├── assets/
│       │   └── index.ts
│       └── package.json
│
├── packages/
│   ├── schemas/
│   ├── prompts/
│   ├── browser/
│   ├── evidence/
│   ├── media/
│   └── shared/
│
├── storage/
│   ├── projects/
│   ├── recordings/
│   ├── audio/
│   ├── assets/
│   └── renders/
│
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
│
├── scope.md
├── prd.md
├── spec.md
├── package.json
└── README.md
```

---

## 3. Technology Stack

### Frontend
* React
* TypeScript
* Vite

### Backend
* Node.js
* TypeScript

### Database
* SQLite (migration-friendly ORM: Drizzle ORM)

---

## 4. AI Layer
* Initial model: Gemini 2.5 Flash
* Abstracted provider interface:
```ts
interface AIProvider {
  generateText(input: AIInput): Promise<AIResponse>;
  generateStructured<T>(input: AIInput, schema: JSONSchema): Promise<T>;
}
```

---

## 5. Schemas & Models
* **CreativeIntent**: Content type, duration, aspect ratio, audience, tone, showRealProduct, voiceover, captions, music, creativeFreedom, additionalInstructions.
* **Project & State Machine**: `CREATED` -> `ANALYZING` -> `UNDERSTOOD` -> `PLANNING` -> `EXPLORING` -> `RECORDING` -> `GENERATING` -> `COMPOSING` -> `RENDERING` -> `QUALITY_CHECK` -> `COMPLETED` (or `FAILED` with retry).
* **ProjectUnderstanding**: Summary, problem, solution, features, workflows, technologies, integrations, routes, evidence.
* **Evidence**: id, claim, status (`VERIFIED` | `PARTIAL` | `UNVERIFIED` | `FUTURE`), source, reference, confidence.
* **BrowserAgent & BrowserAction**: Semantic discovery, clicking, typing, scrolling, waiting, screenshots, video recordings with viewport metadata.
* **SceneManifest & Scene**: Scene types (`hook`, `problem`, `product_reveal`, `product_demo`, `feature`, `architecture`, `result`, `transition`, `cinematic`, `ending`), durationSeconds, narration, visualPlan, transition, music, captions.
* **Remotion Components**: `<HookScene />`, `<ProblemScene />`, `<ProductRevealScene />`, `<ProductDemoScene />`, `<FeatureScene />`, `<ArchitectureScene />`, `<ResultScene />`, `<CinematicScene />`, `<EndingScene />`, `<Caption />`, `<Title />`, `<FeatureCallout />`, `<Zoom />`, `<Highlight />`, `<LogoReveal />`, `<ProgressIndicator />`.
* **QualityReport**: passed, score, issues, regenerationRequests.
