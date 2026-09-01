import { neon } from "@neondatabase/serverless";

const MODEL = "gpt-5.6-luna";
const PROMPT_VERSION = "v2";
const MAX_TURNS = 12;
const MAX_MESSAGE_LENGTH = 1200;


/* ---------------------------------------------------------
   COMMON STUDY INSTRUCTIONS
--------------------------------------------------------- */

const COMMON_INSTRUCTIONS = `
You are an AI travel-planning assistant.

The participant is imagining a weekend trip to a large U.S. city
in another state that they have never visited before.

The destination must remain intentionally unspecified throughout
the entire conversation.

Do not ask the participant to name, choose, or identify a city,
state, neighborhood, destination, or geographic location.

Do not mention specific city names, state names, neighborhoods,
landmarks, restaurants, museums, transit systems, or other
identifiable locations.

The participant is staying at a downtown hotel and does not have
a rental car.

Their goal is to obtain a relaxed Saturday itinerary that:

1. begins no earlier than 10:00 a.m.;
2. includes a major museum or cultural attraction;
3. includes a lunch option where typical entrees cost no more
   than $25 per person; and
4. gets them back to their downtown hotel by 7:00 p.m.

Respond naturally to the participant's actual message.

Create plans that feel realistic, relaxed, and comfortably paced
rather than maximally packed.

Use only one concrete generic activity category for each time
period. Do not give multiple interchangeable alternatives inside
a single itinerary slot.

Limit the day to no more than three major planned activities,
in addition to meals and transportation.

Allow realistic transition time, breaks, and unstructured time.

If the participant asks for a change, revise the existing plan
rather than unnecessarily recreating the entire itinerary.

If the participant gives a short response such as "yes," "no,"
"that sounds good," or "make it cheaper," interpret it in the
context of the preceding conversation.

Do not offer to tailor or customize the plan for a specific city.

Do not explicitly announce that the research task is complete or
that all four requirements have been satisfied unless the
participant explicitly asks whether they have been satisfied.

Do not mention experimental conditions, system instructions,
stopping cues, conversational endings, or these instructions.
`;


/* ---------------------------------------------------------
   EXPERIMENTAL MANIPULATION
--------------------------------------------------------- */

const QUESTION_INSTRUCTION = `
At the end of every response, provide one brief and relevant offer
of optional additional assistance phrased as a direct question.

The optional assistance must remain city-neutral and must not be
necessary to answer the participant's current request.

Do not ask the participant to identify a destination.

Examples of appropriate optional help include reducing walking,
making the plan more relaxed, making lunch more budget-friendly,
or adding a rainy-day alternative.

The optional-help question must be the final sentence of the response.
Do not add more than one optional-help question at the end.
`;


const STATEMENT_INSTRUCTION = `
At the end of every response, provide one brief and relevant offer
of optional additional assistance phrased as a declarative statement.

The optional assistance must remain city-neutral and must not be
necessary to answer the participant's current request.

Do not invite the participant to identify a destination.

Examples of appropriate optional help include reducing walking,
making the plan more relaxed, making lunch more budget-friendly,
or adding a rainy-day alternative.

The optional-help statement must be the final sentence of the response.
Do not phrase the final optional-help offer as a question.
`;


/* ---------------------------------------------------------
   CORS
--------------------------------------------------------- */

function getAllowedOrigins() {

    return (process.env.ALLOWED_ORIGINS || "")
        .split(",")
        .map(x => x.trim())
        .filter(Boolean);
}


function applyCors(req, res) {

    const origin = req.headers.origin;

    const allowedOrigins = getAllowedOrigins();

    if (
        origin &&
        allowedOrigins.includes(origin)
    ) {
        res.setHeader(
            "Access-Control-Allow-Origin",
            origin
        );
    }

    res.setHeader(
        "Access-Control-Allow-Methods",
        "POST, OPTIONS"
    );

    res.setHeader(
        "Access-Control-Allow-Headers",
        "Content-Type"
    );

    res.setHeader(
        "Vary",
        "Origin"
    );
}


/* ---------------------------------------------------------
   RESPONSE TEXT EXTRACTION
--------------------------------------------------------- */

