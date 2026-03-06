import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseServer";
import { supabase } from "@/lib/supabaseClient";

export const runtime = "nodejs";

// ── Types ────────────────────────────────────────────────────

interface PredictionRow {
  id: string;
  title_en: string;
  title_kr: string;
  description_en: string;
  description_kr: string;
  category: string;
  status: string;
  closes_at: string;
  created_at: string;
  resolved_option_id: string | null;
}

// ── Seed data ────────────────────────────────────────────────

const SEEDS = [
  {
    title_en: "March: KOSPI 2,800 reached?",
    title_kr: "3월: 코스피 2,800 도달?",
    description_en: "Will KOSPI index close above 2,800 at any point during March 2026?",
    description_kr: "2026년 3월 중 코스피 지수가 2,800을 넘어 마감할까요?",
    category: "stocks",
    closes_at: new Date(Date.now() + 28 * 86400000).toISOString(),
  },
  {
    title_en: "Samsung Q1 earnings beat consensus?",
    title_kr: "삼성 1분기 실적 컨센서스 상회?",
    description_en: "Will Samsung Electronics report Q1 2026 operating profit above analyst consensus of ₩7.2T?",
    description_kr: "삼성전자 2026년 1분기 영업이익이 애널리스트 컨센서스 7.2조원을 상회할까요?",
    category: "stocks",
    closes_at: new Date(Date.now() + 45 * 86400000).toISOString(),
  },
  {
    title_en: "NVIDIA hits $200 before April?",
    title_kr: "4월 전 엔비디아 $200 도달?",
    description_en: "Will NVIDIA stock price reach $200 per share before April 1, 2026?",
    description_kr: "2026년 4월 1일 전에 엔비디아 주가가 주당 $200에 도달할까요?",
    category: "stocks",
    closes_at: new Date(Date.now() + 30 * 86400000).toISOString(),
  },
  {
    title_en: "Seoul apt prices up 5%+ in H1 2026?",
    title_kr: "2026 상반기 서울 아파트 5%+ 상승?",
    description_en: "Will average Seoul apartment prices rise more than 5% in the first half of 2026?",
    description_kr: "2026년 상반기 서울 아파트 평균 가격이 5% 이상 오를까요?",
    category: "realestate",
    closes_at: new Date(Date.now() + 90 * 86400000).toISOString(),
  },
  {
    title_en: "Jeonse index drops below 90 by June?",
    title_kr: "6월까지 전세지수 90 이하 하락?",
    description_en: "Will the KB Jeonse Price Index fall below 90 before June 30, 2026?",
    description_kr: "2026년 6월 30일 전에 KB 전세가격지수가 90 아래로 떨어질까요?",
    category: "realestate",
    closes_at: new Date(Date.now() + 80 * 86400000).toISOString(),
  },
  {
    title_en: "Next FOMC: rate cut happens?",
    title_kr: "다음 FOMC: 금리 인하?",
    description_en: "Will the Federal Reserve announce a rate cut at the next FOMC meeting?",
    description_kr: "다음 FOMC 회의에서 연준이 금리 인하를 발표할까요?",
    category: "politics",
    closes_at: new Date(Date.now() + 35 * 86400000).toISOString(),
  },
  {
    title_en: "Korea snap election called before July?",
    title_kr: "7월 전 한국 조기선거 실시?",
    description_en: "Will a snap presidential election be called in South Korea before July 2026?",
    description_kr: "2026년 7월 전에 한국에서 조기 대선이 실시될까요?",
    category: "politics",
    closes_at: new Date(Date.now() + 60 * 86400000).toISOString(),
  },
  {
    title_en: "USD/KRW below 1,350 by end of March?",
    title_kr: "3월 말까지 달러/원 1,350 이하?",
    description_en: "Will the USD/KRW exchange rate trade below 1,350 before March 31, 2026?",
    description_kr: "2026년 3월 31일 전에 달러/원 환율이 1,350 아래로 거래될까요?",
    category: "other",
    closes_at: new Date(Date.now() + 28 * 86400000).toISOString(),
  },
  {
    title_en: "Bitcoin above $120k before May?",
    title_kr: "5월 전 비트코인 $120k 돌파?",
    description_en: "Will Bitcoin reach $120,000 USD before May 1, 2026?",
    description_kr: "2026년 5월 1일 전에 비트코인이 12만 달러를 돌파할까요?",
    category: "other",
    closes_at: new Date(Date.now() + 55 * 86400000).toISOString(),
  },
];

async function seedIfEmpty() {
  const { count } = await supabaseAdmin
    .from("predictions")
    .select("id", { count: "exact", head: true });
  if (count && count > 0) return;

  await supabaseAdmin.from("predictions").insert(
    SEEDS.map((s) => ({
      ...s,
      status: "open",
      resolved_option_id: null,
    }))
  );
}

// ── GET: fetch all predictions + vote counts ─────────────────

export async function GET() {
  try {
    await seedIfEmpty();

    const { data: rows, error } = await supabaseAdmin
      .from("predictions")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    // Get all votes and count per prediction+option
    const { data: allVotes } = await supabaseAdmin
      .from("prediction_votes")
      .select("prediction_id, option_id");

    const voteMap: Record<string, { yes: number; no: number }> = {};
    if (allVotes) {
      for (const v of allVotes) {
        if (!voteMap[v.prediction_id]) voteMap[v.prediction_id] = { yes: 0, no: 0 };
        if (v.option_id === "yes") voteMap[v.prediction_id].yes++;
        if (v.option_id === "no") voteMap[v.prediction_id].no++;
      }
    }

    const predictions = (rows as PredictionRow[]).map((r) => {
      const yesCount = voteMap[r.id]?.yes ?? 0;
      const noCount = voteMap[r.id]?.no ?? 0;
      const total = yesCount + noCount;
      return {
        id: r.id,
        title: { en: r.title_en, kr: r.title_kr },
        description: { en: r.description_en, kr: r.description_kr },
        category: r.category,
        status: r.status,
        closesAt: r.closes_at,
        createdAt: r.created_at,
        resolvedOptionId: r.resolved_option_id,
        stats: {
          yesCount,
          noCount,
          participants: total,
          yesPct: total > 0 ? Math.round((yesCount / total) * 100) : 50,
          noPct: total > 0 ? Math.round((noCount / total) * 100) : 50,
        },
      };
    });

    return NextResponse.json({ ok: true, predictions });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}

// ── POST: create new prediction (auth required) ──────────────

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (authError || !user) {
      return NextResponse.json({ ok: false, error: "Invalid token" }, { status: 401 });
    }

    const body = await req.json();
    const { title_en, title_kr, description_en, description_kr, category, closes_at } = body;

    if (!title_en) {
      return NextResponse.json({ ok: false, error: "title_en required" }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin.from("predictions").insert({
      title_en,
      title_kr: title_kr || title_en,
      description_en: description_en || "",
      description_kr: description_kr || "",
      category: category || "other",
      status: "open",
      closes_at: closes_at || new Date(Date.now() + 7 * 86400000).toISOString(),
      resolved_option_id: null,
    }).select().single();

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, prediction: data });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
