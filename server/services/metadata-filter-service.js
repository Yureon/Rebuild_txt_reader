'use strict';

const METADATA_MANUAL_PROVIDER_FILTER_PASS = 'v681-metadata-manual-provider-filter-pass';
const MANUAL_METADATA_PROVIDER_ID = 'manual';

function normalizeMetadataProviderId(value = '') {
  return String(value || '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, 120);
}

function metadataProviderIdFromApplied(metadata = null) {
  return normalizeMetadataProviderId(metadata && metadata.providerId);
}

function metadataProviderMatchesFilter(metadata = null, requestedProviderIds = []) {
  const requested = Array.isArray(requestedProviderIds)
    ? Array.from(new Set(requestedProviderIds.map(normalizeMetadataProviderId).filter(Boolean))).slice(0, 24)
    : [];
  if (!requested.length) return true;
  const providerId = metadataProviderIdFromApplied(metadata);
  return Boolean(providerId && requested.includes(providerId));
}

module.exports = {
  METADATA_MANUAL_PROVIDER_FILTER_PASS,
  MANUAL_METADATA_PROVIDER_ID,
  normalizeMetadataProviderId,
  metadataProviderIdFromApplied,
  metadataProviderMatchesFilter
};
