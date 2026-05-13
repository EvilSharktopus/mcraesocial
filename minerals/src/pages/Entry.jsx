// src/pages/Entry.jsx
// First screen students see — name entry only.
// Stores name in localStorage under key "minerals_student_name".
// No Firestore writes here; the name becomes the Firestore key for all phases.

import { useState } from 'react';

const LS_KEY = 'minerals_student_name';

export default function Entry({ onEnter }) {
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Please enter your name before continuing.');
      return;
    }
    if (trimmed.length < 3) {
      setError('Please use your first name and last initial (e.g. Adam M.)');
      return;
    }
    localStorage.setItem(LS_KEY, trimmed);
    onEnter(trimmed);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleSubmit();
  };

  return (
    <div className="min-h-screen bg-[#0d0d0f] flex flex-col items-center justify-center px-4">
      {/* Background texture */}
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top,_#1a1200_0%,_#0d0d0f_70%)] pointer-events-none" />

      <div className="relative z-10 w-full max-w-md">
        {/* Header */}
        <div className="mb-10 text-center">
          <div className="inline-flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 rounded-full px-4 py-1.5 mb-6">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            <span className="text-amber-400 text-xs font-medium tracking-widest uppercase">
              Class Activity
            </span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-white tracking-tight leading-tight">
            Blood Minerals
          </h1>
          <p className="mt-2 text-lg text-amber-400 font-semibold">
            Take a Stand
          </p>
          <p className="mt-4 text-sm text-white/40 leading-relaxed max-w-xs mx-auto">
            A structured inquiry into one of the most urgent ethical crises of our time.
          </p>
        </div>

        {/* Entry card */}
        <div className="bg-white/[0.04] border border-white/10 rounded-2xl p-8 backdrop-blur-sm shadow-2xl">
          <label
            htmlFor="student-name"
            className="block text-sm font-medium text-white/70 mb-3"
          >
            Enter your first name and last initial
          </label>

          <input
            id="student-name"
            type="text"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (error) setError('');
            }}
            onKeyDown={handleKeyDown}
            placeholder="e.g. Adam M."
            maxLength={40}
            autoComplete="off"
            autoFocus
            className={[
              'w-full rounded-lg border bg-white/5 px-4 py-3',
              'text-white placeholder-white/25 text-base',
              'focus:outline-none focus:ring-2 focus:ring-amber-500/60',
              'transition-colors duration-200',
              error
                ? 'border-red-500/60 focus:ring-red-500/40'
                : 'border-white/10 focus:border-amber-500/40',
            ].join(' ')}
          />

          {error && (
            <p className="mt-2 text-xs text-red-400">{error}</p>
          )}

          <button
            id="enter-btn"
            onClick={handleSubmit}
            disabled={!name.trim()}
            className={[
              'mt-5 w-full py-3 rounded-lg font-semibold text-sm tracking-wide',
              'transition-all duration-200',
              name.trim()
                ? 'bg-amber-500 hover:bg-amber-400 text-black cursor-pointer shadow-lg shadow-amber-500/20'
                : 'bg-white/10 text-white/30 cursor-not-allowed',
            ].join(' ')}
          >
            Enter the activity →
          </button>
        </div>

        <p className="mt-6 text-center text-xs text-white/20">
          Your name is used to save your work. No account needed.
        </p>
      </div>
    </div>
  );
}
