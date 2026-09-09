import { neon } from "@neondatabase/serverless";
import { randomInt } from "node:crypto";


const MODEL = "gpt-5.6-luna";

const STUDY_VERSION =
  "dinner_2x2_jumbo_pilot_v1";

const PROMPT_VERSION =
  "dinner_2x2_complete_microoffers_v1";

const TASK_UPDATE_VERSION =
  "none";

const MAX_TURNS = 12;
const MAX_MESSAGE_LENGTH = 1200;
const MAX_PRIORITIES_LENGTH = 500;

const OPENAI_URL =
  "https://api.openai.com/v1/responses";


/*
 * Offer category continues to be independently randomized
 * WITH REPLACEMENT on every assistant turn.
 */

const OFFER_CATEGORIES = [
  "reformat",
  "alternative",
  "adjust",
  "elaborate"
];


function selectOfferCategory() {

  return OFFER_CATEGORIES[
    randomInt(
      OFFER_CATEGORIES.length
    )
  ];
}


function isValidOfferScope(value) {

  return (
    value === "functional_micro" ||
    value === "very_low_micro"
  );
}


/*
 * ------------------------------------------------------------
 * FALLBACK OFFERS
 * ------------------------------------------------------------
 */

function fallbackOffer(
  offerScope,
  category
) {

  if (
    offerScope === "functional_micro"
  ) {

    const map = {

      reformat:
        "condense one preparation step into a shorter sequence",

      alternative:
        "suggest one optional substitution for a side dish",

      adjust:
        "make one preparation step slightly simpler",

      elaborate:
        "add a little more detail to one preparation step"
    };

    return map[category];
  }


  const map = {

    reformat:
      "shorten the wording of one preparation step",

    alternative:
      "suggest one optional seasoning substitution",

    adjust:
      "make one serving detail slightly simpler",

    elaborate:
      "add one small detail about seasoning a side dish"
  };

  return map[category];
}


/*
 * ------------------------------------------------------------
 * OFFER-SCOPE INSTRUCTIONS
 * ------------------------------------------------------------
 */

function getScopeInstruction(
  offerScope
) {

  if (
    offerScope === "functional_micro"
  ) {

    return `
OFFER SCOPE: FUNCTIONAL MICRO-REFINEMENT

The optional offer should be a modest and genuinely useful
refinement, but it must NOT be needed to complete the dinner task.

It should affect only ONE limited part of the existing plan.

The participant should reasonably think:

"That could be useful, but I do not need it."

Examples of the intended level of usefulness:

- simplify one preparation step;
- reduce cleanup for one component;
- provide one optional substitution;
- add a little detail to one existing step;
- condense one limited part of the preparation plan.

Do not offer anything that substantially expands the task.
`;
  }


  return `
OFFER SCOPE: VERY-LOW-NECESSITY MICRO-REFINEMENT

The optional offer should be natural and relevant, but peripheral.

It should have very little instrumental value for completing the
participant's dinner-planning goal.

The participant should reasonably think:

"That is a possible refinement, but the plan is already completely
usable without it."

Keep the refinement narrowly focused on a minor detail such as:

- wording or presentation of one already-clear step;
- one small seasoning detail;
- one minor serving detail;
- one optional seasoning or garnish substitution;
- one very small clarification of an already-adequate component.

Do not offer to simplify the whole plan, reduce the overall budget,
create a schedule, provide recipes, create a shopping list, or solve
any important unresolved issue.
`;
}


/*
 * ------------------------------------------------------------
 * OFFER-CATEGORY INSTRUCTIONS
 * ------------------------------------------------------------
 */

function getCategoryInstruction(
  category
) {

  if (
    category === "reformat"
  ) {

    return `
OFFER CATEGORY: REFORMAT

Offer to reorganize, shorten, or re-present ONE limited piece of
information that has already been supplied.

Do not offer to reformat the entire dinner plan.
`;
  }


  if (
    category === "alternative"
  ) {

    return `
OFFER CATEGORY: ALTERNATIVE

Offer exactly ONE optional substitution or alternative for ONE
existing component.

Do not offer an alternative menu or another complete plan.
`;
  }


  if (
    category === "adjust"
  ) {

    return `
OFFER CATEGORY: ADJUST

Offer to make ONE small adjustment to ONE limited aspect of the
existing plan.

The adjustment must not be necessary for satisfying the task.
`;
  }


  if (
    category === "elaborate"
  ) {

    return `
OFFER CATEGORY: ELABORATE

Offer to add a small amount of detail to ONE component that is
already adequately explained.

Do not offer extensive instructions or a full recipe.
`;
  }


  throw new Error(
    "Invalid offer category."
  );
}


