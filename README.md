# LearnIS — AI-Powered Cognitive Tutor

> **Guiding learners through questions, not answers.**

[![Gemma 4](https://img.shields.io/badge/Powered%20by-Gemma%204-blue)](https://ai.google.dev/gemma)
[![Kaggle](https://img.shields.io/badge/Hackathon-Gemma%204%20Good-orange)](https://www.kaggle.com/competitions/gemma-4-good-hackathon)
[![License](https://img.shields.io/badge/License-Apache%202.0-green)](LICENSE)

---

## What is LearnIS?

LearnIS (Learning Intelligence System) is an AI-powered Socratic tutoring system built on Gemma 4. Instead of providing direct answers, LearnIS guides learners through structured dialogue rooted in the Socratic method, constructivism, and cognitive scaffolding.

The system is designed to develop critical thinking, cognitive autonomy, and creativity — especially in educational contexts where qualified pedagogical support is scarce, such as sub-Saharan Africa and the Global South.

---

## The Problem

Generative AI tools are increasingly used as answer machines rather than learning tools. Learners copy outputs without understanding them, leading to:

- Intellectual dependency on AI
- Atrophy of analytical and argumentative skills
- Reduced capacity to reason and synthesize independently

LearnIS addresses this directly by making the reasoning process — not the answer — the center of every interaction.

---

## How It Works

When a learner submits a topic or exercise, LearnIS follows a five-step pedagogical protocol:

| Step | AI Action | Goal |
|---|---|---|
| 1. Exploration | Probes prior knowledge with open questions | Map the learner's current understanding |
| 2. Guided Questioning | Asks progressive questions toward insight | Stimulate autonomous reasoning |
| 3. Orientation | Suggests analogies, examples, and sources | Enrich conceptual framework |
| 4. Consolidation | Proposes exercises with conceptual traps | Detect and correct misconceptions |
| 5. Assessment | Measures mastery and adjusts scaffolding | Personalize the learning path |

---

## Key Features

- **Socratic Dialogue Engine** — Gemma 4 prompted to ask, not answer
- **AI Dependency Indicator (ADI)** — measures cognitive autonomy over time
- **Competency Mastery Score** — tracks progress on each concept
- **Adaptive Scaffolding** — adjusts support level to each learner's zone of proximal development
- **Offline-First Mode** — runs via Gemma 4 Edge E2B in low-connectivity environments

---

## Technical Stack

| Component | Technology |
|---|---|
| Core AI model | Gemma 4 27B (cloud) |
| Offline deployment | Gemma 4 Edge E2B |
| Prompt architecture | Socratic system prompt with function calling |
| Metrics output | Structured JSON via Gemma 4 native function calling |
| Notebook environment | Kaggle |

---

## Pedagogical Frameworks

LearnIS is grounded in three established learning theories:

- **Socratic Method** — knowledge emerges through guided questioning
- **Constructivism** (Vygotsky, Piaget) — learners build knowledge from prior representations
- **Cognitive Scaffolding** — support is gradually reduced as autonomy increases

---

## Impact

LearnIS targets learners in contexts where qualified tutoring is inaccessible:

- Secondary and university students in sub-Saharan Africa
- Self-directed learners without access to human tutors
- Vocational training and digital skills programs

Expected outcomes after regular use:

- 30% reduction in ADI score after 10 sessions
- Mastery score above 70% on targeted concepts
- Full offline functionality via Gemma 4 Edge

---

## Project Structure

```
learnIS/
├── notebook/
│   └── learnIS_kaggle.ipynb       # Main Kaggle notebook
├── docs/
│   └── LearnIS_Technical_Writeup.docx
├── README.md
└── LICENSE
```

---

## Hackathon

This project was built for the **Gemma 4 Good Hackathon** organized by Kaggle and Google DeepMind (May 2026).

---

## Author

**Arnaud Kedagni**
[GitHub](https://github.com/kedagniarnaud999-ai) · [Kaggle](https://www.kaggle.com)

---

*LearnIS does not replace human thinking. It trains it.*
