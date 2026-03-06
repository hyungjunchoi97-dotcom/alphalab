import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseServer";

export const runtime = "nodejs";

const SEED_POSTS = [
  { title: "삼성전자 지금 들어가도 될까요? 52주 신저가 근처", content: "PBR 1 이하인데 역사적으로 이 구간에서 매수하면 1년 뒤 수익률이 좋았습니다. 다만 반도체 업황이 불확실해서 고민이네요. 분할매수 vs 관망 어떻게 생각하세요?", category: "stock", symbol: "005930" },
  { title: "연준 QT 종료 시그널? 순유동성 바닥론", content: "FRED 데이터 보면 RRP 잔고가 거의 바닥나고, TGA도 줄어드는 추세. QT 축소 또는 종료 시그널이 나올 수 있다는 분석이 있는데 어떻게 보시나요? 유동성 장세 재개 가능성?", category: "macro" },
  { title: "비트코인 10만달러 재돌파 가능성", content: "ETF 순유입 계속되고 있고, 반감기 효과도 아직 남아있다고 봅니다. 기관 자금이 꾸준히 들어오고 있어서 연내 신고가 가능하지 않을까요?", category: "crypto", symbol: "BTC" },
  { title: "드러켄밀러 포트폴리오 변화 분석", content: "13F 공시 보니까 AI 관련주 비중을 대폭 늘렸더라구요. NVDA, MSFT 포지션 확대하고 헬스케어는 줄였습니다. 매크로 구루들이 AI 쪽으로 쏠리는 느낌.", category: "overseas", symbol: "NVDA" },
  { title: "FOMC 3월 동결 확실시, 그 다음은?", content: "CME FedWatch 보면 3월은 95% 이상 동결 확률인데, 6월 인하 확률이 조금씩 올라가고 있습니다. 고용지표가 약해지면 하반기 인하 사이클 시작할 수도 있을 것 같은데.", category: "macro" },
  { title: "SK하이닉스 HBM4 수주 소식 어떻게 보시나요", content: "엔비디아 블랙웰 향 HBM4 독점 공급 가능성이 나오고 있는데, 주가에는 이미 반영된 건지 아직 업사이드가 있는 건지 판단이 어렵습니다.", category: "stock", symbol: "000660" },
  { title: "원달러 1450 돌파 가능성 vs 방어선", content: "한은이 계속 구두개입 하고 있는데 실탄이 부족하다는 말도 있고... 수출 기업은 좋은데 내수 기업이랑 소비자에게는 타격이 크죠. 1400대 안착하면 포트폴리오 리밸런싱 고려 중입니다.", category: "macro" },
  { title: "ETF vs 개별주 요즘 어떻게들 하세요?", content: "개별주 피킹이 너무 어려워서 KODEX 200, TIGER 미국S&P500 이런 걸로 갈아타려고 하는데... 수수료나 추적오차 비교해보신 분 계신가요?", category: "question" },
  { title: "한화에어로스페이스 방산주 아직 갈길이 멀다", content: "글로벌 방산 지출 증가 트렌드는 최소 5-10년 지속될 거라고 봅니다. K-방산 수출도 계속 증가세. 장기 보유 관점에서 아직 초입이라고 생각합니다.", category: "stock", symbol: "012450" },
  { title: "이더리움 ETF 승인 이후 전망", content: "비트코인 ETF 때처럼 승인 후 단기 조정 가능성도 있지만, 중장기적으로 기관 자금 유입은 확실시. 스테이킹 수익률까지 감안하면 매력적인 자산이라고 봅니다.", category: "crypto", symbol: "ETH" },
  { title: "미국 대선이 시장에 미치는 영향 정리", content: "역사적으로 대선 해에는 변동성이 높아지지만 연말까지는 상승하는 경우가 많았습니다. 현재 정책 차이: 관세, 세제, 에너지 정책 등이 섹터별 차별화를 만들 수 있습니다.", category: "politics" },
  { title: "테슬라 로보택시 + 옵티머스, 어떻게 평가하시나요?", content: "자동차 회사 밸류에이션으로 보면 비싸지만 로보틱스 + AI + 에너지 기업으로 보면 합리적이라는 시각도 있습니다. FSD 기술 격차가 핵심인데...", category: "overseas", symbol: "TSLA" },
  { title: "금리 인하기에 어떤 섹터가 유리할까요?", content: "리츠, 유틸리티, 성장주가 금리 인하기에 강했다는 데이터가 있는데, 이번 사이클에서도 같을까요? AI 모멘텀이 워낙 강해서 전통적 패턴이 깨질 수도 있겠다 싶습니다.", category: "question" },
  { title: "네이버 vs 카카오, 2026년 승자는?", content: "네이버는 AI 검색 + 커머스 + 일본(라인야후) 성장이 견조하고, 카카오는 구조조정 이후 핵심사업 집중. 둘 다 저평가 구간이라는 의견도 있는데.", category: "stock", symbol: "035420" },
  { title: "요즘 가장 핫한 투자 유튜브 채널 추천", content: "슈카월드, 삼프로TV 외에 괜찮은 투자 유튜브 채널 있으면 추천해주세요. 영어 채널도 환영합니다. 최근 발견한 좋은 채널 공유합니다.", category: "free" },
  { title: "일본 BOJ 금리인상 영향 분석", content: "일본이 마이너스 금리 시대를 끝내고 추가 인상을 시사하고 있습니다. 엔캐리 트레이드 청산 우려는 과도한 것 같고, 오히려 일본 은행주에 기회가 있다고 봅니다.", category: "overseas" },
  { title: "2차전지 관련주 바닥은 어디일까", content: "에코프로, 에코프로비엠, 포스코퓨처엠 등 2차전지 관련주가 계속 하락 중인데, LFP vs 삼원계 논쟁에서 한국 기업들이 경쟁력을 유지할 수 있을지 걱정입니다.", category: "stock", symbol: "247540" },
  { title: "정치 리스크가 시장에 미치는 영향", content: "국내 정치 불확실성이 커지면서 외국인 순매도가 계속되고 있습니다. 과거 사례를 보면 정치 이벤트 해소 후 반등하는 패턴이 있었는데, 이번에도 같을까요?", category: "politics" },
  { title: "초보 투자자입니다. 첫 투자 어떻게 시작하면 좋을까요?", content: "사회초년생인데 월 50만원 정도 투자하려고 합니다. 적금 대신 ETF로 시작하는 게 나을까요? 추천 포트폴리오가 있다면 알려주세요.", category: "question" },
  { title: "주말 잡담 - 이번 주 수익률 공유", content: "이번 주 코스피 약보합이었는데 포트폴리오 수익률 어떠셨나요? 저는 방산주 덕분에 +1.2% 정도 나왔습니다. 다들 공유해주세요!", category: "free" },
];

// Pseudo user ID for seeded posts
const SEED_USER_ID = "00000000-0000-0000-0000-000000000001";
const SEED_AUTHORS = [
  "investor_kim", "macro_trader", "crypto_bear", "value_hunter",
  "quant_dev", "etf_master", "growth_seeker", "dividend_king",
  "alpha_seeker", "market_watcher",
];

export async function POST(req: NextRequest) {
  try {
    const pin = req.headers.get("x-admin-pin");
    if (pin !== process.env.ADMIN_PIN) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const now = Date.now();
    const posts = SEED_POSTS.map((p, i) => ({
      user_id: SEED_USER_ID,
      author_email: `${SEED_AUTHORS[i % SEED_AUTHORS.length]}@alphalab.kr`,
      title: p.title,
      content: p.content,
      category: p.category,
      symbol: p.symbol || null,
      likes: Math.floor(Math.random() * 30) + 1,
      created_at: new Date(now - i * 3600000 * (2 + Math.random() * 10)).toISOString(),
    }));

    const { data, error } = await supabaseAdmin
      .from("posts")
      .insert(posts)
      .select();

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, count: data?.length || 0 });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
