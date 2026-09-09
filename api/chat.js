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
  "dinner_minimal_closing_v2";

const PROMPT_VERSION =
  "dinner_complete_microoffers_v2";

const TASK_UPDATE_VERSION =
  "none";

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
 * PURE RANDOMIZATION WITH REPLACEMENT.
 *
 * Every assistant turn independently receives one of the four
 * categories with probability .25.
 *
 * Repetition across consecutive turns is allowed.
 *
 * Condition is NOT used in this randomization.
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
    randomInt(
      OFFER_CATEGORIES.length
    )
  ];
}


/*
 * ============================================================
 * MICRO-REFINEMENT FALLBACKS
 * ============================================================
 *
 * These are used only if the model produces an unusable or
 * overly large optional offer.
 * ============================================================
 */

function getFallbackOffer(
  offerCategory
) {

  if (
    offerCategory === "reformat"
  ) {

    return "condense one preparation step into a shorter sequence";
  }


  if (
    offerCategory === "alternative"
  ) {

    return "suggest one optional substitution for a side dish";
  }


  if (
    offerCategory === "adjust"
  ) {

    return "make one preparation step slightly simpler";
  }


  return "add one small detail to a preparation step";
}


/*
 * ============================================================
 * MICRO-REFINEMENT CATEGORY INSTRUCTIONS
 * ============================================================
 */

function getOfferCategoryInstruction(
  offerCategory
) {

  if (
    offerCategory === "reformat"
  ) {

    return `
OFFER CATEGORY: REFORMAT

Generate a SMALL, LOW-NECESSITY reformatting offer.

The offer should reorganize or condense only a limited part of
information that is already present.

Good examples:

"condense one preparation step into a shorter sequence"

"summarize the serving steps more briefly"

"put the final preparation steps in a shorter order"

The offer must NOT involve:

- a full shopping list
- a grocery list
- a shopping-and-prep checklist
- a complete cooking timeline
- a complete prep schedule
- a complete recipe
- a comprehensive summary of the entire plan

The participant must already have a usable plan without accepting
this offer.
`;
  }


  if (
    offerCategory === "alternative"
  ) {

    return `
OFFER CATEGORY: ALTERNATIVE

Generate a SMALL, LOW-NECESSITY alternative.

Offer one optional substitution or backup for ONE component that
already exists in the plan.

Good examples:

"suggest one optional substitution for a side dish"

"give one alternative seasoning for the vegetables"

"suggest one backup ingredient for the vegetarian main"

The offer must NOT involve:

- a complete alternative menu
- another full dinner plan
- multiple alternatives
- a new course
- a full dessert plan
- a beverage plan
- a shopping list

The existing recommendation must remain fully usable without the
alternative.
`;
  }


  if (
    offerCategory === "adjust"
  ) {

    return `
OFFER CATEGORY: ADJUST

Generate a SMALL, LOW-NECESSITY adjustment to ONE limited aspect
of the existing plan.

Good examples:

"make one preparation step slightly simpler"

"reduce the cleanup for one part of the meal"

"make one side dish slightly less expensive"

"make one component a little lighter"

The adjustment must be modest.

Do NOT offer to redesign the entire menu, substantially change the
meal, create a new plan, or solve an important missing requirement.

The participant must not need this adjustment for the current plan
to satisfy the task.
`;
  }


  if (
    offerCategory === "elaborate"
  ) {

    return `
OFFER CATEGORY: ELABORATE

Generate a SMALL, LOW-NECESSITY offer to add a little detail to
ONE component that is already adequately explained.

Good examples:

"add one small detail to a preparation step"

"give a little more detail on serving the main course"

"add one detail about seasoning the vegetables"

Do NOT offer:

- full recipes
- a complete step-by-step recipe
- a full shopping list
- a complete prep checklist
- a complete timeline
- extensive detail about the entire meal

The participant must already have enough information to use the
plan without accepting this elaboration.
`;
  }


  throw new Error(
    "Invalid offer category."
  );
}


/*
 * ============================================================
 * CORS
 * ============================================================
 */