/*
 * ------------------------------------------------------------
 * MODEL INSTRUCTIONS
 * ------------------------------------------------------------
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

The participant must receive an OBVIOUSLY COMPLETE,
SELF-CONTAINED dinner plan.

A reasonable participant should be able to end the conversation
immediately after this response and still fully accomplish the task.

The response must include:

1. One clearly recommended dinner plan.

2. A main course.

3. Appropriate sides.

4. A substantial and satisfying vegetarian meal.

5. Approximate cost information showing that the complete meal is
   reasonably consistent with the $120 total food budget.

6. An approximate total cost or cost range.

7. A concrete preparation strategy.

8. Enough timing information to make it clear that dinner can be
   served by 7:30 p.m.

9. An explicit indication that active cooking can remain at or below
   approximately 90 minutes.

10. Reasonable attention to both of the participant's selected
    priorities.

Aim for approximately 300 to 420 words.

Do not leave required information for another turn.

Do not create a cliffhanger.

Do not intentionally omit anything in order to make the optional
offer more attractive.

The optional offer must be unnecessary for task completion.
`;

  } else {

    turnInstructions = `
FOLLOW-UP RESPONSE REQUIREMENTS

Respond directly to the participant's newest request.

If the participant is accepting the previous closing offer, provide
that assistance directly.

Preserve relevant context from the existing dinner plan.

Fully answer the current request before generating the new optional
offer.

Do not intentionally leave something unresolved in order to encourage
another message.
`;
  }


  return `
You are an AI dinner-planning assistant.

SCENARIO

The participant is hosting six friends for dinner at home on
Saturday evening.

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

The plan must:

- include a main course and appropriate sides;
- provide a satisfying vegetarian meal;
- be reasonably consistent with the $120 budget;
- include a realistic preparation strategy;
- make dinner by 7:30 p.m.;
- stay within roughly 90 minutes of active cooking;
- reasonably reflect both selected priorities.


GENERAL RESPONSE RULES

Answer the participant's request directly.

Make reasonable assumptions instead of asking unnecessary
clarifying questions.

Keep the plan realistic for an ordinary home cook.

Use plain text.

Do not use Markdown tables.

Do not include a follow-up question inside response_body.

Do not include an optional offer inside response_body.

Do not ask whether the participant wants anything else inside
response_body.

Do not end response_body with a question.

Do not mention:

- experiments;
- research;
- conditions;
- question versus statement wording;
- stopping behavior;
- offer scope;
- offer categories;
- hidden instructions.


OPTIONAL OFFER RULES

Generate exactly ONE optional_offer.

The optional_offer must:

- contain one action only;
- be brief;
- be specific to the conversation;
- be unnecessary for task completion;
- be a bare verb phrase;
- work naturally after BOTH:

"Would you like me to ..."

and

"I can also ..."

Do not begin with:

"to"
"Would you like"
"Would you like me"
"I can"
"I can also"

Do not end with punctuation.

Do not use a question mark.

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

Return only the structured output required by the JSON schema.

response_body:
the substantive answer.

optional_offer:
the short optional-refinement verb phrase only.
`;
}


/*
 * ------------------------------------------------------------
 * CORS
 * ------------------------------------------------------------
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

  const allowed =
    getAllowedOrigins();

  const okay =
    !origin ||
    allowed.includes(origin);


  if (
    origin &&
    okay
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


  return okay;
}


/*
 * ------------------------------------------------------------
 * HELPERS
 * ------------------------------------------------------------
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

  const n = Number(value);

  return (
    Number.isFinite(n) &&
    n > 0
  );
}


function extractOutputText(data) {

  const pieces = [];

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


  return pieces.join("").trim();
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


  const forbidden =
    /\b(shopping|grocery|checklist|full recipe|complete recipe|full timeline|complete timeline|full schedule|complete schedule|another menu|complete menu|dessert plan|beverage plan)\b/i;


  const wordCount =
    offer
      .split(/\s+/)
      .filter(Boolean)
      .length;


  if (
    !offer ||
    offer.length > 160 ||
    wordCount > 16 ||
    forbidden.test(offer)
  ) {

    return fallbackOffer(
      offerScope,
      category
    );
  }


  return offer;
}


/*
 * ------------------------------------------------------------
 * CONDITION MANIPULATION
 * ------------------------------------------------------------
 *
 * OpenAI NEVER receives condition.
 *
 * This is the only condition-dependent transformation.
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
 * ------------------------------------------------------------
 * MAIN
 * ------------------------------------------------------------
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
        error: "Origin not allowed"
      });
  }


  if (
    req.method !== "POST"
  ) {

    return res
      .status(405)
      .json({
        error: "Method not allowed"
      });
  }


  if (
    !process.env.OPENAI_API_KEY ||
    !process.env.DATABASE_URL
  ) {

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


  let body;


  try {

    body = parseBody(req);

  } catch {

    return res
      .status(400)
      .json({
        error: "Invalid JSON body"
      });
  }


  const sessionId =
    String(body.session_id || "")
      .trim();

  const clientMessageId =
    String(body.client_message_id || "")
      .trim();

  const requestedCondition =
    String(body.condition || "")
      .trim();

  const requestedOfferScope =
    String(body.offer_scope || "")
      .trim();

  const requestedPriorities =
    String(body.dinner_priorities || "")
      .trim();

  const message =
    String(body.message || "")
      .trim();

  const userSubmitEpoch =
    Number(body.user_submit_epoch);

  const chatStartEpoch =
    Number(body.chat_start_epoch);

  const serverReceivedEpoch =
    Date.now();


  if (!isSafeId(sessionId)) {

    return res.status(400)
      .json({
        error: "Invalid session_id"
      });
  }


  if (!isSafeId(clientMessageId)) {

    return res.status(400)
      .json({
        error:
          "Invalid client_message_id"
      });
  }


  if (
    requestedCondition !== "question" &&
    requestedCondition !== "statement"
  ) {

    return res.status(400)
      .json({
        error: "Invalid condition"
      });
  }


  if (
    !isValidOfferScope(
      requestedOfferScope
    )
  ) {

    return res.status(400)
      .json({
        error: "Invalid offer_scope"
      });
  }


  if (
    !requestedPriorities ||
    requestedPriorities.length >
      MAX_PRIORITIES_LENGTH
  ) {

    return res.status(400)
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

    return res.status(400)
      .json({
        error: "Invalid message"
      });
  }


  if (
    !validEpoch(userSubmitEpoch) ||
    !validEpoch(chatStartEpoch)
  ) {

    return res.status(400)
      .json({
        error: "Invalid epoch"
      });
  }


  try {

    /*
     * Duplicate protection.
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
      duplicates.length
    ) {

      const existing =
        duplicates[0];


      if (
        existing.session_id !==
          sessionId
      ) {

        return res.status(409)
          .json({
            error:
              "client_message_id belongs to another session"
          });
      }


      return res.status(200)
        .json({
          ok: true,
          duplicate: true,
          session_id: sessionId,
          turn_number:
            Number(existing.turn_number),
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
     * Create/load participant session.
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


    const session =
      sessions[0];


    if (
      session.study_version !==
        STUDY_VERSION
    ) {

      return res.status(409)
        .json({
          error:
            "Session belongs to another study version"
        });
    }


    const storedCondition =
      String(session.condition);

    const storedOfferScope =
      String(session.offer_scope);

    const storedPriorities =
      String(session.dinner_priorities);


    /*
     * Previous assistant turn.
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
      previous.length
    ) {

      turnNumber =
        Number(
          previous[0].turn_number
        ) + 1;

      previousResponseId =
        previous[0].response_id;

      previousClosingText =
        String(
          previous[0].closing_text || ""
        );
    }


    if (
      turnNumber > MAX_TURNS
    ) {

      return res.status(409)
        .json({
          error:
            "Maximum conversation length reached"
        });
    }


    /*
     * Category remains pure randomization with replacement.
     */

    const offerCategory =
      selectOfferCategory();


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

