"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { ACTIVE_CLINIC_COOKIE } from "@/lib/data/clinic-context";

export async function setActiveClinic(formData: FormData) {
  const id = formData.get("clinic_id") as string;
  const c = await cookies();
  if (id) {
    c.set(ACTIVE_CLINIC_COOKIE, id, {
      path: "/", httpOnly: false, sameSite: "lax", maxAge: 60 * 60 * 24 * 365,
    });
  } else {
    c.delete(ACTIVE_CLINIC_COOKIE);
  }
  revalidatePath("/", "layout");
}
