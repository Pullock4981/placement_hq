'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BarChart2, Loader2, Pencil, Search, Users } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import type { User, UserRole, UserStatus } from '@/types';
import { DashboardPageHeader } from '@/components/dashboard/dashboard-page-header';

type UserDraft = { role: UserRole; status: UserStatus; active: boolean };

export function UserManagement({ viewerRole = 'admin' }: { viewerRole?: 'admin' | 'manager' }) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [draft, setDraft] = useState<UserDraft>({ role: 'mentor', status: 'pending', active: false });
  const users = useQuery<{ data: User[] }>({
    queryKey: ['managed-users', viewerRole],
    queryFn: async () => {
      const response = await fetch('/api/admin/users', { cache: 'no-store' });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || 'Unable to load users.');
      return payload;
    },
  });
  const update = useMutation({
    mutationFn: async () => {
      if (!editingUser) return;
      const response = await fetch('/api/admin/users', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: editingUser.id, ...draft }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || 'Unable to update user.');
      return payload;
    },
    onSuccess: async () => {
      toast.success('User access updated');
      setEditingUser(null);
      await queryClient.invalidateQueries({ queryKey: ['managed-users'] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Unable to update user.'),
  });
  const allUsers = useMemo(() => users.data?.data ?? [], [users.data?.data]);
  const visibleUsers = useMemo(() => {
    const query = search.trim().toLowerCase();
    return allUsers.filter((user) => !query || [user.name, user.email, user.team_nickname, user.discord_username, user.role, user.status].some((value) => value?.toLowerCase().includes(query)));
  }, [allUsers, search]);

  function openEditor(user: User) {
    setEditingUser(user);
    setDraft({ role: user.role, status: user.status ?? 'pending', active: user.active });
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-10">
      <DashboardPageHeader
        eyebrow={`Programming Hero · ${viewerRole === 'admin' ? 'Admin' : 'Manager'} Access Control`}
        title="User Management"
        description={viewerRole === 'admin' ? 'View every account and update its role, approval status, and active access.' : 'Manage non-admin accounts, approval status, and active access.'}
        context={
          <div className="flex items-center gap-2">
            <Link href="/admin/tools-view">
              <Button size="sm" className="bg-white/20 hover:bg-white/30 text-white font-bold gap-2 shadow-sm border border-white/20 backdrop-blur">
                <BarChart2 className="h-4 w-4 text-amber-300" />
                Tools View
              </Button>
            </Link>
          </div>
        }
      />

      <Card className="overflow-hidden border-0 shadow-sm ring-1 ring-border">
        <div className="flex flex-col gap-3 border-b bg-muted/20 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-violet-600" />
            <p className="font-black">{viewerRole === 'admin' ? 'All users' : 'Managed users'}</p>
            <Badge variant="secondary">{allUsers.length}</Badge>
          </div>
          <div className="flex flex-col sm:flex-row items-center gap-2.5 w-full sm:w-auto">
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search users…" className="h-10 pl-9" />
            </div>
            <Link href="/admin/tools-view">
              <Button variant="outline" size="sm" className="h-10 border-violet-200 text-violet-700 hover:bg-violet-50 dark:border-violet-800 dark:text-violet-300 font-bold gap-2 whitespace-nowrap">
                <BarChart2 className="h-4 w-4 text-violet-600" /> Tools View
              </Button>
            </Link>
          </div>
        </div>
        {users.isLoading ? <div className="flex min-h-64 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-violet-600" /></div> : users.isError ? <p className="p-8 text-center text-sm text-destructive">{users.error instanceof Error ? users.error.message : 'Unable to load users.'}</p> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead className="bg-muted/30 text-[10px] uppercase tracking-wider text-muted-foreground"><tr><th className="px-5 py-3">User</th><th className="px-4 py-3">Team</th><th className="px-4 py-3">Discord</th><th className="px-4 py-3">Access role</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Active</th><th className="px-5 py-3 text-right">Action</th></tr></thead>
              <tbody>{visibleUsers.map((user) => <tr key={user.id} className="border-t transition hover:bg-muted/20"><td className="px-5 py-4"><p className="font-bold">{user.name}</p><p className="mt-0.5 text-xs text-muted-foreground">{user.email}</p></td><td className="px-4 py-4 font-semibold">{user.team_nickname || '—'}</td><td className="px-4 py-4"><p className="font-medium">{user.discord_username ? `@${user.discord_username}` : '—'}</p><p className="text-[10px] text-muted-foreground">{user.discord_user_id || ''}</p></td><td className="px-4 py-4 capitalize">{user.role}</td><td className="px-4 py-4"><Badge variant={user.status === 'active' ? 'default' : user.status === 'pending' ? 'secondary' : 'outline'}>{user.status ?? 'pending'}</Badge></td><td className="px-4 py-4"><span className={`inline-flex rounded-full px-2 py-1 text-[10px] font-black ${user.active ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'}`}>{user.active ? 'TRUE' : 'FALSE'}</span></td><td className="px-5 py-4 text-right"><Button variant="outline" size="sm" className="gap-1.5" onClick={() => openEditor(user)}><Pencil className="h-3.5 w-3.5" /> Edit</Button></td></tr>)}</tbody>
            </table>
            {!visibleUsers.length && <p className="p-10 text-center text-sm text-muted-foreground">No users found.</p>}
          </div>
        )}
      </Card>

      <Dialog open={Boolean(editingUser)} onOpenChange={(open) => { if (!open) setEditingUser(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Edit user access</DialogTitle><DialogDescription>{editingUser?.name} · {editingUser?.email}</DialogDescription></DialogHeader>
          <div className="grid gap-4 py-2">
            <label className="grid gap-2 text-xs font-bold">Access role<select value={draft.role} onChange={(event) => setDraft((current) => ({ ...current, role: event.target.value as UserRole }))} className="h-11 rounded-xl border bg-background px-3 text-sm font-semibold"><option value="mentor">Team member</option><option value="manager">Manager</option>{viewerRole === 'admin' && <option value="admin">Admin</option>}</select></label>
            {viewerRole === 'manager' && <p className="rounded-xl bg-violet-50 p-3 text-xs text-violet-800 dark:bg-violet-950/40 dark:text-violet-200">Managers cannot view or modify Admin accounts, or grant Admin access.</p>}
            <label className="grid gap-2 text-xs font-bold">Account status<select value={draft.status} onChange={(event) => setDraft((current) => ({ ...current, status: event.target.value as UserStatus }))} className="h-11 rounded-xl border bg-background px-3 text-sm font-semibold"><option value="pending">Pending</option><option value="active">Active</option><option value="suspended">Suspended</option></select></label>
            <label className="grid gap-2 text-xs font-bold">Active access<select value={draft.active ? 'true' : 'false'} onChange={(event) => setDraft((current) => ({ ...current, active: event.target.value === 'true' }))} className="h-11 rounded-xl border bg-background px-3 text-sm font-semibold"><option value="true">True — can sign in</option><option value="false">False — cannot sign in</option></select></label>
            {draft.status === 'active' && !draft.active && <p className="rounded-xl bg-amber-50 p-3 text-xs text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">Status is Active, but this user still cannot sign in until Active access is set to True.</p>}
          </div>
          <DialogFooter showCloseButton><Button disabled={update.isPending} onClick={() => update.mutate()} className="bg-violet-600 hover:bg-violet-700">{update.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save changes'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
