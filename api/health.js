// health check endpoint

export default async function handler(req, res) {

  if (req.method !== "GET") {
    return res.status(405).json({
      error: "Method not allowed"
    });
  }

  return res.status(200).json({
    ok: true,
    service: "qualtrics-ai-study",
    timestamp: Date.now()
  });
}
