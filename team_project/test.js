import axios from 'axios';

const SERVICE_KEY = 'e4d5f479ba042d30514b970ee81bf7f9b1d5904e4fb388e63c29f03a47335318'; 
const BASE_URL = 'https://apis.data.go.kr/B551011/KorService2';

async function checkApiData() {
  // 💡 detailInfo2 로 올바르게 수정되었습니다.
  const infoUrl = `${BASE_URL}/detailInfo2?serviceKey=${SERVICE_KEY}&MobileOS=ETC&MobileApp=LocalHub&contentId=1952971&contentTypeId=25&_type=json`;
  
  console.log("요청 URL:", infoUrl);
  console.log("데이터를 가져오는 중...\n");

  try {
    const res = await axios.get(infoUrl);
    // API가 뱉어내는 실제 데이터 구조를 콘솔에 출력합니다.
    console.log("🟢 서버 응답 결과:\n", JSON.stringify(res.data, null, 2));
  } catch (error) {
    console.log("🔴 에러 발생:\n", error.message);
  }
}

checkApiData();