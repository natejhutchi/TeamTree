export type DialogueButton = {
  label: string;
  target: string;
};

export type TextPart =
  | { kind: "text"; text: string }
  | { kind: "strong"; text: string }
  | { kind: "em"; text: string }
  | { kind: "muted"; text: string }
  | { kind: "accent"; text: string; tone?: "solution" | "exit" | "close" | "rush" }
  | { kind: "link"; label: string; target: string; tone?: "solution" | "exit" | "reference" | "close" };

export type ScriptLine = {
  parts: TextPart[];
  indent?: number;
};

export type ScriptList = {
  items: string[];
  indent?: number;
};

export type ScriptContent = ScriptLine | ScriptList;

export type DialogueBlock = {
  id: string;
  title: string;
  layoutArea: string;
  bodyFormat?: "legacy" | "tiptap";
  lines?: ScriptLine[];
  mutedLabels?: string[];
  responseLines?: ScriptLine[];
  buttons?: DialogueButton[];
  buttonRows?: DialogueButton[][];
  script?: ScriptContent[];
};

const text = (value: string): TextPart => ({ kind: "text", text: value });
const strong = (value: string): TextPart => ({ kind: "strong", text: value });
const em = (value: string): TextPart => ({ kind: "em", text: value });
const muted = (value: string): TextPart => ({ kind: "muted", text: value });
const accent = (value: string, tone?: "solution" | "exit" | "close" | "rush"): TextPart => ({
  kind: "accent",
  text: value,
  tone,
});
const link = (
  label: string,
  target: string,
  tone?: "solution" | "exit" | "reference" | "close",
): TextPart => ({ kind: "link", label, target, tone });

const line = (parts: TextPart[], indent = 0): ScriptLine => ({ parts, indent });
const list = (items: string[], indent = 0): ScriptList => ({ items, indent });

const aiSystemQuestions = list(
  [
    "What are you using it for -- first drafts, or finished assets that go out the door?",
    "Who's actually running the tools -- your marketers, or someone whose job is design?",
    "How much time goes into prompting and fixing before it's on-brand and usable?",
    "Are you happy with how differentiated it looks, or does it feel a bit generic?",
    "For the stuff that really matters -- campaigns, brand -- do you trust it unsupervised?",
  ],
  2,
);

const freelancerQuestions = list(
  [
    "How much time are you spending managing and briefing them?",
    "How consistent is the quality from project to project?",
    "What happens when your go-to freelancer is booked or disappears?",
    "If you added it all up, what are you spending across them in a month?",
  ],
  2,
);

const painExitLines = (indent = 2): ScriptLine[] => [
  line([strong("If pain: "), link("Solution", "solution", "solution")], indent),
  line([strong("If no pain: "), link("Exit", "graceful-exit", "exit")], indent),
];

const aiSystemBranch = (yesIndent = 1): ScriptContent[] => [
  line([
    strong("Yes: "),
    text("Does that mean you're running full salaries for your designers to write prompts and revise AI output?"),
  ], yesIndent),
  line([
    strong("Yes: "),
    text("Well hey, I know that's expensive "),
    link("Solution", "solution", "solution"),
  ], yesIndent + 1),
  line([strong("No: "), text("Sounds like you got a system with it, but:")], yesIndent + 1),
  aiSystemQuestions,
  ...painExitLines(yesIndent + 2),
];

