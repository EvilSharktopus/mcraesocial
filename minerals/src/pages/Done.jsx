// src/pages/Done.jsx
// Final confirmation screen — shown after Phase 5 submission.
// No navigation. No further actions. Static display only.

export default function Done({ studentName }) {
  return (
    <div className="min-h-screen bg-[#0d0d0f] flex flex-col items-center justify-center px-4">
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_center,_#001a12_0%,_#0d0d0f_65%)] pointer-events-none" />

      <div className="relative z-10 w-full max-w-md text-center">

        {/* Check icon */}
        <div className="mx-auto mb-8 w-20 h-20 rounded-full bg-teal-500/15 border border-teal-500/30 flex items-center justify-center shadow-xl shadow-teal-500/10">
          <svg
            className="w-10 h-10 text-teal-400"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>

        {/* Heading */}
        <h1 className="text-3xl font-bold text-white mb-3 tracking-tight">
          You're done.
        </h1>

        {/* Name acknowledgement */}
        {studentName && (
          <p className="text-white/40 text-sm mb-6">
            Great work, <span className="text-white/70 font-medium">{studentName}</span>.
          </p>
        )}

        {/* Message card */}
        <div className="bg-white/[0.04] border border-white/10 rounded-2xl p-7 backdrop-blur-sm shadow-2xl">
          <p className="text-white/65 text-sm leading-relaxed">
            Your reflection has been saved. The conversation about blood minerals doesn't end here — but your voice is now part of it.
          </p>

          <div className="mt-6 pt-5 border-t border-white/8">
            <p className="text-xs text-white/25 leading-relaxed">
              You can close this tab. Your responses have been recorded and your teacher can review your work at any time.
            </p>
          </div>
        </div>

        {/* Phase completion indicators */}
        <div className="mt-8 flex items-center justify-center gap-2">
          {['1', '2', '3', '4', '5'].map((n) => (
            <div
              key={n}
              className="flex items-center justify-center w-7 h-7 rounded-full bg-teal-500/20 border border-teal-500/30 text-teal-400 text-xs font-bold"
            >
              {n}
            </div>
          ))}
          <svg className="w-4 h-4 text-teal-400 ml-1" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
        </div>
        <p className="mt-2 text-xs text-white/20">All 5 phases complete</p>

      </div>
    </div>
  );
}
