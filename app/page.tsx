import { Workspace } from "@/components/reality5/workspace"
import { getDefaultPossession } from "@/lib/reality5/data-source"

export default async function Page() {
  const possession = await getDefaultPossession()
  return <Workspace possession={possession} />
}
