import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  ArrowLeft, 
  Search, 
  Check, 
  X, 
  Clock, 
  DollarSign,
  User,
  Filter,
  RefreshCw
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useUser } from '@/contexts/UserContext';
import { useToast } from '@/hooks/use-toast';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface PayoutRequest {
  id: string;
  user_id: string;
  amount: number;
  vat_deducted: number;
  currency: string;
  country_code: string;
  status: string;
  payout_method: string | null;
  payout_reference: string | null;
  requested_at: string;
  processed_at: string | null;
  profile?: {
    username: string;
    display_name: string;
    avatar_url: string | null;
  };
}

const AdminPayouts = () => {
  const navigate = useNavigate();
  const { authUser } = useUser();
  const { toast } = useToast();
  const [payouts, setPayouts] = useState<PayoutRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [isAdmin, setIsAdmin] = useState(false);
  const [processing, setProcessing] = useState<string | null>(null);

  useEffect(() => {
    checkAdminStatus();
  }, [authUser]);

  const checkAdminStatus = async () => {
    if (!authUser) {
      navigate('/auth');
      return;
    }

    const { data: role } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', authUser.id)
      .eq('role', 'admin')
      .maybeSingle();

    if (role) {
      setIsAdmin(true);
      fetchPayouts();
    } else {
      toast({ title: 'Access Denied', description: 'You do not have admin access', variant: 'destructive' });
      navigate('/');
    }
  };

  const fetchPayouts = async () => {
    setLoading(true);
    try {
      // Note: This requires a service role or RLS policy that allows admins to view all payouts
      const { data: payoutsData, error } = await supabase
        .from('creator_payouts')
        .select('*')
        .order('requested_at', { ascending: false });

      if (error) {
        console.error('Error fetching payouts:', error);
        setLoading(false);
        return;
      }

      if (payoutsData && payoutsData.length > 0) {
        const userIds = [...new Set(payoutsData.map(p => p.user_id))];
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, username, display_name, avatar_url')
          .in('user_id', userIds);

        const enriched = payoutsData.map(p => ({
          ...p,
          profile: profiles?.find(pr => pr.user_id === p.user_id),
        }));

        setPayouts(enriched);
      }
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (payoutId: string) => {
    setProcessing(payoutId);
    try {
      const { error } = await supabase
        .from('creator_payouts')
        .update({
          status: 'approved',
          processed_at: new Date().toISOString(),
        })
        .eq('id', payoutId);

      if (error) throw error;

      setPayouts(prev => prev.map(p => 
        p.id === payoutId ? { ...p, status: 'approved', processed_at: new Date().toISOString() } : p
      ));
      toast({ title: 'Approved', description: 'Payout has been approved for processing' });
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to approve payout', variant: 'destructive' });
    } finally {
      setProcessing(null);
    }
  };

  const handleReject = async (payoutId: string) => {
    setProcessing(payoutId);
    try {
      const { error } = await supabase
        .from('creator_payouts')
        .update({
          status: 'rejected',
          processed_at: new Date().toISOString(),
        })
        .eq('id', payoutId);

      if (error) throw error;

      setPayouts(prev => prev.map(p => 
        p.id === payoutId ? { ...p, status: 'rejected', processed_at: new Date().toISOString() } : p
      ));
      toast({ title: 'Rejected', description: 'Payout request has been rejected' });
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to reject payout', variant: 'destructive' });
    } finally {
      setProcessing(null);
    }
  };

  const handleMarkPaid = async (payoutId: string) => {
    setProcessing(payoutId);
    const reference = prompt('Enter payment reference (optional):');
    
    try {
      const { error } = await supabase
        .from('creator_payouts')
        .update({
          status: 'paid',
          payout_reference: reference || null,
          processed_at: new Date().toISOString(),
        })
        .eq('id', payoutId);

      if (error) throw error;

      setPayouts(prev => prev.map(p => 
        p.id === payoutId ? { ...p, status: 'paid', payout_reference: reference, processed_at: new Date().toISOString() } : p
      ));
      toast({ title: 'Marked as Paid', description: 'Payout has been marked as completed' });
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to update payout', variant: 'destructive' });
    } finally {
      setProcessing(null);
    }
  };

  const formatCurrency = (amount: number, currency: string) => {
    const symbols: Record<string, string> = {
      USD: '$', EUR: '€', GBP: '£', ZAR: 'R', NGN: '₦', KES: 'KSh',
    };
    return `${symbols[currency] || currency}${amount.toFixed(2)}`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      pending: 'bg-amber-500/20 text-amber-500',
      approved: 'bg-blue-500/20 text-blue-500',
      paid: 'bg-green-500/20 text-green-500',
      rejected: 'bg-red-500/20 text-red-500',
    };
    return (
      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${styles[status] || 'bg-muted text-muted-foreground'}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  const filteredPayouts = payouts.filter(p => {
    const matchesSearch = 
      p.profile?.username?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.profile?.display_name?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const stats = {
    pending: payouts.filter(p => p.status === 'pending').length,
    totalPending: payouts.filter(p => p.status === 'pending').reduce((s, p) => s + p.amount, 0),
    totalPaid: payouts.filter(p => p.status === 'paid').reduce((s, p) => s + p.amount, 0),
  };

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background border-b border-border px-4 py-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-lg font-bold">Admin: Payout Requests</h1>
          <Button variant="ghost" size="sm" onClick={fetchPayouts} className="ml-auto">
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 p-4">
        <div className="p-3 bg-secondary/30 rounded-xl text-center">
          <Clock className="w-5 h-5 mx-auto mb-1 text-amber-500" />
          <p className="text-lg font-bold">{stats.pending}</p>
          <p className="text-xs text-muted-foreground">Pending</p>
        </div>
        <div className="p-3 bg-secondary/30 rounded-xl text-center">
          <DollarSign className="w-5 h-5 mx-auto mb-1 text-amber-500" />
          <p className="text-lg font-bold">${stats.totalPending.toFixed(0)}</p>
          <p className="text-xs text-muted-foreground">Pending Value</p>
        </div>
        <div className="p-3 bg-secondary/30 rounded-xl text-center">
          <Check className="w-5 h-5 mx-auto mb-1 text-green-500" />
          <p className="text-lg font-bold">${stats.totalPaid.toFixed(0)}</p>
          <p className="text-xs text-muted-foreground">Total Paid</p>
        </div>
      </div>

      {/* Filters */}
      <div className="px-4 pb-4 flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search users..."
            className="pl-9 rounded-xl"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-32 rounded-xl">
            <Filter className="w-4 h-4 mr-2" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Payouts List */}
      <div className="px-4 pb-20 space-y-3">
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" />
          </div>
        ) : filteredPayouts.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <DollarSign className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No payout requests found</p>
          </div>
        ) : (
          filteredPayouts.map((payout) => (
            <div key={payout.id} className="p-4 bg-card rounded-xl border border-border">
              <div className="flex items-start gap-3">
                <Avatar className="w-10 h-10">
                  <AvatarImage src={payout.profile?.avatar_url || ''} />
                  <AvatarFallback>
                    <User className="w-5 h-5" />
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <p className="font-semibold truncate">
                      {payout.profile?.display_name || 'Unknown User'}
                    </p>
                    {getStatusBadge(payout.status)}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    @{payout.profile?.username || 'unknown'}
                  </p>
                  <div className="flex items-center gap-4 mt-2 text-sm">
                    <span className="font-bold text-lg">
                      {formatCurrency(payout.amount, payout.currency)}
                    </span>
                    <span className="text-muted-foreground">
                      VAT: {formatCurrency(payout.vat_deducted, payout.currency)}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Requested: {formatDate(payout.requested_at)}
                  </p>
                  {payout.payout_method && (
                    <p className="text-xs text-muted-foreground">
                      Method: {payout.payout_method}
                    </p>
                  )}
                  {payout.payout_reference && (
                    <p className="text-xs text-muted-foreground">
                      Ref: {payout.payout_reference}
                    </p>
                  )}
                </div>
              </div>

              {/* Actions */}
              {payout.status === 'pending' && (
                <div className="flex gap-2 mt-3">
                  <Button
                    size="sm"
                    className="flex-1 rounded-xl"
                    onClick={() => handleApprove(payout.id)}
                    disabled={processing === payout.id}
                  >
                    <Check className="w-4 h-4 mr-1" />
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    className="flex-1 rounded-xl"
                    onClick={() => handleReject(payout.id)}
                    disabled={processing === payout.id}
                  >
                    <X className="w-4 h-4 mr-1" />
                    Reject
                  </Button>
                </div>
              )}
              {payout.status === 'approved' && (
                <Button
                  size="sm"
                  className="w-full mt-3 rounded-xl bg-green-600 hover:bg-green-700"
                  onClick={() => handleMarkPaid(payout.id)}
                  disabled={processing === payout.id}
                >
                  <DollarSign className="w-4 h-4 mr-1" />
                  Mark as Paid
                </Button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default AdminPayouts;
