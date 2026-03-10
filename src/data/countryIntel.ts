export type ExposureDirection = "EXPORTER" | "PRODUCER" | "IMPORT RISK" | "PROCESSOR" | "STRANDED" | "TRANSIT" | "TRADING HUB";

export interface CommodityExposureItem {
  commodity: string;
  direction: ExposureDirection;
  reason: string;
}

export interface CountryIntel {
  political: string;
  economic: string;
  commodity: string;
  geopolitical: string;
  commodityExposure: CommodityExposureItem[];
}

export const COUNTRY_INTEL: Record<string, CountryIntel> = {
  US: {
    political: "공화당 트럼프 2기. 관세 강화, 달러 패권 유지 우선. 재정적자 GDP 6% 지속으로 장기 달러 신뢰 균열 진행 중.",
    economic: "GDP 성장 2.1%, 인플레 고착화로 Fed 금리인하 지연. 부채/GDP 124%로 이자비용이 국방비 초과. 스태그플레이션 리스크 상존.",
    commodity: "세계 최대 원유/천연가스 생산국. LNG 수출 1위로 유럽 에너지 레버리지 보유. 셰일 혁명으로 에너지 자급 달성.",
    geopolitical: "나토 분담금 압박, 대만 방어 의지 불확실. 중국과 반도체/AI 패권 경쟁 격화. 우크라이나 지원 축소 시사.",
    commodityExposure: [
      { commodity: "OIL", direction: "PRODUCER", reason: "세계 최대 생산국(22%). 유가 상승 시 셰일 기업 수혜, 소비자 물가 압박 상충. 에너지 수출로 무역적자 완화." },
      { commodity: "GAS/LNG", direction: "EXPORTER", reason: "LNG 수출 세계 1위. 유럽 에너지 의존으로 지정학 레버리지 확보. 유럽 TTF 가격과 직결." },
      { commodity: "WHEAT", direction: "EXPORTER", reason: "세계 4위 밀 수출국. 달러 결제 곡물 시장 지배로 달러 패권 유지 수단." },
    ],
  },
  CN: {
    political: "시진핑 3기 권력 집중. 대만 통일 의지 공식화. 서방과 디커플링 가속, 글로벌 사우스 연대 강화.",
    economic: "GDP 성장 4.5%이나 부동산 위기로 내수 침체. 디플레이션 압력 지속. 지방정부 부채 위기 잠재. 위안화 국제화 추진 중.",
    commodity: "구리 55%, 리튬 60%, 알루미늄 57% 소비. 희토류 90% 생산 독점. 원자재 소비 블랙홀이자 공급망 지배자.",
    geopolitical: "남중국해 군사화 지속. 대만해협 긴장 고조. 러시아와 전략적 협력 강화. 서방 반도체 제재 대응 자급화 가속.",
    commodityExposure: [
      { commodity: "COPPER", direction: "IMPORT RISK", reason: "글로벌 소비의 55% 담당. 구리 가격 급등 시 제조업 원가 상승, 부동산 침체와 맞물려 내수 압박 가중." },
      { commodity: "OIL", direction: "IMPORT RISK", reason: "원유 수입 세계 1위. GDP의 2.5% 규모. 호르무즈 봉쇄 시 중국 제조업 직격, 전략비축유 90일분 보유." },
      { commodity: "LITHIUM", direction: "PROCESSOR", reason: "리튬 정제의 65% 장악. EV/배터리 산업 글로벌 지배력의 핵심 기반. 서방 공급망 분리 시 최대 레버리지." },
    ],
  },
  EU: {
    political: "EU 통합 결속력 시험대. 극우 부상으로 이민/기후 정책 후퇴. 방위비 자체 조달 논의 본격화. 동유럽 vs 서유럽 이견 확대.",
    economic: "독일 경기침체로 유로존 성장 1% 미만. ECB 금리인하 사이클 진입. 에너지 비용 경쟁력 하락. CBAM 시행으로 통상 마찰.",
    commodity: "에너지 대부분 수입 의존. 러시아 가스 차단 후 미국/카타르 LNG 전환. 탄소국경조정(CBAM)으로 글로벌 통상질서 재편 주도.",
    geopolitical: "나토 동부 방어 강화. 우크라이나 EU 가입 협상 개시. 중국 디리스킹 추진. 서방 제재 체제의 핵심 축.",
    commodityExposure: [
      { commodity: "GAS/LNG", direction: "IMPORT RISK", reason: "러시아 가스 차단 후 미국/카타르 LNG로 전환. 에너지 비용 급등이 유럽 제조업 경쟁력 약화의 핵심 원인." },
      { commodity: "ALUMINUM", direction: "IMPORT RISK", reason: "CBAM 시행으로 중국산 고탄소 알루미늄에 사실상 관세 부과. 역내 제련 재가동 더디어 수입 의존 지속." },
    ],
  },
  RU: {
    political: "푸틴 장기집권 고착. 전시경제 체제. 서방 제재로 중국/인도 의존 심화. 내부 엘리트 불만 축적 중.",
    economic: "GDP 군수 특수로 3% 성장이나 구조적 취약. 인플레 7%+. 루블화 불안. 제재로 기술 접근 차단, 장기 경쟁력 훼손.",
    commodity: "원유 11%, 천연가스 16%, 니켈 7%, 석탄, 밀 대규모 수출국. 에너지를 지정학 무기로 사용. 아시아 할인 판매 지속.",
    geopolitical: "우크라이나 전쟁 장기화. 나토 동진 저지 핵심 목표. 핵 억지력 레버리지 유지. 벨라루스, 북한과 군사 협력.",
    commodityExposure: [
      { commodity: "OIL", direction: "EXPORTER", reason: "원유 수출이 연방 재정의 40%. 유가 $60 이하 시 전쟁 지속 능력 약화. 아시아 할인 판매로 제재 우회 중." },
      { commodity: "GAS/LNG", direction: "EXPORTER", reason: "유럽向 파이프라인 가스 차단 후 LNG로 전환 중. 에너지가 지정학 무기의 핵심." },
      { commodity: "WHEAT", direction: "EXPORTER", reason: "세계 최대 밀 수출국(21%). 흑해 봉쇄 시 글로벌 식량 위기 직접 촉발 가능." },
    ],
  },
  SA: {
    political: "MBS 실질 통치. 비전2030 탈석유 다각화 추진. 미국과 안보 협력 유지하며 중국과도 관계 확대.",
    economic: "유가 의존 재정. $70/bbl 이하 시 재정 적자. 네옴시티 등 대형 프로젝트로 재정 지출 급증. 비석유 GDP 성장 가속 중.",
    commodity: "원유 생산 11%(세계 2위), 확인매장량 세계 1위. OPEC+ 스윙 프로듀서. Aramco가 글로벌 최대 원유 기업.",
    geopolitical: "이란과 관계 정상화(중국 중재). 예멘 내전 개입 지속. 이스라엘 정상화 협상 진행 중. 달러 결제 체계 이탈 가능성 시장 과소평가.",
    commodityExposure: [
      { commodity: "OIL", direction: "EXPORTER", reason: "원유 수출이 GDP의 45%, 재정수입의 70%. 유가 $70 이하 시 재정 적자 전환. OPEC+ 감산 결정권 보유." },
      { commodity: "GAS/LNG", direction: "PRODUCER", reason: "천연가스 세계 6위 생산국. 국내 산업화 연료로 수출보다 내수 활용 중. Vision2030 에너지 다각화 핵심." },
    ],
  },
  IR: {
    political: "최고지도자 하메네이 신정체제. 강경파 주도. 핵협상 교착. 역내 프록시 네트워크(헤즈볼라, 후티, 하마스) 운영.",
    economic: "제재로 GDP 잠재력 40% 수준. 인플레 40%+. 비공식 달러 경제 확산. 원유 밀수출로 중국/인도에 할인 판매.",
    commodity: "원유 확인매장량 세계 4위. 호르무즈 봉쇄 위협이 최대 지정학 레버리지. 천연가스 매장량 세계 2위.",
    geopolitical: "호르무즈 봉쇄 위협으로 글로벌 에너지 시장 인질. 이스라엘과 직접 충돌 위험. 핵무장 임박 논란. 러시아에 드론 공급.",
    commodityExposure: [
      { commodity: "OIL", direction: "EXPORTER", reason: "확인매장량 세계 4위. 제재 우회 밀수출로 하루 150만 배럴 중국/인도에 판매. 호르무즈 봉쇄가 최대 레버리지." },
      { commodity: "GAS/LNG", direction: "STRANDED", reason: "천연가스 매장량 세계 2위이나 제재로 수출 불가. 봉쇄 해제 시 글로벌 LNG 시장 판도 변화." },
    ],
  },
  JP: {
    political: "자민당 연립 취약. 방위비 GDP 2% 확대. 미일 동맹 강화. 엔화 약세 정치 부담.",
    economic: "BOJ 마이너스 금리 탈피 시도. 엔화 약세로 수입물가 부담. 인구감소로 장기 성장 한계. 재정부채 GDP 260%.",
    commodity: "원유, LNG, 철광석, 구리 전량 수입 의존. 에너지 안보 취약성 최고 수준. 원전 재가동으로 우라늄 수입 증가.",
    geopolitical: "중국 군사력 팽창 대응 재무장. 대만 유사시 직접 영향권. 북한 미사일 위협 지속. 미일 동맹이 안보의 전부.",
    commodityExposure: [
      { commodity: "OIL", direction: "IMPORT RISK", reason: "원유 99% 수입 의존. 중동 의존도 90%. 호르무즈 봉쇄 시 일본 경제 즉각 타격. 엔화 약세와 유가 상승 이중 부담." },
      { commodity: "URANIUM", direction: "IMPORT RISK", reason: "원전 재가동 가속으로 우라늄 수요 급증. 에너지 안보 다변화의 핵심 수단. 후쿠시마 이후 정책 대전환." },
      { commodity: "GAS/LNG", direction: "IMPORT RISK", reason: "LNG 수입 세계 2위. JKM 가격 직접 노출. 러시아 사할린 LNG 제재 리스크 상존." },
    ],
  },
  KR: {
    political: "정치 불안정(탄핵 정국). 미중 사이 전략적 모호성 유지. 방산 수출 급성장. 원전 수출 국가전략화.",
    economic: "수출 의존형 경제. 반도체(삼성/SK하이닉스) 사이클에 좌우. 원/달러 환율 민감. 가계부채 GDP 100%+ 부담.",
    commodity: "반도체 글로벌 점유율 60%+. 조선 LNG선 점유율 70%+. 원자재 전량 수입, 에너지 안보 취약.",
    geopolitical: "주한미군 주둔. 북한 핵/미사일 위협 상존. 대중 수출 의존과 미국 동맹 사이 딜레마. 사드 갈등 재현 가능성.",
    commodityExposure: [
      { commodity: "OIL", direction: "IMPORT RISK", reason: "원유 100% 수입 의존. 유가 $10 상승 시 무역수지 연간 $60억 악화. 정제 마진이 S-Oil, SK이노베이션 실적 결정." },
      { commodity: "COPPER", direction: "IMPORT RISK", reason: "반도체/전자 제조의 핵심 소재. LS전선, 대한전선 직접 노출. 전력망 투자 테마의 핵심 변수." },
      { commodity: "LITHIUM/NICKEL", direction: "IMPORT RISK", reason: "배터리 3사(LG엔솔/삼성SDI/SK온) 핵심 원재료. 리튬+니켈 가격이 배터리 셀 원가의 60% 결정." },
    ],
  },
  IN: {
    political: "모디 BJP 3연임. 힌두 민족주의 강화. 전략적 자율성(비동맹 2.0). 러시아, 미국, 중국 모두와 실용적 관계.",
    economic: "GDP 성장 6.5% 고성장 지속. 인구 보너스 최대 수혜국(14억, 중위연령 28세). 인플레이션 관리 중. 제조업 허브로 부상.",
    commodity: "세계 3위 원유 소비국. 러시아 할인 원유 최대 수혜국. 석탄 2위 생산/소비국. 핵심광물 자급 추진 중.",
    geopolitical: "중국과 국경 분쟁 지속(라다크). 파키스탄과 긴장 상존. 쿼드(미일호인) 참여. 러시아 에너지 수입 서방 압박 무시.",
    commodityExposure: [
      { commodity: "OIL", direction: "IMPORT RISK", reason: "원유 수입 세계 3위. GDP 성장의 아킬레스건. 러시아 할인 원유 수입으로 연간 $200억+ 절감 중." },
      { commodity: "COAL", direction: "PRODUCER", reason: "세계 2위 석탄 생산/소비국. 전력의 70%가 석탄 발전. 탈석탄은 2040년 이후 현실적." },
      { commodity: "WHEAT", direction: "PRODUCER", reason: "세계 2위 밀 생산국. 수출 금지/허용이 글로벌 식량 가격에 즉각 영향. 기후 리스크가 최대 변수." },
    ],
  },
  TW: {
    political: "민진당 집권, 독립 성향. 중국의 통일 압박 지속. 미국 무기 지원 확대. 현상 유지 기조.",
    economic: "반도체 의존 경제. TSMC가 GDP의 15%. 중국 수출 의존과 미중 갈등 사이 딜레마. 외환보유고 풍부.",
    commodity: "첨단 반도체(7nm 이하) 글로벌 생산의 90% 독점. 공급 차질 시 글로벌 전자/자동차 산업 마비.",
    geopolitical: "미중 패권 경쟁의 최전선. 중국 군사 훈련 상시화. 봉쇄 시나리오가 글로벌 반도체 공급 붕괴로 직결. 세계에서 가장 위험한 분쟁 지점.",
    commodityExposure: [
      { commodity: "OIL", direction: "IMPORT RISK", reason: "에너지 98% 수입 의존. 중국 봉쇄 시 에너지 공급 즉각 차단 위협. 전략 비축 90일분." },
      { commodity: "GAS/LNG", direction: "IMPORT RISK", reason: "LNG 수입 의존도 높음. 대만해협 봉쇄 = LNG 수입 차단 = 전력 위기 시나리오." },
      { commodity: "COPPER", direction: "IMPORT RISK", reason: "반도체 제조 공정의 핵심 소재. TSMC 생산 차질 시 글로벌 구리 수요에도 영향." },
    ],
  },
  DE: {
    political: "숄츠 연립정부 붕괴, 총선 후 우파 연립 가능성. AfD 부상으로 정치 불안정. 나토 방위비 증액 압박.",
    economic: "러시아 가스 의존 탈피 후 산업 공동화 가속. 제조업 경쟁력 하락. GDP 역성장 우려. 에너지 비용이 핵심 약점.",
    commodity: "원자재 대부분 수입 의존. 유럽 최대 구리/알루미늄 소비국. 재생에너지 전환으로 핵심광물 수입 급증.",
    geopolitical: "나토 동부 측면 방어 핵심국. 우크라이나 지원 주도. 중국 의존 탈피 모색 중. 러시아 가스 차단 후 에너지 안보 재편.",
    commodityExposure: [
      { commodity: "GAS/LNG", direction: "IMPORT RISK", reason: "러시아 파이프라인 가스 차단 후 LNG 수입으로 전환. 에너지 비용 급등이 독일 제조업 탈산업화의 핵심 원인." },
      { commodity: "COPPER", direction: "IMPORT RISK", reason: "유럽 최대 구리 소비국. 자동차/기계 제조업 핵심 투입재. 에너지전환 가속으로 수요 구조적 증가." },
      { commodity: "ALUMINUM", direction: "IMPORT RISK", reason: "고에너지 비용으로 국내 알루미늄 제련 사실상 중단. 전량 수입 의존 전환. 자동차 경량화 수요 지속." },
    ],
  },
  FR: {
    political: "마크롱 레임덕. 극우 르펜 세력 확대. EU 내 독자 행보. 원전 중심 에너지 정책 유지.",
    economic: "재정적자 GDP 5% 초과로 EU 재정규율 위반. 연금개혁 갈등 지속. 원전 덕분에 에너지 비용 경쟁력 보유.",
    commodity: "원전 의존도 70%로 우라늄 세계 2위 소비국. Orano(구 Areva)가 핵연료 사이클 수직계열화. 아프리카 우라늄 공급 레버리지.",
    geopolitical: "유엔 안보리 상임이사국. 아프리카 영향력 축소 중(사헬 지역 철수). 인도-태평양 전략 독자 추진. 핵 억지력 보유.",
    commodityExposure: [
      { commodity: "URANIUM", direction: "IMPORT RISK", reason: "원전 70% 의존으로 우라늄 세계 2위 소비국. Orano 핵연료 사이클이 에너지 안보 핵심. 아프리카 공급 불안." },
      { commodity: "OIL", direction: "IMPORT RISK", reason: "원유 수입 의존이나 원전 덕분에 에너지 믹스 분산. 정제업(TotalEnergies) 글로벌 플레이어." },
    ],
  },
  GB: {
    political: "노동당 스타머 정부. 브렉시트 후 EU 관계 재정립 모색. 방위비 확대. 금융 규제 완화 추진.",
    economic: "GDP 성장 1% 미만. 인플레 둔화 중이나 BOE 금리 고수. 파운드화 상대적 안정. NHS 등 공공서비스 재정 압박.",
    commodity: "북해 원유/가스 생산 감소 추세. 금융 허브(런던)가 원자재 거래의 중심. LME, LBMA 등 가격 결정 인프라 보유.",
    geopolitical: "미국과 특별관계 유지. AUKUS 통해 인태 관여. 우크라이나 지원 적극적. 홍콩 민주화 이슈로 중국과 갈등.",
    commodityExposure: [
      { commodity: "OIL", direction: "PRODUCER", reason: "북해 원유 생산 감소 추세. Brent 벤치마크 본거지. 에너지 자급률 하락으로 수입 의존 증가." },
      { commodity: "GOLD", direction: "TRADING HUB", reason: "런던 LBMA가 글로벌 금 가격 결정의 중심. 글로벌 금 거래의 70%가 런던 경유." },
    ],
  },
  AU: {
    political: "노동당 알바니지 정부. 미중 사이 실용적 균형. AUKUS 핵잠수함 도입 추진. 원주민 권리 정책 추진.",
    economic: "광업 주도 경제. 중국 수출 의존도 30%+. 주택시장 과열 우려. RBA 금리 정상화 진행. 호주달러 원자재 통화.",
    commodity: "철광석, 리튬, 우라늄, 석탄, 금 대규모 수출국. 리튬 생산 세계 1위(47%). 희토류 개발 가속으로 중국 대안 공급원 부상.",
    geopolitical: "AUKUS/쿼드 핵심 파트너. 중국과 무역 관계 정상화 중이나 전략적 불신 지속. 남태평양 영향력 경쟁(중국 vs 호주).",
    commodityExposure: [
      { commodity: "LITHIUM", direction: "EXPORTER", reason: "글로벌 리튬 생산 47% 독점. 리튬 가격이 광업 GDP의 핵심 변수. 중국 정제 의존 탈피가 국가 과제." },
      { commodity: "COAL", direction: "EXPORTER", reason: "원료탄 수출 세계 1위(Queensland). 철강용 원료탄 프리미엄 시장 지배. 중국과의 석탄 분쟁이 외교 바로미터." },
      { commodity: "COPPER", direction: "EXPORTER", reason: "세계 5위 구리 생산국. 에너지전환 수요 증가로 장기 수출 전망 긍정적. Olympic Dam 등 대형 광산 보유." },
    ],
  },
  CA: {
    political: "트뤼도 퇴진 후 정치 전환기. 미국 관세 압박에 취약. 이민 정책 전환. 에너지 수출 다변화 추진.",
    economic: "원자재/에너지 수출 의존. 주택 버블 리스크. BOC 금리인하 선행. 미국 경제에 강하게 연동된 GDP 성장.",
    commodity: "원유 4위(오일샌드), 우라늄 2위(Cameco), 칼리 1위, 니켈/구리/금 주요 생산국. 에너지 자원 강국이나 인프라 병목.",
    geopolitical: "미국과 USMCA 무역 체제. 중국과 관계 악화(화웨이 사건). 북극 자원 개발 러시아와 경쟁. 나토 방위비 부족 비판.",
    commodityExposure: [
      { commodity: "OIL", direction: "EXPORTER", reason: "오일샌드 기반 세계 4위 원유 생산국. 미국 수출 의존도 98%. 키스톤 파이프라인 정치가 공급 병목 결정." },
      { commodity: "URANIUM", direction: "EXPORTER", reason: "세계 2위 우라늄 생산국(15%). Cigar Lake 세계 최고품위 광산 보유. 원전 르네상스 최대 수혜국 중 하나." },
      { commodity: "WHEAT", direction: "EXPORTER", reason: "세계 5위 밀 수출국. 프레리 지역 곡물이 글로벌 식량 안보의 완충 역할." },
    ],
  },
  BR: {
    political: "룰라 좌파 정부. 글로벌 사우스 리더 자임. BRICS 확대 주도. 환경 정책 강화이나 아마존 파괴 지속.",
    economic: "GDP 성장 2.5%. 인플레 관리 중. 헤알화 변동성. 재정적자 확대 우려. 농업/광업이 성장 동력.",
    commodity: "철광석(Vale), 대두, 옥수수, 커피 세계 최대 수출국. 심해 유전(프리솔트) 원유 생산 급증. 에탄올 생산 2위.",
    geopolitical: "비동맹 외교 유지. 러시아 제재 불참. 아마존 주권 주장. 남미 경제 블록 메르코수르 주도. 미국과 거리두기.",
    commodityExposure: [
      { commodity: "OIL", direction: "EXPORTER", reason: "심해 프리솔트 유전으로 생산 급증(세계 8위). Petrobras가 중남미 최대 에너지 기업." },
      { commodity: "WHEAT", direction: "EXPORTER", reason: "옥수수 세계 2위 수출국. 대두 1위. 곡물 메이저와 함께 글로벌 식량 공급의 핵심 축." },
    ],
  },
  MX: {
    political: "모레나당 셰인바움 대통령. 좌파 민족주의 노선. 사법개혁 논란. 자원민족주의 강화 조짐.",
    economic: "니어쇼어링 수혜로 FDI 급증. 미국 수출 의존도 80%+. 페소화 상대적 강세. 제조업 성장이나 인프라 부족.",
    commodity: "세계 1위 은 생산국(23%). 원유 생산 감소 추세(PEMEX 위기). 리튬 국유화 선언. 농산물(아보카도, 토마토) 수출국.",
    geopolitical: "미국과 이민/마약 이슈로 긴장. USMCA 재협상 리스크. 중국 제조업 FDI 유입으로 미국 경계. 카르텔 폭력 지속.",
    commodityExposure: [
      { commodity: "SILVER", direction: "EXPORTER", reason: "세계 1위 은 생산국(23%). 태양광 수요 급증으로 은 가격 상승 시 직접 수혜." },
      { commodity: "OIL", direction: "PRODUCER", reason: "PEMEX 위기로 생산 감소 추세. 정유 인프라 부족으로 원유 수출 후 휘발유 역수입 구조." },
    ],
  },
  AR: {
    political: "밀레이 극우 자유주의 정부. 달러화/긴축 추진. IMF 프로그램 이행 중. 페론주의와 대립.",
    economic: "인플레 100%+ 급감 중이나 여전히 고수준. GDP 축소 후 반등 기대. 페소 평가절하. 외환보유고 부족.",
    commodity: "리튬 트라이앵글 일원(매장량 세계 3위). 바카무에르타 셰일(세계 2위 셰일가스 매장량) 개발 가속. 대두/밀 주요 수출국.",
    geopolitical: "BRICS 탈퇴(밀레이 결정). 미국/서방 정렬로 전환. 포클랜드 영유권 재주장. 칠레, 볼리비아와 리튬 경쟁.",
    commodityExposure: [
      { commodity: "LITHIUM", direction: "EXPORTER", reason: "리튬 트라이앵글 일원(매장량 세계 3위). 외국인 투자 유치로 생산 급증. IRA 적격 공급원으로 전략적 가치 상승." },
      { commodity: "GAS/LNG", direction: "EXPORTER", reason: "바카무에르타 셰일가스(세계 2위 매장량) 개발 가속. LNG 수출 인프라 구축 시 글로벌 공급자 부상." },
    ],
  },
  CL: {
    political: "보리치 좌파 정부. 신헌법 제정 실패 후 중도화. 구리 광업세 인상 논란. 리튬 국유화 부분 추진.",
    economic: "구리 수출 의존(GDP 10%+). 인플레 둔화. 경상수지 적자. 중앙은행 선제적 금리인하. 연금개혁 추진 중.",
    commodity: "세계 1위 구리 생산국(27%). 리튬 2위(26%, 아타카마 염호). SQM/Albemarle 합작 논의. 자원민족주의 리스크 확대.",
    geopolitical: "태평양 동맹 회원국. 중국이 최대 구리 수출 대상. 미국 IRA로 리튬 공급망 전략적 파트너 부상. 안정적 민주주의.",
    commodityExposure: [
      { commodity: "COPPER", direction: "EXPORTER", reason: "세계 최대 구리 생산국(27%). 광업이 GDP의 10%, 수출의 50%. 구리 가격이 칠레 경제 전체를 좌우." },
      { commodity: "LITHIUM", direction: "EXPORTER", reason: "세계 2위 리튬 생산국(26%). Atacama 염호가 최저 원가 리튬 공급원. 국유화 논의가 최대 리스크." },
    ],
  },
  PE: {
    political: "정치 불안정 지속. 대통령 탄핵/교체 반복. 좌파-우파 갈등. 자원민족주의 강화 잠재력.",
    economic: "광업 의존 경제(GDP 15%). 구리/금/은 수출 주도. 인플레 안정. 비공식 경제 비중 높음. 빈부격차 심화.",
    commodity: "구리 3위(11%), 은 2위(14%), 금/아연/납 주요 생산국. Antamina, Cerro Verde 등 대형 광산 운영. 환경 갈등 빈발.",
    geopolitical: "중국이 최대 광물 수출 대상. 미중 경쟁에서 중립 유지. 아마존 불법 채굴 문제. 볼리비아와 국경 이슈.",
    commodityExposure: [
      { commodity: "COPPER", direction: "EXPORTER", reason: "세계 3위 구리 생산국(11%). 광업이 GDP 15%, 수출의 30%. 정치 불안정이 광산 투자 억제 요인." },
      { commodity: "SILVER", direction: "EXPORTER", reason: "은 세계 2위 생산국(14%). 금/아연 부산물 생산 포함 광업 GDP 기여 높음." },
    ],
  },
  VE: {
    political: "마두로 독재 고착. 야권 탄압 지속. 국제사회 승인 논란. 미국 제재 완화-재강화 반복.",
    economic: "하이퍼인플레이션 후 달러화 진행. GDP 원유 의존. PDVSA 생산 붕괴(700만→70만 bbl/d). 난민 위기 지속.",
    commodity: "확인 원유매장량 세계 1위(3,000억 배럴)이나 초중질유 생산 어려움. 중국/러시아 투자로 일부 회복. 금/보크사이트 매장.",
    geopolitical: "미국 제재 대상. 중국/러시아와 밀착. 가이아나와 에세키보 영유권 분쟁. 중남미 좌파 블록 약화 중.",
    commodityExposure: [
      { commodity: "OIL", direction: "EXPORTER", reason: "확인매장량 세계 1위(3,040억 배럴)이나 경제 붕괴로 생산량이 잠재력의 10% 수준. 제재 해제 시 공급 급증 가능." },
    ],
  },
  TR: {
    political: "에르도안 장기집권. 대통령제 권력 집중. 나토 회원이나 러시아/중국과도 균형 외교. 쿠르드 문제 지속.",
    economic: "인플레 50%+ 후 긴축 전환. 리라화 급락 후 안정화 시도. 경상수지 적자 만성적. 관광/제조업 경제.",
    commodity: "보스포루스 해협으로 흑해 원유/곡물 수출 통제. 크롬/보론 매장. 에너지 수입 의존. 가스 허브 야심.",
    geopolitical: "나토-러시아 사이 전략적 중재자. 시리아/리비아 군사 개입. 그리스와 에게해 갈등. 스웨덴 나토 가입 승인.",
    commodityExposure: [
      { commodity: "OIL", direction: "IMPORT RISK", reason: "원유 99% 수입. 에너지 수입이 경상적자의 최대 원인. 리라화 약세와 유가 상승 이중 압박." },
      { commodity: "WHEAT", direction: "TRANSIT", reason: "보스포루스 해협 통제로 흑해 곡물 수출의 게이트키퍼. 러-우 곡물 협상의 핵심 중재자." },
    ],
  },
  PL: {
    political: "투스크 친유럽 정부. EU 법치 갈등 완화. 나토 동부 최전선 방위 강화. 방위비 GDP 4% 목표.",
    economic: "GDP 성장 3%+ 중동유럽 최강. 인플레 둔화. EU 자금 재개. 제조업/IT 허브로 성장. 인구 감소 우려.",
    commodity: "석탄 의존 전력 구조(70%). 탈석탄 전환 진행 중이나 속도 느림. 원전 도입 추진(한국형 APR1400 후보).",
    geopolitical: "나토 동부 최전선. 우크라이나 인접국으로 안보 최우선. 미국 군사 기지 확대. 독일과 에너지 정책 이견.",
    commodityExposure: [
      { commodity: "COAL", direction: "PRODUCER", reason: "EU 최대 석탄 생산국. 전력의 70%가 석탄 발전. EU 탈석탄 압박과 에너지 안보 사이 딜레마." },
      { commodity: "GAS/LNG", direction: "IMPORT RISK", reason: "러시아 가스 의존 탈피 완료. 미국 LNG + 노르웨이 파이프라인으로 대체. 발트해 파이프라인(Baltic Pipe) 운영." },
    ],
  },
  NO: {
    political: "사민당 스토레 정부. 나토 회원. 에너지 주권 중시. 국부펀드(GPFG, 세계 최대 $1.7T) 운용.",
    economic: "유럽 최대 가스 수출국으로 에너지 위기 최대 수혜. 1인당 GDP 세계 최상위. 인플레 안정. 크로네화 변동성.",
    commodity: "유럽 최대 천연가스 수출국(러시아 대체). 북해 원유 생산. 양식 연어 세계 1위. 희토류/광물 탐사 확대.",
    geopolitical: "나토 북극 방어 핵심. 러시아와 바렌츠해 국경. 해저 인프라(파이프라인/케이블) 보호 강화. 유럽 에너지 안보의 핵.",
    commodityExposure: [
      { commodity: "OIL", direction: "EXPORTER", reason: "유럽 최대 원유 수출국. 러시아 공급 차단 후 유럽 에너지 안보의 대체 핵심 공급원. 국부펀드(GPFG) $1.7조." },
      { commodity: "GAS/LNG", direction: "EXPORTER", reason: "유럽 천연가스 공급의 30% 담당. 러시아 가스 대체재로 전략적 위상 급상승." },
    ],
  },
  QA: {
    political: "타미 왕가 안정적 통치. 미국 최대 비나토 동맹(알 우데이드 기지). 하마스 중재 역할.",
    economic: "LNG 수출 세계 2위. 1인당 GDP 세계 최상위권. North Field 확장으로 LNG 수출용량 2배 확대 추진.",
    commodity: "LNG 생산/수출 글로벌 2위. North Field(세계 최대 가스전)으로 2030년 수출 77→126mtpa. 헬륨 주요 생산국.",
    geopolitical: "이란과 가스전 공유(South Pars/North Field). 호르무즈 봉쇄 시 직접 피해. GCC 내 독자 외교. 알자지라 소프트파워.",
    commodityExposure: [
      { commodity: "GAS/LNG", direction: "EXPORTER", reason: "LNG 수출 세계 2위. North Field 확장으로 2030년 생산 64% 증가 예정. 아시아/유럽 장기계약 핵심 공급자." },
      { commodity: "OIL", direction: "EXPORTER", reason: "원유 수출로 1인당 GDP 세계 최고 수준 유지. 국부펀드(QIA) $450억 글로벌 투자." },
    ],
  },
  AE: {
    political: "MBZ 실질 통치(아부다비). 두바이 금융/물류 허브. 탈석유 다각화 선진. 이스라엘 아브라함 협정.",
    economic: "석유 외 GDP 비중 70%+로 GCC 최고 다각화. 두바이 관광/금융. 아부다비 원유/국부펀드(ADIA). 디르함 달러 페그.",
    commodity: "원유 생산 확대 여력 보유(OPEC+ 내 비자발적 감산). ADNOC 해외 투자 확대. 알루미늄(EGA) 세계 5위 생산.",
    geopolitical: "미국과 안보 동맹이나 중국과도 협력 확대. 예멘 개입 축소. 이스라엘 정상화 선도. 아프리카/인도양 영향력 확대.",
    commodityExposure: [
      { commodity: "OIL", direction: "EXPORTER", reason: "OPEC 4위 산유국. ADNOC이 생산 증설로 사우디와 OPEC 내 영향력 경쟁 중. 탈석유 다각화(두바이 모델) 진행." },
      { commodity: "GOLD", direction: "TRADING HUB", reason: "두바이가 글로벌 금 거래의 주요 허브. 러시아/아프리카산 금의 서방 제재 우회 경유지로 지목." },
    ],
  },
  KW: {
    political: "에미르 통치. 의회-정부 갈등 반복적 정치 교착. GCC 내 보수적 입장. 미군 기지 주둔.",
    economic: "원유 수출 GDP 90% 의존. 재정 개혁 지연. 국부펀드(KIA, 세계 최고령) 운용. 청년 실업 문제.",
    commodity: "OPEC 회원국. 원유 확인매장량 세계 6위. 정제 용량 확대 추진. 호르무즈 해협 의존.",
    geopolitical: "이라크 침공(1990) 트라우마로 미국 안보 의존. 이란-사우디 관계에 영향. 호르무즈 봉쇄 시 직접 피해국.",
    commodityExposure: [
      { commodity: "OIL", direction: "EXPORTER", reason: "원유 수출이 GDP의 90%. OPEC 회원국. 호르무즈 봉쇄 시 수출 불가로 경제 즉각 마비." },
    ],
  },
  IQ: {
    political: "시아파 연립정부. 이란 영향력 심화. 쿠르드 자치구 석유 분쟁. 부패 만연. 민병대 문제.",
    economic: "원유 수출 GDP 95%+ 의존. 인프라 재건 진행 중이나 부패로 지연. 높은 청년 실업. 디나르 안정화 노력.",
    commodity: "OPEC 2위 생산국(원유 5%). 바스라 원유가 아시아 벤치마크. 쿠르드 지역 수출 분쟁으로 일부 공급 차질.",
    geopolitical: "미-이란 대리전 무대. 이란계 민병대 미군 기지 공격 반복. 터키의 쿠르드 PKK 월경 작전. 수자원(유프라테스) 분쟁.",
    commodityExposure: [
      { commodity: "OIL", direction: "EXPORTER", reason: "OPEC 2위 생산국. 원유 수출이 GDP의 95%+. 바스라 원유가 아시아 시장 핵심 벤치마크." },
    ],
  },
  YE: {
    political: "사실상 분단 상태(후티 vs 정부). 사우디 주도 연합군 개입. 후티 이란 지원. 휴전 협상 진행 중.",
    economic: "내전으로 경제 붕괴. 인도주의 위기. 리알화 폭락. 식량 수입 90% 의존. 세계 최악 인도주의 위기.",
    commodity: "바브엘만데브 해협 인접으로 글로벌 해운 교란 능력 보유. 후티의 상선 공격이 홍해 물류 위기 촉발.",
    geopolitical: "후티 반군의 홍해 상선 공격으로 글로벌 물류 위기. 수에즈 통과 교통량 66% 감소. 이란 프록시 전쟁의 핵심 전선.",
    commodityExposure: [
      { commodity: "WHEAT", direction: "IMPORT RISK", reason: "식량 수입 90% 의존. 세계 최악 기아 위기. 홍해 물류 차단으로 식량 수입 비용 급등." },
    ],
  },
  NG: {
    political: "티누부 대통령. 연료 보조금 철폐 개혁. 나이라화 평가절하. 보코하람 안보 위협 지속.",
    economic: "아프리카 최대 경제(GDP). 원유 의존이나 정유 부족으로 연료 수입. 인플레 30%+. 나이라화 폭락. 핀테크 성장.",
    commodity: "아프리카 최대 원유 생산국이나 유전 노후화/도난으로 생산 감소. LNG 수출 확대 추진. 주석/콜탄 매장.",
    geopolitical: "서아프리카(ECOWAS) 리더. 사헬 지역 쿠데타 도미노(니제르, 말리). 기니만 해적 문제. 인구 2억+으로 아프리카 핵심국.",
    commodityExposure: [
      { commodity: "OIL", direction: "EXPORTER", reason: "아프리카 최대 산유국. 파이프라인 노후화와 도유(oil theft)로 생산량이 잠재력 대비 40% 수준." },
      { commodity: "GAS/LNG", direction: "EXPORTER", reason: "아프리카 최대 LNG 수출국. 유럽의 러시아 가스 대체 수요로 전략적 위상 상승." },
    ],
  },
  ZA: {
    political: "ANC 연립정부(DA와 국민통합정부). 제도적 민주주의 유지. 전력 위기(Eskom 부하차단)가 최대 국내 이슈.",
    economic: "GDP 성장 1% 미만. 실업률 33%+(세계 최고 수준). 랜드화 변동성. 전력 위기가 광업/제조업 직접 타격.",
    commodity: "백금족 금속(PGM) 세계 70%+ 생산. 금/크롬/망간/철광석 주요 생산국. 석탄 수출국. 에너지전환 핵심광물 보유.",
    geopolitical: "BRICS 회원국. 러시아 제재 불참으로 서방 관계 악화. 남아공 항만이 아프리카 물류 허브. 이민 갈등 심화.",
    commodityExposure: [
      { commodity: "GOLD", direction: "EXPORTER", reason: "역사적 세계 최대 금 생산국이나 현재 6위로 하락. 광산 노후화와 전력난이 생산 감소 원인." },
      { commodity: "COAL", direction: "EXPORTER", reason: "아프리카 최대 석탄 수출국. 전력난(로드쉐딩)으로 내수 석탄 수요 급증. 수출 여력 감소." },
      { commodity: "NICKEL", direction: "PRODUCER", reason: "백금족 금속(PGM) 세계 최대 생산국. 수소경제/자동차 촉매 수요 직접 수혜." },
    ],
  },
  CD: {
    political: "치세케디 대통령 재선. 동부 M23 반군 분쟁 지속. 르완다 개입 논란. 거버넌스 취약.",
    economic: "광업 의존 경제. 코발트/구리 수출 주도. 인프라 극도로 부족. 비공식 경제 지배적. 세계 최빈국 중 하나.",
    commodity: "코발트 세계 1위(73%). 구리 2위(13%). 콜탄(탄탈럼) 지배적. 중국 기업(CMOC, 화유코발트)이 광산 대부분 장악.",
    geopolitical: "동부 분쟁으로 코발트/콜탄 공급 차질 리스크. 중국 자원 외교 핵심 대상. 르완다와 군사 갈등. 인도주의 위기 지속.",
    commodityExposure: [
      { commodity: "COPPER", direction: "EXPORTER", reason: "세계 2위 구리 생산국(13%). 카탕가 구리벨트가 글로벌 에너지전환의 핵심 공급원. 중국 자본 장악." },
      { commodity: "COBALT", direction: "EXPORTER", reason: "세계 코발트 생산의 70% 독점. EV 배터리 핵심 소재. 아동노동 리스크가 ESG 공급망 이슈." },
    ],
  },
  ID: {
    political: "프라보워 신임 대통령. 군부 출신이나 실용주의 경제 노선. 자원민족주의 강화. 니켈 수출 금지 정책 유지.",
    economic: "GDP 성장 5%. 동남아 최대 경제. 니켈 가공 산업화 추진(수출 금지→국내 제련). 인프라 투자 확대. 루피아 관리변동.",
    commodity: "니켈 세계 1위(52%). 석탄 수출 1위(열탄). 주석 2위. 팜유 1위. 보크사이트 수출 금지로 알루미나 가공 추진.",
    geopolitical: "남중국해 나투나 제도 중국과 마찰. 아세안 최대국으로 지역 리더. 중국 자본 대규모 유입(니켈 제련소). IRA 적격성 논란.",
    commodityExposure: [
      { commodity: "NICKEL", direction: "EXPORTER", reason: "세계 최대 니켈 생산국(52%). 원광 수출 금지 정책으로 중국 자본 유치해 정제 생태계 구축. 배터리 공급망의 핵심." },
      { commodity: "COAL", direction: "EXPORTER", reason: "세계 최대 열탄 수출국(40%). 아시아 발전용 석탄 시장 지배. 수출 쿼터 정책이 글로벌 석탄 가격 직접 영향." },
    ],
  },
  PH: {
    political: "마르코스 주니어 대통령. 친미 선회. 남중국해 중국과 직접 대치. 방위 협력 확대.",
    economic: "GDP 성장 5.5%. BPO/해외송금 의존. 인플레 관리 중. 인프라 투자 확대. 페소 변동성.",
    commodity: "니켈 2위(10%). 구리/금 매장. 남중국해 해저 자원 영유권 분쟁. 농산물(코코넛, 바나나) 수출.",
    geopolitical: "남중국해 제2토마스 암초에서 중국과 직접 대치. 미-필 상호방위조약 강화. 대만 유사시 전략적 위치. 이슬람 반군 문제.",
    commodityExposure: [
      { commodity: "NICKEL", direction: "EXPORTER", reason: "니켈 세계 2위 생산국(10%). 중국/일본 제련소에 원광 공급. 인도네시아 수출 금지 후 대체 공급원 부상." },
      { commodity: "OIL", direction: "IMPORT RISK", reason: "원유 100% 수입 의존. 유가 상승 시 물가 직접 타격. 남중국해 해저 자원 개발이 장기 에너지 안보 핵심." },
    ],
  },
  TH: {
    political: "친탁신계 연립정부. 왕실-군부-재계 삼각 구조. 정치 불안정성 잠재. 관광 중심 경제 재건.",
    economic: "GDP 성장 3%. 관광(GDP 18%) 회복 중. 자동차/전자 제조 허브. 태국 바트 상대적 안정. EV 생산 허브 야심.",
    commodity: "주석/고무 주요 생산국. 금 수요 아시아 5위. 에너지 수입 의존. 쌀 수출 세계 2위.",
    geopolitical: "미국 조약 동맹이나 중국과도 실용적 관계. 미얀마 난민 유입. 메콩강 수자원 중국 댐 영향. 아세안 중심외교.",
    commodityExposure: [
      { commodity: "OIL", direction: "IMPORT RISK", reason: "에너지 수입 의존. 유가 상승 시 경상적자 확대. EV 전환으로 장기 에너지 수입 의존도 축소 시도." },
      { commodity: "GOLD", direction: "IMPORT RISK", reason: "아시아 5위 금 수요국. 바트화 불안 시 금 수요 급증. 중앙은행 금 매입 확대." },
    ],
  },
  PK: {
    political: "군부 영향 하 민간정부. 정치 불안정(이란 칸 구금). 중국 CPEC 의존. 테러 위협 지속.",
    economic: "IMF 구제금융 프로그램. 인플레 20%+. 루피화 약세. 외환보유고 부족. 에너지 위기 만성적. 인구 2.3억.",
    commodity: "에너지 수입 대부분 의존. 레코딕 구리/금 광산(세계급) 개발 착수. 면화/쌀 수출. 핵보유국.",
    geopolitical: "인도와 카슈미르 분쟁 상존. 중국 CPEC(과다르항)으로 전략적 연결. 아프가니스탄 국경 불안. 핵 억지력 보유.",
    commodityExposure: [
      { commodity: "GAS/LNG", direction: "IMPORT RISK", reason: "에너지 부족이 경제 위기의 핵심. LNG 수입 외환 부담으로 IMF 구제금융 반복. 중국 CPEC 에너지 프로젝트 의존." },
      { commodity: "WHEAT", direction: "IMPORT RISK", reason: "식량 수입 의존도 증가. 기후 재해(홍수)로 국내 생산 불안정. 식량 가격 급등 시 정치 불안 직결." },
    ],
  },
  KZ: {
    political: "토카예프 대통령. 나자르바예프 영향력 축소 후 개혁 추진. 러시아-중국 사이 균형 외교.",
    economic: "원유/광물 수출 의존 경제. 텡게화 변동. 러시아 경유 원유 수출 파이프라인 취약. 외국인 투자 유치 노력.",
    commodity: "우라늄 세계 1위(43%, Kazatomprom). 원유 생산국(카샤간). 크롬/구리/아연 매장. 희토류 개발 추진.",
    geopolitical: "러시아 영향권이나 서방 투자 유치. 중국 일대일로 핵심 경유지. 우크라이나 전쟁으로 러시아 경유 수출 리스크 부각. 중앙아시아 리더.",
    commodityExposure: [
      { commodity: "OIL", direction: "EXPORTER", reason: "카스피해 원유 수출국. 러시아 통과 파이프라인 의존으로 제재 우회 복잡성 증가. 서방 자본 투자 핵심지." },
      { commodity: "URANIUM", direction: "EXPORTER", reason: "세계 최대 우라늄 생산국(43%). Kazatomprom이 글로벌 원전 르네상스의 핵심 공급자. 러-중 영향권 사이 전략적 위치." },
    ],
  },
  MN: {
    political: "의회민주주의. 러시아-중국 사이 '제3의 이웃' 외교(미국, 일본, EU). 광업 개발 정치화.",
    economic: "광업 GDP 25%+. 오유톨고이(구리/금) 세계급 광산. 중국 수출 의존도 90%+. 인플레 관리. 채무 부담.",
    commodity: "구리(오유톨고이, 세계급), 석탄(타반톨고이), 금, 희토류 매장. 중국이 사실상 유일 수출 시장. 자원의 저주 리스크.",
    geopolitical: "러시아-중국에 완전 둘러싸임. 내륙국으로 수출 경로 중국 의존. 제3의 이웃 정책으로 미일 관계 확대 시도.",
    commodityExposure: [
      { commodity: "COPPER", direction: "EXPORTER", reason: "Oyu Tolgoi(리오틴토) 세계 3위 구리광산 보유. 러시아-중국 사이 내륙국으로 수출 루트가 지정학 변수." },
      { commodity: "COAL", direction: "EXPORTER", reason: "중국 국경 인접 노천 석탄광. 중국 에너지 안보의 완충 공급원. 철도 인프라 부족이 생산 확대 병목." },
    ],
  },
  NA: {
    political: "SWAPO 일당 지배 약화. 민주주의 유지. 독일 식민 배상 이슈. 광업 법제 개혁 논의.",
    economic: "광업 의존(GDP 12%+). 우라늄/다이아몬드 수출 주도. 나미비아 달러(ZAR 페그). 관광 성장. 청년 실업 높음.",
    commodity: "우라늄 세계 3위(11%). 뢰싱/후사브 광산(중국 CGN 소유). 다이아몬드(De Beers). 해상 석유/가스 탐사 진행.",
    geopolitical: "남아공 경제권 의존. 중국 투자 확대(우라늄 광산). 정치적 안정성 양호. 해상 유전 개발 시 에너지 수출국 전환 가능.",
    commodityExposure: [
      { commodity: "URANIUM", direction: "EXPORTER", reason: "세계 3위 우라늄 생산국(11%). 후사브 광산(중국 CGN 소유) 확장으로 생산 증가. 원전 르네상스 수혜." },
      { commodity: "OIL", direction: "PRODUCER", reason: "해상 유전(오렌지 분지) 탐사로 대규모 원유 매장 확인. 개발 시 아프리카 신규 산유국 부상 가능." },
    ],
  },
  UZ: {
    political: "미르지요예프 대통령 개혁 추진. 러시아 영향권 이탈 시도. 서방 투자 유치. 중앙아시아 최다 인구(3,500만).",
    economic: "경제 개혁 가속(환율 자유화, 민영화). GDP 성장 5%+. 면화 모노컬쳐 탈피 추진. 송금 의존(러시아 노동자).",
    commodity: "우라늄 세계 5위(7%). 금 생산국(나보이 광산). 천연가스 생산. 구리/텅스텐 매장. 핵심광물 개발 잠재력.",
    geopolitical: "러시아-중국-서방 삼각 균형 외교. 아프가니스탄 인접 안보 리스크. 수자원(아무다리아) 분쟁. 중앙아시아 경제 통합 추진.",
    commodityExposure: [
      { commodity: "URANIUM", direction: "EXPORTER", reason: "세계 5위 우라늄 생산국(7%). 나보이광업이 금/우라늄 동시 생산. 서방 투자 유치로 생산 확대 추진." },
      { commodity: "GOLD", direction: "EXPORTER", reason: "금 생산국(나보이 광산). 중앙은행 금 보유 확대. 광업 다각화로 경제 체질 개선 중." },
    ],
  },
  EG: {
    political: "시시 군부 통치 고착. 야권 탄압. IMF 구제금융. 수에즈 운하 수입 급감(후티 공격). 인구 1.1억 폭증.",
    economic: "인플레 30%+. 파운드화 급락. 외채 위기. 수에즈 운하 통행료 급감(2024년 -50%). 관광/송금 의존. IMF 대출 확대.",
    commodity: "수에즈 운하로 글로벌 해상 교역 12% 통제. 세계 최대 밀 수입국. 천연가스(조르 가스전) 자급 달성이나 수요 급증.",
    geopolitical: "수에즈 운하 수입이 국가 재정 핵심. 후티 홍해 공격으로 통행량 66% 감소. 이스라엘-가자 인접. 리비아 내전 영향.",
    commodityExposure: [
      { commodity: "WHEAT", direction: "IMPORT RISK", reason: "세계 최대 밀 수입국. 식량 보조금이 재정 부담의 핵심. 밀 가격 급등 시 사회 불안 직결(아랍의 봄 촉매)." },
      { commodity: "GAS/LNG", direction: "PRODUCER", reason: "조르 가스전으로 천연가스 자급 달성이나 인구 급증으로 수요 압박. LNG 수출 여력 축소." },
    ],
  },
};
