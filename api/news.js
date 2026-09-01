export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "GET") {
    return res.status(405).json({
      ok: false,
      error: "Method not allowed"
    });
  }

  const API_KEY = process.env.FMP_API_KEY;

  if (!API_KEY) {
    return res.status(500).json({
      ok: false,
      error: "FMP_API_KEY لە Environment Variables نییە."
    });
  }

  try {
    const from =
      req.query?.from ||
      new Date().toISOString().slice(0, 10);

    const to =
      req.query?.to ||
      from;

    const url =
      `https://financialmodelingprep.com/stable/economic-calendar` +
      `?from=${encodeURIComponent(from)}` +
      `&to=${encodeURIComponent(to)}` +
      `&apikey=${encodeURIComponent(API_KEY)}`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Accept": "application/json"
      }
    });

    const text = await response.text();

    let data;

    try {
      data = JSON.parse(text);
    } catch {
      return res.status(502).json({
        ok: false,
        error: "FMP وەڵامی JSON نەدا."
      });
    }

    if (!response.ok) {
      return res.status(response.status).json({
        ok: false,
        error: "FMP API error",
        status: response.status
      });
    }

    if (!Array.isArray(data)) {
      return res.status(502).json({
        ok: false,
        error: "داتای Economic Calendar دروست نییە."
      });
    }

    const events = data.map((item) => ({
      date: item.date || item.datetime || null,
      country: item.country || "",
      currency: item.currency || "",
      event: item.event || item.name || "",
      impact: normalizeImpact(item),
      actual: item.actual ?? null,
      forecast: item.estimate ?? item.forecast ?? null,
      previous: item.previous ?? null
    }));

    return res.status(200).json({
      ok: true,
      source: "FMP",
      from,
      to,
      count: events.length,
      events
    });

  } catch (error) {

    console.error("Economic Calendar Error:", error);

    return res.status(500).json({
      ok: false,
      error: "هەڵەیەک لە وەرگرتنی داتای Economic Calendar ڕوویدا."
    });
  }
}


function normalizeImpact(item) {

  const value = String(
    item.impact ||
    item.importance ||
    item.volatility ||
    ""
  ).toLowerCase();

  if (
    value.includes("high") ||
    value.includes("red")
  ) {
    return "High";
  }

  if (
    value.includes("medium") ||
    value.includes("moderate") ||
    value.includes("orange")
  ) {
    return "Medium";
  }

  if (
    value.includes("low") ||
    value.includes("green")
  ) {
    return "Low";
  }

  return "Low";
}
