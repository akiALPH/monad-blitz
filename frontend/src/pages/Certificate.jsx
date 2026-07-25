import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getCertificate } from '../api';

export default function Certificate() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [cert, setCert] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getCertificate(id).then(setCert).catch(() => {}).finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div style={{ padding: '48px', textAlign: 'center', color: '#666' }}>Generating certificate...</div>;
  if (!cert) return <div style={{ padding: '48px', textAlign: 'center', color: '#ef4444' }}>Certificate unavailable</div>;

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0f', padding: '24px' }}>
      <div className="header" style={{ marginBottom: '24px' }}>
        <div style={{ fontSize: '14px', fontWeight: '600', color: '#fff' }}>
          CERTIFICATE OF AUTHENTICITY
        </div>
        <div className="header-links">
          <a href="/">TAP</a>
          <a href={`/dashboard/${id}`}>DASHBOARD</a>
          <a href={`/provenance/${id}`}>PROVENANCE</a>
        </div>
      </div>

      {/* Certificate Card */}
      <div style={{ maxWidth: '700px', margin: '0 auto' }}>
        <div className="dash-card" style={{
          borderColor: 'rgba(218,165,32,0.3)', position: 'relative',
          background: 'linear-gradient(135deg, rgba(20,15,10,0.95), rgba(15,10,20,0.95))',
        }}>
          {/* Gold seal */}
          <div style={{
            position: 'absolute', top: '-10px', right: '20px',
            width: '60px', height: '60px', borderRadius: '50%',
            background: 'linear-gradient(145deg, #daa520, #b8860b)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '9px', fontWeight: 'bold', color: '#1a1a2e', textAlign: 'center',
            border: '2px solid #f0d060', boxShadow: '0 0 20px rgba(218,165,32,0.3)',
            lineHeight: '1.2', padding: '4px',
          }}>LUXVOID<br/>VERIFIED</div>

          <div className="dash-card-title" style={{ color: '#daa520', fontSize: '10px', marginBottom: '20px' }}>
            ● CERTIFICATE ID: {cert.certificateId}
          </div>

          <div style={{ display: 'grid', gap: '16px' }}>
            <div>
              <div style={{ fontSize: '10px', color: '#888', letterSpacing: '1px', marginBottom: '4px' }}>ASSET TOKEN</div>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#fff' }}>#{cert.assetTokenId}</div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <div style={{ fontSize: '10px', color: '#888', letterSpacing: '1px', marginBottom: '4px' }}>MINTER</div>
                <div style={{ fontSize: '11px', fontFamily: 'monospace', color: '#06b6d4' }}>
                  {cert.minter?.slice(0, 8)}...{cert.minter?.slice(-6)}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '10px', color: '#888', letterSpacing: '1px', marginBottom: '4px' }}>CURRENT OWNER</div>
                <div style={{ fontSize: '11px', fontFamily: 'monospace', color: '#a78bfa' }}>
                  {cert.currentOwner?.slice(0, 8)}...{cert.currentOwner?.slice(-6)}
                </div>
              </div>
            </div>

            {/* Ownership Timeline */}
            <div>
              <div style={{ fontSize: '10px', color: '#888', letterSpacing: '1px', marginBottom: '8px' }}>OWNERSHIP HISTORY</div>
              {cert.ownershipHistory.map((o, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  padding: '6px 10px',
                  background: i === cert.ownershipHistory.length - 1 ? 'rgba(167,139,250,0.05)' : 'transparent',
                  borderLeft: '2px solid rgba(167,139,250,0.3)',
                  marginLeft: '8px', fontSize: '11px', fontFamily: 'monospace', color: '#ccc',
                }}>
                  <span style={{ color: '#a78bfa', fontSize: '8px' }}>{i === 0 ? '●' : '○'}</span>
                  {o.owner.slice(0, 8)}...{o.owner.slice(-6)}
                  <span style={{ color: '#555' }}>· {new Date(o.since).toLocaleDateString()}</span>
                </div>
              ))}
            </div>

            {/* Current Geo */}
            <div>
              <div style={{ fontSize: '10px', color: '#888', letterSpacing: '1px', marginBottom: '4px' }}>CURRENT GEOLOCATION (BASEL III)</div>
              <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#fff' }}>
                {cert.currentGeo.lat.toFixed(4)}, {cert.currentGeo.lon.toFixed(4)}
              </div>
              <div style={{ fontSize: '10px', color: '#888' }}>
                Last verified: {new Date(cert.currentGeo.lastVerified).toLocaleString()} · {cert.currentGeo.totalLifetimeTaps} lifetime taps
              </div>
            </div>

            {/* Geo History Summary */}
            {cert.geoHistory.length > 1 && (
              <div>
                <div style={{ fontSize: '10px', color: '#888', letterSpacing: '1px', marginBottom: '8px' }}>
                  GEO HISTORY ({cert.geoHistory.length} points)
                </div>
                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                  {cert.geoHistory.map((g, i) => (
                    <div key={i} style={{
                      padding: '4px 8px', borderRadius: '4px',
                      background: 'rgba(6,182,212,0.06)',
                      border: '1px solid rgba(6,182,212,0.1)',
                      fontSize: '10px', fontFamily: 'monospace', color: '#06b6d4',
                    }}>
                      {g.lat.toFixed(2)},{g.lon.toFixed(2)}
                      <span style={{ color: '#555', display: 'block', fontSize: '8px' }}>
                        {new Date(g.timestamp).toLocaleDateString()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Collateral Status */}
            <div>
              <div className={`tps-badge ${cert.collateralStatus ? 'green' : 'cyan'}`} style={{ display: 'inline-flex' }}>
                {cert.collateralStatus ? '✅ COLLATERALIZED' : '◌ NOT COLLATERALIZED'}
              </div>
              <div className="tps-badge cyan" style={{ display: 'inline-flex', marginLeft: '6px' }}>
                ROYALTY: {cert.royaltyBps / 100}%
              </div>
            </div>

            {/* Verification */}
            <div style={{
              padding: '12px', borderRadius: '8px',
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid rgba(255,255,255,0.06)',
              fontSize: '10px', color: '#666', fontFamily: 'monospace', wordBreak: 'break-all',
            }}>
              <div>Verification Hash: SHA256:{cert.verificationHash?.slice(0, 32)}...</div>
              <div style={{ marginTop: '4px' }}>
                Blockchain: <a href={cert.blockchainVerification} target="_blank" rel="noreferrer"
                  style={{ color: '#06b6d4' }}>Monadscan →</a>
              </div>
            </div>

            {/* PandaDoc-style footer */}
            <div style={{
              textAlign: 'center', paddingTop: '12px',
              borderTop: '1px solid rgba(255,255,255,0.06)',
              fontSize: '10px', color: '#555', fontStyle: 'italic',
            }}>
              {cert.legalDisclaimer}
            </div>
          </div>
        </div>

        <div style={{ textAlign: 'center', marginTop: '16px' }}>
          <button className="btn btn-outline" onClick={() => navigate(`/dashboard/${id}`)}>
            ← BACK TO DASHBOARD
          </button>
        </div>
      </div>
    </div>
  );
}
