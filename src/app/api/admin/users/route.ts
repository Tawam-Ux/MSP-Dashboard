import type { NextRequest } from "next/server";
import { apiError, listResponse, readJson, requireApiPermission } from "@/backend/lib/admin-api";
import { createUserSchema, createUserWithAccess, getAdminUser, listAdminUsers } from "@/backend/lib/users";

export async function GET(req: NextRequest) {
  const me = await requireApiPermission("users.manage");
  if (me instanceof Response) return me;
  return listResponse(req, "users", await listAdminUsers(), ["username", "name"]);
}

export async function POST(req: NextRequest) {
  const me = await requireApiPermission("users.manage");
  if (me instanceof Response) return me;

  const parsed = createUserSchema.safeParse(await readJson(req));
  if (!parsed.success) return apiError(400, parsed.error.issues[0].message);
  const result = await createUserWithAccess(parsed.data);
  if ("error" in result) return apiError(400, result.error);
  return Response.json(await getAdminUser(result.id), { status: 201 });
}
