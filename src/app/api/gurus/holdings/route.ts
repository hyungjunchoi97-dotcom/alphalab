import { NextResponse } from "next/server";

export const runtime = "nodejs";

interface Holding {
  ticker: string;
  company: string;
  shares: number;
  value: number; // in $1000s (normalized)
  weight: number; // % of portfolio
  cusip: string;
}

interface GuruData {
  id: string;
  name: string;
  fund: string;
  cik: string;
  holdings: Holding[];
  totalValue: number; // in $1000s
  lastFiled: string;
}

interface CacheEntry {
  data: GuruData[];
  cachedAt: number;
}

const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours
let cache: CacheEntry | null = null;

const GURUS = [
  // Value
  { id: "berkshire", name: "Warren Buffett", fund: "Berkshire Hathaway", cik: "0001067983" },
  { id: "pabrai", name: "Mohnish Pabrai", fund: "Pabrai Funds", cik: "0001173334" },
  { id: "burry", name: "Michael Burry", fund: "Scion Asset Management", cik: "0001649339" },
  { id: "einhorn", name: "David Einhorn", fund: "Greenlight Capital", cik: "0001079114" },
  { id: "klarman", name: "Seth Klarman", fund: "Baupost Group", cik: "0000886068" },
  // Macro/Global
  { id: "druckenmiller", name: "Stanley Druckenmiller", fund: "Duquesne Family Office", cik: "0001536411" },
  { id: "tepper", name: "David Tepper", fund: "Appaloosa Management", cik: "0001656456" },
  { id: "cohen", name: "Steve Cohen", fund: "Point72 Asset Management", cik: "0001603466" },
  { id: "englander", name: "Israel Englander", fund: "Millennium Management", cik: "0001273931" },
  // Growth/Tech
  { id: "ark", name: "Cathie Wood", fund: "ARK Invest", cik: "0001697748" },
  { id: "coleman", name: "Chase Coleman", fund: "Tiger Global", cik: "0001167483" },
  { id: "halvorsen", name: "Andreas Halvorsen", fund: "Viking Global", cik: "0001103804" },
  { id: "twosigma", name: "John Overdeck & David Siegel", fund: "Two Sigma", cik: "0001423053" },
  // Activist
  { id: "ackman", name: "Bill Ackman", fund: "Pershing Square", cik: "0001336528" },
  { id: "griffin", name: "Ken Griffin", fund: "Citadel Advisors", cik: "0001423298" },
];

const SEC_HEADERS = {
  "User-Agent": "AlphaLab contact@thealphalabs.net",
  Accept: "application/json",
};

const SEC_HEADERS_HTML = {
  "User-Agent": "AlphaLab contact@thealphalabs.net",
  Accept: "text/html",
};

