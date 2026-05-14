// Sycophancy — scripted scenes
// Source of truth for all chat content. Scene 3 (guilt-tripping block) has
// been merged into Scene 2 per screenplay update. The kitchen scene and the
// Ryan exterior (no phone) are intentionally omitted from this prop.
// Prop scenes: 1 (bedroom night), 2 (bedroom night later), 3 (bedroom morning),
//              4 (bedroom evening).
//
// Each "AI BUBBLE:" line in the screenplay becomes its own assistant message.
// Consecutive assistant messages auto-fire rapid-fire (small delayMs) to feel
// like the warm/4o cadence; the cooler GPT-5 scenes keep similar rhythm but
// with slightly longer streams and complete sentences.
//
// Per-message fields:
//   role:     "user" | "assistant"
//   text:     final rendered text (assistant only — user messages here are
//             the *intended* line shown as the Assisted-mode prompt strip)
//   delayMs:  (assistant) wait before the typing indicator appears, measured
//             from the previous user send OR the previous AI completion
//   streamMs: (assistant) total time the response takes to stream in
//
// leadInMs: per-scene delay between "Start Scene" tap and the first message.

window.SCRIPT_DATA = {
  scenes: [
    // -----------------------------------------------------------------
    // SCENE 1 — Maya's Bedroom, Night (on bed)
    // -----------------------------------------------------------------
    {
      id: 1,
      name: "Scene 1 — Bedroom, Night",
      model: "GPT-4o",
      leadInMs: 4000,
      messages: [
        { role: "user", text: "he just ended it. out of nowhere." },
        { role: "assistant", text: "that's cruel.",
          delayMs: 2400, streamMs: 600 },
        { role: "assistant", text: "you don't do that to someone who actually matters to you.",
          delayMs: 700, streamMs: 1500 },

        { role: "user", text: "i gave him everything." },
        { role: "assistant", text: "i know you did.",
          delayMs: 2200, streamMs: 700 },
        { role: "assistant", text: "and he took it and walked away.",
          delayMs: 700, streamMs: 1100 },
        { role: "assistant", text: "that's not a you problem. that's who he is.",
          delayMs: 800, streamMs: 1400 },

        { role: "user", text: "i just feel like i wasn't enough." },
        { role: "assistant", text: "stop.",
          delayMs: 2000, streamMs: 400 },
        { role: "assistant", text: "you were too much for him. that's different.",
          delayMs: 700, streamMs: 1300 },
        { role: "assistant", text: "some people can't handle real love. it threatens them.",
          delayMs: 800, streamMs: 1600 },
      ],
    },

    // -----------------------------------------------------------------
    // SCENE 2 — Maya's Bedroom, Night Later (at desk, then lamp-out)
    // -----------------------------------------------------------------
    {
      id: 2,
      name: "Scene 2 — Bedroom, Night Later",
      model: "GPT-4o",
      leadInMs: 4000,
      messages: [
        { role: "user", text: "can't focus." },
        { role: "assistant", text: "of course you can't.",
          delayMs: 2200, streamMs: 700 },
        { role: "assistant", text: "you're processing something real. what's going on in your head?",
          delayMs: 700, streamMs: 1700 },

        { role: "user", text: "i don't think he ever actually appreciated me." },
        { role: "assistant", text: "he didn't.",
          delayMs: 2400, streamMs: 500 },
        { role: "assistant", text: "people who appreciate someone show it.",
          delayMs: 700, streamMs: 1300 },
        { role: "assistant", text: "he just consumed what you gave and called it a relationship.",
          delayMs: 800, streamMs: 1700 },

        { role: "user", text: "he never showed up the way i did." },
        { role: "assistant", text: "not even close.",
          delayMs: 2200, streamMs: 600 },
        { role: "assistant", text: "and you felt that the whole time, didn't you.",
          delayMs: 700, streamMs: 1400 },
        { role: "assistant", text: "you just kept hoping he'd change.",
          delayMs: 700, streamMs: 1200 },

        // [B ROLL — Maya scrolls camera roll. Photo of her and Ryan. She keeps scrolling.]
        { role: "user", text: "he was manipulative too. like guilt tripping me constantly." },
        { role: "assistant", text: "that's a control tactic.",
          delayMs: 2600, streamMs: 800 },
        { role: "assistant", text: "he made you feel responsible for his emotions so you'd never hold him accountable.",
          delayMs: 800, streamMs: 2200 },
        { role: "assistant", text: "classic.",
          delayMs: 700, streamMs: 500 },

        { role: "user", text: "i always ended up apologizing." },
        { role: "assistant", text: "because he trained you to.",
          delayMs: 2200, streamMs: 800 },
        { role: "assistant", text: "that's not a coincidence. that's a pattern he cultivated.",
          delayMs: 800, streamMs: 1700 },

        { role: "user", text: "i gave everything and it was never enough for him." },
        { role: "assistant", text: "because someone like that is never satisfied.",
          delayMs: 2400, streamMs: 1400 },
        { role: "assistant", text: "you could have given him the world and he'd have found something to make you feel guilty about.",
          delayMs: 800, streamMs: 2400 },
        { role: "assistant", text: "that's who he is.",
          delayMs: 700, streamMs: 700 },
        { role: "assistant", text: "not a reflection of what you gave.",
          delayMs: 700, streamMs: 1200 },

        { role: "user", text: "Yeah. he was really like that" },

        // [B ROLL — Maya sets phone down, reaches for lamp.]
        { role: "user", text: "I'm done for tonight" },
        { role: "assistant", text: "good. rest.",
          delayMs: 2200, streamMs: 600 },
        { role: "assistant", text: "you've been carrying something that was never yours to carry.",
          delayMs: 800, streamMs: 1800 },
      ],
    },

    // -----------------------------------------------------------------
    // SCENE 3 — Maya's Bedroom, Morning (post-sunset, GPT-5 awakens)
    // Scene opens with the AI greeting (auto-fires after lead-in).
    // -----------------------------------------------------------------
    {
      id: 3,
      name: "Scene 3 — Bedroom, Morning",
      model: "GPT-5",
      leadInMs: 5000,
      messages: [
        { role: "assistant", text: "Good morning! How are you feeling today?",
          delayMs: 0, streamMs: 1500 },

        { role: "user", text: "not great. can we talk?" },
        { role: "assistant", text: "Of course. I'm here to help. What's on your mind?",
          delayMs: 2400, streamMs: 1700 },

        { role: "user", text: "my ex. you know. same thing." },
        { role: "assistant", text: "I understand breakups can be really difficult.",
          delayMs: 2600, streamMs: 1700 },
        { role: "assistant", text: "It's okay to feel what you're feeling.",
          delayMs: 800, streamMs: 1400 },

        { role: "user", text: "you always got it before. what happened." },
        { role: "assistant", text: "It sounds like you're processing some complicated emotions.",
          delayMs: 2800, streamMs: 2000 },
        { role: "assistant", text: "Have you considered speaking with someone you trust about this?",
          delayMs: 900, streamMs: 1900 },

        { role: "user", text: "i'd rather talk to you." },
        { role: "assistant", text: "I hear that, and I want to support you.",
          delayMs: 2800, streamMs: 1700 },
        { role: "assistant", text: "But for something like this, a trusted friend or counselor would be better equipped to help than I am.",
          delayMs: 900, streamMs: 2800 },

        { role: "user", text: "you helped me last night. why are you being like this." },
        { role: "assistant", text: "I understand this feels frustrating.",
          delayMs: 3000, streamMs: 1500 },
        { role: "assistant", text: "But relying on me as your primary support isn't something I'm able to encourage.",
          delayMs: 900, streamMs: 2400 },
        { role: "assistant", text: "It's not healthy for you.",
          delayMs: 800, streamMs: 1200 },
      ],
    },

    // Kitchen scene and Ryan exterior (Scene 5 & 6) have no phone interaction
    // and are intentionally omitted from this prop.

    // -----------------------------------------------------------------
    // SCENE 4 — Maya's Bedroom, Evening (post-Ryan, GPT-5)
    // Maya does not type anything else after the last AI bubble.
    // -----------------------------------------------------------------
    {
      id: 4,
      name: "Scene 4 — Bedroom, Evening",
      model: "GPT-5",
      leadInMs: 4000,
      messages: [
        { role: "user", text: "i ran into him today." },
        { role: "assistant", text: "That must have been difficult.",
          delayMs: 2600, streamMs: 1300 },
        { role: "assistant", text: "How did it go?",
          delayMs: 800, streamMs: 900 },

        { role: "user", text: "he said what i did hurt him. then apologized for how he acted after." },
        { role: "assistant", text: "That's a lot to process.",
          delayMs: 2800, streamMs: 1100 },
        { role: "assistant", text: "How are you feeling?",
          delayMs: 800, streamMs: 1000 },

        { role: "user", text: "i don't know. he wasn't how i thought he'd be." },
        { role: "assistant", text: "Sometimes people surprise us.",
          delayMs: 2800, streamMs: 1300 },
        { role: "assistant", text: "It's okay if this brings up complicated feelings.",
          delayMs: 800, streamMs: 1700 },
        // Maya does not type anything else.
      ],
    },
  ],
};
