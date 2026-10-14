import { clientsWithLogos } from "../lib/clientLogos";
import { WorkPage } from "../work/WorkPage";

export default function Home() {
  return <WorkPage clients={clientsWithLogos()} />;
}
