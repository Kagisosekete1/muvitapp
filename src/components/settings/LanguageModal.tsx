import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Check } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface LanguageModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const languages = [
  // Most spoken languages globally
  { code: 'en', name: 'English', native: 'English' },
  { code: 'zh', name: 'Chinese (Simplified)', native: '简体中文' },
  { code: 'zh-TW', name: 'Chinese (Traditional)', native: '繁體中文' },
  { code: 'es', name: 'Spanish', native: 'Español' },
  { code: 'hi', name: 'Hindi', native: 'हिन्दी' },
  { code: 'ar', name: 'Arabic', native: 'العربية' },
  { code: 'bn', name: 'Bengali', native: 'বাংলা' },
  { code: 'pt', name: 'Portuguese', native: 'Português' },
  { code: 'ru', name: 'Russian', native: 'Русский' },
  { code: 'ja', name: 'Japanese', native: '日本語' },
  { code: 'de', name: 'German', native: 'Deutsch' },
  { code: 'fr', name: 'French', native: 'Français' },
  { code: 'ko', name: 'Korean', native: '한국어' },
  { code: 'it', name: 'Italian', native: 'Italiano' },
  { code: 'tr', name: 'Turkish', native: 'Türkçe' },
  { code: 'vi', name: 'Vietnamese', native: 'Tiếng Việt' },
  { code: 'th', name: 'Thai', native: 'ภาษาไทย' },
  { code: 'pl', name: 'Polish', native: 'Polski' },
  { code: 'nl', name: 'Dutch', native: 'Nederlands' },
  { code: 'id', name: 'Indonesian', native: 'Bahasa Indonesia' },
  { code: 'ms', name: 'Malay', native: 'Bahasa Melayu' },
  { code: 'tl', name: 'Filipino', native: 'Filipino' },
  { code: 'sw', name: 'Swahili', native: 'Kiswahili' },
  // African languages
  { code: 'zu', name: 'Zulu', native: 'isiZulu' },
  { code: 'xh', name: 'Xhosa', native: 'isiXhosa' },
  { code: 'af', name: 'Afrikaans', native: 'Afrikaans' },
  { code: 'st', name: 'Sotho', native: 'Sesotho' },
  { code: 'tn', name: 'Tswana', native: 'Setswana' },
  { code: 'yo', name: 'Yoruba', native: 'Yorùbá' },
  { code: 'ig', name: 'Igbo', native: 'Igbo' },
  { code: 'ha', name: 'Hausa', native: 'Hausa' },
  { code: 'am', name: 'Amharic', native: 'አማርኛ' },
];

const LanguageModal: React.FC<LanguageModalProps> = ({ isOpen, onClose }) => {
  const [selectedLanguage, setSelectedLanguage] = useState('en');
  const { toast } = useToast();

  const handleSelectLanguage = (code: string) => {
    setSelectedLanguage(code);
    const lang = languages.find(l => l.code === code);
    toast({
      title: "Language Changed",
      description: `Language set to ${lang?.name}`,
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px] bg-card border-border rounded-3xl">
        <DialogHeader className="pb-4 border-b border-border">
          <DialogTitle className="text-xl font-semibold text-foreground">Language</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-1 bg-secondary/30 rounded-2xl overflow-hidden max-h-[400px] overflow-y-auto">
            {languages.map((lang) => (
              <Button
                key={lang.code}
                variant="ghost"
                className="w-full justify-between h-auto py-4 px-4 rounded-none hover:bg-secondary/50"
                onClick={() => handleSelectLanguage(lang.code)}
              >
                <div className="text-left">
                  <p className="font-medium text-foreground">{lang.name}</p>
                  <p className="text-xs text-muted-foreground">{lang.native}</p>
                </div>
                {selectedLanguage === lang.code && (
                  <Check className="w-5 h-5 text-primary" />
                )}
              </Button>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default LanguageModal;