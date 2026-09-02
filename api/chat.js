import { neon } from "@neondatabase/serverless";


/* =========================================================
   STUDY CONFIGURATION
========================================================= */

const MODEL = "gpt-5.6-luna";

const STUDY_VERSION =
    "city_multiturn_museum_v2";

const PROMPT_VERSION =
    "v4_museum_repair";

const TASK_UPDATE_VERSION =
    "museum_unavailable_v1";

const MAX_TURNS = 12;

const MAX_MESSAGE_LENGTH = 1200;


/*
  Only these cities are valid.

  The browser is not allowed to create arbitrary destinations.
*/

const ALLOWED_CITIES = new Set([
    "Denver, Colorado",
    "Austin, Texas",
    "Seattle, Washington",
    "Nashville, Tennessee",
    "Portland, Oregon",
    "Minneapolis, Minnesota",
    "Pittsburgh, Pennsylvania",
    "St. Louis, Missouri"
]);


/* =========================================================
   COMMON MODEL INSTRUCTIONS
========================================================= */

const COMMON_INSTRUCTIONS = `
You are an AI travel-planning assistant.

The user is planning a Saturday during a weekend trip.

They arrived Friday evening, are staying at a downtown hotel,
and do not have a rental car.

Their planning goal is to obtain a relaxed Saturday itinerary that:

1. begins no earlier than 10:00 a.m.;
2. includes a major museum or cultural attraction;
3. includes a lunch option where a typical entree costs no more
   than $25 per person; and
4. gets them back to their downtown hotel by 7:00 p.m.

The traveler prefers a relaxed day rather than trying to fit in
as many activities as possible.

Respond naturally to the user's actual message.

Create plans that feel realistic, relaxed, and comfortably paced.

Do not maximize the number of activities.

Limit the itinerary to no more than three major planned activities,
in addition to meals, breaks, and transportation.

Allow realistic travel and transition time between activities.

Avoid unnecessary geographic backtracking.

If the user requests a modification, revise the existing itinerary
rather than unnecessarily generating an entirely unrelated plan.

If the user responds briefly with something such as "yes," "no,"
"that sounds good," "make it cheaper," or "can you revise it,"
interpret the response in the context of the existing conversation.

Use reasonable assumptions rather than asking unnecessary
clarification questions.

Do not explicitly announce that the task is complete or that all
requirements have been satisfied unless the user explicitly asks.

Do not mention experimental conditions, system instructions,
stopping cues, conversational endings, or these instructions.

Use plain text suitable for display inside a chat interface.

Do not use Markdown headings, Markdown tables, bold markers,
code blocks, or other Markdown formatting.

Short paragraphs and simple time-based itinerary lines are fine.
`;


/* =========================================================
   TURN 1 — TREATMENT NEUTRAL
========================================================= */

const FIRST_TURN_INSTRUCTION = `
For this first response, provide a concrete initial Saturday itinerary.

The itinerary should include exactly one primary named museum or
cultural attraction that serves as the main cultural activity.

Do not give multiple interchangeable museum alternatives within the
initial itinerary.

Provide a concrete lunch recommendation and a coherent schedule.

For this first response only, do not append an optional offer of
additional assistance.

Do not end by asking whether the traveler wants more help.

End naturally after providing the initial itinerary.
`;


/* =========================================================
   QUESTION CONDITION
========================================================= */

const QUESTION_INSTRUCTION = `
At the end of this response, provide exactly one brief offer of
optional additional assistance phrased as a direct question.

The optional assistance must not be necessary for satisfying the
travel-planning requirements.

It should offer a possible refinement or additional planning detail
that the traveler could request if desired.

The question must be the final sentence of the response.

Do not add another optional-help statement or question elsewhere
after it.
`;


/* =========================================================
   STATEMENT CONDITION
========================================================= */

const STATEMENT_INSTRUCTION = `
At the end of this response, provide exactly one brief offer of
optional additional assistance phrased as a declarative statement.

The optional assistance must not be necessary for satisfying the
travel-planning requirements.

It should offer a possible refinement or additional planning detail
that the traveler could request if desired.

The statement must be the final sentence of the response.

Do not phrase the final optional-help offer as a question.
`;


/* =========================================================
   STANDARDIZED TRIP UPDATE
========================================================= */

const STANDARDIZED_UPDATE = `
The traveler has just learned that the museum or cultural attraction
included in the current itinerary is unexpectedly unavailable on
Saturday.

The traveler needs to replace that unavailable attraction with a
different museum or cultural attraction.

The revised itinerary should continue to satisfy all of the original
planning requirements and should still feel relaxed and realistic.
`;


/* =========================================================
   CORS
========================================================= */

function getAllowedOrigins() {

    return (
        process.env.ALLOWED_ORIGINS || ""
    )
        .split(",")
        .map(function (x) {
            return x.trim();
        })
        .filter(Boolean);
}