export const teamInfoResponses: ScriptContent[][] = [
  [
    line([strong("THE TEAM")]),
    line([text("Every client gets a dedicated Project Manager + Creative Lead + 3-5 designers who learn their brand and stay with them.")], 1),
  ],
  [
    line([strong("HOW WORK FLOWS")]),
    line([text("Requests come in via Slack or our portal. Most work returns in 24-48 hours. Unlimited revisions, client owns everything.")], 1),
  ],
  [
    line([strong("THE MODEL")]),
    line([text("Flat monthly rate, month-to-month, cancel anytime. Plans start at $3,000/mo. 15-day money-back guarantee.")], 1),
  ],
  [
    line([strong("THE WORK")]),
    line([text("Ads, social, branding, web, motion, video, illustration. Human-led, AI-enabled -- senior designers do the work.")], 1),
  ],
  [
    line([strong("We use Superside.")]),
    line([text("Oh nice - you're already in the subscription model. How's that going for you?")], 1),
    line([strong("If pain: "), text("That's what we hear a lot. A lot of our designers came from superside. The big differences are")], 2),
    line([strong("If no pain: "), text("Awesome, well its great you're familiar with the subscription format. I'll just quickly say, the differences with TeamTown are")], 2),
    line([text("we're month-to-month, $3K vs. $10K, and human-led vs. AI-first. If you ever want to compare, (my director) Alex can walk through it in 15 minutes.")], 1),
  ],
  [
    line([strong("We're not looking right now.")]),
    line([text("It sounds like the timing isn't great. Totally fair. Is that because design capacity isn't a constraint, or more of a timing thing?")], 1),
    line([strong("If timing: "), text("When would make sense to revisit?")], 2),
    line([strong("If no constraint: "), text("No worries, sounds like we're not a good fit. Have a great day.")], 2),
  ],
  [
    line([strong("I've never heard of you.")]),
    line([text("That's fair. We work with over 200 companies including Staples and Evian. We're rated 5.0 on G2. Most of our growth has been word of mouth. Would it be worth a quick intro to see the work?")], 1),
  ],
];
export const objectionResponses: ScriptContent[][] = [
  [
    line([strong("Who are you?")]),
    line([
      em("[[Your Name]]"),
      text(" from TeamTown, we scale design for marketing teams without adding headcount"),
    ], 1),
    line([strong("If not ready: "), text("that's why I want to ask + "), strong("next question in flow")], 2),
    line([strong("If almost ready: "), link("Solution", "solution", "solution")], 2),
    line([strong("If ready: "), link("Close", "close", "close")], 2),
  ],
  [
    line([strong("What are you selling / What do you do?")]),
    line([
      text("We make sure your designers never hit capacity and bottleneck, and you're not paying full salaries for designers to run AI prompts"),
    ], 1),
    line([strong("If not ready: "), text("that's why I want to ask + "), strong("next question in flow")], 2),
    line([strong("If almost ready: "), link("Solution", "solution", "solution")], 2),
    line([strong("If ready: "), link("Close", "close", "close")], 2),
  ],
  [
    line([strong("What does it cost?")]),
    line([
      text("Cheaper than a designer, less hassle than freelancers, faster than agencies. (That's 3000 a month, cancel anytime)."),
    ], 1),
    line([strong("If not ready: "), text("that's why I want to ask + "), strong("next question in flow")], 2),
    line([strong("If almost ready: "), link("Solution", "solution", "solution")], 2),
    line([strong("If ready: "), link("Close", "close", "close")], 2),
  ],
];
export const dialogueBlocks: DialogueBlock[] = [
  {
    id: "start",
    title: "Opener",
    layoutArea: "start",
    lines: [line([text("[[Name]] it's [[Name]]")])],
    mutedLabels: ["Bypass Response"],
    responseLines: [
      line([
        strong("Chill:"),
        text(" I'm in the marketing and design world and there's 2 things I keep hearing about, mind if I run them by you?"),
      ]),
      line([
        strong("Quick:"),
        text(" I'm in the marketing and design world and there's 2 things I keep hearing about, I wanna run them by you real quick, you got like.. 27 seconds?"),
      ]),
    ],
    buttons: [
      { label: "Sure", target: "sure" },
      { label: "Who's this? / What's this about?", target: "whos-this" },
    ],
  },
  {
    id: "rush",
    title: "Busy",
    layoutArea: "rush",
    script: [
      line([accent("Busy", "rush")]),
      line([text("Hey you sound super busy, I can always call back another time.")]),
      line([
        strong("I'm busy, call later: "),
        text("No worries, what's the best time I can reach you and get your undivided attention for 2 minutes, because this call has value, if you're in the same spot as the other teams I've helped."),
      ], 1),
      line([
        strong("Curious: "),
        text("Look, my names Nathan from TeamTown, we help marketing teams solve design issues, that's why I was asking. If you're not opposed to hearing me out, I'll be real quick. "),
        link("Sure", "sure", "reference"),
      ], 2),
      line([strong("Not interested: "), text("All good thanks for your time, take care.")], 2),
      line([strong("Be quick: "), link("Sure", "sure", "reference")], 1),
      line([strong("No: "), text("No worries, take care.")], 1),
    ],
  },
  {
    id: "sure",
    title: "Sure",
    layoutArea: "sure",
    lines: [
      line([
        text("Great, so this is what I'm hearing. On one side, there's pressure to cut costs -- nobody's getting approved to add headcount. On the other, the marketing demand keeps growing, now that AI's in the mix. So, you're stuck doing more with less. Is this the spot you're in too or is it different on your end?"),
      ]),
    ],
    buttonRows: [
      [
        { label: "What are you talking about? (confusion)", target: "confusion" },
        { label: "That's the spot", target: "spot-were-in" },
      ],
      [
        { label: "It's different with AI", target: "different-ai" },
        { label: "It's different with designers", target: "different-designer" },
      ],
    ],
  },
  {
    id: "whos-this",
    title: "Who's this? / What's this about?",
    layoutArea: "whos-this",
    lines: [
      line([text("I'm just about to get to that, but first I want to make sure this is even relevant for you. Are you using AI for designs?")]),
    ],
    buttons: [
      { label: "I am using AI", target: "using-ai" },
      { label: "I am not using AI", target: "not-using-ai" },
    ],
  },
  {
    id: "confusion",
    title: "What are you talking about? (confusion)",
    layoutArea: "confusion",
    script: [
      line([strong("What are you talking about? (confusion)")]),
      line([text("I'll put it simply, teams I'm talking to are feeling pressure, the rise of AI is increasing demand and AI tools alone can't cover it, but adding new employees is a huge pain. Are you feeling that too?")]),
      line([strong("Yes: "), link("That's the spot", "spot-were-in", "reference")], 1),
      line([
        strong("No: "),
        text("Fair enough, then I just got to ask because you are the exception. What's your secret?"),
      ], 1),
      line([strong("If AI is solution: "), link("It's different with AI", "different-ai", "reference")], 2),
      line([strong("If designers are solution: "), link("It's different with designers", "different-designer", "reference")], 2),
      ...painExitLines(2),
    ],
  },
  {
    id: "spot-were-in",
    title: "That's the spot",
    layoutArea: "spot-were-in",
    script: [
      line([strong("That's the spot")]),
      line([text("You know what [[Prospect Name]], I'm hearing that a lot. Now I'm curious, is your team trying to use AI to meet that demand?")]),
      ...aiSystemBranch(1),
      line([
        strong("No: "),
        text("Honestly, that's good to hear. AI is not the solution people think it is "),
        em("[because then you're paying designers full salaries to be prompt engineers, but you can't get rid of the designers and do it yourself because you need designers to fix the quality and consistency of the AI's output, it's a trap that only feels like a solution until you really look at it]."),
        text(" But it sounds like your feeling the pressure other teams are feeling right now, which means something can be better "),
        link("Solution", "solution", "solution"),
      ], 1),
    ],
  },
  {
    id: "different-ai",
    title: "It's different with AI",
    layoutArea: "different-ai",
    script: [
      line([strong("It's different with AI")]),
      line([text("That's great [[Prospect Name]], sounds like you're meeting demand with AI, love to hear it. But does that mean you're running full designer salaries for your designers to write prompts and fix AI designs?")]),
      line([
        strong("Yes: "),
        text("Well hey, I know that's expensive "),
        link("Solution", "solution", "solution"),
      ], 1),
      line([strong("No: "), text("Sounds like you got a system with it, but:")], 1),
      aiSystemQuestions,
      ...painExitLines(2),
    ],
  },
  {
    id: "different-designer",
    title: "It's different with designers",
    layoutArea: "different-designer",
    script: [
      line([strong("It's different with designers")]),
      line([text("Awesome [[Prospect Name]]. I'm glad that's working for you, but do your designers ever bottleneck during busy seasons?")]),
      line([
        strong("Yes: "),
        text("Yeah, I hear that a lot, in house designers can't really fluctuate with demand "),
        link("Solution", "solution", "solution"),
      ], 1),
      line([
        strong("No: "),
        text("What about when multiple campaigns launch at once? Or sick days and staff changes? You're telling me you never hit capacity?"),
      ], 1),
      line([
        strong("Yes: "),
        text("Yeah I hear that a lot, in house designers can't really fluctuate with demand "),
        link("Solution", "solution", "solution"),
      ], 2),
      line([
        strong("No: "),
        text("Fair enough, then I just got to ask because you are the exception. What's your secret?"),
      ], 2),
      ...painExitLines(3),
      line([strong("No with freelancers: "), text("Got it, but:")], 2),
      freelancerQuestions,
      ...painExitLines(3),
      line([strong("No with agency: "), text("Got it, but:")], 2),
      list(
        [
          "Are you getting work back fast enough to move at the speed you need?",
          "How do small, quick requests get handled -- full project cycle or same-day?",
          "Are you on a retainer or contract right now?",
          "When you have a rush, how long does it actually take to turn around?",
          "Are you working with the same people each time, or does it keep changing?",
        ],
        2,
      ),
      ...painExitLines(3),
    ],
  },
  {
    id: "using-ai",
    title: "I am using AI",
    layoutArea: "using-ai",
    script: [
      line([strong("I am using AI")]),
      line([text("Great, AI is a fantastic tool, we use it to. But what I'm hearing from other marketing teams is that while AI has increased productivity, its also increased demand because your expected to do more, now that AI's in the mix. Yet no one is being approved to add headcount, so now you're actually doing more with less. Is that the spot you're in, or is it different on your end?")]),
      line([
        strong("That's the spot: "),
        text("I'm hearing that a lot. Now I'm curious if you're in the same boat as some of the other teams I talk to: are you running full designer salaries for your designers to write prompts and revise AI output?"),
      ], 1),
      line([
        strong("Yes: "),
        text("Well hey, I know that's expensive "),
        link("Solution", "solution", "solution"),
      ], 2),
      line([strong("No: "), text("Sounds like you got a system with it, but:")], 2),
      aiSystemQuestions,
      ...painExitLines(3),
      line([
        strong("It's different: "),
        text("Fair enough, then I just got to ask because you're the exception. What's your secret?"),
      ], 1),
      line([strong("If AI is solution: "), link("It's different with AI", "different-ai", "reference")], 2),
      line([strong("If designers are solution: "), link("It's different with designers", "different-designer", "reference")], 2),
      ...painExitLines(2),
    ],
  },
  {
    id: "not-using-ai",
    title: "I am not using AI",
    layoutArea: "not-using-ai",
    script: [
      line([strong("I am not using AI")]),
      line([
        text("You know what, I like to hear that. AI is not the solution people think it is "),
        muted("[because then you're paying designers full salaries to be prompt engineers, but you can't get rid of the designers and do it yourself because you need designers to fix the quality and consistency of the AI's output, it's a trap that only feels like a solution until you really look at it]."),
        text(" But, without the added productivity of AI, do your designers ever bottle neck during busy seasons?"),
      ]),
      line([
        strong("Yes: "),
        text("Yeah, I hear that a lot, in house designers can't really fluctuate with demand "),
        link("Solution", "solution", "solution"),
      ], 1),
      line([
        strong("No: "),
        text("What about when multiple campaigns launch at once? Or sick days and staff changes? You're telling me you never hit capacity?"),
      ], 1),
      line([
        strong("No: "),
        text("Fair enough, then I just got to ask because you are the exception. What's your secret?"),
      ], 2),
      ...painExitLines(3),
      line([
        strong("Yes: "),
        text("Yeah, I hear that a lot, in house designers can't really fluctuate with demand "),
        link("Solution", "solution", "solution"),
      ], 2),
    ],
  },
  {
    id: "solution",
    title: "Solution",
    layoutArea: "solution",
    script: [
      line([accent("Solution:", "solution")]),
      line([
        text("Look, let me share with you our solution. If you don't like it, no harm done we just end the call, but at least then you know it's there, and you can make the best decision whenever you want. Are you opposed to hearing me out?"),
      ]),
      line([
        strong("If using AI: "),
        text("We use AI too, it's great for productivity. But our team is human lead: Project manager. Creative lead. Creative team. You get the output you want, high quality and brand aware, because humans care when AI can't. But it sounds like that's what you got going on right now, you have designers running AI. The difference, though, is we're 3 thousand a month. If you could snap your fingers and make this switch to us, would it save you money?"),
      ], 1),
      line([strong("Yes: "), link("Close", "close", "close")], 2),
      line([strong("No: "), link("Exit", "graceful-exit", "exit")], 2),
      line([
        strong("If not using AI: "),
        text("We give you a full team: Project manager. Creative lead. Creative team. That can fluctuate with demand so you never hit capacity. If you could snap your fingers and make that switch, would it improve your work flow?"),
      ], 1),
      line([strong("Yes: "), link("Close", "close", "close")], 2),
      line([strong("No: "), link("Exit", "graceful-exit", "exit")], 2),
    ],
  },
  {
    id: "rush-bullet",
    title: "Impatient",
    layoutArea: "rush-bullet",
    script: [
      line([accent("Impatient:", "rush")]),
      line([text("Then let me just cut to the chase and this will be the last thing I say:")]),
      line([
        text("We're interested in solving genuine problems for marketing teams. If you're using designer salaries to pay designers to prompt AI and revise output, which is expensive, or you wish you could fluctuate headcount with demand, so your design team never bottlenecks, then maybe there's something I can do for you."),
      ]),
      line([strong("Yes: "), link("Solution", "solution", "solution")], 1),
      line([
        strong("No: "),
        text("Fair enough, then I just got to ask because you are the exception. What's your secret?"),
      ], 1),
      ...painExitLines(2),
      line([
        strong("Neither, marketers use AI directly: "),
        text("Sounds like you got a system with it, but I know AI output is inconsistent, not brand aware, and requires a ton of oversight and revision, is that a job best fit for marketers or designers?"),
      ], 1),
      ...painExitLines(2),
    ],
  },
  {
    id: "close",
    title: "Close",
    layoutArea: "close",
    script: [
      line([accent("Close:", "close")]),
      line([
        text("[[Name]], it sounds like you have a genuine need and your at least somewhat curious. I wasn't planning on solving any problems on the phone today. But in 20 minutes my director Alex Stewart can run you through it, do a full comparison, show you our work, and show you how we've helped teams solve this exact issue in the past. If you don't like it, no harm done, but at least then you know, and it only takes 20 minutes. He's available tomorrow, 11AM or 3PM, do either of those times work for you?"),
      ]),
    ],
  },
  {
    id: "graceful-exit",
    title: "Exit",
    layoutArea: "graceful-exit",
    script: [
      line([accent("Exit:", "exit")]),
      line([
        text("Well hey, sounds like you got a good thing going which means were probably not a good fit. So, I really appreciate your time, and I hope you have a great day from here on out, but I'll let you go. Take care [[Name]]"),
      ]),
    ],
  },
];

export function getButtonRows(block: DialogueBlock) {
  if (block.buttonRows) {
    return block.buttonRows;
  }

  return block.buttons ? [block.buttons] : [];
}

export function getAllTargets(block: DialogueBlock) {
  const buttonTargets = getButtonRows(block).flatMap((row) =>
    row.map((button) => ({ label: button.label, target: button.target })),
  );
  const scriptTargets = (block.script ?? []).flatMap((content) =>
    "parts" in content
      ? content.parts
        .filter((part): part is Extract<TextPart, { kind: "link" }> => part.kind === "link")
        .map((part) => ({ label: part.label, target: part.target }))
      : [],
  );

  return [...buttonTargets, ...scriptTargets];
}

export function getMissingTargets(blocks: DialogueBlock[]) {
  const ids = new Set(blocks.map((block) => block.id));
  const titles = new Set(blocks.map((block) => block.title.trim()).filter(Boolean));

  return blocks.flatMap((block) =>
    getAllTargets(block)
      .filter((target) => !ids.has(target.target) && !titles.has(target.label.trim()) && !titles.has(target.target.trim()))
      .map((target) => ({
        from: block.id,
        label: target.label,
        target: target.target,
      })),
  );
}













