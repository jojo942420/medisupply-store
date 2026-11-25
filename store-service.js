'use strict';

const dek450Service = "https://br-wild-truth-bd6upfbt-dek450store.compute.c-8.us-east-2.aws.neon.tech";
const dek450CatalogReady = fetch(dek450Service + '/api/catalog', {
  signal: AbortSignal.timeout(8000),
}).then(async response => {
  if (!response.ok) return false;
  const records = await response.json();
  if (!Array.isArray(records) || records.some(product => !product.id || !product.photos?.length)) return false;
  products.splice(0, products.length, ...records);
  return true;
}).catch(() => false);
