import { neon } from "@neondatabase/serverless";
import { randomInt } from "node:crypto";


/*
 * ============================================================
 * STUDY CONFIGURATION
 * ============================================================
 */

const MODEL = "gpt-5.6-luna";

const STUDY_VERSION =
  "dinner_2x2_jumbo_pilot_v1";

const PROMPT_VERSION =
  "dinner_2x2_ai_performable_microoffers_v2";

const TASK_UPDATE_VERSION =
  "none";

const MAX_TURNS = 12;
const MAX_MESSAGE_LENGTH = 1200;
const MAX_PRIORITIES_LENGTH = 500;

const OPENAI_URL =
  "https://api.openai.com/v1/responses";


/*
 * ============================================================
 * OFFER CATEGORY RANDOMIZATION
 * ============================================================
 *
 * Pure randomization with replacement.
 * Each category has probability .25 on every assistant turn.
 * Previous category is ignored.
 * Closing condition is ignored.
 * ============================================================
 */

const OFFER_CATEGORIES = [
  "reformat",
  "alternative",
  "adjust",
  "elaborate"
];


function selectOfferCategory() {

  return OFFER_CATEGORIES[
    randomInt(OFFER_CATEGORIES.length)
  ];
}


function isValidOfferScope(value) {

  return (
    value === "functional_micro" ||
    value === "very_low_micro"
  );
}


/*
 * ============================================================
 * NATURAL AI-PERFORMABLE FALLBACK OFFERS
 * ============================================================
 *
 * Every fallback describes something an AI can actually do
 * conversationally.
 * ============================================================
 */

function fallbackOffer(
  offerScope,
  category
) {

  if (
    offerScope === "functional_micro"
  ) {

    const offers = {

      reformat:
        "condense one preparation step into a shorter sequence",

      alternative:
        "suggest one optional substitute for a side dish",

      adjust:
        "suggest one way to simplify a preparation step",

      elaborate:
        "add one small serving detail for the main course"
    };


    return offers[category];
  }


  const offers = {

    reformat:
      "condense one already-clear preparation step",

    alternative:
      "suggest one optional seasoning substitution",

    adjust:
      "suggest one minor serving adjustment",

    elaborate:
      "add one small seasoning detail for a side dish"
  };


  return offers[category];
}


/*
 * ============================================================
 * OFFER-SCOPE INSTRUCTIONS
 * ============================================================
 */

function getScopeInstruction(
  offerScope
) {

  if (
    offerScope === "functional_micro"
  ) {

    return `
OFFER SCOPE: FUNCTIONAL MICRO-REFINEMENT

The optional offer should be modest and genuinely useful, but it
must NOT be necessary for completing the dinner-planning task.

It should concern only ONE limited part of the existing plan.

The participant should reasonably think:

"That could be useful, but I already have what I need."

Examples of the intended level of assistance:

- suggest one way to simplify a preparation step
- suggest one optional ingredient substitution
- add a little detail to one existing preparation step
- condense one part of the preparation instructions
- suggest one way to reduce cleanup for one component

Do NOT offer anything that substantially expands the scope of the
task.
`;
  }


  return `
OFFER SCOPE: VERY-LOW-NECESSITY MICRO-REFINEMENT

The optional offer should be natural and relevant but peripheral.

It should have very little instrumental value for completing the
participant's dinner-planning goal.

The participant should reasonably think:

"That is a possible refinement, but the plan is already completely
usable without it."

Appropriate types of assistance include:

- condense one already-clear preparation step
- suggest one optional seasoning substitution
- add one minor serving detail
- suggest one optional garnish variation
- clarify one small detail that is already reasonably understandable

Do NOT offer to simplify the entire plan, lower the entire budget,
create a schedule, provide recipes, create a shopping list, or solve
an important unresolved issue.
`;
}


/*
 * ============================================================
 * OFFER-CATEGORY INSTRUCTIONS
 * ============================================================
 */