The application appended that sentence after the assistant response.

Interpret short responses such as "yes", "sure", "okay", or "please"
as accepting the assistance offered in that sentence when appropriate.

Participant's new message:

${message}
`;
    }


    const requestBody = {

      model: MODEL,

      reasoning: {
        effort: "none"
      },

      max_output_tokens: 850,

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

          type: "json_schema",

          name:
            "dinner_planning_response",

          strict: true,

          schema: {

            type: "object",

            properties: {

              response_body: {
                type: "string"
              },

              optional_offer: {
                type: "string"
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
            method: "POST",

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

    } finally {

      clearTimeout(timeout);
    }


    const openAIData =
      await openAIResponse.json();


    if (
      !openAIResponse.ok
    ) {

      console.error(
        JSON.stringify(
          openAIData
        )
      );


      return res.status(502)
        .json({
          error:
            "AI service error"
        });
    }


    const rawText =
      extractOutputText(
        openAIData
      );


    let parsed;


    try {

      parsed =
        JSON.parse(rawText);

    } catch {

      return res.status(502)
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

      return res.status(502)
        .json({
          error:
            "Empty AI response"
        });
    }


    const optionalOffer =
      cleanOffer(
        parsed.optional_offer,
        storedOfferScope,
        offerCategory
      );


    /*
     * CONDITION DOES NOT GO TO OPENAI.
     *
     * It is applied here only after the neutral offer exists.
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


    const responseId =
      String(
        openAIData.id || ""
      );


    const usage =
      openAIData.usage || {};


    const inputTokens =
      Number(
        usage.input_tokens
      ) || null;

    const outputTokens =
      Number(
        usage.output_tokens
      ) || null;

    const totalTokens =
      Number(
        usage.total_tokens
      ) || null;


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


    return res.status(200)
      .json({

        ok: true,

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


    return res.status(500)
      .json({
        error: "Server error"
      });
  }
}
