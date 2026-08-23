import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { 
  Wallet, 
  Building2, 
  Smartphone, 
  Check,
  Plus,
  Trash2,
  CreditCard
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useUser } from '@/contexts/UserContext';
import { useToast } from '@/hooks/use-toast';

interface PaymentMethodsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onMethodSelected?: (method: PaymentMethod) => void;
}

interface PaymentMethod {
  id: string;
  type: 'paypal' | 'bank' | 'mobile_money';
  name: string;
  details: string;
  isDefault: boolean;
}

const PaymentMethodsModal: React.FC<PaymentMethodsModalProps> = ({ 
  isOpen, 
  onClose,
  onMethodSelected 
}) => {
  const { authUser } = useUser();
  const { toast } = useToast();
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [selectedMethod, setSelectedMethod] = useState<string>('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [addType, setAddType] = useState<'paypal' | 'bank' | 'mobile_money'>('paypal');
  const [loading, setLoading] = useState(false);

  // Form fields
  const [paypalEmail, setPaypalEmail] = useState('');
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [routingNumber, setRoutingNumber] = useState('');
  const [accountHolder, setAccountHolder] = useState('');
  const [mobileProvider, setMobileProvider] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');

  useEffect(() => {
    if (isOpen && authUser) {
      loadPaymentMethods();
    }
  }, [isOpen, authUser]);

  const loadPaymentMethods = async () => {
    if (!authUser) return;
    
    // For now, we'll store in localStorage until we add a DB table
    const stored = localStorage.getItem(`payment_methods_${authUser.id}`);
    if (stored) {
      const parsed = JSON.parse(stored);
      setMethods(parsed);
      const defaultMethod = parsed.find((m: PaymentMethod) => m.isDefault);
      if (defaultMethod) {
        setSelectedMethod(defaultMethod.id);
      }
    }
  };

  const savePaymentMethods = (newMethods: PaymentMethod[]) => {
    if (!authUser) return;
    localStorage.setItem(`payment_methods_${authUser.id}`, JSON.stringify(newMethods));
    setMethods(newMethods);
  };

  const handleAddMethod = () => {
    let newMethod: PaymentMethod | null = null;
    const id = crypto.randomUUID();

    if (addType === 'paypal') {
      if (!paypalEmail) {
        toast({ title: 'Error', description: 'Please enter your PayPal email', variant: 'destructive' });
        return;
      }
      newMethod = {
        id,
        type: 'paypal',
        name: 'PayPal',
        details: paypalEmail,
        isDefault: methods.length === 0,
      };
    } else if (addType === 'bank') {
      if (!bankName || !accountNumber || !accountHolder) {
        toast({ title: 'Error', description: 'Please fill all bank details', variant: 'destructive' });
        return;
      }
      newMethod = {
        id,
        type: 'bank',
        name: bankName,
        details: `****${accountNumber.slice(-4)} - ${accountHolder}`,
        isDefault: methods.length === 0,
      };
    } else if (addType === 'mobile_money') {
      if (!mobileProvider || !mobileNumber) {
        toast({ title: 'Error', description: 'Please fill all mobile money details', variant: 'destructive' });
        return;
      }
      newMethod = {
        id,
        type: 'mobile_money',
        name: mobileProvider,
        details: mobileNumber,
        isDefault: methods.length === 0,
      };
    }

    if (newMethod) {
      const updated = [...methods, newMethod];
      savePaymentMethods(updated);
      setShowAddForm(false);
      resetForm();
      toast({ title: 'Success', description: 'Payment method added' });
    }
  };

  const handleDeleteMethod = (id: string) => {
    const updated = methods.filter(m => m.id !== id);
    if (updated.length > 0 && !updated.find(m => m.isDefault)) {
      updated[0].isDefault = true;
    }
    savePaymentMethods(updated);
    if (selectedMethod === id && updated.length > 0) {
      setSelectedMethod(updated[0].id);
    }
    toast({ title: 'Removed', description: 'Payment method removed' });
  };

  const handleSetDefault = (id: string) => {
    const updated = methods.map(m => ({
      ...m,
      isDefault: m.id === id,
    }));
    savePaymentMethods(updated);
    setSelectedMethod(id);
  };

  const handleConfirm = () => {
    const method = methods.find(m => m.id === selectedMethod);
    if (method && onMethodSelected) {
      onMethodSelected(method);
    }
    onClose();
  };

  const resetForm = () => {
    setPaypalEmail('');
    setBankName('');
    setAccountNumber('');
    setRoutingNumber('');
    setAccountHolder('');
    setMobileProvider('');
    setMobileNumber('');
  };

  const getMethodIcon = (type: string) => {
    switch (type) {
      case 'paypal': return <Wallet className="w-5 h-5 text-blue-500" />;
      case 'bank': return <Building2 className="w-5 h-5 text-green-500" />;
      case 'mobile_money': return <Smartphone className="w-5 h-5 text-orange-500" />;
      default: return <CreditCard className="w-5 h-5" />;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[450px] max-h-[85vh] overflow-y-auto bg-card">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-primary" />
            Payment Methods
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Existing Methods */}
          {methods.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">Your payment methods</p>
              <RadioGroup value={selectedMethod} onValueChange={handleSetDefault}>
                {methods.map((method) => (
                  <div
                    key={method.id}
                    className={`flex items-center justify-between p-3 rounded-xl border transition-colors ${
                      selectedMethod === method.id ? 'border-primary bg-primary/5' : 'border-border'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <RadioGroupItem value={method.id} id={method.id} />
                      <label htmlFor={method.id} className="flex items-center gap-2 cursor-pointer">
                        {getMethodIcon(method.type)}
                        <div>
                          <p className="text-sm font-medium">{method.name}</p>
                          <p className="text-xs text-muted-foreground">{method.details}</p>
                        </div>
                      </label>
                    </div>
                    <div className="flex items-center gap-2">
                      {method.isDefault && (
                        <span className="text-[10px] bg-primary/20 text-primary px-2 py-0.5 rounded-full">
                          Default
                        </span>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                        onClick={() => handleDeleteMethod(method.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </RadioGroup>
            </div>
          )}

          {/* Add New Method */}
          {!showAddForm ? (
            <Button
              variant="outline"
              className="w-full rounded-xl"
              onClick={() => setShowAddForm(true)}
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Payment Method
            </Button>
          ) : (
            <div className="space-y-4 p-4 bg-secondary/30 rounded-xl">
              <div className="flex gap-2">
                <Button
                  variant={addType === 'paypal' ? 'default' : 'outline'}
                  size="sm"
                  className="flex-1 rounded-lg"
                  onClick={() => setAddType('paypal')}
                >
                  <Wallet className="w-4 h-4 mr-1" />
                  PayPal
                </Button>
                <Button
                  variant={addType === 'bank' ? 'default' : 'outline'}
                  size="sm"
                  className="flex-1 rounded-lg"
                  onClick={() => setAddType('bank')}
                >
                  <Building2 className="w-4 h-4 mr-1" />
                  Bank
                </Button>
                <Button
                  variant={addType === 'mobile_money' ? 'default' : 'outline'}
                  size="sm"
                  className="flex-1 rounded-lg"
                  onClick={() => setAddType('mobile_money')}
                >
                  <Smartphone className="w-4 h-4 mr-1" />
                  Mobile
                </Button>
              </div>

              {addType === 'paypal' && (
                <div className="space-y-3">
                  <div>
                    <Label className="text-sm">PayPal Email</Label>
                    <Input
                      type="email"
                      value={paypalEmail}
                      onChange={(e) => setPaypalEmail(e.target.value)}
                      placeholder="your@email.com"
                      className="mt-1 rounded-xl"
                    />
                  </div>
                </div>
              )}

              {addType === 'bank' && (
                <div className="space-y-3">
                  <div>
                    <Label className="text-sm">Bank Name</Label>
                    <Input
                      value={bankName}
                      onChange={(e) => setBankName(e.target.value)}
                      placeholder="e.g. Chase, Wells Fargo"
                      className="mt-1 rounded-xl"
                    />
                  </div>
                  <div>
                    <Label className="text-sm">Account Holder Name</Label>
                    <Input
                      value={accountHolder}
                      onChange={(e) => setAccountHolder(e.target.value)}
                      placeholder="Full name on account"
                      className="mt-1 rounded-xl"
                    />
                  </div>
                  <div>
                    <Label className="text-sm">Account Number</Label>
                    <Input
                      value={accountNumber}
                      onChange={(e) => setAccountNumber(e.target.value)}
                      placeholder="Account number"
                      className="mt-1 rounded-xl"
                    />
                  </div>
                  <div>
                    <Label className="text-sm">Routing Number (Optional)</Label>
                    <Input
                      value={routingNumber}
                      onChange={(e) => setRoutingNumber(e.target.value)}
                      placeholder="Routing number"
                      className="mt-1 rounded-xl"
                    />
                  </div>
                </div>
              )}

              {addType === 'mobile_money' && (
                <div className="space-y-3">
                  <div>
                    <Label className="text-sm">Mobile Money Provider</Label>
                    <Input
                      value={mobileProvider}
                      onChange={(e) => setMobileProvider(e.target.value)}
                      placeholder="e.g. M-Pesa, MTN MoMo, Airtel Money"
                      className="mt-1 rounded-xl"
                    />
                  </div>
                  <div>
                    <Label className="text-sm">Phone Number</Label>
                    <Input
                      value={mobileNumber}
                      onChange={(e) => setMobileNumber(e.target.value)}
                      placeholder="+254 xxx xxx xxx"
                      className="mt-1 rounded-xl"
                    />
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1 rounded-xl"
                  onClick={() => {
                    setShowAddForm(false);
                    resetForm();
                  }}
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1 rounded-xl"
                  onClick={handleAddMethod}
                  disabled={loading}
                >
                  <Check className="w-4 h-4 mr-2" />
                  Add
                </Button>
              </div>
            </div>
          )}

          {/* Confirm Button */}
          {methods.length > 0 && onMethodSelected && (
            <Button
              className="w-full rounded-xl"
              onClick={handleConfirm}
              disabled={!selectedMethod}
            >
              Use Selected Method
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PaymentMethodsModal;
