import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { SessionComments } from '@/components/SessionComments';
import { toast } from 'sonner';
import { Download, Eye, Filter, MapPin, Calendar, Clock, User } from 'lucide-react';

interface Session {
  id: string;
  session_date: string;
  punch_in_time: string | null;
  punch_out_time: string | null;
  status: string;
  finalized_at: string | null;
  employees: { full_name: string; phone: string | null };
  markets: { name: string; location: string };
  stalls: any[];
  media: any[];
}

export default function AllSessions() {
  const location = useLocation();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [filteredSessions, setFilteredSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [filters, setFilters] = useState({
    dateFrom: '',
    dateTo: '',
    status: '',
    marketId: '',
  });
  const [markets, setMarkets] = useState<any[]>([]);

  useEffect(() => {
    fetchMarkets();
    fetchSessions();
  }, []);

  useEffect(() => {
    // Apply filters based on navigation state
    const state = location.state as any;
    const today = new Date().toISOString().split('T')[0];
    
    if (state?.filterToday) {
      setFilters(prev => ({ ...prev, dateFrom: today, dateTo: today, status: '' }));
    } else if (state?.filterCompleted) {
      setFilters(prev => ({ ...prev, dateFrom: today, dateTo: today, status: 'completed' }));
    }
  }, [location.state]);

  useEffect(() => {
    applyFilters();
  }, [sessions, filters]);

  const fetchMarkets = async () => {
    try {
      const { data, error } = await supabase.from('markets').select('*').order('name');
      if (error) throw error;
      setMarkets(data || []);
    } catch (error) {
      console.error('Error fetching markets:', error);
    }
  };

  const fetchSessions = async () => {
    try {
      const { data, error } = await supabase
        .from('sessions')
        .select(
          `
          *,
          employees!sessions_user_id_fkey (full_name, phone),
          markets!sessions_market_id_fkey (name, location),
          stalls (*),
          media (*)
        `
        )
        .order('session_date', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) throw error;
      setSessions(data as any || []);
    } catch (error: any) {
      toast.error('Failed to load sessions');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...sessions];

    if (filters.dateFrom) {
      filtered = filtered.filter((s) => s.session_date >= filters.dateFrom);
    }
    if (filters.dateTo) {
      filtered = filtered.filter((s) => s.session_date <= filters.dateTo);
    }
    if (filters.status && filters.status !== 'all') {
      filtered = filtered.filter((s) => s.status === filters.status);
    }
    if (filters.marketId && filters.marketId !== 'all') {
      filtered = filtered.filter((s) => s.markets && 'id' in s.markets && (s.markets as any).id === filters.marketId);
    }

    setFilteredSessions(filtered);
  };

  const exportToCSV = () => {
    const headers = [
      'Date',
      'Employee',
      'Market',
      'Punch In',
      'Punch Out',
      'Status',
      'Stalls Count',
      'Media Count',
    ];

    const rows = filteredSessions.map((s) => [
      s.session_date,
      s.employees?.full_name || 'N/A',
      s.markets?.name || 'N/A',
      s.punch_in_time ? new Date(s.punch_in_time).toLocaleString() : 'N/A',
      s.punch_out_time ? new Date(s.punch_out_time).toLocaleString() : 'N/A',
      s.status,
      s.stalls?.length || 0,
      s.media?.length || 0,
    ]);

    const csv = [headers, ...rows].map((row) => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sessions-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    toast.success('CSV exported successfully');
  };

  const getStatusBadge = (status: string) => {
    const colors = {
      active: 'bg-info text-info-foreground',
      completed: 'bg-success text-success-foreground',
      finalized: 'bg-success text-success-foreground',
      locked: 'bg-muted text-muted-foreground',
    };
    return <Badge className={colors[status as keyof typeof colors]}>{status}</Badge>;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-3xl font-bold">All Sessions</h2>
          <p className="text-muted-foreground">View and manage employee reporting sessions</p>
        </div>
        <Button onClick={exportToCSV} disabled={filteredSessions.length === 0}>
          <Download className="mr-2 h-4 w-4" />
          Export CSV
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label htmlFor="dateFrom">Date From</Label>
              <Input
                id="dateFrom"
                type="date"
                value={filters.dateFrom}
                onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dateTo">Date To</Label>
              <Input
                id="dateTo"
                type="date"
                value={filters.dateTo}
                onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select value={filters.status} onValueChange={(val) => setFilters({ ...filters, status: val })}>
                <SelectTrigger id="status">
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="finalized">Finalized</SelectItem>
                  <SelectItem value="locked">Locked</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="market">Market</Label>
              <Select
                value={filters.marketId}
                onValueChange={(val) => setFilters({ ...filters, marketId: val })}
              >
                <SelectTrigger id="market">
                  <SelectValue placeholder="All markets" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {markets.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2">
            <p className="text-sm text-muted-foreground">
              Showing {filteredSessions.length} of {sessions.length} sessions
            </p>
            {(filters.dateFrom || filters.dateTo || filters.status || filters.marketId) && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setFilters({ dateFrom: '', dateTo: '', status: '', marketId: '' })}
              >
                Clear Filters
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Sessions List */}
      <div className="space-y-4">
        {filteredSessions.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              No sessions found matching the filters
            </CardContent>
          </Card>
        ) : (
          filteredSessions.map((session) => (
            <Card key={session.id}>
              <CardContent className="p-6">
                <div className="flex justify-between items-start">
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center gap-3">
                      <h3 className="font-semibold text-lg">{session.employees?.full_name || 'Unknown'}</h3>
                      {getStatusBadge(session.status)}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Calendar className="h-4 w-4" />
                        {new Date(session.session_date).toLocaleDateString()}
                      </div>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <MapPin className="h-4 w-4" />
                        {session.markets?.name || 'N/A'}
                      </div>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Clock className="h-4 w-4" />
                        In: {session.punch_in_time ? new Date(session.punch_in_time).toLocaleTimeString() : 'N/A'}
                      </div>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Clock className="h-4 w-4" />
                        Out: {session.punch_out_time ? new Date(session.punch_out_time).toLocaleTimeString() : 'N/A'}
                      </div>
                    </div>
                    <div className="flex gap-4 text-sm">
                      <span className="text-muted-foreground">
                        Stalls: <strong>{session.stalls?.length || 0}</strong>
                      </span>
                      <span className="text-muted-foreground">
                        Media: <strong>{session.media?.length || 0}</strong>
                      </span>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => setSelectedSession(session)}>
                    <Eye className="mr-2 h-4 w-4" />
                    View Details
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Session Details Dialog */}
      <Dialog open={!!selectedSession} onOpenChange={() => setSelectedSession(null)}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>Session Details</DialogTitle>
            <DialogDescription>
              {selectedSession?.employees?.full_name} -{' '}
              {selectedSession && new Date(selectedSession.session_date).toLocaleDateString()}
            </DialogDescription>
          </DialogHeader>
          {selectedSession && (
            <div className="space-y-6">
              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="font-semibold mb-2">Employee Information</h4>
                  <p className="text-sm">
                    <strong>Name:</strong> {selectedSession.employees?.full_name}
                  </p>
                  <p className="text-sm">
                    <strong>Phone:</strong> {selectedSession.employees?.phone || 'N/A'}
                  </p>
                </div>
                <div>
                  <h4 className="font-semibold mb-2">Market Information</h4>
                  <p className="text-sm">
                    <strong>Market:</strong> {selectedSession.markets?.name}
                  </p>
                  <p className="text-sm">
                    <strong>Location:</strong> {selectedSession.markets?.location}
                  </p>
                </div>
              </div>

              {/* Stalls */}
              <div>
                <h4 className="font-semibold mb-3">Stalls ({selectedSession.stalls?.length || 0})</h4>
                {selectedSession.stalls?.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {selectedSession.stalls.map((stall: any) => (
                      <Card key={stall.id}>
                        <CardContent className="p-3">
                          <p className="text-sm">
                            <strong>{stall.stall_name}</strong>
                          </p>
                          <p className="text-xs text-muted-foreground">Farmer: {stall.farmer_name}</p>
                          <p className="text-xs text-muted-foreground">Stall No: {stall.stall_no}</p>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No stalls recorded</p>
                )}
              </div>

              {/* Media */}
              <div>
                <h4 className="font-semibold mb-3">Media Files ({selectedSession.media?.length || 0})</h4>
                {selectedSession.media?.length > 0 ? (
                  <div className="space-y-3">
                    {selectedSession.media.map((media: any) => (
                      <Card key={media.id}>
                        <CardContent className="p-3">
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="text-sm font-medium">{media.file_name}</p>
                              <p className="text-xs text-muted-foreground">
                                Type: {media.media_type === 'outside_rates' ? 'Outside Rates' : 'Selfie + GPS'}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                Captured: {new Date(media.captured_at).toLocaleString()}
                              </p>
                              {media.gps_lat && media.gps_lng && (
                                <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                                  <MapPin className="h-3 w-3" />
                                  GPS: {media.gps_lat.toFixed(6)}, {media.gps_lng.toFixed(6)}
                                  <a
                                    href={`https://www.google.com/maps?q=${media.gps_lat},${media.gps_lng}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-accent hover:underline ml-2"
                                  >
                                    View on Map
                                  </a>
                                </p>
                              )}
                            </div>
                            <Button variant="outline" size="sm" asChild>
                              <a href={media.file_url} target="_blank" rel="noopener noreferrer">
                                View File
                              </a>
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No media files uploaded</p>
                )}
              </div>

              {/* Comments */}
              <SessionComments sessionId={selectedSession.id} />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
