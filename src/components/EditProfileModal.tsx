import React, { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Camera } from 'lucide-react';
import { useUser } from '@/contexts/UserContext';
import { useToast } from '@/hooks/use-toast';
import { profileSchema } from '@/lib/validations';

interface EditProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const EditProfileModal: React.FC<EditProfileModalProps> = ({ isOpen, onClose }) => {
  const { currentUser, updateUser, authUser } = useUser();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formData, setFormData] = useState({
    username: currentUser?.username || '',
    displayName: currentUser?.displayName || '',
    bio: currentUser?.bio || '',
  });
  const [avatarPreview, setAvatarPreview] = useState(currentUser?.avatarUrl || '');

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !authUser) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      setAvatarPreview(reader.result as string);
    };
    reader.readAsDataURL(file);

    toast({
      title: "Photo selected",
      description: "Your photo will be saved when you click Save Changes",
    });
  };

  const handleSave = async () => {
    if (!currentUser) return;
    setErrors({});
    setLoading(true);

    try {
      // Validate with zod schema
      const result = profileSchema.safeParse({
        username: formData.username,
        displayName: formData.displayName,
        bio: formData.bio || undefined,
      });

      if (!result.success) {
        const fieldErrors: Record<string, string> = {};
        result.error.issues.forEach((err) => {
          if (err.path[0]) {
            fieldErrors[err.path[0] as string] = err.message;
          }
        });
        setErrors(fieldErrors);
        setLoading(false);
        return;
      }

      await updateUser({
        username: formData.username,
        displayName: formData.displayName,
        bio: formData.bio,
        avatarUrl: avatarPreview,
      });

      toast({
        title: "Profile updated",
        description: "Your profile has been saved to the cloud.",
      });
      onClose();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update profile",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (!currentUser) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px] bg-card border-border rounded-3xl">
        <DialogHeader className="pb-4 border-b border-border">
          <DialogTitle className="text-xl font-semibold text-foreground">Edit Profile</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          {/* Profile Picture */}
          <div className="flex flex-col items-center space-y-2">
            <div className="relative">
              <img
                src={avatarPreview}
                alt="Profile"
                className="w-24 h-24 rounded-full object-cover"
              />
              <Button
                size="sm"
                className="absolute bottom-0 right-0 rounded-full w-8 h-8 p-0"
                onClick={handleAvatarClick}
              >
                <Camera className="w-4 h-4" />
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarChange}
              />
            </div>
            <button 
              onClick={handleAvatarClick}
              className="text-sm text-primary hover:underline"
            >
              Change profile photo
            </button>
          </div>

          {/* Form Fields */}
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium text-foreground">Username</label>
              <Input
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') })}
                placeholder="@username"
                className={`mt-1 rounded-xl ${errors.username ? 'border-destructive' : ''}`}
              />
              {errors.username && (
                <p className="text-xs text-destructive mt-1">{errors.username}</p>
              )}
            </div>

            <div>
              <label className="text-sm font-medium text-foreground">Display Name</label>
              <Input
                value={formData.displayName}
                onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                placeholder="Your Name"
                className={`mt-1 rounded-xl ${errors.displayName ? 'border-destructive' : ''}`}
              />
              {errors.displayName && (
                <p className="text-xs text-destructive mt-1">{errors.displayName}</p>
              )}
            </div>

            <div>
              <label className="text-sm font-medium text-foreground">Bio</label>
              <Textarea
                value={formData.bio}
                onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                placeholder="Tell us about yourself..."
                className={`mt-1 resize-none rounded-xl ${errors.bio ? 'border-destructive' : ''}`}
                rows={3}
              />
              {errors.bio && (
                <p className="text-xs text-destructive mt-1">{errors.bio}</p>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex space-x-3 pt-2">
            <Button variant="outline" className="flex-1 rounded-xl" onClick={onClose}>
              Cancel
            </Button>
            <Button className="flex-1 rounded-xl" onClick={handleSave} disabled={loading}>
              {loading ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default EditProfileModal;