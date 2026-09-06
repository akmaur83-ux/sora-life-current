import { useLegalPage } from '../lib/legalPagesApi.js';
import LegalPageContent from '../components/LegalPageContent.jsx';
export default function EditableLegal({ doc }) {
  const { page } = useLegalPage(doc);
  return <LegalPageContent id={doc} page={page}/>;
}
