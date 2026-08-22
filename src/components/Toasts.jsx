import Icon from './Icon.jsx';
import { useStore } from '../lib/store.jsx';

export default function Toasts() {
  const { toasts } = useStore();
  return (
    <div className="toast-wrap" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className="toast">
          <span className="t-ic"><Icon name={t.kind === 'wish' ? 'heart' : 'checkCircle'} size={18} /></span>
          <span className="t-body"><strong>{t.message}</strong></span>
        </div>
      ))}
    </div>
  );
}
