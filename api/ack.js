import { neon } from "@neondatabase/serverless";


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


  const responseId =
    String(
      body.response_id || ""
    ).trim();


  const assistantDisplayEpoch =
    Number(
      body.assistant_display_epoch
    );


  if (
    !sessionId ||
    !responseId
  ) {

    return res
      .status(400)
      .json({
        error:
          "session_id and response_id are required"
      });
  }


  if (
    !Number.isFinite(
      assistantDisplayEpoch
    ) ||
    assistantDisplayEpoch <= 0
  ) {

    return res
      .status(400)
      .json({
        error:
          "Invalid assistant_display_epoch"
      });
  }


  const sql =
    neon(
      process.env.DATABASE_URL
    );


  try {

    /*
     * Preserve the first successful display timestamp.
     */

    const rows =
      await sql`
        UPDATE ai_turns
        SET
          assistant_display_epoch =
            COALESCE(
              assistant_display_epoch,
              ${assistantDisplayEpoch}
            )
        WHERE
          session_id =
            ${sessionId}
          AND
          response_id =
            ${responseId}
        RETURNING
          session_id,
          turn_number,
          response_id,
          assistant_display_epoch
      `;


    if (
      rows.length === 0
    ) {

      return res
        .status(404)
        .json({
          error:
            "No matching turn found"
        });
    }


    return res
      .status(200)
      .json({

        ok:
          true,

        session_id:
          rows[0].session_id,

        turn_number:
          Number(
            rows[0].turn_number
          ),

        response_id:
          rows[0].response_id,

        assistant_display_epoch:
          Number(
            rows[0]
              .assistant_display_epoch
          )

      });


  } catch (error) {

    console.error(
      "Unhandled /api/ack error:",
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