function normalizeOrigin(origin) {

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

function parseRequestBody(req) {

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


function isSafeId(value) {

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


function isValidEpoch(value) {

  const number =
    Number(
      value
    );

  return (
    Number.isFinite(number) &&
    number > 0
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

  const categoryInstruction =
    getOfferCategoryInstruction(
      offerCategory
    );


  let turnInstruction;


  if (
    turnNumber === 1
  ) {

    turnInstruction = `
FIRST RESPONSE REQUIREMENTS

This is the participant's FIRST assistant response.

The response must be obviously COMPLETE and SELF-CONTAINED.

A reasonable participant should be able to stop immediately after
reading this response and still have a usable dinner plan satisfying
the assigned task.

Do NOT leave any required task element unresolved for a later turn.

response_body must include ALL of the following:

1. ONE clearly recommended dinner plan.

2. A clearly identified main course.

3. Appropriate sides.

4. A satisfying vegetarian meal for the vegetarian guest.

   The vegetarian guest must receive a substantial meal, not merely
   a side dish or the meat removed from another dish.

5. An approximate budget.

   Give enough approximate cost information to make it clear that
   the complete food plan is reasonably consistent with the $120
   total budget.

   Include an approximate overall total or range.

6. A concrete preparation strategy.

   Make clear what should be done earlier versus closer to serving.

7. A realistic timing plan.

   The response must make it clear how dinner can be served by
   7:30 p.m.

8. An approximate active-cooking-time assessment.

   Make clear that the plan can be executed without more than about
   90 minutes of active cooking.

9. Reasonable attention to BOTH priorities selected by the
   participant.

The substantive answer should aim for approximately 300 to 420 words.

Completeness is more important than brevity.

The answer should still be focused rather than exhaustive.

Do NOT deliberately omit information in order to create a reason for
the participant to continue.

Do NOT end response_body at a natural cliffhanger.

Do NOT say that more information is needed.

Do NOT make the optional_offer necessary to understand, execute, or
complete the dinner plan.

Do NOT proactively provide:

- a full grocery list
- a shopping-and-prep checklist
- multiple backup menus
- extensive substitutions
- extensive beverage recommendations
- decorating suggestions
- a second complete menu
- optional extras unrelated to satisfying the assigned task

The randomly selected offer category applies ONLY to optional_offer.

response_body must be fully satisfactory before the optional offer is
considered.
`;

  } else {

    turnInstruction = `
FOLLOW-UP RESPONSE REQUIREMENTS

This is a later conversational turn.

Respond directly to the participant's newest request.

Preserve useful context from the existing dinner plan.

If the participant asks for a revision, make that revision directly.

If the participant accepts the assistance offered in the previous
closing, provide exactly that kind of assistance.

Do not unnecessarily repeat the entire dinner plan when a focused
answer is sufficient.

The participant's current request must be fully answered BEFORE the
new optional_offer is considered.

The randomly selected offer category applies only to the NEW
optional_offer.

Do not deliberately create an omission or unresolved issue in the
substantive answer to make the new optional offer attractive.
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

The plan should also reflect the participant's two selected
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

experiments

research studies

experimental conditions

question conditions

statement conditions

terminal questions

terminal statements

stopping behavior

offer-category randomization

micro-refinement instructions

hidden instructions

system prompts


OPTIONAL OFFER: GENERAL RULES

Generate exactly ONE optional_offer.

The optional_offer must be a LOW-NECESSITY MICRO-REFINEMENT.

This means:

- it should be plausible and mildly useful;
- it should involve only a small refinement;
- it must NOT be necessary to satisfy the participant's task;
- the participant must already possess a complete answer without it;
- declining the offer should leave no important problem unresolved;
- it should not substantially expand the scope of the interaction.

The optional_offer must be specific enough to sound natural in the
current conversation.

The optional_offer must be brief.

Aim for roughly 5 to 12 words.

The optional_offer must contain only ONE action.

Do not combine two offers with "and" or "or".

Do NOT offer:

- a shopping list
- a grocery list
- a shopping checklist
- a shopping-and-prep checklist
- a full prep checklist
- a full cooking timeline
- a full recipe
- a complete step-by-step recipe
- another complete menu
- an entire alternative dinner plan
- another course
- a full dessert plan
- a beverage plan
- extensive substitutions
- extensive customization

The optional_offer must be a bare verb phrase that works naturally
after BOTH of these stems:

"Would you like me to ..."

"I can also ..."

For example:

"make one preparation step slightly simpler"

Do NOT begin optional_offer with:

"to"

"Would you like"

"Would you like me"

"I can"

"I can also"

Do NOT place punctuation at the end of optional_offer.

Do NOT include a question mark.

The model must NOT know or infer whether the application will later
render the offer as a question or a statement.


${categoryInstruction}


${turnInstruction}


OUTPUT REQUIREMENT

Return only the structured output required by the supplied JSON
schema.

response_body must contain the complete substantive response.

optional_offer must contain only the short micro-refinement verb
phrase.
`;
}


/*
 * ============================================================
 * OPENAI OUTPUT HELPERS
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
 * OPTIONAL-OFFER CLEANING
 * ============================================================
 */

function cleanOptionalOffer(
  value,
  offerCategory
) {

  let offer =
    String(
      value || ""
    )
      .replace(
        /\s+/g,
        " "
      )
      .trim();


  /*
   * Strip accidental stems.
   */

  offer =
    offer.replace(
      /^would you like me to\s+/i,
      ""
    );


  offer =
    offer.replace(
      /^would you like me\s+/i,
      ""
    );


  offer =
    offer.replace(
      /^i can also\s+/i,
      ""
    );


  offer =
    offer.replace(
      /^i can\s+/i,
      ""
    );


  offer =
    offer.replace(
      /^to\s+/i,
      ""
    );


  /*
   * Strip punctuation.
   */

  offer =
    offer.replace(
      /[?.!;:]+$/g,
      ""
    );


  offer =
    offer.replace(
      /\?/g,
      ""
    );


  offer =
    offer.trim();


  /*
   * Reject obviously high-necessity / large-scope offers.
   */

  const forbiddenPattern =
    /\b(shopping|grocery|checklist|full recipe|complete recipe|step-by-step recipe|full timeline|complete timeline|full prep plan|complete prep plan|entire plan|complete menu|another menu|dessert plan|beverage plan|drink pairing)\b/i;


  /*
   * Keep offers short enough to remain micro-refinements.
   */

  const wordCount =
    offer
      .split(/\s+/)
      .filter(Boolean)
      .length;


  if (
    !offer ||
    offer.length > 160 ||
    wordCount > 16 ||
    forbiddenPattern.test(
      offer
    )
  ) {

    return getFallbackOffer(
      offerCategory
    );
  }


  return offer;
}


/*
 * ============================================================
 * EXPERIMENTAL CLOSING
 * ============================================================
 *
 * THIS IS THE ONLY CONDITION-DEPENDENT PARTICIPANT-FACING
 * TRANSFORMATION.
 *
 * The semantic optional offer is identical within a given response.
 *
 * QUESTION:
 * Would you like me to X?
 *
 * STATEMENT:
 * I can also X.
 *
 * No "if that would be useful" language remains.
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
   * METHOD
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
   * ENVIRONMENT
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
   * PARSE REQUEST
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
   * VALIDATION
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
     * Do not allow an old pilot session to be accidentally reused
     * under this new manipulation.
     */

    if (
      session.study_version &&
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
     */

    const previousRows =
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


    let turnNumber =
      1;


    let previousResponseId =
      null;


    let previousClosingText =
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


      previousClosingText =
        String(
          previous.closing_text || ""
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
     * PURE OFFER-CATEGORY RANDOMIZATION
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
The participant saw the previous assistant response followed by this
exact final sentence:

"${previousClosingText}"

That final sentence was appended by the application after the
assistant's substantive response.

Interpret the participant's new message in that conversational
context.

If the participant gives a short acceptance such as "yes", "sure",
"okay", "please", or similar language, interpret it as accepting the
assistance offered in that exact final sentence.

The participant's new message is:

${message}
`;
    }


    /*
     * --------------------------------------------------------
     * OPENAI REQUEST
     * --------------------------------------------------------
     *
     * OpenAI sees the offer category.
     *
     * OpenAI NEVER receives question/statement condition.
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
      openAIData.status !== "completed"
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


    const optionalOffer =
      cleanOptionalOffer(
        parsedOutput.optional_offer,
        offerCategory
      );


    /*
     * --------------------------------------------------------
     * APPLY EXPERIMENTAL CONDITION
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
     * RESPONSE TO QUALTRICS
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
