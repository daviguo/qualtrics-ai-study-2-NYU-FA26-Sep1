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

    return res.status(405)
      .json({
        error:
          "Method not allowed"
      });
  }


  return res.status(200)
    .json({

      ok: true,

      service:
        "qualtrics-ai-study",

      study_version:
        "dinner_2x2_jumbo_pilot_v1",

      prompt_version:
        "dinner_2x2_complete_microoffers_v1",

      model:
        "gpt-5.6-luna",

      factors: {

        closing_form: [
          "question",
          "statement"
        ],

        offer_scope: [
          "functional_micro",
          "very_low_micro"
        ]
      },

      question_template:
        "Would you like me to X?",

      statement_template:
        "I can also X.",

      offer_categories: [
        "reformat",
        "alternative",
        "adjust",
        "elaborate"
      ],

      offer_category_randomization:
        "independent_with_replacement_every_turn",

      first_response:
        "complete_self_contained_plan",

      timestamp:
        Date.now()
    });
}
