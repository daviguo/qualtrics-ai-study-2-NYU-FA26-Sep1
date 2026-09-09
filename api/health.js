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
        "dinner_question_statement_confirmatory_v1",

      prompt_version:
        "dinner_very_low_ai_performable_v1",

      model:
        "gpt-5.6-luna",

      experimental_factor:
        "closing_form",

      conditions: [
        "question",
        "statement"
      ],

      offer_scope:
        "very_low_micro",

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

      offer_action_requirement:
        "text_based_ai_performable_action",

      model_condition_blinding:
        "condition_not_sent_to_model",

      offer_category_randomization:
        "independent_with_replacement_every_turn",

      first_response_requirement:
        "complete_self_contained_plan",

      timestamp:
        Date.now()
    });
}
