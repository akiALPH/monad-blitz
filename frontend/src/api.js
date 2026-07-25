const API = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export async function mintAsset(chipUid, lat, lon, name) {
  const res = await fetch(`${API}/api/mint`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chipUid, lat, lon, name }),
  });
  if (!res.ok) throw new Error((await res.json()).error || 'Mint failed');
  return res.json();
}

export async function getAssets() {
  const res = await fetch(`${API}/api/assets`);
  return res.json();
}

export async function recordTap(tokenId, lat, lon) {
  const res = await fetch(`${API}/api/tap/${tokenId}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ lat, lon }),
  });
  if (!res.ok) throw new Error((await res.json()).error || 'Tap failed');
  return res.json();
}

export async function getGeoHistory(tokenId) {
  const res = await fetch(`${API}/api/geo-history/${tokenId}`);
  return res.json();
}

export async function getProvenance(tokenId) {
  const res = await fetch(`${API}/api/provenance/${tokenId}`);
  return res.json();
}

export async function getCertificate(tokenId) {
  const res = await fetch(`${API}/api/certificate/${tokenId}`);
  return res.json();
}

export async function transferAsset(tokenId, to) {
  const res = await fetch(`${API}/api/transfer`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tokenId, to }),
  });
  if (!res.ok) throw new Error('Transfer failed');
  return res.json();
}

export async function setCollateral(tokenId, status) {
  const res = await fetch(`${API}/api/collateralize/${tokenId}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  });
  if (!res.ok) throw new Error('Collateral update failed');
  return res.json();
}

export async function getRoyalty(tokenId) {
  const res = await fetch(`${API}/api/royalty/${tokenId}`);
  return res.json();
}

export async function getStatus() {
  const res = await fetch(`${API}/api/status`);
  return res.json();
}
