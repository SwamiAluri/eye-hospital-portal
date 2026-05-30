'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

export function AdminSectionHub({
  title,
  description,
  links,
}: {
  title: string;
  description: string;
  links: { label: string; href: string; description?: string }[];
}) {
  return (
    <div className="p-6 max-w-3xl">
      <h1 className="text-xl font-bold text-gray-900">{title}</h1>
      <p className="text-sm text-gray-500 mt-1 mb-6">{description}</p>
      <ul className="space-y-3">
        {links.map((link) => (
          <li key={link.href}>
            <Link
              href={link.href}
              className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-xl hover:shadow-md transition-all group"
            >
              <div>
                <p className="font-medium text-gray-900">{link.label}</p>
                {link.description && (
                  <p className="text-xs text-gray-400 mt-0.5">{link.description}</p>
                )}
              </div>
              <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-emerald-600" />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
