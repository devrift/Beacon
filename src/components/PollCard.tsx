import { BarChart3, Check } from 'lucide-react';
import { cx } from '../lib/cx';
import { useAppStore, type Message } from '../store/useAppStore';

export function PollCard({ message }: { message: Message }) {
  const poll = message.poll;
  const me = useAppStore((s) => s.appUser.id);
  const votePoll = useAppStore((s) => s.votePoll);
  const closePoll = useAppStore((s) => s.closePoll);
  if (!poll) return null;

  const total = poll.options.reduce((sum, o) => sum + o.votes.length, 0);
  const iVoted = poll.options.some((o) => o.votes.includes(me));
  const isAuthor = message.author_id === me;

  return (
    <div className="mt-1.5 max-w-[440px] rounded-md border border-line bg-surface p-3.5">
      <div className="mb-3 flex items-start gap-2">
        <BarChart3 size={15} className="mt-px shrink-0 text-accent" />
        <div className="min-w-0 flex-1">
          <div className="text-[13.5px] leading-snug font-semibold text-ink">{poll.question}</div>
          <div className="mt-0.5 text-[11.5px] text-ink-mute">
            {poll.closed ? 'Final results' : poll.multiple ? 'Pick as many as you like' : 'Pick one'}
            {' · '}
            {total} {total === 1 ? 'vote' : 'votes'}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        {poll.options.map((option) => {
          const count = option.votes.length;
          const share = total > 0 ? count / total : 0;
          const chosen = option.votes.includes(me);
          // Results stay hidden until you vote, so early votes don't anchor later ones.
          const reveal = iVoted || poll.closed;

          return (
            <button
              key={option.id}
              type="button"
              disabled={poll.closed}
              onClick={() => votePoll(message.channel_id, message.id, option.id)}
              className={cx(
                'relative overflow-hidden rounded-sm border px-3 py-2 text-left transition-colors',
                chosen ? 'border-accent/60' : 'border-line hover:border-line-strong',
                poll.closed && 'cursor-default',
              )}
            >
              {reveal && (
                <span
                  className="absolute inset-y-0 left-0 transition-[width] duration-500"
                  style={{
                    width: `${share * 100}%`,
                    backgroundColor: chosen
                      ? 'rgb(var(--accent-rgb) / 0.18)'
                      : 'rgb(var(--text-rgb) / 0.06)',
                  }}
                />
              )}
              <span className="relative flex items-center gap-2">
                <span
                  className={cx(
                    'grid h-4 w-4 shrink-0 place-items-center rounded-[4px] border',
                    chosen ? 'border-accent bg-accent text-accent-ink' : 'border-line-strong',
                  )}
                >
                  {chosen && <Check size={11} strokeWidth={3} />}
                </span>
                <span className="min-w-0 flex-1 truncate text-[13px] text-ink">{option.label}</span>
                {reveal && (
                  <span className="shrink-0 font-mono text-[11px] text-ink-dim tnum">
                    {Math.round(share * 100)}%
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>

      {isAuthor && !poll.closed && (
        <button
          type="button"
          onClick={() => closePoll(message.channel_id, message.id)}
          className="mt-2.5 text-[11.5px] font-medium text-ink-mute hover:text-danger"
        >
          Close poll
        </button>
      )}
    </div>
  );
}
