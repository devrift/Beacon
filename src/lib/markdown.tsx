import { Fragment, useState, type ReactNode } from 'react';

// ─────────────────────────────────────────────────────────────────────────────
// A small, dependency-free Markdown renderer that emits React nodes (never raw
// HTML, so there is nothing to sanitise). It covers the subset people actually
// type in chat: fenced code, quotes, lists, and inline emphasis/links/spoilers.
// ─────────────────────────────────────────────────────────────────────────────

const URL_RE = /^(https?:\/\/[^\s<>]+[^\s<>.,;:!?)])/i;

function Spoiler({ children }: { children: ReactNode }) {
  const [shown, setShown] = useState(false);
  return (
    <span
      className="spoiler"
      data-revealed={shown ? 'true' : undefined}
      onClick={() => setShown(true)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setShown(true)}
    >
      {children}
    </span>
  );
}

/** Inline pass: emphasis, code, strike, spoilers, links, mentions. */
function renderInline(text: string, keyBase: string): ReactNode[] {
  const out: ReactNode[] = [];
  let rest = text;
  let i = 0;

  const push = (node: ReactNode) => out.push(<Fragment key={`${keyBase}-${i++}`}>{node}</Fragment>);

  while (rest.length > 0) {
    // Ordered by precedence; code first so its contents stay literal.
    const code = rest.match(/^`([^`]+)`/);
    if (code) {
      push(<code>{code[1]}</code>);
      rest = rest.slice(code[0].length);
      continue;
    }
    const spoiler = rest.match(/^\|\|([\s\S]+?)\|\|/);
    if (spoiler) {
      push(<Spoiler>{renderInline(spoiler[1], `${keyBase}s${i}`)}</Spoiler>);
      rest = rest.slice(spoiler[0].length);
      continue;
    }
    const bold = rest.match(/^\*\*([\s\S]+?)\*\*/);
    if (bold) {
      push(<strong>{renderInline(bold[1], `${keyBase}b${i}`)}</strong>);
      rest = rest.slice(bold[0].length);
      continue;
    }
    const strike = rest.match(/^~~([\s\S]+?)~~/);
    if (strike) {
      push(<s>{renderInline(strike[1], `${keyBase}k${i}`)}</s>);
      rest = rest.slice(strike[0].length);
      continue;
    }
    const italic = rest.match(/^([*_])([^*_\n]+?)\1/);
    if (italic) {
      push(<em>{renderInline(italic[2], `${keyBase}i${i}`)}</em>);
      rest = rest.slice(italic[0].length);
      continue;
    }
    const link = rest.match(/^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/);
    if (link) {
      push(
        <a href={link[2]} target="_blank" rel="noreferrer noopener">
          {link[1]}
        </a>,
      );
      rest = rest.slice(link[0].length);
      continue;
    }
    const bare = rest.match(URL_RE);
    if (bare) {
      push(
        <a href={bare[1]} target="_blank" rel="noreferrer noopener">
          {bare[1]}
        </a>,
      );
      rest = rest.slice(bare[0].length);
      continue;
    }
    const mention = rest.match(/^@([a-z0-9_]{1,32})/i);
    if (mention) {
      push(<span className="mention">@{mention[1]}</span>);
      rest = rest.slice(mention[0].length);
      continue;
    }

    // Plain run: consume up to the next character that could start a token.
    const next = rest.slice(1).search(/[`|*_~[@]|https?:\/\//);
    const take = next === -1 ? rest.length : next + 1;
    push(rest.slice(0, take));
    rest = rest.slice(take);
  }

  return out;
}

/** Block pass: splits fences, quotes and lists, then renders inline within. */
export function Markdown({ text }: { text: string }) {
  const blocks: ReactNode[] = [];
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  let k = 0;

  for (let li = 0; li < lines.length; li += 1) {
    const line = lines[li];

    // Fenced code — everything until the closing fence is literal.
    const fence = line.match(/^```(\w*)\s*$/);
    if (fence) {
      const body: string[] = [];
      li += 1;
      while (li < lines.length && !/^```\s*$/.test(lines[li])) {
        body.push(lines[li]);
        li += 1;
      }
      blocks.push(
        <pre key={`p${k++}`}>
          <code>{body.join('\n')}</code>
        </pre>,
      );
      continue;
    }

    if (/^>\s?/.test(line)) {
      const quote: string[] = [];
      while (li < lines.length && /^>\s?/.test(lines[li])) {
        quote.push(lines[li].replace(/^>\s?/, ''));
        li += 1;
      }
      li -= 1;
      blocks.push(
        <blockquote key={`q${k++}`}>{renderInline(quote.join('\n'), `q${k}`)}</blockquote>,
      );
      continue;
    }

    if (/^\s*[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (li < lines.length && /^\s*[-*]\s+/.test(lines[li])) {
        items.push(lines[li].replace(/^\s*[-*]\s+/, ''));
        li += 1;
      }
      li -= 1;
      blocks.push(
        <ul key={`u${k++}`}>
          {items.map((item, idx) => (
            <li key={idx}>{renderInline(item, `u${k}-${idx}`)}</li>
          ))}
        </ul>,
      );
      continue;
    }

    if (line.trim() === '') continue;

    blocks.push(<p key={`t${k++}`}>{renderInline(line, `t${k}`)}</p>);
  }

  return <div className="prose-msg">{blocks}</div>;
}
