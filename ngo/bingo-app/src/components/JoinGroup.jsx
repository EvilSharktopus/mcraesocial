// src/components/JoinGroup.jsx
import { useState } from 'react';
import { db } from '../firebase';
import { useAuth } from '../auth/AuthContext';
import {
  collection,
  getDocs,
  query,
  where,
  updateDoc,
  doc,
  arrayUnion,
} from 'firebase/firestore';

export default function JoinGroup() {
  const { user } = useAuth();
  const [code, setCode]     = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState('');

  const handleJoin = async () => {
    const trimmed = code.trim().toUpperCase();
    if (trimmed.length !== 4) {
      setError('Enter the 4-character join code from your teammate.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      // Check not already in a group
      const myGroups = await getDocs(
        query(collection(db, 'ngo_groups'), where('members', 'array-contains', user.uid))
      );
      if (!myGroups.empty) {
        setError('You are already in a group.');
        return;
      }

      // Find the group by code
      const snap = await getDocs(
        query(collection(db, 'ngo_groups'), where('joinCode', '==', trimmed))
      );
      if (snap.empty) {
        setError('Code not found. Double-check with your teammate.');
        return;
      }

      const groupDoc = snap.docs[0];
      const groupData = groupDoc.data();

      if (groupData.members.length >= 4) {
        setError('That group is full (max 4 members).');
        return;
      }

      await updateDoc(doc(db, 'ngo_groups', groupDoc.id), {
        members:     arrayUnion(user.uid),
        memberNames: arrayUnion(user.displayName || user.email),
      });

    } catch (e) {
      setError(e.message || 'Failed to join group.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card" id="join-group-card">
      <h3 style={{ marginBottom: '0.5rem' }}>🔗 Join a group</h3>
      <p style={{ marginBottom: '1.5rem' }}>
        Enter the 4-character code from your group creator.
      </p>
      {error && <div className="alert alert-error" style={{ marginBottom: '1rem' }}>{error}</div>}
      <div className="form-group">
        <input
          id="join-code-input"
          type="text"
          placeholder="e.g. BQTX"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 4))}
          style={{
            textAlign: 'center',
            fontSize: '1.8rem',
            fontWeight: 800,
            letterSpacing: '0.4em',
            textTransform: 'uppercase',
          }}
          maxLength={4}
          onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
        />
      </div>
      <button
        id="join-group-btn"
        className="btn btn-yellow btn-lg"
        style={{ width: '100%', marginTop: '1rem' }}
        onClick={handleJoin}
        disabled={loading || code.trim().length !== 4}
      >
        {loading ? 'Joining…' : 'Join Group'}
      </button>
    </div>
  );
}
