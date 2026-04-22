import { redirect } from 'next/navigation';
import { getCurrentProfile, listProfiles, listMagasins } from '@/lib/supabase/queries';
import UsersTable from './UsersTable';
import NewUserForm from './NewUserForm';

export const dynamic = 'force-dynamic';

export default async function UsersPage() {
  const me = await getCurrentProfile();
  if (!me) redirect('/signin?redirect=/users');
  if (me.role !== 'admin') redirect('/');

  const [profiles, magasins] = await Promise.all([listProfiles(), listMagasins()]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="mb-2 text-2xl font-semibold text-gray-800 dark:text-white/90">
          Utilisateurs
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Gestion des comptes Komilfo — créer, activer ou désactiver des accès.
        </p>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
        <h2 className="mb-4 text-lg font-semibold text-gray-800 dark:text-white/90">
          Nouvel utilisateur
        </h2>
        <NewUserForm magasins={magasins} />
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
        <UsersTable users={profiles} />
      </div>
    </div>
  );
}
