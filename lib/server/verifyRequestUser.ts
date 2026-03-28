import { getAdminAuth } from "@/lib/server/firebaseAdmin"

export async function verifyBearerUid(request: Request): Promise<string> {
  const header = request.headers.get("authorization")
  if (!header?.startsWith("Bearer ")) {
    throw new Error("UNAUTHORIZED")
  }
  const token = header.slice(7).trim()
  if (!token) throw new Error("UNAUTHORIZED")
  const decoded = await getAdminAuth().verifyIdToken(token)
  return decoded.uid
}
