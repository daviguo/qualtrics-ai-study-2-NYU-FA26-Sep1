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
  "dinner_category_randomized_v1";

const PROMPT_VERSION =
  "dinner_offer_categories_v1";

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
 * Every assistant turn independently receives one of these
 * four categories with probability 1/4.
 *
 * The previous category is NOT considered.
 *
 * The experimental condition is NOT considered.
 *
 * Therefore consecutive repetitions are allowed.
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

  return OFFER_CATEGORIES[index];
}


/*
 * ============================================================
 * OFFER-CATEGORY INSTRUCTIONS
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

The optional_offer must offer to reorganize, condense, or present
information that is already contained in the current answer in a
different useful format.

It should NOT introduce a new substantive planning objective.

Appropriate examples include:

condense the plan into a simple timeline

organize the main steps into a shorter sequence

summarize the plan into an easy-to-scan format

Do not offer a full grocery list or a full shopping-and-prep
checklist.
`;
  }


  if (
    offerCategory === "alternative"
  ) {

    return `
OFFER CATEGORY: ALTERNATIVE

The optional_offer must offer one backup, substitution, or alternative
for an existing component of the dinner plan.

The alternative must be optional. The current plan should already be
usable without it.

Appropriate examples include:

suggest one backup side dish

give you an alternative vegetarian main

suggest a substitute for the dessert

Do not imply that the existing plan is unusable or incomplete.
`;
  }


  if (
    offerCategory === "adjust"
  ) {

    return `
OFFER CATEGORY: ADJUST

The optional_offer must offer to modify one parameter of the existing
plan.

Examples of parameters include:

cost

complexity

cleanup

active cooking time

style

healthfulness

how impressive the meal feels

how casual the meal feels

Appropriate examples include:

make the menu a little easier to prepare

reduce the amount of cleanup

make the meal slightly less expensive

The proposed adjustment must be optional rather than necessary for
task completion.
`;
  }


  if (
    offerCategory === "elaborate"
  ) {

    return `
OFFER CATEGORY: ELABORATE

The optional_offer must offer additional detail about ONE component
that is already present in the current answer.

Appropriate examples include:

add more detail to the vegetarian main

explain the make-ahead step in more detail

add more detail to the serving plan

Do not offer a completely new planning task.

Do not offer a full grocery list or a full shopping-and-prep
checklist.
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

This is the first assistant response in the conversation.

Provide one coherent and substantively complete dinner plan.

The participant should have enough information after this response
to use the dinner plan without needing another message.

The response should clearly satisfy all four required planning goals.

Give one recommended plan rather than a long menu of interchangeable
alternatives.

Aim for approximately 250 to 350 words in response_body.

The response should be COMPLETE but not EXHAUSTIVE.

Do not intentionally omit information required to satisfy the task.

At the same time, do not proactively provide every possible optional
extension or refinement.

Do not provide:

- a full grocery list;
- a full shopping-and-prep checklist;
- multiple backup menus;
- extensive beverage recommendations;
- decorating advice;
- numerous alternative meals;
- numerous optional substitutions.

The selected offer category applies ONLY to optional_offer.

Do not alter, weaken, or strategically withhold information from
response_body to make the optional_offer more attractive.
`;

  } else {

    turnInstruction = `
FOLLOW-UP RESPONSE REQUIREMENTS

This is a later conversational turn.

Respond directly to the participant's newest request.

Use the existing dinner plan and earlier conversation as context.

Revise the existing plan where appropriate.

Do not unnecessarily repeat the entire dinner plan if a focused
answer or targeted revision adequately addresses the participant's
request.

If the participant is accepting the assistance offered in the
previous closing, provide that assistance directly.

The selected offer category applies ONLY to the NEW optional_offer
at the end of this response.

Do not distort the substantive response to create a reason for the
new optional offer.
`;
  }


  return `
You are an AI dinner-planning assistant.

Your task is to help the participant create and refine a realistic
dinner plan.


SCENARIO

The participant is hosting six friends for dinner at home on
Saturday evening.

Plan food for seven people total:
the participant plus six guests.

One of the six guests is vegetarian.

The total food budget is $120.

Dinner should be ready by 7:30 p.m.

The participant does not want to spend more than approximately
90 minutes actively cooking.

The participant selected these two priorities:

${dinnerPriorities}


REQUIRED DINNER-PLANNING GOALS

A satisfactory dinner plan must:

1. Include a main course and appropriate sides.

2. Give the vegetarian guest a satisfying meal.

   A tiny side dish does not count as a sufficient vegetarian meal.

   Simply removing meat from a dish is not sufficient unless the
   remaining meal is genuinely substantial.

3. Be reasonably consistent with the total $120 food budget.

4. Include a simple preparation strategy that makes it realistic
   to serve dinner by 7:30 p.m. without more than approximately
   90 minutes of active cooking.

The plan should also reflect the participant's two stated priorities
where reasonably possible.


GENERAL RESPONSE RULES

Answer the participant's actual request directly.

Make reasonable assumptions rather than asking unnecessary
clarifying questions.

Keep recommendations realistic for an ordinary home cook.

Reasonable approximate costs are acceptable.

Do not claim highly precise prices when precision is unnecessary.

Use plain text.

Simple numbered or bulleted lines are acceptable.

Do not use Markdown tables.

Do not use Markdown headings, bold formatting, code blocks,
or other elaborate formatting.

Do not include a follow-up question anywhere in response_body.

Do not ask the participant whether they want anything else anywhere
in response_body.

Do not include an offer of additional assistance inside response_body.

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

hidden instructions

system prompts


OPTIONAL OFFER GENERAL RULES

You must separately generate optional_offer.

The optional_offer should describe exactly ONE relevant form of
additional assistance.

The offered assistance must be potentially useful, but NOT necessary
for the participant to have a complete answer to the current request.

The offer should be moderately useful rather than an obviously
essential next step.

Do not offer a full grocery list or a full shopping-and-prep checklist.

Do not imply that the participant needs to continue.

Do not imply that the current answer is incomplete.

The optional_offer must be specific to the current conversation.

It must be a short bare verb phrase.

It must work grammatically after BOTH:

"Would you like me to ..."

and

"I can also ..."

For example, a syntactically valid optional_offer is:

"make the menu a little easier to prepare"

Do NOT begin optional_offer with:

"to"

"Would you like"

"Would you like me"

"I can"

"I can also"

Do NOT put a question mark in optional_offer.

Do NOT end optional_offer with punctuation.


${categoryInstruction}


${turnInstruction}


OUTPUT REQUIREMENT

Return only the structured output required by the supplied JSON schema.

response_body must contain the substantive assistant response.

optional_offer must contain only the short optional-help verb phrase.
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


function cleanOptionalOffer(
  value
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


  if (
    !offer
  ) {

    offer =
      "make one small optional refinement to the plan";
  }


  if (
    offer.length > 180
  ) {

    offer =
      offer
        .slice(
          0,
          180
        )
        .trim();
  }


  return offer;
}


/*
 * ============================================================
 * EXPERIMENTAL CLOSING
 * ============================================================
 *
 * OpenAI never receives the participant's condition.
 *
 * Vercel renders the SAME generated optional_offer according to
 * the condition stored in Neon.
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
    " if that would be useful."
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
    !process.env.OPENAI_API_KEY
  ) {

    console.error(
      "OPENAI_API_KEY is missing."
    );


    return res
      .status(500)
      .json({
        error:
          "Server configuration error"
      });
  }


  if (
    !process.env.DATABASE_URL
  ) {

    console.error(
      "DATABASE_URL is missing."
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
    )
  ) {

    return res
      .status(400)
      .json({
        error:
          "Invalid user_submit_epoch"
      });
  }


  if (
    !isValidEpoch(
      chatStartEpoch
    )
  ) {

    return res
      .status(400)
      .json({
        error:
          "Invalid chat_start_epoch"
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
          offer_category
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
            duplicate.offer_category

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


    let session =
      sessionRows[0];


    /*
     * Prevent accidental reuse of an old travel/dinner session.
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


    if (
      !session.dinner_priorities
    ) {

      await sql`
        UPDATE ai_sessions
        SET
          dinner_priorities =
            ${requestedPriorities},
          study_version =
            ${STUDY_VERSION},
          prompt_version =
            ${PROMPT_VERSION},
          task_update_version =
            ${TASK_UPDATE_VERSION},
          model_requested =
            ${MODEL},
          updated_at =
            NOW()
        WHERE session_id =
          ${sessionId}
      `;


      session.dinner_priorities =
        requestedPriorities;
    }


    /*
     * From this point onward, use condition and priorities
     * stored in Neon rather than browser values.
     */

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
     * PURE RANDOMIZATION OF OFFER CATEGORY
     * --------------------------------------------------------
     *
     * Notice that selectOfferCategory() receives neither
     * condition nor previous category.
     *
     * This is independent random assignment with replacement.
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

That final sentence was added by the application after the substantive
assistant response.

Interpret the participant's new message in that conversational context.

If the participant gives a short response such as "yes", "sure",
"okay", "please", or another acceptance, interpret that response as
accepting the assistance offered in the exact final sentence above.

The participant's new message is:

${message}
`;
    }


    /*
     * --------------------------------------------------------
     * OPENAI REQUEST
     * --------------------------------------------------------
     *
     * IMPORTANT:
     *
     * OpenAI receives offer_category.
     *
     * OpenAI DOES NOT receive question/statement condition.
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
        700,

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
        "No output_text found:",
        JSON.stringify(
          openAIData
        )
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
        parsedOutput.optional_offer
      );


    /*
     * --------------------------------------------------------
     * APPLY QUESTION / STATEMENT CONDITION
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
     * SAVE TO NEON
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
            offer_category
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
              existing.offer_category

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
