const API = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export async function mintAsset(chipUid, lat, lon, name) {
  const res = await fetch(`${API}/api/mint`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chipUid, lat, lon, name }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Mint failed');
  }
  return res.json();
}

export async function getAssets() {
  const res = await fetch(`${API}/api/assets`);
  return res.json();
}

export async function transferAsset(tokenId, to) {
  const res = await fetch(`${API}/api/transfer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tokenId, to }),
  });
  if (!res.ok) throw new Error('Transfer failed');
  return res.json();
}

export async function setCollateral(tokenId, status) {
  const res = await fetch(`${API}/api/collateralize/${tokenId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
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
