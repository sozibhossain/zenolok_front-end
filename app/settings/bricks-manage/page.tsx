import { redirect } from "next/navigation";

export default function BricksManagePage() {
  redirect("/settings?section=bricksManage&modal=bricks-manage");
}
