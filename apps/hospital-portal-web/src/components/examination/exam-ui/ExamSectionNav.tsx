'use client';

interface ExamSectionNavItem {
  id: string;
  label: string;
}

interface ExamSectionNavProps {
  items: ExamSectionNavItem[];
}

export function ExamSectionNav({ items }: ExamSectionNavProps) {
  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <nav className="sticky top-0 z-10 -mx-1 mb-3 flex flex-wrap gap-1.5 py-2 px-1 bg-gray-50/95 border-b border-slate-200 backdrop-blur-sm">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => scrollTo(item.id)}
          className="px-2.5 py-1 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-md hover:border-emerald-400 hover:text-emerald-800"
        >
          {item.label}
        </button>
      ))}
    </nav>
  );
}