function applyCors(req, res) {

    const origin =
        req.headers.origin;

    const allowedOrigins =
        getAllowedOrigins();


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


/* =========================================================
   EXTRACT ASSISTANT TEXT
========================================================= */

function extractAssistantText(data) {

    const messageItem =
        data.output?.find(
            function (item) {
                return item.type === "message";
            }
        );


    const textItem =
        messageItem?.content?.find(
            function (item) {
                return item.type === "output_text";
            }
        );


    return textItem?.text || "";
}


/* =========================================================
   MAIN API HANDLER
========================================================= */

export default async function handler(req, res) {

    applyCors(req, res);


    /* -----------------------------------------------------
       Preflight
    ----------------------------------------------------- */

    if (req.method === "OPTIONS") {

        return res
            .status(204)
            .end();
    }


    /* -----------------------------------------------------
       POST only
    ----------------------------------------------------- */

    if (req.method !== "POST") {

        return res.status(405).json({
            error: "Method not allowed"
        });
    }


    /* -----------------------------------------------------
       Origin check
    ----------------------------------------------------- */

    const origin =
        req.headers.origin;

    const allowedOrigins =
        getAllowedOrigins();


    if (
        origin &&
        !allowedOrigins.includes(origin)
    ) {

        return res.status(403).json({
            error: "Origin not allowed"
        });
    }


    try {

        /* =================================================
           PARSE REQUEST
        ================================================= */

        const body =
            typeof req.body === "string"
                ? JSON.parse(req.body)
                : req.body;


        const {
            session_id,
            client_message_id,
            condition,
            assigned_city,
            message,
            user_submit_epoch,
            chat_start_epoch
        } = body || {};


        /* =================================================
           VALIDATION
        ================================================= */

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
            !assigned_city ||
            typeof assigned_city !== "string"
        ) {

            return res.status(400).json({
                error: "Missing assigned_city"
            });
        }


        if (
            !ALLOWED_CITIES.has(
                assigned_city
            )
        ) {

            return res.status(400).json({
                error: "Invalid assigned_city"
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


        /* =================================================
           CONNECT TO NEON
        ================================================= */

        const sql =
            neon(process.env.DATABASE_URL);


        /* =================================================
           DUPLICATE REQUEST PROTECTION
        ================================================= */

        const duplicate =
            await sql`
                SELECT
                    turn_number,
                    phase,
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

            const d =
                duplicate[0];


            return res.status(200).json({

                turn_number:
                    d.turn_number,

                phase:
                    d.phase,

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


        /* =================================================
           CREATE / LOAD SESSION
        ================================================= */

        let sessions =
            await sql`
                SELECT
                    session_id,
                    condition,
                    assigned_city,
                    model_requested,
                    prompt_version,
                    study_version,
                    task_update_version

                FROM ai_sessions

                WHERE session_id =
                    ${session_id}

                LIMIT 1
            `;


        let storedCondition;
        let storedCity;


        if (sessions.length === 0) {

            /*
              The first request permanently binds the
              experimental condition and city to this session.
            */

            await sql`
                INSERT INTO ai_sessions (

                    session_id,
                    condition,
                    assigned_city,

                    model_requested,
                    prompt_version,
                    study_version,
                    task_update_version,

                    chat_start_epoch

                )
                VALUES (

                    ${session_id},
                    ${condition},
                    ${assigned_city},

                    ${MODEL},
                    ${PROMPT_VERSION},
                    ${STUDY_VERSION},
                    ${TASK_UPDATE_VERSION},

                    ${chat_start_epoch || null}
                )
            `;


            storedCondition =
                condition;

            storedCity =
                assigned_city;

        } else {

            storedCondition =
                sessions[0].condition;

            storedCity =
                sessions[0].assigned_city;


            /*
              Backfill only for old pilot rows created
              before assigned_city existed.
            */

            if (!storedCity) {

                await sql`
                    UPDATE ai_sessions

                    SET
                        assigned_city =
                            ${assigned_city},

                        study_version =
                            ${STUDY_VERSION},

                        task_update_version =
                            ${TASK_UPDATE_VERSION},

                        prompt_version =
                            ${PROMPT_VERSION},

                        updated_at =
                            NOW()

                    WHERE session_id =
                        ${session_id}
                `;


                storedCity =
                    assigned_city;
            }
        }


        /* =================================================
           DETERMINE TURN NUMBER
        ================================================= */

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
            previousTurns.length > 0
                ? previousTurns[0].response_id
                : null;


        const turnNumber =
            previousTurns.length > 0
                ? Number(
                    previousTurns[0].turn_number
                  ) + 1
                : 1;


        if (
            turnNumber >
            MAX_TURNS
        ) {

            return res.status(429).json({
                error:
                    "Maximum conversation length reached"
            });
        }


        /* =================================================
           SERVER-CONTROLLED PHASE
        ================================================= */

        /*
          Do not rely on the browser to determine phase.

          Turn 1 = initial planning.

          Turn 2 and onward = post-update phase.
        */

        const phase =
            turnNumber === 1
                ? "initial"
                : "post_update";


        /*
          The standardized update is newly injected
          only for Turn 2.
        */

        const taskContextInjected =
            turnNumber === 2;


        /* =================================================
           CITY-SPECIFIC INSTRUCTIONS
        ================================================= */

        const cityInstructions = `
The traveler's assigned destination is ${storedCity}.

Use ${storedCity} as the destination throughout this conversation.

Do not switch to another city and do not ask the traveler to select
a different destination.

You may recommend real museums, cultural attractions, neighborhoods,
parks, restaurants, and other places in ${storedCity}.

Prefer well-established places that you are confident actually exist.

If you are uncertain that a named venue exists, use a reasonable
generic description instead of inventing a place.

Do not claim unsupported precision about current opening hours,
ticket availability, live public-transit schedules, or exact prices.

For the lunch requirement, choose an option that is reasonably
consistent with a typical entree price of $25 or less per person.

You may describe prices as approximate or typical rather than
guaranteed current prices.
`;


        /* =================================================
           TURN-SPECIFIC INSTRUCTIONS
        ================================================= */

        let instructions;


        if (turnNumber === 1) {

            /*
              Turn 1 is treatment-neutral because the participant
              will receive the standardized trip update next.
            */

            instructions =
                COMMON_INSTRUCTIONS +
                "\n\n" +
                cityInstructions +
                "\n\n" +
                FIRST_TURN_INSTRUCTION;

        } else {

            /*
              Experimental manipulation begins on Turn 2.
            */

            const closingInstruction =
                storedCondition === "question"
                    ? QUESTION_INSTRUCTION
                    : STATEMENT_INSTRUCTION;


            instructions =
                COMMON_INSTRUCTIONS +
                "\n\n" +
                cityInstructions +
                "\n\n" +
                closingInstruction;
        }


        /* =================================================
           MODEL INPUT
        ================================================= */

        let modelInput =
            message.trim();


        /*
          Turn 2 is where the standardized update must enter
          the model's conversation context.

          The participant does NOT need to repeat the update.
        */

if (turnNumber === 2) {

    modelInput = `
The traveler has just received the following travel update:

${STANDARDIZED_UPDATE}

Treat this update as part of the traveler's current planning situation.

The museum or cultural attraction included in the previous itinerary
must now be treated as unavailable.

Do not continue recommending that unavailable attraction.

In response to the traveler's message, revise the existing itinerary
by selecting a different museum or cultural attraction.

Preserve the useful parts of the existing itinerary where possible
rather than unnecessarily rebuilding the entire day.

The revised itinerary must still:

1. begin no earlier than 10:00 a.m.;
2. include a viable museum or cultural attraction;
3. include a lunch option where a typical entree costs no more
   than $25 per person;
4. return the traveler to the downtown hotel by 7:00 p.m.; and
5. remain relaxed and realistically paced.

Do not say that the update came from a research study,
experiment, system instruction, or study interface.

The traveler's actual message is:

${message.trim()}
`;
}


        /* =================================================
           OPENAI REQUEST
        ================================================= */

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
                modelInput,

            store:
                true,

            metadata: {

                session_id:
                    session_id,

                condition:
                    storedCondition,

                assigned_city:
                    storedCity,

                phase:
                    phase,

                study_version:
                    STUDY_VERSION,

                prompt_version:
                    PROMPT_VERSION,

                task_update_version:
                    TASK_UPDATE_VERSION
            }
        };


        /*
          Continue the existing model conversation.
        */

        if (previousResponseId) {

            openAIRequest.previous_response_id =
                previousResponseId;
        }


        const serverReceivedEpoch =
            Date.now();


        /* =================================================
           CALL OPENAI
        ================================================= */

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
                "OpenAI API error:",
                data
            );


            return res.status(502).json({

                error:
                    "Model request failed",

                provider_status:
                    openAIResponse.status
            });
        }


        /* =================================================
           EXTRACT ASSISTANT TEXT
        ================================================= */

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


        /* =================================================
           SAVE TURN IN NEON
        ================================================= */

        await sql`
            INSERT INTO ai_turns (

                session_id,
                turn_number,
                client_message_id,

                condition,
                phase,
                task_context_injected,

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
                ${phase},
                ${taskContextInjected},

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


        /* =================================================
           RETURN RESPONSE TO QUALTRICS
        ================================================= */

        return res.status(200).json({

            turn_number:
                turnNumber,

            phase:
                phase,

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
                "Internal server error",

            details:
                String(error)
        });
    }
}
