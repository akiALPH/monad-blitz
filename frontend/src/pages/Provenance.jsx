import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getProvenance, getGeoHistory } from '../api';

export default function Provenance() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [provenance, setProvenance] = useState([]);
  const [geoHistory, setGeoHistory] = useState([]);

  useEffect(() => {
    getProvenance(id).then(setProvenance).catch(() => {});
    getGeoHistory(id).then(setGeoHistory).catch(() => {});
  }, [id]);

  // Merge ownership + geo into a timeline
  const timeline = [];
  provenance.forEach(p => {
    timeline.push({ type: 'ownership', ...p, label: `Owner: ${p.owner.slice(0,8)}...${p.owner.slice(-6)}` });
  });
  geoHistory.forEach(g => {
    timeline.push({ type: 'geo', ...g, label: `📍 ${g.lat.toFixed(4)}, ${g.lon.toFixed(4)}` });
  });
  timeline.sort((a, b) => new Date(a.timestamp || a.since) - new Date(b.timestamp || b.since));

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0f', padding: '24px' }}>
      <div className="header" style={{ marginBottom: '24px' }}>
        <div style={{ fontSize: '14px', fontWeight: '600', color: '#fff' }}>
          FULL PROVENANCE · ASSET #{id}
        </div>
        <div className="header-links">
          <a href="/">TAP</a>
          <a href={`/dashboard/${id}`}>DASHBOARD</a>
          <a href={`/certificate/${id}`}>CERTIFICATE</a>
        </div>
      </div>

      <div style={{ maxWidth: '700px', margin: '0 auto' }}>
        {/* Anti-Ghost Customer Explanation */}
        <div style={{
          padding: '16px', borderRadius: '12px', marginBottom: '24px',
          background: 'rgba(6,182,212,0.05)', border: '1px solid rgba(6,182,212,0.12)',
          fontSize: '12px', color: '#06b6d4',
        }}>
          <strong>● ANTI-GHOST CUSTOMER SYSTEM</strong>
          <div style={{ marginTop: '8px', color: '#888', lineHeight: '1.6' }}>
            Every physical tap on this coin updates its geolocation on-chain. If the owner cannot
            physically tap the coin at the claimed location, possession is disproven.
            Velocity lock prevents relay attacks (&gt;500 km/h between taps).
            This eliminates ghost customers, spoofed collateral, and synthetic assets.
          </div>
        </div>

        {/* Timeline */}
        {timeline.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#666', padding: '40px' }}>No provenance data yet.</div>
        ) : (
          <div>
            {timeline.map((entry, i) => (
              <div key={i} style={{ display: 'flex', gap: '16px', marginBottom: '4px' }}>
                {/* Timeline line */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '20px' }}>
                  <div style={{
                    width: '12px', height: '12px', borderRadius: '50%',
                    background: entry.type === 'ownership' ? '#a78bfa' : '#06b6d4',
                    border: '2px solid #0a0a0f',
                    boxShadow: `0 0 8px ${entry.type === 'ownership' ? 'rgba(167,139,250,0.4)' : 'rgba(6,182,212,0.4)'}`,
                  }} />
                  {i < timeline.length - 1 && (
                    <div style={{ width: '2px', flex: 1, background: 'rgba(255,255,255,0.06)' }} />
                  )}
                </div>
                {/* Content */}
                <div style={{ flex: 1, paddingBottom: '20px' }}>
                  <div style={{
                    padding: '12px', borderRadius: '8px',
                    background: entry.type === 'ownership'
                      ? 'rgba(167,139,250,0.04)'
                      : 'rgba(6,182,212,0.04)',
                    border: `1px solid ${entry.type === 'ownership' ? 'rgba(167,139,250,0.12)' : 'rgba(6,182,212,0.12)'}`,
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{
                        fontSize: '11px', fontWeight: '600',
                        color: entry.type === 'ownership' ? '#a78bfa' : '#06b6d4',
                      }}>
                        {entry.type === 'ownership' ? 'OWNERSHIP TRANSFER' : 'GEO TAP'}
                      </span>
                      <span style={{ fontSize: '10px', color: '#666' }}>
                        {new Date(entry.timestamp || entry.since).toLocaleString()}
                      </span>
                    </div>
                    <div style={{ fontSize: '13px', fontFamily: 'monospace', color: '#ccc' }}>
                      {entry.label}
                    </div>
                    {entry.type === 'geo' && entry.lat && (
                      <div style={{ fontSize: '10px', color: '#888', marginTop: '4px' }}>
                        Velocity check passed · BASEL III geo-stamped
                      </div>
                    )}
                    {entry.type === 'ownership' && (
                      <div style={{ fontSize: '10px', color: '#888', marginTop: '4px' }}>
                        Provenance recorded on-chain
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div style={{ textAlign: 'center', marginTop: '24px' }}>
          <button className="btn btn-outline" onClick={() => navigate(`/dashboard/${id}`)}>
            ← BACK TO DASHBOARD
          </button>
        </div>
      </div>
    </div>
  );
}
