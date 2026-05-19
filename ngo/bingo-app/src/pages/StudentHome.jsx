// src/pages/StudentHome.jsx
// Landing page for authenticated students — routes to group worksite or group formation
import { useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import { useMyGroup } from '../hooks/useMyGroup';
import TopNav from '../components/TopNav';
import CreateGroup from '../components/CreateGroup';
import JoinGroup from '../components/JoinGroup';

export default function StudentHome() {
  const { group, loading } = useMyGroup();
  const navigate = useNavigate();

  // If student is already in a group, redirect straight to worksite
  useEffect(() => {
    if (!loading && group) {
      navigate(`/group/${group.id}`, { replace: true });
    }
  }, [group, loading, navigate]);

  if (loading) {
    return (
      <div className="loading-screen">
        <span className="spinner" />
      </div>
    );
  }

  return (
    <>
      <TopNav />
      <div className="page">
        <div style={{ textAlign: 'center', marginBottom: '3rem', paddingTop: '2rem' }}>
          <div className="phase-badge">Phase 1 · Group Formation</div>
          <h1 style={{ marginBottom: '0.5rem' }}>
            Form your <span style={{ color: 'var(--teal)' }}>NGO</span>
          </h1>
          <p>Create a group or join your teammates with a 4-character code.</p>
        </div>

        <div style={{ display: 'grid', gap: '1.25rem', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
          <CreateGroup />
          <JoinGroup />
        </div>
      </div>
    </>
  );
}
