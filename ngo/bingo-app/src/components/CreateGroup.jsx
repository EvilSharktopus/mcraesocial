// src/components/CreateGroup.jsx
import { useState } from 'react';
import { db } from '../firebase';
import { useAuth } from '../auth/AuthContext';
import {
  collection,
  doc,
  getDocs,
  setDoc,
  query,
  where,
  serverTimestamp,
} from 'firebase/firestore';

function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no ambiguous chars
  return Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

async function generateUniqueCode() {
  for (let i = 0; i < 10; i++) {
    const code = generateCode();
    const snap = await getDocs(query(collection(db, 'ngo_groups'), where('joinCode', '==', code)));
    if (snap.empty) return code;
  }
  throw new Error('Could not generate a unique join code. Try again.');
}

export default function CreateGroup() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  const handleCreate = async () => {
    setError('');
    setLoading(true);
    try {
      // Check not already in a group
      const existing = await getDocs(
        query(collection(db, 'ngo_groups'), where('members', 'array-contains', user.uid))
      );
      if (!existing.empty) {
        setError('You are already in a group.');
        return;
      }

      const joinCode = await generateUniqueCode();
      const groupRef = doc(collection(db, 'ngo_groups'));

      // Create group doc
      await setDoc(groupRef, {
        groupId:      groupRef.id,
        joinCode,
        members:      [user.uid],
        memberNames:  [user.displayName || user.email],
        createdBy:    user.uid,
        createdAt:    serverTimestamp(),
        ngoName:      '',
        tagline:      '',
        phase1Stage:  1,
        stage1Approved: false,
        stage2Approved: false,
        teacherNote:  '',
        fundingReceived: 0,
        funded:       false,
      });

      // Create empty stage docs
      await setDoc(doc(db, 'ngo_stage1', groupRef.id), {
        groupId:           groupRef.id,
        issue:             '',
        whyThisIssue:      '',
        globalContext:     '',
        aiPrompts:         Array.from({ length: 5 }, () => ({ prompt: '', hoping: '' })),
        locationChosen:    '',
        locationJustification: '',
        roughSolution:     '',
        lastUpdated:       serverTimestamp(),
      });

      await setDoc(doc(db, 'ngo_stage2', groupRef.id), {
        groupId:         groupRef.id,
        specificProblem: '',
        rootCauses:      '',
        whoAffected:     '',
        stat1:           '',
        stat1Source:     '',
        stat2:           '',
        stat2Source:     '',
        intervention:    '',
        timeline:        [],
        budget:          [],
        lastUpdated:     serverTimestamp(),
      });

    } catch (e) {
      setError(e.message || 'Failed to create group.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card" id="create-group-card">
      <h3 style={{ marginBottom: '0.5rem' }}>🚀 Start a new group</h3>
      <p style={{ marginBottom: '1.5rem' }}>
        You'll get a join code to share with up to 3 teammates.
      </p>
      {error && <div className="alert alert-error" style={{ marginBottom: '1rem' }}>{error}</div>}
      <button
        id="create-group-btn"
        className="btn btn-primary btn-lg"
        style={{ width: '100%' }}
        onClick={handleCreate}
        disabled={loading}
      >
        {loading ? 'Creating…' : 'Create Group'}
      </button>
    </div>
  );
}
