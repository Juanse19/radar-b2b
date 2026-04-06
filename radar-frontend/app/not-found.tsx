import Link from 'next/link';
import { Radar } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="p-3 bg-gray-800 rounded-full">
          <Radar size={28} className="text-gray-500" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-white mb-1">404</h2>
          <p className="text-gray-400 text-sm">La página que buscas no existe.</p>
        </div>
        <Link
          href="/"
          className="inline-flex items-center justify-center rounded-lg bg-blue-600 hover:bg-blue-700 px-4 h-8 text-sm font-medium text-white transition-colors"
        >
          Volver al Dashboard
        </Link>
      </div>
    </div>
  );
}
