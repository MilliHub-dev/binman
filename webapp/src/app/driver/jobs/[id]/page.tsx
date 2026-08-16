import { JobDetail } from '@/components/driver/JobDetail';

/**
 * Next 16: `params` is a Promise and must be awaited. The interactive work
 * lives in a client component below.
 */
export default async function JobPage(props: PageProps<'/driver/jobs/[id]'>) {
  const { id } = await props.params;
  return <JobDetail assignmentId={id} />;
}
