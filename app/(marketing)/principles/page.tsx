export default function PrinciplesPage() {
  const principles = [
    {
      number: "01",
      title: "Execution over planning",
      desc: "State optimizes for completed work rather than elaborate planning. Capturing tasks, executing them, and recording completed output occurs with minimal friction.",
    },
    {
      number: "02",
      title: "Measurement over motivation",
      desc: "No badges, XP systems, confetti, artificial streaks, or motivational quotes. Metrics describe execution objectively without manipulating behaviour.",
    },
    {
      number: "03",
      title: "Deterministic over opaque",
      desc: "All calculations are explainable. If State displays velocity, throughput, or cycle time, you can inspect the exact mathematical formula.",
    },
    {
      number: "04",
      title: "Fast over feature-heavy",
      desc: "State prioritizes keyboard navigation, low latency, rapid capture, instant board transitions, and restrained animation.",
    },
    {
      number: "05",
      title: "No AI clutter",
      desc: "State does not generate AI summaries, synthetic suggestions, or conversational sidebars. The tool acts as a deterministic instrument.",
    },
    {
      number: "06",
      title: "No employee surveillance",
      desc: "State is built for output and project delivery. We do not track keystrokes, hours-online rankings, mouse activity, or forced employee leaderboards.",
    },
  ];

  return (
    <div className="max-w-4xl mx-auto px-6 py-20 md:py-28 space-y-16">
      <div className="space-y-4">
        <span className="text-xs font-mono uppercase tracking-widest text-[#A9A9A6]">
          Manifesto
        </span>
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-[#F4F4F2] uppercase">
          Product Principles
        </h1>
        <p className="text-[#A9A9A6] text-sm md:text-base leading-relaxed">
          State is infrastructure for measuring execution. These non-negotiable principles guide its architecture, design, and future development.
        </p>
      </div>

      <div className="divide-y divide-white/[0.08]">
        {principles.map((p) => (
          <div key={p.number} className="py-8 grid grid-cols-1 md:grid-cols-4 gap-4 items-start">
            <span className="font-mono text-sm text-[#6F6F6B]">{p.number}</span>
            <div className="md:col-span-3 space-y-2">
              <h2 className="text-lg font-semibold text-[#F4F4F2]">{p.title}</h2>
              <p className="text-sm text-[#A9A9A6] leading-relaxed">{p.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
