import fs from 'fs';
import axios from 'axios';

// 발급 및 동기화가 완료된 해시 키
const SERVICE_KEY = 'e4d5f479ba042d30514b970ee81bf7f9b1d5904e4fb388e63c29f03a47335318'; 
const BASE_URL = 'https://apis.data.go.kr/B551011/KorService2';

const rawData = fs.readFileSync('./src/data/서울/서울_여행코스.json', 'utf-8');
const courseData = JSON.parse(rawData);

async function fetchCourseStops() {
  console.log('총 51개 코스의 상세 장소 수집을 시작합니다...');

  for (let i = 0; i < courseData.items.length; i++) {
    const course = courseData.items[i];
    console.log(`[${i + 1}/${courseData.items.length}] ${course.title} 수집 중...`);

    try {
      // 1단계: 코스의 하위 장소 목록 및 ID 가져오기 (detailInfo2)
      const infoUrl = `${BASE_URL}/detailInfo2?serviceKey=${SERVICE_KEY}&MobileOS=ETC&MobileApp=LocalHub&contentId=${course.contentid}&contentTypeId=25&_type=json`;
      
      const infoRes = await axios.get(infoUrl);
      const subItems = infoRes.data.response?.body?.items?.item || [];
      course.stops = []; 

      for (const item of subItems) {
        // 💡 2단계: 하위 장소 좌표 가져오기 (detailCommon2)
        // 에러의 원흉이었던 defaultYN, mapinfoYN 파라미터를 완전히 제거했습니다!
        const commonUrl = `${BASE_URL}/detailCommon2?serviceKey=${SERVICE_KEY}&MobileOS=ETC&MobileApp=LocalHub&contentId=${item.subcontentid}&_type=json`;
        
        const commonRes = await axios.get(commonUrl);
        const commonData = commonRes.data.response?.body?.items?.item?.[0];

        // 좌표가 모두 정상적으로 존재하는 장소만 stops 배열에 추가
        if (commonData && commonData.mapx && commonData.mapy) {
          course.stops.push({
            contentid: item.subcontentid,
            title: item.subname,
            mapx: commonData.mapx,
            mapy: commonData.mapy,
            contentType: "관광지"
          });
        }
      }
    } catch (error) {
      console.error(`${course.title} 수집 실패:`, error.message);
    }

    // 서버 부하를 막기 위해 0.5초 대기
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  // 완성된 데이터를 기존 파일에 덮어쓰기
  fs.writeFileSync('./src/data/서울/서울_여행코스.json', JSON.stringify(courseData, null, 2), 'utf-8');
  console.log('✅ 모든 수집이 완료되었습니다!');
}

fetchCourseStops();