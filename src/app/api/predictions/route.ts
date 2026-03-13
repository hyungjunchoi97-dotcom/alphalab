import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseServer";
import { supabase } from "@/lib/supabaseClient";
import { calculateAMM } from "@/lib/amm";

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
  yes_pool: number | null;
  no_pool: number | null;
}

// ── Seed data ────────────────────────────────────────────────

const SEEDS = [
  {
    title_en: "March: KOSPI 2,800 reached?",
    title_kr: "3월: 코스피 2,800 도달?",
    description_en: "Will KOSPI index close above 2,800 at any point during March 2026?",
    description_kr: "2026년 3월 중 코스피 지수가 2,800을 넘어 마감할까요?",
    category: "stocks",
    closes_at: new Date(Date.now() + 25 * 86400000).toISOString(),
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
    closes_at: new Date(Date.now() + 26 * 86400000).toISOString(),
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
    title_en: "Next FOMC: Rate cut?",
    title_kr: "다음 FOMC: 금리 인하?",
    description_en: "Will the Federal Reserve cut the federal funds rate at the next FOMC meeting?",
    description_kr: "다음 FOMC 회의에서 연준이 기준금리를 인하할까요?",
    category: "politics",
    closes_at: new Date(Date.now() + 40 * 86400000).toISOString(),
  },
  {
    title_en: "Seoul apartments +5% in H1 2026?",
    title_kr: "2026 상반기 서울 아파트 5%+ 상승?",
    description_en: "Will Seoul apartment price index rise more than 5% in the first half of 2026?",
    description_kr: "2026년 상반기에 서울 아파트 가격지수가 5% 이상 상승할까요?",
    category: "economy",
    closes_at: new Date(Date.now() + 120 * 86400000).toISOString(),
  },
  {
    title_en: "Jeonse index below 90 by June?",
    title_kr: "6월까지 전세지수 90 이하 하락?",
    description_en: "Will the national jeonse (lease deposit) price index fall below 90 by June 2026?",
    description_kr: "2026년 6월까지 전국 전세가격지수가 90 이하로 하락할까요?",
    category: "economy",
    closes_at: new Date(Date.now() + 90 * 86400000).toISOString(),
  },
  {
    title_en: "BTS full group comeback in 2026?",
    title_kr: "BTS 완전체 컴백 2026년 내?",
    description_en: "Will BTS have a full group comeback (all 7 members) before the end of 2026?",
    description_kr: "2026년 말까지 BTS 완전체(7명 전원) 컴백이 이루어질까요?",
    category: "entertainment",
    closes_at: new Date(Date.now() + 270 * 86400000).toISOString(),
  },
  {
    title_en: "Bitcoin breaks $120k before May?",
    title_kr: "비트코인 $120k 돌파 5월 전?",
    description_en: "Will Bitcoin price break $120,000 USD before May 1, 2026?",
    description_kr: "2026년 5월 1일 전에 비트코인 가격이 $120,000를 돌파할까요?",
    category: "crypto",
    closes_at: new Date(Date.now() + 56 * 86400000).toISOString(),
  },
  {
    title_en: "USD/KRW below 1,350 by end of March?",
    title_kr: "3월까지 달러/원 1,350 이하?",
    description_en: "Will the USD/KRW exchange rate trade below 1,350 before March 31, 2026?",
    description_kr: "2026년 3월 31일 전에 달러/원 환율이 1,350 아래로 거래될까요?",
    category: "other",
    closes_at: new Date(Date.now() + 25 * 86400000).toISOString(),
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
      yes_pool: 100,
      no_pool: 100,
      k_constant: 10000,
    }))
  );
}

// ── GET: fetch all predictions with AMM stats ─────────────────

export async function GET() {
  try {
    await seedIfEmpty();

    const { data: rows, error } = await supabaseAdmin
      .from("predictions")
      .select("id, title_en, title_kr, description_en, description_kr, category, status, closes_at, created_at, resolved_option_id, yes_pool, no_pool")
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    // Participant counts from prediction_bets
    const { data: betCounts } = await supabaseAdmin
      .from("prediction_bets")
      .select("prediction_id, side, user_id");

    const countMap: Record<string, { yesCount: number; noCount: number; participants: Set<string> }> = {};
    for (const b of betCounts ?? []) {
      if (!countMap[b.prediction_id]) countMap[b.prediction_id] = { yesCount: 0, noCount: 0, participants: new Set() };
      if (b.side === "yes") countMap[b.prediction_id].yesCount++;
      else countMap[b.prediction_id].noCount++;
      countMap[b.prediction_id].participants.add(b.user_id);
    }

    const predictions = (rows as PredictionRow[]).map((r) => {
      const yesPool = Number(r.yes_pool) || 100;
      const noPool = Number(r.no_pool) || 100;
      const amm = calculateAMM(yesPool, noPool);
      const counts = countMap[r.id];

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
          yesPool,
          noPool,
          totalPool: yesPool + noPool,
          yesPct: Math.round(amm.yesProbability * 100),
          noPct: Math.round(amm.noProbability * 100),
          yesOdds: amm.yesOdds,
          noOdds: amm.noOdds,
          yesCount: counts?.yesCount ?? 0,
          noCount: counts?.noCount ?? 0,
          participants: counts?.participants.size ?? 0,
          volume: Math.round((yesPool + noPool - 200) * 10) / 10, // pts wagered = pool growth from initial 200
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
      yes_pool: 100,
      no_pool: 100,
      k_constant: 10000,
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
