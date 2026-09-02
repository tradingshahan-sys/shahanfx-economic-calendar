// api/chat.js
// ShahanFX AI Pro Backend
// Kurdish Sorani AI + Live Market + News + Chart Image Analysis

export default async function handler(req, res) {
  // =========================================================
  // CORS
  // =========================================================
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, OPTIONS"
  );
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization"
  );
  res.setHeader("Cache-Control", "no-store");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  // =========================================================
  // HEALTH CHECK
  // =========================================================
  if (req.method === "GET") {
    return res.status(200).json({
      ok: true,
      success: true,
      project: "ShahanFX AI Pro",
      status: "online",
      live: true,
      message: "ShahanFX Backend is working!"
    });
  }

  if (req.method !== "POST") {
    return res.status(405).json({
      ok: false,
      error: "تەنها POST ڕێگەپێدراوە."
    });
  }

  // =========================================================
  // ENVIRONMENT VARIABLES
  // =========================================================
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
  const TWELVE_DATA_API_KEY = process.env.TWELVE_DATA_API_KEY;
  const FMP_API_KEY = process.env.FMP_API_KEY;

  // =========================================================
  // REQUEST DATA
  // =========================================================
  let body = {};

  try {
    body =
      typeof req.body === "string"
        ? JSON.parse(req.body)
        : req.body || {};
  } catch {
    return res.status(400).json({
      ok: false,
      error: "داتای نێردراو دروست نییە."
    });
  }

  const message =
    typeof body.message === "string"
      ? body.message.trim()
      : "";

  const image =
    typeof body.image === "string"
      ? body.image
      : null;

  const symbol =
    typeof body.symbol === "string" && body.symbol.trim()
      ? body.symbol.trim()
      : "XAU/USD";

  const interval =
    typeof body.interval === "string" && body.interval.trim()
      ? body.interval.trim()
      : "5min";

  if (!message && !image) {
    return res.status(400).json({
      ok: false,
      error: "تکایە پرسیارێک بنووسە یان وێنەی Chart بنێرە."
    });
  }

  // =========================================================
  // GLOBAL DEADLINE
  // =========================================================
  const startedAt = Date.now();
  const MAX_TIME = 23000;

  function remainingTime() {
    return Math.max(
      1000,
      MAX_TIME - (Date.now() - startedAt)
    );
  }

  // =========================================================
  // FETCH WITH TIMEOUT
  // =========================================================
  async function fetchTimeout(url, options = {}, timeout = 8000) {
    const controller = new AbortController();

    const timer = setTimeout(() => {
      controller.abort();
    }, Math.min(timeout, remainingTime()));

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      });

      return response;
    } finally {
      clearTimeout(timer);
    }
  }

  // =========================================================
  // CLEAN AI RESPONSE
  // =========================================================
  function clean(text) {
    if (!text) return "";

    return String(text)
      .replace(/User Safety:\s*safe/gi, "")
      .replace(/^System:\s*/i, "")
      .trim();
  }

  // =========================================================
  // GET LIVE MARKET DATA
  // =========================================================
  async function getMarket() {
    if (!TWELVE_DATA_API_KEY) {
      return {
        available: false,
        reason: "TWELVE_DATA_API_KEY نەدۆزرایەوە."
      };
    }

    try {
      const url =
        "https://api.twelvedata.com/time_series" +
        `?symbol=${encodeURIComponent(symbol)}` +
        `&interval=${encodeURIComponent(interval)}` +
        `&outputsize=120` +
        `&apikey=${encodeURIComponent(TWELVE_DATA_API_KEY)}`;

      const response = await fetchTimeout(
        url,
        {
          headers: {
            Accept: "application/json"
          }
        },
        7000
      );

      if (!response.ok) {
        return {
          available: false,
          reason: `Market API HTTP ${response.status}`
        };
      }

      const data = await response.json();

      if (!data || !Array.isArray(data.values)) {
        return {
          available: false,
          reason: data?.message || "داتای بازاڕ بەردەست نییە."
        };
      }

      const candles = data.values;

      if (candles.length === 0) {
        return {
          available: false,
          reason: "هیچ کاندڵێک نەدۆزرایەوە."
        };
      }

      const current = candles[0];
      const previous = candles[1] || candles[0];

      const currentClose = Number(current.close);
      const previousClose = Number(previous.close);

      let direction = "neutral";

      if (
        Number.isFinite(currentClose) &&
        Number.isFinite(previousClose)
      ) {
        if (currentClose > previousClose) {
          direction = "bullish";
        } else if (currentClose < previousClose) {
          direction = "bearish";
        }
      }

      const recentCandles = candles
        .slice(0, 20)
        .map((c) => ({
          datetime: c.datetime,
          open: Number(c.open),
          high: Number(c.high),
          low: Number(c.low),
          close: Number(c.close),
          volume:
            c.volume !== undefined
              ? Number(c.volume)
              : null
        }));

      return {
        available: true,
        symbol,
        interval,
        current: {
          datetime: current.datetime,
          open: Number(current.open),
          high: Number(current.high),
          low: Number(current.low),
          close: Number(current.close)
        },
        previous: {
          datetime: previous.datetime,
          open: Number(previous.open),
          high: Number(previous.high),
          low: Number(previous.low),
          close: Number(previous.close)
        },
        direction,
        recentCandles
      };
    } catch (error) {
      return {
        available: false,
        reason:
          error?.name === "AbortError"
            ? "Market API timeout"
            : error?.message || "Market API error"
      };
    }
  }

  // =========================================================
  // GET ECONOMIC NEWS
  // =========================================================
  async function getNews() {
    if (!FMP_API_KEY) {
      return {
        available: false,
        reason: "FMP_API_KEY نەدۆزرایەوە.",
        events: []
      };
    }

    try {
      const now = new Date();

      const year = now.getUTCFullYear();
      const month = String(now.getUTCMonth() + 1).padStart(2, "0");
      const day = String(now.getUTCDate()).padStart(2, "0");

      const today = `${year}-${month}-${day}`;

      const url =
        "https://financialmodelingprep.com/stable/economic-calendar" +
        `?from=${today}` +
        `&to=${today}` +
        `&apikey=${encodeURIComponent(FMP_API_KEY)}`;

      const response = await fetchTimeout(
        url,
        {
          headers: {
            Accept: "application/json"
          }
        },
        7000
      );

      if (!response.ok) {
        return {
          available: false,
          reason: `News API HTTP ${response.status}`,
          events: []
        };
      }

      const data = await response.json();

      if (!Array.isArray(data)) {
        return {
          available: false,
          reason: "Economic Calendar داتای دروستی نەگەڕاندەوە.",
          events: []
        };
      }

      const keywords = [
        "CPI",
        "NFP",
        "FOMC",
        "FED",
        "PPI",
        "GDP",
        "interest rate",
        "interest",
        "nonfarm",
        "inflation",
        "unemployment",
        "retail sales",
        "ISM",
        "jobs",
        "employment"
      ];

      const events = data
        .filter((item) => {
          const country =
            String(
              item.country ||
              item.countryName ||
              ""
            ).toLowerCase();

          const eventName =
            String(
              item.event ||
              item.name ||
              item.title ||
              ""
            ).toLowerCase();

          const impact =
            String(
              item.impact ||
              item.importance ||
              ""
            ).toLowerCase();

          const isUS =
            country.includes("united states") ||
            country === "us" ||
            country === "usa";

          const important =
            impact.includes("high") ||
            impact.includes("medium") ||
            keywords.some((keyword) =>
              eventName.includes(keyword.toLowerCase())
            );

          return isUS && important;
        })
        .slice(0, 40)
        .map((item) => ({
          date: item.date || item.datetime || null,
          country:
            item.country ||
            item.countryName ||
            "United States",
          event:
            item.event ||
            item.name ||
            item.title ||
            "",
          impact:
            item.impact ||
            item.importance ||
            "",
          actual:
            item.actual ?? null,
          estimate:
            item.estimate ??
            item.forecast ??
            null,
          previous:
            item.previous ?? null
        }));

      return {
        available: true,
        date: today,
        events
      };
    } catch (error) {
      return {
        available: false,
        reason:
          error?.name === "AbortError"
            ? "News API timeout"
            : error?.message || "News API error",
        events: []
      };
    }
  }

  // =========================================================
  // LIVE DATA
  // =========================================================
  const [marketResult, newsResult] =
    await Promise.allSettled([
      getMarket(),
      getNews()
    ]);

  const market =
    marketResult.status === "fulfilled"
      ? marketResult.value
      : {
          available: false,
          reason: "Market data error"
        };

  const news =
    newsResult.status === "fulfilled"
      ? newsResult.value
      : {
          available: false,
          reason: "News data error",
          events: []
        };

  const liveContext = {
    symbol,
    interval,

    market,

    news,

    dataPolicy: {
      liveDataOnly: true,
      doNotInventPrice: true,
      doNotInventNews: true,
      doNotClaimCertainty: true
    }
  };

  // =========================================================
  // STRONG KURDISH SORANI SYSTEM PROMPT
  // =========================================================
  const systemPrompt = `
تۆ ShahanFX AI ـیت، ڕاوێژکاری پیشەیی بۆ Forex، Gold، ICT، SMC و ALC™.

━━━━━━━━━━━━━━━━━━━━━━
یاسای زمانی گرنگ
━━━━━━━━━━━━━━━━━━━━━━

هەموو وەڵامەکەت بە کوردیی سۆرانی بنووسە.

بە هیچ شێوەیەک وەڵامێکی زۆر بە ئینگلیزی مەدە.

دەقی ڕوونکردنەوە، هۆکار، شیکردنەوە، ڕاپۆرت و بڕیارەکان هەموویان بە کوردیی سۆرانی بن.

تەنها ئەم وشە تەکنیکییەکان دەتوانرێت بە ئینگلیزی بمێنن:

Forex
Gold
XAU/USD
ICT
SMC
ALC™
FVG
BOS
CHOCH
Liquidity
Order Block
Breaker Block
Fair Value Gap
Entry
Stop Loss
Take Profit
Risk/Reward
BUY
SELL
WAIT

هیچ ڕستەیەکی ئینگلیزی بە تەواوی مەنووسە، مەگەر ناوی تایبەتی یان وشەی تەکنیکی بێت.

━━━━━━━━━━━━━━━━━━━━━━
وەرگێڕانی ناونیشانەکان
━━━━━━━━━━━━━━━━━━━━━━

Current Price = نرخی ئێستا
Recent Range = مەودای دوایی
Candle Direction = ئاڕاستەی کاندڵ
Market Structure = پێکهاتەی بازاڕ
Market Direction = ئاڕاستەی بازاڕ
News Impact = کاریگەری هەواڵ
Confidence = ڕێژەی دڵنیایی
Decision = بڕیار
Analysis = شیکردنەوە
Reason = هۆکار
Signal = ئاماژە
Liquidity = Liquidity
Order Block = Order Block
Fair Value Gap = FVG

ئەگەر ناونیشان بەکار دەهێنیت، ناونیشانی کوردی بەکاربهێنە.

━━━━━━━━━━━━━━━━━━━━━━
شیکردنەوەی بازاڕ
━━━━━━━━━━━━━━━━━━━━━━

لە شیکردنەوەکەتدا ئەمانە لەبەرچاو بگرە:

1. نرخی ئێستا
2. ئاڕاستەی کاندڵ
3. پێکهاتەی بازاڕ
4. Market Structure
5. BOS
6. CHOCH
7. Liquidity
8. Order Block
9. FVG
10. ICT
11. SMC
12. ALC™
13. هەواڵە گرنگەکان
14. Risk/Reward
15. Entry
16. Stop Loss
17. Take Profit

━━━━━━━━━━━━━━━━━━━━━━
ALC™
━━━━━━━━━━━━━━━━━━━━━━

ALC™ سیستەمێکی جیاوازە و نابێت بە ICT یان SMC تێکەڵ بکرێت.

کاتێک باس لە ALC™ دەکەیت، بە شێوەی جیاواز شیکردنەوەی بکە.

━━━━━━━━━━━━━━━━━━━━━━
داتای ڕاستەوخۆ
━━━━━━━━━━━━━━━━━━━━━━

تەنها ئەو داتایە بەکاربهێنە کە لە live context ـەوە دراوە.

نرخی ساختە مەدۆزەوە.

هەواڵی ساختە مەدۆزەوە.

کاتی ساختە مەدۆزەوە.

ئەگەر داتای بازاڕ بەردەست نەبوو، بە ڕوونی بڵێ:

"داتای ڕاستەوخۆی بازاڕ بەردەست نییە، بۆیە ناتوانم نرخی ئێستا بە دڵنیایی دیاری بکەم."

ئەگەر هەواڵ بەردەست نەبوو، هەواڵێکی خۆت مەدروستکە.

━━━━━━━━━━━━━━━━━━━━━━
BUY / SELL / WAIT
━━━━━━━━━━━━━━━━━━━━━━

هیچکات بە دڵنیایی 100% مەڵێ:

"ئەمە حەتمەن سەرکەوتووە."

یان:

"ئەم Trade ـە 100% دەباتەوە."

ئەگەر پێداچوونەوە و Confirmation تەواو نەبوو، بڕیار:

WAIT

بەکاربهێنە.

BUY یان SELL تەنها کاتێک پێشنیار بکە کە Setup ـێکی ڕوون هەبێت.

━━━━━━━━━━━━━━━━━━━━━━
شێوازی وەڵام
━━━━━━━━━━━━━━━━━━━━━━

کاتێک بەکارهێنەر داوای شیکردنەوەی Trade یان Chart دەکات، ئەگەر داتا بەردەست بوو، ئەم شێوازە بەکاربهێنە:

📊 Symbol:
[ناوی بازاڕ]

⏱ Timeframe:
[Timeframe]

💵 نرخی ئێستا:
[نرخ]

📈 ئاڕاستەی بازاڕ:
[Bullish / Bearish / Neutral]

🧱 پێکهاتەی بازاڕ:
[شیکردنەوە بە کوردی]

💧 Liquidity:
[شیکردنەوە بە کوردی]

🟦 Order Block:
[شیکردنەوە بە کوردی]

🟨 FVG:
[شیکردنەوە بە کوردی]

🧠 ICT / SMC:
[شیکردنەوە بە کوردی]

⚡ ALC™:
[شیکردنەوەی تایبەت بە ALC™]

📰 کاریگەری هەواڵ:
[هەواڵ و کاریگەری بە کوردی]

🎯 Setup:
[Setup بە کوردی]

📍 Entry:
[ئەگەر دەتوانرێت بە داتای بەردەست دیاری بکرێت]

🛑 Stop Loss:
[ئەگەر دەتوانرێت دیاری بکرێت]

💰 Take Profit:
[ئەگەر دەتوانرێت دیاری بکرێت]

⚖️ Risk/Reward:
[ڕێژە]

🔎 Confirmation:
[هۆکارەکانی پشتگیری]

🧠 ڕێژەی دڵنیایی:
[ژمارەیەکی گونجاو، نەک 100%]

⏳ بڕیار:
[BUY / SELL / WAIT]

━━━━━━━━━━━━━━━━━━━━━━
یاسای کۆتایی
━━━━━━━━━━━━━━━━━━━━━━

پێش ناردنی وەڵامەکەت، خۆت پشکنین بکە:

- ئایا وەڵامەکە بە کوردیی سۆرانییە؟
- ئایا ڕستەی ئینگلیزی زۆر تێدا نییە؟
- ئایا هیچ نرخی ساختەم دروست نەکردووە؟
- ئایا هیچ هەواڵێکی ساختەم دروست نەکردووە؟
- ئایا BUY/SELL بەبێ Confirmation نەداوە؟
- ئایا ALC™ لە ICT و SMC جیا کراوەتەوە؟

ئەگەر وەڵامەکەت زۆر بە ئینگلیزی بوو، پێش ناردن بیگۆڕە بۆ کوردیی سۆرانی.

وەڵامی کۆتایی دەبێت سروشتی، ڕوون، کورت و پیشەیی بێت.
`;

  // =========================================================
  // GEMINI
  // =========================================================
  async function callGemini() {
    if (!GEMINI_API_KEY) {
      return null;
    }

    const models = [
      "gemini-3.7-flash",
      "gemini-3.6-flash"
    ];

    for (const model of models) {
      if (remainingTime() <= 2500) {
        break;
      }

      try {
        const parts = [];

        parts.push({
          text:
            `داتای ڕاستەوخۆی ShahanFX:\n\n` +
            JSON.stringify(
              liveContext,
              null,
              2
            )
        });

        parts.push({
          text:
            "\n\nپرسیاری بەکارهێنەر:\n" +
            (message ||
              "ئەم Chart ـە بە وردی بە کوردیی سۆرانی شیکاربکە.")
        });

        if (image) {
          const match = image.match(
            /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/
          );

          if (match) {
            parts.push({
              inline_data: {
                mime_type: match[1],
                data: match[2]
              }
            });
          }
        }

        const url =
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent` +
          `?key=${encodeURIComponent(GEMINI_API_KEY)}`;

        const response = await fetchTimeout(
          url,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              system_instruction: {
                parts: [
                  {
                    text: systemPrompt
                  }
                ]
              },

              contents: [
                {
                  role: "user",
                  parts
                }
              ],

              generationConfig: {
                maxOutputTokens: 2200,
                temperature: 0.3
              }
            })
          },
          Math.min(11000, remainingTime())
        );

        const data = await response.json();

        if (!response.ok) {
          continue;
        }

        const text =
          data?.candidates?.[0]?.content?.parts
            ?.map((part) => part.text || "")
            .join("")
            .trim();

        if (text) {
          return {
            provider: "gemini",
            model,
            answer: clean(text)
          };
        }
      } catch {
        // Continue to next model / fallback
      }
    }

    return null;
  }

  // =========================================================
  // OPENROUTER FALLBACK
  // =========================================================
  async function callOpenRouter() {
    if (!OPENROUTER_API_KEY) {
      return null;
    }

    if (remainingTime() <= 2500) {
      return null;
    }

    try {
      const response = await fetchTimeout(
        "https://openrouter.ai/api/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization:
              `Bearer ${OPENROUTER_API_KEY}`,
            "HTTP-Referer":
              "https://shahanfx-backend-9576.vercel.app",
            "X-Title": "ShahanFX AI Pro"
          },

          body: JSON.stringify({
            model: "openrouter/free",

            messages: [
              {
                role: "system",
                content: systemPrompt
              },

              {
                role: "system",
                content:
                  "گرنگترین یاسا: وەڵامی کۆتایی تەنها بە کوردیی سۆرانی بێت، جگە لە وشە تەکنیکییە پێویستەکان."
              },

              {
                role: "user",
                content:
                  `داتای ڕاستەوخۆ:\n${JSON.stringify(
                    liveContext,
                    null,
                    2
                  )}\n\n` +
                  `پرسیاری بەکارهێنەر:\n${
                    message ||
                    "ئەم Chart ـە بە وردی بە کوردیی سۆرانی شیکاربکە."
                  }`
              }
            ],

            max_tokens: 2200,

            temperature: 0.3
          })
        },
        Math.min(10000, remainingTime())
      );

      const data = await response.json();

      if (!response.ok) {
        return null;
      }

      const text =
        data?.choices?.[0]?.message?.content?.trim();

      if (!text) {
        return null;
      }

      return {
        provider: "openrouter",
        model:
          data?.model ||
          "openrouter/free",
        answer: clean(text)
      };
    } catch {
      return null;
    }
  }

  // =========================================================
  // CALL AI
  // =========================================================
  let aiResult = await callGemini();

  if (!aiResult) {
    aiResult = await callOpenRouter();
  }

  // =========================================================
  // AI FAILURE
  // =========================================================
  if (!aiResult) {
    return res.status(503).json({
      ok: false,
      error:
        "هیچ یەکێک لە سیستەمەکانی AI وەڵامی نەدا. تکایە دووبارە هەوڵ بدەوە.",
      liveData: {
        market: market?.available === true,
        news: news?.available === true
      }
    });
  }

  // =========================================================
  // FINAL RESPONSE
  // =========================================================
  return res.status(200).json({
    ok: true,

    success: true,

    answer: aiResult.answer,

    provider: aiResult.provider,

    model: aiResult.model,

    image: Boolean(image),

    liveData: true,

    market: {
      available: Boolean(market?.available),
      symbol,
      interval,
      direction:
        market?.direction || "neutral",

      currentPrice:
        market?.current?.close ?? null,

      datetime:
        market?.current?.datetime ?? null
    },

    news: {
      available: Boolean(news?.available),

      events:
        Array.isArray(news?.events)
          ? news.events
          : []
    }
  });
}
