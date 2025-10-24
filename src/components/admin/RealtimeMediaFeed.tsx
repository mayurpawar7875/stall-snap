import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Download, ExternalLink } from 'lucide-react';

interface MediaUpload {
  id: string;
  employee_name: string;
  market_name: string;
  file_type: string;
  uploaded_at: string;
  is_late: boolean;
  file_url: string;
}

export default function RealtimeMediaFeed() {
  const [uploads, setUploads] = useState<MediaUpload[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRecentUploads();
    
    const channel = supabase
      .channel('media-feed')
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'media' 
      }, (payload) => {
        fetchRecentUploads();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchRecentUploads = async () => {
    try {
      // Use direct filtering with new columns
      const { data, error } = await supabase
        .from('media')
        .select(`
          id,
          file_url,
          media_type,
          captured_at,
          is_late,
          user_id,
          market_id,
          employees!media_user_id_fkey(full_name),
          markets!media_market_id_fkey(name)
        `)
        .order('captured_at', { ascending: false })
        .limit(20);

      if (error) throw error;

      const formattedUploads = data?.map((item: any) => ({
        id: item.id,
        employee_name: item.employees?.full_name || 'Unknown',
        market_name: item.markets?.name || 'Unknown',
        file_type: item.media_type.replace(/_/g, ' ').toUpperCase(),
        uploaded_at: item.captured_at,
        is_late: item.is_late,
        file_url: item.file_url,
      })) || [];

      setUploads(formattedUploads);
    } catch (error) {
      console.error('Error fetching media feed:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleString('en-IN', { 
      timeZone: 'Asia/Kolkata',
      dateStyle: 'short',
      timeStyle: 'short'
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
        <CardTitle>Real-time Media Feed</CardTitle>
        <CardDescription>Latest uploads across all markets</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {uploads.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No uploads yet
            </div>
          ) : (
            uploads.map((upload) => (
              <div key={upload.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent/50 transition-colors">
                <div className="space-y-1 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{upload.employee_name}</span>
                    <span className="text-muted-foreground">•</span>
                    <span className="text-sm text-muted-foreground">{upload.market_name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      {upload.file_type}
                    </Badge>
                    {upload.is_late && (
                      <Badge variant="destructive" className="text-xs">
                        Late Upload
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">{formatTime(upload.uploaded_at)}</p>
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    asChild
                  >
                    <a href={upload.file_url} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    asChild
                  >
                    <a href={upload.file_url} download>
                      <Download className="h-4 w-4" />
                    </a>
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
