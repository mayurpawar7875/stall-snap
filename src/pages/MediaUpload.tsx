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
  media_type: 'outside_rates' | 'selfie_gps';
  file_url: string;
  file_name: string;
  gps_lat: number | null;
  gps_lng: number | null;
  captured_at: string;
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

  const isTimeInWindow = (windowStart: string, windowEnd: string) => {
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const currentMinutes = hours * 60 + minutes;

    const [startH, startM] = windowStart.split(':').map(Number);
    const [endH, endM] = windowEnd.split(':').map(Number);
    const startMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;

    return currentMinutes >= startMinutes && currentMinutes < endMinutes;
  };

  const canUploadOutsideRates = isTimeInWindow('14:00', '14:15');
  const canUploadSelfie = isTimeInWindow('14:15', '14:20');

  const handleFileUpload = async (
    file: File,
    mediaType: 'outside_rates' | 'selfie_gps',
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
      });

      if (insertError) throw insertError;

      toast.success('Media uploaded successfully!');
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

    if (!canUploadOutsideRates) {
      toast.error('Outside Market Rates can only be uploaded between 2:00 PM - 2:15 PM IST');
      return;
    }

    await handleFileUpload(file, 'outside_rates');
  };

  const handleSelfieUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!canUploadSelfie) {
      toast.error('Selfie + GPS can only be uploaded between 2:15 PM - 2:20 PM IST');
      return;
    }

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          await handleFileUpload(
            file,
            'selfie_gps',
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

  const outsideRatesMedia = media.filter((m) => m.media_type === 'outside_rates');
  const selfieMedia = media.filter((m) => m.media_type === 'selfie_gps');

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
                disabled={uploading || !canUploadOutsideRates}
              />
            </div>
            {outsideRatesMedia.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-semibold text-sm">Uploaded Files ({outsideRatesMedia.length})</h4>
                {outsideRatesMedia.map((file) => (
                  <div key={file.id} className="p-3 bg-muted rounded-lg">
                    <p className="text-sm font-medium">{file.file_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(file.captured_at).toLocaleString()}
                    </p>
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
                disabled={uploading || !canUploadSelfie}
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
                    <p className="text-sm font-medium">{file.file_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(file.captured_at).toLocaleString()}
                    </p>
                    {file.gps_lat && file.gps_lng && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {file.gps_lat.toFixed(6)}, {file.gps_lng.toFixed(6)}
                      </p>
                    )}
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
                <p className="font-semibold text-info">Current Time: {currentTime.toLocaleTimeString()}</p>
                <p className="text-sm text-muted-foreground">
                  Make sure to upload files during the specified time windows. Uploads outside these windows
                  will be rejected.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
