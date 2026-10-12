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
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Book appointment</DialogTitle>
          <DialogDescription>Pick a patient, provider and an open slot.</DialogDescription>
        </DialogHeader>
        <BookingForm
          {...form}
          bare
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
