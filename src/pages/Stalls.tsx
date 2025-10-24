import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { ArrowLeft, Plus, Trash2, Edit } from 'lucide-react';

interface Stall {
  id: string;
  farmer_name: string;
  stall_name: string;
  stall_no: string;
}

export default function Stalls() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [session, setSession] = useState<any>(null);
  const [stalls, setStalls] = useState<Stall[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingStall, setEditingStall] = useState<Stall | null>(null);
  const [formData, setFormData] = useState({
    farmer_name: '',
    stall_name: '',
    stall_no: '',
  });

  useEffect(() => {
    fetchData();
  }, [user]);

  const fetchData = async () => {
    if (!user) return;

    try {
      const today = new Date().toISOString().split('T')[0];
      
      // Fetch stall confirmations for today
      const { data: stallsData, error: stallsError } = await supabase
        .from('stall_confirmations')
        .select('*')
        .eq('created_by', user.id)
        .eq('market_date', today)
        .order('created_at', { ascending: true });

      if (stallsError) throw stallsError;
      setStalls(stallsData || []);
    } catch (error: any) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load stalls');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.farmer_name.trim() || !formData.stall_name.trim() || !formData.stall_no.trim()) {
      toast.error('Please fill in all fields');
      return;
    }

    if (!user) return;

    try {
      // Get market info from dashboard state
      const dashboardState = JSON.parse(localStorage.getItem('dashboardState') || '{}');
      const marketId = dashboardState.selectedMarketId;
      
      if (!marketId) {
        toast.error('Please select a market from the dashboard first');
        navigate('/dashboard');
        return;
      }

      if (editingStall) {
        // Update existing stall confirmation
        const { error } = await supabase
          .from('stall_confirmations')
          .update(formData)
          .eq('id', editingStall.id);

        if (error) throw error;
        
        const istTime = new Date().toLocaleTimeString('en-IN', { 
          timeZone: 'Asia/Kolkata',
          hour: '2-digit',
          minute: '2-digit'
        });
        toast.success(`Updated at ${istTime} IST`);
      } else {
        // Insert new stall confirmation - trigger will handle session and metadata
        const { error } = await supabase
          .from('stall_confirmations')
          .insert({
            ...formData,
            created_by: user.id,
            market_id: marketId,
          } as any);

        if (error) throw error;
        
        const istTime = new Date().toLocaleTimeString('en-IN', { 
          timeZone: 'Asia/Kolkata',
          hour: '2-digit',
          minute: '2-digit'
        });
        toast.success(`Saved at ${istTime} IST`);
      }

      setDialogOpen(false);
      setEditingStall(null);
      setFormData({ farmer_name: '', stall_name: '', stall_no: '' });
      fetchData();
    } catch (error: any) {
      toast.error(editingStall ? 'Failed to update stall' : 'Failed to add stall');
      console.error(error);
    }
  };

  const handleEdit = (stall: Stall) => {
    setEditingStall(stall);
    setFormData({
      farmer_name: stall.farmer_name,
      stall_name: stall.stall_name,
      stall_no: stall.stall_no,
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this stall?')) return;

    try {
      const { error } = await supabase.from('stall_confirmations').delete().eq('id', id);

      if (error) throw error;
      toast.success('Stall deleted successfully!');
      fetchData();
    } catch (error: any) {
      toast.error('Failed to delete stall');
      console.error(error);
    }
  };

  const handleDialogClose = () => {
    setDialogOpen(false);
    setEditingStall(null);
    setFormData({ farmer_name: '', stall_name: '', stall_no: '' });
  };

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

      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <Card>
          <CardHeader>
            <div className="flex justify-between items-start">
              <div>
                <CardTitle>Stall Confirmations</CardTitle>
                <CardDescription>Add and manage stall information for today's session</CardDescription>
              </div>
              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Stall
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{editingStall ? 'Edit Stall' : 'Add New Stall'}</DialogTitle>
                    <DialogDescription>
                      Enter the details of the stall
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="farmer_name">Farmer Name</Label>
                      <Input
                        id="farmer_name"
                        value={formData.farmer_name}
                        onChange={(e) => setFormData({ ...formData, farmer_name: e.target.value })}
                        placeholder="Enter farmer name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="stall_name">Stall Name</Label>
                      <Input
                        id="stall_name"
                        value={formData.stall_name}
                        onChange={(e) => setFormData({ ...formData, stall_name: e.target.value })}
                        placeholder="Enter stall name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="stall_no">Stall Number</Label>
                      <Input
                        id="stall_no"
                        value={formData.stall_no}
                        onChange={(e) => setFormData({ ...formData, stall_no: e.target.value })}
                        placeholder="Enter stall number"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button type="submit" className="flex-1">
                        {editingStall ? 'Update' : 'Add'} Stall
                      </Button>
                      <Button type="button" variant="outline" onClick={handleDialogClose}>
                        Cancel
                      </Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent>
            {stalls.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">No stalls added yet. Click "Add Stall" to begin.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {stalls.map((stall) => (
                  <Card key={stall.id}>
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start">
                        <div className="space-y-1">
                          <h3 className="font-semibold">{stall.stall_name}</h3>
                          <p className="text-sm text-muted-foreground">Farmer: {stall.farmer_name}</p>
                          <p className="text-sm text-muted-foreground">Stall No: {stall.stall_no}</p>
                        </div>
                        <div className="flex gap-2">
                          <Button variant="ghost" size="icon" onClick={() => handleEdit(stall)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDelete(stall.id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
