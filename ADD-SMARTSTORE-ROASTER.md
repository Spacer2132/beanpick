# 네이버 스마트스토어 로스터리 추가 방법

스마트스토어 기반 로스터리를 BeanPick에 추가할 때 **지금까지 안정적으로 통한 절차**를 정리한 문서입니다.
새 스토어를 추가할 때 이 순서를 그대로 따라가면 됩니다.

> 예시는 "커피정경 로스터리"(`https://smartstore.naver.com/coffeejg`) 추가 사례 기준입니다.

---

## 0. 준비물

- 추가할 스토어의 주소 (예: `https://smartstore.naver.com/coffeejg`)
  - 주소 끝부분(`coffeejg`)이 그 스토어의 **고유 ID**이자 우리가 쓸 `sourceId`가 됩니다.
- `.env`에 네이버 검색 API 키가 들어 있어야 합니다.
  (`NAVER_COMMERCE_CLIENT_ID`, `NAVER_COMMERCE_CLIENT_SECRET` — 이미 설정되어 있음)

---

## 1. 매장명(mallName) 확인 — 가장 중요

네이버 쇼핑 검색 결과에서 **그 스토어 상품만 골라내는 기준**이 `mallName`입니다.
이 값이 정확해야 다른 스토어 상품이 섞이지 않습니다.

아래 임시 스크립트를 `scripts/_tmp-probe.cjs`로 만들어 한 번 돌려보고, 출력에서 `mallName="..."` 값을 그대로 복사합니다.
(확인이 끝나면 이 임시 파일은 지웁니다.)

```js
const path = require('node:path');
const { loadLocalEnv } = require('../electron/naverShoppingSearch.cjs');
loadLocalEnv(path.resolve(__dirname, '..'));

async function search(query) {
  const config = {
    clientId: (process.env.NAVER_SHOPPING_CLIENT_ID || process.env.NAVER_COMMERCE_CLIENT_ID || '').trim(),
    clientSecret: (process.env.NAVER_SHOPPING_CLIENT_SECRET || process.env.NAVER_COMMERCE_CLIENT_SECRET || '').trim(),
  };
  const url = new URL('https://openapi.naver.com/v1/search/shop.json');
  url.searchParams.set('query', query);
  url.searchParams.set('display', '20');
  const res = await fetch(url, {
    headers: {
      'X-Naver-Client-Id': config.clientId,
      'X-Naver-Client-Secret': config.clientSecret,
    },
  });
  const body = await res.json();
  (body.items || []).forEach((item) => {
    const title = String(item.title).replace(/<[^>]*>/g, '');
    console.log(`mallName="${item.mallName}" | ${title}`);
  });
}

search('커피정경 원두'); // ← 추가할 로스터리 이름으로 바꿔서 실행
```

```bash
node scripts/_tmp-probe.cjs
```

- 출력에서 우리가 원하는 스토어가 `mallName="커피정경"` 처럼 나오면 그 값을 메모합니다.
- 같은 로스터가 여러 표기(`커피정경`, `커피정경커피` 등)로 나오면 모두 `mallNames` 배열에 넣습니다.
- 확인 후 `scripts/_tmp-probe.cjs` 삭제.

---

## 2. 수집 소스 등록 — `electron/naverShoppingSearch.cjs`

`SMARTSTORE_SOURCES` 객체에 항목을 하나 추가합니다.
**카테고리 주소가 없을 때**(대부분의 신규 추가)는 검색 API 방식으로만 등록하면 됩니다.

```js
coffeejg: {
  sourceId: 'coffeejg',          // 스토어 주소 끝부분
  roasterName: '커피정경 로스터리', // 화면에 표시할 이름
  query: '커피정경 원두',          // 네이버 쇼핑 검색어 (보통 "이름 + 원두")
  // 원두 카테고리 주소가 없어 네이버 쇼핑 검색 API로만 수집한다.
  mallNames: ['커피정경'],         // 1단계에서 확인한 매장명
},
```

### (선택) 더 정확하게: 원두 카테고리 직접 수집

스토어에 **"원두" 전용 카테고리 페이지**가 있고 그 주소를 알면, `categoryUrls`를 넣으면 검색 API보다 정확합니다.
드립백·캡슐·굿즈 같은 비원두 카테고리는 빼고 **원두 카테고리만** 넣습니다.

```js
categoryUrls: [
  'https://smartstore.naver.com/<스토어ID>/category/<카테고리해시>?cp=1',
],
```

- 카테고리 주소는 PC 브라우저에서 스토어의 원두 카테고리를 연 뒤 주소창에서 복사합니다.
  (Claude는 smartstore.naver.com을 직접 열 수 없으므로, 이 주소는 사용자가 직접 알려줘야 합니다.)
- `categoryUrls`가 있으면 그쪽을 우선 사용하고, 결과가 비면 검색 API로 자동 대체됩니다.

---

