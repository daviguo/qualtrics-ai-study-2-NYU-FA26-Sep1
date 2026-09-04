import { neon } from "@neondatabase/serverless";


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
 * BODY PARSER
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

  const chatEndEpoch =
    Number(
      body.chat_end_epoch
    );

  const chatEndReason =
    String(
      body.chat_end_reason ||
      "participant_chose_end"
    ).trim();

  const totalUserTurns =
    Number(
      body.total_user_turns
    );

  const totalAssistantTurns =
    Number(
      body.total_assistant_turns
    );


  if (!sessionId) {

    return res
      .status(400)
      .json({
        error:
          "session_id is required"
      });
  }


  if (
    !Number.isFinite(
      chatEndEpoch
    ) ||
    chatEndEpoch <= 0
  ) {

    return res
      .status(400)
      .json({
        error:
          "Invalid chat_end_epoch"
      });
  }


  if (
    !Number.isInteger(
      totalUserTurns
    ) ||
    totalUserTurns < 0
  ) {

    return res
      .status(400)
      .json({
        error:
          "Invalid total_user_turns"
      });
  }


  if (
    !Number.isInteger(
      totalAssistantTurns
    ) ||
    totalAssistantTurns < 0
  ) {

    return res
      .status(400)
      .json({
        error:
          "Invalid total_assistant_turns"
      });
  }


  if (
    chatEndReason.length >
    100
  ) {

    return res
      .status(400)
      .json({
        error:
          "Invalid chat_end_reason"
      });
  }


  const sql =
    neon(
      process.env.DATABASE_URL
    );


  try {

    const rows =
      await sql`
        UPDATE ai_sessions
        SET
          chat_end_epoch =
            ${chatEndEpoch},
          chat_end_reason =
            ${chatEndReason},
          total_user_turns =
            ${totalUserTurns},
          total_assistant_turns =
            ${totalAssistantTurns},
          updated_at =
            NOW()
        WHERE session_id =
          ${sessionId}
        RETURNING
          session_id,
          chat_end_epoch,
          chat_end_reason,
          total_user_turns,
          total_assistant_turns
      `;


    if (
      rows.length === 0
    ) {

      return res
        .status(404)
        .json({
          error:
            "Session not found"
        });
    }


    return res
      .status(200)
      .json({
        ok:
          true,
        session_id:
          rows[0].session_id,
        chat_end_epoch:
          Number(
            rows[0].chat_end_epoch
          ),
        chat_end_reason:
          rows[0].chat_end_reason,
        total_user_turns:
          Number(
            rows[0].total_user_turns
          ),
        total_assistant_turns:
          Number(
            rows[0]
              .total_assistant_turns
          )
      });


  } catch (error) {

    console.error(
      "Unhandled /api/end error:",
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
