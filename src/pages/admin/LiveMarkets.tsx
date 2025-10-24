import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MapPin, Clock, Users, Upload } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface LiveMarket {
  market_id: string;
  market_name: string;
  city: string | null;
  active_sessions: number;
  active_employees: number;
  stall_confirmations_count: number;
  media_uploads_count: number;
  last_upload_time: string | null;
  last_punch_in: string | null;
}

export default function LiveMarkets() {
  const navigate = useNavigate();
  const [markets, setMarkets] = useState<LiveMarket[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLiveMarkets();
    
    // Subscribe to real-time updates
    const sessionsChannel = supabase
      .channel('live-markets-sessions')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sessions' }, fetchLiveMarkets)
      .subscribe();

    const stallsChannel = supabase
      .channel('live-markets-stalls')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stall_confirmations' }, fetchLiveMarkets)
      .subscribe();

    const mediaChannel = supabase
      .channel('live-markets-media')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'media' }, fetchLiveMarkets)
      .subscribe();

    return () => {
      supabase.removeChannel(sessionsChannel);
      supabase.removeChannel(stallsChannel);
      supabase.removeChannel(mediaChannel);
    };
  }, []);

  const fetchLiveMarkets = async () => {
    try {
      const { data, error } = await supabase
        .from('live_markets_today')
        .select('*');

      if (error) throw error;
      setMarkets(data || []);
    } catch (error) {
      console.error('Error fetching live markets:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (timestamp: string | null) => {
    if (!timestamp) return 'N/A';
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-IN', { 
      hour: '2-digit', 
      minute: '2-digit',
      timeZone: 'Asia/Kolkata'
    }) + ' IST';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Live Markets Today</h1>
        <p className="text-muted-foreground mt-2">Real-time view of active markets</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {markets.length === 0 ? (
          <Card className="col-span-full">
            <CardContent className="flex items-center justify-center h-48">
              <p className="text-muted-foreground">No active markets today</p>
            </CardContent>
          </Card>
        ) : (
          markets.map((market) => (
            <Card
              key={market.market_id}
              className="hover:bg-accent/50 transition-colors cursor-pointer"
              onClick={() => navigate(`/admin/market/${market.market_id}`)}
            >
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>{market.market_name}</span>
                  <Badge variant="default">{market.active_sessions} active</Badge>
                </CardTitle>
                <CardDescription className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {market.city || 'N/A'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Users className="h-4 w-4" />
                    <span>Employees</span>
                  </div>
                  <span className="font-medium">{market.active_employees}</span>
                </div>
                
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Upload className="h-4 w-4" />
                    <span>Uploads</span>
                  </div>
                  <span className="font-medium">{market.media_uploads_count}</span>
                </div>

                <div className="pt-2 border-t">
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    <span>Last upload: {formatTime(market.last_upload_time)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
