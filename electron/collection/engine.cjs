const { fromLegacyProduct, toLegacyProduct } = require('./contract.cjs');
const { getChannelBySourceId, listChannels } = require('./registry.cjs');
const { runSource } = require('./runManager.cjs');

function createCollectionEngine(drivers, dependencies = {}) {
  const findChannel = dependencies.getChannelBySourceId || getChannelBySourceId;
  const getChannels = dependencies.listChannels || listChannels;
  const executeSource = dependencies.runSource || runSource;

  function requireChannel(sourceId) {
    const channel = findChannel(sourceId);
    if (!channel) throw new Error(`등록되지 않은 판매처입니다: ${sourceId}`);
    return channel;
  }

  async function collect(sourceId) {
    const channel = requireChannel(sourceId);
    const driver = drivers[channel.driver];
    if (typeof driver !== 'function') throw new Error(`수집 드라이버가 없습니다: ${channel.driver}`);

    try {
      return await executeSource(sourceId, () => driver(sourceId, channel));
    } catch (error) {
      return {
        ok: false,
        sourceId,
        error: error instanceof Error ? error.message : String(error || '판매처 수집 실패'),
      };
    }
  }

  function promoteProducts(sourceId, products) {
    const channel = requireChannel(sourceId);
    return (Array.isArray(products) ? products : []).map((product) => {
      const record = fromLegacyProduct(product, { channelId: channel.channelId });
      const promoted = toLegacyProduct(record);
      if (product.priceOptions === undefined && record.options.length === 0) delete promoted.priceOptions;
      if (product.priceOptionsComplete === undefined) delete promoted.priceOptionsComplete;
      if (product.priceOptionsStatus === undefined
        && !(product.priceOptionsComplete === true && record.options.length === 0)) {
        delete promoted.priceOptionsStatus;
      }
      if (product.isSoldOut === undefined) delete promoted.isSoldOut;
      if (product.tastingNotes === undefined) delete promoted.tastingNotes;
      return promoted;
    });
  }

  return {
    collect,
    listSources: () => getChannels(),
    promoteProducts,
  };
}

module.exports = { createCollectionEngine };
