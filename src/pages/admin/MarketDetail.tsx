import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AdminLayout } from '@/components/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { CalendarIcon, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { OrganiserOnDuty } from '@/components/admin/market-detail/OrganiserOnDuty';
import { StallConfirmationsTable } from '@/components/admin/market-detail/StallConfirmationsTable';
import { MediaUploadsSection } from '@/components/admin/market-detail/MediaUploadsSection';

interface Market {
  id: string;
  name: string;
  city: string | null;
}

interface Organiser {
  full_name: string;
  phone: string | null;
  email: string | null;
}

export default function MarketDetail() {
  const { marketId } = useParams<{ marketId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [market, setMarket] = useState<Market | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [organiser, setOrganiser] = useState<Organiser | null>(null);
  const [loading, setLoading] = useState(true);

  // Get IST date string
  const getISTDateString = (date: Date) => {
    return format(date, 'yyyy-MM-dd');
  };

  const isToday = getISTDateString(selectedDate) === getISTDateString(new Date());

  useEffect(() => {
    const fetchMarket = async () => {
      if (!marketId) return;
      
      const { data } = await supabase
        .from('markets')
        .select('id, name, city')
        .eq('id', marketId)
        .single();
      
      if (data) setMarket(data);
    };

    fetchMarket().finally(() => setLoading(false));
  }, [marketId]);

  useEffect(() => {
    const fetchOrganiser = async () => {
      if (!marketId) return;
      
      const dateStr = getISTDateString(selectedDate);
      
      // Prioritize active session, then latest completed session
      const { data } = await supabase
        .from('sessions')
        .select(`
          profiles!sessions_user_id_fkey (
            full_name,
            phone
          )
        `)
        .eq('market_id', marketId)
        .eq('market_date', dateStr)
        .order('status', { ascending: false }) // 'active' comes before 'completed'
        .order('punch_in_time', { ascending: false })
        .limit(1)
        .single();

      if (data?.profiles) {
        setOrganiser({
          full_name: data.profiles.full_name,
          phone: data.profiles.phone,
          email: null // Add email to profiles query if needed
        });
      } else {
        setOrganiser(null);
      }
    };

    fetchOrganiser();
  }, [marketId, selectedDate]);

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-full">
          <div className="text-lg">Loading...</div>
        </div>
      </AdminLayout>
    );
  }

  if (!market) {
    return (
      <AdminLayout>
        <div className="text-center">Market not found</div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <button onClick={() => navigate('/admin')} className="hover:text-foreground">
            Admin
          </button>
          <ChevronRight className="h-4 w-4" />
          <button onClick={() => navigate('/admin')} className="hover:text-foreground">
            Markets
          </button>
          <ChevronRight className="h-4 w-4" />
          <span className="text-foreground font-medium">
            {market.name} ({format(selectedDate, 'MMM dd, yyyy')})
          </span>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle>Filters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4">
              <div className="flex-1 min-w-[200px]">
                <label className="text-sm font-medium mb-2 block">Market</label>
                <Select value={marketId} onValueChange={(val) => navigate(`/admin/markets/${val}`)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={marketId}>{market.name}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex-1 min-w-[200px]">
                <label className="text-sm font-medium mb-2 block">Date</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {format(selectedDate, 'PPP')}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={selectedDate}
                      onSelect={(date) => date && setSelectedDate(date)}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="flex-1 min-w-[200px]">
                <label className="text-sm font-medium mb-2 block">Organiser</label>
                {organiser ? (
                  <div className="flex items-center gap-2 p-2 bg-muted rounded-md">
                    <div className="flex-1">
                      <div className="font-medium">{organiser.full_name}</div>
                      {organiser.phone && (
                        <div className="text-xs text-muted-foreground">{organiser.phone}</div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="p-2 bg-muted rounded-md text-sm text-muted-foreground">
                    No organiser assigned
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Organiser on Duty */}
        <OrganiserOnDuty
          marketId={marketId!}
          marketDate={getISTDateString(selectedDate)}
          isToday={isToday}
        />

        {/* Stall Confirmations */}
        <StallConfirmationsTable
          marketId={marketId!}
          marketDate={getISTDateString(selectedDate)}
          isToday={isToday}
          marketName={market.name}
        />

        {/* Media Uploads */}
        <MediaUploadsSection
          marketId={marketId!}
          marketDate={getISTDateString(selectedDate)}
          isToday={isToday}
        />
      </div>
    </AdminLayout>
  );
}
