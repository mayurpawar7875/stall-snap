import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { ArrowLeft, CheckCircle, AlertCircle } from 'lucide-react';

export default function Finalize() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [finalizing, setFinalizing] = useState(false);

  useEffect(() => {
    fetchSession();
  }, [user]);

  const fetchSession = async () => {
    if (!user) return;

    try {
      const today = new Date().toISOString().split('T')[0];
      const { data, error } = await supabase
        .from('sessions')
        .select(`*, stalls(*), media(*)`)
        .eq('user_id', user.id)
        .eq('session_date', today)
        .maybeSingle();

      if (error) throw error;
      if (!data) {
        toast.error('No session found for today');
        navigate('/dashboard');
        return;
      }
      setSession(data);
    } catch (error: any) {
      console.error('Error fetching session:', error);
      toast.error('Failed to load session');
    } finally {
      setLoading(false);
    }
  };

  const canFinalize = () => {
    if (!session) return false;
    const now = new Date();
    const hours = now.getHours();
    return hours < 11 && session.punch_in_time && session.stalls.length > 0 && session.media.length > 0;
  };

  const handleFinalize = async () => {
    if (!canFinalize()) {
      toast.error('Cannot finalize: ensure all requirements are met before 11 AM');
      return;
    }

    setFinalizing(true);
    try {
      const { error } = await supabase
        .from('sessions')
        .update({ status: 'finalized', finalized_at: new Date().toISOString() })
        .eq('id', session.id);

      if (error) throw error;

      toast.success('Session finalized successfully!');
      navigate('/dashboard');
    } catch (error: any) {
      toast.error('Failed to finalize session');
      console.error(error);
    } finally {
      setFinalizing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  const requirements = [
    { label: 'Punch In Time', met: !!session.punch_in_time },
    { label: 'At least one stall', met: session.stalls.length > 0 },
    { label: 'At least one media file', met: session.media.length > 0 },
    { label: 'Before 11:00 AM IST', met: new Date().getHours() < 11 },
  ];

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <Button variant="ghost" onClick={() => navigate('/dashboard')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle>Finalize Report</CardTitle>
            <CardDescription>Review and lock your daily report</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3">
              <h3 className="font-semibold">Requirements Checklist</h3>
              {requirements.map((req) => (
                <div key={req.label} className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                  {req.met ? (
                    <CheckCircle className="h-5 w-5 text-success" />
                  ) : (
                    <AlertCircle className="h-5 w-5 text-warning" />
                  )}
                  <span className={req.met ? 'text-foreground' : 'text-muted-foreground'}>{req.label}</span>
                </div>
              ))}
            </div>

            <Button
              onClick={handleFinalize}
              disabled={!canFinalize() || finalizing}
              className="w-full"
              size="lg"
            >
              {finalizing ? 'Finalizing...' : 'Finalize Report'}
            </Button>

            <div className="bg-warning/10 p-4 rounded-lg">
              <p className="text-sm text-warning-foreground">
                <strong>Warning:</strong> Once finalized, you cannot make changes to today's report.
              </p>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