// Rate limiter: SEC allows 10 req/sec
function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetch13F(cik: string): Promise<{
  holdings: Holding[];
  totalValue: number;
  lastFiled: string;
}> {
  try {
    // Step 1: Get recent filings from submissions endpoint
    const subUrl = `https://data.sec.gov/submissions/CIK${cik}.json`;
    const subRes = await fetch(subUrl, { headers: SEC_HEADERS, signal: AbortSignal.timeout(20000) });
    if (!subRes.ok) {
      console.error(`[sec] ${cik} submissions HTTP ${subRes.status}`);
      return { holdings: [], totalValue: 0, lastFiled: "" };
    }
    const subJson = await subRes.json();

    // Find latest 13F-HR filing
    const filings = subJson.filings?.recent;
    if (!filings) return { holdings: [], totalValue: 0, lastFiled: "" };

    let accession = "";
    let filedDate = "";
    for (let i = 0; i < filings.form.length; i++) {
      if (filings.form[i] === "13F-HR" || filings.form[i] === "13F-HR/A") {
        accession = filings.accessionNumber[i];
        filedDate = filings.filingDate[i];
        break;
      }
    }

    if (!accession) return { holdings: [], totalValue: 0, lastFiled: "" };

    await delay(150); // Rate limit

    // Step 2: Scrape filing directory to find infotable XML
    const cikNum = cik.replace(/^0+/, "");
    const accessionClean = accession.replace(/-/g, "");
    const dirUrl = `https://www.sec.gov/Archives/edgar/data/${cikNum}/${accessionClean}/`;

    const dirRes = await fetch(dirUrl, {
      headers: SEC_HEADERS_HTML,
      signal: AbortSignal.timeout(20000),
    });

    if (!dirRes.ok) {
      console.error(`[sec] ${cik} directory listing HTTP ${dirRes.status}`);
      return { holdings: [], totalValue: 0, lastFiled: filedDate };
    }

    const dirHtml = await dirRes.text();

    // Find XML files from directory listing (exclude primary_doc.xml and index files)
    const xmlFiles: string[] = [];
    const hrefMatches = dirHtml.matchAll(/href="[^"]*\/([^"]+\.xml)"/g);
    for (const m of hrefMatches) {
      const fname = m[1];
      if (
        fname !== "primary_doc.xml" &&
        !fname.includes("-index") &&
        !fname.startsWith("R") &&
        !fname.startsWith("Financial")
      ) {
        xmlFiles.push(fname);
      }
    }

    // Prefer files with "infotable" or "13f" in name, otherwise take the largest XML
    let infoFile = xmlFiles.find((f) => f.toLowerCase().includes("infotable"));
    if (!infoFile) infoFile = xmlFiles.find((f) => f.toLowerCase().includes("13f") || f.toLowerCase().includes("form13"));
    if (!infoFile && xmlFiles.length > 0) infoFile = xmlFiles[0];

    if (!infoFile) {
      console.error(`[sec] ${cik} no infotable XML found in ${xmlFiles.join(", ")}`);
      return { holdings: [], totalValue: 0, lastFiled: filedDate };
    }

    await delay(150); // Rate limit

    // Step 3: Fetch the infotable XML
    const xmlUrl = `${dirUrl}${infoFile}`;
    const xmlRes = await fetch(xmlUrl, {
      headers: SEC_HEADERS_HTML,
      signal: AbortSignal.timeout(20000),
    });

    if (!xmlRes.ok) {
      console.error(`[sec] ${cik} infotable XML HTTP ${xmlRes.status}`);
      return { holdings: [], totalValue: 0, lastFiled: filedDate };
    }

    const xml = await xmlRes.text();

    // Step 4: Parse XML for holdings
    // Split on <infoTable> tags (case-insensitive, with or without namespace)
    const holdings: Holding[] = [];
    const blocks = xml.split(/<(?:n1:)?infoTable>/i);

    for (let i = 1; i < blocks.length; i++) {
      const block = blocks[i];
      const nameMatch = block.match(/<(?:n1:)?nameOfIssuer>(.*?)<\/(?:n1:)?nameOfIssuer>/i);
      const titleMatch = block.match(/<(?:n1:)?titleOfClass>(.*?)<\/(?:n1:)?titleOfClass>/i);
      const cusipMatch = block.match(/<(?:n1:)?cusip>(.*?)<\/(?:n1:)?cusip>/i);
      const valueMatch = block.match(/<(?:n1:)?value>(.*?)<\/(?:n1:)?value>/i);
      const sharesMatch = block.match(/<(?:n1:)?sshPrnamt>(.*?)<\/(?:n1:)?sshPrnamt>/i);
      const putCallMatch = block.match(/<(?:n1:)?putCall>(.*?)<\/(?:n1:)?putCall>/i);

      if (nameMatch && valueMatch) {
        const company = nameMatch[1].trim();
        const title = titleMatch ? titleMatch[1].trim() : "";
        // Clean up ticker from titleOfClass
        const ticker = title.replace(/\s*(COM|SHS|CL [A-Z]|CLASS [A-Z]|NEW|ORD|SEDOL.*|ISIN.*).*$/i, "").trim() || "";

        holdings.push({
          company,
          ticker,
          cusip: cusipMatch ? cusipMatch[1].trim() : "",
          value: parseInt(valueMatch[1].replace(/,/g, "")) || 0,
          shares: parseInt(sharesMatch?.[1]?.replace(/,/g, "") || "0") || 0,
          weight: 0,
        });
      }
    }

    // Aggregate by company+cusip (some filers split holdings by manager)
    const aggregated = new Map<string, Holding>();
    for (const h of holdings) {
      const key = h.cusip || h.company;
      const existing = aggregated.get(key);
      if (existing) {
        existing.value += h.value;
        existing.shares += h.shares;
      } else {
        aggregated.set(key, { ...h });
      }
    }
    const mergedHoldings = Array.from(aggregated.values());

    // Calculate total value
    let totalValue = mergedHoldings.reduce((s, h) => s + h.value, 0);

    // Normalize value units: SEC 13F traditionally uses $1000s, but some large filers
    // report in dollars. Heuristic: if total > 1e9, it's in dollars, convert to thousands.
    if (totalValue > 1e9) {
      for (const h of mergedHoldings) {
        h.value = Math.round(h.value / 1000);
      }
      totalValue = mergedHoldings.reduce((s, h) => s + h.value, 0);
    }

    // Calculate weights
    for (const h of mergedHoldings) {
      h.weight = totalValue > 0 ? (h.value / totalValue) * 100 : 0;
    }

    // Sort by value descending, keep top 30
    mergedHoldings.sort((a, b) => b.value - a.value);

    return {
      holdings: mergedHoldings.slice(0, 30),
      totalValue,
      lastFiled: filedDate,
    };
  } catch (err) {
    console.error(`[sec] Error fetching 13F for ${cik}:`, err instanceof Error ? err.message : err);
    return { holdings: [], totalValue: 0, lastFiled: "" };
  }
}

export async function GET() {
  if (cache && Date.now() - cache.cachedAt < CACHE_TTL) {
    return NextResponse.json({ ok: true, gurus: cache.data });
  }

  try {
    // Fetch in batches of 4 to respect SEC rate limits
    const gurus: GuruData[] = [];
    for (let batch = 0; batch < GURUS.length; batch += 4) {
      const slice = GURUS.slice(batch, batch + 4);
      const results = await Promise.allSettled(slice.map((g) => fetch13F(g.cik)));

      for (let i = 0; i < slice.length; i++) {
        const g = slice[i];
        const r = results[i];
        const data = r.status === "fulfilled" ? r.value : { holdings: [], totalValue: 0, lastFiled: "" };
        gurus.push({
          id: g.id,
          name: g.name,
          fund: g.fund,
          cik: g.cik,
          holdings: data.holdings,
          totalValue: data.totalValue,
          lastFiled: data.lastFiled,
        });
      }

      // Delay between batches
      if (batch + 4 < GURUS.length) {
        await delay(500);
      }
    }

    cache = { data: gurus, cachedAt: Date.now() };
    return NextResponse.json({ ok: true, gurus }, {
      headers: { "Cache-Control": "s-maxage=3600, stale-while-revalidate=7200" },
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Unknown error", gurus: [] },
      { status: 500 }
    );
  }
}
