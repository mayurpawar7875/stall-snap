import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Users as UsersIcon, Shield } from 'lucide-react';

interface User {
  id: string;
  full_name: string;
  phone: string | null;
  created_at: string;
  email?: string;
  roles: string[];
}

export default function Users() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      // First get all profiles
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (profilesError) throw profilesError;
      if (!profiles) {
        setUsers([]);
        return;
      }

      // Get roles for each user
      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role');

      if (rolesError) throw rolesError;

      // Get auth users to get emails (may fail without service role key)
      const authData = await supabase.auth.admin.listUsers().catch(() => ({ data: { users: [] } }));

      // Combine the data
      const usersWithRoles = profiles.map((profile: any) => {
        const userRoles = roles?.filter((r: any) => r.user_id === profile.id).map((r: any) => r.role) || [];
        const authUser = authData?.data?.users?.find((u: any) => u.id === profile.id);
        return {
          ...profile,
          email: authUser?.email || 'N/A',
          roles: userRoles,
        };
      });

      setUsers(usersWithRoles);
    } catch (error: any) {
      toast.error('Failed to load users');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const toggleAdminRole = async (userId: string, currentRoles: string[]) => {
    try {
      const hasAdmin = currentRoles.includes('admin');

      if (hasAdmin) {
        // Remove admin role
        const { error } = await supabase
          .from('user_roles')
          .delete()
          .eq('user_id', userId)
          .eq('role', 'admin');

        if (error) throw error;
        toast.success('Admin role removed');
      } else {
        // Add admin role
        const { error } = await supabase
          .from('user_roles')
          .insert({ user_id: userId, role: 'admin' });

        if (error) throw error;
        toast.success('Admin role granted');
      }

      fetchUsers();
    } catch (error: any) {
      toast.error('Failed to update user role');
      console.error(error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold">User Management</h2>
        <p className="text-muted-foreground">Manage user accounts and permissions</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UsersIcon className="h-5 w-5" />
            All Users ({users.length})
          </CardTitle>
          <CardDescription>View and manage user roles</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {users.map((user) => (
              <Card key={user.id}>
                <CardContent className="p-4">
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <h3 className="font-semibold">{user.full_name}</h3>
                      <p className="text-sm text-muted-foreground">{user.email}</p>
                      {user.phone && <p className="text-sm text-muted-foreground">{user.phone}</p>}
                      <div className="flex gap-2 mt-2">
                        {user.roles.map((role) => (
                          <Badge
                            key={role}
                            className={
                              role === 'admin' ? 'bg-accent text-accent-foreground' : 'bg-muted'
                            }
                          >
                            {role}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <Button
                      variant={user.roles.includes('admin') ? 'destructive' : 'outline'}
                      size="sm"
                      onClick={() => toggleAdminRole(user.id, user.roles)}
                    >
                      <Shield className="mr-2 h-4 w-4" />
                      {user.roles.includes('admin') ? 'Remove Admin' : 'Make Admin'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}

            {users.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">No users found</div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="border-warning">
        <CardHeader>
          <CardTitle className="text-warning">Important Notes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>• Admin users have full access to view all sessions and manage the system</p>
          <p>• All new users are assigned the "employee" role by default</p>
          <p>• You cannot remove your own admin role</p>
          <p>• Exercise caution when granting admin privileges</p>
        </CardContent>
      </Card>
    </div>
  );
}
