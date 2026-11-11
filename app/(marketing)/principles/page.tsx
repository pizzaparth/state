import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Principles",
  description: "Why State has no AI clutter, no gamification and no employee surveillance: a task manager built on deterministic, explainable metrics.",
  alternates: { canonical: "/principles" },
};

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
      desc: "State is built for output and project delivery. It does not track keystrokes, hours-online rankings, mouse activity, or forced employee leaderboards.",
    },
  ];

  return (
    <div className="max-w-4xl mx-auto px-6 pt-40 pb-20 md:pb-28 space-y-16">
      <div className="space-y-4">
        <span className="text-sm font-mono uppercase tracking-widest text-accent">
          Manifesto
        </span>
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-[#FFFFFF] uppercase">
          Product Principles
        </h1>
        <p className="text-[#B4BEDB] text-base md:text-base leading-relaxed">
          State is a personal hobby project by Parth Pancholi for measuring execution. These principles guide its architecture and design.
        </p>
      </div>

      <div className="space-y-2 rounded-[28px] border border-white/[0.1] bg-[#16244D] p-2">
        {principles.map((p) => (
          <div key={p.number} className="grid grid-cols-1 items-start gap-4 rounded-[20px] border border-white/[0.16] bg-[#1E2E5C] p-6 md:grid-cols-4">
            <span className="font-mono text-base font-semibold text-accent">{p.number}</span>
            <div className="md:col-span-3 space-y-2">
              <h2 className="text-lg font-semibold text-[#FFFFFF]">{p.title}</h2>
              <p className="text-base text-[#B4BEDB] leading-relaxed">{p.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
