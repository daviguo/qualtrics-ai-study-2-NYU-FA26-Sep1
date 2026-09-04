export default async function handler(
  req,
  res
) {

  res.setHeader(
    "Cache-Control",
    "no-store"
  );


  if (
    req.method !== "GET"
  ) {

    return res
      .status(405)
      .json({
        error:
          "Method not allowed"
      });
  }


  return res
    .status(200)
    .json({

      ok:
        true,

      service:
        "qualtrics-ai-study",

      study_version:
        "dinner_single_stage_v1",

      prompt_version:
        "dinner_refinable_fixed_first_offer_v2",

      model:
        "gpt-5.6-luna",

      first_turn_optional_offer:
        "turn this into a shopping and prep checklist",

      timestamp:
        Date.now()

    });
}
