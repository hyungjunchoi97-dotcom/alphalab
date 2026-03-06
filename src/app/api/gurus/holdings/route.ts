import { NextResponse } from "next/server";

export const runtime = "nodejs";

interface Holding {
  ticker: string;
  company: string;
  shares: number;
  value: number; // in $1000s
  weight: number; // % of portfolio
}

interface GuruData {
  id: string;
  name: string;
  fund: string;
  cik: string;
  holdings: Holding[];
  totalValue: number;
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
  { id: "lilu", name: "Li Lu", fund: "Himalaya Capital", cik: "0001709323" },
  { id: "spier", name: "Guy Spier", fund: "Aquamarine Capital", cik: "0001541996" },
  // Macro/Global
  { id: "druckenmiller", name: "Stanley Druckenmiller", fund: "Duquesne Family Office", cik: "0001536411" },
  { id: "dalio", name: "Ray Dalio", fund: "Bridgewater Associates", cik: "0001350694" },
  { id: "tudor", name: "Paul Tudor Jones", fund: "Tudor Investment", cik: "0000860546" },
  { id: "tepper", name: "David Tepper", fund: "Appaloosa Management", cik: "0001656456" },
  // Growth/Tech
  { id: "ark", name: "Cathie Wood", fund: "ARK Invest", cik: "0001697748" },
  { id: "laffont", name: "Philippe Laffont", fund: "Coatue Management", cik: "0001336532" },
  { id: "coleman", name: "Chase Coleman", fund: "Tiger Global", cik: "0001167483" },
  // Activist
  { id: "ackman", name: "Bill Ackman", fund: "Pershing Square", cik: "0001336528" },
  { id: "loeb", name: "Dan Loeb", fund: "Third Point", cik: "0001040273" },
];

const SEC_HEADERS = {
  "User-Agent": "Alphalab Research contact@alphalab.com",
  Accept: "application/json",
};

async function fetch13F(cik: string): Promise<{
  holdings: Holding[];
  totalValue: number;
  lastFiled: string;
}> {
  try {
    // Step 1: Get recent filings
    const subUrl = `https://data.sec.gov/submissions/CIK${cik}.json`;
    const subRes = await fetch(subUrl, { headers: SEC_HEADERS, signal: AbortSignal.timeout(15000) });
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

    // Step 2: Fetch the 13F XML data
    const accessionClean = accession.replace(/-/g, "");
    const indexUrl = `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${cik}&type=13F-HR&dateb=&owner=include&count=1&search_text=&action=getcompany`;

    // Try to fetch infotable directly
    const tableUrl = `https://data.sec.gov/Archives/edgar/data/${cik.replace(/^0+/, "")}/${accessionClean}`;

    // List files in the filing
    const listRes = await fetch(`${tableUrl}/index.json`, {
      headers: SEC_HEADERS,
      signal: AbortSignal.timeout(15000),
    });

    if (!listRes.ok) {
      return { holdings: [], totalValue: 0, lastFiled: filedDate };
    }

    const listJson = await listRes.json();
    const files = listJson.directory?.item || [];

    // Find infotable XML file
    let infoFile = "";
    for (const f of files) {
      const name = (f.name || "").toLowerCase();
      if (name.includes("infotable") && (name.endsWith(".xml") || name.endsWith(".html"))) {
        infoFile = f.name;
        break;
      }
    }

    // Fallback: any XML that's not primary doc
    if (!infoFile) {
      for (const f of files) {
        const name = (f.name || "").toLowerCase();
        if (name.endsWith(".xml") && !name.includes("primary") && !name.includes("R")) {
          infoFile = f.name;
          break;
        }
      }
    }

    if (!infoFile) {
      return { holdings: [], totalValue: 0, lastFiled: filedDate };
    }

    const xmlRes = await fetch(`${tableUrl}/${infoFile}`, {
      headers: SEC_HEADERS,
      signal: AbortSignal.timeout(15000),
    });

    if (!xmlRes.ok) {
      return { holdings: [], totalValue: 0, lastFiled: filedDate };
    }

    const xml = await xmlRes.text();

    // Parse XML for holdings
    const holdings: Holding[] = [];
    const infoBlocks = xml.split(/<infoTable>/i);

    for (let i = 1; i < infoBlocks.length; i++) {
      const block = infoBlocks[i];
      const nameMatch = block.match(/<nameOfIssuer>(.*?)<\/nameOfIssuer>/i);
      const tickerMatch = block.match(/<titleOfClass>(.*?)<\/titleOfClass>/i);
      const valueMatch = block.match(/<value>(.*?)<\/value>/i);
      const sharesMatch = block.match(/<sshPrnamt>(.*?)<\/sshPrnamt>/i);

      if (nameMatch && valueMatch) {
        holdings.push({
          company: nameMatch[1].trim(),
          ticker: tickerMatch ? tickerMatch[1].trim().replace(/ COM.*| CL [AB].*| SHS.*/i, "") : "",
          value: parseInt(valueMatch[1]) || 0,
          shares: parseInt(sharesMatch?.[1]?.replace(/,/g, "") || "0") || 0,
          weight: 0,
        });
      }
    }

    // Calculate total and weights
    const totalValue = holdings.reduce((s, h) => s + h.value, 0);
    for (const h of holdings) {
      h.weight = totalValue > 0 ? (h.value / totalValue) * 100 : 0;
    }

    // Sort by value descending, keep top 30
    holdings.sort((a, b) => b.value - a.value);

    return {
      holdings: holdings.slice(0, 30),
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
    const results = await Promise.allSettled(GURUS.map((g) => fetch13F(g.cik)));

    const gurus: GuruData[] = GURUS.map((g, i) => {
      const r = results[i];
      const data = r.status === "fulfilled" ? r.value : { holdings: [], totalValue: 0, lastFiled: "" };
      return {
        id: g.id,
        name: g.name,
        fund: g.fund,
        cik: g.cik,
        holdings: data.holdings,
        totalValue: data.totalValue,
        lastFiled: data.lastFiled,
      };
    });

    cache = { data: gurus, cachedAt: Date.now() };
    return NextResponse.json({ ok: true, gurus });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Unknown error", gurus: [] },
      { status: 500 }
    );
  }
}
