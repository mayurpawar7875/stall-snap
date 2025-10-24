import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  LogOut,
  Clock,
  MapPin,
  Calendar,
  CheckCircle,
  AlertCircle,
  Users,
  Camera,
  FileText,
} from 'lucide-react';

interface Session {
  id: string;
  session_date: string;
  market_date: string | null;
  punch_in_time: string | null;
  punch_out_time: string | null;
  status: 'active' | 'completed' | 'finalized' | 'locked';
  market_id: string;
  market: { name: string; location: string };
  stalls: any[];
  media: any[];
}

interface SessionSummary {
  stalls_count: number;
  media_count: number;
  late_uploads_count: number;
  first_activity_at: string | null;
  last_activity_at: string | null;
  finalized_at: string;
}

export default function Dashboard() {
  const { user, signOut, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [todaySession, setTodaySession] = useState<Session | null>(null);
  const [sessionSummary, setSessionSummary] = useState<SessionSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewDialog, setViewDialog] = useState<'stalls' | 'media' | 'late' | null>(null);
  const [dialogData, setDialogData] = useState<any[]>([]);

  useEffect(() => {
    // Redirect admins to admin dashboard
    if (isAdmin) {
      navigate('/admin');
      return;
    }
    fetchTodaySession();
  }, [user, isAdmin, navigate]);

  const fetchTodaySession = async () => {
    if (!user) return;

    try {
      const today = new Date().toISOString().split('T')[0];
      const { data, error } = await supabase
        .from('sessions')
        .select(`
          *,
          market:markets(*),
          stalls(*),
          media(*)
        `)
        .eq('user_id', user.id)
        .eq('session_date', today)
        .maybeSingle();

      if (error) throw error;
      setTodaySession(data);
      
      // If session is completed, fetch summary
      if (data && (data.status === 'completed' || data.status === 'finalized')) {
        const { data: summary } = await supabase
          .from('session_summaries')
          .select('*')
          .eq('session_id', data.id)
          .maybeSingle();
        
        setSessionSummary(summary);
      }
    } catch (error: any) {
      console.error('Error fetching session:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  const handleViewDetails = async (type: 'stalls' | 'media' | 'late') => {
    if (!todaySession) return;
    
    try {
      if (type === 'stalls') {
        const { data, error } = await supabase
          .from('stalls')
          .select('*')
          .eq('session_id', todaySession.id)
          .order('created_at', { ascending: false });
        
        if (error) throw error;
        setDialogData(data || []);
      } else if (type === 'media' || type === 'late') {
        const query = supabase
          .from('media')
          .select('*')
          .eq('session_id', todaySession.id)
          .order('captured_at', { ascending: false });
        
        if (type === 'late') {
          query.eq('is_late', true);
        }
        
        const { data, error } = await query;
        if (error) throw error;
        setDialogData(data || []);
      }
      
      setViewDialog(type);
    } catch (error) {
      console.error('Error fetching details:', error);
      toast.error('Failed to load details');
    }
  };

  const getStatusBadge = (status: string) => {
    const colors = {
      active: 'bg-info text-info-foreground',
      completed: 'bg-success text-success-foreground',
      finalized: 'bg-success text-success-foreground',
      locked: 'bg-muted text-muted-foreground',
    };

    return (
      <Badge className={colors[status as keyof typeof colors]}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Employee Dashboard</h1>
            <p className="text-sm text-muted-foreground">{user?.email}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleSignOut}>
              <LogOut className="mr-2 h-4 w-4" />
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {!todaySession ? (
          <Card>
            <CardHeader>
              <CardTitle>Start Your Daily Report</CardTitle>
              <CardDescription>
                You haven't started a reporting session for today. Click below to begin.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => navigate('/market-selection')} size="lg">
                <MapPin className="mr-2 h-5 w-5" />
                Start New Session
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {/* Session Info */}
            <Card>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle>Today's Session</CardTitle>
                    <CardDescription className="flex items-center gap-2 mt-2">
                      <MapPin className="h-4 w-4" />
                      {todaySession.market.name} - {todaySession.market.location}
                    </CardDescription>
                  </div>
                  {getStatusBadge(todaySession.status)}
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="flex items-center gap-3">
                    <Clock className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Punch In</p>
                      <p className="font-medium">
                        {todaySession.punch_in_time
                          ? new Date(todaySession.punch_in_time).toLocaleTimeString()
                          : 'Not recorded'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Clock className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Punch Out</p>
                      <p className="font-medium">
                        {todaySession.punch_out_time
                          ? new Date(todaySession.punch_out_time).toLocaleTimeString()
                          : 'Not recorded'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Calendar className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Date</p>
                      <p className="font-medium">
                        {new Date(todaySession.session_date).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Action Cards - Show until punch out */}
            {!todaySession.punch_out_time && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => navigate('/punch')}>
                  <CardHeader>
                    <Clock className="h-8 w-8 text-accent mb-2" />
                    <CardTitle className="text-lg">Punch In/Out</CardTitle>
                    <CardDescription>Record your attendance timestamps</CardDescription>
                  </CardHeader>
                </Card>

                <Card
                  className="cursor-pointer hover:shadow-lg transition-shadow"
                  onClick={() => navigate('/stalls')}
                >
                  <CardHeader>
                    <FileText className="h-8 w-8 text-accent mb-2" />
                    <CardTitle className="text-lg">Stall Confirmations</CardTitle>
                    <CardDescription>
                      {todaySession.stalls.length} stall{todaySession.stalls.length !== 1 ? 's' : ''} added
                    </CardDescription>
                  </CardHeader>
                </Card>

                <Card
                  className="cursor-pointer hover:shadow-lg transition-shadow"
                  onClick={() => navigate('/media-upload')}
                >
                  <CardHeader>
                    <Camera className="h-8 w-8 text-accent mb-2" />
                    <CardTitle className="text-lg">Media Upload</CardTitle>
                    <CardDescription>
                      {todaySession.media.length} file{todaySession.media.length !== 1 ? 's' : ''} uploaded
                    </CardDescription>
                  </CardHeader>
                </Card>
              </div>
            )}

            {/* Session Summary - Show after completion */}
            {(todaySession.status === 'completed' || todaySession.status === 'finalized') && sessionSummary && (
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-success" />
                    <CardTitle>Session Summary</CardTitle>
                  </div>
                  <CardDescription>Your session has been completed and finalized</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div 
                      className="p-4 bg-muted rounded-lg cursor-pointer hover:bg-muted/80 transition-colors"
                      onClick={() => handleViewDetails('stalls')}
                    >
                      <p className="text-sm text-muted-foreground">Stalls Confirmed</p>
                      <p className="text-2xl font-bold">{sessionSummary.stalls_count}</p>
                    </div>
                    <div 
                      className="p-4 bg-muted rounded-lg cursor-pointer hover:bg-muted/80 transition-colors"
                      onClick={() => handleViewDetails('media')}
                    >
                      <p className="text-sm text-muted-foreground">Media Uploaded</p>
                      <p className="text-2xl font-bold">{sessionSummary.media_count}</p>
                    </div>
                    <div 
                      className="p-4 bg-muted rounded-lg cursor-pointer hover:bg-muted/80 transition-colors"
                      onClick={() => handleViewDetails('late')}
                    >
                      <p className="text-sm text-muted-foreground">Late Uploads</p>
                      <p className="text-2xl font-bold text-warning">{sessionSummary.late_uploads_count}</p>
                    </div>
                    <div className="p-4 bg-muted rounded-lg">
                      <p className="text-sm text-muted-foreground">Finalized At</p>
                      <p className="text-sm font-semibold">
                        {new Date(sessionSummary.finalized_at).toLocaleTimeString('en-IN', { 
                          hour: '2-digit', 
                          minute: '2-digit',
                          timeZone: 'Asia/Kolkata'
                        })} IST
                      </p>
                    </div>
                  </div>
                  {sessionSummary.first_activity_at && sessionSummary.last_activity_at && (
                    <div className="mt-4 p-3 bg-info/10 rounded-lg">
                      <p className="text-sm">
                        <strong>Activity Period:</strong> {new Date(sessionSummary.first_activity_at).toLocaleTimeString('en-IN')} - {new Date(sessionSummary.last_activity_at).toLocaleTimeString('en-IN')} IST
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Instructions */}
            {todaySession.status === 'active' && (
              <Card className="border-info">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-5 w-5 text-info" />
                    <CardTitle>Instructions</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <p>• All tasks are saved automatically in real-time</p>
                  <p>• Your session will be finalized when you Punch Out</p>
                  <p>• Remember to Punch Out at the end of your shift</p>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </main>

      {/* View Details Dialog */}
      <Dialog open={viewDialog !== null} onOpenChange={() => setViewDialog(null)}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {viewDialog === 'stalls' && 'Stall Confirmations'}
              {viewDialog === 'media' && 'Media Uploads'}
              {viewDialog === 'late' && 'Late Uploads'}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            {viewDialog === 'stalls' && (
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-muted">
                    <tr>
                      <th className="text-left p-3 text-sm font-semibold">Stall No</th>
                      <th className="text-left p-3 text-sm font-semibold">Stall Name</th>
                      <th className="text-left p-3 text-sm font-semibold">Farmer Name</th>
                      <th className="text-left p-3 text-sm font-semibold">Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dialogData.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="text-center p-6 text-muted-foreground">
                          No stall confirmations found
                        </td>
                      </tr>
                    ) : (
                      dialogData.map((stall: any) => (
                        <tr key={stall.id} className="border-t">
                          <td className="p-3">{stall.stall_no}</td>
                          <td className="p-3">{stall.stall_name}</td>
                          <td className="p-3">{stall.farmer_name}</td>
                          <td className="p-3 text-sm text-muted-foreground">
                            {new Date(stall.created_at).toLocaleString('en-IN')}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {(viewDialog === 'media' || viewDialog === 'late') && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {dialogData.length === 0 ? (
                  <div className="col-span-full text-center p-6 text-muted-foreground">
                    No media uploads found
                  </div>
                ) : (
                  dialogData.map((media: any) => (
                    <Card key={media.id}>
                      <CardContent className="p-4">
                        <div className="space-y-2">
                          {media.media_type === 'image' ? (
                            <img 
                              src={media.file_url} 
                              alt={media.file_name}
                              className="w-full h-40 object-cover rounded"
                            />
                          ) : (
                            <video 
                              src={media.file_url}
                              className="w-full h-40 object-cover rounded"
                              controls
                            />
                          )}
                          <div className="text-sm">
                            <p className="font-medium truncate">{media.file_name}</p>
                            <p className="text-muted-foreground">
                              {new Date(media.captured_at).toLocaleString('en-IN')}
                            </p>
                            {media.is_late && (
                              <Badge className="mt-1 bg-warning text-warning-foreground">Late Upload</Badge>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
