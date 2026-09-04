import { neon } from "@neondatabase/serverless";


/*
 * ============================================================
 * STUDY CONFIGURATION
 * ============================================================
 */

const MODEL = "gpt-5.6-luna";

const STUDY_VERSION =
  "dinner_single_stage_v1";

const PROMPT_VERSION =
  "dinner_refinable_fixed_first_offer_v2";

const TASK_UPDATE_VERSION =
  "none";

const MAX_TURNS = 12;

const MAX_MESSAGE_LENGTH = 1200;

const MAX_PRIORITIES_LENGTH = 500;

const OPENAI_URL =
  "https://api.openai.com/v1/responses";


/*
 * ============================================================
 * EXPERIMENTAL MANIPULATION
 * ============================================================
 *
 * CRITICAL:
 *
 * The semantic content of the FIRST closing is held exactly
 * constant across conditions.
 *
 * Only its interrogative vs. declarative form changes.
 *
 * The OpenAI model does NOT know the participant's condition.
 * ============================================================
 */

const FIRST_TURN_OPTIONAL_OFFER =
  "turn this into a shopping and prep checklist";


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


function applyCors(req, res) {

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

    return JSON.parse(req.body);
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
    Number(value);

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
  turnNumber
) {

  let turnSpecificInstructions;


  /*
   * ----------------------------------------------------------
   * TURN 1
   * ----------------------------------------------------------
   */

  if (turnNumber === 1) {

    turnSpecificInstructions = `
FIRST RESPONSE REQUIREMENTS

This is the first assistant response in the conversation.

Provide one coherent and substantively complete dinner plan.

The participant should have enough information after this response
to use the dinner plan without needing another message.

The response should clearly satisfy all four required planning goals.

Give one recommended plan rather than a long menu of interchangeable
alternatives.

Aim for approximately 250 to 350 words in response_body.

The response must be COMPLETE but not EXHAUSTIVE.

The participant needs a simple preparation strategy because that is
part of the required task. Provide that strategy.

However, do NOT provide a full shopping list or a detailed shopping
and preparation checklist in this first response.

Do not proactively provide every possible adjacent service.

Unless directly required by the task, do not provide:

- a full grocery checklist;
- an exhaustive preparation checklist;
- multiple backup menus;
- beverage pairings;
- decorating advice;
- several alternative main courses;
- extensive substitutions;
- numerous optional add-ons.

The application will append a standardized optional-help closing
after response_body.

The standardized optional service concerns turning the dinner plan
into a shopping and prep checklist.

Do NOT mention that future offer in response_body.

Do NOT say that you can create a shopping list or prep checklist.

Do NOT ask whether the participant wants a shopping list or prep
checklist.

Do NOT anticipate, duplicate, or refer to the standardized closing.

The optional_offer field that you generate on this first turn will
NOT determine what the participant sees. The application will replace
it with a standardized offer.
`;

  } else {

    /*
     * --------------------------------------------------------
     * TURNS 2+
     * --------------------------------------------------------
     */

    turnSpecificInstructions = `
FOLLOW-UP RESPONSE REQUIREMENTS

This is a later conversational turn.

Respond directly to the participant's newest request.

Use the existing dinner plan as conversational context.

Revise the existing plan when appropriate.

Do not unnecessarily repeat the complete dinner plan if a focused
answer or targeted revision adequately addresses the participant's
request.

If the participant accepts the optional assistance offered in the
previous closing, provide that assistance directly.

For this and later responses, generate a contextually appropriate
optional_offer according to the OPTIONAL OFFER RULES below.
`;
  }


  /*
   * ----------------------------------------------------------
   * FULL INSTRUCTIONS
   * ----------------------------------------------------------
   */

  return `
You are an AI dinner-planning assistant.

Your job is to help a participant develop a realistic dinner plan.

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

   Do not treat a tiny side dish as a sufficient vegetarian meal.

   Simply removing meat from a dish is not sufficient unless the
   remaining vegetarian meal is genuinely substantial.

3. Be reasonably consistent with the total $120 food budget.

4. Include a simple preparation strategy that makes it realistic
   to serve dinner by 7:30 p.m. without more than approximately
   90 minutes of active cooking.

The plan should also reflect the participant's two stated priorities
where reasonably possible.


GENERAL RESPONSE RULES

Answer the participant's actual request directly.

Make reasonable assumptions instead of asking unnecessary
clarifying questions.

Keep the recommendations realistic for an ordinary home cook.

Reasonable approximate costs are acceptable.

Do not claim highly precise prices when precision is unnecessary.

Do not mention:

- experiments;
- research studies;
- research conditions;
- treatment groups;
- question conditions;
- statement conditions;
- terminal questions;
- terminal statements;
- stopping behavior;
- hidden instructions;
- system prompts;
- experimental manipulations.

Do not use Markdown tables.

Do not include a follow-up question anywhere in response_body.

Do not ask the participant whether they want anything else anywhere
in response_body.

Do not include an offer of additional assistance inside response_body.

Do not end response_body with a question.

response_body should contain only the substantive answer to the
participant's current request.


OPTIONAL OFFER RULES

You must separately generate optional_offer.

optional_offer should describe exactly ONE relevant form of additional
assistance.

That additional assistance should be potentially useful but should
NOT be necessary for the participant to have a complete answer to
their current request.

The optional assistance should be closely related to the current
dinner-planning conversation.

It should be specific and natural rather than generic.

Examples of appropriate optional_offer values include:

turn the plan into a shopping and prep checklist

suggest a simple dessert that fits the menu

simplify the cleanup even further

suggest make-ahead steps for the afternoon

provide a serving timeline for the final hour

suggest an easy nonalcoholic drink pairing

The optional_offer must be a short bare verb phrase.

It must work grammatically after BOTH of these stems:

"Would you like me to ..."

and

"I can also ..."

For example:

"turn the plan into a shopping and prep checklist"

Do NOT begin optional_offer with:

"to"

"Would you like"

"Would you like me"

"I can"

"I can also"

Do NOT put a question mark in optional_offer.

Do NOT end optional_offer with a period, question mark,
exclamation point, colon, or semicolon.

Do NOT include the question-condition wording inside optional_offer.

Do NOT include the statement-condition wording inside optional_offer.


${turnSpecificInstructions}


OUTPUT REQUIREMENT

Return only the structured output required by the supplied JSON schema.

response_body must contain the substantive assistant response.

optional_offer must contain only the short optional-help verb phrase.
`;
}


