import { neon } from "@neondatabase/serverless";


function applyCors(req, res) {

    const origin = req.headers.origin;

    const origins =
        (process.env.ALLOWED_ORIGINS || "")
            .split(",")
            .map(x => x.trim())
            .filter(Boolean);


    if (
        origin &&
        origins.includes(origin)
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


    return (
        !origin ||
        origins.includes(origin)
    );
}


export default async function handler(req, res) {

    const originAllowed =
        applyCors(req, res);


    if (req.method === "OPTIONS") {

        return res.status(204).end();
    }


    if (!originAllowed) {

        return res.status(403).json({
            error: "Origin not allowed"
        });
    }


    if (req.method !== "POST") {

        return res.status(405).json({
            error: "Method not allowed"
        });
    }


    try {

        const body =
            typeof req.body === "string"
                ? JSON.parse(req.body)
                : req.body;


        const {
            session_id,
            response_id,
            assistant_display_epoch
        } = body || {};


        console.log("ACK REQUEST", {
            session_id,
            response_id,
            assistant_display_epoch
        });


        if (!session_id) {

            return res.status(400).json({
                error: "Missing session_id"
            });
        }


        if (!response_id) {

            return res.status(400).json({
                error: "Missing response_id"
            });
        }


        if (
            assistant_display_epoch === undefined ||
            assistant_display_epoch === null
        ) {

            return res.status(400).json({
                error: "Missing assistant_display_epoch"
            });
        }


        if (!process.env.DATABASE_URL) {

            return res.status(500).json({
                error: "DATABASE_URL missing"
            });
        }


        const sql =
            neon(process.env.DATABASE_URL);


        const updated =
            await sql`
                UPDATE ai_turns

                SET assistant_display_epoch =
                    ${assistant_display_epoch}

                WHERE session_id =
                    ${session_id}

                AND response_id =
                    ${response_id}

                RETURNING
                    session_id,
                    turn_number,
                    response_id,
                    assistant_display_epoch
            `;


        if (updated.length === 0) {

            return res.status(404).json({
                error: "No matching turn found",
                session_id: session_id,
                response_id: response_id
            });
        }


        return res.status(200).json({
            ok: true,
            updated: updated[0]
        });


    } catch (error) {

        console.error(
            "ACK ERROR:",
            error
        );


        return res.status(500).json({
            error: "Internal server error",
            details: String(error)
        });
    }
}
