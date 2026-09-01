import { neon } from "@neondatabase/serverless";

function allowed(req, res) {

    const origin =
        req.headers.origin;

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

    return (
        !origin ||
        origins.includes(origin)
    );
}


export default async function handler(req, res) {

    const originAllowed =
        allowed(req, res);


    if (req.method === "OPTIONS") {

        return res
            .status(204)
            .end();
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


        if (
            !session_id ||
            !response_id ||
            !assistant_display_epoch
        ) {

            return res.status(400).json({
                error: "Missing required fields"
            });
        }


        const sql =
            neon(process.env.DATABASE_URL);


        await sql`
            UPDATE ai_turns

            SET assistant_display_epoch =
                ${assistant_display_epoch}

            WHERE session_id =
                ${session_id}

            AND response_id =
                ${response_id}
        `;


        return res.status(200).json({
            ok: true
        });


    } catch (error) {

        console.error(error);

        return res.status(500).json({
            error: "Internal server error"
        });
    }
}
