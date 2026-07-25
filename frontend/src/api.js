const API = import.meta.env.VITE_API_URL || '';

async function api(path, opts = {}) {
  const res = await fetch(`${API}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  });
  if (!res.ok) throw new Error((await res.json()).error || 'Request failed');
  return res.json();
}

export const mintAsset = (chipUid, lat, lon, name) =>
  api('/api/mint', { method: 'POST', body: JSON.stringify({ chipUid, lat, lon, name }) });

export const getAssets = () => api('/api/assets');
export const getStatus = () => api('/api/status');
export const getTxFeed = () => api('/api/tx-feed');
export const getEpoch = () => api('/api/epoch');

export const recordTap = (id, lat, lon) =>
  api(`/api/tap/${id}`, { method: 'POST', body: JSON.stringify({ lat, lon }) });

export const getGeoHistory = id => api(`/api/geo-history/${id}`);
export const getProvenance = id => api(`/api/provenance/${id}`);
export const getCertificate = id => api(`/api/certificate/${id}`);

export const transferAsset = (tokenId, to) =>
  api('/api/transfer', { method: 'POST', body: JSON.stringify({ tokenId, to }) });

export const simulateTrade = tokenId =>
  api('/api/trade', { method: 'POST', body: JSON.stringify({ tokenId }) });

export const setCollateral = (id, status) =>
  api(`/api/collateralize/${id}`, { method: 'POST', body: JSON.stringify({ status }) });

export const getRoyalty = id => api(`/api/royalty/${id}`);

export const stakeToken = id =>
  api(`/api/stake/${id}`, { method: 'POST' });

export const unstakeToken = id =>
  api(`/api/unstake/${id}`, { method: 'POST' });

export const claimRewards = id =>
  api(`/api/claim/${id}`, { method: 'POST' });

export const getStakeInfo = id => api(`/api/stake-info/${id}`);
