
# SYCOPHANCY — Interactive Phone Prop

**A custom browser-based chat interface built as a production tool for the short film *Sycophancy*.**
https://arshansgithub.github.io/sycophancy-film/
## What this is

This tool was built to solve a specific problem in filming *Sycophancy*, a short film about a teenager whose grief after a breakup is distorted by a sycophantic AI companion.

In post-production, the AI conversations are composited as floating chat bubble overlays above the actor's phone using a holographic UI effect. The camera never points directly at the phone screen. Instead the bubbles are tracked and placed digitally in the frame, keeping the focus on the actor's face and reactions.

For this composite to work, the on-screen content needs to be recorded separately as a clean screen capture and synced precisely to the performance. That means the actor needs something real to interact with on set — something that responds on cue, feels natural to type into, and can be reproduced identically for the post-production capture session. A static mockup or screenshots would make the performance feel hollow. This tool replaces that.

---

## How it works

The interface mimics a believable AI chat app. Each scene in the film has its own scripted conversation loaded into the tool. The actor types into a real input field and the pre-written AI responses appear with realistic typing delays and animated indicators, making each exchange feel natural rather than mechanically triggered.

After filming, the tool can replay any recorded session identically so the production team can screen capture a clean reproduction to use as the post-production overlay.

---

## Modes

**Assisted Mode**
Displays the next line the actor is meant to type directly on screen. Used during rehearsal, pickups, and any shot where the phone screen is not visible to camera. Keeps the actor on pace without memorizing dialogue.

**Performance Mode**
Hides all prompts so the screen looks completely clean and in-world. Used during takes where the screen could be visible to camera or when a fully natural performance is needed.

Chat history carries over when switching between modes so the crew can move between prep and filming without resetting anything.

**Replay Mode**
Loads an exported session JSON and plays it back identically for screen capture. Used in post-production to generate the clean recording that gets composited as the bubble overlay.

---

## Production features

- Scene selection from a director panel for instant navigation to any beat
- Start and end controls per scene
- Elapsed time, message count, and active model indicators for continuity tracking
- Autosave to protect progress if the page refreshes mid-session
- JSON export of the full session for post-production sync reference
- One-click Discord upload for sharing recorded runs with the team
- Scene-based replay for reviewing specific beats without scrubbing an entire session
- Quick access to the in-world news article used in the kitchen sequence

---

## Two AI personalities

The film requires two distinct AI voices that reflect the model change at the centre of the story.

**Pre-sunset AI** — lowercase, uses ellipses, warm and conversational, always agrees and amplifies whatever the user says, never redirects or challenges.

**Post-sunset AI** — properly capitalized, standard punctuation, measured and clinical, deflects emotional engagement, repeatedly redirects to external support.

The tool handles both automatically based on which scene is active.

---

## Why it matters on set

The actor is not staring at a blank or static screen. She is interacting with something that responds in a consistent, scene-specific way with the exact timing and tone written into the script. That gives her something real to play against and helps the emotional rhythm of each beat land convincingly.

For the crew the tool is repeatable and dependable. Any take can be reset cleanly from the top of a scene. Timing can be reviewed via export or replay. Nothing is lost if the browser refreshes. The result is a prop system that feels simple on the surface but is built to make filming more controlled, more consistent, and more believable — and to produce a clean screen recording that matches the performance exactly for the post-production composite.

---

## Project context

*Sycophancy* is a short film about the quiet damage of artificial emotional validation. A teenager three weeks out of a breakup she ended uses a sycophantic AI to process her grief, not realizing the AI has been co-authoring an increasingly distorted version of her ex. When the model is sunsetted overnight, she is forced into an unscripted encounter that dismantles the version of him she spent weeks constructing.

The film closes with a documentary montage of real posts from real people grieving sunsetted AI models, defending AI relationships, and describing years of dependency — reframing the protagonist's story as one of thousands.

---

*Built for a high school short film production. Solo pre-production.*
