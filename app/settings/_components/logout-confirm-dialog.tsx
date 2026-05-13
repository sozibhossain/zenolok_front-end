import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface LogoutConfirmDialogProps {
  isPending: boolean;
  open: boolean;
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
}

export function LogoutConfirmDialog({ isPending, open, onConfirm, onOpenChange }: LogoutConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-3xl">
        <DialogHeader>
          <DialogTitle className="!text-[24px] text-[var(--text-strong)]">Confirm Logout</DialogTitle>
          <DialogDescription className="!text-[20px] leading-[120%] text-[var(--text-muted)]">
            Are you sure you want to logout from your account?
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="mt-3">
          <Button
            type="button"
            variant="outline"
            className="font-poppins h-8 min-w-[92px] rounded-xl !text-[24px] leading-[120%] font-medium"
            onClick={() => onOpenChange(false)}
          >
            No
          </Button>
          <Button
            type="button"
            variant="destructive"
            className="font-poppins h-8 min-w-[92px] rounded-xl !text-[24px] leading-[120%] font-medium"
            onClick={onConfirm}
            disabled={isPending}
          >
            {isPending ? "..." : "Yes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
