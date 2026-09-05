// ============================================================
// Renders the admin-authored creator terms.
//
// The document is markdown, but this deliberately does NOT use a markdown
// library or dangerouslySetInnerHTML. The text is admin-authored rather than
// user-generated, so it is not hostile — but it is still stored data rendered
// into a page that shows commission figures, and turning stored text into
// live HTML is a habit worth not starting. Everything below builds React
// elements, so nothing in the document can become markup.
//
// Supported, because it is what a terms document actually needs:
//   # / ## / ###   headings
//   - or *         bullets
//   1.             numbered items
//   blank line     paragraph break
// Anything else renders as a paragraph, verbatim.
// ============================================================

function renderBlocks(body) {
  const lines = String(body || '').replace(/\r\n/g, '\n').split('\n');
  const blocks = [];
  let para = [];
  let list = null;          // { ordered: boolean, items: string[] }

  const flushPara = () => {
    if (para.length) { blocks.push({ type: 'p', text: para.join(' ') }); para = []; }
  };
  const flushList = () => {
    if (list) { blocks.push({ type: 'list', ...list }); list = null; }
  };

  for (const raw of lines) {
    const line = raw.trim();

    if (!line) { flushPara(); flushList(); continue; }

    const heading = line.match(/^(#{1,3})\s+(.*)$/);
    if (heading) {
      flushPara(); flushList();
      blocks.push({ type: 'h', level: heading[1].length, text: heading[2].trim() });
      continue;
    }

    const bullet = line.match(/^[-*]\s+(.*)$/);
    if (bullet) {
      flushPara();
      if (!list || list.ordered) { flushList(); list = { ordered: false, items: [] }; }
      list.items.push(bullet[1].trim());
      continue;
    }

    const numbered = line.match(/^\d+[.)]\s+(.*)$/);
    if (numbered) {
      flushPara();
      if (!list || !list.ordered) { flushList(); list = { ordered: true, items: [] }; }
      list.items.push(numbered[1].trim());
      continue;
    }

    flushList();
    para.push(line);
  }
  flushPara(); flushList();
  return blocks;
}

export default function CreatorTermsPanel({ terms, className = '' }) {
  const body = terms?.body || '';
  if (!body.trim()) return null;

  const blocks = renderBlocks(body);

  return (
    <div className={`ck-terms ${className}`.trim()}>
      {blocks.map((b, i) => {
        if (b.type === 'h') {
          const Tag = b.level === 1 ? 'h3' : b.level === 2 ? 'h4' : 'h5';
          // h1/h2 are the page's own; the document starts a level down so it
          // cannot outrank the heading it sits under.
          return <Tag key={i} className="ck-terms__h">{b.text}</Tag>;
        }
        if (b.type === 'list') {
          const Tag = b.ordered ? 'ol' : 'ul';
          return (
            <Tag key={i} className="ck-terms__list">
              {b.items.map((item, j) => <li key={j}>{item}</li>)}
            </Tag>
          );
        }
        return <p key={i} className="ck-terms__p">{b.text}</p>;
      })}
    </div>
  );
}

/** "Last updated" line, shown to creators beside the document. */
export function TermsUpdatedLine({ terms }) {
  if (!terms?.updated_at) return null;
  return (
    <p className="ck-terms__meta">
      Version {terms.version || 1} · last updated{' '}
      {new Date(terms.updated_at).toLocaleDateString('en-IN', {
        day: 'numeric', month: 'long', year: 'numeric',
      })}
    </p>
  );
}