## 3. 화면 목록에 등록 — `src/data/roasterySources.ts`

앱 화면(로스터 목록)에 보이도록 `roasterySources` 배열에 항목을 추가합니다.

```ts
{
  id: 'coffeejg',
  roasterName: '커피정경 로스터리',
  channelType: 'smartStore',
  sourceUrl: 'https://smartstore.naver.com/coffeejg',
  adapterKey: 'naverShoppingSearchAdapter',
  enabled: true,
  status: 'ready',
  productCount: 0,
  lastCheckedAt: '수동 확인 전',
  memo: '네이버 쇼핑 검색 API로 커피정경 로스터리 스마트스토어 원두를 가져옵니다.',
},
```

- `id`는 2단계의 `sourceId`와 **반드시 같아야** 합니다.
- `sourceUrl`은 스토어 주소(또는 원두 카테고리 주소)를 넣습니다.

---

## 3-1. "불러오기" 수집 대상에 등록 — `src/App.jsx` ⚠️ 빠뜨리면 0건

**이 단계를 빠뜨리면 로스터 목록에는 보여도 "불러오기"가 0건이 됩니다.**
화면 코드에 스마트스토어 수집 대상이 **하드코딩**되어 있어서, 여기에 직접 추가해야 실제로 수집됩니다.

`src/App.jsx`에서 두 곳을 고칩니다.

```js
const SMARTSTORE_SOURCE_LABELS = {
  // ...기존 항목...
  coffeejg: '커피정경 로스터리',  // ← 추가
};

function getSmartStoreSourceIds() {
  return ['roasterick', 'lubia', 'hitte', 'identity', 'toch', 'fillout', 'cafedoan', 'coffeejg']; // ← 끝에 추가
}
```

- 배열의 `sourceId`와 라벨 맵의 키는 2·3단계의 `sourceId`/`id`와 **모두 같아야** 합니다.

---

## 4. 검증

```bash
npm run smartstore:test   # 새 스토어가 목록에 뜨고 상품이 연결되는지 확인
npm run build             # 타입 오류 없는지 확인
```

- `smartstore:test` 출력 맨 아래에 새 항목(`coffeejg: ... 연결 상품 N개`)이 보이고,
  상품 이름이 그 로스터 것이 맞으면 성공입니다.

---

## 5. 실행 파일 다시 만들기 (BeanPick 앱에 반영) — 빠뜨리기 쉬움

소스만 고치면 **켜놓은 BeanPick 앱에는 반영되지 않습니다.**
앱은 `app/` 폴더에 복사된 코드로 돌아가므로, 실행 파일을 다시 만들어야 새 로스터가 보입니다.

```bash
npm run package:portable
```

- **반드시 BeanPick 앱(BeanPick.exe)을 완전히 종료한 뒤** 실행하세요.
  앱이 켜져 있으면 `app/` 폴더가 잠겨서, 새 빌드가 `app-<날짜시간>` 같은 임시 폴더로 빠집니다.
  (그러면 원래 `app/BeanPick.exe`는 옛날 코드 그대로라 새 로스터가 안 보입니다.)
- 출력이 `... app\BeanPick.exe`로 끝나면 원래 위치에 정상 반영된 것입니다.
  `... app-20260615-...\BeanPick.exe`로 끝나면 앱이 안 닫힌 것이니, 닫고 다시 실행합니다.
- 임시 폴더(`app-<날짜시간>`)가 생겼다면 확인 후 삭제합니다.

> 참고: `npm run build`는 화면 코드(`dist/`)만 새로 만들 뿐, 실행 파일에는 옮겨주지 않습니다.
> 실행 파일 반영은 위 `package:portable`가 담당합니다.

---

## 6. 배포 (사용자 승인 후에만)

```bash
git add electron/naverShoppingSearch.cjs src/data/roasterySources.ts
git commit -m "Add <로스터명> smartstore source"
git push origin v1-snapshot:main
```

- 작업 브랜치는 `v1-snapshot`, 배포는 `v1-snapshot:main`으로 푸시합니다.
- **커밋·푸시는 사용자가 명확히 승인했을 때만** 합니다.

---

## 빠른 체크리스트

- [ ] 1단계 임시 스크립트로 `mallName` 확인 → 임시 파일 삭제
- [ ] `naverShoppingSearch.cjs`의 `SMARTSTORE_SOURCES`에 항목 추가
- [ ] `roasterySources.ts`의 `roasterySources`에 항목 추가 (`id` 일치 확인)
- [ ] **`App.jsx`의 `getSmartStoreSourceIds()`·`SMARTSTORE_SOURCE_LABELS`에 추가** (안 하면 불러오기 0건)
- [ ] `npm run smartstore:test` 통과
- [ ] `npm run build` 통과
- [ ] **BeanPick 앱 종료 후** `npm run package:portable` → `app\BeanPick.exe`에 반영 확인
- [ ] 승인 후 커밋 + `v1-snapshot:main` 푸시
