import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { ArrowLeft, Upload, Camera, MapPin, AlertCircle, CheckCircle } from 'lucide-react';

interface MediaFile {
  id: string;
  media_type: 'outside_rates' | 'selfie_gps' | 'rate_board' | 'market_video' | 'cleaning_video';
  file_url: string;
  file_name: string;
  gps_lat: number | null;
  gps_lng: number | null;
  captured_at: string;
  is_late: boolean;
}

interface TimeWindow {
  start: string;
  end: string;
  label: string;
}

export default function MediaUpload() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [session, setSession] = useState<any>(null);
  const [media, setMedia] = useState<MediaFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    fetchSession();
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, [user]);

  const fetchSession = async () => {
    if (!user) return;

    try {
      const today = new Date().toISOString().split('T')[0];
      const { data: sessionData, error: sessionError } = await supabase
        .from('sessions')
        .select('*')
        .eq('user_id', user.id)
        .eq('session_date', today)
        .maybeSingle();

      if (sessionError) throw sessionError;
      if (!sessionData) {
        toast.error('No session found for today');
        navigate('/dashboard');
        return;
      }

      setSession(sessionData);

      const { data: mediaData, error: mediaError } = await supabase
        .from('media')
        .select('*')
        .eq('session_id', sessionData.id)
        .order('created_at', { ascending: false });

      if (mediaError) throw mediaError;
      setMedia(mediaData || []);
    } catch (error: any) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load media');
    } finally {
      setLoading(false);
    }
  };

  const getISTTime = () => {
    const now = new Date();
    const istOffset = 5.5 * 60; // IST is UTC+5:30 in minutes
    const localOffset = now.getTimezoneOffset(); // Local offset from UTC in minutes (negative for ahead of UTC)
    return new Date(now.getTime() + (istOffset + localOffset) * 60 * 1000);
  };

  const isTimeInWindow = (windowStart: string, windowEnd: string) => {
    const istTime = getISTTime();
    
    const hours = istTime.getHours();
    const minutes = istTime.getMinutes();
    const currentMinutes = hours * 60 + minutes;

    const [startH, startM] = windowStart.split(':').map(Number);
    const [endH, endM] = windowEnd.split(':').map(Number);
    const startMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;

    return currentMinutes >= startMinutes && currentMinutes < endMinutes;
  };

  const isLateUpload = (windowStart: string, windowEnd: string) => {
    return !isTimeInWindow(windowStart, windowEnd);
  };

  const timeWindows: Record<MediaFile['media_type'], TimeWindow> = {
    outside_rates: { start: '14:00', end: '14:15', label: '2:00 PM - 2:15 PM IST' },
    selfie_gps: { start: '14:15', end: '14:20', label: '2:15 PM - 2:20 PM IST' },
    rate_board: { start: '15:45', end: '16:00', label: '3:45 PM - 4:00 PM IST' },
    market_video: { start: '16:00', end: '16:15', label: '4:00 PM - 4:15 PM IST' },
    cleaning_video: { start: '21:15', end: '21:30', label: '9:15 PM - 9:30 PM IST' },
  };

  const canUploadOutsideRates = isTimeInWindow('14:00', '14:15');
  const canUploadSelfie = isTimeInWindow('14:15', '14:20');
  const canUploadRateBoard = isTimeInWindow('15:45', '16:00');
  const canUploadMarketVideo = isTimeInWindow('16:00', '16:15');
  const canUploadCleaningVideo = isTimeInWindow('21:15', '21:30');

  const handleFileUpload = async (
    file: File,
    mediaType: MediaFile['media_type'],
    isLate: boolean,
    gpsLat?: number,
    gpsLng?: number
  ) => {
    if (!session) return;

    setUploading(true);
    try {
      const fileName = `${user!.id}/${Date.now()}-${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from('employee-media')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from('employee-media').getPublicUrl(fileName);

      const { error: insertError } = await supabase.from('media').insert({
        session_id: session.id,
        media_type: mediaType,
        file_url: urlData.publicUrl,
        file_name: file.name,
        content_type: file.type,
        gps_lat: gpsLat || null,
        gps_lng: gpsLng || null,
        captured_at: new Date().toISOString(),
        is_late: isLate,
      });

      if (insertError) throw insertError;

      const message = isLate 
        ? 'Media uploaded successfully (marked as late)' 
        : 'Media uploaded successfully!';
      toast.success(message);
      fetchSession();
    } catch (error: any) {
      toast.error('Failed to upload media');
      console.error(error);
    } finally {
      setUploading(false);
    }
  };

  const handleOutsideRatesUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isLate = isLateUpload('14:00', '14:15');
    await handleFileUpload(file, 'outside_rates', isLate);
  };

  const handleSelfieUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isLate = isLateUpload('14:15', '14:20');

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          await handleFileUpload(
            file,
            'selfie_gps',
            isLate,
            position.coords.latitude,
            position.coords.longitude
          );
        },
        (error) => {
          toast.error('Failed to get GPS location. Please enable location access.');
          console.error(error);
        }
      );
    } else {
      toast.error('Geolocation is not supported by your browser');
    }
  };

  const handleRateBoardUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const isLate = isLateUpload('15:45', '16:00');
    await handleFileUpload(file, 'rate_board', isLate);
  };

  const handleMarketVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const isLate = isLateUpload('16:00', '16:15');
    await handleFileUpload(file, 'market_video', isLate);
  };

  const handleCleaningVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const isLate = isLateUpload('21:15', '21:30');
    await handleFileUpload(file, 'cleaning_video', isLate);
  };

  const outsideRatesMedia = media.filter((m) => m.media_type === 'outside_rates');
  const selfieMedia = media.filter((m) => m.media_type === 'selfie_gps');
  const rateBoardMedia = media.filter((m) => m.media_type === 'rate_board');
  const marketVideoMedia = media.filter((m) => m.media_type === 'market_video');
  const cleaningVideoMedia = media.filter((m) => m.media_type === 'cleaning_video');

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <Button variant="ghost" onClick={() => navigate('/dashboard')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-4xl space-y-6">
        {/* Outside Market Rates */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-accent/10 rounded-lg">
                <Upload className="h-6 w-6 text-accent" />
              </div>
              <div className="flex-1">
                <CardTitle>Outside Market Rates</CardTitle>
                <CardDescription>Upload allowed between 2:00 PM - 2:15 PM IST</CardDescription>
              </div>
              {canUploadOutsideRates ? (
                <CheckCircle className="h-6 w-6 text-success" />
              ) : (
                <AlertCircle className="h-6 w-6 text-warning" />
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="outside-rates">Upload Media (Image/Video/Audio)</Label>
              <Input
                id="outside-rates"
                type="file"
                accept="image/*,video/*,audio/*"
                onChange={handleOutsideRatesUpload}
                disabled={uploading}
              />
            </div>
            {outsideRatesMedia.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-semibold text-sm">Uploaded Files ({outsideRatesMedia.length})</h4>
                {outsideRatesMedia.map((file) => (
                  <div key={file.id} className="p-3 bg-muted rounded-lg">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <p className="text-sm font-medium">{file.file_name}</p>
                        <p className="text-xs text-muted-foreground">
                          Uploaded at {new Date(file.captured_at).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' })}
                        </p>
                      </div>
                      {file.is_late && (
                        <span className="text-xs font-semibold text-destructive">Late Upload</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Selfie + GPS */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-accent/10 rounded-lg">
                <Camera className="h-6 w-6 text-accent" />
              </div>
              <div className="flex-1">
                <CardTitle>Selfie + GPS Location</CardTitle>
                <CardDescription>Upload allowed between 2:15 PM - 2:20 PM IST</CardDescription>
              </div>
              {canUploadSelfie ? (
                <CheckCircle className="h-6 w-6 text-success" />
              ) : (
                <AlertCircle className="h-6 w-6 text-warning" />
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="selfie">Upload Selfie with GPS</Label>
              <Input
                id="selfie"
                type="file"
                accept="image/*"
                onChange={handleSelfieUpload}
                disabled={uploading}
              />
              <p className="text-xs text-muted-foreground">
                <MapPin className="inline h-3 w-3 mr-1" />
                GPS location will be automatically captured when you upload
              </p>
            </div>
            {selfieMedia.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-semibold text-sm">Uploaded Selfies ({selfieMedia.length})</h4>
                {selfieMedia.map((file) => (
                  <div key={file.id} className="p-3 bg-muted rounded-lg">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <p className="text-sm font-medium">{file.file_name}</p>
                        <p className="text-xs text-muted-foreground">
                          Uploaded at {new Date(file.captured_at).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' })}
                        </p>
                        {file.gps_lat && file.gps_lng && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {file.gps_lat.toFixed(6)}, {file.gps_lng.toFixed(6)}
                          </p>
                        )}
                      </div>
                      {file.is_late && (
                        <span className="text-xs font-semibold text-destructive">Late Upload</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Big Rate Board Photo */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-accent/10 rounded-lg">
                <Upload className="h-6 w-6 text-accent" />
              </div>
              <div className="flex-1">
                <CardTitle>Big Rate Board Photo</CardTitle>
                <CardDescription>Upload allowed between 3:45 PM - 4:00 PM IST</CardDescription>
              </div>
              {canUploadRateBoard ? (
                <CheckCircle className="h-6 w-6 text-success" />
              ) : (
                <AlertCircle className="h-6 w-6 text-warning" />
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="rate-board">Upload Photo</Label>
              <Input
                id="rate-board"
                type="file"
                accept="image/*"
                onChange={handleRateBoardUpload}
                disabled={uploading}
              />
            </div>
            {rateBoardMedia.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-semibold text-sm">Uploaded Photos ({rateBoardMedia.length})</h4>
                {rateBoardMedia.map((file) => (
                  <div key={file.id} className="p-3 bg-muted rounded-lg">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <p className="text-sm font-medium">{file.file_name}</p>
                        <p className="text-xs text-muted-foreground">
                          Uploaded at {new Date(file.captured_at).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' })}
                        </p>
                      </div>
                      {file.is_late && (
                        <span className="text-xs font-semibold text-destructive">Late Upload</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Market Video */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-accent/10 rounded-lg">
                <Upload className="h-6 w-6 text-accent" />
              </div>
              <div className="flex-1">
                <CardTitle>Market Video</CardTitle>
                <CardDescription>Upload allowed between 4:00 PM - 4:15 PM IST</CardDescription>
              </div>
              {canUploadMarketVideo ? (
                <CheckCircle className="h-6 w-6 text-success" />
              ) : (
                <AlertCircle className="h-6 w-6 text-warning" />
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="market-video">Upload Video</Label>
              <Input
                id="market-video"
                type="file"
                accept="video/*"
                onChange={handleMarketVideoUpload}
                disabled={uploading}
              />
            </div>
            {marketVideoMedia.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-semibold text-sm">Uploaded Videos ({marketVideoMedia.length})</h4>
                {marketVideoMedia.map((file) => (
                  <div key={file.id} className="p-3 bg-muted rounded-lg">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <p className="text-sm font-medium">{file.file_name}</p>
                        <p className="text-xs text-muted-foreground">
                          Uploaded at {new Date(file.captured_at).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' })}
                        </p>
                      </div>
                      {file.is_late && (
                        <span className="text-xs font-semibold text-destructive">Late Upload</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Market Space Cleaning Video */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-accent/10 rounded-lg">
                <Upload className="h-6 w-6 text-accent" />
              </div>
              <div className="flex-1">
                <CardTitle>Market Space Cleaning Video</CardTitle>
                <CardDescription>Upload allowed between 9:15 PM - 9:30 PM IST</CardDescription>
              </div>
              {canUploadCleaningVideo ? (
                <CheckCircle className="h-6 w-6 text-success" />
              ) : (
                <AlertCircle className="h-6 w-6 text-warning" />
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="cleaning-video">Upload Video</Label>
              <Input
                id="cleaning-video"
                type="file"
                accept="video/*"
                onChange={handleCleaningVideoUpload}
                disabled={uploading}
              />
            </div>
            {cleaningVideoMedia.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-semibold text-sm">Uploaded Videos ({cleaningVideoMedia.length})</h4>
                {cleaningVideoMedia.map((file) => (
                  <div key={file.id} className="p-3 bg-muted rounded-lg">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <p className="text-sm font-medium">{file.file_name}</p>
                        <p className="text-xs text-muted-foreground">
                          Uploaded at {new Date(file.captured_at).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' })}
                        </p>
                      </div>
                      {file.is_late && (
                        <span className="text-xs font-semibold text-destructive">Late Upload</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Time Window Info */}
        <Card className="border-info">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-info mt-0.5" />
              <div className="flex-1 space-y-1">
                <p className="font-semibold text-info">
                  Current Time (IST): {new Date(currentTime.getTime() + (5.5 * 60 + currentTime.getTimezoneOffset()) * 60 * 1000).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' })}
                </p>
                <p className="text-sm text-muted-foreground">
                  You can upload files anytime. Uploads outside the specified time windows will be marked as "Late Upload".
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
