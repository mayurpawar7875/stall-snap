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
        table: 'stall_confirmations' 
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
        .from('stall_confirmations')
        .select(`
          id,
          farmer_name,
          stall_name,
          stall_no,
          market_date,
          created_at,
          markets (name),
          profiles!stall_confirmations_created_by_fkey (full_name)
        `)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;

      const formatted = data?.map((item: any) => ({
        id: item.id,
        farmer_name: item.farmer_name,
        stall_name: item.stall_name,
        stall_no: item.stall_no,
        market_name: item.markets?.name || 'Unknown',
        market_date: item.market_date,
        created_at: item.created_at,
        entered_by: item.profiles?.full_name || 'Unknown',
      })) || [];

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