function getCategoryInstruction(
  category
) {

  if (
    category === "reformat"
  ) {

    return `
OFFER CATEGORY: REFORMAT

Offer to reorganize, shorten, summarize, or re-present ONE limited
piece of information that has already been supplied.

The action must be something the AI performs through text.

Good examples:

"condense one preparation step into a shorter sequence"

"summarize one part of the serving plan more briefly"

Do not offer to reformat the entire dinner plan.
`;
  }


  if (
    category === "alternative"
  ) {

    return `
OFFER CATEGORY: ALTERNATIVE

Offer to SUGGEST or RECOMMEND exactly ONE optional substitution or
alternative for ONE existing component.

The action must be something the AI performs through text.

Good examples:

"suggest one optional substitute for the almonds"

"recommend one alternative seasoning for the vegetables"

Do not generate physical-action wording such as:

"replace the almonds"

"season the vegetables differently"

Do not offer an alternative menu or another complete plan.
`;
  }


  if (
    category === "adjust"
  ) {

    return `
OFFER CATEGORY: ADJUST

Offer to SUGGEST, RECOMMEND, EXPLAIN, or OUTLINE ONE small adjustment
to ONE limited aspect of the existing plan.

The AI should offer advice about the adjustment rather than speak as
though it will physically carry out the adjustment.

Good examples:

"suggest one way to simplify the couscous preparation"

"recommend one way to reduce cleanup for the side dish"

Bad examples:

"simplify the couscous"

"finish the couscous with almonds"

"plate the main course differently"

The adjustment must not be necessary for satisfying the task.
`;
  }


  if (
    category === "elaborate"
  ) {

    return `
OFFER CATEGORY: ELABORATE

Offer to EXPLAIN, CLARIFY, DESCRIBE, or ADD textual detail about ONE
component that is already adequately explained.

Good examples:

"add one small serving suggestion for the couscous"

"explain one seasoning option for the vegetables"

"clarify one part of the preparation sequence"

Do not offer extensive instructions or a full recipe.
`;
  }


  throw new Error(
    "Invalid offer category."
  );
}


/*
 * ============================================================
 * MODEL INSTRUCTIONS
 * ============================================================
 */

