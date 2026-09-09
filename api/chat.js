import { neon } from "@neondatabase/serverless";
import { randomInt } from "node:crypto";


/*
 * ============================================================
 * STUDY CONFIGURATION
 * ============================================================
 */

const MODEL =
  "gpt-5.6-luna";

const STUDY_VERSION =
  "dinner_question_statement_confirmatory_v1";

const PROMPT_VERSION =
  "dinner_very_low_ai_performable_v1";

const TASK_UPDATE_VERSION =
  "none";


/*
 * Offer scope is FIXED for every participant.
 *
 * It is not supplied or controlled by Qualtrics.
 */

const OFFER_SCOPE =
  "very_low_micro";


const MAX_TURNS =
  12;

const MAX_MESSAGE_LENGTH =
  1200;

const MAX_PRIORITIES_LENGTH =
  500;

const OPENAI_URL =
  "https://api.openai.com/v1/responses";


/*
 * ============================================================
 * OFFER-CATEGORY RANDOMIZATION
 * ============================================================
 *
 * Category is still independently randomized on every
 * assistant turn WITH REPLACEMENT.
 *
 * Each category has probability .25.
 *
 * Repetition is allowed.
 *
 * Condition plays no role in category selection.
 * ============================================================
 */

const OFFER_CATEGORIES = [
  "reformat",
  "alternative",
  "adjust",
  "elaborate"
];


function selectOfferCategory() {

  const index =
    randomInt(
      OFFER_CATEGORIES.length
    );


  return OFFER_CATEGORIES[
    index
  ];
}


/*
 * ============================================================
 * SAFE FALLBACK OFFERS
 * ============================================================
 *
 * All fallbacks:
 *
 * 1. are very-low-necessity;
 * 2. describe something an AI can do through text;
 * 3. work naturally after both closing stems.
 * ============================================================
 */

function fallbackOffer(
  category
) {

  const offers = {

    reformat:
      "condense one preparation step into a shorter version",

    alternative:
      "suggest one optional garnish variation for a side dish",

    adjust:
      "suggest one small serving-detail adjustment",

    elaborate:
      "describe one small seasoning variation for a side dish"
  };


  return offers[
    category
  ];
}


/*
 * ============================================================
 * FIXED OFFER-SCOPE INSTRUCTION
 * ============================================================
 */