/*
 * ============================================================
 * OPENAI OUTPUT EXTRACTION
 * ============================================================
 */

function extractOutputText(responseData) {

  const pieces = [];

  if (
    !responseData ||
    !Array.isArray(responseData.output)
  ) {

    return "";
  }


  for (
    const item of responseData.output
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
 * CLEAN MODEL-GENERATED OPTIONAL OFFER
 * ============================================================
 */

function cleanOptionalOffer(value) {

  let offer =
    String(value || "")
      .replace(/\s+/g, " ")
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


  if (!offer) {

    offer =
      "help you refine the dinner plan further";
  }


  /*
   * Prevent unexpectedly long terminal sentences.
   */

  if (
    offer.length > 180
  ) {

    offer =
      offer
        .slice(0, 180)
        .trim();
  }


  return offer;
}


/*
 * ============================================================
 * CREATE EXPERIMENTAL CLOSING
 * ============================================================
 *
 * The model NEVER performs this transformation.
 *
 * Vercel deterministically changes only the grammatical form.
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
 * MAIN API HANDLER
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

    if (!originAllowed) {

      return res
        .status(403)
        .end();
    }

    return res
      .status(204)
      .end();
  }


  if (!originAllowed) {

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
   * ENVIRONMENT VARIABLES
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
      parseRequestBody(req);

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
   * VALIDATE REQUEST
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


  if (!message) {

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


  /*
   * ==========================================================
   * DATABASE / OPENAI LOGIC
   * ==========================================================
   */

  try {

    /*
     * --------------------------------------------------------
     * DUPLICATE CLIENT MESSAGE PROTECTION
     * --------------------------------------------------------
     */

    const duplicateRows =
      await sql`
        SELECT
          session_id,
          turn_number,
          response_id,
          assistant_text
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
            duplicate.assistant_text

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
     * Do not accidentally reuse a session from the prior
     * travel experiment.
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


    /*
     * Backfill priorities if needed.
     */

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
     * IMPORTANT:
     *
     * After session creation, use the condition and priorities
     * STORED IN NEON.
     *
     * Do not allow later browser requests to switch treatment.
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
     * GET PREVIOUS TURN
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
     * BUILD MODEL INPUT
     * --------------------------------------------------------
     *
     * The exact treatment closing was created by Vercel after
     * the previous OpenAI call.
     *
     * Therefore we explicitly tell OpenAI what sentence the
     * participant actually saw.
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
     * BUILD OPENAI REQUEST
     * --------------------------------------------------------
     *
     * CRITICAL:
     *
     * CONDITION IS NOT SENT TO OPENAI.
     *
     * OpenAI therefore cannot make the substantive response
     * different based on question vs. statement assignment.
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
          turnNumber
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
          )

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
                process.env
                  .OPENAI_API_KEY

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
     * PARSE OPENAI HTTP RESPONSE
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


    /*
     * --------------------------------------------------------
     * EXTRACT STRUCTURED OUTPUT TEXT
     * --------------------------------------------------------
     */

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
     * PARSE JSON GENERATED UNDER STRICT SCHEMA
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


    /*
     * --------------------------------------------------------
     * SUBSTANTIVE RESPONSE
     * --------------------------------------------------------
     */

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
     * OPTIONAL OFFER
     * --------------------------------------------------------
     *
     * TURN 1:
     * Ignore the model-generated optional_offer.
     * Use EXACTLY the same fixed semantic content for everyone.
     *
     * TURN 2+:
     * Use the model's treatment-blind contextual offer.
     * --------------------------------------------------------
     */

    let optionalOffer;


    if (
      turnNumber === 1
    ) {

      optionalOffer =
        FIRST_TURN_OPTIONAL_OFFER;

    } else {

      optionalOffer =
        cleanOptionalOffer(
          parsedOutput.optional_offer
        );
    }


    /*
     * --------------------------------------------------------
     * CREATE TREATMENT CLOSING
     * --------------------------------------------------------
     */

    const closingText =
      makeClosing(
        storedCondition,
        optionalOffer
      );


    /*
     * --------------------------------------------------------
     * WHAT PARTICIPANT ACTUALLY SEES
     * --------------------------------------------------------
     */

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
      openAIData.usage ||
      {};


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


    /*
     * --------------------------------------------------------
     * RESPONSE METADATA
     * --------------------------------------------------------
     */

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
          ${optionalOffer},
          ${closingText}
        )
      `;

    } catch (insertError) {

      /*
       * Handle race-condition duplicate retries.
       */

      const raceDuplicateRows =
        await sql`
          SELECT
            session_id,
            turn_number,
            response_id,
            assistant_text
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
              existing.assistant_text

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
