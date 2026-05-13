// src/pages/Feed.jsx
// Live, auto-scrolling anonymous feed of student positions.
// Perfect for classroom projection.

import { useState, useEffect } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';

const BADGE_STYLES = {
  A: 'bg-rose-500/20 text-rose-300 border border-rose-500/30',
  B: 'bg-sky-500/20 text-sky-300 border border-sky-500/30',
  C: 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30',
  D: 'bg-violet-500/20 text-violet-300 border border-violet-500/30',
};

const POSITION_LABELS = {
  A: 'Corporations are most responsible',
  B: 'Governments / International Law',
  C: 'Consumers have more power than they think',
  D: 'The system hurts more than it helps',
};

// Generate a deterministic pseudo-anonymous handle from the document ID or name
function getHandle(id) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hex = (hash & 0xFFFFFF).toString(16).padStart(6, '0');
  return `@user_${hex.slice(0, 4)}`;
}

export default function Feed() {
  const [gallery, setGallery] = useState([]);
  const [isHovered, setIsHovered] = useState(false);

  // Fetch live gallery
  useEffect(() => {
    const galleryCol = collection(db, 'sessions', 'minerals', 'gallery');
    const unsub = onSnapshot(galleryCol, (snap) => {
      const entries = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      // Sort newest first for a "live feed" feel
      entries.sort((a, b) => (b.submittedAt ?? 0) - (a.submittedAt ?? 0));
      setGallery(entries);
    });
    return () => unsub();
  }, []);

  // Auto-scroll logic
  useEffect(() => {
    if (isHovered) return; // Pause on hover
    
    let animationFrameId;
    
    const scroll = () => {
      // Scroll down by 1 pixel
      window.scrollBy(0, 1);
      
      // If we've reached the bottom, smoothly jump to top
      if (Math.ceil(window.scrollY + window.innerHeight) >= document.documentElement.scrollHeight) {
        window.scrollTo(0, 0);
      }
      
      animationFrameId = requestAnimationFrame(scroll);
    };
    
    // Slight delay before starting scroll to allow rendering
    const timeoutId = setTimeout(() => {
      animationFrameId = requestAnimationFrame(scroll);
    }, 2000);
    
    return () => {
      clearTimeout(timeoutId);
      cancelAnimationFrame(animationFrameId);
    };
  }, [isHovered, gallery.length]);

  return (
    <div className="min-h-screen bg-transparent px-4 py-12"
         onMouseEnter={() => setIsHovered(true)}
         onMouseLeave={() => setIsHovered(false)}
    >
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(0,13,26,0.5)_0%,_transparent_70%)] pointer-events-none" />
      
      <div className="relative z-10 max-w-3xl mx-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between mb-10 sticky top-4 z-20 bg-[#0d0d0f]/80 backdrop-blur-md border border-white/10 rounded-2xl p-4 shadow-xl">
          <div className="flex items-center gap-3">
            <span className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_10px_rgba(52,211,153,0.6)]" />
            <h1 className="text-xl font-bold tracking-wide text-white">Live Feed</h1>
          </div>
          <span className="text-white/40 text-sm font-mono tracking-widest uppercase">
            {gallery.length} Responses
          </span>
        </div>

        {/* Feed container */}
        <div className="space-y-6 pb-[50vh]">
          {gallery.length === 0 ? (
            <div className="text-center py-20 text-white/30 border border-white/10 rounded-2xl bg-white/[0.02]">
              Waiting for submissions...
            </div>
          ) : (
            gallery.map((entry) => {
              const badgeClass = BADGE_STYLES[entry.position] ?? 'bg-white/10 text-white/50 border border-white/15';
              const label = POSITION_LABELS[entry.position] ?? entry.position;
              
              return (
                <div 
                  key={entry.id} 
                  className="bg-white/[0.04] border border-white/10 rounded-2xl p-6 shadow-lg backdrop-blur-sm transition-all duration-300 hover:bg-white/[0.06] hover:scale-[1.01]"
                >
                  <div className="flex items-start justify-between mb-4 gap-4">
                    {/* Fake avatar & handle */}
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-white/10 to-white/5 flex items-center justify-center border border-white/10">
                        <svg className="w-5 h-5 text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-white/80 font-bold text-sm">Anonymous</p>
                        <p className="text-white/40 text-xs font-mono">{getHandle(entry.id)}</p>
                      </div>
                    </div>
                    
                    {/* Position Badge */}
                    <div className="flex flex-col items-end gap-1">
                      <span className={`text-xs font-bold px-3 py-1 rounded-full ${badgeClass}`}>
                        Position {entry.position}
                      </span>
                      <span className="text-white/30 text-[10px] uppercase tracking-wider hidden sm:block max-w-[200px] truncate text-right">
                        {label}
                      </span>
                    </div>
                  </div>
                  
                  {/* Defence Text */}
                  <p className="text-white/85 text-base leading-relaxed pl-13">
                    {entry.defence}
                  </p>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
