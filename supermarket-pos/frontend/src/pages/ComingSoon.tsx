export default function ComingSoon({ title }: { title: string }) {
  return (
    <div className="p-8">
      <h1 className="font-display text-2xl font-semibold text-ink">{title}</h1>
      <div className="mt-6 rounded-xl border border-dashed border-ink/15 bg-white p-6 text-sm text-ink/60">
        This module isn't built yet — check <span className="figure">docs/ROADMAP.md</span> for when it's coming.
      </div>
    </div>
  );
}
