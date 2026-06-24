import { redirect } from "next/navigation";

export default function MdmIndexPage() {
  redirect("/admin/mdm/source-records");
}
