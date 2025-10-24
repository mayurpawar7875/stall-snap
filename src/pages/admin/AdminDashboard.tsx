import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, FileText, CheckCircle, Clock } from 'lucide-react';

export default function AdminDashboard() {
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalSessions: 0,
    todaySessions: 0,
    finalizedToday: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Redirect non-admins to employee dashboard
    if (!isAdmin) {
      navigate('/dashboard');
      return;
    }
    fetchStats();
  }, [isAdmin, navigate]);

  const fetchStats = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];

      const [usersRes, sessionsRes, todaySessionsRes, finalizedRes] = await Promise.all([
        supabase.from('profiles').select('id', { count: 'exact', head: true }),
        supabase.from('sessions').select('id', { count: 'exact', head: true }),
        supabase.from('sessions').select('id', { count: 'exact', head: true }).eq('session_date', today),
        supabase
          .from('sessions')
          .select('id', { count: 'exact', head: true })
          .eq('session_date', today)
          .eq('status', 'finalized'),
      ]);

      setStats({
        totalUsers: usersRes.count || 0,
        totalSessions: sessionsRes.count || 0,
        todaySessions: todaySessionsRes.count || 0,
        finalizedToday: finalizedRes.count || 0,
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    {
      title: 'Total Users',
      value: stats.totalUsers,
      icon: Users,
      description: 'Registered employees',
    },
    {
      title: 'Total Sessions',
      value: stats.totalSessions,
      icon: FileText,
      description: 'All-time reporting sessions',
    },
    {
      title: "Today's Sessions",
      value: stats.todaySessions,
      icon: Clock,
      description: 'Active sessions today',
    },
    {
      title: 'Finalized Today',
      value: stats.finalizedToday,
      icon: CheckCircle,
      description: 'Completed reports today',
    },
  ];

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
        <h2 className="text-3xl font-bold">Dashboard Overview</h2>
        <p className="text-muted-foreground">Key metrics and statistics</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
              <stat.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <p className="text-xs text-muted-foreground">{stat.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>Common administrative tasks</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Navigate to "All Sessions" to view detailed reports, filter data, and export records.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
