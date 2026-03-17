import RealEstateClient from "./RealEstateClient";

export const metadata = {
  title: "서울 부동산",
  description: "서울 아파트 실거래가, 구별 티어리스트, 수요/공급, 금리규제, 입주물량, 재건축 현황.",
};

export default function RealEstatePage() {
  return <RealEstateClient />;
}
