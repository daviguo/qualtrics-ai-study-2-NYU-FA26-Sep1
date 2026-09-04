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
        "dinner_category_randomized_v1",

      prompt_version:
        "dinner_offer_categories_v1",

      model:
        "gpt-5.6-luna",

      offer_categories: [
        "reformat",
        "alternative",
        "adjust",
        "elaborate"
      ],

      offer_category_randomization:
        "independent_with_replacement_every_turn",

      timestamp:
        Date.now()

    });
}
