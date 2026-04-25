import { brickSvgData } from "./brick-svg-data";

export type BrickIconComponent = React.ComponentType<{ className?: string }>;

type BrickIconEntry = {
  value: string;
  label: string;
  svgKey: string;
  aliases?: string[];
  legacyOnly?: boolean;
};

const brickIconEntries: BrickIconEntry[] = [
  { value: "grid-2x2", label: "Grid", svgKey: "grid-2x2", aliases: ["default", "layout-grid", "grid"] },
  { value: "sun", label: "Sun", svgKey: "sun" },
  { value: "cloud-sun", label: "Cloud Sun", svgKey: "cloud-sun" },
  { value: "moon", label: "Moon", svgKey: "moon" },
  { value: "star", label: "Star", svgKey: "star", aliases: ["crown"] },
  { value: "cloud", label: "Cloud", svgKey: "cloud" },
  { value: "leaf", label: "Leaf", svgKey: "leaf" },
  { value: "cloud-rain", label: "Cloud Rain", svgKey: "cloud-rain" },

  { value: "house", label: "House", svgKey: "house", aliases: ["home"] },
  { value: "briefcase-business", label: "Briefcase", svgKey: "briefcase-business", aliases: ["work", "briefcase"] },
  { value: "shopping-cart", label: "Cart", svgKey: "shopping-cart", aliases: ["shopping"] },
  { value: "bike", label: "Bike", svgKey: "bike", aliases: ["bicycle"] },
  { value: "coins", label: "Coins", svgKey: "coins" },
  { value: "user-round", label: "User", svgKey: "user-round", aliases: ["user", "personal"] },
  { value: "backpack", label: "Backpack", svgKey: "backpack", aliases: ["baggage-claim"] },
  { value: "graduation-cap", label: "Graduation Cap", svgKey: "graduation-cap", aliases: ["graduation", "school"] },

  { value: "umbrella", label: "Umbrella", svgKey: "umbrella" },
  { value: "shirt", label: "Shirt", svgKey: "shirt" },
  { value: "bath", label: "Bath", svgKey: "bath" },
  { value: "sofa", label: "Sofa", svgKey: "sofa", aliases: ["armchair"] },
  { value: "bell", label: "Bell", svgKey: "bell" },
  { value: "zap", label: "Zap", svgKey: "zap" },
  { value: "image", label: "Image", svgKey: "image" },
  { value: "tree-pine", label: "Tree", svgKey: "tree-pine", aliases: ["tree"] },

  { value: "ghost", label: "Ghost", svgKey: "ghost" },
  { value: "balloon", label: "Balloon", svgKey: "balloon" },
  { value: "palette", label: "Palette", svgKey: "palette" },
  { value: "badge-plus", label: "Badge", svgKey: "badge-plus" },
  { value: "gamepad-2", label: "Gamepad", svgKey: "gamepad-2", aliases: ["gamepad"] },
  { value: "life-buoy", label: "Lifebuoy", svgKey: "life-buoy" },
  { value: "tv", label: "TV", svgKey: "tv", aliases: ["monitor"] },
  { value: "music", label: "Music", svgKey: "music" },

  { value: "music-2", label: "Music Alt", svgKey: "music-2" },
  { value: "wine", label: "Wine", svgKey: "wine" },
  { value: "utensils", label: "Utensils", svgKey: "utensils" },
  { value: "cake-slice", label: "Cake", svgKey: "cake-slice", aliases: ["cake"] },
  { value: "soup", label: "Soup", svgKey: "soup" },
  { value: "headphones", label: "Headphones", svgKey: "headphones" },
  { value: "library-big", label: "Library", svgKey: "library-big", aliases: ["library"] },
  { value: "radio", label: "Radio", svgKey: "radio" },

  { value: "megaphone", label: "Megaphone", svgKey: "megaphone", aliases: ["speaker"] },
  { value: "alarm-clock", label: "Alarm", svgKey: "alarm-clock", aliases: ["alarm"] },
  { value: "camera", label: "Camera", svgKey: "camera", aliases: ["video"] },
  { value: "monitor", label: "Monitor", svgKey: "monitor" },
  { value: "video", label: "Video", svgKey: "video" },
  { value: "speaker", label: "Speaker", svgKey: "speaker" },
  { value: "heart", label: "Heart", svgKey: "heart" },
  { value: "sparkles", label: "Sparkles", svgKey: "sparkles" },

  { value: "flame", label: "Flame", svgKey: "flame" },
  { value: "building-2", label: "Building", svgKey: "building-2", aliases: ["building"] },
  { value: "church", label: "Church", svgKey: "church" },
  { value: "school", label: "School", svgKey: "school", aliases: ["schoolhouse"] },
  { value: "hotel", label: "Hotel", svgKey: "hotel" },
  { value: "store", label: "Store", svgKey: "store" },
  { value: "tent", label: "Tent", svgKey: "tent" },
  { value: "train-front", label: "Train", svgKey: "train-front", aliases: ["train"] },

  { value: "tram-front", label: "Tram", svgKey: "tram-front", aliases: ["tram"] },
  { value: "bus-front", label: "Bus", svgKey: "bus-front", aliases: ["bus"] },
  { value: "car-front", label: "Car", svgKey: "car-front", aliases: ["car"] },
  { value: "ambulance", label: "Ambulance", svgKey: "ambulance" },
  { value: "truck", label: "Truck", svgKey: "truck" },
  { value: "plane", label: "Plane", svgKey: "plane" },
  { value: "rocket", label: "Rocket", svgKey: "rocket" },
  { value: "flask-conical", label: "Flask", svgKey: "flask-conical", aliases: ["flask", "flask-2"] },

  { value: "syringe", label: "Syringe", svgKey: "syringe" },
  { value: "pill", label: "Pill", svgKey: "pill" },
  { value: "stethoscope", label: "Stethoscope", svgKey: "stethoscope" },
  { value: "briefcase-medical", label: "Medical", svgKey: "briefcase-medical" },
  { value: "globe", label: "Globe", svgKey: "globe" },
  { value: "watch", label: "Watch", svgKey: "watch" },
  { value: "wrench", label: "Wrench", svgKey: "wrench" },
  { value: "calendar-days", label: "Calendar", svgKey: "calendar-days", aliases: ["calendar"] },

  { value: "shopping-bag", label: "Shopping Bag", svgKey: "shopping-bag" },
  { value: "package", label: "Package", svgKey: "package" },
  { value: "bell-ring", label: "Bell Ring", svgKey: "bell-ring" },
  { value: "moon-star", label: "Moon Star", svgKey: "moon-star" },
  { value: "mic-2", label: "Microphone", svgKey: "mic-2" },
  { value: "waves", label: "Waves", svgKey: "waves" },
  { value: "scissors", label: "Scissors", svgKey: "scissors" },
  { value: "trash-2", label: "Trash", svgKey: "trash-2" },

  { value: "compass", label: "Compass", svgKey: "compass" },
  { value: "file-text", label: "File", svgKey: "file-text", aliases: ["file"] },
  { value: "clipboard", label: "Clipboard", svgKey: "clipboard" },
  { value: "mail", label: "Mail", svgKey: "mail" },
  { value: "trophy", label: "Trophy", svgKey: "trophy" },

  { value: "pushpin", label: "Pushpin", svgKey: "pushpin", aliases: ["pin", "tack"] },
  { value: "wheelchair", label: "Wheelchair", svgKey: "wheelchair", aliases: ["accessible", "accessibility"] },
  { value: "barbell", label: "Barbell", svgKey: "dumbbell", aliases: ["gym", "sport", "exercise"] },
  { value: "trash-can", label: "Trash Can", svgKey: "trash-can", aliases: ["garbage", "bin"] },
  { value: "compass-rose", label: "Compass Rose", svgKey: "compass-rose", aliases: ["navigation"] },
  { value: "notes", label: "Notes", svgKey: "notes", aliases: ["document", "list"] },
  { value: "hanger", label: "Hanger", svgKey: "hanger", aliases: ["clothes", "wardrobe"] },
  { value: "envelope", label: "Envelope", svgKey: "envelope", aliases: ["message", "inbox"] },
  { value: "tooth", label: "Tooth", svgKey: "tooth", aliases: ["dental", "dentist"] },
  { value: "paw", label: "Paw", svgKey: "paw", aliases: ["pet", "animal"] },

  // Legacy-only mappings kept so existing saved bricks still render.
  { value: "gift", label: "Gift", svgKey: "star", legacyOnly: true },
  { value: "dumbbell", label: "Dumbbell", svgKey: "dumbbell", legacyOnly: true },
  { value: "list-todo", label: "Todo", svgKey: "file-text", legacyOnly: true },
  { value: "handbag", label: "Handbag", svgKey: "shopping-bag", legacyOnly: true },
  { value: "wallet", label: "Wallet", svgKey: "coins", legacyOnly: true },
  { value: "badge-check", label: "Badge Check", svgKey: "badge-plus", aliases: ["badge", "smile"], legacyOnly: true },
  { value: "armchair", label: "Armchair", svgKey: "sofa", legacyOnly: true },
];

export const brickIconMap: Record<string, string> = brickIconEntries.reduce(
  (acc, entry) => {
    acc[entry.value] = entry.svgKey;
    entry.aliases?.forEach((alias) => {
      acc[alias] = entry.svgKey;
    });
    return acc;
  },
  {} as Record<string, string>,
);

export const brickIconOptions: Array<{
  value: string;
  label: string;
  svgKey: string;
}> = brickIconEntries
  .filter((entry) => !entry.legacyOnly)
  .map(({ value, label, svgKey }) => ({ value, label, svgKey }));

export function getBrickSvg(key: string): string {
  return brickSvgData[key] ?? brickSvgData["grid-2x2"] ?? "";
}
