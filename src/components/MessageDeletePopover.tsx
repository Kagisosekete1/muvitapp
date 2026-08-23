import React from 'react';
import { Button } from '@/components/ui/button';
import { Trash2 } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface MessageDeletePopoverProps {
  children: React.ReactNode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDelete: () => void;
  side?: 'top' | 'bottom' | 'left' | 'right';
}

const MessageDeletePopover: React.FC<MessageDeletePopoverProps> = ({
  children,
  open,
  onOpenChange,
  onDelete,
  side = 'top'
}) => {
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        {children}
      </PopoverTrigger>
      <PopoverContent 
        side={side} 
        className="w-auto p-1 rounded-2xl shadow-lg"
        sideOffset={8}
      >
        <Button
          variant="destructive"
          size="sm"
          className="gap-2 rounded-xl"
          onClick={() => {
            onDelete();
            onOpenChange(false);
          }}
        >
          <Trash2 className="w-4 h-4" />
          Delete
        </Button>
      </PopoverContent>
    </Popover>
  );
};

export default MessageDeletePopover;
