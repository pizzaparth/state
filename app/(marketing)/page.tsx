import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight, CheckCircle2, BarChart2, GitCommit } from "lucide-react";

export default function LandingPage() {
  return (
    <div className="max-w-6xl mx-auto px-6 py-20 md:py-28 space-y-32">
      {/* Hero Section */}
      <section className="space-y-8 max-w-3xl">
        <div className="inline-flex items-center px-3 py-1 rounded-full bg-white/[0.05] border border-white/[0.1] text-xs font-mono uppercase tracking-widest text-[#A9A9A6]">
          KSAN RELAY / STATE
        </div>

        <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-[#F4F4F2] uppercase leading-[1.05]">
          Execution,
          <br />
          Measured.
        </h1>

        <p className="text-lg md:text-xl text-[#A9A9A6] leading-relaxed max-w-2xl">
          A quantitative execution system that turns tasks, projects, and completed work into a measurable history of output. No feeds. No AI summaries. No productivity theatre.
        </p>

        <div className="flex flex-wrap gap-4 pt-4">
          <Link href="/register">
            <Button variant="dark-cta" size="lg" className="group">
              <span>Start State</span>
              <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
            </Button>
          </Link>
          <Link href="/principles">
            <Button variant="raised" size="lg" className="bg-[#161616] text-[#F4F4F2] border border-white/10 hover:bg-[#202020]">
              Read Principles
            </Button>
          </Link>
        </div>
      </section>

      {/* Philosophy Matrix */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="p-8 rounded-card bg-white/[0.02] border border-white/[0.08] space-y-4">
          <CheckCircle2 className="w-6 h-6 text-[#F4F4F2]" />
          <h2 className="text-lg font-semibold text-[#F4F4F2]">Execution over planning</h2>
          <p className="text-sm text-[#A9A9A6] leading-relaxed">
            Tasks represent intent. Commits represent executed work. State records what actually happened rather than endless planning.
          </p>
        </div>

        <div className="p-8 rounded-card bg-white/[0.02] border border-white/[0.08] space-y-4">
          <BarChart2 className="w-6 h-6 text-[#F4F4F2]" />
          <h2 className="text-lg font-semibold text-[#F4F4F2]">Deterministic metrics</h2>
          <p className="text-sm text-[#A9A9A6] leading-relaxed">
            Velocity, throughput, cycle time, and consistency calculated transparently. Zero arbitrary scores, XP, or gamification spam.
          </p>
        </div>

        <div className="p-8 rounded-card bg-white/[0.02] border border-white/[0.08] space-y-4">
          <GitCommit className="w-6 h-6 text-[#F4F4F2]" />
          <h2 className="text-lg font-semibold text-[#F4F4F2]">Commit ledger</h2>
          <p className="text-sm text-[#A9A9A6] leading-relaxed">
            Every completed unit of work produces a verifiable commit, forming a continuous execution ledger across individuals and teams.
          </p>
        </div>
      </section>
    </div>
  );
}
