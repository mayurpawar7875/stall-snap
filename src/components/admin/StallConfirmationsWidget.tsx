import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Download } from 'lucide-react';
import { toast } from 'sonner';

interface StallConfirmation {
  id: string;
  farmer_name: string;
  stall_name: string;
  stall_no: string;
  market_name: string;
  market_date: string;
  created_at: string;
  entered_by: string;
}

export default function StallConfirmationsWidget() {
  const [confirmations, setConfirmations] = useState<StallConfirmation[]>([]);
  const [filteredConfirmations, setFilteredConfirmations] = useState<StallConfirmation[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchConfirmations();
    
    const channel = supabase
      .channel('stall-confirmations')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'stalls' 
      }, fetchConfirmations)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    if (searchTerm) {
      setFilteredConfirmations(
        confirmations.filter(c => 
          c.farmer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          c.stall_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          c.market_name.toLowerCase().includes(searchTerm.toLowerCase())
        )
      );
    } else {
      setFilteredConfirmations(confirmations);
    }
  }, [searchTerm, confirmations]);

  const fetchConfirmations = async () => {
    try {
      const { data, error } = await supabase
        .from('stalls')
        .select(`
          id,
          farmer_name,
          stall_name,
          stall_no,
          created_at,
          session_id
        `)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;

      const confirmations = data || [];
      if (confirmations.length === 0) {
        setConfirmations([]);
        setFilteredConfirmations([]);
        setLoading(false);
        return;
      }

      // Get unique session IDs
      const sessionIds = [...new Set(confirmations.map(c => c.session_id).filter(Boolean))];

      // Fetch sessions to get market_id, market_date, and created_by (user_id)
      const { data: sessions } = await supabase
        .from('sessions')
        .select('id, user_id, market_id, market_date, session_date')
        .in('id', sessionIds);

      const sessionById = Object.fromEntries((sessions || []).map((s: any) => [s.id, s]));

      // Get unique user and market IDs
      const userIds = [...new Set((sessions || []).map((s: any) => s.user_id).filter(Boolean))];
      const marketIds = [...new Set((sessions || []).map((s: any) => s.market_id).filter(Boolean))];

      // Fetch employees and markets
      const [{ data: employees }, { data: markets }] = await Promise.all([
        supabase.from('employees').select('id, full_name').in('id', userIds),
        supabase.from('markets').select('id, name').in('id', marketIds),
      ]);

      const empById = Object.fromEntries((employees || []).map((e: any) => [e.id, e.full_name]));
      const mktById = Object.fromEntries((markets || []).map((m: any) => [m.id, m.name]));

      const formatted = confirmations.map((item: any) => {
        const session = sessionById[item.session_id];
        return {
          id: item.id,
          farmer_name: item.farmer_name,
          stall_name: item.stall_name,
          stall_no: item.stall_no,
          market_name: session ? mktById[session.market_id] || 'Unknown' : 'Unknown',
          market_date: session ? (session.market_date || session.session_date) : null,
          created_at: item.created_at,
          entered_by: session ? empById[session.user_id] || 'Unknown' : 'Unknown',
        };
      });

      setConfirmations(formatted);
      setFilteredConfirmations(formatted);
    } catch (error) {
      console.error('Error fetching confirmations:', error);
    } finally {
      setLoading(false);
    }
  };

  const exportToCSV = () => {
    const headers = ['Farmer Name', 'Stall Name', 'Stall No', 'Market', 'Date', 'Entered By', 'Time'];
    const rows = filteredConfirmations.map(c => [
      c.farmer_name,
      c.stall_name,
      c.stall_no,
      c.market_name,
      c.market_date,
      c.entered_by,
      new Date(c.created_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
    ]);

    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `stall-confirmations-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    toast.success('CSV exported successfully');
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
        <div className="flex justify-between items-start">
          <div>
            <CardTitle>Real-time Stall Confirmations</CardTitle>
            <CardDescription>Live stall entry tracking</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={exportToCSV}>
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
        </div>
        <Input
          placeholder="Search by farmer, stall, or market..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="mt-4"
        />
      </CardHeader>
      <CardContent>
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {filteredConfirmations.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No stall confirmations found
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted">
                  <tr>
                    <th className="p-2 text-left">Farmer</th>
                    <th className="p-2 text-left">Stall</th>
                    <th className="p-2 text-left">No</th>
                    <th className="p-2 text-left">Market</th>
                    <th className="p-2 text-left">Date</th>
                    <th className="p-2 text-left">By</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredConfirmations.map((item) => (
                    <tr key={item.id} className="border-t hover:bg-accent/50">
                      <td className="p-2">{item.farmer_name}</td>
                      <td className="p-2">{item.stall_name}</td>
                      <td className="p-2">{item.stall_no}</td>
                      <td className="p-2">{item.market_name}</td>
                      <td className="p-2">{new Date(item.market_date).toLocaleDateString('en-IN')}</td>
                      <td className="p-2">{item.entered_by}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
