import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MapPin, Clock } from 'lucide-react';

interface LiveMarket {
  id: string;
  name: string;
  city: string;
  active_sessions: number;
  last_media_time: string | null;
}

export default function LiveMarketsWidget() {
  const [markets, setMarkets] = useState<LiveMarket[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLiveMarkets();
    
    const channel = supabase
      .channel('live-markets')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sessions' }, fetchLiveMarkets)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'media' }, fetchLiveMarkets)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchLiveMarkets = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      const { data: sessions, error } = await supabase
        .from('sessions')
        .select(`
          id,
          market_id,
          markets (id, name, city),
          media (captured_at)
        `)
        .eq('session_date', today)
        .eq('status', 'active');

      if (error) throw error;

      const marketMap = new Map<string, LiveMarket>();
      
      sessions?.forEach((session: any) => {
        const market = session.markets;
        if (!market) return;

        if (!marketMap.has(market.id)) {
          marketMap.set(market.id, {
            id: market.id,
            name: market.name,
            city: market.city || 'N/A',
            active_sessions: 0,
            last_media_time: null,
          });
        }

        const marketData = marketMap.get(market.id)!;
        marketData.active_sessions += 1;

        if (session.media && session.media.length > 0) {
          const latestMedia = session.media.sort((a: any, b: any) => 
            new Date(b.captured_at).getTime() - new Date(a.captured_at).getTime()
          )[0];
          
          if (!marketData.last_media_time || new Date(latestMedia.captured_at) > new Date(marketData.last_media_time)) {
            marketData.last_media_time = latestMedia.captured_at;
          }
        }
      });

      setMarkets(Array.from(marketMap.values()));
    } catch (error) {
      console.error('Error fetching live markets:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (timestamp: string | null) => {
    if (!timestamp) return 'No uploads yet';
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-IN', { 
      hour: '2-digit', 
      minute: '2-digit',
      timeZone: 'Asia/Kolkata'
    }) + ' IST';
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-48">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Live Markets Today</CardTitle>
        <CardDescription>Markets with active sessions</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {markets.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No active markets today
            </div>
          ) : (
            markets.map((market) => (
              <div key={market.id} className="flex items-start justify-between p-3 border rounded-lg">
                <div className="space-y-1 flex-1">
                  <div className="flex items-center gap-2">
                    <h4 className="font-semibold">{market.name}</h4>
                    <Badge variant="default">{market.active_sessions} active</Badge>
                  </div>
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <MapPin className="h-3 w-3" />
                    <span>{market.city}</span>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    <span>Last upload: {formatTime(market.last_media_time)}</span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
