import axios from 'axios';

const SERVICE_KEY = 'e4d5f479ba042d30514b970ee81bf7f9b1d5904e4fb388e63c29f03a47335318'; 
const BASE_URL = 'https://apis.data.go.kr/B551011/KorService2';

async function checkCommonData() {
  // 💡 문제가 된 defaultYN, mapinfoYN 파라미터를 아예 싹 다 날렸습니다!
  // 오직 앱 정보(MobileOS, MobileApp)와 장소 ID(contentId)만 보냅니다.
  const commonUrl = `${BASE_URL}/detailCommon2?serviceKey=${SERVICE_KEY}&MobileOS=ETC&MobileApp=LocalHub&contentId=126512&_type=json`;
  
  console.log("요청 URL:", commonUrl);
  console.log("좌표 데이터를 가져오는 중...\n");

  try {
    const res = await axios.get(commonUrl);
    console.log("🟢 좌표 서버 응답 결과:\n", JSON.stringify(res.data, null, 2));
  } catch (error) {
    console.log("🔴 에러 발생:\n", error.message);
  }
}

checkCommonData();