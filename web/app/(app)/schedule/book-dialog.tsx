"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { CalendarPlusIcon } from "lucide-react";
import { Icon } from "@/app/_components/icons";
import BookingForm from "./booking-form";

type Props = Omit<React.ComponentProps<typeof BookingForm>, "onBooked" | "bare"> & {
  label?: string;
};

// "Book" button that opens the booking form in a dialog. On success it
// closes, toasts, and refreshes the page so lists pick up the new visit.
export function BookDialog({ label = "Book", ...form }: Props) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button><Icon name="plus" /> {label}</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader className="flex-row items-center gap-3 text-left">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <CalendarPlusIcon className="size-5" />
          </div>
          <div className="grid gap-1">
            <DialogTitle>Book appointment</DialogTitle>
            <DialogDescription>Choose a patient, provider and an open time.</DialogDescription>
          </div>
        </DialogHeader>
        <BookingForm
          {...form}
          bare
          onCancel={() => setOpen(false)}
          onBooked={() => {
            setOpen(false);
            toast.success("Appointment booked");
            router.refresh();
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
