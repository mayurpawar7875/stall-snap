import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Download } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';

interface StallConfirmation {
  id: string;
  created_at: string;
  farmer_name: string;
  stall_name: string;
  stall_no: string;
  created_by: string;
  profiles: {
    full_name: string;
  };
}

interface Props {
  marketId: string;
  marketDate: string;
  employeeId?: string;
  isToday: boolean;
  marketName: string;
}

export function StallConfirmationsTable({ marketId, marketDate, employeeId, isToday, marketName }: Props) {
  const [confirmations, setConfirmations] = useState<StallConfirmation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchConfirmations();

    if (isToday) {
      const channel = supabase
        .channel(`stall-confirmations-${marketId}-${marketDate}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'stall_confirmations',
            filter: `market_id=eq.${marketId}`,
          },
          () => fetchConfirmations()
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [marketId, marketDate, employeeId, isToday]);

  const fetchConfirmations = async () => {
    setLoading(true);

    let query = supabase
      .from('stall_confirmations')
      .select(`
        id,
        created_at,
        farmer_name,
        stall_name,
        stall_no,
        created_by,
        profiles!stall_confirmations_created_by_fkey (
          full_name
        )
      `)
      .eq('market_id', marketId)
      .eq('market_date', marketDate);

    if (employeeId) {
      query = query.eq('created_by', employeeId);
    }

    const { data } = await query.order('created_at', { ascending: false });

    if (data) {
      setConfirmations(data as any);
    }

    setLoading(false);
  };

  const exportToCSV = () => {
    const headers = ['Time', 'Farmer Name', 'Stall Name', 'Stall No', 'Entered By'];
    const rows = confirmations.map((c) => [
      format(new Date(c.created_at), 'hh:mm a'),
      c.farmer_name,
      c.stall_name,
      c.stall_no,
      c.profiles.full_name,
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${marketName}-${marketDate}-stalls.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Stall Confirmations</CardTitle>
        <Button onClick={exportToCSV} variant="outline" size="sm" disabled={confirmations.length === 0}>
          <Download className="mr-2 h-4 w-4" />
          Export CSV
        </Button>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-center text-muted-foreground">Loading...</div>
        ) : confirmations.length === 0 ? (
          <div className="text-center text-muted-foreground">No stall confirmations yet</div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>Farmer Name</TableHead>
                  <TableHead>Stall Name</TableHead>
                  <TableHead>Stall No</TableHead>
                  <TableHead>Entered By</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {confirmations.map((confirmation) => (
                  <TableRow key={confirmation.id}>
                    <TableCell>{format(new Date(confirmation.created_at), 'hh:mm a')}</TableCell>
                    <TableCell>{confirmation.farmer_name}</TableCell>
                    <TableCell>{confirmation.stall_name}</TableCell>
                    <TableCell>{confirmation.stall_no}</TableCell>
                    <TableCell>{confirmation.profiles.full_name}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