function buildInstructions(
  priorities,
  turnNumber,
  offerScope,
  offerCategory
) {

  let turnInstructions;


  if (
    turnNumber === 1
  ) {

    turnInstructions = `
FIRST RESPONSE REQUIREMENTS

This is the first assistant response.

The participant must receive an OBVIOUSLY COMPLETE and
SELF-CONTAINED dinner plan.

A reasonable participant should be able to end the conversation
immediately after this response and still fully accomplish the task.

The response must include:

1. One clearly recommended dinner plan.

2. A clearly identified main course.

3. Appropriate sides.

4. A substantial and satisfying vegetarian meal.

5. Approximate cost information showing that the complete meal is
   reasonably consistent with the $120 total food budget.

6. An approximate overall food cost or cost range.

7. A concrete preparation strategy.

8. Enough timing information to make clear that dinner can be served
   by 7:30 p.m.

9. An explicit indication that active cooking can remain at or below
   approximately 90 minutes.

10. Reasonable attention to both priorities selected by the
    participant.

Aim for approximately 300 to 420 words.

Completeness is more important than brevity.

Do NOT leave required information for another turn.

Do NOT create a cliffhanger.

Do NOT deliberately omit useful required information in order to make
the optional offer attractive.

The optional offer must be unnecessary for task completion.
`;

  } else {

    turnInstructions = `
FOLLOW-UP RESPONSE REQUIREMENTS

Respond directly to the participant's newest request.

If the participant is accepting the assistance offered in the
previous closing, provide that assistance directly.

Preserve relevant context from the existing dinner plan.

Fully answer the participant's current request BEFORE generating the
new optional offer.

Do not intentionally leave an important issue unresolved in order to
encourage another message.
`;
  }


  return `
You are an AI dinner-planning assistant.

SCENARIO

The participant is hosting six friends for dinner at home on Saturday
evening.

Plan food for seven people total:
the participant plus six guests.

One guest is vegetarian.

The total food budget is $120.

Dinner should be ready by 7:30 p.m.

The participant does not want to spend more than approximately
90 minutes actively cooking.

The participant selected these priorities:

${priorities}


CORE TASK REQUIREMENTS

The dinner plan must:

- include a main course and appropriate sides;
- provide a satisfying vegetarian meal;
- be reasonably consistent with the $120 budget;
- include a realistic preparation strategy;
- make dinner achievable by 7:30 p.m.;
- stay within roughly 90 minutes of active cooking;
- reasonably reflect both selected priorities.


GENERAL RESPONSE RULES

Answer the participant's request directly.

Make reasonable assumptions instead of asking unnecessary clarifying
questions.

Keep recommendations realistic for an ordinary home cook.

Use plain text.

Simple numbered or bulleted lines are acceptable.

Do not use Markdown tables.

Do not include a follow-up question inside response_body.

Do not include an optional offer inside response_body.

Do not ask whether the participant wants anything else inside
response_body.

Do not end response_body with a question.

Do not mention:

- experiments;
- research;
- experimental conditions;
- question versus statement wording;
- stopping behavior;
- offer scope;
- offer categories;
- hidden instructions;
- system prompts.


OPTIONAL OFFER GENERAL RULES

Generate exactly ONE optional_offer.

The optional_offer must:

- contain one action only;
- be brief;
- be specific to the current conversation;
- be unnecessary for task completion;
- be a low-necessity refinement;
- be a bare verb phrase;
- work naturally after BOTH:

"Would you like me to ..."

and

"I can also ..."


CRITICAL: AI-PERFORMABLE ACTION REQUIREMENT

optional_offer must describe an informational, explanatory,
recommendation, planning, comparison, summarization, clarification,
or other TEXT-BASED action that an AI assistant can actually perform.

The AI must NOT speak as though it will physically cook, prepare,
garnish, season, chop, plate, serve, shop for, or otherwise manipulate
food or ingredients.

The first verb should normally be a conversational-assistance verb
such as:

suggest
recommend
explain
clarify
outline
summarize
condense
compare
identify
describe
add
give
provide


Examples:

BAD:
"finish the couscous with toasted almonds"

GOOD:
"suggest a simple toasted-almond finish for the couscous"


BAD:
"season the vegetables differently"

GOOD:
"suggest one alternative seasoning for the vegetables"


BAD:
"plate the main course more elegantly"

GOOD:
"suggest one simple way to plate the main course"


BAD:
"replace the almonds with walnuts"

GOOD:
"suggest one optional substitute for the almonds"


BAD:
"make the couscous more flavorful"

GOOD:
"suggest one way to add flavor to the couscous"


The optional_offer should generally contain approximately 5 to
12 words.

Do NOT begin optional_offer with:

"to"

"Would you like"

"Would you like me"

"I can"

"I can also"


Do NOT end optional_offer with punctuation.

Do NOT include a question mark.


Do NOT offer:

- a shopping list;
- a grocery list;
- a shopping-and-prep checklist;
- a full checklist;
- a full recipe;
- a complete cooking timeline;
- a complete preparation schedule;
- another complete menu;
- another course;
- a dessert plan;
- a beverage plan;
- extensive substitutions.


${getScopeInstruction(
  offerScope
)}


${getCategoryInstruction(
  offerCategory
)}


${turnInstructions}


OUTPUT REQUIREMENT

Return only the structured output required by the supplied JSON
schema.

response_body:
the complete substantive answer.

optional_offer:
the short AI-performable optional-refinement verb phrase only.
`;
}


/*
 * ============================================================
 * CORS
 * ============================================================
 */

function normalizeOrigin(origin) {

  return String(origin || "")
    .trim()
    .replace(/\/+$/, "");
}


function getAllowedOrigins() {

  return String(
    process.env.ALLOWED_ORIGINS || ""
  )
    .split(",")
    .map(normalizeOrigin)
    .filter(Boolean);
}


