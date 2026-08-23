import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useUser } from '@/contexts/UserContext';
import { Mail, User, Calendar, Trash2, Edit2, Check, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface AccountInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const AccountInfoModal: React.FC<AccountInfoModalProps> = ({ isOpen, onClose }) => {
  const { currentUser, authUser, updateUser } = useUser();
  const { toast } = useToast();
  const [isEditingUsername, setIsEditingUsername] = useState(false);
  const [newUsername, setNewUsername] = useState(currentUser?.username || '');
  const [saving, setSaving] = useState(false);

  const handleDeleteAccount = () => {
    toast({
      title: "Delete Account",
      description: "To delete your account, please contact support@se-mogroup.com",
    });
  };

  const handleSaveUsername = async () => {
    if (!newUsername.trim()) {
      toast({
        title: "Error",
        description: "Username cannot be empty",
        variant: "destructive",
      });
      return;
    }

    if (newUsername.length < 3) {
      toast({
        title: "Error",
        description: "Username must be at least 3 characters",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      await updateUser({ username: newUsername.trim() });
      toast({
        title: "Success",
        description: "Username updated successfully",
      });
      setIsEditingUsername(false);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update username",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setNewUsername(currentUser?.username || '');
    setIsEditingUsername(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px] bg-card border-border rounded-3xl">
        <DialogHeader className="pb-4 border-b border-border">
          <DialogTitle className="text-xl font-semibold text-foreground">Account Information</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-3 bg-secondary/30 rounded-2xl p-4">
            {/* Username - Editable */}
            <div className="flex items-center justify-between gap-3 py-2">
              <div className="flex items-center gap-3 flex-1">
                <User className="w-5 h-5 text-muted-foreground" />
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground">Username</p>
                  {isEditingUsername ? (
                    <div className="flex items-center gap-2 mt-1">
                      <Input
                        value={newUsername}
                        onChange={(e) => setNewUsername(e.target.value)}
                        className="h-8 text-sm"
                        placeholder="Enter username"
                        maxLength={30}
                      />
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={handleSaveUsername}
                        disabled={saving}
                        className="h-8 w-8 p-0"
                      >
                        <Check className="w-4 h-4 text-green-500" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={handleCancelEdit}
                        disabled={saving}
                        className="h-8 w-8 p-0"
                      >
                        <X className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  ) : (
                    <p className="font-medium text-foreground">@{currentUser?.username || 'Not set'}</p>
                  )}
                </div>
              </div>
              {!isEditingUsername && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsEditingUsername(true)}
                  className="h-8 w-8 p-0"
                >
                  <Edit2 className="w-4 h-4 text-muted-foreground" />
                </Button>
              )}
            </div>
            
            <div className="flex items-center gap-3 py-2 border-t border-border/50">
              <Mail className="w-5 h-5 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Email</p>
                <p className="font-medium text-foreground">{authUser?.email || 'Not set'}</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3 py-2 border-t border-border/50">
              <Calendar className="w-5 h-5 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Member Since</p>
                <p className="font-medium text-foreground">
                  {authUser?.created_at 
                    ? new Date(authUser.created_at).toLocaleDateString() 
                    : 'Unknown'}
                </p>
              </div>
            </div>
          </div>

          <Button
            variant="outline"
            className="w-full rounded-2xl text-destructive border-destructive/30 hover:bg-destructive/10"
            onClick={handleDeleteAccount}
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Delete Account
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AccountInfoModal;