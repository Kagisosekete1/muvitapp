import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, Globe, Check } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useUser } from '@/contexts/UserContext';
import { useToast } from '@/hooks/use-toast';

interface CountrySelectorProps {
  isOpen: boolean;
  onClose: () => void;
}

interface Country {
  country_code: string;
  country_name: string;
  vat_rate: number;
  currency: string;
}

const CountrySelector: React.FC<CountrySelectorProps> = ({ isOpen, onClose }) => {
  const { authUser, refreshProfile } = useUser();
  const { toast } = useToast();
  const [countries, setCountries] = useState<Country[]>([]);
  const [selectedCountry, setSelectedCountry] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchCountries();
      fetchCurrentCountry();
    }
  }, [isOpen]);

  const fetchCountries = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('country_vat_rates')
      .select('country_code, country_name, vat_rate, currency')
      .order('country_name');

    if (data) {
      setCountries(data);
    }
    setLoading(false);
  };

  const fetchCurrentCountry = async () => {
    if (!authUser) return;
    const { data } = await supabase
      .from('profiles')
      .select('country_code')
      .eq('user_id', authUser.id)
      .single();

    if (data?.country_code) {
      setSelectedCountry(data.country_code);
    }
  };

  const handleSave = async () => {
    if (!authUser || !selectedCountry) return;
    
    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ country_code: selectedCountry })
        .eq('user_id', authUser.id);

      if (error) throw error;

      await refreshProfile();
      toast({ title: 'Country Updated', description: 'Your payout currency has been updated.' });
      onClose();
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to update country', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const filteredCountries = countries.filter(c =>
    c.country_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.country_code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const selectedCountryData = countries.find(c => c.country_code === selectedCountry);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[400px] max-h-[80vh] overflow-hidden flex flex-col bg-card">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Globe className="w-5 h-5 text-primary" />
            Select Your Country
          </DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground">
          Pick your country or search by country name. Muv'it will use that country's currency for earnings and payouts.
        </p>

        {/* Current Selection */}
        {selectedCountryData && (
          <div className="p-3 bg-primary/10 rounded-xl border border-primary/30">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">{selectedCountryData.country_name}</p>
                <p className="text-sm text-muted-foreground">
                  VAT: {selectedCountryData.vat_rate}% • Currency: {selectedCountryData.currency}
                </p>
              </div>
              <Check className="w-5 h-5 text-primary" />
            </div>
          </div>
        )}

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search countries..."
            className="pl-9 rounded-xl"
          />
        </div>

        {/* Countries List */}
        <div className="flex-1 overflow-y-auto space-y-1 min-h-[200px] max-h-[300px]">
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" />
            </div>
          ) : filteredCountries.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">No countries found</p>
          ) : (
            filteredCountries.map((country) => (
              <button
                key={country.country_code}
                onClick={() => setSelectedCountry(country.country_code)}
                className={`w-full flex items-center justify-between p-3 rounded-xl transition-colors text-left ${
                  selectedCountry === country.country_code
                    ? 'bg-primary/10 border border-primary/30'
                    : 'hover:bg-secondary'
                }`}
              >
                <div>
                  <p className="font-medium text-sm">{country.country_name}</p>
                  <p className="text-xs text-muted-foreground">
                    VAT: {country.vat_rate}% • {country.currency}
                  </p>
                </div>
                {selectedCountry === country.country_code && (
                  <Check className="w-4 h-4 text-primary" />
                )}
              </button>
            ))
          )}
        </div>

        {/* Save Button */}
        <Button
          className="w-full rounded-xl"
          onClick={handleSave}
          disabled={saving || !selectedCountry}
        >
          {saving ? 'Saving...' : 'Save Country'}
        </Button>
      </DialogContent>
    </Dialog>
  );
};

export default CountrySelector;
