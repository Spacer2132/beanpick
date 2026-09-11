// 수집 엔진 교체 5단계: 판매처 등록 계층.
// 흩어져 있던 스마트스토어·공식몰 설정을 한 목록으로 모아, 식별자와 플랫폼 드라이버를 한 곳에서 정한다.
// 설정 값을 새로 적지 않고 각 수집기가 실제로 쓰는 설정에서 읽는다. 그래야 두 벌이 어긋나지 않는다.
//
// 시간 예산·재시도 값은 여기에 두지 않는다. 실측으로 정해진 값이 수집기 안에 있고
// (CLAUDE.md 절대금지 2번), 여기에 옮겨 적으면 두 벌이 되어 어긋난다.
const { createChannelId } = require('./contract.cjs');
const { SMARTSTORE_SOURCES } = require('../naverShoppingSearch.cjs');
const { OFFICIAL_MALL_PAGE_CONFIGS } = require('./officialMallSources.cjs');

// 별도 수집 경로를 쓰는 판매처. 주소는 main.cjs의 상수와 같아야 하며 테스트가 이를 확인한다.
const STANDALONE_CHANNELS = [
  {
    sourceId: 'momos',
    roasterName: '모모스커피',
    channelType: 'officialMall',
    platform: 'imweb',
    driver: 'momosShop',
    listUrls: ['https://momos.co.kr/shop'],
  },
  {
    sourceId: 'terarosa',
    roasterName: '테라로사',
    channelType: 'officialMall',
    platform: 'api',
    driver: 'terarosaApi',
    listUrls: ['https://www.terarosa.com/product/list/?category=12'],
  },
];

function toMatchKey(listUrl) {
  const url = String(listUrl || '');
  const smartStore = url.match(/smartstore\.naver\.com\/([^/?#]+)/i)?.[1];
  if (smartStore) return `smartstore.naver.com/${smartStore}`;
  return url.match(/^https?:\/\/([^/?#]+)/i)?.[1] || '';
}

function buildChannels() {
  const channels = [];

  for (const source of Object.values(SMARTSTORE_SOURCES)) {
    const listUrls = [source.categoryUrl, ...(source.categoryUrls || []), source.storeUrl].filter(Boolean);
    channels.push({
      channelId: createChannelId(source.sourceId, 'smartStore'),
      sourceId: source.sourceId,
      roasteryId: source.sourceId,
      roasterName: source.roasterName,
      channelType: 'smartStore',
      platform: 'smartStore',
      driver: 'smartStoreCategory',
      listUrls,
      matchKey: toMatchKey(listUrls[0]),
    });
  }

  for (const [sourceId, config] of Object.entries(OFFICIAL_MALL_PAGE_CONFIGS)) {
    channels.push({
      channelId: createChannelId(sourceId, 'officialMall'),
      sourceId,
      roasteryId: sourceId,
      roasterName: config.roasterName,
      channelType: 'officialMall',
      platform: config.platform || 'cafe24',
      driver: 'officialMallPages',
      listUrls: [config.sourceUrl],
      matchKey: toMatchKey(config.detailOrigin || config.sourceUrl),
    });
  }

  for (const entry of STANDALONE_CHANNELS) {
    channels.push({
      ...entry,
      channelId: createChannelId(entry.sourceId, entry.channelType),
      roasteryId: entry.sourceId,
      matchKey: toMatchKey(entry.listUrls[0]),
    });
  }

  // 긴 matchKey를 먼저 검사해야 스마트스토어 스토어별 구분이 유지된다.
  return channels.sort((a, b) => b.matchKey.length - a.matchKey.length);
}

const CHANNELS = buildChannels();

function listChannels() {
  return CHANNELS.map((channel) => ({ ...channel }));
}

function getChannel(channelId) {
  return CHANNELS.find((channel) => channel.channelId === channelId) || null;
}

function getChannelBySourceId(sourceId) {
  return CHANNELS.find((channel) => channel.sourceId === sourceId) || null;
}

// 원문 저장·실행 기록이 쓰는 채널 ID. 문자열을 각자 이어 붙이지 않게 한 곳에서 만든다.
function getChannelId(sourceId) {
  return getChannelBySourceId(sourceId)?.channelId || `${sourceId}:unknown`;
}

function findChannelByUrl(url) {
  const text = String(url || '');
  return CHANNELS.find((channel) => channel.matchKey && text.includes(channel.matchKey)) || null;
}

// 설정이 여러 파일에 흩어져 있으므로, 서로 어긋나면 조용히 넘기지 않고 목록으로 돌려준다.
function checkRegistryDrift() {
  const problems = [];
  const seen = new Set();

  for (const channel of CHANNELS) {
    if (seen.has(channel.channelId)) problems.push(`판매처 ID가 중복입니다: ${channel.channelId}`);
    seen.add(channel.channelId);
    if (!channel.roasterName) problems.push(`${channel.channelId}에 로스터리 이름이 없습니다.`);
    if (channel.listUrls.length === 0) problems.push(`${channel.channelId}에 목록 주소가 없습니다.`);
    if (!channel.matchKey) problems.push(`${channel.channelId}의 주소에서 판별 키를 만들지 못했습니다.`);
  }

  return problems;
}

module.exports = {
  listChannels,
  getChannel,
  getChannelBySourceId,
  getChannelId,
  findChannelByUrl,
  checkRegistryDrift,
};
