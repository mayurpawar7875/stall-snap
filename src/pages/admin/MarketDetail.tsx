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

interface Employee {
  id: string;
  full_name: string;
}

export default function MarketDetail() {
  const { marketId } = useParams<{ marketId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [market, setMarket] = useState<Market | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedEmployee, setSelectedEmployee] = useState<string>('all');
  const [employees, setEmployees] = useState<Employee[]>([]);
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

    const fetchEmployees = async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name')
        .order('full_name');
      
      if (data) setEmployees(data);
    };

    Promise.all([fetchMarket(), fetchEmployees()]).finally(() => setLoading(false));
  }, [marketId]);

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
                <label className="text-sm font-medium mb-2 block">Employee</label>
                <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Employees</SelectItem>
                    {employees.map((emp) => (
                      <SelectItem key={emp.id} value={emp.id}>
                        {emp.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Organiser on Duty */}
        <OrganiserOnDuty
          marketId={marketId!}
          marketDate={getISTDateString(selectedDate)}
          employeeId={selectedEmployee === 'all' ? undefined : selectedEmployee}
          isToday={isToday}
        />

        {/* Stall Confirmations */}
        <StallConfirmationsTable
          marketId={marketId!}
          marketDate={getISTDateString(selectedDate)}
          employeeId={selectedEmployee === 'all' ? undefined : selectedEmployee}
          isToday={isToday}
          marketName={market.name}
        />

        {/* Media Uploads */}
        <MediaUploadsSection
          marketId={marketId!}
          marketDate={getISTDateString(selectedDate)}
          employeeId={selectedEmployee === 'all' ? undefined : selectedEmployee}
          isToday={isToday}
        />
      </div>
    </AdminLayout>
  );
}
