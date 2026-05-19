import React, { useEffect, useState } from 'react';
import { db } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';

export default function DashboardContributors({ groupId }) {
  const [stage1Tags, setStage1Tags] = useState({});
  const [stage2Tags, setStage2Tags] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchTags() {
      try {
        const [s1, s2] = await Promise.all([
          getDoc(doc(db, 'ngo_stage1', groupId)),
          getDoc(doc(db, 'ngo_stage2', groupId)),
        ]);
        if (s1.exists()) setStage1Tags(s1.data().contributors || {});
        if (s2.exists()) setStage2Tags(s2.data().contributors || {});
      } catch (e) {
        console.error("Failed to fetch tags", e);
      } finally {
        setLoading(false);
      }
    }
    fetchTags();
  }, [groupId]);

  if (loading) return <span className="spinner" style={{ width: 12, height: 12 }} />;

  // Aggregate tags by student
  const studentContributions = {};
  
  const processTags = (tags, stageLabel) => {
    Object.entries(tags).forEach(([field, members]) => {
      members.forEach((m) => {
        if (!studentContributions[m]) studentContributions[m] = { stage1: 0, stage2: 0 };
        if (stageLabel === 'stage1') studentContributions[m].stage1 += 1;
        if (stageLabel === 'stage2') studentContributions[m].stage2 += 1;
      });
    });
  };

  processTags(stage1Tags, 'stage1');
  processTags(stage2Tags, 'stage2');

  const students = Object.keys(studentContributions);
  if (students.length === 0) return <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>No tags recorded</span>;

  return (
    <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
      {students.map((student) => {
        const counts = studentContributions[student];
        const total = counts.stage1 + counts.stage2;
        return (
          <div key={student} style={{
            background: 'var(--navy-4)',
            border: '1px solid var(--glass-border)',
            borderRadius: 'var(--radius)',
            padding: '0.2rem 0.5rem',
            fontSize: '0.7rem',
            color: 'var(--text-muted)'
          }}>
            <strong style={{ color: 'var(--teal)' }}>{student}</strong>
            <span style={{ marginLeft: '0.3rem' }}>{total} contributions</span>
          </div>
        );
      })}
    </div>
  );
}