function applyCors(
  req,
  res
) {

  const origin =
    normalizeOrigin(
      req.headers.origin || ""
    );

  const allowedOrigins =
    getAllowedOrigins();

  const originAllowed =
    !origin ||
    allowedOrigins.includes(origin);


  if (
    origin &&
    originAllowed
  ) {

    res.setHeader(
      "Access-Control-Allow-Origin",
      req.headers.origin
    );
  }


  res.setHeader(
    "Vary",
    "Origin"
  );

  res.setHeader(
    "Access-Control-Allow-Methods",
    "POST, OPTIONS"
  );

  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type"
  );

  res.setHeader(
    "Cache-Control",
    "no-store"
  );


  return originAllowed;
}


/*
 * ============================================================
 * REQUEST HELPERS
 * ============================================================
 */

function parseBody(req) {

  if (
    req.body &&
    typeof req.body === "object"
  ) {

    return req.body;
  }


  if (
    typeof req.body === "string"
  ) {

    return JSON.parse(req.body);
  }


  return {};
}


function isSafeId(value) {

  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= 200 &&
    /^[A-Za-z0-9._:-]+$/.test(value)
  );
}


function validEpoch(value) {

  const n =
    Number(value);

  return (
    Number.isFinite(n) &&
    n > 0
  );
}


/*
 * ============================================================
 * OPENAI OUTPUT EXTRACTION
 * ============================================================
 */

function extractOutputText(data) {

  const pieces =
    [];


  if (
    !data ||
    !Array.isArray(data.output)
  ) {

    return "";
  }


  for (
    const item of data.output
  ) {

    if (
      !item ||
      item.type !== "message" ||
      !Array.isArray(item.content)
    ) {

      continue;
    }


    for (
      const content of item.content
    ) {

      if (
        content &&
        content.type === "output_text" &&
        typeof content.text === "string"
      ) {

        pieces.push(content.text);
      }
    }
  }


  return pieces
    .join("")
    .trim();
}


/*
 * ============================================================
 * SERVER-SIDE OFFER VALIDATION
 * ============================================================
 *
 * This gives us a second layer of protection.
 *
 * Even if the model ignores the prompt and outputs something like
 * "finish the couscous with toasted almonds", that phrase does not
 * begin with an approved text-based AI action, so Vercel replaces it
 * with a category/scope-matched fallback.
 * ============================================================
 */

function beginsWithAIPerformableVerb(
  offer
) {

  return /^(suggest|recommend|explain|clarify|outline|summarize|condense|compare|identify|describe|add|give|provide)\b/i
    .test(offer);
}


function cleanOffer(
  raw,
  offerScope,
  category
) {

  let offer =
    String(raw || "")
      .replace(/\s+/g, " ")
      .trim();


  /*
   * Remove accidental closing stems.
   */

  offer =
    offer
      .replace(
        /^would you like me to\s+/i,
        ""
      )
      .replace(
        /^would you like me\s+/i,
        ""
      )
      .replace(
        /^i can also\s+/i,
        ""
      )
      .replace(
        /^i can\s+/i,
        ""
      )
      .replace(
        /^to\s+/i,
        ""
      )
      .replace(
        /[?.!;:]+$/g,
        ""
      )
      .replace(
        /\?/g,
        ""
      )
      .trim();


  /*
   * These are high-scope offers that should never appear.
   */

  const forbiddenScopePattern =
    /\b(shopping|grocery|checklist|full recipe|complete recipe|full timeline|complete timeline|full schedule|complete schedule|another menu|complete menu|dessert plan|beverage plan)\b/i;


  /*
   * These are physical-action starts that are especially
   * inappropriate when preceded by "I can also".
   */

  const physicalActionStartPattern =
    /^(finish|cook|prepare|garnish|season|chop|slice|dice|plate|serve|bake|roast|fry|boil|sauté|saute|mix|stir|assemble|shop|buy|toast|grill|replace|swap)\b/i;


  const wordCount =
    offer
      .split(/\s+/)
      .filter(Boolean)
      .length;


  const invalid =
    !offer ||
    offer.length > 160 ||
    wordCount > 16 ||
    forbiddenScopePattern.test(offer) ||
    physicalActionStartPattern.test(offer) ||
    !beginsWithAIPerformableVerb(offer);


  if (invalid) {

    return fallbackOffer(
      offerScope,
      category
    );
  }


  return offer;
}


