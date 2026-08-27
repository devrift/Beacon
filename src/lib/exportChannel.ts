import { fullTimestamp } from './time';
import type { Message } from '../store/useAppStore';

interface ExportSource {
  channels: { id: string; name: string; topic?: string }[];
  messagesByChannel: Record<string, Message[]>;
}

/** Renders a channel to Markdown and downloads it. Your data, portable. */
export function exportChannelMarkdown(state: ExportSource, channelId: string): void {
  const channel = state.channels.find((c) => c.id === channelId);
  if (!channel) return;
  const messages = state.messagesByChannel[channelId] ?? [];

  const lines: string[] = [`# #${channel.name}`];
  if (channel.topic) lines.push(`> ${channel.topic}`);
  lines.push('', `_${messages.length} messages · exported ${fullTimestamp(new Date().toISOString())}_`, '');

  for (const message of messages) {
    if (message.system) {
      lines.push(`_${message.content}_`, '');
      continue;
    }
    lines.push(`**${message.author_name ?? 'Unknown'}** · ${fullTimestamp(message.created_at)}`);
    lines.push('');
    lines.push(message.content || '_(no text)_');
    if (message.attachments?.length) {
      lines.push('');
      for (const a of message.attachments) lines.push(`- 📎 ${a.name}`);
    }
    if (message.poll) {
      lines.push('', `**Poll:** ${message.poll.question}`);
      for (const option of message.poll.options) {
        lines.push(`- ${option.label} — ${option.votes.length} vote(s)`);
      }
    }
    const reactions = Object.entries(message.reactions ?? {});
    if (reactions.length > 0) {
      lines.push('', reactions.map(([emoji, users]) => `${emoji} ${users.length}`).join('  '));
    }
    lines.push('', '---', '');
  }

  const blob = new Blob([lines.join('\n')], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${channel.name}.md`;
  link.click();
  URL.revokeObjectURL(url);
}
