import { Workspace } from "@/components/reality5/workspace"
import { getWorkspaceData } from "@/lib/reality5/data-source"

export default async function Page() {
  const data = await getWorkspaceData()
  return <Workspace data={data} />
}