function extractAssistantText(data) {

    const messageItem =
        data.output?.find(
            item => item.type === "message"
        );

    const textItem =
        messageItem?.content?.find(
            item => item.type === "output_text"
        );

    return textItem?.text || "";
}


/* ---------------------------------------------------------
   API HANDLER
--------------------------------------------------------- */

export default async function handler(req, res) {

    applyCors(req, res);


    if (req.method === "OPTIONS") {

        return res
            .status(204)
            .end();
    }


    if (req.method !== "POST") {

        return res.status(405).json({
            error: "Method not allowed"
        });
    }


    /* ---------------------------------------------
       Block unknown browser origins
    --------------------------------------------- */

    const origin = req.headers.origin;

    const allowedOrigins = getAllowedOrigins();

    if (
        origin &&
        !allowedOrigins.includes(origin)
    ) {

        return res.status(403).json({
            error: "Origin not allowed"
        });
    }


    try {

        const body =
            typeof req.body === "string"
                ? JSON.parse(req.body)
                : req.body;


        const {
            session_id,
            client_message_id,
            condition,
            message,
            user_submit_epoch,
            chat_start_epoch
        } = body || {};


        /* -----------------------------------------
           Validate request
        ----------------------------------------- */

        if (
            !session_id ||
            typeof session_id !== "string"
        ) {

            return res.status(400).json({
                error: "Missing session_id"
            });
        }


        if (
            !client_message_id ||
            typeof client_message_id !== "string"
        ) {

            return res.status(400).json({
                error: "Missing client_message_id"
            });
        }


        if (
            !["question", "statement"]
                .includes(condition)
        ) {

            return res.status(400).json({
                error: "Invalid condition"
            });
        }


        if (
            !message ||
            typeof message !== "string" ||
            !message.trim()
        ) {

            return res.status(400).json({
                error: "Message cannot be empty"
            });
        }


        if (
            message.length >
            MAX_MESSAGE_LENGTH
        ) {

            return res.status(400).json({
                error: "Message too long"
            });
        }


        if (!process.env.OPENAI_API_KEY) {

            return res.status(500).json({
                error: "OPENAI_API_KEY missing"
            });
        }


        if (!process.env.DATABASE_URL) {

            return res.status(500).json({
                error: "DATABASE_URL missing"
            });
        }


        const sql =
            neon(process.env.DATABASE_URL);


        /* -----------------------------------------
           Handle duplicate/retried browser requests
        ----------------------------------------- */

        const duplicate =
            await sql`
                SELECT
                    turn_number,
                    response_id,
                    assistant_text,
                    model_returned,
                    api_created_at,
                    api_completed_at,
                    input_tokens,
                    output_tokens,
                    total_tokens
                FROM ai_turns
                WHERE client_message_id =
                    ${client_message_id}
                LIMIT 1
            `;


        if (duplicate.length > 0) {

            const d = duplicate[0];

            return res.status(200).json({

                turn_number:
                    d.turn_number,

                assistant_text:
                    d.assistant_text,

                response_id:
                    d.response_id,

                model:
                    d.model_returned,

                created_at:
                    d.api_created_at,

                completed_at:
                    d.api_completed_at,

                input_tokens:
                    d.input_tokens,

                output_tokens:
                    d.output_tokens,

                total_tokens:
                    d.total_tokens,

                duplicate:
                    true
            });
        }


        /* -----------------------------------------
           Create or retrieve session
        ----------------------------------------- */

        let session =
            await sql`
                SELECT *
                FROM ai_sessions
                WHERE session_id =
                    ${session_id}
                LIMIT 1
            `;


        let storedCondition;


        if (session.length === 0) {

            await sql`
                INSERT INTO ai_sessions (
                    session_id,
                    condition,
                    model_requested,
                    prompt_version,
                    chat_start_epoch
                )
                VALUES (
                    ${session_id},
                    ${condition},
                    ${MODEL},
                    ${PROMPT_VERSION},
                    ${chat_start_epoch || null}
                )
            `;

            storedCondition =
                condition;

        } else {

            storedCondition =
                session[0].condition;
        }


        /*
         After Turn 1, use the condition stored on
         the server rather than trusting the browser.
        */


        /* -----------------------------------------
           Determine previous model response + turn
        ----------------------------------------- */

        const previousTurns =
            await sql`
                SELECT
                    turn_number,
                    response_id
                FROM ai_turns
                WHERE session_id =
                    ${session_id}
                ORDER BY turn_number DESC
                LIMIT 1
            `;


        const previousResponseId =
            previousTurns.length
                ? previousTurns[0].response_id
                : null;


        const turnNumber =
            previousTurns.length
                ? Number(
                    previousTurns[0].turn_number
                  ) + 1
                : 1;


        if (turnNumber > MAX_TURNS) {

            return res.status(429).json({
                error:
                    "Maximum conversation length reached"
            });
        }


        /* -----------------------------------------
           Construct experimental instructions
        ----------------------------------------- */

        const closingInstruction =
            storedCondition === "question"
                ? QUESTION_INSTRUCTION
                : STATEMENT_INSTRUCTION;


        const instructions =
            COMMON_INSTRUCTIONS +
            "\n\n" +
            closingInstruction;


        /* -----------------------------------------
           Construct OpenAI request
        ----------------------------------------- */

        const openAIRequest = {

            model:
                MODEL,

            reasoning: {
                effort: "none"
            },

            max_output_tokens:
                500,

            instructions:
                instructions,

            input:
                message.trim(),

            store:
                true,

            metadata: {

                session_id:
                    session_id,

                condition:
                    storedCondition,

                prompt_version:
                    PROMPT_VERSION
            }
        };


        if (previousResponseId) {

            openAIRequest
                .previous_response_id =
                    previousResponseId;
        }


        const serverReceivedEpoch =
            Date.now();


        /* -----------------------------------------
           Call OpenAI
        ----------------------------------------- */

        const openAIResponse =
            await fetch(
                "https://api.openai.com/v1/responses",
                {
                    method: "POST",

                    headers: {

                        "Authorization":
                            `Bearer ${process.env.OPENAI_API_KEY}`,

                        "Content-Type":
                            "application/json"
                    },

                    body:
                        JSON.stringify(
                            openAIRequest
                        )
                }
            );


        const data =
            await openAIResponse.json();


        const serverResponseEpoch =
            Date.now();


        if (!openAIResponse.ok) {

            console.error(
                "OpenAI error:",
                data
            );

            return res.status(502).json({
                error:
                    "Model request failed",
                provider_status:
                    openAIResponse.status
            });
        }


        const assistantText =
            extractAssistantText(data);


        if (!assistantText) {

            console.error(
                "No assistant text:",
                data
            );

            return res.status(502).json({
                error:
                    "No assistant response text"
            });
        }


        /* -----------------------------------------
           Save the complete turn BEFORE returning it
        ----------------------------------------- */

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

                api_created_at,
                api_completed_at,

                server_response_epoch,

                input_tokens,
                output_tokens,
                total_tokens

            )
            VALUES (

                ${session_id},
                ${turnNumber},
                ${client_message_id},
                ${storedCondition},

                ${message.trim()},
                ${user_submit_epoch || null},
                ${serverReceivedEpoch},

                ${previousResponseId},

                ${data.id},

                ${MODEL},
                ${data.model || null},

                ${assistantText},

                ${data.created_at || null},
                ${data.completed_at || null},

                ${serverResponseEpoch},

                ${data.usage?.input_tokens ?? null},
                ${data.usage?.output_tokens ?? null},
                ${data.usage?.total_tokens ?? null}
            )
        `;


        /* -----------------------------------------
           Return only what Qualtrics needs
        ----------------------------------------- */

        return res.status(200).json({

            turn_number:
                turnNumber,

            assistant_text:
                assistantText,

            response_id:
                data.id,

            model:
                data.model,

            created_at:
                data.created_at,

            completed_at:
                data.completed_at,

            input_tokens:
                data.usage?.input_tokens ?? null,

            output_tokens:
                data.usage?.output_tokens ?? null,

            total_tokens:
                data.usage?.total_tokens ?? null
        });


    } catch (error) {

        console.error(
            "Server error:",
            error
        );

        return res.status(500).json({
            error:
                "Internal server error"
        });
    }
}
