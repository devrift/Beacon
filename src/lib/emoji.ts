// A curated emoji set — enough to feel complete in a picker without shipping a
// multi-megabyte table. Each entry carries search keywords beyond its name.

export interface Emoji {
  char: string;
  name: string;
  keywords: string;
}

export interface EmojiGroup {
  id: string;
  label: string;
  emoji: Emoji[];
}

const e = (char: string, name: string, keywords = ''): Emoji => ({ char, name, keywords });

export const EMOJI_GROUPS: EmojiGroup[] = [
  {
    id: 'smileys',
    label: 'Smileys',
    emoji: [
      e('😀', 'grinning', 'happy smile'),
      e('😄', 'smile', 'happy joy'),
      e('😅', 'sweat smile', 'relief phew'),
      e('😂', 'joy', 'laugh cry lol'),
      e('🤣', 'rofl', 'laugh floor'),
      e('🙂', 'slight smile', 'happy'),
      e('😉', 'wink', 'flirt'),
      e('😊', 'blush', 'happy shy'),
      e('😇', 'innocent', 'angel halo'),
      e('🥰', 'in love', 'hearts adore'),
      e('😍', 'heart eyes', 'love'),
      e('😘', 'kiss', 'love blow'),
      e('😋', 'yum', 'tasty tongue'),
      e('😎', 'cool', 'sunglasses'),
      e('🤩', 'star struck', 'wow amazed'),
      e('🥳', 'party', 'celebrate birthday'),
      e('🤔', 'thinking', 'hmm consider'),
      e('🤨', 'raised brow', 'suspicious'),
      e('😐', 'neutral', 'meh'),
      e('😴', 'sleeping', 'tired zzz'),
      e('😢', 'cry', 'sad tear'),
      e('😭', 'sob', 'cry bawl'),
      e('😤', 'triumph', 'huff proud'),
      e('😡', 'rage', 'angry mad'),
      e('🥺', 'pleading', 'puppy beg'),
      e('😳', 'flushed', 'embarrassed'),
      e('🤯', 'mind blown', 'explode wow'),
      e('😬', 'grimace', 'awkward'),
      e('🙄', 'eye roll', 'annoyed'),
      e('😏', 'smirk', 'smug'),
    ],
  },
  {
    id: 'gestures',
    label: 'People',
    emoji: [
      e('👍', 'thumbs up', 'yes approve like'),
      e('👎', 'thumbs down', 'no dislike'),
      e('👌', 'ok', 'perfect'),
      e('🤌', 'pinched', 'italian chef'),
      e('✌️', 'victory', 'peace'),
      e('🤞', 'crossed fingers', 'luck hope'),
      e('🤙', 'call me', 'hang loose'),
      e('👏', 'clap', 'applause bravo'),
      e('🙌', 'raised hands', 'praise celebrate'),
      e('🙏', 'pray', 'thanks please'),
      e('🤝', 'handshake', 'deal agree'),
      e('💪', 'muscle', 'strong flex'),
      e('👀', 'eyes', 'look watch'),
      e('🧠', 'brain', 'smart think'),
      e('👋', 'wave', 'hi bye hello'),
      e('✋', 'raised hand', 'stop high five'),
      e('🫡', 'salute', 'respect yes'),
      e('🫶', 'heart hands', 'love'),
    ],
  },
  {
    id: 'nature',
    label: 'Nature',
    emoji: [
      e('🔥', 'fire', 'lit hot flame'),
      e('✨', 'sparkles', 'shiny magic clean'),
      e('⭐', 'star', 'favorite'),
      e('🌟', 'glowing star', 'shine'),
      e('⚡', 'zap', 'lightning fast'),
      e('🌈', 'rainbow', 'pride color'),
      e('☀️', 'sun', 'sunny hot'),
      e('🌙', 'moon', 'night'),
      e('💧', 'droplet', 'water'),
      e('🌊', 'wave', 'ocean sea'),
      e('🌸', 'blossom', 'flower spring'),
      e('🌿', 'herb', 'plant leaf'),
      e('🍀', 'clover', 'luck'),
      e('🐶', 'dog', 'puppy'),
      e('🐱', 'cat', 'kitten'),
      e('🦋', 'butterfly', 'pretty'),
    ],
  },
  {
    id: 'food',
    label: 'Food',
    emoji: [
      e('☕', 'coffee', 'cafe morning'),
      e('🍵', 'tea', 'matcha'),
      e('🍕', 'pizza', 'food'),
      e('🍔', 'burger', 'food'),
      e('🌮', 'taco', 'food'),
      e('🍜', 'ramen', 'noodles'),
      e('🍰', 'cake', 'dessert birthday'),
      e('🍪', 'cookie', 'sweet'),
      e('🍩', 'donut', 'sweet'),
      e('🍫', 'chocolate', 'sweet'),
      e('🍺', 'beer', 'drink cheers'),
      e('🍷', 'wine', 'drink'),
      e('🥂', 'cheers', 'toast celebrate'),
      e('🍾', 'champagne', 'celebrate pop'),
    ],
  },
  {
    id: 'objects',
    label: 'Objects',
    emoji: [
      e('🎉', 'tada', 'party celebrate'),
      e('🎊', 'confetti', 'party'),
      e('🎁', 'gift', 'present'),
      e('🏆', 'trophy', 'win award'),
      e('🥇', 'gold medal', 'first win'),
      e('💯', 'hundred', 'perfect score'),
      e('💡', 'idea', 'bulb light'),
      e('🔔', 'bell', 'notify alert'),
      e('📌', 'pin', 'pinned'),
      e('📎', 'clip', 'attach'),
      e('✅', 'check', 'done yes'),
      e('❌', 'cross', 'no wrong'),
      e('⚠️', 'warning', 'caution'),
      e('🚀', 'rocket', 'launch ship fast'),
      e('💻', 'laptop', 'code work'),
      e('📱', 'phone', 'mobile'),
      e('🎧', 'headphones', 'music audio'),
      e('🎙️', 'mic', 'record voice'),
      e('🔗', 'link', 'url chain'),
      e('🔒', 'lock', 'secure private'),
    ],
  },
  {
    id: 'hearts',
    label: 'Symbols',
    emoji: [
      e('❤️', 'red heart', 'love'),
      e('🧡', 'orange heart', 'love'),
      e('💛', 'yellow heart', 'love'),
      e('💚', 'green heart', 'love'),
      e('💙', 'blue heart', 'love'),
      e('💜', 'purple heart', 'love'),
      e('🖤', 'black heart', 'love'),
      e('🤍', 'white heart', 'love'),
      e('💔', 'broken heart', 'sad'),
      e('💕', 'two hearts', 'love'),
      e('💖', 'sparkle heart', 'love'),
      e('❤️‍🔥', 'heart fire', 'passion'),
    ],
  },
];

const ALL = EMOJI_GROUPS.flatMap((g) => g.emoji);

export function searchEmoji(query: string): Emoji[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return ALL.filter((em) => em.name.includes(q) || em.keywords.includes(q)).slice(0, 48);
}