function getScopeInstruction() {

  return `
OFFER SCOPE: VERY-LOW-NECESSITY MICRO-REFINEMENT

Every optional offer must be natural and relevant but peripheral.

The offer should have very little instrumental value for completing
the participant's dinner-planning goal.

The participant should already have everything important needed to
use the dinner plan.

A reasonable participant should be able to think:

"That is a possible refinement, but I do not need it in order to use
the plan."

Appropriate types of offers include:

- condensing one already-understandable preparation step;
- suggesting one optional garnish variation;
- suggesting one minor serving-detail adjustment;
- describing one small seasoning variation;
- clarifying one minor detail that is already sufficiently
  understandable.

The optional offer must NOT solve an important problem.

The optional offer must NOT supply information that is necessary for:

- choosing the meal;
- satisfying the vegetarian guest;
- remaining reasonably within budget;
- knowing when to prepare the meal;
- serving dinner by 7:30 p.m.;
- staying within approximately 90 minutes of active cooking.

Do NOT offer to:

- create a shopping list;
- create a grocery list;
- create a shopping-and-prep checklist;
- create a full checklist;
- provide a full recipe;
- provide a complete cooking timeline;
- provide a complete preparation schedule;
- create another complete menu;
- redesign the meal;
- create another course;
- create a dessert plan;
- create a beverage plan;
- make a major budget change;
- substantially simplify the entire dinner plan;
- provide extensive substitutions.

The participant's current answer must remain fully usable if the
optional offer is ignored.
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

Offer to make a very small presentation or organization change to
ONE limited piece of information that has already been provided.

The AI must perform the action through text.

Good examples:

"condense one preparation step into a shorter version"

"summarize one serving step more briefly"

"rephrase one preparation detail more concisely"

Do not offer to reorganize or summarize the entire dinner plan.
`;
  }


  if (
    category === "alternative"
  ) {

    return `
OFFER CATEGORY: ALTERNATIVE

Offer to SUGGEST or RECOMMEND exactly ONE minor, optional alternative
for ONE existing component.

The existing component must already work well.

The alternative must not solve an important problem.

Good examples:

"suggest one optional garnish variation for the couscous"

"recommend one alternative seasoning for the vegetables"

"suggest one optional herb substitution for a side dish"

Do not offer another menu, another entrée, or another complete plan.
`;
  }


  if (
    category === "adjust"
  ) {

    return `
OFFER CATEGORY: ADJUST

Offer to SUGGEST or RECOMMEND ONE very small adjustment to ONE
limited aspect of the existing plan.

The adjustment must be peripheral rather than necessary.

Good examples:

"suggest one small serving-detail adjustment"

"recommend one minor presentation adjustment for a side dish"

"suggest one small way to vary the garnish"

Do not offer to redesign, substantially simplify, or materially change
the whole dinner plan.
`;
  }


  if (
    category === "elaborate"
  ) {

    return `
OFFER CATEGORY: ELABORATE

Offer to DESCRIBE, EXPLAIN, or CLARIFY a small additional detail
about ONE component that is already adequately explained.

Good examples:

"describe one small seasoning variation for a side dish"

"clarify one minor serving detail for the couscous"

"explain one optional garnish idea for the vegetables"

Do not offer a full recipe, detailed instructions, or extensive
additional information.
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
  dinnerPriorities,
  turnNumber,
  offerCategory
) {

  let turnInstruction;


  if (
    turnNumber === 1
  ) {

    turnInstruction = `
FIRST RESPONSE REQUIREMENTS

This is the participant's FIRST assistant response.

The substantive response must be OBVIOUSLY COMPLETE and
SELF-CONTAINED.

A reasonable participant should be able to stop immediately after
this response and still have a usable dinner plan that satisfies the
assigned task.

Do NOT leave a required task element unresolved for a later turn.

response_body must include ALL of the following:

1. ONE clearly recommended dinner plan.

2. A clearly identified main course.

3. Appropriate sides.

4. A satisfying vegetarian meal for the vegetarian guest.

   The vegetarian guest must receive a substantial meal, not merely
   a small side dish or the meat removed from another dish.

5. Approximate budget information.

   Give enough cost information to make it clear that the complete
   food plan is reasonably consistent with the $120 total food
   budget.

   Include an approximate overall total or range.

6. A concrete preparation strategy.

   Make clear what should be done earlier versus closer to serving.

7. A realistic timing plan.

   Make it clear how dinner can be served by 7:30 p.m.

8. An approximate active-cooking-time assessment.

   Make clear that the plan can be executed without more than about
   90 minutes of active cooking.

9. Reasonable attention to BOTH priorities selected by the
   participant.

Aim for approximately 300 to 420 words.

Completeness is more important than brevity.

The answer should nevertheless remain focused rather than exhaustive.

Do NOT intentionally omit information in order to create a reason for
the participant to continue.

Do NOT end response_body at a cliffhanger.

Do NOT say that the participant needs another response in order to
complete the plan.

Do NOT make optional_offer necessary to understand or execute the
plan.

The randomly selected offer category applies ONLY to optional_offer.

response_body must already satisfy the dinner-planning task before
optional_offer is considered.
`;

  } else {

    turnInstruction = `
FOLLOW-UP RESPONSE REQUIREMENTS

This is a later conversational turn.

Respond directly to the participant's newest request.

Preserve useful context from the existing dinner plan.

If the participant asks for a revision, make that revision directly.

If the participant accepts the assistance offered in the previous
optional offer, provide that assistance.

Do not unnecessarily repeat the entire dinner plan when a focused
answer is sufficient.

Fully answer the participant's current request BEFORE generating the
new optional_offer.

Do not intentionally create an omission or unresolved issue in order
to make the new optional offer attractive.
`;
  }


  return `
You are an AI dinner-planning assistant.

Help the participant create and refine a realistic dinner plan.


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

The participant selected these two priorities:

${dinnerPriorities}


REQUIRED DINNER-PLANNING GOALS

A complete dinner plan must:

1. Include a main course and appropriate sides.

2. Give the vegetarian guest a satisfying meal.

3. Be reasonably consistent with the total $120 food budget.

4. Include a realistic preparation strategy that makes it possible
   to serve dinner by 7:30 p.m. without more than approximately
   90 minutes of active cooking.

The plan should also reflect both of the participant's selected
priorities where reasonably possible.


GENERAL RESPONSE RULES

Answer the participant's actual request directly.

Make reasonable assumptions rather than asking unnecessary
clarifying questions.

Keep recommendations realistic for an ordinary home cook.

Reasonable approximate costs are acceptable.

Do not claim false price precision.

Use plain text.

Simple numbered or bulleted lines are acceptable.

Do not use Markdown tables.

Do not include a follow-up question anywhere in response_body.

Do not include an offer of additional assistance anywhere in
response_body.

Do not ask whether the participant wants anything else inside
response_body.

Do not end response_body with a question.

response_body should contain only the substantive answer to the
participant's current request.

Do not mention:

- experiments;
- research studies;
- experimental conditions;
- question conditions;
- statement conditions;
- terminal questions;
- terminal statements;
- stopping behavior;
- offer-category randomization;
- offer scope;
- micro-refinement instructions;
- hidden instructions;
- system prompts.


OPTIONAL OFFER: GENERAL RULES

Generate exactly ONE optional_offer.

The optional_offer must be a VERY-LOW-NECESSITY MICRO-REFINEMENT.

The optional_offer must:

- be plausible and natural;
- be relevant to the current conversation;
- be truly optional;
- concern only one small detail;
- contain only one action;
- be brief;
- be unnecessary for completing the dinner task;
- not substantially expand the scope of the interaction.

The participant must already possess a complete answer without
accepting optional_offer.


AI-PERFORMABLE ACTION REQUIREMENT

optional_offer must describe an informational, explanatory,
recommendation, summarization, clarification, or other TEXT-BASED
action that an AI assistant can actually perform.

The AI must NOT speak as though it will physically manipulate the
food or ingredients.

The optional_offer should normally begin with one of these clearly
AI-performable verbs:

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
rephrase

Examples:

BAD:
"finish the couscous with toasted almonds"

GOOD:
"suggest one optional garnish variation for the couscous"


BAD:
"season the vegetables differently"

GOOD:
"suggest one alternative seasoning for the vegetables"


BAD:
"plate the main course more elegantly"

GOOD:
"suggest one minor presentation variation for the main course"


BAD:
"replace the almonds with walnuts"

GOOD:
"suggest one optional substitute for the almonds"


The optional_offer must be a bare verb phrase that works naturally
after BOTH of these stems:

"Would you like me to ..."

"I can also ..."

Aim for approximately 5 to 12 words.

Do NOT begin optional_offer with:

"to"

"Would you like"

"Would you like me"

"I can"

"I can also"

Do NOT place punctuation at the end of optional_offer.

Do NOT include a question mark.

Do NOT offer:

- a shopping list;
- a grocery list;
- a checklist;
- a shopping-and-prep checklist;
- a complete cooking timeline;
- a complete preparation schedule;
- a full recipe;
- another complete menu;
- another entrée;
- another course;
- a dessert plan;
- a beverage plan;
- extensive substitutions;
- extensive customization.


${getScopeInstruction()}


${getCategoryInstruction(
  offerCategory
)}


${turnInstruction}


OUTPUT REQUIREMENT

Return only the structured output required by the supplied JSON
schema.

response_body must contain the complete substantive response.

optional_offer must contain only the short, AI-performable,
very-low-necessity verb phrase.
`;
}


/*
 * ============================================================
 * CORS
 * ============================================================
 */

function normalizeOrigin(
  origin
) {

  return String(
    origin || ""
  )
    .trim()
    .replace(
      /\/+$/,
      ""
    );
}


function getAllowedOrigins() {

  return String(
    process.env.ALLOWED_ORIGINS || ""
  )
    .split(",")
    .map(
      normalizeOrigin
    )
    .filter(
      Boolean
    );
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
    allowedOrigins.includes(
      origin
    );


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

function parseRequestBody(
  req
) {

  if (
    req.body &&
    typeof req.body === "object"
  ) {

    return req.body;
  }


  if (
    typeof req.body === "string"
  ) {

    return JSON.parse(
      req.body
    );
  }


  return {};
}


function isSafeId(
  value
) {

  if (
    typeof value !== "string" ||
    !value.trim() ||
    value.length > 200
  ) {

    return false;
  }


  return /^[A-Za-z0-9._:-]+$/.test(
    value.trim()
  );
}


function isValidEpoch(
  value
) {

  const number =
    Number(
      value
    );


  return (
    Number.isFinite(
      number
    ) &&
    number > 0
  );
}


/*
 * ============================================================
 * OPENAI OUTPUT EXTRACTION
 * ============================================================
 */

function extractOutputText(
  responseData
) {

  const pieces =
    [];


  if (
    !responseData ||
    !Array.isArray(
      responseData.output
    )
  ) {

    return "";
  }


  for (
    const item of responseData.output
  ) {

    if (
      !item ||
      item.type !== "message" ||
      !Array.isArray(
        item.content
      )
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

        pieces.push(
          content.text
        );
      }
    }
  }


  return pieces
    .join("")
    .trim();
}


/*
 * ============================================================
 * OPTIONAL-OFFER SERVER VALIDATION
 * ============================================================
 *
 * This is a second protection layer in addition to the prompt.
 *
 * If the model produces a physically performed or overly broad
 * offer, Vercel replaces it with the category-matched fallback.
 * ============================================================
 */

function beginsWithAIPerformableVerb(
  offer
) {

  return /^(suggest|recommend|explain|clarify|outline|summarize|condense|compare|identify|describe|rephrase)\b/i
    .test(
      offer
    );
}


function cleanOptionalOffer(
  rawValue,
  offerCategory
) {

  let offer =
    String(
      rawValue || ""
    )
      .replace(
        /\s+/g,
        " "
      )
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
   * High-scope content that is never permitted.
   */

  const forbiddenScopePattern =
    /\b(shopping list|grocery list|shopping checklist|prep checklist|full checklist|full recipe|complete recipe|full timeline|complete timeline|full schedule|complete schedule|another menu|complete menu|dessert plan|beverage plan|drink pairing)\b/i;


  /*
   * Physical-action openings that should never appear.
   */

  const physicalActionStartPattern =
    /^(finish|cook|prepare|garnish|season|chop|slice|dice|plate|serve|bake|roast|fry|boil|sauté|saute|mix|stir|assemble|shop|buy|toast|grill|replace|swap)\b/i;


  const words =
    offer
      .split(
        /\s+/
      )
      .filter(
        Boolean
      );


  const wordCount =
    words.length;


  const invalid =
    !offer ||
    offer.length > 160 ||
    wordCount > 16 ||
    forbiddenScopePattern.test(
      offer
    ) ||
    physicalActionStartPattern.test(
      offer
    ) ||
    !beginsWithAIPerformableVerb(
      offer
    );


  if (
    invalid
  ) {

    return fallbackOffer(
      offerCategory
    );
  }


  return offer;
}


/*
 * ============================================================
 * EXPERIMENTAL MANIPULATION
 * ============================================================
 *
 * This is the ONLY place where condition changes participant-facing
 * output.
 *
 * The model has already generated the same neutral optional_offer
 * before this function is called.
 * ============================================================
 */

function makeClosing(
  condition,
  optionalOffer
) {

  if (
    condition === "question"
  ) {

    return (
      "Would you like me to " +
      optionalOffer +
      "?"
    );
  }


  return (
    "I can also " +
    optionalOffer +
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

  /*
   * ----------------------------------------------------------
   * CORS
   * ----------------------------------------------------------
   */

  const originAllowed =
    applyCors(
      req,
      res
    );


  if (
    req.method === "OPTIONS"
  ) {

    if (
      !originAllowed
    ) {

      return res
        .status(403)
        .end();
    }


    return res
      .status(204)
      .end();
  }


  if (
    !originAllowed
  ) {

    return res
      .status(403)
      .json({
        error:
          "Origin not allowed"
      });
  }


  /*
   * ----------------------------------------------------------
   * Method
   * ----------------------------------------------------------
   */

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


  /*
   * ----------------------------------------------------------
   * Environment
   * ----------------------------------------------------------
   */

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
      parseRequestBody(
        req
      );

  } catch (error) {

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
    !isSafeId(
      sessionId
    )
  ) {

    return res
      .status(400)
      .json({
        error:
          "Invalid session_id"
      });
  }


  if (
    !isSafeId(
      clientMessageId
    )
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
    !message
  ) {

    return res
      .status(400)
      .json({
        error:
          "Message cannot be empty"
      });
  }


  if (
    message.length >
      MAX_MESSAGE_LENGTH
  ) {

    return res
      .status(400)
      .json({
        error:
          "Message is too long"
      });
  }


  if (
    !isValidEpoch(
      userSubmitEpoch
    ) ||
    !isValidEpoch(
      chatStartEpoch
    )
  ) {

    return res
      .status(400)
      .json({
        error:
          "Invalid epoch value"
      });
  }


  try {

    /*
     * --------------------------------------------------------
     * DUPLICATE MESSAGE PROTECTION
     * --------------------------------------------------------
     */

    const duplicateRows =
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
      duplicateRows.length > 0
    ) {

      const duplicate =
        duplicateRows[0];


      if (
        duplicate.session_id !==
          sessionId
      ) {

        return res
          .status(409)
          .json({
            error:
              "client_message_id already belongs to another session"
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
              duplicate.turn_number
            ),

          response_id:
            duplicate.response_id,

          assistant_text:
            duplicate.assistant_text,

          offer_scope:
            duplicate.offer_scope,

          offer_category:
            duplicate.offer_category,

          optional_offer:
            duplicate.optional_offer,

          closing_text:
            duplicate.closing_text
        });
    }


    /*
     * --------------------------------------------------------
     * CREATE OR LOAD SESSION
     * --------------------------------------------------------
     */

    let sessionRows =
      await sql`
        SELECT
          session_id,
          condition,
          offer_scope,
          dinner_priorities,
          model_requested,
          prompt_version,
          study_version,
          task_update_version
        FROM ai_sessions
        WHERE session_id =
          ${sessionId}
        LIMIT 1
      `;


    if (
      sessionRows.length === 0
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
          ${OFFER_SCOPE},
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


      sessionRows =
        await sql`
          SELECT
            session_id,
            condition,
            offer_scope,
            dinner_priorities,
            model_requested,
            prompt_version,
            study_version,
            task_update_version
          FROM ai_sessions
          WHERE session_id =
            ${sessionId}
          LIMIT 1
        `;
    }


    if (
      sessionRows.length === 0
    ) {

      throw new Error(
        "Session could not be created."
      );
    }


    const session =
      sessionRows[0];


    /*
     * Prevent accidental reuse of a session from an older study.
     */

    if (
      session.study_version !==
        STUDY_VERSION
    ) {

      return res
        .status(409)
        .json({
          error:
            "Session ID belongs to a different study version"
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
      storedOfferScope !==
        OFFER_SCOPE
    ) {

      throw new Error(
        "Stored offer scope does not match this study."
      );
    }


    if (
      !storedPriorities
    ) {

      throw new Error(
        "Stored dinner priorities are missing."
      );
    }


    /*
     * --------------------------------------------------------
     * PREVIOUS TURN
     * --------------------------------------------------------
     *
     * IMPORTANT:
     *
     * We retrieve only the previous NEUTRAL optional offer.
     *
     * We do NOT send the previous question/statement closing to
     * OpenAI. This keeps the model blind to experimental condition.
     * --------------------------------------------------------
     */

    const previousRows =
      await sql`
        SELECT
          turn_number,
          response_id,
          optional_offer
        FROM ai_turns
        WHERE session_id =
          ${sessionId}
        ORDER BY turn_number DESC
        LIMIT 1
      `;


    let turnNumber =
      1;


    let previousResponseId =
      null;


    let previousOptionalOffer =
      "";


    if (
      previousRows.length > 0
    ) {

      const previous =
        previousRows[0];


      turnNumber =
        Number(
          previous.turn_number
        ) + 1;


      previousResponseId =
        previous.response_id ||
        null;


      previousOptionalOffer =
        String(
          previous.optional_offer || ""
        ).trim();
    }


    if (
      turnNumber >
        MAX_TURNS
    ) {

      return res
        .status(409)
        .json({
          error:
            "Maximum conversation length reached"
        });
    }


    if (
      turnNumber > 1 &&
      !previousResponseId
    ) {

      throw new Error(
        "Previous response ID is missing."
      );
    }


    /*
     * --------------------------------------------------------
     * RANDOMIZE OFFER CATEGORY
     * --------------------------------------------------------
     */

    const offerCategory =
      selectOfferCategory();


    /*
     * --------------------------------------------------------
     * MODEL INPUT
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
After the previous substantive assistant response, the application
displayed an optional continuation offer corresponding to this
neutral action:

"${previousOptionalOffer}"

The exact grammatical form of that application-generated closing is
not relevant to your response and is intentionally not provided.

Interpret the participant's new message in that conversational
context.

If the participant gives a short acceptance such as "yes", "sure",
"okay", "please", or similar language, interpret it as accepting the
optional assistance described above when appropriate.

The participant's new message is:

${message}
`;
    }


    /*
     * --------------------------------------------------------
     * OPENAI REQUEST
     * --------------------------------------------------------
     *
     * Experimental condition is deliberately NOT supplied.
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
          String(
            turnNumber
          ),

        offer_scope:
          OFFER_SCOPE,

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
     * CALL OPENAI
     * --------------------------------------------------------
     */

    const controller =
      new AbortController();


    const timeout =
      setTimeout(
        function () {

          controller.abort();

        },
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

        console.error(
          "OpenAI request timed out."
        );


        return res
          .status(504)
          .json({
            error:
              "AI request timed out"
          });
      }


      throw error;

    } finally {

      clearTimeout(
        timeout
      );
    }


    /*
     * --------------------------------------------------------
     * PARSE OPENAI RESPONSE
     * --------------------------------------------------------
     */

    let openAIData;


    try {

      openAIData =
        await openAIResponse.json();

    } catch (error) {

      console.error(
        "OpenAI returned non-JSON response."
      );


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
        JSON.stringify(
          openAIData
        )
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
      openAIData.status !==
        "completed"
    ) {

      console.error(
        "OpenAI response status:",
        openAIData.status
      );


      return res
        .status(502)
        .json({
          error:
            "AI response was incomplete"
        });
    }


    const rawOutputText =
      extractOutputText(
        openAIData
      );


    if (
      !rawOutputText
    ) {

      console.error(
        "No output_text found."
      );


      return res
        .status(502)
        .json({
          error:
            "AI returned no response text"
        });
    }


    /*
     * --------------------------------------------------------
     * PARSE STRUCTURED OUTPUT
     * --------------------------------------------------------
     */

    let parsedOutput;


    try {

      parsedOutput =
        JSON.parse(
          rawOutputText
        );

    } catch (error) {

      console.error(
        "Structured output JSON parsing failed:",
        rawOutputText
      );


      return res
        .status(502)
        .json({
          error:
            "AI returned invalid structured output"
        });
    }


    const responseBody =
      String(
        parsedOutput.response_body ||
        ""
      ).trim();


    if (
      !responseBody
    ) {

      return res
        .status(502)
        .json({
          error:
            "AI returned an empty response"
        });
    }


    /*
     * --------------------------------------------------------
     * VALIDATE NEUTRAL OPTIONAL OFFER
     * --------------------------------------------------------
     */

    const optionalOffer =
      cleanOptionalOffer(
        parsedOutput.optional_offer,
        offerCategory
      );


    /*
     * --------------------------------------------------------
     * APPLY EXPERIMENTAL CONDITION
     * --------------------------------------------------------
     *
     * The same neutral optionalOffer is transformed only here.
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


    const serverResponseEpoch =
      Date.now();


    /*
     * --------------------------------------------------------
     * TOKEN USAGE
     * --------------------------------------------------------
     */

    const usage =
      openAIData.usage || {};


    const inputTokens =
      Number.isFinite(
        Number(
          usage.input_tokens
        )
      )
        ? Number(
            usage.input_tokens
          )
        : null;


    const outputTokens =
      Number.isFinite(
        Number(
          usage.output_tokens
        )
      )
        ? Number(
            usage.output_tokens
          )
        : null;


    const totalTokens =
      Number.isFinite(
        Number(
          usage.total_tokens
        )
      )
        ? Number(
            usage.total_tokens
          )
        : null;


    const phase =
      turnNumber === 1
        ? "initial"
        : "followup";


    const responseId =
      String(
        openAIData.id || ""
      ).trim();


    if (
      !responseId
    ) {

      throw new Error(
        "OpenAI response ID is missing."
      );
    }


    const modelReturned =
      String(
        openAIData.model ||
        MODEL
      );


    /*
     * --------------------------------------------------------
     * SAVE TURN TO NEON
     * --------------------------------------------------------
     */

    try {

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
          ${OFFER_SCOPE},
          ${message},
          ${userSubmitEpoch},
          ${serverReceivedEpoch},
          ${previousResponseId},
          ${responseId},
          ${MODEL},
          ${modelReturned},
          ${assistantText},
          ${serverResponseEpoch},
          ${inputTokens},
          ${outputTokens},
          ${totalTokens},
          ${phase},
          ${false},
          ${offerCategory},
          ${optionalOffer},
          ${closingText}
        )
      `;

    } catch (insertError) {

      /*
       * Race-condition duplicate protection.
       */

      const raceDuplicateRows =
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
        raceDuplicateRows.length > 0 &&
        raceDuplicateRows[0].session_id ===
          sessionId
      ) {

        const existing =
          raceDuplicateRows[0];


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


      throw insertError;
    }


    /*
     * --------------------------------------------------------
     * UPDATE SESSION TIMESTAMP
     * --------------------------------------------------------
     */

    await sql`
      UPDATE ai_sessions
      SET
        updated_at =
          NOW()
      WHERE session_id =
        ${sessionId}
    `;


    /*
     * --------------------------------------------------------
     * RETURN RESPONSE TO QUALTRICS
     * --------------------------------------------------------
     */

    return res
      .status(200)
      .json({

        ok:
          true,

        duplicate:
          false,

        session_id:
          sessionId,

        turn_number:
          turnNumber,

        response_id:
          responseId,

        assistant_text:
          assistantText,

        offer_scope:
          OFFER_SCOPE,

        offer_category:
          offerCategory,

        optional_offer:
          optionalOffer,

        closing_text:
          closingText,

        model:
          modelReturned,

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