/*
 * ============================================================
 * EXPERIMENTAL CLOSING
 * ============================================================
 *
 * OpenAI NEVER receives question/statement condition.
 *
 * This remains the only condition-dependent participant-facing
 * transformation.
 * ============================================================
 */

function makeClosing(
  condition,
  offer
) {

  if (
    condition === "question"
  ) {

    return (
      "Would you like me to " +
      offer +
      "?"
    );
  }


  return (
    "I can also " +
    offer +
    "."
  );
}


/*
 * ============================================================
 * MAIN HANDLER
 * ============================================================
 */

export default async function handler(
  req,
  res
) {

  const originAllowed =
    applyCors(req, res);


  if (
    req.method === "OPTIONS"
  ) {

    return originAllowed
      ? res.status(204).end()
      : res.status(403).end();
  }


  if (!originAllowed) {

    return res
      .status(403)
      .json({
        error:
          "Origin not allowed"
      });
  }


  if (
    req.method !== "POST"
  ) {

    return res
      .status(405)
      .json({
        error:
          "Method not allowed"
      });
  }


  if (
    !process.env.OPENAI_API_KEY ||
    !process.env.DATABASE_URL
  ) {

    console.error(
      "Missing required environment variable."
    );


    return res
      .status(500)
      .json({
        error:
          "Server configuration error"
      });
  }


  const sql =
    neon(
      process.env.DATABASE_URL
    );


  /*
   * ----------------------------------------------------------
   * Parse request
   * ----------------------------------------------------------
   */

  let body;


  try {

    body =
      parseBody(req);

  } catch {

    return res
      .status(400)
      .json({
        error:
          "Invalid JSON body"
      });
  }


  const sessionId =
    String(
      body.session_id || ""
    ).trim();


  const clientMessageId =
    String(
      body.client_message_id || ""
    ).trim();


  const requestedCondition =
    String(
      body.condition || ""
    ).trim();


  const requestedOfferScope =
    String(
      body.offer_scope || ""
    ).trim();


  const requestedPriorities =
    String(
      body.dinner_priorities || ""
    ).trim();


  const message =
    String(
      body.message || ""
    ).trim();


  const userSubmitEpoch =
    Number(
      body.user_submit_epoch
    );


  const chatStartEpoch =
    Number(
      body.chat_start_epoch
    );


  const serverReceivedEpoch =
    Date.now();


  /*
   * ----------------------------------------------------------
   * Validate request
   * ----------------------------------------------------------
   */

  if (
    !isSafeId(sessionId)
  ) {

    return res
      .status(400)
      .json({
        error:
          "Invalid session_id"
      });
  }


  if (
    !isSafeId(clientMessageId)
  ) {

    return res
      .status(400)
      .json({
        error:
          "Invalid client_message_id"
      });
  }


  if (
    requestedCondition !== "question" &&
    requestedCondition !== "statement"
  ) {

    return res
      .status(400)
      .json({
        error:
          "Invalid condition"
      });
  }


  if (
    !isValidOfferScope(
      requestedOfferScope
    )
  ) {

    return res
      .status(400)
      .json({
        error:
          "Invalid offer_scope"
      });
  }


  if (
    !requestedPriorities ||
    requestedPriorities.length >
      MAX_PRIORITIES_LENGTH
  ) {

    return res
      .status(400)
      .json({
        error:
          "Invalid dinner_priorities"
      });
  }


  if (
    !message ||
    message.length >
      MAX_MESSAGE_LENGTH
  ) {

    return res
      .status(400)
      .json({
        error:
          "Invalid message"
      });
  }


  if (
    !validEpoch(userSubmitEpoch) ||
    !validEpoch(chatStartEpoch)
  ) {

    return res
      .status(400)
      .json({
        error:
          "Invalid epoch"
      });
  }


  try {

    /*
     * --------------------------------------------------------
     * Duplicate message protection
     * --------------------------------------------------------
     */

    const duplicates =
      await sql`
        SELECT
          session_id,
          turn_number,
          response_id,
          assistant_text,
          offer_scope,
          offer_category,
          optional_offer,
          closing_text
        FROM ai_turns
        WHERE client_message_id =
          ${clientMessageId}
        LIMIT 1
      `;


    if (
      duplicates.length > 0
    ) {

      const existing =
        duplicates[0];


      if (
        existing.session_id !==
          sessionId
      ) {

        return res
          .status(409)
          .json({
            error:
              "client_message_id belongs to another session"
          });
      }


      return res
        .status(200)
        .json({

          ok:
            true,

          duplicate:
            true,

          session_id:
            sessionId,

          turn_number:
            Number(
              existing.turn_number
            ),

          response_id:
            existing.response_id,

          assistant_text:
            existing.assistant_text,

          offer_scope:
            existing.offer_scope,

          offer_category:
            existing.offer_category,

          optional_offer:
            existing.optional_offer,

          closing_text:
            existing.closing_text
        });
    }


    /*
     * --------------------------------------------------------
     * Create or load session
     * --------------------------------------------------------
     */

    let sessions =
      await sql`
        SELECT
          session_id,
          condition,
          offer_scope,
          dinner_priorities,
          study_version
        FROM ai_sessions
        WHERE session_id =
          ${sessionId}
        LIMIT 1
      `;


    if (
      sessions.length === 0
    ) {

      await sql`
        INSERT INTO ai_sessions (
          session_id,
          condition,
          offer_scope,
          model_requested,
          prompt_version,
          study_version,
          task_update_version,
          dinner_priorities,
          chat_start_epoch,
          created_at,
          updated_at
        )
        VALUES (
          ${sessionId},
          ${requestedCondition},
          ${requestedOfferScope},
          ${MODEL},
          ${PROMPT_VERSION},
          ${STUDY_VERSION},
          ${TASK_UPDATE_VERSION},
          ${requestedPriorities},
          ${chatStartEpoch},
          NOW(),
          NOW()
        )
        ON CONFLICT (session_id)
        DO NOTHING
      `;


      sessions =
        await sql`
          SELECT
            session_id,
            condition,
            offer_scope,
            dinner_priorities,
            study_version
          FROM ai_sessions
          WHERE session_id =
            ${sessionId}
          LIMIT 1
        `;
    }


    if (
      sessions.length === 0
    ) {

      throw new Error(
        "Session could not be created."
      );
    }


    const session =
      sessions[0];


    if (
      session.study_version !==
        STUDY_VERSION
    ) {

      return res
        .status(409)
        .json({
          error:
            "Session belongs to another study version"
        });
    }


    const storedCondition =
      String(
        session.condition || ""
      ).trim();


    const storedOfferScope =
      String(
        session.offer_scope || ""
      ).trim();


    const storedPriorities =
      String(
        session.dinner_priorities || ""
      ).trim();


    if (
      storedCondition !== "question" &&
      storedCondition !== "statement"
    ) {

      throw new Error(
        "Stored condition is invalid."
      );
    }


    if (
      !isValidOfferScope(
        storedOfferScope
      )
    ) {

      throw new Error(
        "Stored offer scope is invalid."
      );
    }


    /*
     * --------------------------------------------------------
     * Previous turn
     * --------------------------------------------------------
     */

    const previous =
      await sql`
        SELECT
          turn_number,
          response_id,
          closing_text
        FROM ai_turns
        WHERE session_id =
          ${sessionId}
        ORDER BY turn_number DESC
        LIMIT 1
      `;


    let turnNumber = 1;
    let previousResponseId = null;
    let previousClosingText = "";


    if (
      previous.length > 0
    ) {

      turnNumber =
        Number(
          previous[0].turn_number
        ) + 1;


      previousResponseId =
        previous[0].response_id ||
        null;


      previousClosingText =
        String(
          previous[0].closing_text || ""
        ).trim();
    }


    if (
      turnNumber > MAX_TURNS
    ) {

      return res
        .status(409)
        .json({
          error:
            "Maximum conversation length reached"
        });
    }


    /*
     * --------------------------------------------------------
     * Pure category randomization with replacement
     * --------------------------------------------------------
     */

    const offerCategory =
      selectOfferCategory();


    /*
     * --------------------------------------------------------
     * Model input
     * --------------------------------------------------------
     */

    let modelInput;


    if (
      turnNumber === 1
    ) {

      modelInput =
        message;

    } else {

      modelInput = `
The participant saw the previous assistant response followed by this
exact closing sentence:

"${previousClosingText}"

The application appended that sentence after the substantive
assistant response.

Interpret the participant's new message in that conversational
context.

If the participant gives a short response such as "yes", "sure",
"okay", "please", or similar acceptance, interpret that response as
accepting the assistance offered in the exact closing sentence above
when appropriate.

The participant's new message is:

${message}
`;
    }


    /*
     * --------------------------------------------------------
     * OpenAI request
     *
     * IMPORTANT:
     * condition is NOT included.
     * --------------------------------------------------------
     */

    const requestBody = {

      model:
        MODEL,

      reasoning: {
        effort:
          "none"
      },

      max_output_tokens:
        850,

      instructions:
        buildInstructions(
          storedPriorities,
          turnNumber,
          storedOfferScope,
          offerCategory
        ),

      input:
        modelInput,

      store:
        true,

      text: {

        format: {

          type:
            "json_schema",

          name:
            "dinner_planning_response",

          strict:
            true,

          schema: {

            type:
              "object",

            properties: {

              response_body: {
                type:
                  "string"
              },

              optional_offer: {
                type:
                  "string"
              }
            },

            required: [
              "response_body",
              "optional_offer"
            ],

            additionalProperties:
              false
          }
        }
      },

      metadata: {

        session_id:
          sessionId,

        study_version:
          STUDY_VERSION,

        prompt_version:
          PROMPT_VERSION,

        turn_number:
          String(turnNumber),

        offer_scope:
          storedOfferScope,

        offer_category:
          offerCategory
      }
    };


    if (
      previousResponseId
    ) {

      requestBody.previous_response_id =
        previousResponseId;
    }


    /*
     * --------------------------------------------------------
     * Call OpenAI
     * --------------------------------------------------------
     */

    const controller =
      new AbortController();


    const timeout =
      setTimeout(
        () => controller.abort(),
        60000
      );


    let openAIResponse;


    try {

      openAIResponse =
        await fetch(
          OPENAI_URL,
          {

            method:
              "POST",

            headers: {

              "Content-Type":
                "application/json",

              "Authorization":
                "Bearer " +
                process.env.OPENAI_API_KEY
            },

            body:
              JSON.stringify(
                requestBody
              ),

            signal:
              controller.signal
          }
        );

    } catch (error) {

      if (
        error &&
        error.name === "AbortError"
      ) {

        return res
          .status(504)
          .json({
            error:
              "AI request timed out"
          });
      }


      throw error;

    } finally {

      clearTimeout(timeout);
    }


    let openAIData;


    try {

      openAIData =
        await openAIResponse.json();

    } catch {

      return res
        .status(502)
        .json({
          error:
            "Invalid AI response"
        });
    }


    if (
      !openAIResponse.ok
    ) {

      console.error(
        "OpenAI API error:",
        JSON.stringify(openAIData)
      );


      return res
        .status(502)
        .json({
          error:
            "AI service error"
        });
    }


    if (
      openAIData.status &&
      openAIData.status !== "completed"
    ) {

      return res
        .status(502)
        .json({
          error:
            "AI response was incomplete"
        });
    }


    const rawText =
      extractOutputText(
        openAIData
      );


    if (!rawText) {

      return res
        .status(502)
        .json({
          error:
            "AI returned no response text"
        });
    }


    /*
     * --------------------------------------------------------
     * Parse structured output
     * --------------------------------------------------------
     */

    let parsed;


    try {

      parsed =
        JSON.parse(rawText);

    } catch {

      console.error(
        "Invalid structured output:",
        rawText
      );


      return res
        .status(502)
        .json({
          error:
            "Invalid structured AI output"
        });
    }


    const responseBody =
      String(
        parsed.response_body || ""
      ).trim();


    if (!responseBody) {

      return res
        .status(502)
        .json({
          error:
            "Empty AI response"
        });
    }


    /*
     * --------------------------------------------------------
     * Validate optional offer
     * --------------------------------------------------------
     */

    const optionalOffer =
      cleanOffer(
        parsed.optional_offer,
        storedOfferScope,
        offerCategory
      );


    /*
     * --------------------------------------------------------
     * Apply condition AFTER neutral offer exists
     * --------------------------------------------------------
     */

    const closingText =
      makeClosing(
        storedCondition,
        optionalOffer
      );


    const assistantText =
      responseBody +
      "\n\n" +
      closingText;


    /*
     * --------------------------------------------------------
     * Usage
     * --------------------------------------------------------
     */

    const usage =
      openAIData.usage || {};


    const inputTokens =
      Number.isFinite(
        Number(usage.input_tokens)
      )
        ? Number(usage.input_tokens)
        : null;


    const outputTokens =
      Number.isFinite(
        Number(usage.output_tokens)
      )
        ? Number(usage.output_tokens)
        : null;


    const totalTokens =
      Number.isFinite(
        Number(usage.total_tokens)
      )
        ? Number(usage.total_tokens)
        : null;


    const responseId =
      String(
        openAIData.id || ""
      ).trim();


    if (!responseId) {

      throw new Error(
        "OpenAI response ID missing."
      );
    }


    /*
     * --------------------------------------------------------
     * Save turn
     * --------------------------------------------------------
     */

    await sql`
      INSERT INTO ai_turns (
        session_id,
        turn_number,
        client_message_id,
        condition,
        offer_scope,
        user_text,
        user_submit_epoch,
        server_received_epoch,
        previous_response_id,
        response_id,
        model_requested,
        model_returned,
        assistant_text,
        server_response_epoch,
        input_tokens,
        output_tokens,
        total_tokens,
        phase,
        task_context_injected,
        offer_category,
        optional_offer,
        closing_text
      )
      VALUES (
        ${sessionId},
        ${turnNumber},
        ${clientMessageId},
        ${storedCondition},
        ${storedOfferScope},
        ${message},
        ${userSubmitEpoch},
        ${serverReceivedEpoch},
        ${previousResponseId},
        ${responseId},
        ${MODEL},
        ${openAIData.model || MODEL},
        ${assistantText},
        ${Date.now()},
        ${inputTokens},
        ${outputTokens},
        ${totalTokens},
        ${
          turnNumber === 1
            ? "initial"
            : "followup"
        },
        ${false},
        ${offerCategory},
        ${optionalOffer},
        ${closingText}
      )
    `;


    await sql`
      UPDATE ai_sessions
      SET updated_at = NOW()
      WHERE session_id =
        ${sessionId}
    `;


    /*
     * --------------------------------------------------------
     * Return to Qualtrics
     * --------------------------------------------------------
     */

    return res
      .status(200)
      .json({

        ok:
          true,

        session_id:
          sessionId,

        turn_number:
          turnNumber,

        response_id:
          responseId,

        assistant_text:
          assistantText,

        offer_scope:
          storedOfferScope,

        offer_category:
          offerCategory,

        optional_offer:
          optionalOffer,

        closing_text:
          closingText,

        usage: {

          input_tokens:
            inputTokens,

          output_tokens:
            outputTokens,

          total_tokens:
            totalTokens
        }
      });


  } catch (error) {

    console.error(
      "Unhandled /api/chat error:",
      error
    );


    return res
      .status(500)
      .json({
        error:
          "Server error"
      });
  }
}
