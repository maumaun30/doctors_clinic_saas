import { redirect } from "next/navigation";

// Retired: doctor↔clinic pairing lives on each doctor's page and
// secretary↔doctor assignments on each secretary's page. Kept as a
// redirect so old links and bookmarks still land somewhere useful.
export default function AssignmentsRedirect() {
  redirect("/admin/doctors");
}
