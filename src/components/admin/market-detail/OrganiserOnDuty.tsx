import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';

interface OrganiserData {
  id: string;
  user_id: string;
  punch_in_time: string | null;
  punch_out_time: string | null;
  status: string;
  profiles: {
    full_name: string;
    phone: string | null;
  };
}

interface Props {
  marketId: string;
  marketDate: string;
  isToday: boolean;
}

export function OrganiserOnDuty({ marketId, marketDate, isToday }: Props) {
  const [organiser, setOrganiser] = useState<OrganiserData | null>(null);
  const [lastActivity, setLastActivity] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchOrganiser();

    if (isToday) {
      const channel = supabase
        .channel(`sessions-${marketId}-${marketDate}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'sessions',
            filter: `market_id=eq.${marketId}`,
          },
          () => fetchOrganiser()
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [marketId, marketDate, isToday]);

  const fetchOrganiser = async () => {
    setLoading(true);
    
    // Fetch sessions (status can be: active, finalized, locked)
    const { data: s, error: sErr } = await supabase
      .from('sessions')
      .select('id, user_id, punch_in_time, punch_out_time, status')
      .eq('market_id', marketId)
      .eq('market_date', marketDate)
      .order('punch_in_time', { ascending: false });

    if (sErr) console.error(sErr);

    const userIds = [...new Set((s ?? []).map(r => r.user_id).filter(Boolean))];

    // Fetch employees
    const { data: emps, error: eErr } = await supabase
      .from('profiles')
      .select('id, full_name, phone')
      .in('id', userIds.length ? userIds : ['00000000-0000-0000-0000-000000000000']);

    if (eErr) console.error(eErr);

    const empById: Record<string, any> = Object.fromEntries((emps ?? []).map(e => [e.id, e]));

    // Pick organiser = active session first, else latest completed
    const organiserSession = (s ?? []).sort((a, b) => 
      (a.status === 'active' ? -1 : 1) || 
      (new Date(b.punch_in_time || 0).getTime() - new Date(a.punch_in_time || 0).getTime())
    )[0];

    if (organiserSession) {
      const emp = empById[organiserSession.user_id];
      setOrganiser({
        ...organiserSession,
        profiles: emp ? {
          full_name: emp.full_name,
          phone: emp.phone
        } : { full_name: 'Unknown', phone: null }
      } as any);

      // Fetch last activity
      const { data: mediaData } = await supabase
        .from('media')
        .select('captured_at')
        .eq('user_id', organiserSession.user_id)
        .eq('market_id', marketId)
        .eq('market_date', marketDate)
        .order('captured_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (mediaData) {
        setLastActivity(mediaData.captured_at);
      }
    } else {
      setOrganiser(null);
    }

    setLoading(false);
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Organiser on Duty</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-muted-foreground">Loading...</div>
        </CardContent>
      </Card>
    );
  }

  if (!organiser) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Organiser on Duty</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-muted-foreground">
            No session for this market/date. Ensure Punch-In created a session for ({marketId}, {marketDate}).
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Organiser on Duty</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div>
            <div className="text-2xl font-bold">{organiser.profiles.full_name}</div>
            {organiser.profiles.phone && (
              <div className="text-sm text-muted-foreground">{organiser.profiles.phone}</div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <div className="text-sm font-medium text-muted-foreground">Punch In</div>
              <div className="text-lg">
                {organiser.punch_in_time
                  ? format(new Date(organiser.punch_in_time), 'hh:mm a')
                  : 'Not punched in'}
              </div>
            </div>

            <div>
              <div className="text-sm font-medium text-muted-foreground">Punch Out</div>
              <div className="text-lg">
                {organiser.punch_out_time
                  ? format(new Date(organiser.punch_out_time), 'hh:mm a')
                  : 'Not punched out'}
              </div>
            </div>

            <div>
              <div className="text-sm font-medium text-muted-foreground">Last Activity</div>
              <div className="text-lg">
                {lastActivity
                  ? format(new Date(lastActivity), 'hh:mm a')
                  : 'No activity'}
              </div>
            </div>
          </div>

          <div>
            <Badge variant={organiser.status === 'active' ? 'default' : 'secondary'}>
              {organiser.status}
            </Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
