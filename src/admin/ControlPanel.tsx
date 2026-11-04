import { useState } from 'react';
import AdminConsole from '@/admin/AdminConsole';
import UserAppsPanel from '@/admin/UserAppsPanel';
import { Landmark } from 'lucide-react';

interface ControlPanelProps {
  adminId: string;
}

const TABS = [
  { id: 'users', label: 'Users' },
  { id: 'apps', 'label': 'User Apps' },
] as const;

export default function ControlPanel({ adminId }: ControlPanelProps) {
  const [tab, setTab] = useState<(typeof TABS)[number]['id']>('users');

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-gradient-to-r from-teal-700 to-teal-800 p-6 text-white shadow-sm">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15">
            <Landmark className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Grambo Seva Kendra Portal</h1>
            <p className="mt-0.5 text-sm text-teal-100">Master control panel</p>
          </div>
        </div>
      </div>

      <div className="inline-flex rounded-xl bg-white p-1 shadow-sm ring-1 ring-slate-200">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            aria-pressed={tab === item.id}
            onClick={() => setTab(item.id)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              tab === item.id ? 'bg-slate-900 text-white' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === 'users' ? <AdminConsole adminId={adminId} /> : <UserAppsPanel />}
    </div>
  );
}
